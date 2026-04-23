/**
 * Exercise Sidedness Classification Script
 * =========================================
 * Uses Claude to classify every exercise in the library as bilateral,
 * unilateral, or alternating. Verdicts go into the exercise_sidedness_reviews
 * table so an admin can approve/reject each one before it is written to the
 * live exercises.sidedness column.
 *
 * HOW TO RUN
 * ----------
 *   # Test on a small batch:
 *   npx tsx scripts/classify-exercise-sidedness.ts --limit 5
 *
 *   # Run on specific exercise IDs:
 *   npx tsx scripts/classify-exercise-sidedness.ts --ids 1,2,3
 *
 *   # Full run (prompts for confirmation):
 *   npx tsx scripts/classify-exercise-sidedness.ts --confirm
 *
 *   # Re-process exercises that already have a review (overwrite pending only):
 *   npx tsx scripts/classify-exercise-sidedness.ts --limit 5 --force
 *
 * REVIEWING
 * ---------
 *   Go to Admin → Sidedness Reviews to approve/reject/change each verdict.
 *   Approving writes the chosen value to exercises.sidedness immediately.
 */

import Anthropic from "@anthropic-ai/sdk";
import { db } from "../server/db";
import { exercises, exerciseSidednessReviews } from "../shared/schema";
import { eq, inArray, notInArray, or } from "drizzle-orm";
import readline from "readline";
import {
  MODEL,
  MAX_RETRIES,
  RETRY_DELAY_MS,
  callClaude,
  withRetry,
  type SidednessValue,
  type ClaudeVerdict,
} from "../server/exerciseSidednessJob";

const CONCURRENCY = 5;

// ── Rate limiter ──────────────────────────────────────────────────────────────
// Claude's tier-1 limit is 50 req/min for claude-sonnet-4-20250514.
// We cap ourselves at 45/min (10% buffer) using a simple token bucket so the
// concurrent workers don't pile up 429s, especially on a full 1,674-exercise run.
const RATE_LIMIT_PER_MIN = 45;

class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly refillRatePerMs: number;
  private readonly max: number;

  constructor(perMinute: number) {
    this.max = perMinute;
    this.tokens = perMinute;
    this.lastRefill = Date.now();
    this.refillRatePerMs = perMinute / 60_000;
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.max, this.tokens + elapsed * this.refillRatePerMs);
    this.lastRefill = now;

    if (this.tokens >= 1) {
      this.tokens--;
      return;
    }

    // Wait until we have at least one token
    const waitMs = Math.ceil((1 - this.tokens) / this.refillRatePerMs);
    await new Promise((r) => setTimeout(r, waitMs));
    this.tokens = 0;
    this.lastRefill = Date.now();
  }
}

const rateLimiter = new TokenBucket(RATE_LIMIT_PER_MIN);

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    limit: 0,
    ids: [] as number[],
    force: false,
    confirm: false,
    concurrency: 0,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) {
      opts.limit = parseInt(args[++i], 10);
    } else if (args[i] === "--ids" && args[i + 1]) {
      opts.ids = args[++i].split(",").map((n) => parseInt(n.trim(), 10));
    } else if (args[i] === "--force") {
      opts.force = true;
    } else if (args[i] === "--confirm") {
      opts.confirm = true;
    } else if (args[i] === "--concurrency" && args[i + 1]) {
      opts.concurrency = parseInt(args[++i], 10);
    }
  }
  return opts;
}

/** Acquire a rate-limit token then delegate to the shared callClaude helper. */
async function classify(
  client: Anthropic,
  ex: { id: number; name: string; instructions: string; bodyPart: string; equipment: string }
): Promise<ClaudeVerdict> {
  // Acquire a rate-limit token before every API call to stay under 50 req/min
  await rateLimiter.acquire();
  return callClaude(client, ex);
}

async function processExercise(
  client: Anthropic,
  ex: { id: number; name: string; instructions: string; bodyPart: string; equipment: string },
  force: boolean
): Promise<"skipped" | "ok"> {
  if (!force) {
    const existing = await db
      .select({ id: exerciseSidednessReviews.id, status: exerciseSidednessReviews.status })
      .from(exerciseSidednessReviews)
      .where(eq(exerciseSidednessReviews.exerciseId, ex.id))
      .limit(1);
    // Skip pending/approved rows — only re-classify exercises the admin has rejected
    if (existing.length > 0 && existing[0].status !== "rejected") return "skipped";
  }

  const verdict = await withRetry(() => classify(client, ex), ex.name);

  await db
    .delete(exerciseSidednessReviews)
    .where(eq(exerciseSidednessReviews.exerciseId, ex.id));

  await db.insert(exerciseSidednessReviews).values({
    exerciseId: ex.id,
    exerciseName: ex.name,
    proposedSidedness: verdict.sidedness,
    reasoning: verdict.reasoning,
    confidence: verdict.confidence,
    rawModelResponse: verdict.rawResponse,
    status: "pending",
  });

  return "ok";
}

