/**
 * Workout Validation Engine
 *
 * Shared validation logic for ParameterizedWorkout objects
 * Used by CLI interactive editor and future UI
 *
 * Validates:
 * - JSON structure matches ParameterizedWorkout schema
 * - Exercise names exist in exercise database
 * - Required fields are present
 */

import type { ParameterizedWorkout, ParameterizedDay, ParameterizedExercise } from './types.js';
import exerciseDatabase from '../../data/exercise_database.json' with { type: 'json' };

export interface ValidationError {
  type: 'error' | 'warning';
  location: string; // e.g., "day1.exercises[2]", "metadata.equipment"
  field?: string; // specific field name
  message: string;
  value?: any; // the problematic value
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * Get all exercise names from database (flattened)
 */
function getAllExerciseNames(): Set<string> {
  const names = new Set<string>();
  const categories = exerciseDatabase.exercise_database.categories as Record<string, { exercises: Record<string, any> }>;

  for (const categoryKey in categories) {
    const exercisesInCategory = categories[categoryKey].exercises;
    for (const exerciseName in exercisesInCategory) {
      names.add(exerciseName);
    }
  }

  return names;
}

/**
 * Validate a single exercise (standalone or compound)
 */
function validateExercise(
  exercise: ParameterizedExercise,
  exerciseNames: Set<string>,
  location: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Required field: name
  if (!exercise.name || exercise.name.trim() === '') {
    errors.push({
      type: 'error',
      location,
      field: 'name',
      message: 'Exercise name is required',
      value: exercise.name
    });
  } else {
    // Check if exercise exists in database (skip for compound exercise parents)
    const isCompoundParent = exercise.sub_exercises && exercise.sub_exercises.length > 0;
    if (!isCompoundParent && !exerciseNames.has(exercise.name)) {
      errors.push({
        type: 'error',
        location,
        field: 'name',
        message: `Exercise "${exercise.name}" not found in exercise database`,
        value: exercise.name
      });
    }
  }

  // If compound exercise, validate sub-exercises
  if (exercise.sub_exercises && exercise.sub_exercises.length > 0) {
    exercise.sub_exercises.forEach((subEx, index) => {
      const subLocation = `${location}.sub_exercises[${index}]`;
      errors.push(...validateExercise(subEx, exerciseNames, subLocation));
    });
  }

  return errors;
}

/**
 * Validate a single day
 */
function validateDay(
  day: ParameterizedDay,
  dayKey: string,
  exerciseNames: Set<string>
): ValidationError[] {
  const errors: ValidationError[] = [];
  const location = `days.${dayKey}`;

  // Required fields
  if (!day.dayNumber || day.dayNumber < 1) {
    errors.push({
      type: 'error',
      location,
      field: 'dayNumber',
      message: 'Day number must be >= 1',
      value: day.dayNumber
    });
  }

  if (!day.focus || day.focus.trim() === '') {
    errors.push({
      type: 'error',
      location,
      field: 'focus',
      message: 'Day focus is required (e.g., "Push", "Pull", "Legs")',
      value: day.focus
    });
  }

  if (!day.type || day.type.trim() === '') {
    errors.push({
      type: 'error',
      location,
      field: 'type',
      message: 'Day type is required (e.g., "gym", "home", "outdoor")',
      value: day.type
    });
  }

  // Exercises array must exist and not be empty
  if (!day.exercises || !Array.isArray(day.exercises)) {
    errors.push({
      type: 'error',
      location,
      field: 'exercises',
      message: 'Day must have exercises array',
      value: day.exercises
    });
  } else if (day.exercises.length === 0) {
    errors.push({
      type: 'warning',
      location,
      field: 'exercises',
      message: 'Day has no exercises',
      value: []
    });
  } else {
    // Validate each exercise
    day.exercises.forEach((exercise, index) => {
      const exerciseLocation = `${location}.exercises[${index}]`;
      errors.push(...validateExercise(exercise, exerciseNames, exerciseLocation));
    });
  }

  return errors;
}

/**
 * Main validation function - validates complete ParameterizedWorkout
 */
export function validateWorkout(workout: ParameterizedWorkout): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Get all valid exercise names from database
  const exerciseNames = getAllExerciseNames();

