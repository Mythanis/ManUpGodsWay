// Fallback exercise data when ExerciseDB API is unavailable
export const fallbackExercises = [
  // Upper Body - Chest
  {
    exerciseId: "fallback-001",
    name: "push ups",
    gifUrl: "https://v2.exercisedb.io/image/8mnm1cDibsNJgT",
    targetMuscles: ["pectorals"],
    bodyParts: ["chest"],
    equipments: ["body weight"],
    secondaryMuscles: ["triceps", "anterior deltoid"],
    instructions: ["Start in plank position", "Lower your body until chest nearly touches floor", "Push back up to starting position"]
  },
  {
    exerciseId: "fallback-002", 
    name: "chest dips",
    gifUrl: "https://v2.exercisedb.io/image/WqzqjTni8Me5Q9",
    targetMuscles: ["pectorals"],
    bodyParts: ["chest"],
    equipments: ["parallel bars"],
    secondaryMuscles: ["triceps", "anterior deltoid"],
    instructions: ["Grip parallel bars and lift body", "Lower body by bending arms", "Push back up to starting position"]
  },
  {
    exerciseId: "fallback-003",
    name: "barbell bench press",
    gifUrl: "https://v2.exercisedb.io/image/k9ghqwS4yNJtAs",
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
    gifUrl: "https://v2.exercisedb.io/image/doAC5VRB-sk8te",
    targetMuscles: ["latissimus dorsi"],
    bodyParts: ["back"],
    equipments: ["pull up bar"],
    secondaryMuscles: ["biceps", "posterior deltoid"],
    instructions: ["Hang from pull up bar", "Pull body up until chin over bar", "Lower body back to starting position"]
  },
  {
    exerciseId: "fallback-005",
    name: "barbell rows",
    gifUrl: "https://v2.exercisedb.io/image/xqNJAVH5kYOXkI",
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
    gifUrl: "https://v2.exercisedb.io/image/OYNIAOOlq1c7tM",
    targetMuscles: ["quadriceps"],
    bodyParts: ["upper legs"],
    equipments: ["body weight"],
    secondaryMuscles: ["glutes", "hamstrings"],
    instructions: ["Stand with feet shoulder-width apart", "Lower body as if sitting back into chair", "Return to standing position"]
  },
  {
    exerciseId: "fallback-007", 
    name: "barbell squats",
    gifUrl: "https://v2.exercisedb.io/image/VDYZUufDRRdXIz",
    targetMuscles: ["quadriceps"],
    bodyParts: ["upper legs"],
    equipments: ["barbell"],
    secondaryMuscles: ["glutes", "hamstrings"],
    instructions: ["Position barbell on upper back", "Lower body into squat position", "Return to standing position"]
  },
  {
    exerciseId: "fallback-008",
    name: "lunges",
    gifUrl: "https://v2.exercisedb.io/image/QLGXLp0cpQTqQN",
    targetMuscles: ["quadriceps"],
    bodyParts: ["upper legs"],
    equipments: ["body weight"],
    secondaryMuscles: ["glutes", "hamstrings"],
    instructions: ["Step forward into lunge position", "Lower back knee toward ground", "Return to starting position"]
  },
  {
    exerciseId: "fallback-009",
    name: "deadlifts",
    gifUrl: "https://v2.exercisedb.io/image/1iAtc9OD0x8oDh",
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
    gifUrl: "https://v2.exercisedb.io/image/QE3MHZJdKVjxGt",
    targetMuscles: ["abdominals"],
    bodyParts: ["waist"],
    equipments: ["body weight"],
    secondaryMuscles: ["erector spinae", "shoulders"],
    instructions: ["Start in push-up position", "Hold body in straight line", "Maintain position for specified time"]
  },
  {
    exerciseId: "fallback-011",
    name: "crunches",
    gifUrl: "https://v2.exercisedb.io/image/6PzAsM9tSbpEPE",
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
    gifUrl: "https://v2.exercisedb.io/image/TlMFCr5e9wgGhN",
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
    gifUrl: "https://v2.exercisedb.io/image/vG6nZh0t0UNe6x",
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
    gifUrl: "https://v2.exercisedb.io/image/xqbq8wCGcKMFyF",
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
    gifUrl: "https://v2.exercisedb.io/image/2XZAyfhBNJJHDF",
    targetMuscles: ["cardiovascular system"],
    bodyParts: ["cardio"],
    equipments: ["body weight"],
    secondaryMuscles: ["calves", "shoulders"],
    instructions: ["Start with feet together", "Jump while spreading legs and raising arms", "Return to starting position"]
  },
  {
    exerciseId: "fallback-016",
    name: "burpees",
    gifUrl: "https://v2.exercisedb.io/image/HjFMzKHTM9cMks",
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