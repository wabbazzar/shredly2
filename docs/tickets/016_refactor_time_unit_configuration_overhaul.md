# Ticket #016: Refactor - Time Unit Configuration Overhaul

**Status**: Open
**Priority**: High
**Type**: refactor
**Estimated Points**: 13 (fibonacci scale)
**Phase**: 1-CLI

---

## Summary

Complete overhaul of the time unit system in workout_generation_rules.json and the engine. Replace confusing `_minutes` + `_unit` field pairs with self-documenting field names where the unit is part of the field name (e.g., `work_time_seconds` or `rest_time_minutes`). The engine will infer the unit from the field name suffix.

## Background

The current time configuration system has several issues:

1. **Confusing field naming**: Fields like `base_work_time_minutes: 0.5` with `base_work_time_unit: "seconds"` are misleading - the field name says "minutes" but the value is interpreted as seconds
2. **Ugly decimal values**: Rest times display as 0.98, 0.96 minutes instead of clean values like "58 seconds" or "2 minutes"
3. **Inconsistent units**: Some categories use minutes, others use seconds, but the field names don't reflect this
4. **Bug**: Interval sub-exercises currently show REPS instead of work_time/rest_time - this is wrong behavior that needs fixing
5. **Missing `sub_work_mode` concept**: No way to specify whether sub-exercises should use reps or time parameters

This ticket will:
- Create self-documenting field names with unit suffixes (`_seconds` or `_minutes`)
- Add `sub_work_mode` field to compound block configs to specify whether sub-exercises use reps or time
- Fix interval sub-exercises to properly display work_time/rest_time (not reps)
- Implement proper rounding (seconds to nearest 5, minutes to nearest 0.5)
- Remove separate `_unit` fields entirely

**Scope**:
- IN SCOPE: Interval, EMOM, AMRAP, Strength, Bodyweight categories
- OUT OF SCOPE: Circuit, Mobility, Flexibility (will be addressed in future ticket)

---

## Technical Requirements

### Data Structures

**Current (problematic) structure**:
```json
{
  "interval": {
    "light": {
      "base_sets": 3,
      "base_work_time_minutes": 0.5,
      "base_work_time_unit": "seconds",
      "base_rest_time_minutes": 0.5,
      "base_rest_time_unit": "seconds"
    }
  }
}
```

**New (self-documenting) structure**:
```json
{
  "interval": {
    "light": {
      "sets": 3,
      "sub_work_mode": "time",
      "sub_work_time_seconds": 30,
      "sub_rest_time_seconds": 30
    }
  }
}
```

### Code Locations

**Files to create**: None

**Files to modify**:
- `src/data/workout_generation_rules.json` - Config restructure (major changes)
- `src/lib/engine/types.ts` - Update IntensityProfiles types, add TimeFieldConfig
- `src/lib/engine/phase2-parameters.ts` - Parse time fields, handle sub_work_mode, update rounding
- `cli/lib/workout-formatter.ts` - Display time in native units (no conversion needed)
- `tests/unit/phase2-parameters.test.ts` - Update existing tests, add new tests

**Dependencies**: None (internal refactor)

### TypeScript Types

```typescript
// New types to add to src/lib/engine/types.ts

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

// Updated IntensityProfile type (partial - showing new fields)
export interface IntensityProfileEntry {
  // Existing fields (to be deprecated in Phase 2)
  base_sets?: number;
  base_reps?: number | string;
  base_rest_time_minutes?: number;      // DEPRECATED - use rest_time_* fields
  base_rest_time_unit?: TimeUnit;       // DEPRECATED - use rest_time_* fields
  base_work_time_minutes?: number;      // DEPRECATED - use work_time_* fields
  base_work_time_unit?: TimeUnit;       // DEPRECATED - use work_time_* fields

  // New self-documenting fields (Phase 1 of this ticket)
  sets?: number;
  reps?: number | string;
  rest_time_seconds?: number;           // NEW: for bodyweight, interval sub-exercises
  rest_time_minutes?: number;           // NEW: for strength exercises
  work_time_seconds?: number;           // NEW: for interval sub-exercises
  work_time_minutes?: number;           // NEW: for EMOM/AMRAP block time
  block_time_minutes?: number;          // NEW: for EMOM/AMRAP total block duration

  // Compound block configuration
  sub_work_mode?: SubWorkMode;          // NEW: "reps" | "time"

  // Other existing fields...
  base_weight_percent_tm?: number;
  base_weight_descriptor?: string;
  base_target_reps_per_minute?: number;
  base_target_rounds?: number;
  intensity_description?: string;
}
```

