import { NextResponse } from "next/server";
import { CountryCode } from "plaid";
import { z } from "zod";
import {
  ApiError,
  assertSameOrigin,
  jsonError,
  readJson,
  requireApiSession,
} from "@/lib/api";
import { db } from "@/lib/db";
import { encryptPlaidSecret } from "@/lib/plaid/crypto";
import {
  getPlaidClient,
  isPlaidConfigured,
  logPlaidError,
  plaidConfigStatus,
  plaidErrorMessage,
} from "@/lib/plaid/config";
import { syncPlaidItem } from "@/lib/plaid/sync";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  publicToken: z.string().trim().min(10).max(500),
  institutionName: z.string().trim().max(120).optional(),
});

function cleanText(value: string | null | undefined): string | null {
  const cleaned = value?.replace(/\s+/g, " ").trim();
  return cleaned || null;
}

export async function POST(request: Request) {
  let accessToken: string | null = null;
  let savedItemId: string | null = null;

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
    if ((await db.plaidItem.count()) >= status.maxItems) {
      throw new ApiError(
        `This Loonie setup has reached its ${status.maxItems}-connection Plaid limit. Disconnect a bank before adding another.`,
        409,
      );
    }

    const body = await readJson(request, bodySchema);
    const client = getPlaidClient();
    const exchange = await client.itemPublicTokenExchange({
      public_token: body.publicToken,
    });
    accessToken = exchange.data.access_token;
    const plaidItemId = exchange.data.item_id;

    let institutionId: string | null = null;
    let institutionName = cleanText(body.institutionName) ?? "Connected bank";
    try {
      const itemResponse = await client.itemGet({ access_token: accessToken });
      institutionId = itemResponse.data.item.institution_id ?? null;
      if (institutionId) {
        const institution = await client.institutionsGetById({
          institution_id: institutionId,
          country_codes: [CountryCode.Ca],
        });
        institutionName =
          cleanText(institution.data.institution.name) ?? institutionName;
      }
    } catch (error) {
      // The Item is valid even if this metadata lookup has a hiccup. Link
      // metadata is only a display fallback.
      logPlaidError("institution metadata", error);
    }

    const item = await db.plaidItem.upsert({
      where: { itemId: plaidItemId },
      update: {
        accessTokenEncrypted: encryptPlaidSecret(accessToken),
        institutionId,
        institutionName,
      },
      create: {
        itemId: plaidItemId,
        accessTokenEncrypted: encryptPlaidSecret(accessToken),
        institutionId,
        institutionName,
      },
      select: { id: true, institutionName: true },
    });
    savedItemId = item.id;

    let syncWarning: string | null = null;
    try {
      await syncPlaidItem(item.id);
    } catch (error) {
      syncWarning =
        error instanceof Error
          ? error.message
          : "The bank was linked, but the first sync failed.";
    }

    return NextResponse.json({
      ok: true,
      connection: {
        id: item.id,
        institutionName: item.institutionName,
      },
      syncWarning,
    });
  } catch (error) {
    if (accessToken && !savedItemId) {
      // Don't leave an active Plaid Item behind if our database write failed.
      try {
        await getPlaidClient().itemRemove({ access_token: accessToken });
      } catch (cleanupError) {
        logPlaidError("exchange cleanup", cleanupError);
      }
    }
    if (error instanceof ApiError) {
      return jsonError(error.message, error.status);
    }
    logPlaidError("exchange", error);
    return jsonError(plaidErrorMessage(error), 502);
  }
}
