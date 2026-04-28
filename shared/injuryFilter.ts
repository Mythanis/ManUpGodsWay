export type InjuryStatus = 'allowed' | 'caution' | 'modify' | 'blocked';

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
  // Recovery start date — used to compute current recovery week when
  // weekNumber is not provided. ISO string, Date, or null/undefined →
  // fall back to week 1.
  startedAt?: string | Date | null;
  // Explicit current week of injury or recovery. When set, takes
  // precedence over startedAt-based math. 1-indexed.
  weekNumber?: number | null;
}

export interface InjuryRecommendation {
  bodyArea: string;
  recommendations: { name: string; why: string }[];
  compensationStretch: { name: string; why: string }[];
  compensationStrengthen: { name: string; why: string }[];
  stretchPolicy: string;
}

// ─── Rule pack definition ─────────────────────────────────────────────────
interface RulePack {
  label: string;
  // Exercise body_part values that count as a DIRECT hit on this injury area.
  bodyParts: string[];
  // Exercise body_part values that count as AFFECTED (uses the area as
  // stabilizer / secondary mover). Direct ⊆ affected logically.
  affinity: string[];
  // Exercise-name keyword matches blocked when currently injured / unrecovered.
  blockPatterns: string[];
  // Explicit allow exemptions — match these and the injury is ignored.
  allowPatterns: string[];
  // Stretches blocked (only checked when stretching === 'Yes').
  stretchBlockPatterns: string[];
  // Stretches explicitly allowed.
  stretchAllowPatterns: string[];
  // Keywords that identify a stretch as TARGETING this body area.
  // Used for state-driven hold-time and reintroduction enforcement.
  stretchAreaPatterns: string[];
  // Permanently avoid for long-term limitation (always block).
  longTermAvoidPatterns: string[];
  // Recommended substitutes for long-term limitation (allowed, no warning).
  longTermPreferPatterns: string[];
  // Hints to surface when long-term limitation hits a direct (uncovered) area.
  preferHints: string[];
  // Generic body-part-specific hints attached to modify-status results.
  modifyHints: string[];
  // Recovery week-by-week reintroduction order. `allowed` is a list of
  // exercise-name keywords that unlock at that week (cumulative).
  reintroduceByWeek: { week: number; allowed: string[] }[];
  // ALWAYS INCLUDE recommendations surfaced to the user (e.g., McGill Big
  // Three for lower back, rotator-cuff maintenance for shoulders).
  alwaysInclude: { name: string; why: string }[];
  // Surrounding muscles to stretch every session alongside the injury area.
  compensationStretch: { name: string; why: string }[];
  // Surrounding muscles to strengthen every session alongside the injury area.
  compensationStrengthen: { name: string; why: string }[];
}

// ─── Per-body-part rule packs ─────────────────────────────────────────────
const KNEES: RulePack = {
  label: 'Knees',
  bodyParts: ['Knees'],
  affinity: ['Quads', 'Hamstrings', 'Calves', 'Hip Flexors', 'Adductors', 'Glutes', 'Legs', 'IT Band', 'Full Body'],
  blockPatterns: [
    'squat', 'lunge', 'leg press', 'leg extension',
    'box jump', 'jump squat', 'plyo', 'plyometric',
    'running', 'jogging', 'jog ', 'high knee', 'butt kick', 'sprint',
    'kneeling', 'knee tuck', 'pistol',
  ],
  allowPatterns: [
    'swim', 'stationary bike', 'recumbent bike', 'exercise bike',
    'ankle circle', 'toe raise',
    'seated chest', 'seated shoulder', 'seated row', 'seated curl', 'seated tricep',
  ],
  stretchBlockPatterns: ['pigeon', 'kneeling hip flexor', 'deep knee', 'cossack'],
  stretchAllowPatterns: [
    'seated hamstring', 'supine quad', 'standing quad', 'seated calf',
    'wall hamstring', 'lying hamstring',
  ],
  stretchAreaPatterns: [
    'quad stretch', 'hamstring stretch', 'calf stretch', 'it band stretch',
    'knee stretch', 'iliotibial stretch', 'vastus stretch',
  ],
  longTermAvoidPatterns: [
    'deep squat', 'pistol squat', 'jump squat', 'box jump', 'plyometric',
    'kneeling',
  ],
  longTermPreferPatterns: [
    'leg press', 'hack squat', 'step-up', 'step up',
    'leg curl', 'cycling', 'elliptical',
  ],
  preferHints: [
    'Prefer leg press / hack squat over barbell squat.',
    'Prefer step-ups over lunges.',
    'Prefer cycling / elliptical over running.',
  ],
  modifyHints: [
    'Avoid deep knee flexion under load (stay above 90°).',
    'No kneeling on hard surfaces — pad the knee.',
  ],
  reintroduceByWeek: [
    { week: 1, allowed: ['glute bridge', 'leg curl'] },
    { week: 2, allowed: ['step-up', 'step up', 'leg press'] },
    { week: 3, allowed: ['goblet squat'] },
    { week: 4, allowed: ['bodyweight squat', 'air squat'] },
    { week: 5, allowed: ['squat'] },
    { week: 6, allowed: ['lunge'] },
  ],
  alwaysInclude: [],
  compensationStretch: [
    { name: 'Standing hip flexor stretch', why: 'Tight hip flexors shift load onto the knee joint.' },
    { name: 'Supine hamstring stretch', why: 'Hamstring tightness increases compressive force on the knee.' },
    { name: 'Standing calf / Achilles stretch', why: 'Limited ankle dorsiflexion forces the knee into poor mechanics.' },
    { name: 'IT band foam roll', why: 'Releases lateral tension that pulls the kneecap out of alignment.' },
  ],
  compensationStrengthen: [
    { name: 'Glute medius (clamshells, side-lying abduction)', why: 'Weak hips cause inward knee collapse under load.' },
    { name: 'VMO / inner quad (terminal knee extension)', why: 'Closes the last 15° of extension — the most knee-protective range.' },
    { name: 'Hamstring curls (seated or lying)', why: 'Balanced hamstring strength protects the ACL and reduces shear.' },
  ],
};

