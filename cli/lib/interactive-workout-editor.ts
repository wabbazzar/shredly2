/**
 * Interactive Workout Editor - Main CLI Interface
 *
 * Vim-like modal interface for editing workout programs
 * Modes: View, Edit, Command
 * Features: Navigation, field editing, exercise replacement, undo, save
 */

import * as readline from 'readline';
import * as fs from 'fs';
import chalk from 'chalk';
import type { ParameterizedWorkout } from '../../src/lib/engine/types.js';
import { WorkoutEditor, type EditableField } from '../../src/lib/engine/workout-editor.js';
import { validateWorkout, formatValidationResult } from '../../src/lib/engine/workout-validator.js';
import {
  formatWorkoutInteractive,
  formatSingleDayView,
  type HighlightOptions
} from './workout-formatter.js';
import { browseExerciseDatabase } from './exercise-db-browser.js';
import hotkeysConfig from '../cli_hotkeys.json' with { type: 'json' };
import exerciseDatabase from '../../src/data/exercise_database.json' with { type: 'json' };
import exerciseDescriptions from '../../src/data/exercise_descriptions.json' with { type: 'json' };

type EditorMode = 'view' | 'edit' | 'command' | 'help';
type ViewMode = 'week' | 'day'; // week = all days, day = one day at a time

interface EditorState {
  mode: EditorMode;
  viewMode: ViewMode;
  currentDayIndex: number; // for day view navigation
  selectedFieldIndex: number; // index in editableFields array
  editBuffer: string; // current value being edited
  commandBuffer: string; // for command mode input
  statusMessage: string;
  statusType: 'info' | 'success' | 'error';
  savedThisSession: boolean; // track if save was successful this session
  numberInputBuffer: string; // buffer for multi-digit exercise numbers
  numberInputTimeout: NodeJS.Timeout | null; // timeout for multi-digit input
  lastEnterPressTime: number; // timestamp of last enter press (for double-enter detection)
  lastEditedField: EditableField | null; // last field that was edited (for broadcast detection)
  lastEditedValue: any; // value that was last saved (for broadcast)
  swapModeState: {
    active: boolean;
    firstExerciseIndex?: number;
    firstDayKey?: string;
    lastATapTime: number;
  };
}

export interface EditorOptions {
  filePath?: string; // original file path for saving
  experienceLevel?: string; // for smart defaults when replacing exercises
}

export class InteractiveWorkoutEditor {
  private editor: WorkoutEditor;
  private state: EditorState;
  private editableFields: EditableField[];
  private dayKeys: string[];
  private options: EditorOptions;
  private running: boolean = false;
  private keypressHandler: ((str: string, key: any) => Promise<void>) | null = null;

  constructor(workout: ParameterizedWorkout, options: EditorOptions = {}) {
    this.editor = new WorkoutEditor(workout);
    this.options = options;

    const workout_ = this.editor.getWorkout();
    this.dayKeys = Object.keys(workout_.days).sort();

    this.editableFields = this.editor.getAllEditableFields();

    this.state = {
      mode: 'view',
      viewMode: 'week',
      currentDayIndex: 0,
      selectedFieldIndex: 0,
      editBuffer: '',
      commandBuffer: '',
      statusMessage: `Loaded workout: ${workout_.name}`,
      statusType: 'info',
      savedThisSession: false,
      numberInputBuffer: '',
      numberInputTimeout: null,
      lastEnterPressTime: 0,
      lastEditedField: null,
      lastEditedValue: null,
      swapModeState: {
        active: false,
        lastATapTime: 0
      }
    };
  }

  /**
   * Start the interactive editor session
   */
  async start(): Promise<{ saved: boolean; workout: ParameterizedWorkout }> {
    this.running = true;

    // CRITICAL: The order matters!
    // 1. First set raw mode
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    // 2. Remove all existing listeners BEFORE emitKeypressEvents
    process.stdin.removeAllListeners('data');
    process.stdin.removeAllListeners('keypress');

    // 3. NOW call emitKeypressEvents
    readline.emitKeypressEvents(process.stdin);

    // 4. Finally resume stdin
    process.stdin.resume();

    this.render();

    return new Promise((resolve) => {
      this.keypressHandler = async (str: string, key: any) => {
        if (!key || !this.running) return;

        await this.handleKeypress(str, key);

        if (!this.running) {
          this.cleanup();
          resolve({
            saved: this.state.savedThisSession,
            workout: this.editor.getWorkout()
          });
        }
      };

      process.stdin.on('keypress', this.keypressHandler);
    });
  }

  /**
   * Handle keyboard input based on current mode
   */
  private async handleKeypress(str: string, key: any): Promise<void> {
    // Global: Ctrl+C
    if (key.ctrl && key.name === 'c') {
      this.running = false;
      return;
    }

    if (this.state.mode === 'view') {
      await this.handleViewModeKey(str, key);
    } else if (this.state.mode === 'edit') {
      this.handleEditModeKey(str, key);
    } else if (this.state.mode === 'command') {
      await this.handleCommandModeKey(str, key);
    } else if (this.state.mode === 'help') {
      this.handleHelpModeKey(str, key);
    }

    this.render();
  }

