#!/bin/bash
set -e

echo "[post-merge] Installing dependencies..."
npm install --no-audit --no-fund

echo "[post-merge] Pushing schema changes..."
npm run db:push -- --force || npm run db:push

echo "[post-merge] Running one-time backfill: completed studies..."
npx tsx scripts/backfill-completed-studies.ts

echo "[post-merge] Done."
