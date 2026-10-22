import { normalizeAmountSign, parseAmount } from "@/lib/import/amount";
import { parseStatementDate } from "@/lib/import/statement-date";
import type {
  DateFormatId,
  ParsedRow,
  ParseWarning,
} from "@/lib/import/types";

const MONTH_WORD =
  "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|janv(?:ier)?|f[eé]vr?(?:ier)?|mars|avr(?:il)?|mai|juin|juil(?:let)?|ao[uû]t|sept(?:embre)?|octobre|novembre|d[eé]cembre)";

const DATE_PREFIX = new RegExp(
  `^(?<date>\\d{4}[-/.]\\d{1,2}[-/.]\\d{1,2}|\\d{1,2}[-/.]\\d{1,2}(?:[-/.]\\d{2,4})?|${MONTH_WORD}\\.?\\s+\\d{1,2}(?:,\\s*\\d{4})?|\\d{1,2}\\s+${MONTH_WORD}\\.?\\s+\\d{2,4})\\s+`,
  "i",
);

const AMOUNT_AT_END =
  /(?<amount>\(?-?\$?\s?\d+(?:[ ,]\d{3})*(?:[.,]\d{2})\)?-?)\s*(?<marker>CR|DR)?\s*$/i;

const NON_TRANSACTION_LINES =
  /(opening balance|closing balance|previous balance|new balance|total balance|minimum payment|payment due|credit limit|available credit|total purchases|total payments|interest rate|annual interest|page \d+( of \d+)?|statement period|account number|rewards? (earned|balance)|points earned)/i;

interface PdfLine {
  text: string;
  page: number;
}

/** Reconstruct visual lines from positioned PDF text items. */
function itemsToLines(
  pages: Array<Array<{ str: string; x: number; y: number; width: number }>>,
): PdfLine[] {
  const lines: PdfLine[] = [];

  pages.forEach((items, pageIndex) => {
    const sorted = [...items]
      .filter((item) => item.str != null)
      .sort((a, b) => {
        if (Math.abs(b.y - a.y) > 2.5) return b.y - a.y;
        return a.x - b.x;
      });

    let currentY: number | null = null;
    let group: typeof sorted = [];

    const flush = () => {
      if (group.length === 0) return;
      const ordered = [...group].sort((a, b) => a.x - b.x);
      let text = "";
      let previousEnd: number | null = null;
      for (const item of ordered) {
        const value = item.str.replace(/\s+/g, " ").trim();
        if (!value) continue;
        if (text && previousEnd !== null) {
          const gap = item.x - previousEnd;
          if (gap > 1.2) text += " ";
        }
        text += value;
        previousEnd = item.x + (item.width || 0);
      }
      const cleaned = text.replace(/\s+/g, " ").trim();
      if (cleaned) lines.push({ text: cleaned, page: pageIndex + 1 });
      group = [];
    };

    for (const item of sorted) {
      if (currentY === null || Math.abs(item.y - currentY) <= 2.5) {
        group.push(item);
        currentY = currentY === null ? item.y : currentY;
      } else {
        flush();
        group = [item];
        currentY = item.y;
      }
    }
    flush();
  });

  return lines;
}

