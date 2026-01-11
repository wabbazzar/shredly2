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

/**
 * New simplified questionnaire answers (v2.0)
 * - 6 required questions
 * - Simplified options for goal, duration, experience, equipment
 * - No user-selectable split or progression (derived from goal)
 */
export interface QuestionnaireAnswers {
  goal: "build_muscle" | "tone" | "lose_weight";
  session_duration: "20" | "30" | "60";
  experience_level: "beginner" | "intermediate" | "advanced";
  equipment_access: "full_gym" | "dumbbells_only" | "bodyweight_only";
  training_frequency: "2" | "3" | "4" | "5" | "6" | "7";
  program_duration: "3" | "4" | "6";
}

/**
 * Legacy questionnaire format (v1.0) - used internally for backward compatibility
 * until Phases 2-5 are complete
 */
export interface LegacyQuestionnaireAnswers {
  primary_goal: "muscle_gain" | "fat_loss" | "athletic_performance" | "general_fitness" | "rehabilitation" | "body_recomposition";
  experience_level: "complete_beginner" | "beginner" | "intermediate" | "advanced" | "expert";
  training_frequency: "2" | "3" | "4" | "5" | "6" | "7";
  session_duration: "20-30" | "30-45" | "45-60" | "60-90" | "90+" | "flexible";
  equipment_access: "commercial_gym" | "home_gym_full" | "home_gym_basic" | "dumbbells_only" | "bodyweight_only" | "minimal_equipment";
  training_split_preference?: "no_preference" | "full_body" | "upper_lower" | "push_pull_legs" | "ulppl";
  program_duration?: "3_weeks" | "4_weeks" | "6_weeks" | "8_weeks" | "12_weeks" | "16_weeks" | "ongoing";
  progression_preference?: "linear" | "volume" | "density" | "wave_loading" | "no_preference";
}

/**
 * Maps new simplified questionnaire answers to legacy format
 * This allows existing generator logic to work during transition
 */
export function mapToLegacyAnswers(answers: QuestionnaireAnswers): LegacyQuestionnaireAnswers {
  // Map goal -> primary_goal
  const goalMap: Record<QuestionnaireAnswers['goal'], LegacyQuestionnaireAnswers['primary_goal']> = {
    build_muscle: 'muscle_gain',
    tone: 'general_fitness',
    lose_weight: 'fat_loss'
  };

  // Map session_duration -> legacy ranges
  const durationMap: Record<QuestionnaireAnswers['session_duration'], LegacyQuestionnaireAnswers['session_duration']> = {
    '20': '20-30',
    '30': '30-45',
    '60': '45-60'  // 60 min maps to 45-60 range
  };

  // Map equipment_access -> legacy values
  const equipmentMap: Record<QuestionnaireAnswers['equipment_access'], LegacyQuestionnaireAnswers['equipment_access']> = {
    full_gym: 'commercial_gym',
    dumbbells_only: 'dumbbells_only',
    bodyweight_only: 'bodyweight_only'
  };

  // Map program_duration -> legacy format with _weeks suffix
  const programMap: Record<QuestionnaireAnswers['program_duration'], NonNullable<LegacyQuestionnaireAnswers['program_duration']>> = {
    '3': '3_weeks',
    '4': '4_weeks',
    '6': '6_weeks'
  };

  // Map goal -> progression (derived, not user-selected)
  const progressionMap: Record<QuestionnaireAnswers['goal'], NonNullable<LegacyQuestionnaireAnswers['progression_preference']>> = {
    build_muscle: 'linear',
    tone: 'volume',
    lose_weight: 'density'
  };

  return {
    primary_goal: goalMap[answers.goal],
    experience_level: answers.experience_level, // beginner/intermediate/advanced map directly
    training_frequency: answers.training_frequency,
    session_duration: durationMap[answers.session_duration],
    equipment_access: equipmentMap[answers.equipment_access],
    training_split_preference: 'no_preference', // No longer user-selectable
    program_duration: programMap[answers.program_duration],
    progression_preference: progressionMap[answers.goal]
  };
}

// ============================================================================
// TIME UNIT TYPES
// ============================================================================

/**
 * Time unit for explicit time value specification
 * Prevents floating point precision errors by using appropriate units
 */
export type TimeUnit = "seconds" | "minutes";

/**
 * Time value with explicit unit
 * Used for rest times and work times to avoid ambiguity
 */
export interface TimeValue {
  value: number;
  unit: TimeUnit;
}

/**
 * Sub-exercise work mode for compound blocks
 * - "reps": Sub-exercises get reps from their own category (EMOM, AMRAP behavior)
 * - "time": Sub-exercises get work_time/rest_time from parent config (Interval behavior)
 */
