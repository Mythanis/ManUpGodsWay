export type Sex = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "very" | "extra";
export type GoalType = "lose" | "maintain" | "gain";

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
  extra: 1.9,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "Sedentary (little or no exercise)",
  light: "Light (1–3 days/week)",
  moderate: "Moderate (3–5 days/week)",
  very: "Very active (6–7 days/week)",
  extra: "Extra active (twice/day or hard labor)",
};

export const KCAL_PER_LB_FAT = 3500;
export const FLOOR_KCAL_MALE = 1500;
export const FLOOR_KCAL_FEMALE = 1200;

export function lbToKg(lb: number): number {
  return lb * 0.45359237;
}
export function kgToLb(kg: number): number {
  return kg / 0.45359237;
}
export function inToCm(inches: number): number {
  return inches * 2.54;
}
export function cmToIn(cm: number): number {
  return cm / 2.54;
}
export function feetInToCm(feet: number, inches: number): number {
  return inToCm(feet * 12 + inches);
}

export function computeBmr(args: {
  sex: Sex;
  ageYears: number;
  heightCm: number;
  weightKg: number;
}): number {
  const { sex, ageYears, heightCm, weightKg } = args;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return sex === "male" ? base + 5 : base - 161;
}

export function computeMaintenance(bmr: number, activity: ActivityLevel): number {
  return bmr * ACTIVITY_MULTIPLIERS[activity];
}

export interface CalorieResult {
  bmr: number;
  maintenanceKcal: number;
  targetKcal: number;
  weeklyChangeLb: number;
  effectivePctPerWeek: number;
  floorApplied: boolean;
  effectiveTimelineWeeks: number;
}

/**
 * Compute the recommended daily calorie target.
 *
 * Goal-pace bands per the spec:
 *   fat loss:    0.25%–1.0% of body weight per week
 *   muscle gain: 0.1%–0.25% of body weight per week
 *
 * The pace is derived from the user's chosen timeline by figuring out the
 * total weight change needed and spreading it linearly across the requested
 * weeks. We then clamp that pace into the safe band, convert weekly weight
 * change to a daily kcal delta (3,500 kcal per lb of fat), and clamp the
 * final target to the sex-based floor.
 */
export function computeTarget(args: {
  sex: Sex;
  ageYears: number;
  heightCm: number;
  weightKg: number;
  goalWeightKg: number;
  goalType: GoalType;
  timelineWeeks: number;
  activity: ActivityLevel;
}): CalorieResult {
  const bmr = computeBmr(args);
  const maintenance = computeMaintenance(bmr, args.activity);
  const floor = args.sex === "male" ? FLOOR_KCAL_MALE : FLOOR_KCAL_FEMALE;

  if (args.goalType === "maintain") {
    const t = Math.round(maintenance);
    return {
      bmr,
      maintenanceKcal: maintenance,
      targetKcal: Math.max(t, floor),
      weeklyChangeLb: 0,
      effectivePctPerWeek: 0,
      floorApplied: t < floor,
      effectiveTimelineWeeks: args.timelineWeeks,
    };
  }

  const currentLb = kgToLb(args.weightKg);
  const goalLb = kgToLb(args.goalWeightKg);
  const totalDeltaLb = Math.abs(currentLb - goalLb);

  const weeks = Math.max(1, Math.round(args.timelineWeeks || 0));
  const requestedPctPerWeek = (totalDeltaLb / currentLb) / weeks * 100;

  const minPct = args.goalType === "lose" ? 0.25 : 0.1;
  const maxPct = args.goalType === "lose" ? 1.0 : 0.25;
  const clampedPct = Math.min(Math.max(requestedPctPerWeek, minPct), maxPct);

  const weeklyChangeLb = (clampedPct / 100) * currentLb;
  const dailyDeltaKcal = (weeklyChangeLb * KCAL_PER_LB_FAT) / 7;

  let target =
    args.goalType === "lose"
      ? maintenance - dailyDeltaKcal
      : maintenance + dailyDeltaKcal;

  let floorApplied = false;
  let effectiveWeeks = Math.ceil(totalDeltaLb / Math.max(weeklyChangeLb, 0.001));

  if (args.goalType === "lose" && target < floor) {
    floorApplied = true;
    target = floor;
    const allowedDailyDeficit = maintenance - floor;
    const allowedWeeklyLb = (allowedDailyDeficit * 7) / KCAL_PER_LB_FAT;
    effectiveWeeks =
      allowedWeeklyLb > 0
        ? Math.ceil(totalDeltaLb / allowedWeeklyLb)
        : effectiveWeeks;
  }

  return {
    bmr,
    maintenanceKcal: maintenance,
    targetKcal: Math.round(target),
    weeklyChangeLb,
    effectivePctPerWeek: clampedPct,
    floorApplied,
    effectiveTimelineWeeks: effectiveWeeks,
  };
}
