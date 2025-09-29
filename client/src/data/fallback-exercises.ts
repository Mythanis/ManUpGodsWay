// Fallback exercise data when ExerciseDB API is unavailable
export const fallbackExercises = [
  // Upper Body - Chest
  {
    exerciseId: "fallback-001",
    name: "push ups",
    gifUrl: "user-icon", // Will be replaced with proper icon in component
    iconName: "user", // Icon to represent push-ups
    targetMuscles: ["pectorals"],
    bodyParts: ["chest"],
    equipments: ["body weight"],
    secondaryMuscles: ["triceps", "anterior deltoid"],
    instructions: ["Start in plank position", "Lower your body until chest nearly touches floor", "Push back up to starting position"]
  },
  {
    exerciseId: "fallback-002", 
    name: "chest dips",
    gifUrl: "muscle-icon",
    iconName: "triangle", // Icon to represent dips
    targetMuscles: ["pectorals"],
    bodyParts: ["chest"],
    equipments: ["parallel bars"],
    secondaryMuscles: ["triceps", "anterior deltoid"],
    instructions: ["Grip parallel bars and lift body", "Lower body by bending arms", "Push back up to starting position"]
  },
  {
    exerciseId: "fallback-003",
    name: "barbell bench press",
    gifUrl: "barbell-icon",
    iconName: "minus", // Icon to represent barbell
    targetMuscles: ["pectorals"],
    bodyParts: ["chest"],
    equipments: ["barbell"],
    secondaryMuscles: ["triceps", "anterior deltoid"],
    instructions: ["Lie on bench with barbell above chest", "Lower bar to chest", "Press bar back up to starting position"]
  },
  
  // Upper Body - Back
  {
    exerciseId: "fallback-004",
    name: "pull ups",
    gifUrl: "pullup-icon",
    iconName: "arrow-up", // Icon to represent pulling up
    targetMuscles: ["latissimus dorsi"],
    bodyParts: ["back"],
    equipments: ["pull up bar"],
    secondaryMuscles: ["biceps", "posterior deltoid"],
    instructions: ["Hang from pull up bar", "Pull body up until chin over bar", "Lower body back to starting position"]
  },
  {
    exerciseId: "fallback-005",
    name: "barbell rows",
    gifUrl: "row-icon",
    iconName: "arrow-left-right", // Icon to represent rowing motion
    targetMuscles: ["latissimus dorsi"],
    bodyParts: ["back"],
    equipments: ["barbell"],
    secondaryMuscles: ["biceps", "posterior deltoid"],
    instructions: ["Hold barbell with overhand grip", "Pull bar to lower chest", "Lower bar back to starting position"]
  },
  
  // Lower Body - Legs
  {
    exerciseId: "fallback-006",
    name: "bodyweight squats",
    gifUrl: "squat-icon",
    iconName: "move-down", // Icon to represent squatting down
    targetMuscles: ["quadriceps"],
    bodyParts: ["upper legs"],
    equipments: ["body weight"],
    secondaryMuscles: ["glutes", "hamstrings"],
    instructions: ["Stand with feet shoulder-width apart", "Lower body as if sitting back into chair", "Return to standing position"]
  },
  {
    exerciseId: "fallback-007", 
    name: "barbell squats",
    gifUrl: "barbell-squat-icon",
    iconName: "move-vertical", // Icon to represent up/down movement
    targetMuscles: ["quadriceps"],
    bodyParts: ["upper legs"],
    equipments: ["barbell"],
    secondaryMuscles: ["glutes", "hamstrings"],
    instructions: ["Position barbell on upper back", "Lower body into squat position", "Return to standing position"]
  },
  {
    exerciseId: "fallback-008",
    name: "lunges",
    gifUrl: "lunge-icon",
    iconName: "footprints", // Icon to represent stepping forward
    targetMuscles: ["quadriceps"],
    bodyParts: ["upper legs"],
    equipments: ["body weight"],
    secondaryMuscles: ["glutes", "hamstrings"],
    instructions: ["Step forward into lunge position", "Lower back knee toward ground", "Return to starting position"]
  },
  {
    exerciseId: "fallback-009",
    name: "deadlifts",
    gifUrl: "deadlift-icon",
    iconName: "activity", // Icon to represent lifting motion
    targetMuscles: ["hamstrings"],
    bodyParts: ["upper legs"],
    equipments: ["barbell"],
    secondaryMuscles: ["glutes", "erector spinae"],
    instructions: ["Stand with barbell over mid-foot", "Bend at hips and knees to grip bar", "Stand up straight lifting the bar"]
  },
  
  // Core
  {
    exerciseId: "fallback-010",
    name: "plank",
    gifUrl: "plank-icon",
    iconName: "clock", // Icon to represent time-based hold
    targetMuscles: ["abdominals"],
    bodyParts: ["waist"],
    equipments: ["body weight"],
    secondaryMuscles: ["erector spinae", "shoulders"],
    instructions: ["Start in push-up position", "Hold body in straight line", "Maintain position for specified time"]
  },
  {
    exerciseId: "fallback-011",
    name: "crunches",
    gifUrl: "crunch-icon",
    iconName: "rotate-cw", // Icon to represent curling motion
    targetMuscles: ["abdominals"],
    bodyParts: ["waist"],
    equipments: ["body weight"],
    secondaryMuscles: [],
    instructions: ["Lie on back with knees bent", "Lift shoulders off ground", "Lower back to starting position"]
  },
  
  // Arms - Biceps
  {
    exerciseId: "fallback-012",
    name: "barbell curls",
    gifUrl: "curl-icon",
    iconName: "rotate-3d", // Icon to represent curling motion
    targetMuscles: ["biceps brachii"],
    bodyParts: ["upper arms"],
    equipments: ["barbell"],
    secondaryMuscles: ["forearms"],
    instructions: ["Hold barbell with underhand grip", "Curl bar up to chest", "Lower bar back to starting position"]
  },
  
  // Arms - Triceps
  {
    exerciseId: "fallback-013",
    name: "tricep dips",
    gifUrl: "tricep-icon",
    iconName: "move-down", // Icon to represent dipping motion
    targetMuscles: ["triceps brachii"],
    bodyParts: ["upper arms"],
    equipments: ["body weight"],
    secondaryMuscles: ["anterior deltoid"],
    instructions: ["Place hands on chair or bench", "Lower body by bending arms", "Push back up to starting position"]
  },
  
  // Shoulders
  {
    exerciseId: "fallback-014",
    name: "shoulder press",
    gifUrl: "shoulder-icon",
    iconName: "arrow-up-circle", // Icon to represent pressing up
    targetMuscles: ["anterior deltoid"],
    bodyParts: ["shoulders"],
    equipments: ["dumbbell"],
    secondaryMuscles: ["triceps", "upper chest"],
    instructions: ["Hold dumbbells at shoulder height", "Press weights overhead", "Lower back to starting position"]
  },
  
  // Cardio
  {
    exerciseId: "fallback-015",
    name: "jumping jacks",
    gifUrl: "jumping-icon",
    iconName: "zap", // Icon to represent high energy/cardio
    targetMuscles: ["cardiovascular system"],
    bodyParts: ["cardio"],
    equipments: ["body weight"],
    secondaryMuscles: ["calves", "shoulders"],
    instructions: ["Start with feet together", "Jump while spreading legs and raising arms", "Return to starting position"]
  },
  {
    exerciseId: "fallback-016",
    name: "burpees",
    gifUrl: "burpee-icon",
    iconName: "flame", // Icon to represent intense cardio
    targetMuscles: ["cardiovascular system"],
    bodyParts: ["cardio"],
    equipments: ["body weight"],
    secondaryMuscles: ["full body"],
    instructions: ["Start standing", "Drop to squat with hands on ground", "Jump back to plank, do push-up, jump feet back, jump up"]
  }
];

