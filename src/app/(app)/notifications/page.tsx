import type { Metadata } from "next";
import { requireUserPage } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { NotificationsView } from "./view";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUserPage();
  const items = await prisma.notification.findMany({ where: { userId: user.id, dismissed: false }, orderBy: { createdAt: "desc" }, take: 500 });
  return (
    <div>
      <PageHeader title="Notifications" description="In-app reminders for bills, loans, budgets, subscriptions, tasks, events and project deadlines." />
      <NotificationsView
        reminderDays={{ bills: user.prefs.billReminderDays, loans: user.prefs.loanReminderDays }}
        rows={items.map((n) => ({ id: n.id, type: n.type, title: n.title, message: n.message, link: n.link ?? "", isRead: n.isRead, when: formatDateTime(n.createdAt, user.prefs.timezone), createdAt: n.createdAt.toISOString() }))}
      />
    </div>
  );
}
