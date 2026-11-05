import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  // Everything except auth endpoints, the cron endpoint (secret-protected), static assets.
  matcher: ["/((?!api/auth|api/cron|_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)"],
};
