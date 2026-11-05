import type { Metadata } from "next";
import { requireUserPage } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/format";
import { MAX_UPLOAD_BYTES } from "@/lib/storage";
import { PageHeader } from "@/components/shared/page-header";
import { DocumentsView } from "./view";

export const metadata: Metadata = { title: "Document vault" };

export default async function DocumentsPage() {
  const user = await requireUserPage();
  const docs = await prisma.document.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  return (
    <div>
      <PageHeader title="Document vault" description="Receipts, invoices, contracts, IDs and certificates in private storage. Only you can download them." />
      <DocumentsView
        maxMb={Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}
        storage={process.env.STORAGE_DRIVER === "supabase" ? "Supabase Storage (private bucket)" : "the server's private storage folder"}
        rows={docs.map((d) => ({ id: d.id, name: d.name, category: d.category, description: d.description ?? "", mimeType: d.mimeType, size: d.size, createdAt: d.createdAt.toISOString(), uploaded: formatDateTime(d.createdAt, user.prefs.timezone, false) }))}
      />
    </div>
  );
}
