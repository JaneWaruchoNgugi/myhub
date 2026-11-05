"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { fail, handle } from "@/lib/action";
import { audit } from "@/lib/audit";
import { dayFromString } from "@/lib/dates";
import { accountSchema, categorySchema } from "@/lib/validation/finance";
import { opt, ownedAccount, assertId } from "../guards";

const refresh = () => {
  revalidatePath("/", "layout");
};

export async function createAccount(input: unknown) {
  return handle(async () => {
    const user = await requireUser();
    const v = accountSchema.parse(input);
    await prisma.$transaction(async (tx) => {
      const a = await tx.account.create({
        data: { userId: user.id, name: v.name, type: v.type, institution: opt(v.institution), openingBalance: v.openingBalance, openingDate: dayFromString(v.openingDate), color: opt(v.color), notes: opt(v.notes), currency: user.prefs.currency },
      });
      await audit(tx, user.id, "create", "Account", a.id, { name: a.name, openingBalance: v.openingBalance });
    });
    refresh();
  }, "Account created");
}

export async function updateAccount(id: string, input: unknown) {
  return handle(async () => {
    assertId(id);
    const user = await requireUser();
    const v = accountSchema.parse(input);
    await prisma.$transaction(async (tx) => {
      const before = await ownedAccount(tx, user.id, id);
      await tx.account.update({
        where: { id },
        data: { name: v.name, type: v.type, institution: opt(v.institution), openingBalance: v.openingBalance, openingDate: dayFromString(v.openingDate), color: opt(v.color), notes: opt(v.notes), isArchived: v.isArchived ?? false },
      });
      if (before.openingBalance.toString() !== v.openingBalance) await audit(tx, user.id, "update", "Account", id, { field: "openingBalance", from: before.openingBalance.toString(), to: v.openingBalance });
    });
    refresh();
  }, "Account updated");
}

export async function deleteAccount(id: string) {
  return handle(async () => {
    assertId(id);
    const user = await requireUser();
    await prisma.$transaction(async (tx) => {
      const a = await ownedAccount(tx, user.id, id);
      const [txns, goals] = await Promise.all([
        tx.transaction.count({ where: { userId: user.id, OR: [{ accountId: id }, { toAccountId: id }] } }),
        tx.savingsGoal.count({ where: { userId: user.id, accountId: id } }),
      ]);
      if (txns > 0) fail(`This account has ${txns} transaction(s). Archive it instead to keep your history intact.`);
      if (goals > 0) fail("Savings goals are held in this account. Move or delete them first.");
      await tx.account.delete({ where: { id } });
      await audit(tx, user.id, "delete", "Account", id, { name: a.name });
    });
    refresh();
  }, "Account deleted");
}

export async function setAccountArchived(id: string, archived: boolean) {
  return handle(async () => {
    assertId(id);
    const user = await requireUser();
    await ownedAccount(prisma, user.id, id);
    await prisma.account.update({ where: { id }, data: { isArchived: archived } });
    refresh();
  }, archived ? "Account archived" : "Account restored");
}

export async function createCategory(input: unknown) {
  return handle(async () => {
    const user = await requireUser();
    const v = categorySchema.parse(input);
    await prisma.transactionCategory.create({ data: { userId: user.id, name: v.name, type: v.type, color: v.color } });
    refresh();
  }, "Category added");
}

export async function updateCategory(id: string, input: unknown) {
  return handle(async () => {
    assertId(id);
    const user = await requireUser();
    const v = categorySchema.omit({ type: true }).parse(input);
    const c = await prisma.transactionCategory.findFirst({ where: { id, userId: user.id } });
    if (!c) fail("Category not found.");
    await prisma.transactionCategory.update({ where: { id }, data: { name: v.name, color: v.color } });
    refresh();
  }, "Category updated");
}

export async function deleteCategory(id: string) {
  return handle(async () => {
    assertId(id);
    const user = await requireUser();
    z.string().parse(id);
    const c = await prisma.transactionCategory.findFirst({ where: { id, userId: user.id } });
    if (!c) fail("Category not found.");
    const used = await prisma.transaction.count({ where: { categoryId: id } });
    await prisma.transactionCategory.delete({ where: { id } });
    refresh();
    return used;
  }, "Category deleted. Its transactions are now uncategorised.");
}
