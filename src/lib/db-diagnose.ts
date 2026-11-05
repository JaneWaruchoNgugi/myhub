// Turns a database failure into a plain cause and a fix, without exposing secrets.
// Used by the sign-in/sign-up error messages and by /api/health.

export type DbProblem =
  | "no_url"
  | "bad_credentials"
  | "unreachable"
  | "database_missing"
  | "tables_missing"
  | "unknown";

const DB_URL_VARS = ["DATABASE_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL"] as const;

/** Which of the accepted connection-string variables are set (names only, never values). */
export function dbEnvPresence() {
  return Object.fromEntries(
    [...DB_URL_VARS, "DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING"].map((k) => [k, !!process.env[k]]),
  ) as Record<string, boolean>;
}

/** Host of the connection string the app uses, e.g. ep-x-pooler.eu-central-1.aws.neon.tech. */
export function dbHost(): string | null {
  const raw = DB_URL_VARS.map((k) => process.env[k]).find(Boolean);
  if (!raw) return null;
  try {
    return new URL(raw).hostname || null;
  } catch {
    return "unparseable";
  }
}

export function classifyDbError(e: unknown): DbProblem {
  const err = e as { code?: string; errorCode?: string; message?: string } | null;
  const code = err?.code ?? err?.errorCode ?? "";
  const msg = err?.message ?? String(e);
  if (/Environment variable not found|datasource.*url|You must provide a nonempty URL/i.test(msg)) return "no_url";
  if (code === "P1000" || /Authentication failed|password authentication failed/i.test(msg)) return "bad_credentials";
  if (code === "P1003" || /does not exist on the database server/i.test(msg)) return "database_missing";
  if (code === "P2021" || code === "P2022" || /table .* does not exist/i.test(msg)) return "tables_missing";
  if (["P1001", "P1002", "P1008", "P1017"].includes(code) || /Can't reach database server|timed out|ECONNREFUSED|ENOTFOUND/i.test(msg))
    return "unreachable";
  return "unknown";
}

export const DB_PROBLEM_TEXT: Record<DbProblem, { message: string; fix: string }> = {
  no_url: {
    message: "The server has no database connection string.",
    fix: "Set DATABASE_URL for the Production environment in Vercel → Settings → Environment Variables, then redeploy.",
  },
  bad_credentials: {
    message: "The database rejected the server's username or password.",
    fix: "Copy a fresh connection string from Neon into DATABASE_URL (Production) and redeploy. The password may have been reset.",
  },
  unreachable: {
    message: "The server couldn't reach its database.",
    fix: "Check that the Neon project is active and not suspended or over its quota, and that DATABASE_URL points at it. Then try again.",
  },
  database_missing: {
    message: "The database named in the connection string doesn't exist.",
    fix: "Make the database name at the end of DATABASE_URL match the one in Neon (usually neondb), then redeploy.",
  },
  tables_missing: {
    message: "The database is reachable but its tables haven't been created.",
    fix: "Redeploy so the build runs prisma migrate deploy against this same database. Build and runtime must use the same DATABASE_URL.",
  },
  unknown: {
    message: "The server hit a database error.",
    fix: "Open /api/health and the Vercel runtime logs for the exact error.",
  },
};