const LOWER_BACK: RulePack = {
  label: 'Lower Back',
  bodyParts: ['Lower Back'],
  affinity: ['Hamstrings', 'Glutes', 'Core', 'Abs', 'Obliques', 'Back', 'Lats', 'Upper Back', 'Quads', 'Legs', 'Full Body'],
  blockPatterns: [
    'deadlift', 'romanian deadlift', 'rdl',
    'barbell squat', 'back squat', 'front squat',
    'good morning',
    'bent over row', 'bent-over row', 'barbell row',
    'sit-up', 'sit up', 'situp', 'crunch',
    'overhead press', 'standing press', 'military press',
    'standing shoulder press',
    'running', 'jogging', 'sprint',
    'snatch', 'clean and', 'clean & ', 'jerk',
  ],
  allowPatterns: [
    'seated chest press', 'seated shoulder press', 'seated curl', 'seated tricep',
    'lying chest', 'lying tricep', 'lying curl',
    'glute bridge', 'bird dog', 'bird-dog',
    'walking', 'swim',
  ],
  stretchBlockPatterns: ['weighted', 'loaded twist', 'hyperextension'],
  stretchAllowPatterns: [
    'knee to chest', 'lying crossover', 'crossover stretch',
    'child pose', "child's pose", 'cat cow', 'cat-cow',
  ],
  stretchAreaPatterns: [
    'lower back stretch', 'lumbar stretch', 'back extension stretch',
    'spine stretch', 'spinal stretch', 'erector stretch',
    'hamstring stretch', 'hip flexor stretch',
  ],
  longTermAvoidPatterns: [
    'good morning',
    'sit-up', 'sit up', 'situp', 'crunch',
    'barbell back squat', 'back squat',
    'standing overhead', 'standing shoulder press', 'standing military',
    'hyperextension',
  ],
  longTermPreferPatterns: [
    'trap bar', 'trap-bar',
    'leg press',
    'seated row', 'cable row',
    'plank',
  ],
  preferHints: [
    'Prefer trap bar over conventional deadlift.',
    'Prefer leg press over barbell squat.',
    'Prefer seated cable rows over bent-over barbell rows.',
    'Prefer planks over crunches.',
  ],
  modifyHints: [
    'Hinge from the hip with a neutral spine — never round the lower back under load.',
  ],
  reintroduceByWeek: [
    { week: 1, allowed: ['dead bug', 'bird dog', 'bird-dog', 'glute bridge'] },
    { week: 2, allowed: ['dead bug', 'bird dog', 'bird-dog', 'glute bridge'] },
    { week: 3, allowed: ['romanian deadlift', 'rdl'] },
    { week: 4, allowed: ['romanian deadlift', 'rdl'] },
    { week: 5, allowed: ['goblet squat', 'dumbbell row', 'supported row'] },
    { week: 6, allowed: ['goblet squat', 'dumbbell row', 'supported row'] },
    { week: 7, allowed: ['barbell row', 'trap bar', 'trap-bar'] },
    { week: 8, allowed: ['barbell row', 'trap bar', 'trap-bar'] },
    { week: 9, allowed: ['deadlift', 'barbell squat', 'back squat'] },
  ],
  alwaysInclude: [
    { name: 'Side Plank', why: 'McGill Big Three — quadratus lumborum and oblique stability.' },
    { name: 'Hip flexor stretch', why: 'Tight hip flexors pull on the lumbar spine.' },
  ],
  compensationStretch: [
    { name: 'Kneeling hip flexor stretch', why: 'Tight hip flexors anteriorly tilt the pelvis and compress the lumbar discs.' },
    { name: 'Supine hamstring stretch', why: 'Tight hamstrings posteriorly tilt the pelvis and reduce lumbar curve.' },
    { name: 'Piriformis / figure-four stretch', why: 'Piriformis tightness can refer pain into the lower back via the SI joint.' },
  ],
  compensationStrengthen: [
    { name: 'Glute strengthening (bridges, hip thrusts)', why: 'Weak glutes force the erectors to overwork — the #1 driver of low-back fatigue.' },
    { name: 'Deep core activation (dead bug, hollow hold)', why: 'Transverse abdominis bracing reduces spinal compressive load by up to 40%.' },
    { name: 'Quadratus lumborum (side plank variations)', why: 'QL weakness causes lateral instability and micro-shear on lumbar vertebrae.' },
  ],
};

const SHOULDERS: RulePack = {
  label: 'Shoulders',
  bodyParts: ['Shoulders'],
  affinity: ['Chest', 'Triceps', 'Lats', 'Upper Back', 'Back', 'Full Body'],
  blockPatterns: [
    'overhead press', 'shoulder press', 'military press',
    'upright row',
    'behind the neck', 'behind-the-neck',
    'lateral raise',
    'pull-up', 'pullup', 'pull up', 'chin-up', 'chinup', 'chin up',
    'bench press',
    'dip ', 'dips ',
    'throw', 'throwing',
    'snatch', 'jerk', 'clean and', 'clean & ',
  ],
  allowPatterns: [
    'squat', 'deadlift', 'lunge', 'leg press',
    'plank', 'dead bug', 'hollow hold',
    'wrist', 'forearm',
    'walking', 'cycling',
  ],
  stretchBlockPatterns: ['behind back', 'behind the back', 'overhead reach'],
  stretchAllowPatterns: ['cross body', 'cross-body', 'pendulum'],
  stretchAreaPatterns: [
    'shoulder stretch', 'pec stretch', 'chest stretch', 'pectoral stretch',
    'posterior capsule', 'internal rotation stretch', 'external rotation stretch',
    'anterior shoulder stretch', 'doorframe stretch',
  ],
  longTermAvoidPatterns: [
    'behind the neck', 'behind-the-neck',
    'upright row',
    'barbell overhead', 'standing barbell press',
  ],
  longTermPreferPatterns: [
    'dumbbell press', 'incline', 'neutral grip',
    'machine shoulder', 'cable lateral',
    'face pull',
  ],
  preferHints: [
    'Prefer dumbbell press over barbell (natural rotation).',
    'Prefer incline over flat bench (less anterior impingement).',
    'Add face pulls every upper-body session.',
  ],
  modifyHints: [
    'Stay below shoulder height under load until cleared.',
  ],
  reintroduceByWeek: [
    { week: 1, allowed: ['internal rotation', 'external rotation', 'band rotation'] },
    { week: 2, allowed: ['internal rotation', 'external rotation', 'band rotation'] },
    { week: 3, allowed: ['shrug', 'scapular', 'wall slide', 'retraction'] },
    { week: 4, allowed: ['shrug', 'scapular', 'wall slide', 'retraction'] },
    { week: 5, allowed: ['dumbbell row', 'face pull'] },
    { week: 6, allowed: ['dumbbell row', 'face pull'] },
    { week: 7, allowed: ['incline dumbbell press', 'incline press'] },
    { week: 8, allowed: ['incline dumbbell press', 'incline press'] },
    { week: 9, allowed: ['flat press', 'lateral raise', 'bench press'] },
    { week: 10, allowed: ['flat press', 'lateral raise', 'bench press'] },
    { week: 11, allowed: ['overhead press', 'shoulder press'] },
  ],
  alwaysInclude: [
    { name: 'External rotation (band)', why: 'Rotator cuff maintenance — 3 × 15 light, every upper-body session.' },
    { name: 'Face pulls', why: 'Strengthens posterior rotator cuff — protective.' },
    { name: 'Band pull-aparts', why: 'Scapular stability and posterior chain balance.' },
  ],
  compensationStretch: [
    { name: 'Doorframe pec minor stretch', why: 'Tight pec minor impinges the subacromial space and compresses the shoulder joint.' },
    { name: 'Thoracic spine extension (foam roll)', why: 'Restricted T-spine forces the shoulder to overcompensate at end-range.' },
    { name: 'Cross-body posterior capsule stretch', why: 'Posterior capsule tightness is the primary driver of shoulder impingement.' },
  ],
  compensationStrengthen: [
    { name: 'Rotator cuff external rotation (band)', why: 'Balances the dominant internal rotators and stabilises the humeral head.' },
    { name: 'Lower / mid trapezius (face pulls, Y-raises)', why: 'Weak lower trap allows scapular winging and impingement.' },
    { name: 'Serratus anterior (wall slides, push-up plus)', why: 'Serratus keeps the scapula flat against the rib cage during overhead movement.' },
  ],
};

