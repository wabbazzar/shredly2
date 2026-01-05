# TICKET-001: Workout Generation Engine (CLI Prototype)

**Status**: Ready for Implementation
**Priority**: P0 (Critical Path)
**Estimated Points**: 13
**Created**: 2026-01-04

---

## Overview

Build the **deterministic workout generation engine** as a CLI prototype to validate the workout generation algorithm before porting to the SvelteKit UI. This engine must transform questionnaire answers into complete, ready-to-use workout JSON files that conform to WORKOUT_SPEC.md.

---

## Success Criteria

✅ **Deterministic Output**: Same questionnaire input always produces identical workout JSON
✅ **WORKOUT_SPEC Compliance**: Generated JSON validates against WORKOUT_SPEC.md format
✅ **CLI Test Harness**: Can run `npm run cli` to generate workouts from sample inputs
✅ **Multiple Test Cases**: Generate and validate workouts for all primary_goal types
✅ **Time Estimates**: Generated workouts respect session_duration constraints (±5 minutes)
✅ **TypeScript Types**: All data structures have strict TypeScript interfaces

---

## Architecture: Two-Phase Generation

The workout generation engine uses a **two-phase approach** to transform questionnaire answers into complete workout programs:

1. **Phase 1: Structural Generation** - Determines workout structure, exercise selection, and progression schemes
2. **Phase 2: Parameterization** - Calculates explicit week-by-week parameters (sets, reps, weight, rest) for every exercise

### Phase 1: Structural Generation (Exercise Selection & Structure)

**Input**: Questionnaire answers (QuestionnaireAnswers interface)
**Output**: Workout structure with selected exercises and assigned progression schemes

```typescript
interface WorkoutStructure {
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

interface DayStructure {
  dayNumber: number;
  type: "gym" | "home" | "outdoor" | "recovery";
  focus: string; // "Push", "Pull", "Legs", "Upper", "Lower", "Full Body", "Mobility"
  exercises: ExerciseStructure[];
}

interface ExerciseStructure {
  name: string; // References exercise_database.json (sampled from 326 exercises)
  category?: string; // For compound exercises: "emom" | "amrap" | "circuit" | "interval"
  sub_exercises?: SubExerciseStructure[];
  progressionScheme: "linear" | "density" | "wave_loading" | "volume" | "static";
  intensityProfile: "light" | "moderate" | "moderate_heavy" | "heavy" | "max";
}
```

**Structural Generation Algorithm** (with Stochastic Exercise Sampling):

1. **Split Assignment** (100% config-driven from workout_generation_rules.json)
   - Get `training_frequency` (2-7 days) and `training_split_preference` from questionnaire
   - If `training_split_preference` === "no_preference", assign default split based on frequency:
     - **NO HARDCODED LOGIC**: Default mappings (2-3 days → full_body, 4 days → upper_lower, etc.) should be config-driven
     - Future: Add `default_split_by_frequency` config object to workout_generation_rules.json
   - Look up `split_patterns[split_type]` from workout_generation_rules.json to get day focus pattern
   - Repeat pattern cyclically to fill all training days
   - Example: 5 days, `ulppl` → ["Upper", "Lower", "Push", "Pull", "Legs"] (from config)

2. **Layer Selection** (100% config-driven from workout_generation_rules.json)
   - Get `session_duration` from questionnaire (e.g., "45-60")
   - Look up `duration_constraints["45-60"].include_layers` from workout_generation_rules.json
   - Example: "45-60" → ["first", "primary", "secondary", "tertiary", "last"] (from config)
   - **NO HARDCODED LAYERS**: All layer lists come from duration_constraints config

