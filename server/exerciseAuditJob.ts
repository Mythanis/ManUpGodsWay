/**
 * Exercise Instruction Audit — Server-side background job
 * Processes exercises in the existing Express server process so it can run
 * indefinitely without bash time-limits. Triggered via admin API.
 */

import Anthropic from "@anthropic-ai/sdk";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { db } from "./db";
import { exercises, exerciseInstructionReviews } from "../shared/schema";
import { eq, isNull, or, and } from "drizzle-orm";

const MODEL = "claude-sonnet-4-20250514";
const CONCURRENCY = 6;
const MAX_RETRIES = 4;
const BASE_RETRY_MS = 5000;

const SYSTEM_PROMPT = `You are a fitness expert reviewing exercise instruction accuracy.
You will be shown three frames captured from an exercise demonstration video — one near the beginning, one near the middle, and one near the end.
Compare what the frames show to the written instructions provided.
If they match: respond with {"match": true}
If they don't match: respond with {"match": false, "corrected_instructions": "..."}
Base corrected instructions only on what you can see in the video frames.
Keep instructions to 2-3 concise steps.`;

export interface AuditJobStatus {
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  total: number;
  processed: number;
  matched: number;
  flagged: number;
  errors: number;
  skipped: number;
  error: string | null;
}

let jobState: AuditJobStatus = {
  running: false,
  startedAt: null,
  finishedAt: null,
  total: 0,
  processed: 0,
  matched: 0,
  flagged: 0,
  errors: 0,
  skipped: 0,
  error: null,
};

export function getAuditJobStatus(): AuditJobStatus {
  return { ...jobState };
}

export function isAuditJobRunning(): boolean {
  return jobState.running;
}

function getBucketName(): string {
  const paths = (process.env.PUBLIC_OBJECT_SEARCH_PATHS || "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (!paths.length) throw new Error("PUBLIC_OBJECT_SEARCH_PATHS is not set");
  const bucketName = paths[0].split("/").filter(Boolean)[0];
  if (!bucketName) throw new Error("Cannot parse bucket from PUBLIC_OBJECT_SEARCH_PATHS");
  return bucketName;
}

function mediaFileToObjectPath(mediaFile: string): string {
  if (mediaFile.startsWith("/api/media/")) return mediaFile.slice("/api/media/".length);
  return mediaFile;
}

async function downloadMp4(objectPath: string): Promise<string | null> {
  try {
    const { objectStorageClient } = await import(
      "./replit_integrations/object_storage/objectStorage"
    );
    const bucket = objectStorageClient.bucket(getBucketName());
    const file = bucket.file(objectPath);
    const [exists] = await file.exists();
    if (!exists) return null;

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "audit-mp4-"));
    const localPath = path.join(tmpDir, "video.mp4");
    await new Promise<void>((resolve, reject) => {
      const ws = fs.createWriteStream(localPath);
      file.createReadStream().pipe(ws);
      ws.on("finish", resolve);
      ws.on("error", reject);
    });
    return localPath;
  } catch {
    return null;
  }
}

function getVideoDuration(mp4Path: string): number {
  try {
    const out = execFileSync(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", mp4Path],
      { encoding: "utf8", timeout: 30000 }
    );
    return parseFloat(out.trim()) || 5;
  } catch {
    return 5;
  }
}

function extractFrames(mp4Path: string): { tmpDir: string; frames: string[] } {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "audit-frames-"));
  const duration = getVideoDuration(mp4Path);
  const timestamps = [
    Math.max(0.1, duration * 0.05),
    duration * 0.5,
    Math.max(0, duration - 1),
  ];
  const frames: string[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const outPath = path.join(tmpDir, `frame${i}.jpg`);
    try {
      execFileSync("ffmpeg", ["-ss", String(timestamps[i]), "-i", mp4Path, "-frames:v", "1", "-q:v", "5", "-vf", "scale=480:-1", "-y", outPath], {
        timeout: 30000,
        stdio: "ignore",
      });
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

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      if (attempt === MAX_RETRIES) throw err;
      const isTransient = err?.status === 429 || (err?.status ?? 0) >= 500 || err?.code === "ECONNRESET";
      if (!isTransient) throw err;
      const wait = BASE_RETRY_MS * attempt;
      console.warn(`[exercise-audit] Retry ${attempt}/${MAX_RETRIES} after ${wait}ms (${err?.status ?? err?.code})`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw new Error("unreachable");
}

async function reviewWithClaude(
  client: Anthropic,
  name: string,
  instructions: string,
  frames: string[]
): Promise<{ match: boolean; correctedInstructions: string | null; raw: string }> {
  const imageBlocks: Anthropic.ImageBlockParam[] = frames.map((fp) => ({
    type: "image",
    source: { type: "base64", media_type: "image/jpeg", data: fs.readFileSync(fp).toString("base64") },
  }));

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: [...imageBlocks, { type: "text", text: `Exercise: ${name}\n\nCurrent instructions:\n${instructions}` }] }],
  });

  const raw = response.content.filter((b) => b.type === "text").map((b) => (b as Anthropic.TextBlock).text).join("") || "";
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("no JSON");
    const parsed = JSON.parse(m[0]);
    return { match: parsed.match === true, correctedInstructions: parsed.match === true ? null : (parsed.corrected_instructions ?? null), raw };
  } catch {
    return { match: false, correctedInstructions: null, raw };
  }
}

