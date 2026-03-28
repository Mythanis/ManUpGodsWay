import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

neonConfig.webSocketConstructor = ws;

const PRIMARY_OWNER_ID = '46399196';
const SECONDARY_OWNER_ID = '46399698';

async function seed() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log('[seed] DATABASE_URL not set — skipping seed.');
    process.exit(0);
  }

  const seedDataPath = join(process.cwd(), 'scripts', 'seed-data.json');
  if (!existsSync(seedDataPath)) {
    console.log('[seed] scripts/seed-data.json not found — skipping seed.');
    process.exit(0);
  }

  const pool = new Pool({ connectionString: dbUrl });
  const client = await pool.connect();

  try {
    const { rows } = await client.query('SELECT COUNT(*) AS count FROM exercises');
    const count = parseInt(rows[0].count, 10);
    if (count > 0) {
      console.log(`[seed] Already seeded (${count} exercises found). Skipping.`);
      return;
    }

    console.log('[seed] No exercises found — seeding production data...');

    const seedData: Record<string, any[]> = JSON.parse(
      readFileSync(seedDataPath, 'utf8')
    );

    async function batchInsert(
      table: string,
      rows: any[],
      overrides: Record<string, any> = {},
      batchSize = 50
    ) {
      if (!rows || rows.length === 0) return 0;

      let inserted = 0;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize).map((r) => ({ ...r, ...overrides }));
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
        const sql = `INSERT INTO "${table}" (${quotedCols}) VALUES ${valueSets.join(', ')} ON CONFLICT DO NOTHING`;
        await client.query(sql, params);
        inserted += batch.length;
      }
      return inserted;
    }

    await client.query('BEGIN');

    await client.query(
      `INSERT INTO users (id) VALUES ($1), ($2) ON CONFLICT (id) DO NOTHING`,
      [PRIMARY_OWNER_ID, SECONDARY_OWNER_ID]
    );
    console.log('[seed] Ensured owner user records exist.');

    const userOverride = { uploaded_by: PRIMARY_OWNER_ID };

    const exerciseCount = await batchInsert('exercises', seedData.exercises);
    console.log(`[seed] exercises: ${exerciseCount}`);

    const seriesCount = await batchInsert('study_series', seedData.study_series);
    console.log(`[seed] study_series: ${seriesCount}`);

    const videoCount = await batchInsert('videos', seedData.videos, userOverride);
    console.log(`[seed] videos: ${videoCount}`);

    const podcastCount = await batchInsert('podcasts', seedData.podcasts, userOverride);
    console.log(`[seed] podcasts: ${podcastCount}`);

    const eventCount = await batchInsert('events', seedData.events, { created_by: PRIMARY_OWNER_ID });
    console.log(`[seed] events: ${eventCount}`);

    const warGroupCount = await batchInsert('war_groups', seedData.war_groups, { leader_id: PRIMARY_OWNER_ID });
    console.log(`[seed] war_groups: ${warGroupCount}`);

    const studyCount = await batchInsert('studies', seedData.studies);
    console.log(`[seed] studies: ${studyCount}`);

    const lessonCount = await batchInsert('study_lessons', seedData.study_lessons);
    console.log(`[seed] study_lessons: ${lessonCount}`);

    const fitnessPlanCount = await batchInsert('fitness_plans', seedData.fitness_plans, { user_id: PRIMARY_OWNER_ID });
    console.log(`[seed] fitness_plans: ${fitnessPlanCount}`);

    await client.query('COMMIT');
    console.log('[seed] All done!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[seed] Error — rolled back:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
