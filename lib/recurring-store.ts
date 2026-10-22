import "server-only";
import { effectiveCategory } from "@/lib/categories";
import { today } from "@/lib/dates";
import { db } from "@/lib/db";
import { detectRecurring } from "@/lib/recurring";

/**
 * Recompute recurring series from all posted transactions. Dismissed series
 * stay dismissed while they're still detected.
 */
export async function refreshRecurringSeries(): Promise<number> {
  const transactions = await db.transaction.findMany({
    where: { pending: false },
    select: {
      merchantName: true,
      name: true,
      amountCents: true,
      date: true,
      category: true,
      categoryOverride: true,
      pending: true,
    },
  });

  const detected = detectRecurring(
    transactions.map((tx) => ({
      merchantName: tx.merchantName,
      name: tx.name,
      amountCents: tx.amountCents,
      date: tx.date,
      category: effectiveCategory(tx),
      pending: tx.pending,
    })),
    { today: today() },
  );

  const existing = await db.recurringSeries.findMany({
    select: { merchantKey: true, direction: true, isDismissed: true },
  });
  const dismissed = new Map(
    existing.map((s) => [`${s.merchantKey}|${s.direction}`, s.isDismissed]),
  );
  const detectedKeys = new Set(detected.map((s) => `${s.merchantKey}|${s.direction}`));

  const stale = existing.filter(
    (s) => !detectedKeys.has(`${s.merchantKey}|${s.direction}`),
  );
  if (stale.length > 0) {
    await db.recurringSeries.deleteMany({
      where: {
        OR: stale.map((s) => ({
          merchantKey: s.merchantKey,
          direction: s.direction,
        })),
      },
    });
  }

  for (const series of detected) {
    const key = `${series.merchantKey}|${series.direction}`;
    const data = {
      merchantName: series.merchantName,
      category: series.category,
      cadence: series.cadence,
      intervalDays: series.intervalDays,
      averageAmountCents: series.averageAmountCents,
      lastAmountCents: series.lastAmountCents,
      lastDate: series.lastDate,
      nextExpectedDate: series.nextExpectedDate,
      confidence: series.confidence,
      transactionCount: series.transactionCount,
    };
    await db.recurringSeries.upsert({
      where: {
        merchantKey_direction: {
          merchantKey: series.merchantKey,
          direction: series.direction,
        },
      },
      update: data,
      create: {
        merchantKey: series.merchantKey,
        direction: series.direction,
        isDismissed: dismissed.get(key) ?? false,
        ...data,
      },
    });
  }

  return detected.length;
}
