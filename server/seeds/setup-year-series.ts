import { db } from "../db";
import { studySeries, studies } from "@shared/schema";
import { eq, sql, isNull } from "drizzle-orm";

const YEAR_SERIES_TITLE = "Man Up God's Way - Year 1";

async function setupYearSeries() {
  console.log("Setting up year-long study series...");

  const existing = await db
    .select()
    .from(studySeries)
    .where(eq(studySeries.title, YEAR_SERIES_TITLE));

  let seriesId: string;

  if (existing.length > 0) {
    seriesId = existing[0].id;
    console.log(`Series "${YEAR_SERIES_TITLE}" already exists (${seriesId}). Ensuring config is correct...`);
    await db
      .update(studySeries)
      .set({ requiresConsecutiveCompletion: true, isPublished: true })
      .where(eq(studySeries.id, seriesId));
  } else {
    const [created] = await db
      .insert(studySeries)
      .values({
        title: YEAR_SERIES_TITLE,
        description:
          "A year-long journey through biblical manhood. Each week features a 7-day study designed to challenge and grow you as a man of God. Studies unlock in order — complete one to access the next.",
        category: "general",
        isPublished: true,
        requiresConsecutiveCompletion: true,
        displayOrder: 1,
      })
      .returning();
    seriesId = created.id;
    console.log(`Created series "${YEAR_SERIES_TITLE}" (${seriesId})`);
  }

  const studyOrder: { title: string; order: number }[] = [
    { title: "Who is God?", order: 1 },
    { title: "Why Theology Matters", order: 2 },
  ];

  for (const entry of studyOrder) {
    const [study] = await db
      .select()
      .from(studies)
      .where(eq(studies.title, entry.title));

    if (!study) {
      console.log(`  Study "${entry.title}" not found — skipping`);
      continue;
    }

    await db
      .update(studies)
      .set({ seriesId, seriesOrder: entry.order })
      .where(eq(studies.id, study.id));
    console.log(`  Assigned "${entry.title}" → order ${entry.order}`);
  }

  const emptySeries = await db.execute(sql`
    SELECT ss.id, ss.title
    FROM study_series ss
    LEFT JOIN studies s ON s.series_id = ss.id
    WHERE ss.id != ${seriesId}
    GROUP BY ss.id, ss.title
    HAVING COUNT(s.id) = 0
  `);

  for (const row of emptySeries.rows) {
    await db.delete(studySeries).where(eq(studySeries.id, row.id as string));
    console.log(`  Removed empty series "${row.title}"`);
  }

  console.log("Year series setup complete.");

  const result = await db
    .select({
      studyTitle: studies.title,
      seriesOrder: studies.seriesOrder,
      seriesTitle: studySeries.title,
      consecutiveCompletion: studySeries.requiresConsecutiveCompletion,
    })
    .from(studies)
    .innerJoin(studySeries, eq(studies.seriesId, studySeries.id))
    .where(eq(studySeries.id, seriesId));

  console.log("\nVerification:");
  for (const r of result) {
    console.log(
      `  [${r.seriesOrder}] ${r.studyTitle} — consecutive: ${r.consecutiveCompletion}`
    );
  }
}

setupYearSeries()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Failed:", err);
    process.exit(1);
  });