export const fallbackBodyParts = [
  { name: "back" },
  { name: "cardio" },
  { name: "chest" },
  { name: "lower arms" },
  { name: "lower legs" },
  { name: "neck" },
  { name: "shoulders" },
  { name: "upper arms" },
  { name: "upper legs" },
  { name: "waist" }
];

export const fallbackEquipments = [
  { name: "assisted" },
  { name: "band" },
  { name: "barbell" },
  { name: "body weight" },
  { name: "bosu ball" },
  { name: "cable" },
  { name: "dumbbell" },
  { name: "ez barbell" },
  { name: "hammer" },
  { name: "kettlebell" },
  { name: "leverage machine" },
  { name: "medicine ball" },
  { name: "parallel bars" },
  { name: "pull up bar" },
  { name: "resistance band" },
  { name: "stability ball" },
  { name: "stationary bike" },
  { name: "tire" },
  { name: "trap bar" },
  { name: "weighted" }
];

export const fallbackTargets = [
  { name: "abdominals" },
  { name: "abductors" },
  { name: "adductors" },
  { name: "biceps brachii" },
  { name: "calves" },
  { name: "cardiovascular system" },
  { name: "delts" },
  { name: "erector spinae" },
  { name: "forearms" },
  { name: "glutes" },
  { name: "hamstrings" },
  { name: "lats" },
  { name: "levator scapulae" },
  { name: "pectorals" },
  { name: "quads" },
  { name: "serratus anterior" },
  { name: "spine" },
  { name: "traps" },
  { name: "triceps" },
  { name: "upper back" }
];