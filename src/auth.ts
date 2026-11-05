import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

class RateLimited extends CredentialsSignin {
  code = "rate_limited";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        if (!rateLimit(`login:${email}`, 10, 15 * 60_000)) throw new RateLimited();
        const user = await prisma.user.findUnique({ where: { email } });
        // Compare against a dummy hash when the user doesn't exist to keep timing similar.
        const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
        if (!user) return null;
        // Security trail visible to the user under Settings → Activity log.
        await prisma.auditLog.create({ data: { userId: user.id, action: ok ? "login" : "login_failed", entity: "User", entityId: user.id } }).catch(() => undefined);
        if (!ok) return null;
        return { id: user.id, email: user.email, name: user.name, sv: user.sessionVersion };
      },
    }),
  ],
});
