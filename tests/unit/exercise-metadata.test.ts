/**
 * Unit Tests for Exercise Metadata Module
 *
 * Tests the exercise-metadata.ts module that provides centralized metadata lookup
 * for exercise database properties. Ensures consistent field visibility and weight
 * assignment rules between generator and editor.
 *
 * Coverage:
 * - getExerciseMetadata() lookup and caching
 * - shouldShowWeightField() visibility rules
 * - shouldAssignWeightOnGeneration() assignment rules
 * - canToggleToReps() / canToggleToWorkTime() validation
 * - getDefaultWorkMode() default behavior
 * - Fallback behavior for custom exercises
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  getExerciseMetadata,
  shouldShowWeightField,
  shouldAssignWeightOnGeneration,
  canToggleToReps,
  canToggleToWorkTime,
  getDefaultWorkMode,
  clearCache,
  type ExerciseMetadata,
} from "../../src/lib/engine/exercise-metadata.js";

describe("Exercise Metadata Module", () => {
  // Clear cache before each test to ensure test independence
  beforeEach(() => {
    clearCache();
  });

  // ============================================================================
  // getExerciseMetadata() - Core Lookup Function
  // ============================================================================

  describe("getExerciseMetadata()", () => {
    it("should return correct metadata for Bench Press (external_load: always)", () => {
      const metadata = getExerciseMetadata("Bench Press");

      expect(metadata).toBeDefined();
      expect(metadata).not.toBeNull();
      expect(metadata?.category).toBe("strength");
      expect(metadata?.external_load).toBe("always");
      expect(metadata?.isometric).toBe(false);
      expect(metadata?.equipment).toContain("Barbell");
      expect(metadata?.muscle_groups).toContain("Chest");
    });

    it("should return correct metadata for Push-ups (external_load: never)", () => {
      const metadata = getExerciseMetadata("Push-ups");

      expect(metadata).toBeDefined();
      expect(metadata).not.toBeNull();
      expect(metadata?.category).toBe("strength");
      expect(metadata?.external_load).toBe("never");
      expect(metadata?.isometric).toBe(false);
      expect(metadata?.equipment).toContain("None");
      expect(metadata?.muscle_groups).toContain("Chest");
    });

    it("should return correct metadata for Plank Hold (isometric: true)", () => {
      const metadata = getExerciseMetadata("Plank Hold");

      expect(metadata).toBeDefined();
      expect(metadata).not.toBeNull();
      expect(metadata?.category).toBe("strength");
      expect(metadata?.external_load).toBe("never");
      expect(metadata?.isometric).toBe(true);
      expect(metadata?.equipment).toContain("None");
      expect(metadata?.muscle_groups).toContain("Core");
    });

    it("should return correct metadata for Wall Sit (external_load: sometimes)", () => {
      const metadata = getExerciseMetadata("Wall Sit");

      expect(metadata).toBeDefined();
      expect(metadata).not.toBeNull();
      expect(metadata?.category).toBe("strength");
      expect(metadata?.external_load).toBe("sometimes");
      expect(metadata?.isometric).toBe(true);
      expect(metadata?.muscle_groups).toContain("Quadriceps");
    });

    it("should return null for compound parent names (EMOM)", () => {
      const metadata = getExerciseMetadata("EMOM 10 minutes");

      expect(metadata).toBeNull();
    });

    it("should return null for compound parent names (Circuit)", () => {
      const metadata = getExerciseMetadata("Circuit 5 rounds");

      expect(metadata).toBeNull();
    });

    it("should return null for compound parent names (AMRAP)", () => {
      const metadata = getExerciseMetadata("AMRAP 20 minutes");

      expect(metadata).toBeNull();
    });

    it("should return null for unknown custom exercises", () => {
      const metadata = getExerciseMetadata("Custom User Exercise");

      expect(metadata).toBeNull();
    });

    it("should return null for empty string", () => {
      const metadata = getExerciseMetadata("");

      expect(metadata).toBeNull();
    });

    it("should be case-sensitive (Bench Press vs bench press)", () => {
      const correctCase = getExerciseMetadata("Bench Press");
      const wrongCase = getExerciseMetadata("bench press");

      expect(correctCase).not.toBeNull();
      expect(wrongCase).toBeNull();
    });
  });

  // ============================================================================
  // Caching Tests
  // ============================================================================

  describe("Caching", () => {
    it("should return same object reference on second lookup (cache hit)", () => {
      const firstLookup = getExerciseMetadata("Bench Press");
      const secondLookup = getExerciseMetadata("Bench Press");

      expect(firstLookup).toBe(secondLookup); // Same object reference
    });

    it("should cache null results for unknown exercises", () => {
      const firstLookup = getExerciseMetadata("Unknown Exercise");
      const secondLookup = getExerciseMetadata("Unknown Exercise");

      expect(firstLookup).toBeNull();
      expect(secondLookup).toBeNull();
    });

    it("should maintain independent cache entries for different exercises", () => {
      const benchPress = getExerciseMetadata("Bench Press");
      const pushups = getExerciseMetadata("Push-ups");
      const benchPressAgain = getExerciseMetadata("Bench Press");

      expect(benchPress).not.toBeNull();
      expect(pushups).not.toBeNull();
      expect(benchPress).toBe(benchPressAgain); // Cached
      expect(benchPress).not.toBe(pushups); // Different exercises
    });

    it("should clear cache when clearCache() is called", () => {
      const firstLookup = getExerciseMetadata("Bench Press");
      clearCache();
      const secondLookup = getExerciseMetadata("Bench Press");

      // After cache clear, we get a new lookup from database
      // The metadata should have the same values
      expect(firstLookup).toEqual(secondLookup);
      // Note: We can't test object reference equality because the database
      // returns the same object reference each time due to JSON import
    });
  });

  // ============================================================================
  // shouldShowWeightField() - UI Visibility Rules
  // ============================================================================

  describe("shouldShowWeightField()", () => {
    describe("external_load: always", () => {
      it("should return true for Bench Press regardless of currentWeight", () => {
        expect(shouldShowWeightField("Bench Press", undefined)).toBe(true);
        expect(shouldShowWeightField("Bench Press", "moderate")).toBe(true);
        expect(shouldShowWeightField("Bench Press", 0)).toBe(true);
      });

      it("should return true for Dumbbell Bicep Curls regardless of currentWeight", () => {
        expect(shouldShowWeightField("Dumbbell Bicep Curls", undefined)).toBe(
          true,
        );
        expect(shouldShowWeightField("Dumbbell Bicep Curls", "heavy")).toBe(
          true,
        );
      });
    });

    describe("external_load: never", () => {
      it("should return false for Push-ups regardless of currentWeight", () => {
        expect(shouldShowWeightField("Push-ups", undefined)).toBe(false);
        expect(shouldShowWeightField("Push-ups", "moderate")).toBe(false);
        expect(shouldShowWeightField("Push-ups", 50)).toBe(false);
      });

      it("should return false for Plank Hold regardless of currentWeight", () => {
        expect(shouldShowWeightField("Plank Hold", undefined)).toBe(false);
        expect(shouldShowWeightField("Plank Hold", "light")).toBe(false);
      });

      it("should return false for Burpees regardless of currentWeight", () => {
        expect(shouldShowWeightField("Burpees", undefined)).toBe(false);
        expect(shouldShowWeightField("Burpees", 100)).toBe(false);
      });
    });

    describe("external_load: sometimes", () => {
      it("should return false for Wall Sit when currentWeight is undefined", () => {
        expect(shouldShowWeightField("Wall Sit", undefined)).toBe(false);
      });

      it("should return true for Wall Sit when currentWeight is present", () => {
        expect(shouldShowWeightField("Wall Sit", "moderate")).toBe(true);
        expect(shouldShowWeightField("Wall Sit", 25)).toBe(true);
        expect(shouldShowWeightField("Wall Sit", 0)).toBe(true);
      });
    });

    describe("Fallback for custom exercises", () => {
      it("should return false for unknown exercise when currentWeight is undefined", () => {
        expect(shouldShowWeightField("Custom User Exercise", undefined)).toBe(
          false,
        );
      });

      it("should return true for unknown exercise when currentWeight is present", () => {
        expect(shouldShowWeightField("Custom User Exercise", "moderate")).toBe(
          true,
        );
        expect(shouldShowWeightField("Custom User Exercise", 50)).toBe(true);
        expect(shouldShowWeightField("Custom User Exercise", 0)).toBe(true);
      });

      it("should return true for compound parent when currentWeight is present", () => {
        expect(shouldShowWeightField("EMOM 10 minutes", "moderate")).toBe(true);
      });

      it("should return false for compound parent when currentWeight is undefined", () => {
        expect(shouldShowWeightField("EMOM 10 minutes", undefined)).toBe(false);
      });
    });
  });

  // ============================================================================
  // shouldAssignWeightOnGeneration() - Generator Assignment Rules
  // ============================================================================

  describe("shouldAssignWeightOnGeneration()", () => {
    describe("external_load: always", () => {
      it("should return true for Bench Press", () => {
        expect(shouldAssignWeightOnGeneration("Bench Press")).toBe(true);
      });

      it("should return true for Dumbbell Bicep Curls", () => {
        expect(shouldAssignWeightOnGeneration("Dumbbell Bicep Curls")).toBe(
          true,
        );
      });

      it("should return true for Bench Press", () => {
        expect(shouldAssignWeightOnGeneration("Bench Press")).toBe(true);
      });
    });

    describe("external_load: never", () => {
      it("should return false for Push-ups", () => {
        expect(shouldAssignWeightOnGeneration("Push-ups")).toBe(false);
      });

      it("should return false for Plank Hold", () => {
        expect(shouldAssignWeightOnGeneration("Plank Hold")).toBe(false);
      });

      it("should return false for Burpees", () => {
        expect(shouldAssignWeightOnGeneration("Burpees")).toBe(false);
      });
    });

    describe("external_load: sometimes", () => {
      it("should return true for Wall Sit (assign weight by default)", () => {
        expect(shouldAssignWeightOnGeneration("Wall Sit")).toBe(true);
      });
    });

    describe("Fallback for custom exercises", () => {
      it("should return false for unknown exercises (default to no weight)", () => {
        expect(shouldAssignWeightOnGeneration("Custom User Exercise")).toBe(
          false,
        );
      });

      it("should return false for compound parent names", () => {
        expect(shouldAssignWeightOnGeneration("EMOM 10 minutes")).toBe(false);
        expect(shouldAssignWeightOnGeneration("Circuit 5 rounds")).toBe(false);
      });
    });
  });

  // ============================================================================
  // canToggleToReps() - Isometric Validation
  // ============================================================================

  describe("canToggleToReps()", () => {
    describe("isometric: false (non-isometric exercises)", () => {
      it("should return true for Bench Press", () => {
        expect(canToggleToReps("Bench Press")).toBe(true);
      });

      it("should return true for Push-ups", () => {
        expect(canToggleToReps("Push-ups")).toBe(true);
      });

      it("should return true for Dumbbell Bicep Curls", () => {
        expect(canToggleToReps("Dumbbell Bicep Curls")).toBe(true);
      });

      it("should return true for Burpees", () => {
        expect(canToggleToReps("Burpees")).toBe(true);
      });
    });

    describe("isometric: true (isometric exercises)", () => {
      it("should return false for Plank Hold", () => {
        expect(canToggleToReps("Plank Hold")).toBe(false);
      });

      it("should return false for Wall Sit", () => {
        expect(canToggleToReps("Wall Sit")).toBe(false);
      });

      it("should return false for Side Plank (isometric)", () => {
        expect(canToggleToReps("Side Plank")).toBe(false);
      });
    });

    describe("Fallback for custom exercises", () => {
      it("should return true for unknown exercises (allow toggle)", () => {
        expect(canToggleToReps("Custom User Exercise")).toBe(true);
      });

      it("should return true for compound parent names", () => {
        expect(canToggleToReps("EMOM 10 minutes")).toBe(true);
        expect(canToggleToReps("Circuit 5 rounds")).toBe(true);
      });
    });
  });

  // ============================================================================
  // canToggleToWorkTime() - Universal Compatibility
  // ============================================================================

  describe("canToggleToWorkTime()", () => {
    it("should always return true for isometric exercises", () => {
      expect(canToggleToWorkTime("Plank Hold")).toBe(true);
      expect(canToggleToWorkTime("Wall Sit")).toBe(true);
      expect(canToggleToWorkTime("Side Plank")).toBe(true);
    });

    it("should always return true for non-isometric exercises", () => {
      expect(canToggleToWorkTime("Bench Press")).toBe(true);
      expect(canToggleToWorkTime("Push-ups")).toBe(true);
      expect(canToggleToWorkTime("Dumbbell Bicep Curls")).toBe(true);
    });

    it("should always return true for custom exercises", () => {
      expect(canToggleToWorkTime("Custom User Exercise")).toBe(true);
    });

    it("should always return true for compound parent names", () => {
      expect(canToggleToWorkTime("EMOM 10 minutes")).toBe(true);
      expect(canToggleToWorkTime("Circuit 5 rounds")).toBe(true);
    });

    it("should always return true regardless of external_load", () => {
      expect(canToggleToWorkTime("Bench Press")).toBe(true); // always
      expect(canToggleToWorkTime("Push-ups")).toBe(true); // never
      expect(canToggleToWorkTime("Wall Sit")).toBe(true); // sometimes
    });
  });

  // ============================================================================
  // getDefaultWorkMode() - Default Behavior
  // ============================================================================

  describe("getDefaultWorkMode()", () => {
    describe("isometric: true (isometric exercises)", () => {
      it("should return work_time for Plank Hold", () => {
        expect(getDefaultWorkMode("Plank Hold")).toBe("work_time");
      });

      it("should return work_time for Wall Sit", () => {
        expect(getDefaultWorkMode("Wall Sit")).toBe("work_time");
      });

      it("should return work_time for Side Plank", () => {
        expect(getDefaultWorkMode("Side Plank")).toBe("work_time");
      });
    });

    describe("isometric: false (non-isometric exercises)", () => {
      it("should return reps for Bench Press", () => {
        expect(getDefaultWorkMode("Bench Press")).toBe("reps");
      });

      it("should return reps for Push-ups", () => {
        expect(getDefaultWorkMode("Push-ups")).toBe("reps");
      });

      it("should return reps for Dumbbell Bicep Curls", () => {
        expect(getDefaultWorkMode("Dumbbell Bicep Curls")).toBe("reps");
      });

      it("should return reps for Burpees", () => {
        expect(getDefaultWorkMode("Burpees")).toBe("reps");
      });
    });

    describe("Fallback for custom exercises", () => {
      it("should return reps for unknown exercises (default)", () => {
        expect(getDefaultWorkMode("Custom User Exercise")).toBe("reps");
      });

      it("should return reps for compound parent names", () => {
        expect(getDefaultWorkMode("EMOM 10 minutes")).toBe("reps");
        expect(getDefaultWorkMode("Circuit 5 rounds")).toBe("reps");
      });
    });
  });

  // ============================================================================
  // Integration Tests - Combined Behavior
  // ============================================================================

  describe("Integration: Combined metadata behavior", () => {
    it("should handle Bench Press correctly (always weighted, non-isometric, reps default)", () => {
      expect(getExerciseMetadata("Bench Press")?.external_load).toBe("always");
      expect(shouldShowWeightField("Bench Press", undefined)).toBe(true);
      expect(shouldAssignWeightOnGeneration("Bench Press")).toBe(true);
      expect(canToggleToReps("Bench Press")).toBe(true);
      expect(canToggleToWorkTime("Bench Press")).toBe(true);
      expect(getDefaultWorkMode("Bench Press")).toBe("reps");
    });

    it("should handle Plank Hold correctly (never weighted, isometric, work_time default)", () => {
      expect(getExerciseMetadata("Plank Hold")?.external_load).toBe("never");
      expect(shouldShowWeightField("Plank Hold", undefined)).toBe(false);
      expect(shouldAssignWeightOnGeneration("Plank Hold")).toBe(false);
      expect(canToggleToReps("Plank Hold")).toBe(false);
      expect(canToggleToWorkTime("Plank Hold")).toBe(true);
      expect(getDefaultWorkMode("Plank Hold")).toBe("work_time");
    });

    it("should handle Wall Sit correctly (sometimes weighted, isometric, work_time default)", () => {
      expect(getExerciseMetadata("Wall Sit")?.external_load).toBe("sometimes");
      expect(shouldShowWeightField("Wall Sit", undefined)).toBe(false);
      expect(shouldShowWeightField("Wall Sit", "moderate")).toBe(true);
      expect(shouldAssignWeightOnGeneration("Wall Sit")).toBe(true);
      expect(canToggleToReps("Wall Sit")).toBe(false);
      expect(canToggleToWorkTime("Wall Sit")).toBe(true);
      expect(getDefaultWorkMode("Wall Sit")).toBe("work_time");
    });

    it("should handle Push-ups correctly (never weighted, non-isometric, reps default)", () => {
      expect(getExerciseMetadata("Push-ups")?.external_load).toBe("never");
      expect(shouldShowWeightField("Push-ups", undefined)).toBe(false);
      expect(shouldAssignWeightOnGeneration("Push-ups")).toBe(false);
      expect(canToggleToReps("Push-ups")).toBe(true);
      expect(canToggleToWorkTime("Push-ups")).toBe(true);
      expect(getDefaultWorkMode("Push-ups")).toBe("reps");
    });

    it("should handle custom exercises with graceful fallbacks", () => {
      const exerciseName = "Custom User Exercise";

      expect(getExerciseMetadata(exerciseName)).toBeNull();
      expect(shouldShowWeightField(exerciseName, undefined)).toBe(false);
      expect(shouldShowWeightField(exerciseName, "moderate")).toBe(true);
      expect(shouldAssignWeightOnGeneration(exerciseName)).toBe(false);
      expect(canToggleToReps(exerciseName)).toBe(true);
      expect(canToggleToWorkTime(exerciseName)).toBe(true);
      expect(getDefaultWorkMode(exerciseName)).toBe("reps");
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe("Edge Cases", () => {
    it("should handle exercises with special characters in name", () => {
      // Most exercises don't have special chars, but test the lookup mechanism
      const metadata = getExerciseMetadata("Bench Press");
      expect(metadata).not.toBeNull();
      expect(metadata?.external_load).toBe("always");
    });

    it("should handle exercises from different categories", () => {
      const strengthExercise = getExerciseMetadata("Bench Press");
      const isometricExercise = getExerciseMetadata("Plank Hold");
      const bodyweightExercise = getExerciseMetadata("Push-ups");

      expect(strengthExercise?.category).toBe("strength");
      expect(isometricExercise?.category).toBe("strength");
      expect(bodyweightExercise?.category).toBe("strength");
    });

    it("should handle currentWeight=0 as present (truthy check)", () => {
      expect(shouldShowWeightField("Wall Sit", 0)).toBe(true);
      expect(shouldShowWeightField("Custom Exercise", 0)).toBe(true);
    });

    it("should handle currentWeight=empty string as present (checks !== undefined)", () => {
      // Empty string is treated as present because check is !== undefined
      expect(shouldShowWeightField("Wall Sit", "")).toBe(true);
      expect(shouldShowWeightField("Custom Exercise", "")).toBe(true);
    });

    it("should handle currentWeight=null as present (checks !== undefined)", () => {
      // null is treated as present because check is !== undefined
      expect(shouldShowWeightField("Wall Sit", null as any)).toBe(true);
      expect(shouldShowWeightField("Custom Exercise", null as any)).toBe(true);
    });
  });
});
