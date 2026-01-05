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
  GenerationRules,
  ExerciseDatabase,
  ParameterizedWorkout,
  DayStructure,
  ExerciseStructure
} from './types.js';
import {
  assignSplit,
  getDayFocusArray,
  generateDayStructure
} from './phase1-structure.js';
import {
  flattenExerciseDatabase,
  createExercisePoolsForDay,
  roundRobinSelectExercises
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
 * @param answers - User's questionnaire answers
 * @returns Complete parameterized workout program
 */
export function generateWorkout(answers: QuestionnaireAnswers): ParameterizedWorkout {
  // Load configuration and data
  const rules = loadGenerationRules();
  const exerciseDB = loadExerciseDatabase();
  const allExercises = flattenExerciseDatabase(exerciseDB);

  // ===== PHASE 1: STRUCTURAL GENERATION =====

  // Step 1: Determine training split and day structure
  const split = assignSplit(answers, rules);
  const daysPerWeek = parseInt(answers.training_frequency);
  const focusArray = getDayFocusArray(split, daysPerWeek, rules.split_patterns);

  // Step 2: Determine program duration
  const totalWeeks = parseProgramDuration(answers.program_duration);

  // Step 3: Get duration constraints for session
  const durationConstraints = rules.duration_constraints[answers.session_duration];
  if (!durationConstraints) {
    throw new Error(`No duration constraints for session: ${answers.session_duration}`);
  }

  const maxDuration = durationConstraints.total_minutes_max;
  const includedLayers = durationConstraints.include_layers;

  // Step 4: For each day, select exercises
  const days: { [dayNumber: string]: DayStructure } = {};

  for (let dayNum = 1; dayNum <= daysPerWeek; dayNum++) {
    const focus = focusArray[dayNum - 1];

    // Create exercise pools for this day
    const pools = createExercisePoolsForDay(
      allExercises,
      focus,
      answers,
      rules,
      includedLayers
    );

    // Select exercises using round-robin
    const selectedExercises = roundRobinSelectExercises(
      pools,
      rules,
      answers,
      maxDuration,
      allExercises,
      focus
    );

    // Determine day type
    let dayType: "gym" | "home" | "outdoor";
    if (answers.equipment_access === 'commercial_gym') {
      dayType = 'gym';
    } else if (answers.equipment_access === 'bodyweight_only') {
      dayType = 'outdoor';
    } else {
      dayType = 'home';
    }

    days[`${dayNum}`] = {
      dayNumber: dayNum,
      type: dayType,
      focus: focus as "Push" | "Pull" | "Legs" | "Upper" | "Lower" | "Full Body" | "Mobility",
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

      return parameterizeExercise(exercise, category, totalWeeks, rules, answers, allExercises);
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
    id: generateWorkoutId(answers),
    name: generateWorkoutName(answers),
    description: generateWorkoutDescription(answers),
    version: "2.0.0",
    weeks: totalWeeks,
    daysPerWeek: daysPerWeek,
    metadata: {
      difficulty: mapExperienceToDifficulty(answers.experience_level),
      equipment: [answers.equipment_access],
      estimatedDuration: answers.session_duration,
      tags: generateTags(answers)
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
function generateWorkoutId(answers: QuestionnaireAnswers): string {
  const timestamp = Date.now();
  const goal = answers.primary_goal.substring(0, 4);
  const exp = answers.experience_level.substring(0, 3);
  return `workout_${goal}_${exp}_${timestamp}`;
}

/**
 * Helper: Generate workout name
 */
function generateWorkoutName(answers: QuestionnaireAnswers): string {
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

  return `${goalNames[answers.primary_goal]} ${expNames[answers.experience_level]} Program`;
}

/**
 * Helper: Generate workout description
 */
function generateWorkoutDescription(answers: QuestionnaireAnswers): string {
  const days = answers.training_frequency;
  const duration = answers.session_duration;
  const goal = answers.primary_goal.replace(/_/g, ' ');

  return `${days} days per week workout program focused on ${goal}. Each session is ${duration} minutes.`;
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
function generateTags(answers: QuestionnaireAnswers): string[] {
  const tags: string[] = [];

  tags.push(answers.primary_goal);
  tags.push(answers.experience_level);
  tags.push(`${answers.training_frequency}_days_week`);
  tags.push(answers.equipment_access);

  if (answers.cardio_preference && answers.cardio_preference !== 'none') {
    tags.push(answers.cardio_preference);
  }

  if (answers.specific_focus_areas) {
    tags.push(...answers.specific_focus_areas);
  }

  return tags;
}
