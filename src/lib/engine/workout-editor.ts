/**
 * Workout Editor Engine
 *
 * Shared edit operations for ParameterizedWorkout objects
 * Used by CLI interactive editor and future UI
 *
 * Features:
 * - Multi-level undo stack
 * - Type-safe field editing
 * - Exercise replacement with smart defaults
 * - Compound exercise handling
 */

import type { ParameterizedWorkout, ParameterizedDay, ParameterizedExercise, WeekParameters, WeightSpecification } from './types.js';
import workoutGenerationRules from '../../data/workout_generation_rules.json' with { type: 'json' };
import exerciseDatabase from '../../data/exercise_database.json' with { type: 'json' };

export interface EditableField {
  location: string; // e.g., "day1.exercises[0].name", "day1.exercises[2].week1.sets"
  dayKey: string; // e.g., "day1"
  exerciseIndex: number;
  subExerciseIndex?: number; // for compound exercises
  weekKey?: string; // e.g., "week1", "week2" (for week-specific params)
  fieldName: string; // e.g., "name", "sets", "reps", "weight", "_insert_after"
  currentValue: any;
  type: 'string' | 'number' | 'weight' | 'array' | 'insertion_point';
}

export interface UndoEntry {
  timestamp: number;
  action: string; // description of what changed
  location: string; // field location
  previousValue: any;
  newValue: any;
  reverseOperation: () => void; // function to undo this change
}

export class WorkoutEditor {
  private workout: ParameterizedWorkout;
  private undoStack: UndoEntry[] = [];
  private modified: boolean = false;

  constructor(workout: ParameterizedWorkout) {
    this.workout = workout;
  }

  /**
   * Get current workout state (deep copy to prevent external mutation)
   */
  getWorkout(): ParameterizedWorkout {
    return JSON.parse(JSON.stringify(this.workout));
  }

  /**
   * Check if workout has unsaved changes
   */
  isModified(): boolean {
    return this.modified;
  }

  /**
   * Mark as saved (clears modified flag but keeps undo stack)
   */
  markSaved(): void {
    this.modified = false;
  }

