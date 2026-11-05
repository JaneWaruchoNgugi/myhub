"use client";
import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";

function Progress({ className, value, indicatorClassName, ...props }: React.ComponentProps<typeof ProgressPrimitive.Root> & { indicatorClassName?: string }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <ProgressPrimitive.Root className={cn("bg-muted relative h-2 w-full overflow-hidden rounded-full", className)} value={v} {...props}>
      <ProgressPrimitive.Indicator className={cn("bg-primary h-full w-full flex-1 rounded-full transition-all duration-500", indicatorClassName)} style={{ transform: `translateX(-${100 - v}%)` }} />
    </ProgressPrimitive.Root>
  );
}
export { Progress };
