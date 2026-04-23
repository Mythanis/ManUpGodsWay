/**
 * Exercise Instruction Audit Script
 * ===================================
 * Audits all 1,674 exercise demo videos against their written instructions
 * using Claude claude-sonnet-4-20250514 (multimodal vision).
 *
 * HOW TO RUN
 * ----------
 *   # Test on a small batch (still writes review rows; small runs skip the
 *   # confirm prompt):
 *   npx tsx scripts/audit-exercise-instructions.ts --limit 3
 *
 *   # Run on specific exercise IDs:
 *   npx tsx scripts/audit-exercise-instructions.ts --ids 2,5,10
 *
 *   # Full run (prompts for confirmation — ~1,674 Claude API calls):
 *   ANTHROPIC_API_KEY=sk-ant-... npx tsx scripts/audit-exercise-instructions.ts --confirm
 *
 *   # Re-process already-reviewed exercises:
 *   npx tsx scripts/audit-exercise-instructions.ts --limit 5 --force
 *
 *   # Override the system prompt sent to Claude:
 *   npx tsx scripts/audit-exercise-instructions.ts --limit 3 --system-prompt "..."
 *   npx tsx scripts/audit-exercise-instructions.ts --limit 3 --system-prompt-file ./prompt.txt
 *   AUDIT_SYSTEM_PROMPT="..." npx tsx scripts/audit-exercise-instructions.ts --limit 3
 *
 * REVIEWING FLAGGED ROWS
 * ----------------------
 *   SELECT * FROM exercise_instruction_reviews WHERE needs_review = true AND status = 'pending';
 *
 *   Once you approve a corrected instruction, run:
 *   UPDATE exercises SET instructions = r.new_instructions
 *   FROM exercise_instruction_reviews r
 *   WHERE exercises.id = r.exercise_id AND r.id = <review_id>;
 *
 *   UPDATE exercise_instruction_reviews SET status = 'approved' WHERE id = <review_id>;
 *
 * COST NOTE
 * ---------
 *   Each exercise sends 3 JPEG frames + ~200 tokens of text to Claude Sonnet.
 *   A full 1,674-exercise run is a real cost. Use --limit to test a small batch first.
 */

import Anthropic from "@anthropic-ai/sdk";
import { execSync, execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { db } from "../server/db";
import { exercises, exerciseInstructionReviews } from "../shared/schema";
import { eq, inArray } from "drizzle-orm";
import readline from "readline";

const DEFAULT_SYSTEM_PROMPT = `You are a fitness expert reviewing exercise instruction accuracy.
You will be shown three frames captured from an exercise demonstration video — one near the beginning, one near the middle, and one near the end.
Compare what the frames show to the written instructions provided.
If they match: respond with {"match": true}
If they don't match: respond with {"match": false, "corrected_instructions": "..."}
Base corrected instructions only on what you can see in the video frame.
Keep instructions to 2-3 concise steps.`;

const MODEL = "claude-sonnet-4-20250514";
const CONCURRENCY = 3;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    limit: 0,
    ids: [] as number[],
    force: false,
    confirm: false,
    concurrency: 0,
    systemPrompt: null as string | null,
    systemPromptFile: null as string | null,
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
    } else if (args[i] === "--system-prompt" && args[i + 1]) {
      opts.systemPrompt = args[++i];
    } else if (args[i] === "--system-prompt-file" && args[i + 1]) {
      opts.systemPromptFile = args[++i];
    }
  }
  return opts;
}

function resolveSystemPrompt(opts: ReturnType<typeof parseArgs>): string {
  if (opts.systemPrompt) return opts.systemPrompt;
  if (opts.systemPromptFile) {
    return fs.readFileSync(opts.systemPromptFile, "utf8").trim();
  }
  if (process.env.AUDIT_SYSTEM_PROMPT) return process.env.AUDIT_SYSTEM_PROMPT;
  return DEFAULT_SYSTEM_PROMPT;
}

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
  if (mediaFile.startsWith("/api/media/")) {
    return mediaFile.slice("/api/media/".length);
  }
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

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ex-audit-mp4-"));
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

interface FramePaths {
  tmpDir: string;
  frames: string[];
}

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

