// "Too easy" adjustment rules engine — mirror image of
// fitness-too-hard-adjustments.ts. Same lever ladder, opposite direction.
//
// GUARDRAILS (same as the too-hard side):
//   - Warm-up, opening stretch, and cool-down rows are NEVER touched.
//   - Per-level maximums and time budget are enforced and never crossed.

import { db } from './db';
import { exercises, fitnessPlans, fitnessPlanExercises, type FitnessPlanExercise, type Exercise } from '@shared/schema';
import { and, eq, inArray, ne, notInArray } from 'drizzle-orm';

export type Level = 'beginner' | 'intermediate' | 'advanced';
export type WorkoutType = 'standard' | 'standard-cardio' | 'hiit' | 'stretching';
export type LeverId = 1 | 2 | 3 | 4 | 5 | 6;

export interface LeverChange {
  exerciseId: string;
  exerciseName: string;
  field: 'restTime' | 'reps' | 'sets' | 'swap' | 'add';
  before?: string | number | null;
  after?: string | number | null;
}

export interface ApplyResult {
  leverId: LeverId;
  applied: boolean;
  reason?: string;
  changes: LeverChange[];
  prompt?: {
    title: string;
    body: string;
    confirmText: string;
    declineText: string;
    postponeText: string;
    targetLevel: Level | null;
  };
}

// ----------------------------- helpers ------------------------------

const COMPOUND_KEYWORDS = [
  'squat', 'deadlift', 'press', 'bench', 'row', 'pull up', 'pull-up', 'pullup',
  'chin up', 'chin-up', 'chinup', 'lunge', 'clean', 'snatch', 'thruster', 'dip',
  'push up', 'push-up', 'pushup', 'overhead', 'front squat', 'back squat',
  'hip thrust', 'good morning', 'rdl',
];

function isCompound(name: string): boolean {
  const n = name.toLowerCase();
  return COMPOUND_KEYWORDS.some(k => n.includes(k));
}

const NON_MAIN_KEYWORDS = ['warm up', 'warm-up', 'warmup', 'stretch', 'cool down', 'cool-down', 'cooldown', 'mobility'];

function isNonMainBlock(ex: FitnessPlanExercise): boolean {
  const n = (ex.exerciseName || '').toLowerCase();
  if (NON_MAIN_KEYWORDS.some(k => n.includes(k))) return true;
  const notes = (ex.notes || '').toLowerCase();
  if (notes.includes('warm') || notes.includes('cool') || notes.includes('stretch')) return true;
  return false;
}

function restFloorFor(level: Level, isCompoundEx: boolean): number {
  if (level === 'advanced') return isCompoundEx ? 60 : 45;
  return isCompoundEx ? 45 : 30;
}

function restDecrementFor(level: Level): number {
  return level === 'advanced' ? 15 : 10;
}

function setsCapFor(level: Level): number {
  if (level === 'beginner') return 3;
  if (level === 'intermediate') return 4;
  return 5;
}

function hiitWorkCap(level: Level): number {
  return level === 'beginner' ? 45 : 60;
}

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

// Rough session-minutes estimate so we can refuse changes that would
// blow past the user's selected duration. Each set ≈ 30s of work for
// reps-based lifts, or whatever the reps field says when in seconds.
// Accounts for between-set rest.
function estimateSessionMinutes(planExercises: FitnessPlanExercise[]): number {
  let totalSeconds = 0;
  for (const ex of planExercises) {
    const sets = ex.sets ?? 3;
    const rest = ex.restTime ?? 60;
    const parsed = parseReps(ex.reps);
    let workSeconds = 30;
    if (parsed && /sec/i.test(parsed.suffix)) {
      workSeconds = parsed.hi;
    } else if (parsed) {
      workSeconds = Math.max(20, parsed.hi * 3); // ≈3s per rep, min 20s
    }
    totalSeconds += sets * workSeconds + Math.max(0, sets - 1) * rest;
  }
  return Math.ceil(totalSeconds / 60);
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
      // Tabata floor — 10s.
      after = Math.max(before - 5, 10);
    } else {
      const floor = restFloorFor(level, isCompound(ex.exerciseName));
      after = Math.max(before - restDecrementFor(level), floor);
    }

    if (after !== before) {
      updates.push({ id: ex.id, restTime: after });
      changes.push({ exerciseId: ex.id, exerciseName: ex.exerciseName, field: 'restTime', before, after });
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
      if (!/sec/i.test(parsed.suffix)) continue;
      const cap = hiitWorkCap(level);
      newHi = Math.min(parsed.hi + 5, cap);
      newLo = Math.min(parsed.lo + 5, newHi);
    } else if (level === 'beginner') {
      // Move to the upper end of the standard rep band (+2).
      newLo = parsed.lo + 2;
      newHi = parsed.hi + 2;
    } else if (level === 'intermediate') {
      newLo = parsed.lo + 2;
      newHi = parsed.hi + 2;
    } else {
      // Advanced: primary compound +1, accessory +2.
      const inc = compoundEx ? 1 : 2;
      newLo = parsed.lo + inc;
      newHi = parsed.hi + inc;
    }

    if (newLo === parsed.lo && newHi === parsed.hi) continue;
    const after = formatReps({ lo: newLo, hi: newHi, suffix: parsed.suffix });
    updates.push({ id: ex.id, reps: after });
    changes.push({ exerciseId: ex.id, exerciseName: ex.exerciseName, field: 'reps', before: ex.reps, after });
  }
  return { changes, updates };
}

