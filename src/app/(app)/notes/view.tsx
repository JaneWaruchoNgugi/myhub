"use client";
import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, NotebookPen, Pin, PinOff, Plus, Save, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm";
import { useRun } from "@/components/shared/use-run";
import { deleteNote, saveNote, togglePin } from "@/server/actions/workspace";
import { cn } from "@/lib/utils";

type Row = { id: string; title: string; content: string; category: string; isPinned: boolean; updatedAt: string; updatedLabel: string };
type Draft = { id: string | null; title: string; content: string; category: string; isPinned: boolean };
const ALL = "__all__";
const blank: Draft = { id: null, title: "", content: "", category: "", isPinned: false };

/** Strips the most common markdown syntax for list previews. */
const plain = (md: string) => md.replace(/```[\s\S]*?```/g, " ").replace(/[#>*_`~\-[\]()!|]/g, "").replace(/\s+/g, " ").trim();

export function NotesView({ rows }: { rows: Row[] }) {
  const [q, setQ] = React.useState("");
  const [cat, setCat] = React.useState(ALL);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [saved, setSaved] = React.useState<Draft | null>(null);
  const [mode, setMode] = React.useState<"write" | "preview">("write");
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const { run } = useRun();
  const categories = React.useMemo(() => [...new Set(rows.map((r) => r.category).filter(Boolean))].sort(), [rows]);
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(saved);

  const list = rows.filter((r) => {
    const s = q.trim().toLowerCase();
    if (cat !== ALL && r.category !== cat) return false;
    return !s || r.title.toLowerCase().includes(s) || r.content.toLowerCase().includes(s);
  });

  function open(d: Draft) {
    if (dirty && !window.confirm("Discard unsaved changes to this note?")) return;
    setDraft(d);
    setSaved(d);
    setMode(d.id && d.content ? "preview" : "write");
  }

  const save = React.useCallback(async () => {
    if (!draft) return;
    if (!draft.title.trim()) return toast.error("Give the note a title.");
    setSaving(true);
    try {
      const r = await saveNote(draft.id, draft);
      if (r.ok) {
        const next = { ...draft, id: r.data ?? draft.id };
        setDraft(next);
        setSaved(next);
        toast.success("Note saved");
      } else toast.error(r.error);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [draft]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s" && draft) {
        e.preventDefault();
        void save();
      }
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [draft, dirty, save]);

  // Keep the open note's pin state in sync when toggled from the list.
  React.useEffect(() => {
    if (!draft?.id) return;
    const r = rows.find((x) => x.id === draft.id);
    if (!r) {
      setDraft(null);
      setSaved(null);
    } else if (r.isPinned !== saved?.isPinned) {
      setDraft((d) => (d ? { ...d, isPinned: r.isPinned } : d));
      setSaved((d) => (d ? { ...d, isPinned: r.isPinned } : d));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  if (rows.length === 0 && !draft)
    return <EmptyState icon={<NotebookPen />} title="No notes yet" description="Write in Markdown: headings, lists, checklists, tables and code blocks all work." action={<Button onClick={() => open(blank)}><Plus /> New note</Button>} />;

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className={cn("flex flex-col gap-3", draft && "hidden lg:flex")}>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes" className="bg-card pl-9" aria-label="Search notes" />
          </div>
          <Button onClick={() => open(blank)} aria-label="New note">
            <Plus />
            <span className="lg:hidden">New</span>
          </Button>
        </div>
        {categories.length ? (
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger className="bg-card h-9" aria-label="Category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <Card className="py-0">
          {list.length === 0 ? (
            <p className="text-muted-foreground p-6 text-center text-sm">No notes match.</p>
          ) : (
            <ul className="max-h-[calc(100dvh-280px)] divide-y overflow-y-auto">
              {list.map((n) => (
                <li key={n.id} className={cn("group flex items-start gap-2 px-3 py-2.5", draft?.id === n.id && "bg-accent")}>
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => open({ id: n.id, title: n.title, content: n.content, category: n.category, isPinned: n.isPinned })}>
                    <div className="flex items-center gap-1.5">
                      {n.isPinned ? <Pin className="text-primary size-3 shrink-0" aria-label="Pinned" /> : null}
                      <span className="truncate text-sm font-medium">{n.title}</span>
                    </div>
                    <p className="text-muted-foreground line-clamp-2 text-xs">{plain(n.content) || "Empty note"}</p>
                    <p className="text-muted-foreground mt-1 text-[11px]">
                      {n.category ? `${n.category} · ` : ""}
                      {n.updatedLabel}
                    </p>
                  </button>
                  <Button size="icon-sm" variant="ghost" className="opacity-60 group-hover:opacity-100" aria-label={n.isPinned ? "Unpin" : "Pin"} onClick={() => run(() => togglePin(n.id), { success: n.isPinned ? "Unpinned" : "Pinned" })}>
                    {n.isPinned ? <PinOff /> : <Pin />}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {draft ? (
        <Card className="min-w-0 gap-0 py-0">
          <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
            <Button
              size="sm"
              variant="ghost"
              className="lg:hidden"
              onClick={() => {
                if (dirty && !window.confirm("Discard unsaved changes to this note?")) return;
                setDraft(null);
                setSaved(null);
              }}
            >
              <ArrowLeft /> Notes
            </Button>
            <Tabs value={mode} onValueChange={(v) => setMode(v as "write" | "preview")}>
              <TabsList>
                <TabsTrigger value="write">Write</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="ml-auto flex items-center gap-1">
              {dirty ? <Badge variant="warning">Unsaved</Badge> : null}
              <Button size="icon-sm" variant="ghost" aria-label={draft.isPinned ? "Unpin" : "Pin"} aria-pressed={draft.isPinned} onClick={() => setDraft({ ...draft, isPinned: !draft.isPinned })}>
                {draft.isPinned ? <PinOff /> : <Pin />}
              </Button>
              {draft.id ? (
                <Button size="icon-sm" variant="ghost" aria-label="Delete note" onClick={() => setConfirmDelete(true)}>
                  <Trash2 />
                </Button>
              ) : null}
              <Button size="sm" onClick={save} disabled={saving || (!dirty && !!draft.id)}>
                <Save /> {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-3 p-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Title" aria-label="Title" className="h-10 flex-1 text-base font-semibold" maxLength={200} />
              <Input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} placeholder="Category (optional)" aria-label="Category" list="note-categories" className="sm:w-48" maxLength={60} />
              <datalist id="note-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            {mode === "write" ? (
              <Textarea
                value={draft.content}
                onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                placeholder={"Write in Markdown…\n\n# Heading\n- [ ] A checklist item\n**bold**, _italic_, `code`"}
                aria-label="Content"
                className="min-h-[50dvh] font-mono text-sm leading-relaxed"
              />
            ) : (
              <div className="prose-note min-h-[50dvh] text-sm">{draft.content.trim() ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{draft.content}</ReactMarkdown> : <p className="text-muted-foreground">Nothing to preview yet.</p>}</div>
            )}
            <p className="text-muted-foreground text-xs">Markdown supported. Press Ctrl/⌘ + S to save.</p>
          </div>
        </Card>
      ) : (
        <Card className="hidden items-center justify-center lg:flex">
          <EmptyState icon={<NotebookPen />} title="Select a note" description="Choose a note on the left, or start a new one." action={<Button onClick={() => open(blank)}><Plus /> New note</Button>} className="border-0" />
        </Card>
      )}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete "${draft?.title}"?`}
        description="This note will be permanently deleted."
        action={async () => {
          const r = await deleteNote(draft!.id!);
          if (r.ok) {
            setDraft(null);
            setSaved(null);
          }
          return r;
        }}
      />
    </div>
  );
}
