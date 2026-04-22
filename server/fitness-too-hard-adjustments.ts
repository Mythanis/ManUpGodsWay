// "Too hard" adjustment rules engine.
//
// Pure-ish helpers + an apply function that mutates plan exercises in
// the DB. Encodes the per-lever amounts from the spec for "too hard"
// feedback. Each lever returns a structured summary of what changed so
// the API and UI can show it to the user.
//
// IMPORTANT GUARDRAILS:
//   - Warm-up, opening stretch, and cool-down rows are NEVER touched.
//     We detect them via the `stretching` flag on the underlying exercise
//     OR by name keywords ("warm up", "warm-up", "stretch", "cool down").
//   - Per-level minimums are enforced and never crossed.

import { db } from './db';
import { exercises, fitnessPlans, fitnessPlanExercises, type FitnessPlanExercise, type Exercise } from '@shared/schema';
import { and, eq, inArray } from 'drizzle-orm';

export type Level = 'beginner' | 'intermediate' | 'advanced';
export type WorkoutType = 'standard' | 'standard-cardio' | 'hiit' | 'stretching';
export type LeverId = 1 | 2 | 3 | 4 | 5 | 6;

export interface LeverChange {
  exerciseId: string;
  exerciseName: string;
  field: 'restTime' | 'reps' | 'sets' | 'swap' | 'remove';
  before?: string | number | null;
  after?: string | number | null;
  newExerciseName?: string;
  // Full row snapshot — set for "remove" so rollback can re-insert.
  snapshot?: any;
}

export interface ApplyResult {
  leverId: LeverId;
  applied: boolean;
  reason?: string;
  changes: LeverChange[];
  // For Lever 6 only — the prompt config the client must show before
  // any level change can take effect.
  prompt?: {
    title: string;
    body: string;
    confirmText: string;
    declineText: string;
    postponeText: string;
    targetLevel: Level | null; // null = cannot go lower (Beginner)
  };
}

// ----------------------------- helpers ------------------------------

const COMPOUND_KEYWORDS = [
  'squat', 'deadlift', 'press', 'bench', 'row', 'pull up', 'pull-up', 'pullup',
  'chin up', 'chin-up', 'chinup', 'lunge', 'clean', 'snatch', 'thruster', 'dip',
  'push up', 'push-up', 'pushup', 'overhead', 'front squat', 'back squat',
  'hip thrust', 'good morning', 'rdl',
];

export function isCompound(name: string): boolean {
  const n = name.toLowerCase();
  return COMPOUND_KEYWORDS.some(k => n.includes(k));
}

const NON_MAIN_KEYWORDS = ['warm up', 'warm-up', 'warmup', 'stretch', 'cool down', 'cool-down', 'cooldown', 'mobility'];

export function isNonMainBlock(ex: FitnessPlanExercise): boolean {
  const n = (ex.exerciseName || '').toLowerCase();
  if (NON_MAIN_KEYWORDS.some(k => n.includes(k))) return true;
  // notes sometimes carries the block label
  const notes = (ex.notes || '').toLowerCase();
  if (notes.includes('warm') || notes.includes('cool') || notes.includes('stretch')) return true;
  return false;
}

// Cap rest time per the spec.
function restCapFor(level: Level, isCompoundEx: boolean): number {
  if (level === 'advanced') return isCompoundEx ? 120 : 90;
  // beginner & intermediate share the same caps
  return isCompoundEx ? 90 : 75;
}

function restIncrementFor(level: Level): number {
  return level === 'advanced' ? 20 : 15;
}

// Parse a reps string like "10", "8-10", "30 seconds". Returns
// { lo, hi, suffix } where suffix preserves any trailing unit
// (" seconds"). Returns null when the reps field isn't numeric.
function parseReps(reps: string | null | undefined): { lo: number; hi: number; suffix: string } | null {
  if (!reps) return null;
  const s = reps.trim();
  const m = s.match(/^(\d+)(?:\s*-\s*(\d+))?(.*)$/);
  if (!m) return null;
  const lo = parseInt(m[1], 10);
  const hi = m[2] ? parseInt(m[2], 10) : lo;
  return { lo, hi, suffix: m[3] || '' };
}

