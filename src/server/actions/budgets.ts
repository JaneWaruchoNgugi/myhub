"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { fail, handle } from "@/lib/action";
import { addMonths, dayFromString } from "@/lib/dates";
import { budgetSchema } from "@/lib/validation/finance";
import { opt } from "../guards";

const refresh = () => revalidatePath("/", "layout");

async function checkCategories(userId: string, ids: string[]) {
  const n = await prisma.transactionCategory.count({ where: { userId, id: { in: ids }, type: "EXPENSE" } });
  if (n !== ids.length) fail("Budgets can only use your expense categories.");
}

export async function saveBudget(id: string | null, input: unknown) {
  return handle(async () => {
    const user = await requireUser();
    const v = budgetSchema.parse(input);
    await checkCategories(user.id, v.items.map((i) => i.categoryId));
    const month = dayFromString(`${v.month}-01`);
    await prisma.$transaction(async (tx) => {
      if (id) {
        const b = await tx.budget.findFirst({ where: { id, userId: user.id } });
        if (!b) fail("Budget not found.");
        const clash = await tx.budget.findFirst({ where: { userId: user.id, month, NOT: { id } } });
        if (clash) fail("There's already a budget for that month.");
        await tx.budget.update({ where: { id }, data: { month, rollover: v.rollover, notes: opt(v.notes) } });
        await tx.budgetItem.deleteMany({ where: { budgetId: id } });
        await tx.budgetItem.createMany({ data: v.items.map((i) => ({ budgetId: id, categoryId: i.categoryId, limit: i.limit })) });
      } else {
        const clash = await tx.budget.findFirst({ where: { userId: user.id, month } });
        if (clash) fail("There's already a budget for that month. Edit it instead.");
        await tx.budget.create({ data: { userId: user.id, month, rollover: v.rollover, notes: opt(v.notes), items: { create: v.items.map((i) => ({ categoryId: i.categoryId, limit: i.limit })) } } });
      }
    });
    refresh();
  }, "Budget saved");
}

export async function copyBudgetToNextMonth(id: string) {
  return handle(async () => {
    const user = await requireUser();
    const b = await prisma.budget.findFirst({ where: { id, userId: user.id }, include: { items: true } });
    if (!b) fail("Budget not found.");
    const next = addMonths(b.month, 1, 1);
    const exists = await prisma.budget.findFirst({ where: { userId: user.id, month: next } });
    if (exists) fail("Next month already has a budget.");
    await prisma.budget.create({ data: { userId: user.id, month: next, rollover: b.rollover, notes: b.notes, items: { create: b.items.map((i) => ({ categoryId: i.categoryId, limit: i.limit })) } } });
    refresh();
    return next.toISOString().slice(0, 7);
  }, "Budget copied to next month");
}

export async function deleteBudget(id: string) {
  return handle(async () => {
    const user = await requireUser();
    const b = await prisma.budget.findFirst({ where: { id, userId: user.id } });
    if (!b) fail("Budget not found.");
    await prisma.budget.delete({ where: { id } });
    refresh();
  }, "Budget deleted");
}