// ----------------------------- LEVER 3 ------------------------------

export function applyLever3(
  planExercises: FitnessPlanExercise[],
  level: Level,
  sessionBudgetMinutes: number,
): { changes: LeverChange[]; updates: Array<{ id: string; sets: number }>; reason?: string } {
  const changes: LeverChange[] = [];
  const updates: Array<{ id: string; sets: number }> = [];

  // Budget check first — only add sets if estimated session time fits.
  const currentMinutes = estimateSessionMinutes(planExercises);
  if (currentMinutes >= sessionBudgetMinutes) {
    return { changes, updates, reason: 'Skipped — session is already at the time budget.' };
  }

  const cap = setsCapFor(level);
  const main = planExercises.filter(e => !isNonMainBlock(e));
  const ordered = [
    ...main.filter(e => isCompound(e.exerciseName)),
    ...main.filter(e => !isCompound(e.exerciseName)),
  ];

  // Add 1 set at a time, re-estimating after each bump, stopping when
  // the budget would be blown.
  const projected = new Map<string, number>();
  for (const ex of ordered) projected.set(ex.id, ex.sets ?? 3);

  for (const ex of ordered) {
    const current = projected.get(ex.id)!;
    if (current >= cap) continue;

    const projectedExercises = planExercises.map(e =>
      e.id === ex.id ? { ...e, sets: current + 1 } : { ...e, sets: projected.get(e.id) ?? e.sets },
    );
    const projectedMinutes = estimateSessionMinutes(projectedExercises);
    if (projectedMinutes > sessionBudgetMinutes) break;

    projected.set(ex.id, current + 1);
    updates.push({ id: ex.id, sets: current + 1 });
    changes.push({ exerciseId: ex.id, exerciseName: ex.exerciseName, field: 'sets', before: current, after: current + 1 });
  }

  return { changes, updates };
}

// ----------------------------- LEVER 4 ------------------------------

export async function applyLever4(
  planExercises: FitnessPlanExercise[],
): Promise<{ changes: LeverChange[]; updates: Array<{ id: string; patch: Partial<FitnessPlanExercise> }> }> {
  const changes: LeverChange[] = [];
  const updates: Array<{ id: string; patch: Partial<FitnessPlanExercise> }> = [];

  const main = planExercises.filter(e => !isNonMainBlock(e));
  const groups = new Map<string, FitnessPlanExercise[]>();
  for (const ex of main) {
    const key = (ex.bodyPart || 'unknown').toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(ex);
  }

  const usedIds = new Set(planExercises.map(e => e.exerciseId));
  const levelOrder: Record<string, number> = { Beginner: 0, Intermediate: 1, Advanced: 2, Tabata: 3 };

  for (const list of Array.from(groups.values())) {
    // Pick the easiest exercise to swap UP — non-compound preferred,
    // otherwise fall back to whatever is in the group.
    const target = list.find(e => !isCompound(e.exerciseName)) ?? list[0];
    if (!target) continue;
    if (!target.bodyPart || !target.equipment) continue;

    const [currentMeta] = await db
      .select()
      .from(exercises)
      .where(eq(exercises.id, parseInt(target.exerciseId, 10)));
    const currentLevelRank = currentMeta ? levelOrder[currentMeta.level] ?? 1 : 1;

    const candidates: Exercise[] = await db
      .select()
      .from(exercises)
      .where(and(
        eq(exercises.bodyPart, target.bodyPart),
        eq(exercises.equipment, target.equipment),
      ))
      .limit(40);

    const harder = candidates
      .filter(c => !usedIds.has(String(c.id)))
      .filter(c => (levelOrder[c.level] ?? 1) >= currentLevelRank)
      .sort((a, b) => (levelOrder[a.level] ?? 1) - (levelOrder[b.level] ?? 1));

    // Prefer the next step up rather than the hardest jump.
    const swap = harder[0];
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
    });
  }

  return { changes, updates };
}

