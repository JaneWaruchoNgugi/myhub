"use client";
import * as React from "react";
import Link from "next/link";
import { ExternalLink, FolderKanban, GitBranch, ListTodo, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/shared/empty-state";
import { RowActions } from "@/components/shared/row-actions";
import { ListToolbar, Pagination, useListControls } from "@/components/shared/list-controls";
import { ProjectDialog } from "@/components/forms/productivity";
import { PROJECT_STATUS_OPTS, labelOf } from "@/components/forms/options";
import { deleteProject } from "@/server/actions/dev";
import { formatDay } from "@/lib/format";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  name: string;
  description: string;
  status: string;
  startDate: string;
  deadline: string;
  daysLeft: number | null;
  techStack: string;
  stack: string[];
  repoUrl: string;
  liveUrl: string;
  notes: string;
  total: number;
  done: number;
  open: number;
  progress: number;
  updatedAt: string;
};

const STATUS: Record<string, "success" | "info" | "warning" | "secondary" | "outline"> = { ACTIVE: "info", PLANNING: "secondary", ON_HOLD: "warning", COMPLETED: "success", ARCHIVED: "outline" };

export function ProjectsView({ rows }: { rows: Row[] }) {
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<Row | null>(null);
  const c = useListControls(rows, {
    search: (r, q) => r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) || r.techStack.toLowerCase().includes(q),
    filters: [{ key: "status", label: "Statuses", options: PROJECT_STATUS_OPTS, test: (r, v) => r.status === v }],
    sorts: [
      { key: "updated", label: "Recently updated", compare: (a, b) => b.updatedAt.localeCompare(a.updatedAt) },
      { key: "deadline", label: "Deadline", compare: (a, b) => (a.deadline || "9999").localeCompare(b.deadline || "9999") },
      { key: "progress", label: "Progress", compare: (a, b) => b.progress - a.progress },
      { key: "name", label: "Name", compare: (a, b) => a.name.localeCompare(b.name) },
    ],
    pageSize: 12,
  });
  return (
    <div>
      <ListToolbar controls={c} placeholder="Search projects or tech">
        <Button onClick={() => setAdding(true)}>
          <Plus /> New project
        </Button>
      </ListToolbar>
      {rows.length === 0 ? (
        <EmptyState icon={<FolderKanban />} title="No projects yet" description="Track side projects, client work and SaaS ideas, then break them down in the backlog and kanban board." action={<Button onClick={() => setAdding(true)}><Plus /> New project</Button>} />
      ) : c.total === 0 ? (
        <EmptyState title="No projects match" action={<Button variant="outline" onClick={c.clear}>Clear filters</Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {c.pageItems.map((p) => (
            <Card key={p.id} className={cn("gap-4", p.status === "ARCHIVED" && "opacity-70")}>
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="truncate text-base">{p.name}</CardTitle>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge variant={STATUS[p.status]}>{labelOf(PROJECT_STATUS_OPTS, p.status)}</Badge>
                    {p.deadline && p.status !== "COMPLETED" && p.status !== "ARCHIVED" ? (
                      <span className={cn("text-xs", p.daysLeft !== null && p.daysLeft < 0 ? "text-red-600 dark:text-red-400" : p.daysLeft !== null && p.daysLeft <= 7 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
                        {p.daysLeft !== null && p.daysLeft < 0 ? `${-p.daysLeft}d past deadline` : `Due ${formatDay(p.deadline)}`}
                      </span>
                    ) : null}
                  </div>
                </div>
                <RowActions onEdit={() => setEditing(p)} onDelete={() => deleteProject(p.id)} deleteTitle={`Delete ${p.name}?`} deleteDescription="Backlog items are kept but no longer linked to a project." />
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                {p.description ? <p className="text-muted-foreground line-clamp-2 text-sm">{p.description}</p> : null}
                {p.stack.length ? (
                  <div className="flex flex-wrap gap-1">
                    {p.stack.map((s) => (
                      <Badge key={s} variant="outline" className="font-normal">
                        {s}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                <div className="mt-auto">
                  <div className="mb-1.5 flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      {p.done} of {p.total} items done
                    </span>
                    <span className="font-medium tabular-nums">{p.progress}%</span>
                  </div>
                  <Progress value={p.progress} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/dev/backlog?project=${p.id}`}>
                      <ListTodo /> Backlog ({p.open})
                    </Link>
                  </Button>
                  {p.repoUrl ? (
                    <Button asChild size="sm" variant="ghost">
                      <a href={p.repoUrl} target="_blank" rel="noopener noreferrer">
                        <GitBranch /> Repo
                      </a>
                    </Button>
                  ) : null}
                  {p.liveUrl ? (
                    <Button asChild size="sm" variant="ghost">
                      <a href={p.liveUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink /> Live
                      </a>
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Pagination page={c.page} pageCount={c.pageCount} total={c.total} onPage={c.setPage} />
      <ProjectDialog open={adding} onOpenChange={setAdding} />
      <ProjectDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} initial={editing ?? undefined} />
    </div>
  );
}
