import { describe, expect, it } from "vitest";
import { baseFingerprint, buildFingerprints } from "@/lib/import/fingerprint";

const row = {
  date: "2026-09-03",
  description: "LOBLAWS #1042 TORONTO ON",
  amountCents: 8423,
  externalId: null,
};

describe("import fingerprints", () => {
  it("is stable for the same row and includes the account", () => {
    const first = baseFingerprint("account-a", row);
    expect(first).toHaveLength(64);
    expect(baseFingerprint("account-a", { ...row })).toBe(first);
    expect(baseFingerprint("account-b", row)).not.toBe(first);
  });

  it("normalizes description case and whitespace", () => {
    expect(
      baseFingerprint("account-a", {
        ...row,
        description: "  loblaws   #1042 toronto on  ",
      }),
    ).toBe(baseFingerprint("account-a", row));
  });

  it("makes identical same-day charges distinct but idempotent", () => {
    const firstImport = buildFingerprints("account-a", [row, { ...row }]);
    const secondImport = buildFingerprints("account-a", [row, { ...row }]);

    expect(firstImport[0].hash).not.toBe(firstImport[1].hash);
    expect(secondImport.map((entry) => entry.hash)).toEqual(
      firstImport.map((entry) => entry.hash),
    );

    const oneCharge = buildFingerprints("account-a", [row]);
    expect(oneCharge[0].hash).toBe(firstImport[0].hash);
  });

  it("uses FITID as the stable identity for OFX rows", () => {
    const bankRow = {
      date: "2026-09-03",
      description: "LOBLAWS #1042",
      amountCents: 8423,
      externalId: "RBC20260903002",
    };
    expect(
      baseFingerprint("account-a", {
        ...bankRow,
        description: "Corrected description",
        amountCents: 9000,
        date: "2026-09-04",
      }),
    ).toBe(baseFingerprint("account-a", bankRow));
  });

  it("changes when the amount or date changes", () => {
    expect(baseFingerprint("account-a", { ...row, amountCents: 9000 })).not.toBe(
      baseFingerprint("account-a", row),
    );
    expect(baseFingerprint("account-a", { ...row, date: "2026-09-04" })).not.toBe(
      baseFingerprint("account-a", row),
    );
  });
});
