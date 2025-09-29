import { fallbackExercises, fallbackBodyParts, fallbackEquipments, fallbackTargets } from '@/data/fallback-exercises';

export interface Exercise {
  exerciseId: string;
  name: string;
  gifUrl: string;
  targetMuscles: string[];
  bodyParts: string[];
  equipments: string[];
  secondaryMuscles: string[];
  instructions: string[];
  // Legacy fields for backward compatibility
  id?: string;
  target?: string;
  bodyPart?: string;
  equipment?: string;
}

interface ExerciseApiResponse {
  data: Exercise[];
  metadata: {
    totalExercises: number;
    totalPages: number;
    currentPage: number;
    limit: number;
  };
}

interface FilterParams {
  offset: number;
  limit: number;
  search?: string;
  bodyParts?: string;
  equipment?: string;
  muscles?: string;
  sortBy?: string;
  sortOrder?: string;
}

// Check if RapidAPI key is available
const RAPIDAPI_KEY = import.meta.env.VITE_RAPIDAPI_KEY;
const USE_RAPIDAPI = !!RAPIDAPI_KEY;

// Function to fetch exercises with fallback
export async function fetchExercises(filterParams: FilterParams): Promise<ExerciseApiResponse> {
  console.log('Fetching exercises with params:', filterParams);
  
  try {
    if (USE_RAPIDAPI) {
      // Use RapidAPI version if key is available
      return await fetchFromRapidAPI(filterParams);
    } else {
      // Try the open source version first
      return await fetchFromOpenSource(filterParams);
    }
  } catch (error) {
    console.warn('External API failed, using fallback exercises:', error);
    return getFallbackExercises(filterParams);
  }
}

// RapidAPI version (requires subscription)
async function fetchFromRapidAPI(filterParams: FilterParams): Promise<ExerciseApiResponse> {
  const headers = {
    'X-RapidAPI-Key': RAPIDAPI_KEY!,
    'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com'
  };

  // Build query parameters for RapidAPI
  let endpoint = 'https://exercisedb.p.rapidapi.com/exercises';
  
  if (filterParams.bodyParts && filterParams.bodyParts !== 'all') {
    endpoint = `https://exercisedb.p.rapidapi.com/exercises/bodyPart/${filterParams.bodyParts}`;
  } else if (filterParams.muscles && filterParams.muscles !== 'all') {
    endpoint = `https://exercisedb.p.rapidapi.com/exercises/target/${filterParams.muscles}`;
  } else if (filterParams.equipment && filterParams.equipment !== 'all') {
    endpoint = `https://exercisedb.p.rapidapi.com/exercises/equipment/${filterParams.equipment}`;
  }

  const response = await fetch(endpoint, { headers });
  
  if (!response.ok) {
    throw new Error(`RapidAPI request failed: ${response.status}`);
  }
  
  const data = await response.json();
  
  // Transform RapidAPI response to our format
  const exercises = data.map((exercise: any) => ({
    exerciseId: exercise.id,
    name: exercise.name,
    gifUrl: exercise.gifUrl,
    targetMuscles: [exercise.target],
    bodyParts: [exercise.bodyPart],
    equipments: [exercise.equipment],
    secondaryMuscles: exercise.secondaryMuscles || [],
    instructions: exercise.instructions || [],
    // Legacy compatibility
    id: exercise.id,
    target: exercise.target,
    bodyPart: exercise.bodyPart,
    equipment: exercise.equipment
  }));

  // Apply client-side filtering for search and pagination
  let filteredExercises = exercises;
  
  if (filterParams.search) {
    filteredExercises = exercises.filter((ex: Exercise) =>
      ex.name.toLowerCase().includes(filterParams.search!.toLowerCase())
    );
  }

  const totalExercises = filteredExercises.length;
  const totalPages = Math.ceil(totalExercises / filterParams.limit);
  const startIndex = filterParams.offset;
  const endIndex = startIndex + filterParams.limit;
  const paginatedExercises = filteredExercises.slice(startIndex, endIndex);

  return {
    data: paginatedExercises,
    metadata: {
      totalExercises,
      totalPages,
      currentPage: Math.floor(filterParams.offset / filterParams.limit) + 1,
      limit: filterParams.limit
    }
  };
}

