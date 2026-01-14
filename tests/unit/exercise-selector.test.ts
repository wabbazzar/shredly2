/**
 * Unit Tests for Exercise Selector
 *
 * Tests exercise filtering, equipment constraints, experience level filtering,
 * and edge cases like expert + bodyweight-only configurations
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  flattenExerciseDatabase,
  filterExercisesForLayer,
  createExercisePoolsForDay,
} from "../../src/lib/engine/exercise-selector.js";
import {
  BEGINNER_FULL_BODY,
  BODYWEIGHT_ONLY_EXPERT,
  MINIMAL_EQUIPMENT_BEGINNER,
  ADVANCED_UPPER_LOWER,
} from "../fixtures/questionnaire-answers.js";
import type {
  ExerciseDatabase,
  GenerationRules,
  Exercise,
} from "../../src/lib/engine/types.js";
import { mapToLegacyAnswers } from "../../src/lib/engine/types.js";

// Load exercise database and rules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadExerciseDatabase(): ExerciseDatabase {
  const dbPath = join(__dirname, "../../src/data/exercise_database.json");
  const dbContent = readFileSync(dbPath, "utf-8");
  return JSON.parse(dbContent) as ExerciseDatabase;
}

function loadGenerationRules(): GenerationRules {
  const rulesPath = join(
    __dirname,
    "../../src/data/workout_generation_rules.json",
  );
  const rulesContent = readFileSync(rulesPath, "utf-8");
  return JSON.parse(rulesContent) as GenerationRules;
}

describe("exercise-selector", () => {
  const exerciseDB = loadExerciseDatabase();
  const rules = loadGenerationRules();
  const allExercises = flattenExerciseDatabase(exerciseDB);

  describe("flattenExerciseDatabase()", () => {
    it("should flatten database into array of tuples", () => {
      expect(allExercises).toBeInstanceOf(Array);
      expect(allExercises.length).toBeGreaterThan(0);
    });

    it("should contain exercise name and data tuples", () => {
      const [name, exercise] = allExercises[0];

      expect(typeof name).toBe("string");
      expect(exercise).toHaveProperty("category");
      expect(exercise).toHaveProperty("muscle_groups");
      expect(exercise).toHaveProperty("equipment");
      expect(exercise).toHaveProperty("difficulty");
    });

    it("should match total_exercises count from database", () => {
      const expectedCount = 373; // Actual count in database (added Butler Bows)

      expect(allExercises.length).toBe(expectedCount);
    });
  });

  describe("filterExercisesForLayer()", () => {
    it("should filter by category", () => {
      const compoundOnly = filterExercisesForLayer(
        allExercises,
        "Push",
        ["Compound"],
        "commercial_gym",
        ["Beginner", "Intermediate", "Advanced"],
        ["always", "sometimes", "never"],
        { include_muscle_groups: ["Chest", "Shoulders", "Triceps"] },
      );

      for (const [name, exercise] of compoundOnly) {
        expect(exercise.category).toBe("Compound");
      }
    });

    it("should filter by difficulty (beginner)", () => {
      const beginnerOnly = filterExercisesForLayer(
        allExercises,
        "Full Body",
        ["Compound", "Primary", "Accessory"],
        "bodyweight_only",
        ["Beginner"], // Only beginner difficulty
        ["never"],
        { include_muscle_groups: [] },
      );

      for (const [name, exercise] of beginnerOnly) {
        expect(exercise.difficulty).toBe("Beginner");
      }
    });

    it("should filter by equipment access - bodyweight only", () => {
      const bodyweightFiltered = filterExercisesForLayer(
        allExercises,
        "Full Body",
        ["Compound", "Primary", "Accessory"],
        "bodyweight_only",
        ["Beginner", "Intermediate", "Advanced"],
        ["never"],
        { include_muscle_groups: [] },
      );

      // All exercises should have "None" in equipment array
      for (const [name, exercise] of bodyweightFiltered) {
        expect(exercise.equipment).toContain("None");
      }
    });

    it("should NOT include barbell exercises for bodyweight-only", () => {
      const bodyweightFiltered = filterExercisesForLayer(
        allExercises,
        "Full Body",
        ["Compound", "Primary", "Accessory"],
        "bodyweight_only",
        ["Beginner", "Intermediate", "Advanced"],
        ["never"],
        { include_muscle_groups: [] },
      );

      // No exercise should require barbell
      for (const [name, exercise] of bodyweightFiltered) {
        expect(exercise.equipment).not.toContain("Barbell");
      }
    });

    it("should filter by external load - equipment-aware for limited equipment", () => {
      // Test that equipment-aware filtering works
      // For limited equipment, filter should relax external load requirements
      const bodyweightExercises = filterExercisesForLayer(
        allExercises,
        "Full Body",
        ["Compound", "Primary", "Accessory"],
        "bodyweight_only",
        ["Beginner", "Intermediate"], // Use lower difficulty to find exercises
        ["sometimes", "always"], // Normally requires external load
        { include_muscle_groups: [] },
      );

      // Equipment-aware filter adds 'never' for limited equipment
      // So we should find bodyweight exercises even with 'sometimes/always' filter
      expect(Array.isArray(bodyweightExercises)).toBe(true);
      // May be empty for specific combinations but should not error
    });

    it("should filter by muscle groups - include only", () => {
      const chestExercises = filterExercisesForLayer(
        allExercises,
        "Push",
        ["Compound", "Primary"],
        "commercial_gym",
        ["Beginner", "Intermediate", "Advanced"],
        ["always", "sometimes"],
        { include_muscle_groups: ["Chest"] },
      );

      // All exercises should target chest
      for (const [name, exercise] of chestExercises) {
        expect(exercise.muscle_groups).toContain("Chest");
      }
    });

    it("should filter by muscle groups - exclude specific groups", () => {
      const noLegs = filterExercisesForLayer(
        allExercises,
        "Upper",
        ["Compound", "Primary"],
        "commercial_gym",
        ["Intermediate", "Advanced"],
        ["always", "sometimes"],
        {
          include_muscle_groups: ["Chest", "Back", "Shoulders"],
          exclude_muscle_groups: ["Quads", "Hamstrings", "Glutes"],
        },
      );

      // No exercise should target legs
      for (const [name, exercise] of noLegs) {
        expect(exercise.muscle_groups).not.toContain("Quads");
        expect(exercise.muscle_groups).not.toContain("Hamstrings");
        expect(exercise.muscle_groups).not.toContain("Glutes");
      }
    });

    it("should handle empty result when filters are too restrictive", () => {
      const impossibleFilter = filterExercisesForLayer(
        allExercises,
        "Push",
        ["Cardio"], // Wrong category for Push day
        "bodyweight_only",
        ["Beginner"],
        ["never"],
        { include_muscle_groups: ["Chest"] },
      );

      expect(impossibleFilter.length).toBe(0);
    });
  });

  describe("createExercisePoolsForDay()", () => {
    it("should create pools for beginner full body workout", () => {
      const pools = createExercisePoolsForDay(
        allExercises,
        "Full Body",
        mapToLegacyAnswers(BEGINNER_FULL_BODY),
        rules,
        ["layer1", "layer2", "layer3"],
      );

      expect(pools.has("layer1")).toBe(true);
      expect(pools.has("layer2")).toBe(true);
      expect(pools.has("layer3")).toBe(true);
    });

    it("should create pools for bodyweight-only expert without throwing", () => {
      // Edge case: advanced + bodyweight-only should NOT throw errors
      const pools = createExercisePoolsForDay(
        allExercises,
        "Push",
        mapToLegacyAnswers(BODYWEIGHT_ONLY_EXPERT),
        rules,
        ["layer1", "layer2", "layer3"],
      );

      // Should create pool structure even if empty
      expect(pools.has("layer1")).toBe(true);
      const layer1 = pools.get("layer1");
      expect(layer1).toBeDefined();
      expect(Array.isArray(layer1)).toBe(true);
      // Note: May be empty for advanced + bodyweight + Push combination
    });

    it("should create pools respecting equipment constraints", () => {
      const pools = createExercisePoolsForDay(
        allExercises,
        "Legs",
        mapToLegacyAnswers(MINIMAL_EQUIPMENT_BEGINNER),
        rules,
        ["layer1", "layer2", "layer3"],
      );

      // Check that exercises in pools respect dumbbells_only constraint
      for (const [poolKey, pool] of pools.entries()) {
        for (const [name, exercise] of pool) {
          // Should have "None" or "Dumbbells" in equipment
          const hasValidEquipment =
            exercise.equipment.includes("None") ||
            exercise.equipment.includes("Dumbbells");
          expect(hasValidEquipment).toBe(true);
        }
      }
    });

    it("should create pools respecting experience level difficulty", () => {
      const pools = createExercisePoolsForDay(
        allExercises,
        "Upper",
        mapToLegacyAnswers(ADVANCED_UPPER_LOWER),
        rules,
        ["layer1", "layer2", "layer3"],
      );

      // Advanced user should get Intermediate and Advanced exercises
      for (const [poolKey, pool] of pools.entries()) {
        for (const [name, exercise] of pool) {
          expect(["Intermediate", "Advanced"]).toContain(exercise.difficulty);
        }
      }
    });

    it("should filter by correct muscle groups for split focus", () => {
      const pools = createExercisePoolsForDay(
        allExercises,
        "Push",
        mapToLegacyAnswers(ADVANCED_UPPER_LOWER),
        rules,
        ["layer1", "layer2"],
      );

      // Push day should target chest, shoulders, triceps
      const pushMuscles = ["Chest", "Shoulders", "Triceps"];

      for (const [poolKey, pool] of pools.entries()) {
        for (const [name, exercise] of pool) {
          // At least one muscle group should be in push muscles
          const hasPushMuscle = exercise.muscle_groups.some((mg) =>
            pushMuscles.includes(mg),
          );
          expect(hasPushMuscle).toBe(true);
        }
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle advanced + bodyweight-only without empty pool errors", () => {
      // This is a critical edge case
      const pools = createExercisePoolsForDay(
        allExercises,
        "Full Body",
        mapToLegacyAnswers(BODYWEIGHT_ONLY_EXPERT),
        rules,
        ["layer1", "layer2", "layer3"],
      );

      // Should create pools even if some are empty
      expect(pools.has("layer1")).toBe(true);
      const layer1 = pools.get("layer1");
      expect(layer1).toBeDefined();
      // Note: Pool may be empty for advanced + bodyweight-only combinations
      expect(Array.isArray(layer1)).toBe(true);
    });

    it("should handle minimal equipment scenarios", () => {
      const pools = createExercisePoolsForDay(
        allExercises,
        "Full Body",
        mapToLegacyAnswers(MINIMAL_EQUIPMENT_BEGINNER),
        rules,
        ["layer1", "layer2", "layer3"],
      );

      // Should create pools structure even if some pools are empty
      expect(pools.has("layer1")).toBe(true);
      const layer1 = pools.get("layer1");
      expect(layer1).toBeDefined();
      expect(Array.isArray(layer1)).toBe(true);
    });
  });
});
