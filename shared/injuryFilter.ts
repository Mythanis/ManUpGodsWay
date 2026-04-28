export type InjuryStatus = 'allowed' | 'modify' | 'blocked';

export interface InjuryEvaluation {
  status: InjuryStatus;
  reasons: string[];
  modificationHints: string[];
}

export interface ExerciseForEval {
  name: string;
  bodyPart: string;
  hiit?: string;
  stretching?: string;
  equipment?: string;
  level?: string;
}

export interface InjuryForEval {
  bodyArea: string;
  injuryType: 'currently_injured' | 'recovery' | 'long_term_limitation';
}

const BODY_PART_AFFINITY: Record<string, string[]> = {
  'Knees':        ['Knees', 'Quads', 'Hamstrings', 'Calves', 'Adductors', 'Hip Flexors', 'Legs', 'Full Body'],
  'Lower Back':   ['Lower Back', 'Hamstrings', 'Glutes', 'Core', 'Abs', 'Obliques', 'Back', 'Lats', 'Upper Back', 'Full Body'],
  'Upper Back':   ['Upper Back', 'Back', 'Lats', 'Shoulders', 'Full Body'],
  'Back':         ['Back', 'Lower Back', 'Upper Back', 'Lats', 'Core', 'Hamstrings', 'Full Body'],
  'Shoulders':    ['Shoulders', 'Chest', 'Triceps', 'Lats', 'Upper Back', 'Back', 'Full Body'],
  'Hip Flexors':  ['Hip Flexors', 'Quads', 'Glutes', 'Hamstrings', 'Adductors', 'Legs', 'Full Body'],
  'Biceps':       ['Biceps', 'Forearms', 'Back', 'Lats'],
  'Triceps':      ['Triceps', 'Chest', 'Shoulders'],
  'Chest':        ['Chest', 'Shoulders', 'Triceps', 'Full Body'],
  'Calves':       ['Calves', 'Hamstrings', 'Knees'],
  'Hamstrings':   ['Hamstrings', 'Glutes', 'Lower Back', 'Knees'],
  'Adductors':    ['Adductors', 'Quads', 'Hamstrings', 'Glutes', 'Legs'],
  'Glutes':       ['Glutes', 'Hamstrings', 'Quads', 'Lower Back'],
  'Abs':          ['Abs', 'Core', 'Obliques'],
  'Core':         ['Core', 'Abs', 'Obliques', 'Lower Back'],
  'Obliques':     ['Obliques', 'Core', 'Abs'],
  'Forearms':     ['Forearms', 'Biceps'],
  'Neck':         ['Neck', 'Shoulders'],
  'Lats':         ['Lats', 'Back', 'Biceps', 'Shoulders'],
  'Quads':        ['Quads', 'Knees', 'Legs', 'Full Body'],
  'Legs':         ['Legs', 'Quads', 'Hamstrings', 'Calves', 'Adductors', 'Glutes', 'Full Body'],
  'Full Body':    ['Full Body', 'Abs', 'Back', 'Biceps', 'Calves', 'Chest', 'Core', 'Forearms', 'Glutes', 'Hamstrings', 'Hip Flexors', 'IT Band', 'Knees', 'Lats', 'Legs', 'Lower Back', 'Neck', 'Obliques', 'Quads', 'Shoulders', 'Triceps', 'Upper Back', 'Adductors'],
  'IT Band':      ['IT Band', 'Quads', 'Hamstrings', 'Knees', 'Legs'],
};

const HEAVY_COMPOUND_KEYWORDS = [
  'deadlift', 'squat', 'snatch', 'clean and', 'clean &', 'jerk', 'overhead press',
  'barbell press', 'military press', 'good morning', 'romanian deadlift', 'rdl',
  'pull-up', 'pullup', 'chin-up', 'chinup', 'lunge', 'thruster', 'barbell row',
  'bent over row', 'hip thrust', 'sumo', 'power clean',
];

const BALLISTIC_KEYWORDS = [
  'jump', 'plyometric', 'plyo', 'explosive', 'sprint', 'burpee', 'hop ', 'bounding',
  'box jump', 'tuck jump', 'bound', 'kipping', 'kip', 'slam', 'throw', 'velocity',
  'rapid fire', 'running', 'agility', 'skip', 'skater',
];

function matchesKeyword(name: string, keywords: string[]): boolean {
  const lower = name.toLowerCase();
  return keywords.some(k => lower.includes(k));
}

function isDirectMatch(injuredArea: string, exerciseBodyPart: string): boolean {
  return injuredArea.toLowerCase() === exerciseBodyPart.toLowerCase();
}

function isInAffinity(injuredArea: string, exerciseBodyPart: string): boolean {
  const affinity = BODY_PART_AFFINITY[injuredArea];
  if (!affinity) {
    const lower = injuredArea.toLowerCase();
    return lower === exerciseBodyPart.toLowerCase();
  }
  return affinity.some(p => p.toLowerCase() === exerciseBodyPart.toLowerCase());
}

function worsenStatus(current: InjuryStatus, incoming: InjuryStatus): InjuryStatus {
  if (incoming === 'blocked') return 'blocked';
  if (incoming === 'modify' && current === 'allowed') return 'modify';
  return current;
}

