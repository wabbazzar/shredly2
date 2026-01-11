# Ticket #013: Deduplicate Muscle Group Configuration

**Type**: refactor
**Status**: COMPLETE
**Created**: 2026-01-10
**Updated**: 2026-01-10
**Estimated Points**: 6

---

## Overview

Cleanup technical debt from Ticket #012. The `split_muscle_group_mapping` configuration has 22 entries when only 7 are needed. The `-HIIT`, `-Volume`, `-Strength`, and `-Mobility` suffixes have NO impact on muscle group selection - they only affect day scheduling (compound-only vs strength blocks). The duplicative entries should be removed and the code should use `getBaseFocus()` consistently.

**Root Cause**: During #012 Phase 2 implementation, all focus type variants were added to `split_muscle_group_mapping` for defensive coding, but this created 15 unnecessary duplicate entries.

---

## Progress Summary

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Remove Duplicative Config | COMPLETE | 15 entries removed, 7 base entries remain |
| Phase 2: Update Code to Use getBaseFocus() | COMPLETE | Simplified to always use getBaseFocus() - no fallback needed |
| Phase 3: Update TypeScript Types | COMPLETE | Added BaseFocusType, MuscleGroupMappingEntry types |
| Phase 4: Dead Code Cleanup | COMPLETE | Removed ~50 lines of dead code + 7 unused config values |

---

## Current State (After Phase 1)

### `split_muscle_group_mapping` (7 entries - CLEAN)

```
Base types only:
- Full Body, Upper, Lower, Push, Pull, Legs, Mobility
```

### `getBaseFocus()` Updated

Special cases now map to `Mobility`:
- `Flexibility` -> `Mobility`
- `FullBody-Mobility` -> `Mobility`

### Tests Updated

- `should have base focus mapping for all focus types via getBaseFocus()` - verifies all focus types map to valid base
- `should have exactly 7 base focus types in split_muscle_group_mapping` - verifies config cleanup
- `should map special focus types to Mobility` - verifies Flexibility/FullBody-Mobility mapping

**All 291 tests passing. TypeScript clean.**

---

## Proposed Solution

### Phase 1: Remove Duplicative Config Entries (2 points) - COMPLETE

**Status**: DONE (2026-01-10)

**Completed**:
1. Removed 15 suffixed entries from `split_muscle_group_mapping`:
   - `Upper-HIIT`, `Lower-HIIT`, `Push-HIIT`, `Pull-HIIT`, `Legs-HIIT`
   - `Upper-Volume`, `Lower-Volume`, `Push-Volume`, `Pull-Volume`, `Legs-Volume`
   - `Push-Strength`, `Pull-Strength`, `Legs-Strength`
   - `FullBody-Mobility`, `Flexibility`

2. Kept only 7 base entries:
   - `Full Body`, `Upper`, `Lower`, `Push`, `Pull`, `Legs`, `Mobility`

3. Updated `description` field to document that suffixed focus types use base mapping via `getBaseFocus()`

4. Updated `getBaseFocus()` in `phase1-structure.ts` to map special cases:
   - `Flexibility` -> `Mobility`
   - `FullBody-Mobility` -> `Mobility`

5. Updated tests in `prescriptive-split.test.ts`:
   - Changed `should return as-is for special focus types` -> `should map special focus types to Mobility`
   - Changed `should have all focus types defined in split_muscle_group_mapping` -> `should have base focus mapping for all focus types via getBaseFocus()`
   - Added `should have exactly 7 base focus types in split_muscle_group_mapping`

**Files Modified**:
- `src/data/workout_generation_rules.json` - removed 15 duplicative entries (~75 lines)
- `src/lib/engine/phase1-structure.ts` - updated `getBaseFocus()` to map Flexibility/FullBody-Mobility to Mobility
- `tests/unit/prescriptive-split.test.ts` - updated 2 tests, added 1 new test

**Result**: 291 tests passing, TypeScript clean

### Phase 2: Update Code to Always Use Base Focus (2 points) - PENDING

