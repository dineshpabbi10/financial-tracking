import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseOfxStatement } from "@/lib/import/ofx";

function sample(name: string): string {
  return readFileSync(new URL(`../../samples/${name}`, import.meta.url), "utf8");
}

describe("parseOfxStatement", () => {
  it("parses OFX transactions, FITIDs, and the ledger balance", () => {
    const parsed = parseOfxStatement(sample("rbc-chequing.ofx"));

    expect(parsed.rows).toHaveLength(3);
    expect(parsed.rowsSkipped).toBe(0);
    expect(parsed.accountBalanceCents).toBe(611782);

    expect(parsed.rows[0]).toMatchObject({
      date: "2026-09-01",
      amountCents: -365000,
      externalId: "RBC20260901001",
      merchantName: "ACME CORP PAYROLL",
    });
    expect(parsed.rows[1].amountCents).toBe(8423);
    expect(parsed.rows[2].amountCents).toBe(2500);
  });

  it("warns instead of silently returning zero rows", () => {
    const parsed = parseOfxStatement("not an ofx file");
    expect(parsed.rows).toHaveLength(0);
    expect(parsed.warnings[0].message).toMatch(/No transactions were found/i);
    expect(parsed.accountBalanceCents).toBeNull();
  });
});
