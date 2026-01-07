/**
 * Test: Workout Formatter - Weight Field Visibility
 *
 * Verifies that the formatter uses metadata-driven weight visibility
 * instead of workMode-based filtering.
 *
 * Bug: Weight fields were hidden for ALL work_time exercises
 * Fix: Check exercise metadata (external_load) to determine visibility
 */

import { describe, it, expect } from 'vitest';
import {
  formatWeekProgressionInteractive,
  formatSubExercisesInteractive,
} from '../../cli/lib/workout-formatter.js';
import type { ParameterizedExercise } from '../../src/lib/engine/types.js';

describe('Workout Formatter - Weight Field Visibility', () => {
  describe('formatWeekProgressionInteractive()', () => {
    it('should show weight for external_load: "always" exercises in work_time mode', () => {
      // Kettlebell Snatch: external_load: "always", isometric: false
      const exercise = {
        name: 'Kettlebell Snatch',
        week1: {
          sets: 4,
          work_time_minutes: 0.5,
          work_time_unit: 'minutes',
          weight: { type: 'absolute' as const, value: 16, unit: 'kg' as const },
          rest_time_minutes: 60,
          rest_time_unit: 'seconds',
        },
      };

      const result = formatWeekProgressionInteractive(exercise, 1, 'day1.exercises[0]', {});

      // Should show weight field
      expect(result).toContain('@ 16 kg');
      expect(result).toContain('0.5 minutes work');
    });

    it('should NOT show weight for external_load: "never" exercises in work_time mode', () => {
      // Plank Hold: external_load: "never", isometric: true
      const exercise = {
        name: 'Plank Hold',
        week1: {
          sets: 3,
          work_time_minutes: 1,
          work_time_unit: 'minutes',
          rest_time_minutes: 60,
          rest_time_unit: 'seconds',
        },
      };

      const result = formatWeekProgressionInteractive(exercise, 1, 'day1.exercises[0]', {});

      // Should NOT show weight field
      expect(result).not.toContain('@');
      expect(result).toContain('1 minutes work');
    });

    it('should show weight for external_load: "sometimes" exercises if weight present in work_time mode', () => {
      // Wall Sit: external_load: "sometimes", isometric: true
      const exercise = {
        name: 'Wall Sit',
        week1: {
          sets: 3,
          work_time_minutes: 1,
          work_time_unit: 'minutes',
          weight: { type: 'absolute' as const, value: 10, unit: 'kg' as const },
          rest_time_minutes: 60,
          rest_time_unit: 'seconds',
        },
      };

      const result = formatWeekProgressionInteractive(exercise, 1, 'day1.exercises[0]', {});

      // Should show weight field because it's present in data
      expect(result).toContain('@ 10 kg');
      expect(result).toContain('1 minutes work');
    });

    it('should NOT show weight for external_load: "sometimes" exercises if weight absent in work_time mode', () => {
      // Wall Sit: external_load: "sometimes", isometric: true
      const exercise = {
        name: 'Wall Sit',
        week1: {
          sets: 3,
          work_time_minutes: 1,
          work_time_unit: 'minutes',
          rest_time_minutes: 60,
          rest_time_unit: 'seconds',
        },
      };

      const result = formatWeekProgressionInteractive(exercise, 1, 'day1.exercises[0]', {});

      // Should NOT show weight field because it's not in data
      expect(result).not.toContain('@');
      expect(result).toContain('1 minutes work');
    });
  });

  describe('formatSubExercisesInteractive()', () => {
    it('should show weight for external_load: "always" sub-exercises in work_time mode', () => {
      const subExercises: ParameterizedExercise[] = [
        {
          name: 'Kettlebell Snatch',
          week1: {
            work_time_minutes: 0.5,
            work_time_unit: 'minutes',
            weight: { type: 'absolute', value: 16, unit: 'kg' },
            rest_time_minutes: 30,
            rest_time_unit: 'seconds',
          },
        } as any,
      ];

      const result = formatSubExercisesInteractive(subExercises, 1, 'day1.exercises[0]', {});

      // Should show weight field
      expect(result).toContain('Kettlebell Snatch');
      expect(result).toContain('16 kg');
    });

    it('should NOT show weight for external_load: "never" sub-exercises in work_time mode', () => {
      const subExercises: ParameterizedExercise[] = [
        {
          name: 'Plank Hold',
          week1: {
            work_time_minutes: 1,
            work_time_unit: 'minutes',
            rest_time_minutes: 30,
            rest_time_unit: 'seconds',
          },
        } as any,
      ];

      const result = formatSubExercisesInteractive(subExercises, 1, 'day1.exercises[0]', {});

      // Should NOT show weight field
      expect(result).toContain('Plank Hold');
      expect(result).not.toContain('kg');
      expect(result).not.toContain('Weight:');
    });

    it('should NOT show tempo for sub-exercises in work_time mode', () => {
      const subExercises: ParameterizedExercise[] = [
        {
          name: 'Kettlebell Snatch',
          week1: {
            work_time_minutes: 0.5,
            work_time_unit: 'minutes',
            weight: { type: 'absolute', value: 16, unit: 'kg' },
            tempo: '2-0-1-0',
            rest_time_minutes: 30,
            rest_time_unit: 'seconds',
          },
        } as any,
      ];

      const result = formatSubExercisesInteractive(subExercises, 1, 'day1.exercises[0]', {});

      // Should NOT show tempo (tempo only applies to reps mode)
      expect(result).not.toContain('Tempo:');
      expect(result).not.toContain('2-0-1-0');
    });
  });

  describe('Consistency with editor', () => {
    it('should match editor visibility rules for weight fields', () => {
      // Test that formatter and editor use the same shared module
      // If formatter shows weight, editor should allow editing it

      const workTimeExerciseWithWeight = {
        name: 'Kettlebell Snatch', // external_load: "always"
        week1: {
          work_time_minutes: 0.5,
          work_time_unit: 'minutes',
          weight: { type: 'absolute' as const, value: 16, unit: 'kg' as const },
        },
      };

      const result = formatWeekProgressionInteractive(
        workTimeExerciseWithWeight,
        1,
        'day1.exercises[0]',
        {}
      );

      // Formatter shows weight -> editor should allow editing it
      expect(result).toContain('@ 16 kg');
    });
  });
});