### New Config Structure (Target State)

**Interval** (uses sets/rounds, NOT block time):

**Design principle:** Work + Rest always equals 60 seconds (1 minute intervals).
Progression: +5 sec work, -5 sec rest per week (maintains 60 sec total).

| Intensity | Week 1 | Week 2 | Week 3 | Sum |
|-----------|--------|--------|--------|-----|
| Light | 30/30 | 35/25 | 40/20 | 60s |
| Moderate | 40/20 | 45/15 | 50/10 | 60s |
| Heavy | 45/15 | 50/10 | 55/5 | 60s |

```json
"interval": {
  "light": {
    "sets": 3,
    "sub_work_mode": "time",
    "sub_work_time_seconds": 30,
    "sub_rest_time_seconds": 30
  },
  "moderate": {
    "sets": 4,
    "sub_work_mode": "time",
    "sub_work_time_seconds": 40,
    "sub_rest_time_seconds": 20
  },
  "heavy": {
    "sets": 6,
    "sub_work_mode": "time",
    "sub_work_time_seconds": 45,
    "sub_rest_time_seconds": 15
  },
  "tabata": {
    "sets": 8,
    "sub_work_mode": "time",
    "sub_work_time_seconds": 20,
    "sub_rest_time_seconds": 10
  }
}
```

**EMOM** (uses block time in minutes):
```json
"emom": {
  "light": {
    "block_time_minutes": 8,
    "sub_work_mode": "reps",
    "target_reps_per_minute": 8
  },
  "moderate": {
    "block_time_minutes": 10,
    "sub_work_mode": "reps",
    "target_reps_per_minute": 10
  },
  "heavy": {
    "block_time_minutes": 12,
    "sub_work_mode": "reps",
    "target_reps_per_minute": 12
  }
}
```

**AMRAP** (uses block time in minutes):
```json
"amrap": {
  "light": {
    "block_time_minutes": 6,
    "sub_work_mode": "reps",
    "target_rounds": 2
  },
  "moderate": {
    "block_time_minutes": 8,
    "sub_work_mode": "reps",
    "target_rounds": 3
  },
  "heavy": {
    "block_time_minutes": 10,
    "sub_work_mode": "reps",
    "target_rounds": 4
  }
}
```

**Strength** (uses rest_time in minutes):
```json
"strength": {
  "light": {
    "sets": 3,
    "reps": 12,
    "rest_time_minutes": 1.0,
    "weight_percent_tm": 60,
    "weight_descriptor": "light"
  },
  "moderate": {
    "sets": 3,
    "reps": 8,
    "rest_time_minutes": 1.0,
    "weight_percent_tm": 70,
    "weight_descriptor": "moderate"
  },
  "heavy": {
    "sets": 4,
    "reps": 5,
    "rest_time_minutes": 2.0,
    "weight_percent_tm": 80,
    "weight_descriptor": "heavy"
  },
  "max": {
    "sets": 5,
    "reps": 3,
    "rest_time_minutes": 3.0,
    "weight_percent_tm": 85,
    "weight_descriptor": "max"
  }
}
```

**Bodyweight** (uses rest_time in seconds):
```json
"bodyweight": {
  "light": {
    "sets": 3,
    "reps": 10,
    "rest_time_seconds": 30
  },
  "moderate": {
    "sets": 3,
    "reps": 15,
    "rest_time_seconds": 45
  },
  "heavy": {
    "sets": 4,
    "reps": 20,
    "rest_time_seconds": 60
  },
  "amrap": {
    "sets": 3,
    "reps": "AMRAP",
    "rest_time_seconds": 60
  }
}
```

### Progression Deltas (Unit-Aware)

