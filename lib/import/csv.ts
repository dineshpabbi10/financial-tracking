import Papa from "papaparse";
import { normalizeAmountSign, parseAmount } from "@/lib/import/amount";
import type {
  AmountConvention,
  CsvMapping,
  DateFormatId,
  ParsedRow,
  ParseWarning,
} from "@/lib/import/types";
import { parseStatementDate } from "@/lib/import/statement-date";

const HEADER_KEYWORDS = [
  "date",
  "description",
  "amount",
  "debit",
  "credit",
  "balance",
  "category",
  "transaction",
  "memo",
  "details",
  "libelle",
  "montant",
  "solde",
  "debit",
  "credit",
];

const DATE_ALIASES = [
  "transaction date",
  "date de transaction",
  "date d operation",
  "date operation",
  "posting date",
  "posted date",
  "date posted",
  "date",
];

const DESCRIPTION_ALIASES = [
  "description 1",
  "transaction description",
  "description",
  "libelle",
  "libelle de transaction",
  "details",
  "detail",
  "merchant",
  "payee",
  "name",
  "memo",
  "narrative",
  "transaction",
];

const DESCRIPTION2_ALIASES = [
  "description 2",
  "memo",
  "details",
  "additional details",
  "detail supplementaire",
];

const AMOUNT_ALIASES = [
  "cad$",
  "cad",
  "transaction amount",
  "amount (cad)",
  "amount",
  "montant",
  "amt",
  "value",
];

const DEBIT_ALIASES = [
  "debit",
  "debit amount",
  "withdrawal",
  "withdrawals",
  "retrait",
  "retraits",
  "debits",
];

const CREDIT_ALIASES = [
  "credit",
  "credit amount",
  "deposit",
  "deposits",
  "depot",
  "depots",
  "credits",
];

const BALANCE_ALIASES = ["balance", "running balance", "solde", "solde courant"];
const CATEGORY_ALIASES = ["category", "categorie"];

