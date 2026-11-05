"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { fail, handle } from "@/lib/action";
import { advance, zonedToInstant, type Freq } from "@/lib/dates";
import { eventSchema, taskSchema } from "@/lib/validation/productivity";
import { opt, assertId } from "../guards";

const refresh = () => revalidatePath("/", "layout");

/** Normalises "YYYY-MM-DD" / "YYYY-MM-DDTHH:mm" into a full wall-clock string. */
const wallClock = (s: string) => (s.length === 10 ? `${s}T09:00:00` : s.length === 16 ? `${s}:00` : s.slice(0, 19));

/** All-day tasks are due at the end of that day in the user's timezone. */
function taskDates(v: { startDate?: string; dueDate?: string; allDay: boolean }, tz: string) {
  const conv = (s: string | undefined, end: boolean) => {
    if (!s) return null;
    if (v.allDay) return zonedToInstant(`${s.slice(0, 10)}T${end ? "23:59:00" : "00:00:00"}`, tz);
    return zonedToInstant(wallClock(s), tz);
  };
  return { startDate: conv(v.startDate, false), dueDate: conv(v.dueDate, true) };
}

export async function saveTask(id: string | null, input: unknown) {
  return handle(async () => {
    if (id !== null) assertId(id);
    const user = await requireUser();
    const v = taskSchema.parse(input);
    const dates = taskDates(v, user.prefs.timezone);
    const data = {
      title: v.title,
      description: opt(v.description),
      ...dates,
      allDay: v.allDay,
      priority: v.priority,
      category: v.category,
      status: v.status,
      reminderMinutes: v.reminderMinutes === "" || v.reminderMinutes === undefined ? null : Number(v.reminderMinutes),
      recurrence: v.recurrence,
      completedAt: v.status === "DONE" ? new Date() : null,
    };
    if (id) {
      const t = await prisma.task.findFirst({ where: { id, userId: user.id } });
      if (!t) fail("Task not found.");
      await prisma.task.update({ where: { id }, data: { ...data, completedAt: v.status === "DONE" ? (t.completedAt ?? new Date()) : null } });
      if (t.status !== "DONE" && v.status === "DONE") await spawnNext(user.id, { ...t, ...data });
    } else await prisma.task.create({ data: { userId: user.id, ...data } });
    refresh();
  }, id ? "Task updated" : "Task added");
}

