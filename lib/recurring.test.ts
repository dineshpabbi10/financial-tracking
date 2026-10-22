import { describe, expect, it } from "vitest";
import {
  detectRecurring,
  occurrencesBetween,
  type RecurringTransactionInput,
} from "@/lib/recurring";

function day(year: number, month: number, date: number): Date {
  return new Date(Date.UTC(year, month - 1, date, 12));
}

function charge(
  date: Date,
  overrides: Partial<RecurringTransactionInput> = {},
): RecurringTransactionInput {
  return {
    merchantName: "NETFLIX",
    name: "NETFLIX.COM",
    amountCents: 1699,
    date,
    category: "subscriptions",
    ...overrides,
  };
}

describe("detectRecurring", () => {
  it("detects a stable monthly subscription", () => {
    const detected = detectRecurring(
      [
        charge(day(2026, 1, 5)),
        charge(day(2026, 2, 5)),
        charge(day(2026, 3, 5)),
        charge(day(2026, 4, 5)),
        charge(day(2026, 5, 5)),
      ],
      { today: day(2026, 5, 20) },
    );

    expect(detected).toHaveLength(1);
    expect(detected[0]).toMatchObject({
      merchantName: "Netflix",
      category: "subscriptions",
      direction: "expense",
      cadence: "monthly",
      averageAmountCents: 1699,
      transactionCount: 5,
    });
    expect(detected[0].confidence).toBeGreaterThan(0.8);
    expect(detected[0].nextExpectedDate.toISOString().slice(0, 10)).toBe(
      "2026-06-05",
    );
  });

  it("detects biweekly income", () => {
    const detected = detectRecurring(
      [
        charge(day(2026, 1, 2), {
          merchantName: "ACME CORP PAYROLL",
          name: "ACME CORP PAYROLL",
          amountCents: -365000,
          category: "income",
        }),
        charge(day(2026, 1, 16), {
          merchantName: "ACME CORP PAYROLL",
          name: "ACME CORP PAYROLL",
          amountCents: -365000,
          category: "income",
        }),
        charge(day(2026, 1, 30), {
          merchantName: "ACME CORP PAYROLL",
          name: "ACME CORP PAYROLL",
          amountCents: -365000,
          category: "income",
        }),
        charge(day(2026, 2, 13), {
          merchantName: "ACME CORP PAYROLL",
          name: "ACME CORP PAYROLL",
          amountCents: -365000,
          category: "income",
        }),
      ],
      { today: day(2026, 2, 20) },
    );

    expect(detected).toHaveLength(1);
    expect(detected[0]).toMatchObject({
      direction: "income",
      cadence: "biweekly",
      averageAmountCents: -365000,
      transactionCount: 4,
    });
  });

  it("does not call two isolated purchases recurring", () => {
    expect(
      detectRecurring([charge(day(2026, 4, 5)), charge(day(2026, 5, 5))], {
        today: day(2026, 5, 20),
      }),
    ).toEqual([]);
  });
});

describe("occurrencesBetween", () => {
  it("projects each occurrence inside the window", () => {
    const dates = occurrencesBetween(
      { nextExpectedDate: day(2026, 5, 20), intervalDays: 30 },
      day(2026, 5, 1),
      day(2026, 7, 31),
    ).map((date) => date.toISOString().slice(0, 10));

    expect(dates).toEqual(["2026-05-20", "2026-06-19", "2026-07-19"]);
  });
});
