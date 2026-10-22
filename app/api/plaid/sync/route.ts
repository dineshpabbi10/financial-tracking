import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiError,
  assertSameOrigin,
  jsonError,
  requireApiSession,
} from "@/lib/api";
import {
  isPlaidConfigured,
  logPlaidError,
  plaidErrorMessage,
} from "@/lib/plaid/config";
import { syncAllPlaidItems, syncPlaidItem } from "@/lib/plaid/sync";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  connectionId: z.string().trim().min(1).max(100).optional(),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await requireApiSession();
    if (!isPlaidConfigured()) {
      throw new ApiError(
        "Plaid is not configured yet. Add the Plaid environment variables and restart Loonie.",
        503,
      );
    }
    const body = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) throw new ApiError("Invalid sync request.");

    if (parsed.data.connectionId) {
      const result = await syncPlaidItem(parsed.data.connectionId);
      return NextResponse.json({
        ok: true,
        connections: 1,
        accounts: result.accounts,
        added: result.added,
        modified: result.modified,
        removed: result.removed,
        results: [result],
        errors: [],
      });
    }

    const summary = await syncAllPlaidItems();
    return NextResponse.json({ ok: summary.errors.length === 0, ...summary });
  } catch (error) {
    if (error instanceof ApiError) {
      return jsonError(error.message, error.status);
    }
    logPlaidError("sync route", error);
    return jsonError(plaidErrorMessage(error), 502);
  }
}
