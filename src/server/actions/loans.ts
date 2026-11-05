"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { fail, handle } from "@/lib/action";
import { audit } from "@/lib/audit";
import { dayFromString } from "@/lib/dates";
import { dec, sum } from "@/lib/money";
import { loanSchema, repaymentSchema } from "@/lib/validation/obligations";
import { opt, ownedAccount, assertId } from "../guards";
import { deleteRepaymentTx, recordRepaymentTx } from "../ops/loans";

const refresh = () => revalidatePath("/", "layout");

export async function createLoan(input: unknown) {
  return handle(async () => {
    const user = await requireUser();
    const v = loanSchema.parse(input);
    const id = await prisma.$transaction(async (tx) => {
      const accountId = opt(v.accountId);
      if (accountId) await ownedAccount(tx, user.id, accountId);
      const loan = await tx.loan.create({
        data: {
          userId: user.id,
          name: v.name,
          direction: v.direction,
          loanType: v.loanType,
          counterparty: v.counterparty,
          principal: v.principal,
          interestRate: v.interestRate,
          startDate: dayFromString(v.startDate),
          dueDate: dayFromString(v.dueDate),
          frequency: v.frequency,
          status: v.status,
          notes: opt(v.notes),
          accountId,
        },
      });
      if (accountId) {
        const t = await tx.transaction.create({
          data: {
            userId: user.id,
            type: v.direction === "BORROWED" ? "INFLOW" : "OUTFLOW",
            source: "LOAN",
            amount: v.principal,
            date: dayFromString(v.startDate),
            description: v.direction === "BORROWED" ? `Loan received: ${v.name}` : `Loan given to ${v.counterparty}`,
            accountId,
          },
        });
        await tx.loan.update({ where: { id: loan.id }, data: { disbursementTxnId: t.id } });
      }
      await audit(tx, user.id, "create", "Loan", loan.id, { principal: v.principal, direction: v.direction });
      return loan.id;
    });
    refresh();
    return id;
  }, "Loan added");
}

export async function updateLoan(id: string, input: unknown) {
  return handle(async () => {
    assertId(id);
    const user = await requireUser();
    const v = loanSchema.parse(input);
    await prisma.$transaction(async (tx) => {
      const loan = await tx.loan.findFirst({ where: { id, userId: user.id }, include: { repayments: true } });
      if (!loan) fail("Loan not found.");
      const repaid = sum(loan.repayments.map((r) => r.principalAmount));
      if (dec(v.principal).lt(repaid)) fail("Principal can't be less than what has already been repaid.");
      // Repayment transactions were booked for the original direction (expense vs income); flipping it would corrupt them.
      if (v.direction !== loan.direction && loan.repayments.length) fail("You can't switch between borrowed and lent once repayments are recorded. Delete the repayments first, or create a new loan.");
      const accountId = opt(v.accountId);
      if (accountId) await ownedAccount(tx, user.id, accountId);
      let disbursementTxnId = loan.disbursementTxnId;
      const txnData = {
        type: v.direction === "BORROWED" ? ("INFLOW" as const) : ("OUTFLOW" as const),
        amount: v.principal,
        date: dayFromString(v.startDate),
        description: v.direction === "BORROWED" ? `Loan received: ${v.name}` : `Loan given to ${v.counterparty}`,
      };
      // Keep the disbursement transaction in step with the loan.
      if (disbursementTxnId && !accountId) {
        await tx.loan.update({ where: { id }, data: { disbursementTxnId: null } });
        await tx.transaction.deleteMany({ where: { id: disbursementTxnId, userId: user.id } });
        disbursementTxnId = null;
      } else if (disbursementTxnId && accountId) {
        await tx.transaction.update({ where: { id: disbursementTxnId }, data: { ...txnData, accountId } });
      } else if (!disbursementTxnId && accountId) {
        const t = await tx.transaction.create({ data: { userId: user.id, source: "LOAN", accountId, ...txnData } });
        disbursementTxnId = t.id;
      }
      const outstanding = dec(v.principal).minus(repaid);
      const status = v.status === "PAID_OFF" && outstanding.gt(0) ? fail("This loan still has an outstanding balance. Record the final repayment to mark it paid off.") : v.status;
      await tx.loan.update({
        where: { id },
        data: {
          name: v.name,
          direction: v.direction,
          loanType: v.loanType,
          counterparty: v.counterparty,
          principal: v.principal,
          interestRate: v.interestRate,
          startDate: dayFromString(v.startDate),
          dueDate: dayFromString(v.dueDate),
          frequency: v.frequency,
          status: outstanding.isZero() && status === "ACTIVE" ? "PAID_OFF" : status,
          notes: opt(v.notes),
          accountId,
          disbursementTxnId,
        },
      });
      if (loan.principal.toString() !== v.principal) await audit(tx, user.id, "update", "Loan", id, { principal: { from: loan.principal.toString(), to: v.principal } });
    });
    refresh();
  }, "Loan updated");
}

export async function deleteLoan(id: string) {
  return handle(async () => {
    assertId(id);
    const user = await requireUser();
    await prisma.$transaction(async (tx) => {
      const loan = await tx.loan.findFirst({ where: { id, userId: user.id }, include: { repayments: true } });
      if (!loan) fail("Loan not found.");
      const txnIds = [loan.disbursementTxnId, ...loan.repayments.flatMap((r) => [r.principalTxnId, r.interestTxnId])].filter((x): x is string => !!x);
      await tx.loan.delete({ where: { id } });
      if (txnIds.length) await tx.transaction.deleteMany({ where: { id: { in: txnIds }, userId: user.id } });
      await audit(tx, user.id, "delete", "Loan", id, { name: loan.name, principal: loan.principal.toString(), removedTransactions: txnIds.length });
    });
    refresh();
  }, "Loan and its linked transactions deleted");
}

export async function addRepayment(input: unknown) {
  return handle(async () => {
    const user = await requireUser();
    const v = repaymentSchema.parse(input);
    await prisma.$transaction((tx) =>
      recordRepaymentTx(tx, user, { loanId: v.loanId, date: dayFromString(v.date), principalAmount: v.principalAmount, interestAmount: v.interestAmount, accountId: opt(v.accountId), note: opt(v.note) }),
    );
    refresh();
  }, "Repayment recorded");
}

export async function deleteRepayment(id: string) {
  return handle(async () => {
    assertId(id);
    const user = await requireUser();
    await prisma.$transaction(async (tx) => {
      const bp = await tx.billPayment.findFirst({ where: { loanRepaymentId: id, userId: user.id } });
      if (bp) fail("This repayment was made from a bill. Undo the bill payment instead.");
      await deleteRepaymentTx(tx, user.id, id);
    });
    refresh();
  }, "Repayment removed");
}
