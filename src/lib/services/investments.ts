import "server-only";
import type { Prisma } from "@prisma/client";
import { D, dec, type Dec, type DecLike } from "@/lib/money";
import { UserError } from "@/lib/action";

/**
 * Replays an investment's trades in date order using the average-cost method and
 * writes back units, cost basis and each sale's realized gain. Throws if a sale
 * would sell more units than were held at that point.
 */
export async function recomputeHolding(tx: Prisma.TransactionClient, investmentId: string) {
  const txns = await tx.investmentTransaction.findMany({ where: { investmentId }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] });
  let units = new D(0);
  let cost = new D(0);
  for (const t of txns) {
    if (t.type === "BUY") {
      units = units.plus(t.units);
      cost = cost.plus(dec(t.amount)).plus(dec(t.fees));
    } else if (t.type === "SELL") {
      if (dec(t.units).gt(units)) throw new UserError(`Can't sell ${t.units} units on ${t.date.toISOString().slice(0, 10)}: only ${units.toString()} held then.`);
      const removed = units.eq(t.units) ? cost : cost.div(units).times(t.units).toDecimalPlaces(2, D.ROUND_HALF_UP);
      const proceeds = dec(t.amount).minus(dec(t.fees));
      units = units.minus(t.units);
      cost = cost.minus(removed);
      await tx.investmentTransaction.update({ where: { id: t.id }, data: { costRemoved: removed, realizedGain: proceeds.minus(removed) } });
    }
  }
  await tx.investment.update({ where: { id: investmentId }, data: { units, costBasis: cost.toDecimalPlaces(2, D.ROUND_HALF_UP) } });
  return { units, cost };
}

export type HoldingLike = { units: DecLike; costBasis: DecLike; currentPrice: DecLike; transactions?: { type: string; amount: DecLike; realizedGain: DecLike | null }[] };

export function holdingStats(h: HoldingLike) {
  const value = dec(h.units).times(dec(h.currentPrice)).toDecimalPlaces(2, D.ROUND_HALF_UP);
  const cost = dec(h.costBasis);
  const unrealized = value.minus(cost);
  const unrealizedPct = cost.isZero() ? 0 : unrealized.div(cost).times(100).toDecimalPlaces(2).toNumber();
  let realized: Dec = new D(0);
  let income: Dec = new D(0);
  for (const t of h.transactions ?? []) {
    if (t.type === "SELL") realized = realized.plus(dec(t.realizedGain));
    if (t.type === "DIVIDEND" || t.type === "INTEREST") income = income.plus(dec(t.amount));
  }
  return { value, cost, unrealized, unrealizedPct, realized, income, totalReturn: unrealized.plus(realized).plus(income) };
}

/**
 * Month-end portfolio value vs amount invested for the last N months.
 * Units come from the trade history; price is the latest recorded price on or
 * before each month end (manual updates or trade prices). Nothing is fabricated:
 * months with no known price use the last known one.
 */
export async function portfolioSeries(userId: string, monthEnds: Date[]) {
  const { prisma } = await import("@/lib/prisma");
  const invs = await prisma.investment.findMany({
    where: { userId },
    include: { transactions: { orderBy: { date: "asc" } }, prices: { orderBy: { date: "asc" } } },
  });
  return monthEnds.map((end) => {
    let value = new D(0);
    let cost = new D(0);
    for (const inv of invs) {
      let units = new D(0);
      let c = new D(0);
      for (const t of inv.transactions) {
        if (t.date > end) break;
        if (t.type === "BUY") {
          units = units.plus(t.units);
          c = c.plus(t.amount).plus(t.fees);
        } else if (t.type === "SELL") {
          c = c.minus(dec(t.costRemoved));
          units = units.minus(t.units);
        }
      }
      if (units.isZero()) continue;
      let price: Dec | null = null;
      for (const p of inv.prices) {
        if (p.date > end) break;
        price = dec(p.price);
      }
      value = value.plus(units.times(price ?? 0));
      cost = cost.plus(c);
    }
    return { month: end.toISOString().slice(0, 7), value: value.toDecimalPlaces(2).toString(), cost: cost.toDecimalPlaces(2).toString() };
  });
}
