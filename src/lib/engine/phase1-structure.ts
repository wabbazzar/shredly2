/**
 * Phase 1: Structural Generation - Split Assignment
 *
 * Determines training split and assigns day focus for each training day
 * All logic is 100% config-driven from workout_generation_rules.json
 */

import type {
  QuestionnaireAnswers,
  GenerationRules,
  BlockSpec,
  ProgressionByGoal
} from './types.js';

/**
 * Gets prescriptive split directly from goal + frequency using new decision tree
 *
 * @param goal - User's goal (build_muscle, tone, lose_weight)
 * @param frequency - Training frequency (2-7)
 * @param rules - Generation rules configuration
 * @returns Array of day focus strings
 */
export function getPrescriptiveSplit(
  goal: QuestionnaireAnswers['goal'],
  frequency: number,
  rules: GenerationRules
): string[] {
  const prescriptiveSplits = rules.prescriptive_splits;
  const frequencyKey = frequency.toString();

  const goalSplits = prescriptiveSplits[goal];
  if (!goalSplits) {
    throw new Error(`No prescriptive splits configured for goal: ${goal}`);
  }

  const dayFocuses = goalSplits[frequencyKey];
  if (!dayFocuses) {
    throw new Error(
      `No prescriptive split configured for goal=${goal}, frequency=${frequency}. ` +
      `Check workout_generation_rules.json prescriptive_splits section.`
    );
  }

  return dayFocuses;
}

/**
 * Extracts the base focus type from a suffixed focus string
 * e.g., "Upper-HIIT" -> "Upper", "Push-Volume" -> "Push", "Flexibility" -> "Flexibility"
 *
 * @param focus - The focus string, possibly with suffix
 * @returns The base focus type
 */
export function getBaseFocus(focus: string): string {
  // Special cases that map to Mobility for muscle group lookup
  // These focus types use the same muscle groups as Mobility (include_muscle_groups: ["all"])
  if (focus === 'Flexibility' || focus === 'FullBody-Mobility') {
    return 'Mobility';
  }

  // Check for known suffixes
  const suffixes = ['-HIIT', '-Volume', '-Strength', '-Mobility'];
  for (const suffix of suffixes) {
    if (focus.endsWith(suffix)) {
      return focus.slice(0, -suffix.length);
    }
  }

  // No suffix found, return as-is
  return focus;
}

/**
 * Parses the day type suffix from a focus string
 *
 * @param focus - The focus string, possibly with suffix
 * @returns The suffix type or null if no suffix
 */
export function parseFocusSuffix(focus: string): 'HIIT' | 'Volume' | 'Strength' | 'Mobility' | null {
  if (focus.endsWith('-HIIT')) return 'HIIT';
  if (focus.endsWith('-Volume')) return 'Volume';
  if (focus.endsWith('-Strength')) return 'Strength';
  if (focus.endsWith('-Mobility')) return 'Mobility';
  return null;
}

/**
 * Gets progression scheme directly from goal (v2.0)
 * Progression is derived from goal, not user-selectable
 *
 * @param goal - User's goal (build_muscle, tone, lose_weight)
 * @param exerciseCategory - Exercise category (strength, mobility, etc.)
 * @param rules - Generation rules configuration
 * @returns Progression scheme type
 */
export function getProgressionFromGoal(
  goal: QuestionnaireAnswers['goal'],
  exerciseCategory: string,
  rules: GenerationRules
): "linear" | "density" | "wave_loading" | "volume" | "static" {
  // For mobility, flexibility, and cardio exercises, always use static (no progression)
  if (exerciseCategory === 'mobility' || exerciseCategory === 'flexibility' || exerciseCategory === 'cardio') {
    return 'static';
  }

  // Note: Compound exercise categories (emom, amrap, circuit, interval) get 'density' progression
  // hardcoded in constructCompoundExercise(), so this function is only called for strength/bodyweight

  // For strength and bodyweight, derive from goal using config
  const progressionByGoal = rules.progression_by_goal as ProgressionByGoal;
  const progression = progressionByGoal[goal];

  if (!progression) {
    throw new Error(
      `No progression configured for goal: ${goal}. ` +
      `Check workout_generation_rules.json progression_by_goal section.`
    );
  }

  return progression as "linear" | "density" | "wave_loading" | "volume";
}

/**
 * Maps focus suffix to day type key for config lookup
 */
function suffixToDayType(suffix: 'HIIT' | 'Volume' | 'Strength' | 'Mobility' | null): string {
  if (suffix === 'HIIT') return 'hiit';
  if (suffix === 'Volume') return 'volume';
  if (suffix === 'Strength') return 'strength';
  if (suffix === 'Mobility') return 'mobility';
  return 'standard';
}

/**
 * Maps equipment access from questionnaire to config key
 */
