import { addDays, daysBetween } from "@/lib/dates";
import {
  categoryIsSpending,
  cleanMerchantName,
  merchantKey,
  type CategoryId,
} from "@/lib/categories";

export type Cadence = "weekly" | "biweekly" | "monthly" | "quarterly";
export type Direction = "expense" | "income";

export interface RecurringTransactionInput {
  merchantName?: string | null;
  name: string;
  amountCents: number;
  date: Date;
  category: string;
  pending?: boolean;
}

export interface DetectedSeries {
  merchantKey: string;
  merchantName: string;
  category: string;
  direction: Direction;
  cadence: Cadence;
  intervalDays: number;
  averageAmountCents: number;
  lastAmountCents: number;
  lastDate: Date;
  nextExpectedDate: Date;
  confidence: number;
  transactionCount: number;
}

const CADENCE_DAYS: Record<Cadence, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  quarterly: 91,
};

const CADENCE_TOLERANCE: Record<Cadence, number> = {
  weekly: 2,
  biweekly: 3,
  monthly: 5,
  quarterly: 9,
};

/** Categories where a repeating charge is likely a bill, not discretionary noise. */
const DETECTABLE_CATEGORIES = new Set<CategoryId>([
  "housing",
  "utilities",
  "subscriptions",
  "insurance",
  "debt",
  "fees",
  "transport",
  "health",
  "entertainment",
  "income",
]);

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function classifyCadence(intervalDays: number): Cadence | null {
  if (intervalDays >= 5 && intervalDays <= 9) return "weekly";
  if (intervalDays >= 12 && intervalDays <= 17) return "biweekly";
  if (intervalDays >= 25 && intervalDays <= 36) return "monthly";
  if (intervalDays >= 75 && intervalDays <= 100) return "quarterly";
  return null;
}

function displayMerchant(raw: string): string {
  const cleaned = cleanMerchantName(raw);
  return cleaned
    .split(/\s+/)
    .map((word) => {
      if (word === word.toUpperCase() && word.length > 3) {
        return word.charAt(0) + word.slice(1).toLowerCase();
      }
      return word;
    })
    .join(" ")
    .replace(/^./, (c) => c.toUpperCase());
}

function nextDateOnOrAfter(date: Date, intervalDays: number, minimum: Date): Date {
  let next = date;
  let safety = 0;
  while (next.getTime() < minimum.getTime() && safety < 120) {
    next = addDays(next, intervalDays);
    safety++;
  }
  return next;
}

/**
 * Detect recurring bills and income from a transaction history.
 * Pure function so it can be unit tested and reused by sync/demo seeding.
 */
