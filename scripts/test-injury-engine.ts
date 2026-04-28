import {
  evaluateExerciseAgainstInjuries,
  getInjuryRecommendations,
  getInjuryStretchPolicy,
  computeRecoveryWeek,
} from '../shared/injuryFilter';

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

// Helper to get a date N weeks ago
function weeksAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n * 7);
  return d.toISOString();
}

// ─── ORIGINAL 21 TESTS (abbreviated checks — confirm they still work) ─────
console.log('\n=== Original engine tests ===');

// Currently injured — block direct body part
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Squat', bodyPart: 'Knees', stretching: 'No' },
    [{ bodyArea: 'Knees', injuryType: 'currently_injured' }],
  );
  assert('Squat blocked for current Knee injury', r.status === 'blocked');
}

// Allow pattern override
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Stationary bike', bodyPart: 'Knees', stretching: 'No' },
    [{ bodyArea: 'Knees', injuryType: 'currently_injured' }],
  );
  assert('Stationary bike allowed despite Knee injury', r.status === 'allowed');
}

// Recovery week 2 — goblet squat not yet unlocked for Knees (unlocks week 3)
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Goblet squat', bodyPart: 'Knees', stretching: 'No' },
    [{ bodyArea: 'Knees', injuryType: 'recovery', startedAt: weeksAgo(1) }],
  );
  assert('Goblet squat blocked at Knee recovery Week 2 (unlocks Week 3)', r.status === 'blocked');
}

// Recovery week 3 — goblet squat now allowed
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Goblet squat', bodyPart: 'Knees', stretching: 'No' },
    [{ bodyArea: 'Knees', injuryType: 'recovery', startedAt: weeksAgo(3) }],
  );
  assert('Goblet squat modify at Knee recovery Week 3', r.status === 'modify');
}

// Long-term limitation — deep squat blocked
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Deep squat', bodyPart: 'Knees', stretching: 'No' },
    [{ bodyArea: 'Knees', injuryType: 'long_term_limitation' }],
  );
  assert('Deep squat blocked for long-term Knee limitation', r.status === 'blocked');
}

// Lower back — McGill alwaysInclude
{
  const recs = getInjuryRecommendations([
    { bodyArea: 'Lower Back', injuryType: 'currently_injured' },
  ]);
  assert('Lower back recs include Bird Dog', recs.some(r => r.recommendations.some(x => x.name === 'Bird Dog')));
}

// Shoulder — stretchBlockPattern
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Behind the back shoulder stretch', bodyPart: 'Shoulders', stretching: 'Yes' },
    [{ bodyArea: 'Shoulders', injuryType: 'currently_injured' }],
  );
  assert('Behind-back stretch blocked for current Shoulder injury', r.status === 'blocked');
}

// ─── NEW TESTS: State-driven area-stretch rules ────────────────────────────
console.log('\n=== New stretch-state tests ===');

// Pigeon stretch with current Knee injury → blocked (existing stretchBlockPatterns)
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Pigeon stretch', bodyPart: 'Hip Flexors', stretching: 'Yes' },
    [{ bodyArea: 'Knees', injuryType: 'currently_injured' }],
  );
  assert('Pigeon stretch blocked for current Knees injury (stretchBlockPatterns)', r.status === 'blocked');
}

// Calf stretch with current Ankle injury → blocked via stretchAreaPatterns
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Standing calf stretch', bodyPart: 'Calves', stretching: 'Yes' },
    [{ bodyArea: 'Ankles', injuryType: 'currently_injured' }],
  );
  assert('Standing calf stretch blocked (stretchBlockPatterns) for current Ankle injury', r.status === 'blocked');
}

// Hamstring stretch with Lower-Back recovery at Week 3 → blocked "unlocks Week 6"
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Hamstring stretch', bodyPart: 'Hamstrings', stretching: 'Yes' },
    [{ bodyArea: 'Lower Back', injuryType: 'recovery', startedAt: weeksAgo(3) }],
  );
  assert('Hamstring stretch blocked at Lower Back recovery Week 3 (unlocks Week 6)', r.status === 'blocked');
  assert('Reason mentions Week 6', r.reasons.some(r => r.includes('Week 6')));
}

// Hamstring stretch with Lower-Back recovery at Week 8 → modify "50% hold time"
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Hamstring stretch', bodyPart: 'Hamstrings', stretching: 'Yes' },
    [{ bodyArea: 'Lower Back', injuryType: 'recovery', startedAt: weeksAgo(8) }],
  );
  assert('Hamstring stretch modify at Lower Back recovery Week 8', r.status === 'modify');
  assert('Reason mentions 50% hold time', r.reasons.some(r => r.includes('50%')));
}

// Lower back stretch with current Lower Back injury → blocked via stretchAreaPatterns
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Lower back stretch', bodyPart: 'Lower Back', stretching: 'Yes' },
    [{ bodyArea: 'Lower Back', injuryType: 'currently_injured' }],
  );
  assert('Lower back stretch blocked for current Lower Back injury (area patterns)', r.status === 'blocked');
  assert('Reason mentions seated/lying + 20-second holds', r.reasons.some(r => r.includes('20-second')));
}

