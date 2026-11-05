import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export class AuthError extends Error {}

export type Prefs = {
  currency: string;
  timezone: string;
  locale: string;
  weekStartsOn: number;
  budgetAlertThreshold: number;
  billReminderDays: number;
  loanReminderDays: number;
  taskReminderDays: number;
  projectReminderDays: number;
};

export type CurrentUser = { id: string; email: string; name: string | null; isDemo: boolean; prefs: Prefs };

type PrefRow = Partial<Prefs> | null | undefined;

/** Preferences with defaults (KES, Africa/Nairobi) for users who haven't saved any. */
export function prefsFrom(p: PrefRow): Prefs {
  return {
    currency: p?.currency ?? "KES",
    timezone: p?.timezone ?? "Africa/Nairobi",
    locale: p?.locale ?? "en-KE",
    weekStartsOn: p?.weekStartsOn ?? 1,
    budgetAlertThreshold: p?.budgetAlertThreshold ?? 80,
    billReminderDays: p?.billReminderDays ?? 3,
    loanReminderDays: p?.loanReminderDays ?? 5,
    taskReminderDays: p?.taskReminderDays ?? 1,
    projectReminderDays: p?.projectReminderDays ?? 7,
  };
}

/** Loads the signed-in user (once per request). Server-side authorization starts here. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await prisma.user.findUnique({ where: { id }, include: { preference: true } });
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isDemo: user.isDemo,
    prefs: prefsFrom(user.preference),
  };
});

/** For pages: redirects to login when there is no session. */
export async function requireUserPage(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}

/** For server actions and API routes: throws when there is no session. */
export async function requireUser(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) throw new AuthError("You must be signed in.");
  return u;
}
