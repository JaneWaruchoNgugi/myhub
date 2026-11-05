"use client";
import * as React from "react";
import { Code2, Maximize2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { RowActions } from "@/components/shared/row-actions";
import { CodeBlock } from "@/components/shared/code-block";
import { ListToolbar, Pagination, useListControls } from "@/components/shared/list-controls";
import { SnippetDialog, SNIPPET_LANGS } from "@/components/forms/productivity";
import { deleteSnippet } from "@/server/actions/dev";

type Row = { id: string; title: string; language: string; code: string; description: string; tags: string; tagList: string[]; updatedAt: string };

export function SnippetsView({ rows }: { rows: Row[] }) {
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<Row | null>(null);
  const [viewing, setViewing] = React.useState<Row | null>(null);
  const tags = React.useMemo(() => [...new Set(rows.flatMap((r) => r.tagList))].sort(), [rows]);
  const c = useListControls(rows, {
    search: (r, q) => r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) || r.code.toLowerCase().includes(q) || r.tags.toLowerCase().includes(q),
    filters: [
      { key: "lang", label: "Languages", options: SNIPPET_LANGS.map((l) => ({ value: l, label: l })), test: (r, v) => r.language === v },
      ...(tags.length ? [{ key: "tag", label: "Tags", options: tags.map((t) => ({ value: t, label: t })), test: (r: Row, v: string) => r.tagList.includes(v) }] : []),
    ],
    sorts: [
      { key: "updated", label: "Recently updated", compare: (a, b) => b.updatedAt.localeCompare(a.updatedAt) },
      { key: "title", label: "Title", compare: (a, b) => a.title.localeCompare(b.title) },
    ],
    pageSize: 12,
  });
  return (
    <div>
      <ListToolbar controls={c} placeholder="Search title, tags or code">
        <Button onClick={() => setAdding(true)}>
          <Plus /> New snippet
        </Button>
      </ListToolbar>
      {rows.length === 0 ? (
        <EmptyState icon={<Code2 />} title="No snippets yet" description="Keep the auth middleware, SQL queries and shell one-liners you always end up searching for." action={<Button onClick={() => setAdding(true)}><Plus /> New snippet</Button>} />
      ) : c.total === 0 ? (
        <EmptyState title="No snippets match" action={<Button variant="outline" onClick={c.clear}>Clear filters</Button>} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {c.pageItems.map((s) => (
            <Card key={s.id} className="min-w-0 gap-3">
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="truncate text-base">{s.title}</CardTitle>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <Badge variant="info">{s.language}</Badge>
                    {s.tagList.map((t) => (
                      <Badge key={t} variant="outline" className="font-normal">
                        #{t}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0">
                  <Button size="icon-sm" variant="ghost" onClick={() => setViewing(s)} aria-label="Expand">
                    <Maximize2 />
                  </Button>
                  <RowActions onEdit={() => setEditing(s)} onDelete={() => deleteSnippet(s.id)} deleteTitle={`Delete "${s.title}"?`} />
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {s.description ? <p className="text-muted-foreground text-sm">{s.description}</p> : null}
                <CodeBlock code={s.code} language={s.language} maxHeight={260} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Pagination page={c.page} pageCount={c.pageCount} total={c.total} onPage={c.setPage} />
      <SnippetDialog open={adding} onOpenChange={setAdding} />
      <SnippetDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} initial={editing ?? undefined} />
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{viewing?.title}</DialogTitle>
            <DialogDescription>{viewing?.description || viewing?.language}</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto px-6 pb-6">{viewing ? <CodeBlock code={viewing.code} language={viewing.language} /> : null}</div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
