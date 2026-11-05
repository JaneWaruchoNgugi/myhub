"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { fail, handle } from "@/lib/action";
import { audit } from "@/lib/audit";
import { advance, dayFromString, type Freq } from "@/lib/dates";
import { dec } from "@/lib/money";
import { billPaySchema, billSchema, subscriptionChargeSchema, subscriptionSchema } from "@/lib/validation/obligations";
import { loanSummary } from "@/lib/services/loans";
import { opt, ownedAccount, ownedCategory } from "../guards";
import { deleteRepaymentTx, recordRepaymentTx } from "../ops/loans";

const refresh = () => revalidatePath("/", "layout");

async function checkRefs(userId: string, v: { categoryId?: string; accountId?: string; loanId?: string }) {
  if (v.categoryId) await ownedCategory(prisma, userId, v.categoryId, "EXPENSE");
  if (v.accountId) await ownedAccount(prisma, userId, v.accountId);
  if (v.loanId) {
    const l = await prisma.loan.findFirst({ where: { id: v.loanId, userId, direction: "BORROWED" } });
    if (!l) fail("Choose one of your borrowed loans.");
  }
}

export async function saveBill(id: string | null, input: unknown) {
  return handle(async () => {
    const user = await requireUser();
    const v = billSchema.parse(input);
    await checkRefs(user.id, v);
    const data = {
      name: v.name,
      kind: v.kind,
      amount: v.amount,
      categoryId: v.kind === "LOAN_REPAYMENT" ? null : opt(v.categoryId),
      accountId: opt(v.accountId),
      loanId: v.kind === "LOAN_REPAYMENT" ? opt(v.loanId) : null,
      nextDueDate: dayFromString(v.nextDueDate),
      recurrence: v.recurrence,
      paymentMethod: opt(v.paymentMethod),
      isActive: v.isActive,
      notes: opt(v.notes),
    };
    if (id) {
      const b = await prisma.bill.findFirst({ where: { id, userId: user.id } });
      if (!b) fail("Bill not found.");
      await prisma.bill.update({ where: { id }, data });
    } else await prisma.bill.create({ data: { userId: user.id, ...data } });
    refresh();
  }, id ? "Bill updated" : "Bill added");
}

export async function deleteBill(id: string) {
  return handle(async () => {
    const user = await requireUser();
    await prisma.$transaction(async (tx) => {
      const b = await tx.bill.findFirst({ where: { id, userId: user.id }, include: { payments: true } });
      if (!b) fail("Bill not found.");
      // Payments that happened stay in the ledger as ordinary expenses.
      const txnIds = b.payments.map((p) => p.transactionId).filter((x): x is string => !!x);
      if (txnIds.length) await tx.transaction.updateMany({ where: { id: { in: txnIds }, userId: user.id, source: "BILL" }, data: { source: "MANUAL" } });
      await tx.bill.delete({ where: { id } });
      await audit(tx, user.id, "delete", "Bill", id, { name: b.name, payments: b.payments.length });
    });
    refresh();
  }, "Bill deleted. Past payments were kept as expenses.");
}

/**
 * Pays the bill's current period. One payment per (bill, due date) is enforced by a
 * unique constraint, so a double click or retry can't create a duplicate expense.
 */
