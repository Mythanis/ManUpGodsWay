/**
 * Apply Exercise Instruction Review Decisions
 * ============================================
 * Processes all pending rows in exercise_instruction_reviews and:
 *   - needs_review = false           → mark approved (instructions already correct)
 *   - needs_review = true, has text  → apply correction to exercises table, mark approved
 *   - needs_review = true, no text   → mark rejected (Claude couldn't parse response)
 *
 * Run this after the audit completes (or any time to catch up on new rows):
 *   npx tsx scripts/apply-exercise-reviews.ts
 *
 * Dry-run mode (show counts without writing):
 *   npx tsx scripts/apply-exercise-reviews.ts --dry-run
 */

import { db } from "../server/db";
import { exercises, exerciseInstructionReviews } from "../shared/schema";
import { eq, and, isNotNull, isNull } from "drizzle-orm";

const isDryRun = process.argv.includes("--dry-run");

async function main() {
  console.log(`\n📝  Apply Exercise Instruction Reviews${isDryRun ? " [DRY RUN]" : ""}`);

  const pending = await db
    .select({ id: exerciseInstructionReviews.id, exerciseId: exerciseInstructionReviews.exerciseId, needsReview: exerciseInstructionReviews.needsReview, newInstructions: exerciseInstructionReviews.newInstructions })
    .from(exerciseInstructionReviews)
    .where(eq(exerciseInstructionReviews.status, "pending"));

  const matched = pending.filter((r) => !r.needsReview);
  const withCorrection = pending.filter((r) => r.needsReview && r.newInstructions);
  const parseErrors = pending.filter((r) => r.needsReview && !r.newInstructions);

  console.log(`\n    Pending rows          : ${pending.length}`);
  console.log(`    Already correct       : ${matched.length}`);
  console.log(`    Has correction        : ${withCorrection.length}`);
  console.log(`    Parse errors (reject) : ${parseErrors.length}\n`);

  if (isDryRun) {
    console.log("Dry run — no changes written.");
    process.exit(0);
  }

  if (pending.length === 0) {
    console.log("Nothing pending. All done.");
    process.exit(0);
  }

  // 1. Approve matched rows (no change to exercises table)
  if (matched.length > 0) {
    for (const r of matched) {
      await db.update(exerciseInstructionReviews).set({ status: "approved" }).where(eq(exerciseInstructionReviews.id, r.id));
    }
    console.log(`✅  Approved ${matched.length} matched rows (instructions were correct)`);
  }

  // 2. Apply corrections and approve
  let appliedCount = 0;
  for (const r of withCorrection) {
    await db.update(exercises).set({ instructions: r.newInstructions! }).where(eq(exercises.id, r.exerciseId));
    await db.update(exerciseInstructionReviews).set({ status: "approved" }).where(eq(exerciseInstructionReviews.id, r.id));
    appliedCount++;
  }
  if (appliedCount > 0) {
    console.log(`🔧  Applied corrections and approved ${appliedCount} rows`);
  }

  // 3. Reject parse errors
  if (parseErrors.length > 0) {
    for (const r of parseErrors) {
      await db.update(exerciseInstructionReviews).set({ status: "rejected" }).where(eq(exerciseInstructionReviews.id, r.id));
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
