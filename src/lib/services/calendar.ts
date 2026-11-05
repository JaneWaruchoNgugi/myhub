import "server-only";
import { prisma } from "@/lib/prisma";
import { advance, instantToZoned, type Freq } from "@/lib/dates";
import { loanSummary } from "./loans";
import { formatMoney } from "@/lib/format";
import type { Prefs } from "@/lib/session";

export type CalKind = "task" | "event" | "bill" | "loan" | "subscription" | "project" | "devtask";

export type CalItem = {
  id: string;
  kind: CalKind;
  refId: string;
  title: string;
  start: string; // wall-clock in user tz, no offset
  end?: string;
  allDay: boolean;
  editable: boolean;
  category: string;
  url?: string;
  done?: boolean;
  overdue?: boolean;
  raw?: Record<string, unknown>;
};

const MAX_OCC = 400;

type TaskRow = { id: string; title: string; description: string | null; allDay: boolean; startDate: Date | null; dueDate: Date | null; priority: string; category: string; status: string; recurrence: string; reminderMinutes: number | null };

/** A task as the values the task form expects (wall-clock strings in the user's timezone). */
export function taskFormValues(t: TaskRow, tz: string) {
  const z = (d: Date) => instantToZoned(d, tz, "yyyy-MM-dd'T'HH:mm:ss");
  const fmt = (d: Date | null) => (d ? (t.allDay ? z(d).slice(0, 10) : z(d).slice(0, 16)) : "");
  return {
    id: t.id,
    title: t.title,
    description: t.description ?? "",
    allDay: t.allDay,
    startDate: fmt(t.startDate),
    dueDate: fmt(t.dueDate),
    priority: t.priority,
    category: t.category,
    status: t.status,
    recurrence: t.recurrence,
    reminderMinutes: t.reminderMinutes?.toString() ?? "",
  };
}
const day = (d: Date) => d.toISOString().slice(0, 10);

