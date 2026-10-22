import { describe, expect, it } from "vitest";
import {
  buildTransactionAnalytics,
  type AnalyticsTransaction,
} from "@/lib/transaction-analytics";

function day(year: number, month: number, date: number): Date {
  return new Date(Date.UTC(year, month - 1, date, 12));
}

function transaction(
  overrides: Partial<AnalyticsTransaction> = {},
): AnalyticsTransaction {
  return {
    amountCents: 1000,
    date: day(2026, 5, 10),
    category: "groceries",
    categoryOverride: null,
    pending: false,
    ...overrides,
  };
}

describe("buildTransactionAnalytics", () => {
  it("totals spending, income, and categories while excluding transfers", () => {
    const analytics = buildTransactionAnalytics([
      transaction({ amountCents: 1000, pending: true }),
      transaction({ amountCents: -200 }),
      transaction({
        amountCents: 2000,
        category: "dining",
        date: day(2026, 4, 20),
      }),
      transaction({
        amountCents: -5000,
        category: "income",
        date: day(2026, 4, 1),
      }),
      transaction({ amountCents: 300, category: "transfers" }),
    ]);

    expect(analytics).toMatchObject({
      spendCents: 2800,
      incomeCents: 5000,
      netCents: 2200,
      spendCount: 3,
      incomeCount: 1,
      pendingCount: 1,
    });
    expect(analytics.categories).toEqual([
      { category: "dining", amountCents: 2000 },
      { category: "groceries", amountCents: 800 },
    ]);
    expect(analytics.monthly).toEqual([
      {
        key: "2026-04",
        label: "Apr 2026",
        spendCents: 2000,
        incomeCents: 5000,
      },
      {
        key: "2026-05",
        label: "May 2026",
        spendCents: 800,
        incomeCents: 0,
      },
    ]);
  });

  it("honours category overrides and income reversals", () => {
    const analytics = buildTransactionAnalytics([
      transaction({ amountCents: 1200, category: "shopping", categoryOverride: "dining" }),
      transaction({ amountCents: -500, category: "groceries", categoryOverride: "dining" }),
      transaction({ amountCents: -4000, category: "income" }),
      transaction({ amountCents: 100, category: "income" }),
    ]);

    expect(analytics.spendCents).toBe(700);
    expect(analytics.incomeCents).toBe(3900);
    expect(analytics.categories).toEqual([{ category: "dining", amountCents: 700 }]);
  });

  it("limits the monthly series to the latest months without losing totals", () => {
    const analytics = buildTransactionAnalytics(
      [
        transaction({ date: day(2025, 1, 5), amountCents: 100 }),
        transaction({ date: day(2025, 2, 5), amountCents: 200 }),
        transaction({ date: day(2025, 3, 5), amountCents: 300 }),
      ],
      { maxMonths: 2 },
    );

    expect(analytics.spendCents).toBe(600);
    expect(analytics.monthly.map((month) => month.key)).toEqual([
      "2025-02",
      "2025-03",
    ]);
    expect(analytics.monthlyTruncated).toBe(true);
  });
});
