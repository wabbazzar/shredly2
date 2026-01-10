# Ticket #012: Prescriptive Workout Taxonomy Overhaul

**Type**: refactor
**Status**: ALL PHASES COMPLETE
**Created**: 2026-01-09
**Updated**: 2026-01-09
**Estimated Points**: 21 (across 5 phases)

---

## Overview

Complete overhaul of the questionnaire and workout generation algorithm. Replaces the complex round-robin technique with a prescriptive, deterministic decision tree. This simplifies the codebase while maintaining the exact same workout output data structure for downstream compatibility.

**Reference Spec**: This ticket implements the taxonomy described in the decision tree below.

---

## Current State (After Phase 1)

**Questionnaire**: Simplified to 6 questions (v2.0 format)
- `goal`: build_muscle | tone | lose_weight
- `session_duration`: 20 | 30 | 60
- `experience_level`: beginner | intermediate | advanced
- `equipment_access`: full_gym | dumbbells_only | bodyweight_only
- `training_frequency`: 2 | 3 | 4 | 5 | 6 | 7
- `program_duration`: 3 | 4 | 6

**Compatibility Layer**: `mapToLegacyAnswers()` in `types.ts` converts new format to legacy format internally, allowing existing generator logic to work unchanged.

**Tests**: All 252 tests passing. TypeScript clean.

**Files Modified in Phase 1**:
- `src/data/workout-questionnaire.json` - REWRITTEN (6 questions)
- `src/lib/engine/types.ts` - Added `LegacyQuestionnaireAnswers` + `mapToLegacyAnswers()`
- `src/lib/engine/workout-generator.ts` - Uses mapping internally
- `src/lib/engine/phase1-structure.ts` - Uses `LegacyQuestionnaireAnswers`
- `src/lib/engine/exercise-selector.ts` - Uses `LegacyQuestionnaireAnswers`
- `src/lib/engine/phase2-parameters.ts` - Uses `LegacyQuestionnaireAnswers`
- `cli/test-runner.ts` - Updated for new format
- `cli/sample-questionnaires/*.json` - All 5 files converted
- `tests/fixtures/questionnaire-answers.ts` - Updated fixtures

---

## Critical Constraints

1. **Workout data structure UNCHANGED** - `ParameterizedWorkout`, `ExerciseStructure`, `WeeklyProgression` types must not change
2. **Editor/viewer tests UNCHANGED** - All tests in `tests/unit/editor/` and formatter tests must pass without modification
3. **Zero dead code** - All removed logic must be fully excised, no orphaned functions or unused config
4. **Wired correctly** - New questionnaire flows through new split selection through new day builder

---

## Decision Tree

```
USER INPUT
    |
    +-- GOAL
    |     |
    |     +-- Build Muscle (strength-focused)
    |     +-- Tone (strength + conditioning)
    |     +-- Lose Weight (hiit-focused)
    |
    +-- TIME PER SESSION
    |     |
    |     +-- 20 min
    |     +-- 30 min
    |     +-- 60 min
    |
    +-- EXPERIENCE LEVEL
    |     |
    |     +-- Beginner --> filters exercise DB by difficulty
    |     +-- Intermediate
    |     +-- Advanced
    |
    +-- EQUIPMENT ACCESS
    |     |
    |     +-- Full Gym (barbell + dumbbells)
    |     +-- Dumbbells Onlymuscle_group_priority_mapping
    |     +-- Basic/Bodyweight Only
    |
    +-- TRAINING DAYS PER WEEK
          |
          v
    +---------------------------------------------+
    | SPLIT SELECTION (depends on goal + days)   |
    +---------------------------------------------+
              | 100.77.235.74
              v

GOAL: BUILD MUSCLE / TONE
|
+-- 2 days --> Upper / Lower
|
+-- 3 days --> Push / Pull / Legs (PPL)
|
+-- 4 days --> PPL / Full-Body-Mobility
|
+-- 5 days --> PPL / Upper-Volume / Lower-Volume
|
+-- 6 days --> PPL / FB-Mobility / Upper-Volume / Lower-Volume
|
+-- 7 days --> PPL(strength) / PPL(volume) / Flexibility


GOAL: LOSE WEIGHT
|
+-- 2 days --> Upper-HIIT / Lower-HIIT
|
+-- 3 days --> PPL-HIIT
|
+-- 4 days --> PPL-HIIT / FB-Mobility
|
+-- 5 days --> PPL-HIIT / Upper-Volume / Lower-Volume
|
+-- 6 days --> PPL-HIIT / FB-Mobility / Upper-Volume / Lower-Volume
|
+-- 7 days --> PPL-HIIT / PPL-Volume / Flexibility


GOAL: TONE (Fat Loss variant)
|
+-- 5 days --> PPL / Upper-HIIT / Lower-HIIT
|
+-- 6 days --> PPL / FB-Mobility / Upper-HIIT / Lower-HIIT
```

