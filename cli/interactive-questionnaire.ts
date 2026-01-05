#!/usr/bin/env node

/**
 * Interactive CLI Questionnaire for Workout Generation
 *
 * Prompts user through questionnaire questions and generates a personalized workout
 */

import inquirer from 'inquirer';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateWorkout } from '../src/lib/engine/workout-generator.js';
import type { QuestionnaireAnswers, ParameterizedWorkout } from '../src/lib/engine/types.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const QUESTIONNAIRE_PATH = join(__dirname, '../src/data/workout-questionnaire.json');

/**
 * Load questionnaire structure
 */
function loadQuestionnaire() {
  const content = readFileSync(QUESTIONNAIRE_PATH, 'utf-8');
  return JSON.parse(content);
}

/**
 * Convert questionnaire question to inquirer prompt
 */
function createPrompt(question: any) {
  const basePrompt = {
    name: question.id,
    message: question.question,
    description: question.description,
  };

  if (question.type === 'multiple_choice') {
    return {
      ...basePrompt,
      type: 'select',
      choices: question.options.map((opt: any) => ({
        name: `${opt.label} - ${opt.description}`,
        value: opt.value,
        short: opt.label,
      })),
    };
  } else if (question.type === 'multiple_choice_multiple') {
    return {
      ...basePrompt,
      type: 'checkbox',
      choices: question.options.map((opt: any) => ({
        name: `${opt.label} - ${opt.description}`,
        value: opt.value,
        checked: false,
      })),
      validate: (answer: string[]) => {
        if (question.max_selections && answer.length > question.max_selections) {
          return `Please select no more than ${question.max_selections} options.`;
        }
        return true;
      },
    };
  }

  throw new Error(`Unsupported question type: ${question.type}`);
}

/**
 * Validate required questions
 */
function validateAnswers(answers: any, questionnaire: any): string[] {
  const errors: string[] = [];
  const requiredQuestions = questionnaire.validation_rules.required_questions;

  for (const req of requiredQuestions) {
    if (!answers[req] || (Array.isArray(answers[req]) && answers[req].length === 0)) {
      const question = questionnaire.questions.find((q: any) => q.id === req);
      errors.push(`Required question not answered: ${question?.question}`);
    }
  }

  if (Object.keys(answers).length < questionnaire.validation_rules.min_questions_answered) {
    errors.push(`Minimum ${questionnaire.validation_rules.min_questions_answered} questions must be answered.`);
  }

  return errors;
}

/**
 * Display workout summary
 */
function displayWorkoutSummary(workout: ParameterizedWorkout) {
  console.log('\n' + '='.repeat(60));
  console.log('WORKOUT PROGRAM GENERATED');
  console.log('='.repeat(60));
  console.log(`Program: ${workout.name}`);
  console.log(`Description: ${workout.description}`);
  console.log(`Version: ${workout.version}`);
  console.log(`Weeks: ${workout.weeks}`);
  console.log(`Days per Week: ${workout.daysPerWeek}`);
  console.log(`Difficulty: ${workout.metadata.difficulty}`);
  console.log(`Equipment: ${workout.metadata.equipment}`);
  console.log(`Estimated Duration: ${workout.metadata.estimatedDuration} minutes`);

  console.log('\nWorkout Structure:');
  for (const dayKey in workout.days) {
    const day = workout.days[dayKey];
    console.log(`  Day ${dayKey} (${day.focus}): ${day.exercises.length} exercises`);
  }
  console.log('='.repeat(60));
}

/**
 * Main interactive questionnaire function
 */
async function main() {
  console.log('='.repeat(60));
  console.log('SHREDLY - INTERACTIVE WORKOUT QUESTIONNAIRE');
  console.log('='.repeat(60));
  console.log('Answer the following questions to generate your personalized workout program.\n');

  try {
    // Load questionnaire
    const questionnaire = loadQuestionnaire();

    // Create prompts
    const prompts = questionnaire.questions.map(createPrompt);

    // Run interactive prompts
    const answers = await inquirer.prompt(prompts);

    // Validate answers
    const validationErrors = validateAnswers(answers, questionnaire);
    if (validationErrors.length > 0) {
      console.error('Validation errors:');
      validationErrors.forEach(err => console.error(`  - ${err}`));
      process.exit(1);
    }

    // Generate workout
    console.log('\nGenerating your personalized workout program...');
    const startTime = Date.now();
    const workout = generateWorkout(answers as QuestionnaireAnswers);
    const endTime = Date.now();
    console.log(`✓ Generated in ${endTime - startTime}ms`);

    // Display summary
    displayWorkoutSummary(workout);

    // Ask to save
    const { saveChoice } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'saveChoice',
        message: 'Would you like to save this workout program to a JSON file?',
        default: true,
      },
    ]);

    if (saveChoice) {
      const { filename } = await inquirer.prompt([
        {
          type: 'input',
          name: 'filename',
          message: 'Enter filename (without extension):',
          default: `workout-${Date.now()}`,
        },
      ]);

      const filepath = join(process.cwd(), `${filename}.json`);
      writeFileSync(filepath, JSON.stringify(workout, null, 2), 'utf-8');
      console.log(`✓ Workout saved to: ${filepath}`);
    }

    console.log('\nThank you for using Shredly! Your workout program is ready.');

  } catch (error) {
    console.error('An error occurred:', error);
    process.exit(1);
  }
}

main();