/**
 * Unit Tests for WorkoutEditor - Smart Time Unit Toggle
 *
 * Tests the smart time unit selection when toggling work definitions
 * and sub-exercise work definition toggling for compound blocks.
 */

import { describe, it, expect } from "vitest";
import { WorkoutEditor } from "../../src/lib/engine/workout-editor.js";
import type {
  ParameterizedWorkout,
  ParameterizedExercise,
} from "../../src/lib/engine/types.js";

/**
 * Helper: Create workout with cardio exercise (should use 'minutes')
 */
function createCardioWorkout(): ParameterizedWorkout {
  return {
    id: "test_cardio",
    name: "Cardio Test Workout",
    weeks: 3,
    daysPerWeek: 1,
    metadata: {
      programId: "test_cardio",
      difficulty: "Intermediate",
      equipment: ["none"],
      estimatedDuration: "30-45",
      tags: ["test", "cardio"],
    },
    days: {
      day1: {
        dayNumber: 1,
        focus: "Cardio",
        exercises: [
          {
            name: "Gentle Walk + Stretching",
            category: "cardio",
            week1: {
              sets: 1,
              reps: 30, // Will toggle to work_time with 'minutes'
              rest_time_minutes: 0,
              rest_time_unit: "minutes",
            },
            week2: {
              sets: 1,
              reps: 35,
              rest_time_minutes: 0,
              rest_time_unit: "minutes",
            },
            week3: {
              sets: 1,
              reps: 40,
              rest_time_minutes: 0,
              rest_time_unit: "minutes",
            },
          } as ParameterizedExercise,
        ],
      },
    },
  };
}

/**
 * Helper: Create workout with flexibility exercise (should use 'seconds')
 */
function createFlexibilityWorkout(): ParameterizedWorkout {
  return {
    id: "test_flexibility",
    name: "Flexibility Test Workout",
    weeks: 3,
    daysPerWeek: 1,
    metadata: {
      programId: "test_flexibility",
      difficulty: "Beginner",
      equipment: ["none"],
      estimatedDuration: "15-20",
      tags: ["test", "flexibility"],
    },
    days: {
      day1: {
        dayNumber: 1,
        focus: "Flexibility",
        exercises: [
          {
            name: "Couch Stretch",
            category: "flexibility",
            week1: {
              sets: 1,
              reps: 90, // Will toggle to work_time with 'seconds' (typical: 90-120 seconds)
              rest_time_minutes: 0,
              rest_time_unit: "seconds",
            },
            week2: {
              sets: 1,
              reps: 105,
              rest_time_minutes: 0,
              rest_time_unit: "seconds",
            },
            week3: {
              sets: 1,
              reps: 120,
              rest_time_minutes: 0,
              rest_time_unit: "seconds",
            },
          } as ParameterizedExercise,
        ],
      },
    },
  };
}

/**
 * Helper: Create workout with strength exercise (should use 'seconds')
 */
