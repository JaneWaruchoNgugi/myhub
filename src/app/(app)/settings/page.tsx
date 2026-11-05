import type { Metadata } from "next";
import { requireUserPage } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsView } from "./view";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUserPage();
  const [cats, usage, logs, u] = await Promise.all([
    prisma.transactionCategory.findMany({ where: { userId: user.id }, orderBy: [{ type: "asc" }, { name: "asc" }] }),
    prisma.transaction.groupBy({ by: ["categoryId"], where: { userId: user.id }, _count: { _all: true } }),
    prisma.auditLog.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 300 }),
    prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { createdAt: true } }),
  ]);
  const used = new Map(usage.map((x) => [x.categoryId, x._count._all]));
  return (
    <div>
      <PageHeader title="Settings" description="Your profile, password, regional preferences, reminder timing, categories and activity log." />
      <SettingsView
        profile={{ name: user.name ?? "", email: user.email, isDemo: user.isDemo, since: formatDateTime(u.createdAt, user.prefs.timezone, false) }}
        prefs={user.prefs}
        categories={cats.map((c) => ({ id: c.id, name: c.name, type: c.type, color: c.color, isSystem: c.isSystem, count: used.get(c.id) ?? 0 }))}
        logs={logs.map((l) => ({ id: l.id, action: l.action, entity: l.entity, entityId: l.entityId ?? "", details: l.details ? JSON.stringify(l.details) : "", when: formatDateTime(l.createdAt, user.prefs.timezone), at: l.createdAt.toISOString() }))}
        cron={!!process.env.CRON_SECRET}
      />
    </div>
  );
}
