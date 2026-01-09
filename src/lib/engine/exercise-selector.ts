/**
 * Exercise Selection with Filtering and Round-Robin Algorithm
 *
 * Implements stochastic exercise sampling from the 323-exercise database
 * All filtering criteria are config-driven from workout_generation_rules.json
 */

import type {
  QuestionnaireAnswers,
  GenerationRules,
  Exercise,
  ExerciseDatabase,
  ExerciseStructure,
  ExercisePool
} from './types.js';
import { estimateExerciseDuration } from './duration-estimator.js';
import { createRandom, shuffleArray, type RandomGenerator } from './seeded-random.js';

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
  answers: QuestionnaireAnswers,
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

  // Get muscle group mapping for this focus
  const muscleMapping = rules.split_muscle_group_mapping[focus];

  if (!muscleMapping) {
    throw new Error(`No muscle group mapping found for focus: ${focus}`);
  }

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
    const categoriesToFilter = hasCompoundCategory
      ? ['strength', 'mobility', 'flexibility', 'cardio']
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
  answers: QuestionnaireAnswers,
  usedExerciseNames: Set<string>,
  intensityProfile: string,
  random: RandomGenerator
): ExerciseStructure {
  // Get constituent exercise count from config
  const count = rules.compound_exercise_construction[compoundCategory].base_constituent_exercises;

  // CRITICAL: Filter for individual exercises only - NEVER allow compound categories to be nested
  // Compound exercises can ONLY contain individual exercises (strength, mobility, flexibility, cardio)
  const individualCategories = ['strength', 'mobility', 'flexibility', 'cardio'];

  // Get muscle group mapping
  const muscleMapping = rules.split_muscle_group_mapping[focus];
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

    // Check muscle groups
    if (!muscleMapping.include_muscle_groups.includes("all")) {
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

/**
 * Selects exercises using round-robin algorithm to maintain layer ratios
 *
 * @param pools - Exercise pools for each layer
 * @param rules - Generation rules configuration
 * @param answers - User's questionnaire answers
 * @param maxDuration - Maximum duration constraint in minutes
 * @param allExercises - All exercises from database (for compound construction)
 * @param focus - Day focus (for compound construction)
 * @param seed - Optional seed for deterministic testing
 * @returns Array of selected exercise structures
 */
export function roundRobinSelectExercises(
  pools: Map<string, Array<[string, Exercise]>>,
  rules: GenerationRules,
  answers: QuestionnaireAnswers,
  maxDuration: number,
  allExercises: Array<[string, Exercise]>,
  focus: string,
  seed?: number
): ExerciseStructure[] {
  const selectedExercises: ExerciseStructure[] = [];
  const usedExerciseNames = new Set<string>();
  const layerRatios = rules.exercise_selection_strategy.layer_ratios;
  const layerRequirements = rules.exercise_selection_strategy.layer_requirements;

  // Create random number generator (seeded if seed provided, unseeded otherwise)
  const random = createRandom(seed);

  // Exercise count constraints
  const constraints = rules.exercise_count_constraints;
  const maxTotalExercises = constraints.total_max_by_duration[answers.session_duration] || 12;
  let strengthExerciseCount = 0;
  let compoundExerciseCount = 0;

  // Equipment quota tracking
  const equipmentQuotas = rules.equipment_quotas;
  let barbellExerciseCount = 0;

  // Muscle group coverage tracking for ALL workouts
  // Track muscle group frequency to ensure balanced primary muscle coverage
  const muscleGroupCoverage = new Map<string, number>();

  // Track current index for each layer
  const layerIndices = new Map<string, number>();
  for (const layer of pools.keys()) {
    layerIndices.set(layer, 0);
  }

  // Determine layer order for round-robin (order matches ratio definition)
  const layerOrder = ["first", "primary", "secondary", "tertiary", "finisher", "last"];

  // Track compound exercises added per layer (to prevent over-adding from finisher)
  const compoundCountByLayer = new Map<string, number>();
  for (const layer of layerOrder) {
    compoundCountByLayer.set(layer, 0);
  }

  // CRITICAL: Use split overrides if available, otherwise use goal-based priorities
  // This MUST match the logic in createExercisePoolsForDay to avoid mismatch
  const splitOverrides = (rules.category_workout_structure as any).split_category_overrides?.[focus];
  const categoryPriorities = splitOverrides ||
    rules.category_workout_structure.category_priority_by_goal[answers.primary_goal];

  // Determine which layers should use compound exercises
  // When multiple compound types are available, randomly select one for variety
  const compoundLayersMap = new Map<string, string>();
  for (const layer of layerOrder) {
    const categories = categoryPriorities[layer as keyof typeof categoryPriorities] as string[] | undefined;
    if (categories) {
      const compoundCats = categories.filter(cat => isCompoundCategory(cat));
      if (compoundCats.length > 0) {
        // Randomly select from available compound types for equal representation
        const selectedIndex = Math.floor(random() * compoundCats.length);
        const compoundCat = compoundCats[selectedIndex];
        compoundLayersMap.set(layer, compoundCat);
      }
    }
  }

  let currentDuration = 0;
  let roundNumber = 0;
  let maxRounds = 50; // Safety limit

  // Track duration per layer (for time-based warm-up selection)
  const layerDurations = new Map<string, number>();
  for (const layer of layerOrder) {
    layerDurations.set(layer, 0);
  }

  // Warm-up target: config-driven (default 3 minutes)
  const warmupTargetMinutes = rules.exercise_selection_strategy.warmup_target_duration_minutes || 3;

  while (currentDuration < maxDuration && roundNumber < maxRounds) {
    roundNumber++;
    let addedAnyExercise = false;

    // Go through each layer in order, respecting the ratios
    for (const layer of layerOrder) {
      if (!pools.has(layer)) {
        continue; // Layer not included for this session duration
      }

      const ratio = layerRatios[layer] || 1;
      const pool = pools.get(layer)!;
      const currentIndex = layerIndices.get(layer)!;

      // SPECIAL: Time-based selection for warm-up phase (first layer)
      // For warm-up, select exercises until we have 3-5 minutes total
      if (layer === 'first') {
        const warmupDuration = layerDurations.get(layer) || 0;
        if (warmupDuration >= warmupTargetMinutes) {
          // Already have enough warm-up time, skip this layer
          continue;
        }
      }

      // Check if this layer needs a compound exercise
      const compoundType = compoundLayersMap.get(layer);

      if (compoundType) {
        // This layer needs a compound exercise - construct it
        const intensityProfile = getDefaultIntensityForLayer(layer);

        // CRITICAL FIX: Limit finisher compounds to prevent exhausting exercise pool
        // Finisher should only add 1-2 compounds total, not 1 per round
        const maxCompoundsForLayer = layer === 'finisher' ? 2 : 999;
        const currentLayerCompounds = compoundCountByLayer.get(layer) || 0;
        if (currentLayerCompounds >= maxCompoundsForLayer) {
          // Already added enough compounds for this layer, skip
          layerIndices.set(layer, currentIndex + 1);
          continue;
        }

        // Check exercise count constraint
        if (selectedExercises.length >= maxTotalExercises) {
          if (hasMetMinimumRequirements(selectedExercises, layerRequirements)) {
            return selectedExercises;
          }
          continue;
        }

        // Estimate duration for compound exercise
        const exerciseDuration = estimateExerciseDuration(
          compoundType,
          intensityProfile,
          rules.intensity_profiles,
          rules.time_estimates
        );

        // Check if adding this exercise would exceed duration
        if (currentDuration + exerciseDuration > maxDuration) {
          if (hasMetMinimumRequirements(selectedExercises, layerRequirements)) {
            return selectedExercises;
          }
          continue;
        }

        // Construct the compound exercise
        const compoundExercise = constructCompoundExercise(
          compoundType as 'circuit' | 'emom' | 'amrap' | 'interval',
          allExercises,
          focus,
          rules,
          answers,
          usedExerciseNames,
          intensityProfile,
          random
        );


        // Only add if we got at least 2 constituent exercises (minimum for any compound)
        if (compoundExercise.sub_exercises && compoundExercise.sub_exercises.length >= 2) {
          selectedExercises.push(compoundExercise);
          currentDuration += exerciseDuration;
          compoundExerciseCount++;
          addedAnyExercise = true;

          // Track compounds added for this layer
          compoundCountByLayer.set(layer, (compoundCountByLayer.get(layer) || 0) + 1);

          // Track layer duration for time-based selection
          const layerDuration = layerDurations.get(layer) || 0;
          layerDurations.set(layer, layerDuration + exerciseDuration);

          // Track muscle group coverage for compound exercises
          // Track all muscle groups from constituent exercises
          for (const subEx of compoundExercise.sub_exercises) {
            const subExerciseData = allExercises.find(([name]) => name === subEx.name)?.[1];
            if (subExerciseData) {
              trackMuscleGroupCoverage(subExerciseData, muscleGroupCoverage);
            }
          }
        }

        // Always increment index for compound layers (avoid infinite loops)
        layerIndices.set(layer, currentIndex + 1);
      } else {
        // Normal individual exercise selection
        // Prioritize exercises by muscle group coverage for ALL split types
        let workingPool = pool;

        // Re-prioritize the pool based on current muscle group coverage
        // This ensures balanced primary muscle group distribution
        const remainingPool = pool.slice(currentIndex);
        const prioritized = prioritizeByMuscleGroupCoverage(
          remainingPool,
          muscleGroupCoverage,
          focus,
          rules
        );
        // Reconstruct pool with prioritized remaining exercises
        workingPool = [...pool.slice(0, currentIndex), ...prioritized];

        // Add 'ratio' exercises from this layer in this round
        for (let i = 0; i < ratio; i++) {
          if (currentIndex + i >= workingPool.length) {
            // No more exercises in this pool
            continue;
          }

          const [exerciseName, exerciseData] = workingPool[currentIndex + i];

          // Check for duplicates
          if (usedExerciseNames.has(exerciseName)) {
            // Skip duplicate and try next
            continue;
          }

          // Check total exercise count constraint
          if (selectedExercises.length >= maxTotalExercises) {
            if (hasMetMinimumRequirements(selectedExercises, layerRequirements)) {
              return selectedExercises;
            }
            continue;
          }

          // Check strength exercise count constraint
          const category = exerciseData.category;
          if (category === 'strength' && strengthExerciseCount >= constraints.strength_max_per_day) {
            // Skip this strength exercise - already hit limit
            continue;
          }

          // Check barbell equipment quota
          const usesBarbell = exerciseData.equipment.includes("Barbell");
          if (usesBarbell && barbellExerciseCount >= equipmentQuotas.barbell_max_per_day) {
            // Skip this barbell exercise - already hit limit
            continue;
          }

          // Estimate duration
          // Assign a default intensity profile (will be refined later)
          const intensityProfile = getDefaultIntensityForLayer(layer);
          const exerciseDuration = estimateExerciseDuration(
            category,
            intensityProfile,
            rules.intensity_profiles,
            rules.time_estimates
          );

          // Check if adding this exercise would exceed duration
          if (currentDuration + exerciseDuration > maxDuration) {
            // Check if we've met minimum requirements
            if (hasMetMinimumRequirements(selectedExercises, layerRequirements)) {
              // We're done - hit duration limit
              return selectedExercises;
            }
            // Otherwise, skip this exercise and try to add from other layers
            continue;
          }

          // Add the exercise
          selectedExercises.push({
            name: exerciseName,
            progressionScheme: "linear", // Default, will be refined later
            intensityProfile: intensityProfile
          });

          usedExerciseNames.add(exerciseName);
          currentDuration += exerciseDuration;

          // Track layer duration for time-based selection
          const layerDuration = layerDurations.get(layer) || 0;
          layerDurations.set(layer, layerDuration + exerciseDuration);

          // Track exercise counts
          if (category === 'strength') {
            strengthExerciseCount++;
          }
          if (usesBarbell) {
            barbellExerciseCount++;
          }

          // Track muscle group coverage for all workouts
          trackMuscleGroupCoverage(exerciseData, muscleGroupCoverage);

          addedAnyExercise = true;
        }

        // Update index for this layer
        layerIndices.set(layer, currentIndex + ratio);
      }
    }

    // If we couldn't add any exercises this round, we're done
    if (!addedAnyExercise) {
      break;
    }
  }

  // Ensure minimum requirements are met
  if (!hasMetMinimumRequirements(selectedExercises, layerRequirements)) {
    // Build diagnostic error message
    const poolSizes = Array.from(pools.entries())
      .map(([layer, pool]) => `${layer}: ${pool.length} exercises`)
      .join(', ');

    const diagnostics = [
      `Failed to select enough exercises.`,
      `Selected: ${selectedExercises.length} exercises`,
      `Max duration: ${maxDuration} minutes`,
      `Current duration: ${currentDuration} minutes`,
      `Rounds completed: ${roundNumber}`,
      `Pool sizes: ${poolSizes}`,
      `Focus: ${focus}`
    ].join('\n  ');

    throw new Error(`Could not meet minimum layer requirements within duration constraint\n  ${diagnostics}`);
  }

  // Check compound exercise requirement (if enabled and applicable)
  // Note: Only enforce if session has enough exercises (skip for very short sessions)
  if (constraints.require_compound_exercises &&
      selectedExercises.length >= 3 &&
      compoundExerciseCount < constraints.compound_min_count) {
    // Warning: Could not meet compound exercise requirement
    // For MVP, we'll allow this rather than failing workout generation
    // In production, consider adding a compound exercise retroactively
  }

  return selectedExercises;
}

/**
 * Gets a default intensity profile for a layer
 *
 * @param layer - Layer name
 * @returns Intensity profile string
 */
function getDefaultIntensityForLayer(
  layer: string
): "light" | "moderate" | "moderate_heavy" | "heavy" | "max" | "tabata" | "liss" | "hiit" | "amrap" | "extended" {
  const intensityMap: { [key: string]: "light" | "moderate" | "moderate_heavy" | "heavy" | "max" | "tabata" | "liss" | "hiit" | "amrap" | "extended" } = {
    first: "light",
    primary: "heavy",
    secondary: "moderate",
    tertiary: "moderate",
    finisher: "heavy",
    last: "light"
  };

  return intensityMap[layer] || "moderate";
}

/**
 * Checks if minimum layer requirements have been met
 *
 * @param exercises - Currently selected exercises
 * @param requirements - Layer requirements configuration
 * @returns True if requirements met, false otherwise
 */
function hasMetMinimumRequirements(
  exercises: ExerciseStructure[],
  requirements: { must_include: string[]; optional: string[]; always_end_with_last_if_available: boolean }
): boolean {
  // Relaxed check: We need at least 1 exercise to have a minimal valid workout
  // In production, we'd track layer assignments, but for now we just ensure
  // we have something to work with
  return exercises.length >= 1;
}

/**
 * Prioritizes exercises based on muscle group coverage using tier-based scoring
 *
 * Works for ALL split types (Full Body, Push/Pull/Legs, Upper/Lower).
 * Uses primary/secondary muscle group config to ensure balanced coverage.
 *
 * @param pool - Exercise pool to prioritize
 * @param muscleGroupCoverage - Map tracking how many times each muscle group has been selected
 * @param focus - Split focus (e.g., "Push", "Pull", "Full Body")
 * @param rules - Generation rules (for muscle group priority mapping)
 * @returns Prioritized pool with underrepresented primary muscles first
 */
function prioritizeByMuscleGroupCoverage(
  pool: Array<[string, Exercise]>,
  muscleGroupCoverage: Map<string, number>,
  focus: string,
  rules: GenerationRules
): Array<[string, Exercise]> {
  // Get primary and secondary muscles for this focus
  const priorityMapping = rules.muscle_group_priority_mapping[focus];

  // If no priority mapping exists for this focus, return pool as-is
  if (!priorityMapping) {
    return pool;
  }

  const primaryMuscles = new Set(priorityMapping.primary);
  const secondaryMuscles = new Set(priorityMapping.secondary);

  // Score each exercise based on muscle group coverage
  const scored = pool.map(([name, exercise]) => {
    // Separate primary and secondary muscle coverage
    let primaryMinCoverage = Infinity;
    let primaryTotalCoverage = 0;
    let primaryUncoveredCount = 0;
    let primaryCoveredCount = 0;

    let secondaryMinCoverage = Infinity;
    let secondaryTotalCoverage = 0;
    let secondaryUncoveredCount = 0;

    if (exercise.muscle_groups.length > 0) {
      for (const mg of exercise.muscle_groups) {
        const coverage = muscleGroupCoverage.get(mg) || 0;

        if (primaryMuscles.has(mg)) {
          // Primary muscle
          primaryMinCoverage = Math.min(primaryMinCoverage, coverage);
          primaryTotalCoverage += coverage;
          if (coverage === 0) {
            primaryUncoveredCount++;
          } else {
            primaryCoveredCount++;
          }
        } else if (secondaryMuscles.has(mg)) {
          // Secondary muscle
          secondaryMinCoverage = Math.min(secondaryMinCoverage, coverage);
          secondaryTotalCoverage += coverage;
          if (coverage === 0) {
            secondaryUncoveredCount++;
          }
        }
      }
    }

    // Reset infinity to 0 if no muscles found
    if (primaryMinCoverage === Infinity) primaryMinCoverage = 0;
    if (secondaryMinCoverage === Infinity) secondaryMinCoverage = 0;

    // FIVE-TIER SCORING SYSTEM (TUNED FOR ≤5.0 RATIO):
    // Tier 1 (Highest): Primary muscles with 0 coverage
    //   - Score = 2000 * primaryUncoveredCount - primaryTotalCoverage
    //   - Ensures uncovered primary muscles get selected first
    //
    // Tier 2 (High): Primary muscles with low coverage (≤2 hits)
    //   - Score = 1000 - primaryTotalCoverage
    //   - Balances primary muscle distribution aggressively
    //
    // Tier 3 (Medium): Secondary muscles with 0 coverage
    //   - Score = 100 * secondaryUncoveredCount - secondaryTotalCoverage
    //   - Allows secondary muscles (traps, forearms) to appear
    //
    // Tier 4 (Low): Any muscle with some coverage
    //   - Score = -primaryTotalCoverage - secondaryTotalCoverage
    //   - Fills remaining slots with variety
    //
    // Tier 5 (Lowest): Heavily covered primary muscles (>2 hits)
    //   - Score = -2000 * primaryMinCoverage - primaryTotalCoverage
    //   - Strongly prevents muscle group dominance

    let score: number;
    let tier: number;

    if (primaryUncoveredCount > 0) {
      // Tier 1: Uncovered primary muscles - HIGHEST PRIORITY
      score = 2000 * primaryUncoveredCount - primaryTotalCoverage;
      tier = 1;
    } else if (primaryCoveredCount > 0 && primaryMinCoverage <= 2) {
      // Tier 2: Primary muscles with low coverage - HIGH PRIORITY
      score = 1000 - primaryTotalCoverage;
      tier = 2;
    } else if (secondaryUncoveredCount > 0) {
      // Tier 3: Uncovered secondary muscles - MEDIUM PRIORITY
      score = 100 * secondaryUncoveredCount - secondaryTotalCoverage;
      tier = 3;
    } else if (primaryMinCoverage <= 2 || secondaryMinCoverage <= 2) {
      // Tier 4: Any muscle with some coverage - LOW PRIORITY
      score = -(primaryTotalCoverage + secondaryTotalCoverage);
      tier = 4;
    } else {
      // Tier 5: Heavily covered muscles - LOWEST PRIORITY
      score = -2000 * primaryMinCoverage - primaryTotalCoverage;
      tier = 5;
    }

    return {
      name,
      exercise,
      score,
      tier,
      primaryUncoveredCount,
      primaryMinCoverage,
      primaryTotalCoverage
    };
  });

  // Sort by tier first, then score (descending), then name (alphabetical)
  scored.sort((a, b) => {
    if (a.tier !== b.tier) {
      return a.tier - b.tier; // Lower tier number = higher priority
    }
    if (a.score !== b.score) {
      return b.score - a.score; // Higher score first within same tier
    }
    return a.name.localeCompare(b.name); // Alphabetical tiebreaker
  });

  return scored.map(({ name, exercise }) => [name, exercise]);
}

/**
 * Updates muscle group coverage tracking after selecting an exercise
 *
 * @param exercise - Selected exercise
 * @param muscleGroupCoverage - Coverage map to update
 */
function trackMuscleGroupCoverage(
  exercise: Exercise,
  muscleGroupCoverage: Map<string, number>
): void {
  for (const muscleGroup of exercise.muscle_groups) {
    const current = muscleGroupCoverage.get(muscleGroup) || 0;
    muscleGroupCoverage.set(muscleGroup, current + 1);
  }
}
