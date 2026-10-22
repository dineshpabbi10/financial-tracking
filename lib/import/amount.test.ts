import { describe, expect, it } from "vitest";
import {
  displayAmountForReview,
  normalizeAmountSign,
  parseAmount,
} from "@/lib/import/amount";
import { parseDollars } from "@/lib/money";

describe("parseAmount", () => {
  it("parses Canadian dollar amounts with thousands separators", () => {
    expect(parseAmount("$1,234.56")?.cents).toBe(123456);
    expect(parseAmount("CAD 3,650.00")?.cents).toBe(365000);
    expect(parseAmount("0.00")?.cents).toBe(0);
  });

  it("keeps negative signs and parenthesized negatives", () => {
    expect(parseAmount("-84.23")?.cents).toBe(-8423);
    expect(parseAmount("(1,234.56)")?.cents).toBe(-123456);
    expect(parseAmount("118.42-")?.cents).toBe(-11842);
  });

  it("supports French decimal commas and spaced thousands", () => {
    expect(parseAmount("1 234,56")?.cents).toBe(123456);
    expect(parseAmount("94,50")?.cents).toBe(9450);
  });

  it("reads CR and DR markers", () => {
    expect(parseAmount("25.00 CR")).toEqual({ cents: 2500, marker: "credit" });
    expect(parseAmount("25.00 DR")).toEqual({ cents: 2500, marker: "debit" });
    expect(parseAmount("-25.00 dr.")).toEqual({ cents: -2500, marker: "debit" });
  });

  it("rejects junk and empty cells", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("—")).toBeNull();
    expect(parseAmount("not an amount")).toBeNull();
  });
});

describe("normalizeAmountSign", () => {
  it("turns statement signs into positive-outflow cents", () => {
    expect(
      normalizeAmountSign({ cents: -8423, marker: null }, "negative-outflow"),
    ).toBe(8423);
    expect(
      normalizeAmountSign({ cents: 8423, marker: null }, "positive-outflow"),
    ).toBe(8423);
    expect(
      normalizeAmountSign({ cents: 365000, marker: null }, "negative-outflow"),
    ).toBe(-365000);
  });

  it("lets CR/DR markers override the column convention", () => {
    expect(
      normalizeAmountSign({ cents: 2500, marker: "credit" }, "positive-outflow"),
    ).toBe(-2500);
    expect(
      normalizeAmountSign({ cents: -2500, marker: "debit" }, "negative-outflow"),
    ).toBe(2500);
  });
});

describe("review amount helpers", () => {
  it("shows outflows as negative in the review table", () => {
    expect(displayAmountForReview(8423)).toBe("-84.23");
    expect(displayAmountForReview(-365000)).toBe("3650.00");
  });

  it("parses edited dollar inputs", () => {
    expect(parseDollars("-84.23")).toBe(-8423);
    expect(parseDollars("$1,000")).toBe(100000);
    expect(parseDollars("1.234")).toBeNull();
  });
});
