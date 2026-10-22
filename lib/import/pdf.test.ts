import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parsePdfLines, parsePdfStatement } from "@/lib/import/pdf";

const lines = (text: string[]) =>
  text.map((line, index) => ({ text: line, page: index + 1 }));

describe("parsePdfLines", () => {
  it("keeps all four integer digits and the correct description", () => {
    const parsed = parsePdfLines(
      lines(["Sep 8, 2026 PAYROLL DEPOSIT ACME CORP 3650.00"]),
      { accountKind: "chequing" },
    );

    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].description).toBe("PAYROLL DEPOSIT ACME CORP");
    expect(parsed.rows[0].amountCents).toBe(-365000);
  });

  it("normalizes signs for chequing vs credit accounts", () => {
    const chequing = parsePdfLines(
      lines([
        "Sep 3, 2026 LOBLAWS #1042 TORONTO ON -84.23",
        "Sep 5, 2026 BELL CANADA -94.50",
      ]),
      { accountKind: "chequing" },
    );
    expect(chequing.rows.map((row) => row.amountCents)).toEqual([8423, 9450]);

    const credit = parsePdfLines(
      lines(["Sep 3, 2026 STARBUCKS STORE 8842 5.25"]),
      { accountKind: "credit" },
    );
    expect(credit.rows[0].amountCents).toBe(525);
  });

  it("handles CR markers, thousands separators, and wrapped descriptions", () => {
    const parsed = parsePdfLines(
      lines([
        "Sep 3, 2026 AMAZON MARKETPLACE",
        "TORONTO ON -1 234.56",
        "Sep 4, 2026 REFUND FROM STORE 25.00 CR",
      ]),
      { accountKind: "chequing" },
    );

    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0].description).toBe("AMAZON MARKETPLACE TORONTO ON");
    expect(parsed.rows[0].amountCents).toBe(123456);
    expect(parsed.rows[1].amountCents).toBe(-2500);
  });

  it("ignores balances, headers, and summary lines", () => {
    const parsed = parsePdfLines(
      lines([
        "RBC Royal Bank Statement",
        "Statement period: September 1, 2026 to September 30, 2026",
        "Opening balance 1,000.00",
        "Sep 3, 2026 LOBLAWS TORONTO ON -84.23",
        "Closing balance 915.77",
      ]),
      { accountKind: "chequing" },
    );

    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].description).toBe("LOBLAWS TORONTO ON");
  });
});

describe("parsePdfStatement", () => {
  it("extracts text and rows from a sample PDF end to end", async () => {
    const buffer = readFileSync(
      new URL("../../samples/rbc-chequing-statement.pdf", import.meta.url),
    );
    const parsed = await parsePdfStatement(
      buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      ) as ArrayBuffer,
      { accountKind: "chequing", dateFormat: "ymd" },
    );

    expect(parsed.pageCount).toBe(1);
    expect(parsed.rows).toHaveLength(4);
    expect(parsed.rawText).toContain("RBC Royal Bank");
    const payroll = parsed.rows.find((row) => row.description.includes("PAYROLL"));
    expect(payroll?.description).toBe("PAYROLL DEPOSIT ACME CORP");
    expect(payroll?.amountCents).toBe(-365000);
  });
});
