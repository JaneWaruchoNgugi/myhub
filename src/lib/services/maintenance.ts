import "server-only";
import type { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { addDays, advance, dayString, diffDays, startOfMonth, todayIn, type Freq } from "@/lib/dates";
import { formatDay, formatMoney } from "@/lib/format";
import { loanSummary } from "./loans";
import { goalStats } from "./savings";
import { evaluateBudget } from "./budgets";
import { snapshotNetWorth } from "./networth";
import type { Prefs } from "@/lib/session";

const MAX_OCCURRENCES_PER_RUN = 120;

/**
 * Materialises due occurrences of recurring transactions up to today.
 * Idempotent: (recurringRuleId, occurrenceDate) is unique, so a rerun never duplicates.
 */
export async function runRecurring(userId: string, today: Date) {
  const rules = await prisma.recurringRule.findMany({ where: { userId, isActive: true, nextDate: { lte: today } } });
  let created = 0;
  for (const rule of rules) {
    const dates: Date[] = [];
    let d = rule.nextDate;
    const anchor = rule.startDate.getUTCDate();
    while (d <= today && (!rule.endDate || d <= rule.endDate) && dates.length < MAX_OCCURRENCES_PER_RUN) {
      dates.push(d);
      d = advance(d, rule.frequency as Freq, anchor);
    }
    await prisma.$transaction(async (tx) => {
      const res = await tx.transaction.createMany({
        data: dates.map((date) => ({
          userId,
          type: rule.type,
          source: "RECURRING" as const,
          amount: rule.amount,
          date,
          description: rule.description,
          accountId: rule.accountId,
          toAccountId: rule.type === "TRANSFER" ? rule.toAccountId : null,
          categoryId: rule.type === "TRANSFER" ? null : rule.categoryId,
          recurringRuleId: rule.id,
          occurrenceDate: date,
        })),
        skipDuplicates: true,
      });
      created += res.count;
      const finished = !!rule.endDate && d > rule.endDate;
      await tx.recurringRule.update({ where: { id: rule.id }, data: { nextDate: d, isActive: finished ? false : rule.isActive } });
    });
  }
  return created;
}

type NewNote = { type: NotificationType; title: string; message: string; link?: string; dedupeKey: string };

/** Builds in-app reminders. Deduplicated with (userId, dedupeKey) so each fires once. */
export async function syncNotifications(userId: string, prefs: Prefs) {
  const today = todayIn(prefs.timezone);
  const mp = { currency: prefs.currency, locale: prefs.locale };
  const notes: NewNote[] = [];
  const now = new Date();

  const [bills, loans, tasks, events, goals, projects, subs] = await Promise.all([
    prisma.bill.findMany({ where: { userId, isActive: true, nextDueDate: { lte: addDays(today, prefs.billReminderDays) } } }),
    prisma.loan.findMany({ where: { userId, status: "ACTIVE" }, include: { repayments: true } }),
    prisma.task.findMany({ where: { userId, status: { in: ["TODO", "IN_PROGRESS"] }, dueDate: { not: null, lte: addDays(now, Math.max(prefs.taskReminderDays, 30)) } } }),
    prisma.calendarEvent.findMany({ where: { userId, start: { gte: now, lte: addDays(now, 2) } } }),
    prisma.savingsGoal.findMany({ where: { userId, status: { in: ["ACTIVE", "COMPLETED"] } }, include: { contributions: true } }),
    prisma.devProject.findMany({ where: { userId, status: { in: ["PLANNING", "ACTIVE"] }, deadline: { not: null, lte: addDays(today, prefs.projectReminderDays) } } }),
    prisma.subscription.findMany({ where: { userId, status: { in: ["ACTIVE", "TRIAL"] }, nextBillingDate: { lte: addDays(today, prefs.billReminderDays) } } }),
  ]);

  for (const b of bills) {
    const key = dayString(b.nextDueDate);
    if (b.nextDueDate < today)
      notes.push({ type: "BILL_OVERDUE", title: `${b.name} is overdue`, message: `${formatMoney(b.amount.toString(), mp)} was due ${formatDay(b.nextDueDate)}.`, link: "/bills", dedupeKey: `bill-overdue:${b.id}:${key}` });
    else
      notes.push({ type: "BILL_UPCOMING", title: `${b.name} due ${diffDays(b.nextDueDate, today) === 0 ? "today" : `in ${diffDays(b.nextDueDate, today)} day(s)`}`, message: `${formatMoney(b.amount.toString(), mp)} due ${formatDay(b.nextDueDate)}.`, link: "/bills", dedupeKey: `bill-upcoming:${b.id}:${key}` });
  }
  for (const s of subs) {
    if (s.nextBillingDate >= today)
      notes.push({ type: "SUBSCRIPTION_RENEWAL", title: `${s.name} renews ${formatDay(s.nextBillingDate, "short")}`, message: `${formatMoney(s.amount.toString(), mp)} will be charged.`, link: "/subscriptions", dedupeKey: `sub:${s.id}:${dayString(s.nextBillingDate)}` });
  }
  for (const l of loans) {
    const s = loanSummary(l, today);
    if (!s.next) continue;
    const key = dayString(s.next.date);
    const verb = l.direction === "BORROWED" ? "repayment" : "collection";
    if (s.isOverdue)
      notes.push({ type: "LOAN_OVERDUE", title: `Loan ${verb} overdue: ${l.name}`, message: `Instalment of ${formatMoney(s.next.payment.toString(), mp)} was due ${formatDay(s.next.date)}.`, link: `/loans/${l.id}`, dedupeKey: `loan-overdue:${l.id}:${key}` });
    else if (diffDays(s.next.date, today) <= prefs.loanReminderDays)
      notes.push({ type: "LOAN_REPAYMENT", title: `Loan ${verb} due ${formatDay(s.next.date, "short")}`, message: `${l.name}: ${formatMoney(s.next.payment.toString(), mp)}.`, link: `/loans/${l.id}`, dedupeKey: `loan-due:${l.id}:${key}` });
  }
  for (const t of tasks) {
    if (!t.dueDate) continue;
    const key = t.dueDate.toISOString();
    const remindAt = t.reminderMinutes != null ? new Date(t.dueDate.getTime() - t.reminderMinutes * 60_000) : addDays(t.dueDate, -prefs.taskReminderDays);
    if (t.dueDate < now)
      notes.push({ type: "TASK_OVERDUE", title: `Missed deadline: ${t.title}`, message: `This task was due ${formatDay(t.dueDate)}.`, link: "/tasks", dedupeKey: `task-overdue:${t.id}:${key}` });
    else if (remindAt <= now)
      notes.push({ type: "TASK_UPCOMING", title: `Upcoming task: ${t.title}`, message: `Due ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: t.allDay ? undefined : "short", timeZone: prefs.timezone }).format(t.dueDate)}.`, link: "/tasks", dedupeKey: `task-upcoming:${t.id}:${key}` });
  }
  for (const e of events) {
    const remindAt = new Date(e.start.getTime() - (e.reminderMinutes ?? 24 * 60) * 60_000);
    if (remindAt <= now)
      notes.push({ type: "EVENT_UPCOMING", title: `${e.title}`, message: `Starts ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: e.allDay ? undefined : "short", timeZone: prefs.timezone }).format(e.start)}${e.location ? ` at ${e.location}` : ""}.`, link: "/calendar", dedupeKey: `event:${e.id}:${e.start.toISOString()}` });
  }
  for (const p of projects) {
    if (!p.deadline) continue;
    const overdue = p.deadline < today;
    notes.push({ type: "PROJECT_DEADLINE", title: overdue ? `Project deadline missed: ${p.name}` : `Project deadline ${formatDay(p.deadline, "short")}: ${p.name}`, message: overdue ? `The deadline was ${formatDay(p.deadline)}.` : `Deadline is ${formatDay(p.deadline)}.`, link: "/dev/projects", dedupeKey: `project:${overdue ? "missed" : "due"}:${p.id}:${dayString(p.deadline)}` });
  }
  const milestoneUpdates: { id: string; step: number }[] = [];
  for (const g of goals) {
    const st = goalStats(g, today);
    const step = Math.min(4, Math.floor(st.progress / 25));
    if (step > g.milestonesNotified) {
      notes.push({ type: "SAVINGS_MILESTONE", title: step === 4 ? `Goal reached: ${g.name} 🎉` : `${g.name} is ${step * 25}% funded`, message: `${formatMoney(st.saved.toString(), mp)} of ${formatMoney(st.target.toString(), mp)} saved.`, link: `/savings/${g.id}`, dedupeKey: `savings:${g.id}:${step}` });
      milestoneUpdates.push({ id: g.id, step });
    }
  }
  const month = startOfMonth(today);
  const budget = await evaluateBudget(userId, month, prefs.budgetAlertThreshold);
  for (const line of budget?.lines ?? []) {
    const mk = dayString(month).slice(0, 7);
    if (line.state === "over")
      notes.push({ type: "BUDGET_EXCEEDED", title: `${line.categoryName} budget exceeded`, message: `Spent ${formatMoney(line.spent.toString(), mp)} of ${formatMoney(line.effectiveLimit.toString(), mp)} (${line.utilization}%).`, link: "/budgets", dedupeKey: `budget-over:${line.itemId}:${mk}` });
    else if (line.state === "warning")
      notes.push({ type: "BUDGET_WARNING", title: `${line.categoryName} budget at ${line.utilization}%`, message: `${formatMoney(line.remaining.toString(), mp)} left this month.`, link: "/budgets", dedupeKey: `budget-warn:${line.itemId}:${mk}` });
  }

  if (notes.length) await prisma.notification.createMany({ data: notes.map((n) => ({ ...n, userId })), skipDuplicates: true });
  for (const m of milestoneUpdates) await prisma.savingsGoal.update({ where: { id: m.id }, data: { milestonesNotified: m.step } });
  return notes.length;
}

const lastRun = new Map<string, number>();

/**
 * Runs recurring generation, reminders and the monthly net-worth snapshot.
 * Triggered when the user opens the app (throttled) and by /api/cron/run.
 */
export async function runMaintenance(userId: string, prefs: Prefs, opts?: { force?: boolean }) {
  const now = Date.now();
  if (!opts?.force && (lastRun.get(userId) ?? 0) > now - 2 * 60_000) return;
  lastRun.set(userId, now);
  try {
    const today = todayIn(prefs.timezone);
    await runRecurring(userId, today);
    await syncNotifications(userId, prefs);
    await snapshotNetWorth(userId, today);
  } catch (e) {
    console.error("[maintenance]", e);
  }
}
