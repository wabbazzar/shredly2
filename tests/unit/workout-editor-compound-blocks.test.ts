/**
 * Unit Tests for WorkoutEditor - Compound Block Creation
 *
 * Tests the manual compound block creation functionality:
 * - createCompoundBlock() - Create empty EMOM/AMRAP/Circuit/Interval blocks
 * - setCompoundBlockType() - Change block type after creation
 * - updateCompoundBlockName() - Regenerate names from sub-exercises
 */

import { describe, it, expect } from "vitest";
import { WorkoutEditor } from "../../src/lib/engine/workout-editor.js";
import type {
  ParameterizedWorkout,
  ParameterizedExercise,
} from "../../src/lib/engine/types.js";

/**
 * Helper: Create a minimal workout for testing
 */
function createTestWorkout(): ParameterizedWorkout {
  return {
    id: "test_workout_1",
    name: "Test Workout",
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
        focus: "Full Body",
        exercises: [
          {
            name: "Squats",
            category: "barbell_squat",
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
          },
        ],
      },
    },
  };
}

describe("WorkoutEditor - createCompoundBlock()", () => {
  it("should create empty EMOM block with placeholder name", () => {
    const workout = createTestWorkout();
    const editor = new WorkoutEditor(workout);

    const result = editor.createCompoundBlock("day1", 0, "emom");

    expect(result.success).toBe(true);
    expect(result.message).toContain("EMOM");
    expect(result.newExerciseIndex).toBe(1);

    const updatedWorkout = editor.getWorkout();
    const newBlock = updatedWorkout.days.day1.exercises[1];

    expect(newBlock.name).toBe("[EMOM] (empty block - add sub-exercises)");
    expect(newBlock.category).toBe("emom");
    expect(newBlock.sub_exercises).toEqual([]);
  });

  it("should create empty AMRAP block with placeholder name", () => {
    const workout = createTestWorkout();
    const editor = new WorkoutEditor(workout);

    const result = editor.createCompoundBlock("day1", 0, "amrap");

    expect(result.success).toBe(true);
    const updatedWorkout = editor.getWorkout();
    const newBlock = updatedWorkout.days.day1.exercises[1];

    expect(newBlock.name).toBe("[AMRAP] (empty block - add sub-exercises)");
    expect(newBlock.category).toBe("amrap");
  });

  it("should create empty Circuit block with placeholder name", () => {
    const workout = createTestWorkout();
    const editor = new WorkoutEditor(workout);

    const result = editor.createCompoundBlock("day1", 0, "circuit");

    expect(result.success).toBe(true);
    const updatedWorkout = editor.getWorkout();
    const newBlock = updatedWorkout.days.day1.exercises[1];

    expect(newBlock.name).toBe("[CIRCUIT] (empty block - add sub-exercises)");
    expect(newBlock.category).toBe("circuit");
  });

  it("should create empty Interval block with placeholder name", () => {
    const workout = createTestWorkout();
    const editor = new WorkoutEditor(workout);

    const result = editor.createCompoundBlock("day1", 0, "interval");

    expect(result.success).toBe(true);
    const updatedWorkout = editor.getWorkout();
    const newBlock = updatedWorkout.days.day1.exercises[1];

    expect(newBlock.name).toBe("[INTERVAL] (empty block - add sub-exercises)");
    expect(newBlock.category).toBe("interval");
  });

  it("should populate all week parameters with smart defaults", () => {
    const workout = createTestWorkout();
    const editor = new WorkoutEditor(workout);

    editor.createCompoundBlock("day1", 0, "emom");

    const updatedWorkout = editor.getWorkout();
    const newBlock = updatedWorkout.days.day1.exercises[1] as any;

    // Should have week parameters for all 3 weeks
    expect(newBlock.week1).toBeDefined();
    expect(newBlock.week2).toBeDefined();
    expect(newBlock.week3).toBeDefined();

    // EMOM blocks should have work_time parameters
    expect(newBlock.week1.work_time_minutes).toBeDefined();
    expect(newBlock.week1.work_time_unit).toBeDefined();
  });

  it("should insert at correct position (after insertAfterIndex)", () => {
    const workout = createTestWorkout();
    const editor = new WorkoutEditor(workout);

    editor.createCompoundBlock("day1", 0, "emom");

    const updatedWorkout = editor.getWorkout();
    expect(updatedWorkout.days.day1.exercises.length).toBe(2);
    expect(updatedWorkout.days.day1.exercises[0].name).toBe("Squats");
    expect(updatedWorkout.days.day1.exercises[1].name).toBe(
      "[EMOM] (empty block - add sub-exercises)"
    );
  });

  it("should add creation to undo stack", () => {
    const workout = createTestWorkout();
    const editor = new WorkoutEditor(workout);

    expect(editor.getUndoStackSize()).toBe(0);
    editor.createCompoundBlock("day1", 0, "emom");
    expect(editor.getUndoStackSize()).toBe(1);
  });

  it("should be undoable", () => {
    const workout = createTestWorkout();
    const editor = new WorkoutEditor(workout);

    editor.createCompoundBlock("day1", 0, "emom");
    expect(editor.getWorkout().days.day1.exercises.length).toBe(2);

    const undoEntry = editor.undo();
    expect(undoEntry).not.toBeNull();
    expect(undoEntry!.action).toContain("EMOM");

    const revertedWorkout = editor.getWorkout();
    expect(revertedWorkout.days.day1.exercises.length).toBe(1);
  });

  it("should fail if day does not exist", () => {
    const workout = createTestWorkout();
    const editor = new WorkoutEditor(workout);

    const result = editor.createCompoundBlock("day99", 0, "emom");

    expect(result.success).toBe(false);
    expect(result.message).toContain("not found");
  });
});

