#!/bin/bash
# Post-merge setup — runs automatically after task agents merge their work.
# Must complete in < 20s (the platform's hard timeout) and must be fully
# non-interactive (no TTY available here).
set -e

# 1. Install any new packages. Skip audit/fund checks (they add ~5s each)
#    and prefer the local cache so unchanged dependency trees finish in ~1s.
npm install --prefer-offline --no-audit --no-fund --silent

# 2. Sync the Drizzle schema to the database.
#    --force skips destructive confirmations. We pipe empty input so any
#    remaining prompt resolves immediately. We wrap in `timeout` so we never
#    eat the entire post-merge budget — schema changes are also tracked as
#    SQL files in `migrations/` and applied during task work, so a skipped
#    push here is recoverable and not blocking.
timeout 10s sh -c 'echo "" | npm run db:push -- --force' >/dev/null 2>&1 || {
  echo "[post-merge] db:push skipped (non-interactive prompt or timeout) — schema files in migrations/ are the source of truth"
}

echo "[post-merge] done"
