// Rollback engine for adaptive fitness adjustments.
//
// Logs every per-exercise change a lever made (grouped by `batchId`) and
// provides three rollback modes per spec:
//
//   1. partialUndoLastBatch:
//        After 2 consecutive "just right" following adjustments, undo
//        ONLY the most recent lever's changes. Do not cascade.
//
//   2. restoreFieldBaselines:
//        After 3 consecutive "just right", restore each field touched
//        by the most-recent lever back to its original baseline. Keep
//        any swaps the user has been performing.
//
//   3. fullRollback:
//        User-initiated. Reverse every un-rolled-back log entry,
//        restoring removed exercises, undoing swaps, and resetting
//        rest/reps/sets to their oldest recorded baselines.
//
// All rollback paths write `rolled_back_at` and `rollback_reason` so the
// log doubles as an audit trail.

import { db } from './db';
import {
  fitnessPlanExercises,
  workoutAdjustmentLog,
  type WorkoutAdjustmentLogRow,
} from '@shared/schema';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import type { LeverChange } from './fitness-too-hard-adjustments';

export type LogDirection = 'easier' | 'harder';

// ---------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------

export interface LogContext {
  planId: string;
  userId: string;
  workoutType: string;
  leverId: number;
  direction: LogDirection;
}

/**
 * Persist every change in a lever application as a row in the
 * adjustment log. Returns the generated batchId so the caller can
 * surface it / cross-reference rollback events.
 */
export async function logAdjustmentBatch(
  ctx: LogContext,
  changes: LeverChange[],
): Promise<string | null> {
  if (!changes || changes.length === 0) return null;
  const batchId = randomUUID();
  const rows = changes.map(c => ({
    planId: ctx.planId,
    userId: ctx.userId,
    workoutType: ctx.workoutType,
    leverId: ctx.leverId,
    direction: ctx.direction,
    batchId,
    field: c.field,
    planExerciseId: c.exerciseId ?? null,
    exerciseName: c.exerciseName ?? null,
    beforeVal: c.before == null ? null : String(c.before),
    afterVal: c.after == null ? null : String(c.after),
    snapshot: c.snapshot ?? null,
  }));
  await db.insert(workoutAdjustmentLog).values(rows);
  return batchId;
}

// ---------------------------------------------------------------------
// Reverse a single log entry against the live plan.
// ---------------------------------------------------------------------

async function reverseLogEntry(entry: WorkoutAdjustmentLogRow): Promise<void> {
  if (entry.field === 'restTime') {
    const v = entry.beforeVal ? parseInt(entry.beforeVal, 10) : null;
    if (entry.planExerciseId && v != null && !isNaN(v)) {
      await db
        .update(fitnessPlanExercises)
        .set({ restTime: v })
        .where(eq(fitnessPlanExercises.id, entry.planExerciseId));
    }
    return;
  }
  if (entry.field === 'sets') {
    const v = entry.beforeVal ? parseInt(entry.beforeVal, 10) : null;
    if (entry.planExerciseId && v != null && !isNaN(v)) {
      await db
        .update(fitnessPlanExercises)
        .set({ sets: v })
        .where(eq(fitnessPlanExercises.id, entry.planExerciseId));
    }
    return;
  }
  if (entry.field === 'reps') {
    if (entry.planExerciseId && entry.beforeVal != null) {
      await db
        .update(fitnessPlanExercises)
        .set({ reps: entry.beforeVal })
        .where(eq(fitnessPlanExercises.id, entry.planExerciseId));
    }
    return;
  }
  if (entry.field === 'swap') {
    // beforeVal/afterVal hold the exercise *names*. The swap was logged
    // against the plan_exercise row id (planExerciseId). To reverse we
    // need the original catalog id — we stored it in the row's notes
    // as `swappedFrom:<id>:<name>`. Read the current row, parse, undo.
    if (!entry.planExerciseId) return;
    const [row] = await db
      .select()
      .from(fitnessPlanExercises)
      .where(eq(fitnessPlanExercises.id, entry.planExerciseId));
    if (!row) return;
    const m = (row.notes || '').match(/swappedFrom:([^:|]+):([^|]+)/);
    if (!m) return;
    const oldId = m[1].trim();
    const oldName = m[2].trim();
    const cleanedNotes = (row.notes || '')
      .replace(/\s*\|?\s*swappedFrom:[^|]+/, '')
      .trim() || null;
    await db
      .update(fitnessPlanExercises)
      .set({
        exerciseId: oldId,
        exerciseName: oldName,
        notes: cleanedNotes,
      })
      .where(eq(fitnessPlanExercises.id, entry.planExerciseId));
    return;
  }
  if (entry.field === 'add') {
    // The added row's id was stored in afterVal during logging — but
    // since the engine generates ids in DB, we recorded planExerciseId.
    if (entry.planExerciseId) {
      await db
        .delete(fitnessPlanExercises)
        .where(eq(fitnessPlanExercises.id, entry.planExerciseId));
    }
    return;
  }
  if (entry.field === 'remove') {
    // Restore the original row from the snapshot.
    const snap: any = entry.snapshot;
    if (!snap) return;
    // Strip the original id so the DB assigns a fresh one (the old id
    // is gone). Everything else round-trips.
    const { id: _ignored, ...rest } = snap;
    await db.insert(fitnessPlanExercises).values(rest as any);
    return;
  }
}

async function markRolledBack(
  ids: string[],
  reason: string,
): Promise<void> {
  if (ids.length === 0) return;
  for (const id of ids) {
    await db
      .update(workoutAdjustmentLog)
      .set({ rolledBackAt: new Date(), rollbackReason: reason })
      .where(eq(workoutAdjustmentLog.id, id));
  }
}