describe("WorkoutEditor - setCompoundBlockType()", () => {
  it("should change EMOM to AMRAP and update name", () => {
    const workout = createTestWorkout();
    const editor = new WorkoutEditor(workout);

    editor.createCompoundBlock("day1", 0, "emom");
    const result = editor.setCompoundBlockType("day1", 1, "amrap");

    expect(result.success).toBe(true);
    expect(result.message).toContain("AMRAP");

    const updatedWorkout = editor.getWorkout();
    const block = updatedWorkout.days.day1.exercises[1];

    expect(block.category).toBe("amrap");
    expect(block.name).toBe("[AMRAP] (empty block - add sub-exercises)");
  });

  it("should change EMOM to Circuit and update name", () => {
    const workout = createTestWorkout();
    const editor = new WorkoutEditor(workout);

    editor.createCompoundBlock("day1", 0, "emom");
    editor.setCompoundBlockType("day1", 1, "circuit");

    const updatedWorkout = editor.getWorkout();
    const block = updatedWorkout.days.day1.exercises[1];

    expect(block.category).toBe("circuit");
    expect(block.name).toBe("[CIRCUIT] (empty block - add sub-exercises)");
  });

  it("should change EMOM to Interval and update name", () => {
    const workout = createTestWorkout();
    const editor = new WorkoutEditor(workout);

    editor.createCompoundBlock("day1", 0, "emom");
    editor.setCompoundBlockType("day1", 1, "interval");

    const updatedWorkout = editor.getWorkout();
    const block = updatedWorkout.days.day1.exercises[1];

    expect(block.category).toBe("interval");
    expect(block.name).toBe("[INTERVAL] (empty block - add sub-exercises)");
  });

  it("should update name when block has sub-exercises", () => {
    const workout = createTestWorkout();
    const editor = new WorkoutEditor(workout);

    // Create EMOM block and add sub-exercises
    editor.createCompoundBlock("day1", 0, "emom");
    editor.insertSubExercise("day1", 1, "Pull-ups");
    editor.insertSubExercise("day1", 1, "Push-ups");

    const beforeChange = editor.getWorkout();
    expect(beforeChange.days.day1.exercises[1].name).toContain("EMOM");

    // Change to Circuit
    editor.setCompoundBlockType("day1", 1, "circuit");

    const afterChange = editor.getWorkout();
    const block = afterChange.days.day1.exercises[1];

    expect(block.category).toBe("circuit");
    expect(block.name).toBe("[CIRCUIT] CIRCUIT: Pull-ups + Push-ups");
  });

  it("should preserve existing week parameters", () => {
    const workout = createTestWorkout();
    const editor = new WorkoutEditor(workout);

    editor.createCompoundBlock("day1", 0, "emom");

    const beforeChange = editor.getWorkout();
    const beforeBlock = beforeChange.days.day1.exercises[1] as any;
    const originalWorkTime = beforeBlock.week1.work_time_minutes;

    editor.setCompoundBlockType("day1", 1, "amrap");

    const afterChange = editor.getWorkout();
    const afterBlock = afterChange.days.day1.exercises[1] as any;

    expect(afterBlock.week1.work_time_minutes).toBe(originalWorkTime);
  });

  it("should add type change to undo stack", () => {
    const workout = createTestWorkout();
    const editor = new WorkoutEditor(workout);

    editor.createCompoundBlock("day1", 0, "emom");
    const stackSizeBefore = editor.getUndoStackSize();

    editor.setCompoundBlockType("day1", 1, "amrap");

    expect(editor.getUndoStackSize()).toBe(stackSizeBefore + 1);
  });

  it("should be undoable", () => {
    const workout = createTestWorkout();
    const editor = new WorkoutEditor(workout);

    editor.createCompoundBlock("day1", 0, "emom");
    editor.setCompoundBlockType("day1", 1, "amrap");

    const beforeUndo = editor.getWorkout();
    expect(beforeUndo.days.day1.exercises[1].category).toBe("amrap");

    editor.undo();

    const afterUndo = editor.getWorkout();
    expect(afterUndo.days.day1.exercises[1].category).toBe("emom");
    expect(afterUndo.days.day1.exercises[1].name).toContain("EMOM");
  });

  it("should fail if exercise is not compound", () => {
    const workout = createTestWorkout();
    const editor = new WorkoutEditor(workout);

    const result = editor.setCompoundBlockType("day1", 0, "amrap");

    expect(result.success).toBe(false);
    expect(result.message).toContain("non-compound");
  });

  it("should fail if exercise does not exist", () => {
    const workout = createTestWorkout();
    const editor = new WorkoutEditor(workout);

    const result = editor.setCompoundBlockType("day1", 99, "amrap");

    expect(result.success).toBe(false);
    expect(result.message).toContain("not found");
  });
});

