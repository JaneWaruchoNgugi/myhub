"use client";
import * as React from "react";
import Link from "next/link";
import { AlarmClock, Bell, BellOff, CalendarClock, CheckCheck, FolderKanban, HandCoins, Info, ListChecks, PieChart, PiggyBank, Receipt, Repeat, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm";
import { RowActions } from "@/components/shared/row-actions";
import { ListToolbar, Pagination, useListControls } from "@/components/shared/list-controls";
import { useRun } from "@/components/shared/use-run";
import { clearReadNotifications, deleteNotification, markAllNotificationsRead, markNotification } from "@/server/actions/planner";
import { cn } from "@/lib/utils";

type Row = { id: string; type: string; title: string; message: string; link: string; isRead: boolean; when: string; createdAt: string };

const GROUPS = [
  { value: "bills", label: "Bills", types: ["BILL_UPCOMING", "BILL_OVERDUE"] },
  { value: "loans", label: "Loans", types: ["LOAN_REPAYMENT", "LOAN_OVERDUE"] },
  { value: "budgets", label: "Budgets", types: ["BUDGET_WARNING", "BUDGET_EXCEEDED"] },
  { value: "savings", label: "Savings", types: ["SAVINGS_MILESTONE"] },
  { value: "subscriptions", label: "Subscriptions", types: ["SUBSCRIPTION_RENEWAL"] },
  { value: "planner", label: "Tasks & events", types: ["TASK_UPCOMING", "TASK_OVERDUE", "EVENT_UPCOMING"] },
  { value: "dev", label: "Projects", types: ["PROJECT_DEADLINE"] },
  { value: "system", label: "System", types: ["SYSTEM"] },
];

const ICON: Record<string, React.ReactNode> = {
  BILL_UPCOMING: <Receipt />,
  BILL_OVERDUE: <Receipt />,
  LOAN_REPAYMENT: <HandCoins />,
  LOAN_OVERDUE: <HandCoins />,
  BUDGET_WARNING: <PieChart />,
  BUDGET_EXCEEDED: <PieChart />,
  SAVINGS_MILESTONE: <PiggyBank />,
  SUBSCRIPTION_RENEWAL: <Repeat />,
  TASK_UPCOMING: <ListChecks />,
  TASK_OVERDUE: <AlarmClock />,
  EVENT_UPCOMING: <CalendarClock />,
  PROJECT_DEADLINE: <FolderKanban />,
  SYSTEM: <Info />,
};
const URGENT = new Set(["BILL_OVERDUE", "LOAN_OVERDUE", "BUDGET_EXCEEDED", "TASK_OVERDUE"]);

export function NotificationsView({ rows, reminderDays }: { rows: Row[]; reminderDays: { bills: number; loans: number } }) {
  const { pending, run } = useRun();
  const [clearing, setClearing] = React.useState(false);
  const unread = rows.filter((r) => !r.isRead).length;
  const c = useListControls(rows, {
    search: (r, q) => r.title.toLowerCase().includes(q) || r.message.toLowerCase().includes(q),
    filters: [
      { key: "state", label: "Notifications", options: [{ value: "unread", label: "Unread only" }, { value: "read", label: "Read only" }], test: (r, v) => (v === "unread" ? !r.isRead : r.isRead) },
      { key: "group", label: "Types", options: GROUPS.map((g) => ({ value: g.value, label: g.label })), test: (r, v) => GROUPS.find((g) => g.value === v)!.types.includes(r.type) },
    ],
    sorts: [
      { key: "new", label: "Newest", compare: (a, b) => b.createdAt.localeCompare(a.createdAt) },
      { key: "old", label: "Oldest", compare: (a, b) => a.createdAt.localeCompare(b.createdAt) },
    ],
    pageSize: 30,
  });

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex-row items-start gap-3 px-4 py-3 text-sm">
        <Info className="text-muted-foreground mt-0.5 size-4 shrink-0" />
        <p className="text-muted-foreground">
          Reminders are generated inside MYHUB when you use the app (and by the scheduled job, if you set one up). They are not sent by email, SMS or push. Bills alert {reminderDays.bills} day(s) ahead and loans {reminderDays.loans} day(s) ahead; change this in{" "}
          <Link href="/settings" className="text-foreground underline underline-offset-2">
            Settings
          </Link>
          .
        </p>
      </Card>
      <ListToolbar controls={c} placeholder="Search notifications">
        <Button variant="outline" disabled={!unread || pending} onClick={() => run(() => markAllNotificationsRead())}>
          <CheckCheck /> Mark all read
        </Button>
        <Button variant="outline" disabled={rows.length === unread} onClick={() => setClearing(true)}>
          <Trash2 /> Clear read
        </Button>
      </ListToolbar>
      {rows.length === 0 ? (
        <EmptyState icon={<BellOff />} title="No notifications" description="When a bill, loan instalment, renewal or deadline is coming up, or a budget runs hot, you'll see it here." />
      ) : c.total === 0 ? (
        <EmptyState title="Nothing matches" action={<Button variant="outline" onClick={c.clear}>Clear filters</Button>} />
      ) : (
        <Card className="py-0">
          <ul className="divide-y">
            {c.pageItems.map((n) => (
              <li key={n.id} className={cn("flex items-start gap-3 px-4 py-3", !n.isRead && "bg-primary/[0.03]")}>
                <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full [&_svg]:size-4", URGENT.has(n.type) ? "bg-red-500/10 text-red-600 dark:text-red-400" : "bg-muted text-muted-foreground")}>{ICON[n.type] ?? <Bell />}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {!n.isRead ? <span className="bg-primary size-2 shrink-0 rounded-full" aria-label="Unread" /> : null}
                    {n.link ? (
                      <Link href={n.link} className={cn("hover:underline", !n.isRead && "font-semibold")} onClick={() => !n.isRead && markNotification(n.id, true)}>
                        {n.title}
                      </Link>
                    ) : (
                      <span className={cn(!n.isRead && "font-semibold")}>{n.title}</span>
                    )}
                  </div>
                  <p className="text-muted-foreground text-sm">{n.message}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">{n.when}</p>
                </div>
                <RowActions
                  extra={[{ label: n.isRead ? "Mark as unread" : "Mark as read", icon: <CheckCheck />, onSelect: () => run(() => markNotification(n.id, !n.isRead)) }]}
                  onDelete={() => deleteNotification(n.id)}
                  deleteTitle="Dismiss this notification?"
                  deleteDescription="It won't be shown again."
                />
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Pagination page={c.page} pageCount={c.pageCount} total={c.total} onPage={c.setPage} />
      <ConfirmDialog open={clearing} onOpenChange={setClearing} title="Clear all read notifications?" description="Read notifications are dismissed. Unread ones stay." confirmLabel="Clear" action={() => clearReadNotifications()} />
    </div>
  );
}