  /**
   * View mode keyboard handler
   */
  private async handleViewModeKey(str: string, key: any): Promise<void> {
    // DEBUG: Log ALL keypresses
    if (process.env.DEBUG_KEYS) {
      console.log(`[KEY DEBUG] str="${str}", key.name="${key.name}", ctrl=${key.ctrl}, meta=${key.meta}`);
    }

    const hotkeys = hotkeysConfig.view_mode;

    // Clear number input buffer on Escape
    if (key.name === 'escape' && this.state.numberInputBuffer) {
      if (this.state.numberInputTimeout) {
        clearTimeout(this.state.numberInputTimeout);
      }
      this.state.numberInputBuffer = '';
      this.state.numberInputTimeout = null;
      this.setStatus('Jump cancelled', 'info');
      return;
    }

    // Navigation
    if (str === hotkeys.navigation.next_editable_field) {
      this.navigateToNextField();
    } else if (str === hotkeys.navigation.previous_editable_field) {
      this.navigateToPreviousField();
    } else if (key.name === hotkeys.navigation.previous_day) {
      if (this.state.viewMode === 'day') {
        this.state.currentDayIndex = Math.max(0, this.state.currentDayIndex - 1);
      }
    } else if (key.name === hotkeys.navigation.next_day) {
      if (this.state.viewMode === 'day') {
        this.state.currentDayIndex = Math.min(this.dayKeys.length - 1, this.state.currentDayIndex + 1);
      }
    }

    // View mode toggle
    else if (str === 'd' || str === 'D') {
      this.state.viewMode = 'day';
      this.setStatus('Switched to Day view', 'info');
    } else if (str === 'w' || str === 'W') {
      this.state.viewMode = 'week';
      this.setStatus('Switched to Week view', 'info');
    }

    // Show exercise information
    else if (str === 'i' || str === 'I') {
      this.showExerciseInfo();
    }

    // Jump to exercise number (supports multi-digit: 10, 11, 12, etc.)
    else if (str && /^[0-9]$/.test(str)) {
      // Clear any existing timeout
      if (this.state.numberInputTimeout) {
        clearTimeout(this.state.numberInputTimeout);
      }

      // Append digit to buffer
      this.state.numberInputBuffer += str;
      this.setStatus(`Jumping to exercise: ${this.state.numberInputBuffer}...`, 'info');

      // Set timeout to execute jump after 500ms of no input
      this.state.numberInputTimeout = setTimeout(() => {
        const exerciseNum = parseInt(this.state.numberInputBuffer);

        if (exerciseNum > 0) {
          // In day view, only search within current day
          const dayKey = this.state.viewMode === 'day' ? this.dayKeys[this.state.currentDayIndex] : undefined;
          const targetField = this.findFieldByExerciseNumber(exerciseNum - 1, dayKey);

          if (targetField !== -1) {
            this.state.selectedFieldIndex = targetField;
            this.syncDayViewToSelectedField();
            this.setStatus(`Jumped to exercise ${exerciseNum}`, 'success');
          } else {
            this.setStatus(`Exercise ${exerciseNum} not found`, 'error');
          }
        } else {
          this.setStatus('Invalid exercise number', 'error');
        }

        // Clear buffer
        this.state.numberInputBuffer = '';
        this.state.numberInputTimeout = null;
      }, 500);
    }

    // Compound block creation (new feature)
    else if (str === 'b' || str === 'B') {
      this.createCompoundBlock();
    }

    // Compound block type change (context-sensitive)
    // If on a compound exercise parent, change block type
    // Otherwise:
    //   - 'e' opens exercise database
    //   - 'a' activates swap mode (double-tap)
    else if (str === 'e' || str === 'a' || str === 'c' || str === 'i') {
      const field = this.editableFields[this.state.selectedFieldIndex];

      // Check if current field is a compound exercise parent name
      const isCompoundParent = field &&
        field.fieldName === 'name' &&
        field.subExerciseIndex === undefined &&
        this.isCurrentExerciseCompound();

      // DEBUG: Log when 'a' is pressed
      if (str === 'a' && process.env.DEBUG_SWAP) {
        console.log(`[SWAP DEBUG] 'a' key handler reached`);
        console.log(`[SWAP DEBUG] field=${field?.fieldName}, isCompoundParent=${isCompoundParent}`);
      }

      if (isCompoundParent) {
        // Change compound block type
        const typeMap: Record<string, 'emom' | 'amrap' | 'circuit' | 'interval'> = {
          'e': 'emom',
          'a': 'amrap',
          'c': 'circuit',
          'i': 'interval'
        };
        this.setCompoundBlockType(typeMap[str]);
      } else if (str === 'e') {
        // Fallback: 'e' opens exercise database when not on compound parent
        await this.openExerciseDatabase();
      } else if (str === 'a') {
        // Fallback: 'a' activates swap mode when not on compound parent
        if (process.env.DEBUG_SWAP) {
          console.log(`[SWAP DEBUG] Calling handleSwapMode()`);
        }
        this.handleSwapMode();
      }
    }

    // Actions
    else if (str === hotkeys.actions.replace_current_field) {
      await this.enterEditMode(true); // Vim-like: auto-clear buffer on 'r'
    } else if (str === hotkeys.actions.swap_with_random) {
      this.swapWithRandomExercise();
    } else if (str === hotkeys.actions.toggle_work_definition) {
      this.toggleWorkDefinition();
    } else if (key.name === hotkeys.actions.delete_exercise) {
      this.deleteCurrentExercise();
    } else if (str === hotkeys.actions.undo_last_change) {
      this.undoLastChange();
    } else if (str === hotkeys.actions.show_help || str === hotkeys.actions.show_help_alt) {
      this.state.mode = 'help';
    } else if (str === hotkeys.actions.enter_command_mode) {
      this.state.mode = 'command';
      this.state.commandBuffer = '';
    } else if (key.name === 'return') {
      // DEBUG: Log Enter key press
      if (process.env.DEBUG_JUMP) {
        console.log(`[JUMP DEBUG] Enter pressed, buffer="${this.state.numberInputBuffer}"`);
      }

      // If number input buffer is active, execute jump immediately
      if (this.state.numberInputBuffer) {
        // Clear the timeout since we're executing now
        if (this.state.numberInputTimeout) {
          clearTimeout(this.state.numberInputTimeout);
          this.state.numberInputTimeout = null;
        }

        if (process.env.DEBUG_JUMP) {
          console.log(`[JUMP DEBUG] Executing jump immediately`);
        }

        const exerciseNum = parseInt(this.state.numberInputBuffer);

        if (exerciseNum > 0) {
          // In day view, only search within current day
          const dayKey = this.state.viewMode === 'day' ? this.dayKeys[this.state.currentDayIndex] : undefined;
          const targetField = this.findFieldByExerciseNumber(exerciseNum - 1, dayKey);

          if (targetField !== -1) {
            this.state.selectedFieldIndex = targetField;
            this.syncDayViewToSelectedField();
            this.setStatus(`Jumped to exercise ${exerciseNum}`, 'success');
          } else {
            this.setStatus(`Exercise ${exerciseNum} not found`, 'error');
          }
        } else {
          this.setStatus('Invalid exercise number', 'error');
        }

        // Clear buffer
        this.state.numberInputBuffer = '';
      } else {
        // Check for double-enter broadcast (Enter in view mode after recent edit)
        const now = Date.now();
        const timeSinceLastEdit = now - this.state.lastEnterPressTime;
        const currentField = this.editableFields[this.state.selectedFieldIndex];

        // If we're on the same field that was just edited, and it's within 500ms, broadcast
        if (this.state.lastEditedField &&
            currentField &&
            this.state.lastEditedField.location === currentField.location &&
            timeSinceLastEdit < 500 &&
            timeSinceLastEdit > 0) {
          // Broadcast the saved value to all weeks
          this.broadcastLastEdit();
        }
      }
    } else if (str === hotkeys.actions.quit) {
      await this.quit();
    }
  }

  /**
   * Edit mode keyboard handler
   */
  private handleEditModeKey(str: string, key: any): void {
    const hotkeys = hotkeysConfig.edit_mode;

    if (key.name === 'escape') {
      // Cancel edit
      this.state.mode = 'view';
      this.state.editBuffer = '';
      this.setStatus('Edit cancelled', 'info');
    } else if (key.name === 'return') {
      // Detect double-enter for broadcast-to-all-weeks
      const now = Date.now();
      const timeSinceLastEnter = now - this.state.lastEnterPressTime;

      if (timeSinceLastEnter < 500 && timeSinceLastEnter > 0) {
        // Double-enter detected - broadcast to all weeks
        this.confirmEditAndBroadcast();
      } else {
        // Single enter - normal behavior
        this.confirmEdit();
      }

      this.state.lastEnterPressTime = now;
      this.state.mode = 'view';
    } else if (key.name === 'tab') {
      // Confirm and jump to next field
      this.confirmEdit();
      this.state.selectedFieldIndex = Math.min(this.editableFields.length - 1, this.state.selectedFieldIndex + 1);
      this.state.mode = 'view';
    } else if (key.name === 'backspace') {
      this.state.editBuffer = this.state.editBuffer.slice(0, -1);
    } else if (str && str.length === 1 && !key.ctrl) {
      this.state.editBuffer += str;
    }
  }