export async function payBill(input: unknown) {
  return handle(async () => {
    const user = await requireUser();
    const v = billPaySchema.parse(input);
    await prisma.$transaction(async (tx) => {
      const bill = await tx.bill.findFirst({ where: { id: v.billId, userId: user.id } });
      if (!bill) fail("Bill not found.");
      if (!bill.isActive) fail("This bill is inactive.");
      const already = await tx.billPayment.findUnique({ where: { billId_dueDate: { billId: bill.id, dueDate: bill.nextDueDate } } });
      if (already) fail("This period is already paid.");
      const paidDate = dayFromString(v.paidDate);
      const accountId = opt(v.accountId) ?? bill.accountId;
      let transactionId: string | null = null;
      let loanRepaymentId: string | null = null;

      if (bill.loanId) {
        // Loan bills settle through the loan so principal and interest stay separate.
        const loan = await tx.loan.findFirst({ where: { id: bill.loanId, userId: user.id }, include: { repayments: true } });
        if (!loan) fail("The linked loan no longer exists.");
        const s = loanSummary(loan, paidDate);
        const amt = dec(v.amount);
        const interest = D_min(s.suggestedInterest, amt);
        const principal = D_min(amt.minus(interest), s.outstanding);
        const rep = await recordRepaymentTx(tx, user, { loanId: loan.id, date: paidDate, principalAmount: principal.toString(), interestAmount: amt.minus(principal).toString(), accountId, note: `Bill: ${bill.name}` });
        loanRepaymentId = rep.id;
      } else if (opt(v.linkTransactionId)) {
        const t = await tx.transaction.findFirst({ where: { id: v.linkTransactionId!, userId: user.id, type: "EXPENSE" }, include: { billPayment: true } });
        if (!t) fail("That expense wasn't found.");
        if (t.billPayment) fail("That expense is already linked to another bill payment.");
        transactionId = t.id;
      } else {
        if (!accountId) fail("Choose the account you paid from.");
        await ownedAccount(tx, user.id, accountId);
        const t = await tx.transaction.create({
          data: { userId: user.id, type: "EXPENSE", source: "BILL", amount: v.amount, date: paidDate, description: bill.name, accountId, categoryId: bill.categoryId, notes: opt(v.note) },
        });
        transactionId = t.id;
      }
      await tx.billPayment.create({
        data: { userId: user.id, billId: bill.id, dueDate: bill.nextDueDate, paidDate, amount: v.amount, paymentMethod: opt(v.paymentMethod) ?? bill.paymentMethod, note: opt(v.note), transactionId, loanRepaymentId },
      });
      // Recurring bills roll forward to the next period; one-off bills close.
      if (bill.recurrence === "NONE") await tx.bill.update({ where: { id: bill.id }, data: { isActive: false } });
      else await tx.bill.update({ where: { id: bill.id }, data: { nextDueDate: advance(bill.nextDueDate, bill.recurrence as Freq) } });
      await audit(tx, user.id, "pay", "Bill", bill.id, { amount: v.amount, dueDate: bill.nextDueDate.toISOString().slice(0, 10), transactionId, loanRepaymentId });
    });
    refresh();
  }, "Bill marked as paid");
}

function D_min(a: ReturnType<typeof dec>, b: ReturnType<typeof dec>) {
  return a.lt(b) ? a : b;
}

export async function undoBillPayment(id: string) {
  return handle(async () => {
    const user = await requireUser();
    await prisma.$transaction(async (tx) => {
      const p = await tx.billPayment.findFirst({ where: { id, userId: user.id }, include: { bill: true, transaction: true } });
      if (!p) fail("Payment not found.");
      const latest = await tx.billPayment.findFirst({ where: { billId: p.billId }, orderBy: { dueDate: "desc" } });
      if (latest?.id !== p.id) fail("Undo the most recent payment of this bill first.");
      await tx.billPayment.delete({ where: { id } });
      if (p.transaction?.source === "BILL") await tx.transaction.delete({ where: { id: p.transaction.id } });
      if (p.loanRepaymentId) await deleteRepaymentTx(tx, user.id, p.loanRepaymentId);
      await tx.bill.update({ where: { id: p.billId }, data: { nextDueDate: p.dueDate, isActive: true } });
      await audit(tx, user.id, "undo_pay", "Bill", p.billId, { amount: p.amount.toString(), dueDate: p.dueDate.toISOString().slice(0, 10) });
    });
    refresh();
  }, "Payment undone");
}

/** Advances a bill to its next period without paying (e.g. waived this month). */
export async function skipBillPeriod(id: string) {
  return handle(async () => {
    const user = await requireUser();
    const b = await prisma.bill.findFirst({ where: { id, userId: user.id } });
    if (!b) fail("Bill not found.");
    if (b.recurrence === "NONE") fail("One-off bills can't be skipped. Delete or deactivate it instead.");
    await prisma.bill.update({ where: { id }, data: { nextDueDate: advance(b.nextDueDate, b.recurrence as Freq) } });
    refresh();
  }, "Moved to the next period");
}

// ── Subscriptions ──

