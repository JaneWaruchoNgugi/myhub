"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { CornerDownLeft, Search } from "lucide-react";
import { NAV } from "./nav";
import { cn } from "@/lib/utils";

const ITEMS = NAV.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label })));

/** Keyboard-first page switcher: Ctrl/⌘ K anywhere, type to filter, Enter to go. */
export function CommandMenu() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [idx, setIdx] = React.useState(0);
  const listRef = React.useRef<HTMLUListElement>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = React.useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? ITEMS.filter((i) => i.label.toLowerCase().includes(t) || i.group.toLowerCase().includes(t)) : ITEMS;
  }, [q]);

  React.useEffect(() => setIdx(0), [q]);
  React.useEffect(() => {
    listRef.current?.querySelector(`[data-index="${idx}"]`)?.scrollIntoView({ block: "nearest" });
  }, [idx]);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[idx]) {
      e.preventDefault();
      go(results[idx].href);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQ("");
      }}>
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          className="bg-muted/60 text-muted-foreground hover:bg-muted hidden h-9 w-full max-w-xs items-center gap-2 rounded-lg border px-3 text-sm transition-colors md:flex"
        >
          <Search className="size-4" />
          <span className="flex-1 text-left">Jump to…</span>
          <kbd className="bg-background rounded border px-1.5 py-0.5 font-sans text-[10px] font-medium">Ctrl K</kbd>
        </button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-slate-950/40" />
        <DialogPrimitive.Content
          onKeyDown={onKeyDown}
          className="bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 fixed top-[15vh] left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 overflow-hidden rounded-xl border shadow-2xl"
        >
          <DialogPrimitive.Title className="sr-only">Jump to a page</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Type to filter, use the arrow keys to choose and Enter to open.</DialogPrimitive.Description>
          <div className="flex items-center gap-2 border-b px-4">
            <Search className="text-muted-foreground size-4 shrink-0" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search pages…"
              aria-label="Search pages"
              role="combobox"
              aria-expanded
              aria-controls="command-results"
              aria-activedescendant={results[idx] ? `cmd-${idx}` : undefined}
              className="h-12 flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          <ul id="command-results" role="listbox" ref={listRef} className="max-h-80 overflow-y-auto p-2">
            {results.length === 0 ? <li className="text-muted-foreground px-3 py-6 text-center text-sm">No pages match “{q}”.</li> : null}
            {results.map((r, i) => {
              const Icon = r.icon;
              return (
                <li
                  key={r.href}
                  id={`cmd-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={i === idx}
                  onMouseMove={() => setIdx(i)}
                  onClick={() => go(r.href)}
                  className={cn("flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm", i === idx && "bg-accent text-accent-foreground")}
                >
                  <Icon className="text-muted-foreground size-4" />
                  <span className="flex-1">{r.label}</span>
                  <span className="text-muted-foreground text-xs">{r.group}</span>
                  {i === idx ? <CornerDownLeft className="text-muted-foreground size-3.5" /> : null}
                </li>
              );
            })}
          </ul>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