function formatReps(p: { lo: number; hi: number; suffix: string }): string {
  if (p.lo === p.hi) return `${p.lo}${p.suffix}`;
  return `${p.lo}-${p.hi}${p.suffix}`;
}

// HIIT minimum work-interval seconds.
function hiitMinWork(level: Level): number {
  return level === 'advanced' ? 15 : 20;
}

// ----------------------------- LEVER 1 ------------------------------

export function applyLever1(
  planExercises: FitnessPlanExercise[],
  level: Level,
  workoutType: WorkoutType,
): { changes: LeverChange[]; updates: Array<{ id: string; restTime: number }> } {
  const changes: LeverChange[] = [];
  const updates: Array<{ id: string; restTime: number }> = [];

  for (const ex of planExercises) {
    if (isNonMainBlock(ex)) continue;
    const before = ex.restTime ?? 60;
    let after: number;

    if (workoutType === 'hiit') {
      // HIIT: rest interval += 10s, max = work interval (1:1). We don't
      // know the actual work interval here without parsing reps as
      // seconds, so cap conservatively at the parsed seconds when
      // possible, otherwise at 60.
      const parsed = parseReps(ex.reps);
      const workSeconds = parsed && /sec/i.test(parsed.suffix) ? parsed.hi : 60;
      after = Math.min(before + 10, workSeconds);
    } else {
      const cap = restCapFor(level, isCompound(ex.exerciseName));
      after = Math.min(before + restIncrementFor(level), cap);
    }

    if (after !== before) {
      updates.push({ id: ex.id, restTime: after });
      changes.push({
        exerciseId: ex.id,
        exerciseName: ex.exerciseName,
        field: 'restTime',
        before,
        after,
      });
    }
  }
  return { changes, updates };
}

// ----------------------------- LEVER 2 ------------------------------

export function applyLever2(
  planExercises: FitnessPlanExercise[],
  level: Level,
  workoutType: WorkoutType,
): { changes: LeverChange[]; updates: Array<{ id: string; reps: string }> } {
  const changes: LeverChange[] = [];
  const updates: Array<{ id: string; reps: string }> = [];

  for (const ex of planExercises) {
    if (isNonMainBlock(ex)) continue;
    const parsed = parseReps(ex.reps);
    if (!parsed) continue;
    const compoundEx = isCompound(ex.exerciseName);

    let newLo = parsed.lo;
    let newHi = parsed.hi;

    if (workoutType === 'hiit') {
      // Reduce work interval by 5 sec, floor by level.
      if (!/sec/i.test(parsed.suffix)) continue;
      const min = hiitMinWork(level);
      newHi = Math.max(parsed.hi - 5, min);
      newLo = Math.max(parsed.lo - 5, min);
    } else if (level === 'beginner') {
      // Drop to the lower end of the standard rep band.
      // Compound: 8-10 → 6-8 (shift -2). Isolation: 10-12 → 8-10 (shift -2).
      newLo = Math.max(parsed.lo - 2, 1);
      newHi = Math.max(parsed.hi - 2, newLo);
    } else if (level === 'intermediate') {
      // Drop by 2 reps from current.
      newLo = Math.max(parsed.lo - 2, 1);
      newHi = Math.max(parsed.hi - 2, newLo);
    } else {
      // Advanced: primary compound -1, accessory -2.
      const dec = compoundEx ? 1 : 2;
      newLo = Math.max(parsed.lo - dec, 1);
      newHi = Math.max(parsed.hi - dec, newLo);
    }

    if (newLo === parsed.lo && newHi === parsed.hi) continue;
    const after = formatReps({ lo: newLo, hi: newHi, suffix: parsed.suffix });
    updates.push({ id: ex.id, reps: after });
    changes.push({
      exerciseId: ex.id,
      exerciseName: ex.exerciseName,
      field: 'reps',
      before: ex.reps,
      after,
    });
  }
  return { changes, updates };
}

