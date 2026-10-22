import "server-only";
import type { AccountBase, Transaction as PlaidTransaction } from "plaid";
import { db } from "@/lib/db";
import { decryptPlaidSecret } from "@/lib/plaid/crypto";
import {
  getPlaidClient,
  logPlaidError,
  plaidErrorMessage,
} from "@/lib/plaid/config";
import {
  categorizePlaidTransaction,
  mapPlaidAccountType,
  plaidAccountName,
  plaidAmountToCents,
  plaidTransactionHash,
} from "@/lib/plaid/mapping";
import { parseDateOnly } from "@/lib/dates";
import { refreshRecurringSeries } from "@/lib/recurring-store";

const SYNC_PAGE_SIZE = 500;
const MAX_SYNC_PAGES = 100;

export interface PlaidSyncResult {
  connectionId: string;
  institutionName: string;
  accounts: number;
  added: number;
  modified: number;
  removed: number;
  skippedAccounts: number;
  warnings: string[];
  updateStatus: string | null;
}

export interface PlaidSyncSummary {
  connections: number;
  accounts: number;
  added: number;
  modified: number;
  removed: number;
  results: PlaidSyncResult[];
  errors: Array<{
    connectionId: string;
    institutionName: string;
    message: string;
  }>;
}

interface LocalAccount {
  id: string;
  plaidAccountId: string;
  currency: string;
}

function accountCurrency(account: AccountBase): string {
  return account.balances.iso_currency_code?.toUpperCase() ?? "CAD";
}

async function upsertPlaidAccounts(
  item: {
    id: string;
    institutionName: string | null;
  },
  accounts: AccountBase[],
): Promise<{ linked: LocalAccount[]; skipped: number }> {
  const linked: LocalAccount[] = [];
  let skipped = 0;

  for (const account of accounts) {
    const currency = accountCurrency(account);
    if (currency !== "CAD") {
      skipped += 1;
      continue;
    }
    const currentBalanceCents =
      account.balances.current === null ||
      account.balances.current === undefined
        ? 0
        : plaidAmountToCents(account.balances.current);
    const availableBalanceCents =
      account.balances.available === null ||
      account.balances.available === undefined
        ? null
        : plaidAmountToCents(account.balances.available);
    const base = {
      institution: item.institutionName ?? "Connected bank",
      mask: account.mask || null,
      currency,
      currentBalanceCents,
      availableBalanceCents,
      plaidItemId: item.id,
    };

    const existing = await db.account.findUnique({
      where: { plaidAccountId: account.account_id },
      select: { id: true, name: true, type: true, currency: true },
    });

    if (existing) {
      await db.account.update({
        where: { id: existing.id },
        data: {
          ...base,
          name: existing.name,
          type: existing.type,
        },
      });
      linked.push({
        id: existing.id,
        plaidAccountId: account.account_id,
        currency,
      });
    } else {
      const created = await db.account.create({
        data: {
          ...base,
          name: plaidAccountName(account),
          type: mapPlaidAccountType(account.type, account.subtype),
          plaidAccountId: account.account_id,
        },
      });
      linked.push({
        id: created.id,
        plaidAccountId: account.account_id,
        currency,
      });
    }
  }

  return { linked, skipped };
}

function plaidTransactionName(transaction: PlaidTransaction): string {
  return (
    transaction.merchant_name?.replace(/\s+/g, " ").trim() ||
    transaction.name?.replace(/\s+/g, " ").trim() ||
    "Transaction"
  );
}

async function upsertPlaidTransactions(
  transactions: PlaidTransaction[],
  accountByPlaidId: Map<string, LocalAccount>,
): Promise<{ written: number; warnings: string[] }> {
  if (transactions.length === 0) return { written: 0, warnings: [] };

  // Added and modified are processed together; if the same ID appears twice,
  // the modified version is the latest state.
  const latest = new Map<string, PlaidTransaction>();
  for (const transaction of transactions) {
    latest.set(transaction.transaction_id, transaction);
  }
  const rows = [...latest.values()];
  const hashes = rows.map((transaction) =>
    plaidTransactionHash(transaction.transaction_id),
  );
  const existing = await db.transaction.findMany({
    where: { importHash: { in: hashes } },
    select: { importHash: true, categoryOverride: true },
  });
  const existingByHash = new Map(existing.map((row) => [row.importHash, row]));

  let written = 0;
  const warnings: string[] = [];
  for (const transaction of rows) {
    const account = accountByPlaidId.get(transaction.account_id);
    if (!account) {
      warnings.push("Skipped a transaction for an account that is no longer linked.");
      continue;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(transaction.date)) {
      warnings.push("Skipped a transaction with an invalid date.");
      continue;
    }
    if (
      transaction.iso_currency_code &&
      transaction.iso_currency_code.toUpperCase() !== "CAD"
    ) {
      warnings.push(
        "Skipped a transaction in a non-CAD currency. Loonie currently tracks CAD amounts.",
      );
      continue;
    }
    const hash = plaidTransactionHash(transaction.transaction_id);
    const previous = existingByHash.get(hash);
    const amountCents = plaidAmountToCents(transaction.amount);
    const merchantName =
      transaction.merchant_name?.replace(/\s+/g, " ").trim() || null;
    const name = plaidTransactionName(transaction);
    const category = categorizePlaidTransaction({
      merchantName,
      name,
      amountCents,
      personalFinanceCategory: transaction.personal_finance_category,
    });
    const data = {
      accountId: account.id,
      importHash: hash,
      externalId: transaction.transaction_id,
      merchantName,
      name,
      amountCents,
      isoCurrency: "CAD",
      date: parseDateOnly(transaction.date),
      // Never rewrite the underlying auto-category for a user's manual choice.
      ...(previous?.categoryOverride ? {} : { category }),
      pending: transaction.pending,
      sourceCategory:
        transaction.personal_finance_category?.detailed ??
        transaction.personal_finance_category?.primary ??
        null,
      balanceCents:
        transaction.running_balance === null ||
        transaction.running_balance === undefined
          ? null
          : plaidAmountToCents(transaction.running_balance),
    };

    await db.transaction.upsert({
      where: { importHash: hash },
      update: data,
      create: { ...data, category },
    });
    written += 1;
  }
  return { written, warnings };
}