```json
"progression_schemes": {
  "linear": {
    "rules": {
      "reps_delta_per_week": -1,
      "reps_minimum": 3,
      "weight_percent_delta_per_week": 5,
      "rest_time_delta_per_week_minutes": -0.25,
      "rest_time_minimum_minutes": 1.5
    }
  },
  "density": {
    "rules": {
      "work_time_increase_percent_total": 25,
      "reps_increase_percent_total": 30,
      "rest_time_delta_per_week_seconds": -5,
      "rest_time_minimum_seconds": 5,
      "interval_work_time_delta_per_week_seconds": 5,
      "interval_rest_time_delta_per_week_seconds": -5
    },
    "interval_behavior": "For interval blocks, work_time increases by +5 sec/week and rest_time decreases by -5 sec/week, maintaining a constant 60-second total (work + rest = 60s)."
  }
}
```

---

## Implementation Plan

### Phase 1: Config Restructure - Interval & Strength (5 points)

**Goal**: Update config structure for Interval, Strength, and Bodyweight categories with new field naming convention.

**Steps**:
1. Update `workout_generation_rules.json`:
   - Rename `base_work_time_minutes` + `base_work_time_unit` pairs to either `work_time_seconds` or `work_time_minutes` (based on actual unit)
   - Rename `base_rest_time_minutes` + `base_rest_time_unit` pairs similarly
   - Remove `base_` prefix from all fields (cleaner naming)
   - Add `sub_work_mode` field to interval/emom/amrap configs
   - Update strength category: `rest_time_minutes: 1.0` (was `base_rest_time_minutes: 1.0, base_rest_time_unit: "minutes"`)
   - Update bodyweight category: `rest_time_seconds: 30` (was `base_rest_time_minutes: 0.5, base_rest_time_unit: "seconds"`)
   - Update interval category: `sub_work_time_seconds: 30, sub_rest_time_seconds: 30`

2. Update `src/lib/engine/types.ts`:
   - Add `SubWorkMode` type
   - Add `ParsedTimeValue` interface
   - Update `IntensityProfiles` interface with new field patterns
   - Keep deprecated fields for backward compatibility during transition

**Files**:
- Modify: `src/data/workout_generation_rules.json` (lines 5-228)
- Modify: `src/lib/engine/types.ts` (lines 433-452)

**Testing**:
- [ ] TypeScript compilation succeeds
- [ ] Config file is valid JSON
- [ ] Manual verification: config structure matches spec

**Commit Message**:
```
refactor(engine): restructure time fields in config

- Replace _minutes + _unit pairs with self-documenting field names
- Add sub_work_mode field for compound block configs
- Update strength, bodyweight, interval categories
- Keep deprecated fields for backward compatibility
```

**Agent Invocations**:
```bash
# Use shredly-code-writer for implementation
# Invoke: shredly-code-writer agent with "Implement Phase 1 for ticket #016 - config restructure"

# Use code-quality-assessor after implementation
# Invoke: code-quality-assessor agent with "Review config changes from ticket #016 Phase 1"
```

---

### Phase 2: Engine Time Field Parsing (5 points)

**Goal**: Update phase2-parameters.ts to parse new field names and infer units from suffixes.

**Steps**:
1. Create helper function `parseTimeField(profile: object, fieldPrefix: string): ParsedTimeValue | null`:
   - Look for `${fieldPrefix}_seconds` first, then `${fieldPrefix}_minutes`
   - Return `{ value, unit, displayValue }`
   - Example: `parseTimeField(profile, "rest_time")` finds `rest_time_seconds: 30` and returns `{ value: 30, unit: "seconds", displayValue: "30 seconds" }`

2. Create helper function `roundTimeValue(value: number, unit: TimeUnit): number`:
   - For seconds: round to nearest 5 seconds
   - For minutes: round to nearest 0.5 minutes (existing behavior)

3. Update `applyIntensityProfile()`:
   - Replace direct field access with `parseTimeField()` calls
   - Use new field names (`rest_time_seconds`, `work_time_minutes`, etc.)
   - Fall back to deprecated `base_*` fields for backward compatibility
   - Store unit in output: `rest_time_unit` or `work_time_unit`

4. Update `applyProgressionScheme()`:
   - Handle unit-aware progression deltas (`rest_time_delta_per_week_seconds` vs `rest_time_delta_per_week_minutes`)
   - Apply appropriate rounding based on unit

