import { parseStatementDate } from "@/lib/import/statement-date";
import type { ParsedRow, ParseWarning } from "@/lib/import/types";

function tag(block: string, name: string): string | null {
  const match = block.match(new RegExp(`<${name}>([^<\\r\\n]*)`, "i"));
  if (!match) return null;
  const value = match[1]
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .trim();
  return value || null;
}

function cleanDescription(name: string | null, memo: string | null): string {
  if (name && memo && memo.toLowerCase() !== name.toLowerCase()) {
    if (memo.toLowerCase().includes(name.toLowerCase())) return memo;
    return `${name} — ${memo}`;
  }
  return (name ?? memo ?? "").replace(/\s+/g, " ").trim();
}

/** Parse OFX/QFX SGML or XML, returning posted transactions. */
export function parseOfxStatement(text: string): {
  rows: ParsedRow[];
  warnings: ParseWarning[];
  totalRows: number;
  rowsSkipped: number;
  accountBalanceCents: number | null;
} {
  const rows: ParsedRow[] = [];
  const warnings: ParseWarning[] = [];
  const blocks = [...text.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi)];
  let skipped = 0;

  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index][1];
    const amountRaw = tag(block, "TRNAMT");
    const dateRaw = tag(block, "DTPOSTED") ?? tag(block, "DTTRADE");
    const fitId = tag(block, "FITID");
    const name = tag(block, "NAME");
    const memo = tag(block, "MEMO");

    const amount = amountRaw ? Number(amountRaw.replace(/,/g, "")) : NaN;
    const date = dateRaw
      ? parseStatementDate(dateRaw.slice(0, 8), "ymd")
      : null;
    const description = cleanDescription(name, memo);

    if (!Number.isFinite(amount) || amount === 0 || !date || !description) {
      skipped++;
      if (warnings.length < 10) {
        warnings.push({
          row: index + 1,
          message: `Skipped OFX transaction ${index + 1}: missing or invalid date/amount/description.`,
        });
      }
      continue;
    }

    rows.push({
      // OFX is signed: debits are negative, credits positive.
      amountCents: -Math.round(amount * 100),
      date,
      description: description.slice(0, 500),
      merchantName: name ? name.slice(0, 200) : null,
      balanceCents: null,
      externalId: fitId,
      sourceCategory: null,
    });
  }

  const balanceRaw = text.match(
    /<LEDGERBAL>[\s\S]*?<BALAMT>([^<\r\n]+)/i,
  )?.[1];
  const balance = balanceRaw ? Number(balanceRaw.replace(/,/g, "")) : NaN;

  return {
    rows: rows.sort((a, b) => a.date.localeCompare(b.date)),
    warnings:
      rows.length === 0
        ? [
            {
              message:
                "No transactions were found. Make sure this is an OFX/QFX file from your bank, not a PDF renamed to .ofx.",
            },
          ]
        : warnings,
    totalRows: blocks.length,
    rowsSkipped: skipped,
    accountBalanceCents: Number.isFinite(balance) ? Math.round(balance * 100) : null,
  };
}
