export interface ParsedAmount {
  cents: number;
  /** CR/DR suffix found in the statement. */
  marker: "credit" | "debit" | null;
}

/**
 * Parse a money cell from a statement. Keeps the displayed sign; marker is
 * returned separately so the importer can honour CR/DR semantics.
 */
export function parseAmount(raw: string | null | undefined): ParsedAmount | null {
  if (raw === null || raw === undefined) return null;
  let value = String(raw).replace(/\u00a0/g, " ").trim();
  if (!value || value === "-" || value === "—" || value === "--") return null;

  let marker: "credit" | "debit" | null = null;
  const markerMatch = value.match(/\b(CR|DR)\.?\s*$/i);
  if (markerMatch) {
    marker = markerMatch[1].toUpperCase() === "CR" ? "credit" : "debit";
    value = value.slice(0, markerMatch.index).trim();
  }

  let negative = false;
  if (/^\(.*\)$/.test(value)) {
    negative = true;
    value = value.slice(1, -1);
  }

  value = value.replace(/[^0-9.,+\-\s]/g, "").replace(/\s/g, "");
  if (!value) return null;

  if (value.endsWith("-")) {
    negative = true;
    value = value.slice(0, -1);
  }
  if (value.startsWith("-")) {
    negative = true;
    value = value.slice(1);
  } else if (value.startsWith("+")) {
    value = value.slice(1);
  }

  // Canadian exports use "." decimals and "," thousands. French-language
  // exports sometimes use a comma decimal; support both.
  if (value.includes(",") && value.includes(".")) {
    value = value.replace(/,/g, "");
  } else if (/,\d{1,2}$/.test(value) && !value.includes(".")) {
    value = value.replace(",", ".");
  } else {
    value = value.replace(/,/g, "");
  }

  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  let cents = Math.round(Number(value) * 100);
  if (negative) cents = -cents;

  return { cents, marker };
}

export function normalizeAmountSign(
  parsed: ParsedAmount,
  convention: "negative-outflow" | "positive-outflow",
): number {
  if (parsed.marker === "credit") return -Math.abs(parsed.cents);
  if (parsed.marker === "debit") return Math.abs(parsed.cents);
  return convention === "negative-outflow" ? -parsed.cents : parsed.cents;
}

export function displayAmountForReview(amountCents: number): string {
  // Outflows are stored positive but shown as negative in the review table.
  return (-amountCents / 100).toFixed(2);
}
