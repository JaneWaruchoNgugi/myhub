"use client";
import * as React from "react";
import Link from "next/link";
import { Bug, Columns3, Lightbulb, ListTodo, Plus, Sparkles, Wrench, FlaskConical, Hammer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { RowActions } from "@/components/shared/row-actions";
import { ListToolbar, Pagination, useListControls } from "@/components/shared/list-controls";
import type { Option } from "@/components/shared/entity-form";
import { DevTaskDialog } from "@/components/forms/productivity";
import { DEV_TASK_STATUS_OPTS, DEV_TASK_TYPE_OPTS, PRIORITY_OPTS, labelOf } from "@/components/forms/options";
import { deleteDevTask } from "@/server/actions/dev";
import { formatDay } from "@/lib/format";
import { cn } from "@/lib/utils";

export type DevTask = { id: string; title: string; description: string; type: string; status: string; priority: string; projectId: string; projectName: string; dueDate: string; position: number; createdAt: string };

export const TYPE_ICON: Record<string, React.ReactNode> = { IDEA: <Lightbulb />, FEATURE: <Sparkles />, BUG: <Bug />, IMPROVEMENT: <Wrench />, TECH_DEBT: <Hammer />, RESEARCH: <FlaskConical /> };
export const PRIORITY_BADGE: Record<string, "danger" | "warning" | "secondary" | "outline"> = { URGENT: "danger", HIGH: "warning", MEDIUM: "secondary", LOW: "outline" };
const RANK: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const STATUS_RANK = Object.fromEntries(DEV_TASK_STATUS_OPTS.map((o, i) => [o.value, i]));

export function BacklogView({ rows, projects, initialProject }: { rows: DevTask[]; projects: Option[]; initialProject?: string }) {
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<DevTask | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const c = useListControls(rows, {
    search: (r, q) => r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) || r.projectName.toLowerCase().includes(q),
    filters: [
      { key: "project", label: "Projects", options: [{ value: "none", label: "No project" }, ...projects], test: (r, v) => (v === "none" ? !r.projectId : r.projectId === v) },
      { key: "status", label: "Statuses", options: [{ value: "open", label: "Open (not completed)" }, ...DEV_TASK_STATUS_OPTS], test: (r, v) => (v === "open" ? r.status !== "COMPLETED" : r.status === v) },
      { key: "type", label: "Types", options: DEV_TASK_TYPE_OPTS, test: (r, v) => r.type === v },
      { key: "priority", label: "Priorities", options: PRIORITY_OPTS, test: (r, v) => r.priority === v },
    ],
    sorts: [
      { key: "priority", label: "Priority", compare: (a, b) => RANK[a.priority] - RANK[b.priority] || STATUS_RANK[a.status] - STATUS_RANK[b.status] },
      { key: "status", label: "Status", compare: (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.position - b.position },
      { key: "due", label: "Due date", compare: (a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999") },
      { key: "new", label: "Newest", compare: (a, b) => b.createdAt.localeCompare(a.createdAt) },
    ],
    initialFilters: { status: "open", ...(initialProject ? { project: initialProject } : {}) },
    pageSize: 25,
  });
  return (
    <div>
      <ListToolbar controls={c} placeholder="Search backlog">
        <Button variant="outline" asChild>
          <Link href="/dev/kanban">
            <Columns3 /> Board
          </Link>
        </Button>
        <Button onClick={() => setAdding(true)}>
          <Plus /> Add item
        </Button>
      </ListToolbar>
      {rows.length === 0 ? (
        <EmptyState icon={<ListTodo />} title="Your backlog is empty" description="Capture ideas, features and bugs here, then pull them across the kanban board." action={<Button onClick={() => setAdding(true)}><Plus /> Add item</Button>} />
      ) : c.total === 0 ? (
        <EmptyState title="No items match your filters" action={<Button variant="outline" onClick={c.clear}>Clear filters</Button>} />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="hidden md:table-cell">Project</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Due</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {c.pageItems.map((t) => (
                <TableRow key={t.id} className={cn(t.status === "COMPLETED" && "opacity-60")}>
                  <TableCell className="whitespace-normal">
                    <button type="button" className="flex items-start gap-2 text-left" onClick={() => setEditing(t)}>
                      <span className="text-muted-foreground mt-0.5 [&_svg]:size-4" title={labelOf(DEV_TASK_TYPE_OPTS, t.type)}>
                        {TYPE_ICON[t.type]}
                      </span>
                      <span>
                        <span className={cn("font-medium", t.status === "COMPLETED" && "line-through")}>{t.title}</span>
                        <span className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
                          <Badge variant={PRIORITY_BADGE[t.priority]}>{t.priority.toLowerCase()}</Badge>
                          {labelOf(DEV_TASK_TYPE_OPTS, t.type)}
                          <span className="md:hidden">{t.projectName ? `· ${t.projectName}` : ""}</span>
                        </span>
                      </span>
                    </button>
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden md:table-cell">{t.projectName || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={t.status === "COMPLETED" ? "success" : t.status === "IN_PROGRESS" || t.status === "TESTING" ? "info" : "secondary"}>{labelOf(DEV_TASK_STATUS_OPTS, t.status)}</Badge>
                  </TableCell>
                  <TableCell className={cn("hidden text-sm sm:table-cell", t.dueDate && t.dueDate < today && t.status !== "COMPLETED" ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>{t.dueDate ? formatDay(t.dueDate) : "—"}</TableCell>
                  <TableCell>
                    <RowActions onEdit={() => setEditing(t)} onDelete={() => deleteDevTask(t.id)} deleteTitle={`Delete "${t.title}"?`} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <Pagination page={c.page} pageCount={c.pageCount} total={c.total} onPage={c.setPage} />
      <DevTaskDialog open={adding} onOpenChange={setAdding} projects={projects} initial={c.filters.project && c.filters.project !== "none" && c.filters.project !== "__all__" ? { projectId: c.filters.project } : undefined} />
      <DevTaskDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} projects={projects} initial={editing ?? undefined} />
    </div>
  );
}
