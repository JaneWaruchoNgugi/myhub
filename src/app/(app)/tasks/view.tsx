"use client";
import * as React from "react";
import { AlarmClock, CalendarCheck, CheckCircle2, ListChecks, Plus, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { RowActions } from "@/components/shared/row-actions";
import { ListToolbar, Pagination, useListControls } from "@/components/shared/list-controls";
import { TaskCheck } from "@/components/dashboard/task-check";
import { TaskDialog } from "@/components/forms/productivity";
import { PRIORITY_OPTS, RECURRENCE_OPTS, TASK_CATEGORY_OPTS, labelOf } from "@/components/forms/options";
import { deleteTask } from "@/server/actions/planner";
import { formatDay } from "@/lib/format";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  title: string;
  description: string;
  allDay: boolean;
  startDate: string;
  dueDate: string;
  priority: string;
  category: string;
  status: string;
  recurrence: string;
  reminderMinutes: string;
  dueDay: string;
  dueTime: string;
  done: boolean;
  overdue: boolean;
  completedAt: string;
};

type Tab = "today" | "upcoming" | "overdue" | "open" | "done";
const PRIORITY_RANK: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const PRIORITY_BADGE: Record<string, "danger" | "warning" | "secondary" | "outline"> = { URGENT: "danger", HIGH: "warning", MEDIUM: "secondary", LOW: "outline" };

function addDays(day: string, n: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function TasksView({ rows, today }: { rows: Row[]; today: string }) {
  const [tab, setTab] = React.useState<Tab>("today");
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<Row | null>(null);
  const weekEnd = addDays(today, 7);

  const open = rows.filter((r) => !r.done);
  const todays = open.filter((r) => r.dueDay === today);
  const overdue = open.filter((r) => r.overdue);
  const upcoming = open.filter((r) => r.dueDay > today && r.dueDay <= weekEnd);
  const doneToday = rows.filter((r) => r.status === "DONE" && r.completedAt === today);

  const inTab = React.useMemo(() => {
    switch (tab) {
      case "today":
        // Today's agenda also carries anything still overdue so it isn't forgotten.
        return open.filter((r) => r.dueDay === today || r.overdue);
      case "upcoming":
        return open.filter((r) => r.dueDay > today);
      case "overdue":
        return overdue;
      case "open":
        return open;
      case "done":
        return rows.filter((r) => r.done);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, rows, today]);

  const c = useListControls(inTab, {
    search: (r, q) => r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q),
    filters: [
      { key: "priority", label: "Priorities", options: PRIORITY_OPTS, test: (r, v) => r.priority === v },
      { key: "category", label: "Categories", options: TASK_CATEGORY_OPTS, test: (r, v) => r.category === v },
    ],
    sorts: [
      { key: "due", label: "Due date", compare: (a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999") || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] },
      { key: "priority", label: "Priority", compare: (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || (a.dueDate || "9999").localeCompare(b.dueDate || "9999") },
      { key: "title", label: "Title", compare: (a, b) => a.title.localeCompare(b.title) },
    ],
    pageSize: 25,
  });

  const emptyCopy: Record<Tab, string> = {
    today: "Nothing due today and nothing overdue. Enjoy it, or plan ahead.",
    upcoming: "No upcoming tasks with a due date.",
    overdue: "You're all caught up. No overdue tasks.",
    open: "No open tasks.",
    done: "Completed tasks will appear here.",
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Due today" value={todays.length} icon={<CalendarCheck />} tone="primary" />
        <StatCard label="Overdue" value={overdue.length} icon={<AlarmClock />} tone={overdue.length ? "negative" : undefined} />
        <StatCard label="Next 7 days" value={upcoming.length} icon={<ListChecks />} />
        <StatCard label="Completed today" value={doneToday.length} icon={<CheckCircle2 />} tone="positive" />
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="overdue">Overdue{overdue.length ? ` (${overdue.length})` : ""}</TabsTrigger>
          <TabsTrigger value="open">All open</TabsTrigger>
          <TabsTrigger value="done">Completed</TabsTrigger>
        </TabsList>
      </Tabs>
      <div>
        <ListToolbar controls={c} placeholder="Search tasks">
          <Button onClick={() => setAdding(true)}>
            <Plus /> Add task
          </Button>
        </ListToolbar>
        {rows.length === 0 ? (
          <EmptyState icon={<ListChecks />} title="No tasks yet" description="Add personal, work or finance to-dos. Tasks with a due date also show on your calendar." action={<Button onClick={() => setAdding(true)}><Plus /> Add task</Button>} />
        ) : c.total === 0 ? (
          <EmptyState title={c.isFiltered ? "No tasks match your filters" : emptyCopy[tab]} action={c.isFiltered ? <Button variant="outline" onClick={c.clear}>Clear filters</Button> : undefined} />
        ) : (
          <Card className="py-0">
            <ul className="divide-y">
              {c.pageItems.map((r) => (
                <li key={r.id} className={cn("flex items-start gap-3 px-4 py-3", r.done && "opacity-60")}>
                  <div className="pt-0.5">{r.status === "CANCELLED" ? <span className="block size-4" /> : <TaskCheck id={r.id} done={r.status === "DONE"} label={r.title} />}</div>
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditing(r)}>
                    <div className={cn("font-medium", r.status === "DONE" && "line-through")}>{r.title}</div>
                    <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                      <Badge variant={PRIORITY_BADGE[r.priority]}>{r.priority.toLowerCase()}</Badge>
                      <span>{labelOf(TASK_CATEGORY_OPTS, r.category)}</span>
                      {r.status === "IN_PROGRESS" ? <Badge variant="info">in progress</Badge> : null}
                      {r.status === "CANCELLED" ? <Badge variant="outline">cancelled</Badge> : null}
                      {r.recurrence !== "NONE" ? (
                        <span className="inline-flex items-center gap-1">
                          <Repeat className="size-3" /> {labelOf(RECURRENCE_OPTS, r.recurrence).toLowerCase()}
                        </span>
                      ) : null}
                      {r.description ? <span className="line-clamp-1 max-w-md">· {r.description}</span> : null}
                    </div>
                  </button>
                  <div className="shrink-0 text-right text-xs">
                    {r.dueDay ? (
                      <>
                        <div className={cn(r.overdue ? "font-medium text-red-600 dark:text-red-400" : r.dueDay === today ? "text-foreground font-medium" : "text-muted-foreground")}>{r.dueDay === today ? "Today" : r.dueDay === addDays(today, 1) ? "Tomorrow" : formatDay(r.dueDay)}</div>
                        <div className="text-muted-foreground">{r.dueTime || (r.overdue ? "overdue" : "")}</div>
                      </>
                    ) : (
                      <span className="text-muted-foreground">No date</span>
                    )}
                  </div>
                  <RowActions onEdit={() => setEditing(r)} onDelete={() => deleteTask(r.id)} deleteTitle={`Delete "${r.title}"?`} />
                </li>
              ))}
            </ul>
          </Card>
        )}
        <Pagination page={c.page} pageCount={c.pageCount} total={c.total} onPage={c.setPage} />
      </div>
      <TaskDialog open={adding} onOpenChange={setAdding} />
      <TaskDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} initial={editing ?? undefined} />
    </div>
  );
}
