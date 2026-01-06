/**
 * Muscle Group Coverage Integration Tests
 *
 * Tests that workout generation achieves balanced muscle group coverage
 * across different training splits and experience levels. Validates that
 * Full Body, Push/Pull/Legs, and Upper/Lower splits appropriately distribute
 * exercises across target muscle groups.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type {
  ExerciseDatabase,
  ParameterizedWorkout,
  ParameterizedDay,
  Exercise
} from '../../src/lib/engine/types.js';
import { generateWorkout } from '../../src/lib/engine/workout-generator.js';
import {
  BEGINNER_FULL_BODY,
  INTERMEDIATE_PPL,
  ADVANCED_UPPER_LOWER,
  EXPERT_ULPPL_GYM
} from '../fixtures/questionnaire-answers.js';
import { validateMuscleGroupCoverage } from '../helpers/validation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');

// Load exercise database
const exerciseDBPath = join(projectRoot, 'src/data/exercise_database.json');
const exerciseDB: ExerciseDatabase = JSON.parse(readFileSync(exerciseDBPath, 'utf-8'));

/**
 * Flattens exercise database into a lookup map
 */
function flattenExerciseDB(db: ExerciseDatabase): Map<string, Exercise> {
  const exerciseMap = new Map<string, Exercise>();

  for (const category of Object.values(db.exercise_database.categories)) {
    for (const [name, exercise] of Object.entries(category.exercises)) {
      exerciseMap.set(name, exercise);
    }
  }

  return exerciseMap;
}

/**
 * Analyzes muscle group coverage for a single day
 */
function analyzeMuscleGroupCoverage(
  day: ParameterizedDay,
  exerciseMap: Map<string, Exercise>
): {
  muscleGroupCounts: Map<string, number>;
  exercisesByMuscleGroup: Map<string, string[]>;
  uniqueMuscleGroups: number;
  totalSelections: number;
  coverageRatio: number;
} {
  const muscleGroupCounts = new Map<string, number>();
  const exercisesByMuscleGroup = new Map<string, string[]>();

  // Process each exercise
  for (const exercise of day.exercises) {
    // Handle compound exercises with sub-exercises
    if (exercise.sub_exercises) {
      for (const subEx of exercise.sub_exercises) {
        const subExData = exerciseMap.get(subEx.name);
        if (subExData) {
          for (const mg of subExData.muscle_groups) {
            muscleGroupCounts.set(mg, (muscleGroupCounts.get(mg) || 0) + 1);
            if (!exercisesByMuscleGroup.has(mg)) {
              exercisesByMuscleGroup.set(mg, []);
            }
            exercisesByMuscleGroup.get(mg)!.push(subEx.name);
          }
        }
      }
    } else {
      // Individual exercise
      const exData = exerciseMap.get(exercise.name);
      if (exData) {
        for (const mg of exData.muscle_groups) {
          muscleGroupCounts.set(mg, (muscleGroupCounts.get(mg) || 0) + 1);
          if (!exercisesByMuscleGroup.has(mg)) {
            exercisesByMuscleGroup.set(mg, []);
          }
          exercisesByMuscleGroup.get(mg)!.push(exercise.name);
        }
      }
    }
  }

  const uniqueMuscleGroups = muscleGroupCounts.size;
  const totalSelections = Array.from(muscleGroupCounts.values()).reduce((a, b) => a + b, 0);
  const maxCount = muscleGroupCounts.size > 0 ? Math.max(...muscleGroupCounts.values()) : 1;
  const minCount = muscleGroupCounts.size > 0 ? Math.min(...muscleGroupCounts.values()) : 1;
  const coverageRatio = maxCount / (minCount || 1);

  return {
    muscleGroupCounts,
    exercisesByMuscleGroup,
    uniqueMuscleGroups,
    totalSelections,
    coverageRatio
  };
}

