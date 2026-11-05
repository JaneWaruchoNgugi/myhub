import "server-only";
import { prisma } from "@/lib/prisma";

export type Opt = { value: string; label: string };
export type FinanceOptions = { accounts: Opt[]; incomeCategories: Opt[]; expenseCategories: Opt[]; goals: Opt[]; loans: Opt[]; projects: Opt[] };

const ACCOUNT_TYPE_LABEL: Record<string, string> = { CASH: "Cash", BANK: "Bank", MOBILE_MONEY: "Mobile money", SAVINGS: "Savings", INVESTMENT_CASH: "Brokerage", OTHER: "Other" };

/** Dropdown options for forms (only active, user-owned records). */
export async function getFinanceOptions(userId: string): Promise<FinanceOptions> {
  const [accounts, cats, goals, loans, projects] = await Promise.all([
    prisma.account.findMany({ where: { userId, isArchived: false }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, type: true } }),
    prisma.transactionCategory.findMany({ where: { userId }, orderBy: { name: "asc" }, select: { id: true, name: true, type: true } }),
    prisma.savingsGoal.findMany({ where: { userId, status: { in: ["ACTIVE", "PAUSED"] } }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
    prisma.loan.findMany({ where: { userId, status: "ACTIVE", direction: "BORROWED" }, select: { id: true, name: true } }),
    prisma.devProject.findMany({ where: { userId, status: { not: "ARCHIVED" } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return {
    accounts: accounts.map((a) => ({ value: a.id, label: `${a.name} · ${ACCOUNT_TYPE_LABEL[a.type]}` })),
    incomeCategories: cats.filter((c) => c.type === "INCOME").map((c) => ({ value: c.id, label: c.name })),
    expenseCategories: cats.filter((c) => c.type === "EXPENSE").map((c) => ({ value: c.id, label: c.name })),
    goals: goals.map((g) => ({ value: g.id, label: g.name })),
    loans: loans.map((l) => ({ value: l.id, label: l.name })),
    projects: projects.map((p) => ({ value: p.id, label: p.name })),
  };
}
