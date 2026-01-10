#!/usr/bin/env node

/**
 * CLI Test Runner for Workout Generation Engine
 *
 * Loads sample questionnaires and generates complete workout programs
 * Validates output and saves to JSON files for inspection
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateWorkout } from '../src/lib/engine/workout-generator.js';
import type { QuestionnaireAnswers, ParameterizedWorkout } from '../src/lib/engine/types.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const QUESTIONNAIRES_DIR = join(__dirname, 'sample-questionnaires');
const OUTPUTS_DIR = join(__dirname, 'sample-outputs');

/**
 * Validates a generated workout against WORKOUT_SPEC.md requirements
 */
function validateWorkout(workout: ParameterizedWorkout): string[] {
  const errors: string[] = [];

  // Check required top-level fields
  if (!workout.id) errors.push('Missing field: id');
  if (!workout.name) errors.push('Missing field: name');
  if (!workout.description) errors.push('Missing field: description');
  if (!workout.version) errors.push('Missing field: version');
  if (!workout.weeks) errors.push('Missing field: weeks');
  if (!workout.daysPerWeek) errors.push('Missing field: daysPerWeek');

  // Check metadata
  if (!workout.metadata) {
    errors.push('Missing metadata');
  } else {
    if (!workout.metadata.difficulty) errors.push('Missing metadata.difficulty');
    if (!workout.metadata.equipment) errors.push('Missing metadata.equipment');
    if (!workout.metadata.estimatedDuration) errors.push('Missing metadata.estimatedDuration');
  }

  // Check days
  if (!workout.days) {
    errors.push('Missing days object');
  } else {
    for (const dayKey in workout.days) {
      const day = workout.days[dayKey];

      if (!day.exercises) {
        errors.push(`Day ${dayKey}: Missing exercises array`);
        continue;
      }

      // Check each exercise
      for (let i = 0; i < day.exercises.length; i++) {
        const exercise = day.exercises[i];

        if (!exercise.name) {
          errors.push(`Day ${dayKey}, Exercise ${i}: Missing name`);
        }

        // Check that all required weeks are present
        if (!exercise.week1) {
          errors.push(`Day ${dayKey}, Exercise ${i} (${exercise.name}): Missing week1`);
        }
        if (!exercise.week2) {
          errors.push(`Day ${dayKey}, Exercise ${i} (${exercise.name}): Missing week2`);
        }
        if (!exercise.week3) {
          errors.push(`Day ${dayKey}, Exercise ${i} (${exercise.name}): Missing week3`);
        }

        // Check that week parameters have at least some content
        if (exercise.week1) {
          const week1Keys = Object.keys(exercise.week1);
          if (week1Keys.length === 0) {
            errors.push(`Day ${dayKey}, Exercise ${i} (${exercise.name}): week1 is empty`);
          }
        }
      }

      // Check that there are some exercises
      if (day.exercises.length === 0) {
        errors.push(`Day ${dayKey}: No exercises selected`);
      }
    }
  }

  return errors;
}

/**
 * Loads a questionnaire JSON file
 */
function loadQuestionnaire(filename: string): QuestionnaireAnswers {
  const filepath = join(QUESTIONNAIRES_DIR, filename);
  const content = readFileSync(filepath, 'utf-8');
  return JSON.parse(content) as QuestionnaireAnswers;
}

/**
 * Saves a generated workout to JSON file
 */
function saveWorkout(workout: ParameterizedWorkout, filename: string): void {
  const filepath = join(OUTPUTS_DIR, filename);
  writeFileSync(filepath, JSON.stringify(workout, null, 2), 'utf-8');
}

/**
 * Main test runner
 */
function main() {
  console.log('='.repeat(60));
  console.log('WORKOUT GENERATION ENGINE - CLI TEST RUNNER');
  console.log('='.repeat(60));
  console.log();

  // Get all questionnaire files
  let questionnaireFiles: string[];
  try {
    questionnaireFiles = readdirSync(QUESTIONNAIRES_DIR).filter(f => f.endsWith('.json'));
  } catch (error) {
    console.error('Error reading questionnaires directory:', error);
    console.log('No questionnaire files found. Please create sample questionnaires in:');
    console.log(QUESTIONNAIRES_DIR);
    process.exit(1);
  }

  if (questionnaireFiles.length === 0) {
    console.log('No questionnaire files found in:', QUESTIONNAIRES_DIR);
    console.log('Please create sample questionnaire JSON files.');
    process.exit(1);
  }

  console.log(`Found ${questionnaireFiles.length} questionnaire(s):\n`);

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  // Process each questionnaire
  for (const filename of questionnaireFiles) {
    totalTests++;
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`Test ${totalTests}: ${filename}`);
    console.log('─'.repeat(60));

    try {
      // Load questionnaire
      const answers = loadQuestionnaire(filename);
      console.log(`Goal: ${answers.goal}`);
      console.log(`Experience: ${answers.experience_level}`);
      console.log(`Frequency: ${answers.training_frequency} days/week`);
      console.log(`Duration: ${answers.session_duration} minutes`);
      console.log(`Equipment: ${answers.equipment_access}`);

      // Generate workout
      console.log('\nGenerating workout...');
      const startTime = Date.now();
      const workout = generateWorkout(answers);
      const endTime = Date.now();
      console.log(`✓ Generated in ${endTime - startTime}ms`);

      // Validate workout
      console.log('\nValidating workout...');
      const validationErrors = validateWorkout(workout);

      if (validationErrors.length > 0) {
        console.log(`✗ Validation FAILED with ${validationErrors.length} error(s):`);
        validationErrors.forEach(err => console.log(`  - ${err}`));
        failedTests++;
      } else {
        console.log('✓ Validation PASSED');
        passedTests++;
      }

      // Save output
      const outputFilename = filename.replace('.json', '-output.json');
      saveWorkout(workout, outputFilename);
      console.log(`\nSaved to: cli/sample-outputs/${outputFilename}`);

      // Print summary
      console.log('\nWorkout Summary:');
      console.log(`  Program: ${workout.name}`);
      console.log(`  Weeks: ${workout.weeks}`);
      console.log(`  Days per week: ${workout.daysPerWeek}`);

      for (const dayKey in workout.days) {
        const day = workout.days[dayKey];
        console.log(`  Day ${dayKey} (${day.focus}): ${day.exercises.length} exercises`);
      }

    } catch (error) {
      console.error('✗ FAILED with error:', error);
      failedTests++;
    }
  }

  // Print final summary
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${failedTests}`);
  console.log('='.repeat(60));

  process.exit(failedTests > 0 ? 1 : 0);
}

main();
