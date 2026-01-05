/**
 * Duration Estimation Utility
 *
 * Estimates workout duration based on exercise type, sets, reps, and rest periods
 * All time values are config-driven from workout_generation_rules.json
 */

import type {
  TimeEstimates,
  IntensityProfiles
} from './types.js';

/**
 * Estimates the duration of a single exercise in minutes
 *
 * @param exerciseCategory - Category of exercise (strength, bodyweight, emom, etc.)
 * @param intensityProfile - Intensity level (light, moderate, heavy, etc.)
 * @param intensityProfiles - Intensity profiles configuration
 * @param timeEstimates - Time estimates configuration
 * @returns Estimated duration in minutes
 */
export function estimateExerciseDuration(
  exerciseCategory: string,
  intensityProfile: string,
  intensityProfiles: IntensityProfiles,
  timeEstimates: TimeEstimates
): number {
  // Get the intensity configuration for this category and profile
  const categoryProfiles = intensityProfiles[exerciseCategory];
  if (!categoryProfiles) {
    throw new Error(`No intensity profiles found for category: ${exerciseCategory}`);
  }

  const profile = categoryProfiles[intensityProfile];
  if (!profile) {
    throw new Error(`No profile "${intensityProfile}" found for category: ${exerciseCategory}`);
  }

  // Get setup time
  const setupTime = timeEstimates.setup_time_minutes[exerciseCategory] || 0;

  // Calculate work time based on category
  let workTime = 0;

  if (profile.base_work_time_minutes !== undefined) {
    // For time-based exercises (emom, amrap, interval, mobility, flexibility, cardio)
    workTime = profile.base_work_time_minutes;
  } else if (profile.base_sets !== undefined && profile.base_reps !== undefined) {
    // For sets/reps-based exercises (strength, bodyweight)
    const sets = profile.base_sets;
    const reps = typeof profile.base_reps === 'number' ? profile.base_reps : 10; // Use 10 as default if string
    const secondsPerRep = timeEstimates.seconds_per_rep[`${exerciseCategory}_default_tempo`] ||
                           timeEstimates.seconds_per_rep[exerciseCategory] || 4;

    const workTimePerSet = (reps * secondsPerRep) / 60; // Convert to minutes
    const restTimeBetweenSets = profile.base_rest_time_minutes || 1;

    // Total work time = (work time per set * sets) + (rest time * (sets - 1))
    workTime = (workTimePerSet * sets) + (restTimeBetweenSets * (sets - 1));
  } else if (profile.base_sets !== undefined && profile.base_rest_between_circuits_minutes !== undefined) {
    // For circuits
    const sets = profile.base_sets;
    const exercisesPerCircuit = profile.base_exercises_per_circuit || 3;
    const restBetweenCircuits = profile.base_rest_between_circuits_minutes;

    // Rough estimate: ~1 minute per exercise in circuit + rest
    workTime = sets * (exercisesPerCircuit + restBetweenCircuits);
  }

  // Add transition time
  const transitionTime = timeEstimates.transition_time_minutes.between_exercises;

  return setupTime + workTime + transitionTime;
}

/**
 * Estimates total duration for a list of exercises
 *
 * @param exercises - Array of exercises with categories and intensity profiles
 * @param intensityProfiles - Intensity profiles configuration
 * @param timeEstimates - Time estimates configuration
 * @returns Total estimated duration in minutes
 */
export function estimateTotalDuration(
  exercises: Array<{ category: string; intensityProfile: string }>,
  intensityProfiles: IntensityProfiles,
  timeEstimates: TimeEstimates
): number {
  let total = 0;

  for (const exercise of exercises) {
    total += estimateExerciseDuration(
      exercise.category,
      exercise.intensityProfile,
      intensityProfiles,
      timeEstimates
    );
  }

  return total;
}
