#!/bin/bash
set -e
npm install
npm run build

# One-time content migration: only runs when SEED_ON_BUILD=true is set.
# After the first successful deployment that seeds the data, remove this
# flag from your deployment environment variables.
if [ "${SEED_ON_BUILD}" = "true" ]; then
  echo "[build] SEED_ON_BUILD=true detected — running production data seed..."
  npx tsx scripts/seed-prod.ts
fi
