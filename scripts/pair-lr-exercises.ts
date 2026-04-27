/**
 * pair-lr-exercises.ts
 *
 * Detects exercises whose names differ only by the standalone token
 * "left" or "right" (e.g. "Diagonal Chop Left" / "Diagonal Chop Right")
 * and links them in the database:
 *   - exercises.paired_exercise_id  → mutual self-FK between the two rows
 *   - exercises.side                → 'left' or 'right'
 *   - exercises.pair_base_name      → the canonical name with the token stripped
 *   - exercises.sidedness           → forced to 'unilateral' for both rows
 *
 * The workout runner already handles 'unilateral' as a single set with
 * right-then-left countdowns, so once a pair is linked the runner does
 * one set = right side + left side instead of two separate single-side sets.
 *
 * Usage:
 *   npx tsx scripts/pair-lr-exercises.ts            # dry-run (default)
 *   npx tsx scripts/pair-lr-exercises.ts --apply    # write changes
 *   npx tsx scripts/pair-lr-exercises.ts --unpair   # clear ALL pair links
 *
 * Idempotent: re-running with --apply when nothing has changed is a no-op.
 */
import { db } from "../server/db";
import { exercises } from "../shared/schema";
import { and, eq, isNotNull, ne, sql } from "drizzle-orm";

type Row = {
  id: number;
  name: string;
  bodyPart: string;
  equipment: string;
  sidedness: string | null;
  pairedExerciseId: number | null;
  side: string | null;
  pairBaseName: string | null;
};

const LR_RE = /\b(left|right)\b/i;

function detectSide(name: string): "left" | "right" | null {
  const m = name.match(LR_RE);
  if (!m) return null;
  return m[1].toLowerCase() as "left" | "right";
}

/**
 * Strip ALL standalone "left"/"right" tokens, collapse repeated whitespace,
 * Title-Case-ish for display, lower-case for matching.
 */
function normalizeBase(name: string): { matchKey: string; displayBase: string } {
  // Remove every whole-word "left"/"right"
  const stripped = name.replace(/\b(left|right)\b/gi, " ").replace(/\s+/g, " ").trim();
  return {
    matchKey: stripped.toLowerCase(),
    displayBase: stripped,
  };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const apply = args.has("--apply");
  const unpair = args.has("--unpair");

  if (unpair) {
    if (!apply) {
      console.log("[unpair] dry-run: pass --apply to actually clear pair links.");
    }
    const linked = await db
      .select({ id: exercises.id, name: exercises.name })
      .from(exercises)
      .where(isNotNull(exercises.pairedExerciseId));
    console.log(`[unpair] ${linked.length} rows currently linked.`);
    if (apply) {
      await db
        .update(exercises)
        .set({ pairedExerciseId: null, side: null, pairBaseName: null })
        .where(isNotNull(exercises.pairedExerciseId));
      console.log("[unpair] cleared paired_exercise_id, side, pair_base_name on all rows.");
    }
    process.exit(0);
  }

  console.log(apply ? "[pair] APPLY mode — writing changes." : "[pair] DRY-RUN — pass --apply to write.");

  // Pull every exercise once
  const all: Row[] = await db
    .select({
      id: exercises.id,
      name: exercises.name,
      bodyPart: exercises.bodyPart,
      equipment: exercises.equipment,
      sidedness: exercises.sidedness,
      pairedExerciseId: exercises.pairedExerciseId,
      side: exercises.side,
      pairBaseName: exercises.pairBaseName,
    })
    .from(exercises);

  console.log(`[pair] scanning ${all.length} exercises…`);

  // Index L/R-named rows by (bodyPart|equipment|matchKey|side)
  const groups = new Map<
    string,
    { left: Row[]; right: Row[]; baseDisplay: string }
  >();

  for (const row of all) {
    const side = detectSide(row.name);
    if (!side) continue;
    const { matchKey, displayBase } = normalizeBase(row.name);
    if (!matchKey) continue;
    // Group on body-part + equipment + name minus L/R so we don't accidentally
    // pair two unrelated exercises that happen to share a base name.
    const groupKey = `${row.bodyPart || ""}||${row.equipment || ""}||${matchKey}`;
    const g = groups.get(groupKey) ?? {
      left: [],
      right: [],
      baseDisplay: displayBase,
    };
    if (side === "left") g.left.push(row);
    else g.right.push(row);
    groups.set(groupKey, g);
  }

  let pairedCount = 0;
  let alreadyPaired = 0;
  const skipped: string[] = [];
  const writes: { id: number; partnerId: number; side: "left" | "right"; baseName: string }[] = [];

  for (const [, g] of groups) {
    if (g.left.length === 0 || g.right.length === 0) {
      // Singleton — no partner exists
      const orphan = g.left[0] ?? g.right[0];
      if (orphan) skipped.push(`(no partner) #${orphan.id} ${orphan.name}`);
      continue;
    }
    if (g.left.length > 1 || g.right.length > 1) {
      const ids = [...g.left, ...g.right].map((r) => `#${r.id} "${r.name}"`).join(", ");
      skipped.push(`(ambiguous: ${g.left.length}L/${g.right.length}R) ${ids}`);
      continue;
    }
    const left = g.left[0];
    const right = g.right[0];
    const baseName = g.baseDisplay;

    const isAlreadyLinked =
      left.pairedExerciseId === right.id &&
      right.pairedExerciseId === left.id &&
      left.side === "left" &&
      right.side === "right" &&
      left.pairBaseName === baseName &&
      right.pairBaseName === baseName &&
      left.sidedness === "unilateral" &&
      right.sidedness === "unilateral";

    if (isAlreadyLinked) {
      alreadyPaired++;
      continue;
    }

    pairedCount++;
    writes.push({ id: left.id, partnerId: right.id, side: "left", baseName });
    writes.push({ id: right.id, partnerId: left.id, side: "right", baseName });
    console.log(
      `[pair] ${baseName}: #${left.id} "${left.name}" (left) ↔ #${right.id} "${right.name}" (right)`,
    );
  }

  console.log(`\n[pair] summary:`);
  console.log(`  pairs to link/update: ${pairedCount}`);
  console.log(`  pairs already linked: ${alreadyPaired}`);
  console.log(`  skipped (singleton or ambiguous): ${skipped.length}`);
  if (skipped.length) {
    console.log(`  skipped details:`);
    for (const s of skipped) console.log(`    - ${s}`);
  }

  if (!apply) {
    console.log(`\n[pair] dry-run only. Pass --apply to write.`);
    process.exit(0);
  }

  if (writes.length === 0) {
    console.log(`[pair] nothing to write — DB is already up to date.`);
    process.exit(0);
  }

  console.log(`[pair] writing ${writes.length} row updates…`);
  for (const w of writes) {
    await db
      .update(exercises)
      .set({
        pairedExerciseId: w.partnerId,
        side: w.side,
        pairBaseName: w.baseName,
        sidedness: "unilateral",
        updatedAt: new Date(),
      })
      .where(eq(exercises.id, w.id));
  }

  console.log(`[pair] done. ${writes.length / 2} pair(s) linked.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[pair] error:", err);
  process.exit(1);
});
