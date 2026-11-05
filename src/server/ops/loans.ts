import "server-only";
import type { Prisma } from "@prisma/client";
import { fail } from "@/lib/action";
import { audit } from "@/lib/audit";
import { dec } from "@/lib/money";
import { formatMoney } from "@/lib/format";
import { loanSummary } from "@/lib/services/loans";
import { systemCategory } from "@/lib/services/defaults";
import { ownedAccount } from "../guards";
import type { CurrentUser } from "@/lib/session";

type Tx = Prisma.TransactionClient;

/**
 * Records a loan repayment with principal and interest kept separate:
 *  - principal moves as OUTFLOW (borrowed) / INFLOW (lent): not an expense or income,
 *    because the principal was never income/expense in the first place.
 *  - interest is an EXPENSE (borrowed) / INCOME (lent).
 */
export async function recordRepaymentTx(
  tx: Tx,
  user: CurrentUser,
  v: { loanId: string; date: Date; principalAmount: string; interestAmount: string; accountId: string | null; note: string | null },
) {
  const loan = await tx.loan.findFirst({ where: { id: v.loanId, userId: user.id }, include: { repayments: true } });
  if (!loan) fail("Loan not found.");
  if (loan.status === "WRITTEN_OFF") fail("This loan was written off.");
  const s = loanSummary(loan, v.date);
  const principal = dec(v.principalAmount);
  const interest = dec(v.interestAmount);
  if (principal.gt(s.outstanding))
    fail(`Principal can't exceed the outstanding balance of ${formatMoney(s.outstanding.toString(), { currency: user.prefs.currency, locale: user.prefs.locale })}. Put the extra under interest or fees.`);
  if (v.accountId) await ownedAccount(tx, user.id, v.accountId);
  const borrowed = loan.direction === "BORROWED";
  let principalTxnId: string | null = null;
  let interestTxnId: string | null = null;
  if (v.accountId && principal.gt(0)) {
    const t = await tx.transaction.create({
      data: { userId: user.id, type: borrowed ? "OUTFLOW" : "INFLOW", source: "LOAN", amount: principal, date: v.date, description: `${loan.name}: principal ${borrowed ? "repaid" : "received"}`, accountId: v.accountId, notes: v.note },
    });
    principalTxnId = t.id;
  }
  if (v.accountId && interest.gt(0)) {
    const cat = await systemCategory(tx, user.id, borrowed ? "Loan interest" : "Loan interest received", borrowed ? "EXPENSE" : "INCOME");
    const t = await tx.transaction.create({
      data: { userId: user.id, type: borrowed ? "EXPENSE" : "INCOME", source: "LOAN", amount: interest, date: v.date, description: `${loan.name}: interest`, accountId: v.accountId, categoryId: cat.id, notes: v.note },
    });
    interestTxnId = t.id;
  }
  const rep = await tx.loanRepayment.create({
    data: { userId: user.id, loanId: loan.id, date: v.date, principalAmount: principal, interestAmount: interest, accountId: v.accountId, note: v.note, principalTxnId, interestTxnId },
  });
  if (principal.eq(s.outstanding) && loan.status === "ACTIVE") await tx.loan.update({ where: { id: loan.id }, data: { status: "PAID_OFF" } });
  await audit(tx, user.id, "repay", "Loan", loan.id, { repaymentId: rep.id, principal: principal.toString(), interest: interest.toString() });
  return rep;
}

export async function deleteRepaymentTx(tx: Tx, userId: string, id: string) {
  const r = await tx.loanRepayment.findFirst({ where: { id, userId }, include: { loan: { include: { repayments: true } } } });
  if (!r) fail("Repayment not found.");
  const ids = [r.principalTxnId, r.interestTxnId].filter((x): x is string => !!x);
  await tx.loanRepayment.delete({ where: { id } });
  if (ids.length) await tx.transaction.deleteMany({ where: { id: { in: ids }, userId } });
  if (r.loan.status === "PAID_OFF") await tx.loan.update({ where: { id: r.loanId }, data: { status: "ACTIVE" } });
  await audit(tx, userId, "delete", "LoanRepayment", id, { loanId: r.loanId, principal: r.principalAmount.toString(), interest: r.interestAmount.toString() });
  return r;
}
