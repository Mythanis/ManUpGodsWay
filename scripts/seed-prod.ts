/**
 * One-time production data migration script.
 *
 * Run manually against the production database:
 *   DATABASE_URL=<prod-connection-string> npx tsx scripts/seed-prod.ts
 *
 * Or set SEED_ON_BUILD=true in your deployment environment so build.sh
 * runs it automatically during the next deployment.
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
 *
 * User FK override rule: any user FK field whose value does not correspond
 * to a known production user is replaced with Jody's owner ID (46399196).
 * Only videos, podcasts, events, war_groups, and fitness_plans need this
 * override — the remaining tables already reference owner IDs exclusively.
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

// FK-safe insertion order — tables appear after the tables they depend on.
const TABLE_ORDER: TableConfig[] = [
  // ── No external FKs ──────────────────────────────────────────────────────
  { key: 'exercises',            table: 'exercises' },
  { key: 'study_series',         table: 'study_series' },

  // ── uploaded_by → users (owner IDs already correct in seed data) ─────────
  { key: 'logo_settings',        table: 'logo_settings' },
  { key: 'header_logo_settings', table: 'header_logo_settings' },

  // ── No user FKs ──────────────────────────────────────────────────────────
  { key: 'carousel_items',          table: 'carousel_items' },
  { key: 'challenges',              table: 'challenges' },
  { key: 'devotionals',             table: 'devotionals' },
  { key: 'man_up_links',            table: 'man_up_links' },
  { key: 'missions',                table: 'missions' },
  { key: 'store_products',          table: 'store_products' },
  { key: 'tier_pricing',            table: 'tier_pricing' },

  // ── bible_reading_plans (no deps) ────────────────────────────────────────
  { key: 'bible_reading_plans',     table: 'bible_reading_plans' },

  // ── bible_reading_plan_days (plan_id → bible_reading_plans) ──────────────
  { key: 'bible_reading_plan_days', table: 'bible_reading_plan_days' },

  // ── uploaded_by / created_by → users — override to PRIMARY_OWNER_ID ─────
  { key: 'videos',               table: 'videos',        overrides: { uploaded_by: PRIMARY_OWNER_ID } },
  { key: 'podcasts',             table: 'podcasts',      overrides: { uploaded_by: PRIMARY_OWNER_ID } },
  { key: 'events',               table: 'events',        overrides: { created_by: PRIMARY_OWNER_ID } },

  // ── leader_id → users — override to PRIMARY_OWNER_ID ────────────────────
  { key: 'war_groups',           table: 'war_groups',    overrides: { leader_id: PRIMARY_OWNER_ID } },

  // ── updated_by → users (already PRIMARY_OWNER_ID in seed data) ──────────
  { key: 'system_settings',      table: 'system_settings' },

  // ── series_id → study_series ─────────────────────────────────────────────
  { key: 'studies',              table: 'studies' },

  // ── study_id → studies ───────────────────────────────────────────────────
  { key: 'study_lessons',        table: 'study_lessons' },

  // ── user_id → users — override to PRIMARY_OWNER_ID ───────────────────────
  { key: 'fitness_plans',        table: 'fitness_plans', overrides: { user_id: PRIMARY_OWNER_ID } },

  // ── user_id → users, study_id → studies (already PRIMARY_OWNER_ID) ───────
  { key: 'discussions',          table: 'discussions' },

  // ── event_id → events ────────────────────────────────────────────────────
  { key: 'event_tiers',          table: 'event_tiers' },

  // ── group_id → war_groups, user_id → users (46399196 + 46399698 both seeded)
  { key: 'war_group_members',    table: 'war_group_members' },
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
      console.log(`  ${cfg.table.padEnd(22)}: ${String(rows[0].count).padStart(4)} existing  /  ${String(seedCount).padStart(4)} in seed file`);
    }

    // ── Insert phase ───────────────────────────────────────────────────────
    await client.query('BEGIN');

    // ── Seed full user records from seed-data.json (users key) ────────────
    // App-specific fields are upserted on conflict; Replit Auth fields
    // (email, first_name, last_name, profile_image_url) are left untouched
    // if the user already exists so a prior Replit login isn't overwritten.
    const APP_USER_UPDATE_COLS = [
      'role', 'subscription_tier', 'subscription_status', 'subscription_expires_at',
      'stripe_customer_id', 'stripe_subscription_id',
      'rations', 'ration_rank', 'streak_days',
      'has_seen_welcome', 'has_completed_tour', 'is_profile_complete',
      'total_studies_completed', 'total_active_days', 'last_study_activity_date',
      'has_fitness_access', 'prayer_permissions_granted',
      'allow_direct_messages', 'allow_group_invites',
      'theme_preference', 'is_profile_private',
      'last_active_date', 'trial_start_date', 'trial_end_date',
    ];

    const seededUserIds = new Set<string>();
    const usersToSeed: any[] = seedData['users'] ?? [];
    for (const user of usersToSeed) {
      const cols = Object.keys(user);
      const params: any[] = cols.map(c => user[c] ?? null);
      const quotedCols = cols.map(c => `"${c}"`).join(', ');
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
      const updateClause = APP_USER_UPDATE_COLS
        .filter(c => cols.includes(c))
        .map(c => `"${c}" = EXCLUDED."${c}"`)
        .join(', ');
      await client.query(
        `INSERT INTO users (${quotedCols}) VALUES (${placeholders})
         ON CONFLICT (id) DO UPDATE SET ${updateClause}`,
        params
      );
      seededUserIds.add(user.id);
      console.log(`[seed] users: upserted ${user.first_name ?? user.id} (${user.id}) role=${user.role} tier=${user.subscription_tier}`);
    }

    // Ensure any remaining owner IDs have at least a placeholder record
    for (const ownerId of OWNER_IDS) {
      if (!seededUserIds.has(ownerId)) {
        await client.query(
          `INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`,
          [ownerId]
        );
        console.log(`[seed] users: placeholder inserted for ${ownerId}`);
      }
    }
    console.log('[seed] Owner user records ensured (46399196, 46399698).');

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
      console.log(`  [${status}] ${cfg.table.padEnd(22)}: ${actual} rows (expected >= ${expected})`);
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
