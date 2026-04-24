/**
 * Exercise Re-classification Script (Claude Opus — Combined Pass)
 * ==============================================================
 * Uses Claude Opus to classify EVERY exercise in the library in a single API
 * call that watches the full demo video and returns three things at once:
 *
 *   1. Sidedness      — bilateral / unilateral / alternating
 *   2. Instructions   — whether the current instructions match the video, plus
 *                       a corrected version when they don't
 *   3. Confidence     — high / medium / low for both verdicts
 *
 * Results land in BOTH review tables (exercise_sidedness_reviews and
 * exercise_instruction_reviews).  No changes are written directly to the
 * exercises table — all changes go through the admin review UIs.
 *
 * HOW TO RUN
 * ----------
 *   # Smoke test on a tiny batch (skip the confirm gate):
 *   npx tsx scripts/reclassify-exercises.ts --limit 3
 *
 *   # Run on specific exercise IDs:
 *   npx tsx scripts/reclassify-exercises.ts --ids 614,844,892
 *
 *   # Full run (prompts for confirmation):
 *   npx tsx scripts/reclassify-exercises.ts --confirm
 *
 *   # Re-process exercises that already have pending rows (overwrite):
 *   npx tsx scripts/reclassify-exercises.ts --limit 5 --force
 *
 *   # Lower concurrency for slow connections:
 *   npx tsx scripts/reclassify-exercises.ts --limit 10 --concurrency 1
 *
 * RATE LIMITS
 * -----------
 *   Opus tier-1: ~50 req/min but much lower token/min budget than Sonnet.
 *   Each call sends ~10-12 JPEG frames, so we target 20 req/min and concurrency 2
 *   by default.  Use --concurrency and the RATE_LIMIT_PER_MIN constant to tune.
 *
 * COST NOTE
 * ---------
 *   Each call sends ~10-12 frames + ~200 tokens of text to Claude Opus.
 *   Opus is significantly more expensive than Sonnet.
 *   A full 1,674-exercise run is a real cost.  Always use --limit first.
 *
 * REVIEWING
 * ---------
 *   Admin → Sidedness Reviews   to approve/reject the sidedness verdicts.
 *   Admin → Instruction Reviews to review the instruction corrections.
 */

import Anthropic from "@anthropic-ai/sdk";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { db } from "../server/db";
import {
  exercises,
  exerciseSidednessReviews,
  exerciseInstructionReviews,
} from "../shared/schema";
import { eq, inArray, notInArray, or } from "drizzle-orm";
import readline from "readline";
import {
  OPUS_MODEL,
  MAX_RETRIES,
  RETRY_DELAY_MS,
  callOpusCombined,
  withRetry,
  type OpusVerdict,
} from "../server/exerciseOpusJob";

const DEFAULT_CONCURRENCY = 2;
const RATE_LIMIT_PER_MIN = 20; // conservative for Opus + large image payloads
const MAX_FRAMES = 12;
const CONFIRM_THRESHOLD = 50; // run --confirm for batches larger than this

// ── Token bucket rate limiter ─────────────────────────────────────────────────
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

    const waitMs = Math.ceil((1 - this.tokens) / this.refillRatePerMs);
    await new Promise((r) => setTimeout(r, waitMs));
    this.tokens = 0;
    this.lastRefill = Date.now();
  }
}

const rateLimiter = new TokenBucket(RATE_LIMIT_PER_MIN);

// ── CLI args ──────────────────────────────────────────────────────────────────
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

