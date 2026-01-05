/**
 * TypeScript Type Definitions for Shredly 2.0 Workout Generation Engine
 *
 * This file contains all type definitions for:
 * - Questionnaire answers
 * - Phase 1: Structural generation (exercise selection)
 * - Phase 2: Parameterization (week-by-week calculations)
 * - Exercise database
 * - Generation rules configuration
 */

// ============================================================================
// QUESTIONNAIRE TYPES
// ============================================================================

export interface QuestionnaireAnswers {
  primary_goal: "muscle_gain" | "fat_loss" | "athletic_performance" | "general_fitness" | "rehabilitation" | "body_recomposition";
  experience_level: "complete_beginner" | "beginner" | "intermediate" | "advanced" | "expert";
  training_frequency: "2" | "3" | "4" | "5" | "6" | "7";
  session_duration: "20-30" | "30-45" | "45-60" | "60-90" | "90+" | "flexible";
  equipment_access: "commercial_gym" | "home_gym_full" | "home_gym_basic" | "dumbbells_only" | "resistance_bands" | "bodyweight_only" | "minimal_equipment";
  training_split_preference?: "no_preference" | "full_body" | "upper_lower" | "push_pull_legs" | "ulppl";
  cardio_preference?: "none" | "integrated" | "separate_sessions" | "hiit" | "liss" | "sport_specific";
  specific_focus_areas?: ("core_stability" | "posture" | "mobility_flexibility" | "functional_strength" | "power_explosiveness" | "muscle_imbalances" | "specific_sport")[];
  program_duration?: "3_weeks" | "4_weeks" | "6_weeks" | "8_weeks" | "12_weeks" | "16_weeks" | "ongoing";
  progression_preference?: "linear" | "volume" | "density" | "wave_loading" | "no_preference";
}

// ============================================================================
// PHASE 1: STRUCTURAL GENERATION TYPES
// ============================================================================

export interface WorkoutStructure {
  id: string;
  name: string;
  description: string;
  weeks: number;
  daysPerWeek: number;
  metadata: WorkoutMetadata;
  days: {
    [dayNumber: string]: DayStructure;
  };
}

export interface WorkoutMetadata {
  difficulty: "Beginner" | "Intermediate" | "Advanced" | "Expert";
  equipment: string[];
  estimatedDuration: string;
  tags: string[];
}

export interface DayStructure {
  dayNumber: number;
  type: "gym" | "home" | "outdoor" | "recovery";
  focus: "Push" | "Pull" | "Legs" | "Upper" | "Lower" | "Full Body" | "Mobility";
  exercises: ExerciseStructure[];
}

export interface ExerciseStructure {
  name: string; // References exercise_database.json (sampled from 323 exercises)
  category?: "emom" | "amrap" | "circuit" | "interval"; // For compound exercises
  sub_exercises?: SubExerciseStructure[];
  progressionScheme: "linear" | "density" | "wave_loading" | "volume" | "static";
  intensityProfile: "light" | "moderate" | "moderate_heavy" | "heavy" | "max" | "tabata" | "liss" | "hiit" | "amrap" | "extended";
}

export interface SubExerciseStructure {
  name: string;
  progressionScheme: "linear" | "density" | "volume" | "static";
}

// ============================================================================
// PHASE 2: PARAMETERIZED WORKOUT TYPES (WORKOUT_SPEC.md FORMAT)
// ============================================================================

export interface ParameterizedWorkout {
  id: string;
  name: string;
  description: string;
  version: string; // "2.0.0"
  weeks: number;
  daysPerWeek: number;
  metadata: WorkoutMetadata;
  days: {
    [dayNumber: string]: ParameterizedDay;
  };
}

export interface ParameterizedDay {
  dayNumber: number;
  type: "gym" | "home" | "outdoor" | "recovery";
  focus: string;
  exercises: ParameterizedExercise[];
}

export interface ParameterizedExercise {
  name: string;
  category_override?: string; // Rare - only when DB category doesn't fit
  category?: "emom" | "amrap" | "circuit" | "interval"; // For compound exercises
  week1: WeekParameters;
  week2: WeekParameters;
  week3: WeekParameters;
  week4?: WeekParameters;
  week5?: WeekParameters;
  week6?: WeekParameters;
  week8?: WeekParameters;
  week12?: WeekParameters;
  week16?: WeekParameters;
  sub_exercises?: ParameterizedSubExercise[];
}

export interface ParameterizedSubExercise {
  name: string;
  week1: WeekParameters;
  week2: WeekParameters;
  week3: WeekParameters;
  week4?: WeekParameters;
  week5?: WeekParameters;
  week6?: WeekParameters;
  week8?: WeekParameters;
  week12?: WeekParameters;
  week16?: WeekParameters;
}

export interface WeekParameters {
  sets?: number;
  reps?: number | string; // number or "8-12" or "AMRAP"
  work_time_minutes?: number;
  rest_time_minutes?: number;
  weight?: WeightSpecification;
  tempo?: string; // "3-1-2" format
  set_blocks?: SetBlock[]; // Advanced - mutually exclusive with flat sets/reps
}

