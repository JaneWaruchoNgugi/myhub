import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { classifyDbError, dbEnvPresence, dbHost, DB_PROBLEM_TEXT } from "@/lib/db-diagnose";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Public deployment check: says whether the database works and why not. Never returns secrets.
export async function GET() {
  const env = {
    ...dbEnvPresence(),
    AUTH_SECRET: !!process.env.AUTH_SECRET,
    VERCEL_ENV: process.env.VERCEL_ENV ?? null,
  };
  const host = dbHost();
  try {
    await prisma.$queryRaw`SELECT 1`;
    await prisma.user.findFirst({ select: { id: true } }); // fails with P2021 if migrations never ran
    return NextResponse.json({ ok: true, database: { host, reachable: true, tables: true }, env }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const problem = classifyDbError(e);
    console.error("[health] database check failed", e);
    return NextResponse.json(
      { ok: false, database: { host, problem, ...DB_PROBLEM_TEXT[problem] }, env },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