function normalizeHeader(value: string): string {
  return value
    .replace(/^\ufeff/, "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9$]+/g, " ")
    .trim();
}

function matchHeader(headers: string[], aliases: string[]): string | null {
  const normalizedHeaders = headers.map((h) => ({
    raw: h,
    normalized: normalizeHeader(h),
  }));
  for (const alias of aliases) {
    const normalizedAlias = normalizeHeader(alias);
    const exact = normalizedHeaders.find((h) => h.normalized === normalizedAlias);
    if (exact) return exact.raw;
  }
  for (const alias of aliases) {
    const normalizedAlias = normalizeHeader(alias);
    if (normalizedAlias.length < 4) continue;
    const partial = normalizedHeaders.find(
      (h) =>
        h.normalized.includes(normalizedAlias) &&
        !/(usd|u s|exchange|rate)/.test(h.normalized),
    );
    if (partial) return partial.raw;
  }
  return null;
}

function uniqueHeaders(rawHeaders: string[]): string[] {
  const counts = new Map<string, number>();
  return rawHeaders.map((raw, index) => {
    const base = raw.replace(/^\ufeff/, "").trim() || `Column ${index + 1}`;
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    return count === 0 ? base : `${base} (${count + 1})`;
  });
}

function findHeaderRow(rows: string[][]): number {
  let best = { index: -1, score: 0 };
  rows.slice(0, 25).forEach((row, index) => {
    let score = 0;
    const normalized = row.map((cell) => normalizeHeader(cell ?? ""));
    for (const cell of normalized) {
      if (HEADER_KEYWORDS.some((keyword) => cell === keyword || cell.includes(keyword))) {
        score += 1;
      }
    }
    if (
      normalized.some((cell) => cell.includes("date")) &&
      normalized.some((cell) => /(amount|debit|credit|montant|solde)/.test(cell))
    ) {
      score += 2;
    }
    if (score > best.score) best = { index, score };
  });
  return best.index;
}

export function suggestCsvMapping(
  headers: string[],
  samples: string[][],
  opts: { accountKind: string; presetConvention?: AmountConvention; presetDateFormat?: DateFormatId },
): CsvMapping {
  const date = matchHeader(headers, DATE_ALIASES) ?? headers[0] ?? "";
  const description =
    matchHeader(headers, DESCRIPTION_ALIASES) ??
    headers.find((h) => !/date|amount|balance|debit|credit/i.test(h)) ??
    headers[1] ??
    "";
  const description2 = matchHeader(headers, DESCRIPTION2_ALIASES);
  const debit = matchHeader(headers, DEBIT_ALIASES);
  const credit = matchHeader(headers, CREDIT_ALIASES);
  const balance = matchHeader(headers, BALANCE_ALIASES);
  const category = matchHeader(headers, CATEGORY_ALIASES);
  const amount = debit || credit ? null : matchHeader(headers, AMOUNT_ALIASES);

  const amountColumnIndex = amount ? headers.indexOf(amount) : -1;
  const sampleAmounts =
    amountColumnIndex >= 0
      ? samples
          .map((row) => row[amountColumnIndex])
          .map((cell) => parseAmount(cell))
          .filter((value): value is NonNullable<typeof value> => value !== null)
      : [];
  const negatives = sampleAmounts.filter((amount) => amount.cents < 0 && !amount.marker).length;
  const positives = sampleAmounts.filter((amount) => amount.cents > 0 && !amount.marker).length;

  let amountConvention: AmountConvention =
    opts.presetConvention ??
    (opts.accountKind === "credit" || opts.accountKind === "loan"
      ? "positive-outflow"
      : "negative-outflow");
  if (sampleAmounts.length > 0) {
    if (negatives > positives) amountConvention = "negative-outflow";
    else if (positives > negatives + 1) {
      amountConvention =
        opts.accountKind === "credit" || opts.accountKind === "loan"
          ? "positive-outflow"
          : amountConvention;
    }
  }

  let dateFormat: DateFormatId = opts.presetDateFormat ?? "auto";
  const dateSamples = samples
    .map((row) => row[headers.indexOf(date)])
    .filter(Boolean)
    .slice(0, 8) as string[];
  if (dateSamples.length > 0) {
    if (dateSamples.every((value) => /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(value.trim()))) {
      dateFormat = "ymd";
    } else if (dateSamples.some((value) => /[A-Za-zÀ-ÿ]/.test(value))) {
      dateFormat = "month-name";
    } else {
      const slash = dateSamples
        .map((value) => value.trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}$/))
        .find(Boolean);
      if (slash) {
        if (Number(slash[1]) > 12) dateFormat = "dmy";
        else if (Number(slash[2]) > 12) dateFormat = "mdy";
      }
    }
  }

  return {
    date,
    description,
    description2: description2 && description2 !== description ? description2 : null,
    amount,
    debit,
    credit,
    balance,
    category,
    dateFormat,
    amountConvention,
  };
}

function cell(row: string[], headers: string[], headerName: string | null): string {
  if (!headerName) return "";
  const index = headers.indexOf(headerName);
  if (index < 0) return "";
  return (row[index] ?? "").trim();
}

function cleanDescription(value: string): string {
  return value.replace(/\s+/g, " ").replace(/^[-–—:;,.\s]+|[-–—:;,.\s]+$/g, "").trim();
}

