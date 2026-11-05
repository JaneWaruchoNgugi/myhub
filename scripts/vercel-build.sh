#!/usr/bin/env bash
# Vercel build: apply migrations over a direct connection, then build.
# Neon's Vercel integration has used several variable names over time, so accept all of them.
set -euo pipefail

DB_URL="${DATABASE_URL:-${POSTGRES_PRISMA_URL:-${POSTGRES_URL:-}}}"
DIRECT_URL="${DATABASE_URL_UNPOOLED:-${POSTGRES_URL_NON_POOLING:-${POSTGRES_URL_NO_SSL:-$DB_URL}}}"

if [ -z "$DB_URL" ]; then
  echo "No database connection string found." >&2
  echo "Connect a Neon database in the project's Storage tab (for Production, Preview and Development), or set DATABASE_URL, then redeploy." >&2
  exit 1
fi

if [ -z "${AUTH_SECRET:-}" ]; then
  echo "AUTH_SECRET is missing. Add it in Settings → Environment Variables, then redeploy." >&2
  exit 1
fi

echo "Applying database migrations…"
DATABASE_URL="$DIRECT_URL" npx prisma migrate deploy

DATABASE_URL="$DB_URL" npx next build