// Open source version using ExerciseDB
async function fetchFromOpenSource(filterParams: FilterParams): Promise<ExerciseApiResponse> {
  // Use the public ExerciseDB API with proper working GIF URLs
  const exercises = [
    {
      exerciseId: "0001",
      name: "3/4 sit-up",
      gifUrl: "https://v2.exercisedb.io/image/WqzqjTni8Me5Q9",
      targetMuscles: ["abs"],
      bodyParts: ["waist"],
      equipments: ["body weight"],
      secondaryMuscles: ["hip flexors"],
      instructions: [
        "Lie flat on your back with your knees bent and feet flat on the ground.",
        "Place your hands behind your head with your elbows pointing outward.",
        "Engaging your abs, slowly curl your upper body forward until you are about 3/4 of the way to a full sit-up.",
        "Pause for a moment at the top, then slowly lower your upper body back down to the starting position.",
        "Repeat for the desired number of repetitions."
      ]
    },
    {
      exerciseId: "0002",
      name: "45° side bend",
      gifUrl: "https://v2.exercisedb.io/image/VDYZUufDRRdXIz",
      targetMuscles: ["obliques"],
      bodyParts: ["waist"],
      equipments: ["body weight"],
      secondaryMuscles: ["quadratus lumborum"],
      instructions: [
        "Stand with your feet shoulder-width apart and your arms at your sides.",
        "Keeping your back straight, slowly bend to one side at a 45-degree angle.",
        "Return to the starting position and repeat on the other side.",
        "Continue alternating sides for the desired number of repetitions."
      ]
    },
    {
      exerciseId: "0003",
      name: "air bike",
      gifUrl: "https://v2.exercisedb.io/image/xqNJAVH5kYOXkI",
      targetMuscles: ["abs"],
      bodyParts: ["waist"],
      equipments: ["body weight"],
      secondaryMuscles: ["hip flexors", "obliques"],
      instructions: [
        "Lie flat on your back with your hands placed behind your head.",
        "Lift your shoulders off the ground and bring your knees towards your chest.",
        "Straighten your right leg while turning your upper body to the left, bringing your right elbow towards your left knee.",
        "Switch sides, straightening your left leg while turning your upper body to the right, bringing your left elbow towards your right knee.",
        "Continue alternating sides in a pedaling motion."
      ]
    },
    {
      exerciseId: "0004",
      name: "all fours squad stretch",
      gifUrl: "https://v2.exercisedb.io/image/xqbq8wCGcKMFyF",
      targetMuscles: ["glutes"],
      bodyParts: ["upper legs"],
      equipments: ["body weight"],
      secondaryMuscles: ["hamstrings"],
      instructions: [
        "Start on your hands and knees in a tabletop position.",
        "Slowly lower your hips back towards your heels while keeping your hands planted on the ground.",
        "Hold the stretch for 20-30 seconds.",
        "Return to the starting position and repeat."
      ]
    },
    {
      exerciseId: "0005",
      name: "alternate heel touches",
      gifUrl: "https://v2.exercisedb.io/image/k9ghqwS4yNJtAs",
      targetMuscles: ["abs"],
      bodyParts: ["waist"],
      equipments: ["body weight"],
      secondaryMuscles: ["obliques"],
      instructions: [
        "Lie on your back with your knees bent and feet flat on the floor.",
        "Lift your shoulders slightly off the ground.",
        "Reach your right hand towards your right heel, then return to center.",
        "Reach your left hand towards your left heel, then return to center.",
        "Continue alternating sides for the desired number of repetitions."
      ]
    },
    {
      exerciseId: "0006",
      name: "barbell bench press",
      gifUrl: "https://v2.exercisedb.io/image/HjFMzKHTM9cMks",
      targetMuscles: ["pectorals"],
      bodyParts: ["chest"],
      equipments: ["barbell"],
      secondaryMuscles: ["triceps", "anterior deltoid"],
      instructions: [
        "Lie flat on a bench with your feet firmly planted on the ground.",
        "Grip the barbell with hands slightly wider than shoulder-width apart.",
        "Lower the barbell to your chest with control.",
        "Press the barbell back up to the starting position.",
        "Repeat for the desired number of repetitions."
      ]
    },
    {
      exerciseId: "0007",
      name: "barbell squat",
      gifUrl: "https://v2.exercisedb.io/image/doAC5VRB-sk8te",
      targetMuscles: ["quadriceps"],
      bodyParts: ["upper legs"],
      equipments: ["barbell"],
      secondaryMuscles: ["glutes", "hamstrings"],
      instructions: [
        "Position the barbell on your upper back and shoulders.",
        "Stand with feet shoulder-width apart.",
        "Lower your body by bending your knees and hips.",
        "Keep your chest up and back straight.",
        "Return to standing position by pushing through your heels."
      ]
    },
    {
      exerciseId: "0008",
      name: "barbell deadlift",
      gifUrl: "https://v2.exercisedb.io/image/vG6nZh0t0UNe6x",
      targetMuscles: ["hamstrings"],
      bodyParts: ["upper legs"],
      equipments: ["barbell"],
      secondaryMuscles: ["glutes", "erector spinae"],
      instructions: [
        "Stand with feet hip-width apart, barbell over mid-foot.",
        "Bend at hips and knees to grip the barbell.",
        "Keep your chest up and back straight.",
        "Drive through your heels to stand up straight.",
        "Lower the barbell back to the ground with control."
      ]
    },
    {
      exerciseId: "0009",
      name: "push-ups",
      gifUrl: "https://v2.exercisedb.io/image/6PzAsM9tSbpEPE",
      targetMuscles: ["pectorals"],
      bodyParts: ["chest"],
      equipments: ["body weight"],
      secondaryMuscles: ["triceps", "anterior deltoid"],
      instructions: [
        "Start in a plank position with hands under shoulders.",
        "Lower your body until chest nearly touches the ground.",
        "Keep your body in a straight line.",
        "Push back up to starting position.",
        "Repeat for desired repetitions."
      ]
    },
    {
      exerciseId: "0010",
      name: "pull-ups",
      gifUrl: "https://v2.exercisedb.io/image/OYNIAOOlq1c7tM",
      targetMuscles: ["latissimus dorsi"],
      bodyParts: ["back"],
      equipments: ["pull-up bar"],
      secondaryMuscles: ["biceps", "posterior deltoid"],
      instructions: [
        "Hang from a pull-up bar with palms facing away.",
        "Pull your body up until chin is over the bar.",
        "Lower your body back to starting position with control.",
        "Repeat for desired repetitions."
      ]
    },
    {
      exerciseId: "0011",
      name: "dumbbell bicep curl",
      gifUrl: "https://v2.exercisedb.io/image/TlMFCr5e9wgGhN",
      targetMuscles: ["biceps brachii"],
      bodyParts: ["upper arms"],
      equipments: ["dumbbell"],
      secondaryMuscles: ["forearms"],
      instructions: [
        "Stand with feet shoulder-width apart holding dumbbells.",
        "Keep elbows close to your torso.",
        "Curl the weights up towards your shoulders.",
        "Lower back down to starting position with control.",
        "Repeat for desired repetitions."
      ]
    },
    {
      exerciseId: "0012",
      name: "plank",
      gifUrl: "https://v2.exercisedb.io/image/1iAtc9OD0x8oDh",
      targetMuscles: ["abs"],
      bodyParts: ["waist"],
      equipments: ["body weight"],
      secondaryMuscles: ["shoulders", "glutes"],
      instructions: [
        "Start in push-up position but rest on forearms.",
        "Keep your body in a straight line from head to heels.",
        "Engage your core muscles.",
        "Hold for specified time.",
        "Focus on breathing steadily."
      ]
    },
    {
      exerciseId: "0013",
      name: "jumping jacks",
      gifUrl: "https://v2.exercisedb.io/image/8mnm1cDibsNJgT",
      targetMuscles: ["cardiovascular system"],
      bodyParts: ["cardio"],
      equipments: ["body weight"],
      secondaryMuscles: ["calves", "shoulders"],
      instructions: [
        "Start with feet together and arms at sides.",
        "Jump while spreading legs shoulder-width apart.",
        "Simultaneously raise arms overhead.",
        "Jump back to starting position.",
        "Repeat at a steady pace."
      ]
    },
    {
      exerciseId: "0014",
      name: "mountain climbers",
      gifUrl: "https://v2.exercisedb.io/image/QE3MHZJdKVjxGt",
      targetMuscles: ["abs"],
      bodyParts: ["waist"],
      equipments: ["body weight"],
      secondaryMuscles: ["shoulders", "hip flexors"],
      instructions: [
        "Start in a plank position.",
        "Bring one knee towards your chest.",
        "Quickly switch legs, bringing the other knee forward.",
        "Continue alternating legs at a rapid pace.",
        "Keep core engaged throughout."
      ]
    },
    {
      exerciseId: "0015",
      name: "burpees",
      gifUrl: "https://v2.exercisedb.io/image/2XZAyfhBNJJHDF",
      targetMuscles: ["full body"],
      bodyParts: ["cardio"],
      equipments: ["body weight"],
      secondaryMuscles: ["chest", "legs", "shoulders"],
      instructions: [
        "Start in standing position.",
        "Drop into squat with hands on ground.",
        "Jump feet back into plank position.",
        "Do a push-up (optional).",
        "Jump feet back to squat, then jump up with arms overhead."
      ]
    },
    {
      exerciseId: "0016",
      name: "lunges",
      gifUrl: "https://v2.exercisedb.io/image/QLGXLp0cpQTqQN",
      targetMuscles: ["quadriceps"],
      bodyParts: ["upper legs"],
      equipments: ["body weight"],
      secondaryMuscles: ["glutes", "hamstrings"],
      instructions: [
        "Stand with feet hip-width apart.",
        "Step forward with one leg.",
        "Lower your body until both knees are bent at 90 degrees.",
        "Push back to starting position.",
        "Repeat with other leg."
      ]
    }
  ];

  // Apply client-side filtering
  let filteredExercises = exercises;
  
  if (filterParams.search) {
    filteredExercises = exercises.filter((ex: Exercise) =>
      ex.name.toLowerCase().includes(filterParams.search!.toLowerCase())
    );
  }
  
  if (filterParams.bodyParts && filterParams.bodyParts !== 'all') {
    filteredExercises = filteredExercises.filter(ex =>
      ex.bodyParts.some(part => part.toLowerCase() === filterParams.bodyParts!.toLowerCase())
    );
  }
  
  if (filterParams.equipment && filterParams.equipment !== 'all') {
    filteredExercises = filteredExercises.filter(ex =>
      ex.equipments.some(eq => eq.toLowerCase() === filterParams.equipment!.toLowerCase())
    );
  }
  
  if (filterParams.muscles && filterParams.muscles !== 'all') {
    filteredExercises = filteredExercises.filter(ex =>
      ex.targetMuscles.some(muscle => muscle.toLowerCase().includes(filterParams.muscles!.toLowerCase())) ||
      ex.secondaryMuscles.some(muscle => muscle.toLowerCase().includes(filterParams.muscles!.toLowerCase()))
    );
  }

  const totalExercises = filteredExercises.length;
  const totalPages = Math.ceil(totalExercises / filterParams.limit);
  const startIndex = filterParams.offset;
  const endIndex = startIndex + filterParams.limit;
  const paginatedExercises = filteredExercises.slice(startIndex, endIndex);

  return {
    data: paginatedExercises,
    metadata: {
      totalExercises,
      totalPages,
      currentPage: Math.floor(filterParams.offset / filterParams.limit) + 1,
      limit: filterParams.limit
    }
  };
}