export async function saveSubscription(id: string | null, input: unknown) {
  return handle(async () => {
    const user = await requireUser();
    const v = subscriptionSchema.parse(input);
    await checkRefs(user.id, v);
    const data = {
      name: v.name,
      provider: opt(v.provider),
      amount: v.amount,
      billingCycle: v.billingCycle,
      nextBillingDate: dayFromString(v.nextBillingDate),
      paymentMethod: opt(v.paymentMethod),
      status: v.status,
      categoryId: opt(v.categoryId),
      accountId: opt(v.accountId),
      url: opt(v.url),
      notes: opt(v.notes),
    };
    if (id) {
      const s = await prisma.subscription.findFirst({ where: { id, userId: user.id } });
      if (!s) fail("Subscription not found.");
      await prisma.subscription.update({ where: { id }, data });
    } else await prisma.subscription.create({ data: { userId: user.id, ...data } });
    refresh();
  }, id ? "Subscription updated" : "Subscription added");
}

export async function deleteSubscription(id: string) {
  return handle(async () => {
    const user = await requireUser();
    await prisma.$transaction(async (tx) => {
      const s = await tx.subscription.findFirst({ where: { id, userId: user.id }, include: { charges: true } });
      if (!s) fail("Subscription not found.");
      const txnIds = s.charges.map((c) => c.transactionId).filter((x): x is string => !!x);
      if (txnIds.length) await tx.transaction.updateMany({ where: { id: { in: txnIds }, userId: user.id }, data: { source: "MANUAL" } });
      await tx.subscription.delete({ where: { id } });
    });
    refresh();
  }, "Subscription deleted. Past charges were kept as expenses.");
}

const CYCLE_FREQ: Record<string, Freq> = { WEEKLY: "WEEKLY", MONTHLY: "MONTHLY", QUARTERLY: "QUARTERLY", SEMI_ANNUAL: "SEMI_ANNUAL", YEARLY: "YEARLY" };

export async function recordSubscriptionCharge(input: unknown) {
  return handle(async () => {
    const user = await requireUser();
    const v = subscriptionChargeSchema.parse(input);
    await prisma.$transaction(async (tx) => {
      const s = await tx.subscription.findFirst({ where: { id: v.subscriptionId, userId: user.id } });
      if (!s) fail("Subscription not found.");
      await ownedAccount(tx, user.id, v.accountId);
      const dup = await tx.subscriptionCharge.findUnique({ where: { subscriptionId_billingDate: { subscriptionId: s.id, billingDate: s.nextBillingDate } } });
      if (dup) fail("This billing period was already recorded.");
      const t = await tx.transaction.create({
        data: { userId: user.id, type: "EXPENSE", source: "SUBSCRIPTION", amount: v.amount, date: dayFromString(v.date), description: `${s.name} subscription`, accountId: v.accountId, categoryId: s.categoryId },
      });
      await tx.subscriptionCharge.create({ data: { subscriptionId: s.id, billingDate: s.nextBillingDate, amount: v.amount, transactionId: t.id } });
      await tx.subscription.update({ where: { id: s.id }, data: { nextBillingDate: advance(s.nextBillingDate, CYCLE_FREQ[s.billingCycle], s.nextBillingDate.getUTCDate()) } });
      await audit(tx, user.id, "charge", "Subscription", s.id, { amount: v.amount });
    });
    refresh();
  }, "Charge recorded as an expense");
}

export async function undoSubscriptionCharge(id: string) {
  return handle(async () => {
    const user = await requireUser();
    await prisma.$transaction(async (tx) => {
      const c = await tx.subscriptionCharge.findFirst({ where: { id, subscription: { userId: user.id } } });
      if (!c) fail("Charge not found.");
      const latest = await tx.subscriptionCharge.findFirst({ where: { subscriptionId: c.subscriptionId }, orderBy: { billingDate: "desc" } });
      if (latest?.id !== c.id) fail("Undo the most recent charge first.");
      await tx.subscriptionCharge.delete({ where: { id } });
      if (c.transactionId) await tx.transaction.deleteMany({ where: { id: c.transactionId, userId: user.id } });
      await tx.subscription.update({ where: { id: c.subscriptionId }, data: { nextBillingDate: c.billingDate } });
    });
    refresh();
  }, "Charge undone");
}
