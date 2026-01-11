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
    expect(block.name).toBe("CIRCUIT: Pull-ups + Push-ups");
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

    expect(name).toBe("EMOM: Pull-ups");
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

    expect(name).toBe("CIRCUIT: Pull-ups + Push-ups + Squat Jumps");
  });

  it("should use correct category prefix for AMRAP", () => {
    const workout = createTestWorkout();
    const editor = new WorkoutEditor(workout);

    editor.createCompoundBlock("day1", 0, "amrap");
    editor.insertSubExercise("day1", 1, "Burpees");

    const block = editor.getWorkout().days.day1.exercises[1];
    const name = editor.updateCompoundBlockName(block);

    expect(name).toBe("AMRAP: Burpees");
  });

  it("should use correct category prefix for Interval", () => {
    const workout = createTestWorkout();
    const editor = new WorkoutEditor(workout);

    editor.createCompoundBlock("day1", 0, "interval");
    editor.insertSubExercise("day1", 1, "Sprint in Place");

    const block = editor.getWorkout().days.day1.exercises[1];
    const name = editor.updateCompoundBlockName(block);

    expect(name).toBe("INTERVAL: Sprint in Place");
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
    expect(afterAdd.days.day1.exercises[1].name).toBe("EMOM: Pull-ups");
  });

  it("should auto-update name when second sub-exercise added", () => {
    const workout = createTestWorkout();
    const editor = new WorkoutEditor(workout);

    editor.createCompoundBlock("day1", 0, "emom");
    editor.insertSubExercise("day1", 1, "Pull-ups");

    const beforeAdd = editor.getWorkout();
    expect(beforeAdd.days.day1.exercises[1].name).toBe("EMOM: Pull-ups");

    editor.insertSubExercise("day1", 1, "Push-ups");

    const afterAdd = editor.getWorkout();
    expect(afterAdd.days.day1.exercises[1].name).toBe(
      "EMOM: Pull-ups + Push-ups"
    );
  });
});