3. **Category Priority Mapping** (100% config-driven from workout_generation_rules.json)
   - Get `primary_goal` from questionnaire (e.g., "muscle_gain")
   - Look up `category_priority_by_goal[primary_goal]` from workout_generation_rules.json
   - Example: muscle_gain → first: [mobility, flexibility], primary: [strength], secondary: [bodyweight, strength], etc. (from config)
   - **NO HARDCODED CATEGORIES**: All category-to-layer mappings come from category_workout_structure config
   - **All 9 exercise categories** from database will be considered:
     - `strength` - Primary resistance training with external load
     - `bodyweight` - Calisthenics and bodyweight exercises (DEPRECATED: exercises in exercise_database.json use "strength" with external_load="never")
     - `mobility` - Dynamic movement preparation, joint mobilization
     - `flexibility` - Static stretching, range of motion work
     - `cardio` - Aerobic conditioning (LISS, steady state)
     - `interval` - High-intensity interval training
     - `emom` - Every Minute on the Minute structured work
     - `amrap` - As Many Rounds/Reps As Possible
     - `circuit` - Multiple exercises performed sequentially
   - **Note**: Category assignment is goal-dependent, not all categories used in every program
   - **Rest days**: Implicit (days not defined in workout structure), no exercises needed

4. **Exercise Pool Filtering (Stochastic Sampling)** (100% config-driven filtering criteria)
   - **CRITICAL**: Exercises are **sampled/filtered** from the 323-exercise database, NOT hardcoded
   - **Filtering Process** (for each layer on each day):
     - Get day `focus` (e.g., "Push")
     - Look up `split_muscle_group_mapping[focus]` from workout_generation_rules.json to get muscle group filters
     - Filter `exercise_database.json` to create **eligible exercise pool** by:
       - `muscle_groups`: Must overlap with split muscle groups (from split_muscle_group_mapping config)
       - `equipment`: Must be in user's `equipment_access` answer
       - `difficulty`: Must be in `experience_modifiers[experience_level].complexity_filter` (from config)
       - `category`: Must be in the layer's category list from category_priority_by_goal (from config)
   - **Result**: Each layer (first, primary, secondary, etc.) gets a filtered pool of eligible exercises
   - **NO HARDCODED FILTERS**: All filtering rules come from workout_generation_rules.json
   - **Stochasticity Note**: Future enhancement could add randomness/variation, but **Phase 1 MVP is deterministic** (same input = same output)

5. **Round-Robin Exercise Selection (with Layer Ratios)** (100% config-driven ratios and constraints)
   - Initialize empty exercise list for the day
   - **Layer Ratios** (from workout_generation_rules.json → exercise_selection_strategy.layer_ratios):
     - `first`: 1 exercise per cycle (from config)
     - `primary`: **2 exercises per cycle** (from config: 2:1 ratio vs first/tertiary/finisher/last)
     - `secondary`: **2 exercises per cycle** (from config: 2:1 ratio vs first/tertiary/finisher/last)
     - `tertiary`: 1 exercise per cycle (from config)
     - `finisher`: 1 exercise per cycle (from config)
     - `last`: 1 exercise per cycle (from config)
   - **NO HARDCODED RATIOS**: All layer ratios read from layer_ratios config object
   - **Round-robin algorithm** (maintains 1:2:2:1:1:1 ratio from config):
     - **Round 1**:
       - first[0], primary[0], primary[1], secondary[0], secondary[1], tertiary[0], finisher[0], last[0]
     - **Round 2**:
       - first[1], primary[2], primary[3], secondary[2], secondary[3], tertiary[1], finisher[1], last[1]
     - Continue until duration constraint is met
   - **Selection from Filtered Pools**:
     - For each layer slot (e.g., primary[0]), select from that layer's filtered exercise pool
     - Avoid duplicates within the day (mark selected exercises as "used")
   - **Diversity Rules** (from exercise_selection_strategy.diversity_rules config):
     - No duplicate exercises within a day (from config: no_duplicate_exercises: true)
     - Aim for muscle group variety within each layer (from config: muscle_diversity_within_day: true)
     - Prefer exercises that haven't been used in recent days (future enhancement)
   - **Duration Check** (config-driven constraints):
     - After each exercise addition, estimate duration using `time_estimates` from workout_generation_rules.json
     - Stop when `total_minutes_max` (from duration_constraints config) would be exceeded
     - **NO HARDCODED TIME VALUES**: All duration limits, setup times, transition times from config
   - **Required Layers** (from exercise_selection_strategy.layer_requirements config):
     - Ensure at least 1 exercise from layers in `must_include` config array (default: ["first", "primary"])
     - If "last" layer is in `include_layers` and `always_end_with_last_if_available` config is true, include cooldown exercise
     - **NO HARDCODED REQUIREMENTS**: All layer requirements come from layer_requirements config

