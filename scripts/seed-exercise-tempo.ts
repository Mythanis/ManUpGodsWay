/**
 * Seed exercise tempo_sec from ffprobe video durations.
 *
 * For each exercise whose tempo_sec is still the default (3.0) or null,
 * this script runs ffprobe on the demo video URL to get its duration and
 * writes that as the exercise's seconds-per-rep baseline.
 *
 * Assumes the dev server is running on port 5000 so we can proxy the GCS
 * video through the existing /api/media/public/uploads/* route.
 *
 * Run: npx tsx scripts/seed-exercise-tempo.ts
 */

import { exec } from "child_process";
import { promisify } from "util";
import { db } from "../server/db";
import { exercises } from "../shared/schema";
import { sql, isNull, or } from "drizzle-orm";

const execAsync = promisify(exec);

const BASE_URL = "http://localhost:5000";
const CONCURRENCY = 15;
const PROBE_TIMEOUT_MS = 20_000;
const MIN_TEMPO = 1.0;
const MAX_TEMPO = 10.0;
const DEFAULT_TEMPO = 3.0;

async function probeVideoDuration(mediaFile: string): Promise<number | null> {
  // mediaFile is like /api/media/public/uploads/exercises/1-xxx.mp4
  const url = `${BASE_URL}${mediaFile}`;
  try {
    const { stdout } = await execAsync(
      `ffprobe -v quiet -analyzeduration 500000 -probesize 200000 -print_format json -show_entries format=duration "${url}"`,
      { timeout: PROBE_TIMEOUT_MS }
    );
    const parsed = JSON.parse(stdout);
    const dur = parseFloat(parsed?.format?.duration ?? "");
    if (!isNaN(dur) && dur >= MIN_TEMPO && dur <= MAX_TEMPO) return dur;
    return null;
  } catch {
    return null;
  }
}

async function runBatch<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

async function main() {
  console.log("Fetching exercises from DB...");
  const rows = await db.select({
    id: exercises.id,
    name: exercises.name,
    mediaFile: exercises.mediaFile,
    tempoSec: exercises.tempoSec,
  }).from(exercises);

  const toProbe = rows.filter(
    (r) => r.mediaFile && /\.(mp4|webm|mov)$/i.test(r.mediaFile)
  );

  console.log(`Total exercises: ${rows.length}, videos to probe: ${toProbe.length}`);

  let probed = 0;
  let fallback = 0;
  let updated = 0;
  const dist: Record<string, number> = {};

  await runBatch(
    toProbe,
    async (row) => {
      const dur = await probeVideoDuration(row.mediaFile);
      const bucket = dur != null
        ? `${Math.floor(dur)}s`
        : "fallback";
      dist[bucket] = (dist[bucket] ?? 0) + 1;

      if (dur != null) {
        probed++;
        // Only update if value differs by more than 0.1s
        const current = row.tempoSec ?? DEFAULT_TEMPO;
        if (Math.abs(current - dur) > 0.1) {
          await db.execute(
            sql`UPDATE exercises SET tempo_sec = ${dur} WHERE id = ${row.id}`
          );
          updated++;
        }
      } else {
        fallback++;
        // If still null, set the default
        if (row.tempoSec == null) {
          await db.execute(
            sql`UPDATE exercises SET tempo_sec = ${DEFAULT_TEMPO} WHERE id = ${row.id}`
          );
        }
      }

      const total = probed + fallback;
      if (total % 50 === 0) {
        process.stdout.write(`  ${total}/${toProbe.length} processed...\r`);
      }
    },
    CONCURRENCY
  );

  console.log("\n\n=== Seed complete ===");
  console.log(`Probed successfully: ${probed}`);
  console.log(`Fallback (could not probe): ${fallback}`);
  console.log(`DB rows updated: ${updated}`);
  console.log("\nDuration distribution:");
  for (const [k, v] of Object.entries(dist).sort()) {
    console.log(`  ${k}: ${v} exercises`);
  }
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
