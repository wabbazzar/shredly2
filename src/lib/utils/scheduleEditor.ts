/**
 * Schedule Editor Utilities
 *
 * Functions for editing exercises within a StoredSchedule.
 * Ported from cli/lib/interactive-workout-editor.ts
 *
 * All functions return a NEW schedule (immutable updates).
 */

import type { StoredSchedule, EditScope } from '$lib/types/schedule';
import type {
  ParameterizedExercise,
  ParameterizedSubExercise,
  WeekParameters
} from '$lib/engine/types';

/**
 * Get the weeks to update based on edit scope
 */
function getWeeksToUpdate(scope: EditScope, currentWeek: number, totalWeeks: number): number[] {
  if (scope === 'all_weeks') {
    return Array.from({ length: totalWeeks }, (_, i) => i + 1);
  } else if (scope === 'this_week_and_remaining') {
    return Array.from({ length: totalWeeks - currentWeek + 1 }, (_, i) => currentWeek + i);
  } else {
    return [currentWeek];
  }
}

/**
 * Get valid week keys from an exercise (week1, week2, etc.)
 */
function getExerciseWeekKeys(exercise: ParameterizedExercise | ParameterizedSubExercise): string[] {
  return Object.keys(exercise).filter((key) => key.startsWith('week') && !isNaN(parseInt(key.replace('week', ''))));
}

/**
 * Swap an exercise with a new one.
 * The new exercise should have all week parameters pre-populated.
 *
 * @param schedule - Current schedule
 * @param dayNumber - Day number (1-based)
 * @param exerciseIndex - Index of exercise in day's exercise array
 * @param newExercise - New exercise with all week parameters
 * @param scope - Edit scope
 * @param currentWeek - Current week number for scope calculation
 * @returns New schedule with swapped exercise
 */
export function swapExercise(
  schedule: StoredSchedule,
  dayNumber: number,
  exerciseIndex: number,
  newExercise: ParameterizedExercise,
  scope: EditScope,
  currentWeek: number
): StoredSchedule {
  const updated = structuredClone(schedule);
  const day = updated.days[dayNumber.toString()];

  if (!day || exerciseIndex < 0 || exerciseIndex >= day.exercises.length) {
    throw new Error(`Invalid day or exercise index: day ${dayNumber}, index ${exerciseIndex}`);
  }

  if (scope === 'all_weeks') {
    // Replace exercise entirely
    day.exercises[exerciseIndex] = newExercise;
  } else if (scope === 'this_week_and_remaining') {
    // Keep weeks before currentWeek from old exercise, use new for current and later
    const existing = day.exercises[exerciseIndex];
    const merged: ParameterizedExercise = {
      ...newExercise
    };

    // Copy over week parameters from existing for weeks before currentWeek
    for (let w = 1; w < currentWeek; w++) {
      const weekKey = `week${w}` as keyof ParameterizedExercise;
      const existingWeek = existing[weekKey];
      if (existingWeek && typeof existingWeek === 'object' && !Array.isArray(existingWeek)) {
        (merged as unknown as Record<string, unknown>)[weekKey] = existingWeek;
      }
    }

    day.exercises[exerciseIndex] = merged;
  } else {
    // this_instance_only - only update the specific week's parameters
    const existing = day.exercises[exerciseIndex];
    const weekKey = `week${currentWeek}` as keyof ParameterizedExercise;
    const newWeekParams = newExercise[weekKey];

    if (newWeekParams && typeof newWeekParams === 'object' && !Array.isArray(newWeekParams)) {
      (existing as unknown as Record<string, unknown>)[weekKey] = newWeekParams;
    }
  }

  updated.scheduleMetadata.updatedAt = new Date().toISOString();
  return updated;
}

/**
 * Update a specific parameter for an exercise.
 *
 * @param schedule - Current schedule
 * @param dayNumber - Day number (1-based)
 * @param exerciseIndex - Index of exercise in day's exercise array
 * @param field - Field name to update (e.g., 'sets', 'reps', 'weight')
 * @param value - New value
 * @param scope - Edit scope
 * @param currentWeek - Current week number for scope calculation
 * @returns New schedule with updated parameter
 */
export function updateExerciseParams(
  schedule: StoredSchedule,
  dayNumber: number,
  exerciseIndex: number,
  field: keyof WeekParameters,
  value: unknown,
  scope: EditScope,
  currentWeek: number
): StoredSchedule {
  const updated = structuredClone(schedule);
  const day = updated.days[dayNumber.toString()];

  if (!day || exerciseIndex < 0 || exerciseIndex >= day.exercises.length) {
    throw new Error(`Invalid day or exercise index: day ${dayNumber}, index ${exerciseIndex}`);
  }

  const exercise = day.exercises[exerciseIndex];
  const weeksToUpdate = getWeeksToUpdate(scope, currentWeek, schedule.weeks);

  for (const week of weeksToUpdate) {
    const weekKey = `week${week}` as keyof ParameterizedExercise;
    const params = exercise[weekKey] as WeekParameters | undefined;
    if (params) {
      (params as Record<string, unknown>)[field] = value;
    }
  }

  updated.scheduleMetadata.updatedAt = new Date().toISOString();
  return updated;
}

/**
 * Update a sub-exercise parameter.
 *
 * @param schedule - Current schedule
 * @param dayNumber - Day number (1-based)
 * @param exerciseIndex - Index of parent exercise
 * @param subExerciseIndex - Index of sub-exercise
 * @param field - Field name to update
 * @param value - New value
 * @param scope - Edit scope
 * @param currentWeek - Current week number
 * @returns New schedule with updated parameter
 */
