/**
 * Test Fixtures for Questionnaire Answers
 *
 * Contains questionnaire answer fixtures covering critical scenarios
 * and edge cases for the workout generation engine.
 *
 * Uses new v2.0 format with 6 required questions.
 */

import type { QuestionnaireAnswers } from '../../src/lib/engine/types.js';

// ============================================================================
// STANDARD SCENARIOS
// ============================================================================

/**
 * Beginner user with bodyweight-only equipment
 * 3 days per week, 30 minute sessions
 * Tone goal (general fitness)
 */
export const BEGINNER_BODYWEIGHT: QuestionnaireAnswers = {
  goal: 'tone',
  experience_level: 'beginner',
  training_frequency: '3',
  session_duration: '30',
  equipment_access: 'bodyweight_only',
  program_duration: '3'
};

/**
 * Intermediate user with full gym access
 * 5 days per week, 60 minute sessions
 * Build muscle goal
 */
export const INTERMEDIATE_GYM: QuestionnaireAnswers = {
  goal: 'build_muscle',
  experience_level: 'intermediate',
  training_frequency: '5',
  session_duration: '60',
  equipment_access: 'full_gym',
  program_duration: '4'
};

/**
 * Advanced user with full gym access
 * 4 days per week, 60 minute sessions
 * Build muscle goal
 */
export const ADVANCED_GYM: QuestionnaireAnswers = {
  goal: 'build_muscle',
  experience_level: 'advanced',
  training_frequency: '4',
  session_duration: '60',
  equipment_access: 'full_gym',
  program_duration: '6'
};

/**
 * Advanced user with full gym access
 * 5 days per week, 60 minute sessions
 * Build muscle goal
 */
export const ADVANCED_5DAY_GYM: QuestionnaireAnswers = {
  goal: 'build_muscle',
  experience_level: 'advanced',
  training_frequency: '5',
  session_duration: '60',
  equipment_access: 'full_gym',
  program_duration: '4'
};

// ============================================================================
// EDGE CASES
// ============================================================================

/**
 * Edge Case: Advanced user with bodyweight-only equipment
 * 6 days per week, 30 minute sessions
 * Tests exercise pool constraints for high experience + limited equipment
 */
export const BODYWEIGHT_ONLY_ADVANCED: QuestionnaireAnswers = {
  goal: 'tone',
  experience_level: 'advanced',
  training_frequency: '6',
  session_duration: '30',
  equipment_access: 'bodyweight_only',
  program_duration: '3'
};

/**
 * Edge Case: Beginner with dumbbells only
 * 3 days per week, 30 minute sessions
 * Lose weight goal
 */
export const BEGINNER_DUMBBELLS_LOSE_WEIGHT: QuestionnaireAnswers = {
  goal: 'lose_weight',
  experience_level: 'beginner',
  training_frequency: '3',
  session_duration: '30',
  equipment_access: 'dumbbells_only',
  program_duration: '3'
};

/**
 * Edge Case: Advanced with lose weight goal
 * 4 days per week, 60 minute sessions
 * Tests fat loss with advanced experience
 */
export const ADVANCED_LOSE_WEIGHT: QuestionnaireAnswers = {
  goal: 'lose_weight',
  experience_level: 'advanced',
  training_frequency: '4',
  session_duration: '60',
  equipment_access: 'full_gym',
  program_duration: '4'
};

/**
 * Edge Case: Advanced user with dumbbells-only equipment
 * 5 days per week, 20 minute sessions
 * Tests difficulty filter relaxation for dumbbells_only with advanced experience
 */
export const ADVANCED_DUMBBELLS_SHORT: QuestionnaireAnswers = {
  goal: 'tone',
  experience_level: 'advanced',
  training_frequency: '5',
  session_duration: '20',
  equipment_access: 'dumbbells_only',
  program_duration: '3'
};

// ============================================================================
// FIXTURE COLLECTION
// ============================================================================

/**
 * All fixtures in an array for easy iteration in tests
 */
export const ALL_FIXTURES: QuestionnaireAnswers[] = [
  BEGINNER_BODYWEIGHT,
  INTERMEDIATE_GYM,
  ADVANCED_GYM,
  ADVANCED_5DAY_GYM,
  BODYWEIGHT_ONLY_ADVANCED,
  BEGINNER_DUMBBELLS_LOSE_WEIGHT,
  ADVANCED_LOSE_WEIGHT,
  ADVANCED_DUMBBELLS_SHORT
];

/**
 * Fixture names for descriptive test output
 */
export const FIXTURE_NAMES = [
  'BEGINNER_BODYWEIGHT',
  'INTERMEDIATE_GYM',
  'ADVANCED_GYM',
  'ADVANCED_5DAY_GYM',
  'BODYWEIGHT_ONLY_ADVANCED',
  'BEGINNER_DUMBBELLS_LOSE_WEIGHT',
  'ADVANCED_LOSE_WEIGHT',
  'ADVANCED_DUMBBELLS_SHORT'
];

// ============================================================================
// LEGACY FIXTURE ALIASES (for backward compatibility in tests)
// ============================================================================

// These aliases help tests that reference old fixture names continue to work
export const BEGINNER_FULL_BODY = BEGINNER_BODYWEIGHT;
export const INTERMEDIATE_PPL = INTERMEDIATE_GYM;
export const ADVANCED_UPPER_LOWER = ADVANCED_GYM;
export const EXPERT_ULPPL_GYM = ADVANCED_5DAY_GYM;
export const BODYWEIGHT_ONLY_EXPERT = BODYWEIGHT_ONLY_ADVANCED;
export const MINIMAL_EQUIPMENT_BEGINNER = BEGINNER_DUMBBELLS_LOSE_WEIGHT;
export const EXPERT_FAT_LOSS_NO_PREFERENCE = ADVANCED_LOSE_WEIGHT;
export const ADVANCED_DUMBBELLS_SHORT_SESSION = ADVANCED_DUMBBELLS_SHORT;