---

## Day Structure by Equipment

```
EQUIPMENT CHECK
|
+-- FULL GYM (Barbell + Dumbbells)
|     |
|     +-- Day Structure:
|           |
|           +-- [Strength Block 1] -- barbell primary (80%)
|           +-- [Strength Block 2] -- dumbbell secondary (20%)
|           +-- [Compound Block 1] -- 2-4 blocks based on time
|           +-- [Compound Block 2] -- (if time allows)
|           +-- [Compound Block 3] -- (if time allows)
|           +-- [Compound Block 4] -- (if time allows)
|
+-- DUMBBELLS ONLY
|     |
|     +-- Day Structure:
|           |
|           +-- [Strength Block 1] -- dumbbell
|           +-- [Strength Block 2] -- dumbbell
|           +-- [Compound Block 1] -- 2-4 blocks based on time
|           +-- ...
|
+-- BASIC / BODYWEIGHT ONLY
      |
      +-- Day Structure (converted):
            |
            +-- [Interval Block] -- 3 exercises (replaces 2 strength)
            +-- [Compound Block 1]
            +-- [Compound Block 2]
            +-- ...
```

---

## Compound Block Types

```
COMPOUND BLOCKS (can be any of):
|
+-- AMRAP     -- as many reps as possible in time window
+-- EMOM      -- every minute on the minute
+-- Circuit   -- rotate through exercises with minimal rest
+-- Interval  -- work/rest periods
```

---

## Progression Schemes

```
PROGRESSION TYPE
|
+-- LINEAR
|     |
|     +-- Strength:    decrease reps, increase weight
|     +-- AMRAP:       increase reps (same time)
|     +-- EMOM:        increase reps (same time)
|     +-- Interval:    increase work/rest ratio
|     +-- Circuit:     increase sets
|
+-- VOLUME
      |
      +-- Strength:    increase sets and reps, same weight
      +-- AMRAP:       increase time
      +-- EMOM:        increase time
      +-- Interval:    increase time
      +-- Circuit:     increase sets
```

---

## Program Duration Options

```
PROGRAM LENGTH (weeks)
|
+-- 3 weeks
+-- 4 weeks
+-- 6 weeks
```

---

## Taxonomy Notes

- "-hiit" suffix indicates compound-only structure (no isolated strength blocks)
- "-volume" suffix indicates high-rep strength + compound setup
- Time budget (20/30/60) determines number of compound blocks (2-4)
- Experience level filters exercise database by difficulty attribute
- Equipment access determines barbell vs dumbbell vs bodyweight exercise pool

---

## Current Architecture (TO BE REPLACED)

### Files Affected

| File | Lines | Action | Notes |
|------|-------|--------|-------|
| `src/data/workout-questionnaire.json` | 156 | REWRITE | Simplify from 13 questions to 5 core |
| `src/lib/engine/exercise-selector.ts` | 993 | MAJOR REFACTOR | Remove round-robin, replace with prescriptive |
| `src/lib/engine/phase1-structure.ts` | 234 | MODIFY | Update split assignment logic |
| `src/lib/engine/workout-generator.ts` | 180 | MODIFY | Wire new flow |
| `src/data/workout_generation_rules.json` | 867 | MODIFY | Add new config, remove unused |
| `cli/interactive-questionnaire.ts` | ~400 | UPDATE | New question flow |

### Code to REMOVE (Round-Robin Complexity)

**In `exercise-selector.ts`**:
```
roundRobinSelectExercises()     -- 330 lines (lines 468-798)
  - Layer cycling state machine
  - layerIndices map maintenance
  - Round-by-round ratio enforcement
  - muscleGroupCoverage tracking within selection loop

prioritizeByMuscleGroupCoverage()  -- 105 lines (lines 839-976)
  - 5-tier scoring system
  - Complex coverage balancing algorithm
```