  /**
   * Command mode keyboard handler
   */
  private async handleCommandModeKey(str: string, key: any): Promise<void> {
    if (key.name === 'escape') {
      this.state.mode = 'view';
      this.state.commandBuffer = '';
    } else if (key.name === 'return') {
      await this.executeCommand(this.state.commandBuffer);
      this.state.mode = 'view';
      this.state.commandBuffer = '';
    } else if (key.name === 'backspace') {
      this.state.commandBuffer = this.state.commandBuffer.slice(0, -1);
    } else if (str && str.length === 1 && !key.ctrl) {
      this.state.commandBuffer += str;
    }
  }

  /**
   * Help mode keyboard handler
   */
  private handleHelpModeKey(str: string, key: any): void {
    if (key.name === 'escape' || str === 'q') {
      this.state.mode = 'view';
    }
  }

  /**
   * Enter edit mode for current field
   * @param autoClear - If true, start with empty buffer (vim-like replace)
   */
  private async enterEditMode(autoClear: boolean = false): Promise<void> {
    const field = this.editableFields[this.state.selectedFieldIndex];
    if (!field) return;

    // Special handling for insertion points
    if (field.type === 'insertion_point') {
      this.state.mode = 'edit';
      this.state.editBuffer = '';
      this.setStatus('Enter exercise name - must match database exactly (or press Esc)', 'info');
      return;
    }

    this.state.mode = 'edit';
    // Auto-clear for vim-like replace behavior
    this.state.editBuffer = autoClear ? '' : String(field.currentValue || '');
    this.setStatus(`Editing ${field.fieldName} - Press Enter to confirm, Esc to cancel`, 'info');
  }

  /**
   * Confirm edit and apply changes
   */
  private confirmEdit(): void {
    const field = this.editableFields[this.state.selectedFieldIndex];
    if (!field) return;

    const newValue = this.state.editBuffer.trim();

    // Special handling for insertion points
    if (field.type === 'insertion_point') {
      if (!newValue) {
        this.setStatus('Exercise name cannot be empty', 'error');
        return;
      }

      // Validate that exercise exists in database
      const exerciseData = this.findExerciseInDatabase(newValue);
      if (!exerciseData) {
        this.setStatus(`Exercise "${newValue}" not found in database`, 'error');
        return;
      }

      // Check if we're inserting into a compound exercise (even if empty)
      const workout = this.editor.getWorkout();
      const day = workout.days[field.dayKey];
      const referenceExercise = day?.exercises[field.exerciseIndex];
      const isCompoundExercise = referenceExercise?.sub_exercises !== undefined;

      let result: any;

      if (isCompoundExercise) {
        // Insert as sub-exercise
        result = this.editor.insertSubExercise(
          field.dayKey,
          field.exerciseIndex,
          newValue,
          this.options.experienceLevel || 'intermediate'
        );
      } else {
        // Insert as standalone exercise
        result = this.editor.insertExercise(
          field.dayKey,
          field.exerciseIndex,
          newValue,
          this.options.experienceLevel || 'intermediate'
        );
      }

      if (result.success) {
        this.setStatus(result.message, 'success');
        this.editableFields = this.editor.getAllEditableFields();

        // Jump to the newly inserted exercise/sub-exercise
        if (isCompoundExercise && result.newSubExerciseIndex !== undefined) {
          const newSubExLocation = `${field.dayKey}.exercises[${field.exerciseIndex}].sub_exercises[${result.newSubExerciseIndex}].name`;
          const newFieldIndex = this.editableFields.findIndex(f => f.location === newSubExLocation);
          if (newFieldIndex !== -1) {
            this.state.selectedFieldIndex = newFieldIndex;
          }
        } else if (result.newExerciseIndex !== undefined) {
          const newExerciseLocation = `${field.dayKey}.exercises[${result.newExerciseIndex}].name`;
          const newFieldIndex = this.editableFields.findIndex(f => f.location === newExerciseLocation);
          if (newFieldIndex !== -1) {
            this.state.selectedFieldIndex = newFieldIndex;
          }
        }
      } else {
        this.setStatus(result.message, 'error');
      }

      this.state.editBuffer = '';
      return;
    }

    // Type conversion for normal fields
    let typedValue: any = newValue;
    if (field.type === 'number') {
      typedValue = parseFloat(newValue);
      if (isNaN(typedValue)) {
        this.setStatus('Invalid number', 'error');
        return;
      }
    }

    const success = this.editor.editField(field, typedValue);
    if (success) {
      this.setStatus(`Updated ${field.fieldName}`, 'success');
      // Refresh editable fields
      this.editableFields = this.editor.getAllEditableFields();

      // Save field and value for potential broadcast (double-enter in view mode)
      this.state.lastEditedField = field;
      this.state.lastEditedValue = typedValue;
    } else {
      this.setStatus('Edit failed', 'error');
    }

    this.state.editBuffer = '';
  }

  /**
   * Confirm edit and broadcast value to all weeks
   * Only works for week-specific fields (sets, reps, weight, rest_time, work_time, tempo, rpe, rir)
   */
  private confirmEditAndBroadcast(): void {
    const field = this.editableFields[this.state.selectedFieldIndex];
    if (!field) return;

    // Special handling for insertion points - not supported for broadcast
    if (field.type === 'insertion_point') {
      this.setStatus('Cannot broadcast insertion points', 'error');
      return;
    }

    // Check if this is a week-specific field
    const weekSpecificFields = ['sets', 'reps', 'weight', 'rest_time', 'work_time', 'tempo', 'rpe', 'rir'];
    if (!weekSpecificFields.includes(field.fieldName)) {
      this.setStatus(`Cannot broadcast ${field.fieldName} - not a week-specific field`, 'error');
      return;
    }

    const newValue = this.state.editBuffer.trim();

    // Type conversion
    let typedValue: any = newValue;
    if (field.type === 'number') {
      typedValue = parseFloat(newValue);
      if (isNaN(typedValue)) {
        this.setStatus('Invalid number', 'error');
        return;
      }
    }

    // Broadcast to all weeks
    const workout = this.editor.getWorkout();
    const numWeeks = workout.weeks;
    let successCount = 0;

    for (let weekIndex = 0; weekIndex < numWeeks; weekIndex++) {
      // Create a field location for this week
      const broadcastField = {
        ...field,
        weekIndex,
        location: field.location.replace(/\[week:\d+\]/, `[week:${weekIndex}]`)
      };

      const success = this.editor.editField(broadcastField, typedValue);
      if (success) {
        successCount++;
      }
    }

    if (successCount > 0) {
      this.setStatus(`Broadcasted ${field.fieldName}=${typedValue} to all ${numWeeks} weeks`, 'success');
      // Refresh editable fields
      this.editableFields = this.editor.getAllEditableFields();
    } else {
      this.setStatus('Broadcast failed', 'error');
    }

    this.state.editBuffer = '';
  }

