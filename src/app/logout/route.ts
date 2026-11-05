import { NextResponse, type NextRequest } from "next/server";
import { signOut } from "@/auth";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Clears a session cookie that no longer belongs to a valid user (account removed or
 * password changed elsewhere). A still-valid session is sent back to the app instead,
 * so this URL can't be used to sign someone out from another site.
 */
export async function GET(req: NextRequest) {
  if (await getCurrentUser()) return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  return signOut({ redirectTo: "/login?expired=1" });
}
