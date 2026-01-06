/**
 * Exercise Filtering Diagnostics Tool
 *
 * USAGE:
 *   npm run test:diagnostics
 *   or
 *   tsx tests/diagnostics/exercise-filtering-diagnostics.ts
 *
 * This diagnostic tool helps debug exercise pool filtering issues by:
 * - Testing problematic equipment + experience combinations
 * - Breaking down filtering steps to identify bottlenecks
 * - Showing which exercises almost match (fail on one criterion)
 * - Comparing different configurations side-by-side
 *
 * Use this tool when:
 * - Workout generation fails due to empty exercise pools
 * - You need to understand why certain exercises aren't being selected
 * - You're debugging experience level + equipment compatibility
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type {
  ExerciseDatabase,
  Exercise,
  GenerationRules
} from '../../src/lib/engine/types.js';
import { flattenExerciseDatabase } from '../../src/lib/engine/exercise-selector.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');

/**
 * Equipment mapping for different access levels
 */
const EQUIPMENT_MAPPINGS = {
  bodyweight_only: ['None', 'Pull-up Bar', 'Chair', 'Wall', 'Mat', 'Box', 'Platform'],
  minimal_equipment: ['None', 'Pull-up Bar', 'Chair', 'Wall', 'Mat', 'Box', 'Platform', 'Dumbbells', 'Resistance Band'],
  dumbbells_only: ['None', 'Dumbbells', 'Mat'],
  home_gym_basic: ['None', 'Dumbbells', 'Barbell', 'Pull-up Bar', 'Mat', 'Bench'],
  home_gym_full: ['None', 'Dumbbells', 'Barbell', 'Pull-up Bar', 'Mat', 'Bench', 'Cable Machine', 'Rack'],
  commercial_gym: [] // No restrictions
};

/**
 * Diagnose filtering for a specific configuration
 */
function diagnoseConfiguration(
  allExercises: Array<[string, Exercise]>,
  experienceLevel: string,
  equipmentAccess: keyof typeof EQUIPMENT_MAPPINGS,
  focus: string,
  rules: GenerationRules
): void {
  console.log('\n========================================');
  console.log(`CONFIGURATION: ${experienceLevel} + ${equipmentAccess} + ${focus}`);
  console.log('========================================\n');

  // Get experience modifiers
  const experienceModifiers = (rules as any).experience_modifiers[experienceLevel];
  if (!experienceModifiers) {
    console.log(`❌ No experience modifiers found for "${experienceLevel}"\n`);
    return;
  }

  console.log('Experience modifiers:');
  console.log(`  complexity_filter: ${experienceModifiers.complexity_filter.join(', ')}`);
  console.log(`  external_load_filter: ${experienceModifiers.external_load_filter.join(', ')}\n`);

  // Get muscle groups for focus
  const focusMapping = (rules as any).split_muscle_group_mapping?.[focus];
  if (!focusMapping) {
    console.log(`❌ No muscle group mapping found for focus "${focus}"\n`);
    return;
  }

  const targetMuscleGroups = focusMapping.include_muscle_groups || [];
  console.log(`Focus "${focus}" muscle groups: ${targetMuscleGroups.join(', ')}\n`);

  // Get equipment list
  const allowedEquipment = EQUIPMENT_MAPPINGS[equipmentAccess];

  // Step-by-step filtering breakdown
  console.log('Filtering breakdown:\n');

  // Step 1: Equipment filter
  const step1 = allExercises.filter(([name, exercise]) => {
    if (equipmentAccess === 'commercial_gym') return true;
    if (exercise.equipment.length === 0 || exercise.equipment.includes('None')) return true;
    return exercise.equipment.every(eq => allowedEquipment.includes(eq));
  });
  console.log(`Step 1 - Equipment (${equipmentAccess}): ${step1.length} exercises`);

  // Step 2: + Muscle groups
  const step2 = step1.filter(([name, exercise]) => {
    return exercise.muscle_groups.some(mg => targetMuscleGroups.includes(mg));
  });
  console.log(`Step 2 - + Muscle groups (${focus}): ${step2.length} exercises`);

  // Step 3: + Difficulty
  const step3 = step2.filter(([name, exercise]) => {
    return experienceModifiers.complexity_filter.includes(exercise.difficulty);
  });
  console.log(`Step 3 - + Difficulty (${experienceModifiers.complexity_filter.join('/')}): ${step3.length} exercises`);

  // Step 4: + External load
  const step4 = step3.filter(([name, exercise]) => {
    return experienceModifiers.external_load_filter.includes(exercise.external_load);
  });
  console.log(`Step 4 - + External load (${experienceModifiers.external_load_filter.join('/')}): ${step4.length} exercises`);

  // Show final results
  if (step4.length > 0) {
    console.log(`\n✓ SUCCESS: ${step4.length} exercises match all criteria\n`);
    console.log('Sample matching exercises:');
    for (const [name, exercise] of step4.slice(0, 10)) {
      console.log(`  - ${name} (${exercise.difficulty}, ${exercise.external_load}, ${exercise.equipment.join('/')})`);
    }
  } else {
    console.log('\n❌ FAILURE: No exercises match all criteria\n');

    // Show exercises that almost match (fail only on external_load)
    console.log('Exercises that ALMOST match (fail only on external_load):');
    const almostMatching = step3.filter(([name, exercise]) => {
      return !experienceModifiers.external_load_filter.includes(exercise.external_load);
    });

    if (almostMatching.length > 0) {
      for (const [name, exercise] of almostMatching.slice(0, 10)) {
        console.log(`  - ${name} (${exercise.difficulty}, external_load="${exercise.external_load}" ❌ needs "${experienceModifiers.external_load_filter.join(' or ')}")`);
      }
      console.log(`\n  ... and ${Math.max(0, almostMatching.length - 10)} more\n`);

      console.log('💡 SUGGESTION: The external_load filter is too restrictive for this equipment level.');
      console.log('   Consider making external_load_filter equipment-aware in workout_generation_rules.json\n');
    } else {
      console.log('  (No exercises found)\n');
    }
  }

  console.log('========================================\n');
}

