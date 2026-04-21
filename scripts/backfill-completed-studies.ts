import { db } from '../server/db';
import { sql } from 'drizzle-orm';

interface RepairedRow {
  user_id: string;
  study_id: string;
}

async function backfill() {
  const result = await db.execute<RepairedRow>(sql`
    WITH study_totals AS (
      SELECT study_id, COUNT(*) AS total_days FROM study_lessons GROUP BY study_id
    ),
    user_completions AS (
      SELECT ulp.user_id, sl.study_id, COUNT(DISTINCT ulp.lesson_id) AS completed_days
      FROM user_lesson_progress ulp
      JOIN study_lessons sl ON sl.id = ulp.lesson_id
      WHERE ulp.is_completed = true
      GROUP BY ulp.user_id, sl.study_id
    ),
    stuck AS (
      SELECT uc.user_id, uc.study_id
      FROM user_completions uc
      JOIN study_totals st ON st.study_id = uc.study_id
      WHERE uc.completed_days >= st.total_days
    )
    UPDATE user_progress up
    SET status = 'completed',
        is_completed = true,
        completed_at = COALESCE(up.completed_at, (
          SELECT MAX(ulp.completed_at)
          FROM user_lesson_progress ulp
          JOIN study_lessons sl ON sl.id = ulp.lesson_id
          WHERE ulp.user_id = up.user_id AND sl.study_id = up.study_id AND ulp.is_completed = true
        ))
    FROM stuck s
    WHERE up.user_id = s.user_id
      AND up.study_id = s.study_id
      AND up.status = 'in_progress'
    RETURNING up.user_id, up.study_id;
  `);

  const rows: RepairedRow[] = result.rows;
  console.log(`[backfill-completed-studies] Repaired ${rows.length} stuck user_progress row(s).`);
  for (const r of rows) {
    console.log(`  - user=${r.user_id} study=${r.study_id}`);
  }
  process.exit(0);
}

backfill().catch((e: unknown) => {
  console.error('[backfill-completed-studies] FAILED:', e);
  process.exit(1);
});
