/**
 * Phase 1: Structural Generation - Split Assignment
 *
 * Determines training split and assigns day focus for each training day
 * All logic is 100% config-driven from workout_generation_rules.json
 */

import type {
  QuestionnaireAnswers,
  GenerationRules,
  SplitPatterns,
  ExerciseStructure
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

  // Otherwise, assign default split based on training frequency from config
  const frequencyKey = training_frequency; // Already a string like "2", "3", etc.
  const defaultSplit = rules.default_split_by_frequency[frequencyKey];

  if (!defaultSplit || defaultSplit === 'description') {
    throw new Error(
      `No default split configured for frequency: ${frequencyKey}. ` +
      `Check workout_generation_rules.json default_split_by_frequency section.`
    );
  }

  return defaultSplit;
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

/**
 * Assigns progression scheme based on user preference or goal-based default
 *
 * @param answers - User's questionnaire answers
 * @param exerciseCategory - Exercise category (strength, mobility, etc.)
 * @returns Progression scheme type
 */
export function assignProgressionScheme(
  answers: QuestionnaireAnswers,
  exerciseCategory: string
): "linear" | "density" | "wave_loading" | "volume" | "static" {
  const { progression_preference, primary_goal, experience_level } = answers;

  // If user has explicit preference (and it's not "no_preference"), validate and use it
  if (progression_preference && progression_preference !== 'no_preference') {
    return progression_preference as "linear" | "density" | "wave_loading" | "volume";
  }

  // Otherwise, assign based on goal and category
  // Future enhancement: Move to workout_generation_rules.json as default_progression_by_goal

  // For mobility and flexibility exercises, always use static (no progression)
  if (exerciseCategory === 'mobility' || exerciseCategory === 'flexibility' || exerciseCategory === 'cardio') {
    return 'static';
  }

  // For metabolic categories (emom, amrap, circuit, interval), use density
  if (['emom', 'amrap', 'circuit', 'interval'].includes(exerciseCategory)) {
    return 'density';
  }

  // For strength and bodyweight, use goal-based defaults
  const goalProgressionMap: { [key: string]: "linear" | "volume" | "wave_loading" } = {
    muscle_gain: 'linear',
    fat_loss: 'volume', // Fat loss uses volume for strength, density for metabolic
    athletic_performance: 'wave_loading',
    general_fitness: 'volume',
    rehabilitation: 'volume',
    body_recomposition: 'linear'
  };

  return goalProgressionMap[primary_goal] || 'linear';
}

/**
 * Assigns intensity profile based on layer
 *
 * @param layer - Layer name (first, primary, secondary, etc.)
 * @param exerciseCategory - Exercise category
 * @returns Intensity profile
 */
export function assignIntensityProfile(
  layer: string,
  exerciseCategory: string
): "light" | "moderate" | "moderate_heavy" | "heavy" | "max" | "tabata" | "liss" | "hiit" | "amrap" | "extended" {
  // Future enhancement: Move to workout_generation_rules.json as intensity_profile_by_layer

  // For certain categories, use category-specific profiles
  if (exerciseCategory === 'cardio') {
    return layer === 'finisher' ? 'hiit' : 'liss';
  }

  if (exerciseCategory === 'interval') {
    if (layer === 'finisher') return 'tabata';
    if (layer === 'tertiary') return 'heavy';
    return 'moderate';
  }

  if (exerciseCategory === 'mobility' || exerciseCategory === 'flexibility') {
    return layer === 'last' ? 'extended' : 'light';
  }

  if (['emom', 'amrap', 'circuit'].includes(exerciseCategory)) {
    return layer === 'finisher' ? 'heavy' : 'moderate';
  }

  // For strength and bodyweight, use layer-based mapping
  const layerIntensityMap: { [key: string]: "light" | "moderate" | "moderate_heavy" | "heavy" | "max" } = {
    first: 'light',
    primary: 'heavy',
    secondary: 'moderate',
    tertiary: 'moderate',
    finisher: 'heavy',
    last: 'light'
  };

  return layerIntensityMap[layer] || 'moderate';
}

/**
 * Applies progression scheme and intensity profile to exercises
 *
 * @param exercises - Array of exercise structures (with names only)
 * @param answers - User's questionnaire answers
 * @param layers - Map of exercise index to layer name
 * @param exerciseCategories - Map of exercise name to category
 * @returns Updated exercises with progression and intensity assigned
 */
export function applyProgressionAndIntensity(
  exercises: ExerciseStructure[],
  answers: QuestionnaireAnswers,
  layers: Map<number, string>,
  exerciseCategories: Map<string, string>
): ExerciseStructure[] {
  return exercises.map((exercise, index) => {
    const layer = layers.get(index) || 'primary';
    const category = exerciseCategories.get(exercise.name) || 'strength';

    return {
      ...exercise,
      progressionScheme: assignProgressionScheme(answers, category),
      intensityProfile: assignIntensityProfile(layer, category)
    };
  });
}
