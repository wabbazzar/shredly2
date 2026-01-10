/**
 * Main Workout Generation Orchestrator
 *
 * Coordinates Phase 1 (Structural Generation) and Phase 2 (Parameterization)
 * to transform questionnaire answers into complete workout programs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type {
  QuestionnaireAnswers,
  LegacyQuestionnaireAnswers,
  GenerationRules,
  ExerciseDatabase,
  ParameterizedWorkout,
  DayStructure,
  ExerciseStructure,
  DayFocus
} from './types.js';
import { mapToLegacyAnswers } from './types.js';
import { getPrescriptiveSplit } from './phase1-structure.js';
import {
  flattenExerciseDatabase,
  selectExercisesForDay
} from './exercise-selector.js';
import { parameterizeExercise } from './phase2-parameters.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Loads generation rules from JSON file
 */
function loadGenerationRules(): GenerationRules {
  const rulesPath = join(__dirname, '../../data/workout_generation_rules.json');
  const rulesContent = readFileSync(rulesPath, 'utf-8');
  return JSON.parse(rulesContent) as GenerationRules;
}

/**
 * Loads exercise database from JSON file
 */
function loadExerciseDatabase(): ExerciseDatabase {
  const dbPath = join(__dirname, '../../data/exercise_database.json');
  const dbContent = readFileSync(dbPath, 'utf-8');
  return JSON.parse(dbContent) as ExerciseDatabase;
}

/**
 * Main entry point: Generates complete workout program from questionnaire
 *
 * @param answers - User's questionnaire answers (new v2.0 format)
 * @param seed - Optional seed for deterministic testing. If provided, same seed = same workout. If omitted, randomness varies each generation.
 * @returns Complete parameterized workout program
 */
export function generateWorkout(
  answers: QuestionnaireAnswers,
  seed?: number
): ParameterizedWorkout {
  // Map new answers to legacy format for backward compatibility
  // This will be removed when Phases 2-5 are complete
  const legacyAnswers = mapToLegacyAnswers(answers);

  // Load configuration and data
  const rules = loadGenerationRules();
  const exerciseDB = loadExerciseDatabase();
  const allExercises = flattenExerciseDatabase(exerciseDB);

  // ===== PHASE 1: STRUCTURAL GENERATION =====

  // Step 1: Determine training split and day structure using new prescriptive logic
  const daysPerWeek = parseInt(answers.training_frequency);
  const focusArray = getPrescriptiveSplit(answers.goal, daysPerWeek, rules);

  // Step 2: Determine program duration
  const totalWeeks = parseProgramDuration(legacyAnswers.program_duration);

  // Step 3: Get session duration in minutes
  const duration = parseInt(answers.session_duration);

  // Step 4: For each day, select exercises using block-based selection
  const days: { [dayNumber: string]: DayStructure } = {};

  for (let dayNum = 1; dayNum <= daysPerWeek; dayNum++) {
    const focus = focusArray[dayNum - 1];

    // Select exercises using new block-based selection
    // Pass goal directly for new progression derivation (Phase 4)
    const selectedExercises = selectExercisesForDay(
      focus,
      allExercises,
      legacyAnswers,
      rules,
      duration,
      seed,
      answers.goal
    );

    // Determine day type
    let dayType: "gym" | "home" | "outdoor";
    if (legacyAnswers.equipment_access === 'commercial_gym') {
      dayType = 'gym';
    } else if (legacyAnswers.equipment_access === 'bodyweight_only') {
      dayType = 'outdoor';
    } else {
      dayType = 'home';
    }

    days[`${dayNum}`] = {
      dayNumber: dayNum,
      type: dayType,
      focus: focus as DayFocus,
      exercises: selectedExercises
    };
  }

  // ===== PHASE 2: PARAMETERIZATION =====

  // For each day, parameterize all exercises
  const parameterizedDays: { [dayNumber: string]: any } = {};

  for (const dayKey in days) {
    const day = days[dayKey];

    const parameterizedExercises = day.exercises.map((exercise: ExerciseStructure) => {
      // Get exercise category
      let category: string;

      if (exercise.category) {
        // Compound exercise - category is already set
        category = exercise.category;
      } else {
        // Individual exercise - look up in database
        const exerciseData = allExercises.find(([name, _]) => name === exercise.name);
        if (!exerciseData) {
          throw new Error(`Exercise not found in database: ${exercise.name}`);
        }
        const [_, exerciseInfo] = exerciseData;
        category = exerciseInfo.category;
      }

      return parameterizeExercise(exercise, category, totalWeeks, rules, legacyAnswers, allExercises);
    });

    parameterizedDays[dayKey] = {
      dayNumber: day.dayNumber,
      type: day.type,
      focus: day.focus,
      exercises: parameterizedExercises
    };
  }

  // ===== BUILD FINAL WORKOUT =====

  const workout: ParameterizedWorkout = {
    id: generateWorkoutId(answers, legacyAnswers),
    name: generateWorkoutName(legacyAnswers),
    description: generateWorkoutDescription(answers, legacyAnswers),
    version: "2.0.0",
    weeks: totalWeeks,
    daysPerWeek: daysPerWeek,
    metadata: {
      difficulty: mapExperienceToDifficulty(legacyAnswers.experience_level),
      equipment: [legacyAnswers.equipment_access],
      estimatedDuration: legacyAnswers.session_duration,
      tags: generateTags(answers, legacyAnswers)
    },
    days: parameterizedDays
  };

  return workout;
}