describe("WorkoutEditor - Compound Block Attribute Handling", () => {
  describe("createCompoundBlock() attributes", () => {
    it("EMOM blocks should have work_time but NOT sets", () => {
      const workout = createTestWorkout();
      const editor = new WorkoutEditor(workout);

      editor.createCompoundBlock("day1", 0, "emom");

      const block = editor.getWorkout().days.day1.exercises[1] as any;

      // EMOM (time-based) should have work_time_minutes
      expect(block.week1.work_time_minutes).toBeDefined();
      expect(block.week1.work_time_unit).toBe("minutes");

      // EMOM should NOT have sets at parent level
      expect(block.week1.sets).toBeUndefined();
    });

    it("AMRAP blocks should have work_time but NOT sets", () => {
      const workout = createTestWorkout();
      const editor = new WorkoutEditor(workout);

      editor.createCompoundBlock("day1", 0, "amrap");

      const block = editor.getWorkout().days.day1.exercises[1] as any;

      // AMRAP (time-based) should have work_time_minutes
      expect(block.week1.work_time_minutes).toBeDefined();
      expect(block.week1.work_time_unit).toBe("minutes");

      // AMRAP should NOT have sets at parent level
      expect(block.week1.sets).toBeUndefined();
    });

    it("CIRCUIT blocks should have sets but NOT work_time", () => {
      const workout = createTestWorkout();
      const editor = new WorkoutEditor(workout);

      editor.createCompoundBlock("day1", 0, "circuit");

      const block = editor.getWorkout().days.day1.exercises[1] as any;

      // CIRCUIT (sets-based) should have sets
      expect(block.week1.sets).toBeDefined();
      expect(block.week1.sets).toBeGreaterThan(0);

      // CIRCUIT should NOT have work_time_minutes at parent level
      expect(block.week1.work_time_minutes).toBeUndefined();
    });

    it("INTERVAL blocks should have sets but NOT work_time at parent level", () => {
      const workout = createTestWorkout();
      const editor = new WorkoutEditor(workout);

      editor.createCompoundBlock("day1", 0, "interval");

      const block = editor.getWorkout().days.day1.exercises[1] as any;

      // INTERVAL (sets-based) should have sets
      expect(block.week1.sets).toBeDefined();
      expect(block.week1.sets).toBeGreaterThan(0);

      // INTERVAL should NOT have work_time_minutes at parent level
      // (work_time goes on sub-exercises, not parent)
      expect(block.week1.work_time_minutes).toBeUndefined();
    });
  });

  describe("setCompoundBlockType() attribute conversion", () => {
    it("should convert from EMOM (time-based) to INTERVAL (sets-based)", () => {
      const workout = createTestWorkout();
      const editor = new WorkoutEditor(workout);

      // Create EMOM block
      editor.createCompoundBlock("day1", 0, "emom");

      const beforeConvert = editor.getWorkout().days.day1.exercises[1] as any;
      expect(beforeConvert.week1.work_time_minutes).toBeDefined();
      expect(beforeConvert.week1.sets).toBeUndefined();

      // Convert to INTERVAL
      editor.setCompoundBlockType("day1", 1, "interval");

      const afterConvert = editor.getWorkout().days.day1.exercises[1] as any;

      // Should now have sets
      expect(afterConvert.week1.sets).toBeDefined();
      expect(afterConvert.week1.sets).toBeGreaterThan(0);

      // Should NOT have work_time_minutes anymore
      expect(afterConvert.week1.work_time_minutes).toBeUndefined();
    });

    it("should convert from EMOM (time-based) to CIRCUIT (sets-based)", () => {
      const workout = createTestWorkout();
      const editor = new WorkoutEditor(workout);

      editor.createCompoundBlock("day1", 0, "emom");
      editor.setCompoundBlockType("day1", 1, "circuit");

      const block = editor.getWorkout().days.day1.exercises[1] as any;

      // Should have sets, NOT work_time_minutes
      expect(block.week1.sets).toBeDefined();
      expect(block.week1.work_time_minutes).toBeUndefined();
    });

    it("should convert from INTERVAL (sets-based) to EMOM (time-based)", () => {
      const workout = createTestWorkout();
      const editor = new WorkoutEditor(workout);

      // Create INTERVAL block
      editor.createCompoundBlock("day1", 0, "interval");

      const beforeConvert = editor.getWorkout().days.day1.exercises[1] as any;
      expect(beforeConvert.week1.sets).toBeDefined();
      expect(beforeConvert.week1.work_time_minutes).toBeUndefined();

      // Convert to EMOM
      editor.setCompoundBlockType("day1", 1, "emom");

      const afterConvert = editor.getWorkout().days.day1.exercises[1] as any;

      // Should now have work_time_minutes
      expect(afterConvert.week1.work_time_minutes).toBeDefined();
      expect(afterConvert.week1.work_time_unit).toBe("minutes");

      // Should NOT have sets anymore
      expect(afterConvert.week1.sets).toBeUndefined();
    });

    it("should convert from CIRCUIT (sets-based) to AMRAP (time-based)", () => {
      const workout = createTestWorkout();
      const editor = new WorkoutEditor(workout);

      editor.createCompoundBlock("day1", 0, "circuit");
      editor.setCompoundBlockType("day1", 1, "amrap");

      const block = editor.getWorkout().days.day1.exercises[1] as any;

      // Should have work_time_minutes, NOT sets
      expect(block.week1.work_time_minutes).toBeDefined();
      expect(block.week1.sets).toBeUndefined();
    });

    it("should preserve work_time when converting between time-based types (EMOM to AMRAP)", () => {
      const workout = createTestWorkout();
      const editor = new WorkoutEditor(workout);

      editor.createCompoundBlock("day1", 0, "emom");

      const beforeConvert = editor.getWorkout().days.day1.exercises[1] as any;
      const originalWorkTime = beforeConvert.week1.work_time_minutes;

      editor.setCompoundBlockType("day1", 1, "amrap");

      const afterConvert = editor.getWorkout().days.day1.exercises[1] as any;

      // work_time should be preserved
      expect(afterConvert.week1.work_time_minutes).toBe(originalWorkTime);
    });

    it("should preserve sets when converting between sets-based types (CIRCUIT to INTERVAL)", () => {
      const workout = createTestWorkout();
      const editor = new WorkoutEditor(workout);

      editor.createCompoundBlock("day1", 0, "circuit");

      const beforeConvert = editor.getWorkout().days.day1.exercises[1] as any;
      const originalSets = beforeConvert.week1.sets;

      editor.setCompoundBlockType("day1", 1, "interval");

      const afterConvert = editor.getWorkout().days.day1.exercises[1] as any;

      // sets should be preserved
      expect(afterConvert.week1.sets).toBe(originalSets);
    });

    it("should undo attribute conversion correctly", () => {
      const workout = createTestWorkout();
      const editor = new WorkoutEditor(workout);

      editor.createCompoundBlock("day1", 0, "emom");

      const beforeConvert = editor.getWorkout().days.day1.exercises[1] as any;
      const originalWorkTime = beforeConvert.week1.work_time_minutes;

      // Convert EMOM -> INTERVAL (time-based to sets-based)
      editor.setCompoundBlockType("day1", 1, "interval");

      const afterConvert = editor.getWorkout().days.day1.exercises[1] as any;
      expect(afterConvert.week1.sets).toBeDefined();
      expect(afterConvert.week1.work_time_minutes).toBeUndefined();

      // Undo the conversion
      editor.undo();

      const afterUndo = editor.getWorkout().days.day1.exercises[1] as any;

      // Should restore original EMOM attributes
      expect(afterUndo.category).toBe("emom");
      expect(afterUndo.week1.work_time_minutes).toBe(originalWorkTime);
      expect(afterUndo.week1.sets).toBeUndefined();
    });
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
      "EMOM: Pull-ups"
    );

    // Step 3: Add second sub-exercise
    editor.insertSubExercise("day1", 1, "Push-ups");
    expect(editor.getWorkout().days.day1.exercises[1].name).toBe(
      "EMOM: Pull-ups + Push-ups"
    );

    // Step 4: Change to Circuit
    editor.setCompoundBlockType("day1", 1, "circuit");
    expect(editor.getWorkout().days.day1.exercises[1].name).toBe(
      "CIRCUIT: Pull-ups + Push-ups"
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
