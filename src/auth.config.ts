import type { NextAuthConfig } from "next-auth";

const PUBLIC_PATHS = ["/login", "/register"];

/** Edge-safe config used by middleware (no database access here). */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
      const loggedIn = !!auth?.user;
      if (isPublic) {
        if (loggedIn) return Response.redirect(new URL("/dashboard", request.nextUrl));
        return true;
      }
      // APIs answer 401 instead of redirecting to the sign-in page.
      if (!loggedIn && pathname.startsWith("/api/")) return Response.json({ error: "Unauthorized" }, { status: 401 });
      return loggedIn;
    },
    jwt({ token, user }) {
      if (user?.id) {
        token.uid = user.id;
        token.sv = user.sv ?? 0;
      }
      return token;
    },
    session({ session, token }) {
      if (token.uid && session.user) {
        session.user.id = token.uid as string;
        session.user.sv = (token.sv as number | undefined) ?? 0;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
