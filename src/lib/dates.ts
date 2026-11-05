import { fromZonedTime, formatInTimeZone } from "date-fns-tz";

/** Date-only values are stored at UTC midnight. */
export function dayFromString(s: string): Date {
  return new Date(`${s.slice(0, 10)}T00:00:00.000Z`);
}

export function dayString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Today's calendar date in the given timezone, as a UTC-midnight Date. */
export function todayIn(timeZone: string): Date {
  return dayFromString(new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()));
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

/**
 * Adds months, clamping to the end of month (31 Jan + 1 month = 28/29 Feb).
 * Keeps the time of day, so timed events and tasks don't jump to midnight.
 */
export function addMonths(d: Date, n: number, anchorDay?: number): Date {
  const day = anchorDay ?? d.getUTCDate();
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + n;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(day, last), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds()));
}

export function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
export function endOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
}
export function startOfYear(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
}
export function endOfYear(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), 11, 31));
}
export function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}
export function monthLabel(d: Date, style: "short" | "long" = "short"): string {
  return new Intl.DateTimeFormat("en-GB", { month: style, year: style === "long" ? "numeric" : "2-digit", timeZone: "UTC" }).format(d);
}
export function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

export type Freq = "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "YEARLY";

export function advance(d: Date, freq: Freq | "NONE", anchorDay?: number): Date {
  switch (freq) {
    case "DAILY":
      return addDays(d, 1);
    case "WEEKLY":
      return addDays(d, 7);
    case "BIWEEKLY":
      return addDays(d, 14);
    case "MONTHLY":
      return addMonths(d, 1, anchorDay);
    case "QUARTERLY":
      return addMonths(d, 3, anchorDay);
    case "SEMI_ANNUAL":
      return addMonths(d, 6, anchorDay);
    case "YEARLY":
      return addMonths(d, 12, anchorDay);
    default:
      return d;
  }
}

export function periodsPerYear(freq: Freq): number {
  return { DAILY: 365, WEEKLY: 52, BIWEEKLY: 26, MONTHLY: 12, QUARTERLY: 4, SEMI_ANNUAL: 2, YEARLY: 1 }[freq];
}

/** Converts a wall-clock "YYYY-MM-DDTHH:mm" in the user's timezone to an instant. */
export function zonedToInstant(local: string, timeZone: string): Date {
  return fromZonedTime(local, timeZone);
}

/** Converts an instant to a wall-clock string in the user's timezone. */
export function instantToZoned(d: Date, timeZone: string, fmt = "yyyy-MM-dd'T'HH:mm"): string {
  return formatInTimeZone(d, timeZone, fmt);
}

/** Start (inclusive) and end (exclusive) instants of "today" in the timezone. */
export function todayRangeIn(timeZone: string): { start: Date; end: Date } {
  const t = dayString(todayIn(timeZone));
  const start = fromZonedTime(`${t}T00:00:00`, timeZone);
  return { start, end: new Date(start.getTime() + 86_400_000) };
}