async function spawnNext(userId: string, t: { title: string; description: string | null; startDate: Date | null; dueDate: Date | null; allDay: boolean; priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"; category: "PERSONAL" | "WORK" | "HEALTH" | "FINANCE" | "LEARNING" | "ERRAND" | "OTHER"; reminderMinutes: number | null; recurrence: string }) {
  if (t.recurrence === "NONE" || !t.dueDate) return;
  const nextDue = advance(t.dueDate, t.recurrence as Freq, t.dueDate.getUTCDate());
  const shift = nextDue.getTime() - t.dueDate.getTime();
  await prisma.task.create({
    data: {
      userId,
      title: t.title,
      description: t.description,
      dueDate: nextDue,
      startDate: t.startDate ? new Date(t.startDate.getTime() + shift) : null,
      allDay: t.allDay,
      priority: t.priority,
      category: t.category,
      reminderMinutes: t.reminderMinutes,
      recurrence: t.recurrence as "DAILY",
    },
  });
}

export async function toggleTask(id: string, done: boolean) {
  return handle(async () => {
    assertId(id);
    const user = await requireUser();
    const t = await prisma.task.findFirst({ where: { id, userId: user.id } });
    if (!t) fail("Task not found.");
    await prisma.task.update({ where: { id }, data: { status: done ? "DONE" : "TODO", completedAt: done ? new Date() : null } });
    if (done && t.status !== "DONE") await spawnNext(user.id, t);
    refresh();
  }, done ? "Task completed" : "Task reopened");
}

export async function deleteTask(id: string) {
  return handle(async () => {
    assertId(id);
    const user = await requireUser();
    const r = await prisma.task.deleteMany({ where: { id, userId: user.id } });
    if (!r.count) fail("Task not found.");
    refresh();
  }, "Task deleted");
}

export async function saveEvent(id: string | null, input: unknown) {
  return handle(async () => {
    if (id !== null) assertId(id);
    const user = await requireUser();
    const v = eventSchema.parse(input);
    const tz = user.prefs.timezone;
    const toI = (s: string, end = false) => (v.allDay ? zonedToInstant(`${s.slice(0, 10)}T${end ? "23:59:00" : "00:00:00"}`, tz) : zonedToInstant(wallClock(s), tz));
    const data = {
      title: v.title,
      description: opt(v.description),
      location: opt(v.location),
      type: v.type,
      start: toI(v.start),
      end: v.end ? toI(v.end, true) : null,
      allDay: v.allDay,
      reminderMinutes: v.reminderMinutes === "" || v.reminderMinutes === undefined ? null : Number(v.reminderMinutes),
      recurrence: v.recurrence,
    };
    if (id) {
      const e = await prisma.calendarEvent.findFirst({ where: { id, userId: user.id } });
      if (!e) fail("Event not found.");
      await prisma.calendarEvent.update({ where: { id }, data });
    } else await prisma.calendarEvent.create({ data: { userId: user.id, ...data } });
    refresh();
  }, id ? "Event updated" : "Event added");
}

export async function deleteEvent(id: string) {
  return handle(async () => {
    assertId(id);
    const user = await requireUser();
    const r = await prisma.calendarEvent.deleteMany({ where: { id, userId: user.id } });
    if (!r.count) fail("Event not found.");
    refresh();
  }, "Event deleted");
}

const moveSchema = z.object({
  kind: z.enum(["task", "event", "bill", "devtask", "project"]),
  id: z.string().min(1).max(40),
  start: z.string().datetime(),
  end: z.string().datetime().nullable().optional(),
  allDay: z.boolean(),
});

/** Drag & drop on the calendar. Times arrive as wall-clock values encoded as UTC. */
export async function moveCalendarItem(input: unknown) {
  return handle(async () => {
    const user = await requireUser();
    const v = moveSchema.parse(input);
    const tz = user.prefs.timezone;
    const wall = (iso: string) => iso.slice(0, 19);
    const day = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
    if (v.kind === "task") {
      const t = await prisma.task.findFirst({ where: { id: v.id, userId: user.id } });
      if (!t) fail("Task not found.");
      const due = v.allDay ? zonedToInstant(`${v.start.slice(0, 10)}T23:59:00`, tz) : zonedToInstant(wall(v.end ?? v.start), tz);
      const start = t.startDate ? (v.allDay ? zonedToInstant(`${v.start.slice(0, 10)}T00:00:00`, tz) : zonedToInstant(wall(v.start), tz)) : null;
      await prisma.task.update({ where: { id: v.id }, data: { dueDate: due, startDate: start, allDay: v.allDay } });
    } else if (v.kind === "event") {
      const e = await prisma.calendarEvent.findFirst({ where: { id: v.id, userId: user.id } });
      if (!e) fail("Event not found.");
      const start = v.allDay ? zonedToInstant(`${v.start.slice(0, 10)}T00:00:00`, tz) : zonedToInstant(wall(v.start), tz);
      const end = v.end ? (v.allDay ? zonedToInstant(`${new Date(new Date(v.end).getTime() - 86_400_000).toISOString().slice(0, 10)}T23:59:00`, tz) : zonedToInstant(wall(v.end), tz)) : null;
      await prisma.calendarEvent.update({ where: { id: v.id }, data: { start, end, allDay: v.allDay } });
    } else if (v.kind === "bill") {
      const r = await prisma.bill.updateMany({ where: { id: v.id, userId: user.id }, data: { nextDueDate: day(v.start) } });
      if (!r.count) fail("Bill not found.");
    } else if (v.kind === "devtask") {
      const r = await prisma.devTask.updateMany({ where: { id: v.id, userId: user.id }, data: { dueDate: day(v.start) } });
      if (!r.count) fail("Task not found.");
    } else {
      const r = await prisma.devProject.updateMany({ where: { id: v.id, userId: user.id }, data: { deadline: day(v.start) } });
      if (!r.count) fail("Project not found.");
    }
    refresh();
  }, "Rescheduled");
}

export async function markNotification(id: string, read: boolean) {
  return handle(async () => {
    assertId(id);
    const user = await requireUser();
    await prisma.notification.updateMany({ where: { id, userId: user.id }, data: { isRead: read } });
    refresh();
  }, read ? "Marked as read" : "Marked as unread");
}

export async function markAllNotificationsRead() {
  return handle(async () => {
    const user = await requireUser();
    const r = await prisma.notification.updateMany({ where: { userId: user.id, isRead: false }, data: { isRead: true } });
    refresh();
    return r.count;
  }, "All caught up");
}

export async function deleteNotification(id: string) {
  return handle(async () => {
    assertId(id);
    const user = await requireUser();
    await prisma.notification.updateMany({ where: { id, userId: user.id }, data: { dismissed: true, isRead: true } });
    refresh();
  }, "Notification removed");
}

export async function clearReadNotifications() {
  return handle(async () => {
    const user = await requireUser();
    await prisma.notification.updateMany({ where: { userId: user.id, isRead: true, dismissed: false }, data: { dismissed: true } });
    refresh();
  }, "Read notifications cleared");
}
