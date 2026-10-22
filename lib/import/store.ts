import "server-only";
import type { Prisma } from "@prisma/client";
import { categorizeTransaction } from "@/lib/categories";
import { parseDateOnly } from "@/lib/dates";
import { db } from "@/lib/db";
import { refreshRecurringSeries } from "@/lib/recurring-store";
import { buildFingerprints } from "@/lib/import/fingerprint";
import type { CsvMapping } from "@/lib/import/types";

export interface CommitRowInput {
  date: string;
  description: string;
  merchantName?: string | null;
  amountCents: number;
  balanceCents?: number | null;
  externalId?: string | null;
  sourceCategory?: string | null;
}

export interface CommitImportInput {
  accountId: string;
  filename: string;
  fileKind: "csv" | "ofx" | "pdf";
  bankPreset?: string | null;
  mapping?: CsvMapping | null;
  updateBalance: boolean;
  accountBalanceCents?: number | null;
  rows: CommitRowInput[];
}

export async function commitImport(input: CommitImportInput): Promise<{
  batchId: string | null;
  imported: number;
  skipped: number;
  periodStart: string | null;
  periodEnd: string | null;
  balanceUpdated: boolean;
}> {
  const account = await db.account.findUnique({ where: { id: input.accountId } });
  if (!account) throw new Error("Account not found.");
  if (account.isDemo) {
    throw new Error(
      "Demo accounts can't receive real imports. Clear the demo data first.",
    );
  }

  const fingerprints = buildFingerprints(account.id, input.rows);
  const hashes = fingerprints.map((entry) => entry.hash);
  const existing = await db.transaction.findMany({
    where: { importHash: { in: hashes } },
    select: { importHash: true },
  });
  const existingHashes = new Set(existing.map((tx) => tx.importHash));

  const toCreate = fingerprints.filter((entry) => !existingHashes.has(entry.hash));
  const skipped = input.rows.length - toCreate.length;

  if (toCreate.length === 0) {
    return {
      batchId: null,
      imported: 0,
      skipped,
      periodStart: null,
      periodEnd: null,
      balanceUpdated: false,
    };
  }

  const dates = toCreate.map((entry) => entry.row.date).sort();
  const periodStart = dates[0];
  const periodEnd = dates[dates.length - 1];

  const rowsWithBalances = toCreate
    .map((entry) => entry.row)
    .filter(
      (row): row is CommitRowInput & { balanceCents: number } =>
        typeof row.balanceCents === "number" && Number.isFinite(row.balanceCents),
    );
  const latestBalance =
    rowsWithBalances.length > 0
      ? rowsWithBalances.reduce((latest, row) =>
          row.date >= latest.date ? row : latest,
        ).balanceCents
      : null;
  const balanceToSet =
    input.updateBalance
      ? input.accountBalanceCents ?? latestBalance
      : null;
  const savedMapping =
    input.fileKind === "csv" && input.mapping
      ? JSON.stringify(input.mapping)
      : null;

  const transactions: Prisma.TransactionCreateManyInput[] = toCreate.map(
    ({ row, hash }) => ({
      accountId: account.id,
      importHash: hash,
      externalId: row.externalId ?? null,
      merchantName: row.merchantName?.trim() || null,
      name: row.description.trim(),
      amountCents: row.amountCents,
      isoCurrency: account.currency,
      date: parseDateOnly(row.date),
      category: categorizeTransaction({
        merchantName: row.merchantName,
        name: row.description,
      }),
      sourceCategory: row.sourceCategory ?? null,
      balanceCents: row.balanceCents ?? null,
      pending: false,
    }),
  );

  const batch = await db.$transaction(async (tx) => {
    const created = await tx.importBatch.create({
      data: {
        accountId: account.id,
        filename: input.filename.slice(0, 255),
        fileKind: input.fileKind,
        bankPreset: input.bankPreset ?? account.bankPreset ?? null,
        transactionsImported: toCreate.length,
        transactionsSkipped: skipped,
        periodStart: parseDateOnly(periodStart),
        periodEnd: parseDateOnly(periodEnd),
        accountBalanceBeforeCents:
          balanceToSet !== null ? account.currentBalanceCents : null,
        accountBalanceAfterCents: balanceToSet,
      },
    });
    await tx.transaction.createMany({
      data: transactions.map((row) => ({ ...row, importBatchId: created.id })),
    });
    if (balanceToSet !== null || savedMapping) {
      await tx.account.update({
        where: { id: account.id },
        data: {
          ...(balanceToSet !== null ? { currentBalanceCents: balanceToSet } : {}),
          ...(savedMapping ? { csvMapping: savedMapping } : {}),
        },
      });
    }
    return created;
  });

  await refreshRecurringSeries();

  return {
    batchId: batch.id,
    imported: toCreate.length,
    skipped,
    periodStart,
    periodEnd,
    balanceUpdated: balanceToSet !== null,
  };
}

export async function deleteImportBatch(id: string): Promise<boolean> {
  const batch = await db.importBatch.findUnique({
    where: { id },
    select: {
      id: true,
      accountId: true,
      accountBalanceBeforeCents: true,
      accountBalanceAfterCents: true,
    },
  });
  if (!batch) return false;

  await db.$transaction(async (tx) => {
    await tx.importBatch.delete({ where: { id } });
    if (batch.accountBalanceAfterCents !== null) {
      // Restore the balance only if no later import has replaced the snapshot
      // since this one. Otherwise leave the newer statement balance intact.
      const account = await tx.account.findUnique({
        where: { id: batch.accountId },
        select: { currentBalanceCents: true },
      });
      if (
        account &&
        account.currentBalanceCents === batch.accountBalanceAfterCents
      ) {
        await tx.account.update({
          where: { id: batch.accountId },
          data: {
            currentBalanceCents: batch.accountBalanceBeforeCents ?? 0,
          },
        });
      }
    }
  });
  await refreshRecurringSeries();
  return true;
}
