/**
 * Unit tests for schedule export/import round-trip functionality
 *
 * Tests that schedules can be:
 * 1. Exported as JSON (download feature)
 * 2. Re-imported via the Load Template modal
 * 3. Round-trip preserves all workout data
 */
import { describe, it, expect } from 'vitest';
import type { StoredSchedule } from '../../../src/lib/types/schedule.js';
import type { ParameterizedExercise, ParameterizedWorkout } from '../../../src/lib/engine/types.js';

/**
 * Simulates the download function from ScheduleLibrary.svelte
 */
function exportScheduleToJson(schedule: StoredSchedule): string {
  return JSON.stringify(schedule, null, 2);
}

/**
 * Simulates the import validation from LoadTemplateModal.svelte
 * Returns the parsed workout or throws an error
 */
function validateImportedJson(jsonString: string): ParameterizedWorkout {
  const workout = JSON.parse(jsonString) as ParameterizedWorkout;

  // Validation from LoadTemplateModal.svelte line 105-107
  if (!workout.id || !workout.name || !workout.days) {
    throw new Error('Invalid workout file format');
  }

  return workout;
}

/**
 * Simulates creating a StoredSchedule from imported workout
 * (from LoadTemplateModal.svelte lines 119-133)
 */
function createStoredScheduleFromImport(
  workout: ParameterizedWorkout,
  startDate: string
): StoredSchedule {
  return {
    ...workout,
    // Generate new ID to avoid conflicts (same logic as LoadTemplateModal)
    id: `schedule_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    scheduleMetadata: {
      isActive: true,
      startDate: startDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      currentWeek: 1,
      currentDay: 1,
      dayMapping: createDefaultDayMapping(workout.daysPerWeek)
    }
  };
}

/**
 * Creates default day mapping (same as LoadTemplateModal)
 */
function createDefaultDayMapping(daysPerWeek: number): Record<string, number> {
  const mapping: Record<string, number> = {};
  for (let i = 1; i <= daysPerWeek; i++) {
    mapping[i.toString()] = (i - 1) % 7;
  }
  return mapping;
}

/**
 * Creates a comprehensive test schedule with various exercise types
 */
function createTestSchedule(): StoredSchedule {
  return {
    id: 'original-schedule-id',
    name: 'My Custom Workout Plan',
    version: '2.0.0',
    weeks: 4,
    daysPerWeek: 3,
    metadata: {
      goal: 'build_muscle',
      experience: 'intermediate',
      equipment: ['dumbbells', 'barbell', 'cables']
    },
    days: {
      '1': {
        dayNumber: 1,
        focus: 'Push',
        type: 'training',
        exercises: [
          {
            name: 'Bench Press',
            category: 'strength',
            week1: { sets: 3, reps: 10, rest_time_minutes: 2, weight: { type: 'percent_tm', value: 70 } },
            week2: { sets: 3, reps: 8, rest_time_minutes: 2, weight: { type: 'percent_tm', value: 75 } },
            week3: { sets: 4, reps: 6, rest_time_minutes: 2.5, weight: { type: 'percent_tm', value: 80 } },
            week4: { sets: 4, reps: 5, rest_time_minutes: 3, weight: { type: 'percent_tm', value: 85 } }
          } as ParameterizedExercise,
          {
            name: 'Shoulder Press',
            category: 'strength',
            week1: { sets: 3, reps: 12, rest_time_seconds: 90 },
            week2: { sets: 3, reps: 10, rest_time_seconds: 90 },
            week3: { sets: 3, reps: 8, rest_time_seconds: 90 },
            week4: { sets: 4, reps: 8, rest_time_seconds: 90 }
          } as ParameterizedExercise,
          {
            name: 'Tricep Pushdown',
            category: 'isolation',
            week1: { sets: 3, reps: 15, rest_time_seconds: 60 },
            week2: { sets: 3, reps: 12, rest_time_seconds: 60 },
            week3: { sets: 3, reps: 12, rest_time_seconds: 60 },
            week4: { sets: 4, reps: 10, rest_time_seconds: 60 }
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
            category: 'strength',
            week1: { sets: 3, reps: 8, rest_time_minutes: 3, weight: { type: 'percent_tm', value: 70 } },
            week2: { sets: 3, reps: 6, rest_time_minutes: 3, weight: { type: 'percent_tm', value: 75 } },
            week3: { sets: 4, reps: 5, rest_time_minutes: 3.5, weight: { type: 'percent_tm', value: 80 } },
            week4: { sets: 4, reps: 4, rest_time_minutes: 4, weight: { type: 'percent_tm', value: 85 } }
          } as ParameterizedExercise,
          {
            name: 'Pull-ups',
            category: 'bodyweight',
            week1: { sets: 3, reps: 8, rest_time_seconds: 90 },
            week2: { sets: 3, reps: 10, rest_time_seconds: 90 },
            week3: { sets: 4, reps: 10, rest_time_seconds: 90 },
            week4: { sets: 4, reps: 12, rest_time_seconds: 90 }
          } as ParameterizedExercise
        ]
      },
      '3': {
        dayNumber: 3,
        focus: 'Legs',
        type: 'training',
        exercises: [
          {
            name: 'Back Squat',
            category: 'strength',
            week1: { sets: 4, reps: 8, rest_time_minutes: 3, weight: { type: 'percent_tm', value: 70 } },
            week2: { sets: 4, reps: 6, rest_time_minutes: 3, weight: { type: 'percent_tm', value: 75 } },
            week3: { sets: 5, reps: 5, rest_time_minutes: 3.5, weight: { type: 'percent_tm', value: 80 } },
            week4: { sets: 5, reps: 4, rest_time_minutes: 4, weight: { type: 'percent_tm', value: 85 } }
          } as ParameterizedExercise
        ]
      }
    },
    scheduleMetadata: {
      isActive: true,
      startDate: '2026-01-13',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-10T12:00:00.000Z',
      currentWeek: 2,
      currentDay: 1,
      dayMapping: { '1': 0, '2': 2, '3': 4 } // Mon, Wed, Fri
    }
  };
}

/**
 * Creates a schedule with compound exercises (EMOM, AMRAP, Circuit)
 */
function createScheduleWithCompoundExercises(): StoredSchedule {
  return {
    id: 'compound-schedule-id',
    name: 'HIIT Compound Workout',
    version: '2.0.0',
    weeks: 3,
    daysPerWeek: 2,
    metadata: {
      goal: 'fat_loss',
      experience: 'advanced',
      equipment: ['kettlebell', 'bodyweight']
    },
    days: {
      '1': {
        dayNumber: 1,
        focus: 'HIIT',
        type: 'training',
        exercises: [
          {
            name: 'EMOM Block',
            category: 'emom',
            week1: { sets: 1, work_time_minutes: 10, rest_time_seconds: 0 },
            week2: { sets: 1, work_time_minutes: 12, rest_time_seconds: 0 },
            week3: { sets: 1, work_time_minutes: 15, rest_time_seconds: 0 },
            subExercises: [
              { name: 'Kettlebell Swings', reps: 15 },
              { name: 'Burpees', reps: 10 },
              { name: 'Mountain Climbers', reps: 20 }
            ]
          } as ParameterizedExercise,
          {
            name: 'AMRAP Finisher',
            category: 'amrap',
            week1: { sets: 1, work_time_minutes: 8 },
            week2: { sets: 1, work_time_minutes: 10 },
            week3: { sets: 1, work_time_minutes: 12 },
            subExercises: [
              { name: 'Box Jumps', reps: 10 },
              { name: 'Push-ups', reps: 15 }
            ]
          } as ParameterizedExercise
        ]
      },
      '2': {
        dayNumber: 2,
        focus: 'Circuit',
        type: 'training',
        exercises: [
          {
            name: 'Full Body Circuit',
            category: 'circuit',
            week1: { sets: 3, rest_time_seconds: 60 },
            week2: { sets: 4, rest_time_seconds: 45 },
            week3: { sets: 5, rest_time_seconds: 30 },
            subExercises: [
              { name: 'Goblet Squat', reps: 12 },
              { name: 'Renegade Row', reps: 8 },
              { name: 'Thrusters', reps: 10 }
            ]
          } as ParameterizedExercise
        ]
      }
    },
    scheduleMetadata: {
      isActive: false,
      startDate: '2026-02-01',
      createdAt: '2026-01-15T00:00:00.000Z',
      updatedAt: '2026-01-15T00:00:00.000Z',
      currentWeek: 1,
      currentDay: 1
    }
  };
}

describe('Schedule Export/Import Round-Trip', () => {
  describe('exportScheduleToJson', () => {
    it('should export schedule as valid JSON string', () => {
      const schedule = createTestSchedule();
      const json = exportScheduleToJson(schedule);

      expect(json).toBeTruthy();
      expect(typeof json).toBe('string');
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('should preserve all schedule properties in export', () => {
      const schedule = createTestSchedule();
      const json = exportScheduleToJson(schedule);
      const parsed = JSON.parse(json);

      expect(parsed.id).toBe(schedule.id);
      expect(parsed.name).toBe(schedule.name);
      expect(parsed.weeks).toBe(schedule.weeks);
      expect(parsed.daysPerWeek).toBe(schedule.daysPerWeek);
      expect(parsed.version).toBe(schedule.version);
    });

    it('should format JSON with 2-space indentation', () => {
      const schedule = createTestSchedule();
      const json = exportScheduleToJson(schedule);

      // Check for proper indentation (2 spaces)
      expect(json).toContain('\n  "');
    });
  });

  describe('validateImportedJson', () => {
    it('should accept valid workout JSON', () => {
      const schedule = createTestSchedule();
      const json = exportScheduleToJson(schedule);

      expect(() => validateImportedJson(json)).not.toThrow();
    });

    it('should return parsed workout with required fields', () => {
      const schedule = createTestSchedule();
      const json = exportScheduleToJson(schedule);
      const workout = validateImportedJson(json);

      expect(workout.id).toBeTruthy();
      expect(workout.name).toBeTruthy();
      expect(workout.days).toBeTruthy();
    });

    it('should reject JSON missing id', () => {
      const invalidJson = JSON.stringify({ name: 'Test', days: {} });

      expect(() => validateImportedJson(invalidJson)).toThrow('Invalid workout file format');
    });

    it('should reject JSON missing name', () => {
      const invalidJson = JSON.stringify({ id: 'test', days: {} });

      expect(() => validateImportedJson(invalidJson)).toThrow('Invalid workout file format');
    });

    it('should reject JSON missing days', () => {
      const invalidJson = JSON.stringify({ id: 'test', name: 'Test' });

      expect(() => validateImportedJson(invalidJson)).toThrow('Invalid workout file format');
    });

    it('should reject malformed JSON', () => {
      const malformedJson = '{ this is not valid json }';

      expect(() => validateImportedJson(malformedJson)).toThrow();
    });
  });

  describe('createStoredScheduleFromImport', () => {
    it('should create new schedule with fresh ID', () => {
      const schedule = createTestSchedule();
      const json = exportScheduleToJson(schedule);
      const workout = validateImportedJson(json);
      const imported = createStoredScheduleFromImport(workout, '2026-03-01');

      expect(imported.id).not.toBe(schedule.id);
      expect(imported.id).toMatch(/^schedule_\d+_[a-z0-9]+$/);
    });

    it('should preserve workout data in imported schedule', () => {
      const schedule = createTestSchedule();
      const json = exportScheduleToJson(schedule);
      const workout = validateImportedJson(json);
      const imported = createStoredScheduleFromImport(workout, '2026-03-01');

      expect(imported.name).toBe(schedule.name);
      expect(imported.weeks).toBe(schedule.weeks);
      expect(imported.daysPerWeek).toBe(schedule.daysPerWeek);
      expect(imported.metadata).toEqual(schedule.metadata);
    });

    it('should reset progress metadata on import', () => {
      const schedule = createTestSchedule();
      schedule.scheduleMetadata.currentWeek = 3;
      schedule.scheduleMetadata.currentDay = 2;

      const json = exportScheduleToJson(schedule);
      const workout = validateImportedJson(json);
      const imported = createStoredScheduleFromImport(workout, '2026-03-01');

      expect(imported.scheduleMetadata.currentWeek).toBe(1);
      expect(imported.scheduleMetadata.currentDay).toBe(1);
    });

    it('should use provided start date', () => {
      const schedule = createTestSchedule();
      const json = exportScheduleToJson(schedule);
      const workout = validateImportedJson(json);
      const imported = createStoredScheduleFromImport(workout, '2026-06-15');

      expect(imported.scheduleMetadata.startDate).toBe('2026-06-15');
    });

    it('should set imported schedule as active', () => {
      const schedule = createTestSchedule();
      schedule.scheduleMetadata.isActive = false;

      const json = exportScheduleToJson(schedule);
      const workout = validateImportedJson(json);
      const imported = createStoredScheduleFromImport(workout, '2026-03-01');

      expect(imported.scheduleMetadata.isActive).toBe(true);
    });

    it('should create default day mapping', () => {
      const schedule = createTestSchedule();
      const json = exportScheduleToJson(schedule);
      const workout = validateImportedJson(json);
      const imported = createStoredScheduleFromImport(workout, '2026-03-01');

      expect(imported.scheduleMetadata.dayMapping).toBeDefined();
      expect(imported.scheduleMetadata.dayMapping?.['1']).toBe(0); // Monday
      expect(imported.scheduleMetadata.dayMapping?.['2']).toBe(1); // Tuesday
      expect(imported.scheduleMetadata.dayMapping?.['3']).toBe(2); // Wednesday
    });
  });

  describe('Full Round-Trip', () => {
    it('should preserve all exercises through export/import cycle', () => {
      const original = createTestSchedule();
      const json = exportScheduleToJson(original);
      const workout = validateImportedJson(json);
      const imported = createStoredScheduleFromImport(workout, '2026-03-01');

      // Check Day 1 exercises
      expect(imported.days['1'].exercises.length).toBe(original.days['1'].exercises.length);
      expect(imported.days['1'].exercises[0].name).toBe('Bench Press');
      expect(imported.days['1'].exercises[1].name).toBe('Shoulder Press');
      expect(imported.days['1'].exercises[2].name).toBe('Tricep Pushdown');

      // Check Day 2 exercises
      expect(imported.days['2'].exercises.length).toBe(original.days['2'].exercises.length);
      expect(imported.days['2'].exercises[0].name).toBe('Deadlift');

      // Check Day 3 exercises
      expect(imported.days['3'].exercises.length).toBe(original.days['3'].exercises.length);
    });

    it('should preserve week-by-week parameters through export/import', () => {
      const original = createTestSchedule();
      const json = exportScheduleToJson(original);
      const workout = validateImportedJson(json);
      const imported = createStoredScheduleFromImport(workout, '2026-03-01');

      const originalBench = original.days['1'].exercises[0] as any;
      const importedBench = imported.days['1'].exercises[0] as any;

      expect(importedBench.week1.sets).toBe(originalBench.week1.sets);
      expect(importedBench.week1.reps).toBe(originalBench.week1.reps);
      expect(importedBench.week2.sets).toBe(originalBench.week2.sets);
      expect(importedBench.week3.reps).toBe(originalBench.week3.reps);
      expect(importedBench.week4.sets).toBe(originalBench.week4.sets);
    });

    it('should preserve weight configuration through export/import', () => {
      const original = createTestSchedule();
      const json = exportScheduleToJson(original);
      const workout = validateImportedJson(json);
      const imported = createStoredScheduleFromImport(workout, '2026-03-01');

      const originalBench = original.days['1'].exercises[0] as any;
      const importedBench = imported.days['1'].exercises[0] as any;

      expect(importedBench.week1.weight).toEqual(originalBench.week1.weight);
      expect(importedBench.week1.weight.type).toBe('percent_tm');
      expect(importedBench.week1.weight.value).toBe(70);
    });

    it('should preserve day focus and type through export/import', () => {
      const original = createTestSchedule();
      const json = exportScheduleToJson(original);
      const workout = validateImportedJson(json);
      const imported = createStoredScheduleFromImport(workout, '2026-03-01');

      expect(imported.days['1'].focus).toBe('Push');
      expect(imported.days['1'].type).toBe('training');
      expect(imported.days['2'].focus).toBe('Pull');
      expect(imported.days['3'].focus).toBe('Legs');
    });

    it('should preserve compound exercises with sub-exercises', () => {
      const original = createScheduleWithCompoundExercises();
      const json = exportScheduleToJson(original);
      const workout = validateImportedJson(json);
      const imported = createStoredScheduleFromImport(workout, '2026-03-01');

      const emomBlock = imported.days['1'].exercises[0] as any;
      expect(emomBlock.name).toBe('EMOM Block');
      expect(emomBlock.category).toBe('emom');
      expect(emomBlock.subExercises).toBeDefined();
      expect(emomBlock.subExercises.length).toBe(3);
      expect(emomBlock.subExercises[0].name).toBe('Kettlebell Swings');
      expect(emomBlock.subExercises[0].reps).toBe(15);

      const amrapBlock = imported.days['1'].exercises[1] as any;
      expect(amrapBlock.category).toBe('amrap');
      expect(amrapBlock.subExercises.length).toBe(2);

      const circuitBlock = imported.days['2'].exercises[0] as any;
      expect(circuitBlock.category).toBe('circuit');
      expect(circuitBlock.subExercises.length).toBe(3);
    });

    it('should preserve metadata.goal and metadata.experience', () => {
      const original = createTestSchedule();
      const json = exportScheduleToJson(original);
      const workout = validateImportedJson(json);
      const imported = createStoredScheduleFromImport(workout, '2026-03-01');

      expect(imported.metadata?.goal).toBe('build_muscle');
      expect(imported.metadata?.experience).toBe('intermediate');
    });

    it('should preserve metadata.equipment array', () => {
      const original = createTestSchedule();
      const json = exportScheduleToJson(original);
      const workout = validateImportedJson(json);
      const imported = createStoredScheduleFromImport(workout, '2026-03-01');

      expect(imported.metadata?.equipment).toEqual(['dumbbells', 'barbell', 'cables']);
    });
  });

  describe('Edge Cases', () => {
    it('should handle schedule with special characters in name', () => {
      const schedule = createTestSchedule();
      schedule.name = 'My "Awesome" Plan (v2.0) - Test & More!';

      const json = exportScheduleToJson(schedule);
      const workout = validateImportedJson(json);
      const imported = createStoredScheduleFromImport(workout, '2026-03-01');

      expect(imported.name).toBe('My "Awesome" Plan (v2.0) - Test & More!');
    });

    it('should handle schedule with unicode characters', () => {
      const schedule = createTestSchedule();
      schedule.name = 'Workout Plan - Strength';
      schedule.days['1'].focus = 'Push Day - Heavy';

      const json = exportScheduleToJson(schedule);
      const workout = validateImportedJson(json);
      const imported = createStoredScheduleFromImport(workout, '2026-03-01');

      expect(imported.name).toBe(schedule.name);
      expect(imported.days['1'].focus).toBe(schedule.days['1'].focus);
    });

    it('should handle schedule with empty exercises array', () => {
      const schedule = createTestSchedule();
      schedule.days['1'].exercises = [];

      const json = exportScheduleToJson(schedule);
      const workout = validateImportedJson(json);
      const imported = createStoredScheduleFromImport(workout, '2026-03-01');

      expect(imported.days['1'].exercises).toEqual([]);
    });

    it('should handle minimal valid schedule', () => {
      const minimal: StoredSchedule = {
        id: 'min-id',
        name: 'Minimal',
        version: '2.0.0',
        weeks: 1,
        daysPerWeek: 1,
        days: {
          '1': {
            dayNumber: 1,
            focus: 'Full Body',
            type: 'training',
            exercises: []
          }
        },
        scheduleMetadata: {
          isActive: false,
          startDate: '2026-01-01',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          currentWeek: 1,
          currentDay: 1
        }
      };

      const json = exportScheduleToJson(minimal);
      const workout = validateImportedJson(json);
      const imported = createStoredScheduleFromImport(workout, '2026-03-01');

      expect(imported.name).toBe('Minimal');
      expect(imported.weeks).toBe(1);
      expect(imported.daysPerWeek).toBe(1);
    });

    it('should generate unique IDs for multiple imports of same schedule', () => {
      const schedule = createTestSchedule();
      const json = exportScheduleToJson(schedule);
      const workout = validateImportedJson(json);

      const imported1 = createStoredScheduleFromImport(workout, '2026-03-01');
      const imported2 = createStoredScheduleFromImport(workout, '2026-03-01');

      expect(imported1.id).not.toBe(imported2.id);
    });
  });

  describe('Filename Sanitization', () => {
    // Test the filename sanitization logic from ScheduleLibrary.svelte
    function sanitizeFilename(name: string): string {
      return name.replace(/[^a-zA-Z0-9-_]/g, '_').toLowerCase();
    }

    it('should sanitize spaces in filename', () => {
      expect(sanitizeFilename('My Workout Plan')).toBe('my_workout_plan');
    });

    it('should sanitize special characters', () => {
      // Note: hyphens and underscores are preserved
      expect(sanitizeFilename('Plan (v2.0) - Test!')).toBe('plan__v2_0__-_test_');
    });

    it('should handle already clean names', () => {
      expect(sanitizeFilename('simple-plan_v1')).toBe('simple-plan_v1');
    });

    it('should lowercase the filename', () => {
      expect(sanitizeFilename('MyPLAN')).toBe('myplan');
    });
  });
});
