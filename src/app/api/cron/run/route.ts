import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { prefsFrom } from "@/lib/session";
import { runMaintenance } from "@/lib/services/maintenance";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const header = req.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Scheduled maintenance for every user: materialises recurring transactions,
 * generates in-app reminders and records the monthly net-worth snapshot.
 * Call with `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends this automatically).
 */
async function run(req: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const started = Date.now();
  const users = await prisma.user.findMany({ select: { id: true, preference: true } });
  let ok = 0;
  for (const u of users) {
    await runMaintenance(u.id, prefsFrom(u.preference), { force: true });
    ok++;
  }
  return NextResponse.json({ users: ok, ms: Date.now() - started });
}

export const GET = run;
export const POST = run;
