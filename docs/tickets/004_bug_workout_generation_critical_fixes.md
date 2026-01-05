# Ticket #004: Bug - Critical Workout Generation Algorithm Fixes

**Status**: Open
**Priority**: High
**Type**: bug
**Estimated Points**: 13 (fibonacci scale)
**Phase**: 1-CLI

---

## Summary

Fix 8 critical bugs in the workout generation algorithm that produce unusable workouts: absurdly low rest times (10-15 seconds instead of 2-5 minutes), floating point precision errors, excessive exercise volume (12-14 exercises per day), excessive barbell exercises, wrong muscle group selection for split focus, severely under-utilized Pull days, time unit inconsistency, and incorrect workout structure missing compound exercises.

## Background

After generating a test workout with the CLI prototype (expert muscle gain, 5 days/week, ULPPL split, 45-60 minutes), the output revealed systematic failures in the generation algorithm. The workout_generation_rules.json configuration file has incorrect base values for rest times (fractional minutes like 0.33 instead of proper minutes), and the exercise selection logic lacks constraints for equipment diversity, exercise count per category, and split focus enforcement. These bugs make generated workouts completely unusable and must be fixed before any UI development.

## Technical Requirements

### Data Structures

Reference WORKOUT_SPEC.md and workout_generation_rules.json:
- Rest times should be 2-5 minutes (120-300 seconds) for heavy strength work
- Exercise count should be 6-8 exercises maximum per 45-60 minute session
- Barbell exercises should be limited to 2-3 per day maximum
- Split focus (Push/Pull/Legs/Upper/Lower) must filter exercises by muscle group
- Workout structure should have 2-3 main strength exercises, then compound exercises (EMOM/Circuit/AMRAP)

### Code Locations

Files to investigate:
- /home/wabbazzar/code/shredly2/src/data/workout_generation_rules.json (configuration fixes)
- /home/wabbazzar/code/shredly2/src/lib/engine/workout-generator.ts (generation algorithm)
- /home/wabbazzar/code/shredly2/src/lib/engine/exercise-selector.ts (exercise filtering/selection)
- /home/wabbazzar/code/shredly2/src/lib/engine/phase2-parameters.ts (parameter application)
- /home/wabbazzar/code/shredly2/src/lib/engine/duration-estimator.ts (time calculations)

Files to modify:
- workout_generation_rules.json (lines 10, 17, 24, 31, 38 - rest time base values)
- workout_generation_rules.json (add equipment_quotas section)
- workout_generation_rules.json (add exercise_count_constraints section)
- exercise-selector.ts (strengthen split_muscle_group_mapping enforcement)
- phase2-parameters.ts (fix time unit handling and floating point precision)

### TypeScript Types

```typescript
// Add to workout_generation_rules.json schema
interface EquipmentQuotas {
  barbell_max_per_day: number;  // 2-3
  sequential_filtering: boolean;  // true
  fallback_order: string[];  // ["Barbell", "Dumbbell", "Cable", "Machine", "Bodyweight"]
}

interface ExerciseCountConstraints {
  strength_max_per_day: number;  // 2-3
  total_max_for_45_60_minutes: number;  // 6-8
  require_compound_exercises: boolean;  // true
  compound_categories: string[];  // ["emom", "amrap", "circuit", "interval"]
}

// Time unit types for explicit units approach
type TimeUnit = "seconds" | "minutes";

interface TimeValue {
  value: number;
  unit: TimeUnit;
}

// Updated workout generation rules schema
interface IntensityProfileTimeFields {
  base_rest_time: number;
  base_rest_time_unit: TimeUnit;
  base_work_time: number;
  base_work_time_unit: TimeUnit;
}

// Add to types.ts
interface ExerciseSelectionContext {
  dayFocus: string;  // "Push", "Pull", "Legs", "Upper", "Lower"
  muscleGroupFilter: string[];  // From split_muscle_group_mapping
  equipmentQuotaRemaining: Map<string, number>;  // Track barbell quota
  categoryQuotaRemaining: Map<string, number>;  // Track strength quota
  totalExerciseCount: number;
  estimatedDurationMinutes: number;
}
```