/** Every dated thing in MYHUB for a range, as calendar items (wall-clock times in the user's timezone). */
export async function calendarItems(userId: string, prefs: Prefs, from: Date, to: Date): Promise<CalItem[]> {
  const tz = prefs.timezone;
  const mp = { currency: prefs.currency, locale: prefs.locale };
  const z = (d: Date) => instantToZoned(d, tz, "yyyy-MM-dd'T'HH:mm:ss");
  const now = new Date();
  const items: CalItem[] = [];
  const [tasks, events, bills, loans, subs, projects, devtasks] = await Promise.all([
    prisma.task.findMany({ where: { userId, dueDate: { gte: from, lte: to } } }),
    prisma.calendarEvent.findMany({ where: { userId, start: { lte: to }, OR: [{ recurrence: { not: "NONE" } }, { start: { gte: new Date(from.getTime() - 31 * 86_400_000) } }] } }),
    prisma.bill.findMany({ where: { userId, isActive: true, nextDueDate: { lte: to } } }),
    prisma.loan.findMany({ where: { userId, status: "ACTIVE" }, include: { repayments: true } }),
    prisma.subscription.findMany({ where: { userId, status: { in: ["ACTIVE", "TRIAL"] }, nextBillingDate: { lte: to } } }),
    prisma.devProject.findMany({ where: { userId, deadline: { gte: from, lte: to } } }),
    prisma.devTask.findMany({ where: { userId, dueDate: { gte: from, lte: to } }, include: { project: { select: { name: true } } } }),
  ]);

  for (const t of tasks) {
    if (!t.dueDate) continue;
    const done = t.status === "DONE" || t.status === "CANCELLED";
    items.push({
      id: `task:${t.id}`,
      kind: "task",
      refId: t.id,
      title: t.title,
      start: t.allDay ? z(t.dueDate).slice(0, 10) : z(t.startDate && t.startDate < t.dueDate ? t.startDate : t.dueDate),
      end: !t.allDay && t.startDate && t.startDate < t.dueDate ? z(t.dueDate) : undefined,
      allDay: t.allDay,
      editable: true,
      category: t.category,
      done,
      overdue: !done && t.dueDate < now,
      raw: taskFormValues(t, tz),
    });
  }
  for (const e of events) {
    const dur = e.end ? e.end.getTime() - e.start.getTime() : 0;
    let s = e.start;
    let n = 0;
    while (s <= to && n < MAX_OCC) {
      if (s.getTime() + dur >= from.getTime()) {
        const en = e.end ? new Date(s.getTime() + dur) : null;
        items.push({
          id: `event:${e.id}:${n}`,
          kind: "event",
          refId: e.id,
          title: e.title + (e.location ? ` · ${e.location}` : ""),
          start: e.allDay ? z(s).slice(0, 10) : z(s),
          // FullCalendar all-day ends are exclusive
          end: en ? (e.allDay ? day(new Date(new Date(`${z(en).slice(0, 10)}T00:00:00Z`).getTime() + 86_400_000)) : z(en)) : undefined,
          allDay: e.allDay,
          editable: e.recurrence === "NONE",
          category: e.type,
          raw: {
            id: e.id,
            title: e.title,
            description: e.description ?? "",
            location: e.location ?? "",
            type: e.type,
            allDay: e.allDay,
            start: e.allDay ? z(e.start).slice(0, 10) : z(e.start).slice(0, 16),
            end: e.end ? (e.allDay ? z(e.end).slice(0, 10) : z(e.end).slice(0, 16)) : "",
            recurrence: e.recurrence,
            reminderMinutes: e.reminderMinutes?.toString() ?? "",
          },
        });
      }
      if (e.recurrence === "NONE") break;
      s = advance(s, e.recurrence as Freq, e.start.getUTCDate());
      n++;
    }
  }
  for (const b of bills) {
    let d = b.nextDueDate;
    let n = 0;
    while (d <= to && n < 60) {
      if (d >= from)
        items.push({ id: `bill:${b.id}:${n}`, kind: "bill", refId: b.id, title: `${b.name} · ${formatMoney(b.amount.toString(), mp, { compact: true })}`, start: day(d), allDay: true, editable: n === 0, category: "BILL", url: "/bills", overdue: n === 0 && d < new Date(`${z(now).slice(0, 10)}T00:00:00Z`) });
      if (b.recurrence === "NONE") break;
      d = advance(d, b.recurrence as Freq, b.anchorDay ?? b.nextDueDate.getUTCDate());
      n++;
    }
  }
  for (const l of loans) {
    const s = loanSummary(l, now);
    let cumulative = 0;
    const repaid = s.principalRepaid.toNumber();
    for (const row of s.schedule) {
      cumulative += row.principal.toNumber();
      if (cumulative <= repaid + 0.005) continue; // already covered
      if (row.date < from || row.date > to) continue;
      items.push({ id: `loan:${l.id}:${row.n}`, kind: "loan", refId: l.id, title: `${l.direction === "BORROWED" ? "Repay" : "Collect"} ${l.name} · ${formatMoney(row.payment.toString(), mp, { compact: true })}`, start: day(row.date), allDay: true, editable: false, category: "LOAN", url: `/loans/${l.id}` });
    }
  }
  const CYCLE: Record<string, Freq> = { WEEKLY: "WEEKLY", MONTHLY: "MONTHLY", QUARTERLY: "QUARTERLY", SEMI_ANNUAL: "SEMI_ANNUAL", YEARLY: "YEARLY" };
  for (const sub of subs) {
    let d = sub.nextBillingDate;
    let n = 0;
    while (d <= to && n < 60) {
      if (d >= from) items.push({ id: `sub:${sub.id}:${n}`, kind: "subscription", refId: sub.id, title: `${sub.name} renews · ${formatMoney(sub.amount.toString(), mp, { compact: true })}`, start: day(d), allDay: true, editable: false, category: "SUBSCRIPTION", url: "/subscriptions" });
      d = advance(d, CYCLE[sub.billingCycle], sub.anchorDay ?? sub.nextBillingDate.getUTCDate());
      n++;
    }
  }
  for (const p of projects) items.push({ id: `project:${p.id}`, kind: "project", refId: p.id, title: `Deadline: ${p.name}`, start: day(p.deadline!), allDay: true, editable: true, category: "PROJECT", url: "/dev/projects" });
  for (const t of devtasks) items.push({ id: `devtask:${t.id}`, kind: "devtask", refId: t.id, title: `${t.title}${t.project ? ` (${t.project.name})` : ""}`, start: day(t.dueDate!), allDay: true, editable: true, category: "DEV", url: "/dev/kanban", done: t.status === "COMPLETED" });
  return items;
}