// ── Object-storage helpers ────────────────────────────────────────────────────
function getBucketName(): string {
  const paths = (process.env.PUBLIC_OBJECT_SEARCH_PATHS || "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (!paths.length) throw new Error("PUBLIC_OBJECT_SEARCH_PATHS is not set");
  const bucketName = paths[0].split("/").filter(Boolean)[0];
  if (!bucketName) throw new Error("Cannot parse bucket name from PUBLIC_OBJECT_SEARCH_PATHS");
  return bucketName;
}

function mediaFileToObjectPath(mediaFile: string): string {
  if (mediaFile.startsWith("/api/media/")) return mediaFile.slice("/api/media/".length);
  return mediaFile;
}

async function downloadMp4ToTemp(objectPath: string): Promise<string | null> {
  try {
    const { objectStorageClient } = await import(
      "../server/replit_integrations/object_storage/objectStorage"
    );
    const bucketName = getBucketName();
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectPath);
    const [exists] = await file.exists();
    if (!exists) return null;

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "opus-mp4-"));
    const localPath = path.join(tmpDir, "video.mp4");

    await new Promise<void>((resolve, reject) => {
      const ws = fs.createWriteStream(localPath);
      file.createReadStream().pipe(ws);
      ws.on("finish", resolve);
      ws.on("error", reject);
    });

    return localPath;
  } catch (err) {
    console.warn("  [download error]", (err as Error).message);
    return null;
  }
}

// ── Frame extraction ──────────────────────────────────────────────────────────
function getVideoDuration(mp4Path: string): number {
  try {
    const out = execFileSync(
      "ffprobe",
      [
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        mp4Path,
      ],
      { encoding: "utf8", timeout: 30000 }
    );
    return parseFloat(out.trim()) || 5;
  } catch {
    return 5;
  }
}

/**
 * Extract up to MAX_FRAMES evenly-spaced frames from the full video so Opus
 * can see the entire movement arc (not just start / middle / end).
 */
function extractFrames(mp4Path: string, maxFrames = MAX_FRAMES): { tmpDir: string; frames: string[] } {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "opus-frames-"));
  const duration = getVideoDuration(mp4Path);

  // Generate evenly-spaced timestamps across [5%, 95%] of the video
  const n = Math.min(maxFrames, Math.max(3, Math.ceil(duration * 1.5)));
  const timestamps: number[] = Array.from({ length: n }, (_, i) => {
    const frac = 0.05 + (0.90 * i) / Math.max(n - 1, 1);
    return Math.max(0.1, Math.min(duration - 0.1, frac * duration));
  });

  const frames: string[] = [];

  for (let i = 0; i < timestamps.length; i++) {
    const outPath = path.join(tmpDir, `frame${i}.jpg`);
    try {
      execFileSync(
        "ffmpeg",
        [
          "-ss", String(timestamps[i]),
          "-i", mp4Path,
          "-frames:v", "1",
          "-q:v", "5",
          "-vf", "scale=480:-1",
          "-y",
          outPath,
        ],
        { timeout: 30000, stdio: "ignore" }
      );
      if (fs.existsSync(outPath)) frames.push(outPath);
    } catch {}
  }

  return { tmpDir, frames };
}

function cleanupDirs(dirs: string[]) {
  for (const d of dirs) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch {}
  }
}

// ── Core per-exercise processing ──────────────────────────────────────────────
type ProcessResult = "ok" | "skipped" | "error";

