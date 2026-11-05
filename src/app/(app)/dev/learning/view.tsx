"use client";
import * as React from "react";
import { ExternalLink, GraduationCap, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { RowActions } from "@/components/shared/row-actions";
import { ListToolbar, Pagination, useListControls } from "@/components/shared/list-controls";
import { LearningDialog } from "@/components/forms/productivity";
import { LEARNING_KIND_OPTS, LEARNING_STATUS_OPTS, labelOf } from "@/components/forms/options";
import { deleteLearning } from "@/server/actions/dev";
import { formatDay } from "@/lib/format";

type Row = { id: string; name: string; kind: string; status: string; progress: number; resourceUrl: string; targetDate: string; notes: string; updatedAt: string };
const STATUS: Record<string, "info" | "secondary" | "success" | "outline"> = { LEARNING: "info", WANT_TO_LEARN: "secondary", PAUSED: "outline", COMPLETED: "success" };
const ORDER: Record<string, number> = { LEARNING: 0, WANT_TO_LEARN: 1, PAUSED: 2, COMPLETED: 3 };

export function LearningView({ rows }: { rows: Row[] }) {
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<Row | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const c = useListControls(rows, {
    search: (r, q) => r.name.toLowerCase().includes(q) || r.notes.toLowerCase().includes(q),
    filters: [
      { key: "status", label: "Statuses", options: LEARNING_STATUS_OPTS, test: (r, v) => r.status === v },
      { key: "kind", label: "Kinds", options: LEARNING_KIND_OPTS, test: (r, v) => r.kind === v },
    ],
    sorts: [
      { key: "status", label: "Status", compare: (a, b) => ORDER[a.status] - ORDER[b.status] || b.progress - a.progress },
      { key: "target", label: "Target date", compare: (a, b) => (a.targetDate || "9999").localeCompare(b.targetDate || "9999") },
      { key: "progress", label: "Progress", compare: (a, b) => b.progress - a.progress },
      { key: "name", label: "Name", compare: (a, b) => a.name.localeCompare(b.name) },
    ],
  });
  const active = rows.filter((r) => r.status === "LEARNING");
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Learning now" value={active.length} tone="primary" />
        <StatCard label="Want to learn" value={rows.filter((r) => r.status === "WANT_TO_LEARN").length} />
        <StatCard label="Completed" value={rows.filter((r) => r.status === "COMPLETED").length} tone="positive" />
        <StatCard label="Average progress" value={`${active.length ? Math.round(active.reduce((s, r) => s + r.progress, 0) / active.length) : 0}%`} hint="Across items in progress" />
      </div>
      <div>
        <ListToolbar controls={c} placeholder="Search learning">
          <Button onClick={() => setAdding(true)}>
            <Plus /> Add item
          </Button>
        </ListToolbar>
        {rows.length === 0 ? (
          <EmptyState icon={<GraduationCap />} title="Nothing on your learning list" description="Track the languages, frameworks and courses you want to master, with progress and a target date." action={<Button onClick={() => setAdding(true)}><Plus /> Add item</Button>} />
        ) : c.total === 0 ? (
          <EmptyState title="Nothing matches" action={<Button variant="outline" onClick={c.clear}>Clear filters</Button>} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {c.pageItems.map((l) => (
              <Card key={l.id} className="gap-3 px-5 py-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{l.name}</p>
                    <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                      <Badge variant={STATUS[l.status]}>{labelOf(LEARNING_STATUS_OPTS, l.status)}</Badge>
                      {labelOf(LEARNING_KIND_OPTS, l.kind)}
                    </div>
                  </div>
                  <RowActions onEdit={() => setEditing(l)} onDelete={() => deleteLearning(l.id)} deleteTitle={`Delete "${l.name}"?`} />
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className={l.targetDate && l.targetDate < today && l.status !== "COMPLETED" ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}>{l.targetDate ? `Target ${formatDay(l.targetDate)}` : "No target date"}</span>
                    <span className="font-medium tabular-nums">{l.progress}%</span>
                  </div>
                  <Progress value={l.progress} />
                </div>
                {l.notes ? <p className="text-muted-foreground line-clamp-2 text-sm">{l.notes}</p> : null}
                {l.resourceUrl ? (
                  <a href={l.resourceUrl} target="_blank" rel="noopener noreferrer" className="text-primary inline-flex items-center gap-1 text-sm hover:underline">
                    Open resource <ExternalLink className="size-3.5" />
                  </a>
                ) : null}
              </Card>
            ))}
          </div>
        )}
        <Pagination page={c.page} pageCount={c.pageCount} total={c.total} onPage={c.setPage} />
      </div>
      <LearningDialog open={adding} onOpenChange={setAdding} />
      <LearningDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} initial={editing ?? undefined} />
    </div>
  );
}