## Implementation Plan

### Phase 1: Fix Rest Time Base Values (2 points)

**Goal**: Correct rest_time_minutes in workout_generation_rules.json to produce 2-5 minute rest times for heavy strength work

**Steps**:
1. Read workout_generation_rules.json lines 10, 17, 24, 31, 38 (intensity_profiles.strength.*.base_rest_time_minutes)
2. Determine if values should be in minutes or seconds (investigate how phase2-parameters.ts uses them)
3. Update base_rest_time_minutes values:
   - light: 1.0 (60 seconds) instead of 0.25
   - moderate: 2.0 (120 seconds) instead of 0.33
   - moderate_heavy: 3.0 (180 seconds) instead of 0.33
   - heavy: 4.0 (240 seconds) instead of 0.33
   - max: 5.0 (300 seconds) instead of 0.5
4. Update progression_schemes.linear.rules.rest_time_delta_per_week_minutes from -0.05 to -0.5 (line 187)
5. Update progression_schemes.linear.rules.rest_time_minimum_minutes from 0.17 to 2.0 (line 188)
6. Update example_3_weeks in progression_schemes.linear to show correct rest times (lines 192-194)

**Files**:
- Modify: /home/wabbazzar/code/shredly2/src/data/workout_generation_rules.json (lines 10, 17, 24, 31, 38, 187-194)

**Testing**:
- [ ] Unit test: Verify intensity_profiles.strength.heavy.base_rest_time_minutes is 4.0
- [ ] Integration test: Generate workout with expert experience, verify rest times are 2-5 minutes
- [ ] CLI validation: Run `npm run cli`, check that Day 1 exercises show rest_time_minutes 2-5 instead of 0.17-0.33

**Commit Message**:
```
fix(engine): correct rest time base values in generation rules

- Update strength intensity profiles to use proper rest times (2-5 minutes)
- Fix progression scheme rest time deltas and minimums
- Resolves absurdly low rest times (10-15 seconds) bug

Testing: CLI generation now produces 2-5 minute rest times for heavy strength work
```

**Agent Invocations**:
```bash
# Use shredly-code-writer for implementation
# Invoke: shredly-code-writer agent with "Implement Phase 1 for ticket #004"

# Use test-writer for test creation
# Invoke: test-writer agent with "Write tests for rest time validation from ticket #004"

# Use code-quality-assessor after implementation
# Invoke: code-quality-assessor agent with "Review workout_generation_rules.json from ticket #004 Phase 1"
```

### Phase 2: Fix Floating Point Precision (2 points)

**Goal**: Eliminate floating point errors like 0.21400000000000002 by implementing hybrid time unit approach with explicit units field

**Chosen Strategy**: Hybrid with explicit units field (see Design Decision: Time Units)

**Steps**:
1. Update workout_generation_rules.json to add `_unit` suffix fields:
   - Change `base_rest_time_minutes` → `base_rest_time` + `base_rest_time_unit: "seconds"` or `"minutes"`
   - Change `base_work_time_minutes` → `base_work_time` + `base_work_time_unit: "seconds"` or `"minutes"`
   - Convert sub-minute durations to seconds (e.g., 0.264 min → 15 sec)
   - Keep multi-minute durations as minutes (e.g., 3.0 min → 3 min)
2. Update WORKOUT_SPEC.md to document new time field schema:
   - Add `rest_time_unit` and `work_time_unit` fields to ExerciseBlock interface
   - Document that units are explicit, not implied
   - Add validation rules for time_unit values
3. Update phase2-parameters.ts to output time with explicit units:
   - Add `rest_time_unit` field alongside `rest_time` (or `rest_time_minutes`)
   - Add `work_time_unit` field alongside `work_time` (or `work_time_minutes`)
   - Use integer values for seconds, avoid decimal places
4. Add TypeScript types for time units to types.ts:
   ```typescript
   type TimeUnit = "seconds" | "minutes";
   interface TimeValue {
     value: number;
     unit: TimeUnit;
   }
   ```
