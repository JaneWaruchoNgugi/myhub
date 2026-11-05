"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { fail, handle } from "@/lib/action";
import { audit } from "@/lib/audit";
import { advance, dayFromString, todayIn, type Freq } from "@/lib/dates";
import { recurringSchema, transactionSchema, txnLabelSchema } from "@/lib/validation/finance";
import { runRecurring } from "@/lib/services/maintenance";
import { opt, ownedAccount, ownedCategory, assertId } from "../guards";

const refresh = () => revalidatePath("/", "layout");

const SOURCE_LABEL: Record<string, string> = {
  BILL: "Bills",
  LOAN: "Loans",
  INVESTMENT: "Investments",
  SAVINGS: "Savings",
  SUBSCRIPTION: "Subscriptions",
};

export async function createTransaction(input: unknown) {
  return handle(async () => {
    const user = await requireUser();
    const v = transactionSchema.parse(input);
    await prisma.$transaction(async (tx) => {
      await ownedAccount(tx, user.id, v.accountId);
      if (v.type === "TRANSFER") await ownedAccount(tx, user.id, v.toAccountId!);
      if (v.type !== "TRANSFER" && v.categoryId) await ownedCategory(tx, user.id, v.categoryId, v.type);
      const t = await tx.transaction.create({
        data: {
          userId: user.id,
          type: v.type,
          amount: v.amount,
          date: dayFromString(v.date),
          description: v.description,
          notes: opt(v.notes),
          accountId: v.accountId,
          toAccountId: v.type === "TRANSFER" ? v.toAccountId : null,
          categoryId: v.type === "TRANSFER" ? null : opt(v.categoryId),
        },
      });
      await audit(tx, user.id, "create", "Transaction", t.id, { type: v.type, amount: v.amount, date: v.date });
    });
    refresh();
  }, "Transaction recorded");
}

export async function updateTransaction(id: string, input: unknown) {
  return handle(async () => {
    assertId(id);
    const user = await requireUser();
    const v = transactionSchema.parse(input);
    await prisma.$transaction(async (tx) => {
      const before = await tx.transaction.findFirst({ where: { id, userId: user.id } });
      if (!before) fail("Transaction not found.");
      const managed = before.source !== "MANUAL" && before.source !== "RECURRING";
      if (managed) {
        // Linked records own the amount, date and accounts. Only labels can change here.
        if (v.amount !== before.amount.toString() && Number(v.amount) !== Number(before.amount)) fail(`This transaction is managed by ${SOURCE_LABEL[before.source]}. Change the amount there.`);
        if (v.accountId !== before.accountId || v.type !== before.type || v.date !== before.date.toISOString().slice(0, 10))
          fail(`This transaction is managed by ${SOURCE_LABEL[before.source]}. Change the date or account there.`);
      }
      await ownedAccount(tx, user.id, v.accountId);
      if (v.type === "TRANSFER") await ownedAccount(tx, user.id, v.toAccountId!);
      if ((v.type === "INCOME" || v.type === "EXPENSE") && v.categoryId) await ownedCategory(tx, user.id, v.categoryId, v.type);
      await tx.transaction.update({
        where: { id },
        data: {
          type: v.type,
          amount: v.amount,
          date: dayFromString(v.date),
          description: v.description,
          notes: opt(v.notes),
          accountId: v.accountId,
          toAccountId: v.type === "TRANSFER" ? v.toAccountId : null,
          categoryId: v.type === "TRANSFER" ? null : opt(v.categoryId),
        },
      });
      if (before.amount.toString() !== v.amount || before.type !== v.type)
        await audit(tx, user.id, "update", "Transaction", id, { from: { amount: before.amount.toString(), type: before.type }, to: { amount: v.amount, type: v.type } });
    });
    refresh();
  }, "Transaction updated");
}

export async function deleteTransaction(id: string) {
  return handle(async () => {
    assertId(id);
    const user = await requireUser();
    await prisma.$transaction(async (tx) => {
      const t = await tx.transaction.findFirst({ where: { id, userId: user.id } });
      if (!t) fail("Transaction not found.");
      if (t.source !== "MANUAL" && t.source !== "RECURRING") fail(`This transaction was created by ${SOURCE_LABEL[t.source]}. Delete it from there so linked records stay consistent.`);
      await tx.transaction.delete({ where: { id } });
      await audit(tx, user.id, "delete", "Transaction", id, { type: t.type, amount: t.amount.toString(), date: t.date.toISOString().slice(0, 10), description: t.description });
    });
    refresh();
  }, "Transaction deleted");
}

