import type { Metadata } from "next";
import { requireUserPage } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { NotesView } from "./view";

export const metadata: Metadata = { title: "Notes" };

export default async function NotesPage() {
  const user = await requireUserPage();
  const notes = await prisma.note.findMany({ where: { userId: user.id }, orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }] });
  return (
    <div>
      <PageHeader title="Notes" description="Markdown notes for ideas, plans, meeting notes and anything else. Pin the ones you need often." />
      <NotesView rows={notes.map((n) => ({ id: n.id, title: n.title, content: n.content, category: n.category ?? "", isPinned: n.isPinned, updatedAt: n.updatedAt.toISOString(), updatedLabel: formatDateTime(n.updatedAt, user.prefs.timezone) }))} />
    </div>
  );
}