  /**
   * Broadcast last edited value to all weeks (double-enter from view mode)
   */
  private broadcastLastEdit(): void {
    if (!this.state.lastEditedField || this.state.lastEditedValue === null) {
      this.setStatus('No recent edit to broadcast', 'error');
      return;
    }

    const field = this.state.lastEditedField;
    const typedValue = this.state.lastEditedValue;

    // Check if this is a week-specific field
    const weekSpecificFields = ['sets', 'reps', 'weight', 'rest_time', 'work_time', 'tempo', 'rpe', 'rir'];
    if (!weekSpecificFields.includes(field.fieldName)) {
      this.setStatus(`Cannot broadcast ${field.fieldName} - not a week-specific field`, 'error');
      return;
    }

    // Broadcast to all weeks
    const workout = this.editor.getWorkout();
    const numWeeks = workout.weeks;
    let successCount = 0;

    for (let weekIndex = 0; weekIndex < numWeeks; weekIndex++) {
      // Create a field location for this week
      const broadcastField = {
        ...field,
        weekIndex,
        location: field.location.replace(/\[week:\d+\]/, `[week:${weekIndex}]`)
      };

      const success = this.editor.editField(broadcastField, typedValue);
      if (success) {
        successCount++;
      }
    }

    if (successCount > 0) {
      this.setStatus(`Broadcasted ${field.fieldName}=${typedValue} to all ${numWeeks} weeks`, 'success');
      // Refresh editable fields
      this.editableFields = this.editor.getAllEditableFields();

      // Clear last edited state to prevent accidental re-broadcast
      this.state.lastEditedField = null;
      this.state.lastEditedValue = null;
    } else {
      this.setStatus('Broadcast failed', 'error');
    }
  }

  /**
   * Open exercise database browser
   */
  private async openExerciseDatabase(): Promise<void> {
    const field = this.editableFields[this.state.selectedFieldIndex];
    if (!field || (field.fieldName !== 'name' && field.type !== 'insertion_point')) {
      this.setStatus('Select an exercise name field or <add exercise> first', 'error');
      return;
    }

    // Pause current interface (temporary - don't pause stdin)
    this.cleanupTemporary();

    const result = await browseExerciseDatabase();

    // Resume interface
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    // Re-attach our keypress handler
    if (this.keypressHandler) {
      process.stdin.on('keypress', this.keypressHandler);
    }

    if (result.selected && result.exerciseName) {
      // Special handling for insertion points
      if (field.type === 'insertion_point') {
        // Check if we're inserting into a compound exercise (even if empty)
        const workout = this.editor.getWorkout();
        const day = workout.days[field.dayKey];
        const referenceExercise = day?.exercises[field.exerciseIndex];
        const isCompoundExercise = referenceExercise?.sub_exercises !== undefined;

        let insertResult: any;

        if (isCompoundExercise) {
          // Insert as sub-exercise
          insertResult = this.editor.insertSubExercise(
            field.dayKey,
            field.exerciseIndex,
            result.exerciseName,
            this.options.experienceLevel || 'intermediate'
          );
        } else {
          // Insert as standalone exercise
          insertResult = this.editor.insertExercise(
            field.dayKey,
            field.exerciseIndex,
            result.exerciseName,
            this.options.experienceLevel || 'intermediate'
          );
        }

        if (insertResult.success) {
          this.setStatus(insertResult.message, 'success');
          this.editableFields = this.editor.getAllEditableFields();

          // Jump to the newly inserted exercise/sub-exercise
          if (isCompoundExercise && insertResult.newSubExerciseIndex !== undefined) {
            const newSubExLocation = `${field.dayKey}.exercises[${field.exerciseIndex}].sub_exercises[${insertResult.newSubExerciseIndex}].name`;
            const newFieldIndex = this.editableFields.findIndex(f => f.location === newSubExLocation);
            if (newFieldIndex !== -1) {
              this.state.selectedFieldIndex = newFieldIndex;
            }
          } else if (insertResult.newExerciseIndex !== undefined) {
            const newExerciseLocation = `${field.dayKey}.exercises[${insertResult.newExerciseIndex}].name`;
            const newFieldIndex = this.editableFields.findIndex(f => f.location === newExerciseLocation);
            if (newFieldIndex !== -1) {
              this.state.selectedFieldIndex = newFieldIndex;
            }
          }
        } else {
          this.setStatus(insertResult.message, 'error');
        }
      } else {
        // Replace exercise or sub-exercise
        let replaceResult;

        if (field.subExerciseIndex !== undefined) {
          // Replacing a sub-exercise within a compound exercise
          replaceResult = this.editor.replaceSubExercise(
            field.dayKey,
            field.exerciseIndex,
            field.subExerciseIndex,
            result.exerciseName
          );
        } else {
          // Replacing a standalone exercise
          replaceResult = this.editor.replaceExercise(
            field.dayKey,
            field.exerciseIndex,
            result.exerciseName,
            this.options.experienceLevel || 'intermediate'
          );
        }

        if (replaceResult.success) {
          this.setStatus(replaceResult.message, 'success');
          this.editableFields = this.editor.getAllEditableFields();
        } else {
          this.setStatus(replaceResult.message, 'error');
        }
      }
    }
  }

  /**
   * Swap current exercise with a random matching exercise from database
   * Matches by category and muscle group (for strength exercises)
   * For insertion points, adds a random exercise matching the profile of the exercise above
   */
  private swapWithRandomExercise(): void {
    const field = this.editableFields[this.state.selectedFieldIndex];
    if (!field) return;

    // Special handling for insertion points
    if (field.type === 'insertion_point') {
      this.addRandomExercise();
      return;
    }

    // Get current exercise to determine category and muscle groups
    const workout = this.editor.getWorkout();
    const day = workout.days[field.dayKey];
    if (!day || !day.exercises[field.exerciseIndex]) return;

    const currentExercise = day.exercises[field.exerciseIndex];

    // For sub-exercises, get the sub-exercise name
    let currentExerciseName: string;
    let currentCategory: string;

    if (field.subExerciseIndex !== undefined && currentExercise.sub_exercises) {
      currentExerciseName = currentExercise.sub_exercises[field.subExerciseIndex].name;
      // Find this sub-exercise in DB to get its category
      const subExData = this.findExerciseInDatabase(currentExerciseName);
      if (!subExData) {
        this.setStatus('Current exercise not found in database', 'error');
        return;
      }
      currentCategory = subExData.category;
    } else {
      currentExerciseName = currentExercise.name;
      // CRITICAL: Always look up category from database if not set in workout
      if (currentExercise.category) {
        currentCategory = currentExercise.category;
      } else {
        const exData = this.findExerciseInDatabase(currentExerciseName);
        if (!exData) {
          this.setStatus('Current exercise not found in database', 'error');
          return;
        }
        currentCategory = exData.category;
      }
    }

    // Find current exercise in database to get muscle groups
    const currentExData = this.findExerciseInDatabase(currentExerciseName);
    if (!currentExData) {
      this.setStatus('Current exercise not found in database', 'error');
      return;
    }

    // Filter exercises by category and muscle group
    const matchingExercises = this.filterExercisesByCategory(
      currentCategory,
      currentExData.muscle_groups
    );

    // Remove current exercise from the list
    const filteredExercises = matchingExercises.filter(name => name !== currentExerciseName);

    if (filteredExercises.length === 0) {
      this.setStatus('No matching exercises found', 'info');
      return;
    }

    // Pick random exercise
    const randomExercise = filteredExercises[Math.floor(Math.random() * filteredExercises.length)];

    // Replace exercise
    let replaceResult;

    if (field.subExerciseIndex !== undefined) {
      replaceResult = this.editor.replaceSubExercise(
        field.dayKey,
        field.exerciseIndex,
        field.subExerciseIndex,
        randomExercise
      );
    } else {
      replaceResult = this.editor.replaceExercise(
        field.dayKey,
        field.exerciseIndex,
        randomExercise,
        this.options.experienceLevel || 'intermediate'
      );
    }

    if (replaceResult.success) {
      this.setStatus(`Swapped to: ${randomExercise}`, 'success');
      this.editableFields = this.editor.getAllEditableFields();
    } else {
      this.setStatus(replaceResult.message, 'error');
    }
  }

