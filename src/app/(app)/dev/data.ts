import "server-only";
import { prisma } from "@/lib/prisma";

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export type DevTaskRow = Awaited<ReturnType<typeof devTasks>>[number];

export async function devTasks(userId: string) {
  const rows = await prisma.devTask.findMany({ where: { userId }, include: { project: { select: { name: true } } }, orderBy: [{ status: "asc" }, { position: "asc" }, { createdAt: "asc" }] });
  return rows.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description ?? "",
    type: t.type,
    status: t.status,
    priority: t.priority,
    projectId: t.projectId ?? "",
    projectName: t.project?.name ?? "",
    dueDate: day(t.dueDate),
    position: t.position,
    createdAt: t.createdAt.toISOString(),
  }));
}

export async function projectOptions(userId: string) {
  const ps = await prisma.devProject.findMany({ where: { userId }, select: { id: true, name: true, status: true }, orderBy: { name: "asc" } });
  return ps.map((p) => ({ value: p.id, label: p.status === "ARCHIVED" ? `${p.name} (archived)` : p.name }));
}

export const dayStr = day;
