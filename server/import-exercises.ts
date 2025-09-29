import { db } from './db';
import { exercises } from '../shared/schema';
import { log } from './vite';
import { sql } from 'drizzle-orm';

// Free public exercise database from GitHub
const EXERCISES_JSON_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';

interface GitHubExercise {
  id: string;
  name: string;
  force: string;
  level: string;
  mechanic: string | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
  images: string[];
}

interface ExerciseDBExercise {
  id: string;
  name: string;
  gifUrl: string;
  bodyPart: string;
  equipment: string;
  target: string;
  secondaryMuscles: string[];
  instructions: string[];
}

// Map equipment to standard body part categories
function mapToBodyPart(primaryMuscles: string[]): string {
  const muscle = primaryMuscles[0]?.toLowerCase() || 'other';
  
  const bodyPartMap: Record<string, string> = {
    'abdominals': 'waist',
    'abs': 'waist',
    'obliques': 'waist',
    'biceps': 'upper arms',
    'triceps': 'upper arms',
    'forearms': 'lower arms',
    'chest': 'chest',
    'pectorals': 'chest',
    'lats': 'back',
    'lower back': 'back',
    'middle back': 'back',
    'traps': 'back',
    'shoulders': 'shoulders',
    'deltoids': 'shoulders',
    'quadriceps': 'upper legs',
    'quads': 'upper legs',
    'hamstrings': 'upper legs',
    'glutes': 'upper legs',
    'adductors': 'upper legs',
    'abductors': 'upper legs',
    'calves': 'lower legs',
    'neck': 'neck',
  };
  
  return bodyPartMap[muscle] || 'other';
}

// Generate GIF URL from exercise ID (using exercisedb.io CDN for GIFs)
function generateGifUrl(exerciseId: string): string {
  // Convert ID to slug format for GIF URL
  const slug = exerciseId.toLowerCase().replace(/_/g, ' ');
  return `https://v2.exercisedb.io/image/${exerciseId}`;
}

async function fetchAllExercises(): Promise<ExerciseDBExercise[]> {
  try {
    log('Fetching all exercises from GitHub free exercise database...');
    
    const response = await fetch(EXERCISES_JSON_URL);
    
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }
    
    const githubExercises: GitHubExercise[] = await response.json();
    log(`Successfully fetched ${githubExercises.length} exercises from GitHub`);
    
    // Convert GitHub format to our ExerciseDB format
    const exercises: ExerciseDBExercise[] = githubExercises.map(ex => ({
      id: ex.id,
      name: ex.name,
      gifUrl: generateGifUrl(ex.id),
      bodyPart: mapToBodyPart(ex.primaryMuscles),
      equipment: ex.equipment || 'body only',
      target: ex.primaryMuscles[0] || 'general',
      secondaryMuscles: ex.secondaryMuscles,
      instructions: ex.instructions,
    }));
    
    log(`Converted ${exercises.length} exercises to database format`);
    return exercises;
  } catch (error) {
    log(`Error fetching exercises: ${error}`);
    throw error;
  }
}

async function importExercisesToDatabase(exercisesData: ExerciseDBExercise[]) {
  try {
    log(`Importing ${exercisesData.length} exercises to database...`);
    
    // Insert in batches of 100 to avoid overwhelming the database
    const batchSize = 100;
    let imported = 0;
    
    for (let i = 0; i < exercisesData.length; i += batchSize) {
      const batch = exercisesData.slice(i, i + batchSize);
      
      await db.insert(exercises)
        .values(batch.map(ex => ({
          id: ex.id,
          name: ex.name,
          gifUrl: ex.gifUrl,
          bodyPart: ex.bodyPart,
          equipment: ex.equipment,
          target: ex.target,
          secondaryMuscles: ex.secondaryMuscles,
          instructions: ex.instructions,
        })))
        .onConflictDoUpdate({
          target: exercises.id,
          set: {
            name: sql`EXCLUDED.name`,
            gifUrl: sql`EXCLUDED.gif_url`,
            bodyPart: sql`EXCLUDED.body_part`,
            equipment: sql`EXCLUDED.equipment`,
            target: sql`EXCLUDED.target`,
            secondaryMuscles: sql`EXCLUDED.secondary_muscles`,
            instructions: sql`EXCLUDED.instructions`,
            updatedAt: new Date(),
          }
        });
      
      imported += batch.length;
      log(`Imported ${imported}/${exercisesData.length} exercises...`);
    }
    
    log(`✓ Successfully imported all ${exercisesData.length} exercises to database!`);
  } catch (error) {
    log(`Error importing exercises to database: ${error}`);
    throw error;
  }
}

export async function importExerciseDatabase() {
  try {
    log('Starting ExerciseDB import process...');
    const exercisesData = await fetchAllExercises();
    await importExercisesToDatabase(exercisesData);
    log('✓ ExerciseDB import complete!');
    return { success: true, count: exercisesData.length };
  } catch (error) {
    log(`✗ ExerciseDB import failed: ${error}`);
    return { success: false, error: String(error) };
  }
}

// Run import if executed directly
importExerciseDatabase()
  .then((result) => {
    if (result.success) {
      log(`Import successful: ${result.count} exercises imported`);
      process.exit(0);
    } else {
      log(`Import failed: ${result.error}`);
      process.exit(1);
    }
  })
  .catch((error) => {
    log(`Import error: ${error}`);
    process.exit(1);
  });