describe("WorkoutEditor - updateCompoundBlockName()", () => {
  it("should return placeholder for empty compound block", () => {
    const workout = createTestWorkout();
    const editor = new WorkoutEditor(workout);

    editor.createCompoundBlock("day1", 0, "emom");

    const block = editor.getWorkout().days.day1.exercises[1];
    const name = editor.updateCompoundBlockName(block);

    expect(name).toBe("[EMOM] (empty block - add sub-exercises)");
  });

  it("should generate name with single sub-exercise", () => {
    const workout = createTestWorkout();
    const editor = new WorkoutEditor(workout);

    editor.createCompoundBlock("day1", 0, "emom");
    editor.insertSubExercise("day1", 1, "Pull-ups");

    const block = editor.getWorkout().days.day1.exercises[1];
    const name = editor.updateCompoundBlockName(block);

    expect(name).toBe("[EMOM] EMOM: Pull-ups");
  });

  it("should generate name with multiple sub-exercises", () => {
    const workout = createTestWorkout();
    const editor = new WorkoutEditor(workout);

    editor.createCompoundBlock("day1", 0, "circuit");
    editor.insertSubExercise("day1", 1, "Pull-ups");
    editor.insertSubExercise("day1", 1, "Push-ups");
    editor.insertSubExercise("day1", 1, "Squat Jumps");

    const block = editor.getWorkout().days.day1.exercises[1];
    const name = editor.updateCompoundBlockName(block);

    expect(name).toBe("[CIRCUIT] CIRCUIT: Pull-ups + Push-ups + Squat Jumps");
  });

  it("should use correct category prefix for AMRAP", () => {
    const workout = createTestWorkout();
    const editor = new WorkoutEditor(workout);

    editor.createCompoundBlock("day1", 0, "amrap");
    editor.insertSubExercise("day1", 1, "Burpees");

    const block = editor.getWorkout().days.day1.exercises[1];
    const name = editor.updateCompoundBlockName(block);

    expect(name).toBe("[AMRAP] AMRAP: Burpees");
  });

  it("should use correct category prefix for Interval", () => {
    const workout = createTestWorkout();
    const editor = new WorkoutEditor(workout);

    editor.createCompoundBlock("day1", 0, "interval");
    editor.insertSubExercise("day1", 1, "Sprint in Place");

    const block = editor.getWorkout().days.day1.exercises[1];
    const name = editor.updateCompoundBlockName(block);

    expect(name).toBe("[INTERVAL] INTERVAL: Sprint in Place");
  });

  it("should return null for non-compound exercise", () => {
    const workout = createTestWorkout();
    const editor = new WorkoutEditor(workout);

    const regularExercise = editor.getWorkout().days.day1.exercises[0];
    const name = editor.updateCompoundBlockName(regularExercise);

    expect(name).toBeNull();
  });

  it("should auto-update name when sub-exercise added", () => {
    const workout = createTestWorkout();
    const editor = new WorkoutEditor(workout);

    editor.createCompoundBlock("day1", 0, "emom");

    const beforeAdd = editor.getWorkout();
    expect(beforeAdd.days.day1.exercises[1].name).toBe(
      "[EMOM] (empty block - add sub-exercises)"
    );

    editor.insertSubExercise("day1", 1, "Pull-ups");

    const afterAdd = editor.getWorkout();
    expect(afterAdd.days.day1.exercises[1].name).toBe("[EMOM] EMOM: Pull-ups");
  });

  it("should auto-update name when second sub-exercise added", () => {
    const workout = createTestWorkout();
    const editor = new WorkoutEditor(workout);

    editor.createCompoundBlock("day1", 0, "emom");
    editor.insertSubExercise("day1", 1, "Pull-ups");

    const beforeAdd = editor.getWorkout();
    expect(beforeAdd.days.day1.exercises[1].name).toBe("[EMOM] EMOM: Pull-ups");

    editor.insertSubExercise("day1", 1, "Push-ups");

    const afterAdd = editor.getWorkout();
    expect(afterAdd.days.day1.exercises[1].name).toBe(
      "[EMOM] EMOM: Pull-ups + Push-ups"
    );
  });
});

