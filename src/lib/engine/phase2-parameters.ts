/**
 * Phase 2: Parameterization - Week-by-Week Parameter Calculation
 *
 * Transforms structural workout (exercise names + schemes) into concrete workout
 * with explicit week-by-week sets, reps, weight, rest for every exercise
 *
 * All parameters are 100% config-driven from workout_generation_rules.json
 */

import type {
  ExerciseStructure,
  ParameterizedExercise,
  WeekParameters,
  WeightSpecification,
  GenerationRules,
  QuestionnaireAnswers
} from './types.js';

/**
 * Round time values to nearest 0.5 minutes for better UX
 * Only applies to values > 1 minute (e.g., 5.2 -> 5.0, 4.7 -> 4.5, 3.3 -> 3.5)
 * Values <= 1 minute are left as-is (e.g., 0.5, 0.75, 0.083 stay exact)
 */
function roundToHalfMinute(minutes: number): number {
  if (minutes > 1) {
    return Math.round(minutes * 2) / 2;
  }
  return minutes;
}

/**
 * Round time values to whole minutes for compound exercise volume progression
 * Uses Math.round for unbiased rounding (8.4 -> 8, 8.5 -> 9, 8.6 -> 9)
 * This ensures EMOM/AMRAP progressions have whole, even minute deltas
 */
function roundToWholeMinutes(minutes: number): number {
  return Math.round(minutes);
}

/**
 * Applies intensity profile to get Week 1 baseline parameters
 *
 * @param exercise - Exercise structure with name, progression, intensity
 * @param exerciseCategory - Category from exercise database
 * @param rules - Generation rules configuration
 * @param answers - User's questionnaire answers
 * @param isSubExercise - Whether this is a sub-exercise in a compound block
 * @param exerciseExternalLoad - External load type from exercise database ("never", "sometimes", "always")
 * @returns Week 1 baseline parameters
 */
export function applyIntensityProfile(
  exercise: ExerciseStructure,
  exerciseCategory: string,
  rules: GenerationRules,
  answers: QuestionnaireAnswers,
  isSubExercise: boolean = false,
  exerciseExternalLoad?: string
): WeekParameters {
  const { intensityProfile } = exercise;

  // Get the intensity profile configuration
  const categoryProfiles = rules.intensity_profiles[exerciseCategory];
  if (!categoryProfiles) {
    throw new Error(`No intensity profiles found for category: ${exerciseCategory}`);
  }

  const profile = categoryProfiles[intensityProfile];
  if (!profile) {
    throw new Error(`No "${intensityProfile}" profile for category: ${exerciseCategory}`);
  }

  // Get experience modifiers
  const experienceModifier = rules.experience_modifiers[answers.experience_level];
  if (!experienceModifier) {
    throw new Error(`No experience modifiers for level: ${answers.experience_level}`);
  }

  // Build Week 1 parameters based on profile and experience modifiers
  const week1: WeekParameters = {};

  // Sub-exercises in compound blocks should NOT have sets or rest_time (those belong to parent)
  // They only have reps and work_time for density progression

  // Apply sets (with volume multiplier) - SKIP for sub-exercises
  if (!isSubExercise && profile.base_sets !== undefined) {
    week1.sets = Math.round(profile.base_sets * experienceModifier.volume_multiplier);
  }

  // Apply reps (with volume multiplier if numeric)
  if (profile.base_reps !== undefined) {
    if (typeof profile.base_reps === 'number') {
      week1.reps = Math.round(profile.base_reps * experienceModifier.volume_multiplier);
    } else {
      week1.reps = profile.base_reps; // Keep string formats like "AMRAP", "8-12"
    }
  }

  // Apply work time
  if (profile.base_work_time_minutes !== undefined) {
    week1.work_time_minutes = profile.base_work_time_minutes;
    // Add explicit time unit if available
    if (profile.base_work_time_unit) {
      week1.work_time_unit = profile.base_work_time_unit;
    }
  }

  // Apply rest time (with rest time multiplier) - SKIP for sub-exercises
  if (!isSubExercise && profile.base_rest_time_minutes !== undefined) {
    const calculatedRest = profile.base_rest_time_minutes * experienceModifier.rest_time_multiplier;
    week1.rest_time_minutes = roundToHalfMinute(calculatedRest);
    // Add explicit time unit if available
    if (profile.base_rest_time_unit) {
      week1.rest_time_unit = profile.base_rest_time_unit;
    }
  }

  // Apply weight specification
  // CRITICAL: Never assign weight to exercises with external_load: "never" (e.g., Burpees)
  const shouldAssignWeight = exerciseExternalLoad !== 'never';

  if (shouldAssignWeight) {
    if (experienceModifier.weight_type === 'descriptor') {
      if (profile.base_weight_descriptor) {
        week1.weight = profile.base_weight_descriptor;
      }
    } else if (experienceModifier.weight_type === 'percent_tm') {
      if (profile.base_weight_percent_tm !== undefined) {
        week1.weight = {
          type: 'percent_tm',
          value: profile.base_weight_percent_tm
        };
      }
    }
  }

  // Note: Tempo is optional and not included in base profiles for MVP
  // Note: set_blocks are for advanced users only (not in MVP)

  return week1;
}