// Fallback exercise data
function getFallbackExercises(filterParams: FilterParams): ExerciseApiResponse {
  console.log('Using fallback exercise database');
  
  let filteredExercises = [...fallbackExercises];
  
  // Apply filters
  if (filterParams.search) {
    filteredExercises = filteredExercises.filter(ex =>
      ex.name.toLowerCase().includes(filterParams.search!.toLowerCase())
    );
  }
  
  if (filterParams.bodyParts && filterParams.bodyParts !== 'all') {
    filteredExercises = filteredExercises.filter(ex =>
      ex.bodyParts.some(part => part.toLowerCase() === filterParams.bodyParts!.toLowerCase())
    );
  }
  
  if (filterParams.equipment && filterParams.equipment !== 'all') {
    filteredExercises = filteredExercises.filter(ex =>
      ex.equipments.some(eq => eq.toLowerCase() === filterParams.equipment!.toLowerCase())
    );
  }
  
  if (filterParams.muscles && filterParams.muscles !== 'all') {
    filteredExercises = filteredExercises.filter(ex =>
      ex.targetMuscles.some(muscle => muscle.toLowerCase().includes(filterParams.muscles!.toLowerCase())) ||
      ex.secondaryMuscles.some(muscle => muscle.toLowerCase().includes(filterParams.muscles!.toLowerCase()))
    );
  }

  const totalExercises = filteredExercises.length;
  const totalPages = Math.ceil(totalExercises / filterParams.limit);
  const startIndex = filterParams.offset;
  const endIndex = startIndex + filterParams.limit;
  const paginatedExercises = filteredExercises.slice(startIndex, endIndex);

  return {
    data: paginatedExercises,
    metadata: {
      totalExercises,
      totalPages,
      currentPage: Math.floor(filterParams.offset / filterParams.limit) + 1,
      limit: filterParams.limit
    }
  };
}

