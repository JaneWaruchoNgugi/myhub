import { Prisma } from "@prisma/client";

/**
 * Decimal-safe money helpers. All arithmetic on money happens with Prisma.Decimal
 * (decimal.js) on the server. Numbers are only produced for display and charts.
 */
export const D = Prisma.Decimal;
export type Dec = Prisma.Decimal;
export type DecLike = Prisma.Decimal | string | number | null | undefined;

export function dec(v: DecLike): Prisma.Decimal {
  if (v === null || v === undefined || v === "") return new D(0);
  return v instanceof D ? v : new D(v);
}

export function sum(values: DecLike[]): Prisma.Decimal {
  return values.reduce<Prisma.Decimal>((acc, v) => acc.plus(dec(v)), new D(0));
}

export function money2(v: DecLike): Prisma.Decimal {
  return dec(v).toDecimalPlaces(2, D.ROUND_HALF_UP);
}

export function pct(part: DecLike, whole: DecLike): number {
  const w = dec(whole);
  if (w.isZero()) return 0;
  return dec(part).div(w).times(100).toDecimalPlaces(1).toNumber();
}

export function minD(a: DecLike, b: DecLike) {
  return D.min(dec(a), dec(b));
}
export function maxD(a: DecLike, b: DecLike) {
  return D.max(dec(a), dec(b));
}

/** Converts Decimal values to strings so data can cross the server/client boundary. */
export type Plain<T> = T extends Prisma.Decimal
  ? string
  : T extends Date
    ? Date
    : T extends Array<infer U>
      ? Plain<U>[]
      : T extends object
        ? { [K in keyof T]: Plain<T[K]> }
        : T;

export function plain<T>(value: T): Plain<T> {
  if (value === null || value === undefined) return value as Plain<T>;
  if (value instanceof D) return value.toString() as Plain<T>;
  if (value instanceof Date) return value as Plain<T>;
  if (Array.isArray(value)) return value.map((v) => plain(v)) as Plain<T>;
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = plain(v);
    return out as Plain<T>;
  }
  return value as Plain<T>;
}
