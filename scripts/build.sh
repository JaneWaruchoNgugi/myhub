#!/usr/bin/env bash
# `npm run build`: on Vercel, run the full deploy build (env checks + migrations) even if
# the project's Build Command was set to `npm run build`; elsewhere just build.
set -euo pipefail
if [ -n "${VERCEL:-}" ]; then exec bash scripts/vercel-build.sh; fi
exec npx next build
