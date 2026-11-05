"use client";
import * as React from "react";
import { Plus, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/shared/empty-state";
import { RowActions } from "@/components/shared/row-actions";
import { ListToolbar, Pagination, useListControls } from "@/components/shared/list-controls";
import { DevGoalDialog } from "@/components/forms/productivity";
import { DEV_GOAL_TYPE_OPTS, GOAL_STATUS_OPTS, labelOf } from "@/components/forms/options";
import { deleteDevGoal } from "@/server/actions/dev";
import { formatDay } from "@/lib/format";
import { cn } from "@/lib/utils";

type Row = { id: string; title: string; description: string; type: string; status: string; progress: number; targetDate: string; updatedAt: string };
const STATUS: Record<string, "info" | "secondary" | "success" | "outline"> = { ACTIVE: "info", PAUSED: "secondary", COMPLETED: "success", CANCELLED: "outline" };
const ORDER: Record<string, number> = { ACTIVE: 0, PAUSED: 1, COMPLETED: 2, CANCELLED: 3 };

export function DevGoalsView({ rows }: { rows: Row[] }) {
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<Row | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const c = useListControls(rows, {
    search: (r, q) => r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q),
    filters: [
      { key: "status", label: "Statuses", options: GOAL_STATUS_OPTS, test: (r, v) => r.status === v },
      { key: "type", label: "Types", options: DEV_GOAL_TYPE_OPTS, test: (r, v) => r.type === v },
    ],
    sorts: [
      { key: "status", label: "Status", compare: (a, b) => ORDER[a.status] - ORDER[b.status] || (a.targetDate || "9999").localeCompare(b.targetDate || "9999") },
      { key: "target", label: "Target date", compare: (a, b) => (a.targetDate || "9999").localeCompare(b.targetDate || "9999") },
      { key: "progress", label: "Progress", compare: (a, b) => b.progress - a.progress },
    ],
  });
  return (
    <div>
      <ListToolbar controls={c} placeholder="Search goals">
        <Button onClick={() => setAdding(true)}>
          <Plus /> New goal
        </Button>
      </ListToolbar>
      {rows.length === 0 ? (
        <EmptyState icon={<Target />} title="No developer goals yet" description="Set a goal like “Ship my first SaaS by June” and track progress towards it." action={<Button onClick={() => setAdding(true)}><Plus /> New goal</Button>} />
      ) : c.total === 0 ? (
        <EmptyState title="No goals match" action={<Button variant="outline" onClick={c.clear}>Clear filters</Button>} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {c.pageItems.map((g) => {
            const late = g.targetDate && g.targetDate < today && g.status === "ACTIVE";
            return (
              <Card key={g.id} className={cn("gap-3 px-5 py-4", (g.status === "CANCELLED" || g.status === "COMPLETED") && "opacity-75")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{g.title}</p>
                    <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                      <Badge variant={STATUS[g.status]}>{labelOf(GOAL_STATUS_OPTS, g.status)}</Badge>
                      {labelOf(DEV_GOAL_TYPE_OPTS, g.type)}
                    </div>
                  </div>
                  <RowActions onEdit={() => setEditing(g)} onDelete={() => deleteDevGoal(g.id)} deleteTitle={`Delete "${g.title}"?`} />
                </div>
                {g.description ? <p className="text-muted-foreground text-sm">{g.description}</p> : null}
                <div>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className={late ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}>{g.targetDate ? `${late ? "Was due" : "Target"} ${formatDay(g.targetDate)}` : "No target date"}</span>
                    <span className="font-medium tabular-nums">{g.progress}%</span>
                  </div>
                  <Progress value={g.progress} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <Pagination page={c.page} pageCount={c.pageCount} total={c.total} onPage={c.setPage} />
      <DevGoalDialog open={adding} onOpenChange={setAdding} />
      <DevGoalDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} initial={editing ?? undefined} />
    </div>
  );
}
