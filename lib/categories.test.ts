import { describe, expect, it } from "vitest";
import { categorizeTransaction } from "@/lib/categories";

describe("categorizeTransaction", () => {
  it("classifies internet transfers as transfers before internet bills", () => {
    expect(
      categorizeTransaction({
        name: "INTERNET TRANSFER 000000130085 TO CARD 4500********6940",
      }),
    ).toBe("transfers");
  });

  it("does not treat a tax payment to CRA as income", () => {
    expect(
      categorizeTransaction({
        name: "VISA DEBIT RETAIL PURCHASE PAY TO: CRA 629322408082",
      }),
    ).toBe("other");
  });

  it("still recognises CRA income deposits", () => {
    expect(
      categorizeTransaction({ name: "CANADA REVENUE GST CREDIT" }),
    ).toBe("income");
  });
});