  // Validate top-level required fields
  if (!workout.name || workout.name.trim() === '') {
    errors.push({
      type: 'error',
      location: 'root',
      field: 'name',
      message: 'Workout program name is required',
      value: workout.name
    });
  }

  if (!workout.description || workout.description.trim() === '') {
    warnings.push({
      type: 'warning',
      location: 'root',
      field: 'description',
      message: 'Workout description is recommended',
      value: workout.description
    });
  }

  if (!workout.version || workout.version.trim() === '') {
    errors.push({
      type: 'error',
      location: 'root',
      field: 'version',
      message: 'Version is required',
      value: workout.version
    });
  }

  if (!workout.weeks || workout.weeks < 1) {
    errors.push({
      type: 'error',
      location: 'root',
      field: 'weeks',
      message: 'Weeks must be >= 1',
      value: workout.weeks
    });
  }

  if (!workout.daysPerWeek || workout.daysPerWeek < 1 || workout.daysPerWeek > 7) {
    errors.push({
      type: 'error',
      location: 'root',
      field: 'daysPerWeek',
      message: 'Days per week must be between 1 and 7',
      value: workout.daysPerWeek
    });
  }

  // Validate metadata
  if (!workout.metadata) {
    errors.push({
      type: 'error',
      location: 'root',
      field: 'metadata',
      message: 'Metadata object is required',
      value: workout.metadata
    });
  } else {
    if (!workout.metadata.difficulty) {
      errors.push({
        type: 'error',
        location: 'metadata',
        field: 'difficulty',
        message: 'Difficulty level is required',
        value: workout.metadata.difficulty
      });
    }

    if (!workout.metadata.equipment || !Array.isArray(workout.metadata.equipment) || workout.metadata.equipment.length === 0) {
      errors.push({
        type: 'error',
        location: 'metadata',
        field: 'equipment',
        message: 'Equipment array is required and must not be empty',
        value: workout.metadata.equipment
      });
    }

    if (!workout.metadata.estimatedDuration) {
      warnings.push({
        type: 'warning',
        location: 'metadata',
        field: 'estimatedDuration',
        message: 'Estimated duration is recommended',
        value: workout.metadata.estimatedDuration
      });
    }
  }

  // Validate days
  if (!workout.days || typeof workout.days !== 'object') {
    errors.push({
      type: 'error',
      location: 'root',
      field: 'days',
      message: 'Days object is required',
      value: workout.days
    });
  } else {
    const dayKeys = Object.keys(workout.days);

    if (dayKeys.length === 0) {
      errors.push({
        type: 'error',
        location: 'days',
        message: 'Workout must have at least one day',
        value: workout.days
      });
    }

    // Validate each day
    for (const dayKey of dayKeys) {
      const dayErrors = validateDay(workout.days[dayKey], dayKey, exerciseNames);
      errors.push(...dayErrors);
    }
  }

  // Separate errors from warnings
  const finalErrors = errors.filter(e => e.type === 'error');
  const finalWarnings = errors.filter(e => e.type === 'warning').concat(warnings);

  return {
    valid: finalErrors.length === 0,
    errors: finalErrors,
    warnings: finalWarnings
  };
}

/**
 * Format validation result for terminal display
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];

  if (result.valid) {
    lines.push('✓ Workout validation PASSED');
    if (result.warnings.length > 0) {
      lines.push(`  ${result.warnings.length} warning(s) found:`);
      result.warnings.forEach(w => {
        lines.push(`  - [${w.location}${w.field ? '.' + w.field : ''}] ${w.message}`);
      });
    }
  } else {
    lines.push(`✗ Workout validation FAILED - ${result.errors.length} error(s) found:`);
    result.errors.forEach(e => {
      lines.push(`  - [${e.location}${e.field ? '.' + e.field : ''}] ${e.message}`);
      if (e.value !== undefined) {
        lines.push(`    Value: ${JSON.stringify(e.value)}`);
      }
    });

    if (result.warnings.length > 0) {
      lines.push('');
      lines.push(`${result.warnings.length} warning(s) also found:`);
      result.warnings.forEach(w => {
        lines.push(`  - [${w.location}${w.field ? '.' + w.field : ''}] ${w.message}`);
      });
    }
  }

  return lines.join('\n');
}
