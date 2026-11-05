import "server-only";
import type { Prisma } from "@prisma/client";
import { DAY_RE } from "@/lib/validation/common";

export type TxnFilters = { q?: string; type?: string; account?: string; category?: string; from?: string; to?: string; sort?: string; page?: string; source?: string };

const TYPES = new Set(["INCOME", "EXPENSE", "TRANSFER", "INFLOW", "OUTFLOW"]);

/** Builds a user-scoped, injection-safe Prisma filter from URL params. */
export function txnWhere(userId: string, f: TxnFilters): Prisma.TransactionWhereInput {
  const where: Prisma.TransactionWhereInput = { userId };
  const and: Prisma.TransactionWhereInput[] = [];
  if (f.type && TYPES.has(f.type)) where.type = f.type as Prisma.EnumTransactionTypeFilter["equals"];
  if (f.account) and.push({ OR: [{ accountId: f.account }, { toAccountId: f.account }] });
  if (f.category) where.categoryId = f.category === "none" ? null : f.category;
  if (f.source === "auto") where.source = { not: "MANUAL" };
  const date: Prisma.DateTimeFilter = {};
  if (f.from && DAY_RE.test(f.from)) date.gte = new Date(`${f.from}T00:00:00Z`);
  if (f.to && DAY_RE.test(f.to)) date.lte = new Date(`${f.to}T00:00:00Z`);
  if (date.gte || date.lte) where.date = date;
  const q = f.q?.trim().slice(0, 100);
  if (q) and.push({ OR: [{ description: { contains: q, mode: "insensitive" } }, { notes: { contains: q, mode: "insensitive" } }, { category: { name: { contains: q, mode: "insensitive" } } }] });
  if (and.length) where.AND = and;
  return where;
}

export function txnOrder(sort?: string): Prisma.TransactionOrderByWithRelationInput[] {
  switch (sort) {
    case "date_asc":
      return [{ date: "asc" }, { createdAt: "asc" }];
    case "amount_desc":
      return [{ amount: "desc" }, { date: "desc" }];
    case "amount_asc":
      return [{ amount: "asc" }, { date: "desc" }];
    default:
      return [{ date: "desc" }, { createdAt: "desc" }];
  }
}