**In `workout_generation_rules.json`**:
```
exercise_selection_strategy.layer_ratios  -- complex ratio config
exercise_selection_strategy.round_robin_algorithm  -- pseudocode docs
```

### Code to KEEP (Must Remain Compatible)

**Types (NO CHANGES)**:
- `ExerciseStructure` - exercise with name, progressionScheme, intensityProfile
- `ParameterizedWorkout` - full workout with weeks array
- `WeeklyProgression` - week-by-week parameters
- `DayStructure` - day with focus and exercises

**Functions (Signature Unchanged)**:
- `generateWorkout(answers)` - main entry point
- `parameterizeExercise()` - Phase 2 parameter assignment
- `assignProgressionScheme()` - already config-driven
- `assignIntensityProfile()` - already config-driven
- `filterExercisesForLayer()` - exercise pool filtering
- `createExercisePoolsForDay()` - pool creation per day

**Config Sections (Keep)**:
- `intensity_profiles` - category+intensity -> parameters
- `progression_schemes` - week-by-week progression rules
- `split_patterns` - day focus arrays (may extend)
- `split_muscle_group_mapping` - focus -> muscles
- `duration_constraints` - session duration -> layer limits

---

## Implementation Phases

### Phase 1: Questionnaire Simplification (5 points) - COMPLETE

**Status**: DONE (2026-01-09)

**Completed**:
- Rewrote questionnaire JSON (8 -> 6 questions)
- Created new `QuestionnaireAnswers` type with v2.0 format
- Created `LegacyQuestionnaireAnswers` type for backward compatibility
- Added `mapToLegacyAnswers()` mapping function
- Updated all engine files to use legacy format internally
- Updated all test fixtures and sample questionnaires
- All 252 tests passing

**Key Architecture Decision**: Using compatibility layer (`mapToLegacyAnswers`) allows Phase 1 to be complete while existing round-robin logic continues to work. Phases 2-5 will progressively replace legacy logic and eventually remove the compatibility layer.

---

### Phase 1 Reference (Original Tasks):

1.1 Rewrite `src/data/workout-questionnaire.json`:
```json
{
  "questions": [
    {
      "id": "goal",
      "type": "single_choice",
      "question": "What is your primary goal?",
      "options": [
        { "value": "build_muscle", "label": "Build Muscle" },
        { "value": "tone", "label": "Tone / Get Fit" },
        { "value": "lose_weight", "label": "Lose Weight" }
      ],
      "required": true
    },
    {
      "id": "session_duration",
      "type": "single_choice",
      "question": "How much time per workout?",
      "options": [
        { "value": "20", "label": "20 minutes" },
        { "value": "30", "label": "30 minutes" },
        { "value": "60", "label": "60 minutes" }
      ],
      "required": true
    },
    {
      "id": "experience_level",
      "type": "single_choice",
      "question": "What is your experience level?",
      "options": [
        { "value": "beginner", "label": "Beginner" },
        { "value": "intermediate", "label": "Intermediate" },
        { "value": "advanced", "label": "Advanced" }
      ],
      "required": true
    },
    {
      "id": "equipment_access",
      "type": "single_choice",
      "question": "What equipment do you have access to?",
      "options": [
        { "value": "full_gym", "label": "Full Gym (Barbells + Dumbbells)" },
        { "value": "dumbbells_only", "label": "Dumbbells Only" },
        { "value": "bodyweight_only", "label": "Bodyweight / Basic Only" }
      ],
      "required": true
    },
    {
      "id": "training_frequency",
      "type": "single_choice",
      "question": "How many days per week can you train?",
      "options": [
        { "value": "2", "label": "2 days" },
        { "value": "3", "label": "3 days" },
        { "value": "4", "label": "4 days" },
        { "value": "5", "label": "5 days" },
        { "value": "6", "label": "6 days" },
        { "value": "7", "label": "7 days" }
      ],
      "required": true
    },
    {
      "id": "program_duration",
      "type": "single_choice",
      "question": "Program length?",
      "options": [
        { "value": "3", "label": "3 weeks" },
        { "value": "4", "label": "4 weeks" },
        { "value": "6", "label": "6 weeks" }
      ],
      "required": true
    }
  ]
}
```

