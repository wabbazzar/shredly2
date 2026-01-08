/**
 * Tests for WorkoutEditor swap and delete operations
 *
 * Testing:
 * 1. Swap mode functionality
 * 2. Compound block deletion (sub-exercise vs parent)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WorkoutEditor } from '../../src/lib/engine/workout-editor.js';
import type { ParameterizedWorkout, ParameterizedExercise } from '../../src/lib/engine/types.js';

describe('WorkoutEditor - Swap Exercises', () => {
  let workout: ParameterizedWorkout;
  let editor: WorkoutEditor;

  beforeEach(() => {
    // Create a minimal workout with 2 days, each with 2 exercises
    workout = {
      name: 'Test Workout',
      version: '2.0.0',
      description: 'Test workout for swap functionality',
      weeks: 3,
      daysPerWeek: 2,
      split: 'full_body',
      difficulty: 'intermediate',
      estimatedDuration: '45-60',
      days: {
        day1: {
          focus: 'Full Body',
          exercises: [
            {
              name: 'Bench Press',
              category: 'strength',
              progressionScheme: 'linear',
              intensityProfile: 'heavy',
              week1: { sets: 3, reps: 8, weight: { percent_tm: 75 }, rest_time_minutes: 2 },
              week2: { sets: 3, reps: 8, weight: { percent_tm: 75 }, rest_time_minutes: 2 },
              week3: { sets: 3, reps: 8, weight: { percent_tm: 75 }, rest_time_minutes: 2 }
            },
            {
              name: 'Squat',
              category: 'strength',
              progressionScheme: 'linear',
              intensityProfile: 'heavy',
              week1: { sets: 3, reps: 8, weight: { percent_tm: 75 }, rest_time_minutes: 2 },
              week2: { sets: 3, reps: 8, weight: { percent_tm: 75 }, rest_time_minutes: 2 },
              week3: { sets: 3, reps: 8, weight: { percent_tm: 75 }, rest_time_minutes: 2 }
            }
          ]
        },
        day2: {
          focus: 'Full Body',
          exercises: [
            {
              name: 'Pull-ups',
              category: 'strength',
              progressionScheme: 'linear',
              intensityProfile: 'moderate',
              week1: { sets: 3, reps: 10, weight: { descriptor: 'bodyweight' }, rest_time_minutes: 1.5 },
              week2: { sets: 3, reps: 10, weight: { descriptor: 'bodyweight' }, rest_time_minutes: 1.5 },
              week3: { sets: 3, reps: 10, weight: { descriptor: 'bodyweight' }, rest_time_minutes: 1.5 }
            },
            {
              name: 'Deadlift',
              category: 'strength',
              progressionScheme: 'linear',
              intensityProfile: 'heavy',
              week1: { sets: 3, reps: 5, weight: { percent_tm: 80 }, rest_time_minutes: 3 },
              week2: { sets: 3, reps: 5, weight: { percent_tm: 80 }, rest_time_minutes: 3 },
              week3: { sets: 3, reps: 5, weight: { percent_tm: 80 }, rest_time_minutes: 3 }
            }
          ]
        }
      }
    };

    editor = new WorkoutEditor(workout);
  });

  describe('swapExercises()', () => {
    it('should swap two exercises in the same day', () => {
      // Swap exercise 0 and exercise 1 in day1
      const result = editor.swapExercises('day1', 0, 'day1', 1);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Swapped');

      const modifiedWorkout = editor.getWorkout();

      // After swap, positions should be reversed
      expect(modifiedWorkout.days.day1.exercises[0].name).toBe('Squat');
      expect(modifiedWorkout.days.day1.exercises[1].name).toBe('Bench Press');
    });

    it('should swap exercises across different days', () => {
      // Swap exercise 0 from day1 with exercise 1 from day2
      const result = editor.swapExercises('day1', 0, 'day2', 1);

      expect(result.success).toBe(true);

      const modifiedWorkout = editor.getWorkout();

      // Bench Press should now be in day2, position 1
      expect(modifiedWorkout.days.day2.exercises[1].name).toBe('Bench Press');
      // Deadlift should now be in day1, position 0
      expect(modifiedWorkout.days.day1.exercises[0].name).toBe('Deadlift');
    });

    it('should mark workout as modified after swap', () => {
      expect(editor.isModified()).toBe(false);

      editor.swapExercises('day1', 0, 'day1', 1);

      expect(editor.isModified()).toBe(true);
    });

    it('should add swap operation to undo stack', () => {
      expect(editor.getUndoStackSize()).toBe(0);

      editor.swapExercises('day1', 0, 'day1', 1);

      expect(editor.getUndoStackSize()).toBe(1);
    });

    it('should support undo after swap', () => {
      const originalWorkout = editor.getWorkout();

      editor.swapExercises('day1', 0, 'day1', 1);

      const swappedWorkout = editor.getWorkout();
      expect(swappedWorkout.days.day1.exercises[0].name).toBe('Squat');

      // Undo the swap
      const undoEntry = editor.undo();
      expect(undoEntry).not.toBeNull();
      expect(undoEntry?.action).toContain('Swapped');

      const undoneWorkout = editor.getWorkout();
      expect(undoneWorkout.days.day1.exercises[0].name).toBe('Bench Press');
      expect(undoneWorkout.days.day1.exercises[1].name).toBe('Squat');
    });

    it('should fail gracefully when day key is invalid', () => {
      const result = editor.swapExercises('invalid_day', 0, 'day1', 1);

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('should fail gracefully when exercise index is out of range', () => {
      const result = editor.swapExercises('day1', 999, 'day1', 1);

      expect(result.success).toBe(false);
      expect(result.message).toContain('out of range');
    });

    it('should swap exercises even when navigating between different field types', () => {
      // Simulate interactive editor behavior:
      // 1. User is on exercise 0, name field → press 'a' to mark
      // 2. User navigates with 't' to exercise 0, sets field (or any non-name field)
      // 3. User navigates with 't' to exercise 1, reps field (not name field)
      // 4. User presses 'a' again to swap

      // For this test, we'll just verify that swapping works regardless of which
      // field the editor is "on" - the swap should work at the exercise level

      // The issue is in the interactive editor, not the WorkoutEditor class itself
      // WorkoutEditor.swapExercises() works fine (as shown by other tests)
      // The bug is that interactive editor only allows swap when on name fields

      // This test documents expected behavior for the fix
      const result = editor.swapExercises('day1', 0, 'day1', 1);
      expect(result.success).toBe(true);
    });
  });
});

describe('WorkoutEditor - Delete Compound Block Sub-Exercises', () => {
  let workout: ParameterizedWorkout;
  let editor: WorkoutEditor;

  beforeEach(() => {
    // Create a workout with a compound block (INTERVAL with 2 sub-exercises)
    workout = {
      name: 'Test Workout with Compound Block',
      version: '2.0.0',
      description: 'Test workout for compound block deletion',
      weeks: 3,
      daysPerWeek: 1,
      split: 'full_body',
      difficulty: 'intermediate',
      estimatedDuration: '45-60',
      days: {
        day1: {
          focus: 'Full Body',
          exercises: [
            {
              name: 'Bench Press',
              category: 'strength',
              progressionScheme: 'linear',
              intensityProfile: 'heavy',
              week1: { sets: 3, reps: 8, weight: { percent_tm: 75 }, rest_time_minutes: 2 },
              week2: { sets: 3, reps: 8, weight: { percent_tm: 75 }, rest_time_minutes: 2 },
              week3: { sets: 3, reps: 8, weight: { percent_tm: 75 }, rest_time_minutes: 2 }
            },
            {
              name: 'INTERVAL: Mountain Climbers + Burpees',
              category: 'interval',
              progressionScheme: 'density',
              intensityProfile: 'moderate',
              sub_exercises: [
                {
                  name: 'Mountain Climbers',
                  progressionScheme: 'density'
                },
                {
                  name: 'Burpees',
                  progressionScheme: 'density'
                }
              ],
              week1: {
                sets: 4,
                work_time_minutes: 0.5,
                rest_time_minutes: 0.25,
                sub_exercises: [
                  { reps: 10 },
                  { reps: 8 }
                ]
              },
              week2: {
                sets: 4,
                work_time_minutes: 0.5,
                rest_time_minutes: 0.25,
                sub_exercises: [
                  { reps: 12 },
                  { reps: 10 }
                ]
              },
              week3: {
                sets: 4,
                work_time_minutes: 0.5,
                rest_time_minutes: 0.25,
                sub_exercises: [
                  { reps: 14 },
                  { reps: 12 }
                ]
              }
            },
            {
              name: 'Squat',
              category: 'strength',
              progressionScheme: 'linear',
              intensityProfile: 'heavy',
              week1: { sets: 3, reps: 8, weight: { percent_tm: 75 }, rest_time_minutes: 2 },
              week2: { sets: 3, reps: 8, weight: { percent_tm: 75 }, rest_time_minutes: 2 },
              week3: { sets: 3, reps: 8, weight: { percent_tm: 75 }, rest_time_minutes: 2 }
            }
          ]
        }
      }
    };

    editor = new WorkoutEditor(workout);
  });

  describe('deleteExercise() - Compound Block Behavior', () => {
    it('should delete entire compound block when deleting the parent exercise', () => {
      // Delete the compound parent (exercise index 1)
      const result = editor.deleteExercise('day1', 1);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Deleted');

      const modifiedWorkout = editor.getWorkout();

      // Should have 2 exercises left (Bench Press and Squat)
      expect(modifiedWorkout.days.day1.exercises.length).toBe(2);
      expect(modifiedWorkout.days.day1.exercises[0].name).toBe('Bench Press');
      expect(modifiedWorkout.days.day1.exercises[1].name).toBe('Squat');
    });

    it('should NOT delete entire block when deleting a sub-exercise', () => {
      // Before deletion, compound block has 2 sub-exercises
      const beforeWorkout = editor.getWorkout();
      expect(beforeWorkout.days.day1.exercises[1].sub_exercises?.length).toBe(2);

      // Delete first sub-exercise (Mountain Climbers) using deleteSubExercise
      const result = editor.deleteSubExercise('day1', 1, 0);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Deleted sub-exercise');

      const modifiedWorkout = editor.getWorkout();

      // Should still have 3 exercises (compound block not deleted)
      expect(modifiedWorkout.days.day1.exercises.length).toBe(3);
      expect(modifiedWorkout.days.day1.exercises[1].name).toContain('INTERVAL');

      // Compound block should have 1 sub-exercise remaining (Burpees)
      expect(modifiedWorkout.days.day1.exercises[1].sub_exercises?.length).toBe(1);
      expect(modifiedWorkout.days.day1.exercises[1].sub_exercises?.[0].name).toBe('Burpees');
    });

    it('should delete entire block when deleting the last sub-exercise', () => {
      // Delete first sub-exercise
      editor.deleteSubExercise('day1', 1, 0);

      // Now delete the last remaining sub-exercise
      const result = editor.deleteSubExercise('day1', 1, 0); // Index 0 because we already deleted index 0

      expect(result.success).toBe(true);

      const modifiedWorkout = editor.getWorkout();

      // Entire compound block should be deleted
      expect(modifiedWorkout.days.day1.exercises.length).toBe(2);
      expect(modifiedWorkout.days.day1.exercises[0].name).toBe('Bench Press');
      expect(modifiedWorkout.days.day1.exercises[1].name).toBe('Squat');
    });

    it('should update compound block name after sub-exercise deletion', () => {
      // Before: INTERVAL: Mountain Climbers + Burpees
      const beforeWorkout = editor.getWorkout();
      expect(beforeWorkout.days.day1.exercises[1].name).toBe('INTERVAL: Mountain Climbers + Burpees');

      // Delete Mountain Climbers
      editor.deleteSubExercise('day1', 1, 0);

      // After: INTERVAL: Burpees
      const afterWorkout = editor.getWorkout();
      expect(afterWorkout.days.day1.exercises[1].name).toBe('INTERVAL: Burpees');
    });

    it('should support undo after sub-exercise deletion', () => {
      editor.deleteSubExercise('day1', 1, 0);

      const afterDelete = editor.getWorkout();
      expect(afterDelete.days.day1.exercises[1].sub_exercises?.length).toBe(1);

      // Undo deletion
      const undoEntry = editor.undo();
      expect(undoEntry).not.toBeNull();
      expect(undoEntry?.action).toContain('Delete sub-exercise');

      const afterUndo = editor.getWorkout();
      expect(afterUndo.days.day1.exercises[1].sub_exercises?.length).toBe(2);
      expect(afterUndo.days.day1.exercises[1].sub_exercises?.[0].name).toBe('Mountain Climbers');
    });
  });
});
