import { NextResponse } from "next/server";
import { CountryCode, Products } from "plaid";
import {
  ApiError,
  assertSameOrigin,
  jsonError,
  requireApiSession,
} from "@/lib/api";
import {
  getPlaidClient,
  isPlaidConfigured,
  logPlaidError,
  plaidConfigStatus,
  plaidErrorMessage,
  plaidRedirectUri,
  plaidWebhookUrl,
} from "@/lib/plaid/config";
import { db } from "@/lib/db";

export const runtime = "nodejs";

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
    if (await db.account.count({ where: { isDemo: true } })) {
      throw new ApiError(
        "Clear the demo data before connecting a real bank.",
        409,
      );
    }
    const status = plaidConfigStatus();
    const itemCount = await db.plaidItem.count();
    if (itemCount >= status.maxItems) {
      throw new ApiError(
        `This Loonie setup has reached its ${status.maxItems}-connection Plaid limit. Disconnect a bank before adding another.`,
        409,
      );
    }

    const redirectUri = plaidRedirectUri();
    const webhook = plaidWebhookUrl();
    const response = await getPlaidClient().linkTokenCreate({
      user: { client_user_id: "loonie-owner" },
      client_name: "Loonie",
      language: "en",
      country_codes: [CountryCode.Ca],
      products: [Products.Transactions],
      transactions: { days_requested: 730 },
      ...(redirectUri ? { redirect_uri: redirectUri } : {}),
      ...(webhook ? { webhook } : {}),
    });

    return NextResponse.json({
      linkToken: response.data.link_token,
      expiration: response.data.expiration,
      env: status.env,
      redirectUri,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return jsonError(error.message, error.status);
    }
    logPlaidError("link-token", error);
    return jsonError(plaidErrorMessage(error), 502);
  }
}
