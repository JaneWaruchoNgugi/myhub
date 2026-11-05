"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import type { DatesSetArg, EventClickArg, EventDropArg, EventInput } from "@fullcalendar/core";
import type { DateClickArg, EventResizeDoneArg } from "@fullcalendar/interaction";
import { CalendarPlus, ListPlus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { TaskDialog, EventDialog } from "@/components/forms/productivity";
import { moveCalendarItem } from "@/server/actions/planner";
import { cn } from "@/lib/utils";

type Item = { id: string; kind: string; refId: string; title: string; start: string; end?: string; allDay: boolean; editable: boolean; category: string; url?: string; done?: boolean; overdue?: boolean; raw?: Record<string, unknown> };

const KINDS = [
  { key: "task", label: "Tasks", color: "#8b5cf6" },
  { key: "event", label: "Appointments & events", color: "#6366f1" },
  { key: "bill", label: "Bills", color: "#f97316" },
  { key: "loan", label: "Loan repayments", color: "#ef4444" },
  { key: "subscription", label: "Renewals", color: "#0ea5e9" },
  { key: "project", label: "Project deadlines", color: "#0f172a" },
  { key: "devtask", label: "Dev tasks", color: "#14b8a6" },
] as const;
const COLOR = Object.fromEntries(KINDS.map((k) => [k.key, k.color]));

export function CalendarView({ weekStartsOn }: { weekStartsOn: number }) {
  const router = useRouter();
  const calRef = React.useRef<FullCalendar>(null);
  const [range, setRange] = React.useState<{ start: string; end: string } | null>(null);
  const [items, setItems] = React.useState<Item[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [q, setQ] = React.useState("");
  const [hidden, setHidden] = React.useState<Set<string>>(new Set());
  const [newTask, setNewTask] = React.useState<string | null>(null);
  const [newEvent, setNewEvent] = React.useState<string | null>(null);
  const [editTask, setEditTask] = React.useState<Record<string, unknown> | null>(null);
  const [editEvent, setEditEvent] = React.useState<Record<string, unknown> | null>(null);
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const m = window.matchMedia("(max-width: 640px)");
    setIsMobile(m.matches);
    const fn = () => setIsMobile(m.matches);
    m.addEventListener("change", fn);
    return () => m.removeEventListener("change", fn);
  }, []);

  const load = React.useCallback(async (r: { start: string; end: string }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/calendar?start=${encodeURIComponent(r.start)}&end=${encodeURIComponent(r.end)}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      setItems(await res.json());
    } catch {
      setError("Couldn't load the calendar. Try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (range) load(range);
  }, [range, load]);

  const refresh = () => {
    router.refresh();
    if (range) load(range);
  };

  const events: EventInput[] = items
    .filter((i) => !hidden.has(i.kind) && (!q || i.title.toLowerCase().includes(q.toLowerCase())))
    .map((i) => ({
      id: i.id,
      title: i.title,
      start: i.start,
      end: i.end,
      allDay: i.allDay,
      editable: i.editable,
      durationEditable: i.editable && (i.kind === "event" || i.kind === "task"),
      backgroundColor: i.done ? "#94a3b8" : COLOR[i.kind],
      borderColor: i.overdue ? "#dc2626" : "transparent",
      textColor: "#fff",
      classNames: cn(i.done && "line-through opacity-70", i.overdue && "ring-2 ring-red-500"),
      extendedProps: i,
    }));

  const onMove = async (arg: EventDropArg | EventResizeDoneArg) => {
    const it = arg.event.extendedProps as Item;
    const r = await moveCalendarItem({ kind: it.kind, id: it.refId, start: arg.event.start!.toISOString(), end: arg.event.end?.toISOString() ?? null, allDay: arg.event.allDay });
    if (!r.ok) {
      toast.error(r.error);
      arg.revert();
    } else {
      toast.success("Rescheduled");
      refresh();
    }
  };

  const onClick = (arg: EventClickArg) => {
    arg.jsEvent.preventDefault();
    const it = arg.event.extendedProps as Item;
    if (it.kind === "task") setEditTask(it.raw ?? null);
    else if (it.kind === "event") setEditEvent(it.raw ?? null);
    else if (it.url) router.push(it.url);
  };

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <Card className="order-2 h-fit lg:order-1 lg:w-64 lg:shrink-0">
        <CardContent className="flex flex-col gap-4">
          <div className="flex gap-2 lg:flex-col">
            <Button className="flex-1" onClick={() => setNewEvent("")}>
              <CalendarPlus /> New event
            </Button>
            <Button className="flex-1" variant="outline" onClick={() => setNewTask("")}>
              <ListPlus /> New task
            </Button>
          </div>
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search events" className="pl-9" aria-label="Search events" />
          </div>
          <div>
            <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">Show</p>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
              {KINDS.map((k) => (
                <label key={k.key} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={!hidden.has(k.key)}
                    onCheckedChange={(c) =>
                      setHidden((h) => {
                        const n = new Set(h);
                        if (c) n.delete(k.key);
                        else n.add(k.key);
                        return n;
                      })
                    }
                  />
                  <span className="size-2.5 rounded-sm" style={{ background: k.color }} />
                  {k.label}
                </label>
              ))}
            </div>
          </div>
          <p className="text-muted-foreground text-xs">Drag tasks, events, bills and dev deadlines to reschedule. Click money items to open them. Overdue items have a red outline.</p>
        </CardContent>
      </Card>
      <Card className="order-1 min-w-0 flex-1 p-3 sm:p-4 lg:order-2">
        {error ? <p className="text-destructive mb-2 text-sm">{error}</p> : null}
        <div className={cn("transition-opacity", loading && "opacity-60")}>
          <FullCalendar
            ref={calRef}
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
            initialView={isMobile ? "listWeek" : "dayGridMonth"}
            headerToolbar={isMobile ? { left: "prev,next", center: "title", right: "today" } : { left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek" }}
            footerToolbar={isMobile ? { center: "dayGridMonth,timeGridDay,listWeek" } : undefined}
            buttonText={{ today: "Today", month: "Month", week: "Week", day: "Day", list: "Agenda" }}
            timeZone="UTC"
            firstDay={weekStartsOn}
            height="auto"
            nowIndicator
            dayMaxEvents={3}
            editable
            selectable={false}
            events={events}
            datesSet={(a: DatesSetArg) => setRange((r) => (r?.start === a.startStr && r?.end === a.endStr ? r : { start: a.startStr, end: a.endStr }))}
            eventDrop={onMove}
            eventResize={onMove}
            eventClick={onClick}
            dateClick={(a: DateClickArg) => setNewEvent(a.allDay ? a.dateStr.slice(0, 10) : a.dateStr.slice(0, 16))}
            noEventsContent="Nothing scheduled in this period."
          />
        </div>
      </Card>

      <TaskDialog open={newTask !== null} onOpenChange={(o) => !o && setNewTask(null)} onSuccess={refresh} initial={newTask ? { dueDate: newTask } : undefined} />
      <EventDialog
        open={newEvent !== null}
        onOpenChange={(o) => !o && setNewEvent(null)}
        onSuccess={refresh}
        initial={newEvent ? (newEvent.length === 10 ? { allDay: false, start: `${newEvent}T09:00`, end: `${newEvent}T10:00` } : { allDay: false, start: newEvent, end: `${newEvent.slice(0, 11)}${String(Math.min(23, Number(newEvent.slice(11, 13)) + 1)).padStart(2, "0")}:${newEvent.slice(14, 16)}` }) : undefined}
      />
      <TaskDialog open={!!editTask} onOpenChange={(o) => !o && setEditTask(null)} onSuccess={refresh} initial={(editTask as Record<string, unknown> & { id?: string }) ?? undefined} />
      <EventDialog open={!!editEvent} onOpenChange={(o) => !o && setEditEvent(null)} onSuccess={refresh} initial={(editEvent as Record<string, unknown> & { id?: string }) ?? undefined} />
    </div>
  );
}