function extractFrames(mp4Path: string): FramePaths {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ex-audit-frames-"));
  const duration = getVideoDuration(mp4Path);
  const timestamps = [
    Math.max(0.1, duration * 0.05),
    duration * 0.5,
    Math.max(0, duration - 1),
  ];
  const frames: string[] = [];

  for (let i = 0; i < timestamps.length; i++) {
    const outPath = path.join(tmpDir, `frame${i}.jpg`);
    execFileSync(
      "ffmpeg",
      [
        "-ss", String(timestamps[i]),
        "-i", mp4Path,
        "-frames:v", "1",
        "-q:v", "5",
        "-y",
        outPath,
      ],
      { timeout: 30000, stdio: "ignore" }
    );
    if (fs.existsSync(outPath)) frames.push(outPath);
  }

  return { tmpDir, frames };
}

function cleanupTemp(dirs: string[]) {
  for (const dir of dirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {}
  }
}

interface ClaudeVerdict {
  match: boolean;
  correctedInstructions: string | null;
  rawResponse: string;
}

async function reviewWithClaude(
  client: Anthropic,
  systemPrompt: string,
  exerciseName: string,
  instructions: string,
  framePaths: string[]
): Promise<ClaudeVerdict> {
  const imageBlocks: Anthropic.ImageBlockParam[] = framePaths.map((fp) => ({
    type: "image",
    source: {
      type: "base64",
      media_type: "image/jpeg",
      data: fs.readFileSync(fp).toString("base64"),
    },
  }));

  const textBlock: Anthropic.TextBlockParam = {
    type: "text",
    text: `Exercise: ${exerciseName}\n\nCurrent instructions:\n${instructions}`,
  };

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [...imageBlocks, textBlock],
      },
    ],
  });

  const rawResponse =
    response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as Anthropic.TextBlock).text)
      .join("") || "";

  try {
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("no JSON found");
    const parsed = JSON.parse(jsonMatch[0]);

    return {
      match: parsed.match === true,
      correctedInstructions: parsed.corrected_instructions ?? null,
      rawResponse,
    };
  } catch {
    return { match: false, correctedInstructions: null, rawResponse };
  }
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      if (attempt === MAX_RETRIES) throw err;
      const isTransient =
        err?.status === 429 || err?.status >= 500 || err?.code === "ECONNRESET";
      if (!isTransient) throw err;
      const wait = RETRY_DELAY_MS * attempt;
      console.warn(`  [retry ${attempt}/${MAX_RETRIES}] ${label} — waiting ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw new Error("unreachable");
}

async function processExercise(
  client: Anthropic,
  systemPrompt: string,
  ex: { id: number; name: string; instructions: string; mediaFile: string },
  force: boolean
): Promise<"skipped" | "ok" | "flagged" | "error"> {
  if (!force) {
    const existing = await db
      .select({ id: exerciseInstructionReviews.id })
      .from(exerciseInstructionReviews)
      .where(eq(exerciseInstructionReviews.exerciseId, ex.id))
      .limit(1);
    if (existing.length > 0) return "skipped";
  }

  if (!ex.mediaFile) {
    console.warn(`  [skip] #${ex.id} ${ex.name} — no mediaFile`);
    return "skipped";
  }

  const objectPath = mediaFileToObjectPath(ex.mediaFile);
  const mp4Path = await downloadMp4ToTemp(objectPath);
  if (!mp4Path) {
    console.warn(`  [skip] #${ex.id} ${ex.name} — could not download MP4`);
    return "error";
  }

  const mp4TmpDir = path.dirname(mp4Path);
  let frameTmpDir: string | null = null;

  try {
    const { tmpDir, frames } = extractFrames(mp4Path);
    frameTmpDir = tmpDir;

    if (frames.length === 0) {
      console.warn(`  [skip] #${ex.id} ${ex.name} — frame extraction produced no frames`);
      return "error";
    }

    const verdict = await withRetry(
      () => reviewWithClaude(client, systemPrompt, ex.name, ex.instructions, frames),
      ex.name
    );

    if (force) {
      await db
        .delete(exerciseInstructionReviews)
        .where(eq(exerciseInstructionReviews.exerciseId, ex.id));
    }

    await db.insert(exerciseInstructionReviews).values({
      exerciseId: ex.id,
      exerciseName: ex.name,
      oldInstructions: ex.instructions,
      newInstructions: verdict.match ? null : verdict.correctedInstructions,
      needsReview: !verdict.match,
      rawModelResponse: verdict.rawResponse,
      status: "pending",
    });

    return verdict.match ? "ok" : "flagged";
  } finally {
    cleanupTemp([mp4TmpDir, frameTmpDir ?? ""].filter(Boolean));
  }
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
        "    Add it to your environment secrets, then re-run:\n" +
        "    ANTHROPIC_API_KEY=sk-ant-... npx tsx scripts/audit-exercise-instructions.ts --limit 3\n"
    );
    process.exit(1);
  }

  const opts = parseArgs();
  const systemPrompt = resolveSystemPrompt(opts);
  const promptSource = opts.systemPrompt
    ? "--system-prompt flag"
    : opts.systemPromptFile
    ? `--system-prompt-file ${opts.systemPromptFile}`
    : process.env.AUDIT_SYSTEM_PROMPT
    ? "AUDIT_SYSTEM_PROMPT env var"
    : "default";
  const client = new Anthropic({ apiKey });

  let allExercises: { id: number; name: string; instructions: string; mediaFile: string }[];

  if (opts.ids.length > 0) {
    allExercises = await db
      .select({
        id: exercises.id,
        name: exercises.name,
        instructions: exercises.instructions,
        mediaFile: exercises.mediaFile,
      })
      .from(exercises)
      .where(inArray(exercises.id, opts.ids));
  } else {
    allExercises = await db
      .select({
        id: exercises.id,
        name: exercises.name,
        instructions: exercises.instructions,
        mediaFile: exercises.mediaFile,
      })
      .from(exercises)
      .orderBy(exercises.id);
  }

  const batch = opts.limit > 0 ? allExercises.slice(0, opts.limit) : allExercises;
  const total = batch.length;
  const isFull = total > 50;

  console.log(`\n📋  Exercise Instruction Audit`);
  console.log(`    Model   : ${MODEL}`);
  console.log(`    Total   : ${total} exercises`);
  console.log(`    Requests: ~${total} (3 frames per exercise, 1 Claude call each)`);
  console.log(`    Force   : ${opts.force ? "yes (will overwrite existing reviews)" : "no"}`);
  console.log(`    Prompt  : ${promptSource}`);
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
  let flagged = 0;
  let skipped = 0;
  let errors = 0;

  async function worker(queue: typeof batch) {
    while (queue.length > 0) {
      const ex = queue.shift()!;
      done++;
      process.stdout.write(
        `\r[${done}/${total}] ${ex.name.slice(0, 40).padEnd(40)} | ✅ ${done - flagged - skipped - errors}  ⚠️  ${flagged}  ⏭  ${skipped}  ❌ ${errors}`
      );

      const result = await processExercise(client, systemPrompt, ex, opts.force).catch((err) => {
        console.error(`\n  [error] #${ex.id} ${ex.name}:`, err.message);
        return "error" as const;
      });

      if (result === "flagged") flagged++;
      else if (result === "skipped") skipped++;
      else if (result === "error") errors++;
    }
  }

  const queue = [...batch];
  const concurrencyLimit = opts.concurrency > 0 ? opts.concurrency : CONCURRENCY;
  const workers = Array.from({ length: Math.min(concurrencyLimit, total) }, () => worker(queue));
  await Promise.all(workers);

  const matched = done - flagged - skipped - errors;
  console.log(`\n\n✅  Done.`);
  console.log(`    Matched        : ${matched}`);
  console.log(`    Flagged        : ${flagged}  ← needs_review = true`);
  console.log(`    Skipped        : ${skipped}`);
  console.log(`    Errors         : ${errors}`);

  if (flagged > 0) {
    console.log(`\n💡  To inspect flagged exercises:`);
    console.log(
      `    SELECT id, exercise_id, exercise_name, needs_review, status, new_instructions\n` +
        `    FROM exercise_instruction_reviews\n` +
        `    WHERE needs_review = true AND status = 'pending'\n` +
        `    ORDER BY exercise_id;`
    );
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("\n[fatal]", err);
  process.exit(1);
});
