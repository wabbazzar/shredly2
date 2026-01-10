/**
 * Exercise Selection with Block-Based Algorithm
 *
 * Implements prescriptive block-based exercise selection from the 323-exercise database
 * All filtering criteria are config-driven from workout_generation_rules.json
 */

import type {
  LegacyQuestionnaireAnswers,
  QuestionnaireAnswers,
  GenerationRules,
  Exercise,
  ExerciseDatabase,
  ExerciseStructure,
  ExercisePool,
  BlockSpec,
  MuscleGroupMappingEntry
} from './types.js';
import { estimateExerciseDuration } from './duration-estimator.js';
import { createRandom, shuffleArray, type RandomGenerator } from './seeded-random.js';
import { buildDayStructure, getBaseFocus, assignIntensityProfile, getProgressionFromGoal } from './phase1-structure.js';

/**
 * Flattens the exercise database into a simple array with exercise names
 *
 * @param exerciseDB - Exercise database
 * @returns Array of [exerciseName, exerciseData] tuples
 */
export function flattenExerciseDatabase(
  exerciseDB: ExerciseDatabase
): Array<[string, Exercise]> {
  const exercises: Array<[string, Exercise]> = [];

  for (const categoryKey in exerciseDB.exercise_database.categories) {
    const category = exerciseDB.exercise_database.categories[categoryKey];
    for (const exerciseName in category.exercises) {
      exercises.push([exerciseName, category.exercises[exerciseName]]);
    }
  }

  return exercises;
}

/**
 * Filters exercises based on criteria for a specific layer on a specific day
 *
 * @param allExercises - Flattened exercise database
 * @param focus - Day focus (e.g., "Push", "Pull", "Upper", "Lower", "Full Body")
 * @param categories - Array of valid categories for this layer (from config)
 * @param equipmentAccess - User's equipment access
 * @param difficultyFilter - Array of allowed difficulty levels (from experience modifiers)
 * @param externalLoadFilter - Array of allowed external load types (from experience modifiers)
 * @param muscleGroupMapping - Muscle group mapping from split focus
 * @returns Filtered array of [exerciseName, exercise] tuples
 */