6. **Progression & Intensity Assignment** (100% config-driven defaults and mappings)
   - Get `progression_preference` from questionnaire
   - If "no_preference", assign based on goal:
     - **NO HARDCODED MAPPINGS**: Create `default_progression_by_goal` config object in workout_generation_rules.json
     - Example config: muscle_gain → "linear", fat_loss → "density", athletic_performance → "wave_loading", general_fitness → "volume"
   - For each exercise, assign:
     - `progressionScheme`: From user preference or goal default (from config)
     - `intensityProfile`: Based on layer mapping
       - **NO HARDCODED INTENSITY ASSIGNMENTS**: Create `intensity_profile_by_layer` config object
       - Example config: first → "light", primary → "heavy", secondary → "moderate", tertiary → "moderate", finisher → "hiit", last → "light"

---

### Phase 2: Parameterization (Week-by-Week Progression Calculation)

**Input**: WorkoutStructure (from Phase 1)
**Output**: Final workout JSON with explicit week-by-week parameters (conforms to WORKOUT_SPEC.md)

```typescript
interface ConcreteWorkout {
  id: string;
  name: string;
  description: string;
  version: string;
  weeks: number;
  daysPerWeek: number;
  metadata: WorkoutMetadata;
  days: {
    [dayNumber: string]: ConcreteDay;
  };
}

interface ConcreteDay {
  dayNumber: number;
  type: "gym" | "home" | "outdoor" | "recovery";
  focus: string;
  exercises: ConcreteExercise[];
}

interface ConcreteExercise {
  name: string;
  category?: string; // For compound exercises
  week1: WeekParameters;
  week2: WeekParameters;
  week3: WeekParameters;
  // ... weekN for total weeks
  sub_exercises?: ConcreteSubExercise[];
}

interface WeekParameters {
  sets?: number;
  reps?: number | string;
  work_time_minutes?: number;
  rest_time_minutes?: number;
  weight?: WeightSpecification;
  tempo?: string;
  set_blocks?: SetBlock[]; // For advanced programs
}
```

**Parameterization Algorithm** (Calculating Explicit Week-by-Week Values - 100% Config-Driven):

1. **Apply Intensity Profile (Week 1 Baseline)** (All base values from workout_generation_rules.json)
   - For each exercise in workout structure:
   - Get `category` from `exercise_database.json[exercise.name].category`
   - Look up `intensity_profiles[category][intensityProfile]` from workout_generation_rules.json
   - Extract base parameters (all from config):
     - `base_sets`, `base_reps`, `base_weight_percent_tm`, `base_rest_time_minutes`, `base_work_time_minutes`, etc.
     - **NO HARDCODED BASE VALUES**: All baseline parameters read from intensity_profiles config
   - Apply `experience_modifiers[experience_level]` from workout_generation_rules.json:
     - Multiply sets/reps by `volume_multiplier` (from config)
     - Multiply rest_time by `rest_time_multiplier` (from config)
     - Choose `weight_type` (descriptor vs percent_tm) (from config)
     - **NO HARDCODED MULTIPLIERS**: All experience modifiers from config
   - This becomes `week1` parameters