/**
 * Applies progression scheme to calculate parameters for Week N
 *
 * @param week1 - Week 1 baseline parameters
 * @param progressionScheme - Progression scheme type
 * @param weekNumber - Current week number (2, 3, 4, etc.)
 * @param totalWeeks - Total program weeks
 * @param rules - Generation rules configuration
 * @param exerciseCategory - Optional category for compound exercise detection
 * @param subExerciseCount - Optional count of sub-exercises (for compound volume progression)
 * @returns Parameters for the specified week
 */
export function applyProgressionScheme(
  week1: WeekParameters,
  progressionScheme: "linear" | "density" | "wave_loading" | "volume" | "static",
  weekNumber: number,
  totalWeeks: number,
  rules: GenerationRules,
  exerciseCategory?: string,
  subExerciseCount?: number
): WeekParameters {
  // Get progression rules
  const scheme = rules.progression_schemes[progressionScheme];
  if (!scheme) {
    throw new Error(`No progression scheme found: ${progressionScheme}`);
  }

  const { rules: progressionRules } = scheme;

  // Start with week1 as base
  const weekN: WeekParameters = { ...week1 };

  // Apply progression based on scheme type
  switch (progressionScheme) {
    case 'linear':
      return applyLinearProgression(weekN, week1, weekNumber, progressionRules);

    case 'density':
      return applyDensityProgression(weekN, week1, weekNumber, totalWeeks, progressionRules, exerciseCategory);

    case 'wave_loading':
      return applyWaveLoading(weekN, week1, weekNumber, totalWeeks, progressionRules);

    case 'volume':
      return applyVolumeProgression(weekN, week1, weekNumber, totalWeeks, progressionRules, exerciseCategory, subExerciseCount);

    case 'static':
      // No changes - return week1 as-is
      return weekN;

    default:
      throw new Error(`Unknown progression scheme: ${progressionScheme}`);
  }
}

/**
 * Applies linear progression (increase weight, decrease reps, decrease rest)
 */
function applyLinearProgression(
  weekN: WeekParameters,
  week1: WeekParameters,
  weekNumber: number,
  rules: any
): WeekParameters {
  const weeksDelta = weekNumber - 1; // How many weeks from baseline

  // Decrease reps
  if (weekN.reps !== undefined && typeof weekN.reps === 'number') {
    const repsDelta = rules.reps_delta_per_week || -1;
    weekN.reps = Math.max(
      week1.reps as number + (repsDelta * weeksDelta),
      rules.reps_minimum || 3
    );
  }

  // Increase weight
  if (weekN.weight !== undefined && typeof weekN.weight === 'object' && weekN.weight.type === 'percent_tm') {
    const weightDelta = rules.weight_percent_delta_per_week || 5;
    weekN.weight = {
      type: 'percent_tm',
      value: (week1.weight as any).value + (weightDelta * weeksDelta)
    };
  }

  // Decrease rest time
  if (weekN.rest_time_minutes !== undefined) {
    const restDelta = rules.rest_time_delta_per_week_minutes || -0.25;
    const calculatedRest = Math.max(
      week1.rest_time_minutes! + (restDelta * weeksDelta),
      rules.rest_time_minimum_minutes || 0.75
    );
    weekN.rest_time_minutes = roundToHalfMinute(calculatedRest);
    // Preserve time unit from week1
    if (week1.rest_time_unit) {
      weekN.rest_time_unit = week1.rest_time_unit;
    }
  }

  return weekN;
}

