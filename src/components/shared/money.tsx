"use client";
import { usePrefs } from "@/components/providers";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export function Money({
  value,
  className,
  tone,
  compact,
  sign,
}: {
  value: string | number | null | undefined;
  className?: string;
  /** "auto" colours by sign; "income"/"expense" force a colour. */
  tone?: "auto" | "income" | "expense" | "muted";
  compact?: boolean;
  sign?: boolean;
}) {
  const prefs = usePrefs();
  const n = Number(value ?? 0);
  const color =
    tone === "income" || (tone === "auto" && n > 0)
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "expense" || (tone === "auto" && n < 0)
        ? "text-red-600 dark:text-red-400"
        : tone === "muted"
          ? "text-muted-foreground"
          : "";
  return <span className={cn("tabular", color, className)}>{formatMoney(value, prefs, { compact, sign })}</span>;
}

export function useMoney() {
  const prefs = usePrefs();
  return (v: string | number | null | undefined, opts?: { compact?: boolean; sign?: boolean }) => formatMoney(v, prefs, opts);
}
