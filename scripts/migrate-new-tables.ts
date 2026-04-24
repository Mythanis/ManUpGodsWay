import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function migrate() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS discussion_dislikes (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      discussion_id varchar NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
      user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamp DEFAULT now(),
      UNIQUE(user_id, discussion_id)
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_discussion_dislikes_discussion_id ON discussion_dislikes(discussion_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_discussion_dislikes_user_id ON discussion_dislikes(user_id)`);
  
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS accountability_supports (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      request_id varchar NOT NULL,
      user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamp DEFAULT now(),
      UNIQUE(user_id, request_id)
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_accountability_supports_request_id ON accountability_supports(request_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_accountability_supports_user_id ON accountability_supports(user_id)`);

  // Health metrics (Task #113)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS health_metrics (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date varchar(10) NOT NULL,
      metric_type varchar(20) NOT NULL
        CHECK (metric_type IN ('steps', 'heart_rate', 'sleep', 'weight')),
      primary_value real NOT NULL,
      secondary_value real,
      notes text,
      created_at timestamp NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_health_metrics_user_type_date
      ON health_metrics (user_id, metric_type, created_at DESC)
  `);

  console.log('Migration complete!');
  process.exit(0);
}

migrate().catch(e => { console.error(e); process.exit(1); });