5. Ensure consistency across all time-related fields in generated workouts

**Files**:
- Modify: /home/wabbazzar/code/shredly2/src/lib/engine/phase2-parameters.ts (time assignment logic)
- Modify: /home/wabbazzar/code/shredly2/src/lib/engine/duration-estimator.ts (if time calculations affected)
- Update: /home/wabbazzar/code/shredly2/docs/WORKOUT_SPEC.md (document time unit strategy)

**Testing**:
- [ ] Unit test: Verify no floating point precision errors in generated workout JSON
- [ ] Unit test: Test time conversions (if using seconds/milliseconds)
- [ ] Integration test: Generate workout, assert all rest_time and work_time values have max 2 decimal places
- [ ] CLI validation: Inspect test.json output for floating point errors

**Commit Message**:
```
fix(engine): implement explicit time units to eliminate floating point errors

- Add time_unit field alongside time values (rest_time_unit, work_time_unit)
- Convert sub-minute durations to seconds (e.g., 15 sec instead of 0.264 min)
- Keep multi-minute durations as minutes with explicit unit
- Update WORKOUT_SPEC.md with new time field schema

Testing: Generated workouts show "rest_time: 180, rest_time_unit: seconds" instead of "rest_time_minutes: 0.21400000000000002"
```

**Agent Invocations**:
```bash
# Use shredly-code-writer for implementation
# Invoke: shredly-code-writer agent with "Implement Phase 2 for ticket #004"

# Use test-writer for test creation
# Invoke: test-writer agent with "Write floating point precision tests from ticket #004"

# Use code-quality-assessor after implementation
# Invoke: code-quality-assessor agent with "Review time handling logic from ticket #004 Phase 2"
```

### Phase 3: Add Exercise Count Constraints (3 points)

**Goal**: Limit exercises to 6-8 per 45-60 minute session, enforce category quotas

**Steps**:
1. Add exercise_count_constraints section to workout_generation_rules.json:
   ```json
   "exercise_count_constraints": {
     "strength_max_per_day": 3,
     "total_max_by_duration": {
       "20-30": 5,
       "30-45": 7,
       "45-60": 8,
       "60-90": 10,
       "90+": 12
     },
     "require_compound_exercises": true,
     "compound_categories": ["emom", "amrap", "circuit", "interval"],
     "compound_min_count": 1
   }
   ```
2. Update exercise-selector.ts to check total exercise count before adding
3. Add category quota tracking in ExerciseSelectionContext
4. Enforce strength category max (2-3 exercises)
5. Require at least 1 compound exercise if duration allows
6. Stop round-robin selection when hitting exercise count limit

**Files**:
- Modify: /home/wabbazzar/code/shredly2/src/data/workout_generation_rules.json (add exercise_count_constraints)
- Modify: /home/wabbazzar/code/shredly2/src/lib/engine/exercise-selector.ts (enforce constraints)
- Modify: /home/wabbazzar/code/shredly2/src/lib/engine/types.ts (add ExerciseSelectionContext)

**Testing**:
- [ ] Unit test: Verify exercise count constraints are loaded from config
- [ ] Integration test: Generate 45-60 minute workout, assert 6-8 exercises total
- [ ] Integration test: Generate workout, assert max 3 strength exercises
- [ ] Integration test: Generate workout, assert at least 1 compound exercise
- [ ] CLI validation: Run `npm run cli`, verify Day 1 has 6-8 exercises (not 12)

**Commit Message**:
```
fix(engine): enforce exercise count constraints per session

- Add exercise_count_constraints to generation rules
- Limit strength exercises to 2-3 per day
- Enforce total exercise count based on session duration
- Require at least 1 compound exercise

Testing: 45-60 minute sessions now generate 6-8 exercises total
```

**Agent Invocations**:
```bash
# Use shredly-code-writer for implementation
# Invoke: shredly-code-writer agent with "Implement Phase 3 for ticket #004"

# Use test-writer for test creation
# Invoke: test-writer agent with "Write exercise count constraint tests from ticket #004"

# Use code-quality-assessor after implementation
# Invoke: code-quality-assessor agent with "Review exercise selection logic from ticket #004 Phase 3"
```

