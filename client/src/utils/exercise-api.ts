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

// Open source version (rate limited)
async function fetchFromOpenSource(filterParams: FilterParams): Promise<ExerciseApiResponse> {
  const queryParams = new URLSearchParams();
  queryParams.set('offset', filterParams.offset.toString());
  queryParams.set('limit', filterParams.limit.toString());
  
  if (filterParams.search) queryParams.set('search', filterParams.search);
  if (filterParams.bodyParts && filterParams.bodyParts !== 'all') queryParams.set('bodyParts', filterParams.bodyParts);
  if (filterParams.equipment && filterParams.equipment !== 'all') queryParams.set('equipment', filterParams.equipment);
  if (filterParams.muscles && filterParams.muscles !== 'all') queryParams.set('muscles', filterParams.muscles);
  if (filterParams.sortBy) queryParams.set('sortBy', filterParams.sortBy);
  if (filterParams.sortOrder) queryParams.set('sortOrder', filterParams.sortOrder);

  const url = `https://www.exercisedb.dev/api/v1/exercises/filter?${queryParams.toString()}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Open source API request failed: ${response.status}`);
  }
  
  const data = await response.json();
  
  // Check if we got valid data
  if (!data || !data.data || data.data.length === 0) {
    throw new Error('No data returned from open source API');
  }
  
  return data;
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