import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseStatement } from "@/lib/import/parse";

function arrayBufferOfFile(name: string): ArrayBuffer {
  const buffer = readFileSync(new URL(`../../samples/${name}`, import.meta.url));
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
}

describe("parseStatement", () => {
  it("falls back to auto-detection when a saved CSV mapping no longer fits", async () => {
    const oldRbcMapping = JSON.stringify({
      date: "Transaction Date",
      description: "Description 1",
      description2: "Description 2",
      amount: "CAD$",
      debit: null,
      credit: null,
      balance: null,
      category: null,
      dateFormat: "ymd",
      amountConvention: "negative-outflow",
    });

    const parsed = await parseStatement({
      buffer: arrayBufferOfFile("td-chequing.csv"),
      filename: "td-chequing.csv",
      accountKind: "chequing",
      bankPresetId: "td",
      savedMapping: oldRbcMapping,
    });

    expect(parsed.kind).toBe("csv");
    expect(parsed.rows).toHaveLength(5);
    expect(parsed.mapping?.date).toBe("Date");
    expect(parsed.warnings[0]?.message).toMatch(/saved on this account/i);
  });

  it("only applies saved mappings to CSV files", async () => {
    const parsed = await parseStatement({
      buffer: arrayBufferOfFile("rbc-chequing.ofx"),
      filename: "rbc-chequing.ofx",
      accountKind: "chequing",
      bankPresetId: "rbc",
      savedMapping: JSON.stringify({ date: "nope" }),
    });

    expect(parsed.kind).toBe("ofx");
    expect(parsed.rows).toHaveLength(3);
  });
});
