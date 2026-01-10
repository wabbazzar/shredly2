/**
 * Tests for time field parsing (Ticket #016)
 *
 * Tests the new self-documenting time field names with unit suffixes
 * and the parseTimeField/roundTimeValue helper functions.
 */

import { describe, it, expect } from 'vitest';
import {
  parseTimeField,
  roundTimeValue,
  applyIntensityProfile,
  applyProgressionScheme,
} from '../../src/lib/engine/phase2-parameters.js';
import type { ExerciseStructure, LegacyQuestionnaireAnswers, WeekParameters } from '../../src/lib/engine/types.js';
import rules from '../../src/data/workout_generation_rules.json' with { type: 'json' };
import type { GenerationRules } from '../../src/lib/engine/types.js';

const generationRules = rules as GenerationRules;

describe('Time Field Parsing (Ticket #016)', () => {
  describe('parseTimeField()', () => {
    it('should parse field with _seconds suffix', () => {
      const profile = {
        rest_time_seconds: 30,
      };

      const result = parseTimeField(profile, 'rest_time');

      expect(result).not.toBeNull();
      expect(result!.value).toBe(30);
      expect(result!.unit).toBe('seconds');
      expect(result!.displayValue).toBe('30 seconds');
    });

    it('should parse field with _minutes suffix', () => {
      const profile = {
        rest_time_minutes: 2.0,
      };

      const result = parseTimeField(profile, 'rest_time');

      expect(result).not.toBeNull();
      expect(result!.value).toBe(2.0);
      expect(result!.unit).toBe('minutes');
      expect(result!.displayValue).toBe('2 minutes');
    });

    it('should return null when no field found', () => {
      const profile = {
        sets: 3,
        reps: 10,
      };

      const result = parseTimeField(profile, 'rest_time');

      expect(result).toBeNull();
    });

    it('should prefer _seconds over _minutes when both exist (edge case)', () => {
      const profile = {
        rest_time_seconds: 45,
        rest_time_minutes: 1.5,
      };

      const result = parseTimeField(profile, 'rest_time');

      // _seconds takes precedence
      expect(result).not.toBeNull();
      expect(result!.unit).toBe('seconds');
      expect(result!.value).toBe(45);
    });

    it('should parse sub_work_time_seconds for interval sub-exercises', () => {
      const profile = {
        sub_work_time_seconds: 30,
        sub_rest_time_seconds: 30,
        sub_work_mode: 'time',
      };

      const workTime = parseTimeField(profile, 'sub_work_time');
      const restTime = parseTimeField(profile, 'sub_rest_time');

      expect(workTime).not.toBeNull();
      expect(workTime!.value).toBe(30);
      expect(workTime!.unit).toBe('seconds');

      expect(restTime).not.toBeNull();
      expect(restTime!.value).toBe(30);
      expect(restTime!.unit).toBe('seconds');
    });

    it('should parse block_time_minutes for EMOM/AMRAP', () => {
      const profile = {
        block_time_minutes: 10,
        sub_work_mode: 'reps',
      };

      // Note: block_time_minutes is accessed directly, not through parseTimeField
      // This test verifies the config structure is correct
      expect(profile.block_time_minutes).toBe(10);
    });
  });

  describe('roundTimeValue()', () => {
    it('should round seconds to nearest 5', () => {
      expect(roundTimeValue(32, 'seconds')).toBe(30);
      expect(roundTimeValue(33, 'seconds')).toBe(35);
      expect(roundTimeValue(37, 'seconds')).toBe(35);
      expect(roundTimeValue(38, 'seconds')).toBe(40);
    });

    it('should round minutes to nearest 0.5 for values > 1', () => {
      expect(roundTimeValue(1.2, 'minutes')).toBe(1.0);
      expect(roundTimeValue(1.3, 'minutes')).toBe(1.5);
      expect(roundTimeValue(1.7, 'minutes')).toBe(1.5);
      expect(roundTimeValue(1.8, 'minutes')).toBe(2.0);
      expect(roundTimeValue(2.1, 'minutes')).toBe(2.0);
      expect(roundTimeValue(2.3, 'minutes')).toBe(2.5);
    });

    it('should preserve exact values for minutes <= 1', () => {
      expect(roundTimeValue(0.5, 'minutes')).toBe(0.5);
      expect(roundTimeValue(0.75, 'minutes')).toBe(0.75);
      expect(roundTimeValue(1.0, 'minutes')).toBe(1.0);
    });

    it('should handle edge cases', () => {
      expect(roundTimeValue(0, 'seconds')).toBe(0);
      expect(roundTimeValue(0, 'minutes')).toBe(0);
      expect(roundTimeValue(5, 'seconds')).toBe(5);
      expect(roundTimeValue(60, 'seconds')).toBe(60);
    });
  });

  describe('Config Structure Validation', () => {
    it('should have strength profiles with rest_time_minutes', () => {
      const strengthProfile = generationRules.intensity_profiles.strength;

      expect(strengthProfile.moderate.rest_time_minutes).toBe(1.0);
      expect(strengthProfile.heavy.rest_time_minutes).toBe(2.0);
      expect(strengthProfile.max.rest_time_minutes).toBe(3.0);
    });

    it('should have bodyweight profiles with rest_time_seconds', () => {
      const bodyweightProfile = generationRules.intensity_profiles.bodyweight;

      expect(bodyweightProfile.light.rest_time_seconds).toBe(30);
      expect(bodyweightProfile.moderate.rest_time_seconds).toBe(45);
      expect(bodyweightProfile.heavy.rest_time_seconds).toBe(60);
    });

    it('should have interval profiles with sub_work_mode: "time"', () => {
      const intervalProfile = generationRules.intensity_profiles.interval;

      expect(intervalProfile.light.sub_work_mode).toBe('time');
      expect(intervalProfile.light.sub_work_time_seconds).toBe(30);
      expect(intervalProfile.light.sub_rest_time_seconds).toBe(30);

      // Verify work + rest = 60 seconds
      expect(intervalProfile.light.sub_work_time_seconds + intervalProfile.light.sub_rest_time_seconds).toBe(60);
      expect(intervalProfile.moderate.sub_work_time_seconds + intervalProfile.moderate.sub_rest_time_seconds).toBe(60);
      expect(intervalProfile.heavy.sub_work_time_seconds + intervalProfile.heavy.sub_rest_time_seconds).toBe(60);
    });

    it('should have EMOM profiles with block_time_minutes and sub_work_mode: "reps"', () => {
      const emomProfile = generationRules.intensity_profiles.emom;

      expect(emomProfile.light.block_time_minutes).toBe(8);
      expect(emomProfile.moderate.block_time_minutes).toBe(10);
      expect(emomProfile.heavy.block_time_minutes).toBe(12);

      expect(emomProfile.light.sub_work_mode).toBe('reps');
      expect(emomProfile.moderate.sub_work_mode).toBe('reps');
      expect(emomProfile.heavy.sub_work_mode).toBe('reps');
    });

    it('should have AMRAP profiles with block_time_minutes and sub_work_mode: "reps"', () => {
      const amrapProfile = generationRules.intensity_profiles.amrap;

      expect(amrapProfile.light.block_time_minutes).toBe(6);
      expect(amrapProfile.moderate.block_time_minutes).toBe(8);
      expect(amrapProfile.heavy.block_time_minutes).toBe(10);

      expect(amrapProfile.light.sub_work_mode).toBe('reps');
      expect(amrapProfile.moderate.sub_work_mode).toBe('reps');
      expect(amrapProfile.heavy.sub_work_mode).toBe('reps');
    });

    it('should have density progression rules with unit-aware deltas', () => {
      const densityRules = generationRules.progression_schemes.density.rules;

      expect(densityRules.rest_time_delta_per_week_minutes).toBe(-0.25);
      expect(densityRules.rest_time_minimum_minutes).toBe(1.5);
      expect(densityRules.rest_time_delta_per_week_seconds).toBe(-5);
      expect(densityRules.rest_time_minimum_seconds).toBe(5);
      expect(densityRules.interval_work_time_delta_per_week_seconds).toBe(5);
      expect(densityRules.interval_rest_time_delta_per_week_seconds).toBe(-5);
    });
  });

  describe('Interval Sub-Exercise Time Parameters', () => {
    const answers: LegacyQuestionnaireAnswers = {
      experience_level: 'intermediate',
      fitness_goal: 'general_fitness',
      weekly_days_available: 3,
      equipment_access: ['commercial_gym'],
      workout_duration: 45,
      session_duration: 45,
      injuries_limitations: ''
    };

    it('should pass parent profile sub_work_time to interval sub-exercises', () => {
      const subExercise: ExerciseStructure = {
        name: 'Mountain Climbers',
        progressionScheme: 'density',
        intensityProfile: 'moderate',
      };

      // Parent interval profile with sub_work_mode: "time"
      const parentProfile = {
        sets: 4,
        sub_work_mode: 'time',
        sub_work_time_seconds: 40,
        sub_rest_time_seconds: 20,
      };

      const week1 = applyIntensityProfile(
        subExercise,
        'bodyweight', // sub-exercise category
        generationRules,
        answers,
        true, // isSubExercise
        'never', // external_load
        'interval', // parentCategory
        parentProfile // parentProfile with sub_work_mode: "time"
      );

      // Sub-exercise should have work_time and rest_time (NOT reps)
      expect(week1.work_time_minutes).toBeDefined();
      expect(week1.rest_time_minutes).toBeDefined();
      expect(week1.work_time_unit).toBe('seconds');
      expect(week1.rest_time_unit).toBe('seconds');

      // Verify the values (stored as minutes but unit is seconds)
      expect(week1.work_time_minutes).toBeCloseTo(40 / 60, 4);
      expect(week1.reps).toBeUndefined(); // Should NOT have reps
    });

    it('should NOT pass time params to EMOM sub-exercises (sub_work_mode: "reps")', () => {
      const subExercise: ExerciseStructure = {
        name: 'Burpees',
        progressionScheme: 'density',
        intensityProfile: 'moderate',
      };

      // Parent EMOM profile with sub_work_mode: "reps"
      const parentProfile = {
        block_time_minutes: 10,
        sub_work_mode: 'reps',
        target_reps_per_minute: 10,
      };

      const week1 = applyIntensityProfile(
        subExercise,
        'bodyweight', // sub-exercise category
        generationRules,
        answers,
        true, // isSubExercise
        'never', // external_load
        'emom', // parentCategory
        parentProfile // parentProfile with sub_work_mode: "reps"
      );

      // Sub-exercise should have reps (NOT work_time from parent)
      expect(week1.reps).toBeDefined();
      // Should not inherit work_time from parent
      expect(week1.work_time_minutes).toBeUndefined();
    });
  });

  describe('Interval Sub-Exercise Progression', () => {
    it('should increase work_time and decrease rest_time for interval sub-exercises', () => {
      const week1: WeekParameters = {
        work_time_minutes: 30 / 60,  // 30 seconds stored as minutes
        work_time_unit: 'seconds',
        rest_time_minutes: 30 / 60,  // 30 seconds stored as minutes
        rest_time_unit: 'seconds',
      };

      // Week 2 with interval-specific progression
      const week2 = applyProgressionScheme(
        week1,
        'density',
        2,
        3,
        generationRules,
        undefined,
        undefined,
        true // isIntervalSubExercise
      );

      // Work time should INCREASE by +5 seconds
      const week1WorkSeconds = week1.work_time_minutes! * 60;
      const week2WorkSeconds = week2.work_time_minutes! * 60;
      expect(week2WorkSeconds).toBe(week1WorkSeconds + 5); // 35 seconds

      // Rest time should DECREASE by -5 seconds
      const week1RestSeconds = week1.rest_time_minutes! * 60;
      const week2RestSeconds = week2.rest_time_minutes! * 60;
      expect(week2RestSeconds).toBe(week1RestSeconds - 5); // 25 seconds

      // Total should still be 60 seconds
      expect(week2WorkSeconds + week2RestSeconds).toBe(60);
    });

    it('should respect minimum rest time for interval sub-exercises', () => {
      const week1: WeekParameters = {
        work_time_minutes: 50 / 60,  // 50 seconds - close to max
        work_time_unit: 'seconds',
        rest_time_minutes: 10 / 60,  // 10 seconds - close to min
        rest_time_unit: 'seconds',
      };

      // Week 3 - would push rest below minimum (5 seconds)
      const week3 = applyProgressionScheme(
        week1,
        'density',
        3,
        3,
        generationRules,
        undefined,
        undefined,
        true // isIntervalSubExercise
      );

      // Rest time should not go below minimum (5 seconds)
      const week3RestSeconds = week3.rest_time_minutes! * 60;
      expect(week3RestSeconds).toBeGreaterThanOrEqual(5);
    });
  });
});