export async function deleteTransactions(ids: string[]) {
  return handle(async () => {
    const user = await requireUser();
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500) fail("Select between 1 and 500 transactions.");
    ids.forEach((i) => assertId(i));
    const res = await prisma.$transaction(async (tx) => {
      const rows = await tx.transaction.findMany({ where: { id: { in: ids }, userId: user.id, source: { in: ["MANUAL", "RECURRING"] } }, select: { id: true } });
      await tx.transaction.deleteMany({ where: { id: { in: rows.map((r) => r.id) }, userId: user.id } });
      await audit(tx, user.id, "bulk_delete", "Transaction", null, { count: rows.length });
      return rows.length;
    });
    refresh();
    return res;
  }, "Selected transactions deleted");
}

// ── Recurring rules ──

export async function createRecurring(input: unknown) {
  return handle(async () => {
    const user = await requireUser();
    const v = recurringSchema.parse(input);
    await prisma.$transaction(async (tx) => {
      await ownedAccount(tx, user.id, v.accountId);
      if (v.type === "TRANSFER") await ownedAccount(tx, user.id, v.toAccountId!);
      if (v.type !== "TRANSFER" && v.categoryId) await ownedCategory(tx, user.id, v.categoryId, v.type);
      const start = dayFromString(v.startDate);
      await tx.recurringRule.create({
        data: {
          userId: user.id,
          type: v.type,
          amount: v.amount,
          description: v.description,
          accountId: v.accountId,
          toAccountId: v.type === "TRANSFER" ? v.toAccountId : null,
          categoryId: v.type === "TRANSFER" ? null : opt(v.categoryId),
          frequency: v.frequency,
          startDate: start,
          nextDate: start,
          endDate: v.endDate ? dayFromString(v.endDate) : null,
          isActive: v.isActive,
        },
      });
    });
    await runRecurring(user.id, todayIn(user.prefs.timezone));
    refresh();
  }, "Recurring transaction saved. Due occurrences were added.");
}

export async function updateRecurring(id: string, input: unknown) {
  return handle(async () => {
    assertId(id);
    const user = await requireUser();
    const v = recurringSchema.parse(input);
    const rule = await prisma.recurringRule.findFirst({ where: { id, userId: user.id } });
    if (!rule) fail("Recurring rule not found.");
    await ownedAccount(prisma, user.id, v.accountId);
    if (v.type === "TRANSFER") await ownedAccount(prisma, user.id, v.toAccountId!);
    if (v.type !== "TRANSFER" && v.categoryId) await ownedCategory(prisma, user.id, v.categoryId, v.type);
    const start = dayFromString(v.startDate);
    // Next run = first occurrence from the (new) start date after the last one already generated.
    const last = await prisma.transaction.findFirst({ where: { recurringRuleId: id }, orderBy: { occurrenceDate: "desc" }, select: { occurrenceDate: true } });
    let next = start;
    let guard = 0;
    while (last?.occurrenceDate && next <= last.occurrenceDate && guard++ < 5000) next = advance(next, v.frequency as Freq, start.getUTCDate());
    await prisma.recurringRule.update({
      where: { id },
      data: {
        type: v.type,
        amount: v.amount,
        description: v.description,
        accountId: v.accountId,
        toAccountId: v.type === "TRANSFER" ? v.toAccountId : null,
        categoryId: v.type === "TRANSFER" ? null : opt(v.categoryId),
        frequency: v.frequency,
        startDate: start,
        nextDate: next,
        endDate: v.endDate ? dayFromString(v.endDate) : null,
        isActive: v.isActive,
      },
    });
    await runRecurring(user.id, todayIn(user.prefs.timezone));
    refresh();
  }, "Recurring transaction updated. Past entries are unchanged.");
}

export async function deleteRecurring(id: string) {
  return handle(async () => {
    assertId(id);
    const user = await requireUser();
    const rule = await prisma.recurringRule.findFirst({ where: { id, userId: user.id } });
    if (!rule) fail("Recurring rule not found.");
    // Generated transactions stay (they happened); they're just unlinked.
    await prisma.recurringRule.delete({ where: { id } });
    refresh();
  }, "Recurring rule deleted. Past transactions were kept.");
}

/** For transactions owned by another module: only labels can change. */
export async function updateTransactionLabels(id: string, input: unknown) {
  return handle(async () => {
    assertId(id);
    const user = await requireUser();
    const v = txnLabelSchema.parse(input);
    const t = await prisma.transaction.findFirst({ where: { id, userId: user.id } });
    if (!t) fail("Transaction not found.");
    const categoryId = t.type === "INCOME" || t.type === "EXPENSE" ? opt(v.categoryId) : null;
    if (categoryId) await ownedCategory(prisma, user.id, categoryId, t.type as "INCOME" | "EXPENSE");
    await prisma.transaction.update({ where: { id }, data: { description: v.description, notes: opt(v.notes), categoryId: t.type === "INCOME" || t.type === "EXPENSE" ? categoryId : t.categoryId } });
    refresh();
  }, "Transaction updated");
}
