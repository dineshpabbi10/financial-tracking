import "server-only";
import {
  CATEGORY_IDS,
  categoryIsSpending,
  effectiveCategory,
  isCategoryId,
  type CategoryId,
} from "@/lib/categories";
import {
  addDays,
  lastNMonths,
  monthKey,
  monthRange,
  startOfMonth,
  today,
} from "@/lib/dates";
import { db } from "@/lib/db";
import { occurrencesBetween } from "@/lib/recurring";
import { buildTransactionAnalytics } from "@/lib/transaction-analytics";

export async function getAccounts() {
  return db.account.findMany({
    orderBy: [{ isDemo: "asc" }, { institution: "asc" }, { name: "asc" }],
  });
}

export interface UpcomingEvent {
  seriesId: string;
  merchantName: string;
  category: string;
  cadence: string;
  date: Date;
  amountCents: number;
  confidence: number;
}

export async function getDashboardData() {
  const anchor = today();
  const currentMonth = monthRange(monthKey(anchor));
  const previousMonthStart = startOfMonth(addDays(currentMonth.start, -1));
  const previousMonth = monthRange(monthKey(previousMonthStart));
  const months = lastNMonths(6, anchor);
  const windowEnd = addDays(anchor, 30);

  const [accounts, budgets, transactions, recentTransactions, recurring] =
    await Promise.all([
      getAccounts(),
      db.budget.findMany(),
      db.transaction.findMany({
        where: {
          pending: false,
          date: { gte: months[0].start, lte: months[months.length - 1].end },
        },
        select: {
          amountCents: true,
          date: true,
          category: true,
          categoryOverride: true,
        },
      }),
      db.transaction.findMany({
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 8,
        include: {
          account: {
            select: { name: true, mask: true, type: true, institution: true },
          },
        },
      }),
      db.recurringSeries.findMany({
        where: { isDismissed: false },
        orderBy: { nextExpectedDate: "asc" },
      }),
    ]);

  const cashCents = accounts
    .filter((a) => ["chequing", "savings", "investment"].includes(a.type))
    .reduce((sum, a) => sum + a.currentBalanceCents, 0);
  const debtCents = accounts
    .filter((a) => ["credit", "loan"].includes(a.type))
    .reduce((sum, a) => sum + Math.abs(a.currentBalanceCents), 0);

  const currentCategoryTotals = new Map<string, number>();
  const previousCategoryTotals = new Map<string, number>();
  const trendMap = new Map<string, { spend: number; income: number }>();
  for (const month of months) trendMap.set(month.key, { spend: 0, income: 0 });

  let currentSpend = 0;
  let currentIncome = 0;
  let previousSpend = 0;
  let previousIncome = 0;

  for (const tx of transactions) {
    const category = effectiveCategory(tx);
    const spending = categoryIsSpending(category);
    const income = category === "income";
    if (!spending && !income) continue;

    const inCurrent = tx.date >= currentMonth.start && tx.date <= currentMonth.end;
    const inPrevious =
      tx.date >= previousMonth.start && tx.date <= previousMonth.end;
    const point = trendMap.get(monthKey(tx.date));

    if (spending) {
      if (inCurrent) {
        currentSpend += tx.amountCents;
        currentCategoryTotals.set(
          category,
          (currentCategoryTotals.get(category) ?? 0) + tx.amountCents,
        );
      }
      if (inPrevious) {
        previousSpend += tx.amountCents;
        previousCategoryTotals.set(
          category,
          (previousCategoryTotals.get(category) ?? 0) + tx.amountCents,
        );
      }
      if (point) point.spend += tx.amountCents;
    } else if (income) {
      const amount = -tx.amountCents;
      if (inCurrent) currentIncome += amount;
      if (inPrevious) previousIncome += amount;
      if (point) point.income += amount;
    }
  }

  const categories = [...currentCategoryTotals.entries()]
    .map(([category, amountCents]) => ({
      category,
      amountCents,
      previousAmountCents: previousCategoryTotals.get(category) ?? 0,
    }))
    .filter((entry) => entry.amountCents !== 0)
    .sort((a, b) => b.amountCents - a.amountCents);

  const budgetOverview = budgets
    .filter((budget) => isCategoryId(budget.category))
    .map((budget) => {
      const spent = Math.max(0, currentCategoryTotals.get(budget.category) ?? 0);
      return {
        id: budget.id,
        category: budget.category as CategoryId,
        limitCents: budget.monthlyLimitCents,
        spentCents: spent,
        progress: budget.monthlyLimitCents
          ? spent / budget.monthlyLimitCents
          : 0,
      };
    })
    .sort((a, b) => b.progress - a.progress);

  const expenseSeries = recurring.filter((s) => s.direction === "expense");
  const upcomingEvents: UpcomingEvent[] = expenseSeries
    .flatMap((series) =>
      occurrencesBetween(series, anchor, windowEnd).map((date) => ({
        seriesId: series.id,
        merchantName: series.merchantName,
        category: series.category,
        cadence: series.cadence,
        date,
        amountCents: series.averageAmountCents,
        confidence: series.confidence,
      })),
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const upcomingTotalCents = upcomingEvents.reduce(
    (sum, event) => sum + event.amountCents,
    0,
  );

  const nextIncome = recurring
    .filter((series) => series.direction === "income")
    .flatMap((series) =>
      occurrencesBetween(series, anchor, windowEnd).map((date) => ({
        merchantName: series.merchantName,
        date,
        amountCents: series.averageAmountCents,
      })),
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime())[0];

  return {
    accounts,
    netWorthCents: cashCents - debtCents,
    cashCents,
    debtCents,
    currentMonth: {
      key: monthKey(anchor),
      spendCents: currentSpend,
      incomeCents: currentIncome,
      previousSpendCents: previousSpend,
      previousIncomeCents: previousIncome,
      spendChange:
        previousSpend > 0 ? (currentSpend - previousSpend) / previousSpend : null,
    },
    categories,
    trend: months.map((month) => ({
      key: month.key,
      label: month.label,
      spendCents: Math.max(0, trendMap.get(month.key)?.spend ?? 0),
      incomeCents: trendMap.get(month.key)?.income ?? 0,
    })),
    budgets: budgetOverview,
    upcoming: upcomingEvents.slice(0, 6),
    upcomingTotalCents,
    upcomingCount: upcomingEvents.length,
    nextIncome,
    recentTransactions,
  };
}

export interface TransactionFilters {
  q?: string;
  accountId?: string;
  category?: string;
  month?: string;
  page?: number;
}

export async function getTransactionPage(filters: TransactionFilters) {
  const pageSize = 50;
  const page = Math.max(1, filters.page ?? 1);
  const where: Record<string, unknown> = {};
  const and: Record<string, unknown>[] = [];

  if (filters.q?.trim()) {
    const q = filters.q.trim();
    and.push({
      OR: [{ name: { contains: q } }, { merchantName: { contains: q } }],
    });
  }
  if (filters.accountId) {
    and.push({ accountId: filters.accountId });
  }
  if (filters.category && isCategoryId(filters.category)) {
    and.push({
      OR: [
        { categoryOverride: filters.category },
        {
          AND: [
            {
              OR: [
                { categoryOverride: null },
                { categoryOverride: { notIn: [...CATEGORY_IDS] } },
              ],
            },
            { category: filters.category },
          ],
        },
      ],
    });
  }
  if (filters.month && /^\d{4}-\d{2}$/.test(filters.month)) {
    const range = monthRange(filters.month);
    and.push({ date: { gte: range.start, lte: range.end } });
  }
  if (and.length > 0) where.AND = and;

  const [transactions, accounts, analyticsTransactions] = await Promise.all([
    db.transaction.findMany({
      where,
      include: {
        account: {
          select: {
            name: true,
            mask: true,
            type: true,
            institution: true,
          },
        },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    getAccounts(),
    db.transaction.findMany({
      where,
      select: {
        amountCents: true,
        date: true,
        category: true,
        categoryOverride: true,
        pending: true,
      },
    }),
  ]);
  const total = analyticsTransactions.length;

  return {
    transactions,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    accounts,
    analytics: buildTransactionAnalytics(analyticsTransactions),
  };
}

export async function getRecurringOverview() {
  const anchor = today();
  const [series, accounts] = await Promise.all([
    db.recurringSeries.findMany({
      orderBy: [{ isDismissed: "asc" }, { nextExpectedDate: "asc" }],
    }),
    getAccounts(),
  ]);

  const active = series.filter((s) => !s.isDismissed);
  const expenses = active.filter((s) => s.direction === "expense");
  const events: UpcomingEvent[] = expenses
    .flatMap((s) =>
      occurrencesBetween(s, anchor, addDays(anchor, 30)).map((date) => ({
        seriesId: s.id,
        merchantName: s.merchantName,
        category: s.category,
        cadence: s.cadence,
        date,
        amountCents: s.averageAmountCents,
        confidence: s.confidence,
      })),
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const monthlyEquivalent = (cadence: string) => {
    switch (cadence) {
      case "weekly":
        return 52 / 12;
      case "biweekly":
        return 26 / 12;
      case "quarterly":
        return 1 / 3;
      default:
        return 1;
    }
  };
  const estimatedMonthlyCents = Math.round(
    expenses.reduce(
      (sum, s) => sum + s.averageAmountCents * monthlyEquivalent(s.cadence),
      0,
    ),
  );
  const next30TotalCents = expenses.reduce(
    (sum, s) =>
      sum +
      occurrencesBetween(s, anchor, addDays(anchor, 30)).length *
        s.averageAmountCents,
    0,
  );
  const incomeEvents = active
    .filter((s) => s.direction === "income")
    .flatMap((s) =>
      occurrencesBetween(s, anchor, addDays(anchor, 30)).map((date) => ({
        merchantName: s.merchantName,
        date,
        amountCents: s.averageAmountCents,
        seriesId: s.id,
      })),
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const income30Total = incomeEvents.reduce(
    (sum, event) => sum + Math.abs(event.amountCents),
    0,
  );

  return {
    series,
    expenses,
    accounts,
    events,
    estimatedMonthlyCents,
    next30TotalCents,
    nextIncome: incomeEvents[0],
    income30Total,
    windowEnd: addDays(anchor, 30),
  };
}

export async function getBudgetOverview(month?: string) {
  const anchor = today();
  const selectedKey = month && /^\d{4}-\d{2}$/.test(month) ? month : monthKey(anchor);
  const range = monthRange(selectedKey);
  const [budgets, transactions] = await Promise.all([
    db.budget.findMany(),
    db.transaction.findMany({
      where: { pending: false, date: { gte: range.start, lte: range.end } },
      select: {
        amountCents: true,
        category: true,
        categoryOverride: true,
      },
    }),
  ]);

  const totals = new Map<string, number>();
  for (const tx of transactions) {
    const category = effectiveCategory(tx);
    if (!categoryIsSpending(category)) continue;
    totals.set(category, (totals.get(category) ?? 0) + tx.amountCents);
  }

  const budgeted = budgets
    .filter((b) => isCategoryId(b.category))
    .map((b) => {
      const spent = Math.max(0, totals.get(b.category) ?? 0);
      return {
        id: b.id,
        category: b.category as CategoryId,
        limitCents: b.monthlyLimitCents,
        spentCents: spent,
        progress: b.monthlyLimitCents ? spent / b.monthlyLimitCents : 0,
      };
    })
    .sort((a, b) => b.progress - a.progress);

  const budgetedCategories = new Set(budgeted.map((b) => b.category));
  const unbudgetedTotals = [...totals.entries()]
    .filter(([category]) => !budgetedCategories.has(category as CategoryId))
    .map(([category, amount]) => ({
      category,
      amountCents: Math.max(0, amount),
    }))
    .sort((a, b) => b.amountCents - a.amountCents);

  return {
    month: selectedKey,
    months: lastNMonths(12, anchor),
    budgets: budgeted,
    unbudgetedTotals,
    totalLimitCents: budgeted.reduce((sum, b) => sum + b.limitCents, 0),
    totalSpentCents: budgeted.reduce((sum, b) => sum + b.spentCents, 0),
    spentAcrossAllCategories: [...totals.values()].reduce(
      (sum, value) => sum + Math.max(0, value),
      0,
    ),
  };
}

export async function getAccountsOverview() {
  const [accounts, counts, batches] = await Promise.all([
    getAccounts(),
    db.transaction.groupBy({
      by: ["accountId"],
      _count: { id: true },
      _max: { date: true },
    }),
    db.importBatch.groupBy({
      by: ["accountId"],
      _max: { createdAt: true },
    }),
  ]);
  const byAccount = new Map(counts.map((c) => [c.accountId, c]));
  const importsByAccount = new Map(
    batches.map((b) => [b.accountId, b._max.createdAt]),
  );

  const enriched = accounts.map((account) => ({
    ...account,
    transactionCount: byAccount.get(account.id)?._count.id ?? 0,
    lastTransactionDate: byAccount.get(account.id)?._max.date ?? null,
    lastImportAt: importsByAccount.get(account.id) ?? null,
  }));

  const groups = new Map<
    string,
    {
      institution: string;
      isDemo: boolean;
      accounts: typeof enriched;
      latestImportAt: Date | null;
    }
  >();
  for (const account of enriched) {
    const key = `${account.institution}|${account.isDemo}`;
    const existing = groups.get(key);
    if (existing) {
      existing.accounts.push(account);
      if (
        account.lastImportAt &&
        (!existing.latestImportAt || account.lastImportAt > existing.latestImportAt)
      ) {
        existing.latestImportAt = account.lastImportAt;
      }
    } else {
      groups.set(key, {
        institution: account.institution,
        isDemo: account.isDemo,
        accounts: [account],
        latestImportAt: account.lastImportAt,
      });
    }
  }

  const cashCents = accounts
    .filter((a) => ["chequing", "savings", "investment"].includes(a.type))
    .reduce((sum, a) => sum + a.currentBalanceCents, 0);
  const debtCents = accounts
    .filter((a) => ["credit", "loan"].includes(a.type))
    .reduce((sum, a) => sum + Math.abs(a.currentBalanceCents), 0);

  return {
    accounts: enriched,
    groups: [...groups.values()].sort((a, b) =>
      a.isDemo === b.isDemo
        ? a.institution.localeCompare(b.institution)
        : a.isDemo
          ? 1
          : -1,
    ),
    cashCents,
    debtCents,
    netWorthCents: cashCents - debtCents,
  };
}

export async function getImportHistory(limit = 12) {
  return db.importBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      account: {
        select: { name: true, institution: true, mask: true, type: true },
      },
    },
  });
}
