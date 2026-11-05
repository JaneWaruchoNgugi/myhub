import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className, dark = true }: { className?: string; dark?: boolean }) {
  return (
    <Link href="/dashboard" className={cn("flex items-center gap-2.5", className)} aria-label="MYHUB home">
      <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 text-sm font-bold text-white shadow-sm">M</span>
      <span className="flex flex-col leading-none">
        <span className={cn("text-[15px] font-bold tracking-tight", dark ? "text-white" : "text-foreground")}>MYHUB</span>
        <span className={cn("mt-1 text-[10px]", dark ? "text-sidebar-muted" : "text-muted-foreground")}>Your Money. Your Goals. Your Life.</span>
      </span>
    </Link>
  );
}