function createStrengthWorkout(): ParameterizedWorkout {
  return {
    id: "test_strength",
    name: "Strength Test Workout",
    weeks: 3,
    daysPerWeek: 1,
    metadata: {
      programId: "test_strength",
      difficulty: "Intermediate",
      equipment: ["barbell"],
      estimatedDuration: "45-60",
      tags: ["test", "strength"],
    },
    days: {
      day1: {
        dayNumber: 1,
        focus: "Upper Body",
        exercises: [
          {
            name: "Bench Press",
            category: "strength",
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
 * Helper: Create workout with compound EMOM block containing sub-exercises
 */
function createCompoundWorkout(): ParameterizedWorkout {
  return {
    id: "test_compound",
    name: "Compound Block Test Workout",
    weeks: 3,
    daysPerWeek: 1,
    metadata: {
      programId: "test_compound",
      difficulty: "Intermediate",
      equipment: ["dumbbells", "kettlebell"],
      estimatedDuration: "30-45",
      tags: ["test", "emom"],
    },
    days: {
      day1: {
        dayNumber: 1,
        focus: "Full Body",
        exercises: [
          {
            name: "EMOM: Turkish Get-Up + Kettlebell Swings",
            category: "emom",
            week1: {
              sets: 4,
              work_time_minutes: 6,
              work_time_unit: "minutes",
              rest_time_minutes: 2,
              rest_time_unit: "minutes",
            },
            week2: {
              sets: 4,
              work_time_minutes: 7,
              work_time_unit: "minutes",
              rest_time_minutes: 2,
              rest_time_unit: "minutes",
            },
            week3: {
              sets: 4,
              work_time_minutes: 8,
              work_time_unit: "minutes",
              rest_time_minutes: 2,
              rest_time_unit: "minutes",
            },
            sub_exercises: [
              {
                name: "Turkish Get-Up",
                week1: {
                  reps: 3,
                  weight: { type: "percent_tm", value: 50 },
                },
                week2: {
                  reps: 3,
                  weight: { type: "percent_tm", value: 55 },
                },
                week3: {
                  reps: 3,
                  weight: { type: "percent_tm", value: 60 },
                },
              },
              {
                name: "Kettlebell Swings",
                week1: {
                  reps: 8,
                  weight: { type: "percent_tm", value: 70 },
                },
                week2: {
                  reps: 8,
                  weight: { type: "percent_tm", value: 70 },
                },
                week3: {
                  reps: 8,
                  weight: { type: "percent_tm", value: 70 },
                },
              },
            ],
          } as ParameterizedExercise,
        ],
      },
    },
  };
}

describe("WorkoutEditor - Smart Time Unit Toggle", () => {
  describe("toggleWorkDefinition() - Smart time unit selection", () => {
    it("should use 'minutes' for cardio exercises when toggling to work_time", () => {
      const workout = createCardioWorkout();
      const editor = new WorkoutEditor(workout);

      // Toggle to work_time mode
      const result = editor.toggleWorkDefinition("day1", 0);
      expect(result.success).toBe(true);
      expect(result.newMode).toBe("work_time");

      // Verify time unit is 'minutes' (not 'seconds')
      const modifiedWorkout = editor.getWorkout();
      const exercise = modifiedWorkout.days.day1.exercises[0] as any;

      expect(exercise.week1.work_time_minutes).toBe(30);
      expect(exercise.week1.work_time_unit).toBe("minutes");

      expect(exercise.week2.work_time_minutes).toBe(35);
      expect(exercise.week2.work_time_unit).toBe("minutes");

      expect(exercise.week3.work_time_minutes).toBe(40);
      expect(exercise.week3.work_time_unit).toBe("minutes");
    });

    it("should use 'seconds' for flexibility exercises when toggling to work_time", () => {
      const workout = createFlexibilityWorkout();
      const editor = new WorkoutEditor(workout);

      // Toggle to work_time mode
      const result = editor.toggleWorkDefinition("day1", 0);
      expect(result.success).toBe(true);
      expect(result.newMode).toBe("work_time");

      // Verify time unit is 'seconds' (flexibility stretches are typically 30-120 seconds)
      const modifiedWorkout = editor.getWorkout();
      const exercise = modifiedWorkout.days.day1.exercises[0] as any;

      expect(exercise.week1.work_time_minutes).toBe(90);
      expect(exercise.week1.work_time_unit).toBe("seconds");

      expect(exercise.week2.work_time_minutes).toBe(105);
      expect(exercise.week2.work_time_unit).toBe("seconds");

      expect(exercise.week3.work_time_minutes).toBe(120);
      expect(exercise.week3.work_time_unit).toBe("seconds");
    });

    it("should use 'seconds' for strength exercises when toggling to work_time", () => {
      const workout = createStrengthWorkout();
      const editor = new WorkoutEditor(workout);

      // Toggle to work_time mode
      const result = editor.toggleWorkDefinition("day1", 0);
      expect(result.success).toBe(true);
      expect(result.newMode).toBe("work_time");

      // Verify time unit is 'seconds' (default for strength)
      const modifiedWorkout = editor.getWorkout();
      const exercise = modifiedWorkout.days.day1.exercises[0] as any;

      expect(exercise.week1.work_time_minutes).toBe(8);
      expect(exercise.week1.work_time_unit).toBe("seconds");

      expect(exercise.week2.work_time_minutes).toBe(8);
      expect(exercise.week2.work_time_unit).toBe("seconds");

      expect(exercise.week3.work_time_minutes).toBe(8);
      expect(exercise.week3.work_time_unit).toBe("seconds");
    });

    it("should NOT preserve old time unit when toggling back and forth", () => {
      const workout = createStrengthWorkout();
      const editor = new WorkoutEditor(workout);

      // First toggle: reps -> work_time (should be 'seconds' for strength)
      editor.toggleWorkDefinition("day1", 0);

      let modifiedWorkout = editor.getWorkout();
      let exercise = modifiedWorkout.days.day1.exercises[0] as any;

      expect(exercise.week1.work_time_unit).toBe("seconds");

      // Second toggle: work_time -> reps (deletes time unit)
      editor.toggleWorkDefinition("day1", 0);

      modifiedWorkout = editor.getWorkout();
      exercise = modifiedWorkout.days.day1.exercises[0] as any;

      expect(exercise.week1.reps).toBe(8); // Restored from work_time_minutes value
      expect(exercise.week1.work_time_unit).toBeUndefined(); // Deleted

      // Third toggle: reps -> work_time again (should be fresh 'seconds', not preserved)
      editor.toggleWorkDefinition("day1", 0);

      modifiedWorkout = editor.getWorkout();
      exercise = modifiedWorkout.days.day1.exercises[0] as any;

      expect(exercise.week1.work_time_minutes).toBe(8);
      expect(exercise.week1.work_time_unit).toBe("seconds"); // Fresh, not preserved
    });

    it("should transfer numeric values correctly when toggling", () => {
      const workout = createCardioWorkout();
      const editor = new WorkoutEditor(workout);

      // Toggle to work_time mode
      editor.toggleWorkDefinition("day1", 0);

      const modifiedWorkout = editor.getWorkout();
      const exercise = modifiedWorkout.days.day1.exercises[0] as any;

      // Verify values transferred correctly (30 reps -> 30 work_time_minutes)
      expect(exercise.week1.work_time_minutes).toBe(30);
      expect(exercise.week2.work_time_minutes).toBe(35);
      expect(exercise.week3.work_time_minutes).toBe(40);

      // Toggle back to reps
      editor.toggleWorkDefinition("day1", 0);

      const restoredWorkout = editor.getWorkout();
      const restoredExercise = restoredWorkout.days.day1.exercises[0] as any;

      // Verify values transferred back correctly
      expect(restoredExercise.week1.reps).toBe(30);
      expect(restoredExercise.week2.reps).toBe(35);
      expect(restoredExercise.week3.reps).toBe(40);
    });
  });

  describe("toggleSubExerciseWorkDefinition() - Sub-exercise targeting", () => {
    it("should toggle sub-exercise work definition without affecting parent block", () => {
      const workout = createCompoundWorkout();
      const editor = new WorkoutEditor(workout);

      // Get initial state of parent block
      const initialWorkout = editor.getWorkout();
      const initialParent = initialWorkout.days.day1.exercises[0] as any;

      expect(initialParent.week1.work_time_minutes).toBe(6);
      expect(initialParent.week1.work_time_unit).toBe("minutes");

      // Toggle first sub-exercise (Turkish Get-Up) to work_time
      const result = editor.toggleSubExerciseWorkDefinition("day1", 0, 0);
      expect(result.success).toBe(true);
      expect(result.newMode).toBe("work_time");

      // Verify sub-exercise changed
      const modifiedWorkout = editor.getWorkout();
      const modifiedParent = modifiedWorkout.days.day1.exercises[0] as any;
      const modifiedSubEx = modifiedParent.sub_exercises![0] as any;

      expect(modifiedSubEx.week1.work_time_minutes).toBe(3); // From reps: 3
      expect(modifiedSubEx.week1.work_time_unit).toBe("seconds"); // Strength exercise default
      expect(modifiedSubEx.week1.reps).toBeUndefined(); // Reps deleted

      // Verify parent block unchanged
      expect(modifiedParent.week1.work_time_minutes).toBe(6);
      expect(modifiedParent.week1.work_time_unit).toBe("minutes");
      expect(modifiedParent.week2.work_time_minutes).toBe(7);
      expect(modifiedParent.week3.work_time_minutes).toBe(8);
    });

    it("should toggle sub-exercise without affecting other sub-exercises", () => {
      const workout = createCompoundWorkout();
      const editor = new WorkoutEditor(workout);

      // Get initial state of second sub-exercise
      const initialWorkout = editor.getWorkout();
      const initialParent = initialWorkout.days.day1.exercises[0] as any;
      const initialSubEx2 = initialParent.sub_exercises![1] as any;

      expect(initialSubEx2.week1.reps).toBe(8);
      expect(initialSubEx2.week1.work_time_minutes).toBeUndefined();

      // Toggle first sub-exercise
      editor.toggleSubExerciseWorkDefinition("day1", 0, 0);

      // Verify second sub-exercise unchanged
      const modifiedWorkout = editor.getWorkout();
      const modifiedParent = modifiedWorkout.days.day1.exercises[0] as any;
      const modifiedSubEx2 = modifiedParent.sub_exercises![1] as any;

      expect(modifiedSubEx2.week1.reps).toBe(8); // Unchanged
      expect(modifiedSubEx2.week1.work_time_minutes).toBeUndefined(); // Still undefined
    });

    it("should use smart time units for sub-exercises based on exercise name", () => {
      const workout = createCompoundWorkout();
      const editor = new WorkoutEditor(workout);

      // Toggle first sub-exercise (Turkish Get-Up - strength exercise)
      editor.toggleSubExerciseWorkDefinition("day1", 0, 0);

      const modifiedWorkout = editor.getWorkout();
      const modifiedParent = modifiedWorkout.days.day1.exercises[0] as any;
      const modifiedSubEx = modifiedParent.sub_exercises![0] as any;

      // Strength exercise should use 'seconds'
      expect(modifiedSubEx.week1.work_time_unit).toBe("seconds");
      expect(modifiedSubEx.week2.work_time_unit).toBe("seconds");
      expect(modifiedSubEx.week3.work_time_unit).toBe("seconds");
    });

    it("should handle toggling sub-exercise back to reps", () => {
      const workout = createCompoundWorkout();
      const editor = new WorkoutEditor(workout);

      // Toggle to work_time
      editor.toggleSubExerciseWorkDefinition("day1", 0, 0);

      // Toggle back to reps
      const result = editor.toggleSubExerciseWorkDefinition("day1", 0, 0);
      expect(result.success).toBe(true);
      expect(result.newMode).toBe("reps");

      // Verify restored to reps
      const modifiedWorkout = editor.getWorkout();
      const modifiedParent = modifiedWorkout.days.day1.exercises[0] as any;
      const modifiedSubEx = modifiedParent.sub_exercises![0] as any;

      expect(modifiedSubEx.week1.reps).toBe(3);
      expect(modifiedSubEx.week1.work_time_minutes).toBeUndefined();
      expect(modifiedSubEx.week1.work_time_unit).toBeUndefined();
    });

    it("should return error if compound exercise not found", () => {
      const workout = createStrengthWorkout(); // No compound exercises
      const editor = new WorkoutEditor(workout);

      const result = editor.toggleSubExerciseWorkDefinition("day1", 0, 0);
      expect(result.success).toBe(false);
      expect(result.message).toBe("Compound exercise not found");
      expect(result.newMode).toBe(null);
    });

    it("should return error if sub-exercise index out of bounds", () => {
      const workout = createCompoundWorkout();
      const editor = new WorkoutEditor(workout);

      // Try to toggle sub-exercise index 5 (only 2 sub-exercises exist)
      const result = editor.toggleSubExerciseWorkDefinition("day1", 0, 5);
      expect(result.success).toBe(false);
      expect(result.message).toBe("Sub-exercise not found");
      expect(result.newMode).toBe(null);
    });
  });

  describe("Undo support for new toggle methods", () => {
    it("should support undo for smart time unit toggle", () => {
      const workout = createCardioWorkout();
      const editor = new WorkoutEditor(workout);

      // Get initial state
      const initialWorkout = editor.getWorkout();
      const initialExercise = initialWorkout.days.day1.exercises[0] as any;

      expect(initialExercise.week1.reps).toBe(30);
      expect(initialExercise.week1.work_time_minutes).toBeUndefined();

      // Toggle to work_time
      editor.toggleWorkDefinition("day1", 0);

      // Undo the toggle
      const undoEntry = editor.undo();
      expect(undoEntry).not.toBe(null);
      expect(undoEntry!.action).toContain("Toggle work definition");

      // Verify restored to initial state
      const undoneWorkout = editor.getWorkout();
      const undoneExercise = undoneWorkout.days.day1.exercises[0] as any;

      expect(undoneExercise.week1.reps).toBe(30);
      expect(undoneExercise.week1.work_time_minutes).toBeUndefined();
      expect(undoneExercise.week1.work_time_unit).toBeUndefined();
    });

    it("should support undo for sub-exercise toggle", () => {
      const workout = createCompoundWorkout();
      const editor = new WorkoutEditor(workout);

      // Get initial state
      const initialWorkout = editor.getWorkout();
      const initialParent = initialWorkout.days.day1.exercises[0] as any;
      const initialSubEx = initialParent.sub_exercises![0] as any;

      expect(initialSubEx.week1.reps).toBe(3);
      expect(initialSubEx.week1.work_time_minutes).toBeUndefined();

      // Toggle sub-exercise to work_time
      editor.toggleSubExerciseWorkDefinition("day1", 0, 0);

      // Undo the toggle
      const undoEntry = editor.undo();
      expect(undoEntry).not.toBe(null);
      expect(undoEntry!.action).toContain("Toggle sub-exercise work definition");

      // Verify restored to initial state
      const undoneWorkout = editor.getWorkout();
      const undoneParent = undoneWorkout.days.day1.exercises[0] as any;
      const undoneSubEx = undoneParent.sub_exercises![0] as any;

      expect(undoneSubEx.week1.reps).toBe(3);
      expect(undoneSubEx.week1.work_time_minutes).toBeUndefined();
      expect(undoneSubEx.week1.work_time_unit).toBeUndefined();
    });
  });
});
