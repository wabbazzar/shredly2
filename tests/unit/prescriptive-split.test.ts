/**
 * Prescriptive Split Unit Tests
 *
 * Tests the new prescriptive split selection logic from Phase 2 of ticket #012.
 * Validates that goal + frequency combinations produce correct day focus arrays.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { GenerationRules } from '../../src/lib/engine/types.js';
import {
  getPrescriptiveSplit,
  getBaseFocus,
  parseFocusSuffix,
  getProgressionFromGoal
} from '../../src/lib/engine/phase1-structure.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');

// Load rules configuration
let rules: GenerationRules;

beforeAll(() => {
  const rulesPath = join(projectRoot, 'src/data/workout_generation_rules.json');
  rules = JSON.parse(readFileSync(rulesPath, 'utf-8'));
});

describe('Prescriptive Split Selection', () => {

  describe('getPrescriptiveSplit()', () => {

    describe('build_muscle goal', () => {
      it('should return Upper/Lower for 2 days', () => {
        const result = getPrescriptiveSplit('build_muscle', 2, rules);
        expect(result).toEqual(['Upper', 'Lower']);
      });

      it('should return PPL for 3 days', () => {
        const result = getPrescriptiveSplit('build_muscle', 3, rules);
        expect(result).toEqual(['Push', 'Pull', 'Legs']);
      });

      it('should return PPL + FullBody-Mobility for 4 days', () => {
        const result = getPrescriptiveSplit('build_muscle', 4, rules);
        expect(result).toEqual(['Push', 'Pull', 'Legs', 'FullBody-Mobility']);
      });

      it('should return PPL + Volume days for 5 days', () => {
        const result = getPrescriptiveSplit('build_muscle', 5, rules);
        expect(result).toEqual(['Push', 'Pull', 'Legs', 'Upper-Volume', 'Lower-Volume']);
      });

      it('should return full 6-day split with mobility and volume', () => {
        const result = getPrescriptiveSplit('build_muscle', 6, rules);
        expect(result).toEqual(['Push', 'Pull', 'Legs', 'FullBody-Mobility', 'Upper-Volume', 'Lower-Volume']);
      });

      it('should return full 7-day split with strength/volume/flexibility', () => {
        const result = getPrescriptiveSplit('build_muscle', 7, rules);
        expect(result).toEqual([
          'Push-Strength', 'Pull-Strength', 'Legs-Strength',
          'Push-Volume', 'Pull-Volume', 'Legs-Volume',
          'Flexibility'
        ]);
      });
    });

    describe('tone goal', () => {
      it('should return Upper/Lower for 2 days', () => {
        const result = getPrescriptiveSplit('tone', 2, rules);
        expect(result).toEqual(['Upper', 'Lower']);
      });

      it('should return PPL for 3 days', () => {
        const result = getPrescriptiveSplit('tone', 3, rules);
        expect(result).toEqual(['Push', 'Pull', 'Legs']);
      });

      it('should return PPL + HIIT days for 5 days', () => {
        const result = getPrescriptiveSplit('tone', 5, rules);
        expect(result).toEqual(['Push', 'Pull', 'Legs', 'Upper-HIIT', 'Lower-HIIT']);
      });

      it('should return 6-day split with mobility and HIIT', () => {
        const result = getPrescriptiveSplit('tone', 6, rules);
        expect(result).toEqual(['Push', 'Pull', 'Legs', 'FullBody-Mobility', 'Upper-HIIT', 'Lower-HIIT']);
      });
    });

    describe('lose_weight goal', () => {
      it('should return HIIT days for 2 days', () => {
        const result = getPrescriptiveSplit('lose_weight', 2, rules);
        expect(result).toEqual(['Upper-HIIT', 'Lower-HIIT']);
      });

      it('should return PPL-HIIT for 3 days', () => {
        const result = getPrescriptiveSplit('lose_weight', 3, rules);
        expect(result).toEqual(['Push-HIIT', 'Pull-HIIT', 'Legs-HIIT']);
      });

      it('should return PPL-HIIT + mobility for 4 days', () => {
        const result = getPrescriptiveSplit('lose_weight', 4, rules);
        expect(result).toEqual(['Push-HIIT', 'Pull-HIIT', 'Legs-HIIT', 'FullBody-Mobility']);
      });

      it('should return full 7-day split', () => {
        const result = getPrescriptiveSplit('lose_weight', 7, rules);
        expect(result).toEqual([
          'Push-HIIT', 'Pull-HIIT', 'Legs-HIIT',
          'Push-Volume', 'Pull-Volume', 'Legs-Volume',
          'Flexibility'
        ]);
      });
    });

    describe('error handling', () => {
      it('should throw error for invalid goal', () => {
        expect(() => {
          // @ts-expect-error Testing invalid input
          getPrescriptiveSplit('invalid_goal', 3, rules);
        }).toThrow(/No prescriptive splits configured for goal/);
      });
    });
  });

  describe('getBaseFocus()', () => {

    it('should return base focus for HIIT suffix', () => {
      expect(getBaseFocus('Upper-HIIT')).toBe('Upper');
      expect(getBaseFocus('Lower-HIIT')).toBe('Lower');
      expect(getBaseFocus('Push-HIIT')).toBe('Push');
      expect(getBaseFocus('Pull-HIIT')).toBe('Pull');
      expect(getBaseFocus('Legs-HIIT')).toBe('Legs');
    });

    it('should return base focus for Volume suffix', () => {
      expect(getBaseFocus('Upper-Volume')).toBe('Upper');
      expect(getBaseFocus('Lower-Volume')).toBe('Lower');
      expect(getBaseFocus('Push-Volume')).toBe('Push');
      expect(getBaseFocus('Pull-Volume')).toBe('Pull');
      expect(getBaseFocus('Legs-Volume')).toBe('Legs');
    });

    it('should return base focus for Strength suffix', () => {
      expect(getBaseFocus('Push-Strength')).toBe('Push');
      expect(getBaseFocus('Pull-Strength')).toBe('Pull');
      expect(getBaseFocus('Legs-Strength')).toBe('Legs');
    });

    it('should map special focus types to Mobility', () => {
      // Flexibility and FullBody-Mobility use the same muscle groups as Mobility
      expect(getBaseFocus('Flexibility')).toBe('Mobility');
      expect(getBaseFocus('FullBody-Mobility')).toBe('Mobility');
    });

    it('should return as-is for base focus types without suffix', () => {
      expect(getBaseFocus('Push')).toBe('Push');
      expect(getBaseFocus('Pull')).toBe('Pull');
      expect(getBaseFocus('Legs')).toBe('Legs');
      expect(getBaseFocus('Upper')).toBe('Upper');
      expect(getBaseFocus('Lower')).toBe('Lower');
      expect(getBaseFocus('Full Body')).toBe('Full Body');
      expect(getBaseFocus('Mobility')).toBe('Mobility');
    });
  });

  describe('parseFocusSuffix()', () => {

    it('should return HIIT for HIIT suffix', () => {
      expect(parseFocusSuffix('Upper-HIIT')).toBe('HIIT');
      expect(parseFocusSuffix('Lower-HIIT')).toBe('HIIT');
      expect(parseFocusSuffix('Push-HIIT')).toBe('HIIT');
    });

    it('should return Volume for Volume suffix', () => {
      expect(parseFocusSuffix('Upper-Volume')).toBe('Volume');
      expect(parseFocusSuffix('Push-Volume')).toBe('Volume');
    });

    it('should return Strength for Strength suffix', () => {
      expect(parseFocusSuffix('Push-Strength')).toBe('Strength');
      expect(parseFocusSuffix('Legs-Strength')).toBe('Strength');
    });

    it('should return Mobility for Mobility suffix', () => {
      expect(parseFocusSuffix('FullBody-Mobility')).toBe('Mobility');
    });

    it('should return null for no suffix', () => {
      expect(parseFocusSuffix('Push')).toBeNull();
      expect(parseFocusSuffix('Pull')).toBeNull();
      expect(parseFocusSuffix('Legs')).toBeNull();
      expect(parseFocusSuffix('Upper')).toBeNull();
      expect(parseFocusSuffix('Lower')).toBeNull();
      expect(parseFocusSuffix('Flexibility')).toBeNull();
    });
  });
});

describe('Prescriptive Split Coverage', () => {

  it('should cover all 18 goal + frequency combinations', () => {
    const goals = ['build_muscle', 'tone', 'lose_weight'] as const;
    const frequencies = [2, 3, 4, 5, 6, 7];

    for (const goal of goals) {
      for (const freq of frequencies) {
        const result = getPrescriptiveSplit(goal, freq, rules);
        expect(result).toBeDefined();
        expect(result.length).toBe(freq);
        expect(Array.isArray(result)).toBe(true);
      }
    }
  });

  it('should have base focus mapping for all focus types via getBaseFocus()', () => {
    const goals = ['build_muscle', 'tone', 'lose_weight'] as const;
    const frequencies = [2, 3, 4, 5, 6, 7];

    const allFocuses = new Set<string>();
    for (const goal of goals) {
      for (const freq of frequencies) {
        const focuses = getPrescriptiveSplit(goal, freq, rules);
        focuses.forEach(f => allFocuses.add(f));
      }
    }

    // Verify each focus maps to a valid base focus that exists in split_muscle_group_mapping
    for (const focus of allFocuses) {
      const baseFocus = getBaseFocus(focus);
      expect(
        rules.split_muscle_group_mapping[baseFocus],
        `Focus type "${focus}" should map to base focus "${baseFocus}" which should be defined in split_muscle_group_mapping`
      ).toBeDefined();
    }
  });

  it('should have exactly 7 base focus types in split_muscle_group_mapping', () => {
    const expectedBaseFocuses = ['Full Body', 'Upper', 'Lower', 'Push', 'Pull', 'Legs', 'Mobility'];
    const actualKeys = Object.keys(rules.split_muscle_group_mapping).filter(k => k !== 'description');

    expect(actualKeys.sort()).toEqual(expectedBaseFocuses.sort());
  });
});

describe('Progression Derivation (Phase 4)', () => {

  describe('getProgressionFromGoal()', () => {

    describe('goal-based derivation for strength/bodyweight', () => {
      it('should return linear for build_muscle goal', () => {
        expect(getProgressionFromGoal('build_muscle', 'strength', rules)).toBe('linear');
        expect(getProgressionFromGoal('build_muscle', 'bodyweight', rules)).toBe('linear');
      });

      it('should return volume for tone goal', () => {
        expect(getProgressionFromGoal('tone', 'strength', rules)).toBe('volume');
        expect(getProgressionFromGoal('tone', 'bodyweight', rules)).toBe('volume');
      });

      it('should return density for lose_weight goal', () => {
        expect(getProgressionFromGoal('lose_weight', 'strength', rules)).toBe('density');
        expect(getProgressionFromGoal('lose_weight', 'bodyweight', rules)).toBe('density');
      });
    });

    describe('static progression for mobility/flexibility/cardio', () => {
      it('should return static for mobility regardless of goal', () => {
        expect(getProgressionFromGoal('build_muscle', 'mobility', rules)).toBe('static');
        expect(getProgressionFromGoal('tone', 'mobility', rules)).toBe('static');
        expect(getProgressionFromGoal('lose_weight', 'mobility', rules)).toBe('static');
      });

      it('should return static for flexibility regardless of goal', () => {
        expect(getProgressionFromGoal('build_muscle', 'flexibility', rules)).toBe('static');
        expect(getProgressionFromGoal('tone', 'flexibility', rules)).toBe('static');
        expect(getProgressionFromGoal('lose_weight', 'flexibility', rules)).toBe('static');
      });

      it('should return static for cardio regardless of goal', () => {
        expect(getProgressionFromGoal('build_muscle', 'cardio', rules)).toBe('static');
        expect(getProgressionFromGoal('tone', 'cardio', rules)).toBe('static');
        expect(getProgressionFromGoal('lose_weight', 'cardio', rules)).toBe('static');
      });
    });

    describe('compound categories architectural note', () => {
      /**
       * Note: Compound exercise categories (emom, amrap, circuit, interval) are NOT handled
       * by getProgressionFromGoal(). Instead, they get their progression hardcoded as 'density'
       * in constructCompoundExercise() in exercise-selector.ts (line ~824).
       *
       * This function is only called for individual exercises (strength, bodyweight) via
       * selectStrengthExercise(). The tests below verify this by documenting what would happen
       * if compound categories were erroneously passed - they'd get goal-based progression,
       * but this code path is never executed in production.
       */
      it('should note that compound categories get density from constructCompoundExercise, not this function', () => {
        // This is an architectural documentation test
        // In production, compound exercises (emom/amrap/circuit/interval) get 'density' progression
        // hardcoded in constructCompoundExercise(), NOT from this function.
        //
        // If erroneously called with compound categories, the function falls through to goal-based
        // progression since the defensive check was removed (dead code cleanup per ticket #013).
        expect(getProgressionFromGoal('build_muscle', 'emom', rules)).toBe('linear'); // Would be 'density' via constructCompoundExercise
        expect(getProgressionFromGoal('tone', 'amrap', rules)).toBe('volume'); // Would be 'density' via constructCompoundExercise
        expect(getProgressionFromGoal('lose_weight', 'circuit', rules)).toBe('density'); // Matches by coincidence (lose_weight -> density)
      });
    });

    describe('error handling', () => {
      it('should throw error for invalid goal', () => {
        expect(() => {
          // @ts-expect-error Testing invalid input
          getProgressionFromGoal('invalid_goal', 'strength', rules);
        }).toThrow(/No progression configured for goal/);
      });
    });
  });
});