export function filterExercisesForLayer(
  allExercises: Array<[string, Exercise]>,
  focus: string,
  categories: string[],
  equipmentAccess: string,
  difficultyFilter: string[],
  externalLoadFilter: string[],
  muscleGroupMapping: { include_muscle_groups: string[]; exclude_muscle_groups?: string[] }
): Array<[string, Exercise]> {
  return allExercises.filter(([name, exercise]) => {
    // Filter by category (must be in the layer's allowed categories)
    if (!categories.includes(exercise.category)) {
      return false;
    }

    // Filter by difficulty (must be in experience level's allowed difficulties)
    // CRITICAL: For limited equipment (bodyweight/minimal/dumbbells), relax difficulty filter
    // Otherwise expert users with limited equipment would have ZERO exercises
    const hasLimitedEquipmentForDifficulty = equipmentAccess === 'bodyweight_only' ||
                                equipmentAccess === 'minimal_equipment' ||
                                equipmentAccess === 'dumbbells_only';
    const relaxedDifficultyFilter = hasLimitedEquipmentForDifficulty
      ? [...difficultyFilter, 'Beginner', 'Intermediate'] // Allow all difficulties for limited equipment
      : difficultyFilter;

    if (!relaxedDifficultyFilter.includes(exercise.difficulty)) {
      return false;
    }

    // Filter by external load (must be in experience level's allowed external loads)
    // CRITICAL: Make external load filter equipment-aware AND category-aware
    // For limited equipment (bodyweight_only, minimal_equipment, dumbbells_only), relax the filter
    // to allow "never" external load exercises, otherwise advanced/expert users
    // with limited equipment would have ZERO exercises
    const hasLimitedEquipment = equipmentAccess === 'bodyweight_only' ||
                                equipmentAccess === 'minimal_equipment' ||
                                equipmentAccess === 'dumbbells_only';

    // CRITICAL: For certain categories that are inherently low-load (mobility, flexibility, bodyweight, cardio),
    // relax the external_load filter to prevent empty exercise pools for expert users
    // These categories typically use bodyweight or minimal equipment, so requiring "always" external load
    // would result in 0 exercises
    const isLowLoadCategory = ['mobility', 'flexibility', 'bodyweight', 'cardio'].includes(exercise.category);

    const relaxedExternalLoadFilter = (hasLimitedEquipment || isLowLoadCategory)
      ? [...externalLoadFilter, 'never', 'sometimes'] // Allow bodyweight and sometimes-loaded exercises
      : externalLoadFilter;

    if (!relaxedExternalLoadFilter.includes(exercise.external_load)) {
      return false;
    }

    // Filter by equipment
    // For "None" equipment exercises, they're always available
    // For exercises requiring equipment, check if user has access
    if (exercise.equipment.length > 0 && !exercise.equipment.includes("None")) {
      const hasRequiredEquipment = checkEquipmentAvailability(
        exercise.equipment,
        equipmentAccess
      );
      if (!hasRequiredEquipment) {
        return false;
      }
    }

    // Filter by muscle groups (based on split focus)
    if (muscleGroupMapping.include_muscle_groups.includes("all")) {
      // Full body - no muscle group filtering
      return true;
    }

    // Check if exercise targets any of the included muscle groups
    const targetsIncludedMuscles = exercise.muscle_groups.some(mg =>
      muscleGroupMapping.include_muscle_groups.includes(mg)
    );

    if (!targetsIncludedMuscles) {
      return false;
    }

    // Check if exercise targets any excluded muscle groups
    if (muscleGroupMapping.exclude_muscle_groups) {
      const targetsExcludedMuscles = exercise.muscle_groups.some(mg =>
        muscleGroupMapping.exclude_muscle_groups!.includes(mg)
      );
      if (targetsExcludedMuscles) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Checks if the user has access to required equipment
 *
 * @param requiredEquipment - Array of equipment needed for exercise
 * @param userAccess - User's equipment access level
 * @returns True if user has access, false otherwise
 */
function checkEquipmentAvailability(
  requiredEquipment: string[],
  userAccess: string
): boolean {
  // Define equipment availability by access level
  const equipmentByAccess: { [key: string]: string[] } = {
    commercial_gym: ["Barbell", "Dumbbell", "Dumbbells", "Bench", "Plates", "Pull-up Bar",
                      "Squat Rack", "Power Rack", "Cable Machine", "Smith Machine",
                      "Leg Press", "Box", "Platform", "Kettlebell", "Resistance Bands",
                      "TRX", "Medicine Ball", "Slam Ball", "Battle Ropes", "Sled",
                      "Chair", "Wall", "Mat", "Foam Roller", "None"],
    home_gym_full: ["Barbell", "Dumbbell", "Dumbbells", "Bench", "Plates", "Pull-up Bar",
                     "Squat Rack", "Power Rack", "Kettlebell", "Resistance Bands",
                     "Chair", "Wall", "Mat", "Foam Roller", "None"],
    home_gym_basic: ["Dumbbell", "Dumbbells", "Bench", "Resistance Bands", "Kettlebell",
                      "Pull-up Bar", "Chair", "Wall", "Mat", "Foam Roller", "None"],
    dumbbells_only: ["Dumbbell", "Dumbbells", "Bench", "Chair", "Wall", "Mat", "None"],
    bodyweight_only: ["None", "Pull-up Bar", "Chair", "Wall", "Mat", "Box", "Platform"],
    minimal_equipment: ["None", "Resistance Bands", "Chair", "Wall", "Mat", "Dumbbell"]
  };

  const availableEquipment = equipmentByAccess[userAccess] || [];

  // Check if all required equipment is available
  return requiredEquipment.every(eq => availableEquipment.includes(eq));
}

/**
 * Creates exercise pools for all layers based on day focus and goal
 *
 * @param allExercises - Flattened exercise database
 * @param focus - Day focus (e.g., "Push", "Pull", "Upper")
 * @param answers - User's questionnaire answers
 * @param rules - Generation rules configuration
 * @param includedLayers - Layers to include based on session duration
 * @param seed - Optional seed for deterministic testing
 * @returns Map of layer name to filtered exercise pool
 */
export function createExercisePoolsForDay(
  allExercises: Array<[string, Exercise]>,
  focus: string,
  answers: LegacyQuestionnaireAnswers,
  rules: GenerationRules,
  includedLayers: string[],
  seed?: number
): Map<string, Array<[string, Exercise]>> {
  const pools = new Map<string, Array<[string, Exercise]>>();

  // Create random number generator (seeded if seed provided, unseeded otherwise)
  const random = createRandom(seed);

  // Check for split-specific category overrides first (e.g., high-tempo Upper/Lower in ULPPL)
  const splitOverrides = (rules.category_workout_structure as any).split_category_overrides?.[focus];

  // Use split overrides if available, otherwise use goal-based priorities
  const categoryPriorities = splitOverrides ||
    rules.category_workout_structure.category_priority_by_goal[answers.primary_goal];

  if (!categoryPriorities) {
    throw new Error(`No category priorities found for goal: ${answers.primary_goal}`);
  }

  // Get muscle group mapping using base focus (suffixed variants use same muscle groups)
  const baseFocusForMapping = getBaseFocus(focus);
  const muscleMappingRaw = rules.split_muscle_group_mapping[baseFocusForMapping];

  if (!muscleMappingRaw || typeof muscleMappingRaw === 'string') {
    throw new Error(`No muscle group mapping found for base focus: ${baseFocusForMapping}`);
  }
  const muscleMapping = muscleMappingRaw as MuscleGroupMappingEntry;

  // Get experience modifiers
  const experienceModifier = rules.experience_modifiers[answers.experience_level];

  if (!experienceModifier) {
    throw new Error(`No experience modifiers found for level: ${answers.experience_level}`);
  }

  // Create a pool for each included layer
  for (const layer of includedLayers) {
    const categoriesForLayer = categoryPriorities[layer as keyof typeof categoryPriorities] as string[];

    if (!categoriesForLayer || categoriesForLayer.length === 0) {
      // Empty layer for this goal (e.g., rehabilitation has no finisher)
      pools.set(layer, []);
      continue;
    }

    // Check if any categories are compound types
    const hasCompoundCategory = categoriesForLayer.some(cat =>
      ['circuit', 'emom', 'amrap', 'interval'].includes(cat)
    );

    // If compound categories requested, filter for individual exercises instead
    // (compound exercises will be constructed from individual exercises)
    // NOTE: Exclude mobility and flexibility from compound sub-exercises - they should only
    // appear at start (warmup) or end (cooldown), never in middle of workout
    const categoriesToFilter = hasCompoundCategory
      ? ['strength', 'cardio', 'bodyweight']
      : categoriesForLayer;

    const filteredExercises = filterExercisesForLayer(
      allExercises,
      focus,
      categoriesToFilter,
      answers.equipment_access,
      experienceModifier.complexity_filter,
      experienceModifier.external_load_filter,
      muscleMapping
    );

    // Shuffle the pool if configured to introduce randomness
    if (rules.exercise_selection_strategy.shuffle_pools) {
      shuffleArray(filteredExercises, random);
    }

    pools.set(layer, filteredExercises);
  }

  return pools;
}

/**
 * Checks if a category is a compound type that needs to be constructed
 */
function isCompoundCategory(category: string): boolean {
  return ['circuit', 'emom', 'amrap', 'interval'].includes(category);
}

// ============================================================================
// BLOCK-BASED SELECTION (Phase 3 - Replaces Round-Robin)
// ============================================================================

/**
 * Selects exercises for a day using block-based selection
 *
 * @param dayFocus - Day focus with possible suffix (e.g., "Upper-HIIT", "Push-Volume")
 * @param allExercises - Flattened exercise database
 * @param answers - User's questionnaire answers (legacy format)
 * @param rules - Generation rules configuration
 * @param duration - Session duration in minutes
 * @param seed - Optional seed for deterministic testing
 * @param goal - User's goal (v2.0 format) for progression derivation
 * @returns Array of selected exercise structures
 */
export function selectExercisesForDay(
  dayFocus: string,
  allExercises: Array<[string, Exercise]>,
  answers: LegacyQuestionnaireAnswers,
  rules: GenerationRules,
  duration: number,
  seed?: number,
  goal?: QuestionnaireAnswers['goal']
): ExerciseStructure[] {
  const random = createRandom(seed);
  const usedExerciseNames = new Set<string>();
  const selectedExercises: ExerciseStructure[] = [];

  // Get block structure for this day
  const blocks = buildDayStructure(dayFocus, answers.equipment_access, duration, rules);

  // Get base focus for muscle group filtering
  const baseFocus = getBaseFocus(dayFocus);

  // Get muscle group mapping using base focus (suffixed variants use same muscle groups)
  const muscleMappingRaw = rules.split_muscle_group_mapping[baseFocus];
  if (!muscleMappingRaw || typeof muscleMappingRaw === 'string') {
    throw new Error(`No muscle group mapping found for base focus: ${baseFocus}`);
  }
  const muscleMapping = muscleMappingRaw as MuscleGroupMappingEntry;

  // Get experience modifiers
  const experienceModifier = rules.experience_modifiers[answers.experience_level];
  if (!experienceModifier) {
    throw new Error(`No experience modifiers found for level: ${answers.experience_level}`);
  }

  // Process each block
  for (const block of blocks) {
    const blockCount = typeof block.count === 'number' ? block.count : 1;

    for (let i = 0; i < blockCount; i++) {
      const exercise = selectExerciseForBlock(
        block,
        baseFocus,
        allExercises,
        answers,
        rules,
        muscleMapping,
        experienceModifier,
        usedExerciseNames,
        random,
        goal
      );

      if (exercise) {
        selectedExercises.push(exercise);
      }
    }
  }

  return selectedExercises;
}

/**
 * Selects a single exercise for a block specification
 */
function selectExerciseForBlock(
  block: BlockSpec,
  baseFocus: string,
  allExercises: Array<[string, Exercise]>,
  answers: LegacyQuestionnaireAnswers,
  rules: GenerationRules,
  muscleMapping: { include_muscle_groups: string[]; exclude_muscle_groups?: string[] },
  experienceModifier: {
    complexity_filter: string[];
    external_load_filter: string[];
    [key: string]: any;
  },
  usedExerciseNames: Set<string>,
  random: RandomGenerator,
  goal?: QuestionnaireAnswers['goal']
): ExerciseStructure | null {
  switch (block.type) {
    case 'strength':
    case 'strength_high_rep':
      return selectStrengthExercise(
        block,
        baseFocus,
        allExercises,
        answers,
        rules,
        muscleMapping,
        experienceModifier,
        usedExerciseNames,
        random,
        goal
      );

    case 'compound':
      return selectCompoundExercise(
        baseFocus,
        allExercises,
        answers,
        rules,
        muscleMapping,
        experienceModifier,
        usedExerciseNames,
        random,
        goal
      );

    case 'interval':
      return selectIntervalBlock(
        block,
        baseFocus,
        allExercises,
        answers,
        rules,
        muscleMapping,
        experienceModifier,
        usedExerciseNames,
        random,
        goal
      );

    case 'mobility':
      return selectMobilityExercise(
        baseFocus,
        allExercises,
        answers,
        rules,
        usedExerciseNames,
        random
      );

    default:
      return null;
  }
}

/**
 * Selects a strength exercise based on block specification
 */
function selectStrengthExercise(
  block: BlockSpec,
  baseFocus: string,
  allExercises: Array<[string, Exercise]>,
  answers: LegacyQuestionnaireAnswers,
  rules: GenerationRules,
  muscleMapping: { include_muscle_groups: string[]; exclude_muscle_groups?: string[] },
  experienceModifier: {
    complexity_filter: string[];
    external_load_filter: string[];
    [key: string]: any;
  },
  usedExerciseNames: Set<string>,
  random: RandomGenerator,
  goal?: QuestionnaireAnswers['goal']
): ExerciseStructure | null {
  // Filter for strength exercises
  let filtered = filterExercisesForLayer(
    allExercises,
    baseFocus,
    ['strength'],
    answers.equipment_access,
    experienceModifier.complexity_filter,
    experienceModifier.external_load_filter,
    muscleMapping
  );

  // Apply equipment preference filter
  if (block.equipment_preference === 'barbell') {
    filtered = filtered.filter(([_, ex]) => ex.equipment.includes('Barbell'));
  } else if (block.equipment_preference === 'dumbbell') {
    filtered = filtered.filter(([_, ex]) =>
      ex.equipment.includes('Dumbbell') || ex.equipment.includes('Dumbbells')
    );
  }

  // Remove already used exercises
  filtered = filtered.filter(([name, _]) => !usedExerciseNames.has(name));

  // Shuffle for variety
  if (rules.exercise_selection_strategy.shuffle_pools) {
    shuffleArray(filtered, random);
  }

  if (filtered.length === 0) {
    // Fallback: try without equipment preference
    filtered = filterExercisesForLayer(
      allExercises,
      baseFocus,
      ['strength'],
      answers.equipment_access,
      experienceModifier.complexity_filter,
      experienceModifier.external_load_filter,
      muscleMapping
    ).filter(([name, _]) => !usedExerciseNames.has(name));

    if (rules.exercise_selection_strategy.shuffle_pools) {
      shuffleArray(filtered, random);
    }
  }

  if (filtered.length === 0) {
    return null;
  }

  const [name, _] = filtered[0];
  usedExerciseNames.add(name);

  // Determine intensity profile based on block type
  const layer = block.type === 'strength_high_rep' ? 'secondary' : 'primary';
  const intensityProfile = assignIntensityProfile(layer, 'strength', rules);

  // Use new goal-based progression derivation if goal is provided
  const progressionScheme = goal
    ? getProgressionFromGoal(goal, 'strength', rules)
    : 'linear'; // Fallback for backward compatibility

  return {
    name,
    progressionScheme,
    intensityProfile
  };
}

/**
 * Selects a compound exercise (EMOM, AMRAP, Circuit, or Interval)
 */
function selectCompoundExercise(
  baseFocus: string,
  allExercises: Array<[string, Exercise]>,
  answers: LegacyQuestionnaireAnswers,
  rules: GenerationRules,
  muscleMapping: { include_muscle_groups: string[]; exclude_muscle_groups?: string[] },
  experienceModifier: {
    complexity_filter: string[];
    external_load_filter: string[];
    [key: string]: any;
  },
  usedExerciseNames: Set<string>,
  random: RandomGenerator,
  goal?: QuestionnaireAnswers['goal']
): ExerciseStructure | null {
  // Try each compound type until we find one that works
  const compoundTypes: Array<'emom' | 'amrap' | 'circuit' | 'interval'> = ['emom', 'amrap', 'circuit', 'interval'];

  // Shuffle compound types for variety
  shuffleArray(compoundTypes, random);

  for (const compoundType of compoundTypes) {
    // Construct the compound exercise
    const intensityProfile = assignIntensityProfile('finisher', compoundType, rules);

    const compound = constructCompoundExercise(
      compoundType,
      allExercises,
      baseFocus,
      rules,
      answers,
      usedExerciseNames,
      intensityProfile,
      random
    );

    // Check if compound has valid sub-exercises (at least 2)
    if (compound && compound.sub_exercises && compound.sub_exercises.length >= 2) {
      return compound;
    }
  }

  // Couldn't create any valid compound - return null
  return null;
}

/**
 * Selects an interval block with multiple exercises
 */
function selectIntervalBlock(
  block: BlockSpec,
  baseFocus: string,
  allExercises: Array<[string, Exercise]>,
  answers: LegacyQuestionnaireAnswers,
  rules: GenerationRules,
  muscleMapping: { include_muscle_groups: string[]; exclude_muscle_groups?: string[] },
  experienceModifier: {
    complexity_filter: string[];
    external_load_filter: string[];
    [key: string]: any;
  },
  usedExerciseNames: Set<string>,
  random: RandomGenerator,
  goal?: QuestionnaireAnswers['goal']
): ExerciseStructure | null {
  const intensityProfile = assignIntensityProfile('primary', 'interval', rules);

  // Create interval compound exercise
  const compound = constructCompoundExercise(
    'interval',
    allExercises,
    baseFocus,
    rules,
    answers,
    usedExerciseNames,
    intensityProfile,
    random
  );

  // Only return if compound has valid sub-exercises
  if (compound && compound.sub_exercises && compound.sub_exercises.length >= 2) {
    return compound;
  }

  return null;
}

/**
 * Selects a mobility exercise
 */
function selectMobilityExercise(
  baseFocus: string,
  allExercises: Array<[string, Exercise]>,
  answers: LegacyQuestionnaireAnswers,
  rules: GenerationRules,
  usedExerciseNames: Set<string>,
  random: RandomGenerator
): ExerciseStructure | null {
  // Filter for mobility/flexibility exercises
  let filtered = allExercises.filter(([name, ex]) => {
    if (usedExerciseNames.has(name)) return false;
    if (!['mobility', 'flexibility'].includes(ex.category)) return false;

    // Check equipment availability
    if (ex.equipment.length > 0 && !ex.equipment.includes('None')) {
      const hasEquipment = checkEquipmentAvailability(ex.equipment, answers.equipment_access);
      if (!hasEquipment) return false;
    }

    return true;
  });

  if (rules.exercise_selection_strategy.shuffle_pools) {
    shuffleArray(filtered, random);
  }

  if (filtered.length === 0) {
    return null;
  }

  const [name, _] = filtered[0];
  usedExerciseNames.add(name);

  return {
    name,
    progressionScheme: 'static',
    intensityProfile: assignIntensityProfile('first', 'mobility', rules)
  };
}

/**
 * Constructs a compound exercise by selecting multiple constituent exercises
 *
 * @param compoundCategory - Type of compound exercise (circuit, emom, amrap, interval)
 * @param allExercises - All available individual exercises
 * @param focus - Day focus for muscle group filtering
 * @param rules - Generation rules
 * @param answers - User answers
 * @param usedExerciseNames - Set of already used exercise names
 * @param intensityProfile - Intensity profile for the compound exercise
 * @param random - Random number generator (seeded or unseeded)
 * @returns Compound exercise structure with sub-exercises
 */
function constructCompoundExercise(
  compoundCategory: 'circuit' | 'emom' | 'amrap' | 'interval',
  allExercises: Array<[string, Exercise]>,
  focus: string,
  rules: GenerationRules,
  answers: LegacyQuestionnaireAnswers,
  usedExerciseNames: Set<string>,
  intensityProfile: string,
  random: RandomGenerator
): ExerciseStructure {
  // Get constituent exercise count from config
  const count = rules.compound_exercise_construction[compoundCategory].base_constituent_exercises;

  // CRITICAL: Filter for individual exercises only - NEVER allow compound categories to be nested
  // Compound exercises can ONLY contain individual exercises (strength, cardio, bodyweight)
  // NOTE: Exclude mobility and flexibility - these should only appear at start (warmup) or end (cooldown)
  const individualCategories = ['strength', 'cardio', 'bodyweight'];

  // Get muscle group mapping using base focus (suffixed variants use same muscle groups)
  const baseFocusForMapping = getBaseFocus(focus);
  const muscleMappingRaw = rules.split_muscle_group_mapping[baseFocusForMapping];
  const muscleMapping = (muscleMappingRaw && typeof muscleMappingRaw !== 'string')
    ? muscleMappingRaw as MuscleGroupMappingEntry
    : undefined;
  const experienceModifier = rules.experience_modifiers[answers.experience_level];

  // Filter available exercises
  let availableExercises = allExercises.filter(([name, exercise]) => {
    // CRITICAL: Must be individual exercise category - NEVER compound categories
    if (!individualCategories.includes(exercise.category)) return false;

    // Explicit check: Never allow circuit, emom, amrap, interval to be nested
    if (['circuit', 'emom', 'amrap', 'interval'].includes(exercise.category)) return false;

    // Not already used
    if (usedExerciseNames.has(name)) return false;

    // Meets difficulty and load requirements
    // CRITICAL: Relax difficulty filter for limited equipment (same as filterExercisesForLayer)
    const hasLimitedEquipmentForDifficulty = answers.equipment_access === 'bodyweight_only' ||
                                answers.equipment_access === 'minimal_equipment' ||
                                answers.equipment_access === 'dumbbells_only';
    const relaxedDifficultyFilter = hasLimitedEquipmentForDifficulty
      ? [...experienceModifier.complexity_filter, 'Beginner', 'Intermediate']
      : experienceModifier.complexity_filter;

    if (!relaxedDifficultyFilter.includes(exercise.difficulty)) return false;

    // CRITICAL: Make external load filter equipment-aware (same as filterExercisesForLayer)
    const hasLimitedEquipment = answers.equipment_access === 'bodyweight_only' ||
                                answers.equipment_access === 'minimal_equipment' ||
                                answers.equipment_access === 'dumbbells_only';
    const relaxedExternalLoadFilter = hasLimitedEquipment
      ? [...experienceModifier.external_load_filter, 'never']
      : experienceModifier.external_load_filter;

    if (!relaxedExternalLoadFilter.includes(exercise.external_load)) return false;

    // Check equipment
    if (exercise.equipment.length > 0 && !exercise.equipment.includes("None")) {
      if (!checkEquipmentAvailability(exercise.equipment, answers.equipment_access)) {
        return false;
      }
    }

    // Exclude equipment based on compound exercise type config
    const excludedEquipment = rules.compound_exercise_construction[compoundCategory].exclude_equipment;
    if (excludedEquipment && excludedEquipment.length > 0) {
      const hasExcludedEquipment = exercise.equipment.some(eq => excludedEquipment.includes(eq));
      if (hasExcludedEquipment) {
        return false;
      }
    }

    // Check muscle groups (only if mapping exists)
    if (muscleMapping && !muscleMapping.include_muscle_groups.includes("all")) {
      const targetsIncluded = exercise.muscle_groups.some(mg =>
        muscleMapping.include_muscle_groups.includes(mg)
      );
      if (!targetsIncluded) return false;

      if (muscleMapping.exclude_muscle_groups) {
        const targetsExcluded = exercise.muscle_groups.some(mg =>
          muscleMapping.exclude_muscle_groups!.includes(mg)
        );
        if (targetsExcluded) return false;
      }
    }

    return true;
  });

  // Shuffle for randomness if enabled
  if (rules.exercise_selection_strategy.shuffle_pools) {
    shuffleArray(availableExercises, random);
  }

  // VALIDATION: We need at least 2 individual exercises to create any compound exercise
  // If we can't find enough, return a placeholder that will be filtered out later
  if (availableExercises.length < 2) {
    return {
      name: `${compoundCategory.toUpperCase()}: [insufficient exercises]`,
      category: compoundCategory,
      sub_exercises: [], // Empty - will be filtered out
      progressionScheme: 'density',
      intensityProfile: intensityProfile as any
    };
  }

  // Helper function to normalize exercise names for duplicate detection
  const normalizeExerciseName = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '') // Remove punctuation, spaces, hyphens
      .trim();
  };

  // Select constituent exercises with duplicate detection
  const selectedCount = Math.min(count, availableExercises.length);
  const constituentExercises: Array<[string, Exercise]> = [];
  const normalizedNames = new Set<string>();

  for (const [name, exercise] of availableExercises) {
    if (constituentExercises.length >= selectedCount) break;

    const normalized = normalizeExerciseName(name);

    // Skip if we already have this exercise (or a very similar variant)
    if (normalizedNames.has(normalized)) {
      continue;
    }

    constituentExercises.push([name, exercise]);
    normalizedNames.add(normalized);
  }

  // VALIDATION: Ensure we have enough unique exercises
  if (constituentExercises.length < 2) {
    return {
      name: `${compoundCategory.toUpperCase()}: [insufficient unique exercises]`,
      category: compoundCategory,
      sub_exercises: [],
      progressionScheme: 'density',
      intensityProfile: intensityProfile as any
    };
  }

  // Mark as used
  constituentExercises.forEach(([name, _]) => usedExerciseNames.add(name));

  // Build compound exercise name
  const exerciseNames = constituentExercises.map(([name, _]) => name);
  const compoundName = `${compoundCategory.toUpperCase()}: ${exerciseNames.join(' + ')}`;

  // Create compound exercise structure
  return {
    name: compoundName,
    category: compoundCategory,
    sub_exercises: constituentExercises.map(([name, _]) => ({
      name,
      progressionScheme: 'density' // Compound exercises typically use density progression
    })),
    progressionScheme: 'density',
    intensityProfile: intensityProfile as any
  };
}

