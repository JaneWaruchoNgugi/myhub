import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { calendarItems } from "@/lib/services/calendar";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const from = new Date(sp.get("start") ?? "");
  const to = new Date(sp.get("end") ?? "");
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from || to.getTime() - from.getTime() > 400 * 86_400_000)
    return NextResponse.json({ error: "Invalid range" }, { status: 400 });
  // The calendar's wall-clock range is widened a day each side to cover timezone offsets.
  const items = await calendarItems(user.id, user.prefs, new Date(from.getTime() - 86_400_000), new Date(to.getTime() + 86_400_000));
  return NextResponse.json(items, { headers: { "Cache-Control": "no-store" } });
}
