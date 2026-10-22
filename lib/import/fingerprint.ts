import { createHash } from "node:crypto";

export interface FingerprintRow {
  date: string;
  description: string;
  amountCents: number;
  externalId?: string | null;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function baseFingerprint(
  accountId: string,
  row: FingerprintRow,
): string {
  if (row.externalId?.trim()) {
    return sha256(`${accountId}|external|${row.externalId.trim()}`);
  }
  const description = row.description
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return sha256(`${accountId}|${row.date}|${row.amountCents}|${description}`);
}

/**
 * Statements can legitimately contain two identical purchases on the same
 * day. Include an occurrence number in the fingerprint so re-importing the
 * same statement is still idempotent, while two real identical charges both
 * make it in the first time.
 */
export function buildFingerprints<T extends FingerprintRow>(
  accountId: string,
  rows: T[],
): Array<{ row: T; hash: string }> {
  const counts = new Map<string, number>();
  return rows.map((row) => {
    const base = baseFingerprint(accountId, row);
    if (row.externalId?.trim()) return { row, hash: base };
    const occurrence = (counts.get(base) ?? 0) + 1;
    counts.set(base, occurrence);
    return { row, hash: sha256(`${base}|occurrence:${occurrence}`) };
  });
}