async function processOne(
  client: Anthropic,
  ex: { id: number; name: string; instructions: string; mediaFile: string },
  force: boolean
): Promise<"skipped" | "matched" | "flagged" | "error"> {
  if (!force) {
    const existing = await db.select({ id: exerciseInstructionReviews.id }).from(exerciseInstructionReviews).where(eq(exerciseInstructionReviews.exerciseId, ex.id)).limit(1);
    if (existing.length > 0) return "skipped";
  }

  if (!ex.mediaFile) return "skipped";

  const mp4Path = await downloadMp4(mediaFileToObjectPath(ex.mediaFile));
  if (!mp4Path) return "error";

  const mp4TmpDir = path.dirname(mp4Path);
  let frameTmpDir: string | null = null;
  try {
    const { tmpDir, frames } = extractFrames(mp4Path);
    frameTmpDir = tmpDir;
    if (frames.length === 0) return "error";

    const verdict = await withRetry(() => reviewWithClaude(client, ex.name, ex.instructions, frames));

    if (force) {
      await db.delete(exerciseInstructionReviews).where(eq(exerciseInstructionReviews.exerciseId, ex.id));
    }

    await db.insert(exerciseInstructionReviews).values({
      exerciseId: ex.id,
      exerciseName: ex.name,
      oldInstructions: ex.instructions,
      newInstructions: verdict.match ? null : verdict.correctedInstructions,
      needsReview: !verdict.match,
      rawModelResponse: verdict.raw,
      status: "pending",
    }).onConflictDoUpdate({
      target: exerciseInstructionReviews.exerciseId,
      set: {
        exerciseName: ex.name,
        oldInstructions: ex.instructions,
        newInstructions: verdict.match ? null : verdict.correctedInstructions,
        needsReview: !verdict.match,
        rawModelResponse: verdict.raw,
        status: "pending",
      },
    });

    return verdict.match ? "matched" : "flagged";
  } finally {
    cleanupDirs([mp4TmpDir, frameTmpDir ?? ""].filter(Boolean));
  }
}

export async function auditSingleExercise(exerciseId: number): Promise<{ result: string; exerciseName: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const rows = await db
    .select({ id: exercises.id, name: exercises.name, instructions: exercises.instructions, mediaFile: exercises.mediaFile })
    .from(exercises)
    .where(eq(exercises.id, exerciseId));

  if (!rows.length) throw new Error(`Exercise #${exerciseId} not found`);

  const ex = rows[0];
  const client = new Anthropic({ apiKey });
  const result = await processOne(client, ex, true);
  return { result, exerciseName: ex.name };
}

export async function startAuditJob(force = false): Promise<void> {
  if (jobState.running) throw new Error("Audit job is already running");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const allExercises = await db
    .select({ id: exercises.id, name: exercises.name, instructions: exercises.instructions, mediaFile: exercises.mediaFile })
    .from(exercises)
    .orderBy(exercises.id);

  jobState = {
    running: true,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    total: allExercises.length,
    processed: 0,
    matched: 0,
    flagged: 0,
    errors: 0,
    skipped: 0,
    error: null,
  };

  const client = new Anthropic({ apiKey });
  console.log(`[exercise-audit] Starting: ${allExercises.length} exercises, concurrency=${CONCURRENCY}`);

  (async () => {
    try {
      const queue = [...allExercises];

      async function worker() {
        while (queue.length > 0) {
          const ex = queue.shift()!;
          try {
            const result = await processOne(client, ex, force);
            jobState.processed++;
            if (result === "matched") jobState.matched++;
            else if (result === "flagged") jobState.flagged++;
            else if (result === "error") jobState.errors++;
            else jobState.skipped++;
          } catch (err: any) {
            console.error(`[exercise-audit] Error on #${ex.id} ${ex.name}:`, err.message);
            jobState.processed++;
            jobState.errors++;
          }
          if (jobState.processed % 50 === 0) {
            console.log(`[exercise-audit] Progress: ${jobState.processed}/${jobState.total} (flagged=${jobState.flagged}, errors=${jobState.errors})`);
          }
        }
      }

      await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

      jobState.running = false;
      jobState.finishedAt = new Date().toISOString();
      console.log(`[exercise-audit] Complete: matched=${jobState.matched}, flagged=${jobState.flagged}, errors=${jobState.errors}, skipped=${jobState.skipped}`);
    } catch (err: any) {
      jobState.running = false;
      jobState.finishedAt = new Date().toISOString();
      jobState.error = err.message;
      console.error("[exercise-audit] Fatal error:", err.message);
    }
  })();
}
