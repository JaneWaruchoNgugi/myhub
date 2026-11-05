import { z } from "zod";

export const MONEY_RE = /^\d{1,12}(\.\d{1,2})?$/;
export const UNITS_RE = /^\d{1,12}(\.\d{1,8})?$/;
export const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
export const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

const clean = (s: string) => s.replace(/[,\s]/g, "");

/** Positive money amount as a string (decimal-safe), e.g. "1500.50". */
export const money = z
  .string({ required_error: "Amount is required" })
  .transform(clean)
  .pipe(z.string().regex(MONEY_RE, "Enter a valid amount, e.g. 1500 or 1500.50"))
  .refine((v) => Number(v) > 0, "Amount must be greater than zero");

/** Money that may be zero. */
export const moneyZero = z
  .string()
  .transform(clean)
  .pipe(z.string().regex(MONEY_RE, "Enter a valid amount, e.g. 0 or 1500.50"));

/** Signed money (opening balances may be negative for overdrafts). */
export const signedMoney = z
  .string()
  .transform(clean)
  .pipe(z.string().regex(/^-?\d{1,12}(\.\d{1,2})?$/, "Enter a valid amount, e.g. -200 or 1500.50"));

export const units = z
  .string()
  .transform(clean)
  .pipe(z.string().regex(UNITS_RE, "Enter a valid quantity (up to 8 decimals)"))
  .refine((v) => Number(v) > 0, "Must be greater than zero");

export const unitsZero = z.string().transform(clean).pipe(z.string().regex(UNITS_RE, "Enter a valid number (up to 8 decimals)"));

export const rate = z
  .string()
  .transform(clean)
  .pipe(z.string().regex(/^\d{1,3}(\.\d{1,4})?$/, "Enter a rate like 13 or 12.5"))
  .refine((v) => Number(v) <= 999, "Rate looks too high");

/** True only for real calendar dates (rejects 2026-02-31). */
export const isRealDay = (s: string) => {
  const d = new Date(`${s.slice(0, 10)}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s.slice(0, 10) && d.getUTCFullYear() >= 1900 && d.getUTCFullYear() <= 2200;
};
export const day = z.string({ required_error: "Date is required" }).regex(DAY_RE, "Pick a date").refine(isRealDay, "Pick a valid date");
export const optDay = z.union([z.literal(""), z.string().regex(DAY_RE, "Pick a valid date").refine(isRealDay, "Pick a valid date")]).optional();
export const optDateTime = z.union([z.literal(""), z.string().regex(DATETIME_RE, "Pick a valid date and time"), z.string().regex(DAY_RE, "Pick a valid date")]).optional();

export const name = (label = "Name", max = 120) => z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long`);
export const optText = (max = 2000) => z.string().trim().max(max, "Too long").optional();
export const optId = z.string().max(40).optional();
export const id = z.string().min(1).max(40);
export const optUrl = z
  .union([z.literal(""), z.string().trim().url("Enter a full URL starting with https://").max(2000)])
  .optional()
  .refine((v) => !v || /^https?:\/\//i.test(v), "Only http(s) links are allowed");
export const url = z
  .string()
  .trim()
  .url("Enter a full URL starting with https://")
  .max(2000)
  .refine((v) => /^https?:\/\//i.test(v), "Only http(s) links are allowed");
export const tags = z.string().trim().max(500).optional();
export const percent = z.coerce.number().int().min(0, "Min 0").max(100, "Max 100");
export const optMinutes = z.union([z.literal(""), z.coerce.number().int().min(0).max(60 * 24 * 30)]).optional();

export const FREQUENCIES = ["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"] as const;
export const RECURRENCES = ["NONE", ...FREQUENCIES] as const;
export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export const GOAL_STATUSES = ["ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"] as const;
