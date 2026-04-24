/**
 * Apply Exercise Instruction Review Decisions
 * ============================================
 * Processes pending rows in exercise_instruction_reviews:
 *
 *   needs_review = false           → mark approved (instructions already correct)
 *   needs_review = true, no text   → mark rejected (Claude couldn't parse response)
 *
 * Rows with AI corrections (needs_review = true AND new_instructions IS NOT NULL)
 * are intentionally left pending. A human should inspect each correction and then
 * approve it explicitly (via admin UI or the --apply-corrections flag below).
 *
 * Usage:
 *   npx tsx scripts/apply-exercise-reviews.ts --dry-run        # preview counts
 *   npx tsx scripts/apply-exercise-reviews.ts                  # approve matched, reject errors
 *   npx tsx scripts/apply-exercise-reviews.ts --apply-corrections  # also write AI corrections to exercises table
 *
 * Inspect corrections before applying:
 *   SELECT exercise_id, exercise_name, new_instructions
 *   FROM exercise_instruction_reviews
 *   WHERE needs_review = true AND new_instructions IS NOT NULL AND status = 'pending'
 *   ORDER BY exercise_id;
 */

import { db } from "../server/db";
import { exercises, exerciseInstructionReviews } from "../shared/schema";
import { eq } from "drizzle-orm";

const isDryRun = process.argv.includes("--dry-run");
const applyCorrections = process.argv.includes("--apply-corrections");

async function main() {
  const mode = isDryRun ? " [DRY RUN]" : applyCorrections ? " [APPLY CORRECTIONS]" : "";
  console.log(`\n📝  Apply Exercise Instruction Reviews${mode}`);

  const pending = await db
    .select({
      id: exerciseInstructionReviews.id,
      exerciseId: exerciseInstructionReviews.exerciseId,
      exerciseName: exerciseInstructionReviews.exerciseName,
      needsReview: exerciseInstructionReviews.needsReview,
      newInstructions: exerciseInstructionReviews.newInstructions,
      confidence: exerciseInstructionReviews.confidence,
    })
    .from(exerciseInstructionReviews)
    .where(eq(exerciseInstructionReviews.status, "pending"));

  const matched = pending.filter((r) => !r.needsReview);
  const withCorrection = pending.filter((r) => r.needsReview && r.newInstructions);
  const parseErrors = pending.filter((r) => r.needsReview && !r.newInstructions);
  const mediumConfidence = pending.filter((r) => r.confidence === "medium");
  const lowConfidence = pending.filter((r) => r.confidence === "low");

  console.log(`\n    Pending rows                  : ${pending.length}`);
  console.log(`    Instructions already correct  : ${matched.length}  → will approve`);
  console.log(`    Has AI correction             : ${withCorrection.length}  → ${applyCorrections ? "will apply + approve" : "needs human review (skipped)"}`);
  console.log(`    Parse errors (no correction)  : ${parseErrors.length}  → will reject`);
  console.log(`    Medium confidence             : ${mediumConfidence.length}  → recommend manual review`);
  console.log(`    Low confidence                : ${lowConfidence.length}  → recommend manual review\n`);

  if (!applyCorrections && withCorrection.length > 0) {
    console.log(
      "ℹ️   Rows with AI corrections are left pending for human review.\n" +
      "    Inspect them with:\n" +
      "      SELECT exercise_id, exercise_name, new_instructions\n" +
      "      FROM exercise_instruction_reviews\n" +
      "      WHERE needs_review = true AND new_instructions IS NOT NULL AND status = 'pending'\n" +
      "      ORDER BY exercise_id;\n" +
      "    Then approve via admin UI (task #90) or rerun with --apply-corrections to bulk-apply.\n"
    );
  }

  if (mediumConfidence.length > 0) {
    console.log(
      "⚠️   Medium-confidence rows (verify before bulk-approving):\n" +
      mediumConfidence
        .slice(0, 20)
        .map((r) => `      #${r.exerciseId} ${r.exerciseName}`)
        .join("\n") +
      (mediumConfidence.length > 20 ? `\n      … and ${mediumConfidence.length - 20} more` : "") +
      "\n"
    );
  }

  if (isDryRun) {
    console.log("Dry run — no changes written.");
    process.exit(0);
  }

  if (pending.length === 0) {
    console.log("Nothing pending. All done.");
    process.exit(0);
  }

  // 1. Approve matched rows (instructions were already correct)
  if (matched.length > 0) {
    for (const r of matched) {
      await db
        .update(exerciseInstructionReviews)
        .set({ status: "approved" })
        .where(eq(exerciseInstructionReviews.id, r.id));
    }
    console.log(`✅  Approved ${matched.length} matched rows (instructions were correct)`);
  }

  // 2. Optionally apply AI corrections to exercises table (requires --apply-corrections)
  if (applyCorrections && withCorrection.length > 0) {
    let appliedCount = 0;
    for (const r of withCorrection) {
      await db.update(exercises).set({ instructions: r.newInstructions! }).where(eq(exercises.id, r.exerciseId));
      await db
        .update(exerciseInstructionReviews)
        .set({ status: "approved" })
        .where(eq(exerciseInstructionReviews.id, r.id));
      appliedCount++;
    }
    console.log(`🔧  Applied corrections and approved ${appliedCount} rows`);
  }

  // 3. Reject parse errors (Claude returned unparseable response)
  if (parseErrors.length > 0) {
    for (const r of parseErrors) {
      await db
        .update(exerciseInstructionReviews)
        .set({ status: "rejected" })
        .where(eq(exerciseInstructionReviews.id, r.id));
    }
    console.log(`❌  Rejected ${parseErrors.length} rows (no correction parsed from Claude response)`);
  }

  const totalPending = await db.$count(exerciseInstructionReviews, eq(exerciseInstructionReviews.status, "pending"));
  console.log(`\n✅  Done. Remaining pending rows: ${totalPending}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("\n[fatal]", err);
  process.exit(1);
});