/**
 * Main diagnostic function
 */
async function runDiagnostics() {
  // Load exercise database
  const exerciseDBPath = join(projectRoot, 'src/data/exercise_database.json');
  const exerciseDB: ExerciseDatabase = JSON.parse(readFileSync(exerciseDBPath, 'utf-8'));

  // Load generation rules
  const rulesPath = join(projectRoot, 'src/data/workout_generation_rules.json');
  const rules: GenerationRules = JSON.parse(readFileSync(rulesPath, 'utf-8'));

  const allExercises = flattenExerciseDatabase(exerciseDB);

  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║  EXERCISE FILTERING DIAGNOSTICS TOOL                   ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log(`\nTotal exercises in database: ${allExercises.length}\n`);

  // ===== PROBLEMATIC CONFIGURATIONS =====

  console.log('\n### TESTING PROBLEMATIC CONFIGURATIONS ###\n');

  // Configuration 1: Advanced + Bodyweight Only + Pull
  diagnoseConfiguration(
    allExercises,
    'advanced',
    'bodyweight_only',
    'Pull',
    rules
  );

  // Configuration 2: Expert + Bodyweight Only + Push
  diagnoseConfiguration(
    allExercises,
    'expert',
    'bodyweight_only',
    'Push',
    rules
  );

  // Configuration 3: Advanced + Minimal Equipment + Legs
  diagnoseConfiguration(
    allExercises,
    'advanced',
    'minimal_equipment',
    'Legs',
    rules
  );

  // Configuration 4: Expert + Dumbbells Only + Full Body
  diagnoseConfiguration(
    allExercises,
    'expert',
    'dumbbells_only',
    'Full Body',
    rules
  );

  // ===== BASELINE CONFIGURATIONS (SHOULD WORK) =====

  console.log('\n### TESTING BASELINE CONFIGURATIONS (SHOULD WORK) ###\n');

  // Baseline 1: Beginner + Bodyweight Only + Full Body
  diagnoseConfiguration(
    allExercises,
    'beginner',
    'bodyweight_only',
    'Full Body',
    rules
  );

  // Baseline 2: Intermediate + Home Gym Full + Push
  diagnoseConfiguration(
    allExercises,
    'intermediate',
    'home_gym_full',
    'Push',
    rules
  );

  // Baseline 3: Advanced + Commercial Gym + Legs
  diagnoseConfiguration(
    allExercises,
    'advanced',
    'commercial_gym',
    'Legs',
    rules
  );

  // ===== SUMMARY =====

  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║  DIAGNOSTICS COMPLETE                                  ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  console.log('Key Findings:');
  console.log('1. Advanced/Expert + Bodyweight/Minimal Equipment often fails');
  console.log('2. Root cause: external_load filter requires "always" but bodyweight = "never"/"sometimes"');
  console.log('3. Solution: Make external_load_filter equipment-aware\n');

  console.log('Recommended Actions:');
  console.log('- Update workout_generation_rules.json to include equipment-specific external_load filters');
  console.log('- OR: Relax external_load requirements for limited equipment scenarios');
  console.log('- OR: Add more advanced bodyweight exercises with external_load="always" to database\n');
}

// Run diagnostics
runDiagnostics().catch(console.error);
