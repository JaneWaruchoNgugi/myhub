import type { Metadata } from "next";
import { requireUserPage } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { evaluateBudget } from "@/lib/services/budgets";
import { addMonths, dayFromString, startOfMonth, todayIn } from "@/lib/dates";
import { PageHeader } from "@/components/shared/page-header";
import { BudgetsView } from "./view";

export const metadata: Metadata = { title: "Budgets" };

export default async function BudgetsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireUserPage();
  const sp = await searchParams;
  const current = startOfMonth(todayIn(user.prefs.timezone));
  const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? dayFromString(`${sp.month}-01`) : current;
  const threshold = user.prefs.budgetAlertThreshold;
  const [b, cats] = await Promise.all([evaluateBudget(user.id, month, threshold), prisma.transactionCategory.findMany({ where: { userId: user.id, type: "EXPENSE" }, orderBy: { name: "asc" } })]);
  const compare = [];
  for (let i = 5; i >= 0; i--) {
    const m = addMonths(month, -i, 1);
    const e = await evaluateBudget(user.id, m, threshold);
    compare.push({ label: new Intl.DateTimeFormat("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" }).format(m), Budget: e ? e.totalLimit.toNumber() : 0, Spent: e ? e.totalSpent.toNumber() : 0 });
  }
  return (
    <div>
      <PageHeader title="Budgets" description={`Monthly limits per category. You're warned at ${threshold}% (change this in Settings).`} />
      <BudgetsView
        month={month.toISOString().slice(0, 7)}
        isCurrent={month.getTime() === current.getTime()}
        threshold={threshold}
        categories={cats.map((c) => ({ value: c.id, label: c.name }))}
        budget={
          b
            ? {
                id: b.budget.id,
                rollover: b.budget.rollover,
                notes: b.budget.notes ?? "",
                totalLimit: b.totalLimit.toString(),
                totalSpent: b.totalSpent.toString(),
                unbudgeted: b.unbudgeted.toString(),
                utilization: b.utilization,
                lines: b.lines.map((l) => ({ ...l, limit: l.limit.toString(), carry: l.carry.toString(), effectiveLimit: l.effectiveLimit.toString(), spent: l.spent.toString(), remaining: l.remaining.toString() })),
              }
            : null
        }
        compare={compare}
      />
    </div>
  );
}
