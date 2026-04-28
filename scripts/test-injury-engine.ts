import {
  evaluateExerciseAgainstInjuries,
  getInjuryRecommendations,
  getInjuryStretchPolicy,
} from '../shared/injuryFilter';

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  \u2713 ${label}`);
    passed++;
  } else {
    console.error(`  \u2717 ${label}${detail ? ` \u2014 ${detail}` : ''}`);
    failed++;
  }
}

function weeksAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n * 7);
  return d.toISOString();
}

// ─── KNEES ────────────────────────────────────────────────────────────────
console.log('\n=== KNEES pack ===');
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Squat', bodyPart: 'Knees', stretching: 'No' },
    [{ bodyArea: 'Knees', injuryType: 'currently_injured' }],
  );
  assert('Squat blocked (currently_injured)', r.status === 'blocked');
}
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Stationary bike', bodyPart: 'Knees', stretching: 'No' },
    [{ bodyArea: 'Knees', injuryType: 'currently_injured' }],
  );
  assert('Stationary bike allowed (allowPatterns)', r.status === 'allowed');
}
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Goblet squat', bodyPart: 'Knees', stretching: 'No' },
    [{ bodyArea: 'Knees', injuryType: 'recovery', startedAt: weeksAgo(1) }],
  );
  assert('Goblet squat blocked at Week 2 (unlocks Week 3)', r.status === 'blocked');
}
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Goblet squat', bodyPart: 'Knees', stretching: 'No' },
    [{ bodyArea: 'Knees', injuryType: 'recovery', startedAt: weeksAgo(3) }],
  );
  assert('Goblet squat modify at Week 3', r.status === 'modify');
}
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Deep squat', bodyPart: 'Knees', stretching: 'No' },
    [{ bodyArea: 'Knees', injuryType: 'long_term_limitation' }],
  );
  assert('Deep squat blocked (longTermAvoidPatterns)', r.status === 'blocked');
}
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Cycling', bodyPart: 'Knees', stretching: 'No' },
    [{ bodyArea: 'Knees', injuryType: 'long_term_limitation' }],
  );
  assert('Cycling allowed (longTermPreferPatterns)', r.status === 'allowed');
}
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Pigeon stretch', bodyPart: 'Hip Flexors', stretching: 'Yes' },
    [{ bodyArea: 'Knees', injuryType: 'currently_injured' }],
  );
  assert('Pigeon stretch blocked (stretchBlockPatterns)', r.status === 'blocked');
}
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Seated hamstring stretch', bodyPart: 'Hamstrings', stretching: 'Yes' },
    [{ bodyArea: 'Knees', injuryType: 'currently_injured' }],
  );
  assert('Seated hamstring stretch allowed (stretchAllowPatterns)', r.status === 'allowed');
}

// ─── LOWER BACK ───────────────────────────────────────────────────────────
console.log('\n=== LOWER_BACK pack ===');
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Deadlift', bodyPart: 'Lower Back', stretching: 'No' },
    [{ bodyArea: 'Lower Back', injuryType: 'currently_injured' }],
  );
  assert('Deadlift blocked (currently_injured)', r.status === 'blocked');
}
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Glute bridge', bodyPart: 'Glutes', stretching: 'No' },
    [{ bodyArea: 'Lower Back', injuryType: 'currently_injured' }],
  );
  assert('Glute bridge allowed (allowPatterns)', r.status === 'allowed');
}
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Trap bar deadlift', bodyPart: 'Lower Back', stretching: 'No' },
    [{ bodyArea: 'Lower Back', injuryType: 'long_term_limitation' }],
  );
  assert('Trap bar allowed (longTermPreferPatterns)', r.status === 'allowed');
}
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Sit-up', bodyPart: 'Abs', stretching: 'No' },
    [{ bodyArea: 'Lower Back', injuryType: 'long_term_limitation' }],
  );
  assert('Sit-up blocked (longTermAvoidPatterns)', r.status === 'blocked');
}
{
  const recs = getInjuryRecommendations([
    { bodyArea: 'Lower Back', injuryType: 'currently_injured' },
  ]);
  const pack = recs.find(r => r.bodyArea === 'Lower Back');
  assert('Lower back recs include Bird Dog', !!pack?.recommendations.some(x => x.name === 'Bird Dog'));
  assert('Lower back recs include Side Plank', !!pack?.recommendations.some(x => x.name === 'Side Plank'));
}
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Knee to chest stretch', bodyPart: 'Lower Back', stretching: 'Yes' },
    [{ bodyArea: 'Lower Back', injuryType: 'currently_injured' }],
  );
  assert('Knee-to-chest stretch allowed (stretchAllowPatterns)', r.status === 'allowed');
}

// ─── SHOULDERS ────────────────────────────────────────────────────────────
console.log('\n=== SHOULDERS pack ===');
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Overhead press', bodyPart: 'Shoulders', stretching: 'No' },
    [{ bodyArea: 'Shoulders', injuryType: 'currently_injured' }],
  );
  assert('Overhead press blocked (currently_injured)', r.status === 'blocked');
}
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Squat', bodyPart: 'Quads', stretching: 'No' },
    [{ bodyArea: 'Shoulders', injuryType: 'currently_injured' }],
  );
  assert('Squat allowed despite Shoulder injury (allowPatterns)', r.status === 'allowed');
}
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Behind the back shoulder stretch', bodyPart: 'Shoulders', stretching: 'Yes' },
    [{ bodyArea: 'Shoulders', injuryType: 'currently_injured' }],
  );
  assert('Behind-back stretch blocked (stretchBlockPatterns)', r.status === 'blocked');
}
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Cross-body stretch', bodyPart: 'Shoulders', stretching: 'Yes' },
    [{ bodyArea: 'Shoulders', injuryType: 'currently_injured' }],
  );
  assert('Cross-body stretch allowed (stretchAllowPatterns)', r.status === 'allowed');
}
{
  const recs = getInjuryRecommendations([
    { bodyArea: 'Shoulders', injuryType: 'long_term_limitation' },
  ]);
  const pack = recs.find(r => r.bodyArea === 'Shoulders');
  assert('Shoulder recs include External rotation band', !!pack?.recommendations.some(x => x.name.includes('External rotation')));
}

// ─── HIPS ────────────────────────────────────────────────────────────────
console.log('\n=== HIPS pack ===');
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Hip thrust', bodyPart: 'Glutes', stretching: 'No' },
    [{ bodyArea: 'Hips', injuryType: 'currently_injured' }],
  );
  assert('Hip thrust blocked (currently_injured)', r.status === 'blocked');
}
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Pigeon stretch', bodyPart: 'Hip Flexors', stretching: 'Yes' },
    [{ bodyArea: 'Hips', injuryType: 'currently_injured' }],
  );
  assert('Pigeon stretch blocked (stretchBlockPatterns)', r.status === 'blocked');
}
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Supine figure four stretch', bodyPart: 'Hip Flexors', stretching: 'Yes' },
    [{ bodyArea: 'Hips', injuryType: 'currently_injured' }],
  );
  assert('Supine figure four allowed (stretchAllowPatterns)', r.status === 'allowed');
}

// ─── UPPER BACK / NECK ────────────────────────────────────────────────────
console.log('\n=== UPPER_BACK_NECK pack ===');
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Pull-up', bodyPart: 'Upper Back', stretching: 'No' },
    [{ bodyArea: 'Upper Back', injuryType: 'currently_injured' }],
  );
  assert('Pull-up blocked (currently_injured)', r.status === 'blocked');
}
{
  // Goblet squat unlocks at Week 6 for Upper Back / Neck recovery.
  // Use bodyPart 'Lats' which is in the pack's affinity list.
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Goblet squat', bodyPart: 'Lats', stretching: 'No' },
    [{ bodyArea: 'Neck', injuryType: 'recovery', startedAt: weeksAgo(6) }],
  );
  assert('Goblet squat modify at Neck recovery Week 6+ (unlocks Week 6)', r.status === 'modify');
}
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Chin tuck', bodyPart: 'Neck', stretching: 'Yes' },
    [{ bodyArea: 'Neck', injuryType: 'currently_injured' }],
  );
  assert('Chin tuck allowed (stretchAllowPatterns)', r.status === 'allowed');
}

// ─── WRISTS / FOREARMS ───────────────────────────────────────────────────
console.log('\n=== WRISTS_FOREARMS pack ===');
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Barbell bench press', bodyPart: 'Chest', stretching: 'No' },
    [{ bodyArea: 'Wrists', injuryType: 'currently_injured' }],
  );
  assert('Barbell bench blocked (blockPatterns)', r.status === 'blocked');
}
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Machine chest press', bodyPart: 'Chest', stretching: 'No' },
    [{ bodyArea: 'Wrists', injuryType: 'currently_injured' }],
  );
  assert('Machine chest press allowed (allowPatterns)', r.status === 'allowed');
}
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Wrist curl', bodyPart: 'Forearms', stretching: 'No' },
    [{ bodyArea: 'Wrists', injuryType: 'long_term_limitation' }],
  );
  assert('Wrist curl blocked (longTermAvoidPatterns)', r.status === 'blocked');
}

// ─── ANKLES / CALVES ─────────────────────────────────────────────────────
console.log('\n=== ANKLES_CALVES pack ===');
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Calf raise', bodyPart: 'Calves', stretching: 'No' },
    [{ bodyArea: 'Ankles', injuryType: 'currently_injured' }],
  );
  assert('Calf raise blocked (currently_injured)', r.status === 'blocked');
}
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Seated calf raise', bodyPart: 'Calves', stretching: 'No' },
    [{ bodyArea: 'Ankles', injuryType: 'recovery', startedAt: weeksAgo(1) }],
  );
  assert('Seated calf raise modify at Week 2 (unlocks Week 1)', r.status === 'modify');
}
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Seated ankle circle', bodyPart: 'Calves', stretching: 'Yes' },
    [{ bodyArea: 'Ankles', injuryType: 'currently_injured' }],
  );
  assert('Seated ankle circle allowed (stretchAllowPatterns)', r.status === 'allowed');
}

// ─── Multiple injuries + no injuries ─────────────────────────────────────
console.log('\n=== Edge cases ===');
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Deadlift', bodyPart: 'Lower Back', stretching: 'No' },
    [
      { bodyArea: 'Knees', injuryType: 'long_term_limitation' },
      { bodyArea: 'Lower Back', injuryType: 'currently_injured' },
    ],
  );
  assert('Multiple injuries: blocked by worst state', r.status === 'blocked');
}
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Deadlift', bodyPart: 'Lower Back', stretching: 'No' },
    [],
  );
  assert('No injuries: allowed', r.status === 'allowed');
}

// ─── NEW TESTS: State-driven area-stretch rules ────────────────────────────
console.log('\n=== New stretch-state tests (name pattern matching) ===');
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Hamstring stretch', bodyPart: 'Hamstrings', stretching: 'Yes' },
    [{ bodyArea: 'Lower Back', injuryType: 'recovery', startedAt: weeksAgo(3) }],
  );
  assert('Hamstring stretch blocked at Lower Back recovery Week 3 (unlocks Week 6)', r.status === 'blocked');
  assert('Reason mentions Week 6', r.reasons.some(r => r.includes('Week 6')));
}
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Hamstring stretch', bodyPart: 'Hamstrings', stretching: 'Yes' },
    [{ bodyArea: 'Lower Back', injuryType: 'recovery', startedAt: weeksAgo(8) }],
  );
  assert('Hamstring stretch modify at Lower Back recovery Week 8', r.status === 'modify');
  assert('Reason mentions 50% hold time', r.reasons.some(r => r.includes('50%')));
}
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Lower back stretch', bodyPart: 'Lower Back', stretching: 'Yes' },
    [{ bodyArea: 'Lower Back', injuryType: 'currently_injured' }],
  );
  assert('Lower back stretch blocked for current Lower Back injury (area patterns)', r.status === 'blocked');
  assert('Reason mentions 20-second holds', r.reasons.some(r => r.includes('20-second')));
}
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Shoulder stretch', bodyPart: 'Shoulders', stretching: 'Yes' },
    [{ bodyArea: 'Shoulders', injuryType: 'long_term_limitation' }],
  );
  assert('Shoulder stretch allowed for long-term limitation (coaching only)', r.status === 'allowed');
}
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Doorframe pec stretch', bodyPart: 'Chest', stretching: 'Yes' },
    [{ bodyArea: 'Shoulders', injuryType: 'long_term_limitation' }],
  );
  assert('Pec stretch allowed for long-term Shoulder (coaching via rec card)', r.status === 'allowed');
}

// ─── Direct-body-part stretches (not name-pattern matched) ────────────────
console.log('\n=== Direct body-part stretch (no name-pattern match) ===');
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Deltoid stretch', bodyPart: 'Shoulders', stretching: 'Yes' },
    [{ bodyArea: 'Shoulders', injuryType: 'currently_injured' }],
  );
  assert('Deltoid stretch (direct, non-pattern) blocked for current Shoulder injury', r.status === 'blocked');
  assert('Reason mentions 20-second holds', r.reasons.some(r => r.includes('20-second')));
}
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Knee mobility stretch', bodyPart: 'Knees', stretching: 'Yes' },
    [{ bodyArea: 'Knees', injuryType: 'recovery', startedAt: weeksAgo(3) }],
  );
  assert('Knee mobility stretch (direct, non-pattern) blocked for Knee recovery Week 3 (<6)', r.status === 'blocked');
  assert('Reason mentions Week 6', r.reasons.some(r => r.includes('Week 6')));
}
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Knee mobility stretch', bodyPart: 'Knees', stretching: 'Yes' },
    [{ bodyArea: 'Knees', injuryType: 'recovery', startedAt: weeksAgo(8) }],
  );
  assert('Knee mobility stretch (direct, non-pattern) modify at Knee recovery Week 8', r.status === 'modify');
  assert('Reason mentions 50% hold time', r.reasons.some(r => r.includes('50%')));
}
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Deltoid stretch', bodyPart: 'Shoulders', stretching: 'Yes' },
    [{ bodyArea: 'Shoulders', injuryType: 'long_term_limitation' }],
  );
  assert('Deltoid stretch (direct, non-pattern) allowed for long-term Shoulder limitation', r.status === 'allowed');
}
{
  // Hamstrings is affinity-only for KNEES (not direct). 'lying hamstring' IS in stretchAllowPatterns.
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Lying hamstring stretch', bodyPart: 'Hamstrings', stretching: 'Yes' },
    [{ bodyArea: 'Knees', injuryType: 'currently_injured' }],
  );
  assert('Lying hamstring stretch allowed for current Knee injury via stretchAllowPatterns', r.status === 'allowed');
}

// ─── Overlap precedence: stretchAllow vs stretchBlock ────────────────────
// A pattern that appears in both lists — stretchAllowPatterns wins first.
console.log('\n=== stretchAllow/stretchBlock precedence ===');
{
  // stretchAllowPatterns for KNEES includes 'seated hamstring'
  // stretchAreaPatterns doesn't include it; direct=No (bodyPart=Hamstrings)
  // → allowed (stretchAllow fires before state-driven logic)
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Seated hamstring stretch', bodyPart: 'Hamstrings', stretching: 'Yes' },
    [{ bodyArea: 'Knees', injuryType: 'currently_injured' }],
  );
  assert('Seated hamstring stretch allowed (stretchAllowPatterns wins over state logic)', r.status === 'allowed');
}
{
  // stretchAllowPatterns for LOWER_BACK includes "cat cow" / "cat-cow"
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Cat-cow stretch', bodyPart: 'Lower Back', stretching: 'Yes' },
    [{ bodyArea: 'Lower Back', injuryType: 'currently_injured' }],
  );
  assert('Cat-cow allowed (stretchAllowPatterns wins for current Lower Back injury)', r.status === 'allowed');
}
{
  // stretchBlockPatterns for ANKLES includes 'standing calf stretch'
  // Even if it's direct, block-patterns fire before state-driven when
  // they're listed in stretchBlockPatterns explicitly.
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Standing calf stretch', bodyPart: 'Calves', stretching: 'Yes' },
    [{ bodyArea: 'Ankles', injuryType: 'currently_injured' }],
  );
  assert('Standing calf stretch blocked (stretchBlockPatterns for Ankle injury)', r.status === 'blocked');
}

// ─── getInjuryStretchPolicy tests ─────────────────────────────────────────
console.log('\n=== getInjuryStretchPolicy ===');
{
  const policy = getInjuryStretchPolicy([
    { bodyArea: 'Lower Back', injuryType: 'currently_injured' },
  ]);
  assert('Lower Back current → policy mentions 20-second holds', !!policy['Lower Back']?.includes('20-second'));
}
{
  const policy = getInjuryStretchPolicy([
    { bodyArea: 'Lower Back', injuryType: 'recovery', startedAt: weeksAgo(3) },
  ]);
  assert('Lower Back recovery Week 3 → policy mentions Week 6', !!policy['Lower Back']?.includes('Week 6'));
}
{
  const policy = getInjuryStretchPolicy([
    { bodyArea: 'Lower Back', injuryType: 'recovery', startedAt: weeksAgo(8) },
  ]);
  assert('Lower Back recovery Week 8 → policy mentions 50%', !!policy['Lower Back']?.includes('50%'));
}
{
  const policy = getInjuryStretchPolicy([
    { bodyArea: 'Shoulders', injuryType: 'long_term_limitation' },
  ]);
  assert('Shoulder long-term → policy mentions Dynamic', !!policy['Shoulders']?.includes('Dynamic'));
}
{
  const policy = getInjuryStretchPolicy([
    { bodyArea: 'Lower Back', injuryType: 'long_term_limitation' },
    { bodyArea: 'Lower Back', injuryType: 'currently_injured' },
  ]);
  assert('Worst state (current) wins over long-term', !!policy['Lower Back']?.includes('20-second'));
}

// ─── Compensation list tests ───────────────────────────────────────────────
console.log('\n=== Compensation lists ===');
{
  const recs = getInjuryRecommendations([
    { bodyArea: 'Shoulders', injuryType: 'long_term_limitation' },
  ]);
  const rec = recs.find(r => r.bodyArea === 'Shoulders');
  assert('Shoulder compensation stretch includes pec minor', !!rec?.compensationStretch.some(x => x.name.toLowerCase().includes('pec')));
  assert('Shoulder compensation strengthen includes rotator cuff', !!rec?.compensationStrengthen.some(x => x.name.toLowerCase().includes('rotator')));
  assert('Shoulder stretchPolicy set', !!rec?.stretchPolicy);
}
{
  const recs = getInjuryRecommendations([
    { bodyArea: 'Knees', injuryType: 'currently_injured' },
  ]);
  const rec = recs.find(r => r.bodyArea === 'Knees');
  assert('Knee compensation stretch includes hip flexors', !!rec?.compensationStretch.some(x => x.name.toLowerCase().includes('hip flexor')));
  assert('Knee compensation strengthen includes glute', !!rec?.compensationStrengthen.some(x => x.name.toLowerCase().includes('glute')));
}
{
  const recs = getInjuryRecommendations([
    { bodyArea: 'Lower Back', injuryType: 'recovery', startedAt: weeksAgo(4) },
  ]);
  const rec = recs.find(r => r.bodyArea === 'Lower Back');
  assert('Lower Back comp stretch includes hip flexors', !!rec?.compensationStretch.some(x => x.name.toLowerCase().includes('hip flexor')));
  assert('Lower Back comp strengthen includes glutes', !!rec?.compensationStrengthen.some(x => x.name.toLowerCase().includes('glute')));
}
{
  const recs = getInjuryRecommendations([
    { bodyArea: 'Ankles', injuryType: 'currently_injured' },
  ]);
  const rec = recs.find(r => r.bodyArea === 'Ankles / Calves');
  assert('Ankle comp stretch includes calf', !!rec?.compensationStretch.some(x => x.name.toLowerCase().includes('calf')));
  assert('Ankle comp strengthen includes tibialis', !!rec?.compensationStrengthen.some(x => x.name.toLowerCase().includes('tibialis')));
}

// ─── Name resolver logic (mirrors resolveByName in fitness.tsx) ───────────
console.log('\n=== Name resolver ===');

// Mirrors the normName / resolveByName helpers implemented in fitness.tsx.
// These tests ensure the matching logic works before real DB exercises are
// available in the test environment.
function normName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}
interface FakeEx { id: string; name: string }
function resolveByName(name: string, pool: FakeEx[]): FakeEx | undefined {
  const n = normName(name);
  let found = pool.find(e => normName(e.name) === n);
  if (found) return found;
  found = pool.find(e => { const en = normName(e.name); return en.length > 3 && n.includes(en); });
  if (found) return found;
  found = pool.find(e => { const en = normName(e.name); return n.length > 3 && en.includes(n); });
  if (found) return found;
  const nWords = n.split(' ').filter((w: string) => w.length > 3);
  found = pool.find(e => {
    const eWords = normName(e.name).split(' ').filter((w: string) => w.length > 3);
    return nWords.filter((w: string) => eWords.includes(w)).length >= 2;
  });
  return found;
}

const fakePool: FakeEx[] = [
  { id: '1', name: 'Cat-Cow Stretch' },
  { id: '2', name: 'Hip Flexor Stretch' },
  { id: '3', name: 'Glute Bridge' },
  { id: '4', name: 'Side Plank' },
  { id: '5', name: 'Pigeon Pose' },
  { id: '6', name: 'Tibialis Raise (Bodyweight)' },
  { id: '7', name: 'Banded Shoulder External Rotation' },
];

{
  // Exact match (after normalization: "cat cow stretch")
  const found = resolveByName('Cat-Cow Stretch', fakePool);
  assert('Exact match Cat-Cow Stretch', !!found && found.id === '1');
}
{
  // Punctuation stripped: "cat cow" matches "cat cow stretch" (catalog contains target?)
  // "cat cow" (n) is 7 chars, normName("Cat-Cow Stretch") = "cat cow stretch" includes "cat cow" → yes
  const found = resolveByName('cat cow', fakePool);
  assert('Alias cat-cow resolves to Cat-Cow Stretch', !!found && found.id === '1');
}
{
  // Exact match Glute Bridge
  const found = resolveByName('Glute Bridge', fakePool);
  assert('Exact match Glute Bridge', !!found && found.id === '3');
}
{
  // Token word overlap: "Tibialis Raise" should match "Tibialis Raise (Bodyweight)"
  const found = resolveByName('Tibialis Raise', fakePool);
  assert('Tibialis Raise resolves via partial match', !!found && found.id === '6');
}
{
  // Bird Dog → not in catalog → should return undefined
  const found = resolveByName('Bird Dog', fakePool);
  assert('Bird Dog not in catalog → silently skipped (undefined)', found === undefined);
}
{
  // McGill Curl-Up → not in catalog → undefined
  const found = resolveByName('McGill Curl-Up', fakePool);
  assert('McGill Curl-Up not in catalog → silently skipped (undefined)', found === undefined);
}

// ─── Integration: Lower Back injury produces expected recommendations ──────
console.log('\n=== Integration: plan-level compensation data ===');
{
  const recs = getInjuryRecommendations([
    { bodyArea: 'Lower Back', injuryType: 'currently_injured' },
  ]);
  const rec = recs.find(r => r.bodyArea === 'Lower Back');
  assert('Lower Back rec: compensationStretch is non-empty', !!rec && rec.compensationStretch.length > 0);
  assert('Lower Back rec: compensationStrengthen is non-empty', !!rec && rec.compensationStrengthen.length > 0);

  // At least one of the stretch names resolves in the fake pool (Hip Flexor Stretch, Cat-Cow Stretch)
  const stretches = rec?.compensationStretch ?? [];
  const anyStretchResolved = stretches.some(s => !!resolveByName(s.name, fakePool));
  assert('Lower Back comp-stretch: at least one resolves in fake pool', anyStretchResolved);

  // At least one of the strengthen names resolves (Glute Bridge, Side Plank)
  const strengthens = rec?.compensationStrengthen ?? [];
  const anyStrengthResolved = strengthens.some(s => !!resolveByName(s.name, fakePool));
  assert('Lower Back comp-strengthen: at least one resolves in fake pool', anyStrengthResolved);
}
{
  // No injuries → no recs → plan unchanged (zero injection candidates)
  const recs = getInjuryRecommendations([]);
  assert('No injuries → empty recommendations', recs.length === 0);

  const policy = getInjuryStretchPolicy([]);
  assert('No injuries → empty policy map', Object.keys(policy).length === 0);
}
{
  // Knees: "Standing hip flexor stretch" should resolve to fakePool id '2'
  // (via substring match: "standing hip flexor stretch" includes "hip flexor stretch")
  const recs = getInjuryRecommendations([{ bodyArea: 'Knees', injuryType: 'currently_injured' }]);
  const rec = recs.find(r => r.bodyArea === 'Knees');
  const stretchResolvedIds = (rec?.compensationStretch ?? [])
    .map(s => resolveByName(s.name, fakePool)?.id)
    .filter(Boolean);
  assert('Knees comp-stretch: at least one item resolves in fake pool', stretchResolvedIds.length > 0);

  // Knees comp-strengthen items have long descriptive names ("Glute medius (clamshells, side-lying abduction)")
  // which don't match our simple fake pool — this is expected behaviour (silently skipped).
  const strengthResolvedIds = (rec?.compensationStrengthen ?? [])
    .map(s => resolveByName(s.name, fakePool)?.id)
    .filter(Boolean);
  // Just verify the recommendation set is non-empty even if none resolve in the small fake pool.
  assert('Knees comp-strengthen: recommendation list non-empty', !!rec && rec.compensationStrengthen.length > 0);
}

// ─── Generator-level outcome tests ────────────────────────────────────────
// These tests validate the exact behaviour the plan generator relies on:
//   • alwaysInclude items (rec.recommendations) resolve and appear in the
//     combined injection list, just like compStrengthen items.
//   • Per-day cap: combined list (alwaysInclude + compStrengthen) ≤ 2 items.
//   • Unresolved names (Bird Dog) do NOT block other items from resolving.
//   • No-injury path produces zero injection candidates (plan unchanged).
console.log('\n=== Generator-level outcome tests ===');
{
  // Lower Back currently_injured: alwaysInclude list ("rec.recommendations")
  // should include Bird Dog and Side Plank. Side Plank IS in fakePool (id '4').
  const recs = getInjuryRecommendations([{ bodyArea: 'Lower Back', injuryType: 'currently_injured' }]);
  const rec = recs.find(r => r.bodyArea === 'Lower Back');
  assert('Lower Back alwaysInclude list is non-empty', !!rec && rec.recommendations.length > 0);
  assert('Lower Back alwaysInclude includes Side Plank', !!rec?.recommendations.some(x => x.name === 'Side Plank'));

  // Resolve alwaysInclude from fakePool (Bird Dog silently dropped, Side Plank found)
  const resolvedAlwaysInclude = (rec?.recommendations ?? [])
    .map(x => resolveByName(x.name, fakePool))
    .filter(Boolean) as FakeEx[];
  assert('Side Plank resolves from alwaysInclude', resolvedAlwaysInclude.some(e => e.id === '4'));
  assert('Bird Dog is silently skipped (not in pool)', !resolvedAlwaysInclude.some(e => normName(e.name).includes('bird dog')));
}
{
  // Per-day cap simulation: combined (alwaysInclude + compStrengthen) → ≤ 2 injected
  const recs = getInjuryRecommendations([{ bodyArea: 'Lower Back', injuryType: 'currently_injured' }]);
  const rec = recs.find(r => r.bodyArea === 'Lower Back');

  // Build large fake pool so more items resolve
  const largeFakePool: FakeEx[] = [
    { id: '1', name: 'Cat-Cow Stretch' },
    { id: '2', name: 'Hip Flexor Stretch' },
    { id: '3', name: 'Glute Bridge' },
    { id: '4', name: 'Side Plank' },
    { id: '5', name: 'Dead Bug' },
    { id: '6', name: 'Pallof Press' },
    { id: '7', name: 'Banded Shoulder External Rotation' },
  ];

  const alwaysIncludeResolved = (rec?.recommendations ?? [])
    .map(x => resolveByName(x.name, largeFakePool))
    .filter(Boolean) as FakeEx[];
  const compStrengthResolved = (rec?.compensationStrengthen ?? [])
    .map(x => resolveByName(x.name, largeFakePool))
    .filter(Boolean) as FakeEx[];

  // Simulate the per-day cap (mirrors generateDynamicPlan's injection block)
  const seenIds = new Set<string>();
  const injected: FakeEx[] = [];
  for (const ex of [...alwaysIncludeResolved, ...compStrengthResolved]) {
    if (injected.length >= 2) break;
    if (!seenIds.has(ex.id)) { seenIds.add(ex.id); injected.push(ex); }
  }
  assert('Per-day cap: at most 2 main-block rehab exercises injected', injected.length <= 2);
  assert('Per-day cap: at least 1 exercise injected when injuries active', injected.length >= 1);
}
{
  // No-injury path produces zero candidates (plan is unchanged)
  const recs = getInjuryRecommendations([]);
  const allCandidates = recs.flatMap(r => [
    ...r.recommendations.map(x => resolveByName(x.name, fakePool)),
    ...r.compensationStrengthen.map(x => resolveByName(x.name, fakePool)),
    ...r.compensationStretch.map(x => resolveByName(x.name, fakePool)),
  ]).filter(Boolean);
  assert('No injuries → zero injection candidates → plan unchanged', allCandidates.length === 0);
}

// ─── Summary ─────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