1.2 Update `QuestionnaireAnswers` type in `src/lib/engine/types.ts`:
- Change `primary_goal` values: `build_muscle | tone | lose_weight`
- Change `session_duration` values: `20 | 30 | 60`
- Change `experience_level` values: `beginner | intermediate | advanced`
- Change `equipment_access` values: `full_gym | dumbbells_only | bodyweight_only`
- Change `program_duration` values: `3 | 4 | 6`

1.3 Update CLI `interactive-questionnaire.ts` to use new question flow

1.4 Remove dead answer handling code for removed questions:
- `training_split_preference` - no longer user-selectable
- `progression_preference` - derived from goal
- All 90+ minute session handling
- Flexible/varies duration handling

**Tests to UPDATE**:
- `tests/fixtures/` - all 6 questionnaire fixtures
- `tests/unit/questionnaire/` - validation tests

**Tests UNCHANGED**:
- `tests/unit/editor/` - all editor tests
- Formatter tests

---

### Phase 2: Prescriptive Split Selection (5 points) - COMPLETE

**Status**: DONE (2026-01-09)

**Completed**:
- Added `prescriptive_splits` config section to `workout_generation_rules.json`
- Added 16 new focus type mappings to `split_muscle_group_mapping` (HIIT, Volume, Strength, Mobility variants)
- Created `PrescriptiveSplits` TypeScript interface in `types.ts`
- Created `DayFocus` type union for all focus types
- Created `getPrescriptiveSplit(goal, frequency)` function in `phase1-structure.ts`
- Created `getBaseFocus()` helper to extract base focus from suffixed strings
- Created `parseFocusSuffix()` helper to parse suffix type
- Updated `workout-generator.ts` to use new prescriptive split logic directly (bypasses legacy `assignSplit`)
- Updated integration tests for new PPL split behavior
- Added 27 new unit tests for prescriptive split functions
- All 279 tests passing, TypeScript clean

**Key Architecture Decision**: The generator now uses `getPrescriptiveSplit(answers.goal, frequency)` directly instead of going through `mapToLegacyAnswers()` + `assignSplit()`. The prescriptive splits config provides deterministic day focus arrays for all 18 goal + frequency combinations.

**Goal**: Replace the legacy split assignment with deterministic lookup from new goal + frequency decision tree.

**Current State**:
- `workout-generator.ts` calls `mapToLegacyAnswers()` then passes to `assignSplit()`
- `assignSplit()` in `phase1-structure.ts` uses legacy `training_split_preference` + `default_split_by_frequency` config
- Need to replace with direct lookup using new `goal` + `frequency` combination

**What Changes**:
1. Add `prescriptive_splits` config section to `workout_generation_rules.json`
2. Create `getPrescriptiveSplit(goal, frequency)` function
3. Update `workout-generator.ts` to use new split logic with `answers.goal` directly
4. Add new day focus suffixes (-HIIT, -Volume, -Strength, -Mobility, Flexibility)
5. Update `split_muscle_group_mapping` config for new focus types

**Tasks**:

2.1 Add new config section to `workout_generation_rules.json`:
```json
{
  "prescriptive_splits": {
    "build_muscle": {
      "2": ["Upper", "Lower"],
      "3": ["Push", "Pull", "Legs"],
      "4": ["Push", "Pull", "Legs", "FullBody-Mobility"],
      "5": ["Push", "Pull", "Legs", "Upper-Volume", "Lower-Volume"],
      "6": ["Push", "Pull", "Legs", "FullBody-Mobility", "Upper-Volume", "Lower-Volume"],
      "7": ["Push-Strength", "Pull-Strength", "Legs-Strength", "Push-Volume", "Pull-Volume", "Legs-Volume", "Flexibility"]
    },
    "tone": {
      "2": ["Upper", "Lower"],
      "3": ["Push", "Pull", "Legs"],
      "4": ["Push", "Pull", "Legs", "FullBody-Mobility"],
      "5": ["Push", "Pull", "Legs", "Upper-HIIT", "Lower-HIIT"],
      "6": ["Push", "Pull", "Legs", "FullBody-Mobility", "Upper-HIIT", "Lower-HIIT"],
      "7": ["Push", "Pull", "Legs", "Push-Volume", "Pull-Volume", "Legs-Volume", "Flexibility"]
    },
    "lose_weight": {
      "2": ["Upper-HIIT", "Lower-HIIT"],
      "3": ["Push-HIIT", "Pull-HIIT", "Legs-HIIT"],
      "4": ["Push-HIIT", "Pull-HIIT", "Legs-HIIT", "FullBody-Mobility"],
      "5": ["Push-HIIT", "Pull-HIIT", "Legs-HIIT", "Upper-Volume", "Lower-Volume"],
      "6": ["Push-HIIT", "Pull-HIIT", "Legs-HIIT", "FullBody-Mobility", "Upper-Volume", "Lower-Volume"],
      "7": ["Push-HIIT", "Pull-HIIT", "Legs-HIIT", "Push-Volume", "Pull-Volume", "Legs-Volume", "Flexibility"]
    }
  }
}
```