export function parseCsvStatement(
  text: string,
  opts: {
    mapping?: CsvMapping | null;
    accountKind: string;
    presetConvention?: AmountConvention;
    presetDateFormat?: DateFormatId;
  },
): {
  rows: ParsedRow[];
  warnings: ParseWarning[];
  totalRows: number;
  rowsSkipped: number;
  headers: string[];
  mapping: CsvMapping;
  delimiter: string;
} {
  const parsed = Papa.parse<string[]>(text.replace(/^\ufeff/, ""), {
    header: false,
    skipEmptyLines: "greedy",
    delimitersToGuess: [",", ";", "\t", "|"],
  });
  const data = (parsed.data ?? []).filter((row) => row.some((value) => String(value).trim() !== ""));
  if (data.length < 2) {
    throw new Error("That CSV looks empty, or has fewer than two rows.");
  }

  const headerRowIndex = findHeaderRow(data);
  if (headerRowIndex < 0) {
    throw new Error(
      "Couldn't find a header row in this CSV. Try exporting the statement again, or choose a different bank preset.",
    );
  }

  const headers = uniqueHeaders(data[headerRowIndex].map((value) => String(value)));
  const dataRows = data.slice(headerRowIndex + 1);
  const samples = dataRows.slice(0, 30);
  const mapping =
    opts.mapping ??
    suggestCsvMapping(headers, samples, {
      accountKind: opts.accountKind,
      presetConvention: opts.presetConvention,
      presetDateFormat: opts.presetDateFormat,
    });

  if (!mapping.date || !headers.includes(mapping.date)) {
    throw new Error("Choose which CSV column contains the transaction date.");
  }
  if (!mapping.description || !headers.includes(mapping.description)) {
    throw new Error("Choose which CSV column contains the description.");
  }
  if (
    (!mapping.amount || !headers.includes(mapping.amount)) &&
    (!mapping.debit && !mapping.credit)
  ) {
    throw new Error("Choose an amount column, or separate debit/credit columns.");
  }

  const rows: ParsedRow[] = [];
  const warnings: ParseWarning[] = [];
  let skipped = 0;

  dataRows.forEach((row, index) => {
    const rowNumber = headerRowIndex + index + 2;
    const dateRaw = cell(row, headers, mapping.date);
    const date = parseStatementDate(dateRaw, mapping.dateFormat);
    const description = cleanDescription(
      [cell(row, headers, mapping.description), cell(row, headers, mapping.description2)]
        .filter(Boolean)
        .join(" — "),
    );

    if (!date) {
      skipped++;
      if (warnings.length < 12) {
        warnings.push({
          row: rowNumber,
          message: dateRaw
            ? `Skipped row ${rowNumber}: couldn't read the date "${dateRaw}".`
            : `Skipped row ${rowNumber}: no date.`,
        });
      }
      return;
    }
    if (!description) {
      skipped++;
      if (warnings.length < 12) {
        warnings.push({ row: rowNumber, message: `Skipped row ${rowNumber}: no description.` });
      }
      return;
    }

    let amountCents: number | null = null;
    if (mapping.debit || mapping.credit) {
      const debitParsed = parseAmount(cell(row, headers, mapping.debit));
      const creditParsed = parseAmount(cell(row, headers, mapping.credit));
      if (debitParsed && debitParsed.cents !== 0) {
        amountCents = Math.abs(debitParsed.cents);
      } else if (creditParsed && creditParsed.cents !== 0) {
        amountCents = -Math.abs(creditParsed.cents);
      }
    } else {
      const parsedAmount = parseAmount(cell(row, headers, mapping.amount));
      if (parsedAmount) {
        amountCents = normalizeAmountSign(parsedAmount, mapping.amountConvention);
      }
    }

    if (amountCents === null || amountCents === 0) {
      skipped++;
      if (warnings.length < 12) {
        warnings.push({
          row: rowNumber,
          message: `Skipped row ${rowNumber}: no readable amount.`,
        });
      }
      return;
    }

    const balanceParsed = parseAmount(cell(row, headers, mapping.balance));
    rows.push({
      date,
      description: description.slice(0, 500),
      merchantName: null,
      amountCents,
      balanceCents: balanceParsed ? balanceParsed.cents : null,
      externalId: null,
      sourceCategory: cell(row, headers, mapping.category) || null,
    });
  });

  return {
    rows: rows.sort((a, b) => a.date.localeCompare(b.date)),
    warnings,
    totalRows: dataRows.length,
    rowsSkipped: skipped,
    headers,
    mapping,
    delimiter: parsed.meta.delimiter || ",",
  };
}

export function csvMappingToJson(mapping: CsvMapping): string {
  return JSON.stringify(mapping);
}

export function csvMappingFromJson(value: string | null | undefined): CsvMapping | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as CsvMapping;
    if (!parsed.date || !parsed.description) return null;
    return parsed;
  } catch {
    return null;
  }
}
