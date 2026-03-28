#!/bin/bash
set -e
npm install
npm run build
npx tsx scripts/seed-prod.ts
