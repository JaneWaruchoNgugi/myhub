"use client";
import * as React from "react";
import { Bookmark as BookmarkIcon, ExternalLink, Plus, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { RowActions } from "@/components/shared/row-actions";
import { ListToolbar, Pagination, useListControls } from "@/components/shared/list-controls";
import { useRun } from "@/components/shared/use-run";
import { BookmarkDialog } from "@/components/forms/productivity";
import { BOOKMARK_CAT_OPTS, labelOf } from "@/components/forms/options";
import { deleteBookmark, toggleFavourite } from "@/server/actions/dev";
import { cn } from "@/lib/utils";

type Row = { id: string; title: string; url: string; description: string; category: string; tags: string; tagList: string[]; isFavourite: boolean; createdAt: string };

const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
};

export function BookmarksView({ rows }: { rows: Row[] }) {
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<Row | null>(null);
  const { pending, run } = useRun();
  const tags = React.useMemo(() => [...new Set(rows.flatMap((r) => r.tagList))].sort(), [rows]);
  const c = useListControls(rows, {
    search: (r, q) => r.title.toLowerCase().includes(q) || r.url.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) || r.tags.toLowerCase().includes(q),
    filters: [
      { key: "category", label: "Categories", options: BOOKMARK_CAT_OPTS, test: (r, v) => r.category === v },
      ...(tags.length ? [{ key: "tag", label: "Tags", options: tags.map((t) => ({ value: t, label: t })), test: (r: Row, v: string) => r.tagList.includes(v) }] : []),
      { key: "fav", label: "Bookmarks", options: [{ value: "fav", label: "Favourites only" }], test: (r) => r.isFavourite },
    ],
    sorts: [
      { key: "fav", label: "Favourites first", compare: (a, b) => Number(b.isFavourite) - Number(a.isFavourite) || b.createdAt.localeCompare(a.createdAt) },
      { key: "new", label: "Newest", compare: (a, b) => b.createdAt.localeCompare(a.createdAt) },
      { key: "title", label: "Title", compare: (a, b) => a.title.localeCompare(b.title) },
    ],
    pageSize: 24,
  });
  return (
    <div>
      <ListToolbar controls={c} placeholder="Search bookmarks">
        <Button onClick={() => setAdding(true)}>
          <Plus /> Save bookmark
        </Button>
      </ListToolbar>
      {rows.length === 0 ? (
        <EmptyState icon={<BookmarkIcon />} title="No bookmarks saved" description="Save documentation, repositories, tutorials and API references so they're one search away." action={<Button onClick={() => setAdding(true)}><Plus /> Save bookmark</Button>} />
      ) : c.total === 0 ? (
        <EmptyState title="No bookmarks match" action={<Button variant="outline" onClick={c.clear}>Clear filters</Button>} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {c.pageItems.map((b) => (
            <Card key={b.id} className="flex-row items-start gap-3 px-4 py-4">
              <button type="button" disabled={pending} onClick={() => run(() => toggleFavourite(b.id), { success: b.isFavourite ? "Removed from favourites" : "Added to favourites" })} aria-label={b.isFavourite ? "Remove from favourites" : "Add to favourites"} aria-pressed={b.isFavourite} className="mt-0.5">
                <Star className={cn("size-4", b.isFavourite ? "fill-amber-400 text-amber-400" : "text-muted-foreground hover:text-foreground")} />
              </button>
              <div className="min-w-0 flex-1">
                <a href={b.url} target="_blank" rel="noopener noreferrer" className="group inline-flex max-w-full items-center gap-1 font-medium hover:underline">
                  <span className="truncate">{b.title}</span>
                  <ExternalLink className="text-muted-foreground size-3.5 shrink-0" />
                </a>
                <p className="text-muted-foreground truncate text-xs">{host(b.url)}</p>
                {b.description ? <p className="text-muted-foreground mt-1.5 line-clamp-2 text-sm">{b.description}</p> : null}
                <div className="mt-2 flex flex-wrap gap-1">
                  <Badge variant="secondary">{labelOf(BOOKMARK_CAT_OPTS, b.category)}</Badge>
                  {b.tagList.map((t) => (
                    <Badge key={t} variant="outline" className="font-normal">
                      #{t}
                    </Badge>
                  ))}
                </div>
              </div>
              <RowActions onEdit={() => setEditing(b)} onDelete={() => deleteBookmark(b.id)} deleteTitle={`Delete "${b.title}"?`} />
            </Card>
          ))}
        </div>
      )}
      <Pagination page={c.page} pageCount={c.pageCount} total={c.total} onPage={c.setPage} />
      <BookmarkDialog open={adding} onOpenChange={setAdding} />
      <BookmarkDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} initial={editing ?? undefined} />
    </div>
  );
}