const HIPS: RulePack = {
  label: 'Hips',
  bodyParts: ['Hip Flexors', 'Glutes', 'Adductors'],
  affinity: ['Quads', 'Hamstrings', 'Lower Back', 'Knees', 'Legs', 'Full Body', 'IT Band'],
  blockPatterns: [
    'squat', 'deadlift', 'hip thrust', 'glute bridge',
    'lunge', 'step-up', 'step up', 'leg press',
    'plyo', 'plyometric', 'box jump', 'jump squat',
    'hip abductor', 'hip adductor',
    'running', 'jogging', 'sprint', 'cycling',
  ],
  allowPatterns: [
    'seated chest', 'seated shoulder', 'seated row', 'seated curl', 'seated tricep',
    'lying chest', 'lying tricep', 'lying curl',
    'flutter kick', 'hollow hold',
  ],
  stretchBlockPatterns: [
    'pigeon', 'cossack', 'butterfly',
    'deep hip flexor', 'kneeling hip flexor',
  ],
  stretchAllowPatterns: ['supine figure', 'figure four', 'supine figure four'],
  stretchAreaPatterns: [
    'hip stretch', 'hip flexor stretch', 'glute stretch', 'adductor stretch',
    'groin stretch', 'psoas stretch', 'iliacus stretch', 'hip rotator stretch',
  ],
  longTermAvoidPatterns: [
    'deep squat', 'pistol squat',
    'plyo', 'plyometric',
  ],
  longTermPreferPatterns: [
    'hip thrust', 'step-up', 'step up',
    'sumo', 'leg press',
  ],
  preferHints: [
    'Prefer hip thrust over barbell squat for glute development.',
    'Prefer step-ups over lunges.',
    'Prefer sumo stance for deadlifts.',
  ],
  modifyHints: [
    'Stop immediately on any clicking, pinching, or sharp hip pain.',
  ],
  reintroduceByWeek: [
    { week: 1, allowed: ['clamshell', 'side-lying hip', 'side lying hip'] },
    { week: 2, allowed: ['clamshell', 'side-lying hip', 'side lying hip', 'supine figure'] },
    { week: 3, allowed: ['glute bridge'] },
    { week: 4, allowed: ['glute bridge', 'kneeling hip flexor'] },
    { week: 5, allowed: ['bodyweight squat', 'air squat', 'step-up', 'step up'] },
    { week: 6, allowed: ['bodyweight squat', 'air squat', 'step-up', 'step up', 'pigeon'] },
    { week: 7, allowed: ['hip thrust', 'romanian deadlift', 'rdl'] },
    { week: 8, allowed: ['hip thrust', 'romanian deadlift', 'rdl'] },
    { week: 9, allowed: ['squat', 'deadlift'] },
  ],
  alwaysInclude: [
    { name: 'Hip flexor stretch', why: 'Tightness is a major driver of hip pain.' },
    { name: 'Clamshell', why: 'Strengthens the glute medius — weak glutes overload the hip joint.' },
  ],
  compensationStretch: [
    { name: 'Standing hip flexor (lunge stretch)', why: 'Hip flexor tightness is the most common contributor to hip joint impingement.' },
    { name: 'IT band foam roll', why: 'IT band tension creates lateral hip pain and affects gait mechanics.' },
    { name: 'Supine glute stretch (figure four)', why: 'Releases the piriformis and short hip rotators without stressing the joint capsule.' },
  ],
  compensationStrengthen: [
    { name: 'Hip abductors (clamshells, side-lying raises)', why: 'Abductor weakness is the primary cause of hip drop and joint overload.' },
    { name: 'Glute medius (single-leg balance, lateral band walk)', why: 'Controls frontal-plane pelvic stability through every step.' },
    { name: 'Transverse abdominis (dead bug, hollow hold)', why: 'Core co-contraction reduces hip joint contact force by up to 30%.' },
  ],
};

