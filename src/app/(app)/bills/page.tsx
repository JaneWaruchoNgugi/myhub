import type { Metadata } from "next";
import { requireUserPage } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getFinanceOptions } from "@/lib/services/options";
import { addDays, diffDays, todayIn } from "@/lib/dates";
import { PageHeader } from "@/components/shared/page-header";
import { BillsView } from "./view";

export const metadata: Metadata = { title: "Bills" };

export default async function BillsPage() {
  const user = await requireUserPage();
  const today = todayIn(user.prefs.timezone);
  const [bills, options, recentExpenses] = await Promise.all([
    prisma.bill.findMany({
      where: { userId: user.id },
      include: { category: { select: { name: true } }, loan: { select: { name: true } }, payments: { orderBy: { dueDate: "desc" }, include: { transaction: { include: { account: { select: { name: true } } } } } } },
      orderBy: [{ isActive: "desc" }, { nextDueDate: "asc" }],
    }),
    getFinanceOptions(user.id),
    prisma.transaction.findMany({ where: { userId: user.id, type: "EXPENSE", billPayment: null, source: { in: ["MANUAL", "RECURRING"] }, date: { gte: addDays(today, -60) } }, orderBy: { date: "desc" }, take: 200, select: { id: true, amount: true, date: true, description: true } }),
  ]);
  return (
    <div>
      <PageHeader title="Bills" description={`Rent, utilities, school fees and other obligations. Reminders start ${user.prefs.billReminderDays} days before the due date.`} />
      <BillsView
        reminderDays={user.prefs.billReminderDays}
        options={options}
        expenses={recentExpenses.map((e) => ({ id: e.id, amount: e.amount.toString(), date: e.date.toISOString().slice(0, 10), description: e.description }))}
        rows={bills.map((b) => ({
          id: b.id,
          name: b.name,
          kind: b.kind,
          amount: b.amount.toString(),
          categoryId: b.categoryId ?? "",
          categoryName: b.category?.name ?? null,
          accountId: b.accountId ?? "",
          loanId: b.loanId ?? "",
          loanName: b.loan?.name ?? null,
          nextDueDate: b.nextDueDate.toISOString().slice(0, 10),
          daysUntil: diffDays(b.nextDueDate, today),
          recurrence: b.recurrence,
          paymentMethod: b.paymentMethod ?? "",
          isActive: b.isActive,
          notes: b.notes ?? "",
          payments: b.payments.map((p) => ({ id: p.id, dueDate: p.dueDate.toISOString().slice(0, 10), paidDate: p.paidDate.toISOString().slice(0, 10), amount: p.amount.toString(), method: p.paymentMethod ?? "", account: p.transaction?.account.name ?? null, viaLoan: !!p.loanRepaymentId, linked: p.transaction?.source !== "BILL" && !!p.transaction })),
        }))}
      />
    </div>
  );
}