/**
 * Helper: Parse program duration to number of weeks
 */
function parseProgramDuration(duration?: string): number {
  if (!duration || duration === 'ongoing') {
    return 12; // Default to 12 weeks
  }

  const mapping: { [key: string]: number } = {
    '3_weeks': 3,
    '4_weeks': 4,
    '6_weeks': 6,
    '8_weeks': 8,
    '12_weeks': 12,
    '16_weeks': 16
  };

  return mapping[duration] || 8; // Default to 8 weeks
}

/**
 * Helper: Generate unique workout ID
 */
function generateWorkoutId(answers: QuestionnaireAnswers, legacyAnswers: LegacyQuestionnaireAnswers): string {
  const timestamp = Date.now();
  const goal = answers.goal.substring(0, 4);
  const exp = answers.experience_level.substring(0, 3);
  return `workout_${goal}_${exp}_${timestamp}`;
}

/**
 * Helper: Generate workout name
 */
function generateWorkoutName(legacyAnswers: LegacyQuestionnaireAnswers): string {
  const goalNames: { [key: string]: string } = {
    muscle_gain: 'Muscle Building',
    fat_loss: 'Fat Loss',
    athletic_performance: 'Athletic Performance',
    general_fitness: 'General Fitness',
    rehabilitation: 'Rehabilitation',
    body_recomposition: 'Body Recomposition'
  };

  const expNames: { [key: string]: string } = {
    complete_beginner: 'Beginner',
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
    expert: 'Expert'
  };

  return `${goalNames[legacyAnswers.primary_goal]} ${expNames[legacyAnswers.experience_level]} Program`;
}

/**
 * Helper: Generate workout description
 */
function generateWorkoutDescription(answers: QuestionnaireAnswers, legacyAnswers: LegacyQuestionnaireAnswers): string {
  const days = answers.training_frequency;
  const duration = answers.session_duration;
  const goalNames: { [key: string]: string } = {
    build_muscle: 'building muscle',
    tone: 'toning and fitness',
    lose_weight: 'losing weight'
  };

  return `${days} days per week workout program focused on ${goalNames[answers.goal]}. Each session is ${duration} minutes.`;
}

/**
 * Helper: Map experience level to difficulty
 */
function mapExperienceToDifficulty(
  experience: string
): "Beginner" | "Intermediate" | "Advanced" | "Expert" {
  const mapping: { [key: string]: "Beginner" | "Intermediate" | "Advanced" | "Expert" } = {
    complete_beginner: "Beginner",
    beginner: "Beginner",
    intermediate: "Intermediate",
    advanced: "Advanced",
    expert: "Expert"
  };

  return mapping[experience] || "Intermediate";
}

/**
 * Helper: Generate tags for the workout
 */
function generateTags(answers: QuestionnaireAnswers, legacyAnswers: LegacyQuestionnaireAnswers): string[] {
  const tags: string[] = [];

  tags.push(answers.goal);
  tags.push(answers.experience_level);
  tags.push(`${answers.training_frequency}_days_week`);
  tags.push(answers.equipment_access);

  return tags;
}