async function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (ans) => {
      rl.close();
      resolve(ans.trim().toLowerCase() === "y");
    });
  });
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error(
      "\n❌  ANTHROPIC_API_KEY is not set.\n" +
        "    Add it to your environment secrets, then re-run.\n"
    );
    process.exit(1);
  }

  const opts = parseArgs();
  const client = new Anthropic({ apiKey });

  let allExercises: { id: number; name: string; instructions: string; bodyPart: string; equipment: string }[];

  if (opts.ids.length > 0) {
    allExercises = await db
      .select({
        id: exercises.id,
        name: exercises.name,
        instructions: exercises.instructions,
        bodyPart: exercises.bodyPart,
        equipment: exercises.equipment,
      })
      .from(exercises)
      .where(inArray(exercises.id, opts.ids));
  } else if (!opts.force) {
    // Exclude exercises that already have a pending or approved review.
    // Rejected rows are intentionally included so the admin can re-run the
    // script to get a fresh classification for anything they rejected.
    const skipReviews = await db
      .select({ exerciseId: exerciseSidednessReviews.exerciseId })
      .from(exerciseSidednessReviews)
      .where(or(
        eq(exerciseSidednessReviews.status, "pending"),
        eq(exerciseSidednessReviews.status, "approved"),
      ));
    const skipIds = skipReviews.map((r) => r.exerciseId);

    allExercises = await db
      .select({
        id: exercises.id,
        name: exercises.name,
        instructions: exercises.instructions,
        bodyPart: exercises.bodyPart,
        equipment: exercises.equipment,
      })
      .from(exercises)
      .where(skipIds.length > 0 ? notInArray(exercises.id, skipIds) : undefined)
      .orderBy(exercises.id);
  } else {
    allExercises = await db
      .select({
        id: exercises.id,
        name: exercises.name,
        instructions: exercises.instructions,
        bodyPart: exercises.bodyPart,
        equipment: exercises.equipment,
      })
      .from(exercises)
      .orderBy(exercises.id);
  }

  const batch = opts.limit > 0 ? allExercises.slice(0, opts.limit) : allExercises;
  const total = batch.length;
  const isFull = total > 50;

  if (total === 0) {
    console.log("\n✅  All exercises already have a sidedness review. Use --force to re-classify.");
    process.exit(0);
  }

  console.log(`\n🏋️  Exercise Sidedness Classifier`);
  console.log(`    Model      : ${MODEL}`);
  console.log(`    Total      : ${total} exercises`);
  console.log(`    Force      : ${opts.force ? "yes (re-classifies all)" : "no (skip already reviewed)"}`);
  console.log();

  if (isFull && !opts.confirm) {
    const go = await confirm(
      `⚠️  This will send ${total} requests to the Claude API (real cost).\n   Continue? [y/N] `
    );
    if (!go) {
      console.log("Aborted.");
      process.exit(0);
    }
    console.log();
  }

  let done = 0;
  let classified = 0;
  let skipped = 0;
  let errors = 0;

  async function worker(queue: typeof batch) {
    while (queue.length > 0) {
      const ex = queue.shift()!;
      done++;
      process.stdout.write(
        `\r[${done}/${total}] ${ex.name.slice(0, 42).padEnd(42)} | ✅ ${classified}  ⏭  ${skipped}  ❌ ${errors}`
      );

      const result = await processExercise(client, ex, opts.force).catch((err: Error) => {
        console.error(`\n  [error] #${ex.id} ${ex.name}:`, err.message);
        errors++;
        return "error" as const;
      });

      if (result === "ok") classified++;
      else if (result === "skipped") skipped++;
    }
  }

  const queue = [...batch];
  const concurrencyLimit = opts.concurrency > 0 ? opts.concurrency : CONCURRENCY;
  const workers = Array.from({ length: Math.min(concurrencyLimit, total) }, () => worker(queue));
  await Promise.all(workers);

  console.log(`\n\n✅  Done.`);
  console.log(`    Classified : ${classified}`);
  console.log(`    Skipped    : ${skipped}`);
  console.log(`    Errors     : ${errors}`);
  console.log(`\n💡  Go to Admin → Sidedness Reviews to approve/reject the queue.`);

  process.exit(0);
}

main().catch((err) => {
  console.error("\n[fatal]", err);
  process.exit(1);
});