// ----------------------------- LEVER 5 ------------------------------

// Per-duration MAX exercise counts (from the existing exercise count
// table — we can't import the client-side table, so mirror the spec
// for the standard column here).
const MAIN_MAX_BY_DURATION: Array<{ minutes: number; max: number }> = [
  { minutes: 30, max: 5 },
  { minutes: 45, max: 7 },
  { minutes: 60, max: 8 },
  { minutes: 90, max: 10 },
];

function mainMaxFor(minutes: number): number {
  const sorted = [...MAIN_MAX_BY_DURATION].sort(
    (a, b) => Math.abs(a.minutes - minutes) - Math.abs(b.minutes - minutes),
  );
  return sorted[0]?.max ?? 8;
}

export async function applyLever5(
  planId: string,
  planExercises: FitnessPlanExercise[],
  sessionBudgetMinutes: number,
): Promise<{ changes: LeverChange[]; insertRow: any | null; reason?: string }> {
  const main = planExercises.filter(e => !isNonMainBlock(e));
  const max = mainMaxFor(sessionBudgetMinutes);
  if (main.length >= max) {
    return { changes: [], insertRow: null, reason: 'Skipped — session is already at the exercise count cap.' };
  }
  const currentMinutes = estimateSessionMinutes(planExercises);
  if (currentMinutes >= sessionBudgetMinutes) {
    return { changes: [], insertRow: null, reason: 'Skipped — session is already at the time budget.' };
  }

  // Find the muscle group with the fewest exercises in the session.
  const counts = new Map<string, number>();
  for (const ex of main) {
    const key = (ex.bodyPart || 'unknown').toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const sortedGroups = Array.from(counts.entries()).sort((a, b) => a[1] - b[1]);
  const targetBodyPart = sortedGroups[0]?.[0];
  if (!targetBodyPart) {
    return { changes: [], insertRow: null, reason: 'Skipped — no body part to target.' };
  }

  // Pick a strength exercise (not stretching/HIIT-only) the user isn't
  // already doing, on the same equipment family already in use for that
  // body part if possible.
  const usedIds = planExercises.map(e => parseInt(e.exerciseId, 10)).filter(n => !isNaN(n));
  const candidates: Exercise[] = await db
    .select()
    .from(exercises)
    .where(and(
      eq(exercises.bodyPart, planExercises.find(e => (e.bodyPart || '').toLowerCase() === targetBodyPart)?.bodyPart || targetBodyPart),
      ne(exercises.stretching, 'Yes'),
      usedIds.length > 0 ? notInArray(exercises.id, usedIds) : undefined,
    ))
    .limit(20);

  const pick = candidates[0];
  if (!pick) {
    return { changes: [], insertRow: null, reason: 'Skipped — no candidate exercise available.' };
  }

  // Build the new plan exercise row, mirroring sets/reps/rest from a
  // similar row when possible. We don't insert here — return the
  // payload so the driver can do it (and to keep this function pure-ish).
  const template = main.find(e => (e.bodyPart || '').toLowerCase() === targetBodyPart) || main[0];
  const newOrderIndex = (Math.max(...main.map(e => e.orderIndex ?? 0)) ?? 0) + 1;

  const row = {
    planId,
    exerciseId: String(pick.id),
    exerciseName: pick.name,
    bodyPart: pick.bodyPart,
    targetMuscle: pick.bodyPart,
    equipment: pick.equipment,
    imageUrl: pick.mediaFile,
    sets: template.sets ?? 3,
    reps: template.reps ?? '10',
    minutes: null as number | null,
    weight: null as string | null,
    restTime: template.restTime ?? 60,
    notes: 'addedByLever5',
    daysOfWeek: template.daysOfWeek ?? null,
    weekNumber: template.weekNumber ?? 1,
    orderIndex: newOrderIndex,
  };

  // Verify adding it stays within the time budget.
  const projected = [...planExercises, { ...(row as any), id: 'projected' } as FitnessPlanExercise];
  if (estimateSessionMinutes(projected) > sessionBudgetMinutes) {
    return { changes: [], insertRow: null, reason: 'Skipped — adding this exercise would exceed the time budget.' };
  }

  return {
    changes: [{
      exerciseId: 'new',
      exerciseName: pick.name,
      field: 'add',
      before: null,
      after: pick.name,
    }],
    insertRow: row,
  };
}

// ----------------------------- LEVER 6 ------------------------------

const LEVEL_UP: Record<Level, Level | null> = {
  beginner: 'intermediate',
  intermediate: 'advanced',
  advanced: null,
};

export function buildLever6Prompt(level: Level): ApplyResult['prompt'] {
  const target = LEVEL_UP[level];
  if (!target) {
    return {
      title: "You're already at the highest level.",
      body: "Let's increase the volume and intensity within your current plan.",
      confirmText: 'Push my workout harder',
      declineText: 'Keep it as-is',
      postponeText: 'Ask me later',
      targetLevel: null,
    };
  }
  const pretty = target === 'intermediate' ? 'Intermediate' : 'Advanced';
  return {
    title: "You've been crushing your workouts!",
    body: `Ready to step up to ${pretty} plans?`,
    confirmText: `Yes, switch to ${pretty}`,
    declineText: "No, don't ask again for a while",
    postponeText: 'Not yet',
    targetLevel: target,
  };
}

// ----------------------------- DRIVER -------------------------------

export async function applyTooEasyLever(params: {
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
    const { changes, updates, reason } = applyLever3(planExercises, level, sessionMinutes);
    for (const u of updates) {
      await db.update(fitnessPlanExercises).set({ sets: u.sets }).where(eq(fitnessPlanExercises.id, u.id));
    }
    return { leverId, applied: changes.length > 0, changes, reason };
  }

  if (leverId === 4) {
    const { changes, updates } = await applyLever4(planExercises);
    for (const u of updates) {
      await db.update(fitnessPlanExercises).set(u.patch).where(eq(fitnessPlanExercises.id, u.id));
    }
    return { leverId, applied: changes.length > 0, changes };
  }

  if (leverId === 5) {
    const { changes, insertRow, reason } = await applyLever5(planId, planExercises, sessionMinutes);
    if (insertRow) {
      await db.insert(fitnessPlanExercises).values(insertRow);
    }
    return { leverId, applied: changes.length > 0, changes, reason };
  }

  return { leverId, applied: false, reason: 'Unknown lever', changes: [] };
}

export async function applyLever6Decision(params: {
  planId: string;
  decision: 'yes' | 'no' | 'later';
  currentLevel: Level;
  workoutType: WorkoutType;
  sessionMinutes: number;
}): Promise<ApplyResult & { cooldownUntil?: Date | null }> {
  const { planId, decision, currentLevel, workoutType, sessionMinutes } = params;
  const target = LEVEL_UP[currentLevel];

  if (decision === 'later') {
    // "Not yet" → apply Levers 1–5, ask again after 3 more sessions.
    const all: LeverChange[] = [];
    for (const id of [1, 2, 3, 4, 5] as LeverId[]) {
      const r = await applyTooEasyLever({ planId, leverId: id, level: currentLevel, workoutType, sessionMinutes });
      all.push(...r.changes);
    }
    // 3-session cooldown signaled to the route via this special date
    // value: the route persists a session counter when this is set.
    return { leverId: 6, applied: all.length > 0, changes: all, reason: 'Postponed — applied Levers 1–5; will ask again after 3 sessions.' };
  }

  if (decision === 'no') {
    // 2-week cooldown.
    const cooldownUntil = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    await db
      .update(fitnessPlans)
      .set({ levelDecisionCooldownUntil: cooldownUntil })
      .where(eq(fitnessPlans.id, planId));
    return { leverId: 6, applied: false, reason: "Declined — won't ask again for 2 weeks.", changes: [], cooldownUntil };
  }

  // decision === 'yes'
  if (!target) {
    // Advanced cap — apply Levers 1–5 with the spec's higher headroom.
    // The existing Levers 1–5 already use the per-level caps; we just
    // run them all in sequence so the workout still escalates.
    const all: LeverChange[] = [];
    for (const id of [1, 2, 3, 4, 5] as LeverId[]) {
      const r = await applyTooEasyLever({ planId, leverId: id, level: currentLevel, workoutType, sessionMinutes });
      all.push(...r.changes);
    }
    return { leverId: 6, applied: all.length > 0, changes: all, reason: 'Advanced cap: applied Levers 1–5 in lieu of level change.' };
  }

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
