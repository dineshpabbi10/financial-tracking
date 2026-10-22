import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCsvStatement } from "@/lib/import/csv";

function sample(name: string): string {
  return readFileSync(new URL(`../../samples/${name}`, import.meta.url), "utf8");
}

describe("parseCsvStatement", () => {
  it("parses the RBC export and detects the bank's column names", () => {
    const parsed = parseCsvStatement(sample("rbc-chequing.csv"), {
      accountKind: "chequing",
      presetConvention: "negative-outflow",
      presetDateFormat: "ymd",
    });

    expect(parsed.rows).toHaveLength(8);
    expect(parsed.rowsSkipped).toBe(0);
    expect(parsed.mapping).toMatchObject({
      date: "Transaction Date",
      description: "Description 1",
      description2: "Description 2",
      amount: "CAD$",
      dateFormat: "ymd",
      amountConvention: "negative-outflow",
    });
    expect(parsed.mapping.category).toBeNull();

    const payroll = parsed.rows.find((row) => row.description.includes("PAYROLL"));
    expect(payroll?.amountCents).toBe(-365000);
    expect(payroll?.date).toBe("2026-09-01");

    const groceries = parsed.rows.find((row) => row.description.includes("LOBLAWS"));
    expect(groceries?.amountCents).toBe(8423);
    expect(groceries?.sourceCategory).toBeNull();
  });

  it("handles TD's separate debit and credit columns", () => {
    const parsed = parseCsvStatement(sample("td-chequing.csv"), {
      accountKind: "chequing",
      presetConvention: "negative-outflow",
      presetDateFormat: "mdy",
    });

    expect(parsed.rows).toHaveLength(5);
    expect(parsed.mapping.debit).toBe("Debit");
    expect(parsed.mapping.credit).toBe("Credit");

    const rent = parsed.rows.find((row) => row.description.includes("RENT"));
    expect(rent?.amountCents).toBe(215000);
    expect(rent?.balanceCents).toBe(369213);

    const incoming = parsed.rows.find((row) => row.description.includes("JORDAN"));
    expect(incoming?.amountCents).toBe(-4500);
  });

  it("treats positive Amex charges as money out", () => {
    const parsed = parseCsvStatement(sample("amex-cobalt.csv"), {
      accountKind: "credit",
      presetConvention: "positive-outflow",
      presetDateFormat: "mdy",
    });

    expect(parsed.rows).toHaveLength(4);
    const coffee = parsed.rows.find((row) => row.description.includes("STARBUCKS"));
    expect(coffee?.amountCents).toBe(525);
    expect(coffee?.date).toBe("2026-09-02");

    const payment = parsed.rows.find((row) => row.description.includes("PAYMENT"));
    expect(payment?.amountCents).toBe(-25000);
  });

  it("handles semicolon-delimited French exports with comma decimals", () => {
    const parsed = parseCsvStatement(
      [
        "Date;Description;Débit;Crédit",
        "01/09/2026;LOYER SEPTEMBRE;2150,00;",
        "05/09/2026;REMBOURSEMENT;;45,25",
      ].join("\n"),
      {
        accountKind: "chequing",
        presetConvention: "negative-outflow",
        presetDateFormat: "dmy",
      },
    );

    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0].amountCents).toBe(215000);
    expect(parsed.rows[1].amountCents).toBe(-4525);
    expect(parsed.mapping.debit).toBe("Débit");
    expect(parsed.mapping.credit).toBe("Crédit");
  });

  it("raises useful errors for unreadable files", () => {
    expect(() =>
      parseCsvStatement("", {
        accountKind: "chequing",
      }),
    ).toThrow(/empty|fewer than two rows/i);

    expect(() =>
      parseCsvStatement("one,two\nhello,world", {
        accountKind: "chequing",
      }),
    ).toThrow(/header row/i);
  });
});