### Phase 4: Add Barbell Exercise Quota (3 points)

**Goal**: Limit barbell exercises to 2-3 per day, implement sequential equipment filtering

**Steps**:
1. Add equipment_quotas section to workout_generation_rules.json:
   ```json
   "equipment_quotas": {
     "barbell_max_per_day": 3,
     "sequential_filtering_enabled": true,
     "fallback_order": ["Barbell", "Dumbbell", "Cable", "Machine", "Bodyweight"],
     "description": "After barbell quota met, filter to next equipment type"
   }
   ```
2. Update exercise-selector.ts to track barbell exercise count
3. Implement sequential equipment filtering:
   - Start with all equipment available
   - After 3 barbell exercises added, exclude "Barbell" from filter
   - Continue with Dumbbell/Cable/Machine/Bodyweight
4. Add equipment quota tracking to ExerciseSelectionContext
5. Update round-robin selection to check equipment quota before adding

**Files**:
- Modify: /home/wabbazzar/code/shredly2/src/data/workout_generation_rules.json (add equipment_quotas)
- Modify: /home/wabbazzar/code/shredly2/src/lib/engine/exercise-selector.ts (implement quota logic)
- Modify: /home/wabbazzar/code/shredly2/src/lib/engine/types.ts (add equipmentQuotaRemaining to context)

**Testing**:
- [ ] Unit test: Verify equipment quotas are loaded from config
- [ ] Integration test: Generate workout, assert max 3 barbell exercises per day
- [ ] Integration test: Verify sequential filtering after barbell quota met
- [ ] Integration test: Assert non-barbell exercises (dumbbells, cables) are used
- [ ] CLI validation: Run `npm run cli`, verify Day 1 has 2-3 barbell exercises, rest are dumbbells/cables

**Commit Message**:
```
fix(engine): limit barbell exercises and implement equipment fallback

- Add equipment_quotas configuration
- Limit barbell exercises to 2-3 per day
- Implement sequential equipment filtering
- Prioritize equipment diversity in workouts

Testing: Days now contain mix of barbell, dumbbell, cable exercises
```

**Agent Invocations**:
```bash
# Use shredly-code-writer for implementation
# Invoke: shredly-code-writer agent with "Implement Phase 4 for ticket #004"

# Use test-writer for test creation
# Invoke: test-writer agent with "Write barbell quota tests from ticket #004"

# Use code-quality-assessor after implementation
# Invoke: code-quality-assessor agent with "Review equipment filtering logic from ticket #004 Phase 4"
```

### Phase 5: Fix Split Focus Muscle Group Filtering (3 points)

**Goal**: Enforce split_muscle_group_mapping so Push days don't include squats, Pull days don't include bench press

**Steps**:
1. Investigate how exercise-selector.ts uses split_muscle_group_mapping
2. Read exercise-database.json to understand muscle_groups field structure
3. Implement strict muscle group filtering:
   - Get day focus (Push, Pull, Legs, Upper, Lower)
   - Look up split_muscle_group_mapping[dayFocus].include_muscle_groups
   - Look up split_muscle_group_mapping[dayFocus].exclude_muscle_groups
   - Filter exercises: must have at least one included muscle group
   - Filter exercises: must not have any excluded muscle groups
4. Add validation to ensure no leg exercises in Push/Pull days
5. Add validation to ensure no chest/shoulder exercises in Lower/Legs days
6. Update round-robin selection to respect muscle group filters

**Files**:
- Modify: /home/wabbazzar/code/shredly2/src/lib/engine/exercise-selector.ts (strengthen filtering)
- Read: /home/wabbazzar/code/shredly2/src/data/exercise-database.json (understand exercise structure)

