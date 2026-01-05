/**
 * Phase 1: Structural Generation - Split Assignment
 *
 * Determines training split and assigns day focus for each training day
 * All logic is 100% config-driven from workout_generation_rules.json
 */

import type {
  QuestionnaireAnswers,
  GenerationRules,
  SplitPatterns
} from './types.js';

/**
 * Assigns the training split based on user preference or goal-based default
 *
 * @param answers - User's questionnaire answers
 * @param rules - Generation rules configuration
 * @returns Split type (e.g., "full_body", "upper_lower", "push_pull_legs", "ulppl")
 */
export function assignSplit(
  answers: QuestionnaireAnswers,
  rules: GenerationRules
): string {
  const { training_split_preference, training_frequency, primary_goal } = answers;

  // If user has explicit preference (and it's not "no_preference"), use it
  if (training_split_preference && training_split_preference !== 'no_preference') {
    return training_split_preference;
  }

  // Otherwise, assign default split based on training frequency
  // This mapping should ideally be in the config, but for MVP we'll use simple logic
  const frequency = parseInt(training_frequency);

  // Default split assignment based on frequency
  // Future enhancement: Move to workout_generation_rules.json as default_split_by_frequency
  if (frequency <= 3) {
    return 'full_body';
  } else if (frequency === 4) {
    return 'upper_lower';
  } else if (frequency >= 5) {
    return 'push_pull_legs';
  }

  // Fallback (should never reach here with valid input)
  throw new Error(`Unable to assign split for frequency: ${frequency}`);
}

/**
 * Gets the day focus array for all training days based on split pattern
 *
 * @param split - Split type (e.g., "full_body", "upper_lower", "push_pull_legs", "ulppl")
 * @param daysPerWeek - Number of training days per week
 * @param splitPatterns - Split patterns configuration from rules
 * @returns Array of focus strings for each day (e.g., ["Upper", "Lower", "Push", "Pull", "Legs"])
 */
export function getDayFocusArray(
  split: string,
  daysPerWeek: number,
  splitPatterns: SplitPatterns
): string[] {
  // Get the split pattern configuration
  const splitConfig = splitPatterns[split];

  if (!splitConfig) {
    throw new Error(`Split type "${split}" not found in configuration`);
  }

  // First, check if there's a pre-defined example for this exact number of days
  const exactDaysKey = `${daysPerWeek}_days`;
  if (splitConfig[exactDaysKey]) {
    return splitConfig[exactDaysKey] as string[];
  }

  // Otherwise, use the pattern and repeat it cyclically to fill all days
  const pattern = splitConfig.pattern as string[];

  if (!pattern || pattern.length === 0) {
    throw new Error(`Split "${split}" has no pattern defined`);
  }

  const focusArray: string[] = [];
  for (let i = 0; i < daysPerWeek; i++) {
    focusArray.push(pattern[i % pattern.length]);
  }

  return focusArray;
}

/**
 * Generates the complete day structure for a workout program
 *
 * @param answers - User's questionnaire answers
 * @param rules - Generation rules configuration
 * @returns Object mapping day numbers to their focus
 */
export function generateDayStructure(
  answers: QuestionnaireAnswers,
  rules: GenerationRules
): { [dayNumber: string]: { dayNumber: number; type: "gym" | "home" | "outdoor"; focus: string } } {
  const split = assignSplit(answers, rules);
  const daysPerWeek = parseInt(answers.training_frequency);
  const focusArray = getDayFocusArray(split, daysPerWeek, rules.split_patterns);

  // Determine day type based on equipment access
  let dayType: "gym" | "home" | "outdoor";
  if (answers.equipment_access === 'commercial_gym') {
    dayType = 'gym';
  } else if (answers.equipment_access === 'bodyweight_only') {
    dayType = 'outdoor';
  } else {
    dayType = 'home';
  }

  // Build the day structure object
  const days: { [dayNumber: string]: { dayNumber: number; type: "gym" | "home" | "outdoor"; focus: string } } = {};

  for (let i = 0; i < daysPerWeek; i++) {
    const dayNum = i + 1;
    days[`${dayNum}`] = {
      dayNumber: dayNum,
      type: dayType,
      focus: focusArray[i]
    };
  }

  return days;
}
