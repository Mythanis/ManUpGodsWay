/**
 * One-time production data migration script.
 *
 * Run manually against the production database (e.g. from a dev machine with
 * the prod DATABASE_URL exported, or via an ephemeral runner):
 *
 *   DATABASE_URL=<prod-connection-string> npx tsx scripts/seed-prod.ts
 *
 * The script is fully idempotent:
 *   - Each table is checked independently before seeding.
 *   - Existing rows are preserved via ON CONFLICT DO NOTHING.
 *   - A single transaction wraps all inserts; rolls back on any error.
 *
 * Owner user IDs are Replit platform IDs and are identical in dev and prod.
 * Minimal placeholder user records are inserted before content so that FK
 * constraints on uploaded_by / created_by / leader_id pass. Replit Auth will
 * overwrite these records with real profile data on first login.
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
  { key: 'exercises',    table: 'exercises' },
  { key: 'study_series', table: 'study_series' },
  { key: 'videos',       table: 'videos',       overrides: { uploaded_by: PRIMARY_OWNER_ID } },
  { key: 'podcasts',     table: 'podcasts',      overrides: { uploaded_by: PRIMARY_OWNER_ID } },
  { key: 'events',       table: 'events',        overrides: { created_by: PRIMARY_OWNER_ID } },
  { key: 'war_groups',   table: 'war_groups',    overrides: { leader_id: PRIMARY_OWNER_ID } },
  { key: 'studies',      table: 'studies' },
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
    console.log('[seed] Checking current table counts...');
    const summary: Record<string, { existing: number; toInsert: number }> = {};

    for (const cfg of TABLE_ORDER) {
      const key = cfg.key as keyof typeof seedData;
      const { rows } = await client.query(`SELECT COUNT(*) AS count FROM "${cfg.table}"`);
      const existing = parseInt(rows[0].count, 10);
      const toInsert = (seedData[key] ?? []).length;
      summary[cfg.table] = { existing, toInsert };
      console.log(`  ${cfg.table}: ${existing} rows in DB, ${toInsert} rows in seed file`);
    }

    const tablesToSeed = TABLE_ORDER.filter(
      (cfg) => summary[cfg.table].existing === 0 && summary[cfg.table].toInsert > 0
    );

    if (tablesToSeed.length === 0) {
      console.log('[seed] All tables already have data. Nothing to seed.');
      return;
    }

    console.log(`\n[seed] Will seed ${tablesToSeed.length} table(s): ${tablesToSeed.map((t) => t.table).join(', ')}`);

    await client.query('BEGIN');

    // Ensure owner user records exist so FK constraints pass
    for (const ownerId of OWNER_IDS) {
      await client.query(
        `INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`,
        [ownerId]
      );
    }
    console.log('[seed] Owner user records ensured.');

    for (const cfg of tablesToSeed) {
      const rows: any[] = (seedData[cfg.key as keyof typeof seedData] ?? []).map((r: any) =>
        cfg.overrides ? { ...r, ...cfg.overrides } : r
      );

      let inserted = 0;
      const BATCH = 50;

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
        inserted += batch.length;
      }

      console.log(`[seed] ${cfg.table}: inserted ${inserted} rows`);
    }

    await client.query('COMMIT');
    console.log('\n[seed] Seed complete. Verify row counts:');

    for (const cfg of TABLE_ORDER) {
      const { rows } = await client.query(`SELECT COUNT(*) AS count FROM "${cfg.table}"`);
      console.log(`  ${cfg.table}: ${rows[0].count} rows`);
    }
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
