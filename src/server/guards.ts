import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fail } from "@/lib/action";

type Tx = Prisma.TransactionClient | typeof prisma;

/** Every lookup is scoped by userId so one user can never touch another user's records. */
export async function ownedAccount(tx: Tx, userId: string, id: string) {
  const a = await tx.account.findFirst({ where: { id, userId } });
  if (!a) fail("Account not found.");
  return a;
}

export async function ownedCategory(tx: Tx, userId: string, id: string, type?: "INCOME" | "EXPENSE") {
  const c = await tx.transactionCategory.findFirst({ where: { id, userId } });
  if (!c) fail("Category not found.");
  if (type && c.type !== type) fail(`Choose an ${type.toLowerCase()} category.`);
  return c;
}

export const opt = (v: string | undefined | null) => (v && v.trim() ? v.trim() : null);
export const tagList = (v: string | undefined | null) =>
  Array.from(new Set((v ?? "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))).slice(0, 20);
