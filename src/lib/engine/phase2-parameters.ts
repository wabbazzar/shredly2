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
  LegacyQuestionnaireAnswers,
  TimeUnit,
  ParsedTimeValue,
  SubWorkMode
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
 * Round time value based on unit
 * - Seconds: round to nearest 5 seconds
 * - Minutes: round to nearest 0.5 minutes (existing behavior)
 */
export function roundTimeValue(value: number, unit: TimeUnit): number {
  if (unit === 'seconds') {
    return Math.round(value / 5) * 5;
  }
  // minutes - use existing half-minute rounding
  return roundToHalfMinute(value);
}

/**
 * Parse time field from intensity profile using self-documenting field names
 * Looks for fields with _seconds or _minutes suffix and infers unit from name
 *
 * @param profile - Intensity profile object
 * @param fieldPrefix - Field prefix to search for (e.g., "rest_time", "work_time", "sub_work_time")
 * @returns ParsedTimeValue with value, unit, and display string, or null if not found
 */
export function parseTimeField(profile: Record<string, any>, fieldPrefix: string): ParsedTimeValue | null {
  // First check for _seconds suffix
  const secondsField = `${fieldPrefix}_seconds`;
  if (profile[secondsField] !== undefined) {
    const value = profile[secondsField];
    return {
      value,
      unit: 'seconds',
      displayValue: `${value} seconds`
    };
  }

  // Then check for _minutes suffix
  const minutesField = `${fieldPrefix}_minutes`;
  if (profile[minutesField] !== undefined) {
    const value = profile[minutesField];
    return {
      value,
      unit: 'minutes',
      displayValue: `${value} minutes`
    };
  }

  return null;
}

/**
 * Get value from profile with fallback to deprecated base_* field
 * Supports both new field names (sets, reps) and deprecated (base_sets, base_reps)
 */
