/**
 * Unit Tests for WorkoutEditor - Work Mode Filtering
 *
 * Tests the work mode filtering functionality in getAllEditableFields()
 * to ensure rep-based and work_time-based exercises expose correct fields.
 */

import { describe, it, expect } from "vitest";
import { WorkoutEditor } from "../../src/lib/engine/workout-editor.js";
import type {
  ParameterizedWorkout,
  ParameterizedExercise,
} from "../../src/lib/engine/types.js";

/**
 * Helper: Create a minimal workout with a rep-based exercise
 */
function createRepBasedWorkout(): ParameterizedWorkout {
  return {
    id: "test_workout_1",
    name: "Test Rep-Based Workout",
    weeks: 3,
    daysPerWeek: 1,
    metadata: {
      programId: "test_1",
      difficulty: "Intermediate",
      equipment: ["barbell"],
      estimatedDuration: "45-60",
      tags: ["test"],
    },
    days: {
      day1: {
        dayNumber: 1,
        focus: "Upper Body",
        exercises: [
          {
            name: "Bench Press",
            category: "barbell_press",
            week1: {
              sets: 3,
              reps: 8,
              weight: { type: "percent_tm", value: 70 },
              rest_time_minutes: 2,
              rest_time_unit: "minutes",
            },
            week2: {
              sets: 3,
              reps: 8,
              weight: { type: "percent_tm", value: 75 },
              rest_time_minutes: 2,
              rest_time_unit: "minutes",
            },
            week3: {
              sets: 3,
              reps: 8,
              weight: { type: "percent_tm", value: 80 },
              rest_time_minutes: 2,
              rest_time_unit: "minutes",
            },
          } as ParameterizedExercise,
        ],
      },
    },
  };
}

/**
 * Helper: Create a minimal workout with a work_time-based exercise
 */
function createWorkTimeBasedWorkout(): ParameterizedWorkout {
  return {
    id: "test_workout_2",
    name: "Test Work Time Workout",
    weeks: 3,
    daysPerWeek: 1,
    metadata: {
      programId: "test_2",
      difficulty: "Intermediate",
      equipment: ["bodyweight"],
      estimatedDuration: "30-45",
      tags: ["test"],
    },
    days: {
      day1: {
        dayNumber: 1,
        focus: "Cardio",
        exercises: [
          {
            name: "Plank Hold",
            category: "hold",
            week1: {
              sets: 3,
              work_time_minutes: 60,
              work_time_unit: "seconds",
              rest_time_minutes: 1,
              rest_time_unit: "minutes",
            },
            week2: {
              sets: 3,
              work_time_minutes: 75,
              work_time_unit: "seconds",
              rest_time_minutes: 1,
              rest_time_unit: "minutes",
            },
            week3: {
              sets: 3,
              work_time_minutes: 90,
              work_time_unit: "seconds",
              rest_time_minutes: 1,
              rest_time_unit: "minutes",
            },
          } as ParameterizedExercise,
        ],
      },
    },
  };
}