const UPPER_BACK_NECK: RulePack = {
  label: 'Upper Back / Neck',
  bodyParts: ['Upper Back', 'Neck'],
  affinity: ['Lats', 'Back', 'Shoulders', 'Full Body'],
  blockPatterns: [
    'overhead press', 'shoulder press', 'military press',
    'pull-up', 'pullup', 'pull up', 'chin-up', 'chinup', 'chin up',
    'shrug',
    'upright row',
    'behind the neck', 'behind-the-neck',
    'barbell back squat', 'back squat',
    'deadlift',
  ],
  allowPatterns: [
    'leg press', 'leg extension', 'leg curl',
    'seated chest', 'seated bicep', 'seated tricep',
    'lying tricep', 'lying curl',
  ],
  stretchBlockPatterns: ['loaded neck', 'weighted neck'],
  stretchAllowPatterns: ['chin tuck', 'neck side tilt', 'side tilt'],
  stretchAreaPatterns: [
    'neck stretch', 'upper trap stretch', 'cervical stretch', 'upper back stretch',
    'thoracic stretch', 'levator stretch', 'trapezius stretch',
    'suboccipital stretch', 'scalene stretch',
  ],
  longTermAvoidPatterns: [],
  longTermPreferPatterns: [
    'safety bar squat', 'goblet squat',
    'trap bar', 'trap-bar',
    'seated cable row', 'seated row',
    'dumbbell',
  ],
  preferHints: [
    'Prefer safety bar / goblet squat over barbell back squat.',
    'Prefer trap bar over conventional deadlift.',
    'Prefer seated cable row over bent-over row.',
    'Prefer dumbbells over barbells (less cervical stabilization).',
  ],
  modifyHints: [
    'Avoid bracing through the neck — keep the chin tucked, eyes forward.',
  ],
  reintroduceByWeek: [
    { week: 1, allowed: ['chin tuck', 'neck side tilt'] },
    { week: 2, allowed: ['chin tuck', 'neck side tilt', 'scapular'] },
    { week: 3, allowed: ['shrug', 'cable row'] },
    { week: 4, allowed: ['shrug', 'cable row', 'dumbbell row'] },
    { week: 5, allowed: ['lat pulldown', 'seated row'] },
    { week: 6, allowed: ['goblet squat', 'trap bar', 'trap-bar'] },
  ],
  alwaysInclude: [],
  compensationStretch: [
    { name: 'Upper trapezius stretch (ear to shoulder, no force)', why: 'Upper trap is chronically overloaded by forward-head posture and stress.' },
    { name: 'Levator scapulae stretch (chin down and across)', why: 'Levator tightness creates the "stiff neck" sensation and restricts rotation.' },
    { name: 'Thoracic extension over a foam roller', why: 'Stiff T-spine transfers movement demand onto the cervical joints.' },
  ],
  compensationStrengthen: [
    { name: 'Deep neck flexors (chin tucks, gentle resistance)', why: 'Deep flexors support the cervical curve — their weakness drives forward head posture.' },
    { name: 'Rhomboids (band rows, face pulls)', why: 'Scapular retraction reduces the pull on the cervical extensors.' },
    { name: 'Lower trapezius (Y-raises, prone T)', why: 'Lower trap prevents scapular elevation that compresses the upper neck.' },
  ],
};

const WRISTS_FOREARMS: RulePack = {
  label: 'Wrists / Forearms',
  bodyParts: ['Forearms'],
  affinity: ['Biceps', 'Triceps', 'Chest', 'Shoulders', 'Back', 'Lats'],
  blockPatterns: [
    'barbell press', 'barbell bench', 'barbell row',
    'push-up', 'push up', 'pushup',
    'wrist curl', 'wrist extension',
  ],
  allowPatterns: [
    'forearm plank', 'elbow plank',
    'lunge', 'squat', 'deadlift', 'leg press', 'leg curl', 'leg extension',
    'machine chest', 'machine row', 'machine shoulder',
  ],
  stretchBlockPatterns: ['weighted wrist'],
  stretchAllowPatterns: ['wrist circle', 'wrist mobility', 'finger'],
  stretchAreaPatterns: [
    'wrist stretch', 'forearm stretch', 'wrist flexor stretch', 'wrist extensor stretch',
    'finger stretch', 'carpal stretch',
  ],
  longTermAvoidPatterns: ['wrist curl', 'heavy wrist'],
  longTermPreferPatterns: [
    'neutral grip', 'hammer grip',
    'ez bar', 'ez-bar',
    'machine',
  ],
  preferHints: [
    'Prefer neutral / hammer grip for pressing.',
    'Prefer EZ bar over straight bar for curls.',
    'Use wrist wraps for any heavy pressing.',
    'Use straps to reduce grip demand on heavy back work.',
  ],
  modifyHints: [
    'Use wrist wraps; switch hand-plank variations to forearm plank.',
  ],
  reintroduceByWeek: [],
  alwaysInclude: [],
  compensationStretch: [
    { name: 'Wrist flexor stretch (arm extended, palm up)', why: 'Flexor tightness is the leading cause of medial wrist and carpal tunnel pain.' },
    { name: 'Wrist extensor stretch (arm extended, palm down)', why: 'Extensor overuse from keyboard work or gripping compounds tendinopathy.' },
    { name: 'Finger flexor stretch (prayer position)', why: 'Releases cumulative tension from gripping exercises and daily tasks.' },
  ],
  compensationStrengthen: [
    { name: 'Wrist extensor resistance (light dumbbell, low rep)', why: 'Extensor weakness is the root cause of most lateral wrist tendinopathy.' },
    { name: 'Pronation / supination (light dumbbell or band)', why: 'Balanced rotation prevents torque build-up at the radio-ulnar joint.' },
    { name: 'Grip strengthening (stress ball, towel twists)', why: 'Controlled grip strength reduces injury risk on all pulling and pressing movements.' },
  ],
};

const ANKLES_CALVES: RulePack = {
  label: 'Ankles / Calves',
  bodyParts: ['Calves'],
  affinity: ['Hamstrings', 'Quads', 'Knees', 'Hip Flexors', 'Glutes', 'Adductors', 'Legs', 'Full Body'],
  blockPatterns: [
    'squat', 'lunge', 'deadlift',
    'calf raise',
    'running', 'jogging', 'sprint', 'jumping', 'jump squat', 'box jump', 'plyo', 'plyometric',
    'step-up', 'step up',
    'standing balance',
  ],
  allowPatterns: [
    'seated chest', 'seated shoulder', 'seated row', 'seated curl', 'seated tricep',
    'lying chest', 'lying tricep', 'lying curl',
    'seated leg curl', 'seated leg extension',
  ],
  stretchBlockPatterns: ['standing calf stretch'],
  stretchAllowPatterns: ['seated ankle', 'ankle circle', 'seated calf stretch'],
  stretchAreaPatterns: [
    'calf stretch', 'ankle stretch', 'achilles stretch', 'soleus stretch',
    'plantar stretch', 'gastrocnemius stretch', 'dorsiflexion stretch',
  ],
  longTermAvoidPatterns: [],
  longTermPreferPatterns: [
    'seated calf', 'machine calf',
  ],
  preferHints: [
    'Prefer seated / machine calf raises over standing.',
    'Avoid plyometrics until full recovery.',
  ],
  modifyHints: [],
  reintroduceByWeek: [
    { week: 1, allowed: ['seated calf'] },
    { week: 2, allowed: ['seated calf'] },
    { week: 3, allowed: ['standing calf', 'calf raise'] },
    { week: 4, allowed: ['standing calf', 'calf raise'] },
    { week: 5, allowed: ['bodyweight squat', 'air squat'] },
    { week: 6, allowed: ['bodyweight squat', 'air squat'] },
    { week: 7, allowed: ['squat', 'lunge', 'deadlift'] },
    { week: 10, allowed: ['plyo', 'jump', 'box jump', 'plyometric'] },
  ],
  alwaysInclude: [],
  compensationStretch: [
    { name: 'Gastroc / soleus calf stretch (wall or step)', why: 'Calf tightness reduces ankle dorsiflexion and shifts load onto the ankle and knee.' },
    { name: 'Plantar fascia stretch (toe extension or rolling)', why: 'The plantar fascia is continuous with the Achilles — stretching both reduces overall tension.' },
    { name: 'Ankle alphabet / circles (non-weight-bearing)', why: 'Maintains proprioception and full joint range without stressing the healing tissue.' },
  ],
  compensationStrengthen: [
    { name: 'Tibialis anterior (seated toe raises)', why: 'Tibialis weakness causes excessive ankle pronation and stress fracture risk.' },
    { name: 'Peroneals (resistance band eversion)', why: 'Peroneal weakness is the primary risk factor for lateral ankle sprain recurrence.' },
    { name: 'Intrinsic foot muscles (towel scrunches, toe spreads)', why: 'Foot intrinsics provide the dynamic arch support the ankle depends on during loading.' },
  ],
};