2. **Apply Progression Scheme (Week 2, 3, ..., N)** (All deltas/rates from workout_generation_rules.json)
   - Get `progressionScheme` from exercise structure
   - Look up `progression_schemes[progressionScheme].rules` from workout_generation_rules.json
   - For each week from 2 to totalWeeks:
     - Apply deltas from progression rules (all from config):
       - **linear**: reps_delta_per_week (from config), weight_percent_delta_per_week (from config), rest_time_delta_per_week_minutes (from config)
       - **density**: work_time_increase_percent_total (from config), reps_increase_percent_total (from config), rest_time_delta_per_week_minutes (from config)
       - **wave_loading**: Use wave_patterns array from config for that week
       - **volume**: sets_increase_every_n_weeks (from config), reps_increase_percent_total (from config), weight_percent_delta_per_week (from config)
       - **static**: All parameters stay the same (all_deltas_zero from config)
     - **NO HARDCODED DELTAS OR RATES**: All progression values (reps -= 1, weight += 5%, rest -= 0.25, etc.) read from progression_schemes config
     - Respect minimums from config: reps_minimum, rest_time_minimum_minutes (from progression_schemes.rules)
     - Respect maximums from config: sets_maximum (from progression_schemes.rules)

3. **Compound Exercise Handling**
   - If exercise has `sub_exercises` in workout structure:
   - Parent exercise gets:
     - `category` field (emom, amrap, circuit, interval)
     - `weekN.work_time_minutes` for each week (from progression)
   - Each sub_exercise gets:
     - Own `weekN.reps` or `weekN.work_time_minutes` progression
     - Independent progression scheme application

4. **Weight Specification**
   - Get `weight_type` from `experience_modifiers[experience_level]`
   - If `weight_type` === "descriptor":
     - Use string: "light", "moderate", "heavy"
   - If `weight_type` === "percent_tm":
     - Use object: `{type: "percent_tm", value: 70}`
   - For bodyweight exercises:
     - Omit weight field entirely (not needed)

5. **Final Validation**
   - Ensure every exercise has weekN for all weeks (week1 through weekN where N = totalWeeks)
   - Ensure no null/undefined fields in weekN objects
   - Ensure set_blocks and flat sets/reps are mutually exclusive
   - Validate against WORKOUT_SPEC.md schema

---

## File Structure

```
shredly2/
├── cli/
│   ├── test-runner.ts              # Main CLI entry point
│   ├── sample-questionnaires/      # Test input JSONs
│   │   ├── muscle-gain-intermediate-4day.json
│   │   ├── fat-loss-beginner-3day.json
│   │   ├── athletic-advanced-6day.json
│   │   └── ... (more test cases)
│   └── sample-outputs/             # Generated workout JSONs for verification
│       ├── muscle-gain-intermediate-4day-output.json
│       └── ...
├── src/
│   ├── lib/
│   │   ├── engine/                 # SHARED generation logic (CLI + frontend will both use this)
│   │   │   ├── types.ts            # All TypeScript interfaces
│   │   │   ├── phase1-structure.ts # Structural generation logic (exercise selection)
│   │   │   ├── phase2-parameters.ts  # Parameterization logic (week-by-week calculations)
│   │   │   ├── exercise-selector.ts # Exercise filtering and stochastic sampling
│   │   │   ├── progression-calculator.ts # Week-to-week progression math
│   │   │   ├── duration-estimator.ts # Time estimation logic
│   │   │   └── workout-generator.ts # Main orchestrator (calls phase1 → phase2)
│   │   └── ...
│   └── data/
│       ├── exercise_database.json           # 323 exercises (READ-ONLY)
│       ├── workout-questionnaire.json       # Questionnaire structure (READ-ONLY)
│       └── workout_generation_rules.json    # All configuration (READ-ONLY)
└── docs/
    └── WORKOUT_SPEC.md              # Output format specification
```

---

## TypeScript Type Definitions (src/lib/engine/types.ts)

