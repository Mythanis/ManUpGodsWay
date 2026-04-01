import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function migrate() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS discussion_dislikes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      discussion_id uuid NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
      user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamp DEFAULT now(),
      UNIQUE(user_id, discussion_id)
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_discussion_dislikes_discussion_id ON discussion_dislikes(discussion_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_discussion_dislikes_user_id ON discussion_dislikes(user_id)`);
  
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS accountability_supports (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id uuid NOT NULL REFERENCES accountability_requests(id) ON DELETE CASCADE,
      user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamp DEFAULT now(),
      UNIQUE(user_id, request_id)
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_accountability_supports_request_id ON accountability_supports(request_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_accountability_supports_user_id ON accountability_supports(user_id)`);
  
  console.log('Migration complete!');
  process.exit(0);
}

migrate().catch(e => { console.error(e); process.exit(1); });
