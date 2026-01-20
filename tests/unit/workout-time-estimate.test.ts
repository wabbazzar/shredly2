/**
 * Tests for Workout Time Estimate Utility
 *
 * Validates:
 * - Time calculation for regular exercises
 * - Time calculation for compound blocks (EMOM, AMRAP, Circuit, Interval)
 * - Time formatting
 */

import { describe, it, expect } from 'vitest';
import {
  calculateWorkoutTimeFromLiveExercises,
  calculateWorkoutTimeFromDay,
  formatWorkoutTime
} from '$lib/utils/workoutTimeEstimate';
import type { LiveExercise, TimerExerciseType } from '$lib/engine/types';
import type { ParameterizedDay, ParameterizedExercise } from '$lib/engine/types';

// Helper to create LiveExercise
function createLiveExercise(overrides: Partial<LiveExercise> = {}): LiveExercise {
  return {
    exerciseName: 'Test Exercise',
    exerciseType: 'strength' as TimerExerciseType,
    isCompoundParent: false,
    subExercises: [],
    prescription: {
      sets: 3,
      reps: 10,
      weight: null,
      weightUnit: null,
      workTimeSeconds: null,
      restTimeSeconds: 90,
      tempo: null,
      weightPrescription: null,
      previousWeek: null
    },
    completed: false,
    completedSets: 0,
    skipped: false,
    ...overrides
  };
}

describe('formatWorkoutTime', () => {
  it('should format 0 seconds as "0 min"', () => {
    expect(formatWorkoutTime(0)).toBe('0 min');
  });

  it('should format less than 60 minutes without hours', () => {
    expect(formatWorkoutTime(30 * 60)).toBe('30 min');
    expect(formatWorkoutTime(45 * 60)).toBe('45 min');
  });

  it('should format exactly 60 minutes as "1 hr"', () => {
    expect(formatWorkoutTime(60 * 60)).toBe('1 hr');
  });

  it('should format hours and minutes', () => {
    expect(formatWorkoutTime(75 * 60)).toBe('1 hr 15 min');
    expect(formatWorkoutTime(90 * 60)).toBe('1 hr 30 min');
    expect(formatWorkoutTime(120 * 60)).toBe('2 hr');
  });

  it('should round to nearest minute', () => {
    expect(formatWorkoutTime(30)).toBe('1 min');
    expect(formatWorkoutTime(89)).toBe('1 min');
    expect(formatWorkoutTime(91)).toBe('2 min');
  });
});