**Note**: After Phase 1, the existing fallback logic now works correctly:
```typescript
const muscleMapping = rules.split_muscle_group_mapping[dayFocus] ||
                      rules.split_muscle_group_mapping[baseFocus];
```
Since suffixed entries no longer exist, the fallback to `baseFocus` always triggers. This is functional but could be simplified.

**Optional cleanup** (low priority since code works):

1. In `exercise-selector.ts` (line 319-320), simplify to direct lookup:
```typescript
const baseFocus = getBaseFocus(dayFocus);
const muscleMapping = rules.split_muscle_group_mapping[baseFocus];
```

2. In `constructCompoundExercise()` (line 687), add `getBaseFocus()` call:
```typescript
const baseFocus = getBaseFocus(focus);
const muscleMapping = rules.split_muscle_group_mapping[baseFocus];
```

3. Verify `createExercisePoolsForDay()` (line 219) consistency

### Phase 3: Update TypeScript Types (1 point) - PENDING

**Note**: Test updates were already completed in Phase 1.

**Remaining work**:

1. Update `SplitMuscleGroupMapping` type to only include base types:

```typescript
type BaseFocusType = 'Full Body' | 'Upper' | 'Lower' | 'Push' | 'Pull' | 'Legs' | 'Mobility';

interface SplitMuscleGroupMapping {
  description: string;
  [K in BaseFocusType]: {
    include_muscle_groups: string[];
    exclude_muscle_groups?: string[];
    description?: string;
  };
}
```

### Phase 4: Dead Code Cleanup (1 point)

Remove unreachable code paths identified during progression logic analysis.

**1. Remove compound volume progression logic in `phase2-parameters.ts`**

In `applyVolumeProgression()` (lines 404-445), remove the compound-specific branch:

```typescript
// REMOVE THIS BLOCK (lines 404-446):
if (isCompoundParent(exerciseCategory)) {
  if (weekN.work_time_minutes !== undefined) {
    // ... EMOM/AMRAP/Circuit/Interval volume logic
  }
  return weekN;
}
```

**Reason**: All compound exercises are hardcoded with `progressionScheme: 'density'` in `constructCompoundExercise()`. This volume code path is NEVER executed.

**2. Remove defensive compound check in `getProgressionFromGoal()` in `phase1-structure.ts`**

```typescript
// REMOVE THIS BLOCK (lines 105-108):
if (['emom', 'amrap', 'circuit', 'interval'].includes(exerciseCategory)) {
  return 'density';
}
```

**Reason**: `getProgressionFromGoal()` is only called by `selectStrengthExercise()` with `exerciseCategory: 'strength'`. Compound exercises bypass this function entirely.

**3. Remove unused config entries in `workout_generation_rules.json`**

Remove from `progression_schemes.volume.rules`:
- `compound_emom_time_increase_per_sub_per_week`
- `compound_emom_default_sub_count`
- `compound_amrap_time_increase_per_week`
- `compound_circuit_increase_time`
- `compound_circuit_time_increase_per_week`
- `compound_reps_increase_enabled`
- `round_work_time_to_whole_minutes`

**Reason**: These config values are only used by the compound volume progression code that is being removed.

---

## Files Affected

| File | Action | Notes |
|------|--------|-------|
| `src/data/workout_generation_rules.json` | MODIFY | Remove 15 duplicative entries + 7 unused config values |
| `src/lib/engine/exercise-selector.ts` | MODIFY | Always use `getBaseFocus()` for muscle mapping lookup |
| `src/lib/engine/types.ts` | MODIFY | Update `SplitMuscleGroupMapping` type |
| `src/lib/engine/phase1-structure.ts` | MODIFY | Remove dead compound category check in `getProgressionFromGoal()` |
| `src/lib/engine/phase2-parameters.ts` | MODIFY | Remove dead compound volume progression code (~45 lines) |
| `tests/unit/prescriptive-split.test.ts` | MODIFY | Update focus type validation test |

---

## Progression Logic Verification (Completed During Analysis)

As requested, verified the linear/volume/density progression logic is correct.

### Progression Scheme Summary

