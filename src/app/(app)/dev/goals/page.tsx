import type { Metadata } from "next";
import { requireUserPage } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { dayStr } from "../data";
import { DevGoalsView } from "./view";

export const metadata: Metadata = { title: "Developer goals" };

export default async function DevGoalsPage() {
  const user = await requireUserPage();
  const rows = await prisma.devGoal.findMany({ where: { userId: user.id }, orderBy: [{ status: "asc" }, { targetDate: { sort: "asc", nulls: "last" } }] });
  return (
    <div>
      <PageHeader title="Developer goals" description="Bigger ambitions: ship a SaaS, learn a framework, contribute to open source, deploy a project." />
      <DevGoalsView rows={rows.map((g) => ({ id: g.id, title: g.title, description: g.description ?? "", type: g.type, status: g.status, progress: g.progress, targetDate: dayStr(g.targetDate), updatedAt: g.updatedAt.toISOString() }))} />
    </div>
  );
}