function getProfileValue<T>(profile: Record<string, any>, fieldName: string, deprecatedFieldName?: string): T | undefined {
  if (profile[fieldName] !== undefined) {
    return profile[fieldName] as T;
  }
  if (deprecatedFieldName && profile[deprecatedFieldName] !== undefined) {
    return profile[deprecatedFieldName] as T;
  }
  return undefined;
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
 * @param parentCategory - Parent exercise category (for sub-exercises in compound blocks)
 * @param parentProfile - Parent's intensity profile (for interval sub-exercise time params)
 * @returns Week 1 baseline parameters
 */
export function applyIntensityProfile(
  exercise: ExerciseStructure,
  exerciseCategory: string,
  rules: GenerationRules,
  answers: LegacyQuestionnaireAnswers,
  isSubExercise: boolean = false,
  exerciseExternalLoad?: string,
  parentCategory?: string,
  parentProfile?: Record<string, any>
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

  // Check if parent uses sub_work_mode: "time" (interval behavior)
  const parentSubWorkMode = parentProfile?.sub_work_mode as SubWorkMode | undefined;
  const isIntervalSubExercise = isSubExercise && parentSubWorkMode === 'time';

  // Sub-exercises in compound blocks should NOT have sets (belongs to parent)
  // EXCEPTION: INTERVAL sub-exercises need work_time/rest_time (applied below)

  // Apply sets (with volume multiplier)
  // - For INTERVAL parents: sets = number of times through the block
  // - For other parents: sets = number of times to do the exercise
  // - For sub-exercises: SKIP (sets belong to parent)
  const setsValue = getProfileValue<number>(profile, 'sets', 'base_sets');
  if (!isSubExercise && setsValue !== undefined) {
    week1.sets = Math.round(setsValue * experienceModifier.volume_multiplier);
  }

  // Apply reps (with volume multiplier if numeric)
  // SKIP for interval sub-exercises (they use work_time, not reps)
  const repsValue = getProfileValue<number | string>(profile, 'reps', 'base_reps');
  if (!isIntervalSubExercise && repsValue !== undefined) {
    if (typeof repsValue === 'number') {
      week1.reps = Math.round(repsValue * experienceModifier.volume_multiplier);
    } else {
      week1.reps = repsValue; // Keep string formats like "AMRAP", "8-12"
    }
  }

  // Handle interval sub-exercises: get work_time/rest_time from parent profile
  if (isIntervalSubExercise && parentProfile) {
    // Get sub_work_time_seconds from parent's interval profile
    const subWorkTime = parseTimeField(parentProfile, 'sub_work_time');
    if (subWorkTime) {
      // Store as minutes for output format but preserve unit
      week1.work_time_minutes = subWorkTime.unit === 'seconds' ? subWorkTime.value / 60 : subWorkTime.value;
      week1.work_time_unit = subWorkTime.unit;
    }

    // Get sub_rest_time_seconds from parent's interval profile
    // NOTE: Do NOT apply experience modifier here - interval work/rest ratios
    // are part of the training protocol (e.g., 40/20 = 60 sec cycle).
    // Experience modifiers apply to rest BETWEEN sets, not within interval cycles.
    const subRestTime = parseTimeField(parentProfile, 'sub_rest_time');
    if (subRestTime) {
      const roundedRest = roundTimeValue(subRestTime.value, subRestTime.unit);
      week1.rest_time_minutes = subRestTime.unit === 'seconds' ? roundedRest / 60 : roundedRest;
      week1.rest_time_unit = subRestTime.unit;
    }
  } else {
    // Regular work time handling for non-interval-sub-exercises
    // EMOM/AMRAP parents: use block_time_minutes
    // Skip work_time for INTERVAL parents (they only have sets)
    const isIntervalParent = exerciseCategory === 'interval' && !isSubExercise;
    const shouldAddWorkTime = !isIntervalParent;

    if (shouldAddWorkTime) {
      // First try block_time_minutes (for EMOM/AMRAP)
      const blockTime = profile.block_time_minutes;
      if (blockTime !== undefined) {
        week1.work_time_minutes = blockTime;
        week1.work_time_unit = 'minutes';
      } else {
        // Try new work_time_* fields, then fall back to deprecated base_work_time_*
        const workTime = parseTimeField(profile, 'work_time');
        if (workTime) {
          week1.work_time_minutes = workTime.unit === 'seconds' ? workTime.value / 60 : workTime.value;
          week1.work_time_unit = workTime.unit;
        } else if (profile.base_work_time_minutes !== undefined) {
          // Fall back to deprecated format
          let workTimeMinutes = profile.base_work_time_minutes;
          if (profile.base_work_time_unit === 'seconds') {
            workTimeMinutes = workTimeMinutes / 60;
          }
          week1.work_time_minutes = workTimeMinutes;
          if (profile.base_work_time_unit) {
            week1.work_time_unit = profile.base_work_time_unit;
          }
        }
      }
    }

    // Apply rest time for non-interval-sub-exercises
    // INTERVAL PARENT: should NOT have rest_time (only sub-exercises get it)
    // Other PARENT: should have rest_time (rest between sets)
    // Other SUB-EXERCISE: should NOT have rest_time (EMOM/AMRAP subs don't get rest_time)
    const shouldAddRestTime = !isIntervalParent && !isSubExercise;

    if (shouldAddRestTime) {
      // Try new rest_time_* fields, then fall back to deprecated base_rest_time_*
      const restTime = parseTimeField(profile, 'rest_time');
      if (restTime) {
        const calculatedRest = restTime.value * experienceModifier.rest_time_multiplier;
        const roundedRest = roundTimeValue(calculatedRest, restTime.unit);
        week1.rest_time_minutes = restTime.unit === 'seconds' ? roundedRest / 60 : roundedRest;
        week1.rest_time_unit = restTime.unit;
      } else if (profile.base_rest_time_minutes !== undefined) {
        // Fall back to deprecated format
        let restTimeMinutes = profile.base_rest_time_minutes;
        if (profile.base_rest_time_unit === 'seconds') {
          restTimeMinutes = restTimeMinutes / 60;
        }
        const calculatedRest = restTimeMinutes * experienceModifier.rest_time_multiplier;
        week1.rest_time_minutes = roundToHalfMinute(calculatedRest);
        if (profile.base_rest_time_unit) {
          week1.rest_time_unit = profile.base_rest_time_unit;
        }
      }
    }
  }

  // Apply weight specification
  // CRITICAL: Never assign weight to exercises with external_load: "never" (e.g., Burpees)
  const shouldAssignWeight = exerciseExternalLoad !== 'never';

  if (shouldAssignWeight) {
    const weightDescriptor = getProfileValue<string>(profile, 'weight_descriptor', 'base_weight_descriptor');
    const weightPercentTm = getProfileValue<number>(profile, 'weight_percent_tm', 'base_weight_percent_tm');

    if (experienceModifier.weight_type === 'descriptor') {
      if (weightDescriptor) {
        week1.weight = weightDescriptor;
      }
    } else if (experienceModifier.weight_type === 'percent_tm') {
      if (weightPercentTm !== undefined) {
        week1.weight = {
          type: 'percent_tm',
          value: weightPercentTm
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
 * @param isIntervalSubExercise - Whether this is a sub-exercise in an interval block (sub_work_mode: "time")
 * @returns Parameters for the specified week
 */
export function applyProgressionScheme(
  week1: WeekParameters,
  progressionScheme: "linear" | "density" | "wave_loading" | "volume" | "static",
  weekNumber: number,
  totalWeeks: number,
  rules: GenerationRules,
  exerciseCategory?: string,
  subExerciseCount?: number,
  isIntervalSubExercise: boolean = false
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
      return applyDensityProgression(weekN, week1, weekNumber, totalWeeks, progressionRules, exerciseCategory, isIntervalSubExercise);

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
 * Special handling for interval sub-exercises: +5 sec work, -5 sec rest per week
 */
function applyDensityProgression(
  weekN: WeekParameters,
  week1: WeekParameters,
  weekNumber: number,
  totalWeeks: number,
  rules: any,
  exerciseCategory?: string,
  isIntervalSubExercise: boolean = false
): WeekParameters {
  const weeksDelta = weekNumber - 1;

  // Special handling for interval sub-exercises (sub_work_mode: "time")
  // Work time INCREASES by +5 sec/week, rest time DECREASES by -5 sec/week
  // Total always = 60 seconds (work + rest = 60s)
  if (isIntervalSubExercise) {
    // Get interval-specific deltas from rules
    const workDeltaSeconds = rules.interval_work_time_delta_per_week_seconds || 5;
    const restDeltaSeconds = rules.interval_rest_time_delta_per_week_seconds || -5;
    const restMinimumSeconds = rules.rest_time_minimum_seconds || 5;

    // Increase work time
    if (weekN.work_time_minutes !== undefined && week1.work_time_unit === 'seconds') {
      const week1Seconds = week1.work_time_minutes! * 60; // Convert from stored minutes
      const newSeconds = week1Seconds + (workDeltaSeconds * weeksDelta);
      const roundedSeconds = roundTimeValue(newSeconds, 'seconds');
      weekN.work_time_minutes = roundedSeconds / 60; // Store as minutes
      weekN.work_time_unit = 'seconds';
    }

    // Decrease rest time
    if (weekN.rest_time_minutes !== undefined && week1.rest_time_unit === 'seconds') {
      const week1Seconds = week1.rest_time_minutes! * 60; // Convert from stored minutes
      const newSeconds = Math.max(week1Seconds + (restDeltaSeconds * weeksDelta), restMinimumSeconds);
      const roundedSeconds = roundTimeValue(newSeconds, 'seconds');
      weekN.rest_time_minutes = roundedSeconds / 60; // Store as minutes
      weekN.rest_time_unit = 'seconds';
    }

    return weekN;
  }

  // Standard density progression for non-interval exercises
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

  // Decrease rest time (using unit-aware deltas)
  if (weekN.rest_time_minutes !== undefined) {
    const unit = week1.rest_time_unit || 'minutes';

    if (unit === 'seconds') {
      // Use seconds-based delta
      const restDeltaSeconds = rules.rest_time_delta_per_week_seconds || -5;
      const restMinimumSeconds = rules.rest_time_minimum_seconds || 5;
      const week1Seconds = week1.rest_time_minutes! * 60; // Convert from stored minutes
      const newSeconds = Math.max(week1Seconds + (restDeltaSeconds * weeksDelta), restMinimumSeconds);
      const roundedSeconds = roundTimeValue(newSeconds, 'seconds');
      weekN.rest_time_minutes = roundedSeconds / 60; // Store as minutes
      weekN.rest_time_unit = 'seconds';
    } else {
      // Use minutes-based delta
      const restDelta = rules.rest_time_delta_per_week_minutes || -0.25;
      const restMinimum = rules.rest_time_minimum_minutes || 1.5;
      const calculatedRest = Math.max(week1.rest_time_minutes! + (restDelta * weeksDelta), restMinimum);
      weekN.rest_time_minutes = roundToHalfMinute(calculatedRest);
      weekN.rest_time_unit = 'minutes';
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
 * Note: Compound exercises always use 'density' progression (hardcoded in constructCompoundExercise),
 * so this function only handles regular (non-compound) exercises.
 */
function applyVolumeProgression(
  weekN: WeekParameters,
  week1: WeekParameters,
  weekNumber: number,
  totalWeeks: number,
  rules: any,
  _exerciseCategory?: string,
  _subExerciseCount?: number
): WeekParameters {
  const weeksDelta = weekNumber - 1;

  // Regular (non-compound) exercise volume progression
  // Note: Compound exercises always use 'density' progression (hardcoded in constructCompoundExercise),
  // so this code path only executes for strength/bodyweight exercises with 'tone' goal

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
 * @param parentCategory - Parent exercise category (for sub-exercises)
 * @param parentProfile - Parent's intensity profile (for interval sub-exercise time params)
 * @returns Parameterized exercise with week1, week2, ..., weekN
 */
export function parameterizeExercise(
  exercise: ExerciseStructure,
  exerciseCategory: string,
  totalWeeks: number,
  rules: GenerationRules,
  answers: LegacyQuestionnaireAnswers,
  allExercises?: Array<[string, any]>,
  isSubExercise: boolean = false,
  parentCategory?: string,
  parentProfile?: Record<string, any>
): ParameterizedExercise {
  // Look up exercise external_load to determine if weight should be assigned
  let exerciseExternalLoad: string | undefined;
  if (allExercises && !exercise.category) { // Only for individual exercises (not compounds)
    const exerciseData = allExercises.find(([name, _]) => name === exercise.name);
    if (exerciseData) {
      exerciseExternalLoad = exerciseData[1].external_load;
    }
  }

  // Check if this is an interval sub-exercise (parent has sub_work_mode: "time")
  const isIntervalSubExercise = isSubExercise && parentProfile?.sub_work_mode === 'time';

  // Get Week 1 baseline
  const week1 = applyIntensityProfile(exercise, exerciseCategory, rules, answers, isSubExercise, exerciseExternalLoad, parentCategory, parentProfile);

  // Calculate sub-exercise count for compound volume progression
  const subExerciseCount = exercise.sub_exercises ? exercise.sub_exercises.length : undefined;

  // Calculate Week 2 and Week 3 (always required)
  // Pass exercise.category to enable compound parent detection for density/volume progression
  // Pass subExerciseCount for EMOM volume progression calculations
  // Pass isIntervalSubExercise for interval-specific time progression
  const week2 = applyProgressionScheme(week1, exercise.progressionScheme, 2, totalWeeks, rules, exercise.category, subExerciseCount, isIntervalSubExercise);
  const week3 = applyProgressionScheme(week1, exercise.progressionScheme, 3, totalWeeks, rules, exercise.category, subExerciseCount, isIntervalSubExercise);

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
      subExerciseCount,
      isIntervalSubExercise
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
    // Get the parent's intensity profile for passing to sub-exercises
    const parentCategoryProfiles = rules.intensity_profiles[exercise.category || exerciseCategory];
    const parentIntensityProfile = parentCategoryProfiles?.[exercise.intensityProfile];

    parameterized.sub_exercises = exercise.sub_exercises.map(subEx => {
      // Look up sub-exercise in database to get its category
      const subExData = allExercises.find(([name, _]) => name === subEx.name);
      if (!subExData) {
        throw new Error(`Sub-exercise not found in database: ${subEx.name}`);
      }

      const [_, subExInfo] = subExData;
      const subCategory = subExInfo.category;

      // Determine appropriate intensity profile for sub-exercise
      // Parent's intensity profile may not exist for sub-exercise's category (e.g., 'tabata' doesn't exist for 'strength')
      // Use 'moderate' as a safe fallback that exists for most categories
      let subIntensityProfile = exercise.intensityProfile;

      // Check if parent's intensity profile exists for sub-exercise's category
      const categoryProfiles = rules.intensity_profiles[subCategory];
      if (categoryProfiles && !categoryProfiles[exercise.intensityProfile]) {
        // Parent's profile doesn't exist for this category - use 'moderate' or 'heavy' as fallback
        if (categoryProfiles['moderate']) {
          subIntensityProfile = 'moderate';
        } else if (categoryProfiles['heavy']) {
          subIntensityProfile = 'heavy';
        } else {
          // Use first available profile
          const availableProfiles = Object.keys(categoryProfiles);
          subIntensityProfile = availableProfiles[0] as any;
        }
      }

      // Create a temporary ExerciseStructure for the sub-exercise
      const subExerciseStructure: ExerciseStructure = {
        name: subEx.name,
        progressionScheme: subEx.progressionScheme,
        intensityProfile: subIntensityProfile
      };

      // Recursively parameterize the sub-exercise (passing isSubExercise=true, parentCategory, and parentProfile)
      return parameterizeExercise(
        subExerciseStructure,
        subCategory,
        totalWeeks,
        rules,
        answers,
        allExercises,
        true, // This is a sub-exercise
        exercise.category || exerciseCategory, // Pass parent category for INTERVAL rest_time logic
        parentIntensityProfile // Pass parent's intensity profile for interval sub-exercise time params
      );
    });
  }

  return parameterized;
}
