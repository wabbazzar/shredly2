/**
 * Unit tests for schedule editor utilities
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  swapExercise,
  updateExerciseParams,
  updateSubExerciseParams,
  deleteExercise,
  addExercise,
  reorderExercise,
  deleteSubExercise
} from '../../../src/lib/utils/scheduleEditor.js';
import type { StoredSchedule } from '../../../src/lib/types/schedule.js';
import type { ParameterizedExercise } from '../../../src/lib/engine/types.js';

// Helper to create a minimal StoredSchedule for testing
function createTestSchedule(): StoredSchedule {
  return {
    id: 'test-schedule-1',
    name: 'Test Schedule',
    version: '2.0.0',
    weeks: 3,
    daysPerWeek: 3,
    metadata: {
      goal: 'build_muscle',
      experience: 'intermediate',
      equipment: ['dumbbells', 'barbell']
    },
    days: {
      '1': {
        dayNumber: 1,
        focus: 'Push',
        type: 'training',
        exercises: [
          {
            name: 'Bench Press',
            week1: { sets: 3, reps: 10, rest_time_minutes: 2, rest_time_unit: 'minutes' },
            week2: { sets: 3, reps: 8, rest_time_minutes: 2, rest_time_unit: 'minutes' },
            week3: { sets: 4, reps: 6, rest_time_minutes: 2.5, rest_time_unit: 'minutes' }
          } as ParameterizedExercise,
          {
            name: 'Shoulder Press',
            week1: { sets: 3, reps: 12, rest_time_minutes: 90, rest_time_unit: 'seconds' },
            week2: { sets: 3, reps: 10, rest_time_minutes: 90, rest_time_unit: 'seconds' },
            week3: { sets: 3, reps: 8, rest_time_minutes: 90, rest_time_unit: 'seconds' }
          } as ParameterizedExercise
        ]
      },
      '2': {
        dayNumber: 2,
        focus: 'Pull',
        type: 'training',
        exercises: [
          {
            name: 'Deadlift',
            week1: { sets: 3, reps: 8, rest_time_minutes: 3, rest_time_unit: 'minutes' },
            week2: { sets: 3, reps: 6, rest_time_minutes: 3, rest_time_unit: 'minutes' },
            week3: { sets: 4, reps: 5, rest_time_minutes: 3.5, rest_time_unit: 'minutes' }
          } as ParameterizedExercise
        ]
      }
    },
    scheduleMetadata: {
      isActive: true,
      startDate: '2026-01-13',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      currentWeek: 1,
      currentDay: 1
    }
  };
}

describe('scheduleEditor', () => {
  let schedule: StoredSchedule;

  beforeEach(() => {
    schedule = createTestSchedule();
  });

  describe('swapExercise', () => {
    it('should swap exercise for all weeks', () => {
      const newExercise: ParameterizedExercise = {
        name: 'Incline Bench Press',
        week1: { sets: 3, reps: 10 },
        week2: { sets: 3, reps: 8 },
        week3: { sets: 4, reps: 6 }
      } as ParameterizedExercise;

      const result = swapExercise(schedule, 1, 0, newExercise, 'all_weeks', 1);

      expect(result.days['1'].exercises[0].name).toBe('Incline Bench Press');
      expect(result.scheduleMetadata.updatedAt).not.toBe(schedule.scheduleMetadata.updatedAt);
    });

    it('should swap exercise for this week and remaining', () => {
      const newExercise: ParameterizedExercise = {
        name: 'Incline Bench Press',
        week1: { sets: 4, reps: 12 },
        week2: { sets: 4, reps: 10 },
        week3: { sets: 5, reps: 8 }
      } as ParameterizedExercise;

      const result = swapExercise(schedule, 1, 0, newExercise, 'this_week_and_remaining', 2);

      // Week 1 should keep old exercise params
      expect(result.days['1'].exercises[0].name).toBe('Incline Bench Press');
      expect((result.days['1'].exercises[0] as any).week1.sets).toBe(3); // Old value
      expect((result.days['1'].exercises[0] as any).week2.sets).toBe(4); // New value
      expect((result.days['1'].exercises[0] as any).week3.sets).toBe(5); // New value
    });

    it('should swap exercise for this instance only', () => {
      const newExercise: ParameterizedExercise = {
        name: 'Incline Bench Press',
        week1: { sets: 5, reps: 5 },
        week2: { sets: 5, reps: 5 },
        week3: { sets: 5, reps: 5 }
      } as ParameterizedExercise;

      const result = swapExercise(schedule, 1, 0, newExercise, 'this_instance_only', 2);

      // Only week 2 should be updated
      expect((result.days['1'].exercises[0] as any).week1.sets).toBe(3); // Old
      expect((result.days['1'].exercises[0] as any).week2.sets).toBe(5); // New
      expect((result.days['1'].exercises[0] as any).week3.sets).toBe(4); // Old
    });

    it('should throw error for invalid day', () => {
      const newExercise = { name: 'Test' } as ParameterizedExercise;
      expect(() => swapExercise(schedule, 99, 0, newExercise, 'all_weeks', 1))
        .toThrow('Invalid day or exercise index');
    });

    it('should throw error for invalid exercise index', () => {
      const newExercise = { name: 'Test' } as ParameterizedExercise;
      expect(() => swapExercise(schedule, 1, 99, newExercise, 'all_weeks', 1))
        .toThrow('Invalid day or exercise index');
    });
  });

  describe('updateExerciseParams', () => {
    it('should update sets for all weeks', () => {
      const result = updateExerciseParams(schedule, 1, 0, 'sets', 5, 'all_weeks', 1);

      expect((result.days['1'].exercises[0] as any).week1.sets).toBe(5);
      expect((result.days['1'].exercises[0] as any).week2.sets).toBe(5);
      expect((result.days['1'].exercises[0] as any).week3.sets).toBe(5);
    });

    it('should update reps for this week only', () => {
      const result = updateExerciseParams(schedule, 1, 0, 'reps', 15, 'this_instance_only', 2);

      expect((result.days['1'].exercises[0] as any).week1.reps).toBe(10); // Unchanged
      expect((result.days['1'].exercises[0] as any).week2.reps).toBe(15); // Updated
      expect((result.days['1'].exercises[0] as any).week3.reps).toBe(6); // Unchanged
    });

    it('should update this week and remaining', () => {
      const result = updateExerciseParams(schedule, 1, 0, 'sets', 6, 'this_week_and_remaining', 2);

      expect((result.days['1'].exercises[0] as any).week1.sets).toBe(3); // Unchanged
      expect((result.days['1'].exercises[0] as any).week2.sets).toBe(6); // Updated
      expect((result.days['1'].exercises[0] as any).week3.sets).toBe(6); // Updated
    });
  });

  describe('deleteExercise', () => {
    it('should remove exercise from day', () => {
      expect(schedule.days['1'].exercises.length).toBe(2);

      const result = deleteExercise(schedule, 1, 0);

      expect(result.days['1'].exercises.length).toBe(1);
      expect(result.days['1'].exercises[0].name).toBe('Shoulder Press');
    });

    it('should throw error for invalid exercise index', () => {
      expect(() => deleteExercise(schedule, 1, 99))
        .toThrow('Invalid day or exercise index');
    });
  });

  describe('addExercise', () => {
    it('should add exercise at end by default', () => {
      const newExercise: ParameterizedExercise = {
        name: 'Tricep Extension',
        week1: { sets: 3, reps: 12 }
      } as ParameterizedExercise;

      const result = addExercise(schedule, 1, newExercise);

      expect(result.days['1'].exercises.length).toBe(3);
      expect(result.days['1'].exercises[2].name).toBe('Tricep Extension');
    });

    it('should add exercise at specific index', () => {
      const newExercise: ParameterizedExercise = {
        name: 'Tricep Extension',
        week1: { sets: 3, reps: 12 }
      } as ParameterizedExercise;

      const result = addExercise(schedule, 1, newExercise, 1);

      expect(result.days['1'].exercises.length).toBe(3);
      expect(result.days['1'].exercises[1].name).toBe('Tricep Extension');
      expect(result.days['1'].exercises[2].name).toBe('Shoulder Press');
    });

    it('should throw error for invalid day', () => {
      const newExercise = { name: 'Test' } as ParameterizedExercise;
      expect(() => addExercise(schedule, 99, newExercise))
        .toThrow('Invalid day number');
    });
  });

  describe('reorderExercise', () => {
    it('should move exercise from first to second position', () => {
      const result = reorderExercise(schedule, 1, 0, 1);

      expect(result.days['1'].exercises[0].name).toBe('Shoulder Press');
      expect(result.days['1'].exercises[1].name).toBe('Bench Press');
    });

    it('should move exercise from second to first position', () => {
      const result = reorderExercise(schedule, 1, 1, 0);

      expect(result.days['1'].exercises[0].name).toBe('Shoulder Press');
      expect(result.days['1'].exercises[1].name).toBe('Bench Press');
    });

    it('should throw error for invalid indices', () => {
      expect(() => reorderExercise(schedule, 1, 0, 99))
        .toThrow('Invalid indices');
    });
  });

  describe('immutability', () => {
    it('should not mutate original schedule on swap', () => {
      const originalName = schedule.days['1'].exercises[0].name;
      const newExercise = { name: 'New Exercise' } as ParameterizedExercise;

      swapExercise(schedule, 1, 0, newExercise, 'all_weeks', 1);

      expect(schedule.days['1'].exercises[0].name).toBe(originalName);
    });

    it('should not mutate original schedule on delete', () => {
      const originalLength = schedule.days['1'].exercises.length;

      deleteExercise(schedule, 1, 0);

      expect(schedule.days['1'].exercises.length).toBe(originalLength);
    });

    it('should not mutate original schedule on add', () => {
      const originalLength = schedule.days['1'].exercises.length;
      const newExercise = { name: 'New Exercise' } as ParameterizedExercise;

      addExercise(schedule, 1, newExercise);

      expect(schedule.days['1'].exercises.length).toBe(originalLength);
    });
  });
});
