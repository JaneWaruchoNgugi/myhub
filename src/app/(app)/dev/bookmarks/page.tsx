import type { Metadata } from "next";
import { requireUserPage } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { BookmarksView } from "./view";

export const metadata: Metadata = { title: "Bookmarks" };

export default async function BookmarksPage() {
  const user = await requireUserPage();
  const rows = await prisma.bookmark.findMany({ where: { userId: user.id }, orderBy: [{ isFavourite: "desc" }, { createdAt: "desc" }] });
  return (
    <div>
      <PageHeader title="Bookmarks" description="Docs, repositories, tutorials, APIs and tools you keep coming back to." />
      <BookmarksView rows={rows.map((b) => ({ id: b.id, title: b.title, url: b.url, description: b.description ?? "", category: b.category, tags: b.tags.join(", "), tagList: b.tags, isFavourite: b.isFavourite, createdAt: b.createdAt.toISOString() }))} />
    </div>
  );
}
