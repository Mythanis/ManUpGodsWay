import { db } from './db';
import { exercises } from '../shared/schema';
import { log } from './vite';
import { sql } from 'drizzle-orm';

// ExerciseDB v1 API endpoint
const EXERCISEDB_API_BASE = 'https://v1.exercisedb.dev';

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

async function fetchAllExercises(): Promise<ExerciseDBExercise[]> {
  try {
    log('Fetching all exercises from ExerciseDB v1 API...');
    const response = await fetch(`${EXERCISEDB_API_BASE}/exercises`);
    
    if (!response.ok) {
      throw new Error(`ExerciseDB API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    log(`Successfully fetched ${data.length} exercises from ExerciseDB`);
    return data;
  } catch (error) {
    log(`Error fetching exercises from ExerciseDB: ${error}`);
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