/**
 * Helper function to detect if exercise is a compound parent
 * Compound parents have a category field (emom, circuit, amrap, interval)
 *
 * @param exerciseCategory - Optional category from ExerciseStructure
 * @returns true if this is a compound exercise parent
 */
function isCompoundParent(exerciseCategory?: string): boolean {
  if (!exerciseCategory) return false;
  return ['emom', 'circuit', 'amrap', 'interval'].includes(exerciseCategory);
}

/**
 * Applies density progression (increase work time, increase reps, decrease rest)
 */
function applyDensityProgression(
  weekN: WeekParameters,
  week1: WeekParameters,
  weekNumber: number,
  totalWeeks: number,
  rules: any,
  exerciseCategory?: string
): WeekParameters {
  const weeksDelta = weekNumber - 1;

  // Increase work time (for EMOM, AMRAP, etc.)
  // CRITICAL: Compound parents should keep work_time STATIC for density progression
  // Density means "more work in same time", so time stays constant and reps increase
  if (weekN.work_time_minutes !== undefined) {
    const isCompound = isCompoundParent(exerciseCategory);

    if (isCompound) {
      // Compound parent: work_time stays STATIC (keep week1 value)
      // Density comes from sub-exercise reps increasing, not time extension
      weekN.work_time_minutes = week1.work_time_minutes;
      // Preserve time unit from week1
      if (week1.work_time_unit) {
        weekN.work_time_unit = week1.work_time_unit;
      }
    } else {
      // Regular exercise: work_time CAN increase (existing behavior)
      const totalIncrease = rules.work_time_increase_percent_total || 25;
      const increasePerWeek = (totalIncrease / 100) / (totalWeeks - 1);
      const calculatedTime = week1.work_time_minutes! * (1 + increasePerWeek * weeksDelta);
      // Round to half-minute increments for better UX
      weekN.work_time_minutes = roundToHalfMinute(calculatedTime);
      // Preserve time unit from week1
      if (week1.work_time_unit) {
        weekN.work_time_unit = week1.work_time_unit;
      }
    }
  }

  // Increase reps (for sub-exercises in EMOM, etc.)
  if (weekN.reps !== undefined && typeof weekN.reps === 'number') {
    const totalIncrease = rules.reps_increase_percent_total || 30;
    const increasePerWeek = (totalIncrease / 100) / (totalWeeks - 1);
    weekN.reps = Math.round(week1.reps as number * (1 + increasePerWeek * weeksDelta));
  }

  // Decrease rest time
  if (weekN.rest_time_minutes !== undefined) {
    const restDelta = rules.rest_time_delta_per_week_minutes || -0.083;
    const calculatedRest = Math.max(
      week1.rest_time_minutes! + (restDelta * weeksDelta),
      rules.rest_time_minimum_minutes || 0.167
    );
    weekN.rest_time_minutes = roundToHalfMinute(calculatedRest);
    // Preserve time unit from week1
    if (week1.rest_time_unit) {
      weekN.rest_time_unit = week1.rest_time_unit;
    }
  }

  return weekN;
}

/**
 * Applies wave loading (undulating intensity pattern)
 */