function inferStatementYear(lines: PdfLine[]): number {
  const sample = lines.slice(0, 120).map((line) => line.text).join(" ");
  const years = [...sample.matchAll(/\b(20\d{2})\b/g)].map((match) => Number(match[1]));
  if (years.length > 0) {
    // Statements often include the current year many times; use the mode.
    const counts = new Map<number, number>();
    for (const year of years) counts.set(year, (counts.get(year) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }
  return new Date().getFullYear();
}

function cleanDescription(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s+[|·•]\s+/g, " · ")
    .replace(/^[-–—:;,.\s]+|[-–—:;,.\s]+$/g, "")
    .trim();
}

/**
 * Best-effort transaction extraction from statement text. PDF layouts are
 * wildly inconsistent, so every row is reviewed before import.
 */
export function parsePdfLines(
  lines: PdfLine[],
  opts: { accountKind: string; dateFormat?: DateFormatId },
): {
  rows: ParsedRow[];
  warnings: ParseWarning[];
  totalCandidates: number;
  rowsSkipped: number;
} {
  const fallbackYear = inferStatementYear(lines);
  const convention =
    opts.accountKind === "credit" || opts.accountKind === "loan"
      ? "positive-outflow"
      : "negative-outflow";
  const rows: ParsedRow[] = [];
  const warnings: ParseWarning[] = [];
  let candidates = 0;
  let skipped = 0;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].text;
    if (NON_TRANSACTION_LINES.test(line)) continue;
    const dateMatch = line.match(DATE_PREFIX);
    if (!dateMatch?.groups?.date) continue;

    candidates++;
    let combined = line;
    let amountMatch = combined.match(AMOUNT_AT_END);

    // Descriptions sometimes wrap onto the next line, with the amount on the
    // following line. Look ahead cautiously.
    if (!amountMatch) {
      for (let lookahead = 1; lookahead <= 2 && index + lookahead < lines.length; lookahead++) {
        const nextLine = lines[index + lookahead].text;
        if (DATE_PREFIX.test(nextLine) || NON_TRANSACTION_LINES.test(nextLine)) break;
        combined = `${combined} ${nextLine}`;
        amountMatch = combined.match(AMOUNT_AT_END);
        if (amountMatch) break;
      }
    }

    if (!amountMatch?.groups?.amount) continue;

    const date = parseStatementDate(
      dateMatch.groups.date,
      opts.dateFormat ?? "auto",
      fallbackYear,
    );
    const parsedAmount = parseAmount(
      `${amountMatch.groups.amount}${amountMatch.groups.marker ? ` ${amountMatch.groups.marker}` : ""}`,
    );
    const description = cleanDescription(
      combined
        .slice(dateMatch[0].length, amountMatch.index)
        .replace(/\s+/g, " "),
    );

    if (!date || !parsedAmount || parsedAmount.cents === 0 || description.length < 2) {
      skipped++;
      continue;
    }

    rows.push({
      date,
      description: description.slice(0, 500),
      merchantName: null,
      amountCents: normalizeAmountSign(parsedAmount, convention),
      balanceCents: null,
      externalId: null,
      sourceCategory: null,
    });
  }

  if (rows.length === 0) {
    warnings.push({
      message:
        "No transaction lines were recognized. This PDF layout may use columns or a font that text extraction can't read. Try exporting the CSV version of the statement instead.",
    });
  }

  return {
    rows: rows.sort((a, b) => a.date.localeCompare(b.date)),
    warnings,
    totalCandidates: candidates,
    rowsSkipped: skipped,
  };
}

export async function extractPdfText(
  buffer: ArrayBuffer,
  password?: string,
): Promise<{ lines: PdfLine[]; rawText: string; pageCount: number }> {
  const { getDocumentProxy, extractTextItems } = await import("unpdf");
  const data = new Uint8Array(buffer);

  let pdf;
  try {
    pdf = await getDocumentProxy(data, password ? { password } : {});
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/password/i.test(message)) {
      throw new Error(
        "This PDF is password protected (or the password is wrong). Add the statement password and try again.",
      );
    }
    throw new Error(`Couldn't open that PDF. ${message || "Is it a valid statement PDF?"}`);
  }

  try {
    const extraction = await extractTextItems(pdf);
    const lines = itemsToLines(
      extraction.items.map((page) =>
        page.map((item) => ({
          str: item.str,
          x: item.x,
          y: item.y,
          width: item.width,
        })),
      ),
    );
    return {
      lines,
      rawText: lines.map((line) => line.text).join("\n").slice(0, 80_000),
      pageCount: extraction.totalPages,
    };
  } finally {
    await pdf.loadingTask.destroy();
  }
}

export async function parsePdfStatement(
  buffer: ArrayBuffer,
  opts: { accountKind: string; dateFormat?: DateFormatId; password?: string },
): Promise<{
  rows: ParsedRow[];
  warnings: ParseWarning[];
  totalRows: number;
  rowsSkipped: number;
  rawText: string;
  pageCount: number;
}> {
  const { lines, rawText, pageCount } = await extractPdfText(buffer, opts.password);
  const parsed = parsePdfLines(lines, {
    accountKind: opts.accountKind,
    dateFormat: opts.dateFormat,
  });
  return {
    rows: parsed.rows,
    warnings: parsed.warnings,
    totalRows: parsed.totalCandidates,
    rowsSkipped: parsed.rowsSkipped,
    rawText,
    pageCount,
  };
}
