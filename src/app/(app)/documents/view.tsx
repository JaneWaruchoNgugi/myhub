"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, Eye, FileImage, FileLock2, FileSpreadsheet, FileText, Lock, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { EntityForm } from "@/components/shared/entity-form";
import { RowActions } from "@/components/shared/row-actions";
import { ListToolbar, Pagination, useListControls } from "@/components/shared/list-controls";
import { DOC_CAT_OPTS, labelOf } from "@/components/forms/options";
import { documentMetaSchema } from "@/lib/validation/productivity";
import { deleteDocument, updateDocument } from "@/server/actions/workspace";

type Row = { id: string; name: string; category: string; description: string; mimeType: string; size: number; createdAt: string; uploaded: string };
const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.docx,.xlsx";
const PREVIEWABLE = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp", "text/plain"]);

const size = (b: number) => (b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
const icon = (m: string) => (m.startsWith("image/") ? <FileImage /> : m.includes("sheet") || m === "text/csv" ? <FileSpreadsheet /> : <FileText />);

export function DocumentsView({ rows, maxMb, storage }: { rows: Row[]; maxMb: number; storage: string }) {
  const [uploading, setUploading] = React.useState(false);
  const [editing, setEditing] = React.useState<Row | null>(null);
  const c = useListControls(rows, {
    search: (r, q) => r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q),
    filters: [{ key: "category", label: "Categories", options: DOC_CAT_OPTS, test: (r, v) => r.category === v }],
    sorts: [
      { key: "new", label: "Newest", compare: (a, b) => b.createdAt.localeCompare(a.createdAt) },
      { key: "name", label: "Name", compare: (a, b) => a.name.localeCompare(b.name) },
      { key: "size", label: "Size", compare: (a, b) => b.size - a.size },
    ],
  });
  const total = rows.reduce((s, r) => s + r.size, 0);
  return (
    <div className="flex flex-col gap-4">
      <Card className="flex-row items-center gap-3 px-4 py-3 text-sm">
        <Lock className="text-muted-foreground size-4 shrink-0" />
        <p className="text-muted-foreground">
          {rows.length} file{rows.length === 1 ? "" : "s"} · {size(total)} stored in {storage}. Files are never public; every download checks that you own it. Max {maxMb} MB per file.
        </p>
      </Card>
      <ListToolbar controls={c} placeholder="Search documents">
        <Button onClick={() => setUploading(true)}>
          <Upload /> Upload
        </Button>
      </ListToolbar>
      {rows.length === 0 ? (
        <EmptyState icon={<FileLock2 />} title="Your vault is empty" description="Upload receipts, invoices, contracts, ID scans, tax documents and certificates (PDF, images, TXT, CSV, DOCX, XLSX)." action={<Button onClick={() => setUploading(true)}><Upload /> Upload a document</Button>} />
      ) : c.total === 0 ? (
        <EmptyState title="No documents match" action={<Button variant="outline" onClick={c.clear}>Clear filters</Button>} />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead className="hidden sm:table-cell">Category</TableHead>
                <TableHead className="hidden md:table-cell">Uploaded</TableHead>
                <TableHead className="hidden text-right md:table-cell">Size</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {c.pageItems.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="whitespace-normal">
                    <div className="flex items-start gap-2">
                      <span className="text-muted-foreground mt-0.5 [&_svg]:size-4">{icon(d.mimeType)}</span>
                      <div className="min-w-0">
                        <div className="font-medium break-words">{d.name}</div>
                        {d.description ? <div className="text-muted-foreground line-clamp-1 text-xs">{d.description}</div> : null}
                        <div className="text-muted-foreground text-xs sm:hidden">
                          {labelOf(DOC_CAT_OPTS, d.category)} · {size(d.size)}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="secondary">{labelOf(DOC_CAT_OPTS, d.category)}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden text-sm md:table-cell">{d.uploaded}</TableCell>
                  <TableCell className="text-muted-foreground hidden text-right text-sm tabular-nums md:table-cell">{size(d.size)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-0.5">
                      {PREVIEWABLE.has(d.mimeType) ? (
                        <Button asChild size="icon-sm" variant="ghost" aria-label={`Preview ${d.name}`}>
                          <a href={`/api/documents/${d.id}?inline=1`} target="_blank" rel="noopener noreferrer">
                            <Eye />
                          </a>
                        </Button>
                      ) : null}
                      <Button asChild size="icon-sm" variant="ghost" aria-label={`Download ${d.name}`}>
                        <a href={`/api/documents/${d.id}`} download>
                          <Download />
                        </a>
                      </Button>
                      <RowActions onEdit={() => setEditing(d)} onDelete={() => deleteDocument(d.id)} deleteTitle={`Delete "${d.name}"?`} deleteDescription="The file is permanently removed from storage." />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <Pagination page={c.page} pageCount={c.pageCount} total={c.total} onPage={c.setPage} />
      <UploadDialog open={uploading} onOpenChange={setUploading} maxMb={maxMb} />
      <EntityForm
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        title="Edit document details"
        schema={documentMetaSchema}
        fields={[
          { name: "name", label: "Name", type: "text", span: 2 },
          { name: "category", label: "Category", type: "select", options: DOC_CAT_OPTS, span: 2 },
          { name: "description", label: "Description", type: "textarea", rows: 3 },
        ]}
        defaultValues={{ name: editing?.name ?? "", category: editing?.category ?? "OTHER", description: editing?.description ?? "" }}
        onSubmit={(v) => updateDocument(editing!.id, v)}
      />
    </div>
  );
}

function UploadDialog({ open, onOpenChange, maxMb }: { open: boolean; onOpenChange: (o: boolean) => void; maxMb: number }) {
  const router = useRouter();
  const [file, setFile] = React.useState<File | null>(null);
  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState("RECEIPT");
  const [description, setDescription] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setFile(null);
      setName("");
      setCategory("RECEIPT");
      setDescription("");
      setError(null);
    }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return setError("Choose a file to upload.");
    if (file.size > maxMb * 1024 * 1024) return setError(`Files must be ${maxMb} MB or smaller.`);
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("name", name);
    fd.set("category", category);
    fd.set("description", description);
    try {
      const res = await fetch("/api/documents", { method: "POST", body: fd });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Upload failed.");
        return;
      }
      toast.success("Document uploaded");
      onOpenChange(false);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent>
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle>Upload a document</DialogTitle>
            <DialogDescription>PDF, PNG, JPG, WEBP, TXT, CSV, DOCX or XLSX, up to {maxMb} MB.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 overflow-y-auto px-6 pb-2">
            <div className="grid gap-1.5">
              <Label htmlFor="doc-file">File</Label>
              <Input
                id="doc-file"
                type="file"
                accept={ACCEPT}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                  if (f && !name) setName(f.name.replace(/\.[^.]+$/, ""));
                }}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="doc-name">Name</Label>
              <Input id="doc-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} placeholder="Defaults to the file name" />
            </div>
            <div className="grid gap-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOC_CAT_OPTS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="doc-desc">Description</Label>
              <Textarea id="doc-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={1000} />
            </div>
            {error ? (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !file}>
              <Upload /> {busy ? "Uploading…" : "Upload"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
