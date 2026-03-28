/**
 * One-time production data migration script.
 *
 * Run manually against the production database:
 *   DATABASE_URL=<prod-connection-string> npx tsx scripts/seed-prod.ts
 *
 * Idempotency:
 *   - Every table is seeded on every run regardless of existing row count.
 *   - Existing rows are preserved by ON CONFLICT DO NOTHING (PK match).
 *   - Missing rows in a partially-populated table are always backfilled.
 *
 * After seeding, the script verifies each table's count matches the seed
 * file and exits non-zero if any mismatch is found.
 *
 * Owner user IDs are Replit platform IDs (identical in dev and prod).
 * Minimal placeholder user records are inserted before content so FK
 * constraints on uploaded_by / created_by / leader_id pass. Replit Auth
 * overwrites these with real profile data on first login.
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

neonConfig.webSocketConstructor = ws;

const OWNER_IDS = ['46399196', '46399698'];
const PRIMARY_OWNER_ID = OWNER_IDS[0];

interface TableConfig {
  key: string;
  table: string;
  overrides?: Record<string, string>;
}

const TABLE_ORDER: TableConfig[] = [
  { key: 'exercises',     table: 'exercises' },
  { key: 'study_series',  table: 'study_series' },
  { key: 'videos',        table: 'videos',       overrides: { uploaded_by: PRIMARY_OWNER_ID } },
  { key: 'podcasts',      table: 'podcasts',      overrides: { uploaded_by: PRIMARY_OWNER_ID } },
  { key: 'events',        table: 'events',        overrides: { created_by: PRIMARY_OWNER_ID } },
  { key: 'war_groups',    table: 'war_groups',    overrides: { leader_id: PRIMARY_OWNER_ID } },
  { key: 'studies',       table: 'studies' },
  { key: 'study_lessons', table: 'study_lessons' },
  { key: 'fitness_plans', table: 'fitness_plans', overrides: { user_id: PRIMARY_OWNER_ID } },
];

async function seed() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('[seed] ERROR: DATABASE_URL environment variable is not set.');
    process.exit(1);
  }

  const seedDataPath = join(process.cwd(), 'scripts', 'seed-data.json');
  if (!existsSync(seedDataPath)) {
    console.error('[seed] ERROR: scripts/seed-data.json not found.');
    process.exit(1);
  }

  console.log('[seed] Loading seed data...');
  const seedData: Record<string, any[]> = JSON.parse(readFileSync(seedDataPath, 'utf8'));

  const pool = new Pool({ connectionString: dbUrl });
  const client = await pool.connect();

  try {
    // ── Pre-seed count report ──────────────────────────────────────────────
    console.log('[seed] Current row counts before seeding:');
    for (const cfg of TABLE_ORDER) {
      const { rows } = await client.query(`SELECT COUNT(*) AS count FROM "${cfg.table}"`);
      const seedCount = (seedData[cfg.key] ?? []).length;
      console.log(`  ${cfg.table.padEnd(16)}: ${String(rows[0].count).padStart(4)} existing  /  ${String(seedCount).padStart(4)} in seed file`);
    }

    // ── Insert phase ───────────────────────────────────────────────────────
    await client.query('BEGIN');

    // Ensure owner user records exist so FK constraints pass
    for (const ownerId of OWNER_IDS) {
      await client.query(
        `INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`,
        [ownerId]
      );
    }
    console.log('\n[seed] Owner user records ensured.');

    for (const cfg of TABLE_ORDER) {
      const rows: any[] = (seedData[cfg.key] ?? []).map((r: any) =>
        cfg.overrides ? { ...r, ...cfg.overrides } : r
      );

      if (rows.length === 0) {
        console.log(`[seed] ${cfg.table}: no rows in seed file — skipping`);
        continue;
      }

      const BATCH = 50;
      let attempted = 0;
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const cols = Object.keys(batch[0]);
        const params: any[] = [];

        const valueSets = batch.map((row) => {
          const placeholders = cols.map((col) => {
            params.push(row[col] ?? null);
            return `$${params.length}`;
          });
          return `(${placeholders.join(', ')})`;
        });

        const quotedCols = cols.map((c) => `"${c}"`).join(', ');
        const sql = `INSERT INTO "${cfg.table}" (${quotedCols}) VALUES ${valueSets.join(', ')} ON CONFLICT DO NOTHING`;
        await client.query(sql, params);
        attempted += batch.length;
      }
      console.log(`[seed] ${cfg.table}: ${attempted} rows attempted (existing rows skipped via ON CONFLICT DO NOTHING)`);
    }

    await client.query('COMMIT');

    // ── Post-seed verification ─────────────────────────────────────────────
    console.log('\n[seed] Post-seed verification:');
    let failures = 0;
    for (const cfg of TABLE_ORDER) {
      const { rows } = await client.query(`SELECT COUNT(*) AS count FROM "${cfg.table}"`);
      const actual = parseInt(rows[0].count, 10);
      const expected = (seedData[cfg.key] ?? []).length;
      const ok = actual >= expected;
      const status = ok ? 'OK' : 'MISMATCH';
      console.log(`  [${status}] ${cfg.table.padEnd(16)}: ${actual} rows (expected >= ${expected})`);
      if (!ok) failures++;
    }

    if (failures > 0) {
      console.error(`\n[seed] FAILED: ${failures} table(s) have fewer rows than the seed file.`);
      process.exit(1);
    }
    console.log('\n[seed] All tables verified. Seed complete.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[seed] Error — transaction rolled back:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