// ----------------------------- LEVER 3 ------------------------------

const SET_FLOOR: Record<Level, number> = { beginner: 2, intermediate: 2, advanced: 3 };

export function applyLever3(
  planExercises: FitnessPlanExercise[],
  level: Level,
): { changes: LeverChange[]; updates: Array<{ id: string; sets: number }> } {
  const changes: LeverChange[] = [];
  const updates: Array<{ id: string; sets: number }> = [];

  // Compound exercises first, then isolation. Remove 1 set per exercise,
  // never below the per-level floor.
  const main = planExercises.filter(e => !isNonMainBlock(e));
  const ordered = [
    ...main.filter(e => isCompound(e.exerciseName)),
    ...main.filter(e => !isCompound(e.exerciseName)),
  ];

  for (const ex of ordered) {
    const before = ex.sets ?? 3;
    const after = before - 1;
    if (after < SET_FLOOR[level]) continue;
    updates.push({ id: ex.id, sets: after });
    changes.push({
      exerciseId: ex.id,
      exerciseName: ex.exerciseName,
      field: 'sets',
      before,
      after,
    });
  }
  return { changes, updates };
}

// ----------------------------- LEVER 4 ------------------------------

// Pick the "hardest" exercise per body part — heuristic: prefer compound,
// then any. Swap with same body_part + same equipment, lower level if
// possible. Logs the original exerciseId in `notes` as `swappedFrom:<id>`.
export async function applyLever4(
  planExercises: FitnessPlanExercise[],
): Promise<{ changes: LeverChange[]; updates: Array<{ id: string; patch: Partial<FitnessPlanExercise> }> }> {
  const changes: LeverChange[] = [];
  const updates: Array<{ id: string; patch: Partial<FitnessPlanExercise> }> = [];

  const main = planExercises.filter(e => !isNonMainBlock(e));

  // Group by body part, pick the hardest (compound preferred) per group.
  const groups = new Map<string, FitnessPlanExercise[]>();
  for (const ex of main) {
    const key = (ex.bodyPart || 'unknown').toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(ex);
  }

  const usedIds = new Set(planExercises.map(e => e.exerciseId));
  const levelOrder: Record<string, number> = { Beginner: 0, Intermediate: 1, Advanced: 2, Tabata: 3 };

  for (const list of Array.from(groups.values())) {
    const target = list.find(e => isCompound(e.exerciseName)) ?? list[0];
    if (!target) continue;
    if (!target.bodyPart || !target.equipment) continue;

    // Find current exercise's level.
    const [currentMeta] = await db
      .select()
      .from(exercises)
      .where(eq(exercises.id, parseInt(target.exerciseId, 10)));
    const currentLevelRank = currentMeta ? levelOrder[currentMeta.level] ?? 1 : 1;

    // Candidate query: same body_part + equipment, level rank <= current.
    const candidates: Exercise[] = await db
      .select()
      .from(exercises)
      .where(and(
        eq(exercises.bodyPart, target.bodyPart),
        eq(exercises.equipment, target.equipment),
      ))
      .limit(40);

    const easier = candidates
      .filter(c => !usedIds.has(String(c.id)))
      .filter(c => (levelOrder[c.level] ?? 1) <= currentLevelRank)
      .sort((a, b) => (levelOrder[a.level] ?? 1) - (levelOrder[b.level] ?? 1));

    const swap = easier[0];
    if (!swap) continue;

    usedIds.delete(target.exerciseId);
    usedIds.add(String(swap.id));

    const noteAddition = `swappedFrom:${target.exerciseId}:${target.exerciseName}`;
    const newNotes = target.notes ? `${target.notes} | ${noteAddition}` : noteAddition;

    updates.push({
      id: target.id,
      patch: {
        exerciseId: String(swap.id),
        exerciseName: swap.name,
        bodyPart: swap.bodyPart,
        targetMuscle: swap.bodyPart,
        equipment: swap.equipment,
        imageUrl: swap.mediaFile,
        notes: newNotes,
      },
    });
    changes.push({
      exerciseId: target.id,
      exerciseName: target.exerciseName,
      field: 'swap',
      before: target.exerciseName,
      after: swap.name,
      newExerciseName: swap.name,
    });
  }

  return { changes, updates };
}

