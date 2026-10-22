import { describe, expect, it } from "vitest";
import {
  categorizePlaidTransaction,
  mapPlaidAccountType,
  plaidAccountName,
  plaidAmountToCents,
  plaidTransactionHash,
} from "@/lib/plaid/mapping";

describe("Plaid mapping", () => {
  it("keeps Plaid's positive-outflow amount convention", () => {
    expect(plaidAmountToCents(84.23)).toBe(8423);
    expect(plaidAmountToCents(-3650)).toBe(-365000);
    expect(plaidAmountToCents(0.005)).toBe(1);
    expect(() => plaidAmountToCents(Number.NaN)).toThrow(/invalid/i);
  });

  it("maps Plaid account types to Loonie account types", () => {
    expect(mapPlaidAccountType("depository", "checking")).toBe("chequing");
    expect(mapPlaidAccountType("depository", "savings")).toBe("savings");
    expect(mapPlaidAccountType("depository", "money market")).toBe("savings");
    expect(mapPlaidAccountType("credit", "credit card")).toBe("credit");
    expect(mapPlaidAccountType("loan", "student")).toBe("loan");
    expect(mapPlaidAccountType("investment", "brokerage")).toBe("investment");
    expect(mapPlaidAccountType("other", null)).toBe("other");
  });

  it("prefers the official account name when present", () => {
    expect(
      plaidAccountName({
        name: "CREDIT CARD",
        official_name: "RBC Avion Visa Infinite",
      }),
    ).toBe("RBC Avion Visa Infinite");
    expect(plaidAccountName({ name: "Everyday Chequing", official_name: null })).toBe(
      "Everyday Chequing",
    );
  });

  it("creates stable, distinct transaction fingerprints", () => {
    const first = plaidTransactionHash("txn-1");
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(plaidTransactionHash("txn-1")).toBe(first);
    expect(plaidTransactionHash("txn-2")).not.toBe(first);
  });

  it("uses curated local rules before Plaid categories", () => {
    expect(
      categorizePlaidTransaction({
        merchantName: "Loblaws",
        name: "LOBLAWS #1234",
        amountCents: 8423,
        personalFinanceCategory: {
          primary: "GENERAL_MERCHANDISE",
          detailed: "GENERAL_MERCHANDISE_SUPERSTORES",
        },
      }),
    ).toBe("groceries");
  });

  it("falls back to Plaid's personal finance categories", () => {
    expect(
      categorizePlaidTransaction({
        merchantName: "Unknown Merchant",
        name: "UNKNOWN MERCHANT 998",
        amountCents: 2500,
        personalFinanceCategory: {
          primary: "TRANSPORTATION",
          detailed: "TRANSPORTATION_PARKING",
        },
      }),
    ).toBe("transport");
    expect(
      categorizePlaidTransaction({
        merchantName: "Unknown Merchant",
        name: "UNKNOWN MERCHANT 998",
        amountCents: 2500,
        personalFinanceCategory: {
          primary: "FOOD_AND_DRINK",
          detailed: "FOOD_AND_DRINK_GROCERIES",
        },
      }),
    ).toBe("groceries");
    expect(
      categorizePlaidTransaction({
        merchantName: null,
        name: "UNKNOWN CREDIT",
        amountCents: -5000,
        personalFinanceCategory: {
          primary: "GOVERNMENT_AND_NON_PROFIT",
          detailed: "GOVERNMENT_AND_NON_PROFIT_TAX_PAYMENT",
        },
      }),
    ).toBe("income");
  });
});