5. Handle `sub_work_mode` for compound blocks:
   - Read `sub_work_mode` from parent intensity profile
   - If `sub_work_mode === "time"`: pass time params to sub-exercises
   - If `sub_work_mode === "reps"`: pass reps params to sub-exercises (existing behavior)

**Files**:
- Modify: `src/lib/engine/phase2-parameters.ts` (lines 24-159, 277-337)

**Testing**:
- [ ] Unit tests for `parseTimeField()` helper
- [ ] Unit tests for `roundTimeValue()` helper
- [ ] Existing tests still pass (backward compatibility)
- [ ] TypeScript compilation succeeds

**Commit Message**:
```
refactor(engine): add time field parsing with unit inference

- Add parseTimeField() helper to infer unit from field suffix
- Add roundTimeValue() helper with unit-aware rounding
- Update applyIntensityProfile() to use new config fields
- Add sub_work_mode handling for compound block configs
- Maintain backward compatibility with deprecated base_* fields
```

**Agent Invocations**:
```bash
# Use shredly-code-writer for implementation
# Invoke: shredly-code-writer agent with "Implement Phase 2 for ticket #016 - engine time parsing"

# Use test-writer for test creation
# Invoke: test-writer agent with "Write tests for parseTimeField and roundTimeValue from ticket #016"

# Use test-critic for review
# Invoke: test-critic agent with "Review tests for time field parsing from ticket #016"
```

---

### Phase 3: EMOM/AMRAP Config Update (3 points)

**Goal**: Update EMOM and AMRAP categories to use `block_time_minutes` and `sub_work_mode: "reps"`.

**Steps**:
1. Update `workout_generation_rules.json`:
   - EMOM: Replace `base_work_time_minutes` with `block_time_minutes`
   - EMOM: Add `sub_work_mode: "reps"`
   - EMOM: Rename `base_target_reps_per_minute` to `target_reps_per_minute`
   - AMRAP: Replace `base_work_time_minutes` with `block_time_minutes`
   - AMRAP: Add `sub_work_mode: "reps"`
   - AMRAP: Rename `base_target_rounds` to `target_rounds`

2. Update `applyIntensityProfile()` in phase2-parameters.ts:
   - Handle `block_time_minutes` for compound parents
   - Map to output field `work_time_minutes` with unit "minutes"

3. Verify compound parent behavior:
   - EMOM parent: shows `block_time_minutes` as work_time
   - EMOM sub-exercises: show reps (from their category)
   - AMRAP parent: shows `block_time_minutes` as work_time
   - AMRAP sub-exercises: show reps (from their category)

**Files**:
- Modify: `src/data/workout_generation_rules.json` (lines 107-141)
- Modify: `src/lib/engine/phase2-parameters.ts`

**Testing**:
- [ ] EMOM workouts generate with block_time in minutes
- [ ] EMOM sub-exercises show reps (not time)
- [ ] AMRAP workouts generate with block_time in minutes
- [ ] AMRAP sub-exercises show reps (not time)
- [ ] CLI formatter displays correctly

**Commit Message**:
```
refactor(engine): update EMOM/AMRAP config to use block_time

- Add block_time_minutes field for compound block duration
- Add sub_work_mode: "reps" for EMOM/AMRAP configs
- Rename base_target_* fields to target_*
- Verify sub-exercises correctly inherit reps behavior
```

**Agent Invocations**:
```bash
# Use shredly-code-writer for implementation
# Invoke: shredly-code-writer agent with "Implement Phase 3 for ticket #016 - EMOM/AMRAP config"

# Use test-writer for test creation
# Invoke: test-writer agent with "Write tests for EMOM/AMRAP block_time from ticket #016"
```

---

### Phase 4: Interval Sub-Exercise Fix (5 points)

**Goal**: Fix interval sub-exercises to display work_time/rest_time instead of reps.

**Steps**:
1. Update `parameterizeExercise()` in phase2-parameters.ts:
   - Check parent's `sub_work_mode` from intensity profile
   - If `sub_work_mode === "time"`:
     - Read `sub_work_time_seconds` and `sub_rest_time_seconds` from parent config
     - Pass these to sub-exercise parameterization instead of using category reps
     - Sub-exercises output `work_time_minutes` (converted from seconds) + `work_time_unit: "seconds"`
     - Sub-exercises output `rest_time_minutes` (converted from seconds) + `rest_time_unit: "seconds"`