export type SubWorkMode = "reps" | "time";

/**
 * Parsed time value with inferred unit from field name
 */
export interface ParsedTimeValue {
  value: number;
  unit: TimeUnit;
  displayValue: string; // e.g., "30 seconds" or "2 minutes"
}

/**
 * Helper type for time field suffixes
 */
export type TimeFieldSuffix = "_seconds" | "_minutes";

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

/**
 * Day focus types - base types and suffixed variants
 * Base: Push, Pull, Legs, Upper, Lower, Full Body, Mobility
 * Suffixes: -HIIT, -Volume, -Strength, -Mobility
 * Special: Flexibility, FullBody-Mobility
 */
export type DayFocus =
  | "Push" | "Pull" | "Legs" | "Upper" | "Lower" | "Full Body" | "Mobility"
  | "Push-HIIT" | "Pull-HIIT" | "Legs-HIIT" | "Upper-HIIT" | "Lower-HIIT"
  | "Push-Volume" | "Pull-Volume" | "Legs-Volume" | "Upper-Volume" | "Lower-Volume"
  | "Push-Strength" | "Pull-Strength" | "Legs-Strength"
  | "FullBody-Mobility" | "Flexibility";

export interface DayStructure {
  dayNumber: number;
  type: "gym" | "home" | "outdoor" | "recovery";
  focus: DayFocus;
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
  work_time_unit?: TimeUnit; // Explicit unit for work time
  rest_time_minutes?: number;
  rest_time_unit?: TimeUnit; // Explicit unit for rest time
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
  rest_time_unit?: TimeUnit; // Explicit unit for rest time
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

/**
 * Progression by goal configuration (v2.0)
 * Maps new goal values directly to progression scheme
 */
export interface ProgressionByGoal {
  description: string;
  build_muscle: string;
  tone: string;
  lose_weight: string;
}

export interface IntensityProfileByLayerAndCategory {
  description: string;
  default: {
    [layer: string]: string; // Allow any layer key
    first: string;
    primary: string;
    secondary: string;
    tertiary: string;
    finisher: string;
    last: string;
  };
  [category: string]: any; // Allow any category with optional layer overrides and default
}

/**
 * Prescriptive splits configuration
 * Maps goal + frequency to deterministic day focus array
 */
export interface PrescriptiveSplits {
  description: string;
  build_muscle: {
    [frequency: string]: string[];
  };
  tone: {
    [frequency: string]: string[];
  };
  lose_weight: {
    [frequency: string]: string[];
  };
}

/**
 * Block specification for day structure
 */
export interface BlockSpec {
  type: 'strength' | 'strength_high_rep' | 'compound' | 'interval' | 'mobility';
  equipment_preference?: 'barbell' | 'dumbbell' | 'any';
  count: number | 'time_based';
  exercise_count?: number;  // For interval blocks
}

/**
 * Day structure configuration for a specific equipment level and day type
 */
export interface DayStructureConfig {
  description: string;
  blocks: BlockSpec[];
}

/**
 * Equipment-based day structure configuration
 */
export interface DayStructureByEquipment {
  description: string;
  full_gym: {
    standard: DayStructureConfig;
    hiit: DayStructureConfig;
    volume: DayStructureConfig;
    strength: DayStructureConfig;
    mobility: DayStructureConfig;
    [key: string]: DayStructureConfig | string;
  };
  dumbbells_only: {
    standard: DayStructureConfig;
    hiit: DayStructureConfig;
    volume: DayStructureConfig;
    strength: DayStructureConfig;
    mobility: DayStructureConfig;
    [key: string]: DayStructureConfig | string;
  };
  bodyweight_only: {
    standard: DayStructureConfig;
    hiit: DayStructureConfig;
    volume: DayStructureConfig;
    strength: DayStructureConfig;
    mobility: DayStructureConfig;
    [key: string]: DayStructureConfig | string;
  };
}

/**
 * Compound blocks by time configuration
 */
export interface CompoundBlocksByTime {
  description?: string;
  [duration: string]: number | string | undefined;
}

export interface GenerationRules {
  version: string;
  intensity_profiles: IntensityProfiles;
  progression_schemes: ProgressionSchemes;
  experience_modifiers: ExperienceModifiers;
  time_estimates: TimeEstimates;
  category_workout_structure: CategoryWorkoutStructure;
  split_muscle_group_mapping: SplitMuscleGroupMapping;
  compound_exercise_construction: CompoundExerciseConstruction;
  exercise_selection_strategy: ExerciseSelectionStrategy;
  progression_by_goal: ProgressionByGoal;
  intensity_profile_by_layer_and_category: IntensityProfileByLayerAndCategory;
  prescriptive_splits: PrescriptiveSplits;
  day_structure_by_equipment: DayStructureByEquipment;
  compound_blocks_by_time: CompoundBlocksByTime;
}

export interface CompoundExerciseConstruction {
  circuit: {
    base_constituent_exercises: number;
    description: string;
    exclude_equipment?: string[];
    exclusion_reason?: string;
  };
  emom: {
    base_constituent_exercises: number;
    description: string;
    exclude_equipment?: string[];
    exclusion_reason?: string;
  };
  amrap: {
    base_constituent_exercises: number;
    description: string;
    exclude_equipment?: string[];
    exclusion_reason?: string;
  };
  interval: {
    base_constituent_exercises: number;
    description: string;
    exclude_equipment?: string[];
    exclusion_reason?: string;
  };
}


export interface IntensityProfiles {
  [category: string]: {
    [intensity: string]: {
      // New self-documenting fields (Phase 1 of ticket #016)
      sets?: number;
      reps?: number | string;
      rest_time_seconds?: number;           // For bodyweight, interval sub-exercises
      rest_time_minutes?: number;           // For strength exercises
      work_time_seconds?: number;           // For interval sub-exercises
      work_time_minutes?: number;           // For EMOM/AMRAP block time
      block_time_minutes?: number;          // For EMOM/AMRAP total block duration
      weight_percent_tm?: number;
      weight_descriptor?: string;
      target_reps_per_minute?: number;      // For EMOM
      target_rounds?: number;               // For AMRAP
      sub_work_mode?: SubWorkMode;          // "reps" | "time" for compound blocks
      sub_work_time_seconds?: number;       // For interval sub-exercises
      sub_rest_time_seconds?: number;       // For interval sub-exercises

      // Deprecated fields (for backward compatibility during transition)
      /** @deprecated Use sets instead */
      base_sets?: number;
      /** @deprecated Use reps instead */
      base_reps?: number | string;
      /** @deprecated Use rest_time_seconds or rest_time_minutes instead */
      base_rest_time_minutes?: number;
      /** @deprecated Unit now inferred from field name */
      base_rest_time_unit?: TimeUnit;
      /** @deprecated Use weight_percent_tm instead */
      base_weight_percent_tm?: number;
      /** @deprecated Use weight_descriptor instead */
      base_weight_descriptor?: string;
      /** @deprecated Use work_time_seconds or work_time_minutes instead */
      base_work_time_minutes?: number;
      /** @deprecated Unit now inferred from field name */
      base_work_time_unit?: TimeUnit;
      /** @deprecated Use target_reps_per_minute instead */
      base_target_reps_per_minute?: number;
      /** @deprecated Use target_rounds instead */
      base_target_rounds?: number;
      base_exercises_per_circuit?: number;
      base_rest_between_circuits_minutes?: number;
      base_rest_between_circuits_unit?: TimeUnit;
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
  };
}

/**
 * Base focus types for split muscle group mapping
 * Only these 7 base types need config entries - suffixed variants (e.g., "Upper-HIIT")
 * are mapped to their base type via getBaseFocus() before lookup
 */
export type BaseFocusType = 'Full Body' | 'Upper' | 'Lower' | 'Push' | 'Pull' | 'Legs' | 'Mobility';

/**
 * Muscle group mapping entry
 */
export interface MuscleGroupMappingEntry {
  include_muscle_groups: string[];
  exclude_muscle_groups?: string[];
  description: string;
}

/**
 * Muscle group mapping configuration
 * Contains exactly 7 entries for base focus types:
 * - Full Body, Upper, Lower, Push, Pull, Legs, Mobility
 *
 * Suffixed focus types (e.g., "Push-HIIT", "Upper-Volume") use getBaseFocus() to lookup
 * their base type before accessing this mapping.
 */
export interface SplitMuscleGroupMapping {
  description?: string;
  [focus: string]: MuscleGroupMappingEntry | string | undefined;
}

export interface CategoryWorkoutStructure {
  main_strength_categories?: string[];
  split_category_overrides?: {
    [splitFocus: string]: {
      first: string[];
      primary: string[];
      secondary: string[];
      tertiary: string[];
      finisher: string[];
      last: string[];
    };
  };
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
  shuffle_pools?: boolean;
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

// ============================================================================
// TIMER ENGINE TYPES (Live View)
// ============================================================================

/**
 * Timer phase types - represents the current state of the timer
 */
export type TimerPhase = 'idle' | 'work' | 'rest' | 'countdown' | 'complete' | 'paused' | 'entry';

/**
 * Timer mode based on exercise type
 * - countdown: Timer counts down from a target time (strength, EMOM, AMRAP, interval)
 * - count_up: Timer counts up from 0 (circuit)
 */
export type TimerMode = 'countdown' | 'count_up';

/**
 * Exercise category for timer behavior
 */
export type TimerExerciseType = 'strength' | 'bodyweight' | 'emom' | 'amrap' | 'interval' | 'circuit';

/**
 * Current state of the timer during a workout
 */
export interface TimerState {
  mode: TimerMode;
  phase: TimerPhase;
  exerciseType: TimerExerciseType;

