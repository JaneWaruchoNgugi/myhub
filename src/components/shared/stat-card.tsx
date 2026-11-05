import * as React from "react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "default" | "positive" | "negative" | "primary" | "warning";
  className?: string;
}) {
  const toneCls = {
    default: "bg-muted text-muted-foreground",
    positive: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    negative: "bg-red-500/10 text-red-600 dark:text-red-400",
    primary: "bg-primary/10 text-primary",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  }[tone];
  return (
    <div className={cn("bg-card flex min-w-0 flex-col gap-3 rounded-xl border p-4 shadow-[0_1px_2px_0_rgb(15_23_42/0.04)]", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</span>
        {icon ? <span className={cn("flex size-7 items-center justify-center rounded-lg [&_svg]:size-4", toneCls)}>{icon}</span> : null}
      </div>
      <div className="text-lg leading-tight font-semibold tracking-tight break-words tabular sm:text-xl xl:text-[22px]">{value}</div>
      {hint ? <div className="text-muted-foreground text-xs">{hint}</div> : null}
    </div>
  );
}