```typescript
// ============================================================================
// QUESTIONNAIRE TYPES
// ============================================================================

export interface QuestionnaireAnswers {
  primary_goal: "muscle_gain" | "fat_loss" | "athletic_performance" | "general_fitness" | "rehabilitation" | "body_recomposition";
  experience_level: "complete_beginner" | "beginner" | "intermediate" | "advanced" | "expert";
  training_frequency: "2" | "3" | "4" | "5" | "6" | "7";
  session_duration: "20-30" | "30-45" | "45-60" | "60-90" | "90+";
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
  metadata: {
    difficulty: "Beginner" | "Intermediate" | "Advanced" | "Expert";
    equipment: string[];
    estimatedDuration: string;
    tags: string[];
  };
  days: {
    [dayNumber: string]: DayStructure;
  };
}

export interface DayStructure {
  dayNumber: number;
  type: "gym" | "home" | "outdoor" | "recovery";
  focus: "Push" | "Pull" | "Legs" | "Upper" | "Lower" | "Full Body" | "Mobility";
  exercises: ExerciseStructure[];
}

export interface ExerciseStructure {
  name: string; // Sampled from exercise_database.json (323 exercises, filtered by criteria)
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
  metadata: {
    difficulty: "Beginner" | "Intermediate" | "Advanced" | "Expert";
    equipment: string[];
    estimatedDuration: string;
    tags: string[];
  };
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
  // ... weekN
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
```

---

## Implementation Steps

### Step 1: TypeScript Type Definitions (1 point)
- [ ] Create `src/lib/engine/types.ts` with all interfaces above
- [ ] Import and validate against existing data files
- [ ] Ensure all JSON files can be typed correctly

### Step 2: Structural Generation - Split Assignment (2 points)
- [ ] Create `src/lib/engine/phase1-structure.ts`
- [ ] Implement `assignSplit(answers: QuestionnaireAnswers): string`
  - Handle "no_preference" default logic
  - Look up split_patterns and repeat cyclically
- [ ] Implement `getDayFocusArray(split: string, days: number): string[]`
- [ ] Unit tests for all split/frequency combinations

### Step 3: Structural Generation - Exercise Selection with Stochastic Sampling (3 points)
- [ ] Create `src/lib/engine/exercise-selector.ts`
- [ ] Implement `filterExercisesByDay(focus, categories, equipment, difficulty): Exercise[]`
  - **Filter all 9 exercise categories**: strength, bodyweight, mobility, flexibility, cardio, interval, emom, amrap, circuit
  - **Stochastic sampling**: Create filtered pools for each layer, select from pools (not hardcoded)
- [ ] Implement `roundRobinSelect(exercisePool, layers, durationConstraint): ExerciseStructure[]`
  - **Maintain 1:2:2:1:1:1 layer ratio**: primary and secondary get 2 exercises per cycle, others get 1
  - **Round-robin order**: first[0], primary[0], primary[1], secondary[0], secondary[1], tertiary[0], finisher[0], last[0]
- [ ] Implement muscle group diversity checking
- [ ] Implement duration estimation during selection
- [ ] Unit tests for filtering logic and ratio enforcement

### Step 4: Structural Generation - Progression Assignment (1 point)
- [ ] Implement `assignProgressionScheme(preference, goal): string`
- [ ] Implement `assignIntensityProfile(layer): string`
- [ ] Unit tests for all goal combinations

### Step 5: Parameterization - Week 1 Baseline (2 points)
- [ ] Create `src/lib/engine/phase2-parameters.ts`
- [ ] Create `src/lib/engine/progression-calculator.ts`
- [ ] Implement `applyIntensityProfile(exercise, profile, experience): WeekParameters`
- [ ] Apply experience modifiers (volume_multiplier, rest_time_multiplier)
- [ ] Handle weight_type selection (descriptor vs percent_tm)
- [ ] Unit tests for intensity application