describe('calculateWorkoutTimeFromLiveExercises', () => {
  describe('regular exercises', () => {
    it('should calculate time for a single exercise with reps', () => {
      const exercise = createLiveExercise({
        prescription: {
          sets: 3,
          reps: 10,
          weight: null,
          weightUnit: null,
          workTimeSeconds: null,
          restTimeSeconds: 90, // 1.5 minutes
          tempo: null,
          weightPrescription: null,
          previousWeek: null
        }
      });

      // 3 sets of 10 reps @ 4 sec/rep = 3 * 40 = 120 seconds work
      // 2 rest periods (between sets) of 90 sec = 180 seconds rest
      // Total = 120 + 180 = 300 seconds = 5 minutes
      const time = calculateWorkoutTimeFromLiveExercises([exercise]);
      expect(time).toBe(300);
    });

    it('should calculate time using explicit work time', () => {
      const exercise = createLiveExercise({
        prescription: {
          sets: 4,
          reps: null,
          weight: null,
          weightUnit: null,
          workTimeSeconds: 30, // 30 seconds work per set
          restTimeSeconds: 60,
          tempo: null,
          weightPrescription: null,
          previousWeek: null
        }
      });

      // 4 sets of 30 sec work = 120 seconds
      // 3 rest periods of 60 sec = 180 seconds
      // Total = 120 + 180 = 300 seconds
      const time = calculateWorkoutTimeFromLiveExercises([exercise]);
      expect(time).toBe(300);
    });

    it('should calculate time for multiple exercises', () => {
      const exercise1 = createLiveExercise({
        prescription: {
          sets: 3,
          reps: 10,
          weight: null,
          weightUnit: null,
          workTimeSeconds: null,
          restTimeSeconds: 60,
          tempo: null,
          weightPrescription: null,
          previousWeek: null
        }
      });

      const exercise2 = createLiveExercise({
        prescription: {
          sets: 3,
          reps: 8,
          weight: null,
          weightUnit: null,
          workTimeSeconds: null,
          restTimeSeconds: 90,
          tempo: null,
          weightPrescription: null,
          previousWeek: null
        }
      });

      // Exercise 1: 3 * 40 + 2 * 60 = 120 + 120 = 240
      // Exercise 2: 3 * 32 + 2 * 90 = 96 + 180 = 276
      // Total = 516 seconds
      const time = calculateWorkoutTimeFromLiveExercises([exercise1, exercise2]);
      expect(time).toBe(516);
    });
  });

  describe('EMOM blocks', () => {
    it('should use total block duration for EMOM', () => {
      const emom = createLiveExercise({
        exerciseType: 'emom',
        isCompoundParent: true,
        prescription: {
          sets: 1,
          reps: null,
          weight: null,
          weightUnit: null,
          workTimeSeconds: 600, // 10 minutes
          restTimeSeconds: null,
          tempo: null,
          weightPrescription: null,
          previousWeek: null
        },
        subExercises: [
          createLiveExercise({ exerciseName: 'Push-ups' }),
          createLiveExercise({ exerciseName: 'Squats' })
        ]
      });

      const time = calculateWorkoutTimeFromLiveExercises([emom]);
      expect(time).toBe(600);
    });
  });

  describe('AMRAP blocks', () => {
    it('should use total block duration for AMRAP', () => {
      const amrap = createLiveExercise({
        exerciseType: 'amrap',
        isCompoundParent: true,
        prescription: {
          sets: 1,
          reps: null,
          weight: null,
          weightUnit: null,
          workTimeSeconds: 900, // 15 minutes
          restTimeSeconds: null,
          tempo: null,
          weightPrescription: null,
          previousWeek: null
        },
        subExercises: [
          createLiveExercise({ exerciseName: 'Burpees' }),
          createLiveExercise({ exerciseName: 'Lunges' })
        ]
      });

      const time = calculateWorkoutTimeFromLiveExercises([amrap]);
      expect(time).toBe(900);
    });
  });

  describe('Circuit blocks', () => {
    it('should calculate time based on rounds and sub-exercise times', () => {
      const circuit = createLiveExercise({
        exerciseType: 'circuit',
        isCompoundParent: true,
        prescription: {
          sets: 3, // 3 rounds
          reps: null,
          weight: null,
          weightUnit: null,
          workTimeSeconds: null,
          restTimeSeconds: null,
          tempo: null,
          weightPrescription: null,
          previousWeek: null
        },
        subExercises: [
          createLiveExercise({
            exerciseName: 'Push-ups',
            prescription: {
              sets: 1,
              reps: 10, // 10 reps @ 4 sec = 40 sec
              weight: null,
              weightUnit: null,
              workTimeSeconds: null,
              restTimeSeconds: null,
              tempo: null,
              weightPrescription: null,
              previousWeek: null
            }
          }),
          createLiveExercise({
            exerciseName: 'Squats',
            prescription: {
              sets: 1,
              reps: 15, // 15 reps @ 4 sec = 60 sec
              weight: null,
              weightUnit: null,
              workTimeSeconds: null,
              restTimeSeconds: null,
              tempo: null,
              weightPrescription: null,
              previousWeek: null
            }
          })
        ]
      });

      // Round time: 40 + 60 + (2 exercises * 5 sec transition) = 110 sec
      // 3 rounds * 110 = 330 seconds
      const time = calculateWorkoutTimeFromLiveExercises([circuit]);
      expect(time).toBe(330);
    });
  });

  describe('Interval blocks', () => {
    it('should calculate time based on sets and sub-exercise work/rest', () => {
      const interval = createLiveExercise({
        exerciseType: 'interval',
        isCompoundParent: true,
        prescription: {
          sets: 4, // 4 sets
          reps: null,
          weight: null,
          weightUnit: null,
          workTimeSeconds: null,
          restTimeSeconds: null,
          tempo: null,
          weightPrescription: null,
          previousWeek: null
        },
        subExercises: [
          createLiveExercise({
            exerciseName: 'Sprints',
            prescription: {
              sets: 1,
              reps: null,
              weight: null,
              weightUnit: null,
              workTimeSeconds: 30,
              restTimeSeconds: 30,
              tempo: null,
              weightPrescription: null,
              previousWeek: null
            }
          })
        ]
      });

      // 1 sub-exercise: 30 work + 30 rest = 60 sec per interval
      // 4 sets * 60 = 240 seconds
      const time = calculateWorkoutTimeFromLiveExercises([interval]);
      expect(time).toBe(240);
    });
  });

  describe('empty exercises', () => {
    it('should return 0 for empty exercise array', () => {
      expect(calculateWorkoutTimeFromLiveExercises([])).toBe(0);
    });
  });
});

describe('calculateWorkoutTimeFromDay', () => {
  it('should calculate time from ParameterizedDay', () => {
    const day: ParameterizedDay = {
      dayNumber: 1,
      focus: 'Upper Body',
      type: 'strength',
      exercises: [
        {
          name: 'Bench Press',
          week1: { sets: 3, reps: 10, rest_time_minutes: 1.5, rest_time_unit: 'minutes' },
          week2: { sets: 3, reps: 10, rest_time_minutes: 1.5, rest_time_unit: 'minutes' }
        } as ParameterizedExercise
      ]
    };

    // 3 sets of 10 reps @ 4 sec/rep = 120 sec work
    // 2 rest periods of 90 sec = 180 sec rest
    // Total = 300 seconds
    const time = calculateWorkoutTimeFromDay(day, 1);
    expect(time).toBe(300);
  });

  it('should handle EMOM blocks in ParameterizedDay', () => {
    const day: ParameterizedDay = {
      dayNumber: 1,
      focus: 'Conditioning',
      type: 'conditioning',
      exercises: [
        {
          name: 'EMOM Block',
          category: 'emom',
          week1: { work_time_minutes: 10, work_time_unit: 'minutes' },
          sub_exercises: [
            { name: 'Push-ups', week1: { reps: 10 } },
            { name: 'Squats', week1: { reps: 15 } }
          ]
        } as unknown as ParameterizedExercise
      ]
    };

    // EMOM: 10 minutes = 600 seconds
    const time = calculateWorkoutTimeFromDay(day, 1);
    expect(time).toBe(600);
  });
});
