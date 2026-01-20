/**
 * Workout Time Estimate - Calculate estimated workout duration based on timers
 *
 * Calculates total time by adding all timer durations:
 * - Regular exercises: (work_time + rest_time) * sets
 * - EMOM/AMRAP: work_time (total block duration)
 * - Circuit/Interval: rounds * (sub-exercise times)
 */

import type { LiveExercise } from '$lib/engine/types';
import type { ParameterizedExercise, ParameterizedDay, WeekParameters } from '$lib/engine/types';
import timerConfig from '$lib/../data/timer_config.json';

const TEMPO_SECONDS_PER_REP = timerConfig.defaults.tempo_seconds_per_rep;
const DEFAULT_REST_SECONDS = timerConfig.defaults.default_rest_seconds;
const TRANSITION_TIME_PER_BLOCK_SECONDS = 90; // Time to set up equipment, move stations, etc.

/**
 * Calculate work duration for a single set (in seconds)
 */
function calculateWorkDurationSeconds(
  reps: number | undefined,
  workTimeSeconds: number | undefined,
  tempo?: string
): number {
  // If explicit work time is provided, use it
  if (workTimeSeconds && workTimeSeconds > 0) {
    return workTimeSeconds;
  }

  // Calculate from reps and tempo
  if (reps && reps > 0) {
    const tempoSeconds = tempo ? parseTempoToSeconds(tempo) : TEMPO_SECONDS_PER_REP;
    return reps * tempoSeconds;
  }

  // Default work time (30 seconds)
  return 30;
}

/**
 * Parse tempo string (e.g., "3-1-2") to total seconds per rep
 */
function parseTempoToSeconds(tempo: string): number {
  const parts = tempo.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    return TEMPO_SECONDS_PER_REP;
  }
  return parts.reduce((sum, val) => sum + val, 0);
}

/**
 * Calculate total workout time estimate from LiveExercise array (for Live View)
 *
 * @param exercises - Array of LiveExercise objects
 * @returns Total estimated time in seconds
 */
export function calculateWorkoutTimeFromLiveExercises(exercises: LiveExercise[]): number {
  let totalSeconds = 0;

  // Count exercise blocks for transition time
  const blockCount = exercises.filter(e => !e.isCompoundParent ||
    ['emom', 'amrap', 'circuit', 'interval'].includes(e.exerciseType)).length;

  // Add transition time between blocks (setup, equipment changes, etc.)
  totalSeconds += blockCount * TRANSITION_TIME_PER_BLOCK_SECONDS;

  for (const exercise of exercises) {
    const { prescription, exerciseType, isCompoundParent, subExercises } = exercise;

    if (isCompoundParent) {
      // EMOM/AMRAP: work_time is total block duration
      if (exerciseType === 'emom' || exerciseType === 'amrap') {
        totalSeconds += prescription.workTimeSeconds ?? 0;
      }
      // Circuit: rounds * (sum of sub-exercise work times + some transition time)
      else if (exerciseType === 'circuit') {
        const rounds = prescription.sets;
        let roundTime = 0;
        for (const subEx of subExercises) {
          roundTime += calculateWorkDurationSeconds(
            subEx.prescription.reps ?? undefined,
            subEx.prescription.workTimeSeconds ?? undefined,
            subEx.prescription.tempo ?? undefined
          );
        }
        // Add transition time between exercises (5 seconds per sub-exercise)
        roundTime += subExercises.length * 5;
        totalSeconds += rounds * roundTime;
      }
      // Interval: sets * (sum of work + rest for each sub-exercise)
      else if (exerciseType === 'interval') {
        const sets = prescription.sets;
        let intervalTime = 0;
        for (const subEx of subExercises) {
          intervalTime += (subEx.prescription.workTimeSeconds ?? 30);
          intervalTime += (subEx.prescription.restTimeSeconds ?? 30);
        }
        totalSeconds += sets * intervalTime;
      }
    } else {
      // Regular exercise: (work_time + rest_time) * sets
      const sets = prescription.sets;
      const workTime = calculateWorkDurationSeconds(
        prescription.reps ?? undefined,
        prescription.workTimeSeconds ?? undefined,
        prescription.tempo ?? undefined
      );
      const restTime = prescription.restTimeSeconds ?? DEFAULT_REST_SECONDS;

      // First set has no rest before, last set has no rest after
      // Formula: sets * work_time + (sets - 1) * rest_time
      totalSeconds += sets * workTime + (sets - 1) * restTime;
    }
  }

  return totalSeconds;
}

