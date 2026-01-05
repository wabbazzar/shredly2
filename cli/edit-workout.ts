#!/usr/bin/env node

/**
 * Standalone CLI Tool for Editing Existing Workout JSONs
 *
 * Usage:
 *   npm run edit-workout <path-to-workout.json>
 *   node cli/edit-workout.ts ./my-workout.json
 *
 * Opens an interactive vim-like editor for the specified workout file
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { ParameterizedWorkout } from '../src/lib/engine/types.js';
import { editWorkoutInteractive } from './lib/interactive-workout-editor.js';

/**
 * Load workout from JSON file
 */
function loadWorkoutFromFile(filePath: string): ParameterizedWorkout {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const workout = JSON.parse(content) as ParameterizedWorkout;

    // Basic validation
    if (!workout.name || !workout.version || !workout.days) {
      throw new Error('Invalid workout format: missing required fields (name, version, days)');
    }

    return workout;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(`File not found: ${filePath}`);
    }
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: npm run edit-workout <path-to-workout.json>');
    console.log('');
    console.log('Examples:');
    console.log('  npm run edit-workout ./my-workout.json');
    console.log('  npm run edit-workout /path/to/workout-12345.json');
    console.log('');
    console.log('Opens an interactive vim-like editor for the specified workout file.');
    console.log('Press ? inside the editor for help.');
    process.exit(0);
  }

  const inputPath = args[0];
  const absolutePath = resolve(inputPath);

  console.log('='.repeat(60));
  console.log('SHREDLY - INTERACTIVE WORKOUT EDITOR');
  console.log('='.repeat(60));
  console.log(`Loading workout from: ${absolutePath}`);
  console.log('');

  try {
    // Load workout
    const workout = loadWorkoutFromFile(absolutePath);

    console.log(`Loaded: ${workout.name}`);
    console.log(`Version: ${workout.version}`);
    console.log(`Weeks: ${workout.weeks} | Days per week: ${workout.daysPerWeek}`);
    console.log('');
    console.log('Launching interactive editor...');
    console.log('Tip: Press ? for help once inside the editor');
    console.log('');

    // Give user a moment to read
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Launch editor
    const result = await editWorkoutInteractive(workout, {
      filePath: absolutePath,
      experienceLevel: workout.metadata.difficulty || 'intermediate'
    });

    // Clear screen and show exit message
    console.clear();
    console.log('');
    console.log('='.repeat(60));
    console.log('SESSION ENDED');
    console.log('='.repeat(60));

    if (result.saved) {
      console.log(`✓ Workout saved to: ${absolutePath}`);
    } else {
      console.log('Workout was not saved (no changes or user chose not to save)');
    }

    console.log('');
    console.log('Thank you for using Shredly!');

  } catch (error: any) {
    console.error('');
    console.error('ERROR:', error.message);
    console.error('');
    process.exit(1);
  }
}

main();