async function processExercise(
  client: Anthropic,
  ex: {
    id: number;
    name: string;
    instructions: string;
    bodyPart: string;
    equipment: string;
    mediaFile: string;
  },
  force: boolean
): Promise<ProcessResult> {
  // Skip check — skip if BOTH tables already have a non-rejected row for this exercise
  // (unless --force is set)
  if (!force) {
    const sidednessRow = await db
      .select({ status: exerciseSidednessReviews.status })
      .from(exerciseSidednessReviews)
      .where(eq(exerciseSidednessReviews.exerciseId, ex.id))
      .limit(1);

    const instructionRow = await db
      .select({ status: exerciseInstructionReviews.status })
      .from(exerciseInstructionReviews)
      .where(eq(exerciseInstructionReviews.exerciseId, ex.id))
      .limit(1);

    const sideHasRow = sidednessRow.length > 0 && sidednessRow[0].status !== "rejected";
    const instrHasRow = instructionRow.length > 0 && instructionRow[0].status !== "rejected";

    if (sideHasRow && instrHasRow) return "skipped";
  }

  if (!ex.mediaFile) {
    console.warn(`\n  [skip] #${ex.id} ${ex.name} — no mediaFile`);
    return "skipped";
  }

  const objectPath = mediaFileToObjectPath(ex.mediaFile);
  const mp4Path = await downloadMp4ToTemp(objectPath);
  if (!mp4Path) {
    console.warn(`\n  [skip] #${ex.id} ${ex.name} — could not download MP4`);
    return "error";
  }

  const mp4TmpDir = path.dirname(mp4Path);
  let frameTmpDir: string | null = null;

  try {
    const { tmpDir, frames } = extractFrames(mp4Path);
    frameTmpDir = tmpDir;

    if (frames.length === 0) {
      console.warn(`\n  [skip] #${ex.id} ${ex.name} — frame extraction produced no frames`);
      return "error";
    }

    // Rate-limit before the API call
    await rateLimiter.acquire();

    const verdict: OpusVerdict = await withRetry(
      () => callOpusCombined(client, ex, frames),
      ex.name
    );

    // Upsert sidedness review row — preserve approved rows unless --force
    const [existingSide] = await db
      .select({ status: exerciseSidednessReviews.status })
      .from(exerciseSidednessReviews)
      .where(eq(exerciseSidednessReviews.exerciseId, ex.id))
      .limit(1);

    if (!force && existingSide?.status === "approved") {
      // Keep the approved verdict; only refresh instruction review
    } else {
      await db
        .delete(exerciseSidednessReviews)
        .where(eq(exerciseSidednessReviews.exerciseId, ex.id));
      await db.insert(exerciseSidednessReviews).values({
        exerciseId: ex.id,
        exerciseName: ex.name,
        proposedSidedness: verdict.sidedness,
        reasoning: verdict.sidednessReasoning,
        confidence: verdict.sidednessConfidence,
        rawModelResponse: verdict.rawResponse,
        status: "pending",
      });
    }

    // Upsert instruction review row — preserve approved rows unless --force
    const [existingInstr] = await db
      .select({ status: exerciseInstructionReviews.status })
      .from(exerciseInstructionReviews)
      .where(eq(exerciseInstructionReviews.exerciseId, ex.id))
      .limit(1);

    if (!force && existingInstr?.status === "approved") {
      // Keep the approved instruction correction; don't overwrite
    } else {
      await db
        .delete(exerciseInstructionReviews)
        .where(eq(exerciseInstructionReviews.exerciseId, ex.id));
      await db.insert(exerciseInstructionReviews).values({
        exerciseId: ex.id,
        exerciseName: ex.name,
        oldInstructions: ex.instructions,
        newInstructions: verdict.instructionsMatch ? null : verdict.correctedInstructions,
        needsReview: !verdict.instructionsMatch,
        confidence: verdict.instructionsConfidence,
        rawModelResponse: verdict.rawResponse,
        status: "pending",
      });
    }

    return "ok";
  } finally {
    cleanupDirs([mp4TmpDir, frameTmpDir ?? ""].filter(Boolean));
  }
}