**Testing**:
- [ ] Unit test: Verify muscle group filtering logic
- [ ] Integration test: Generate Push day, assert no squat/deadlift exercises
- [ ] Integration test: Generate Pull day, assert no bench/shoulder press exercises
- [ ] Integration test: Generate Legs day, assert no chest/back exercises
- [ ] Integration test: Generate Upper day, assert no squat/deadlift exercises
- [ ] CLI validation: Run `npm run cli`, verify Day 3 (Push) has no squats

**Commit Message**:
```
fix(engine): enforce split focus muscle group filtering

- Strengthen exercise filtering by muscle groups
- Prevent leg exercises in Push/Pull days
- Prevent upper body exercises in Leg days
- Respect split_muscle_group_mapping configuration

Testing: Push days no longer include squats, Pull days respect muscle group boundaries
```

**Agent Invocations**:
```bash
# Use shredly-code-writer for implementation
# Invoke: shredly-code-writer agent with "Implement Phase 5 for ticket #004"

# Use test-writer for test creation
# Invoke: test-writer agent with "Write muscle group filtering tests from ticket #004"

# Use code-quality-assessor after implementation
# Invoke: code-quality-assessor agent with "Review split focus filtering from ticket #004 Phase 5"
```

---

## Testing Strategy

### Unit Tests

- [ ] Test rest time base values are loaded correctly from config
- [ ] Test floating point rounding function produces clean values
- [ ] Test exercise count constraints are enforced
- [ ] Test barbell quota tracking and enforcement
- [ ] Test muscle group filtering logic
- [ ] Test equipment sequential filtering
- [ ] Test ExerciseSelectionContext state management

### Integration Tests

- [ ] Generate expert muscle gain ULPPL workout, verify:
  - Rest times: 2-5 minutes for strength exercises
  - Exercise count: 6-8 per day for 45-60 minute sessions
  - Barbell exercises: 2-3 maximum per day
  - Split focus: Push day has no squats, Pull day has 6-8 exercises
  - Workout structure: 2-3 strength + compound exercises
- [ ] Generate beginner full body workout, verify rest times adjusted for experience
- [ ] Generate 30-45 minute workout, verify lower exercise count
- [ ] Generate 60-90 minute workout, verify higher exercise count allowed

### Manual Testing

**CLI (Phase 1)**:
```bash
npm run cli
# Input: Expert, Muscle Gain, 5 days/week, ULPPL, 45-60 minutes, Commercial Gym, Density Progression
# Expected output:
#   - Day 1 (Upper): 6-8 exercises, rest times 2-5 minutes, max 3 barbell exercises
#   - Day 2 (Lower): 6-8 exercises, no chest/shoulder exercises
#   - Day 3 (Push): 6-8 exercises, no leg exercises, mix of bench/press/dips
#   - Day 4 (Pull): 6-8 exercises (not 2!), no leg exercises, mix of rows/pull-ups
#   - Day 5 (Legs): 6-8 exercises, no chest/back exercises
#   - All days: Clean numeric values (no 0.21400000000000002)
```

### Test Acceptance Criteria

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] TypeScript compilation succeeds (`npm run typecheck`)
- [ ] Build succeeds (`npm run build`)
- [ ] Manual CLI test produces valid workout matching all criteria above
- [ ] test.json regenerated with same questionnaire shows all bugs fixed

---

## Success Criteria

- [ ] Rest times for heavy strength work are 2-5 minutes (120-300 seconds)
- [ ] No floating point precision errors in generated JSON
- [ ] 45-60 minute sessions generate 6-8 exercises maximum
- [ ] Barbell exercises limited to 2-3 per day maximum
- [ ] Push days contain no leg exercises (squats, deadlifts)
- [ ] Pull days contain 6-8 exercises (not severely under-utilized)
- [ ] Workout structure includes 2-3 strength exercises + compound exercises
- [ ] All numeric values are clean (no 0.21400000000000002)
- [ ] Code follows CLAUDE.md standards
- [ ] Data structures comply with WORKOUT_SPEC.md
- [ ] workout_generation_rules.json is properly documented

---

## Dependencies

### Blocked By
- None

