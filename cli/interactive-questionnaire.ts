#!/usr/bin/env node

/**
 * Interactive CLI Questionnaire for Workout Generation
 *
 * Prompts user through questionnaire questions and generates a personalized workout
 * Features single-number selection: press a number to select, Enter to confirm
 */

import inquirer from 'inquirer';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { generateWorkout } from '../src/lib/engine/workout-generator.js';
import type { QuestionnaireAnswers, ParameterizedWorkout } from '../src/lib/engine/types.js';
import { formatWorkoutForTerminal } from './lib/workout-formatter.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const QUESTIONNAIRE_PATH = join(__dirname, '../src/data/workout-questionnaire.json');

// ANSI escape codes
const ANSI = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  gray: '\x1b[90m',
  clearLine: '\x1b[2K',
  clearToEnd: '\x1b[0J', // Clear from cursor to end of screen
  cursorUp: (n: number) => `\x1b[${n}A`,
  cursorToStart: '\x1b[G',
};

/**
 * Load questionnaire structure
 */
function loadQuestionnaire() {
  const content = readFileSync(QUESTIONNAIRE_PATH, 'utf-8');
  return JSON.parse(content);
}

/**
 * Custom single-number selection prompt
 * - Press a number (1-9) to select that option
 * - Press Enter to confirm and move to next question
 * - Overwrites in place for clean UI
 */
