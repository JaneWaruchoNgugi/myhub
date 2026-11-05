import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ALLOWED_MIME, getStorage } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Only these types may be shown inline (preview); everything else is always a download.
const INLINE = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp", "text/plain"]);

/** Authenticated download. Files are only ever served to their owner. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const doc = await prisma.document.findFirst({ where: { id, userId: user.id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  let data: Buffer;
  try {
    data = await getStorage().get(doc.storageKey);
  } catch (e) {
    console.error("[download]", e);
    return NextResponse.json({ error: "File unavailable" }, { status: 502 });
  }
  const inline = req.nextUrl.searchParams.get("inline") === "1" && INLINE.has(doc.mimeType);
  const ext = ALLOWED_MIME[doc.mimeType]?.[0] ?? "";
  const withExt = ext && !doc.name.toLowerCase().endsWith(ext) ? `${doc.name}${ext}` : doc.name;
  const safeName = withExt.replace(/[^\w.\- ]+/g, "_").slice(0, 150) || "document";
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": doc.mimeType === "text/plain" ? "text/plain; charset=utf-8" : doc.mimeType,
      "Content-Length": String(data.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(withExt)}`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