  /**
   * Add a random exercise at insertion point
   * Matches the categorical profile of the exercise above it
   * For compound exercises, adds as a sub-exercise
   */
  private addRandomExercise(): void {
    const field = this.editableFields[this.state.selectedFieldIndex];
    if (!field || field.type !== 'insertion_point') return;

    // Get the exercise above this insertion point
    const workout = this.editor.getWorkout();
    const day = workout.days[field.dayKey];
    if (!day || !day.exercises[field.exerciseIndex]) return;

    const referenceExercise = day.exercises[field.exerciseIndex];

    // Check if this is a compound exercise
    const isCompoundExercise = referenceExercise.sub_exercises !== undefined;

    let referenceData: any;

    if (isCompoundExercise) {
      // For empty compound blocks, user must add first sub-exercise manually
      if (referenceExercise.sub_exercises!.length === 0) {
        this.setStatus('Add first sub-exercise manually (press "e" to browse exercises)', 'info');
        return;
      }
      // Use the last sub-exercise as reference
      const lastSubEx = referenceExercise.sub_exercises![referenceExercise.sub_exercises!.length - 1];
      referenceData = this.findExerciseInDatabase(lastSubEx.name);
      if (!referenceData) {
        this.setStatus('Reference sub-exercise not found in database', 'error');
        return;
      }
    } else {
      // Use the exercise itself as reference
      referenceData = this.findExerciseInDatabase(referenceExercise.name);
      if (!referenceData) {
        this.setStatus('Reference exercise not found in database', 'error');
        return;
      }
    }

    // Filter exercises by category and muscle group
    const matchingExercises = this.filterExercisesByCategory(
      referenceData.category,
      referenceData.muscle_groups
    );

    if (matchingExercises.length === 0) {
      this.setStatus('No matching exercises found', 'info');
      return;
    }

    // Pick random exercise
    const randomExercise = matchingExercises[Math.floor(Math.random() * matchingExercises.length)];

    // Insert as sub-exercise or standalone based on reference type
    let result: any;

    if (isCompoundExercise) {
      result = this.editor.insertSubExercise(
        field.dayKey,
        field.exerciseIndex,
        randomExercise,
        this.options.experienceLevel || 'intermediate'
      );
    } else {
      result = this.editor.insertExercise(
        field.dayKey,
        field.exerciseIndex,
        randomExercise,
        this.options.experienceLevel || 'intermediate'
      );
    }

    if (result.success) {
      this.setStatus(`Added: ${randomExercise}`, 'success');
      this.editableFields = this.editor.getAllEditableFields();

      // Jump to the newly inserted exercise/sub-exercise
      if (isCompoundExercise && result.newSubExerciseIndex !== undefined) {
        const newSubExLocation = `${field.dayKey}.exercises[${field.exerciseIndex}].sub_exercises[${result.newSubExerciseIndex}].name`;
        const newFieldIndex = this.editableFields.findIndex(f => f.location === newSubExLocation);
        if (newFieldIndex !== -1) {
          this.state.selectedFieldIndex = newFieldIndex;
        }
      } else if (result.newExerciseIndex !== undefined) {
        const newExerciseLocation = `${field.dayKey}.exercises[${result.newExerciseIndex}].name`;
        const newFieldIndex = this.editableFields.findIndex(f => f.location === newExerciseLocation);
        if (newFieldIndex !== -1) {
          this.state.selectedFieldIndex = newFieldIndex;
        }
      }
    } else {
      this.setStatus(result.message, 'error');
    }
  }

  /**
   * Helper: Find exercise in database
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
   * Helper: Filter exercises by category and muscle group
   * For strength exercises, matches muscle groups
   * For other categories, matches category only
   */
  private filterExercisesByCategory(category: string, muscleGroups?: string[]): string[] {
    const categories = exerciseDatabase.exercise_database.categories as Record<string, { exercises: Record<string, any> }>;
    const matchingExercises: string[] = [];

    // If category exists in DB
    if (categories[category]) {
      const exercisesInCategory = categories[category].exercises;

      for (const exerciseName in exercisesInCategory) {
        const exerciseData = exercisesInCategory[exerciseName];

        // For strength exercises, also match muscle groups
        if (category === 'strength' && muscleGroups && muscleGroups.length > 0) {
          const exerciseMuscles = exerciseData.muscle_groups || [];
          // Check if there's at least one overlapping muscle group
          const hasOverlap = muscleGroups.some(mg => exerciseMuscles.includes(mg));
          if (hasOverlap) {
            matchingExercises.push(exerciseName);
          }
        } else {
          // For non-strength exercises, just match category
          matchingExercises.push(exerciseName);
        }
      }
    }

    return matchingExercises;
  }

  /**
   * Delete current exercise or sub-exercise
   * If on a sub-exercise, only delete that sub-exercise
   * If on the compound parent name, delete the entire block
   */
  private deleteCurrentExercise(): void {
    const field = this.editableFields[this.state.selectedFieldIndex];
    if (!field) return;

    let result;

    // Check if we're on a sub-exercise field
    if (field.subExerciseIndex !== undefined) {
      // Delete just the sub-exercise
      result = this.editor.deleteSubExercise(field.dayKey, field.exerciseIndex, field.subExerciseIndex);
    } else {
      // Delete the entire exercise (or compound block if on parent name)
      result = this.editor.deleteExercise(field.dayKey, field.exerciseIndex);
    }

    if (result.success) {
      this.setStatus(result.message, 'success');
      this.editableFields = this.editor.getAllEditableFields();

      // Move selection to previous field if we're at the end
      if (this.state.selectedFieldIndex >= this.editableFields.length) {
        this.state.selectedFieldIndex = Math.max(0, this.editableFields.length - 1);
      }
    } else {
      this.setStatus(result.message, 'error');
    }
  }

  /**
   * Toggle work definition between reps and work_time for current exercise or sub-exercise
   */
  private toggleWorkDefinition(): void {
    const field = this.editableFields[this.state.selectedFieldIndex];
    if (!field) return;

    // Check if we're on a sub-exercise field within a compound block
    if (field.subExerciseIndex !== undefined) {
      // Toggle sub-exercise work definition
      const result = this.editor.toggleSubExerciseWorkDefinition(
        field.dayKey,
        field.exerciseIndex,
        field.subExerciseIndex
      );

      if (result.success) {
        this.setStatus(result.message, 'success');
        this.editableFields = this.editor.getAllEditableFields();
      } else {
        this.setStatus(result.message, 'error');
      }
      return;
    }

    // Check if this is a compound parent block
    const workout = this.editor.getWorkout();
    const day = workout.days[field.dayKey];
    const exercise = day?.exercises[field.exerciseIndex];

    if (exercise?.sub_exercises !== undefined) {
      // Don't allow toggling parent compound block work definition
      // Parent blocks have block-level work_time (total EMOM/Circuit duration) that shouldn't toggle
      this.setStatus('Cannot toggle compound block. Toggle individual sub-exercises instead.', 'error');
      return;
    }

    // Toggle standalone exercise work definition
    const result = this.editor.toggleWorkDefinition(field.dayKey, field.exerciseIndex);

    if (result.success) {
      this.setStatus(result.message, 'success');
      this.editableFields = this.editor.getAllEditableFields();
    } else {
      this.setStatus(result.message, 'error');
    }
  }