export function updateSubExerciseParams(
  schedule: StoredSchedule,
  dayNumber: number,
  exerciseIndex: number,
  subExerciseIndex: number,
  field: keyof WeekParameters,
  value: unknown,
  scope: EditScope,
  currentWeek: number
): StoredSchedule {
  const updated = structuredClone(schedule);
  const day = updated.days[dayNumber.toString()];

  if (!day || exerciseIndex < 0 || exerciseIndex >= day.exercises.length) {
    throw new Error(`Invalid day or exercise index: day ${dayNumber}, index ${exerciseIndex}`);
  }

  const exercise = day.exercises[exerciseIndex];
  if (!exercise.sub_exercises || subExerciseIndex < 0 || subExerciseIndex >= exercise.sub_exercises.length) {
    throw new Error(`Invalid sub-exercise index: ${subExerciseIndex}`);
  }

  const subExercise = exercise.sub_exercises[subExerciseIndex];
  const weeksToUpdate = getWeeksToUpdate(scope, currentWeek, schedule.weeks);

  for (const week of weeksToUpdate) {
    const weekKey = `week${week}` as keyof ParameterizedSubExercise;
    const params = subExercise[weekKey] as WeekParameters | undefined;
    if (params) {
      (params as Record<string, unknown>)[field] = value;
    }
  }

  updated.scheduleMetadata.updatedAt = new Date().toISOString();
  return updated;
}

/**
 * Delete an exercise from a day.
 *
 * @param schedule - Current schedule
 * @param dayNumber - Day number (1-based)
 * @param exerciseIndex - Index of exercise to delete
 * @returns New schedule with exercise removed
 */
export function deleteExercise(
  schedule: StoredSchedule,
  dayNumber: number,
  exerciseIndex: number
): StoredSchedule {
  const updated = structuredClone(schedule);
  const day = updated.days[dayNumber.toString()];

  if (!day || exerciseIndex < 0 || exerciseIndex >= day.exercises.length) {
    throw new Error(`Invalid day or exercise index: day ${dayNumber}, index ${exerciseIndex}`);
  }

  day.exercises.splice(exerciseIndex, 1);
  updated.scheduleMetadata.updatedAt = new Date().toISOString();
  return updated;
}

/**
 * Add an exercise to a day.
 *
 * @param schedule - Current schedule
 * @param dayNumber - Day number (1-based)
 * @param exercise - Exercise to add
 * @param insertAt - Index to insert at (default: end)
 * @returns New schedule with exercise added
 */
export function addExercise(
  schedule: StoredSchedule,
  dayNumber: number,
  exercise: ParameterizedExercise,
  insertAt?: number
): StoredSchedule {
  const updated = structuredClone(schedule);
  const day = updated.days[dayNumber.toString()];

  if (!day) {
    throw new Error(`Invalid day number: ${dayNumber}`);
  }

  if (insertAt !== undefined && insertAt >= 0 && insertAt <= day.exercises.length) {
    day.exercises.splice(insertAt, 0, exercise);
  } else {
    day.exercises.push(exercise);
  }

  updated.scheduleMetadata.updatedAt = new Date().toISOString();
  return updated;
}

/**
 * Reorder exercises within a day.
 *
 * @param schedule - Current schedule
 * @param dayNumber - Day number (1-based)
 * @param fromIndex - Current index of exercise
 * @param toIndex - New index for exercise
 * @returns New schedule with reordered exercises
 */
export function reorderExercise(
  schedule: StoredSchedule,
  dayNumber: number,
  fromIndex: number,
  toIndex: number
): StoredSchedule {
  const updated = structuredClone(schedule);
  const day = updated.days[dayNumber.toString()];

  if (!day) {
    throw new Error(`Invalid day number: ${dayNumber}`);
  }

  if (fromIndex < 0 || fromIndex >= day.exercises.length || toIndex < 0 || toIndex >= day.exercises.length) {
    throw new Error(`Invalid indices: from ${fromIndex}, to ${toIndex}`);
  }

  const [exercise] = day.exercises.splice(fromIndex, 1);
  day.exercises.splice(toIndex, 0, exercise);

  updated.scheduleMetadata.updatedAt = new Date().toISOString();
  return updated;
}

/**
 * Delete a sub-exercise from a compound block.
 *
 * @param schedule - Current schedule
 * @param dayNumber - Day number (1-based)
 * @param exerciseIndex - Index of parent exercise
 * @param subExerciseIndex - Index of sub-exercise to delete
 * @returns New schedule with sub-exercise removed
 */
export function deleteSubExercise(
  schedule: StoredSchedule,
  dayNumber: number,
  exerciseIndex: number,
  subExerciseIndex: number
): StoredSchedule {
  const updated = structuredClone(schedule);
  const day = updated.days[dayNumber.toString()];

  if (!day || exerciseIndex < 0 || exerciseIndex >= day.exercises.length) {
    throw new Error(`Invalid day or exercise index: day ${dayNumber}, index ${exerciseIndex}`);
  }

  const exercise = day.exercises[exerciseIndex];
  if (!exercise.sub_exercises || subExerciseIndex < 0 || subExerciseIndex >= exercise.sub_exercises.length) {
    throw new Error(`Invalid sub-exercise index: ${subExerciseIndex}`);
  }

  exercise.sub_exercises.splice(subExerciseIndex, 1);
  updated.scheduleMetadata.updatedAt = new Date().toISOString();
  return updated;
}
