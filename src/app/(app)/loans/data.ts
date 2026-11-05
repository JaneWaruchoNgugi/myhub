import "server-only";
import type { Loan, LoanRepayment } from "@prisma/client";
import { loanSummary } from "@/lib/services/loans";

export function loanRow(l: Loan & { repayments: LoanRepayment[]; account?: { name: string } | null }, today: Date) {
  const s = loanSummary(l, today);
  return {
    id: l.id,
    name: l.name,
    direction: l.direction,
    loanType: l.loanType,
    counterparty: l.counterparty,
    principal: l.principal.toString(),
    interestRate: l.interestRate.toString(),
    startDate: l.startDate.toISOString().slice(0, 10),
    dueDate: l.dueDate.toISOString().slice(0, 10),
    frequency: l.frequency,
    status: l.status,
    notes: l.notes ?? "",
    accountId: l.accountId ?? "",
    accountName: l.account?.name ?? null,
    outstanding: s.outstanding.toString(),
    principalRepaid: s.principalRepaid.toString(),
    interestPaid: s.interestPaid.toString(),
    scheduledInterest: s.scheduledInterest.toString(),
    progress: s.progress,
    isOverdue: s.isOverdue,
    nextDate: s.next?.date.toISOString().slice(0, 10) ?? null,
    nextPayment: s.next?.payment.toString() ?? null,
    suggestedPrincipal: s.suggestedPrincipal.toString(),
    suggestedInterest: s.suggestedInterest.toString(),
  };
}
export type LoanRow = ReturnType<typeof loanRow>;