function equipmentToConfigKey(equipment: string): 'full_gym' | 'dumbbells_only' | 'bodyweight_only' {
  // Map legacy equipment values to new config keys
  const equipmentMap: { [key: string]: 'full_gym' | 'dumbbells_only' | 'bodyweight_only' } = {
    'commercial_gym': 'full_gym',
    'home_gym_full': 'full_gym',
    'home_gym_basic': 'dumbbells_only',
    'dumbbells_only': 'dumbbells_only',
    'bodyweight_only': 'bodyweight_only',
    'minimal_equipment': 'bodyweight_only',
    // New questionnaire values
    'full_gym': 'full_gym'
  };
  return equipmentMap[equipment] || 'bodyweight_only';
}

/**
 * Derives the equipment config key from an array of available equipment.
 * Used for location-based equipment profiles (v2.1).
 *
 * @param equipmentArray - Array of equipment types available at location
 * @returns Config key for day structure selection
 */
export function equipmentArrayToConfigKey(equipmentArray: string[]): 'full_gym' | 'dumbbells_only' | 'bodyweight_only' {
  // Check for barbell/rack - indicates full gym capability
  const hasBarbell = equipmentArray.includes('Barbell');
  const hasRack = equipmentArray.includes('Squat Rack') || equipmentArray.includes('Power Rack');

  if (hasBarbell && hasRack) {
    return 'full_gym';
  }

  // Check for dumbbells - indicates dumbbell-level capability
  const hasDumbbells = equipmentArray.includes('Dumbbell') || equipmentArray.includes('Dumbbells');
  if (hasDumbbells) {
    return 'dumbbells_only';
  }

  // Default to bodyweight
  return 'bodyweight_only';
}

/**
 * Builds day structure based on focus suffix, equipment, and duration
 *
 * @param dayFocus - Day focus with possible suffix (e.g., "Upper-HIIT", "Push-Volume", "Push")
 * @param equipment - User's equipment access level (legacy string) OR equipment array
 * @param duration - Session duration in minutes (20, 30, or 60)
 * @param rules - Generation rules configuration
 * @param availableEquipment - Optional array of equipment at location (v2.1)
 * @returns Array of resolved block specifications with concrete counts
 */
export function buildDayStructure(
  dayFocus: string,
  equipment: string,
  duration: number,
  rules: GenerationRules,
  availableEquipment?: string[]
): BlockSpec[] {
  // Special handling for Flexibility day - entirely mobility-focused
  if (dayFocus === 'Flexibility') {
    return [
      { type: 'mobility', count: 3 },
      { type: 'compound', count: 1 }
    ];
  }

  // Parse the focus suffix to determine day type
  const suffix = parseFocusSuffix(dayFocus);
  const dayType = suffixToDayType(suffix);

  // Map equipment to config key - use equipment array if provided (v2.1), otherwise legacy string
  const equipmentKey = availableEquipment
    ? equipmentArrayToConfigKey(availableEquipment)
    : equipmentToConfigKey(equipment);

  // Get day structure from config
  const equipmentConfig = rules.day_structure_by_equipment[equipmentKey];
  if (!equipmentConfig) {
    throw new Error(`No day structure config for equipment: ${equipmentKey}`);
  }

  const dayConfig = equipmentConfig[dayType];
  if (!dayConfig || typeof dayConfig === 'string') {
    // Fall back to standard if specific day type not found
    const standardConfig = equipmentConfig.standard;
    if (!standardConfig || typeof standardConfig === 'string') {
      throw new Error(`No standard day structure config for equipment: ${equipmentKey}`);
    }
    return resolveBlockCounts(standardConfig.blocks, duration, rules);
  }

  return resolveBlockCounts(dayConfig.blocks, duration, rules);
}

/**
 * Resolves 'time_based' block counts to concrete numbers based on duration
 */
function resolveBlockCounts(
  blocks: BlockSpec[],
  duration: number,
  rules: GenerationRules
): BlockSpec[] {
  const durationKey = duration.toString();
  const compoundCount = rules.compound_blocks_by_time[durationKey];

  // Default to 2 if not found
  const resolvedCompoundCount = typeof compoundCount === 'number' ? compoundCount : 2;

  return blocks.map(block => {
    if (block.count === 'time_based') {
      return { ...block, count: resolvedCompoundCount };
    }
    return block;
  });
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
  exerciseCategory: string,
  rules: GenerationRules
): "light" | "moderate" | "moderate_heavy" | "heavy" | "max" | "tabata" | "liss" | "hiit" | "amrap" | "extended" {
  const intensityConfig = rules.intensity_profile_by_layer_and_category;

  // Try category-specific mapping first
  const categoryConfig = intensityConfig[exerciseCategory];
  if (categoryConfig && typeof categoryConfig === 'object') {
    // Check if layer has specific override
    if (categoryConfig[layer]) {
      return categoryConfig[layer] as any;
    }
    // Otherwise use category's default
    if (categoryConfig.default) {
      return categoryConfig.default as any;
    }
  }

  // Fall back to default layer mapping
  const defaultConfig = intensityConfig.default;
  if (defaultConfig && defaultConfig[layer]) {
    return defaultConfig[layer] as any;
  }

  // Ultimate fallback
  return 'moderate';
}

