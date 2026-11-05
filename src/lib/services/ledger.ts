import "server-only";
import { Prisma, type AccountType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { D, dec, type Dec } from "@/lib/money";

/**
 * Account balance = opening balance
 *   + INCOME + INFLOW + transfers in
 *   − EXPENSE − OUTFLOW − transfers out
 * Computed from the ledger, never stored, so it can't drift.
 */
export async function accountBalances(userId: string, asOf?: Date): Promise<Map<string, Dec>> {
  const dateFilter = asOf ? { date: { lte: asOf } } : {};
  const [accounts, bySource, byDest] = await Promise.all([
    prisma.account.findMany({ where: { userId }, select: { id: true, openingBalance: true, openingDate: true } }),
    prisma.transaction.groupBy({ by: ["accountId", "type"], where: { userId, ...dateFilter }, _sum: { amount: true } }),
    prisma.transaction.groupBy({ by: ["toAccountId"], where: { userId, type: "TRANSFER", toAccountId: { not: null }, ...dateFilter }, _sum: { amount: true } }),
  ]);
  const balances = new Map<string, Dec>();
  for (const a of accounts) balances.set(a.id, asOf && a.openingDate > asOf ? new D(0) : dec(a.openingBalance));
  for (const row of bySource) {
    const cur = balances.get(row.accountId);
    if (!cur) continue;
    const amt = dec(row._sum.amount);
    const signed = row.type === "INCOME" || row.type === "INFLOW" ? amt : amt.negated();
    balances.set(row.accountId, cur.plus(signed));
  }
  for (const row of byDest) {
    if (!row.toAccountId) continue;
    const cur = balances.get(row.toAccountId);
    if (cur) balances.set(row.toAccountId, cur.plus(dec(row._sum.amount)));
  }
  return balances;
}

/** Balance of one account inside a DB transaction (used to block overdrawing on transfers). */
export async function accountBalanceTx(tx: Prisma.TransactionClient, userId: string, accountId: string): Promise<Dec> {
  const acc = await tx.account.findFirst({ where: { id: accountId, userId }, select: { openingBalance: true } });
  if (!acc) return new D(0);
  const [out, inn] = await Promise.all([
    tx.transaction.groupBy({ by: ["type"], where: { userId, accountId }, _sum: { amount: true } }),
    tx.transaction.aggregate({ where: { userId, toAccountId: accountId, type: "TRANSFER" }, _sum: { amount: true } }),
  ]);
  let bal = dec(acc.openingBalance).plus(dec(inn._sum.amount));
  for (const r of out) bal = r.type === "INCOME" || r.type === "INFLOW" ? bal.plus(dec(r._sum.amount)) : bal.minus(dec(r._sum.amount));
  return bal;
}

export type AccountWithBalance = {
  id: string;
  name: string;
  type: AccountType;
  institution: string | null;
  color: string | null;
  isArchived: boolean;
  balance: Dec;
};

export async function accountsWithBalances(userId: string, includeArchived = true): Promise<AccountWithBalance[]> {
  const [accounts, balances] = await Promise.all([
    prisma.account.findMany({ where: { userId, ...(includeArchived ? {} : { isArchived: false }) }, orderBy: [{ isArchived: "asc" }, { createdAt: "asc" }] }),
    accountBalances(userId),
  ]);
  return accounts.map((a) => ({ id: a.id, name: a.name, type: a.type, institution: a.institution, color: a.color, isArchived: a.isArchived, balance: balances.get(a.id) ?? new D(0) }));
}

/** Income and expense totals for a period. Transfers, inflows and outflows are excluded. */
export async function incomeExpense(userId: string, from: Date, to: Date) {
  const rows = await prisma.transaction.groupBy({
    by: ["type"],
    where: { userId, type: { in: ["INCOME", "EXPENSE"] }, date: { gte: from, lte: to } },
    _sum: { amount: true },
  });
  const income = dec(rows.find((r) => r.type === "INCOME")?._sum.amount);
  const expense = dec(rows.find((r) => r.type === "EXPENSE")?._sum.amount);
  const net = income.minus(expense);
  const savingsRate = income.isZero() ? 0 : net.div(income).times(100).toDecimalPlaces(1).toNumber();
  return { income, expense, net, savingsRate };
}

export type MonthRow = { month: string; income: string; expense: string; net: string };

/** Monthly income vs expense series between two dates (inclusive), zero-filled. */
export async function monthlySeries(userId: string, from: Date, to: Date): Promise<MonthRow[]> {
  const rows = await prisma.$queryRaw<{ m: Date; type: string; total: Prisma.Decimal }[]>(Prisma.sql`
    SELECT date_trunc('month', "date")::date AS m, "type"::text AS type, SUM("amount") AS total
    FROM "Transaction"
    WHERE "userId" = ${userId} AND "type" IN ('INCOME', 'EXPENSE') AND "date" >= ${from} AND "date" <= ${to}
    GROUP BY 1, 2 ORDER BY 1`);
  const map = new Map<string, { income: Dec; expense: Dec }>();
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  while (cursor <= to) {
    map.set(cursor.toISOString().slice(0, 7), { income: new D(0), expense: new D(0) });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  for (const r of rows) {
    const k = new Date(r.m).toISOString().slice(0, 7);
    const e = map.get(k);
    if (!e) continue;
    if (r.type === "INCOME") e.income = e.income.plus(dec(r.total));
    else e.expense = e.expense.plus(dec(r.total));
  }
  return [...map.entries()].map(([month, v]) => ({ month, income: v.income.toString(), expense: v.expense.toString(), net: v.income.minus(v.expense).toString() }));
}

export type CategoryRow = { categoryId: string | null; name: string; color: string; total: string };

export async function byCategory(userId: string, type: "INCOME" | "EXPENSE", from: Date, to: Date): Promise<CategoryRow[]> {
  const [rows, cats] = await Promise.all([
    prisma.transaction.groupBy({ by: ["categoryId"], where: { userId, type, date: { gte: from, lte: to } }, _sum: { amount: true } }),
    prisma.transactionCategory.findMany({ where: { userId }, select: { id: true, name: true, color: true } }),
  ]);
  const catMap = new Map(cats.map((c) => [c.id, c]));
  return rows
    .map((r) => {
      const c = r.categoryId ? catMap.get(r.categoryId) : undefined;
      return { categoryId: r.categoryId, name: c?.name ?? "Uncategorised", color: c?.color ?? "#94a3b8", total: dec(r._sum.amount).toString() };
    })
    .sort((a, b) => Number(b.total) - Number(a.total));
}
