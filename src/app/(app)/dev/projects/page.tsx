import type { Metadata } from "next";
import { requireUserPage } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { diffDays, todayIn } from "@/lib/dates";
import { PageHeader } from "@/components/shared/page-header";
import { dayStr } from "../data";
import { ProjectsView } from "./view";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const user = await requireUserPage();
  const today = todayIn(user.prefs.timezone);
  const projects = await prisma.devProject.findMany({ where: { userId: user.id }, include: { tasks: { select: { status: true } } }, orderBy: [{ updatedAt: "desc" }] });
  return (
    <div>
      <PageHeader title="Projects" description="Software projects with their stack, links, deadlines and how much of the backlog is done." />
      <ProjectsView
        rows={projects.map((p) => {
          const total = p.tasks.length;
          const done = p.tasks.filter((t) => t.status === "COMPLETED").length;
          return {
            id: p.id,
            name: p.name,
            description: p.description ?? "",
            status: p.status,
            startDate: dayStr(p.startDate),
            deadline: dayStr(p.deadline),
            daysLeft: p.deadline ? diffDays(p.deadline, today) : null,
            techStack: p.techStack.join(", "),
            stack: p.techStack,
            repoUrl: p.repoUrl ?? "",
            liveUrl: p.liveUrl ?? "",
            notes: p.notes ?? "",
            total,
            done,
            open: p.tasks.filter((t) => t.status !== "COMPLETED" && t.status !== "IDEAS").length,
            progress: total ? Math.round((done / total) * 100) : 0,
            updatedAt: p.updatedAt.toISOString(),
          };
        })}
      />
    </div>
  );
}