### Step 6: Parameterization - Week 2-N Progression (2 points)
- [ ] Implement `applyProgressionScheme(week1, scheme, weekNum, totalWeeks): WeekParameters`
- [ ] Implement linear progression math
- [ ] Implement density progression math
- [ ] Implement wave_loading progression math
- [ ] Implement volume progression math
- [ ] Implement static progression (no change)
- [ ] Unit tests for all progression schemes

### Step 7: Main Orchestrator & CLI (2 points)
- [ ] Create `src/lib/engine/workout-generator.ts`
- [ ] Implement `generateWorkout(answers: QuestionnaireAnswers): ParameterizedWorkout`
  - Call phase1-structure.ts → get WorkoutStructure
  - Call phase2-parameters.ts → get ParameterizedWorkout
  - Validate output against WORKOUT_SPEC.md
- [ ] Create `cli/test-runner.ts`
- [ ] Create sample questionnaire JSON files (minimum 5 test cases)
- [ ] Generate and save output workout JSONs
- [ ] Add `npm run cli` script to package.json

---

## Test Cases (Minimum Required)

1. **muscle_gain + intermediate + 4 days + 45-60 min + commercial_gym + upper_lower**
   - Expected: Upper/Lower split, linear progression, percent_tm weights

2. **fat_loss + beginner + 3 days + 30-45 min + bodyweight_only + full_body**
   - Expected: Full Body, density progression, descriptor weights, bodyweight exercises only

3. **athletic_performance + advanced + 6 days + 60-90 min + commercial_gym + push_pull_legs**
   - Expected: PPL 2x/week, wave_loading progression, advanced exercises

4. **general_fitness + complete_beginner + 2 days + 20-30 min + home_gym_basic + no_preference**
   - Expected: Full Body, volume progression, minimal exercises, beginner-friendly

5. **body_recomposition + intermediate + 5 days + 45-60 min + commercial_gym + ulppl**
   - Expected: ULPPL split, mixed categories (strength + metabolic), balanced progression

---

## Validation Checklist

For each generated workout JSON, validate:

- [ ] `id`, `name`, `description`, `version`, `weeks`, `daysPerWeek` fields present
- [ ] `metadata.difficulty` matches user's `experience_level`
- [ ] `metadata.equipment` matches user's `equipment_access`
- [ ] Every day has `dayNumber`, `type`, `focus`, `exercises`
- [ ] Every exercise has `name` field
- [ ] Every exercise has `week1` through `weekN` (where N = weeks)
- [ ] No exercise has both `set_blocks` AND flat `sets/reps` (mutually exclusive)
- [ ] Compound exercises have `category` and `sub_exercises` fields
- [ ] Sub-exercises have their own `weekN` progression
- [ ] Total estimated duration is within ±5 minutes of session_duration constraint
- [ ] No duplicate exercise names within a single day
- [ ] All exercise names exist in exercise_database.json
- [ ] Weight specifications use correct type based on experience_level

---

## Definition of Done

- [ ] All TypeScript files compile without errors (`npm run typecheck`)
- [ ] All 5 test case workouts generate successfully
- [ ] All generated JSONs validate against WORKOUT_SPEC.md
- [ ] CLI runs with `npm run cli` command
- [ ] Sample output JSONs saved to `cli/sample-outputs/`
- [ ] Duration estimates are accurate (±5 minutes)
- [ ] Deterministic: Running same input twice produces identical output
- [ ] Code is commented with JSDoc for all public functions
- [ ] README.md updated with CLI usage instructions

---

## Dependencies

**Data Files** (already exist):
- `src/data/exercise_database.json`
- `src/data/workout-questionnaire.json`
- `src/data/workout_generation_rules.json`

**Documentation** (already exists):
- `docs/WORKOUT_SPEC.md`
- `docs/EXERCISE_HISTORY_SPEC.md`

