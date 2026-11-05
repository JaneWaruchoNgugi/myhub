import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUserPage } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { goalStats } from "@/lib/services/savings";
import { getFinanceOptions } from "@/lib/services/options";
import { todayIn } from "@/lib/dates";
import { GoalDetail } from "./view";

export const metadata: Metadata = { title: "Savings goal" };

export default async function GoalPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUserPage();
  const { id } = await params;
  const g = await prisma.savingsGoal.findFirst({ where: { id, userId: user.id }, include: { contributions: { orderBy: [{ date: "desc" }, { createdAt: "desc" }], include: { transaction: { include: { account: true, toAccount: true } } } }, account: true } });
  if (!g) notFound();
  const s = goalStats(g, todayIn(user.prefs.timezone));
  const options = await getFinanceOptions(user.id);
  let running = 0;
  const chrono = [...g.contributions].reverse().map((c) => {
    running += (c.type === "CONTRIBUTION" ? 1 : -1) * Number(c.amount);
    return { date: c.date.toISOString(), netWorth: running.toFixed(2) };
  });
  return (
    <GoalDetail
      options={options}
      goal={{
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
      }}
      history={g.contributions.map((c) => ({
        id: c.id,
        type: c.type,
        amount: c.amount.toString(),
        date: c.date.toISOString().slice(0, 10),
        note: c.note ?? "",
        movement: c.transaction ? `${c.transaction.account.name} → ${c.transaction.toAccount?.name ?? ""}` : null,
      }))}
      series={chrono}
    />
  );
}
