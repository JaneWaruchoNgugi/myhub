"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { fail, handle } from "@/lib/action";
import { audit } from "@/lib/audit";
import { dayFromString, todayIn } from "@/lib/dates";
import { contributionSchema, savingsGoalSchema } from "@/lib/validation/finance";
import { goalStats } from "@/lib/services/savings";
import { accountBalanceTx } from "@/lib/services/ledger";
import { dec, sum } from "@/lib/money";
import { formatMoney } from "@/lib/format";
import { opt, ownedAccount, assertId } from "../guards";

const refresh = () => revalidatePath("/", "layout");

export async function createGoal(input: unknown) {
  return handle(async () => {
    const user = await requireUser();
    const v = savingsGoalSchema.parse(input);
    await ownedAccount(prisma, user.id, v.accountId);
    const g = await prisma.savingsGoal.create({
      data: { userId: user.id, name: v.name, description: opt(v.description), targetAmount: v.targetAmount, targetDate: v.targetDate ? dayFromString(v.targetDate) : null, priority: v.priority, status: v.status, isEmergencyFund: v.isEmergencyFund, accountId: v.accountId },
    });
    refresh();
    return g.id;
  }, "Savings goal created");
}

export async function updateGoal(id: string, input: unknown) {
  return handle(async () => {
    assertId(id);
    const user = await requireUser();
    const v = savingsGoalSchema.parse(input);
    const g = await prisma.savingsGoal.findFirst({ where: { id, userId: user.id }, include: { contributions: true } });
    if (!g) fail("Goal not found.");
    await ownedAccount(prisma, user.id, v.accountId);
    // Moving a funded goal to another account would earmark money that isn't there.
    if (v.accountId !== g.accountId && goalStats(g, new Date()).saved.gt(0))
      fail("This goal already holds money in its current account. Withdraw it to the new account first, then change the account.");
    await prisma.savingsGoal.update({
      where: { id },
      data: { name: v.name, description: opt(v.description), targetAmount: v.targetAmount, targetDate: v.targetDate ? dayFromString(v.targetDate) : null, priority: v.priority, status: v.status, isEmergencyFund: v.isEmergencyFund, accountId: v.accountId },
    });
    refresh();
  }, "Goal updated");
}

export async function deleteGoal(id: string) {
  return handle(async () => {
    assertId(id);
    const user = await requireUser();
    await prisma.$transaction(async (tx) => {
      const g = await tx.savingsGoal.findFirst({ where: { id, userId: user.id }, include: { contributions: true } });
      if (!g) fail("Goal not found.");
      // Money that moved between accounts really moved: keep those transfers as ordinary ones.
      const txnIds = g.contributions.map((c) => c.transactionId).filter((x): x is string => !!x);
      if (txnIds.length) await tx.transaction.updateMany({ where: { id: { in: txnIds }, userId: user.id }, data: { source: "MANUAL" } });
      await tx.savingsGoal.delete({ where: { id } });
      await audit(tx, user.id, "delete", "SavingsGoal", id, { name: g.name, contributions: g.contributions.length });
    });
    refresh();
  }, "Goal deleted. Any transfers it made were kept in your transactions.");
}

/** Sum of money earmarked by all goals held in an account. */
async function earmarked(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], userId: string, accountId: string) {
  const goals = await tx.savingsGoal.findMany({ where: { userId, accountId, status: { not: "CANCELLED" } }, include: { contributions: true } });
  return sum(goals.map((g) => goalStats(g, new Date()).saved));
}

export async function addContribution(input: unknown) {
  return handle(async () => {
    const user = await requireUser();
    const v = contributionSchema.parse(input);
    const mp = { currency: user.prefs.currency, locale: user.prefs.locale };
    await prisma.$transaction(async (tx) => {
      const goal = await tx.savingsGoal.findFirst({ where: { id: v.goalId, userId: user.id }, include: { contributions: true, account: true } });
      if (!goal) fail("Goal not found.");
      const stats = goalStats(goal, todayIn(user.prefs.timezone));
      const amount = dec(v.amount);
      const other = opt(v.otherAccountId);
      if (other) await ownedAccount(tx, user.id, other);
      const moves = !!other && other !== goal.accountId;

      if (v.type === "WITHDRAWAL" && amount.gt(stats.saved)) fail(`You can withdraw at most ${formatMoney(stats.saved.toString(), mp)} from this goal.`);

      let transactionId: string | null = null;
      if (moves) {
        const from = v.type === "CONTRIBUTION" ? other! : goal.accountId;
        const to = v.type === "CONTRIBUTION" ? goal.accountId : other!;
        const t = await tx.transaction.create({
          data: {
            userId: user.id,
            type: "TRANSFER",
            source: "SAVINGS",
            amount: v.amount,
            date: dayFromString(v.date),
            description: `${v.type === "CONTRIBUTION" ? "Saving towards" : "Withdrawal from"} ${goal.name}`,
            notes: opt(v.note),
            accountId: from,
            toAccountId: to,
          },
        });
        transactionId = t.id;
      }
      if (v.type === "CONTRIBUTION") {
        // A goal can't earmark more than the account actually holds (prevents phantom savings).
        const [bal, held] = await Promise.all([accountBalanceTx(tx, user.id, goal.accountId), earmarked(tx, user.id, goal.accountId)]);
        if (held.plus(amount).gt(bal))
          fail(
            `${goal.account.name} holds ${formatMoney(bal.toString(), mp)} and goals already earmark ${formatMoney(held.toString(), mp)}. Choose a "from" account to move the money in, or record the deposit as income first.`,
          );
      }
      const c = await tx.savingsContribution.create({ data: { userId: user.id, goalId: goal.id, type: v.type, amount: v.amount, date: dayFromString(v.date), note: opt(v.note), transactionId } });
      const newSaved = v.type === "CONTRIBUTION" ? stats.saved.plus(amount) : stats.saved.minus(amount);
      if (goal.status === "ACTIVE" && newSaved.gte(goal.targetAmount)) await tx.savingsGoal.update({ where: { id: goal.id }, data: { status: "COMPLETED" } });
      if (goal.status === "COMPLETED" && newSaved.lt(goal.targetAmount)) await tx.savingsGoal.update({ where: { id: goal.id }, data: { status: "ACTIVE" } });
      await audit(tx, user.id, v.type === "CONTRIBUTION" ? "contribute" : "withdraw", "SavingsGoal", goal.id, { contributionId: c.id, amount: v.amount, transactionId });
    });
    refresh();
  }, input && (input as { type?: string }).type === "WITHDRAWAL" ? "Withdrawal recorded" : "Contribution added");
}

export async function deleteContribution(id: string) {
  return handle(async () => {
    assertId(id);
    const user = await requireUser();
    await prisma.$transaction(async (tx) => {
      const c = await tx.savingsContribution.findFirst({ where: { id, userId: user.id }, include: { goal: { include: { contributions: true } } } });
      if (!c) fail("Entry not found.");
      if (c.type === "CONTRIBUTION") {
        const remaining = goalStats({ ...c.goal, contributions: c.goal.contributions.filter((x) => x.id !== id) }, new Date());
        if (remaining.saved.isNeg()) fail("Removing this contribution would make the goal negative. Delete the later withdrawals first.");
      }
      await tx.savingsContribution.delete({ where: { id } });
      if (c.transactionId) await tx.transaction.deleteMany({ where: { id: c.transactionId, userId: user.id } });
      await audit(tx, user.id, "delete", "SavingsContribution", id, { amount: c.amount.toString(), type: c.type, transactionId: c.transactionId });
    });
    refresh();
  }, "Entry removed and any linked transfer reversed");
}
