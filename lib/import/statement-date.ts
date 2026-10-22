import type { DateFormatId } from "@/lib/import/types";

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
  janv: 1,
  janvier: 1,
  fev: 2,
  février: 2,
  fevr: 2,
  mars: 3,
  avr: 4,
  avril: 4,
  mai: 5,
  juin: 6,
  juil: 7,
  juillet: 7,
  aout: 8,
  août: 8,
  octobre: 10,
  novembre: 11,
  décembre: 12,
  déc: 12,
  févr: 2,
};

function iso(year: number, month: number, day: number): string | null {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    year < 1900 ||
    year > 2200
  ) {
    return null;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function expandYear(value: number): number {
  if (value >= 100) return value;
  return value >= 70 ? 1900 + value : 2000 + value;
}

/**
 * Parse the many date shapes found in Canadian bank exports.
 * Returns YYYY-MM-DD or null.
 */
export function parseStatementDate(
  raw: string,
  format: DateFormatId = "auto",
  fallbackYear?: number,
): string | null {
  const value = raw
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["']|["']$/g, "");
  if (!value) return null;

  // ISO / YYYY-first
  let match = value.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (match) return iso(Number(match[1]), Number(match[2]), Number(match[3]));

  // Compact YYYYMMDD
  match = value.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (match) return iso(Number(match[1]), Number(match[2]), Number(match[3]));

  // Slash / dash dates with 2 or 4 digit years
  match = value.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (match) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    const year = expandYear(Number(match[3]));
    if (format === "dmy") return iso(year, second, first);
    if (format === "mdy") return iso(year, first, second);
    // Auto: impossible days/months disambiguate, otherwise Canada defaults to MDY.
    if (first > 12 && second <= 12) return iso(year, second, first);
    if (second > 12 && first <= 12) return iso(year, first, second);
    return iso(year, first, second);
  }

  // Month name forms: "Jan 5, 2026", "5 Jan 2026", "05-JAN-2026"
  match = value.match(
    /^([A-Za-zÀ-ÿ.]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{2,4})$/,
  );
  if (match) {
    const month = MONTHS[match[1].toLowerCase().replace(/\.$/, "")];
    if (month) return iso(expandYear(Number(match[3])), month, Number(match[2]));
  }
  match = value.match(
    /^(\d{1,2})(?:st|nd|rd|th)?[\s-]+([A-Za-zÀ-ÿ.]+)[\s-]+(\d{2,4})$/,
  );
  if (match) {
    const month = MONTHS[match[2].toLowerCase().replace(/\.$/, "")];
    if (month) return iso(expandYear(Number(match[3])), month, Number(match[1]));
  }

  // Year omitted (common inside PDF statements): "Jan 05", "05 Jan", "01/05"
  if (fallbackYear) {
    match = value.match(/^([A-Za-zÀ-ÿ.]+)\s+(\d{1,2})(?:st|nd|rd|th)?$/);
    if (match) {
      const month = MONTHS[match[1].toLowerCase().replace(/\.$/, "")];
      if (month) return iso(fallbackYear, month, Number(match[2]));
    }
    match = value.match(/^(\d{1,2})[\s-]+([A-Za-zÀ-ÿ.]+)$/);
    if (match) {
      const month = MONTHS[match[2].toLowerCase().replace(/\.$/, "")];
      if (month) return iso(fallbackYear, month, Number(match[1]));
    }
    match = value.match(/^(\d{1,2})[-/.](\d{1,2})$/);
    if (match) {
      const first = Number(match[1]);
      const second = Number(match[2]);
      if (format === "dmy" || first > 12) return iso(fallbackYear, second, first);
      return iso(fallbackYear, first, second);
    }
  }

  // ISO with time suffix
  match = value.match(/^(\d{4})-(\d{2})-(\d{2})[T\s]/);
  if (match) return iso(Number(match[1]), Number(match[2]), Number(match[3]));

  return null;
}

export function formatDateForInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}