// ─── Body area normalization ──────────────────────────────────────────────
// Map the user-selected body area (case-insensitive) to its rule pack.
// Umbrella terms (Hips, Wrists, Ankles) and the related
// specific body parts (Hip Flexors, Forearms, Calves, Neck, etc.) all
// resolve to the same pack so the spec's per-area rules apply.
const RULE_PACK_BY_AREA: Record<string, RulePack> = {
  'knees':                KNEES,
  'lower back':           LOWER_BACK,
  'shoulders':            SHOULDERS,
  'hips':                 HIPS,
  'hip flexors':          HIPS,
  'glutes':               HIPS,
  'adductors':            HIPS,
  'upper back':           UPPER_BACK_NECK,
  'neck':                 UPPER_BACK_NECK,
  'upper back / neck':    UPPER_BACK_NECK,
  'wrists':               WRISTS_FOREARMS,
  'forearms':             WRISTS_FOREARMS,
  'wrists / forearms':    WRISTS_FOREARMS,
  'ankles':               ANKLES_CALVES,
  'calves':               ANKLES_CALVES,
  'ankles / calves':      ANKLES_CALVES,
};

// Body areas that should appear in the "Add Injury" dropdown alongside the
// 23 exercise body parts — the umbrellas the spec references.
export const UMBRELLA_BODY_AREAS = ['Hips', 'Wrists', 'Ankles'];

function getRulePack(bodyArea: string): RulePack | null {
  return RULE_PACK_BY_AREA[bodyArea.trim().toLowerCase()] ?? null;
}

// ─── Generic affinity (fallback for areas without a dedicated pack) ───────
// Kept for body parts like Biceps, Triceps, Chest, IT Band, etc. that the
// spec doesn't enumerate specifically.
const GENERIC_AFFINITY: Record<string, string[]> = {
  'Biceps':       ['Biceps', 'Forearms', 'Back', 'Lats'],
  'Triceps':      ['Triceps', 'Chest', 'Shoulders'],
  'Chest':        ['Chest', 'Shoulders', 'Triceps', 'Full Body'],
  'Hamstrings':   ['Hamstrings', 'Glutes', 'Lower Back', 'Knees'],
  'Quads':        ['Quads', 'Knees', 'Legs', 'Full Body'],
  'Abs':          ['Abs', 'Core', 'Obliques'],
  'Core':         ['Core', 'Abs', 'Obliques', 'Lower Back'],
  'Obliques':     ['Obliques', 'Core', 'Abs'],
  'Lats':         ['Lats', 'Back', 'Biceps', 'Shoulders'],
  'Back':         ['Back', 'Lower Back', 'Upper Back', 'Lats', 'Core', 'Hamstrings', 'Full Body'],
  'Legs':         ['Legs', 'Quads', 'Hamstrings', 'Calves', 'Adductors', 'Glutes', 'Full Body'],
  'IT Band':      ['IT Band', 'Quads', 'Hamstrings', 'Knees', 'Legs'],
  'Full Body':    ['Full Body'],
};

const GENERIC_HEAVY_COMPOUND = [
  'deadlift', 'squat', 'snatch', 'clean and', 'clean &', 'jerk', 'overhead press',
  'barbell press', 'military press', 'good morning', 'romanian deadlift', 'rdl',
  'pull-up', 'pullup', 'chin-up', 'chinup', 'lunge', 'thruster', 'barbell row',
  'bent over row', 'hip thrust', 'sumo', 'power clean',
];

const GENERIC_BALLISTIC = [
  'jump', 'plyometric', 'plyo', 'explosive', 'sprint', 'burpee', 'hop ', 'bounding',
  'box jump', 'tuck jump', 'bound', 'kipping', 'kip', 'slam', 'throw', 'velocity',
  'rapid fire', 'running', 'agility', 'skip', 'skater',
];

// ─── Helpers ──────────────────────────────────────────────────────────────
function lower(s: string): string {
  return (s || '').toLowerCase();
}

function matchesAny(name: string, patterns: string[]): string | null {
  const n = lower(name);
  for (const p of patterns) {
    if (n.includes(p)) return p;
  }
  return null;
}

function isMachineEquipment(equipment: string | undefined): boolean {
  return /machine|cable|smith/i.test(equipment || '');
}

