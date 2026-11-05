import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUserPage } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getFinanceOptions } from "@/lib/services/options";
import { loanSummary } from "@/lib/services/loans";
import { todayIn } from "@/lib/dates";
import { loanRow } from "../data";
import { LoanDetail } from "./view";

export const metadata: Metadata = { title: "Loan" };

export default async function LoanPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUserPage();
  const { id } = await params;
  const today = todayIn(user.prefs.timezone);
  const loan = await prisma.loan.findFirst({ where: { id, userId: user.id }, include: { repayments: { orderBy: { date: "desc" }, include: { billPayment: { select: { id: true } } } }, account: { select: { name: true } } } });
  if (!loan) notFound();
  const s = loanSummary(loan, today);
  const options = await getFinanceOptions(user.id);
  let repaidSoFar = s.principalRepaid.toNumber();
  return (
    <LoanDetail
      loan={loanRow(loan, today)}
      options={options}
      schedule={s.schedule.map((r) => {
        const paid = repaidSoFar >= r.principal.toNumber() - 0.005;
        repaidSoFar = Math.max(0, repaidSoFar - r.principal.toNumber());
        return { n: r.n, date: r.date.toISOString().slice(0, 10), payment: r.payment.toString(), interest: r.interest.toString(), principal: r.principal.toString(), balance: r.balance.toString(), paid, overdue: !paid && r.date < today };
      })}
      repayments={loan.repayments.map((r) => ({ id: r.id, date: r.date.toISOString().slice(0, 10), principal: r.principalAmount.toString(), interest: r.interestAmount.toString(), note: r.note ?? "", fromBill: !!r.billPayment }))}
    />
  );
}
