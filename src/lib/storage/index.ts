import "server-only";
import { promises as fs } from "fs";
import path from "path";

/** Private file storage. Files are never served from /public; downloads go through an authenticated route. */
export interface StorageProvider {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

const SAFE_KEY = /^[a-zA-Z0-9/_-]+$/;
function assertKey(key: string) {
  if (!SAFE_KEY.test(key) || key.includes("..")) throw new Error("Invalid storage key");
}

class LocalStorage implements StorageProvider {
  constructor(private root: string) {}
  private resolve(key: string) {
    assertKey(key);
    const p = path.resolve(this.root, key);
    if (!p.startsWith(path.resolve(this.root) + path.sep)) throw new Error("Invalid storage path");
    return p;
  }
  async put(key: string, data: Buffer) {
    const p = this.resolve(key);
    await fs.mkdir(path.dirname(p), { recursive: true, mode: 0o700 });
    await fs.writeFile(p, data, { mode: 0o600 });
  }
  async get(key: string) {
    return fs.readFile(this.resolve(key));
  }
  async remove(key: string) {
    await fs.rm(this.resolve(key), { force: true });
  }
}

/** Supabase Storage via its REST API, using a PRIVATE bucket and the service-role key (server only). */
class SupabaseStorage implements StorageProvider {
  constructor(
    private url: string,
    private serviceKey: string,
    private bucket: string,
  ) {}
  private endpoint(key: string) {
    assertKey(key);
    return `${this.url.replace(/\/$/, "")}/storage/v1/object/${encodeURIComponent(this.bucket)}/${key}`;
  }
  private headers(extra?: Record<string, string>) {
    return { Authorization: `Bearer ${this.serviceKey}`, apikey: this.serviceKey, ...extra };
  }
  async put(key: string, data: Buffer, contentType: string) {
    const res = await fetch(this.endpoint(key), { method: "POST", headers: this.headers({ "Content-Type": contentType, "x-upsert": "false" }), body: new Uint8Array(data) });
    if (!res.ok) throw new Error(`Supabase upload failed (${res.status})`);
  }
  async get(key: string) {
    const res = await fetch(this.endpoint(key), { headers: this.headers() });
    if (!res.ok) throw new Error(`Supabase download failed (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }
  async remove(key: string) {
    const res = await fetch(`${this.url.replace(/\/$/, "")}/storage/v1/object/${encodeURIComponent(this.bucket)}`, {
      method: "DELETE",
      headers: this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ prefixes: [key] }),
    });
    if (!res.ok && res.status !== 404) throw new Error(`Supabase delete failed (${res.status})`);
  }
}

let instance: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (instance) return instance;
  const driver = process.env.STORAGE_DRIVER ?? "local";
  if (driver === "supabase") {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "myhub-documents";
    if (!url || !key) throw new Error("STORAGE_DRIVER=supabase needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    instance = new SupabaseStorage(url, key, bucket);
  } else instance = new LocalStorage(path.resolve(process.cwd(), process.env.LOCAL_STORAGE_DIR ?? "./storage"));
  return instance;
}

export const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_MB ?? 10) * 1024 * 1024;

export const ALLOWED_MIME: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
  "text/plain": [".txt"],
  "text/csv": [".csv"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
};

/** Checks magic bytes for binary types so a renamed file can't pass as a PDF/image. */
export function sniffMatches(mime: string, buf: Buffer): boolean {
  const b = buf.subarray(0, 12);
  switch (mime) {
    case "application/pdf":
      return b.subarray(0, 5).toString("latin1") === "%PDF-";
    case "image/png":
      return b[0] === 0x89 && b.subarray(1, 4).toString("latin1") === "PNG";
    case "image/jpeg":
      return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    case "image/webp":
      return b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP";
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      return b[0] === 0x50 && b[1] === 0x4b; // zip
    case "text/plain":
    case "text/csv":
      return !buf.subarray(0, 4096).includes(0);
    default:
      return false;
  }
}
