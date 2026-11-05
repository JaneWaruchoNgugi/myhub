import { z } from "zod";
import { FREQUENCIES, GOAL_STATUSES, PRIORITIES, day, id, money, moneyZero, name, optDay, optId, optText, signedMoney } from "./common";

export const ACCOUNT_TYPES = ["CASH", "BANK", "MOBILE_MONEY", "SAVINGS", "INVESTMENT_CASH", "OTHER"] as const;
export const accountSchema = z.object({
  name: name("Account name", 80),
  type: z.enum(ACCOUNT_TYPES),
  institution: optText(80),
  openingBalance: signedMoney,
  openingDate: day,
  color: z.string().max(20).optional(),
  notes: optText(1000),
  isArchived: z.boolean().optional(),
});

export const categorySchema = z.object({
  name: name("Category name", 60),
  type: z.enum(["INCOME", "EXPENSE"]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a colour").default("#6366f1"),
});

export const transactionSchema = z
  .object({
    type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
    amount: money,
    date: day,
    description: name("Description", 160),
    notes: optText(2000),
    accountId: id,
    toAccountId: optId,
    categoryId: optId,
  })
  .superRefine((v, ctx) => {
    if (v.type === "TRANSFER") {
      if (!v.toAccountId) ctx.addIssue({ code: "custom", path: ["toAccountId"], message: "Choose the destination account" });
      else if (v.toAccountId === v.accountId) ctx.addIssue({ code: "custom", path: ["toAccountId"], message: "Pick a different account" });
    }
  });

export const recurringSchema = z
  .object({
    type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
    amount: money,
    description: name("Description", 160),
    accountId: id,
    toAccountId: optId,
    categoryId: optId,
    frequency: z.enum(FREQUENCIES),
    startDate: day,
    endDate: optDay,
    isActive: z.boolean().default(true),
  })
  .superRefine((v, ctx) => {
    if (v.type === "TRANSFER" && (!v.toAccountId || v.toAccountId === v.accountId))
      ctx.addIssue({ code: "custom", path: ["toAccountId"], message: "Choose a different destination account" });
    if (v.endDate && v.endDate < v.startDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "End date must be after the start" });
  });

export const budgetSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Pick a month"),
  rollover: z.boolean().default(false),
  notes: optText(1000),
  items: z
    .array(z.object({ categoryId: id, limit: money }))
    .min(1, "Add at least one category limit")
    .max(200, "Too many categories")
    .refine((items) => new Set(items.map((i) => i.categoryId)).size === items.length, "Each category can only appear once"),
});

export const savingsGoalSchema = z.object({
  name: name("Goal name", 100),
  description: optText(1000),
  targetAmount: money,
  targetDate: optDay,
  priority: z.enum(PRIORITIES),
  status: z.enum(GOAL_STATUSES),
  isEmergencyFund: z.boolean().default(false),
  accountId: id,
});

export const contributionSchema = z.object({
  goalId: id,
  type: z.enum(["CONTRIBUTION", "WITHDRAWAL"]),
  amount: money,
  date: day,
  note: optText(500),
  /** For a contribution: account the money comes from. For a withdrawal: where it goes. Empty = no money moves. */
  otherAccountId: optId,
});

export const assetSchema = z.object({
  name: name("Asset name", 100),
  type: z.enum(["PROPERTY", "VEHICLE", "EQUIPMENT", "JEWELLERY", "RECEIVABLE", "OTHER"]),
  value: moneyZero,
  valuedAt: day,
  notes: optText(1000),
});

export const liabilitySchema = z.object({
  name: name("Liability name", 100),
  type: z.enum(["CREDIT_CARD", "MORTGAGE", "TAX", "OTHER"]),
  balance: moneyZero,
  asOf: day,
  notes: optText(1000),
});

export const txnLabelSchema = z.object({
  description: name("Description", 160),
  notes: optText(2000),
  categoryId: optId,
});