2.2 Create new function `getPrescriptiveSplit(goal, frequency)`:
```typescript
function getPrescriptiveSplit(
  goal: 'build_muscle' | 'tone' | 'lose_weight',
  frequency: number
): string[] {
  const config = loadConfig();
  return config.prescriptive_splits[goal][frequency.toString()];
}
```

2.3 Replace `assignSplit()` logic in `phase1-structure.ts`:
- Remove preference-based fallback logic
- Direct lookup from prescriptive_splits config
- Return the day focus array directly (not split type)

2.4 Update `getDayFocusArray()` to use new split:
- Input: goal + frequency (not split type)
- Output: string[] of day focuses from config

2.5 Add day type definitions for new suffixes:
- `-HIIT` suffix: compound-only day (no strength blocks)
- `-Volume` suffix: high-rep strength + compounds
- `-Strength` suffix: standard strength + compounds
- `-Mobility` suffix: flexibility/mobility focus
- `Flexibility`: recovery/mobility day

**Tests to UPDATE**:
- `tests/unit/engine/phase1-structure.test.ts`
- `tests/unit/engine/workout-generator.test.ts`
- `tests/integration/end-to-end-generation.test.ts`

---

### Phase 3: Day Structure by Equipment (5 points) - COMPLETE

**Status**: DONE (2026-01-09)

**Completed**:
- Added `day_structure_by_equipment` config section to `workout_generation_rules.json`
- Added `compound_blocks_by_time` config for duration-based compound block counts
- Created `buildDayStructure(dayFocus, equipment, duration)` function in `phase1-structure.ts`
- Created `selectExercisesForDay()` function with block-based selection in `exercise-selector.ts`
- Created `selectExerciseForBlock()` for per-block exercise selection
- Created equipment-specific selection functions (strength, compound, interval, mobility)
- Updated `workout-generator.ts` to use new block-based selection (removed round-robin calls)
- Fixed sub-exercise intensity profile inheritance (fallback to compatible profiles)
- Fixed compound exercise validation (filter out invalid/insufficient compounds)
- Removed ~540 lines of old round-robin code:
  - `roundRobinSelectExercises()` - replaced by `selectExercisesForDay()`
  - `getDefaultIntensityForLayer()` - no longer needed
  - `hasMetMinimumRequirements()` - no longer needed
  - `prioritizeByMuscleGroupCoverage()` - no longer needed
  - `trackMuscleGroupCoverage()` - no longer needed
- Updated test thresholds for block-based selection behavior
- All 279 tests passing, TypeScript clean

**Key Architecture Decision**: Block-based selection is simpler and more deterministic than round-robin. Each day's structure is determined by equipment access and focus suffix, then exercises are selected block-by-block. This eliminates complex layer ratio tracking and tier-based scoring.

**Goal**: Implement equipment-based day structure (strength blocks vs interval conversion).

**Tasks (Original):**

