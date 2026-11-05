import "server-only";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AuthError } from "@/lib/session";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/** Errors whose message is safe to show to the user. */
export class UserError extends Error {}

export function fail(message: string): never {
  throw new UserError(message);
}

/** Wraps a server action body: maps validation/auth/db errors into a safe result. */
export async function handle<T>(fn: () => Promise<T>, message?: string): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data, message };
  } catch (e) {
    if (e instanceof ZodError) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of e.issues) {
        const k = issue.path.join(".") || "_";
        (fieldErrors[k] ??= []).push(issue.message);
      }
      return { ok: false, error: e.issues[0]?.message ?? "Invalid input", fieldErrors };
    }
    if (e instanceof UserError || e instanceof AuthError) return { ok: false, error: e.message };
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") return { ok: false, error: "A record with these details already exists." };
      if (e.code === "P2025") return { ok: false, error: "Record not found." };
      if (e.code === "P2003") return { ok: false, error: "This record is linked to other records and can't be changed that way." };
    }
    console.error("[action]", e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
