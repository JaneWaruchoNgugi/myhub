import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "crypto";
import path from "path";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { ALLOWED_MIME, MAX_UPLOAD_BYTES, getStorage, sniffMatches } from "@/lib/storage";
import { documentMetaSchema } from "@/lib/validation/productivity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Upload a document into the private vault. multipart/form-data: file, name?, category, description? */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(`upload:${user.id}`, 30, 10 * 60_000)) return NextResponse.json({ error: "Too many uploads. Try again in a few minutes." }, { status: 429 });

  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_UPLOAD_BYTES + 64 * 1024) return NextResponse.json({ error: `Files must be ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB or smaller.` }, { status: 413 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: `Files must be ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB or smaller.` }, { status: 413 });

  const ext = path.extname(file.name).toLowerCase();
  // Trust the extension + magic bytes, not the browser-supplied MIME type.
  const mime = Object.keys(ALLOWED_MIME).find((m) => ALLOWED_MIME[m].includes(ext));
  if (!mime) return NextResponse.json({ error: "That file type isn't allowed. Upload PDF, PNG, JPG, WEBP, TXT, CSV, DOCX or XLSX." }, { status: 415 });
  const buf = Buffer.from(await file.arrayBuffer());
  if (!sniffMatches(mime, buf)) return NextResponse.json({ error: "The file's contents don't match its extension." }, { status: 415 });

  const parsed = documentMetaSchema.safeParse({
    name: String(form.get("name") || "").trim() || file.name.slice(0, 200),
    category: form.get("category") || "OTHER",
    description: form.get("description") || "",
  });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid details." }, { status: 400 });

  const key = `${user.id}/${randomBytes(16).toString("hex")}`;
  const storage = getStorage();
  try {
    await storage.put(key, buf, mime);
  } catch (e) {
    console.error("[upload]", e);
    return NextResponse.json({ error: "Storage is unavailable. Please try again later." }, { status: 502 });
  }
  try {
    const doc = await prisma.$transaction(async (tx) => {
      const d = await tx.document.create({ data: { userId: user.id, name: parsed.data.name, category: parsed.data.category, description: parsed.data.description || null, storageKey: key, mimeType: mime, size: buf.length } });
      await audit(tx, user.id, "upload", "Document", d.id, { name: d.name, size: d.size });
      return d;
    });
    revalidatePath("/documents");
    return NextResponse.json({ id: doc.id }, { status: 201 });
  } catch (e) {
    await storage.remove(key).catch(() => undefined);
    console.error("[upload]", e);
    return NextResponse.json({ error: "Couldn't save the document." }, { status: 500 });
  }
}
