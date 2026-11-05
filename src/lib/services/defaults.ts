import type { Prisma } from "@prisma/client";

export const DEFAULT_INCOME_CATEGORIES: [string, string][] = [
  ["Salary", "#10b981"],
  ["Freelancing", "#14b8a6"],
  ["Business", "#0ea5e9"],
  ["Investments", "#6366f1"],
  ["Gifts", "#a855f7"],
  ["Loan interest received", "#8b5cf6"],
  ["Other income", "#64748b"],
];

export const DEFAULT_EXPENSE_CATEGORIES: [string, string][] = [
  ["Rent", "#ef4444"],
  ["Food", "#f97316"],
  ["Transport", "#f59e0b"],
  ["Shopping", "#ec4899"],
  ["Utilities", "#eab308"],
  ["Internet", "#06b6d4"],
  ["Subscriptions", "#8b5cf6"],
  ["Healthcare", "#22c55e"],
  ["Entertainment", "#d946ef"],
  ["Education", "#3b82f6"],
  ["Family", "#f43f5e"],
  ["Loan interest", "#b91c1c"],
  ["Insurance", "#0891b2"],
  ["Other", "#64748b"],
];

/** Creates preferences and default categories for a new user. */
export async function provisionUser(tx: Prisma.TransactionClient, userId: string) {
  await tx.userPreference.upsert({ where: { userId }, update: {}, create: { userId } });
  await tx.transactionCategory.createMany({
    data: [
      ...DEFAULT_INCOME_CATEGORIES.map(([name, color]) => ({ userId, name, color, type: "INCOME" as const, isSystem: true })),
      ...DEFAULT_EXPENSE_CATEGORIES.map(([name, color]) => ({ userId, name, color, type: "EXPENSE" as const, isSystem: true })),
    ],
    skipDuplicates: true,
  });
}

/** Finds (or creates) a system category by name, used for loan interest and investment income. */
export async function systemCategory(tx: Prisma.TransactionClient, userId: string, name: string, type: "INCOME" | "EXPENSE") {
  return tx.transactionCategory.upsert({
    where: { userId_name_type: { userId, name, type } },
    update: {},
    create: { userId, name, type, isSystem: true, color: type === "INCOME" ? "#6366f1" : "#b91c1c" },
  });
}