// ── Confirm prompt ────────────────────────────────────────────────────────────
async function confirmPrompt(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (ans) => {
      rl.close();
      resolve(ans.trim().toLowerCase() === "y");
    });
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
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

  // ── Load exercise batch ──────────────────────────────────────────────────
  let allExercises: {
    id: number;
    name: string;
    instructions: string;
    bodyPart: string;
    equipment: string;
    mediaFile: string;
  }[];

  const selectCols = {
    id: exercises.id,
    name: exercises.name,
    instructions: exercises.instructions,
    bodyPart: exercises.bodyPart,
    equipment: exercises.equipment,
    mediaFile: exercises.mediaFile,
  } as const;

  if (opts.ids.length > 0) {
    allExercises = await db
      .select(selectCols)
      .from(exercises)
      .where(inArray(exercises.id, opts.ids));
  } else if (!opts.force) {
    // Skip exercises that already have BOTH tables filled (non-rejected)
    const sidednessSkip = await db
      .select({ exerciseId: exerciseSidednessReviews.exerciseId })
      .from(exerciseSidednessReviews)
      .where(or(
        eq(exerciseSidednessReviews.status, "pending"),
        eq(exerciseSidednessReviews.status, "approved"),
      ));

    const instructionSkip = await db
      .select({ exerciseId: exerciseInstructionReviews.exerciseId })
      .from(exerciseInstructionReviews)
      .where(or(
        eq(exerciseInstructionReviews.status, "pending"),
        eq(exerciseInstructionReviews.status, "approved"),
      ));

    // Only skip exercises that have BOTH rows already (they truly need no re-run)
    const sideIds = new Set(sidednessSkip.map((r) => r.exerciseId));
    const instrIds = new Set(instructionSkip.map((r) => r.exerciseId));
    const bothDoneIds = [...sideIds].filter((id) => instrIds.has(id));

    allExercises = await db
      .select(selectCols)
      .from(exercises)
      .where(bothDoneIds.length > 0 ? notInArray(exercises.id, bothDoneIds) : undefined)
      .orderBy(exercises.id);
  } else {
    allExercises = await db
      .select(selectCols)
      .from(exercises)
      .orderBy(exercises.id);
  }

  const batch = opts.limit > 0 ? allExercises.slice(0, opts.limit) : allExercises;
  const total = batch.length;

  if (total === 0) {
    console.log("\n✅  All exercises already have reviews in both tables. Use --force to re-classify.");
    process.exit(0);
  }

  const concurrencyLimit = opts.concurrency > 0 ? opts.concurrency : DEFAULT_CONCURRENCY;
  const estMinutes = Math.ceil(total / RATE_LIMIT_PER_MIN);

  console.log(`\n🏋️  Exercise Re-classifier (Opus + Full Video)`);
  console.log(`    Model         : ${OPUS_MODEL}`);
  console.log(`    Total         : ${total} exercises`);
  console.log(`    Frames/video  : up to ${MAX_FRAMES} evenly spaced`);
  console.log(`    Rate limit    : ${RATE_LIMIT_PER_MIN} req/min`);
  console.log(`    Concurrency   : ${concurrencyLimit}`);
  console.log(`    Est. time     : ~${estMinutes} min at full rate`);
  console.log(`    Force         : ${opts.force ? "yes (re-classifies all)" : "no (skip if both tables filled)"}`);
  console.log();

  if (total > CONFIRM_THRESHOLD && !opts.confirm) {
    // Rough cost estimate: ~$0.20/exercise (12 image frames × ~1K tokens each + text, Opus pricing)
    const estCost = (total * 0.20).toFixed(0);
    const go = await confirmPrompt(
      `⚠️  This will send ${total} requests to Claude Opus (real cost — more expensive than Sonnet).\n` +
      `   Rough estimate: ~$${estCost} USD at current Opus pricing (~$0.20/exercise with video frames).\n` +
      `   Pass --limit N to process a smaller batch first.\n   Continue? [y/N] `
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
        `\r[${done}/${total}] ${ex.name.slice(0, 40).padEnd(40)} | ✅ ${classified}  ⏭  ${skipped}  ❌ ${errors}`
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
  const workers = Array.from(
    { length: Math.min(concurrencyLimit, total) },
    () => worker(queue)
  );
  await Promise.all(workers);

  console.log(`\n\n✅  Done.`);
  console.log(`    Classified : ${classified}  (wrote to both review tables)`);
  console.log(`    Skipped    : ${skipped}`);
  console.log(`    Errors     : ${errors}`);
  console.log(`\n💡  Go to Admin → Sidedness Reviews to approve/reject sidedness verdicts.`);
  console.log(`💡  Go to Admin → Instruction Reviews to approve/reject instruction corrections.`);

  process.exit(0);
}

main().catch((err) => {
  console.error("\n[fatal]", err);
  process.exit(1);
});
