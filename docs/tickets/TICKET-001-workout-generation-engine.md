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

### Phase 1: Workout Blueprint Generation

**Input**: Questionnaire answers (QuestionnaireAnswers interface)
**Output**: Workout blueprint with day structure and exercise selection

```typescript
interface WorkoutBlueprint {
  id: string;
  name: string;
  description: string;
  weeks: number;
  daysPerWeek: number;
  metadata: WorkoutMetadata;
  days: {
    [dayNumber: string]: DayBlueprint;
  };
}

interface DayBlueprint {
  dayNumber: number;
  type: "gym" | "home" | "outdoor" | "recovery";
  focus: string; // "Push", "Pull", "Legs", "Upper", "Lower", "Full Body", "Mobility"
  exercises: ExerciseBlueprint[];
}

interface ExerciseBlueprint {
  name: string; // References exercise_database.json
  category?: string; // For compound exercises: "emom" | "amrap" | "circuit" | "interval"
  sub_exercises?: SubExerciseBlueprint[];
  progressionScheme: "linear" | "density" | "wave_loading" | "volume" | "static";
  intensityProfile: "light" | "moderate" | "moderate_heavy" | "heavy" | "max";
}
```

**Blueprint Generation Algorithm**:

1. **Split Assignment**
   - Get `training_frequency` (2-7 days) and `training_split_preference` from questionnaire
   - If `training_split_preference` === "no_preference", assign default split based on frequency:
     - 2-3 days → `full_body`
     - 4 days → `upper_lower`
     - 5-6 days → `push_pull_legs` or `ulppl`
   - Look up `split_patterns[split_type]` to get day focus pattern
   - Repeat pattern cyclically to fill all training days
   - Example: 5 days, `ulppl` → ["Upper", "Lower", "Push", "Pull", "Legs"]

2. **Layer Selection**
   - Get `session_duration` from questionnaire (e.g., "45-60")
   - Look up `duration_constraints["45-60"].include_layers`
   - Example: "45-60" → ["first", "primary", "secondary", "tertiary", "last"]

3. **Category Priority Mapping**
   - Get `primary_goal` from questionnaire (e.g., "muscle_gain")
   - Look up `category_priority_by_goal[primary_goal]` to get category assignments per layer
   - Example: muscle_gain → first: [mobility, flexibility], primary: [strength], secondary: [bodyweight, strength], etc.

4. **Exercise Pool Filtering**
   - For each day, get `focus` (e.g., "Push")
   - Look up `split_muscle_group_mapping[focus]` to get muscle group filters
   - Filter `exercise_database.json` by:
     - `muscle_groups`: Must overlap with split muscle groups
     - `equipment`: Must be in user's `equipment_access` answer
     - `difficulty`: Must be in `experience_modifiers[experience_level].complexity_filter`
     - `category`: Must be in the layer's category list from category_priority_by_goal

5. **Round-Robin Exercise Selection**
   - Initialize empty exercise list for the day
   - Round-robin add exercises from included layers:
     - Round 1: first[0], primary[0], secondary[0], tertiary[0], last[0]
     - Round 2: first[1], primary[1], secondary[1], tertiary[1], last[1]
     - Continue until duration constraint is met
   - **Diversity Rules**:
     - No duplicate exercises within a day
     - Aim for muscle group variety within each layer
   - **Duration Check**:
     - After each exercise addition, estimate duration using `time_estimates`
     - Stop when `total_minutes_max` would be exceeded
   - **Required Layers**:
     - Ensure at least 1 exercise from "first" (warmup) layer
     - Ensure at least 1 exercise from "primary" (main work) layer
     - If "last" layer is available, always include at least 1 cooldown exercise

6. **Progression & Intensity Assignment**
   - Get `progression_preference` from questionnaire
   - If "no_preference", assign based on goal:
     - muscle_gain → "linear"
     - fat_loss → "density"
     - athletic_performance → "wave_loading"
     - general_fitness → "volume"
   - For each exercise, assign:
     - `progressionScheme`: From user preference or goal default
     - `intensityProfile`: Based on layer (first=light, primary=heavy, secondary=moderate, etc.)

---

### Phase 2: Concrete Workout Generation

**Input**: WorkoutBlueprint
**Output**: Final workout JSON (conforms to WORKOUT_SPEC.md)

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

**Concrete Workout Generation Algorithm**:

1. **Apply Intensity Profile (Week 1 Baseline)**
   - For each exercise in blueprint:
   - Get `category` from `exercise_database.json[exercise.name].category`
   - Look up `intensity_profiles[category][intensityProfile]`
   - Extract base parameters (base_sets, base_reps, base_weight_percent_tm, base_rest_time_minutes, etc.)
   - Apply `experience_modifiers[experience_level]`:
     - Multiply sets/reps by `volume_multiplier`
     - Multiply rest_time by `rest_time_multiplier`
     - Choose `weight_type` (descriptor vs percent_tm)
   - This becomes `week1` parameters

2. **Apply Progression Scheme (Week 2, 3, ..., N)**
   - Get `progressionScheme` from exercise blueprint
   - Look up `progression_schemes[progressionScheme].rules`
   - For each week from 2 to totalWeeks:
     - Apply deltas from progression rules:
       - **linear**: reps -= 1, weight_percent += 5, rest_time -= 0.25
       - **density**: work_time += 25%, reps += 30%, rest_time -= 0.083
       - **wave_loading**: Use wave_patterns array for that week
       - **volume**: sets += 1 every 2 weeks, reps += 20% total
       - **static**: All parameters stay the same
     - Respect minimums (reps_minimum, rest_time_minimum_minutes)
     - Respect maximums (sets_maximum)