  // Time tracking (all values in seconds)
  totalSeconds: number;      // Total duration for this phase
  remainingSeconds: number;  // Countdown: seconds left. Count-up: seconds elapsed
  targetTimestamp: number;   // Unix timestamp when timer should end (for drift correction)

  // Set/round tracking
  currentSet: number;
  totalSets: number;
  currentSubExercise: number;  // For compound blocks (0-indexed)
  totalSubExercises: number;

  // Minute tracking (EMOM/AMRAP)
  currentMinute: number;
  totalMinutes: number;

  // Audio state
  audioEnabled: boolean;
  lastAudioCue: string | null;
}

/**
 * Timer behavior configuration for an exercise type
 */
export interface TimerConfig {
  exerciseType: TimerExerciseType;
  mode: TimerMode;
  phases: ('work' | 'rest' | 'continuous')[];
  workCalculation: 'tempo_based' | 'fixed' | 'from_prescription';
  countdownBefore: 'work' | 'rest' | null;
  logTiming: 'after_each_set' | 'after_block';
  minuteMarkers: boolean;
  countdownAtMinuteEnd?: boolean;
}

/**
 * Audio configuration for the timer
 */
export interface AudioConfig {
  enabled: boolean;
  countdownEnabled: boolean;
  completionEnabled: boolean;
  minuteMarkersEnabled: boolean;
  volume: number;  // 0.0 - 1.0
  duckMusic: boolean;
}

/**
 * Default audio configuration
 */
export const DEFAULT_AUDIO_CONFIG: AudioConfig = {
  enabled: true,
  countdownEnabled: true,
  completionEnabled: true,
  minuteMarkersEnabled: true,
  volume: 0.8,
  duckMusic: false
};

/**
 * Live workout session - tracks the full state of an active workout
 */
export interface LiveWorkoutSession {
  workoutId: string;
  scheduleId: string;
  weekNumber: number;
  dayNumber: number;
  startTime: string;  // ISO timestamp
  currentExerciseIndex: number;
  exercises: LiveExercise[];
  logs: ExerciseLog[];
  timerState: TimerState;
  audioConfig: AudioConfig;
  isPaused: boolean;
  pauseStartTime: string | null;
  totalPauseTime: number;  // seconds
}

/**
 * An exercise as it appears in a live workout
 */
export interface LiveExercise {
  exerciseName: string;
  exerciseType: TimerExerciseType;
  isCompoundParent: boolean;
  subExercises: LiveExercise[];
  prescription: {
    sets: number;
    reps: number | null;
    weight: number | null;
    weightUnit: 'lbs' | 'kg' | null;
    workTimeSeconds: number | null;
    restTimeSeconds: number | null;
    tempo: string | null;
  };
  completed: boolean;
  completedSets: number;
}

/**
 * Log entry for a single set
 */
export interface SetLog {
  setNumber: number;
  reps: number | null;
  weight: number | null;
  weightUnit: 'lbs' | 'kg' | null;
  workTime: number | null;
  rpe: number | null;
  rir: number | null;
  completed: boolean;
  notes: string | null;
  timestamp: string;
}

/**
 * Log entry for a complete exercise (contains all sets)
 */
export interface ExerciseLog {
  exerciseName: string;
  exerciseOrder: number;
  isCompoundParent: boolean;
  compoundParentName: string | null;
  sets: SetLog[];
  totalTime?: number;  // For circuits (time to complete)
  totalRounds?: number;  // For AMRAP
  timestamp: string;
}

/**
 * Timer event types for callbacks
 */
export type TimerEventType =
  | 'tick'
  | 'phase_change'
  | 'set_complete'
  | 'exercise_complete'
  | 'minute_marker'
  | 'countdown_tick'
  | 'workout_complete';

/**
 * Timer event data
 */
export interface TimerEvent {
  type: TimerEventType;
  state: TimerState;
  previousPhase?: TimerPhase;
  countdownValue?: number;  // For countdown_tick events (3, 2, 1)
}
