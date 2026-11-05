import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/csv";
import { txnOrder, txnWhere } from "@/lib/services/queries";
import { byCategory, monthlySeries } from "@/lib/services/ledger";
import { evaluateBudget } from "@/lib/services/budgets";
import { holdingStats } from "@/lib/services/investments";
import { loanSummary } from "@/lib/services/loans";
import { goalStats } from "@/lib/services/savings";
import { annualCost, monthlyCost } from "@/lib/services/subscriptions";
import { DAY_RE } from "@/lib/validation/common";
import { addMonths, dayFromString, endOfMonth, startOfMonth, startOfYear, todayIn } from "@/lib/dates";

export const dynamic = "force-dynamic";

function range(sp: URLSearchParams, tz: string) {
  const today = todayIn(tz);
  const from = sp.get("from") && DAY_RE.test(sp.get("from")!) ? dayFromString(sp.get("from")!) : startOfYear(today);
  const to = sp.get("to") && DAY_RE.test(sp.get("to")!) ? dayFromString(sp.get("to")!) : endOfMonth(today);
  return { from, to, today };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { type } = await params;
  const sp = req.nextUrl.searchParams;
  const { from, to, today } = range(sp, user.prefs.timezone);
  const uid = user.id;
  let headers: string[] = [];
  let rows: unknown[][] = [];

  switch (type) {
    case "transactions": {
      const where = txnWhere(uid, Object.fromEntries(sp.entries()));
      const data = await prisma.transaction.findMany({ where, orderBy: txnOrder(sp.get("sort") ?? undefined), take: 50_000, include: { account: true, toAccount: true, category: true } });
      headers = ["Date", "Type", "Description", "Category", "Account", "To account", "Amount", "Currency", "Source", "Notes"];
      rows = data.map((t) => [t.date, t.type, t.description, t.category?.name ?? "", t.account.name, t.toAccount?.name ?? "", t.amount.toString(), user.prefs.currency, t.source, t.notes ?? ""]);
      break;
    }
    case "monthly": {
      const data = await monthlySeries(uid, startOfMonth(from), to);
      headers = ["Month", "Income", "Expenses", "Net"];
      rows = data.map((r) => [r.month, r.income, r.expense, r.net]);
      break;
    }
    case "categories": {
      const [e, i] = await Promise.all([byCategory(uid, "EXPENSE", from, to), byCategory(uid, "INCOME", from, to)]);
      headers = ["Type", "Category", "Total"];
      rows = [...i.map((r) => ["Income", r.name, r.total]), ...e.map((r) => ["Expense", r.name, r.total])];
      break;
    }
    case "budgets": {
      headers = ["Month", "Category", "Limit", "Carried over", "Spent", "Remaining", "Utilisation %"];
      for (let m = startOfMonth(from); m <= to; m = addMonths(m, 1, 1)) {
        const b = await evaluateBudget(uid, m, user.prefs.budgetAlertThreshold);
        for (const l of b?.lines ?? []) rows.push([m.toISOString().slice(0, 7), l.categoryName, l.limit.toString(), l.carry.toString(), l.spent.toString(), l.remaining.toString(), l.utilization]);
      }
      break;
    }
    case "savings": {
      const goals = await prisma.savingsGoal.findMany({ where: { userId: uid }, include: { contributions: { orderBy: { date: "asc" } } } });
      headers = ["Goal", "Date", "Type", "Amount", "Note"];
      for (const g of goals) for (const c of g.contributions) if (c.date >= from && c.date <= to) rows.push([g.name, c.date, c.type, c.amount.toString(), c.note ?? ""]);
      break;
    }
    case "loans": {
      const loans = await prisma.loan.findMany({ where: { userId: uid }, include: { repayments: { orderBy: { date: "asc" } } } });
      headers = ["Loan", "Direction", "Date", "Principal", "Interest", "Outstanding after"];
      for (const l of loans) {
        let out = l.principal;
        for (const r of l.repayments) {
          out = out.minus(r.principalAmount);
          if (r.date >= from && r.date <= to) rows.push([l.name, l.direction, r.date, r.principalAmount.toString(), r.interestAmount.toString(), out.toString()]);
        }
      }
      break;
    }
    case "investments": {
      const invs = await prisma.investment.findMany({ where: { userId: uid }, include: { transactions: true } });
      headers = ["Investment", "Symbol", "Asset class", "Units", "Cost basis", "Price", "Market value", "Unrealized P/L", "Realized P/L", "Dividends & interest", "Price source", "Price updated"];
      rows = invs.map((i) => {
        const s = holdingStats(i);
        return [i.name, i.symbol ?? "", i.assetClass, i.units.toString(), s.cost.toString(), i.currentPrice.toString(), s.value.toString(), s.unrealized.toString(), s.realized.toString(), s.income.toString(), i.priceSource, i.priceUpdatedAt ?? ""];
      });
      break;
    }
    case "networth": {
      const snaps = await prisma.netWorthSnapshot.findMany({ where: { userId: uid, date: { gte: startOfMonth(from), lte: to } }, orderBy: { date: "asc" } });
      headers = ["Month", "Total assets", "Total liabilities", "Net worth"];
      rows = snaps.map((s) => [s.date.toISOString().slice(0, 7), s.totalAssets.toString(), s.totalLiabilities.toString(), s.netWorth.toString()]);
      break;
    }
    case "subscriptions": {
      const subs = await prisma.subscription.findMany({ where: { userId: uid }, orderBy: { name: "asc" } });
      headers = ["Name", "Provider", "Status", "Amount", "Billing cycle", "Monthly cost", "Annual cost", "Next billing"];
      rows = subs.map((s) => [s.name, s.provider ?? "", s.status, s.amount.toString(), s.billingCycle, monthlyCost(s.amount, s.billingCycle).toString(), annualCost(s.amount, s.billingCycle).toString(), s.nextBillingDate]);
      break;
    }
    case "goals": {
      const goals = await prisma.savingsGoal.findMany({ where: { userId: uid }, include: { contributions: true } });
      headers = ["Goal", "Target", "Saved", "Remaining", "Progress %", "Target date", "Forecast"];
      rows = goals.map((g) => {
        const s = goalStats(g, today);
        return [g.name, s.target.toString(), s.saved.toString(), s.remaining.toString(), s.progress, g.targetDate ?? "", s.forecast];
      });
      break;
    }
    case "loan-summary": {
      const loans = await prisma.loan.findMany({ where: { userId: uid }, include: { repayments: true } });
      headers = ["Loan", "Direction", "Counterparty", "Principal", "Repaid", "Interest paid", "Outstanding", "Rate %", "Status", "Due date"];
      rows = loans.map((l) => {
        const s = loanSummary(l, today);
        return [l.name, l.direction, l.counterparty, s.principal.toString(), s.principalRepaid.toString(), s.interestPaid.toString(), s.outstanding.toString(), l.interestRate.toString(), l.status, l.dueDate];
      });
      break;
    }
    default:
      return NextResponse.json({ error: "Unknown export" }, { status: 404 });
  }
  const filename = `myhub-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse("﻿" + toCsv(headers, rows), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" },
  });
}
