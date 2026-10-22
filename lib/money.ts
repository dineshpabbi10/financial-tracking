const cadFormatter = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const cadWholeFormatter = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Signed currency amount. In our model positive cents are money out. */
export function formatMoney(cents: number, opts: { whole?: boolean } = {}): string {
  const value = cents / 100;
  return (opts.whole ? cadWholeFormatter : cadFormatter).format(value);
}

/** Absolute currency amount, e.g. for a bill amount. */
export function formatAmount(cents: number, opts: { whole?: boolean } = {}): string {
  return formatMoney(Math.abs(cents), opts);
}

/** +$1,234.00 for money in, −$54.99 for money out. */
export function formatSignedMoney(cents: number): string {
  const sign = cents > 0 ? "\u2212" : cents < 0 ? "+" : "";
  return `${sign}${formatMoney(Math.abs(cents))}`;
}

export function formatPercent(value: number, fractionDigits = 0): string {
  return `${Math.round(value * 10 ** fractionDigits) / 10 ** fractionDigits}%`;
}

/** Parse a currency-ish input string into integer cents. Returns null if invalid. */
export function parseDollars(input: string | number): number | null {
  if (typeof input === "number") {
    return Number.isFinite(input) ? Math.round(input * 100) : null;
  }
  const cleaned = input.replace(/[$,\s]/g, "").trim();
  if (!/^-?\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? Math.round(value * 100) : null;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function ratio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return numerator / denominator;
}