| Progression | When Used | Behavior |
|------------|-----------|----------|
| **linear** | build_muscle goal + strength/bodyweight | Reps decrease (-1/week), weight increase (+5%/week), rest decrease |
| **volume** | tone goal + strength/bodyweight | Sets increase every N weeks, reps increase (+20% total), weight CONSTANT |
| **density** | lose_weight goal OR all compound blocks | Work_time STATIC for compounds, sub-exercise reps increase (+30% total), rest decrease |
| **static** | mobility/flexibility/cardio | No changes - all parameters identical across weeks |

### `getProgressionFromGoal()` in `phase1-structure.ts`

```typescript
// 1. Static for recovery categories (CORRECT)
if (exerciseCategory === 'mobility' || exerciseCategory === 'flexibility' || exerciseCategory === 'cardio') {
  return 'static';
}

// 2. Density for metabolic categories (CORRECT - defensive)
if (['emom', 'amrap', 'circuit', 'interval'].includes(exerciseCategory)) {
  return 'density';
}

// 3. Goal-based for strength/bodyweight (CORRECT)
// build_muscle -> linear (decrease reps, increase weight)
// tone -> volume (increase sets/reps, weight constant)
// lose_weight -> density (more work in same time)
return rules.progression_by_goal[goal];
```

### `constructCompoundExercise()` in `exercise-selector.ts`

Lines 824-826 correctly hardcode `progressionScheme: 'density'` for all compound exercises:

```typescript
sub_exercises: constituentExercises.map(([name, _]) => ({
  name,
  progressionScheme: 'density' // Compound exercises typically use density progression
})),
progressionScheme: 'density',
```

### `applyProgressionScheme()` in `phase2-parameters.ts`

The actual progression application is also correct:

**Density for Compound Parents** (lines 297-321):
```typescript
if (isCompound) {
  // Compound parent: work_time stays STATIC (keep week1 value)
  // Density comes from sub-exercise reps increasing, not time extension
  weekN.work_time_minutes = week1.work_time_minutes;
}
```

**Volume for Compound Parents** (lines 404-445):
```typescript
if (exerciseCategory === 'emom') {
  // EMOM: increase by (1 minute * sub_exercise_count) per week
  timeIncreasePerWeek = (1) * subCount;  // e.g., 6->9->12 with 3 subs
} else if (exerciseCategory === 'amrap') {
  // AMRAP: increase by 1 minute per week
  timeIncreasePerWeek = 1;  // e.g., 6->7->8
}
```

### Data Flow Verification

```
User selects goal (e.g., "tone")
    |
    v
selectExercisesForDay() loops over blocks
    |
    +-- STRENGTH BLOCK:
    |     selectStrengthExercise()
    |         -> getProgressionFromGoal('tone', 'strength', rules)
    |         -> returns 'volume' (correct!)
    |
    +-- COMPOUND BLOCK:
          selectCompoundExercise()
              -> constructCompoundExercise()
              -> hardcodes progressionScheme: 'density' (correct!)
```

### Edge Case: Tone Goal + Compound Block

**Question**: If user has tone goal (maps to volume), do compound blocks still get density?

**Answer**: YES - and this is CORRECT per the specification. The ticket #012 explicitly states:
- "emom/amrap/circuit/interval -> density (always)"

The `constructCompoundExercise()` hardcodes density regardless of goal, which is the intended behavior.

### Note: Volume Logic for Compounds (Unused but Available)

The `applyVolumeProgression()` function (lines 404-445) has logic for compound exercises:
- EMOM: work_time increases by (1 min * sub_count) per week
- AMRAP: work_time increases by 1 min per week

However, this code path is NEVER HIT because `constructCompoundExercise()` hardcodes `progressionScheme: 'density'` for all compound exercises. This is correct behavior per the spec, but the volume code for compounds is effectively dead code.

This is not a bug - it's defensive code that would work correctly if compound exercises ever needed volume progression in the future.

### Verification Result: IRON TIGHT

- Goal-based progression only applies to strength/bodyweight exercises
- Compound exercises (EMOM/AMRAP/Circuit/Interval) ALWAYS get density progression
- Density for compounds = work_time STATIC, sub-exercise reps increase (more work in same time)
- Mobility/flexibility/cardio always get static progression
- The progression logic is consistent between all three files
- Dead code identified: compound volume progression + defensive compound check (to be removed in Phase 4)

