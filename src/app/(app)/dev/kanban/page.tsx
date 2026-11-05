import type { Metadata } from "next";
import { requireUserPage } from "@/lib/session";
import { PageHeader } from "@/components/shared/page-header";
import { devTasks, projectOptions } from "../data";
import { KanbanView } from "./view";

export const metadata: Metadata = { title: "Kanban" };

export default async function KanbanPage() {
  const user = await requireUserPage();
  const [rows, projects] = await Promise.all([devTasks(user.id), projectOptions(user.id)]);
  return (
    <div>
      <PageHeader title="Kanban" description="Drag cards between columns to move work along. Order within a column is saved." />
      <KanbanView rows={rows} projects={projects} />
    </div>
  );
}