  /**
   * Undo last change
   */
  private undoLastChange(): void {
    const undoEntry = this.editor.undo();
    if (undoEntry) {
      this.setStatus(`Undone: ${undoEntry.action}`, 'success');
      this.editableFields = this.editor.getAllEditableFields();

      // Jump to the location that was undone
      const fieldIndex = this.editableFields.findIndex(f => f.location === undoEntry.location);
      if (fieldIndex !== -1) {
        this.state.selectedFieldIndex = fieldIndex;
      }
    } else {
      this.setStatus('Nothing to undo', 'info');
    }
  }

  /**
   * Create a compound exercise block (EMOM/AMRAP/Circuit/Interval)
   */
  private createCompoundBlock(): void {
    const field = this.editableFields[this.state.selectedFieldIndex];
    if (!field || field.type !== 'insertion_point') {
      this.setStatus('Navigate to an <add exercise> insertion point first', 'error');
      return;
    }

    const result = this.editor.createCompoundBlock(
      field.dayKey,
      field.exerciseIndex,
      'emom', // Default to EMOM
      this.options.experienceLevel || 'intermediate'
    );

    if (result.success) {
      this.setStatus(`${result.message}. Press 'a'/'c'/'i' to change type.`, 'success');
      this.editableFields = this.editor.getAllEditableFields();

      // Jump to the newly created compound block name field
      if (result.newExerciseIndex !== undefined) {
        const newExerciseLocation = `${field.dayKey}.exercises[${result.newExerciseIndex}].name`;
        const newFieldIndex = this.editableFields.findIndex(f => f.location === newExerciseLocation);
        if (newFieldIndex !== -1) {
          this.state.selectedFieldIndex = newFieldIndex;
        }
      }
    } else {
      this.setStatus(result.message, 'error');
    }
  }

  /**
   * Set the type of the current compound block
   */
  private setCompoundBlockType(newCategory: 'emom' | 'amrap' | 'circuit' | 'interval'): void {
    const field = this.editableFields[this.state.selectedFieldIndex];
    if (!field) return;

    const result = this.editor.setCompoundBlockType(
      field.dayKey,
      field.exerciseIndex,
      newCategory,
      this.options.experienceLevel || 'intermediate'
    );

    if (result.success) {
      this.setStatus(result.message, 'success');
      this.editableFields = this.editor.getAllEditableFields();
      // Stay on the same field (name will have been updated)
    } else {
      this.setStatus(result.message, 'error');
    }
  }

  /**
   * Handle swap mode activation (double-tap 'a')
   * First tap: mark first exercise
   * Second tap (within 1 second): mark second exercise and prompt for confirmation
   * Works on any field - uses the exercise index from the current field
   */
  private handleSwapMode(): void {
    const field = this.editableFields[this.state.selectedFieldIndex];
    if (!field) return;

    // Don't allow swapping on insertion points
    if (field.type === 'insertion_point') {
      this.setStatus('Cannot swap insertion points', 'error');
      return;
    }

    // Don't allow swapping sub-exercises (only whole exercises)
    if (field.subExerciseIndex !== undefined) {
      this.setStatus('Cannot swap sub-exercises - navigate to parent exercise', 'error');
      return;
    }

    const now = Date.now();
    const timeSinceLastATap = now - this.state.swapModeState.lastATapTime;

    // DEBUG: Log swap mode state
    if (process.env.DEBUG_SWAP) {
      console.log(`[SWAP DEBUG] timeSince=${timeSinceLastATap}ms, active=${this.state.swapModeState.active}, condition=${this.state.swapModeState.active && timeSinceLastATap < 1000}`);
    }

    // Check if this is a double-tap (within 1 second)
    if (this.state.swapModeState.active && timeSinceLastATap < 1000) {
      // Second tap - confirm swap
      const firstExerciseIndex = this.state.swapModeState.firstExerciseIndex;
      const firstDayKey = this.state.swapModeState.firstDayKey;
      const secondExerciseIndex = field.exerciseIndex;
      const secondDayKey = field.dayKey;

      // Can't swap an exercise with itself
      if (firstDayKey === secondDayKey && firstExerciseIndex === secondExerciseIndex) {
        this.setStatus('Cannot swap exercise with itself', 'error');
        this.state.swapModeState.active = false;
        return;
      }

      // Get exercise names for confirmation prompt
      const workout = this.editor.getWorkout();
      const firstExercise = workout.days[firstDayKey!].exercises[firstExerciseIndex!];
      const secondExercise = workout.days[secondDayKey].exercises[secondExerciseIndex];

      // Show confirmation prompt
      this.promptSwapConfirmation(
        firstDayKey!,
        firstExerciseIndex!,
        firstExercise.name,
        secondDayKey,
        secondExerciseIndex,
        secondExercise.name
      );

      // Clear swap mode
      this.state.swapModeState.active = false;
    } else {
      // First tap - mark exercise
      this.state.swapModeState.active = true;
      this.state.swapModeState.firstExerciseIndex = field.exerciseIndex;
      this.state.swapModeState.firstDayKey = field.dayKey;
      this.setStatus(`Exercise marked for swap. Tap 'a' on another exercise to swap.`, 'info');
    }

    this.state.swapModeState.lastATapTime = now;
  }

  /**
   * Prompt user to confirm exercise swap
   */
  private promptSwapConfirmation(
    dayKey1: string,
    exerciseIndex1: number,
    exerciseName1: string,
    dayKey2: string,
    exerciseIndex2: number,
    exerciseName2: string
  ): void {
    console.clear();
    console.log(chalk.yellow.bold('=== SWAP EXERCISES ==='));
    console.log('');
    console.log(`  ${chalk.cyan('Exercise A:')} ${exerciseName1} (${dayKey1}, position ${exerciseIndex1 + 1})`);
    console.log(`  ${chalk.cyan('Exercise B:')} ${exerciseName2} (${dayKey2}, position ${exerciseIndex2 + 1})`);
    console.log('');
    console.log(chalk.yellow(`Swap these exercises?`));
    console.log('');
    console.log(`  ${chalk.green('y')} - Yes, swap them`);
    console.log(`  ${chalk.red('n')} - No, cancel`);
    console.log('');

    // Wait for y/n keypress
    const handler = (str: string, key: any) => {
      process.stdin.removeListener('keypress', handler);

      if (str === 'y' || str === 'Y') {
        // Execute swap
        const result = this.editor.swapExercises(dayKey1, exerciseIndex1, dayKey2, exerciseIndex2);

        if (result.success) {
          this.setStatus(result.message, 'success');
          this.editableFields = this.editor.getAllEditableFields();
        } else {
          this.setStatus(result.message, 'error');
        }
      } else {
        this.setStatus('Swap cancelled', 'info');
      }

      this.render();
    };

    process.stdin.once('keypress', handler);
  }

