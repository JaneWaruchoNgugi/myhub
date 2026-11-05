import type { Metadata } from "next";
import { requireUserPage } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { dayStr } from "../data";
import { LearningView } from "./view";

export const metadata: Metadata = { title: "Learning" };

export default async function LearningPage() {
  const user = await requireUserPage();
  const rows = await prisma.learningGoal.findMany({ where: { userId: user.id }, orderBy: [{ status: "asc" }, { updatedAt: "desc" }] });
  return (
    <div>
      <PageHeader title="Learning" description="Languages, frameworks, courses and skills you're working on, with progress and target dates." />
      <LearningView rows={rows.map((l) => ({ id: l.id, name: l.name, kind: l.kind, status: l.status, progress: l.progress, resourceUrl: l.resourceUrl ?? "", targetDate: dayStr(l.targetDate), notes: l.notes ?? "", updatedAt: l.updatedAt.toISOString() }))} />
    </div>
  );
}