function applyWaveLoading(
  weekN: WeekParameters,
  week1: WeekParameters,
  weekNumber: number,
  totalWeeks: number,
  rules: any
): WeekParameters {
  // Get wave pattern for this program length
  const wavePatterns = rules.wave_patterns || {};
  const patternKey = `${totalWeeks}_weeks`;
  const pattern = wavePatterns[patternKey] || wavePatterns['3_weeks']; // Fallback

  if (!pattern) {
    // No wave pattern defined, fallback to linear
    return applyLinearProgression(weekN, week1, weekNumber, rules);
  }

  const weekIndex = weekNumber - 1;

  // Apply weight delta from pattern
  if (weekN.weight !== undefined && typeof weekN.weight === 'object' && weekN.weight.type === 'percent_tm') {
    const weightDelta = pattern.weight_percent_deltas[weekIndex] || 0;
    weekN.weight = {
      type: 'percent_tm',
      value: (week1.weight as any).value + weightDelta
    };
  }

  // Apply reps delta from pattern
  if (weekN.reps !== undefined && typeof weekN.reps === 'number') {
    const repsDelta = pattern.reps_deltas[weekIndex] || 0;
    weekN.reps = Math.max(week1.reps as number + repsDelta, 1);
  }

  return weekN;
}

/**
 * Applies volume progression (increase sets and reps, weight stays constant)
 * For compound exercises, increases work_time with whole-minute rounding
 */
function applyVolumeProgression(
  weekN: WeekParameters,
  week1: WeekParameters,
  weekNumber: number,
  totalWeeks: number,
  rules: any,
  exerciseCategory?: string,
  subExerciseCount?: number
): WeekParameters {
  const weeksDelta = weekNumber - 1;

  // Handle compound block volume progression FIRST
  if (isCompoundParent(exerciseCategory)) {
    if (weekN.work_time_minutes !== undefined) {
      const baseWorkTime = week1.work_time_minutes!;

      // Determine time increase per week based on compound type
      let timeIncreasePerWeek = 0;

      if (exerciseCategory === 'emom') {
        // EMOM: increase by (1 minute * sub_exercise_count) per week
        const subCount = subExerciseCount || rules.compound_emom_default_sub_count || 2;
        timeIncreasePerWeek = (rules.compound_emom_time_increase_per_sub_per_week || 1) * subCount;
      } else if (exerciseCategory === 'amrap') {
        // AMRAP: increase by 1 minute per week
        timeIncreasePerWeek = rules.compound_amrap_time_increase_per_week || 1;
      } else if (exerciseCategory === 'circuit' || exerciseCategory === 'interval') {
        // Circuit/Interval: optionally increase time OR increase sets (based on config)
        const shouldIncreaseTime = rules.compound_circuit_increase_time !== false;
        if (shouldIncreaseTime) {
          timeIncreasePerWeek = rules.compound_circuit_time_increase_per_week || 1;
        }
        // If not increasing time, sets will increase via existing logic below
      }

      // Calculate new work_time with whole-minute rounding
      const calculatedTime = baseWorkTime + (timeIncreasePerWeek * weeksDelta);
      weekN.work_time_minutes = roundToWholeMinutes(calculatedTime);

      // Preserve time unit from week1
      if (week1.work_time_unit) {
        weekN.work_time_unit = week1.work_time_unit;
      }
    }

    // For compound blocks, reps can also increase if configured
    if (weekN.reps !== undefined && typeof weekN.reps === 'number' && rules.compound_reps_increase_enabled) {
      const totalIncrease = rules.reps_increase_percent_total || 20;
      const increasePerWeek = (totalIncrease / 100) / (totalWeeks - 1);
      weekN.reps = Math.round(week1.reps as number * (1 + increasePerWeek * weeksDelta));
    }

    // Return early for compound blocks (don't apply regular set increases)
    return weekN;
  }

  // Regular (non-compound) exercise volume progression

  // Increase sets every N weeks
  if (weekN.sets !== undefined) {
    const setsIncreaseInterval = rules.sets_increase_every_n_weeks || 2;
    const setsToAdd = Math.floor(weeksDelta / setsIncreaseInterval);
    weekN.sets = Math.min(
      week1.sets! + setsToAdd,
      rules.sets_maximum || 6
    );
  }

  // Increase reps gradually
  if (weekN.reps !== undefined && typeof weekN.reps === 'number') {
    const totalIncrease = rules.reps_increase_percent_total || 20;
    const increasePerWeek = (totalIncrease / 100) / (totalWeeks - 1);
    weekN.reps = Math.round(week1.reps as number * (1 + increasePerWeek * weeksDelta));
  }

  // Weight stays constant (delta = 0)
  // weekN.weight already copied from week1

  return weekN;
}