describe("WorkoutEditor - Integration: Compound Block Workflow", () => {
  it("should support full workflow: create -> add sub-exercises -> change type", () => {
    const workout = createTestWorkout();
    const editor = new WorkoutEditor(workout);

    // Step 1: Create EMOM block
    editor.createCompoundBlock("day1", 0, "emom");
    expect(editor.getWorkout().days.day1.exercises[1].name).toBe(
      "[EMOM] (empty block - add sub-exercises)"
    );

    // Step 2: Add first sub-exercise
    editor.insertSubExercise("day1", 1, "Pull-ups");
    expect(editor.getWorkout().days.day1.exercises[1].name).toBe(
      "[EMOM] EMOM: Pull-ups"
    );

    // Step 3: Add second sub-exercise
    editor.insertSubExercise("day1", 1, "Push-ups");
    expect(editor.getWorkout().days.day1.exercises[1].name).toBe(
      "[EMOM] EMOM: Pull-ups + Push-ups"
    );

    // Step 4: Change to Circuit
    editor.setCompoundBlockType("day1", 1, "circuit");
    expect(editor.getWorkout().days.day1.exercises[1].name).toBe(
      "[CIRCUIT] CIRCUIT: Pull-ups + Push-ups"
    );
    expect(editor.getWorkout().days.day1.exercises[1].category).toBe("circuit");
  });

  it("should maintain undo history through full workflow", () => {
    const workout = createTestWorkout();
    const editor = new WorkoutEditor(workout);

    editor.createCompoundBlock("day1", 0, "emom");
    editor.insertSubExercise("day1", 1, "Pull-ups");
    editor.insertSubExercise("day1", 1, "Push-ups");
    editor.setCompoundBlockType("day1", 1, "circuit");

    expect(editor.getUndoStackSize()).toBe(4);

    // Undo type change
    editor.undo();
    expect(editor.getWorkout().days.day1.exercises[1].category).toBe("emom");

    // Undo second sub-exercise
    editor.undo();
    expect(editor.getWorkout().days.day1.exercises[1].sub_exercises!.length).toBe(
      1
    );

    // Undo first sub-exercise
    editor.undo();
    expect(editor.getWorkout().days.day1.exercises[1].sub_exercises!.length).toBe(
      0
    );

    // Undo block creation
    editor.undo();
    expect(editor.getWorkout().days.day1.exercises.length).toBe(1);
  });

  it("should validate that created blocks match WORKOUT_SPEC.md structure", () => {
    const workout = createTestWorkout();
    const editor = new WorkoutEditor(workout);

    editor.createCompoundBlock("day1", 0, "emom");
    editor.insertSubExercise("day1", 1, "Pull-ups");
    editor.insertSubExercise("day1", 1, "Push-ups");

    const block = editor.getWorkout().days.day1.exercises[1] as any;

    // Verify WORKOUT_SPEC.md compliance
    expect(block.name).toBeDefined();
    expect(block.category).toBe("emom");
    expect(Array.isArray(block.sub_exercises)).toBe(true);
    expect(block.sub_exercises.length).toBe(2);

    // Verify week parameters exist
    expect(block.week1).toBeDefined();
    expect(block.week2).toBeDefined();
    expect(block.week3).toBeDefined();

    // Verify sub-exercises have proper structure
    const subEx1 = block.sub_exercises[0];
    expect(subEx1.name).toBe("Pull-ups");
    expect(subEx1.week1).toBeDefined();
    expect(subEx1.week1.reps).toBeDefined();
  });
});