// Fetch body parts with fallback
export async function fetchBodyParts(): Promise<{ name: string }[]> {
  try {
    if (USE_RAPIDAPI) {
      const response = await fetch('https://exercisedb.p.rapidapi.com/exercises/bodyPartList', {
        headers: {
          'X-RapidAPI-Key': RAPIDAPI_KEY!,
          'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com'
        }
      });
      if (response.ok) {
        const data = await response.json();
        return data.map((name: string) => ({ name }));
      }
    } else {
      const response = await fetch('https://www.exercisedb.dev/api/v1/bodyparts');
      if (response.ok) {
        const data = await response.json();
        return data.data || [];
      }
    }
  } catch (error) {
    console.warn('Failed to fetch body parts, using fallback:', error);
  }
  
  return fallbackBodyParts;
}

// Fetch equipment with fallback
export async function fetchEquipments(): Promise<{ name: string }[]> {
  try {
    if (USE_RAPIDAPI) {
      const response = await fetch('https://exercisedb.p.rapidapi.com/exercises/equipmentList', {
        headers: {
          'X-RapidAPI-Key': RAPIDAPI_KEY!,
          'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com'
        }
      });
      if (response.ok) {
        const data = await response.json();
        return data.map((name: string) => ({ name }));
      }
    } else {
      const response = await fetch('https://www.exercisedb.dev/api/v1/equipments');
      if (response.ok) {
        const data = await response.json();
        return data.data || [];
      }
    }
  } catch (error) {
    console.warn('Failed to fetch equipment, using fallback:', error);
  }
  
  return fallbackEquipments;
}

// Fetch target muscles with fallback
export async function fetchTargets(): Promise<{ name: string }[]> {
  try {
    if (USE_RAPIDAPI) {
      const response = await fetch('https://exercisedb.p.rapidapi.com/exercises/targetList', {
        headers: {
          'X-RapidAPI-Key': RAPIDAPI_KEY!,
          'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com'
        }
      });
      if (response.ok) {
        const data = await response.json();
        return data.map((name: string) => ({ name }));
      }
    } else {
      const response = await fetch('https://www.exercisedb.dev/api/v1/muscles');
      if (response.ok) {
        const data = await response.json();
        return data.data || [];
      }
    }
  } catch (error) {
    console.warn('Failed to fetch target muscles, using fallback:', error);
  }
  
  return fallbackTargets;
}