// Shoulder stretch with long-term Shoulder limitation → allowed (coaching only)
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Shoulder stretch', bodyPart: 'Shoulders', stretching: 'Yes' },
    [{ bodyArea: 'Shoulders', injuryType: 'long_term_limitation' }],
  );
  assert('Shoulder stretch allowed for long-term Shoulder limitation (coaching only)', r.status === 'allowed');
}

// Pec stretch (matches stretchAreaPatterns) with long-term Shoulder → allowed
{
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Doorframe pec stretch', bodyPart: 'Chest', stretching: 'Yes' },
    [{ bodyArea: 'Shoulders', injuryType: 'long_term_limitation' }],
  );
  assert('Pec stretch allowed for long-term Shoulder (coaching via rec card)', r.status === 'allowed');
}

// ─── Stretch policy helper ─────────────────────────────────────────────────
console.log('\n=== getInjuryStretchPolicy tests ===');

{
  const policy = getInjuryStretchPolicy([
    { bodyArea: 'Lower Back', injuryType: 'currently_injured' },
  ]);
  assert('Lower Back current injury → policy mentions max 20-second holds', policy['Lower Back']?.includes('20-second'));
}

{
  const policy = getInjuryStretchPolicy([
    { bodyArea: 'Lower Back', injuryType: 'recovery', startedAt: weeksAgo(3) },
  ]);
  assert('Lower Back recovery Week 3 → policy mentions Week 6', policy['Lower Back']?.includes('Week 6'));
}

{
  const policy = getInjuryStretchPolicy([
    { bodyArea: 'Lower Back', injuryType: 'recovery', startedAt: weeksAgo(8) },
  ]);
  assert('Lower Back recovery Week 8 → policy mentions 50%', policy['Lower Back']?.includes('50%'));
}

{
  const policy = getInjuryStretchPolicy([
    { bodyArea: 'Shoulders', injuryType: 'long_term_limitation' },
  ]);
  assert('Shoulder long-term → policy mentions dynamic/static', policy['Shoulders']?.includes('Dynamic'));
}

// Worst-state wins
{
  const policy = getInjuryStretchPolicy([
    { bodyArea: 'Lower Back', injuryType: 'long_term_limitation' },
    { bodyArea: 'Lower Back', injuryType: 'currently_injured' },
  ]);
  assert('Worst state (current) wins over long-term for same area', policy['Lower Back']?.includes('20-second'));
}

// ─── Compensation lists ────────────────────────────────────────────────────
console.log('\n=== Compensation list tests ===');

{
  const recs = getInjuryRecommendations([
    { bodyArea: 'Shoulders', injuryType: 'long_term_limitation' },
  ]);
  const rec = recs.find(r => r.bodyArea === 'Shoulders');
  assert('Shoulder compensation stretch includes pec minor', rec?.compensationStretch.some(x => x.name.toLowerCase().includes('pec')));
  assert('Shoulder compensation strengthen includes rotator cuff', rec?.compensationStrengthen.some(x => x.name.toLowerCase().includes('rotator')));
}

{
  const recs = getInjuryRecommendations([
    { bodyArea: 'Knees', injuryType: 'currently_injured' },
  ]);
  const rec = recs.find(r => r.bodyArea === 'Knees');
  assert('Knee compensation stretch includes hip flexors', rec?.compensationStretch.some(x => x.name.toLowerCase().includes('hip flexor')));
  assert('Knee compensation strengthen includes glutes', rec?.compensationStrengthen.some(x => x.name.toLowerCase().includes('glute')));
}

{
  const recs = getInjuryRecommendations([
    { bodyArea: 'Lower Back', injuryType: 'recovery', startedAt: weeksAgo(4) },
  ]);
  const rec = recs.find(r => r.bodyArea === 'Lower Back');
  assert('Lower Back rec has stretch policy set', !!rec?.stretchPolicy);
  assert('Lower Back comp stretch includes hip flexors', rec?.compensationStretch.some(x => x.name.toLowerCase().includes('hip flexor')));
  assert('Lower Back comp strengthen includes glutes', rec?.compensationStrengthen.some(x => x.name.toLowerCase().includes('glute')));
}

{
  const recs = getInjuryRecommendations([
    { bodyArea: 'Ankles', injuryType: 'currently_injured' },
  ]);
  const rec = recs.find(r => r.bodyArea === 'Ankles / Calves');
  assert('Ankle rec has calf compensation stretch', rec?.compensationStretch.some(x => x.name.toLowerCase().includes('calf')));
  assert('Ankle rec has tibialis strengthen', rec?.compensationStrengthen.some(x => x.name.toLowerCase().includes('tibialis')));
}

// ─── stretchAllowPatterns still override state logic ──────────────────────
console.log('\n=== stretchAllowPatterns precedence ===');
{
  // Seated hamstring stretch is in stretchAllowPatterns for KNEES
  // → should be allowed even though "hamstring stretch" matches stretchAreaPatterns
  const r = evaluateExerciseAgainstInjuries(
    { name: 'Seated hamstring stretch', bodyPart: 'Hamstrings', stretching: 'Yes' },
    [{ bodyArea: 'Knees', injuryType: 'currently_injured' }],
  );
  assert('Seated hamstring stretch allowed for current Knee injury (stretchAllowPatterns wins)', r.status === 'allowed');
}

// ─── Summary ─────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
