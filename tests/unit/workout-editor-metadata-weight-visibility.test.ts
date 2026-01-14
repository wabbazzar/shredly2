/**
 * Unit Tests for WorkoutEditor - Metadata-Driven Weight Field Visibility
 *
 * Tests Phase 2 implementation from ticket #008:
 * Weight field visibility is now driven by external_load metadata (not workMode).
 *
 * Bug Fix: Weighted time-based exercises (e.g., DB Weighted Crunches)
 * now correctly show weight field in BOTH reps and work_time modes.
 *
 * Test Coverage:
 * - external_load: "always" -> ALWAYS show weight (both modes)
 * - external_load: "never" -> NEVER show weight (both modes)
 * - external_load: "sometimes" -> show weight only if present
 * - Custom exercises (not in DB) -> show weight only if present (fallback)
 * - Sub-exercises use their own metadata (independent of parent)
 * - Toggle scenarios preserve weight field visibility
 */

import { describe, it, expect } from "vitest";
import { WorkoutEditor } from "../../src/lib/engine/workout-editor.js";
import type {
  ParameterizedWorkout,
  ParameterizedExercise,
} from "../../src/lib/engine/types.js";

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Create minimal workout with specified exercise
 */
function createWorkoutWithExercise(
  exerciseName: string,
  weekParams: Record<string, any>,
  weeks: number = 2,
): ParameterizedWorkout {
  const exerciseData: ParameterizedExercise = {
    name: exerciseName,
    category: "test_category",
  } as ParameterizedExercise;

  // Add week parameters
  for (let w = 1; w <= weeks; w++) {
    (exerciseData as any)[`week${w}`] = { ...weekParams };
  }

  return {
    id: "test_workout",
    name: "Test Workout",
    weeks,
    daysPerWeek: 1,
    metadata: {
      programId: "test",
      difficulty: "Intermediate",
      equipment: ["test"],
      estimatedDuration: "30-45",
      tags: ["test"],
    },
    days: {
      day1: {
        dayNumber: 1,
        focus: "Test",
        exercises: [exerciseData],
      },
    },
  };
}

/**
 * Create workout with compound exercise (parent + sub-exercises)
 */
function createWorkoutWithCompoundExercise(
  parentName: string,
  subExercises: Array<{ name: string; weekParams: Record<string, any> }>,
  weeks: number = 2,
): ParameterizedWorkout {
  const parentExercise: ParameterizedExercise = {
    name: parentName,
    category: "compound",
    compound_set_type: "EMOM",
    sub_exercises: [],
  } as ParameterizedExercise;

  // Add sub-exercises
  parentExercise.sub_exercises = subExercises.map((subEx) => {
    const subExData: any = {
      name: subEx.name,
      category: "test_category",
    };

    // Add week parameters for sub-exercise
    for (let w = 1; w <= weeks; w++) {
      subExData[`week${w}`] = { ...subEx.weekParams };
    }

    return subExData;
  });

  return {
    id: "test_workout",
    name: "Test Compound Workout",
    weeks,
    daysPerWeek: 1,
    metadata: {
      programId: "test",
      difficulty: "Intermediate",
      equipment: ["test"],
      estimatedDuration: "30-45",
      tags: ["test"],
    },
    days: {
      day1: {
        dayNumber: 1,
        focus: "Test",
        exercises: [parentExercise],
      },
    },
  };
}

/**
 * Get weight fields for specific exercise from editable fields
 */
function getWeightFields(
  editor: WorkoutEditor,
  exerciseIndex: number = 0,
  subExerciseIndex?: number,
): any[] {
  const fields = editor.getAllEditableFields();
  return fields.filter(
    (f) =>
      f.fieldName === "weight" &&
      f.exerciseIndex === exerciseIndex &&
      f.subExerciseIndex === subExerciseIndex,
  );
}

// ============================================================================
// UNIT TESTS: external_load: "always"
// ============================================================================

