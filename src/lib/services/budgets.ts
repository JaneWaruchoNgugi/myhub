import "server-only";
import { prisma } from "@/lib/prisma";
import { D, dec, type Dec } from "@/lib/money";
import { addMonths, endOfMonth } from "@/lib/dates";

export type BudgetLine = {
  itemId: string;
  categoryId: string;
  categoryName: string;
  color: string;
  limit: Dec;
  carry: Dec;
  effectiveLimit: Dec;
  spent: Dec;
  remaining: Dec;
  utilization: number;
  state: "ok" | "warning" | "over";
};

async function spentByCategory(userId: string, month: Date) {
  const rows = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: { userId, type: "EXPENSE", date: { gte: month, lte: endOfMonth(month) } },
    _sum: { amount: true },
  });
  return new Map(rows.map((r) => [r.categoryId, dec(r._sum.amount)]));
}

/**
 * Evaluates a month's budget. With rollover on, last month's unspent amount
 * (or overspend) for the same category is carried into this month's limit.
 */
export async function evaluateBudget(userId: string, month: Date, threshold: number) {
  const budget = await prisma.budget.findUnique({
    where: { userId_month: { userId, month } },
    include: { items: { include: { category: true }, orderBy: { category: { name: "asc" } } } },
  });
  if (!budget) return null;
  const spent = await spentByCategory(userId, month);
  let carryMap = new Map<string, Dec>();
  if (budget.rollover) {
    const prevMonth = addMonths(month, -1, 1);
    const prev = await prisma.budget.findUnique({ where: { userId_month: { userId, month: prevMonth } }, include: { items: true } });
    if (prev) {
      const prevSpent = await spentByCategory(userId, prevMonth);
      carryMap = new Map(prev.items.map((i) => [i.categoryId, dec(i.limit).minus(prevSpent.get(i.categoryId) ?? 0)]));
    }
  }
  const lines: BudgetLine[] = budget.items.map((i) => {
    const carry = carryMap.get(i.categoryId) ?? new D(0);
    const effectiveLimit = D.max(dec(i.limit).plus(carry), 0);
    const s = spent.get(i.categoryId) ?? new D(0);
    const utilization = effectiveLimit.isZero() ? (s.gt(0) ? 100 : 0) : s.div(effectiveLimit).times(100).toDecimalPlaces(1).toNumber();
    return {
      itemId: i.id,
      categoryId: i.categoryId,
      categoryName: i.category.name,
      color: i.category.color,
      limit: dec(i.limit),
      carry,
      effectiveLimit,
      spent: s,
      remaining: effectiveLimit.minus(s),
      utilization,
      state: utilization > 100 ? "over" : utilization >= threshold ? "warning" : "ok",
    };
  });
  const totalLimit = lines.reduce<Dec>((a, l) => a.plus(l.effectiveLimit), new D(0));
  const totalSpent = lines.reduce<Dec>((a, l) => a.plus(l.spent), new D(0));
  // Spending in categories that have no budget line this month.
  const budgeted = new Set(lines.map((l) => l.categoryId));
  let unbudgeted: Dec = new D(0);
  for (const [cat, v] of spent) if (!cat || !budgeted.has(cat)) unbudgeted = unbudgeted.plus(v);
  return { budget, lines, totalLimit, totalSpent, unbudgeted, utilization: totalLimit.isZero() ? 0 : totalSpent.div(totalLimit).times(100).toDecimalPlaces(1).toNumber() };
}