// Compute the current recovery week (1-indexed) from the start date.
// Null/undefined → week 1.
export function computeRecoveryWeek(startedAt: string | Date | null | undefined): number {
  if (!startedAt) return 1;
  const start = startedAt instanceof Date ? startedAt : new Date(startedAt);
  if (isNaN(start.getTime())) return 1;
  const now = Date.now();
  const days = Math.max(0, (now - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.floor(days / 7) + 1;
}

// Resolve the current week of an injury. Prefers the user-supplied
// weekNumber (explicit "I'm in week 3"), falls back to startedAt-based
// math, then to week 1. Used for both currently_injured and recovery
// injuries so the engine can adjust progression accordingly.
export function getCurrentInjuryWeek(injury: Pick<InjuryForEval, 'weekNumber' | 'startedAt'>): number {
  if (typeof injury.weekNumber === 'number' && injury.weekNumber >= 1) {
    return Math.min(52, Math.floor(injury.weekNumber));
  }
  return computeRecoveryWeek(injury.startedAt);
}

// Patterns unlocked at or before the current week (cumulative).
function allowedUpToWeek(reintroduce: { week: number; allowed: string[] }[], currentWeek: number): string[] {
  const set = new Set<string>();
  for (const entry of reintroduce) {
    if (entry.week <= currentWeek) {
      for (const p of entry.allowed) set.add(p);
    }
  }
  return Array.from(set);
}

// First week at which an exercise-name keyword unlocks. Null if it never
// appears in the reintroduce schedule.
function firstUnlockWeek(name: string, reintroduce: { week: number; allowed: string[] }[]): number | null {
  const n = lower(name);
  let earliest: number | null = null;
  for (const entry of reintroduce) {
    if (entry.allowed.some(p => n.includes(p))) {
      if (earliest === null || entry.week < earliest) earliest = entry.week;
    }
  }
  return earliest;
}

// ─── Status severity ──────────────────────────────────────────────────────
const STATUS_RANK: Record<InjuryStatus, number> = {
  blocked: 3,
  modify: 2,
  caution: 1,
  allowed: 0,
};

function worsenStatus(current: InjuryStatus, incoming: InjuryStatus): InjuryStatus {
  return STATUS_RANK[incoming] > STATUS_RANK[current] ? incoming : current;
}

// ─── Generic fallback evaluator (no rule pack) ────────────────────────────
// Mirrors the original heuristic logic for body areas not covered by a pack.
function evaluateGeneric(
  exercise: ExerciseForEval,
  injury: InjuryForEval,
  acc: { status: InjuryStatus; reasons: string[]; hints: string[] },
): void {
  const bodyArea = injury.bodyArea;
  const direct = lower(bodyArea) === lower(exercise.bodyPart);
  const affinity = GENERIC_AFFINITY[bodyArea] ?? [bodyArea];
  const affected = direct || affinity.some(p => lower(p) === lower(exercise.bodyPart));
  if (!direct && !affected) return;

  const isStretch = exercise.stretching === 'Yes';
  const isHIIT = exercise.hiit === 'Yes';
  const isBallistic = isHIIT || matchesAny(exercise.name, GENERIC_BALLISTIC) !== null;
  const isHeavyCompound = matchesAny(exercise.name, GENERIC_HEAVY_COMPOUND) !== null;
  const isMachine = isMachineEquipment(exercise.equipment);

  const exName = exerciseDisplay(exercise.name);

  if (injury.injuryType === 'currently_injured') {
    if (direct) {
      acc.status = worsenStatus(acc.status, 'blocked');
      acc.reasons.push(`${exName} directly loads your ${bodyArea} injury — no direct work allowed.`);
    } else if (isBallistic) {
      acc.status = worsenStatus(acc.status, 'blocked');
      acc.reasons.push(`${exName} is high-impact and stresses your ${bodyArea} injury.`);
    } else if (isStretch) {
      acc.status = worsenStatus(acc.status, 'blocked');
      acc.reasons.push(`${exName} stretches deeply and can aggravate your ${bodyArea} injury.`);
    } else if (isHeavyCompound) {
      acc.status = worsenStatus(acc.status, 'blocked');
      acc.reasons.push(`${exName} requires ${bodyArea} to stabilize under full load.`);
    } else {
      acc.status = worsenStatus(acc.status, 'modify');
      acc.reasons.push(`${exName} uses ${bodyArea} as a stabilizer — reduce load and range of motion.`);
      acc.hints.push('Use bodyweight or minimal load only.');
    }
  } else if (injury.injuryType === 'recovery') {
    if (direct) {
      if (isBallistic || isStretch || isHeavyCompound) {
        acc.status = worsenStatus(acc.status, 'blocked');
        acc.reasons.push(`${exName} is too aggressive for your recovering ${bodyArea} — wait until pain-free at full range.`);
      } else {
        acc.status = worsenStatus(acc.status, 'modify');
        acc.reasons.push(`${exName} loads your recovering ${bodyArea} — use light load and reduced range of motion.`);
        acc.hints.push('Use the lightest weight; stop at any pain.');
      }
    } else if (isBallistic) {
      acc.status = worsenStatus(acc.status, 'blocked');
      acc.reasons.push(`${exName} is high-impact and stresses your recovering ${bodyArea}.`);
    } else if (isHeavyCompound) {
      acc.status = worsenStatus(acc.status, 'modify');
      acc.reasons.push(`${exName} is a heavy compound that involves your recovering ${bodyArea} — reduce load.`);
    }
  } else if (injury.injuryType === 'long_term_limitation') {
    if (direct) {
      if (isBallistic) {
        acc.status = worsenStatus(acc.status, 'blocked');
        acc.reasons.push(`${exName} is high-impact and directly stresses your ${bodyArea} long-term limitation.`);
      } else if (isHeavyCompound && !isMachine) {
        acc.status = worsenStatus(acc.status, 'blocked');
        acc.reasons.push(`${exName} is a heavy free-weight compound that directly loads your ${bodyArea} limitation.`);
        acc.hints.push('Use machine or cable alternatives for better joint stability.');
      } else if (isStretch) {
        acc.status = worsenStatus(acc.status, 'modify');
        acc.reasons.push(`${exName} reaches end-range — monitor intensity for your ${bodyArea} limitation.`);
      } else {
        acc.status = worsenStatus(acc.status, 'caution');
        acc.reasons.push(`${exName} involves your ${bodyArea} limitation — use moderate weight only.`);
      }
    } else if (isBallistic) {
      acc.status = worsenStatus(acc.status, 'modify');
      acc.reasons.push(`${exName} is high-impact and stresses your ${bodyArea} long-term limitation area.`);
    } else if (isHeavyCompound && !isMachine) {
      acc.status = worsenStatus(acc.status, 'caution');
      acc.reasons.push(`${exName} is a heavy compound that loads your ${bodyArea} limitation area.`);
    }
  }
}

// ─── Main evaluator ───────────────────────────────────────────────────────
export function evaluateExerciseAgainstInjuries(
  exercise: ExerciseForEval,
  injuries: InjuryForEval[],
): InjuryEvaluation {
  if (!injuries || injuries.length === 0) {
    return { status: 'allowed', reasons: [], modificationHints: [] };
  }

  const acc = {
    status: 'allowed' as InjuryStatus,
    reasons: [] as string[],
    hints: [] as string[],
  };

  for (const injury of injuries) {
    const pack = getRulePack(injury.bodyArea);
    if (!pack) {
      evaluateGeneric(exercise, injury, acc);
      continue;
    }
    evaluateAgainstPack(exercise, injury, pack, acc);
  }

  return {
    status: acc.status,
    reasons: Array.from(new Set(acc.reasons)),
    modificationHints: Array.from(new Set(acc.hints)),
  };
}

function evaluateAgainstPack(
  exercise: ExerciseForEval,
  injury: InjuryForEval,
  pack: RulePack,
  acc: { status: InjuryStatus; reasons: string[]; hints: string[] },
): void {
  const direct = pack.bodyParts.some(p => lower(p) === lower(exercise.bodyPart));
  const affected = direct || pack.affinity.some(p => lower(p) === lower(exercise.bodyPart));
  if (!affected) return;

  // 1. Explicit allow override — covers exercises like "stationary bike" for
  //    knee injuries or "seated chest press" for lower-back injuries that the
  //    spec lists under ALLOW.
  if (matchesAny(exercise.name, pack.allowPatterns)) return;

  const isStretch = exercise.stretching === 'Yes';

  // 2. Stretch-specific rules — only check when the exercise is tagged as a
  //    stretch; an unmatched stretch falls through to the type-based rules.
  if (isStretch) {
    // 2a. Spec-approved gentle stretches take precedence over the new
    //     state-based area logic — these are explicitly safe for the injury.
    if (matchesAny(exercise.name, pack.stretchAllowPatterns)) {
      return;
    }

    // 2b. Spec-blocked stretches — always blocked regardless of state.
    const blockedStretch = matchesAny(exercise.name, pack.stretchBlockPatterns);
    if (blockedStretch) {
      acc.status = worsenStatus(acc.status, 'blocked');
      acc.reasons.push(
        `${formatExerciseRef(blockedStretch)} stretch is too aggressive for your ${pack.label} ${injuryTypeLabel(injury.injuryType)}.`,
      );
      return;
    }

    // 2c. State-driven area-stretch rules (new).
    //     Applies when the stretch DIRECTLY targets the injured body part
    //     (exercise.bodyPart is in pack.bodyParts) OR when the exercise name
    //     matches stretchAreaPatterns — both indicate the stretch loads the
    //     exact injury area rather than merely using it as a stabilizer.
    const matchesArea = matchesAny(exercise.name, pack.stretchAreaPatterns);
    if (direct || matchesArea) {
      const exName = exerciseDisplay(exercise.name);

      if (injury.injuryType === 'currently_injured') {
        acc.status = worsenStatus(acc.status, 'blocked');
        acc.reasons.push(
          `${exName} targets your current ${pack.label} injury — stretches must avoid the injured area. Only seated / lying stretches with max 20-second holds.`,
        );
        return;
      }

      if (injury.injuryType === 'recovery') {
        const week = getCurrentInjuryWeek(injury);
        if (week < 6) {
          acc.status = worsenStatus(acc.status, 'blocked');
          acc.reasons.push(
            `Stretching the ${pack.label} is reintroduced at Week 6 of recovery (currently Week ${week}) — let the tissue heal before loading it under tension.`,
          );
          return;
        }
        // Week 6+ — allow but flag with hold-time coaching.
        acc.status = worsenStatus(acc.status, 'modify');
        acc.reasons.push(
          `${exName} — use ~50% of your normal hold time and never stretch into pain. Add 5 seconds per pain-free week.`,
        );
        return;
      }

      // long_term_limitation — area stretches are encouraged; no blocking.
      // Coaching delivered via recommendations card. Return early so the
      // exercise doesn't fall through to the direct-load caution rule below.
      if (injury.injuryType === 'long_term_limitation') return;
    }
    // Unmatched stretch on affected area (affinity only, no name match) —
    // fall through to type-based rules which apply the appropriate caution.
  }

  // Short, human-readable name for this exercise — used in every reason so
  // the user always sees which exercise the rule applies to (rather than
  // just the body area).
  const exName = exerciseDisplay(exercise.name);

  // 3. Long-term limitation
  if (injury.injuryType === 'long_term_limitation') {
    const avoid = matchesAny(exercise.name, pack.longTermAvoidPatterns);
    if (avoid) {
      acc.status = worsenStatus(acc.status, 'blocked');
      acc.reasons.push(
        withSubstitute(
          `${exName} is on the permanent avoid list for your ${pack.label} limitation.`,
          pack.longTermPreferPatterns,
        ),
      );
      return;
    }
    if (matchesAny(exercise.name, pack.longTermPreferPatterns)) {
      // Recommended substitute — allowed silently (no warning badge).
      return;
    }
    const block = matchesAny(exercise.name, pack.blockPatterns);
    if (block && direct) {
      acc.status = worsenStatus(acc.status, 'blocked');
      acc.reasons.push(
        withSubstitute(
          `${exName} aggravates your ${pack.label} limitation.`,
          pack.longTermPreferPatterns,
        ),
      );
      return;
    }
    if (direct) {
      acc.status = worsenStatus(acc.status, 'caution');
      acc.reasons.push(
        withSubstitute(
          `${exName} loads your ${pack.label} limitation — use moderate weight only.`,
          pack.longTermPreferPatterns,
        ),
      );
      pack.preferHints.forEach(h => acc.hints.push(h));
      return;
    }
    // Affected only, no specific match → no warning.
    return;
  }

  // 4. Recovery
  if (injury.injuryType === 'recovery') {
    const week = getCurrentInjuryWeek(injury);
    const allowedThisWeek = allowedUpToWeek(pack.reintroduceByWeek, week);
    const matchedAllowedNow = allowedThisWeek.find(p => lower(exercise.name).includes(p));
    if (matchedAllowedNow) {
      acc.status = worsenStatus(acc.status, 'modify');
      acc.reasons.push(
        `${exName} is reintroduced at Week ${week} of your ${pack.label} recovery — light load only.`,
      );
      pack.modifyHints.forEach(h => acc.hints.push(h));
      acc.hints.push('Use the lightest weight and stop at any pain.');
      return;
    }
    const unlockWeek = firstUnlockWeek(exercise.name, pack.reintroduceByWeek);
    if (unlockWeek !== null && unlockWeek > week) {
      acc.status = worsenStatus(acc.status, 'blocked');
      acc.reasons.push(
        withSubstitute(
          `${exName} unlocks at Week ${unlockWeek} of your ${pack.label} recovery (currently Week ${week}).`,
          allowedThisWeek.length > 0 ? allowedThisWeek : pack.allowPatterns,
        ),
      );
      return;
    }
    const block = matchesAny(exercise.name, pack.blockPatterns);
    if (block) {
      acc.status = worsenStatus(acc.status, 'blocked');
      acc.reasons.push(
        withSubstitute(
          `${exName} stays blocked until your ${pack.label} recovery is complete (currently Week ${week}).`,
          allowedThisWeek.length > 0 ? allowedThisWeek : pack.allowPatterns,
        ),
      );
      return;
    }
    if (direct) {
      acc.status = worsenStatus(acc.status, 'blocked');
      acc.reasons.push(
        withSubstitute(
          `${exName} loads your recovering ${pack.label} and isn't reintroduced yet (currently Week ${week}).`,
          allowedThisWeek.length > 0 ? allowedThisWeek : pack.allowPatterns,
        ),
      );
      return;
    }
    // Affected only, no specific match → light caution.
    acc.status = worsenStatus(acc.status, 'modify');
    acc.reasons.push(
      `${exName} uses your recovering ${pack.label} area — keep load light (Week ${week}).`,
    );
    return;
  }

  // 5. Currently injured
  if (injury.injuryType === 'currently_injured') {
    const block = matchesAny(exercise.name, pack.blockPatterns);
    if (block) {
      acc.status = worsenStatus(acc.status, 'blocked');
      acc.reasons.push(
        withSubstitute(
          `${exName} is blocked for your current ${pack.label} injury.`,
          pack.longTermPreferPatterns,
          pack.allowPatterns,
        ),
      );
      return;
    }
    if (direct) {
      acc.status = worsenStatus(acc.status, 'blocked');
      acc.reasons.push(
        withSubstitute(
          `${exName} directly loads your current ${pack.label} injury — no direct work allowed.`,
          pack.longTermPreferPatterns,
          pack.allowPatterns,
        ),
      );
      return;
    }
    // Affected only → modify with stabilizer warning.
    acc.status = worsenStatus(acc.status, 'modify');
    acc.reasons.push(
      `${exName} uses your ${pack.label} as a stabilizer — reduce load and range of motion.`,
    );
    pack.modifyHints.forEach(h => acc.hints.push(h));
    return;
  }
}

// Format the exercise name for use in user-facing reason text. Trims long
// names, preserves capitalization, falls back to "This exercise".
function exerciseDisplay(name: string | undefined | null): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return 'This exercise';
  return trimmed.length > 60 ? `${trimmed.slice(0, 57).trimEnd()}…` : trimmed;
}

// Append a "try X instead" hint when at least one substitute pattern exists.
// Walks the candidate lists in priority order and returns the first match
// that meaningfully resembles a real exercise (>= 3 chars, has letters).
function withSubstitute(reason: string, ...candidateLists: (string[] | undefined)[]): string {
  for (const list of candidateLists) {
    if (!list) continue;
    for (const c of list) {
      const trimmed = (c ?? '').trim();
      if (trimmed.length < 3) continue;
      if (!/[a-z]/i.test(trimmed)) continue;
      const sub = formatExerciseRef(trimmed);
      if (sub) return `${reason} Try ${sub} instead.`;
    }
  }
  return reason;
}

// Capitalize and clean up a matched pattern for human-readable reasons.
// E.g. "leg press" → "Leg press", "rdl" → "RDL", "bent-over row" → "Bent-over row".
function formatExerciseRef(pattern: string): string {
  const trimmed = pattern.trim();
  if (!trimmed) return trimmed;
  // Common acronyms stay uppercased.
  const upper = trimmed.toUpperCase();
  if (['RDL', 'EZ BAR', 'EZ-BAR'].includes(upper)) return upper;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function injuryTypeLabel(t: InjuryForEval['injuryType']): string {
  switch (t) {
    case 'currently_injured':    return 'current injury';
    case 'recovery':             return 'recovery';
    case 'long_term_limitation': return 'long-term limitation';
  }
}

// ─── Stretch policy coaching text ─────────────────────────────────────────
// Returns a per-area coaching string based on the worst-state injury for
// that area (current > recovery > long-term).
export function getInjuryStretchPolicy(injuries: InjuryForEval[]): Record<string, string> {
  if (!injuries || injuries.length === 0) return {};

  const stateRank: Record<InjuryForEval['injuryType'], number> = {
    currently_injured: 2,
    recovery: 1,
    long_term_limitation: 0,
  };

  const worstByPack = new Map<string, { rank: number; injury: InjuryForEval }>();

  for (const injury of injuries) {
    const pack = getRulePack(injury.bodyArea);
    if (!pack) continue;
    const rank = stateRank[injury.injuryType];
    const existing = worstByPack.get(pack.label);
    if (!existing || rank > existing.rank) {
      worstByPack.set(pack.label, { rank, injury });
    }
  }

  const result: Record<string, string> = {};

  for (const [label, { injury }] of worstByPack.entries()) {
    if (injury.injuryType === 'currently_injured') {
      result[label] =
        'While currently injured: only seated / lying stretches, max 20-second holds, never load the injured area.';
    } else if (injury.injuryType === 'recovery') {
      const week = getCurrentInjuryWeek(injury);
      if (week < 6) {
        result[label] =
          `Avoid stretching the ${label} area until Week 6 of recovery (currently Week ${week}). Focus on compensation muscles only.`;
      } else {
        result[label] =
          `Stretching reintroduced. Use ~50% of your normal hold time — add 5 seconds per pain-free week. Stop at any tension beyond mild.`;
      }
    } else {
      result[label] =
        'Dynamic stretches in warm-up, static in cooldown — never force end range. Include compensation stretches every session.';
    }
  }

  return result;
}

// ─── ALWAYS INCLUDE recommendations ───────────────────────────────────────
// Returns one entry per unique rule pack covered by the user's injuries,
// including always-include, compensation, and stretch-policy data.
export function getInjuryRecommendations(injuries: InjuryForEval[]): InjuryRecommendation[] {
  if (!injuries || injuries.length === 0) return [];
  const stretchPolicies = getInjuryStretchPolicy(injuries);
  const seen = new Set<string>();
  const result: InjuryRecommendation[] = [];
  for (const injury of injuries) {
    const pack = getRulePack(injury.bodyArea);
    if (!pack) continue;
    if (seen.has(pack.label)) continue;
    // Only surface entries where there is at least one always-include OR
    // compensation item — packs with no recommendations are skipped.
    const hasContent =
      pack.alwaysInclude.length > 0 ||
      pack.compensationStretch.length > 0 ||
      pack.compensationStrengthen.length > 0;
    if (!hasContent) continue;
    seen.add(pack.label);
    result.push({
      bodyArea: pack.label,
      recommendations: pack.alwaysInclude,
      compensationStretch: pack.compensationStretch,
      compensationStrengthen: pack.compensationStrengthen,
      stretchPolicy: stretchPolicies[pack.label] ?? '',
    });
  }
  return result;
}

// ─── Status presentation helpers (used by UI) ─────────────────────────────
export function getInjuryStatusLabel(status: InjuryStatus): string {
  switch (status) {
    case 'blocked': return '🔴 Blocked';
    case 'modify':  return '🟡 Caution';
    case 'caution': return '🟢 Caution';
    default:        return '';
  }
}

export function getInjuryStatusColor(status: InjuryStatus): string {
  switch (status) {
    case 'blocked': return 'bg-red-600 text-white';
    case 'modify':  return 'bg-yellow-500 text-black';
    case 'caution': return 'bg-green-700 text-white';
    default:        return '';
  }
}