2. Update formatter display:
   - Ensure sub-exercises with time params show "30 seconds work, 30 seconds rest"
   - NOT "10 reps" (current buggy behavior)

3. Handle progression for time-based sub-exercises (INTERVAL-SPECIFIC):
   - Work_time INCREASES by +5 seconds per week (unlike other compound types)
   - Rest_time DECREASES by -5 seconds per week
   - Total always equals 60 seconds (work + rest = 60s)
   - Example: Light 30/30 -> 35/25 -> 40/20

4. Test with interval workout generation:
   - Generate interval workout
   - Verify sub-exercises show work_time/rest_time
   - Verify progression shows decreasing rest time

**Files**:
- Modify: `src/lib/engine/phase2-parameters.ts` (lines 434-549)
- Modify: `cli/lib/workout-formatter.ts` (verify display)

**Testing**:
- [ ] Interval sub-exercises show work_time/rest_time
- [ ] Interval sub-exercises do NOT show reps
- [ ] Progression correctly decreases rest_time
- [ ] CLI formatter displays "30 seconds work | 30 seconds rest"
- [ ] EMOM sub-exercises still show reps (not affected)

**Commit Message**:
```
fix(engine): interval sub-exercises show work_time/rest_time

- Implement sub_work_mode: "time" handling for interval blocks
- Sub-exercises get work_time/rest_time from parent config
- Interval progression: +5s work, -5s rest (maintains 60s total)
- EMOM/AMRAP sub-exercises unaffected (still use reps)
```

**Agent Invocations**:
```bash
# Use shredly-code-writer for implementation
# Invoke: shredly-code-writer agent with "Implement Phase 4 for ticket #016 - interval sub-exercise fix"

# Use test-writer for test creation
# Invoke: test-writer agent with "Write tests for interval sub_work_mode from ticket #016"

# Use test-critic for review
# Invoke: test-critic agent with "Review interval tests from ticket #016 Phase 4"
```

---

### Phase 5: Cleanup and Documentation (2 points)

**Goal**: Remove deprecated fields, add migration notes, update documentation.

**Steps**:
1. Remove deprecated `base_*` fields from config (after confirming all tests pass):
   - Remove `base_work_time_minutes` (replaced by `work_time_*` or `block_time_*`)
   - Remove `base_work_time_unit` (unit inferred from field name)
   - Remove `base_rest_time_minutes` (replaced by `rest_time_*`)
   - Remove `base_rest_time_unit` (unit inferred from field name)
   - Remove `base_sets`, `base_reps` (replaced by `sets`, `reps`)

2. Update TypeScript types:
   - Mark deprecated fields as truly deprecated (add `@deprecated` JSDoc)
   - OR remove deprecated fields entirely if backward compatibility no longer needed

3. Update WORKOUT_SPEC.md:
   - Document new field naming convention
   - Add examples of time field usage
   - Document `sub_work_mode` field

4. Add migration notes to CLAUDE.md Current Development Status:
   - Document the time unit overhaul
   - Note that Circuit, Mobility, Flexibility are still using old format (future ticket)

**Files**:
- Modify: `src/data/workout_generation_rules.json` (remove deprecated fields)
- Modify: `src/lib/engine/types.ts` (cleanup types)
- Modify: `docs/WORKOUT_SPEC.md` (lines 149-163)
- Modify: `CLAUDE.md` (Current Development Status section)

**Testing**:
- [ ] All existing tests pass
- [ ] TypeScript compilation succeeds
- [ ] `npm run lint` passes
- [ ] CLI workout generation works correctly

**Commit Message**:
```
refactor(engine): cleanup deprecated time config fields

- Remove base_*_minutes and base_*_unit fields
- Update TypeScript types to remove deprecated interfaces
- Update WORKOUT_SPEC.md with new time field documentation
- Update CLAUDE.md with migration notes
```

**Agent Invocations**:
```bash
# Use code-quality-assessor for final review
# Invoke: code-quality-assessor agent with "Review final cleanup from ticket #016 Phase 5"

# Use test-writer for any missing test coverage
# Invoke: test-writer agent with "Review test coverage for ticket #016 final phase"
```

