"use client";
import { useTransition } from "react";
import { toast } from "sonner";

type Result = { ok: true; message?: string; data?: unknown } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/** Runs a server action with pending state and toast feedback. */
export function useRun() {
  const [pending, startTransition] = useTransition();
  function run<R extends Result>(fn: () => Promise<R>, opts?: { success?: string; onSuccess?: (r: R) => void }) {
    startTransition(async () => {
      try {
        const r = await fn();
        if (r.ok) {
          toast.success(r.message ?? opts?.success ?? "Saved");
          opts?.onSuccess?.(r);
        } else toast.error(r.error);
      } catch {
        toast.error("Network error. Please try again.");
      }
    });
  }
  return { pending, run };
}