3.1 Add new config section `day_structure_by_equipment`:
```json
{
  "day_structure_by_equipment": {
    "full_gym": {
      "standard": {
        "blocks": [
          { "type": "strength", "equipment_preference": "barbell", "count": 1 },
          { "type": "strength", "equipment_preference": "dumbbell", "count": 1 },
          { "type": "compound", "count": "time_based" }
        ]
      },
      "hiit": {
        "blocks": [
          { "type": "compound", "count": "time_based" }
        ]
      },
      "volume": {
        "blocks": [
          { "type": "strength_high_rep", "equipment_preference": "any", "count": 2 },
          { "type": "compound", "count": "time_based" }
        ]
      }
    },
    "dumbbells_only": {
      "standard": {
        "blocks": [
          { "type": "strength", "equipment_preference": "dumbbell", "count": 2 },
          { "type": "compound", "count": "time_based" }
        ]
      }
    },
    "bodyweight_only": {
      "standard": {
        "blocks": [
          { "type": "interval", "exercise_count": 3, "count": 1 },
          { "type": "compound", "count": "time_based" }
        ]
      }
    }
  },
  "compound_blocks_by_time": {
    "20": 2,
    "30": 2,
    "60": 4
  }
}
```

3.2 Create new function `buildDayStructure(dayFocus, equipment, duration)`:
```typescript
function buildDayStructure(
  dayFocus: string,
  equipment: 'full_gym' | 'dumbbells_only' | 'bodyweight_only',
  duration: number
): BlockSpec[] {
  // Parse day focus suffix (-HIIT, -Volume, etc.)
  // Look up structure from config
  // Calculate compound block count from duration
  // Return block specifications
}
```

3.3 Create new function `selectExercisesForBlock(blockSpec, pools, context)`:
- Replace round-robin with direct block-based selection
- For strength blocks: select 1 exercise matching equipment preference
- For compound blocks: select exercises for EMOM/AMRAP/Circuit/Interval
- For interval blocks (bodyweight): select 3 exercises for interval structure

3.4 Update `createExercisePoolsForDay()`:
- Add equipment preference filtering
- Maintain existing muscle group targeting
- Keep difficulty filtering by experience

3.5 Remove round-robin functions:
- Delete `roundRobinSelectExercises()` (330 lines)
- Delete `prioritizeByMuscleGroupCoverage()` (105 lines)
- Delete layer ratio tracking code
- Delete round-by-round state machine

**Tests to UPDATE**:
- `tests/unit/engine/exercise-selector.test.ts` - heavy changes
- `tests/integration/muscle-group-coverage.test.ts`

---

### Phase 4: Progression Derivation (3 points) - COMPLETE

**Status**: DONE (2026-01-09)

**Completed**:
- Added `progression_by_goal` config section to `workout_generation_rules.json`
- Added `ProgressionByGoal` TypeScript interface in `types.ts`
- Created `getProgressionFromGoal(goal, exerciseCategory, rules)` function in `phase1-structure.ts`
- Updated `selectExercisesForDay()` to accept goal parameter
- Updated `selectExerciseForBlock()` to accept goal parameter
- Updated `selectStrengthExercise()` to use `getProgressionFromGoal()` instead of `assignProgressionScheme()`
- Updated `workout-generator.ts` to pass goal to `selectExercisesForDay()`
- Added 11 new unit tests for `getProgressionFromGoal()` function
- All 290 tests passing, TypeScript clean

**Key Architecture Decision**: Progression is now derived directly from goal (v2.0 format) without going through legacy answers. The function `getProgressionFromGoal()` uses the new `progression_by_goal` config which maps directly from new goal values (build_muscle, tone, lose_weight) to progression schemes.

**Progression Rules**:
- build_muscle -> linear (decrease reps, increase weight)
- tone -> volume (increase sets/reps, weight constant)
- lose_weight -> density (more work in same time)
- mobility/flexibility/cardio -> static (always)
- emom/amrap/circuit/interval -> density (always)

**Goal**: Derive progression scheme from goal (no user choice).

**Tasks (Original)**:

4.1 Add progression derivation config:
```json
{
  "progression_by_goal": {
    "build_muscle": "linear",
    "tone": "volume",
    "lose_weight": "density"
  }
}
```

4.2 Update `assignProgressionScheme()`:
- Remove user preference input
- Derive directly from goal
- Keep existing progression application logic

4.3 Remove progression preference question handling:
- Remove from questionnaire
- Remove from CLI interactive flow
- Remove validation for removed option