---

## Testing Strategy

### Unit Tests (Vitest)

**New test file**: `tests/unit/time-field-parsing.test.ts`

- [ ] `parseTimeField()` returns correct value for `_seconds` suffix
- [ ] `parseTimeField()` returns correct value for `_minutes` suffix
- [ ] `parseTimeField()` returns null when no field found
- [ ] `parseTimeField()` prefers `_seconds` over `_minutes` when both exist (edge case)
- [ ] `roundTimeValue()` rounds seconds to nearest 5
- [ ] `roundTimeValue()` rounds minutes to nearest 0.5
- [ ] `roundTimeValue()` handles edge cases (0, negative, very large values)

**Updated test file**: `tests/unit/phase2-parameters.test.ts`

- [ ] Strength exercises use `rest_time_minutes`
- [ ] Bodyweight exercises use `rest_time_seconds`
- [ ] Interval parents use `sets` (not work_time)
- [ ] Interval sub-exercises use `work_time_seconds` and `rest_time_seconds`
- [ ] EMOM parents use `block_time_minutes`
- [ ] EMOM sub-exercises use reps (not time)
- [ ] AMRAP parents use `block_time_minutes`
- [ ] AMRAP sub-exercises use reps (not time)
- [ ] Progression deltas use correct units
- [ ] Backward compatibility: old `base_*` fields still work during transition

Run: `npm run test:unit`

### Integration Tests (Vitest)

**Updated test file**: `tests/integration/workout-generation.test.ts`

- [ ] Full workout generation with interval blocks shows correct time params
- [ ] Full workout generation with EMOM blocks shows correct time params
- [ ] Time values are properly rounded in output
- [ ] No ugly decimals in rest_time values

Run: `npm run test:integration`

### Manual Testing

**CLI (Phase 1)**:
```bash
npm run cli

# Generate workout with:
# - Goal: lose_weight (uses interval blocks)
# - Duration: 30 minutes
# - Equipment: bodyweight_only

# Expected output for interval block (light intensity):
# 1. [INTERVAL] INTERVAL: Mountain Climbers + Burpees
#    Sets: Week 1: 3 sets | Week 2: 3 sets | Week 3: 3 sets
#    - Mountain Climbers:
#      Work Time: Week 1: 30 seconds | Week 2: 35 seconds | Week 3: 40 seconds
#      Rest Time: Week 1: 30 seconds | Week 2: 25 seconds | Week 3: 20 seconds
#    - Burpees:
#      Work Time: Week 1: 30 seconds | Week 2: 35 seconds | Week 3: 40 seconds
#      Rest Time: Week 1: 30 seconds | Week 2: 25 seconds | Week 3: 20 seconds
#
# Note: Work + Rest always = 60 seconds (30+30, 35+25, 40+20)

# NOT this (current buggy output):
#    - Mountain Climbers:
#      Reps: Week 1: 10 reps | Week 2: 11 reps | Week 3: 12 reps
```

### Test Acceptance Criteria

- [ ] All unit tests pass (`npm run test:unit`)
- [ ] All integration tests pass (`npm run test:integration`)
- [ ] All tests pass together (`npm test`)
- [ ] TypeScript compilation succeeds (`npm run typecheck`)
- [ ] Build succeeds (`npm run build`)
- [ ] Manual testing checklist complete
- [ ] No regressions in existing workout generation

---

## Success Criteria

- [ ] All time fields use unit-suffixed naming (no separate `_unit` fields)
- [ ] Interval sub-exercises display work_time/rest_time (NOT reps)
- [ ] EMOM/AMRAP sub-exercises display reps (current behavior preserved)
- [ ] No ugly decimal values in output (proper rounding: 5s for seconds, 0.5min for minutes)
- [ ] All existing tests pass or are updated appropriately
- [ ] Engine correctly infers unit from field name suffix
- [ ] `sub_work_mode` field controls sub-exercise parameterization
- [ ] Strength exercises show rest_time in minutes (e.g., "2 minutes rest")
- [ ] Bodyweight exercises show rest_time in seconds (e.g., "45 seconds rest")
- [ ] Interval work + rest always equals 60 seconds across all weeks
- [ ] Interval progression: +5 sec work, -5 sec rest per week
- [ ] Code follows CLAUDE.md standards
- [ ] TypeScript types are properly defined
- [ ] Tests provide >80% coverage of new code

