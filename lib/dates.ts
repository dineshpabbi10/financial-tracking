/**
 * All calendar dates are stored at 12:00 UTC (noon) so they stay on the
 * intended day regardless of server timezone. Display with timeZone "UTC".
 */
export const APP_TIMEZONE = process.env.APP_TIMEZONE || "America/Toronto";

const DAY_MS = 86_400_000;

export function parseDateOnly(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid date: ${value}`);
  }
  return new Date(`${value}T12:00:00.000Z`);
}

export function toCalendarDate(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      12,
    ),
  );
}

/** "Today" in the app's configured timezone, normalized to noon UTC. */
export function today(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "01";
  return new Date(
    Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day")), 12),
  );
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 12));
}

export function endOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 12));
}

export function daysInMonth(date: Date): number {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
}

export function monthKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function monthKeyToDate(key: string): Date {
  return parseDateOnly(`${key}-01`);
}

export function monthRange(key: string): { start: Date; end: Date } {
  const start = monthKeyToDate(key);
  return { start, end: endOfMonth(start) };
}

export function lastNMonths(
  n: number,
  anchor: Date = today(),
): Array<{ key: string; label: string; start: Date; end: Date }> {
  const monthStart = startOfMonth(anchor);
  const months = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(
      Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() - i, 1, 12),
    );
    months.push({
      key: monthKey(d),
      label: formatMonth(d),
      start: startOfMonth(d),
      end: endOfMonth(d),
    });
  }
  return months;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

export function formatMonth(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatDateShort(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatDateWithWeekday(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function relativeDateLabel(date: Date, from: Date = today()): string {
  const diff = daysBetween(from, date);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff < 7) return formatDateWithWeekday(date);
  return formatDateShort(date);
}

export function shortMonth(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    month: "short",
  }).format(date);
}
