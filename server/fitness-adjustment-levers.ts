// Adjustment Levers — the catalog of mechanisms the adaptive-difficulty
// system can use to nudge a workout up or down. Levers are ordered from
// LEAST disruptive (1) to MOST disruptive (6). The Confirmation Rule
// always starts at Lever 1 and only escalates to a higher lever when the
// user gives the same feedback again.
//
// This file does NOT mutate any plan. It only encodes the decision logic
// of "given this streak, which lever should fire?" so the feedback
// endpoint can return it and downstream plan-generation can act on it.

export type LeverId = 1 | 2 | 3 | 4 | 5 | 6;

export interface LeverDefinition {
  id: LeverId;
  name: string;
  description: string;
  // True when applying this lever requires explicit user confirmation
  // before it takes effect (Lever 6 — level change).
  requiresConfirmation: boolean;
}

export const LEVERS: Record<LeverId, LeverDefinition> = {
  1: {
    id: 1,
    name: 'Rest periods',
    description: 'Adjust between-set rest seconds (least disruptive — try first).',
    requiresConfirmation: false,
  },
  2: {
    id: 2,
    name: 'Reps',
    description: 'Adjust target reps per set within the current scheme.',
    requiresConfirmation: false,
  },
  3: {
    id: 3,
    name: 'Sets',
    description: 'Add or drop a working set per exercise.',
    requiresConfirmation: false,
  },
  4: {
    id: 4,
    name: 'Exercise swaps',
    description: 'Swap exercises for same-muscle alternatives at a different difficulty.',
    requiresConfirmation: false,
  },
  5: {
    id: 5,
    name: 'Session duration',
    description: 'Shift session length within the user\'s selected time window.',
    requiresConfirmation: false,
  },
  6: {
    id: 6,
    name: 'Level change',
    description: 'Change the user\'s training level (most disruptive — needs confirmation).',
    requiresConfirmation: true,
  },
};

/**
 * Pick which lever should fire given a consecutive same-feedback streak.
 *
 *   streak < 2  → null  (Confirmation Rule: one session is never enough)
 *   streak = 2  → Lever 1 (rest)
 *   streak = 3  → Lever 2 (reps)
 *   streak = 4  → Lever 3 (sets)
 *   streak = 5  → Lever 4 (swaps)
 *   streak = 6  → Lever 5 (duration)
 *   streak ≥ 7  → Lever 6 (level change, requires confirmation)
 *
 * "just_right" feedback is logged but never triggers a lever — callers
 * should pass it through and check `feeling` themselves before calling.
 */
export function selectLeverForStreak(streak: number): LeverDefinition | null {
  if (streak < 2) return null;
  const id = Math.min(streak - 1, 6) as LeverId;
  return LEVERS[id];
}