async function syncPlaidItemRecord(item: {
  id: string;
  itemId: string;
  institutionName: string | null;
  accessTokenEncrypted: string;
  cursor: string | null;
}): Promise<PlaidSyncResult> {
  const client = getPlaidClient();
  const accessToken = decryptPlaidSecret(item.accessTokenEncrypted);
  let cursor = item.cursor ?? undefined;
  let added = 0;
  let modified = 0;
  let removed = 0;
  let accountsCount = 0;
  let skippedAccounts = 0;
  let updateStatus: string | null = null;
  const warnings = new Set<string>();

  try {
    const accountsResponse = await client.accountsGet({ access_token: accessToken });
    const linked = await upsertPlaidAccounts(item, accountsResponse.data.accounts);
    accountsCount = linked.linked.length;
    skippedAccounts = linked.skipped;
    if (skippedAccounts > 0) {
      warnings.add(
        `${skippedAccounts} non-CAD ${
          skippedAccounts === 1 ? "account was" : "accounts were"
        } skipped. Loonie currently tracks CAD accounts.`,
      );
    }
    const byPlaidId = new Map(
      linked.linked.map((account) => [account.plaidAccountId, account]),
    );

    let hasMore = true;
    let pages = 0;
    while (hasMore && pages < MAX_SYNC_PAGES) {
      const page = await client.transactionsSync({
        access_token: accessToken,
        ...(cursor ? { cursor } : {}),
        count: SYNC_PAGE_SIZE,
      });
      pages += 1;
      updateStatus = page.data.transactions_update_status;
      added += page.data.added.length;
      modified += page.data.modified.length;

      const writes = await upsertPlaidTransactions(
        [...page.data.added, ...page.data.modified],
        byPlaidId,
      );
      for (const warning of writes.warnings) warnings.add(warning);

      if (page.data.removed.length > 0) {
        const hashes = page.data.removed.map((entry) =>
          plaidTransactionHash(entry.transaction_id),
        );
        const deleted = await db.transaction.deleteMany({
          where: { importHash: { in: hashes } },
        });
        removed += deleted.count;
      }

      cursor = page.data.next_cursor || undefined;
      await db.plaidItem.update({
        where: { id: item.id },
        data: { cursor: cursor ?? null },
      });
      hasMore = page.data.has_more;
    }
    if (hasMore) {
      warnings.add(
        "This bank has more history than one sync can fetch. Run Sync now again to continue.",
      );
    }

    await db.plaidItem.update({
      where: { id: item.id },
      data: {
        lastSyncedAt: new Date(),
        lastSyncError: null,
      },
    });
    if (added > 0 || modified > 0 || removed > 0) {
      await refreshRecurringSeries();
    }

    if (updateStatus === "NOT_READY") {
      warnings.add(
        "Plaid is still preparing this bank's transaction history. Sync again in a minute.",
      );
    }

    return {
      connectionId: item.id,
      institutionName: item.institutionName ?? "Connected bank",
      accounts: accountsCount,
      added,
      modified,
      removed,
      skippedAccounts,
      warnings: [...warnings],
      updateStatus,
    };
  } catch (error) {
    const message = plaidErrorMessage(error);
    await db.plaidItem.update({
      where: { id: item.id },
      data: { lastSyncError: message.slice(0, 500) },
    });
    logPlaidError(`sync ${item.itemId}`, error);
    throw new Error(message);
  }
}

export async function syncPlaidItem(
  connectionId: string,
): Promise<PlaidSyncResult> {
  const item = await db.plaidItem.findUnique({
    where: { id: connectionId },
    select: {
      id: true,
      itemId: true,
      institutionName: true,
      accessTokenEncrypted: true,
      cursor: true,
    },
  });
  if (!item) throw new Error("Bank connection not found.");
  return syncPlaidItemRecord(item);
}

export async function syncAllPlaidItems(): Promise<PlaidSyncSummary> {
  const items = await db.plaidItem.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      itemId: true,
      institutionName: true,
      accessTokenEncrypted: true,
      cursor: true,
    },
  });

  const summary: PlaidSyncSummary = {
    connections: items.length,
    accounts: 0,
    added: 0,
    modified: 0,
    removed: 0,
    results: [],
    errors: [],
  };
  for (const item of items) {
    try {
      const result = await syncPlaidItemRecord(item);
      summary.results.push(result);
      summary.accounts += result.accounts;
      summary.added += result.added;
      summary.modified += result.modified;
      summary.removed += result.removed;
    } catch (error) {
      logPlaidError(`sync all ${item.itemId}`, error);
      summary.errors.push({
        connectionId: item.id,
        institutionName: item.institutionName ?? "Connected bank",
        message: error instanceof Error ? error.message : "Sync failed.",
      });
    }
  }
  return summary;
}

/** Used by the webhook route after Plaid verifies the event. */
export async function syncPlaidItemByPlaidId(
  plaidItemId: string,
): Promise<PlaidSyncResult | null> {
  const item = await db.plaidItem.findUnique({
    where: { itemId: plaidItemId },
    select: { id: true },
  });
  if (!item) return null;
  return syncPlaidItem(item.id);
}
