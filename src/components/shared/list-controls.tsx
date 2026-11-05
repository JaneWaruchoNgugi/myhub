"use client";
import * as React from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Option } from "./entity-form";

export type FilterDef<T> = { key: string; label: string; options: Option[]; test: (item: T, value: string) => boolean };
export type SortDef<T> = { key: string; label: string; compare: (a: T, b: T) => number };

const ALL = "__all__";

/** Client-side search, filter, sort and pagination for lists. */
export function useListControls<T>(items: T[], opts: { search?: (item: T, q: string) => boolean; filters?: FilterDef<T>[]; sorts?: SortDef<T>[]; pageSize?: number; initialFilters?: Record<string, string> }) {
  const [q, setQ] = React.useState("");
  const [filters, setFilters] = React.useState<Record<string, string>>(opts.initialFilters ?? {});
  const [sort, setSort] = React.useState(opts.sorts?.[0]?.key ?? "");
  const [page, setPage] = React.useState(1);
  const pageSize = opts.pageSize ?? 20;

  const filtered = React.useMemo(() => {
    const query = q.trim().toLowerCase();
    let out = items.filter((it) => (!query || !opts.search ? true : opts.search(it, query)));
    for (const f of opts.filters ?? []) {
      const v = filters[f.key];
      if (v && v !== ALL) out = out.filter((it) => f.test(it, v));
    }
    const s = opts.sorts?.find((x) => x.key === sort);
    if (s) out = [...out].sort(s.compare);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, q, filters, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  return {
    q,
    setQ: (v: string) => {
      setQ(v);
      setPage(1);
    },
    filters,
    setFilter: (k: string, v: string) => {
      setFilters((f) => ({ ...f, [k]: v }));
      setPage(1);
    },
    sort,
    setSort,
    page: safePage,
    setPage,
    pageCount,
    pageItems,
    filtered,
    total: filtered.length,
    filterDefs: opts.filters ?? [],
    sortDefs: opts.sorts ?? [],
    clear: () => {
      setQ("");
      setFilters({});
      setPage(1);
    },
    isFiltered: !!q || Object.values(filters).some((v) => v && v !== ALL),
  };
}

type Controls<T> = ReturnType<typeof useListControls<T>>;

export function ListToolbar<T>({ controls, placeholder = "Search…", children }: { controls: Controls<T>; placeholder?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-64">
        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input value={controls.q} onChange={(e) => controls.setQ(e.target.value)} placeholder={placeholder} className="bg-card pl-9" aria-label="Search" />
      </div>
      <div className="contents">
        {controls.filterDefs.map((f) => (
          <Select key={f.key} value={controls.filters[f.key] || ALL} onValueChange={(v) => controls.setFilter(f.key, v)}>
            <SelectTrigger className="bg-card h-9 w-auto min-w-[130px]" aria-label={f.label}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All {f.label.toLowerCase()}</SelectItem>
              {f.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
        {controls.sortDefs.length > 1 ? (
          <Select value={controls.sort} onValueChange={controls.setSort}>
            <SelectTrigger className="bg-card h-9 w-auto min-w-[150px]" aria-label="Sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {controls.sortDefs.map((s) => (
                <SelectItem key={s.key} value={s.key}>
                  Sort: {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {controls.isFiltered ? (
          <Button variant="ghost" size="sm" onClick={controls.clear}>
            <X /> Clear
          </Button>
        ) : null}
      </div>
      {children ? <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

export function Pagination({ page, pageCount, total, onPage }: { page: number; pageCount: number; total: number; onPage: (p: number) => void }) {
  if (pageCount <= 1) return total ? <p className="text-muted-foreground mt-3 text-xs">{total} item{total === 1 ? "" : "s"}</p> : null;
  return (
    <div className="mt-4 flex items-center justify-between gap-2">
      <p className="text-muted-foreground text-xs">
        Page {page} of {pageCount} · {total} items
      </p>
      <div className="flex gap-1">
        <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <ChevronLeft />
        </Button>
        <Button variant="outline" size="icon-sm" disabled={page >= pageCount} onClick={() => onPage(page + 1)} aria-label="Next page">
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