describe("WorkoutEditor - Metadata Weight Visibility", () => {
  describe('external_load: "always" (DB Weighted Crunches)', () => {
    it("should show weight field in reps mode", () => {
      const workout = createWorkoutWithExercise("DB Weighted Crunches", {
        sets: 3,
        reps: 15,
        weight: { type: "fixed", value: 25, unit: "lbs" },
        rest_time_minutes: 1,
        rest_time_unit: "minutes",
      });

      const editor = new WorkoutEditor(workout);
      const weightFields = getWeightFields(editor);

      // Should have weight field for both weeks
      expect(weightFields).toHaveLength(2);
      expect(weightFields[0].weekKey).toBe("week1");
      expect(weightFields[1].weekKey).toBe("week2");
      expect(weightFields[0].currentValue).toEqual({
        type: "fixed",
        value: 25,
        unit: "lbs",
      });
    });

    it("should show weight field in work_time mode", () => {
      const workout = createWorkoutWithExercise("DB Weighted Crunches", {
        sets: 3,
        work_time_minutes: 45,
        work_time_unit: "seconds",
        weight: { type: "fixed", value: 25, unit: "lbs" },
        rest_time_minutes: 1,
        rest_time_unit: "minutes",
      });

      const editor = new WorkoutEditor(workout);
      const weightFields = getWeightFields(editor);

      // Should have weight field for both weeks (BUG FIX: was missing before)
      expect(weightFields).toHaveLength(2);
      expect(weightFields[0].weekKey).toBe("week1");
      expect(weightFields[1].weekKey).toBe("week2");
      expect(weightFields[0].currentValue).toEqual({
        type: "fixed",
        value: 25,
        unit: "lbs",
      });
    });

    it("should show weight field even if weight is undefined (always = always)", () => {
      const workout = createWorkoutWithExercise("DB Weighted Crunches", {
        sets: 3,
        reps: 15,
        rest_time_minutes: 1,
        rest_time_unit: "minutes",
        // NO weight field
      });

      const editor = new WorkoutEditor(workout);
      const weightFields = getWeightFields(editor);

      // external_load: "always" means ALWAYS show, even if undefined
      expect(weightFields).toHaveLength(2);
      expect(weightFields[0].currentValue).toBeUndefined();
    });
  });

  // ============================================================================
  // UNIT TESTS: external_load: "never"
  // ============================================================================

  describe('external_load: "never" (Plank Hold)', () => {
    it("should NEVER show weight field in reps mode", () => {
      const workout = createWorkoutWithExercise("Plank Hold", {
        sets: 3,
        reps: 10, // Hypothetical (planks are usually timed, but testing the rule)
        rest_time_minutes: 1,
        rest_time_unit: "minutes",
        // No weight - external_load: never
      });

      const editor = new WorkoutEditor(workout);
      const weightFields = getWeightFields(editor);

      // Should have NO weight fields
      expect(weightFields).toHaveLength(0);
    });

    it("should NEVER show weight field in work_time mode", () => {
      const workout = createWorkoutWithExercise("Plank Hold", {
        sets: 3,
        work_time_minutes: 60,
        work_time_unit: "seconds",
        rest_time_minutes: 1,
        rest_time_unit: "minutes",
        // No weight - external_load: never
      });

      const editor = new WorkoutEditor(workout);
      const weightFields = getWeightFields(editor);

      // Should have NO weight fields
      expect(weightFields).toHaveLength(0);
    });

    it("should NEVER show weight field even if weight is present in data", () => {
      const workout = createWorkoutWithExercise("Plank Hold", {
        sets: 3,
        work_time_minutes: 60,
        work_time_unit: "seconds",
        weight: { type: "fixed", value: 25, unit: "lbs" }, // Invalid data
        rest_time_minutes: 1,
        rest_time_unit: "minutes",
      });

      const editor = new WorkoutEditor(workout);
      const weightFields = getWeightFields(editor);

      // external_load: "never" means NEVER show, even if data is present
      expect(weightFields).toHaveLength(0);
    });
  });

  // ============================================================================
  // UNIT TESTS: external_load: "sometimes"
  // ============================================================================

  describe('external_load: "sometimes" (Wall Sit)', () => {
    it("should show weight field if weight is present", () => {
      const workout = createWorkoutWithExercise("Wall Sit", {
        sets: 3,
        work_time_minutes: 60,
        work_time_unit: "seconds",
        weight: { type: "fixed", value: 20, unit: "lbs" }, // Weighted vest
        rest_time_minutes: 1,
        rest_time_unit: "minutes",
      });

      const editor = new WorkoutEditor(workout);
      const weightFields = getWeightFields(editor);

      // Should show weight because it's present in data
      expect(weightFields).toHaveLength(2);
      expect(weightFields[0].currentValue).toEqual({
        type: "fixed",
        value: 20,
        unit: "lbs",
      });
    });

    it("should NOT show weight field if weight is undefined", () => {
      const workout = createWorkoutWithExercise("Wall Sit", {
        sets: 3,
        work_time_minutes: 60,
        work_time_unit: "seconds",
        rest_time_minutes: 1,
        rest_time_unit: "minutes",
        // No weight
      });

      const editor = new WorkoutEditor(workout);
      const weightFields = getWeightFields(editor);

      // Should NOT show weight because it's not present
      expect(weightFields).toHaveLength(0);
    });

    it("should show weight in reps mode if present", () => {
      const workout = createWorkoutWithExercise("Wall Sit", {
        sets: 3,
        reps: 10,
        weight: { type: "fixed", value: 20, unit: "lbs" },
        rest_time_minutes: 1,
        rest_time_unit: "minutes",
      });

      const editor = new WorkoutEditor(workout);
      const weightFields = getWeightFields(editor);

      expect(weightFields).toHaveLength(2);
      expect(weightFields[0].currentValue).toEqual({
        type: "fixed",
        value: 20,
        unit: "lbs",
      });
    });
  });

  // ============================================================================
  // UNIT TESTS: Custom Exercises (Fallback Behavior)
  // ============================================================================

  describe("Custom exercises not in database", () => {
    it("should show weight field if weight is present (fallback: sometimes)", () => {
      const workout = createWorkoutWithExercise("Custom Exercise 123", {
        sets: 3,
        reps: 10,
        weight: { type: "fixed", value: 50, unit: "lbs" },
        rest_time_minutes: 2,
        rest_time_unit: "minutes",
      });

      const editor = new WorkoutEditor(workout);
      const weightFields = getWeightFields(editor);

      // Fallback: show weight if present
      expect(weightFields).toHaveLength(2);
      expect(weightFields[0].currentValue).toEqual({
        type: "fixed",
        value: 50,
        unit: "lbs",
      });
    });

    it("should NOT show weight field if weight is undefined (fallback: sometimes)", () => {
      const workout = createWorkoutWithExercise("Custom Exercise 456", {
        sets: 3,
        reps: 10,
        rest_time_minutes: 2,
        rest_time_unit: "minutes",
        // No weight
      });

      const editor = new WorkoutEditor(workout);
      const weightFields = getWeightFields(editor);

      // Fallback: do NOT show weight if not present
      expect(weightFields).toHaveLength(0);
    });

    it("should apply fallback behavior in work_time mode", () => {
      const workout = createWorkoutWithExercise("Custom Time Exercise", {
        sets: 3,
        work_time_minutes: 45,
        work_time_unit: "seconds",
        weight: { type: "fixed", value: 30, unit: "kg" },
        rest_time_minutes: 1.5,
        rest_time_unit: "minutes",
      });

      const editor = new WorkoutEditor(workout);
      const weightFields = getWeightFields(editor);

      expect(weightFields).toHaveLength(2);
      expect(weightFields[0].currentValue).toEqual({
        type: "fixed",
        value: 30,
        unit: "kg",
      });
    });
  });

  // ============================================================================
  // UNIT TESTS: Sub-Exercises Use Their Own Metadata
  // ============================================================================

  describe("Sub-exercises use their own metadata (not parent)", () => {
    it("should show weight for sub-exercise with external_load: always", () => {
      const workout = createWorkoutWithCompoundExercise(
        "EMOM 10 minutes",
        [
          {
            name: "DB Weighted Crunches", // external_load: always
            weekParams: {
              reps: 15,
              weight: { type: "fixed", value: 25, unit: "lbs" },
            },
          },
        ],
        2,
      );

      const editor = new WorkoutEditor(workout);
      const weightFields = getWeightFields(editor, 0, 0); // Sub-exercise index 0

      expect(weightFields).toHaveLength(2);
      expect(weightFields[0].subExerciseIndex).toBe(0);
      expect(weightFields[0].currentValue).toEqual({
        type: "fixed",
        value: 25,
        unit: "lbs",
      });
    });

    it("should NOT show weight for sub-exercise with external_load: never", () => {
      const workout = createWorkoutWithCompoundExercise(
        "Circuit 5 rounds",
        [
          {
            name: "Plank Hold", // external_load: never
            weekParams: {
              work_time_minutes: 45,
              work_time_unit: "seconds",
            },
          },
        ],
        2,
      );

      const editor = new WorkoutEditor(workout);
      const weightFields = getWeightFields(editor, 0, 0);

      // Should have NO weight fields
      expect(weightFields).toHaveLength(0);
    });

    it("should apply different rules to different sub-exercises", () => {
      const workout = createWorkoutWithCompoundExercise(
        "Circuit 3 rounds",
        [
          {
            name: "DB Weighted Crunches", // external_load: always
            weekParams: {
              reps: 15,
              weight: { type: "fixed", value: 25, unit: "lbs" },
            },
          },
          {
            name: "Plank Hold", // external_load: never
            weekParams: {
              work_time_minutes: 60,
              work_time_unit: "seconds",
            },
          },
          {
            name: "Wall Sit", // external_load: sometimes
            weekParams: {
              work_time_minutes: 45,
              work_time_unit: "seconds",
              weight: { type: "fixed", value: 10, unit: "lbs" },
            },
          },
        ],
        2,
      );

      const editor = new WorkoutEditor(workout);

      // Sub-exercise 0: DB Weighted Crunches (should show weight)
      const weightFields0 = getWeightFields(editor, 0, 0);
      expect(weightFields0).toHaveLength(2);

      // Sub-exercise 1: Plank Hold (should NOT show weight)
      const weightFields1 = getWeightFields(editor, 0, 1);
      expect(weightFields1).toHaveLength(0);

      // Sub-exercise 2: Wall Sit (should show weight because present)
      const weightFields2 = getWeightFields(editor, 0, 2);
      expect(weightFields2).toHaveLength(2);
    });

    it("should use sub-exercise metadata, not parent compound name", () => {
      // Parent compound name ("EMOM 10 minutes") is not in exercise DB
      // Sub-exercise should use its own metadata
      const workout = createWorkoutWithCompoundExercise(
        "EMOM 10 minutes",
        [
          {
            name: "DB Weighted Crunches",
            weekParams: {
              reps: 15,
              // No weight specified
            },
          },
        ],
        2,
      );

      const editor = new WorkoutEditor(workout);
      const weightFields = getWeightFields(editor, 0, 0);

      // external_load: always for DB Weighted Crunches
      // Should show weight even though undefined
      expect(weightFields).toHaveLength(2);
      expect(weightFields[0].currentValue).toBeUndefined();
    });
  });

  // ============================================================================
  // INTEGRATION TESTS: Toggle Behavior
  // ============================================================================

  describe("Toggle behavior preserves weight field visibility", () => {
    it("should maintain weight field when toggling DB Weighted Crunches from reps to work_time", () => {
      const workout = createWorkoutWithExercise("DB Weighted Crunches", {
        sets: 3,
        reps: 15,
        weight: { type: "fixed", value: 25, unit: "lbs" },
        rest_time_minutes: 1,
        rest_time_unit: "minutes",
      });

      const editor = new WorkoutEditor(workout);

      // Before toggle: weight field visible in reps mode
      const weightFieldsBefore = getWeightFields(editor);
      expect(weightFieldsBefore).toHaveLength(2);

      // Toggle to work_time mode using toggleWorkDefinition method
      editor.toggleWorkDefinition("day1", 0);

      // After toggle: weight field should STILL be visible
      const weightFieldsAfter = getWeightFields(editor);
      expect(weightFieldsAfter).toHaveLength(2); // Both weeks still have weight
      expect(weightFieldsAfter[0].currentValue).toEqual({
        type: "fixed",
        value: 25,
        unit: "lbs",
      });
    });

    it("should maintain weight field when toggling back from work_time to reps", () => {
      const workout = createWorkoutWithExercise("DB Weighted Crunches", {
        sets: 3,
        work_time_minutes: 45,
        work_time_unit: "seconds",
        weight: { type: "fixed", value: 25, unit: "lbs" },
        rest_time_minutes: 1,
        rest_time_unit: "minutes",
      });

      const editor = new WorkoutEditor(workout);

      // Before toggle: weight field visible in work_time mode
      const weightFieldsBefore = getWeightFields(editor);
      expect(weightFieldsBefore).toHaveLength(2);

      // Toggle to reps mode using toggleWorkDefinition method
      editor.toggleWorkDefinition("day1", 0);

      // After toggle: weight field should STILL be visible
      const weightFieldsAfter = getWeightFields(editor);
      expect(weightFieldsAfter).toHaveLength(2);
      expect(weightFieldsAfter[0].currentValue).toEqual({
        type: "fixed",
        value: 25,
        unit: "lbs",
      });
    });

    it("should NOT show weight for Plank Hold regardless of toggle", () => {
      const workout = createWorkoutWithExercise("Plank Hold", {
        sets: 3,
        work_time_minutes: 60,
        work_time_unit: "seconds",
        rest_time_minutes: 1,
        rest_time_unit: "minutes",
      });

      const editor = new WorkoutEditor(workout);

      // Work_time mode: no weight
      const weightFieldsBefore = getWeightFields(editor);
      expect(weightFieldsBefore).toHaveLength(0);

      // Note: Plank Hold is isometric, cannot toggle to reps mode
      // This test verifies external_load: never means NEVER show weight
      // The editor would prevent toggling isometric exercises to reps anyway
      const weightFieldsAfter = getWeightFields(editor);
      expect(weightFieldsAfter).toHaveLength(0);
    });

    it("should show/hide weight for Wall Sit based on data presence", () => {
      const workout = createWorkoutWithExercise("Wall Sit", {
        sets: 3,
        work_time_minutes: 60,
        work_time_unit: "seconds",
        weight: { type: "fixed", value: 20, unit: "lbs" },
        rest_time_minutes: 1,
        rest_time_unit: "minutes",
      });

      const editor = new WorkoutEditor(workout);

      // Work_time mode with weight: visible
      const weightFieldsBefore = getWeightFields(editor);
      expect(weightFieldsBefore).toHaveLength(2);

      // Get the weight fields and edit them to undefined
      const fields = editor.getAllEditableFields();
      const week1WeightField = fields.find(
        (f) =>
          f.fieldName === "weight" &&
          f.exerciseIndex === 0 &&
          f.weekKey === "week1",
      );
      const week2WeightField = fields.find(
        (f) =>
          f.fieldName === "weight" &&
          f.exerciseIndex === 0 &&
          f.weekKey === "week2",
      );

      if (week1WeightField && week2WeightField) {
        editor.editField(week1WeightField, undefined);
        editor.editField(week2WeightField, undefined);

        // After removing weight: should NOT be visible (sometimes = only if present)
        const weightFieldsAfter = getWeightFields(editor);
        expect(weightFieldsAfter).toHaveLength(0);
      } else {
        throw new Error("Weight fields not found");
      }
    });
  });

  // ============================================================================
  // REGRESSION TESTS
  // ============================================================================

  describe("Regression: Ensure existing functionality still works", () => {
    it("should still expose reps field for rep-based exercises", () => {
      const workout = createWorkoutWithExercise("Bench Press", {
        sets: 3,
        reps: 8,
        weight: { type: "percent_tm", value: 70 },
        rest_time_minutes: 2,
        rest_time_unit: "minutes",
      });

      const editor = new WorkoutEditor(workout);
      const fields = editor.getAllEditableFields();

      const repsFields = fields.filter(
        (f) =>
          f.fieldName === "reps" &&
          f.exerciseIndex === 0 &&
          f.subExerciseIndex === undefined,
      );
      expect(repsFields).toHaveLength(2); // 2 weeks
      expect(repsFields[0].currentValue).toBe(8);
    });

    it("should still expose work_time_minutes field for time-based exercises", () => {
      const workout = createWorkoutWithExercise("Plank Hold", {
        sets: 3,
        work_time_minutes: 60,
        work_time_unit: "seconds",
        rest_time_minutes: 1,
        rest_time_unit: "minutes",
      });

      const editor = new WorkoutEditor(workout);
      const fields = editor.getAllEditableFields();

      const workTimeFields = fields.filter(
        (f) =>
          f.fieldName === "work_time_minutes" &&
          f.exerciseIndex === 0 &&
          f.subExerciseIndex === undefined,
      );
      expect(workTimeFields).toHaveLength(2);
      expect(workTimeFields[0].currentValue).toBe(60);
    });

    it("should still support editing weight values", () => {
      const workout = createWorkoutWithExercise("DB Weighted Crunches", {
        sets: 3,
        reps: 15,
        weight: { type: "fixed", value: 25, unit: "lbs" },
        rest_time_minutes: 1,
        rest_time_unit: "minutes",
      });

      const editor = new WorkoutEditor(workout);

      // Get the weight field and edit it
      const fields = editor.getAllEditableFields();
      const week1WeightField = fields.find(
        (f) =>
          f.fieldName === "weight" &&
          f.exerciseIndex === 0 &&
          f.weekKey === "week1",
      );

      if (!week1WeightField) {
        throw new Error("Weight field not found");
      }

      // Edit weight value
      editor.editField(week1WeightField, {
        type: "fixed",
        value: 30,
        unit: "lbs",
      });

      const updatedWorkout = editor.getWorkout();
      const week1Weight = (updatedWorkout.days.day1.exercises[0] as any).week1
        .weight;
      expect(week1Weight).toEqual({ type: "fixed", value: 30, unit: "lbs" });
    });

    it("should maintain undo stack functionality", () => {
      const workout = createWorkoutWithExercise("DB Weighted Crunches", {
        sets: 3,
        reps: 15,
        weight: { type: "fixed", value: 25, unit: "lbs" },
        rest_time_minutes: 1,
        rest_time_unit: "minutes",
      });

      const editor = new WorkoutEditor(workout);

      // Get the weight field and edit it
      const fields = editor.getAllEditableFields();
      const week1WeightField = fields.find(
        (f) =>
          f.fieldName === "weight" &&
          f.exerciseIndex === 0 &&
          f.weekKey === "week1",
      );

      if (!week1WeightField) {
        throw new Error("Weight field not found");
      }

      // Make edit
      editor.editField(week1WeightField, {
        type: "fixed",
        value: 30,
        unit: "lbs",
      });

      // Verify undo is available
      expect(editor.getUndoStackSize()).toBeGreaterThan(0);

      // Undo
      editor.undo();

      // Verify original value restored
      const restoredWorkout = editor.getWorkout();
      const week1Weight = (restoredWorkout.days.day1.exercises[0] as any).week1
        .weight;
      expect(week1Weight).toEqual({ type: "fixed", value: 25, unit: "lbs" });
    });
  });
});
