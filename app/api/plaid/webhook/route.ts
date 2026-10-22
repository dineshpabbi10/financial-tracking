import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import {
  decodeProtectedHeader,
  importJWK,
  jwtVerify,
  type JWK,
  type JWTPayload,
} from "jose";
import {
  getPlaidClient,
  logPlaidError,
  plaidConfigStatus,
} from "@/lib/plaid/config";
import { syncPlaidItemByPlaidId } from "@/lib/plaid/sync";

export const runtime = "nodejs";
export const maxDuration = 60;

interface PlaidWebhookBody {
  webhook_type?: string;
  webhook_code?: string;
  item_id?: string;
  environment?: string;
}

export async function POST(request: Request) {
  const status = plaidConfigStatus();
  if (!status.configured) {
    return NextResponse.json({ error: "Plaid is not configured." }, { status: 503 });
  }

  const rawBody = await request.text();
  const verificationToken = request.headers.get("plaid-verification");
  if (!verificationToken) {
    return NextResponse.json({ error: "Missing verification." }, { status: 401 });
  }

  let keyId: string;
  try {
    const header = decodeProtectedHeader(verificationToken);
    if (!header.kid) {
      return NextResponse.json({ error: "Invalid verification." }, { status: 401 });
    }
    keyId = header.kid;
  } catch {
    return NextResponse.json({ error: "Invalid verification." }, { status: 401 });
  }

  let verificationKey: JWK;
  try {
    const keyResponse = await getPlaidClient().webhookVerificationKeyGet({
      key_id: keyId,
    });
    verificationKey = keyResponse.data.key as JWK;
  } catch (error) {
    logPlaidError("webhook key", error);
    return NextResponse.json({ error: "Verification unavailable." }, { status: 500 });
  }

  let payload: JWTPayload;
  try {
    const publicKey = await importJWK(verificationKey, "ES256");
    const verified = await jwtVerify(verificationToken, publicKey, {
      algorithms: ["ES256"],
      maxTokenAge: "5 min",
    });
    payload = verified.payload;
  } catch {
    return NextResponse.json({ error: "Invalid verification." }, { status: 401 });
  }

  const expectedHash = createHash("sha256").update(rawBody).digest("hex");
  if (
    typeof payload.request_body_sha256 !== "string" ||
    payload.request_body_sha256 !== expectedHash
  ) {
    return NextResponse.json({ error: "Invalid verification." }, { status: 401 });
  }

  let body: PlaidWebhookBody;
  try {
    body = JSON.parse(rawBody) as PlaidWebhookBody;
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  if (body.environment && body.environment !== status.env) {
    return NextResponse.json({ ok: true, ignored: "environment" });
  }
  if (body.webhook_type !== "TRANSACTIONS" || !body.item_id) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    const result = await syncPlaidItemByPlaidId(body.item_id);
    return NextResponse.json({ ok: true, synced: Boolean(result) });
  } catch (error) {
    logPlaidError("webhook sync", error);
    return NextResponse.json({ error: "Sync failed." }, { status: 500 });
  }
}