3. **Compound Exercise Handling**
   - If exercise has `sub_exercises` in blueprint:
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
│   │   │   ├── phase1-blueprint.ts # Blueprint generation logic
│   │   │   ├── phase2-concrete.ts  # Concrete workout generation logic
│   │   │   ├── exercise-selector.ts # Exercise filtering and selection
│   │   │   ├── progression-calculator.ts # Week-to-week progression math
│   │   │   ├── duration-estimator.ts # Time estimation logic
│   │   │   └── workout-generator.ts # Main orchestrator (calls phase1 → phase2)
│   │   └── ...
│   └── data/
│       ├── exercise_database.json           # 326 exercises (READ-ONLY)
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
// PHASE 1: BLUEPRINT TYPES
// ============================================================================

export interface WorkoutBlueprint {
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
    [dayNumber: string]: DayBlueprint;
  };
}

export interface DayBlueprint {
  dayNumber: number;
  type: "gym" | "home" | "outdoor" | "recovery";
  focus: "Push" | "Pull" | "Legs" | "Upper" | "Lower" | "Full Body" | "Mobility";
  exercises: ExerciseBlueprint[];
}

export interface ExerciseBlueprint {
  name: string; // Lookup key for exercise_database.json
  category?: "emom" | "amrap" | "circuit" | "interval"; // For compound exercises
  sub_exercises?: SubExerciseBlueprint[];
  progressionScheme: "linear" | "density" | "wave_loading" | "volume" | "static";
  intensityProfile: "light" | "moderate" | "moderate_heavy" | "heavy" | "max" | "tabata" | "liss" | "hiit" | "amrap" | "extended";
}

export interface SubExerciseBlueprint {
  name: string;
  progressionScheme: "linear" | "density" | "volume" | "static";
}

// ============================================================================
// PHASE 2: CONCRETE WORKOUT TYPES (WORKOUT_SPEC.md FORMAT)
// ============================================================================

export interface ConcreteWorkout {
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
    [dayNumber: string]: ConcreteDay;
  };
}

export interface ConcreteDay {
  dayNumber: number;
  type: "gym" | "home" | "outdoor" | "recovery";
  focus: string;
  exercises: ConcreteExercise[];
}

export interface ConcreteExercise {
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
  sub_exercises?: ConcreteSubExercise[];
}

export interface ConcreteSubExercise {
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

### Step 2: Blueprint Generation - Split Assignment (2 points)
- [ ] Create `src/lib/engine/phase1-blueprint.ts`
- [ ] Implement `assignSplit(answers: QuestionnaireAnswers): string`
  - Handle "no_preference" default logic
  - Look up split_patterns and repeat cyclically
- [ ] Implement `getDayFocusArray(split: string, days: number): string[]`
- [ ] Unit tests for all split/frequency combinations

### Step 3: Blueprint Generation - Exercise Selection (3 points)
- [ ] Create `src/lib/engine/exercise-selector.ts`
- [ ] Implement `filterExercisesByDay(focus, categories, equipment, difficulty): Exercise[]`
- [ ] Implement `roundRobinSelect(exercisePool, layers, durationConstraint): ExerciseBlueprint[]`
- [ ] Implement muscle group diversity checking
- [ ] Implement duration estimation during selection
- [ ] Unit tests for filtering logic

### Step 4: Blueprint Generation - Progression Assignment (1 point)
- [ ] Implement `assignProgressionScheme(preference, goal): string`
- [ ] Implement `assignIntensityProfile(layer): string`
- [ ] Unit tests for all goal combinations

### Step 5: Concrete Workout Generation - Week 1 Baseline (2 points)
- [ ] Create `src/lib/engine/phase2-concrete.ts`
- [ ] Create `src/lib/engine/progression-calculator.ts`
- [ ] Implement `applyIntensityProfile(exercise, profile, experience): WeekParameters`
- [ ] Apply experience modifiers (volume_multiplier, rest_time_multiplier)
- [ ] Handle weight_type selection (descriptor vs percent_tm)
- [ ] Unit tests for intensity application

### Step 6: Concrete Workout Generation - Week 2-N Progression (2 points)
- [ ] Implement `applyProgressionScheme(week1, scheme, weekNum, totalWeeks): WeekParameters`
- [ ] Implement linear progression math
- [ ] Implement density progression math
- [ ] Implement wave_loading progression math
- [ ] Implement volume progression math
- [ ] Implement static progression (no change)
- [ ] Unit tests for all progression schemes

### Step 7: Main Orchestrator & CLI (2 points)
- [ ] Create `src/lib/engine/workout-generator.ts`
- [ ] Implement `generateWorkout(answers: QuestionnaireAnswers): ConcreteWorkout`
  - Call phase1-blueprint.ts → get WorkoutBlueprint
  - Call phase2-concrete.ts → get ConcreteWorkout
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

- **Determinism is critical**: Use stable sorting, no randomness, no timestamps in generation logic
- **Fail loudly**: No fallback logic - if something is wrong, throw descriptive error
- **CLI first, UI later**: Don't touch SvelteKit yet - validate algorithm in terminal first
- **Exercise DB is source of truth**: Never hardcode exercise data in generation logic
- **Config-driven**: All magic numbers live in workout_generation_rules.json

---

## Follow-Up Tickets (Not in This Ticket)

- TICKET-002: Port workout generation engine to SvelteKit UI
- TICKET-003: Questionnaire flow implementation
- TICKET-004: Exercise history tracking
- TICKET-005: Progressive overload calculations
- TICKET-006: Mobile polish (Capacitor integration)

---

**END OF TICKET-001**