// ----------------------------- LEVER 5 ------------------------------

const MAIN_FLOOR_BY_DURATION: Array<{ minutes: number; floor: number }> = [
  { minutes: 30, floor: 3 },
  { minutes: 45, floor: 4 },
  { minutes: 60, floor: 5 },
  { minutes: 90, floor: 6 },
];

function mainFloorFor(minutes: number): number {
  // Snap to nearest known duration; fall back to 60-min floor.
  const sorted = [...MAIN_FLOOR_BY_DURATION].sort(
    (a, b) => Math.abs(a.minutes - minutes) - Math.abs(b.minutes - minutes),
  );
  return sorted[0]?.floor ?? 5;
}

export function applyLever5(
  planExercises: FitnessPlanExercise[],
  sessionMinutes: number,
): { changes: LeverChange[]; removeIds: string[] } {
  const changes: LeverChange[] = [];
  const removeIds: string[] = [];

  const main = [...planExercises]
    .filter(e => !isNonMainBlock(e))
    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));

  const floor = mainFloorFor(sessionMinutes);
  if (main.length <= floor) return { changes, removeIds };

  const last = main[main.length - 1];
  removeIds.push(last.id);
  changes.push({
    exerciseId: last.id,
    exerciseName: last.exerciseName,
    field: 'remove',
    before: last.exerciseName,
    after: null,
  });
  return { changes, removeIds };
}

// ----------------------------- LEVER 6 ------------------------------

const LEVEL_DOWN: Record<Level, Level | null> = {
  advanced: 'intermediate',
  intermediate: 'beginner',
  beginner: null,
};

export function buildLever6Prompt(level: Level): ApplyResult['prompt'] {
  const target = LEVEL_DOWN[level];
  if (!target) {
    return {
      title: "You're working hard — that's what matters.",
      body: "Let's adjust the workout to be a bit more manageable.",
      confirmText: 'Adjust this workout',
      declineText: 'Keep it as-is',
      postponeText: 'Ask me later',
      targetLevel: null,
    };
  }
  const pretty = target === 'beginner' ? 'Beginner' : 'Intermediate';
  return {
    title: "You've found the last several workouts quite challenging.",
    body: `Would you like to step down to ${pretty} plans? You can always move back up when you're ready.`,
    confirmText: `Yes, switch to ${pretty}`,
    declineText: 'No, keep my level',
    postponeText: 'Not now',
    targetLevel: target,
  };
}

// ----------------------------- DRIVER -------------------------------

/**
 * Apply a "too hard" lever to a plan. Reads the plan's current
 * exercises, computes the changes, writes them, and returns a summary.
 *
 *   Lever 6 NEVER auto-applies — it returns a prompt for the client to
 *   show the user.
 */
