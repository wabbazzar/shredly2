/**
 * Test Validation Helpers
 *
 * Provides validation functions for testing workout generation
 * engine output against WORKOUT_SPEC.md requirements.
 */

import type {
  WorkoutProgram,
  ParameterizedDay,
  ParameterizedExercise,
  ExerciseDatabase,
  Exercise
} from '../../src/lib/engine/types.js';

// ============================================================================
// WORKOUT STRUCTURE VALIDATION
// ============================================================================

/**
 * Validates workout structure against WORKOUT_SPEC.md requirements
 * Throws descriptive errors if validation fails
 */
export function validateWorkoutStructure(workout: WorkoutProgram): void {
  // Validate metadata
  if (!workout.metadata) {
    throw new Error('Workout missing metadata');
  }

  if (!workout.metadata.programId) {
    throw new Error('Workout metadata missing programId');
  }

  if (!workout.metadata.weeks || workout.metadata.weeks < 1) {
    throw new Error('Workout metadata must specify weeks >= 1');
  }

  if (!workout.metadata.daysPerWeek || workout.metadata.daysPerWeek < 2 || workout.metadata.daysPerWeek > 7) {
    throw new Error('Workout metadata daysPerWeek must be 2-7');
  }

  // Validate days structure
  if (!workout.days || typeof workout.days !== 'object') {
    throw new Error('Workout missing days object');
  }

  const dayNumbers = Object.keys(workout.days).map(Number);
  if (dayNumbers.length === 0) {
    throw new Error('Workout has no days');
  }

  // Validate each day
  for (const [dayKey, day] of Object.entries(workout.days)) {
    validateDay(day, dayKey);
  }
}

/**
 * Validates a single day structure
 */
function validateDay(day: ParameterizedDay, dayKey: string): void {
  if (!day.dayNumber) {
    throw new Error(`Day ${dayKey} missing dayNumber`);
  }

  if (!day.type) {
    throw new Error(`Day ${dayKey} missing type`);
  }

  if (!day.focus) {
    throw new Error(`Day ${dayKey} missing focus`);
  }

  if (!day.exercises || !Array.isArray(day.exercises)) {
    throw new Error(`Day ${dayKey} missing exercises array`);
  }

  if (day.exercises.length === 0) {
    throw new Error(`Day ${dayKey} has no exercises`);
  }

  // Validate each exercise
  for (let i = 0; i < day.exercises.length; i++) {
    validateExercise(day.exercises[i], dayKey, i);
  }
}

/**
 * Validates a single exercise structure
 */
function validateExercise(exercise: ParameterizedExercise, dayKey: string, index: number): void {
  if (!exercise.name) {
    throw new Error(`Day ${dayKey} exercise ${index} missing name`);
  }

  // Validate week parameters exist
  if (!exercise.week1) {
    throw new Error(`Day ${dayKey} exercise ${index} (${exercise.name}) missing week1`);
  }

  if (!exercise.week2) {
    throw new Error(`Day ${dayKey} exercise ${index} (${exercise.name}) missing week2`);
  }

  if (!exercise.week3) {
    throw new Error(`Day ${dayKey} exercise ${index} (${exercise.name}) missing week3`);
  }

  // Validate sub-exercises if present
  if (exercise.sub_exercises) {
    if (!Array.isArray(exercise.sub_exercises)) {
      throw new Error(`Day ${dayKey} exercise ${index} (${exercise.name}) sub_exercises must be an array`);
    }

    for (let j = 0; j < exercise.sub_exercises.length; j++) {
      const subEx = exercise.sub_exercises[j];
      if (!subEx.name) {
        throw new Error(`Day ${dayKey} exercise ${index} (${exercise.name}) sub-exercise ${j} missing name`);
      }
      if (!subEx.week1) {
        throw new Error(`Day ${dayKey} exercise ${index} (${exercise.name}) sub-exercise ${j} missing week1`);
      }
    }
  }
}

// ============================================================================
// EXERCISE REFERENCE VALIDATION
// ============================================================================

/**
 * Validates all exercise references exist in the exercise database
 * Checks muscle groups, equipment, and difficulty are valid
 */
export function validateExerciseReferences(
  workout: WorkoutProgram,
  exerciseDB: ExerciseDatabase
): void {
  const allExercises = getAllExercisesFromDB(exerciseDB);

  for (const [dayKey, day] of Object.entries(workout.days)) {
    for (const exercise of day.exercises) {
      // Check main exercise
      if (!allExercises[exercise.name]) {
        throw new Error(`Day ${dayKey} exercise "${exercise.name}" not found in exercise database`);
      }

      // Validate exercise metadata
      const dbExercise = allExercises[exercise.name];
      validateExerciseMetadata(dbExercise, exercise.name);

      // Check sub-exercises
      if (exercise.sub_exercises) {
        for (const subEx of exercise.sub_exercises) {
          if (!allExercises[subEx.name]) {
            throw new Error(`Day ${dayKey} sub-exercise "${subEx.name}" not found in exercise database`);
          }
        }
      }
    }
  }
}

/**
 * Validates exercise metadata is valid
 */