async function singleNumberPrompt(question: any): Promise<string> {
  return new Promise((resolve) => {
    const options = question.options;
    let selectedIndex = 0;

    // Calculate number of lines this prompt uses
    const descLines = question.description ? 1 : 0;
    const totalLines = 1 + descLines + options.length + 1; // question + desc + options + hint

    // Set up raw mode
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();

    const renderOptions = () => {
      // Move cursor up and clear all lines
      process.stdout.write(ANSI.cursorUp(totalLines));

      // Reprint question
      process.stdout.write(ANSI.clearLine + ANSI.cursorToStart);
      process.stdout.write(`${ANSI.bright}${ANSI.cyan}? ${question.question}${ANSI.reset}\n`);

      if (question.description) {
        process.stdout.write(ANSI.clearLine + ANSI.cursorToStart);
        process.stdout.write(`${ANSI.gray}  ${question.description}${ANSI.reset}\n`);
      }

      // Print options
      options.forEach((opt: any, index: number) => {
        process.stdout.write(ANSI.clearLine + ANSI.cursorToStart);
        const num = index + 1;
        const isSelected = index === selectedIndex;
        if (isSelected) {
          process.stdout.write(`${ANSI.green}> ${num}) ${ANSI.bright}${opt.label}${ANSI.reset} ${ANSI.dim}- ${opt.description}${ANSI.reset}\n`);
        } else {
          process.stdout.write(`${ANSI.gray}  ${num}) ${ANSI.reset}${opt.label} ${ANSI.dim}- ${opt.description}${ANSI.reset}\n`);
        }
      });

      // Print hint with trailing newline for correct cursor positioning
      process.stdout.write(ANSI.clearLine + ANSI.cursorToStart);
      process.stdout.write(`${ANSI.gray}  [1-${options.length}] select, [Enter] confirm${ANSI.reset}\n`);
    };

    // Initial render
    process.stdout.write(`${ANSI.bright}${ANSI.cyan}? ${question.question}${ANSI.reset}\n`);
    if (question.description) {
      process.stdout.write(`${ANSI.gray}  ${question.description}${ANSI.reset}\n`);
    }
    options.forEach((opt: any, index: number) => {
      const num = index + 1;
      const isSelected = index === selectedIndex;
      if (isSelected) {
        process.stdout.write(`${ANSI.green}> ${num}) ${ANSI.bright}${opt.label}${ANSI.reset} ${ANSI.dim}- ${opt.description}${ANSI.reset}\n`);
      } else {
        process.stdout.write(`${ANSI.gray}  ${num}) ${ANSI.reset}${opt.label} ${ANSI.dim}- ${opt.description}${ANSI.reset}\n`);
      }
    });
    process.stdout.write(`${ANSI.gray}  [1-${options.length}] select, [Enter] confirm${ANSI.reset}\n`);

    const onKeypress = (key: Buffer) => {
      const char = key.toString();

      // Ctrl+C to exit
      if (char === '\x03') {
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        console.log('\n');
        process.exit(0);
      }

      // Number keys
      const num = parseInt(char, 10);
      if (!isNaN(num) && num >= 1 && num <= options.length) {
        selectedIndex = num - 1;
        renderOptions();
        return;
      }

      // Enter key - confirm selection
      if (char === '\r' || char === '\n') {
        process.stdin.removeListener('data', onKeypress);
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        process.stdin.pause();

        // Move up to start of question, clear everything below, print compact answer
        process.stdout.write(ANSI.cursorUp(totalLines) + ANSI.cursorToStart);
        process.stdout.write(ANSI.clearToEnd); // Clear all old content below

        const selected = options[selectedIndex];
        process.stdout.write(`${ANSI.green}? ${question.question} ${ANSI.bright}${selected.label}${ANSI.reset}\n`);

        resolve(selected.value);
        return;
      }

      // Arrow keys
      if (char === '\x1b[A') { // Up
        selectedIndex = (selectedIndex - 1 + options.length) % options.length;
        renderOptions();
      } else if (char === '\x1b[B') { // Down
        selectedIndex = (selectedIndex + 1) % options.length;
        renderOptions();
      }
    };

    process.stdin.on('data', onKeypress);
  });
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
    const questionnaire = loadQuestionnaire();
    const answers: any = {};

    for (const question of questionnaire.questions) {
      if (question.type === 'multiple_choice') {
        answers[question.id] = await singleNumberPrompt(question);
      } else if (question.type === 'multiple_choice_multiple') {
        // Use inquirer for multi-select
        const prompt = {
          name: question.id,
          type: 'checkbox',
          message: question.question,
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
        const result = await inquirer.prompt([prompt]);
        answers[question.id] = result[question.id];
      }
    }

    // Validate
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
    console.log(`Generated in ${endTime - startTime}ms`);

    displayWorkoutSummary(workout);

    console.log('\nFull workout details:\n');
    console.log(formatWorkoutForTerminal(workout));

    // Ask if user wants to edit
    const { editChoice } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'editChoice',
        message: 'Would you like to edit this workout interactively? (vim-like interface)',
        default: false,
      },
    ]);

    let finalWorkout = workout;

    if (editChoice) {
      console.log('\nLaunching interactive editor in separate process...');
      console.log('Tip: Press ? for help once inside the editor\n');

      const tempFile = join(process.cwd(), `.workout-temp-${Date.now()}.json`);
      writeFileSync(tempFile, JSON.stringify(workout, null, 2), 'utf-8');

      await new Promise(resolve => setTimeout(resolve, 1500));

      const editorProcess = spawn('npx', ['tsx', 'cli/edit-workout.ts', tempFile], {
        stdio: 'inherit',
        cwd: process.cwd()
      });

      await new Promise<void>((resolve) => {
        editorProcess.on('close', (code) => {
          console.log(`\nEditor exited with code ${code}`);
          resolve();
        });
      });

      try {
        const modifiedContent = readFileSync(tempFile, 'utf-8');
        finalWorkout = JSON.parse(modifiedContent);
        console.log('Loaded modified workout from editor');
      } catch (error) {
        console.log('Could not load modified workout, using original');
        finalWorkout = workout;
      }

      try {
        const fs = await import('fs/promises');
        await fs.unlink(tempFile);
      } catch (e) {
        // Ignore cleanup errors
      }
    }

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
      writeFileSync(filepath, JSON.stringify(finalWorkout, null, 2), 'utf-8');
      console.log(`Workout saved to: ${filepath}`);
    }

    console.log('\nThank you for using Shredly!');

  } catch (error) {
    console.error('An error occurred:', error);
    process.exit(1);
  }
}

main();
