import type { Metadata } from "next";
import { requireUserPage } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { SnippetsView } from "./view";

export const metadata: Metadata = { title: "Snippets" };

export default async function SnippetsPage() {
  const user = await requireUserPage();
  const rows = await prisma.codeSnippet.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } });
  return (
    <div>
      <PageHeader title="Code snippets" description="Reusable code with syntax highlighting and one-click copy." />
      <SnippetsView rows={rows.map((s) => ({ id: s.id, title: s.title, language: s.language, code: s.code, description: s.description ?? "", tags: s.tags.join(", "), tagList: s.tags, updatedAt: s.updatedAt.toISOString() }))} />
    </div>
  );
}
