"use server";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { AuthError as NextAuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validation/productivity";
import { provisionUser } from "@/lib/services/defaults";
import { rateLimit } from "@/lib/rate-limit";

export type AuthState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

async function clientKey() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

export async function loginAction(_: AuthState, formData: FormData): Promise<AuthState> {
  if (!rateLimit(`login-ip:${await clientKey()}`, 30, 15 * 60_000)) return { error: "Too many attempts. Try again in a few minutes." };
  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirectTo: "/dashboard",
    });
  } catch (e) {
    if (e instanceof NextAuthError) {
      if ((e as { code?: string }).code === "rate_limited") return { error: "Too many attempts for this account. Try again in 15 minutes." };
      return { error: "Incorrect email or password." };
    }
    throw e; // redirect
  }
}

export async function registerAction(_: AuthState, formData: FormData): Promise<AuthState> {
  if (process.env.ALLOW_REGISTRATION !== "true") return { error: "Registration is disabled on this server." };
  if (!rateLimit(`register:${await clientKey()}`, 5, 60 * 60_000)) return { error: "Too many sign-ups from this network. Try later." };
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }
  const { name, email, password } = parsed.data;
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return { error: "An account with this email already exists." };
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { name, email, passwordHash } });
    await provisionUser(tx, user.id);
  });
  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  } catch (e) {
    if (e instanceof NextAuthError) return { error: "Account created. Please sign in." };
    throw e;
  }
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