export type WeightSpecification =
  | string // "light", "moderate", "heavy", etc.
  | { type: "percent_tm"; value: number }
  | { type: "percent_bw"; value: number }
  | { type: "absolute"; value: number; unit: "lbs" | "kg" };

export interface SetBlock {
  sets: number;
  reps: number | string;
  rest_time_minutes?: number;
  weight?: WeightSpecification;
  tempo?: string;
}

// ============================================================================
// EXERCISE DATABASE TYPES
// ============================================================================

export interface ExerciseDatabase {
  exercise_database: {
    version: string;
    last_updated: string;
    total_exercises: number;
    categories: {
      [category: string]: {
        description: string;
        exercises: {
          [exerciseName: string]: Exercise;
        };
      };
    };
  };
}

export interface Exercise {
  category: string;
  typical_sets: number;
  typical_reps: string;
  equipment: string[];
  muscle_groups: string[];
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  variations: string[];
  isometric: boolean;
  external_load: "never" | "sometimes" | "always";
}

// ============================================================================
// GENERATION RULES TYPES
// ============================================================================

export interface GenerationRules {
  version: string;
  intensity_profiles: IntensityProfiles;
  progression_schemes: ProgressionSchemes;
  experience_modifiers: ExperienceModifiers;
  time_estimates: TimeEstimates;
  category_workout_structure: CategoryWorkoutStructure;
  duration_constraints: DurationConstraints;
  split_patterns: SplitPatterns;
  split_muscle_group_mapping: SplitMuscleGroupMapping;
  exercise_selection_strategy: ExerciseSelectionStrategy;
}

export interface IntensityProfiles {
  [category: string]: {
    [intensity: string]: {
      base_sets?: number;
      base_reps?: number | string;
      base_rest_time_minutes?: number;
      base_weight_percent_tm?: number;
      base_weight_descriptor?: string;
      base_work_time_minutes?: number;
      base_target_reps_per_minute?: number;
      base_target_rounds?: number;
      base_exercises_per_circuit?: number;
      base_rest_between_circuits_minutes?: number;
      intensity_description?: string;
    };
  };
}

export interface ProgressionSchemes {
  [scheme: string]: {
    name: string;
    description: string;
    applies_to: string[];
    rules: {
      [rule: string]: any;
    };
  };
}

export interface ExperienceModifiers {
  [level: string]: {
    weight_type: "descriptor" | "percent_tm";
    volume_multiplier: number;
    rest_time_multiplier: number;
    complexity_filter: string[];
    external_load_filter: string[];
    can_use_set_blocks?: boolean;
    can_use_wave_loading?: boolean;
    can_use_auto_regulation?: boolean;
  };
}

export interface DurationConstraints {
  [duration: string]: {
    total_minutes_min: number;
    total_minutes_max: number;
    include_layers: string[];
    description: string;
  };
}

export interface SplitPatterns {
  [splitType: string]: {
    pattern: string[];
    description: string;
    [key: string]: any; // For examples like "3_days", "5_days", etc.
  };
}

export interface SplitMuscleGroupMapping {
  [focus: string]: {
    include_muscle_groups: string[];
    exclude_muscle_groups?: string[];
    description: string;
  };
}

export interface CategoryWorkoutStructure {
  warmup_categories?: string[];
  main_strength_categories?: string[];
  volume_categories?: string[];
  metabolic_categories?: string[];
  cooldown_categories?: string[];
  category_display_order?: string[];
  category_priority_by_goal: {
    [goal: string]: {
      first: string[];
      primary: string[];
      secondary: string[];
      tertiary: string[];
      finisher: string[];
      last: string[];
    };
  };
  [key: string]: any;
}

export interface ExerciseSelectionStrategy {
  description?: string;
  strategy: string;
  algorithm: string;
  layer_ratios: {
    [layer: string]: number;
  };
  layer_requirements: {
    must_include: string[];
    optional: string[];
    always_end_with_last_if_available: boolean;
  };
  diversity_rules: {
    no_duplicate_exercises: boolean;
    muscle_diversity_within_day: boolean;
    description: string;
  };
  equipment_priority: {
    description: string;
    prefer_available_equipment: boolean;
    fallback_to_bodyweight: boolean;
  };
  [key: string]: any; // For filling_algorithm_pseudocode, examples, etc.
}

export interface TimeEstimates {
  setup_time_minutes: {
    [category: string]: number;
  };
  seconds_per_rep: {
    [key: string]: number;
  };
  transition_time_minutes: {
    between_exercises: number;
    between_categories: number;
  };
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Represents a filtered pool of exercises for a specific layer
 */
export interface ExercisePool {
  layer: string;
  category: string;
  exercises: Exercise[];
  exerciseNames: string[];
}

/**
 * Represents duration estimation for an exercise
 */
export interface DurationEstimate {
  setupTime: number;
  workTime: number;
  restTime: number;
  totalTime: number;
}