/**
 * Generates complete parameterized exercise with all weeks
 *
 * @param exercise - Exercise structure from Phase 1
 * @param exerciseCategory - Category from exercise database
 * @param totalWeeks - Total program duration
 * @param rules - Generation rules
 * @param answers - User answers
 * @param allExercises - Flattened exercise database (for sub-exercise lookup)
 * @param isSubExercise - Whether this is a sub-exercise in a compound block
 * @returns Parameterized exercise with week1, week2, ..., weekN
 */
export function parameterizeExercise(
  exercise: ExerciseStructure,
  exerciseCategory: string,
  totalWeeks: number,
  rules: GenerationRules,
  answers: QuestionnaireAnswers,
  allExercises?: Array<[string, any]>,
  isSubExercise: boolean = false
): ParameterizedExercise {
  // Look up exercise external_load to determine if weight should be assigned
  let exerciseExternalLoad: string | undefined;
  if (allExercises && !exercise.category) { // Only for individual exercises (not compounds)
    const exerciseData = allExercises.find(([name, _]) => name === exercise.name);
    if (exerciseData) {
      exerciseExternalLoad = exerciseData[1].external_load;
    }
  }

  // Get Week 1 baseline
  const week1 = applyIntensityProfile(exercise, exerciseCategory, rules, answers, isSubExercise, exerciseExternalLoad);

  // Calculate sub-exercise count for compound volume progression
  const subExerciseCount = exercise.sub_exercises ? exercise.sub_exercises.length : undefined;

  // Calculate Week 2 and Week 3 (always required)
  // Pass exercise.category to enable compound parent detection for density/volume progression
  // Pass subExerciseCount for EMOM volume progression calculations
  const week2 = applyProgressionScheme(week1, exercise.progressionScheme, 2, totalWeeks, rules, exercise.category, subExerciseCount);
  const week3 = applyProgressionScheme(week1, exercise.progressionScheme, 3, totalWeeks, rules, exercise.category, subExerciseCount);

  // Build parameterized exercise with required weeks
  const parameterized: ParameterizedExercise = {
    name: exercise.name,
    week1,
    week2,
    week3
  };

  // Calculate parameters for remaining weeks (if any)
  for (let weekNum = 4; weekNum <= totalWeeks; weekNum++) {
    const weekKey = `week${weekNum}` as keyof ParameterizedExercise;
    const weekParams = applyProgressionScheme(
      week1,
      exercise.progressionScheme,
      weekNum,
      totalWeeks,
      rules,
      exercise.category,
      subExerciseCount
    );

    // TypeScript requires explicit assignment due to dynamic keys
    (parameterized as any)[weekKey] = weekParams;
  }

  // Copy category override if exists
  if (exercise.category) {
    parameterized.category = exercise.category;
  }

  // Handle sub_exercises for compound exercises (EMOM, Circuit, AMRAP, Interval)
  if (exercise.sub_exercises && exercise.sub_exercises.length > 0 && allExercises) {
    parameterized.sub_exercises = exercise.sub_exercises.map(subEx => {
      // Look up sub-exercise in database to get its category
      const subExData = allExercises.find(([name, _]) => name === subEx.name);
      if (!subExData) {
        throw new Error(`Sub-exercise not found in database: ${subEx.name}`);
      }

      const [_, subExInfo] = subExData;
      const subCategory = subExInfo.category;

      // Create a temporary ExerciseStructure for the sub-exercise
      const subExerciseStructure: ExerciseStructure = {
        name: subEx.name,
        progressionScheme: subEx.progressionScheme,
        intensityProfile: exercise.intensityProfile // Inherit from parent
      };

      // Recursively parameterize the sub-exercise (passing isSubExercise=true)
      return parameterizeExercise(
        subExerciseStructure,
        subCategory,
        totalWeeks,
        rules,
        answers,
        allExercises,
        true // This is a sub-exercise
      );
    });
  }

  return parameterized;
}