export function detectRecurring(
  transactions: RecurringTransactionInput[],
  opts: { today: Date; minimumOccurrences?: number },
): DetectedSeries[] {
  const minimumOccurrences = opts.minimumOccurrences ?? 3;
  const groups = new Map<
    string,
    Array<{ date: Date; amountCents: number; category: string; display: string }>
  >();

  for (const tx of transactions) {
    if (tx.pending || tx.amountCents === 0) continue;
    if (!categoryIsSpending(tx.category) && tx.category !== "income") continue;
    if (!DETECTABLE_CATEGORIES.has(tx.category as CategoryId)) continue;

    const raw = tx.merchantName?.trim() || tx.name;
    const key = merchantKey(raw);
    if (!key) continue;
    const direction: Direction = tx.amountCents > 0 ? "expense" : "income";
    const groupKey = `${key}|${direction}`;
    const list = groups.get(groupKey) ?? [];
    list.push({
      date: tx.date,
      amountCents: tx.amountCents,
      category: tx.category,
      display: raw,
    });
    groups.set(groupKey, list);
  }

  const detected: DetectedSeries[] = [];

  for (const [groupKey, rawEntries] of groups) {
    if (rawEntries.length < minimumOccurrences) continue;

    // One charge per calendar day; keep the largest absolute amount.
    const byDay = new Map<string, (typeof rawEntries)[number]>();
    for (const entry of rawEntries) {
      const day = entry.date.toISOString().slice(0, 10);
      const existing = byDay.get(day);
      if (!existing || Math.abs(entry.amountCents) > Math.abs(existing.amountCents)) {
        byDay.set(day, entry);
      }
    }
    const entries = [...byDay.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
    if (entries.length < minimumOccurrences) continue;

    const intervals: number[] = [];
    for (let i = 1; i < entries.length; i++) {
      intervals.push(daysBetween(entries[i - 1].date, entries[i].date));
    }
    const intervalDays = Math.round(median(intervals));
    const cadence = classifyCadence(intervalDays);
    if (!cadence) continue;

    const tolerance = CADENCE_TOLERANCE[cadence];
    const regularIntervals = intervals.filter(
      (value) => Math.abs(value - intervalDays) <= tolerance,
    ).length;
    const regularity = regularIntervals / intervals.length;
    if (regularity < 0.55) continue;

    const amounts = entries.map((entry) => entry.amountCents);
    const medianAmount = median(amounts);
    if (medianAmount === 0) continue;
    const deviations = amounts.map((amount) => Math.abs(amount - medianAmount));
    const mad = median(deviations);
    const amountStability = 1 - Math.min(1, mad / Math.abs(medianAmount) / 0.5);

    const countScore = Math.min(1, (entries.length - 2) / 4);
    const last = entries[entries.length - 1];
    const daysSinceLast = daysBetween(last.date, opts.today);
    const recency = daysSinceLast <= intervalDays * 1.6 ? 1 : Math.max(0, 1 - (daysSinceLast - intervalDays * 1.6) / 60);
    const confidence =
      regularity * 0.45 + amountStability * 0.3 + countScore * 0.15 + recency * 0.1;

    if (confidence < 0.5) continue;

    const recentAmounts = entries.slice(-6).map((entry) => entry.amountCents);
    const averageAmountCents = Math.round(median(recentAmounts));
    const nextExpectedDate = nextDateOnOrAfter(
      addDays(last.date, intervalDays),
      intervalDays,
      opts.today,
    );

    const [key, direction] = groupKey.split("|") as [string, Direction];

    detected.push({
      merchantKey: key,
      merchantName: displayMerchant(last.display),
      category: last.category,
      direction,
      cadence,
      intervalDays,
      averageAmountCents,
      lastAmountCents: last.amountCents,
      lastDate: last.date,
      nextExpectedDate,
      confidence: Math.round(confidence * 100) / 100,
      transactionCount: entries.length,
    });
  }

  return detected.sort((a, b) => a.nextExpectedDate.getTime() - b.nextExpectedDate.getTime());
}

/** All projected occurrences of a series inside [start, end] (inclusive). */
export function occurrencesBetween(
  series: { nextExpectedDate: Date; intervalDays: number },
  start: Date,
  end: Date,
): Date[] {
  const dates: Date[] = [];
  let cursor = series.nextExpectedDate;
  // Normally nextExpectedDate is already >= today; guard just in case.
  while (cursor.getTime() < start.getTime()) {
    cursor = addDays(cursor, series.intervalDays);
  }
  while (cursor.getTime() <= end.getTime() && dates.length < 20) {
    dates.push(cursor);
    cursor = addDays(cursor, series.intervalDays);
  }
  return dates;
}

export function cadenceLabel(cadence: string): string {
  switch (cadence) {
    case "weekly":
      return "Weekly";
    case "biweekly":
      return "Every 2 weeks";
    case "monthly":
      return "Monthly";
    case "quarterly":
      return "Quarterly";
    default:
      return cadence;
  }
}

export function projectedTotalInWindow(
  series: { nextExpectedDate: Date; intervalDays: number; averageAmountCents: number },
  start: Date,
  end: Date,
): number {
  return (
    occurrencesBetween(series, start, end).length * series.averageAmountCents
  );
}

export const CADENCE_INTERVAL_DAYS = CADENCE_DAYS;
