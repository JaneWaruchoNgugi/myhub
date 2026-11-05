import type { Metadata } from "next";
import { requireUserPage } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { goalStats } from "@/lib/services/savings";
import { accountBalances, incomeExpense } from "@/lib/services/ledger";
import { getFinanceOptions } from "@/lib/services/options";
import { addMonths, startOfMonth, todayIn, addDays } from "@/lib/dates";
import { sum } from "@/lib/money";
import { PageHeader } from "@/components/shared/page-header";
import { SavingsView } from "./view";

export const metadata: Metadata = { title: "Savings" };

export default async function SavingsPage() {
  const user = await requireUserPage();
  const today = todayIn(user.prefs.timezone);
  const [goals, options, balances, accounts] = await Promise.all([
    prisma.savingsGoal.findMany({ where: { userId: user.id }, include: { contributions: true, account: { select: { name: true } } }, orderBy: [{ status: "asc" }, { isEmergencyFund: "desc" }, { createdAt: "asc" }] }),
    getFinanceOptions(user.id),
    accountBalances(user.id),
    prisma.account.findMany({ where: { userId: user.id, type: "SAVINGS" }, select: { id: true, name: true } }),
  ]);
  // Average monthly expenses over the last 3 full months, for emergency-fund coverage.
  const ie = await incomeExpense(user.id, addMonths(startOfMonth(today), -3, 1), addDays(startOfMonth(today), -1));
  const avgExpense = ie.expense.div(3);
  const rows = goals.map((g) => {
    const s = goalStats(g, today);
    return {
      id: g.id,
      name: g.name,
      description: g.description ?? "",
      targetAmount: g.targetAmount.toString(),
      targetDate: g.targetDate?.toISOString().slice(0, 10) ?? "",
      priority: g.priority,
      status: g.status,
      isEmergencyFund: g.isEmergencyFund,
      accountId: g.accountId,
      accountName: g.account.name,
      saved: s.saved.toString(),
      remaining: s.remaining.toString(),
      progress: s.progress,
      forecast: s.forecast,
      requiredMonthly: s.requiredMonthly?.toString() ?? null,
      avgMonthly: s.avgMonthly.toString(),
      projectedDate: s.projectedDate?.toISOString().slice(0, 10) ?? null,
    };
  });
  const ef = goals.filter((g) => g.isEmergencyFund).map((g) => goalStats(g, today).saved);
  const efSaved = sum(ef);
  const coverage = avgExpense.isZero() ? null : efSaved.div(avgExpense).toDecimalPlaces(1).toNumber();
  const savingsBalance = sum(accounts.map((a) => balances.get(a.id) ?? 0));
  return (
    <div>
      <PageHeader title="Savings" description="Goals earmark money held in your accounts. Contributions move money between accounts, so nothing is double-counted." />
      <SavingsView
        rows={rows}
        options={options}
        summary={{
          totalSaved: sum(rows.filter((r) => r.status !== "CANCELLED").map((r) => r.saved)).toString(),
          totalTarget: sum(rows.filter((r) => r.status === "ACTIVE").map((r) => r.targetAmount)).toString(),
          savingsBalance: savingsBalance.toString(),
          coverage,
          avgExpense: avgExpense.toDecimalPlaces(2).toString(),
          hasEmergency: ef.length > 0,
        }}
      />
    </div>
  );
}
