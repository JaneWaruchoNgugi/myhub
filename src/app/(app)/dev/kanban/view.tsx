"use client";
import * as React from "react";
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, closestCorners, useDroppable, useSensor, useSensors, type DragEndEvent, type DragOverEvent, type DragStartEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Option } from "@/components/shared/entity-form";
import { DevTaskDialog } from "@/components/forms/productivity";
import { DEV_TASK_STATUS_OPTS, DEV_TASK_TYPE_OPTS, labelOf } from "@/components/forms/options";
import { moveDevTask } from "@/server/actions/dev";
import { formatDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PRIORITY_BADGE, TYPE_ICON, type DevTask } from "../backlog/view";

type Columns = Record<string, string[]>;
const ALL = "__all__";

function group(rows: DevTask[]): Columns {
  const cols: Columns = Object.fromEntries(DEV_TASK_STATUS_OPTS.map((o) => [o.value, [] as string[]]));
  for (const r of [...rows].sort((a, b) => a.position - b.position)) cols[r.status]?.push(r.id);
  return cols;
}

export function KanbanView({ rows, projects }: { rows: DevTask[]; projects: Option[] }) {
  const byId = React.useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const [cols, setCols] = React.useState<Columns>(() => group(rows));
  const [active, setActive] = React.useState<string | null>(null);
  const [project, setProject] = React.useState(ALL);
  const [adding, setAdding] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<DevTask | null>(null);
  const startCol = React.useRef<string | null>(null);

  React.useEffect(() => setCols(group(rows)), [rows]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const visible = (id: string) => project === ALL || (project === "none" ? !byId.get(id)?.projectId : byId.get(id)?.projectId === project);
  const colOf = (id: string) => (id in cols ? id : Object.keys(cols).find((k) => cols[k].includes(id)));

  function onStart(e: DragStartEvent) {
    setActive(String(e.active.id));
    startCol.current = colOf(String(e.active.id)) ?? null;
  }

  function onOver(e: DragOverEvent) {
    const a = String(e.active.id);
    const o = e.over ? String(e.over.id) : null;
    if (!o) return;
    const from = colOf(a);
    const to = colOf(o);
    if (!from || !to || from === to) return;
    setCols((c) => {
      const target = c[to];
      const idx = o in c ? target.length : Math.max(0, target.indexOf(o));
      return { ...c, [from]: c[from].filter((x) => x !== a), [to]: [...target.slice(0, idx), a, ...target.slice(idx)] };
    });
  }

  async function onEnd(e: DragEndEvent) {
    const a = String(e.active.id);
    setActive(null);
    const o = e.over ? String(e.over.id) : null;
    const col = colOf(a);
    if (!o || !col) return setCols(group(rows));
    let ordered = cols[col];
    const oi = ordered.indexOf(o);
    const ai = ordered.indexOf(a);
    if (oi >= 0 && ai >= 0 && oi !== ai) ordered = arrayMove(ordered, ai, oi);
    if (col === startCol.current && ordered.join() === group(rows)[col].join()) return;
    setCols((c) => ({ ...c, [col]: ordered }));
    const r = await moveDevTask({ id: a, status: col, orderedIds: ordered });
    if (!r.ok) {
      toast.error(r.error);
      setCols(group(rows));
    }
  }

  const activeTask = active ? byId.get(active) : null;
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={project} onValueChange={setProject}>
          <SelectTrigger className="bg-card h-9 w-auto min-w-[180px]" aria-label="Project">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All projects</SelectItem>
            <SelectItem value="none">No project</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground hidden text-xs sm:block">Tip: on touch screens, press and hold a card to drag it. With a keyboard, focus a card and press Space.</p>
        <Button className="ml-auto" onClick={() => setAdding("BACKLOG")}>
          <Plus /> Add item
        </Button>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onStart} onDragOver={onOver} onDragEnd={onEnd} onDragCancel={() => (setActive(null), setCols(group(rows)))}>
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
          {DEV_TASK_STATUS_OPTS.map((col) => {
            const ids = cols[col.value].filter(visible);
            return (
              <Column key={col.value} id={col.value} title={col.label} count={ids.length} onAdd={() => setAdding(col.value)}>
                <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                  {ids.map((id) => {
                    const t = byId.get(id);
                    return t ? <SortableCard key={id} task={t} onOpen={() => setEditing(t)} /> : null;
                  })}
                </SortableContext>
              </Column>
            );
          })}
        </div>
        <DragOverlay>{activeTask ? <CardBody task={activeTask} className="rotate-2 shadow-lg" /> : null}</DragOverlay>
      </DndContext>
      <DevTaskDialog open={!!adding} onOpenChange={(o) => !o && setAdding(null)} projects={projects} initial={adding ? { status: adding, ...(project !== ALL && project !== "none" ? { projectId: project } : {}) } : undefined} />
      <DevTaskDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} projects={projects} initial={editing ?? undefined} />
    </div>
  );
}

function Column({ id, title, count, onAdd, children }: { id: string; title: string; count: number; onAdd: () => void; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section className="bg-muted/50 flex w-72 shrink-0 snap-start flex-col rounded-xl border">
      <header className="flex items-center justify-between px-3 py-2.5">
        <h2 className="text-sm font-semibold">
          {title} <span className="text-muted-foreground ml-1 font-normal tabular-nums">{count}</span>
        </h2>
        <Button size="icon-sm" variant="ghost" onClick={onAdd} aria-label={`Add to ${title}`}>
          <Plus />
        </Button>
      </header>
      <div ref={setNodeRef} className={cn("flex min-h-24 flex-1 flex-col gap-2 rounded-b-xl p-2 transition-colors", isOver && "bg-primary/5")}>
        {children}
        {count === 0 ? <p className="text-muted-foreground py-6 text-center text-xs">Drop cards here</p> : null}
      </div>
    </section>
  );
}

function SortableCard({ task, onOpen }: { task: DevTask; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} {...attributes} {...listeners} className={cn("touch-manipulation", isDragging && "opacity-40")}>
      <CardBody task={task} onOpen={onOpen} />
    </div>
  );
}

function CardBody({ task, onOpen, className }: { task: DevTask; onOpen?: () => void; className?: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const late = task.dueDate && task.dueDate < today && task.status !== "COMPLETED";
  return (
    <div
      className={cn("bg-card cursor-grab rounded-lg border p-3 text-sm shadow-xs active:cursor-grabbing", className)}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" && onOpen) onOpen();
      }}
    >
      <div className="flex items-start gap-2">
        <span className="text-muted-foreground mt-0.5 [&_svg]:size-3.5" title={labelOf(DEV_TASK_TYPE_OPTS, task.type)}>
          {TYPE_ICON[task.type]}
        </span>
        <p className="flex-1 leading-snug font-medium">{task.title}</p>
      </div>
      <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-1.5 text-xs">
        <Badge variant={PRIORITY_BADGE[task.priority]}>{task.priority.toLowerCase()}</Badge>
        {task.projectName ? <span className="truncate">{task.projectName}</span> : null}
        {task.dueDate ? <span className={cn("ml-auto", late && "text-red-600 dark:text-red-400")}>{formatDay(task.dueDate, "short")}</span> : null}
      </div>
    </div>
  );
}
