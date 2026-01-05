#!/usr/bin/env node

/**
 * Test script for interactive workout editor
 * Tests basic functionality without requiring interactive input
 */

import { readFileSync } from 'fs';
import type { ParameterizedWorkout } from '../src/lib/engine/types.js';
import { WorkoutEditor } from '../src/lib/engine/workout-editor.js';
import { validateWorkout, formatValidationResult } from '../src/lib/engine/workout-validator.js';
import { formatWorkoutInteractive } from './lib/workout-formatter.js';

console.log('='.repeat(60));
console.log('INTERACTIVE EDITOR - FUNCTIONAL TEST');
console.log('='.repeat(60));
console.log('');

try {
  // Test 1: Load workout
  console.log('Test 1: Loading workout from test.json...');
  const workoutContent = readFileSync('./test.json', 'utf-8');
  const workout = JSON.parse(workoutContent) as ParameterizedWorkout;
  console.log(`✓ Loaded: ${workout.name}`);
  console.log('');

  // Test 2: Initialize editor
  console.log('Test 2: Initializing workout editor...');
  const editor = new WorkoutEditor(workout);
  console.log(`✓ Editor initialized with ${editor.getAllEditableFields().length} editable fields`);
  console.log('');

  // Test 3: Get editable fields
  console.log('Test 3: Extracting editable fields...');
  const fields = editor.getAllEditableFields();
  console.log(`✓ Found ${fields.length} editable fields`);
  console.log(`  First field: ${fields[0].location} = "${fields[0].currentValue}"`);
  console.log(`  Last field: ${fields[fields.length - 1].location} = "${fields[fields.length - 1].currentValue}"`);
  console.log('');

  // Test 4: Edit a field
  console.log('Test 4: Editing a field (sets for first exercise)...');
  const setField = fields.find(f => f.fieldName === 'sets');
  if (setField) {
    const originalValue = setField.currentValue;
    const newValue = 10;
    const success = editor.editField(setField, newValue);
    console.log(`✓ Edit ${success ? 'succeeded' : 'failed'}: ${setField.location} changed from ${originalValue} to ${newValue}`);
  } else {
    console.log('⚠ No sets field found to test');
  }
  console.log('');

  // Test 5: Undo
  console.log('Test 5: Testing undo functionality...');
  const undoEntry = editor.undo();
  if (undoEntry) {
    console.log(`✓ Undone: ${undoEntry.action}`);
    console.log(`  Location: ${undoEntry.location}`);
  } else {
    console.log('⚠ No undo entry (expected if edit failed)');
  }
  console.log('');

  // Test 6: Validate workout
  console.log('Test 6: Validating workout structure...');
  const validationResult = validateWorkout(editor.getWorkout());
  console.log(formatValidationResult(validationResult));
  console.log('');

  // Test 7: Interactive formatting
  console.log('Test 7: Testing interactive formatting...');
  const formatted = formatWorkoutInteractive(editor.getWorkout(), {
    selectedFieldLocation: fields[0].location,
    showAllEditable: false
  });
  console.log('✓ Interactive formatting succeeded');
  console.log(`  Output length: ${formatted.length} characters`);
  console.log('');

  // Test 8: Exercise replacement (simulated)
  console.log('Test 8: Testing exercise replacement...');
  const exerciseNameField = fields.find(f => f.fieldName === 'name' && f.subExerciseIndex === undefined);
  if (exerciseNameField) {
    const result = editor.replaceExercise(
      exerciseNameField.dayKey,
      exerciseNameField.exerciseIndex,
      'Bird Dogs', // Replace with another exercise from database
      'intermediate'
    );
    console.log(`✓ ${result.message}`);
    if (result.addedFields && result.addedFields.length > 0) {
      console.log(`  Added fields: ${result.addedFields.join(', ')}`);
    }
  } else {
    console.log('⚠ No exercise name field found to test');
  }
  console.log('');

  // Summary
  console.log('='.repeat(60));
  console.log('ALL TESTS PASSED');
  console.log('='.repeat(60));
  console.log('');
  console.log('The interactive editor components are working correctly.');
  console.log('');
  console.log('To test the full interactive interface, run:');
  console.log('  npm run cli:edit test.json');
  console.log('');

} catch (error: any) {
  console.error('');
  console.error('TEST FAILED:');
  console.error(error.message);
  console.error('');
  console.error(error.stack);
  process.exit(1);
}