// ---------------------------------------------------------------------
// Rollback modes
// ---------------------------------------------------------------------

/**
 * Partial undo: reverse the most recent un-rolled-back lever batch
 * for this (plan, workoutType, direction). Returns metadata about
 * what was reverted (or null if nothing applicable).
 */
export async function partialUndoLastBatch(params: {
  planId: string;
  workoutType: string;
  direction: LogDirection;
  reason: string;
}): Promise<{ batchId: string; leverId: number; entries: number } | null> {
  const { planId, workoutType, direction, reason } = params;
  const [latest] = await db
    .select()
    .from(workoutAdjustmentLog)
    .where(and(
      eq(workoutAdjustmentLog.planId, planId),
      eq(workoutAdjustmentLog.workoutType, workoutType),
      eq(workoutAdjustmentLog.direction, direction),
      isNull(workoutAdjustmentLog.rolledBackAt),
    ))
    .orderBy(desc(workoutAdjustmentLog.appliedAt))
    .limit(1);
  if (!latest) return null;

  const batchEntries = await db
    .select()
    .from(workoutAdjustmentLog)
    .where(and(
      eq(workoutAdjustmentLog.batchId, latest.batchId),
      isNull(workoutAdjustmentLog.rolledBackAt),
    ));

  for (const e of batchEntries) await reverseLogEntry(e);
  await markRolledBack(batchEntries.map(e => e.id), reason);

  return { batchId: latest.batchId, leverId: latest.leverId, entries: batchEntries.length };
}

/**
 * Restore each field touched by the most-recent lever batch back to
 * its ORIGINAL baseline (oldest beforeVal across all un-rolled-back
 * log entries for that field+exercise). Keeps swaps per spec.
 */
export async function restoreFieldBaselines(params: {
  planId: string;
  workoutType: string;
  direction: LogDirection;
  reason: string;
}): Promise<{ batchId: string; leverId: number; entries: number } | null> {
  const { planId, workoutType, direction, reason } = params;

  const [latest] = await db
    .select()
    .from(workoutAdjustmentLog)
    .where(and(
      eq(workoutAdjustmentLog.planId, planId),
      eq(workoutAdjustmentLog.workoutType, workoutType),
      eq(workoutAdjustmentLog.direction, direction),
      isNull(workoutAdjustmentLog.rolledBackAt),
    ))
    .orderBy(desc(workoutAdjustmentLog.appliedAt))
    .limit(1);
  if (!latest) return null;

  const batchEntries = await db
    .select()
    .from(workoutAdjustmentLog)
    .where(and(
      eq(workoutAdjustmentLog.batchId, latest.batchId),
      isNull(workoutAdjustmentLog.rolledBackAt),
    ));

  // Pull the full history of un-rolled-back entries in this scope so we
  // can find each field's earliest baseline.
  const history = await db
    .select()
    .from(workoutAdjustmentLog)
    .where(and(
      eq(workoutAdjustmentLog.planId, planId),
      eq(workoutAdjustmentLog.workoutType, workoutType),
      eq(workoutAdjustmentLog.direction, direction),
      isNull(workoutAdjustmentLog.rolledBackAt),
    ));

  const earliest = new Map<string, WorkoutAdjustmentLogRow>(); // key: `${planExerciseId}|${field}`
  for (const e of history) {
    const k = `${e.planExerciseId}|${e.field}`;
    const existing = earliest.get(k);
    if (!existing || (e.appliedAt && existing.appliedAt && e.appliedAt < existing.appliedAt)) {
      earliest.set(k, e);
    }
  }

  const idsToMark: string[] = [];
  for (const entry of batchEntries) {
    if (entry.field === 'swap') continue; // keep swaps per spec
    const k = `${entry.planExerciseId}|${entry.field}`;
    const baseline = earliest.get(k);
    if (!baseline) continue;
    // Reverse to the EARLIEST baseline, not the most-recent before.
    await reverseLogEntry(baseline);
    // Mark every history entry for this (exercise, field) as rolled back
    // so they don't double-apply on a future rollback.
    for (const e of history) {
      if (e.planExerciseId === entry.planExerciseId && e.field === entry.field) {
        idsToMark.push(e.id);
      }
    }
  }
  await markRolledBack(idsToMark, reason);

  return { batchId: latest.batchId, leverId: latest.leverId, entries: idsToMark.length };
}

/**
 * Full rollback: walk every un-rolled-back log entry for this plan in
 * reverse chronological order and reverse each one. This restores
 * removed exercises, undoes swaps, and snaps fields back to their
 * earliest recorded baseline.
 */
export async function fullRollback(params: {
  planId: string;
  reason: string;
}): Promise<{ entries: number; batches: number }> {
  const { planId, reason } = params;
  const all = await db
    .select()
    .from(workoutAdjustmentLog)
    .where(and(
      eq(workoutAdjustmentLog.planId, planId),
      isNull(workoutAdjustmentLog.rolledBackAt),
    ))
    .orderBy(desc(workoutAdjustmentLog.appliedAt));

  // For field changes (restTime/reps/sets), reverse each one in reverse
  // chronological order so the live row ends up at the OLDEST baseline.
  // For swaps and removes, reverse in reverse chronological order so
  // any chain of swaps unwinds back to the original.
  for (const entry of all) await reverseLogEntry(entry);
  await markRolledBack(all.map(e => e.id), reason);

  const batches = new Set(all.map(e => e.batchId)).size;
  return { entries: all.length, batches };
}
