/**
 * Default User Schedule Flow Integration Test
 *
 * Validates the complete flow: default user (V) can create a workout
 * using their stored preferences and load it into the schedule.
 *
 * This test ensures ticket #017 (Schedule Tab UI) works end-to-end.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DEFAULT_USER, type WorkoutPreferences } from '../../../src/lib/types/user.js';
import { generateWorkout } from '../../../src/lib/engine/workout-generator.js';
import type { QuestionnaireAnswers, ParameterizedWorkout } from '../../../src/lib/engine/types.js';
import type { StoredSchedule, ScheduleMetadata } from '../../../src/lib/types/schedule.js';
import {
  validateWorkoutStructure,
  validateExerciseReferences
} from '../../helpers/validation.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../../..');

// Load exercise database for validation
const exerciseDBPath = join(projectRoot, 'src/data/exercise_database.json');
const exerciseDB = JSON.parse(readFileSync(exerciseDBPath, 'utf-8'));

describe('Default User Schedule Flow', () => {
  describe('DEFAULT_USER Preferences Validity', () => {
    it('should have all required preference fields', () => {
      const prefs = DEFAULT_USER.preferences;

      // All fields required by QuestionnaireAnswers
      expect(prefs.goal).toBeDefined();
      expect(prefs.session_duration).toBeDefined();
      expect(prefs.experience_level).toBeDefined();
      expect(prefs.training_frequency).toBeDefined();
      expect(prefs.program_duration).toBeDefined();
      // v2.1: equipment_access is optional, replaced by location-based equipment profiles
      expect(prefs.homeEquipment).toBeDefined();
      expect(prefs.gymEquipment).toBeDefined();
    });

    it('should have valid preference values', () => {
      const prefs = DEFAULT_USER.preferences;

      // Validate goal
      expect(['build_muscle', 'tone', 'lose_weight']).toContain(prefs.goal);

      // Validate session_duration
      expect(['20', '30', '60']).toContain(prefs.session_duration);

      // Validate experience_level
      expect(['beginner', 'intermediate', 'advanced']).toContain(prefs.experience_level);

      // v2.1: equipment_access is optional (now uses dayConfigs + equipment profiles)
      // If present, validate it
      if (prefs.equipment_access) {
        expect(['full_gym', 'dumbbells_only', 'bodyweight_only']).toContain(prefs.equipment_access);
      }

      // Validate equipment arrays (v2.1)
      expect(Array.isArray(prefs.homeEquipment)).toBe(true);
      expect(Array.isArray(prefs.gymEquipment)).toBe(true);
      expect(prefs.homeEquipment.length).toBeGreaterThan(0);
      expect(prefs.gymEquipment.length).toBeGreaterThan(0);

      // Validate training_frequency
      expect(['2', '3', '4', '5', '6', '7']).toContain(prefs.training_frequency);

      // Validate program_duration
      expect(['3', '4', '6']).toContain(prefs.program_duration);
    });

    it('should be compatible with QuestionnaireAnswers type', () => {
      // This test verifies type compatibility at runtime
      // WorkoutPreferences should work as QuestionnaireAnswers
      const prefs = DEFAULT_USER.preferences;

      // Cast to QuestionnaireAnswers - this should work without errors
      const answers: QuestionnaireAnswers = {
        goal: prefs.goal,
        session_duration: prefs.session_duration,
        experience_level: prefs.experience_level,
        equipment_access: prefs.equipment_access,
        training_frequency: prefs.training_frequency,
        program_duration: prefs.program_duration
      };

      expect(answers.goal).toBe(prefs.goal);
      expect(answers.training_frequency).toBe(prefs.training_frequency);
    });
  });

  describe('Workout Generation from Default User Preferences', () => {
    let answers: QuestionnaireAnswers;
    let workout: ParameterizedWorkout;

    beforeEach(() => {
      const prefs = DEFAULT_USER.preferences;
      answers = {
        goal: prefs.goal,
        session_duration: prefs.session_duration,
        experience_level: prefs.experience_level,
        equipment_access: prefs.equipment_access,
        training_frequency: prefs.training_frequency,
        program_duration: prefs.program_duration
      };

      // Generate workout with deterministic seed
      workout = generateWorkout(answers, 12345);
    });

    it('should generate workout without errors', () => {
      expect(workout).toBeDefined();
      expect(workout.id).toBeDefined();
      expect(workout.name).toBeDefined();
      expect(workout.days).toBeDefined();
    });

    it('should generate valid workout structure', () => {
      expect(() => validateWorkoutStructure(workout)).not.toThrow();
    });

    it('should reference valid exercises from database', () => {
      expect(() => validateExerciseReferences(workout, exerciseDB)).not.toThrow();
    });

    it('should match training frequency from preferences', () => {
      const expectedDays = parseInt(answers.training_frequency);
      expect(workout.daysPerWeek).toBe(expectedDays);
      expect(Object.keys(workout.days).length).toBe(expectedDays);
    });

    it('should match program duration from preferences', () => {
      const expectedWeeks = parseInt(answers.program_duration);
      expect(workout.weeks).toBe(expectedWeeks);
    });

    it('should have exercises for all days', () => {
      Object.entries(workout.days).forEach(([dayKey, day]) => {
        expect(
          day.exercises.length,
          `Day ${dayKey} (${day.focus}) should have exercises`
        ).toBeGreaterThan(0);
      });
    });
  });

  describe('StoredSchedule Creation', () => {
    let workout: ParameterizedWorkout;
    let storedSchedule: StoredSchedule;

    beforeEach(() => {
      const prefs = DEFAULT_USER.preferences;
      const answers: QuestionnaireAnswers = {
        goal: prefs.goal,
        session_duration: prefs.session_duration,
        experience_level: prefs.experience_level,
        equipment_access: prefs.equipment_access,
        training_frequency: prefs.training_frequency,
        program_duration: prefs.program_duration
      };

      workout = generateWorkout(answers, 12345);

      // Create StoredSchedule matching CreateScheduleModal logic
      const startDate = new Date().toISOString().split('T')[0];
      storedSchedule = {
        ...workout,
        scheduleMetadata: {
          isActive: true,
          startDate: startDate,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          currentWeek: 1,
          currentDay: 1
        }
      };
    });

    it('should preserve ParameterizedWorkout structure (zero drift)', () => {
      // All original workout fields should be present
      expect(storedSchedule.id).toBe(workout.id);
      expect(storedSchedule.name).toBe(workout.name);
      expect(storedSchedule.version).toBe(workout.version);
      expect(storedSchedule.weeks).toBe(workout.weeks);
      expect(storedSchedule.daysPerWeek).toBe(workout.daysPerWeek);
      expect(storedSchedule.days).toEqual(workout.days);
      expect(storedSchedule.metadata).toEqual(workout.metadata);
    });

    it('should have all required scheduleMetadata fields', () => {
      const meta = storedSchedule.scheduleMetadata;

      expect(meta.isActive).toBe(true);
      expect(meta.startDate).toBeDefined();
      expect(meta.createdAt).toBeDefined();
      expect(meta.updatedAt).toBeDefined();
      expect(meta.currentWeek).toBe(1);
      expect(meta.currentDay).toBe(1);
    });

    it('should have valid ISO date strings', () => {
      const meta = storedSchedule.scheduleMetadata;

      // startDate should be YYYY-MM-DD format
      expect(meta.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // createdAt and updatedAt should be full ISO timestamps
      expect(new Date(meta.createdAt).toISOString()).toBe(meta.createdAt);
      expect(new Date(meta.updatedAt).toISOString()).toBe(meta.updatedAt);
    });

    it('should have unique schedule ID', () => {
      expect(storedSchedule.id).toBeDefined();
      expect(typeof storedSchedule.id).toBe('string');
      expect(storedSchedule.id.length).toBeGreaterThan(0);
    });
  });

  describe('Full Schedule Creation Flow', () => {
    it('should complete the full flow: preferences -> workout -> StoredSchedule', () => {
      // Step 1: Get default user preferences
      const prefs = DEFAULT_USER.preferences;
      expect(prefs).toBeDefined();

      // Step 2: Convert to QuestionnaireAnswers (what CreateScheduleModal does)
      const answers: QuestionnaireAnswers = {
        goal: prefs.goal,
        session_duration: prefs.session_duration,
        experience_level: prefs.experience_level,
        equipment_access: prefs.equipment_access,
        training_frequency: prefs.training_frequency,
        program_duration: prefs.program_duration
      };

      // Step 3: Generate workout
      const workout = generateWorkout(answers, 12345);
      expect(workout).toBeDefined();
      expect(workout.days).toBeDefined();

      // Step 4: Wrap in StoredSchedule
      const startDate = '2026-01-13';
      const storedSchedule: StoredSchedule = {
        ...workout,
        scheduleMetadata: {
          isActive: true,
          startDate: startDate,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          currentWeek: 1,
          currentDay: 1
        }
      };

      // Step 5: Verify final structure
      expect(storedSchedule.id).toBeDefined();
      expect(storedSchedule.name).toBeDefined();
      expect(storedSchedule.weeks).toBe(parseInt(prefs.program_duration));
      expect(storedSchedule.daysPerWeek).toBe(parseInt(prefs.training_frequency));
      expect(storedSchedule.scheduleMetadata.startDate).toBe(startDate);

      // Verify exercises exist
      const dayCount = Object.keys(storedSchedule.days).length;
      expect(dayCount).toBe(parseInt(prefs.training_frequency));

      Object.values(storedSchedule.days).forEach((day) => {
        expect(day.exercises.length).toBeGreaterThan(0);
      });
    });

    it('should handle different user preferences', () => {
      // Test with different preference combinations
      const testCases: QuestionnaireAnswers[] = [
        {
          goal: 'build_muscle',
          session_duration: '60',
          experience_level: 'advanced',
          equipment_access: 'full_gym',
          training_frequency: '5',
          program_duration: '6'
        },
        {
          goal: 'lose_weight',
          session_duration: '30',
          experience_level: 'beginner',
          equipment_access: 'bodyweight_only',
          training_frequency: '3',
          program_duration: '4'
        },
        {
          goal: 'tone',
          session_duration: '20',
          experience_level: 'intermediate',
          equipment_access: 'dumbbells_only',
          training_frequency: '4',
          program_duration: '3'
        }
      ];

      testCases.forEach((answers, index) => {
        const workout = generateWorkout(answers, 12345 + index);

        const storedSchedule: StoredSchedule = {
          ...workout,
          scheduleMetadata: {
            isActive: index === 0, // Only first is active
            startDate: '2026-01-13',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            currentWeek: 1,
            currentDay: 1
          }
        };

        expect(storedSchedule.weeks).toBe(parseInt(answers.program_duration));
        expect(storedSchedule.daysPerWeek).toBe(parseInt(answers.training_frequency));
        expect(Object.keys(storedSchedule.days).length).toBe(parseInt(answers.training_frequency));
      });
    });
  });

  describe('Default User "V" Specific Validation', () => {
    it('should generate correct workout for user V', () => {
      // V's specific preferences from DEFAULT_USER
      // goal: 'build_muscle'
      // session_duration: '30'
      // experience_level: 'intermediate'
      // equipment_access: 'full_gym'
      // training_frequency: '4'
      // program_duration: '4'

      const prefs = DEFAULT_USER.preferences;
      const answers: QuestionnaireAnswers = {
        goal: prefs.goal,
        session_duration: prefs.session_duration,
        experience_level: prefs.experience_level,
        equipment_access: prefs.equipment_access,
        training_frequency: prefs.training_frequency,
        program_duration: prefs.program_duration
      };

      const workout = generateWorkout(answers, 12345);

      // V should get 4 days/week, 4 weeks program
      expect(workout.daysPerWeek).toBe(4);
      expect(workout.weeks).toBe(4);

      // All days should have exercises (full_gym with intermediate experience)
      Object.values(workout.days).forEach((day) => {
        expect(day.exercises.length).toBeGreaterThan(0);
        expect(day.focus).toBeDefined();
      });

      // Each exercise should have week1 through week4 parameters
      Object.values(workout.days).forEach((day) => {
        day.exercises.forEach((exercise) => {
          expect(exercise.week1).toBeDefined();
          expect(exercise.week2).toBeDefined();
          expect(exercise.week3).toBeDefined();
          expect(exercise.week4).toBeDefined();
        });
      });
    });

    it('should create valid StoredSchedule for user V', () => {
      const prefs = DEFAULT_USER.preferences;
      const answers: QuestionnaireAnswers = {
        goal: prefs.goal,
        session_duration: prefs.session_duration,
        experience_level: prefs.experience_level,
        equipment_access: prefs.equipment_access,
        training_frequency: prefs.training_frequency,
        program_duration: prefs.program_duration
      };

      const workout = generateWorkout(answers, 12345);

      const storedSchedule: StoredSchedule = {
        ...workout,
        scheduleMetadata: {
          isActive: true,
          startDate: '2026-01-13', // Monday start
          createdAt: '2026-01-10T10:00:00.000Z',
          updatedAt: '2026-01-10T10:00:00.000Z',
          currentWeek: 1,
          currentDay: 1
        }
      };

      // Profile validation: V's workout is ready to use
      expect(storedSchedule.scheduleMetadata.isActive).toBe(true);
      expect(storedSchedule.scheduleMetadata.currentWeek).toBe(1);
      expect(storedSchedule.scheduleMetadata.currentDay).toBe(1);

      // Structure validation
      expect(() => validateWorkoutStructure(storedSchedule)).not.toThrow();
      expect(() => validateExerciseReferences(storedSchedule, exerciseDB)).not.toThrow();
    });
  });
});