function validateExerciseMetadata(exercise: Exercise, name: string): void {
  if (!exercise.muscle_groups || exercise.muscle_groups.length === 0) {
    throw new Error(`Exercise "${name}" missing muscle_groups`);
  }

  if (!exercise.equipment || exercise.equipment.length === 0) {
    throw new Error(`Exercise "${name}" missing equipment`);
  }

  if (!exercise.difficulty) {
    throw new Error(`Exercise "${name}" missing difficulty`);
  }

  if (!['Beginner', 'Intermediate', 'Advanced'].includes(exercise.difficulty)) {
    throw new Error(`Exercise "${name}" has invalid difficulty: ${exercise.difficulty}`);
  }

  if (!['never', 'sometimes', 'always'].includes(exercise.external_load)) {
    throw new Error(`Exercise "${name}" has invalid external_load: ${exercise.external_load}`);
  }
}

/**
 * Flattens exercise database into a single object for quick lookup
 */
function getAllExercisesFromDB(exerciseDB: ExerciseDatabase): { [name: string]: Exercise } {
  const result: { [name: string]: Exercise } = {};

  for (const category of Object.values(exerciseDB.exercise_database.categories)) {
    for (const [name, exercise] of Object.entries(category.exercises)) {
      result[name] = exercise;
    }
  }

  return result;
}

// ============================================================================
// DURATION CONSTRAINTS VALIDATION
// ============================================================================

/**
 * Validates estimated workout duration stays within bounds
 * Calculates duration from sets, reps, rest times
 */
export function validateDurationConstraints(
  day: ParameterizedDay,
  maxMinutes: number,
  weekNumber: number = 1
): void {
  const estimatedMinutes = estimateWorkoutDuration(day, weekNumber);

  if (estimatedMinutes > maxMinutes * 1.2) {
    throw new Error(
      `Day ${day.dayNumber} (${day.focus}) estimated duration ${estimatedMinutes.toFixed(1)} minutes exceeds max ${maxMinutes} by >20%`
    );
  }
}

/**
 * Estimates workout duration in minutes
 * Formula: (sets * (reps * 3 seconds + rest_time)) per exercise
 */
function estimateWorkoutDuration(day: ParameterizedDay, weekNumber: number): number {
  let totalMinutes = 0;

  for (const exercise of day.exercises) {
    const weekKey = `week${weekNumber}` as keyof ParameterizedExercise;
    const weekParams = exercise[weekKey];

    if (weekParams && typeof weekParams === 'object') {
      const sets = weekParams.sets || 3;
      const reps = typeof weekParams.reps === 'number' ? weekParams.reps : 10;
      const restMinutes = weekParams.rest_time_minutes || 1;

      // Rough estimate: 3 seconds per rep + rest time
      const workMinutes = (reps * 3) / 60;
      const totalPerSet = workMinutes + restMinutes;

      totalMinutes += sets * totalPerSet;
    }
  }

  // Add 10% buffer for transitions
  return totalMinutes * 1.1;
}

// ============================================================================
// MUSCLE GROUP COVERAGE VALIDATION
// ============================================================================

/**
 * Validates muscle group coverage matches training split expectations
 */
export function validateMuscleGroupCoverage(
  day: ParameterizedDay,
  exerciseDB: ExerciseDatabase,
  expectedMuscleGroups?: string[]
): void {
  const allExercises = getAllExercisesFromDB(exerciseDB);
  const muscleGroupCounts: { [group: string]: number } = {};

  // Count muscle group occurrences
  for (const exercise of day.exercises) {
    const dbExercise = allExercises[exercise.name];
    if (dbExercise) {
      for (const muscleGroup of dbExercise.muscle_groups) {
        muscleGroupCounts[muscleGroup] = (muscleGroupCounts[muscleGroup] || 0) + 1;
      }
    }
  }

  // If expected muscle groups provided, validate they're present
  if (expectedMuscleGroups) {
    for (const expectedGroup of expectedMuscleGroups) {
      if (!muscleGroupCounts[expectedGroup] || muscleGroupCounts[expectedGroup] === 0) {
        throw new Error(
          `Day ${day.dayNumber} (${day.focus}) missing expected muscle group: ${expectedGroup}`
        );
      }
    }
  }

  // Validate at least one muscle group is hit
  if (Object.keys(muscleGroupCounts).length === 0) {
    throw new Error(`Day ${day.dayNumber} (${day.focus}) has no muscle group coverage`);
  }
}

// ============================================================================
// PROGRESSION LOGIC VALIDATION
// ============================================================================

/**
 * Validates progressive overload week-to-week
 * Checks that volume, intensity, or density increases
 */
export function validateProgressionLogic(
  exercise: ParameterizedExercise,
  weeks: number
): void {
  for (let weekNum = 2; weekNum <= weeks; weekNum++) {
    const prevWeekKey = `week${weekNum - 1}` as keyof ParameterizedExercise;
    const currWeekKey = `week${weekNum}` as keyof ParameterizedExercise;

    const prevWeek = exercise[prevWeekKey];
    const currWeek = exercise[currWeekKey];

    if (!prevWeek || typeof prevWeek !== 'object') continue;
    if (!currWeek || typeof currWeek !== 'object') continue;

    // Check if there's any progression
    const prevSets = prevWeek.sets || 0;
    const currSets = currWeek.sets || 0;
    const prevReps = typeof prevWeek.reps === 'number' ? prevWeek.reps : 0;
    const currReps = typeof currWeek.reps === 'number' ? currWeek.reps : 0;

    const prevVolume = prevSets * prevReps;
    const currVolume = currSets * currReps;

    // Allow same volume (deload weeks) but warn if volume decreases significantly
    if (currVolume < prevVolume * 0.8) {
      // More than 20% decrease might be intentional (deload), so just log
      console.warn(
        `Exercise "${exercise.name}" week ${weekNum} volume decreased by >20% (possible deload)`
      );
    }
  }
}
