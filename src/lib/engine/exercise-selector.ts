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
    if (!difficultyFilter.includes(exercise.difficulty)) {
      return false;
    }

    // Filter by external load (must be in experience level's allowed external loads)
    if (!externalLoadFilter.includes(exercise.external_load)) {
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
    resistance_bands: ["Resistance Bands", "TRX", "Chair", "Wall", "Mat", "Foam Roller", "None"],
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
 * @returns Map of layer name to filtered exercise pool
 */
export function createExercisePoolsForDay(
  allExercises: Array<[string, Exercise]>,
  focus: string,
  answers: QuestionnaireAnswers,
  rules: GenerationRules,
  includedLayers: string[]
): Map<string, Array<[string, Exercise]>> {
  const pools = new Map<string, Array<[string, Exercise]>>();

  // Get category priorities for this goal
  const categoryPriorities = rules.category_workout_structure.category_priority_by_goal[answers.primary_goal];

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

    const filteredExercises = filterExercisesForLayer(
      allExercises,
      focus,
      categoriesForLayer,
      answers.equipment_access,
      experienceModifier.complexity_filter,
      experienceModifier.external_load_filter,
      muscleMapping
    );

    pools.set(layer, filteredExercises);
  }

  return pools;
}

/**
 * Selects exercises using round-robin algorithm to maintain layer ratios
 *
 * @param pools - Exercise pools for each layer
 * @param rules - Generation rules configuration
 * @param answers - User's questionnaire answers
 * @param maxDuration - Maximum duration constraint in minutes
 * @returns Array of selected exercise structures
 */
export function roundRobinSelectExercises(
  pools: Map<string, Array<[string, Exercise]>>,
  rules: GenerationRules,
  answers: QuestionnaireAnswers,
  maxDuration: number
): ExerciseStructure[] {
  const selectedExercises: ExerciseStructure[] = [];
  const usedExerciseNames = new Set<string>();
  const layerRatios = rules.exercise_selection_strategy.layer_ratios;
  const layerRequirements = rules.exercise_selection_strategy.layer_requirements;

  // Track current index for each layer
  const layerIndices = new Map<string, number>();
  for (const layer of pools.keys()) {
    layerIndices.set(layer, 0);
  }

  // Determine layer order for round-robin (order matches ratio definition)
  const layerOrder = ["first", "primary", "secondary", "tertiary", "finisher", "last"];

  let currentDuration = 0;
  let roundNumber = 0;
  let maxRounds = 50; // Safety limit

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

      // Add 'ratio' exercises from this layer in this round
      for (let i = 0; i < ratio; i++) {
        if (currentIndex + i >= pool.length) {
          // No more exercises in this pool
          continue;
        }

        const [exerciseName, exerciseData] = pool[currentIndex + i];

        // Check for duplicates
        if (usedExerciseNames.has(exerciseName)) {
          // Skip duplicate and try next
          continue;
        }

        // Estimate duration
        const category = exerciseData.category;
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
        addedAnyExercise = true;
      }

      // Update index for this layer
      layerIndices.set(layer, currentIndex + ratio);
    }

    // If we couldn't add any exercises this round, we're done
    if (!addedAnyExercise) {
      break;
    }
  }

  // Ensure minimum requirements are met
  if (!hasMetMinimumRequirements(selectedExercises, layerRequirements)) {
    throw new Error("Could not meet minimum layer requirements within duration constraint");
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
  // For now, we're using a simplified check
  // In a full implementation, we'd track which layers each exercise came from
  // For MVP, we just check if we have at least a few exercises
  return exercises.length >= 3;
}
