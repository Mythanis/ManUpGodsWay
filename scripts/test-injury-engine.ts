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

// ─── Summary ─────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
