import type { Metadata } from "next";
import { requireUserPage } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { taskFormValues } from "@/lib/services/calendar";
import { instantToZoned } from "@/lib/dates";
import { PageHeader } from "@/components/shared/page-header";
import { TasksView } from "./view";

export const metadata: Metadata = { title: "Tasks" };

export default async function TasksPage() {
  const user = await requireUserPage();
  const tz = user.prefs.timezone;
  const tasks = await prisma.task.findMany({ where: { userId: user.id }, orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }] });
  const today = instantToZoned(new Date(), tz, "yyyy-MM-dd");
  const now = new Date();
  return (
    <div>
      <PageHeader title="Tasks" description="Everything you need to do, with today's agenda, overdue items and what's coming up." />
      <TasksView
        today={today}
        rows={tasks.map((t) => {
          const done = t.status === "DONE" || t.status === "CANCELLED";
          return {
            ...taskFormValues(t, tz),
            dueDay: t.dueDate ? instantToZoned(t.dueDate, tz, "yyyy-MM-dd") : "",
            dueTime: t.dueDate && !t.allDay ? instantToZoned(t.dueDate, tz, "HH:mm") : "",
            done,
            overdue: !done && !!t.dueDate && t.dueDate < now,
            completedAt: t.completedAt ? instantToZoned(t.completedAt, tz, "yyyy-MM-dd") : "",
          };
        })}
      />
    </div>
  );
}
