// Display-only formatting. Safe on client and server.
export type MoneyPrefs = { currency: string; locale: string };

export function formatMoney(value: string | number | null | undefined, prefs: MoneyPrefs, opts?: { compact?: boolean; sign?: boolean }) {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return new Intl.NumberFormat(prefs.locale, {
    style: "currency",
    currency: prefs.currency,
    notation: opts?.compact ? "compact" : "standard",
    maximumFractionDigits: opts?.compact ? 1 : 2,
    minimumFractionDigits: opts?.compact ? 0 : 2,
    signDisplay: opts?.sign ? "exceptZero" : "auto",
  }).format(Number.isFinite(n) ? n : 0);
}

export function formatNumber(value: string | number | null | undefined, maxDigits = 4) {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: maxDigits }).format(n);
}

export function formatPct(value: number, digits = 1) {
  return `${value.toFixed(digits)}%`;
}

/** Formats a date-only value (stored as UTC midnight). */
export function formatDay(value: Date | string | null | undefined, style: "short" | "medium" | "long" | "month" | "monthShort" = "medium") {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  const opts: Intl.DateTimeFormatOptions =
    style === "month"
      ? { month: "long", year: "numeric", timeZone: "UTC" }
      : style === "monthShort"
        ? { month: "short", year: "2-digit", timeZone: "UTC" }
        : style === "short"
      ? { day: "numeric", month: "short", timeZone: "UTC" }
      : style === "long"
        ? { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }
        : { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" };
  return new Intl.DateTimeFormat("en-GB", opts).format(d);
}

/** Formats an instant in the user's timezone. */
export function formatDateTime(value: Date | string | null | undefined, timeZone: string, withTime = true) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone,
  }).format(d);
}

export function dayKey(value: Date | string) {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toISOString().slice(0, 10);
}