  /**
   * Check if the current exercise is a compound exercise
   */
  private isCurrentExerciseCompound(): boolean {
    const field = this.editableFields[this.state.selectedFieldIndex];
    if (!field) return false;

    const workout = this.editor.getWorkout();
    const day = workout.days[field.dayKey];
    if (!day) return false;

    const exercise = day.exercises[field.exerciseIndex];
    if (!exercise) return false;

    return exercise.sub_exercises !== undefined;
  }

  /**
   * Execute command (e.g., :w, :q, :validate)
   */
  private async executeCommand(cmd: string): Promise<void> {
    const parts = cmd.trim().split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1);

    const commands = hotkeysConfig.command_mode.commands;

    if (commands.save.includes(command)) {
      this.saveWorkout(args[0]);
    } else if (commands.quit.includes(command)) {
      await this.quit();
    } else if (commands.save_and_quit.includes(command)) {
      this.saveWorkout(args[0]);
      this.running = false;
    } else if (commands.force_quit.includes(command)) {
      this.running = false;
    } else if (commands.validate.includes(command)) {
      this.validateWorkout();
    } else if (commands.help.includes(command)) {
      this.state.mode = 'help';
    } else {
      this.setStatus(`Unknown command: ${command}`, 'error');
    }
  }

  /**
   * Save workout to file
   */
  private saveWorkout(filePath?: string): boolean {
    const targetPath = filePath || this.options.filePath;

    if (!targetPath) {
      this.setStatus('No file path specified. Use :w <filename>', 'error');
      return false;
    }

    try {
      const workout = this.editor.getWorkout();
      fs.writeFileSync(targetPath, JSON.stringify(workout, null, 2), 'utf-8');
      this.editor.markSaved();
      this.state.savedThisSession = true;
      this.setStatus(`Saved to ${targetPath}`, 'success');
      return true;
    } catch (error) {
      this.setStatus(`Save failed: ${error}`, 'error');
      return false;
    }
  }

  /**
   * Validate workout
   */
  private validateWorkout(): void {
    const workout = this.editor.getWorkout();
    const result = validateWorkout(workout);
    const formatted = formatValidationResult(result);

    // Show validation in a temporary overlay
    console.clear();
    console.log(formatted);
    console.log('');
    console.log(chalk.gray('Press any key to continue...'));

    // Wait for keypress
    const handler = () => {
      process.stdin.removeListener('keypress', handler);
      this.render();
    };
    process.stdin.once('keypress', handler);
  }

  /**
   * Quit with unsaved changes check
   */
  private async quit(): Promise<void> {
    if (this.editor.isModified()) {
      this.setStatus('Unsaved changes! Use :wq to save and quit, or :q! to force quit', 'error');
    } else {
      this.running = false;
    }
  }

  /**
   * Render the current view
   */
  private render(): void {
    console.clear();

    const workout = this.editor.getWorkout();
    const selectedField = this.editableFields[this.state.selectedFieldIndex];

    const highlightOptions: HighlightOptions = {
      selectedFieldLocation: selectedField?.location,
      showAllEditable: false
    };

    if (this.state.mode === 'help') {
      this.renderHelp();
      return;
    }

    if (this.state.viewMode === 'week') {
      console.log(formatWorkoutInteractive(workout, highlightOptions));
    } else {
      const dayKey = this.dayKeys[this.state.currentDayIndex];
      const day = workout.days[dayKey];
      console.log(formatSingleDayView(day, dayKey, workout.weeks, highlightOptions));
    }

    console.log('');
    this.renderStatusLine();
  }

  /**
   * Render status line at bottom
   */
  private renderStatusLine(): void {
    const workout = this.editor.getWorkout();
    const modifiedIndicator = this.editor.isModified() ? chalk.red('[+]') : '';
    const modeIndicator = this.getModeIndicator();
    const viewIndicator = this.state.viewMode === 'week' ? '[WEEK]' : `[DAY ${this.state.currentDayIndex + 1}/${this.dayKeys.length}]`;
    const undoIndicator = this.editor.getUndoStackSize() > 0 ? `[Undo: ${this.editor.getUndoStackSize()}]` : '';

    console.log(chalk.gray('-'.repeat(60)));

    if (this.state.mode === 'edit') {
      console.log(chalk.cyan(`EDIT: ${this.state.editBuffer}_`));
    } else if (this.state.mode === 'command') {
      console.log(chalk.cyan(`:${this.state.commandBuffer}_`));
    }

    const statusColor = this.state.statusType === 'error' ? chalk.red : this.state.statusType === 'success' ? chalk.green : chalk.gray;
    console.log(statusColor(this.state.statusMessage));

    console.log(chalk.gray(`${modeIndicator} ${viewIndicator} ${modifiedIndicator} ${undoIndicator} | Press ? for help`));
  }

  /**
   * Show exercise information from exercise_descriptions.json
   */
  private showExerciseInfo(): void {
    const field = this.editableFields[this.state.selectedFieldIndex];
    if (!field) return;

    // Get exercise name from current field
    let exerciseName: string | undefined;

    if (field.fieldName === 'name' && field.type !== 'insertion_point') {
      exerciseName = String(field.currentValue);
    } else {
      this.setStatus('Navigate to an exercise name field first', 'error');
      return;
    }

    if (!exerciseName) {
      this.setStatus('No exercise selected', 'error');
      return;
    }

    // Look up exercise in descriptions database
    const descriptions = exerciseDescriptions as Record<string, {
      description: {
        overview: string;
        setup: string;
        movement: string;
        cues: string;
      }
    }>;

    const exerciseInfo = descriptions[exerciseName];

    if (!exerciseInfo) {
      this.setStatus(`No description found for: ${exerciseName}`, 'error');
      return;
    }

    // Get exercise metadata from exercise database
    const exerciseData = this.findExerciseInDatabase(exerciseName);

    // Render description overlay
    console.clear();
    console.log(chalk.cyan.bold('='.repeat(60)));
    console.log(chalk.cyan.bold(`EXERCISE: ${exerciseName}`));
    console.log(chalk.cyan.bold('='.repeat(60)));
    console.log('');

    if (exerciseData) {
      console.log(chalk.gray(`Category: ${exerciseData.category} | Difficulty: ${exerciseData.difficulty} | External Load: ${exerciseData.external_load}`));
      if (exerciseData.muscle_groups && exerciseData.muscle_groups.length > 0) {
        console.log(chalk.gray(`Muscles: ${exerciseData.muscle_groups.join(', ')}`));
      }
      if (exerciseData.equipment && exerciseData.equipment.length > 0) {
        console.log(chalk.gray(`Equipment: ${exerciseData.equipment.join(', ')}`));
      }
      console.log('');
    }

    console.log(chalk.yellow.bold('OVERVIEW:'));
    console.log(exerciseInfo.description.overview);
    console.log('');

    console.log(chalk.yellow.bold('SETUP:'));
    console.log(exerciseInfo.description.setup);
    console.log('');

    console.log(chalk.yellow.bold('MOVEMENT:'));
    console.log(exerciseInfo.description.movement);
    console.log('');

    console.log(chalk.yellow.bold('CUES:'));
    console.log(exerciseInfo.description.cues);
    console.log('');

    console.log(chalk.gray('-'.repeat(60)));
    console.log(chalk.gray('Press any key to return to editor...'));

    // Wait for keypress
    const handler = () => {
      process.stdin.removeListener('keypress', handler);
      this.render();
    };
    process.stdin.once('keypress', handler);
  }

  /**
   * Render help screen
   */
  private renderHelp(): void {
    console.log(chalk.cyan('=== INTERACTIVE WORKOUT EDITOR HELP ==='));
    console.log('');
    console.log(chalk.yellow('VIEW MODE:'));
    console.log('  d/w         - Toggle Day/Week view');
    console.log('  ← →         - Navigate between days (Day view)');
    console.log('  t/T         - Jump to next/previous editable field');
    console.log('  1-99        - Jump to exercise number (multi-digit supported)');
    console.log('  r           - Replace/edit field (vim-like: auto-clears value)');
    console.log('  e           - Open exercise database browser');
    console.log('  i           - Show exercise info (descriptions, cues, setup)');
    console.log('  a (2x)      - Swap mode: tap twice to swap exercises');
    console.log('  s           - Swap/add random matching exercise');
    console.log('  m           - Toggle work definition (reps <-> work_time)');
    console.log('  b           - Create compound block (EMOM/AMRAP/Circuit/Interval)');
    console.log('  Del         - Delete current exercise');
    console.log('  u           - Undo last change');
    console.log('  :           - Enter command mode');
    console.log('  q           - Quit (checks for unsaved changes)');
    console.log('');
    console.log(chalk.gray('Note: On <add exercise> markers, r/e/s will add exercises'));
    console.log(chalk.gray('Note: On compound parent names, e/a/c/i change block type'));
    console.log('');
    console.log(chalk.yellow('EDIT MODE:'));
    console.log('  Type        - Enter new value');
    console.log('  Enter       - Confirm edit (save to current week)');
    console.log('  Enter (2x)  - Broadcast to all weeks (week-specific fields only)');
    console.log('  Tab         - Confirm and jump to next field');
    console.log('  Esc         - Cancel edit');
    console.log('');
    console.log(chalk.yellow('COMMAND MODE:'));
    console.log('  :w          - Save workout');
    console.log('  :w <file>   - Save as (specify path)');
    console.log('  :q          - Quit');
    console.log('  :wq         - Save and quit');
    console.log('  :q!         - Force quit (discard changes)');
    console.log('  :validate   - Validate workout structure');
    console.log('');
    console.log(chalk.cyan('NEW FEATURES:'));
    console.log('  • Multi-digit jump: Type "15" to jump to exercise 15');
    console.log('  • Exercise info: Press "i" on any exercise name for details');
    console.log('  • Swap mode: Tap "a" on first exercise, then "a" on second');
    console.log('  • Broadcast: Press Enter twice to copy value to all weeks');
    console.log('  • Vim replace: "r" now auto-clears the field (no backspace needed)');
    console.log('');
    console.log(chalk.gray('Press Esc or Q to close help'));
  }

  /**
   * Get mode indicator string
   */
  private getModeIndicator(): string {
    if (this.state.mode === 'view') return chalk.green('[VIEW]');
    if (this.state.mode === 'edit') return chalk.yellow('[EDIT]');
    if (this.state.mode === 'command') return chalk.cyan('[COMMAND]');
    if (this.state.mode === 'help') return chalk.blue('[HELP]');
    return '';
  }

  /**
   * Set status message
   */
  private setStatus(message: string, type: 'info' | 'success' | 'error'): void {
    this.state.statusMessage = message;
    this.state.statusType = type;
  }

  /**
   * Navigate to next editable field (day-aware in day view)
   */
  private navigateToNextField(): void {
    // Clear last edited state when navigating away
    this.state.lastEditedField = null;
    this.state.lastEditedValue = null;

    if (this.state.viewMode === 'week') {
      // Week view: navigate through all fields
      this.state.selectedFieldIndex = Math.min(this.editableFields.length - 1, this.state.selectedFieldIndex + 1);
    } else {
      // Day view: only navigate within current day
      const currentDayKey = this.dayKeys[this.state.currentDayIndex];
      const currentIndex = this.state.selectedFieldIndex;

      for (let i = currentIndex + 1; i < this.editableFields.length; i++) {
        if (this.editableFields[i].dayKey === currentDayKey) {
          this.state.selectedFieldIndex = i;
          return;
        }
      }

      // If no next field in current day, wrap to first field of current day
      for (let i = 0; i <= currentIndex; i++) {
        if (this.editableFields[i].dayKey === currentDayKey) {
          this.state.selectedFieldIndex = i;
          return;
        }
      }
    }
  }

  /**
   * Navigate to previous editable field (day-aware in day view)
   */
  private navigateToPreviousField(): void {
    // Clear last edited state when navigating away
    this.state.lastEditedField = null;
    this.state.lastEditedValue = null;

    if (this.state.viewMode === 'week') {
      // Week view: navigate through all fields
      this.state.selectedFieldIndex = Math.max(0, this.state.selectedFieldIndex - 1);
    } else {
      // Day view: only navigate within current day
      const currentDayKey = this.dayKeys[this.state.currentDayIndex];
      const currentIndex = this.state.selectedFieldIndex;

      for (let i = currentIndex - 1; i >= 0; i--) {
        if (this.editableFields[i].dayKey === currentDayKey) {
          this.state.selectedFieldIndex = i;
          return;
        }
      }

      // If no previous field in current day, wrap to last field of current day
      for (let i = this.editableFields.length - 1; i >= currentIndex; i--) {
        if (this.editableFields[i].dayKey === currentDayKey) {
          this.state.selectedFieldIndex = i;
          return;
        }
      }
    }
  }

  /**
   * Find field index by exercise number
   * @param exerciseIndex - The exercise index to find (0-based)
   * @param dayKey - Optional day key to filter by (for day view)
   */
  private findFieldByExerciseNumber(exerciseIndex: number, dayKey?: string): number {
    for (let i = 0; i < this.editableFields.length; i++) {
      const field = this.editableFields[i];

      // If dayKey specified, only match within that day
      if (dayKey && field.dayKey !== dayKey) {
        continue;
      }

      if (field.exerciseIndex === exerciseIndex) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Sync day view to show the day containing the currently selected field
   */
  private syncDayViewToSelectedField(): void {
    if (this.state.viewMode !== 'day') return;

    const selectedField = this.editableFields[this.state.selectedFieldIndex];
    if (!selectedField) return;

    const dayIndex = this.dayKeys.indexOf(selectedField.dayKey);
    if (dayIndex !== -1 && dayIndex !== this.state.currentDayIndex) {
      this.state.currentDayIndex = dayIndex;
    }
  }

  /**
   * Temporary cleanup for switching UIs (e.g., exercise database)
   * Does NOT pause stdin - we need it to resume
   */
  private cleanupTemporary(): void {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    process.stdin.removeAllListeners('keypress');
  }

  /**
   * Full cleanup for program exit
   * Pauses stdin to allow terminal to return
   */
  private cleanup(): void {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    process.stdin.removeAllListeners('keypress');
    process.stdin.pause();
  }
}

/**
 * Entry point for interactive workout editing
 */
export async function editWorkoutInteractive(
  workout: ParameterizedWorkout,
  options: EditorOptions = {}
): Promise<{ saved: boolean; workout: ParameterizedWorkout }> {
  const editor = new InteractiveWorkoutEditor(workout, options);
  return await editor.start();
}
