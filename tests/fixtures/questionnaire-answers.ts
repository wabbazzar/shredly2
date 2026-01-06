/**
 * Test Fixtures for Questionnaire Answers
 *
 * Contains 6 questionnaire answer fixtures covering critical scenarios
 * and edge cases for the workout generation engine.
 */

import type { QuestionnaireAnswers } from '../../src/lib/engine/types.js';

// ============================================================================
// STANDARD SCENARIOS
// ============================================================================

/**
 * Beginner user with bodyweight-only equipment
 * 3 days per week, 30-45 minute sessions
 * Full body training split
 */
export const BEGINNER_FULL_BODY: QuestionnaireAnswers = {
  primary_goal: 'general_fitness',
  experience_level: 'beginner',
  training_frequency: '3',
  session_duration: '30-45',
  equipment_access: 'bodyweight_only',
  training_split_preference: 'full_body',
  program_duration: '3_weeks',
  progression_preference: 'linear'
};

/**
 * Intermediate user with home gym setup
 * 5 days per week, 45-60 minute sessions
 * Push/Pull/Legs split
 */
export const INTERMEDIATE_PPL: QuestionnaireAnswers = {
  primary_goal: 'muscle_gain',
  experience_level: 'intermediate',
  training_frequency: '5',
  session_duration: '45-60',
  equipment_access: 'home_gym_full',
  training_split_preference: 'push_pull_legs',
  program_duration: '3_weeks',
  progression_preference: 'volume'
};

/**
 * Advanced user with commercial gym access
 * 4 days per week, 60-90 minute sessions
 * Upper/Lower split
 */
export const ADVANCED_UPPER_LOWER: QuestionnaireAnswers = {
  primary_goal: 'muscle_gain',
  experience_level: 'advanced',
  training_frequency: '4',
  session_duration: '60-90',
  equipment_access: 'commercial_gym',
  training_split_preference: 'upper_lower',
  program_duration: '3_weeks',
  progression_preference: 'wave_loading'
};

/**
 * Expert user with commercial gym access
 * 5 days per week, 60-90 minute sessions
 * ULPPL (Upper/Lower/Push/Pull/Legs) split
 */
export const EXPERT_ULPPL_GYM: QuestionnaireAnswers = {
  primary_goal: 'muscle_gain',
  experience_level: 'expert',
  training_frequency: '5',
  session_duration: '60-90',
  equipment_access: 'commercial_gym',
  training_split_preference: 'ulppl',
  program_duration: '3_weeks',
  progression_preference: 'volume'
};

// ============================================================================
// EDGE CASES
// ============================================================================

/**
 * Edge Case: Expert user with bodyweight-only equipment
 * 6 days per week, 45-60 minute sessions
 * Tests exercise pool constraints for high experience + limited equipment
 */
export const BODYWEIGHT_ONLY_EXPERT: QuestionnaireAnswers = {
  primary_goal: 'athletic_performance',
  experience_level: 'expert',
  training_frequency: '6',
  session_duration: '45-60',
  equipment_access: 'bodyweight_only',
  training_split_preference: 'push_pull_legs',
  program_duration: '3_weeks',
  progression_preference: 'density'
};

/**
 * Edge Case: Beginner with minimal equipment (dumbbells only)
 * 3 days per week, 30-45 minute sessions
 * Tests limited equipment scenarios for beginners
 */
export const MINIMAL_EQUIPMENT_BEGINNER: QuestionnaireAnswers = {
  primary_goal: 'fat_loss',
  experience_level: 'beginner',
  training_frequency: '3',
  session_duration: '30-45',
  equipment_access: 'dumbbells_only',
  training_split_preference: 'full_body',
  program_duration: '3_weeks',
  progression_preference: 'linear'
};

// ============================================================================
// FIXTURE COLLECTION
// ============================================================================

/**
 * All fixtures in an array for easy iteration in tests
 */
export const ALL_FIXTURES: QuestionnaireAnswers[] = [
  BEGINNER_FULL_BODY,
  INTERMEDIATE_PPL,
  ADVANCED_UPPER_LOWER,
  EXPERT_ULPPL_GYM,
  BODYWEIGHT_ONLY_EXPERT,
  MINIMAL_EQUIPMENT_BEGINNER
];

/**
 * Fixture names for descriptive test output
 */
export const FIXTURE_NAMES = [
  'BEGINNER_FULL_BODY',
  'INTERMEDIATE_PPL',
  'ADVANCED_UPPER_LOWER',
  'EXPERT_ULPPL_GYM',
  'BODYWEIGHT_ONLY_EXPERT',
  'MINIMAL_EQUIPMENT_BEGINNER'
];
