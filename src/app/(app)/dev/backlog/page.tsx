import type { Metadata } from "next";
import { requireUserPage } from "@/lib/session";
import { PageHeader } from "@/components/shared/page-header";
import { devTasks, projectOptions } from "../data";
import { BacklogView } from "./view";

export const metadata: Metadata = { title: "Backlog" };

export default async function BacklogPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const user = await requireUserPage();
  const { project } = await searchParams;
  const [rows, projects] = await Promise.all([devTasks(user.id), projectOptions(user.id)]);
  return (
    <div>
      <PageHeader title="Backlog" description="Ideas, features, bugs, improvements, technical debt and research, across all your projects." />
      <BacklogView rows={rows} projects={projects} initialProject={project && projects.some((p) => p.value === project) ? project : undefined} />
    </div>
  );
}
