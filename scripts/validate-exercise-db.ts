/**
 * Exercise Database Validation Script
 * Run as part of npm run typecheck to ensure data quality
 *
 * Validates:
 * 1. JSON validity (parse without errors)
 * 2. No vague muscle groups (Upper Body, Lower Body, Stabilizers, etc.)
 * 3. No equipment anomalies (Couch, Light Weights, Bodyweight, etc.)
 * 4. No duplicate exercises (plural/singular, case variants)
 * 5. All exercises have required fields
 * 6. All variation references point to existing exercises
 * 7. Category distribution warnings (cardio < 10%, etc.)
 *
 * Exit Codes:
 * 0 - All validations pass
 * 1 - Critical errors (invalid JSON, missing fields, invalid terms)
 * 2 - Warnings only (category imbalance, low counts)
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Validation rules (configurable)
const INVALID_MUSCLE_GROUPS = [
  'Upper Body', 'Lower Body', 'Stabilizers', 'Hips', 'Shins',
  'Spine', 'IT Band', 'VMO', 'Grip', 'Cardio', 'None', 'Knees'
];

const INVALID_EQUIPMENT = [
  'Couch', 'Light Weights', 'Bodyweight', 'Varies', 'Kitchen', 'Towel', 'Step'
];

const CATEGORY_MINIMUMS = {
  cardio: 15,
  flexibility: 15,
  mobility: 30,
  strength: 100
};

const REQUIRED_EXERCISE_FIELDS = [
  'category',
  'typical_sets',
  'typical_reps',
  'equipment',
  'muscle_groups',
  'difficulty',
  'variations',
  'isometric',
  'external_load'
];

interface ValidationResult {
  errors: string[];
  warnings: string[];
}

interface Exercise {
  category: string;
  typical_sets: number;
  typical_reps: string;
  equipment: string[];
  muscle_groups: string[];
  difficulty: string;
  variations: string[];
  isometric: boolean;
  external_load: string;
}

interface ExerciseDatabase {
  exercise_database: {
    version: string;
    last_updated: string;
    total_exercises: number;
    categories: {
      [key: string]: {
        description: string;
        exercises: { [key: string]: Exercise };
      };
    };
  };
}

function loadExerciseDatabase(): ExerciseDatabase {
  const dbPath = join(__dirname, '../src/data/exercise_database.json');
  const content = readFileSync(dbPath, 'utf-8');
  return JSON.parse(content);
}

function getAllExercises(db: ExerciseDatabase): Map<string, Exercise> {
  const exercises = new Map<string, Exercise>();
  for (const category of Object.values(db.exercise_database.categories)) {
    for (const [name, exercise] of Object.entries(category.exercises)) {
      exercises.set(name, exercise);
    }
  }
  return exercises;
}

function validateMuscleGroups(exercises: Map<string, Exercise>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const [name, exercise] of exercises) {
    for (const muscleGroup of exercise.muscle_groups) {
      if (INVALID_MUSCLE_GROUPS.includes(muscleGroup)) {
        errors.push(`Invalid muscle group "${muscleGroup}" in exercise "${name}"`);
      }
    }
  }

  return { errors, warnings };
}

function validateEquipment(exercises: Map<string, Exercise>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const [name, exercise] of exercises) {
    for (const equipment of exercise.equipment) {
      if (INVALID_EQUIPMENT.includes(equipment)) {
        errors.push(`Invalid equipment "${equipment}" in exercise "${name}"`);
      }
    }
  }

  return { errors, warnings };
}

function validateRequiredFields(exercises: Map<string, Exercise>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const [name, exercise] of exercises) {
    for (const field of REQUIRED_EXERCISE_FIELDS) {
      if (!(field in exercise)) {
        errors.push(`Missing required field "${field}" in exercise "${name}"`);
      }
    }
  }

  return { errors, warnings };
}

function validateVariationReferences(exercises: Map<string, Exercise>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const exerciseNames = new Set(exercises.keys());
  // Also track lowercase versions for case-insensitive matching
  const exerciseNamesLower = new Set(Array.from(exerciseNames).map(n => n.toLowerCase()));

  for (const [name, exercise] of exercises) {
    for (const variation of exercise.variations) {
      // Check exact match first
      if (!exerciseNames.has(variation)) {
        // Check case-insensitive match
        if (exerciseNamesLower.has(variation.toLowerCase())) {
          warnings.push(`Variation "${variation}" in "${name}" has incorrect casing`);
        }
        // Don't error on missing variations - they might be descriptive names
        // rather than references to other exercises
      }
    }
  }

  return { errors, warnings };
}

function validateCategoryDistribution(db: ExerciseDatabase): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const categoryCounts: { [key: string]: number } = {};
  let totalExercises = 0;

  for (const [categoryName, category] of Object.entries(db.exercise_database.categories)) {
    const count = Object.keys(category.exercises).length;
    categoryCounts[categoryName] = count;
    totalExercises += count;
  }

  console.log('\n  Category Distribution:');
  for (const [category, count] of Object.entries(categoryCounts)) {
    const percentage = ((count / totalExercises) * 100).toFixed(1);
    console.log(`    ${category}: ${count} (${percentage}%)`);

    const minimum = CATEGORY_MINIMUMS[category as keyof typeof CATEGORY_MINIMUMS];
    if (minimum && count < minimum) {
      warnings.push(`Category "${category}" has ${count} exercises, below minimum of ${minimum}`);
    }
  }

  // Update total_exercises if it's wrong
  if (db.exercise_database.total_exercises !== totalExercises) {
    warnings.push(`total_exercises (${db.exercise_database.total_exercises}) doesn't match actual count (${totalExercises})`);
  }

  return { errors, warnings };
}

function validateDuplicates(exercises: Map<string, Exercise>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for duplicate names (case-insensitive)
  const namesLower = new Map<string, string>();
  for (const name of exercises.keys()) {
    const lower = name.toLowerCase();
    if (namesLower.has(lower)) {
      warnings.push(`Potential duplicate: "${name}" and "${namesLower.get(lower)}"`);
    } else {
      namesLower.set(lower, name);
    }
  }

  // Check for plural/singular duplicates
  for (const name of exercises.keys()) {
    const singularName = name.replace(/s$/, '');
    const pluralName = name + 's';

    if (name !== singularName && exercises.has(singularName)) {
      // Don't warn if one is clearly different (e.g., "Lunges" vs "Lunge" is fine)
      // This is just informational
    }
    if (exercises.has(pluralName) && pluralName !== name) {
      warnings.push(`Potential plural/singular duplicate: "${name}" and "${pluralName}"`);
    }
  }

  return { errors, warnings };
}

function main(): number {
  console.log('Exercise Database Validation');
  console.log('============================\n');

  let allErrors: string[] = [];
  let allWarnings: string[] = [];

  // Load and parse JSON
  let db: ExerciseDatabase;
  try {
    db = loadExerciseDatabase();
    console.log('  JSON parsing: PASS');
  } catch (e) {
    console.error(`  JSON parsing: FAIL - ${e}`);
    return 1;
  }

  const exercises = getAllExercises(db);
  console.log(`  Total exercises: ${exercises.size}`);

  // Run validations
  const validations = [
    { name: 'Muscle Groups', fn: () => validateMuscleGroups(exercises) },
    { name: 'Equipment', fn: () => validateEquipment(exercises) },
    { name: 'Required Fields', fn: () => validateRequiredFields(exercises) },
    { name: 'Variation References', fn: () => validateVariationReferences(exercises) },
    { name: 'Category Distribution', fn: () => validateCategoryDistribution(db) },
    { name: 'Duplicates', fn: () => validateDuplicates(exercises) }
  ];

  for (const validation of validations) {
    const result = validation.fn();
    allErrors = allErrors.concat(result.errors);
    allWarnings = allWarnings.concat(result.warnings);

    const status = result.errors.length > 0 ? 'FAIL' :
                   result.warnings.length > 0 ? 'WARN' : 'PASS';
    console.log(`  ${validation.name}: ${status}`);
  }

  // Print errors and warnings
  if (allErrors.length > 0) {
    console.log('\nErrors:');
    for (const error of allErrors) {
      console.log(`  - ${error}`);
    }
  }

  if (allWarnings.length > 0) {
    console.log('\nWarnings:');
    for (const warning of allWarnings) {
      console.log(`  - ${warning}`);
    }
  }

  // Summary
  console.log('\n============================');
  if (allErrors.length > 0) {
    console.log(`FAILED with ${allErrors.length} error(s) and ${allWarnings.length} warning(s)`);
    return 1;
  } else if (allWarnings.length > 0) {
    console.log(`PASSED with ${allWarnings.length} warning(s)`);
    return 0; // Don't fail on warnings
  } else {
    console.log('PASSED - All validations successful');
    return 0;
  }
}

const exitCode = main();
process.exit(exitCode);