**Tools**:
- TypeScript 5.x
- Node.js 20.x+
- ES Modules (100% ESM, no CommonJS)

---

## Notes

### Critical Design Principles

- **Determinism is critical**: Use stable sorting, no randomness, no timestamps in generation logic (MVP is deterministic)
- **Stochastic sampling vs hardcoding**: Exercises are **filtered/sampled** from exercise_database.json based on criteria (equipment, difficulty, muscle groups, category), NOT hardcoded into generation logic
- **All 9 categories covered**: Engine must handle all exercise categories: strength, bodyweight, mobility, flexibility, cardio, interval, emom, amrap, circuit
- **Rest days are implicit**: Days not defined in the workout structure are rest days (no exercises needed)
- **Layer ratios enforced**: Primary and secondary layers get **2:1 ratio** (2 exercises per cycle) compared to first/tertiary/finisher/last (1 exercise per cycle)
- **Fail loudly**: No fallback logic - if something is wrong, throw descriptive error
- **CLI first, UI later**: Don't touch SvelteKit yet - validate algorithm in terminal first

### Config-Driven Architecture (ZERO HARDCODED VALUES)

**CRITICAL**: The generation engine must have **ZERO hardcoded numbers, rates, deltas, or magic values**. Every parameter comes from either:
1. **exercise_database.json** - Exercise metadata (categories, muscle groups, equipment, difficulty)
2. **workout_generation_rules.json** - ALL generation parameters

**Config-Driven Parameters Include**:
- **Split patterns**: All day focus patterns (full_body, upper_lower, ppl, ulppl)
- **Layer ratios**: How many exercises from each layer per cycle (1:2:2:1:1:1)
- **Category priorities**: Which categories go in which layers for each goal
- **Duration constraints**: Time limits and which layers to include for each session duration
- **Intensity profiles**: Base sets, reps, weight, rest time for each category × intensity combination
- **Experience modifiers**: Volume multipliers, rest time multipliers, complexity filters
- **Progression schemes**: ALL deltas, rates, percentages, minimums, maximums for each progression type
  - Linear: reps_delta_per_week, weight_percent_delta_per_week, rest_time_delta_per_week_minutes
  - Density: work_time_increase_percent_total, reps_increase_percent_total, rest_time_delta_per_week_minutes
  - Wave loading: wave_patterns arrays
  - Volume: sets_increase_every_n_weeks, reps_increase_percent_total
  - Static: all_deltas_zero flag
- **Time estimates**: setup_time_minutes, seconds_per_rep, transition_time_minutes
- **Diversity rules**: no_duplicate_exercises, muscle_diversity_within_day flags
- **Layer requirements**: must_include arrays, optional arrays, always_end_with_last_if_available flag

**Engine Responsibilities** (Pure Logic Only):
- Read config files
- Filter exercises based on config criteria
- Apply config formulas to calculate progressions
- Execute round-robin algorithm using config ratios
- Validate output against WORKOUT_SPEC.md

**What the Engine Does NOT Do** (Config Handles These):
- ❌ Hardcode any numeric values (sets, reps, weight percentages, time durations, deltas, rates)
- ❌ Hardcode category-to-layer mappings
- ❌ Hardcode split patterns
- ❌ Hardcode experience modifiers
- ❌ Hardcode progression formulas

**Benefit**: Changing workout generation behavior = edit JSON config, no code changes needed

### Terminology Clarification

- **Structural Generation** (Phase 1): Selects exercises and structure from database based on config filters
- **Parameterization** (Phase 2): Calculates explicit week-by-week values using config formulas

---

## Follow-Up Tickets (Not in This Ticket)

- TICKET-002: Port workout generation engine to SvelteKit UI
- TICKET-003: Questionnaire flow implementation
- TICKET-004: Exercise history tracking
- TICKET-005: Progressive overload calculations
- TICKET-006: Mobile polish (Capacitor integration)

---

**END OF TICKET-001**
