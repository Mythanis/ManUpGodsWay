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
  sedentary: "Sedentary",
  light: "Lightly active",
  moderate: "Moderately active",
  very: "Very active",
  extra: "Extremely active",
};

export const ACTIVITY_DESCRIPTIONS: Record<ActivityLevel, string> = {
  sedentary: "Desk job, little or no exercise",
  light: "Light exercise 1–3 days per week",
  moderate: "Exercise 3–5 days per week",
  very: "Hard exercise 6–7 days per week",
  extra: "Physical job plus daily hard training",
};

export const GOAL_LABELS: Record<GoalType, string> = {
  lose: "Lose weight",
  maintain: "Maintain weight",
  gain: "Build muscle",
};

export const GOAL_DESCRIPTIONS: Record<GoalType, string> = {
  lose: "Reduce body fat with a moderate calorie deficit",
  maintain: "Fuel your body without gaining or losing",
  gain: "Support muscle growth with a small calorie surplus",
};

// Per-goal daily kcal adjustment applied to TDEE.
export const GOAL_KCAL_DELTA: Record<GoalType, number> = {
  lose: -500,
  maintain: 0,
  gain: 250,
};

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
  floorApplied: boolean;
}

/**
 * Compute the recommended daily calorie target.
 *
 * Mifflin–St Jeor BMR → TDEE (BMR × activity multiplier) → goal adjustment:
 *   lose weight:   TDEE − 500
 *   maintain:      TDEE
 *   build muscle:  TDEE + 250
 *
 * Final target is clamped to a sex-based safety floor.
 */
export function computeTarget(args: {
  sex: Sex;
  ageYears: number;
  heightCm: number;
  weightKg: number;
  goalType: GoalType;
  activity: ActivityLevel;
}): CalorieResult {
  const bmr = computeBmr(args);
  const maintenance = computeMaintenance(bmr, args.activity);
  const floor = args.sex === "male" ? FLOOR_KCAL_MALE : FLOOR_KCAL_FEMALE;

  const adjusted = maintenance + GOAL_KCAL_DELTA[args.goalType];
  const rounded = Math.round(adjusted);
  const floorApplied = rounded < floor;
  const target = floorApplied ? floor : rounded;

  return {
    bmr,
    maintenanceKcal: maintenance,
    targetKcal: target,
    floorApplied,
  };
}