  /**
   * Get all editable fields from the workout (for 't' navigation)
   */
  getAllEditableFields(): EditableField[] {
    const fields: EditableField[] = [];

    for (const dayKey in this.workout.days) {
      const day = this.workout.days[dayKey];

      day.exercises.forEach((exercise, exIndex) => {
        const baseLocation = `${dayKey}.exercises[${exIndex}]`;

        // Exercise name is always editable
        fields.push({
          location: `${baseLocation}.name`,
          dayKey,
          exerciseIndex: exIndex,
          fieldName: 'name',
          currentValue: exercise.name,
          type: 'string'
        });

        // Week parameters (sets, reps, weight, etc.)
        for (let w = 1; w <= this.workout.weeks; w++) {
          const weekKey = `week${w}`;
          const weekParams = (exercise as any)[weekKey] as WeekParameters | undefined;

          if (weekParams) {
            if (weekParams.sets !== undefined) {
              fields.push({
                location: `${baseLocation}.${weekKey}.sets`,
                dayKey,
                exerciseIndex: exIndex,
                weekKey,
                fieldName: 'sets',
                currentValue: weekParams.sets,
                type: 'number'
              });
            }

            if (weekParams.reps !== undefined) {
              fields.push({
                location: `${baseLocation}.${weekKey}.reps`,
                dayKey,
                exerciseIndex: exIndex,
                weekKey,
                fieldName: 'reps',
                currentValue: weekParams.reps,
                type: 'number'
              });
            }

            if (weekParams.weight !== undefined) {
              fields.push({
                location: `${baseLocation}.${weekKey}.weight`,
                dayKey,
                exerciseIndex: exIndex,
                weekKey,
                fieldName: 'weight',
                currentValue: weekParams.weight,
                type: 'weight'
              });
            }

            if (weekParams.work_time_minutes !== undefined) {
              fields.push({
                location: `${baseLocation}.${weekKey}.work_time_minutes`,
                dayKey,
                exerciseIndex: exIndex,
                weekKey,
                fieldName: 'work_time_minutes',
                currentValue: weekParams.work_time_minutes,
                type: 'number'
              });
            }

            if (weekParams.rest_time_minutes !== undefined) {
              fields.push({
                location: `${baseLocation}.${weekKey}.rest_time_minutes`,
                dayKey,
                exerciseIndex: exIndex,
                weekKey,
                fieldName: 'rest_time_minutes',
                currentValue: weekParams.rest_time_minutes,
                type: 'number'
              });
            }
          }
        }

        // Sub-exercises (for compound exercises)
        if (exercise.sub_exercises && exercise.sub_exercises.length > 0) {
          exercise.sub_exercises.forEach((subEx, subIndex) => {
            const subLocation = `${baseLocation}.sub_exercises[${subIndex}]`;

            // Sub-exercise name
            fields.push({
              location: `${subLocation}.name`,
              dayKey,
              exerciseIndex: exIndex,
              subExerciseIndex: subIndex,
              fieldName: 'name',
              currentValue: subEx.name,
              type: 'string'
            });

            // Sub-exercise week parameters
            for (let w = 1; w <= this.workout.weeks; w++) {
              const weekKey = `week${w}`;
              const weekParams = (subEx as any)[weekKey] as WeekParameters | undefined;

              if (weekParams) {
                if (weekParams.reps !== undefined) {
                  fields.push({
                    location: `${subLocation}.${weekKey}.reps`,
                    dayKey,
                    exerciseIndex: exIndex,
                    subExerciseIndex: subIndex,
                    weekKey,
                    fieldName: 'reps',
                    currentValue: weekParams.reps,
                    type: 'number'
                  });
                }

                if (weekParams.weight !== undefined) {
                  fields.push({
                    location: `${subLocation}.${weekKey}.weight`,
                    dayKey,
                    exerciseIndex: exIndex,
                    subExerciseIndex: subIndex,
                    weekKey,
                    fieldName: 'weight',
                    currentValue: weekParams.weight,
                    type: 'weight'
                  });
                }
              }
            }
          });
        }

        // Add insertion point after each exercise (for "add exercise" functionality)
        fields.push({
          location: `${baseLocation}._insert_after`,
          dayKey,
          exerciseIndex: exIndex,
          fieldName: '_insert_after',
          currentValue: '<add exercise>',
          type: 'insertion_point'
        });
      });
    }

    return fields;
  }