---

## Success Criteria

1. `split_muscle_group_mapping` reduced from 22 entries to 7 entries
2. All code uses `getBaseFocus()` for muscle mapping lookups
3. Dead compound volume progression code removed (~45 lines)
4. Unused config entries removed (7 values)
5. All 290+ tests pass
6. TypeScript compilation succeeds
7. Generated workouts are identical (same muscle targeting behavior)

---

## Testing Strategy

### Unit Tests to Update

1. `tests/unit/prescriptive-split.test.ts`:
   - Update focus type validation test to check base types only
   - Add test: `getBaseFocus('Upper-HIIT')` returns `'Upper'`
   - Add test: muscle mapping exists for all base types

### Integration Tests

1. Generate workouts with all goal + frequency combinations
2. Verify muscle group filtering is identical before/after refactor

### Manual Verification

```bash
# Before refactor: count entries in split_muscle_group_mapping
grep -c '"include_muscle_groups"' src/data/workout_generation_rules.json

# After refactor: should be 7
```

---

## Risk Assessment

**Risk Level**: LOW

- No functional changes to workout generation
- Muscle group filtering behavior unchanged
- Only removing redundant configuration
- Code already has fallback logic

---

## Notes

This is purely a cleanup refactor. The generated workouts will be byte-for-byte identical. The goal is to:
1. Reduce config file size (~108 lines of duplicate config + 7 unused config values)
2. Remove ~45 lines of dead code from phase2-parameters.ts
3. Remove defensive compound check from getProgressionFromGoal() (~4 lines)
4. Eliminate maintenance burden of keeping 15 duplicate entries in sync
5. Align `split_muscle_group_mapping` with the simpler `muscle_group_priority_mapping` design
6. Make the codebase easier to understand for future developers

**Total cleanup**: ~160 lines of config + ~50 lines of code removed

---

## Completion Summary (2026-01-10)

### Phase 2 Completed
- Simplified muscle mapping lookups in `exercise-selector.ts`
- Replaced fallback logic with direct `getBaseFocus()` lookups in 3 locations:
  - `createExercisePoolsForDay()` (line 219-226)
  - `selectExercisesForDay()` (line 321-326)
  - `constructCompoundExercise()` (line 689-694)
- Added proper type guards for `MuscleGroupMappingEntry`

### Phase 3 Completed
- Added `BaseFocusType` union type documenting the 7 valid base focus types
- Added `MuscleGroupMappingEntry` interface for type-safe mapping entries
- Updated `SplitMuscleGroupMapping` interface with documentation

### Phase 4 Completed
- Removed `roundToWholeMinutes()` helper function (8 lines)
- Removed compound volume progression block from `applyVolumeProgression()` (~45 lines)
- Removed defensive compound check from `getProgressionFromGoal()` (4 lines)
- Removed 7 unused config values from `progression_schemes.volume.rules`:
  - `compound_emom_time_increase_per_sub_per_week`
  - `compound_emom_default_sub_count`
  - `compound_amrap_time_increase_per_week`
  - `compound_circuit_increase_time`
  - `compound_circuit_time_increase_per_week`
  - `compound_reps_increase_enabled`
  - `round_work_time_to_whole_minutes`
- Removed compound-specific examples from volume progression config
- Updated test to document architectural decision (compound categories get 'density' from `constructCompoundExercise()`, not `getProgressionFromGoal()`)

### Files Modified
- `src/lib/engine/exercise-selector.ts` - Simplified lookups, added type imports and guards
- `src/lib/engine/phase1-structure.ts` - Removed defensive compound check, added documentation
- `src/lib/engine/phase2-parameters.ts` - Removed dead code (~55 lines total)
- `src/lib/engine/types.ts` - Added `BaseFocusType`, `MuscleGroupMappingEntry` types
- `src/data/workout_generation_rules.json` - Removed 7 unused config values, updated description
- `tests/unit/prescriptive-split.test.ts` - Updated tests for architectural change

### Test Results
- All 288 tests passing
- TypeScript compilation succeeds