---

## Dependencies

### Blocked By
- None

### Blocks
- Future ticket for Circuit, Mobility, Flexibility time field cleanup
- UI development may want cleaner time display

### External Dependencies
- None

---

## Risks & Mitigations

### Risk 1: Backward Compatibility Breaking
- **Impact**: High
- **Probability**: Medium
- **Mitigation**: Implement dual-read approach in Phase 2 - check new fields first, fall back to deprecated `base_*` fields. Keep deprecated fields until Phase 5 cleanup is complete and all tests pass.

### Risk 2: Progression Logic Breaks
- **Impact**: High
- **Probability**: Low
- **Mitigation**: Comprehensive test coverage for progression schemes. Test with both new and deprecated config formats.

### Risk 3: Interval Sub-Exercise Fix Has Side Effects
- **Impact**: Medium
- **Probability**: Medium
- **Mitigation**: The `sub_work_mode` field explicitly controls behavior - EMOM/AMRAP use `"reps"`, Interval uses `"time"`. Test each compound type separately.

### Risk 4: Rounding Creates Bad Values
- **Impact**: Low
- **Probability**: Low
- **Mitigation**: Use well-tested rounding functions. Round seconds to nearest 5 (not 10 - too coarse). Round minutes to nearest 0.5 (existing behavior).

---

## Notes

### Design Decisions

1. **Why `_seconds` and `_minutes` suffixes?**
   - Self-documenting: field name tells you the unit without looking at another field
   - No ambiguity: `work_time_seconds: 30` clearly means 30 seconds
   - Cleaner output: no need to store separate unit field in generated workouts

2. **Why `sub_work_mode` instead of per-sub-exercise config?**
   - Simpler: one field at parent level controls all sub-exercises
   - Consistent: all sub-exercises in a compound block use the same mode
   - Matches real-world usage: EMOM always uses reps, Interval always uses time

3. **Why keep minutes for strength rest times?**
   - More readable: "2 minutes rest" is clearer than "120 seconds rest"
   - Matches user mental model: gym-goers think in minutes for longer rests
   - Existing config already uses minutes for strength

4. **Why seconds for interval sub-exercises?**
   - More precise: "30 seconds work" is more accurate than "0.5 minutes work"
   - Avoids ugly decimals: no more "0.98 minutes"
   - Matches real-world usage: interval training is always in seconds

5. **Why work + rest = 60 seconds for intervals?**
   - Clean mental model: each interval round is exactly 1 minute
   - Easy timing: users can track rounds by watching the clock
   - Balanced progression: +5 work / -5 rest maintains the 60s total
   - Profiles represent difficulty: light (30/30) to heavy (45/15) shift work:rest ratio

### Future Work (Out of Scope)

- Circuit, Mobility, Flexibility categories still need migration (separate ticket)
- Consider adding `block_time_seconds` for very short AMRAP blocks (e.g., 30-second AMRAPs)
- UI components will need to handle both units in display

### Related Tickets

- Ticket #012: Prescriptive Workout Taxonomy - defined compound block structure
- Ticket #009: Compound exercise progression logic - established progression behavior

---

## Commit Standards Reminder

**MANDATORY**: Follow CLAUDE.md commit message standards:
- Format: `type(scope): description under 50 chars`
- Types: feat, fix, docs, style, refactor, test, chore
- Scopes: cli, engine, questionnaire, profile, schedule, live, workout-gen, exercise-selector, progression, ui, mobile, history, prs, tests
- **NEVER include "Generated with [Claude Code]" or "Co-Authored-By: Claude"**

---

## Definition of Done

- [ ] All phases implemented and tested
- [ ] All tests passing (279+ existing + new tests)
- [ ] TypeScript compilation succeeds
- [ ] Code reviewed (by code-quality-assessor agent)
- [ ] Success criteria met
- [ ] Documentation updated (WORKOUT_SPEC.md, CLAUDE.md)
- [ ] Committed with proper commit messages
- [ ] CLAUDE.md "Current Development Status" updated
- [ ] Interval sub-exercises correctly show work_time/rest_time
- [ ] No ugly decimal values in any time display