  /**
   * Edit a field value
   */
  editField(field: EditableField, newValue: any): boolean {
    const previousValue = field.currentValue;
    const exercise = this.getExercise(field.dayKey, field.exerciseIndex);

    if (!exercise) return false;

    const target = field.subExerciseIndex !== undefined
      ? exercise.sub_exercises![field.subExerciseIndex]
      : exercise;

    try {
      if (field.weekKey) {
        // Week-specific parameter
        const weekParams = (target as any)[field.weekKey];
        if (!weekParams) {
          (target as any)[field.weekKey] = {};
        }
        (target as any)[field.weekKey][field.fieldName] = newValue;
      } else {
        // Top-level field (e.g., name)
        (target as any)[field.fieldName] = newValue;

        // If editing a sub-exercise name, update parent compound exercise title
        if (field.subExerciseIndex !== undefined && field.fieldName === 'name' && exercise.sub_exercises) {
          const oldParentName = exercise.name;
          const newParentName = this.generateCompoundExerciseName(exercise);
          if (newParentName && newParentName !== oldParentName) {
            exercise.name = newParentName;
            // Note: we don't add this to undo stack separately - it will be reverted when the sub-exercise name is reverted
          }
        }
      }

      // Add to undo stack
      this.addUndo({
        timestamp: Date.now(),
        action: `Edit ${field.fieldName}`,
        location: field.location,
        previousValue,
        newValue,
        reverseOperation: () => {
          if (field.weekKey) {
            (target as any)[field.weekKey][field.fieldName] = previousValue;
          } else {
            (target as any)[field.fieldName] = previousValue;

            // If reverting a sub-exercise name edit, also revert parent title
            if (field.subExerciseIndex !== undefined && field.fieldName === 'name' && exercise.sub_exercises) {
              const revertedParentName = this.generateCompoundExerciseName(exercise);
              if (revertedParentName) {
                exercise.name = revertedParentName;
              }
            }
          }
        }
      });

      this.modified = true;
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Replace an exercise with a new one from database
   * Handles category changes and smart default population
   */
  replaceExercise(
    dayKey: string,
    exerciseIndex: number,
    newExerciseName: string,
    experienceLevel: string = 'intermediate'
  ): { success: boolean; message: string; addedFields?: string[] } {
    const day = this.workout.days[dayKey];
    if (!day || !day.exercises[exerciseIndex]) {
      return { success: false, message: 'Exercise not found' };
    }

    const oldExercise = day.exercises[exerciseIndex];
    const oldExerciseCopy = JSON.parse(JSON.stringify(oldExercise));

    // Find new exercise in database
    const newExerciseData = this.findExerciseInDatabase(newExerciseName);
    if (!newExerciseData) {
      return { success: false, message: `Exercise "${newExerciseName}" not found in database` };
    }

    const newCategory = newExerciseData.category;
    const oldCategory = oldExercise.category;

    // Check if this is a compound -> standalone or vice versa conversion
    const wasCompound = oldExercise.sub_exercises && oldExercise.sub_exercises.length > 0;
    const isCompound = ['emom', 'circuit', 'amrap', 'interval'].includes(newCategory);

    // Create new exercise structure (build as any to allow dynamic week properties)
    const newExercise: any = {
      name: newExerciseName,
      category: newCategory
    };

    // Populate week parameters with smart defaults
    const addedFields: string[] = [];
    const hasWeight = newExerciseData.external_load !== 'never';

    for (let w = 1; w <= this.workout.weeks; w++) {
      const weekKey = `week${w}`;
      const oldWeekParams = (oldExercise as any)[weekKey];
      const newWeekParams: any = {};

      // Get smart defaults from workout_generation_rules.json
      const defaults = this.getSmartDefaults(newCategory, experienceLevel);

      // Start with defaults, then selectively override with old params where compatible
      if (oldWeekParams) {
        // Apply all defaults first
        Object.assign(newWeekParams, defaults);

        // Override with old params where they exist and are compatible with new category
        if (oldWeekParams.sets !== undefined) newWeekParams.sets = oldWeekParams.sets;

        // Only copy reps if new exercise uses reps (has reps in defaults)
        if (oldWeekParams.reps !== undefined && defaults.reps !== undefined) {
          newWeekParams.reps = oldWeekParams.reps;
        }

        // For time fields, only copy if the new exercise uses that field
        if (oldWeekParams.rest_time_minutes !== undefined) {
          newWeekParams.rest_time_minutes = oldWeekParams.rest_time_minutes;
          // Copy unit if it exists, otherwise keep default unit
          if ((oldWeekParams as any).rest_time_unit) {
            (newWeekParams as any).rest_time_unit = (oldWeekParams as any).rest_time_unit;
          }
        }

        // Only copy work_time if new exercise uses work_time (has work_time in defaults)
        if (oldWeekParams.work_time_minutes !== undefined && defaults.work_time_minutes !== undefined) {
          newWeekParams.work_time_minutes = oldWeekParams.work_time_minutes;
          // Copy unit if it exists, otherwise keep default unit
          if ((oldWeekParams as any).work_time_unit) {
            (newWeekParams as any).work_time_unit = (oldWeekParams as any).work_time_unit;
          }
        }

        // Handle weight field
        if (oldWeekParams.weight) {
          newWeekParams.weight = oldWeekParams.weight;
        } else if (hasWeight && !newWeekParams.weight) {
          addedFields.push('weight');
        }
      } else {
        // No old params, use all defaults
        Object.assign(newWeekParams, defaults);
        if (hasWeight) addedFields.push('weight');
      }

      newExercise[weekKey] = newWeekParams;
    }

    // Handle compound exercise conversion
    if (!isCompound && wasCompound) {
      // Compound -> standalone: sub-exercises will be lost
      // This should have been confirmed by user before calling this function
    }

    // Replace exercise
    day.exercises[exerciseIndex] = newExercise;

    // Add to undo stack
    this.addUndo({
      timestamp: Date.now(),
      action: `Replace exercise "${oldExerciseCopy.name}" with "${newExerciseName}"`,
      location: `${dayKey}.exercises[${exerciseIndex}]`,
      previousValue: oldExerciseCopy,
      newValue: newExercise,
      reverseOperation: () => {
        day.exercises[exerciseIndex] = oldExerciseCopy;
      }
    });

    this.modified = true;

    const message = addedFields.length > 0
      ? `Exercise replaced. Added fields: ${addedFields.join(', ')}`
      : 'Exercise replaced successfully';

    return { success: true, message, addedFields };
  }

  /**
   * Replace a sub-exercise within a compound exercise
   */
  replaceSubExercise(
    dayKey: string,
    exerciseIndex: number,
    subExerciseIndex: number,
    newExerciseName: string
  ): { success: boolean; message: string } {
    const exercise = this.getExercise(dayKey, exerciseIndex);
    if (!exercise || !exercise.sub_exercises || !exercise.sub_exercises[subExerciseIndex]) {
      return { success: false, message: 'Sub-exercise not found' };
    }

    const oldSubEx = exercise.sub_exercises[subExerciseIndex];
    const oldSubExCopy = JSON.parse(JSON.stringify(oldSubEx));

    // Simply replace the name - keep all week parameters the same
    oldSubEx.name = newExerciseName;

    // Update parent exercise title to reflect new sub-exercise name
    const newParentName = this.generateCompoundExerciseName(exercise);
    const oldParentName = exercise.name;
    if (newParentName) {
      exercise.name = newParentName;
    }

    // Add to undo stack
    this.addUndo({
      timestamp: Date.now(),
      action: `Replace sub-exercise "${oldSubExCopy.name}" with "${newExerciseName}"`,
      location: `${dayKey}.exercises[${exerciseIndex}].sub_exercises[${subExerciseIndex}]`,
      previousValue: oldSubExCopy,
      newValue: { ...oldSubEx },
      reverseOperation: () => {
        exercise.sub_exercises![subExerciseIndex] = oldSubExCopy;
        // Restore parent title
        exercise.name = oldParentName;
      }
    });

    this.modified = true;

    return { success: true, message: `Replaced ${oldSubExCopy.name} with ${newExerciseName}` };
  }

  /**
   * Delete an exercise from a day
   */
  deleteExercise(
    dayKey: string,
    exerciseIndex: number
  ): { success: boolean; message: string } {
    const day = this.workout.days[dayKey];
    if (!day || !day.exercises[exerciseIndex]) {
      return { success: false, message: 'Exercise not found' };
    }

    if (day.exercises.length === 1) {
      return { success: false, message: 'Cannot delete the only exercise in a day' };
    }

    const deletedExercise = { ...day.exercises[exerciseIndex] };
    const deletedIndex = exerciseIndex;

    // Remove from exercises array
    day.exercises.splice(exerciseIndex, 1);

    // Add to undo stack
    this.addUndo({
      timestamp: Date.now(),
      action: `Delete exercise: ${deletedExercise.name}`,
      location: `${dayKey}.exercises[${deletedIndex}]`,
      previousValue: deletedExercise,
      newValue: null,
      reverseOperation: () => {
        day.exercises.splice(deletedIndex, 0, deletedExercise);
      }
    });

    this.modified = true;

    return { success: true, message: `Deleted ${deletedExercise.name}` };
  }

  /**
   * Insert a new exercise after a given exercise index
   * Used for "add exercise" functionality
   */
  insertExercise(
    dayKey: string,
    insertAfterIndex: number,
    newExerciseName: string,
    experienceLevel: string = 'intermediate'
  ): { success: boolean; message: string; newExerciseIndex?: number } {
    const day = this.workout.days[dayKey];
    if (!day) {
      return { success: false, message: 'Day not found' };
    }

    // Find new exercise in database
    const newExerciseData = this.findExerciseInDatabase(newExerciseName);
    if (!newExerciseData) {
      return { success: false, message: `Exercise "${newExerciseName}" not found in database` };
    }

    const newCategory = newExerciseData.category;

    // Create new exercise structure
    const newExercise: any = {
      name: newExerciseName,
      category: newCategory
    };

    // Populate week parameters with smart defaults
    const hasWeight = newExerciseData.external_load !== 'never';

    for (let w = 1; w <= this.workout.weeks; w++) {
      const weekKey = `week${w}`;
      const newWeekParams: any = {};

      // Get smart defaults from workout_generation_rules.json
      const defaults = this.getSmartDefaults(newCategory, experienceLevel);

      // Apply defaults
      Object.assign(newWeekParams, defaults);

      newExercise[weekKey] = newWeekParams;
    }

    // For compound exercises, add empty sub_exercises array
    const isCompound = ['emom', 'circuit', 'amrap', 'interval'].includes(newCategory);
    if (isCompound) {
      newExercise.sub_exercises = [];
    }

    // Insert into exercises array at insertAfterIndex + 1
    const insertIndex = insertAfterIndex + 1;
    const oldExercises = [...day.exercises];
    day.exercises.splice(insertIndex, 0, newExercise as ParameterizedExercise);

    // Add to undo stack
    this.addUndo({
      timestamp: Date.now(),
      action: `Insert exercise: ${newExerciseName}`,
      location: `${dayKey}.exercises[${insertIndex}]`,
      previousValue: null,
      newValue: newExercise,
      reverseOperation: () => {
        day.exercises = oldExercises;
      }
    });

    this.modified = true;

    return {
      success: true,
      message: `Inserted ${newExerciseName} at position ${insertIndex + 1}`,
      newExerciseIndex: insertIndex
    };
  }

  /**
   * Insert a new sub-exercise into a compound exercise (EMOM, Circuit, etc.)
   */
  insertSubExercise(
    dayKey: string,
    exerciseIndex: number,
    newExerciseName: string,
    experienceLevel: string = 'intermediate'
  ): { success: boolean; message: string; newSubExerciseIndex?: number } {
    const exercise = this.getExercise(dayKey, exerciseIndex);
    if (!exercise) {
      return { success: false, message: 'Exercise not found' };
    }

    // Verify this is a compound exercise
    if (!exercise.sub_exercises) {
      return { success: false, message: 'Cannot add sub-exercise to non-compound exercise' };
    }

    // Find new exercise in database
    const newExerciseData = this.findExerciseInDatabase(newExerciseName);
    if (!newExerciseData) {
      return { success: false, message: `Exercise "${newExerciseName}" not found in database` };
    }

    // Create new sub-exercise structure
    const newSubExercise: any = {
      name: newExerciseName
    };

    // Populate week parameters - sub-exercises typically have reps and weight
    for (let w = 1; w <= this.workout.weeks; w++) {
      const weekKey = `week${w}`;
      const newWeekParams: any = {};

      // Get defaults for the sub-exercise category
      const defaults = this.getSmartDefaults(newExerciseData.category, experienceLevel);

      // Sub-exercises in compound exercises typically use reps and weight (not work_time)
      if (defaults.reps !== undefined) {
        newWeekParams.reps = defaults.reps;
      } else {
        newWeekParams.reps = 8; // Sensible default
      }

      if (newExerciseData.external_load !== 'never') {
        newWeekParams.weight = defaults.weight || { type: 'percent_tm', value: 70 };
      }

      newSubExercise[weekKey] = newWeekParams;
    }

    // Add to sub_exercises array
    const oldSubExercises = [...exercise.sub_exercises];
    exercise.sub_exercises.push(newSubExercise as any);
    const newSubIndex = exercise.sub_exercises.length - 1;

    // Update parent exercise title
    const oldParentName = exercise.name;
    const newParentName = this.generateCompoundExerciseName(exercise);
    if (newParentName) {
      exercise.name = newParentName;
    }

    // Add to undo stack
    this.addUndo({
      timestamp: Date.now(),
      action: `Insert sub-exercise: ${newExerciseName}`,
      location: `${dayKey}.exercises[${exerciseIndex}].sub_exercises[${newSubIndex}]`,
      previousValue: null,
      newValue: newSubExercise,
      reverseOperation: () => {
        exercise.sub_exercises = oldSubExercises;
        exercise.name = oldParentName;
      }
    });

    this.modified = true;

    return {
      success: true,
      message: `Inserted ${newExerciseName} as sub-exercise`,
      newSubExerciseIndex: newSubIndex
    };
  }

  /**
   * Toggle between rep-based and work_time-based definitions for an exercise
   * Swaps reps <-> work_time_minutes for all weeks
   */
  toggleWorkDefinition(
    dayKey: string,
    exerciseIndex: number
  ): { success: boolean; message: string; newMode: 'reps' | 'work_time' | null } {
    const exercise = this.getExercise(dayKey, exerciseIndex);
    if (!exercise) {
      return { success: false, message: 'Exercise not found', newMode: null };
    }

    // Determine current mode by checking week1
    const week1 = (exercise as any).week1;
    if (!week1) {
      return { success: false, message: 'No week parameters found', newMode: null };
    }

    const hasReps = week1.reps !== undefined;
    const hasWorkTime = week1.work_time_minutes !== undefined;

    if (hasReps === hasWorkTime) {
      return {
        success: false,
        message: 'Exercise has both reps and work_time, or neither. Cannot toggle.',
        newMode: null
      };
    }

    const oldExercise = JSON.parse(JSON.stringify(exercise));
    const targetMode: 'reps' | 'work_time' = hasReps ? 'work_time' : 'reps';

    // Toggle for all weeks
    const weekCount = Object.keys(exercise).filter(k => k.startsWith('week')).length;
    for (let w = 1; w <= weekCount; w++) {
      const weekKey = `week${w}`;
      const weekParams = (exercise as any)[weekKey];
      if (!weekParams) continue;

      if (hasReps) {
        // Convert reps -> work_time
        const reps = weekParams.reps;
        delete weekParams.reps;
        weekParams.work_time_minutes = reps; // Simple 1:1 mapping (user can adjust)
        if (!weekParams.work_time_unit) {
          weekParams.work_time_unit = 'seconds'; // Default to seconds for work time
        }
      } else {
        // Convert work_time -> reps
        const workTime = weekParams.work_time_minutes;
        delete weekParams.work_time_minutes;
        delete weekParams.work_time_unit;
        weekParams.reps = workTime; // Simple 1:1 mapping (user can adjust)
      }
    }

    // Add to undo stack
    this.addUndo({
      timestamp: Date.now(),
      action: `Toggle work definition to ${targetMode}`,
      location: `${dayKey}.exercises[${exerciseIndex}]`,
      previousValue: oldExercise,
      newValue: JSON.parse(JSON.stringify(exercise)),
      reverseOperation: () => {
        const day = this.workout.days[dayKey];
        if (day) {
          day.exercises[exerciseIndex] = oldExercise;
        }
      }
    });

    this.modified = true;

    return {
      success: true,
      message: `Toggled to ${targetMode}-based definition`,
      newMode: targetMode
    };
  }

  /**
   * Undo last change
   */
  undo(): UndoEntry | null {
    if (this.undoStack.length === 0) return null;

    const entry = this.undoStack.pop()!;
    entry.reverseOperation();
    this.modified = true;

    return entry;
  }

  /**
   * Get undo stack size
   */
  getUndoStackSize(): number {
    return this.undoStack.length;
  }

  /**
   * Private helper: add to undo stack
   */
  private addUndo(entry: UndoEntry): void {
    this.undoStack.push(entry);
    // Limit undo stack to 100 entries to prevent memory issues
    if (this.undoStack.length > 100) {
      this.undoStack.shift();
    }
  }

  /**
   * Private helper: get exercise by day and index
   */
  private getExercise(dayKey: string, exerciseIndex: number): ParameterizedExercise | null {
    const day = this.workout.days[dayKey];
    if (!day || !day.exercises[exerciseIndex]) return null;
    return day.exercises[exerciseIndex];
  }

  /**
   * Generate compound exercise name from sub-exercises
   * Format: "CATEGORY: Exercise1 + Exercise2 + Exercise3"
   */
  private generateCompoundExerciseName(exercise: ParameterizedExercise): string | null {
    if (!exercise.sub_exercises || exercise.sub_exercises.length === 0) return null;

    const category = exercise.category ? exercise.category.toUpperCase() : 'COMPOUND';
    const subNames = exercise.sub_exercises.map(sub => sub.name).join(' + ');

    return `${category}: ${subNames}`;
  }

  /**
   * Private helper: find exercise in database
   */
  private findExerciseInDatabase(exerciseName: string): any {
    const categories = exerciseDatabase.exercise_database.categories as Record<string, { exercises: Record<string, any> }>;

    for (const categoryKey in categories) {
      const exercisesInCategory = categories[categoryKey].exercises;
      if (exercisesInCategory[exerciseName]) {
        return {
          ...exercisesInCategory[exerciseName],
          category: categoryKey
        };
      }
    }

    return null;
  }

  /**
   * Private helper: get smart defaults from workout_generation_rules.json
   */
  private getSmartDefaults(category: string, experienceLevel: string): any {
    const defaults: any = {};

    // Get base intensity profile
    const intensityProfiles = (workoutGenerationRules.intensity_profiles as any)[category];
    if (intensityProfiles) {
      const profile = intensityProfiles.moderate || intensityProfiles.light || Object.values(intensityProfiles)[0];

      if (profile.base_sets) defaults.sets = profile.base_sets;
      if (profile.base_reps) defaults.reps = profile.base_reps;

      // CRITICAL: Copy both value AND unit for time fields
      if (profile.base_rest_time_minutes !== undefined) {
        defaults.rest_time_minutes = profile.base_rest_time_minutes;
      }
      if (profile.base_rest_time_unit) {
        defaults.rest_time_unit = profile.base_rest_time_unit;
      }

      if (profile.base_work_time_minutes !== undefined) {
        defaults.work_time_minutes = profile.base_work_time_minutes;
      }
      if (profile.base_work_time_unit) {
        defaults.work_time_unit = profile.base_work_time_unit;
      }

      // Weight defaults
      if (profile.base_weight_percent_tm) {
        defaults.weight = {
          type: 'percent_tm',
          value: profile.base_weight_percent_tm
        } as WeightSpecification;
      } else if (profile.base_weight_descriptor) {
        defaults.weight = profile.base_weight_descriptor;
      }
    }

    // Apply experience modifiers
    const expModifiers = (workoutGenerationRules.experience_modifiers as any)[experienceLevel];
    if (expModifiers) {
      if (defaults.sets && expModifiers.volume_multiplier) {
        defaults.sets = Math.round(defaults.sets * expModifiers.volume_multiplier);
      }
      if (defaults.rest_time_minutes && expModifiers.rest_time_multiplier) {
        defaults.rest_time_minutes = defaults.rest_time_minutes * expModifiers.rest_time_multiplier;
      }
    }

    return defaults;
  }
}