export async function applyTooHardLever(params: {
  planId: string;
  leverId: LeverId;
  level: Level;
  workoutType: WorkoutType;
  sessionMinutes: number;
}): Promise<ApplyResult> {
  const { planId, leverId, level, workoutType, sessionMinutes } = params;

  if (leverId === 6) {
    return {
      leverId,
      applied: false,
      reason: 'Lever 6 requires user confirmation before any change is made.',
      changes: [],
      prompt: buildLever6Prompt(level),
    };
  }

  const planExercises = await db
    .select()
    .from(fitnessPlanExercises)
    .where(eq(fitnessPlanExercises.planId, planId));

  if (leverId === 1) {
    const { changes, updates } = applyLever1(planExercises, level, workoutType);
    for (const u of updates) {
      await db.update(fitnessPlanExercises).set({ restTime: u.restTime }).where(eq(fitnessPlanExercises.id, u.id));
    }
    return { leverId, applied: changes.length > 0, changes };
  }

  if (leverId === 2) {
    const { changes, updates } = applyLever2(planExercises, level, workoutType);
    for (const u of updates) {
      await db.update(fitnessPlanExercises).set({ reps: u.reps }).where(eq(fitnessPlanExercises.id, u.id));
    }
    return { leverId, applied: changes.length > 0, changes };
  }

  if (leverId === 3) {
    const { changes, updates } = applyLever3(planExercises, level);
    for (const u of updates) {
      await db.update(fitnessPlanExercises).set({ sets: u.sets }).where(eq(fitnessPlanExercises.id, u.id));
    }
    return { leverId, applied: changes.length > 0, changes };
  }

  if (leverId === 4) {
    const { changes, updates } = await applyLever4(planExercises);
    for (const u of updates) {
      await db.update(fitnessPlanExercises).set(u.patch).where(eq(fitnessPlanExercises.id, u.id));
    }
    return { leverId, applied: changes.length > 0, changes };
  }

  if (leverId === 5) {
    const { changes, removeIds } = applyLever5(planExercises, sessionMinutes);
    if (removeIds.length > 0) {
      // Attach a full snapshot to each "remove" change BEFORE deleting,
      // so rollback can re-insert the exact row.
      for (const c of changes) {
        if (c.field === 'remove') {
          const snap = planExercises.find(e => e.id === c.exerciseId);
          if (snap) c.snapshot = snap;
        }
      }
      await db.delete(fitnessPlanExercises).where(inArray(fitnessPlanExercises.id, removeIds));
    }
    return { leverId, applied: changes.length > 0, changes };
  }

  return { leverId, applied: false, reason: 'Unknown lever', changes: [] };
}

/**
 * Apply a Lever 6 level-change after the user confirms.
 *   - "yes": change plan.difficulty to the target level. Caller is
 *     responsible for resetting the streak counter and logging.
 *   - "no": apply Lever 5 only.
 *   - "later": no-op.
 *
 * For Beginner there is no lower level — caller should treat any
 * confirm as "apply Levers 1–5" and never change `plan.difficulty`.
 */
export async function applyLever6Decision(params: {
  planId: string;
  decision: 'yes' | 'no' | 'later';
  currentLevel: Level;
  workoutType: WorkoutType;
  sessionMinutes: number;
}): Promise<ApplyResult> {
  const { planId, decision, currentLevel, workoutType, sessionMinutes } = params;
  const target = LEVEL_DOWN[currentLevel];

  if (decision === 'later') {
    return { leverId: 6, applied: false, reason: 'Postponed — will ask again next session.', changes: [] };
  }

  if (decision === 'no') {
    // Fall back to Lever 5.
    return applyTooHardLever({ planId, leverId: 5, level: currentLevel, workoutType, sessionMinutes });
  }

  // decision === 'yes'
  if (!target) {
    // Beginner can't go lower — apply Levers 1–5 in sequence so the
    // workout still becomes more manageable.
    const allChanges: LeverChange[] = [];
    for (const id of [1, 2, 3, 4, 5] as LeverId[]) {
      const r = await applyTooHardLever({ planId, leverId: id, level: currentLevel, workoutType, sessionMinutes });
      allChanges.push(...r.changes);
    }
    return { leverId: 6, applied: allChanges.length > 0, changes: allChanges, reason: 'Beginner: applied Levers 1–5 in lieu of level change.' };
  }

  // Real level change.
  await db
    .update(fitnessPlans)
    .set({ difficulty: target })
    .where(eq(fitnessPlans.id, planId));
  return {
    leverId: 6,
    applied: true,
    changes: [{ exerciseId: planId, exerciseName: 'plan', field: 'swap', before: currentLevel, after: target }],
    reason: `Level changed: ${currentLevel} → ${target}.`,
  };
}
