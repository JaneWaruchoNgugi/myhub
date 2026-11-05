import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function titleCase(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function enumOptions<T extends string>(values: readonly T[], labels?: Partial<Record<T, string>>) {
  return values.map((v) => ({ value: v, label: labels?.[v] ?? titleCase(v) }));
}

export function initials(name?: string | null) {
  if (!name) return "U";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}
