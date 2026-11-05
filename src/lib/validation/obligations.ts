import { z } from "zod";
import { FREQUENCIES, RECURRENCES, day, id, money, moneyZero, name, optDay, optId, optText, optUrl, rate, units, unitsZero } from "./common";

export const LOAN_TYPES = ["PERSONAL", "BANK", "MOBILE", "CREDIT_CARD", "SACCO", "OTHER"] as const;
export const LOAN_STATUSES = ["ACTIVE", "PAID_OFF", "DEFAULTED", "WRITTEN_OFF"] as const;

export const loanSchema = z
  .object({
    name: name("Loan name", 100),
    direction: z.enum(["BORROWED", "LENT"]),
    loanType: z.enum(LOAN_TYPES),
    counterparty: name("Lender / borrower", 100),
    principal: money,
    interestRate: rate,
    startDate: day,
    dueDate: day,
    frequency: z.enum(FREQUENCIES),
    status: z.enum(LOAN_STATUSES),
    notes: optText(2000),
    /** Account the principal was received into (borrowed) or paid out of (lent). Empty = no cash movement recorded. */
    accountId: optId,
  })
  .refine((v) => v.dueDate >= v.startDate, { path: ["dueDate"], message: "Due date must be on or after the start date" });

export const repaymentSchema = z
  .object({
    loanId: id,
    date: day,
    principalAmount: moneyZero,
    interestAmount: moneyZero,
    accountId: optId,
    note: optText(500),
  })
  .refine((v) => Number(v.principalAmount) + Number(v.interestAmount) > 0, { path: ["principalAmount"], message: "Enter a principal or interest amount" });

export const ASSET_CLASSES = ["STOCK", "ETF", "MONEY_MARKET", "TREASURY_BILL", "GOVERNMENT_BOND", "MUTUAL_FUND", "CRYPTO", "OTHER"] as const;

export const investmentSchema = z.object({
  name: name("Investment name", 100),
  symbol: optText(20),
  assetClass: z.enum(ASSET_CLASSES),
  platform: optText(80),
  accountId: optId,
  notes: optText(2000),
});

export const investmentCreateSchema = investmentSchema.extend({
  initialUnits: z.union([z.literal(""), units]).optional(),
  initialPrice: z.union([z.literal(""), unitsZero]).optional(),
  initialFees: z.union([z.literal(""), moneyZero]).optional(),
  purchaseDate: optDay,
  payFromAccount: z.boolean().default(false),
});

export const investmentTxnSchema = z
  .object({
    investmentId: id,
    type: z.enum(["BUY", "SELL", "DIVIDEND", "INTEREST"]),
    date: day,
    units: z.union([z.literal(""), units]).optional(),
    price: z.union([z.literal(""), unitsZero]).optional(),
    amount: z.union([z.literal(""), money]).optional(),
    fees: z.union([z.literal(""), moneyZero]).optional(),
    accountId: optId,
    note: optText(500),
  })
  .superRefine((v, ctx) => {
    if (v.type === "BUY" || v.type === "SELL") {
      if (!v.units) ctx.addIssue({ code: "custom", path: ["units"], message: "Enter the number of units" });
      if (!v.price) ctx.addIssue({ code: "custom", path: ["price"], message: "Enter the price per unit" });
    } else if (!v.amount) ctx.addIssue({ code: "custom", path: ["amount"], message: "Enter the amount received" });
  });

export const priceUpdateSchema = z.object({
  investmentId: id,
  mode: z.enum(["PRICE", "VALUE"]),
  value: unitsZero,
  date: day,
});

export const watchlistSchema = z.object({
  symbol: name("Symbol", 20),
  name: name("Name", 100),
  assetClass: z.enum(ASSET_CLASSES),
  targetPrice: z.union([z.literal(""), unitsZero]).optional(),
  lastPrice: z.union([z.literal(""), unitsZero]).optional(),
  notes: optText(1000),
});

export const BILL_KINDS = ["RENT", "ELECTRICITY", "WATER", "INTERNET", "PHONE", "SCHOOL_FEES", "INSURANCE", "LOAN_REPAYMENT", "STREAMING", "HOSTING", "OTHER"] as const;

export const billSchema = z
  .object({
    name: name("Bill name", 100),
    kind: z.enum(BILL_KINDS),
    amount: money,
    categoryId: optId,
    accountId: optId,
    loanId: optId,
    nextDueDate: day,
    recurrence: z.enum(RECURRENCES),
    paymentMethod: optText(60),
    isActive: z.boolean().default(true),
    notes: optText(1000),
  })
  .refine((v) => v.kind !== "LOAN_REPAYMENT" || !!v.loanId, { path: ["loanId"], message: "Choose the loan this bill repays" });

export const billPaySchema = z.object({
  billId: id,
  paidDate: day,
  amount: money,
  accountId: optId,
  paymentMethod: optText(60),
  note: optText(500),
  /** Link an expense you already recorded instead of creating a new one. */
  linkTransactionId: optId,
});

export const BILLING_CYCLES = ["WEEKLY", "MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"] as const;
export const SUB_STATUSES = ["ACTIVE", "TRIAL", "PAUSED", "CANCELLED"] as const;

export const subscriptionSchema = z.object({
  name: name("Subscription name", 100),
  provider: optText(80),
  amount: money,
  billingCycle: z.enum(BILLING_CYCLES),
  nextBillingDate: day,
  paymentMethod: optText(60),
  status: z.enum(SUB_STATUSES),
  categoryId: optId,
  accountId: optId,
  url: optUrl,
  notes: optText(1000),
});

export const subscriptionChargeSchema = z.object({
  subscriptionId: id,
  accountId: id,
  amount: money,
  date: day,
});
