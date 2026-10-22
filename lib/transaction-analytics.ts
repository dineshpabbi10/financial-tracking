import {
  categoryIsSpending,
  effectiveCategory,
  type CategoryId,
} from "@/lib/categories";
import { formatMonth, monthKey, monthKeyToDate } from "@/lib/dates";

export interface AnalyticsTransaction {
  amountCents: number;
  date: Date;
  category: string;
  categoryOverride?: string | null;
  pending?: boolean;
}

export interface TransactionMonthTotal {
  key: string;
  label: string;
  spendCents: number;
  incomeCents: number;
}

export interface TransactionCategoryTotal {
  category: CategoryId;
  amountCents: number;
}

export interface TransactionAnalytics {
  spendCents: number;
  incomeCents: number;
  netCents: number;
  spendCount: number;
  incomeCount: number;
  pendingCount: number;
  monthly: TransactionMonthTotal[];
  monthlyTruncated: boolean;
  categories: TransactionCategoryTotal[];
}

/**
 * Build the transaction-page summary from the same filtered set as the list.
 * Positive amounts are spending; negative amounts in the income category are
 * income. Transfers and other non-income categories are left out.
 *
 * Pending transactions are included so the totals match what is visible in the
 * list. The UI notes that they are included.
 */
export function buildTransactionAnalytics(
  transactions: AnalyticsTransaction[],
  options: { maxMonths?: number } = {},
): TransactionAnalytics {
  const maxMonths = options.maxMonths ?? 12;
  let spendCents = 0;
  let incomeCents = 0;
  let spendCount = 0;
  let incomeCount = 0;
  let pendingCount = 0;
  const monthTotals = new Map<
    string,
    { spendCents: number; incomeCents: number }
  >();
  const categoryTotals = new Map<CategoryId, number>();

  for (const transaction of transactions) {
    if (transaction.pending) pendingCount += 1;

    const category = effectiveCategory(transaction);
    const spending = categoryIsSpending(category);
    const income = category === "income";
    if (!spending && !income) continue;

    const key = monthKey(transaction.date);
    const month = monthTotals.get(key) ?? { spendCents: 0, incomeCents: 0 };

    if (spending) {
      spendCents += transaction.amountCents;
      spendCount += 1;
      categoryTotals.set(
        category,
        (categoryTotals.get(category) ?? 0) + transaction.amountCents,
      );
      month.spendCents += transaction.amountCents;
    } else {
      const amount = -transaction.amountCents;
      incomeCents += amount;
      incomeCount += 1;
      month.incomeCents += amount;
    }

    monthTotals.set(key, month);
  }

  const allMonths = [...monthTotals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, totals]) => ({
      key,
      label: formatMonth(monthKeyToDate(key)),
      spendCents: totals.spendCents,
      incomeCents: totals.incomeCents,
    }));

  const monthly = allMonths.slice(-maxMonths);
  const categories = [...categoryTotals.entries()]
    .map(([category, amountCents]) => ({ category, amountCents }))
    .filter((entry) => entry.amountCents > 0)
    .sort((a, b) => b.amountCents - a.amountCents);

  return {
    spendCents,
    incomeCents,
    netCents: incomeCents - spendCents,
    spendCount,
    incomeCount,
    pendingCount,
    monthly,
    monthlyTruncated: allMonths.length > monthly.length,
    categories,
  };
}