describe("WorkoutEditor - Work Mode Filtering", () => {
  describe("getAllEditableFields() - Rep-based exercises", () => {
    it("should include reps and weight fields for rep-based exercises", () => {
      const workout = createRepBasedWorkout();
      const editor = new WorkoutEditor(workout);

      const fields = editor.getAllEditableFields();

      // Filter to exercise name field for first exercise in day1
      const nameFields = fields.filter(
        (f) =>
          f.dayKey === "day1" &&
          f.exerciseIndex === 0 &&
          f.fieldName === "name" &&
          f.subExerciseIndex === undefined,
      );
      expect(nameFields).toHaveLength(1);
      expect(nameFields[0].currentValue).toBe("Bench Press");

      // Filter to sets field for week1
      const setsFields = fields.filter(
        (f) =>
          f.dayKey === "day1" &&
          f.exerciseIndex === 0 &&
          f.fieldName === "sets" &&
          f.weekKey === "week1",
      );
      expect(setsFields).toHaveLength(1);
      expect(setsFields[0].currentValue).toBe(3);

      // Filter to reps field for week1
      const repsFields = fields.filter(
        (f) =>
          f.dayKey === "day1" &&
          f.exerciseIndex === 0 &&
          f.fieldName === "reps" &&
          f.weekKey === "week1",
      );
      expect(repsFields).toHaveLength(1);
      expect(repsFields[0].currentValue).toBe(8);

      // Filter to weight field for week1
      const weightFields = fields.filter(
        (f) =>
          f.dayKey === "day1" &&
          f.exerciseIndex === 0 &&
          f.fieldName === "weight" &&
          f.weekKey === "week1",
      );
      expect(weightFields).toHaveLength(1);
      expect(weightFields[0].currentValue).toEqual({
        type: "percent_tm",
        value: 70,
      });

      // Filter to rest_time_minutes field for week1
      const restFields = fields.filter(
        (f) =>
          f.dayKey === "day1" &&
          f.exerciseIndex === 0 &&
          f.fieldName === "rest_time_minutes" &&
          f.weekKey === "week1",
      );
      expect(restFields).toHaveLength(1);
      expect(restFields[0].currentValue).toBe(2);
    });

    it("should NOT include work_time_minutes for rep-based exercises", () => {
      const workout = createRepBasedWorkout();
      const editor = new WorkoutEditor(workout);

      const fields = editor.getAllEditableFields();

      // Verify no work_time_minutes fields for this exercise
      const workTimeFields = fields.filter(
        (f) =>
          f.dayKey === "day1" &&
          f.exerciseIndex === 0 &&
          f.fieldName === "work_time_minutes",
      );
      expect(workTimeFields).toHaveLength(0);
    });

    it("should include reps and weight for all weeks (3 weeks)", () => {
      const workout = createRepBasedWorkout();
      const editor = new WorkoutEditor(workout);

      const fields = editor.getAllEditableFields();

      // Verify reps fields for all 3 weeks
      const repsFields = fields.filter(
        (f) =>
          f.dayKey === "day1" &&
          f.exerciseIndex === 0 &&
          f.fieldName === "reps",
      );
      expect(repsFields).toHaveLength(3);
      expect(repsFields.map((f) => f.weekKey)).toEqual([
        "week1",
        "week2",
        "week3",
      ]);

      // Verify weight fields for all 3 weeks
      const weightFields = fields.filter(
        (f) =>
          f.dayKey === "day1" &&
          f.exerciseIndex === 0 &&
          f.fieldName === "weight",
      );
      expect(weightFields).toHaveLength(3);
      expect(weightFields.map((f) => f.weekKey)).toEqual([
        "week1",
        "week2",
        "week3",
      ]);
    });
  });

  describe("getAllEditableFields() - Work_time-based exercises", () => {
    it("should include work_time_minutes for work_time-based exercises", () => {
      const workout = createWorkTimeBasedWorkout();
      const editor = new WorkoutEditor(workout);

      const fields = editor.getAllEditableFields();

      // Filter to work_time_minutes field for week1
      const workTimeFields = fields.filter(
        (f) =>
          f.dayKey === "day1" &&
          f.exerciseIndex === 0 &&
          f.fieldName === "work_time_minutes" &&
          f.weekKey === "week1",
      );
      expect(workTimeFields).toHaveLength(1);
      expect(workTimeFields[0].currentValue).toBe(60);

      // Verify all 3 weeks have work_time_minutes
      const allWorkTimeFields = fields.filter(
        (f) =>
          f.dayKey === "day1" &&
          f.exerciseIndex === 0 &&
          f.fieldName === "work_time_minutes",
      );
      expect(allWorkTimeFields).toHaveLength(3);
      expect(allWorkTimeFields.map((f) => f.weekKey)).toEqual([
        "week1",
        "week2",
        "week3",
      ]);
    });

    it("should include sets and rest_time_minutes for work_time-based exercises", () => {
      const workout = createWorkTimeBasedWorkout();
      const editor = new WorkoutEditor(workout);

      const fields = editor.getAllEditableFields();

      // Filter to sets field for week1
      const setsFields = fields.filter(
        (f) =>
          f.dayKey === "day1" &&
          f.exerciseIndex === 0 &&
          f.fieldName === "sets" &&
          f.weekKey === "week1",
      );
      expect(setsFields).toHaveLength(1);
      expect(setsFields[0].currentValue).toBe(3);

      // Filter to rest_time_minutes field for week1
      const restFields = fields.filter(
        (f) =>
          f.dayKey === "day1" &&
          f.exerciseIndex === 0 &&
          f.fieldName === "rest_time_minutes" &&
          f.weekKey === "week1",
      );
      expect(restFields).toHaveLength(1);
      expect(restFields[0].currentValue).toBe(1);
    });

    it("should NOT include reps or weight for work_time-based exercises", () => {
      const workout = createWorkTimeBasedWorkout();
      const editor = new WorkoutEditor(workout);

      const fields = editor.getAllEditableFields();

      // Verify no reps fields for this exercise
      const repsFields = fields.filter(
        (f) =>
          f.dayKey === "day1" &&
          f.exerciseIndex === 0 &&
          f.fieldName === "reps",
      );
      expect(repsFields).toHaveLength(0);

      // Verify no weight fields for this exercise
      const weightFields = fields.filter(
        (f) =>
          f.dayKey === "day1" &&
          f.exerciseIndex === 0 &&
          f.fieldName === "weight",
      );
      expect(weightFields).toHaveLength(0);
    });
  });

  describe("getAllEditableFields() - After toggling work definition", () => {
    it("should update fields from reps to work_time after toggle", () => {
      const workout = createRepBasedWorkout();
      const editor = new WorkoutEditor(workout);

      // Get initial fields (should have reps and weight)
      const initialFields = editor.getAllEditableFields();

      const initialRepsFields = initialFields.filter(
        (f) =>
          f.dayKey === "day1" &&
          f.exerciseIndex === 0 &&
          f.fieldName === "reps",
      );
      expect(initialRepsFields).toHaveLength(3); // 3 weeks

      const initialWeightFields = initialFields.filter(
        (f) =>
          f.dayKey === "day1" &&
          f.exerciseIndex === 0 &&
          f.fieldName === "weight",
      );
      expect(initialWeightFields).toHaveLength(3); // 3 weeks

      const initialWorkTimeFields = initialFields.filter(
        (f) =>
          f.dayKey === "day1" &&
          f.exerciseIndex === 0 &&
          f.fieldName === "work_time_minutes",
      );
      expect(initialWorkTimeFields).toHaveLength(0);

      // Toggle to work_time mode
      const result = editor.toggleWorkDefinition("day1", 0);
      expect(result.success).toBe(true);
      expect(result.newMode).toBe("work_time");

      // Get fields after toggle (should have work_time, no reps/weight)
      const newFields = editor.getAllEditableFields();

      const newRepsFields = newFields.filter(
        (f) =>
          f.dayKey === "day1" &&
          f.exerciseIndex === 0 &&
          f.fieldName === "reps",
      );
      expect(newRepsFields).toHaveLength(0);

      const newWeightFields = newFields.filter(
        (f) =>
          f.dayKey === "day1" &&
          f.exerciseIndex === 0 &&
          f.fieldName === "weight",
      );
      expect(newWeightFields).toHaveLength(0);

      const newWorkTimeFields = newFields.filter(
        (f) =>
          f.dayKey === "day1" &&
          f.exerciseIndex === 0 &&
          f.fieldName === "work_time_minutes",
      );
      expect(newWorkTimeFields).toHaveLength(3); // 3 weeks
    });

    it("should update fields from work_time to reps after toggle", () => {
      const workout = createWorkTimeBasedWorkout();
      const editor = new WorkoutEditor(workout);

      // Get initial fields (should have work_time, no reps/weight)
      const initialFields = editor.getAllEditableFields();

      const initialWorkTimeFields = initialFields.filter(
        (f) =>
          f.dayKey === "day1" &&
          f.exerciseIndex === 0 &&
          f.fieldName === "work_time_minutes",
      );
      expect(initialWorkTimeFields).toHaveLength(3); // 3 weeks

      const initialRepsFields = initialFields.filter(
        (f) =>
          f.dayKey === "day1" &&
          f.exerciseIndex === 0 &&
          f.fieldName === "reps",
      );
      expect(initialRepsFields).toHaveLength(0);

      const initialWeightFields = initialFields.filter(
        (f) =>
          f.dayKey === "day1" &&
          f.exerciseIndex === 0 &&
          f.fieldName === "weight",
      );
      expect(initialWeightFields).toHaveLength(0);

      // Toggle to reps mode
      const result = editor.toggleWorkDefinition("day1", 0);
      expect(result.success).toBe(true);
      expect(result.newMode).toBe("reps");

      // Get fields after toggle (should have reps, no work_time)
      const newFields = editor.getAllEditableFields();

      const newWorkTimeFields = newFields.filter(
        (f) =>
          f.dayKey === "day1" &&
          f.exerciseIndex === 0 &&
          f.fieldName === "work_time_minutes",
      );
      expect(newWorkTimeFields).toHaveLength(0);

      const newRepsFields = newFields.filter(
        (f) =>
          f.dayKey === "day1" &&
          f.exerciseIndex === 0 &&
          f.fieldName === "reps",
      );
      expect(newRepsFields).toHaveLength(3); // 3 weeks

      // Note: weight fields won't appear unless the exercise supports weight
      // This particular exercise (Plank Hold) doesn't have weight in the original
    });

    it("should preserve rest_time_minutes across toggle", () => {
      const workout = createRepBasedWorkout();
      const editor = new WorkoutEditor(workout);

      // Get initial rest_time fields
      const initialFields = editor.getAllEditableFields();
      const initialRestFields = initialFields.filter(
        (f) =>
          f.dayKey === "day1" &&
          f.exerciseIndex === 0 &&
          f.fieldName === "rest_time_minutes",
      );
      expect(initialRestFields).toHaveLength(3); // 3 weeks
      expect(initialRestFields[0].currentValue).toBe(2);

      // Toggle to work_time mode
      editor.toggleWorkDefinition("day1", 0);

      // Get rest_time fields after toggle (should still be there)
      const newFields = editor.getAllEditableFields();
      const newRestFields = newFields.filter(
        (f) =>
          f.dayKey === "day1" &&
          f.exerciseIndex === 0 &&
          f.fieldName === "rest_time_minutes",
      );
      expect(newRestFields).toHaveLength(3); // 3 weeks
      expect(newRestFields[0].currentValue).toBe(2);
    });

    it("should preserve sets across toggle", () => {
      const workout = createRepBasedWorkout();
      const editor = new WorkoutEditor(workout);

      // Get initial sets fields
      const initialFields = editor.getAllEditableFields();
      const initialSetsFields = initialFields.filter(
        (f) =>
          f.dayKey === "day1" &&
          f.exerciseIndex === 0 &&
          f.fieldName === "sets",
      );
      expect(initialSetsFields).toHaveLength(3); // 3 weeks
      expect(initialSetsFields[0].currentValue).toBe(3);

      // Toggle to work_time mode
      editor.toggleWorkDefinition("day1", 0);

      // Get sets fields after toggle (should still be there)
      const newFields = editor.getAllEditableFields();
      const newSetsFields = newFields.filter(
        (f) =>
          f.dayKey === "day1" &&
          f.exerciseIndex === 0 &&
          f.fieldName === "sets",
      );
      expect(newSetsFields).toHaveLength(3); // 3 weeks
      expect(newSetsFields[0].currentValue).toBe(3);
    });
  });

  describe("getAllEditableFields() - Field order", () => {
    it("should maintain correct field order for rep-based exercises", () => {
      const workout = createRepBasedWorkout();
      const editor = new WorkoutEditor(workout);

      const fields = editor.getAllEditableFields();

      // Filter to week1 fields for first exercise
      const week1Fields = fields.filter(
        (f) =>
          f.dayKey === "day1" &&
          f.exerciseIndex === 0 &&
          f.weekKey === "week1" &&
          f.subExerciseIndex === undefined,
      );

      // Expected order: sets, reps, weight, rest_time_minutes
      expect(week1Fields.length).toBeGreaterThanOrEqual(4);

      const fieldNames = week1Fields.map((f) => f.fieldName);
      const setsIndex = fieldNames.indexOf("sets");
      const repsIndex = fieldNames.indexOf("reps");
      const weightIndex = fieldNames.indexOf("weight");
      const restIndex = fieldNames.indexOf("rest_time_minutes");

      // Verify order (sets should come before reps, reps before weight, weight before rest)
      expect(setsIndex).toBeLessThan(repsIndex);
      expect(repsIndex).toBeLessThan(weightIndex);
      expect(weightIndex).toBeLessThan(restIndex);
    });

    it("should maintain correct field order for work_time-based exercises", () => {
      const workout = createWorkTimeBasedWorkout();
      const editor = new WorkoutEditor(workout);

      const fields = editor.getAllEditableFields();

      // Filter to week1 fields for first exercise
      const week1Fields = fields.filter(
        (f) =>
          f.dayKey === "day1" &&
          f.exerciseIndex === 0 &&
          f.weekKey === "week1" &&
          f.subExerciseIndex === undefined,
      );

      // Expected order: sets, work_time_minutes, rest_time_minutes
      expect(week1Fields.length).toBeGreaterThanOrEqual(3);

      const fieldNames = week1Fields.map((f) => f.fieldName);
      const setsIndex = fieldNames.indexOf("sets");
      const workTimeIndex = fieldNames.indexOf("work_time_minutes");
      const restIndex = fieldNames.indexOf("rest_time_minutes");

      // Verify order (sets should come before work_time, work_time before rest)
      expect(setsIndex).toBeLessThan(workTimeIndex);
      expect(workTimeIndex).toBeLessThan(restIndex);
    });

    it("should place exercise name before week parameters", () => {
      const workout = createRepBasedWorkout();
      const editor = new WorkoutEditor(workout);

      const fields = editor.getAllEditableFields();

      // Filter to first exercise fields
      const exerciseFields = fields.filter(
        (f) => f.dayKey === "day1" && f.exerciseIndex === 0,
      );

      // Name field should be first
      expect(exerciseFields[0].fieldName).toBe("name");

      // Week parameters should come after name
      const nameIndex = exerciseFields.findIndex((f) => f.fieldName === "name");
      const firstWeekParamIndex = exerciseFields.findIndex(
        (f) => f.weekKey !== undefined,
      );

      expect(nameIndex).toBeLessThan(firstWeekParamIndex);
    });

    it("should place insertion point after all exercise fields", () => {
      const workout = createRepBasedWorkout();
      const editor = new WorkoutEditor(workout);

      const fields = editor.getAllEditableFields();

      // Filter to first exercise fields
      const exerciseFields = fields.filter(
        (f) => f.dayKey === "day1" && f.exerciseIndex === 0,
      );

      // Insertion point should be last
      const lastField = exerciseFields[exerciseFields.length - 1];
      expect(lastField.fieldName).toBe("_insert_after");
      expect(lastField.type).toBe("insertion_point");
      expect(lastField.currentValue).toBe("<add exercise>");
    });
  });
});