/**
 * Calculate total workout time estimate from ParameterizedDay (for Schedule View)
 *
 * @param day - ParameterizedDay object
 * @param weekNumber - Current week number
 * @returns Total estimated time in seconds
 */
export function calculateWorkoutTimeFromDay(day: ParameterizedDay, weekNumber: number): number {
  let totalSeconds = 0;

  // Add transition time between blocks (setup, equipment changes, etc.)
  // Each top-level exercise counts as a block
  totalSeconds += day.exercises.length * TRANSITION_TIME_PER_BLOCK_SECONDS;

  for (const exercise of day.exercises) {
    const weekKey = `week${weekNumber}` as keyof ParameterizedExercise;
    const weekParams = exercise[weekKey] as WeekParameters | undefined;

    if (!weekParams) continue;

    const isCompound = ['emom', 'amrap', 'circuit', 'interval'].includes(exercise.category ?? '');

    if (isCompound) {
      // EMOM/AMRAP: work_time is total block duration (stored in minutes, convert to seconds)
      if (exercise.category === 'emom' || exercise.category === 'amrap') {
        if (weekParams.work_time_minutes !== undefined) {
          // Value is always stored converted to minutes, so multiply by 60
          totalSeconds += weekParams.work_time_minutes * 60;
        }
      }
      // Circuit: rounds * (sum of sub-exercise work times)
      else if (exercise.category === 'circuit') {
        const rounds = weekParams.sets ?? 1;
        let roundTime = 0;

        if (exercise.sub_exercises) {
          for (const subEx of exercise.sub_exercises) {
            const subWeekParams = subEx[weekKey as keyof typeof subEx] as WeekParameters | undefined;
            if (subWeekParams) {
              if (subWeekParams.reps && typeof subWeekParams.reps === 'number') {
                roundTime += calculateWorkDurationSeconds(subWeekParams.reps, undefined, undefined);
              } else if (subWeekParams.work_time_minutes !== undefined) {
                roundTime += subWeekParams.work_time_minutes * 60;
              }
            }
          }
          // Transition time between exercises
          roundTime += exercise.sub_exercises.length * 5;
        }

        totalSeconds += rounds * roundTime;
      }
      // Interval: sets * (sum of work + rest for each sub-exercise)
      else if (exercise.category === 'interval') {
        const sets = weekParams.sets ?? 1;
        let intervalTime = 0;

        if (exercise.sub_exercises) {
          for (const subEx of exercise.sub_exercises) {
            const subWeekParams = subEx[weekKey as keyof typeof subEx] as WeekParameters | undefined;
            if (subWeekParams) {
              // Work time
              if (subWeekParams.work_time_minutes !== undefined) {
                intervalTime += subWeekParams.work_time_minutes * 60;
              } else {
                intervalTime += 30; // Default
              }
              // Rest time
              if (subWeekParams.rest_time_minutes !== undefined) {
                intervalTime += subWeekParams.rest_time_minutes * 60;
              } else {
                intervalTime += 30; // Default
              }
            }
          }
        }

        totalSeconds += sets * intervalTime;
      }
    } else {
      // Regular exercise: (work_time + rest_time) * sets
      const sets = weekParams.sets ?? 1;

      let workTime: number;
      if (weekParams.work_time_minutes !== undefined) {
        workTime = weekParams.work_time_minutes * 60;
      } else {
        const reps = typeof weekParams.reps === 'number' ? weekParams.reps : undefined;
        workTime = calculateWorkDurationSeconds(reps, undefined, undefined);
      }

      let restTime: number;
      if (weekParams.rest_time_minutes !== undefined) {
        restTime = weekParams.rest_time_minutes * 60;
      } else {
        restTime = DEFAULT_REST_SECONDS;
      }

      // First set has no rest before, last set has no rest after
      totalSeconds += sets * workTime + (sets - 1) * restTime;
    }
  }

  return totalSeconds;
}

/**
 * Format seconds as a human-readable time string
 * Examples: "45 min", "1 hr 15 min", "30 min"
 */
export function formatWorkoutTime(seconds: number): string {
  if (seconds <= 0) return '0 min';

  const totalMinutes = Math.round(seconds / 60);

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${minutes} min`;
}