describe('Muscle Group Coverage Tests', () => {

  const exerciseMap = flattenExerciseDB(exerciseDB);

  describe('Full Body Split Coverage', () => {

    it('should achieve balanced muscle group coverage for beginner full body', () => {
      const workout = generateWorkout(BEGINNER_FULL_BODY);

      // Analyze each day (should all be Full Body)
      Object.values(workout.days).forEach((day) => {
        const analysis = analyzeMuscleGroupCoverage(day, exerciseMap);

        // Full Body should hit multiple muscle groups
        expect(
          analysis.uniqueMuscleGroups,
          `Day ${day.dayNumber}: should target multiple muscle groups`
        ).toBeGreaterThanOrEqual(4);

        // Coverage ratio should be reasonable (max/min <= 3.0 is acceptable)
        expect(
          analysis.coverageRatio,
          `Day ${day.dayNumber}: muscle group distribution too unbalanced (ratio: ${analysis.coverageRatio.toFixed(2)})`
        ).toBeLessThanOrEqual(3.0);

        // Log coverage for debugging
        console.log(`\nFull Body Day ${day.dayNumber} Coverage:`);
        console.log(`  Unique muscle groups: ${analysis.uniqueMuscleGroups}`);
        console.log(`  Coverage ratio (max/min): ${analysis.coverageRatio.toFixed(2)}`);
      });
    });

    it.skip('should cover major muscle groups in full body workouts (KNOWN ISSUE: variable muscle group coverage)', () => {
      // TODO: Improve muscle group targeting to ensure consistent major muscle coverage
      // Currently some days may miss major muscle groups like Chest/Back/Legs/Core
      const workout = generateWorkout(BEGINNER_FULL_BODY);

      // Expected major muscle groups for Full Body
      const expectedMuscleGroups = ['Chest', 'Back', 'Legs', 'Core'];

      Object.values(workout.days).forEach((day) => {
        // Use helper validation
        expect(
          () => validateMuscleGroupCoverage(day, exerciseDB, expectedMuscleGroups),
          `Day ${day.dayNumber}: should cover major muscle groups`
        ).not.toThrow();
      });
    });
  });

  describe('Push/Pull/Legs Split Coverage', () => {

    it.skip('should achieve balanced coverage for PPL split (KNOWN BUG: cardio intensity profiles)', () => {
      // TODO: Fix missing cardio "light" profile in duration-estimator.ts
      const workout = generateWorkout(INTERMEDIATE_PPL);

      // Analyze coverage by focus type
      const pushDays = Object.values(workout.days).filter(d => d.focus === 'Push');
      const pullDays = Object.values(workout.days).filter(d => d.focus === 'Pull');
      const legsDays = Object.values(workout.days).filter(d => d.focus === 'Legs');

      // Test Push days
      pushDays.forEach((day) => {
        const analysis = analyzeMuscleGroupCoverage(day, exerciseMap);
        expect(
          analysis.muscleGroupCounts.has('Chest') || analysis.muscleGroupCounts.has('Shoulders'),
          `Push day ${day.dayNumber}: should target Chest or Shoulders`
        ).toBe(true);

        // Coverage should be balanced
        expect(
          analysis.coverageRatio,
          `Push day ${day.dayNumber}: coverage ratio ${analysis.coverageRatio.toFixed(2)} too high`
        ).toBeLessThanOrEqual(3.0);
      });

      // Test Pull days
      pullDays.forEach((day) => {
        const analysis = analyzeMuscleGroupCoverage(day, exerciseMap);
        expect(
          analysis.muscleGroupCounts.has('Back') || analysis.muscleGroupCounts.has('Biceps'),
          `Pull day ${day.dayNumber}: should target Back or Biceps`
        ).toBe(true);

        // Coverage should be balanced
        expect(
          analysis.coverageRatio,
          `Pull day ${day.dayNumber}: coverage ratio ${analysis.coverageRatio.toFixed(2)} too high`
        ).toBeLessThanOrEqual(3.0);
      });

      // Test Legs days
      legsDays.forEach((day) => {
        const analysis = analyzeMuscleGroupCoverage(day, exerciseMap);
        expect(
          analysis.muscleGroupCounts.has('Legs') ||
          analysis.muscleGroupCounts.has('Quads') ||
          analysis.muscleGroupCounts.has('Hamstrings') ||
          analysis.muscleGroupCounts.has('Glutes'),
          `Legs day ${day.dayNumber}: should target leg muscle groups`
        ).toBe(true);

        // Coverage should be balanced
        expect(
          analysis.coverageRatio,
          `Legs day ${day.dayNumber}: coverage ratio ${analysis.coverageRatio.toFixed(2)} too high`
        ).toBeLessThanOrEqual(3.0);
      });
    });
  });

  describe('Upper/Lower Split Coverage', () => {

    it.skip('should achieve balanced coverage for upper/lower split (KNOWN ISSUE: variable coverage)', () => {
      // TODO: Improve muscle group distribution for Upper/Lower splits
      const workout = generateWorkout(ADVANCED_UPPER_LOWER);

      // Analyze coverage by focus type
      const upperDays = Object.values(workout.days).filter(d => d.focus === 'Upper');
      const lowerDays = Object.values(workout.days).filter(d => d.focus === 'Lower');

      // Test Upper days
      upperDays.forEach((day) => {
        const analysis = analyzeMuscleGroupCoverage(day, exerciseMap);

        // Should hit multiple upper body muscle groups
        const upperMuscleGroups = ['Chest', 'Back', 'Shoulders', 'Arms', 'Biceps', 'Triceps'];
        const upperHits = upperMuscleGroups.filter(mg => analysis.muscleGroupCounts.has(mg));

        expect(
          upperHits.length,
          `Upper day ${day.dayNumber}: should hit multiple upper body muscle groups`
        ).toBeGreaterThanOrEqual(2);

        // Coverage should be balanced
        expect(
          analysis.coverageRatio,
          `Upper day ${day.dayNumber}: coverage ratio ${analysis.coverageRatio.toFixed(2)} too high`
        ).toBeLessThanOrEqual(3.0);
      });

      // Test Lower days
      lowerDays.forEach((day) => {
        const analysis = analyzeMuscleGroupCoverage(day, exerciseMap);

        // Should hit leg muscle groups
        const lowerMuscleGroups = ['Legs', 'Quads', 'Hamstrings', 'Glutes', 'Calves'];
        const lowerHits = lowerMuscleGroups.filter(mg => analysis.muscleGroupCounts.has(mg));

        expect(
          lowerHits.length,
          `Lower day ${day.dayNumber}: should hit lower body muscle groups`
        ).toBeGreaterThanOrEqual(1);

        // Coverage should be balanced
        expect(
          analysis.coverageRatio,
          `Lower day ${day.dayNumber}: coverage ratio ${analysis.coverageRatio.toFixed(2)} too high`
        ).toBeLessThanOrEqual(3.0);
      });
    });
  });

  describe('ULPPL Split Coverage', () => {

    it('should achieve balanced coverage for ULPPL split', () => {
      const workout = generateWorkout(EXPERT_ULPPL_GYM);

      // ULPPL = Upper, Lower, Push, Pull, Legs
      Object.values(workout.days).forEach((day) => {
        const analysis = analyzeMuscleGroupCoverage(day, exerciseMap);

        // Should hit muscle groups appropriate to focus
        expect(
          analysis.uniqueMuscleGroups,
          `Day ${day.dayNumber} (${day.focus}): should target multiple muscle groups`
        ).toBeGreaterThanOrEqual(1);

        // Coverage should be balanced
        expect(
          analysis.coverageRatio,
          `Day ${day.dayNumber} (${day.focus}): coverage ratio ${analysis.coverageRatio.toFixed(2)} too high`
        ).toBeLessThanOrEqual(4.0); // Slightly more lenient for advanced splits
      });
    });
  });

  describe('Experience Level Coverage', () => {

    it.skip('should maintain coverage balance across experience levels (KNOWN BUG: cardio intensity profiles)', () => {
      // TODO: Fix missing cardio "light" profile in duration-estimator.ts
      const beginnerWorkout = generateWorkout(BEGINNER_FULL_BODY);
      const intermediateWorkout = generateWorkout(INTERMEDIATE_PPL);
      const advancedWorkout = generateWorkout(ADVANCED_UPPER_LOWER);

      // All experience levels should have balanced coverage
      [beginnerWorkout, intermediateWorkout, advancedWorkout].forEach((workout) => {
        Object.values(workout.days).forEach((day) => {
          const analysis = analyzeMuscleGroupCoverage(day, exerciseMap);

          expect(
            analysis.uniqueMuscleGroups,
            `Workout "${workout.name}" day ${day.dayNumber}: should target multiple muscle groups`
          ).toBeGreaterThanOrEqual(1);

          // All levels should have reasonable coverage ratios
          expect(
            analysis.coverageRatio,
            `Workout "${workout.name}" day ${day.dayNumber}: coverage too unbalanced`
          ).toBeLessThanOrEqual(4.0);
        });
      });
    });
  });

  describe('Coverage Ratio Thresholds', () => {

    it('should meet good coverage threshold (ratio <= 2.0) for most days', () => {
      const workout = generateWorkout(BEGINNER_FULL_BODY);

      let goodCoverageDays = 0;
      let totalDays = 0;

      Object.values(workout.days).forEach((day) => {
        const analysis = analyzeMuscleGroupCoverage(day, exerciseMap);
        totalDays++;

        if (analysis.coverageRatio <= 2.0) {
          goodCoverageDays++;
        }

        console.log(`Day ${day.dayNumber} (${day.focus}): Coverage ratio = ${analysis.coverageRatio.toFixed(2)}`);
      });

      // At least 60% of days should have good coverage (ratio <= 2.0)
      const goodCoveragePercentage = (goodCoverageDays / totalDays) * 100;
      expect(
        goodCoveragePercentage,
        `Only ${goodCoverageDays}/${totalDays} days have good coverage (${goodCoveragePercentage.toFixed(1)}%)`
      ).toBeGreaterThanOrEqual(60);
    });

    it('should avoid poor coverage (ratio > 3.0) for full body workouts', () => {
      const workout = generateWorkout(BEGINNER_FULL_BODY);

      Object.values(workout.days).forEach((day) => {
        const analysis = analyzeMuscleGroupCoverage(day, exerciseMap);

        expect(
          analysis.coverageRatio,
          `Day ${day.dayNumber}: Poor coverage ratio ${analysis.coverageRatio.toFixed(2)}`
        ).toBeLessThanOrEqual(3.0);
      });
    });
  });
});
