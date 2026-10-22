import "server-only";
import { db } from "@/lib/db";
import { formatDate, relativeDateLabel, today } from "@/lib/dates";
import { plaidConfigStatus } from "@/lib/plaid/config";
import type {
  PlaidConnectionSummary,
  PlaidOverview,
} from "@/lib/plaid/types";

export async function getPlaidOverview(): Promise<PlaidOverview> {
  const status = plaidConfigStatus();
  const [demoCount, items] = await Promise.all([
    db.account.count({ where: { isDemo: true } }),
    db.plaidItem.findMany({
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        institutionName: true,
        lastSyncedAt: true,
        lastSyncError: true,
        accounts: {
          select: { id: true, name: true, mask: true, type: true },
          orderBy: { name: "asc" },
        },
      },
    }),
  ]);

  const summaries: PlaidConnectionSummary[] = items.map((item) => ({
    id: item.id,
    institutionName: item.institutionName ?? "Connected bank",
    accountCount: item.accounts.length,
    accounts: item.accounts,
    lastSyncedLabel: item.lastSyncedAt
      ? relativeDateLabel(item.lastSyncedAt, today())
      : "Not synced yet",
    lastSyncedExact: item.lastSyncedAt ? formatDate(item.lastSyncedAt) : null,
    lastSyncError: item.lastSyncError,
  }));

  return {
    configured: status.configured,
    env: status.env,
    maxItems: status.maxItems,
    missing: status.missing,
    redirectConfigured: Boolean(status.redirectUri),
    webhookConfigured: status.webhookConfigured,
    demo: demoCount > 0,
    items: summaries,
    totalItems: summaries.length,
  };
}