### Blocks
- Any UI development (can't build UI on broken generation engine)
- Future ticket: Advanced progression schemes
- Future ticket: Exercise substitution based on injury history

### External Dependencies
- None (all fixes are internal to generation engine)

---

## Risks & Mitigations

### Risk 1: Time Unit Change Breaks Duration Estimator
- **Impact**: High
- **Probability**: Medium
- **Mitigation**:
  - Thoroughly read duration-estimator.ts before changing time units
  - Add comprehensive tests for time conversions
  - Use feature flag to toggle between old/new time handling
  - Commit Phase 2 separately with rollback plan

### Risk 2: Equipment Filtering Too Strict, Not Enough Exercises Found
- **Impact**: Medium
- **Probability**: Low
- **Mitigation**:
  - Implement fallback logic: if quota prevents selection, relax equipment filter
  - Log warning when equipment quota causes selection failure
  - Add test case for edge case: only 2 barbell exercises available

### Risk 3: Muscle Group Filtering Breaks Mobility/Cardio Days
- **Impact**: Medium
- **Probability**: Medium
- **Mitigation**:
  - Exclude mobility/flexibility/cardio exercises from muscle group filtering
  - Check exercise category before applying split focus filter
  - Mobility days should use "all" muscle groups (already in config)

### Risk 4: Fixing Bugs Reveals New Issues in Progression Logic
- **Impact**: High
- **Probability**: High
- **Mitigation**:
  - Focus on fixing identified bugs first, don't scope creep
  - Document any new issues discovered as separate tickets
  - Add comprehensive logging to help debug future issues

---

## Notes

### Design Decision: Time Units ✅ DECIDED

**CHOSEN STRATEGY: Hybrid with explicit units field (Option C)**

Approach:
- Add `time_unit: "seconds" | "minutes"` field to all time-related fields
- Store sub-minute durations as seconds with `time_unit: "seconds"`
- Store multi-minute durations as minutes with `time_unit: "minutes"`
- Most flexible approach - avoids floating point errors and unclear units

Example in WORKOUT_SPEC.md:
```typescript
interface ExerciseBlock {
  rest_time: number;           // 180
  rest_time_unit: "seconds";   // explicit unit
  work_time: number;           // 10
  work_time_unit: "minutes";   // explicit unit
}
```

Benefits:
- No floating point errors (0.264 min → 15 sec, 0.333 min → 20 sec)
- Clear units at glance (no ambiguity between 3 minutes vs 3 seconds)
- Easy to extend (can add "milliseconds" or "hours" later if needed)
- TypeScript type safety for units

Implementation notes:
- Update workout_generation_rules.json to include `_unit` suffix for all time fields
- Update WORKOUT_SPEC.md to reflect new time field schema
- Add validation that time_unit matches expected values

### Design Decision: Equipment Quota Enforcement

Sequential filtering approach:
1. Start with all equipment available
2. Track barbell exercise count
3. After quota met (3 barbell exercises), add "Barbell" to exclude filter
4. Continue selecting from remaining equipment types
5. If no exercises found, relax equipment filter (fallback to bodyweight)

### Known Limitations After Fixes

- Day 4 (Pull) under-utilization is likely a separate bug in round-robin selection algorithm
- Will need separate investigation into why Pull days get fewer exercises
- May be related to exercise database having fewer Pull exercises
- Consider creating follow-up ticket after Phase 5 completes

---

## Commit Standards Reminder

**MANDATORY**: Follow CLAUDE.md commit message standards:
- Format: `type(scope): description under 50 chars`
- Types: fix (for all phases in this ticket)
- Scopes: engine, workout-gen, exercise-selector
- **NEVER include "🤖 Generated with [Claude Code]" or "Co-Authored-By: Claude"**

---

## Definition of Done

- [ ] All phases implemented and tested
- [ ] All tests passing
- [ ] TypeScript compilation succeeds
- [ ] Code reviewed (by code-quality-assessor agent)
- [ ] Success criteria met
- [ ] test.json regenerated and manually inspected for all fixes
- [ ] Committed with proper commit messages (one per phase)
- [ ] CLAUDE.md "Current Development Status" updated
- [ ] Follow-up tickets created for any new issues discovered