export function evaluateExerciseAgainstInjuries(
  exercise: ExerciseForEval,
  injuries: InjuryForEval[],
): InjuryEvaluation {
  if (!injuries || injuries.length === 0) {
    return { status: 'allowed', reasons: [], modificationHints: [] };
  }

  let status: InjuryStatus = 'allowed';
  const reasons: string[] = [];
  const hints: string[] = [];

  const isHIIT = exercise.hiit === 'Yes';
  const isStretch = exercise.stretching === 'Yes';
  const isBallistic = isHIIT || matchesKeyword(exercise.name, BALLISTIC_KEYWORDS);
  const isHeavyCompound = matchesKeyword(exercise.name, HEAVY_COMPOUND_KEYWORDS);
  const isAdvanced = exercise.level === 'Advanced';
  const equipmentStr = exercise.equipment || '';
  const isMachine = /machine|cable|smith/i.test(equipmentStr);

  for (const injury of injuries) {
    const { bodyArea, injuryType } = injury;
    const direct = isDirectMatch(bodyArea, exercise.bodyPart);
    const affected = isInAffinity(bodyArea, exercise.bodyPart);

    if (!direct && !affected) continue;

    if (injuryType === 'currently_injured') {
      if (direct) {
        status = worsenStatus(status, 'blocked');
        reasons.push(`Directly loads your ${bodyArea} injury — no direct work allowed.`);
      } else if (isBallistic) {
        status = worsenStatus(status, 'blocked');
        reasons.push(`High-impact movement stresses your ${bodyArea} injury.`);
      } else if (isStretch) {
        status = worsenStatus(status, 'blocked');
        reasons.push(`Deep stretching can aggravate your ${bodyArea} injury.`);
      } else if (isHeavyCompound) {
        status = worsenStatus(status, 'blocked');
        reasons.push(`Heavy compound requires ${bodyArea} to stabilize under full load.`);
      } else {
        status = worsenStatus(status, 'modify');
        reasons.push(`Uses ${bodyArea} as a stabilizer — reduce load and range of motion.`);
        hints.push('Use bodyweight or minimal load only.');
        hints.push('Reduce range of motion; avoid end-range positions.');
      }
    } else if (injuryType === 'recovery') {
      if (direct) {
        if (isBallistic) {
          status = worsenStatus(status, 'blocked');
          reasons.push(`Ballistic / high-impact too aggressive for recovering ${bodyArea}.`);
        } else if (isStretch && isAdvanced) {
          status = worsenStatus(status, 'blocked');
          reasons.push(`End-range loaded stretching could re-injure recovering ${bodyArea}.`);
        } else if (isHeavyCompound && isAdvanced) {
          status = worsenStatus(status, 'blocked');
          reasons.push(`Heavy load on ${bodyArea} too soon — wait until pain-free at full range.`);
        } else {
          status = worsenStatus(status, 'modify');
          reasons.push(`${bodyArea} is recovering — use minimum weight and 50% range of motion.`);
          hints.push('Start at 50% normal range of motion.');
          hints.push('Use the lightest available weight.');
          hints.push('Stop immediately if pain occurs — treat as current injury.');
        }
      } else {
        if (isBallistic) {
          status = worsenStatus(status, 'blocked');
          reasons.push(`High-impact stresses the recovering ${bodyArea} area.`);
        } else if (isHeavyCompound) {
          status = worsenStatus(status, 'modify');
          reasons.push(`Heavy compound involves recovering ${bodyArea} — reduce load.`);
          hints.push('Use lighter weight and controlled tempo.');
        } else {
          status = worsenStatus(status, 'modify');
          reasons.push(`Involves recovering ${bodyArea} area — keep load light.`);
          hints.push('Monitor for any pain or discomfort.');
        }
      }
    } else if (injuryType === 'long_term_limitation') {
      if (direct) {
        if (isBallistic) {
          status = worsenStatus(status, 'modify');
          reasons.push(`High-impact may aggravate your ${bodyArea} limitation.`);
          hints.push('Substitute with a low-impact alternative if possible.');
        } else if (isHeavyCompound && !isMachine) {
          status = worsenStatus(status, 'modify');
          reasons.push(`Heavy free-weight compounds stress your ${bodyArea} limitation.`);
          hints.push('Prefer machine or cable alternatives for better joint stability.');
          hints.push('Never go to maximum effort on the affected area.');
        } else if (isStretch) {
          status = worsenStatus(status, 'modify');
          reasons.push(`Monitor stretch intensity — ${bodyArea} limitation limits end-range stretch.`);
          hints.push('Stay within comfortable range; avoid end-range positions.');
        } else {
          reasons.push(`Involves your ${bodyArea} — use moderate weight only.`);
          hints.push('Never max-effort the affected area.');
        }
      }
    }
  }

  return {
    status,
    reasons: [...new Set(reasons)],
    modificationHints: [...new Set(hints)],
  };
}

export function getInjuryStatusLabel(status: InjuryStatus): string {
  switch (status) {
    case 'blocked': return '🔴 Blocked';
    case 'modify':  return '🟡 Caution';
    default:        return '';
  }
}

export function getInjuryStatusColor(status: InjuryStatus): string {
  switch (status) {
    case 'blocked': return 'bg-red-600 text-white';
    case 'modify':  return 'bg-yellow-500 text-black';
    default:        return '';
  }
}
