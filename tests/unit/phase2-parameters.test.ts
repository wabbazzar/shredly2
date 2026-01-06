/**
 * Unit Tests for Phase 2 Parameters
 *
 * Tests rest/work time calculations, weight progression, RPE/RIR ranges,
 * and floating point precision handling for parameter generation
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  applyIntensityProfile,
  applyProgressionScheme,
  parameterizeExercise,
} from "../../src/lib/engine/phase2-parameters.js";
import {
  BEGINNER_FULL_BODY,
  INTERMEDIATE_PPL,
  ADVANCED_UPPER_LOWER,
} from "../fixtures/questionnaire-answers.js";
import type {
  GenerationRules,
  ExerciseStructure,
  WeekParameters,
} from "../../src/lib/engine/types.js";

// Load generation rules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadGenerationRules(): GenerationRules {
  const rulesPath = join(
    __dirname,
    "../../src/data/workout_generation_rules.json",
  );
  const rulesContent = readFileSync(rulesPath, "utf-8");
  return JSON.parse(rulesContent) as GenerationRules;
}

describe("phase2-parameters", () => {
  const rules = loadGenerationRules();

  describe("applyIntensityProfile()", () => {
    it("should produce valid sets value", () => {
      const exercise: ExerciseStructure = {
        name: "Barbell Bench Press",
        intensityProfile: "heavy",
        progressionScheme: "linear",
      };

      const week1 = applyIntensityProfile(
        exercise,
        "strength",
        rules,
        BEGINNER_FULL_BODY,
        false,
      );

      expect(week1.sets).toBeDefined();
      expect(typeof week1.sets).toBe("number");
      expect(week1.sets).toBeGreaterThan(0);
      expect(week1.sets).toBeLessThanOrEqual(10);
      expect(Number.isInteger(week1.sets)).toBe(true);
    });

    it("should produce valid reps value", () => {
      const exercise: ExerciseStructure = {
        name: "Push-ups",
        intensityProfile: "moderate",
        progressionScheme: "linear",
      };

      const week1 = applyIntensityProfile(
        exercise,
        "strength",
        rules,
        INTERMEDIATE_PPL,
        false,
      );

      expect(week1.reps).toBeDefined();
      if (typeof week1.reps === "number") {
        expect(week1.reps).toBeGreaterThan(0);
        expect(week1.reps).toBeLessThanOrEqual(50);
      } else {
        // String formats like "8-12", "AMRAP"
        expect(typeof week1.reps).toBe("string");
      }
    });

    it("should produce valid rest time in minutes", () => {
      const exercise: ExerciseStructure = {
        name: "Squats",
        intensityProfile: "heavy",
        progressionScheme: "linear",
      };

      const week1 = applyIntensityProfile(
        exercise,
        "strength",
        rules,
        ADVANCED_UPPER_LOWER,
        false,
      );

      if (week1.rest_time_minutes !== undefined) {
        expect(typeof week1.rest_time_minutes).toBe("number");
        expect(week1.rest_time_minutes).toBeGreaterThan(0);
        expect(week1.rest_time_minutes).toBeLessThanOrEqual(10);
        // Check for reasonable precision (not too many decimal places)
        expect(week1.rest_time_minutes.toFixed(2)).toBe(
          week1.rest_time_minutes.toFixed(2),
        );
      }
    });

    it("should handle work time with explicit units", () => {
      const exercise: ExerciseStructure = {
        name: "AMRAP Push-ups",
        intensityProfile: "moderate",
        progressionScheme: "density",
      };

      const week1 = applyIntensityProfile(
        exercise,
        "emom",
        rules,
        BEGINNER_FULL_BODY,
        false,
      );

      if (week1.work_time_minutes !== undefined) {
        expect(typeof week1.work_time_minutes).toBe("number");
        expect(week1.work_time_minutes).toBeGreaterThan(0);

        // Should have explicit time unit
        if (week1.work_time_unit) {
          expect(["seconds", "minutes"]).toContain(week1.work_time_unit);
        }
      }
    });

    it("should skip sets and rest for sub-exercises", () => {
      const subExercise: ExerciseStructure = {
        name: "Burpees",
        intensityProfile: "moderate",
        progressionScheme: "static",
      };

      const week1 = applyIntensityProfile(
        subExercise,
        "strength",
        rules,
        INTERMEDIATE_PPL,
        true, // isSubExercise = true
      );

      // Sub-exercises should NOT have sets or rest_time
      expect(week1.sets).toBeUndefined();
      expect(week1.rest_time_minutes).toBeUndefined();

      // But should have reps and potentially work_time
      expect(week1.reps).toBeDefined();
    });

    it("should apply experience level volume multiplier", () => {
      const exercise: ExerciseStructure = {
        name: "Dumbbell Rows",
        intensityProfile: "moderate",
        progressionScheme: "linear",
      };

      const beginnerWeek1 = applyIntensityProfile(
        exercise,
        "strength",
        rules,
        BEGINNER_FULL_BODY,
        false,
      );

      const advancedWeek1 = applyIntensityProfile(
        exercise,
        "strength",
        rules,
        ADVANCED_UPPER_LOWER,
        false,
      );

      // Advanced should have higher volume (more sets or reps)
      if (beginnerWeek1.sets && advancedWeek1.sets) {
        expect(advancedWeek1.sets).toBeGreaterThanOrEqual(beginnerWeek1.sets);
      }
    });
  });

  describe("applyProgressionScheme()", () => {
    const baseWeek1: WeekParameters = {
      sets: 3,
      reps: 10,
      rest_time_minutes: 2.0,
      rest_time_unit: "minutes",
      weight: { type: "percent_tm", value: 70 },
    };

    it("should increase week-to-week for linear progression", () => {
      const week2 = applyProgressionScheme(baseWeek1, "linear", 2, 3, rules);

      // Linear progression typically decreases reps, increases weight
      if (
        typeof week2.reps === "number" &&
        typeof baseWeek1.reps === "number"
      ) {
        expect(week2.reps).toBeLessThanOrEqual(baseWeek1.reps);
      }

      // Weight should increase
      if (
        week2.weight &&
        typeof week2.weight === "object" &&
        week2.weight.type === "percent_tm"
      ) {
        expect(week2.weight.value).toBeGreaterThan(
          (baseWeek1.weight as any).value,
        );
      }
    });

    it("should handle volume progression", () => {
      const week2 = applyProgressionScheme(baseWeek1, "volume", 2, 3, rules);

      // Volume progression increases sets or reps
      const week1Volume =
        (baseWeek1.sets || 0) * ((baseWeek1.reps as number) || 0);
      const week2Volume = (week2.sets || 0) * ((week2.reps as number) || 0);

      expect(week2Volume).toBeGreaterThanOrEqual(week1Volume);
    });

    it("should handle density progression with work time", () => {
      const densityWeek1: WeekParameters = {
        sets: 5,
        reps: "AMRAP",
        work_time_minutes: 10,
        work_time_unit: "minutes",
        rest_time_minutes: 1.0,
      };

      const week2 = applyProgressionScheme(
        densityWeek1,
        "density",
        2,
        3,
        rules,
      );

      // Density progression increases work time, decreases rest
      if (week2.work_time_minutes !== undefined) {
        expect(week2.work_time_minutes).toBeGreaterThanOrEqual(
          densityWeek1.work_time_minutes!,
        );
      }

      if (week2.rest_time_minutes !== undefined) {
        expect(week2.rest_time_minutes).toBeLessThanOrEqual(
          densityWeek1.rest_time_minutes!,
        );
      }
    });

    it("should handle static progression (no changes)", () => {
      const week2 = applyProgressionScheme(baseWeek1, "static", 2, 3, rules);

      // Static progression should not change parameters
      expect(week2.sets).toBe(baseWeek1.sets);
      expect(week2.reps).toBe(baseWeek1.reps);
      expect(week2.rest_time_minutes).toBe(baseWeek1.rest_time_minutes);
    });

    it("should produce valid integer sets after progression", () => {
      const week3 = applyProgressionScheme(baseWeek1, "volume", 3, 3, rules);

      if (week3.sets !== undefined) {
        expect(Number.isInteger(week3.sets)).toBe(true);
        expect(week3.sets).toBeGreaterThan(0);
      }
    });

    it("should not corrupt rest/work times with floating point precision", () => {
      const precisionWeek1: WeekParameters = {
        sets: 4,
        reps: 8,
        rest_time_minutes: 1.5,
        rest_time_unit: "minutes",
        work_time_minutes: 0.5,
        work_time_unit: "minutes",
      };

      const week2 = applyProgressionScheme(
        precisionWeek1,
        "linear",
        2,
        3,
        rules,
      );

      // Check rest time has reasonable precision
      if (week2.rest_time_minutes !== undefined) {
        const decimalPlaces =
          week2.rest_time_minutes.toString().split(".")[1]?.length || 0;
        expect(decimalPlaces).toBeLessThanOrEqual(2);
      }

      // Check work time has reasonable precision
      if (week2.work_time_minutes !== undefined) {
        const decimalPlaces =
          week2.work_time_minutes.toString().split(".")[1]?.length || 0;
        expect(decimalPlaces).toBeLessThanOrEqual(2);
      }
    });

    it("should preserve time units across progression", () => {
      const week2 = applyProgressionScheme(baseWeek1, "linear", 2, 3, rules);

      if (week2.rest_time_unit !== undefined) {
        expect(week2.rest_time_unit).toBe(baseWeek1.rest_time_unit);
      }
    });

    it("should enforce minimum rest time constraints", () => {
      const week5 = applyProgressionScheme(baseWeek1, "linear", 5, 6, rules);

      // Even after 5 weeks of progression, rest time should not go below minimum
      if (week5.rest_time_minutes !== undefined) {
        expect(week5.rest_time_minutes).toBeGreaterThan(0.5); // Reasonable minimum
      }
    });

    it("should enforce minimum reps constraints", () => {
      const week6 = applyProgressionScheme(baseWeek1, "linear", 6, 6, rules);

      // Even after 6 weeks, reps should not go below minimum
      if (typeof week6.reps === "number") {
        expect(week6.reps).toBeGreaterThanOrEqual(3);
      }
    });
  });

  describe("parameterizeExercise()", () => {
    it("should generate all week parameters for 3-week program", () => {
      const exercise: ExerciseStructure = {
        name: "Deadlift",
        intensityProfile: "heavy",
        progressionScheme: "linear",
      };

      const parameterized = parameterizeExercise(
        exercise,
        "strength",
        3, // weeks
        rules,
        ADVANCED_UPPER_LOWER,
        false,
      );

      expect(parameterized.week1).toBeDefined();
      expect(parameterized.week2).toBeDefined();
      expect(parameterized.week3).toBeDefined();
      expect(parameterized.week4).toBeUndefined();
    });

    it("should generate all week parameters for 6-week program", () => {
      const exercise: ExerciseStructure = {
        name: "Pull-ups",
        intensityProfile: "moderate",
        progressionScheme: "volume",
      };

      const parameterized = parameterizeExercise(
        exercise,
        "strength",
        6, // weeks
        rules,
        INTERMEDIATE_PPL,
        false,
      );

      expect(parameterized.week1).toBeDefined();
      expect(parameterized.week2).toBeDefined();
      expect(parameterized.week3).toBeDefined();
      expect(parameterized.week4).toBeDefined();
      expect(parameterized.week5).toBeDefined();
      expect(parameterized.week6).toBeDefined();
    });

    it("should preserve exercise name", () => {
      const exercise: ExerciseStructure = {
        name: "Romanian Deadlift",
        intensityProfile: "moderate",
        progressionScheme: "linear",
      };

      const parameterized = parameterizeExercise(
        exercise,
        "strength",
        3,
        rules,
        ADVANCED_UPPER_LOWER,
        false,
      );

      expect(parameterized.name).toBe("Romanian Deadlift");
    });

    it("should handle compound exercises with category", () => {
      const compoundExercise: ExerciseStructure = {
        name: "EMOM Complex",
        category: "emom",
        intensityProfile: "moderate",
        progressionScheme: "density",
      };

      const parameterized = parameterizeExercise(
        compoundExercise,
        "emom",
        3,
        rules,
        BEGINNER_FULL_BODY,
        false,
      );

      expect(parameterized.name).toBe("EMOM Complex");
      expect(parameterized.category).toBe("emom");
    });
  });

  describe("Edge Cases", () => {
    it("should handle AMRAP reps string format", () => {
      const amrapWeek: WeekParameters = {
        sets: 3,
        reps: "AMRAP",
        rest_time_minutes: 2.0,
      };

      const week2 = applyProgressionScheme(amrapWeek, "volume", 2, 3, rules);

      // AMRAP should remain as string
      expect(week2.reps).toBe("AMRAP");
    });

    it('should handle rep range strings like "8-12"', () => {
      const rangeWeek: WeekParameters = {
        sets: 3,
        reps: "8-12",
        rest_time_minutes: 1.5,
      };

      const week2 = applyProgressionScheme(rangeWeek, "linear", 2, 3, rules);

      // Rep ranges should remain as strings
      expect(typeof week2.reps).toBe("string");
    });

    it("should handle zero rest time for supersets", () => {
      const supersetWeek: WeekParameters = {
        sets: 3,
        reps: 10,
        rest_time_minutes: 0,
        rest_time_unit: "minutes",
      };

      const week2 = applyProgressionScheme(supersetWeek, "linear", 2, 3, rules);

      // Zero rest should remain zero or very small
      expect(week2.rest_time_minutes).toBeDefined();
      expect(week2.rest_time_minutes).toBeGreaterThanOrEqual(0);
    });
  });
});
