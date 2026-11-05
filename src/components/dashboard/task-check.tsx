"use client";
import { Checkbox } from "@/components/ui/checkbox";
import { toggleTask } from "@/server/actions/planner";
import { useRun } from "@/components/shared/use-run";

export function TaskCheck({ id, done, label }: { id: string; done: boolean; label: string }) {
  const { pending, run } = useRun();
  return <Checkbox checked={done} disabled={pending} aria-label={`Mark "${label}" ${done ? "not done" : "done"}`} onCheckedChange={(c) => run(() => toggleTask(id, c === true))} />;
}