4.4 Verify progression application unchanged:
- `applyProgressionScheme()` logic stays same
- Week-by-week calculation stays same
- Compound progression logic (from ticket #009) stays same

**Tests to UPDATE**:
- `tests/unit/engine/progression.test.ts`
- Remove progression preference fixture variations

---

### Phase 5: Dead Code Removal & Wiring (3 points) - COMPLETE

**Status**: DONE (2026-01-09)

**Completed**:
- Removed dead functions from `phase1-structure.ts`:
  - `assignSplit()` - replaced by `getPrescriptiveSplit()`
  - `getDayFocusArray()` - replaced by prescriptive splits config
  - `generateDayStructure()` - replaced by inline day building in workout-generator
  - `assignProgressionScheme()` - replaced by `getProgressionFromGoal()`
  - `applyProgressionAndIntensity()` - no longer called
- Removed unused imports from `workout-generator.ts`:
  - `assignSplit`, `getDayFocusArray`, `generateDayStructure`
- Removed unused config sections from `workout_generation_rules.json`:
  - `default_split_by_frequency` - replaced by prescriptive_splits
  - `default_progression_by_goal` - replaced by progression_by_goal
  - `exercise_selection_strategy.layer_ratios` - round-robin removed
  - `exercise_selection_strategy.algorithm` - round-robin removed
  - `exercise_selection_strategy.filling_algorithm_pseudocode` - round-robin docs
  - `exercise_selection_strategy.example_45_60_minute_workout` - round-robin example
- Removed unused type definitions from `types.ts`:
  - `DefaultSplitByFrequency` interface
  - `DefaultProgressionByGoal` interface
  - Cleaned up `ExerciseSelectionStrategy` interface (removed layer_ratios, algorithm)
- Updated `GenerationRules` interface to remove dead config references
- All 290 tests passing, TypeScript clean

**Key Architecture Note**: `LegacyQuestionnaireAnswers` and `mapToLegacyAnswers()` are still retained because:
1. `selectExercisesForDay()` and related functions use legacy format for equipment/experience filtering
2. `phase2-parameters.ts` uses legacy format for experience modifiers
3. Tests rely on `mapToLegacyAnswers()` for test fixtures
These can be removed in a future cleanup when all functions are migrated to use new format directly.

**Goal**: Remove all orphaned code and verify end-to-end wiring.

**Tasks (Original)**:

5.1 Remove unused config sections from `workout_generation_rules.json`:
- `category_priority_by_goal` - replaced by prescriptive splits
- `split_category_overrides` - no longer needed
- `exercise_selection_strategy.layer_ratios` - no round-robin
- `exercise_selection_strategy.round_robin_algorithm` - documentation only
- Any unreferenced intensity profiles
- Any unreferenced duration constraints

5.2 Remove unused functions from `exercise-selector.ts`:
- Verify no orphaned helper functions
- Remove any unused imports
- Verify all exports are consumed

5.3 Remove unused code from `phase1-structure.ts`:
- Old split preference logic
- Unused type definitions
- Dead default mappings

5.4 Verify complete wiring:
```
questionnaire.json (5 questions)
    |
    v
interactive-questionnaire.ts (CLI input)
    |
    v
workout-generator.ts (main entry)
    |
    +-- getPrescriptiveSplit(goal, frequency)
    |     |
    |     v
    |   prescriptive_splits config --> day focus array
    |
    +-- For each day:
          |
          +-- buildDayStructure(focus, equipment, duration)
          |     |
          |     v
          |   day_structure_by_equipment config --> block specs
          |
          +-- For each block:
                |
                +-- selectExercisesForBlock(spec, pools)
                      |
                      v
                    exercise array (ExerciseStructure[])
    |
    v
parameterizeExercise() (Phase 2 - unchanged)
    |
    v
ParameterizedWorkout (output structure - unchanged)
```

5.5 Run full test suite and fix any failures:
- All `tests/unit/editor/` must pass unchanged
- All formatter tests must pass unchanged
- Update remaining tests for new flow

5.6 Manual verification:
- Generate workout via CLI with each goal
- Verify output structure matches ParameterizedWorkout schema
- Verify exercises appropriate for equipment selection
- Verify day focuses match prescriptive split

---

## Test Strategy

### Tests That MUST NOT CHANGE (Downstream Compatibility)

These tests validate the workout output structure that editors/formatters consume:

```
tests/unit/editor/
  +-- interactive-workout-editor.test.ts (96 tests)
  +-- editor-compound-blocks.test.ts (29 tests)
  +-- editor-undo.test.ts

tests/unit/formatter/
  +-- workout-formatter.test.ts
  +-- exercise-metadata.test.ts (67 tests)
```

If any of these tests fail, the refactor has broken downstream compatibility.

### Tests That MUST Be Updated

```
tests/fixtures/
  +-- questionnaire-*.json (all 6 fixtures - new question format)

tests/unit/engine/
  +-- exercise-selector.test.ts (round-robin -> prescriptive)
  +-- phase1-structure.test.ts (new split logic)
  +-- workout-generator.test.ts (new flow)

tests/unit/questionnaire/
  +-- questionnaire-validation.test.ts (new questions)

tests/integration/
  +-- end-to-end-generation.test.ts (new fixtures)
  +-- muscle-group-coverage.test.ts (new selection logic)
```

### New Tests to Add

```
tests/unit/engine/
  +-- prescriptive-split.test.ts
    - Test all goal + frequency combinations
    - Test day focus array generation

  +-- day-structure.test.ts
    - Test equipment -> structure mapping
    - Test HIIT/Volume/Strength suffix handling
    - Test compound block count by duration
```

---

## Success Criteria

1. All 96+ editor tests pass unchanged
2. All formatter tests pass unchanged
3. `npm run lint` passes
4. `npm run typecheck` passes
5. Generate valid workout for all 18 combinations (3 goals x 6 frequencies)
6. Zero orphaned functions in git diff
7. Zero unused config sections
8. CLI questionnaire uses exactly 6 questions
9. Output ParameterizedWorkout validates against existing schema

---

## Rollback Plan

If issues discovered after partial implementation:

```bash
git log --oneline -10  # Find last stable commit
git reset --hard <commit>  # Revert to stable state
```

Each phase should be committed separately for easy rollback.

---

## Files Summary

### Already Modified (Phases 1-4 - COMPLETE)

| File | Status | Notes |
|------|--------|-------|
| `src/data/workout-questionnaire.json` | DONE | 6 questions v2.0 format |
| `src/lib/engine/types.ts` | DONE | Added `ProgressionByGoal`, `BlockSpec`, `DayStructureByEquipment`, `CompoundBlocksByTime` + Phase 1-2 types |
| `src/lib/engine/workout-generator.ts` | DONE | Uses `selectExercisesForDay()` with goal parameter |
| `src/lib/engine/phase1-structure.ts` | DONE | Added `getProgressionFromGoal()`, `buildDayStructure()`, `resolveBlockCounts()` |
| `src/lib/engine/exercise-selector.ts` | DONE | Uses `getProgressionFromGoal()` for strength exercises |
| `src/lib/engine/phase2-parameters.ts` | DONE | Fixed sub-exercise intensity profile inheritance |
| `src/data/workout_generation_rules.json` | DONE | Added `progression_by_goal`, `day_structure_by_equipment`, `compound_blocks_by_time` |
| `cli/test-runner.ts` | DONE | Uses new format |
| `cli/sample-questionnaires/*.json` | DONE | All 5 files converted |
| `tests/fixtures/questionnaire-answers.ts` | DONE | New format fixtures |
| `tests/unit/prescriptive-split.test.ts` | DONE | 38 tests (27 split + 11 progression) |
| `tests/integration/muscle-group-coverage.test.ts` | DONE | Updated thresholds for block-based selection |

### Phase 5 Cleanup (COMPLETE)

**Removed**:
- `assignSplit()`, `getDayFocusArray()`, `generateDayStructure()`, `assignProgressionScheme()`, `applyProgressionAndIntensity()` from `phase1-structure.ts`
- `default_split_by_frequency`, `default_progression_by_goal`, `layer_ratios`, round-robin documentation from config
- `DefaultSplitByFrequency`, `DefaultProgressionByGoal` type definitions

**Retained for future cleanup**:
- `LegacyQuestionnaireAnswers` and `mapToLegacyAnswers()` - still used by exercise selection and parameterization functions

### NO CHANGES (Must Pass Unchanged)

- `src/lib/engine/exercise-metadata.ts`
- `tests/unit/editor/*.test.ts` (125+ tests)
- `tests/unit/formatter/*.test.ts`

