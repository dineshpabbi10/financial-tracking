import { NextResponse } from "next/server";
import {
  ApiError,
  assertSameOrigin,
  jsonError,
  requireApiSession,
} from "@/lib/api";
import { db } from "@/lib/db";
import { decryptPlaidSecret } from "@/lib/plaid/crypto";
import {
  getPlaidClient,
  isPlaidConfigured,
  logPlaidError,
  plaidErrorDetails,
} from "@/lib/plaid/config";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    await requireApiSession();
    const { id } = await params;
    const item = await db.plaidItem.findUnique({
      where: { id },
      select: {
        id: true,
        itemId: true,
        accessTokenEncrypted: true,
        institutionName: true,
      },
    });
    if (!item) throw new ApiError("Bank connection not found.", 404);

    let revocationWarning: string | null = null;
    if (isPlaidConfigured()) {
      try {
        const accessToken = decryptPlaidSecret(item.accessTokenEncrypted);
        await getPlaidClient().itemRemove({ access_token: accessToken });
      } catch (error) {
        const code = plaidErrorDetails(error).code;
        if (code !== "ITEM_NOT_FOUND" && code !== "INVALID_ACCESS_TOKEN") {
          logPlaidError(`disconnect ${item.itemId}`, error);
          revocationWarning =
            "The local connection was removed, but Plaid could not confirm that access was revoked. Remove Loonie from your Plaid dashboard if you want to revoke it there too.";
        }
      }
    } else {
      revocationWarning =
        "The local connection was removed, but Plaid is not configured, so Loonie could not revoke the Item at Plaid. Remove it from your Plaid dashboard if needed.";
    }

    // Accounts and their transaction history stay in Loonie as manual accounts.
    // PlaidItem's onDelete: SetNull relation clears the account link.
    await db.plaidItem.delete({ where: { id: item.id } });

    return NextResponse.json({
      ok: true,
      warning: revocationWarning,
      institutionName: item.institutionName,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return jsonError(error.message, error.status);
    }
    logPlaidError("disconnect route", error);
    return jsonError("Could not disconnect that bank.", 500);
  }
}
