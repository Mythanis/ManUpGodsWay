import { db } from "../db";
import { studySeries, studies } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

const YEAR_SERIES_TITLE = "Man Up God's Way - Year 1";

const STUDY_ORDER: { title: string; order: number }[] = [
  { title: "Who is God?", order: 1 },
  { title: "Why Theology Matters", order: 2 },
];

async function setupYearSeries() {
  console.log("Setting up year-long study series...");

  const existing = await db
    .select()
    .from(studySeries)
    .where(eq(studySeries.title, YEAR_SERIES_TITLE));

  let seriesId: string;

  if (existing.length > 0) {
    seriesId = existing[0].id;
    console.log(`Series "${YEAR_SERIES_TITLE}" already exists (${seriesId}). Ensuring config...`);
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

  for (const entry of STUDY_ORDER) {
    const [study] = await db
      .select()
      .from(studies)
      .where(sql`TRIM(${studies.title}) = ${entry.title}`);

    if (!study) {
      throw new Error(
        `Required study "${entry.title}" not found in database. Cannot proceed with setup.`
      );
    }

    await db
      .update(studies)
      .set({ seriesId, seriesOrder: entry.order })
      .where(eq(studies.id, study.id));
    console.log(`  Assigned "${entry.title}" (${study.id}) → order ${entry.order}`);
  }

  console.log("\nVerification:");
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

  if (result.length !== STUDY_ORDER.length) {
    throw new Error(
      `Expected ${STUDY_ORDER.length} studies in series but found ${result.length}`
    );
  }

  for (const r of result) {
    console.log(
      `  [${r.seriesOrder}] ${r.studyTitle} — consecutiveCompletion: ${r.consecutiveCompletion}`
    );
  }

  console.log(`\nSeries ID: ${seriesId}`);
  console.log("Year series setup complete.");
}

setupYearSeries()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Setup failed:", err);
    process.exit(1);
  });
