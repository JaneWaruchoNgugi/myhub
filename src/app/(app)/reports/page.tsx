import type { Metadata } from "next";
import { requireUserPage } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { byCategory, incomeExpense, monthlySeries } from "@/lib/services/ledger";
import { evaluateBudget } from "@/lib/services/budgets";
import { goalStats } from "@/lib/services/savings";
import { loanSummary } from "@/lib/services/loans";
import { holdingStats } from "@/lib/services/investments";
import { computeNetWorth } from "@/lib/services/networth";
import { annualCost, monthlyCost } from "@/lib/services/subscriptions";
import { D, sum } from "@/lib/money";
import { addMonths, dayFromString, dayString, endOfMonth, startOfMonth, startOfYear, todayIn } from "@/lib/dates";
import { DAY_RE } from "@/lib/validation/common";
import { PageHeader } from "@/components/shared/page-header";
import { ReportsView } from "./view";

export const metadata: Metadata = { title: "Reports" };

function parseDay(s: string | undefined) {
  if (!s || !DAY_RE.test(s)) return null;
  const d = dayFromString(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; tab?: string }> }) {
  const user = await requireUserPage();
  const sp = await searchParams;
  const uid = user.id;
  const today = todayIn(user.prefs.timezone);
  let from = parseDay(sp.from) ?? startOfYear(today);
  let to = parseDay(sp.to) ?? endOfMonth(today);
  if (from > to) [from, to] = [to, from];

  const [totals, months, expenseCats, incomeCats, goals, loans, invs, snaps, nw, subs, subCharges, repaymentsInRange, investIncome] = await Promise.all([
    incomeExpense(uid, from, to),
    monthlySeries(uid, startOfMonth(from), to),
    byCategory(uid, "EXPENSE", from, to),
    byCategory(uid, "INCOME", from, to),
    prisma.savingsGoal.findMany({ where: { userId: uid }, include: { contributions: true, account: { select: { name: true } } }, orderBy: { createdAt: "asc" } }),
    prisma.loan.findMany({ where: { userId: uid }, include: { repayments: true }, orderBy: { startDate: "desc" } }),
    prisma.investment.findMany({ where: { userId: uid }, include: { transactions: true }, orderBy: { name: "asc" } }),
    prisma.netWorthSnapshot.findMany({ where: { userId: uid, date: { gte: startOfMonth(from), lte: to } }, orderBy: { date: "asc" } }),
    computeNetWorth(uid),
    prisma.subscription.findMany({ where: { userId: uid }, orderBy: { name: "asc" } }),
    prisma.subscriptionCharge.aggregate({ where: { subscription: { userId: uid }, billingDate: { gte: from, lte: to } }, _sum: { amount: true } }),
    prisma.loanRepayment.findMany({ where: { userId: uid, date: { gte: from, lte: to } }, include: { loan: { select: { direction: true } } } }),
    prisma.investmentTransaction.groupBy({ by: ["type"], where: { userId: uid, date: { gte: from, lte: to }, type: { in: ["DIVIDEND", "INTEREST", "BUY", "SELL"] } }, _sum: { amount: true } }),
  ]);

  // Budgets: every month in range that has a budget (capped at 24 months).
  const budgetMonths: { month: string; limit: string; spent: string; over: number; lines: number }[] = [];
  const catAgg = new Map<string, { name: string; limit: InstanceType<typeof D>; spent: InstanceType<typeof D> }>();
  let m = startOfMonth(from);
  for (let i = 0; m <= to && i < 24; i++, m = addMonths(m, 1, 1)) {
    const b = await evaluateBudget(uid, m, user.prefs.budgetAlertThreshold);
    if (!b) continue;
    budgetMonths.push({ month: dayString(m).slice(0, 7), limit: sum(b.lines.map((l) => l.effectiveLimit)).toString(), spent: sum(b.lines.map((l) => l.spent)).toString(), over: b.lines.filter((l) => l.state === "over").length, lines: b.lines.length });
    for (const l of b.lines) {
      const e = catAgg.get(l.categoryId) ?? { name: l.categoryName, limit: new D(0), spent: new D(0) };
      e.limit = e.limit.plus(l.effectiveLimit);
      e.spent = e.spent.plus(l.spent);
      catAgg.set(l.categoryId, e);
    }
  }

  const holdings = invs.map((i) => ({ i, s: holdingStats(i) }));
  const inv = (t: string) => investIncome.find((r) => r.type === t)?._sum.amount?.toString() ?? "0";
  const activeSubs = subs.filter((s) => s.status === "ACTIVE" || s.status === "TRIAL");
  const repSum = (dir: "BORROWED" | "LENT", k: "principalAmount" | "interestAmount") => sum(repaymentsInRange.filter((r) => r.loan.direction === dir).map((r) => r[k])).toString();

  return (
    <div>
      <PageHeader title="Reports" description="Cash flow, spending, budgets, savings, loans, investments, net worth and subscriptions for any period. Every report exports to CSV." />
      <ReportsView
        from={dayString(from)}
        to={dayString(to)}
        today={dayString(today)}
        tab={sp.tab}
        cashflow={{ income: totals.income.toString(), expense: totals.expense.toString(), net: totals.net.toString(), savingsRate: totals.savingsRate, months }}
        categories={{ expense: expenseCats, income: incomeCats }}
        budgets={{ months: budgetMonths, categories: [...catAgg.values()].map((c) => ({ name: c.name, limit: c.limit.toString(), spent: c.spent.toString(), pct: c.limit.isZero() ? 0 : c.spent.div(c.limit).times(100).toDecimalPlaces(0).toNumber() })).sort((a, b) => b.pct - a.pct) }}
        goals={goals.map((g) => {
          const s = goalStats(g, today);
          const inRange = g.contributions.filter((c) => c.date >= from && c.date <= to);
          return {
            id: g.id,
            name: g.name,
            account: g.account?.name ?? "",
            status: g.status,
            target: s.target.toString(),
            saved: s.saved.toString(),
            remaining: s.remaining.toString(),
            progress: s.progress,
            forecast: s.forecast,
            targetDate: g.targetDate ? dayString(g.targetDate) : "",
            periodNet: sum(inRange.map((c) => (c.type === "CONTRIBUTION" ? c.amount : c.amount.negated()))).toString(),
          };
        })}
        loans={{
          rows: loans.map((l) => {
            const s = loanSummary(l, today);
            return { id: l.id, name: l.name, direction: l.direction, counterparty: l.counterparty, status: l.status, principal: s.principal.toString(), repaid: s.principalRepaid.toString(), interest: s.interestPaid.toString(), outstanding: s.outstanding.toString(), progress: s.progress, dueDate: dayString(l.dueDate) };
          }),
          period: { borrowedPrincipal: repSum("BORROWED", "principalAmount"), borrowedInterest: repSum("BORROWED", "interestAmount"), lentPrincipal: repSum("LENT", "principalAmount"), lentInterest: repSum("LENT", "interestAmount") },
        }}
        investments={{
          rows: holdings.map(({ i, s }) => ({ id: i.id, name: i.name, symbol: i.symbol ?? "", assetClass: i.assetClass, value: s.value.toString(), cost: s.cost.toString(), unrealized: s.unrealized.toString(), unrealizedPct: s.unrealizedPct, realized: s.realized.toString(), income: s.income.toString(), priceSource: i.priceSource, priceUpdatedAt: i.priceUpdatedAt ? dayString(i.priceUpdatedAt) : "" })),
          totals: {
            value: sum(holdings.map((h) => h.s.value)).toString(),
            cost: sum(holdings.map((h) => h.s.cost)).toString(),
            unrealized: sum(holdings.map((h) => h.s.unrealized)).toString(),
            realized: sum(holdings.map((h) => h.s.realized)).toString(),
            income: sum(holdings.map((h) => h.s.income)).toString(),
          },
          period: { dividends: inv("DIVIDEND"), interest: inv("INTEREST"), bought: inv("BUY"), sold: inv("SELL") },
        }}
        networth={{
          current: { assets: nw.totalAssets.toString(), liabilities: nw.totalLiabilities.toString(), netWorth: nw.netWorth.toString() },
          snapshots: snaps.map((s) => ({ date: dayString(s.date).slice(0, 7), netWorth: s.netWorth.toString(), assets: s.totalAssets.toString(), liabilities: s.totalLiabilities.toString() })),
          breakdown: nw.breakdown,
        }}
        subscriptions={{
          rows: subs.map((s) => ({ id: s.id, name: s.name, status: s.status, cycle: s.billingCycle, amount: s.amount.toString(), monthly: monthlyCost(s.amount, s.billingCycle).toString(), annual: annualCost(s.amount, s.billingCycle).toString() })),
          monthly: sum(activeSubs.map((s) => monthlyCost(s.amount, s.billingCycle))).toString(),
          annual: sum(activeSubs.map((s) => annualCost(s.amount, s.billingCycle))).toString(),
          chargedInPeriod: subCharges._sum?.amount?.toString() ?? "0",
        }}
      />
    </div>
  );
}
