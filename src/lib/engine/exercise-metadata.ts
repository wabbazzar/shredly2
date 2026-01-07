/**
 * Exercise Metadata Module - Single Source of Truth for Exercise Properties
 *
 * Provides centralized metadata lookup for exercise database properties.
 * Used by BOTH generator (phase2-parameters.ts) and editor (workout-editor.ts)
 * to ensure consistent field visibility and weight assignment rules.
 *
 * Core Rule: external_load metadata drives field visibility
 * - "always"    -> ALWAYS show/assign weight
 * - "never"     -> NEVER show/assign weight
 * - "sometimes" -> show/assign weight if present in data
 *
 * Performance: Singleton cache ensures O(1) lookup after first access per exercise.
 */

import exerciseDatabaseJson from '../../data/exercise_database.json' with { type: 'json' };

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ExerciseMetadata {
  category: string;
  external_load: 'never' | 'sometimes' | 'always';
  isometric: boolean;
  typical_reps?: string;
  difficulty: string;
  muscle_groups: string[];
  equipment: string[];
  typical_sets?: number;
  variations?: string[];
}

// ============================================================================
// SINGLETON CACHE FOR PERFORMANCE
// ============================================================================

/**
 * Singleton cache to avoid repeated JSON traversal (O(n) -> O(1) after first lookup)
 *
 * Memory footprint: ~1KB for 8 exercises (typical workout size)
 * Cache clears on module reload (no memory leak in hot-reload dev)
 */
class ExerciseMetadataCache {
  private cache = new Map<string, ExerciseMetadata | null>();

  /**
   * Get exercise metadata from cache or database
   * Returns null for compound parent names (e.g., "EMOM 10 minutes")
   * Returns null for custom exercises not in database
   */
  get(exerciseName: string): ExerciseMetadata | null {
    // Check cache first
    if (this.cache.has(exerciseName)) {
      return this.cache.get(exerciseName)!;
    }

    // Search exercise database
    const metadata = this.findInDatabase(exerciseName);
    this.cache.set(exerciseName, metadata);
    return metadata;
  }

  /**
   * Search all categories in exercise database for matching exercise name
   * Returns null if not found (compound parent or custom exercise)
   */
  private findInDatabase(exerciseName: string): ExerciseMetadata | null {
    const db = exerciseDatabaseJson.exercise_database;

    for (const categoryKey of Object.keys(db.categories)) {
      const category = db.categories[categoryKey as keyof typeof db.categories];
      const exercises = category.exercises;

      if (exercises[exerciseName as keyof typeof exercises]) {
        return exercises[exerciseName as keyof typeof exercises] as ExerciseMetadata;
      }
    }

    return null; // Not found - compound parent or custom exercise
  }

  /**
   * Clear cache (for testing or module reload)
   */
  clear(): void {
    this.cache.clear();
  }
}

// Singleton instance
const metadataCache = new ExerciseMetadataCache();

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get exercise metadata from database
 *
 * @param exerciseName - Name of exercise (e.g., "Bench Press", "Plank Hold")
 * @returns Exercise metadata or null if not found
 *
 * Returns null for:
 * - Compound parent names (e.g., "EMOM 10 minutes", "Circuit 5 rounds")
 * - Custom user-created exercises not in database
 */
export function getExerciseMetadata(exerciseName: string): ExerciseMetadata | null {
  return metadataCache.get(exerciseName);
}

/**
 * Determine if weight field should be shown in editor UI
 *
 * Core visibility rule based on external_load metadata:
 * - "always"    -> ALWAYS show weight (e.g., Bench Press, Dumbbell Curls)
 * - "never"     -> NEVER show weight (e.g., Plank Hold, Push-ups)
 * - "sometimes" -> show weight if present in data (e.g., Wall Sit with optional vest)
 *
 * @param exerciseName - Name of exercise
 * @param currentWeight - Current weight value in data (undefined if not present)
 * @returns true if weight field should be visible
 */
export function shouldShowWeightField(exerciseName: string, currentWeight?: any): boolean {
  const metadata = getExerciseMetadata(exerciseName);

  if (!metadata) {
    // Fallback for custom exercises or compound parents: show weight if present in data
    return currentWeight !== undefined;
  }

  switch (metadata.external_load) {
    case 'always':
      return true; // ALWAYS show weight
    case 'never':
      return false; // NEVER show weight
    case 'sometimes':
      return currentWeight !== undefined; // Show if present in data
  }
}

/**
 * Determine if weight should be assigned during workout generation
 *
 * Used by generator (phase2-parameters.ts) to decide if weight should be assigned
 * to newly generated exercises.
 *
 * @param exerciseName - Name of exercise
 * @returns true if weight should be assigned
 */
export function shouldAssignWeightOnGeneration(exerciseName: string): boolean {
  const metadata = getExerciseMetadata(exerciseName);

  if (!metadata) {
    // Fallback for custom exercises: default to no weight
    return false;
  }

  // Assign weight for "always" and "sometimes" (never assign for "never")
  return metadata.external_load !== 'never';
}

/**
 * Check if exercise can toggle to reps mode
 *
 * Isometric exercises cannot use reps (e.g., Plank Hold, Wall Sit)
 * Non-isometric exercises can use either reps or work_time
 *
 * @param exerciseName - Name of exercise
 * @returns true if exercise can use reps mode
 */
export function canToggleToReps(exerciseName: string): boolean {
  const metadata = getExerciseMetadata(exerciseName);

  if (!metadata) {
    // Fallback for custom exercises: allow toggle
    return true;
  }

  // Isometric exercises can't use reps
  return !metadata.isometric;
}

/**
 * Check if exercise can toggle to work_time mode
 *
 * All exercises can use work_time mode (universal compatibility)
 *
 * @param exerciseName - Name of exercise
 * @returns true (always)
 */
export function canToggleToWorkTime(exerciseName: string): boolean {
  // All exercises can use work_time mode
  return true;
}

/**
 * Get default work mode for exercise
 *
 * Isometric exercises default to work_time (e.g., Plank Hold)
 * Non-isometric exercises default to reps (e.g., Bench Press)
 *
 * @param exerciseName - Name of exercise
 * @returns 'reps' or 'work_time'
 */
export function getDefaultWorkMode(exerciseName: string): 'reps' | 'work_time' {
  const metadata = getExerciseMetadata(exerciseName);

  if (!metadata) {
    // Fallback for custom exercises: default to reps
    return 'reps';
  }

  return metadata.isometric ? 'work_time' : 'reps';
}

/**
 * Clear metadata cache (for testing)
 */
export function clearCache(): void {
  metadataCache.clear();
}
