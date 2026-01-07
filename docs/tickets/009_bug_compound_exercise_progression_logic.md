# Ticket #009: Bug - Compound Exercise Progression Logic

**Status**: Open
**Priority**: High
**Type**: bug
**Estimated Points**: 8
**Phase**: 1-CLI

---

## Summary

Fix incorrect progression logic for compound exercises (EMOM, Circuit, AMRAP, Interval) to ensure density progression keeps work time static (not increasing), and add proper volume progression rules for compound blocks that respect whole-minute rounding requirements.

## Background

The workout generation engine currently has two critical bugs in compound exercise progression:

**Bug 1: Density Progression (EMOM/Circuit/AMRAP/Interval)**
- Current behavior: work_time increases (e.g., 10min -> 12.5min -> 15min)
- **This is WRONG**: Density means "more work in same time" OR "same work in less time"
- Correct behavior: work_time should be STATIC, only reps increase
- Example: EMOM 10 minutes (10 -> 10 -> 10), with sub-exercise reps increasing (8 -> 10 -> 12)

**Bug 2: Volume Progression (EMOM/Circuit/AMRAP/Interval)**
- Current behavior: Volume progression doesn't handle work_time for compound blocks
- Missing feature: work_time should increase by (1 minute * sub_exercise_count) per week
- User requirement: "EMOM progressions must round to whole minutes. Delta each week should be a whole, even number."
- Example (3 sub-exercises): 6min -> 9min (+3) -> 12min (+3)

**Impact**: Generated workouts have incorrect compound exercise progressions, violating the definition of density progression and lacking proper volume progression options.

---

## Technical Requirements

### Data Structures

All compound exercise types use the same week parameters structure (WORKOUT_SPEC.md):

```typescript
// Compound exercise parent (EMOM example)
{
  "name": "EMOM 10 minutes",
  "category": "emom",
  "week1": {
    "work_time_minutes": 10,
    "work_time_unit": "minutes"
  },
  "week2": {
    "work_time_minutes": 10,  // STATIC for density
    "work_time_unit": "minutes"
  },
  "sub_exercises": [
    {
      "name": "Pull-ups",
      "week1": {"reps": 8},
      "week2": {"reps": 10}  // INCREASES for density
    }
  ]
}
```

### Code Locations

- Files to modify:
  - `src/lib/engine/phase2-parameters.ts` (lines 230-277: applyDensityProgression, lines 320-352: applyVolumeProgression)
  - `src/data/workout_generation_rules.json` (lines 251-281: density progression rules, lines 311-327: volume progression rules)
  - `cli/lib/interactive-workout-editor.ts` (if editor uses progression logic)

- Files to review for impact:
  - `tests/unit/phase2-parameters.test.ts` (lines 240-269: density progression tests)
  - `tests/integration/workout-generation.test.ts` (end-to-end compound exercise tests)

- Dependencies:
  - `workout_generation_rules.json` (config-driven rules)
  - `WORKOUT_SPEC.md` (data structure specification)

### TypeScript Types

All types already exist in `src/lib/engine/types.ts`:

```typescript
export interface WeekParameters {
  sets?: number;
  reps?: number | string;
  work_time_minutes?: number;
  work_time_unit?: TimeUnit;
  rest_time_minutes?: number;
  rest_time_unit?: TimeUnit;
  weight?: WeightSpecification;
}

export type TimeUnit = "seconds" | "minutes";
```

---

## Progression Rules Definition

### Density Progression (same work in less time OR more work in same time)

| Block Type | Parent work_time | Parent rest_time | Sub-exercise reps | Sub-exercise weight |
|------------|------------------|------------------|-------------------|---------------------|
| EMOM       | STATIC           | N/A              | INCREASE          | STATIC or INCREASE  |
| Circuit    | STATIC           | DECREASE         | INCREASE          | STATIC or INCREASE  |
| AMRAP      | STATIC           | N/A              | INCREASE naturally | STATIC or INCREASE  |
| Interval   | STATIC           | DECREASE         | INCREASE          | STATIC or INCREASE  |

**Key principle**: Parent work_time is STATIC, density comes from doing more reps in the same time window.

### Volume Progression (increase total work)

| Block Type | Parent work_time | Parent sets | Sub-exercise reps | Sub-exercise weight |
|------------|------------------|-------------|-------------------|---------------------|
| EMOM       | INCREASE (+1min * sub_count/week, whole minutes) | N/A | STATIC or INCREASE | STATIC |
| Circuit    | INCREASE OR STATIC | INCREASE | STATIC or INCREASE | STATIC |
| AMRAP      | INCREASE (+1min/week, whole minutes) | N/A | STATIC or INCREASE | STATIC |
| Interval   | INCREASE OR STATIC | INCREASE | STATIC or INCREASE | STATIC |

**Key principle**: Total work increases by extending time window or adding sets, weight stays constant.

**Rounding rule**: All work_time increases must round to whole minutes (6min -> 9min, NOT 6min -> 8.5min).

---

## Implementation Plan

### Phase 1: Fix Density Progression Logic (3 points)

**Goal**: Ensure density progression keeps work_time STATIC for all compound block types

**Steps**:
1. Modify `applyDensityProgression()` in `phase2-parameters.ts`
   - Add logic to detect if exercise is a compound block parent (has `category` field)
   - If compound parent: work_time_minutes stays STATIC (week1 value), only sub-exercise reps increase
   - If NOT compound parent: keep existing behavior (work_time can increase for regular exercises)
2. Update `workout_generation_rules.json` density progression rules
   - Add `compound_parent_work_time_static: true` flag
   - Add comment explaining density progression for compound blocks
3. Add helper function `isCompoundParent()` to check if exercise has compound category
   - Takes exercise structure, returns boolean
   - Used by progression logic to branch behavior

**Files**:
- Modify: `src/lib/engine/phase2-parameters.ts` (lines 230-277)
- Modify: `src/data/workout_generation_rules.json` (lines 251-281)

**Testing**:
- [ ] Unit test: Density EMOM work_time stays 10min across all weeks
- [ ] Unit test: Density Circuit work_time stays 12min across all weeks
- [ ] Unit test: Density AMRAP work_time stays 8min across all weeks
- [ ] Unit test: Density Interval work_time stays 5min across all weeks
- [ ] Unit test: Density sub-exercise reps increase correctly (8 -> 10 -> 12)
- [ ] Unit test: Regular (non-compound) exercises can still increase work_time with density
- [ ] Integration test: Generated EMOM block has static work_time in density progression

**Commit Message**:
```
fix(engine): density progression keeps compound work_time static

- Modify applyDensityProgression() to detect compound parents
- Compound blocks (EMOM/Circuit/AMRAP/Interval) keep work_time STATIC
- Density comes from sub-exercise reps increasing, not time extension
- Regular exercises unaffected (can still increase work_time)
- Update workout_generation_rules.json with compound_parent flag
```

**Agent Invocations**:
```bash
# Implementation
shredly-code-writer agent with:
"Implement Phase 1 from ticket #009: Fix density progression for compound exercises.
Modify applyDensityProgression() in phase2-parameters.ts to keep work_time STATIC
for compound parents (detect via category field). Update workout_generation_rules.json
with compound_parent_work_time_static flag. Add isCompoundParent() helper."

# Testing
test-writer agent with:
"Write unit tests for ticket #009 Phase 1 density progression fix. Test: EMOM/Circuit/AMRAP/Interval
work_time stays static across weeks, sub-exercise reps increase, regular exercises unaffected,
integration test for generated EMOM blocks."

# Review
test-critic agent with:
"Review tests for ticket #009 Phase 1. Ensure all compound block types tested (EMOM/Circuit/AMRAP/Interval),
regular exercise behavior preserved, edge cases covered (missing category field, empty sub_exercises)."

# Code quality
code-quality-assessor agent with:
"Review phase2-parameters.ts changes from ticket #009 Phase 1. Check: clean compound detection,
no breaking changes to existing logic, config-driven approach, TypeScript types correct."
```

---

### Phase 2: Add Volume Progression for Compound Blocks (3 points)

**Goal**: Implement proper volume progression rules for compound exercises with whole-minute rounding

**Steps**:
1. Modify `applyVolumeProgression()` in `phase2-parameters.ts`
   - Add compound block handling branch
   - For EMOM: work_time increases by (1 minute * sub_exercise_count) per week
   - For AMRAP: work_time increases by 1 minute per week
   - For Circuit/Interval: work_time increases OR sets increase (configurable)
   - Round all work_time values to whole minutes (no decimals)
2. Update `workout_generation_rules.json` volume progression rules
   - Add `compound_emom_time_increase_per_sub_per_week: 1` (minutes)
   - Add `compound_amrap_time_increase_per_week: 1` (minutes)
   - Add `compound_circuit_increase_sets: true` (alternative to time increase)
   - Add `round_work_time_to_whole_minutes: true` flag
3. Add `roundToWholeMinutes()` helper function
   - Takes number (minutes), returns integer
   - Used for all compound block work_time calculations

**Files**:
- Modify: `src/lib/engine/phase2-parameters.ts` (lines 320-352)
- Modify: `src/data/workout_generation_rules.json` (lines 311-327)

**Testing**:
- [ ] Unit test: EMOM volume progression increases by (1min * sub_count) per week
- [ ] Unit test: 3-sub EMOM: 6min -> 9min (+3) -> 12min (+3)
- [ ] Unit test: 2-sub EMOM: 4min -> 6min (+2) -> 8min (+2)
- [ ] Unit test: AMRAP volume progression increases by 1min per week
- [ ] Unit test: Circuit volume progression increases sets (work_time static)
- [ ] Unit test: All work_time values are whole minutes (no decimals like 8.5)
- [ ] Unit test: Rounding handles edge cases (8.7 -> 9, 12.2 -> 12)
- [ ] Integration test: Generated EMOM block has proper volume progression

**Commit Message**:
```
feat(engine): add volume progression for compound exercises

- Implement volume progression for EMOM/AMRAP/Circuit/Interval blocks
- EMOM increases work_time by (1min * sub_exercise_count) per week
- AMRAP increases work_time by 1min per week
- Circuit/Interval can increase sets OR time (configurable)
- All work_time rounded to whole minutes (no decimals)
- Update workout_generation_rules.json with compound volume rules
```

**Agent Invocations**:
```bash
# Implementation
shredly-code-writer agent with:
"Implement Phase 2 from ticket #009: Add volume progression for compound exercises.
Modify applyVolumeProgression() in phase2-parameters.ts to handle EMOM/AMRAP/Circuit/Interval.
Add roundToWholeMinutes() helper. Update workout_generation_rules.json with compound volume rules."

# Testing
test-writer agent with:
"Write unit tests for ticket #009 Phase 2 volume progression. Test: EMOM time increase by sub_count,
AMRAP +1min/week, Circuit sets increase, whole-minute rounding, various sub_exercise counts,
integration test."

# Review
test-critic agent with:
"Review tests for ticket #009 Phase 2. Ensure rounding logic tested thoroughly, edge cases covered
(0 subs, 1 sub, 5+ subs), all block types tested, config flags respected."

# Code quality
code-quality-assessor agent with:
"Review phase2-parameters.ts changes from ticket #009 Phase 2. Check: clean volume logic,
rounding function correct, config-driven, no magic numbers, TypeScript types correct."
```

---

### Phase 3: Update Editor Progression Logic (2 points)

**Goal**: Ensure CLI workout editor uses same progression rules when manually advancing weeks

**Steps**:
1. Review `cli/lib/interactive-workout-editor.ts` for progression logic usage
   - Check if editor has "advance week" functionality
   - If yes, ensure it uses `applyProgressionScheme()` from phase2-parameters
   - If no, document that editor doesn't need changes
2. Add manual test scenarios for editor
   - Create EMOM block with density progression
   - Verify work_time stays static when viewing week 2, 3
   - Create EMOM block with volume progression
   - Verify work_time increases by (1min * sub_count) per week
3. Update editor documentation if needed

**Files**:
- Review: `cli/lib/interactive-workout-editor.ts`
- Modify (if needed): `cli/lib/interactive-workout-editor.ts`

**Testing**:
- [ ] Manual CLI test: View EMOM (density) week1/week2/week3, verify static work_time
- [ ] Manual CLI test: View EMOM (volume) week1/week2/week3, verify increasing work_time
- [ ] Manual CLI test: Create custom EMOM, verify progression follows new rules
- [ ] Manual CLI test: Switch EMOM from density to volume, verify progression changes

**Commit Message**:
```
fix(cli): ensure editor uses corrected compound progression

- Review editor progression logic usage
- Verify density EMOM keeps work_time static in editor view
- Verify volume EMOM increases work_time correctly in editor view
- Document editor behavior with new progression rules
```

**Agent Invocations**:
```bash
# Implementation (if needed)
shredly-code-writer agent with:
"Implement Phase 3 from ticket #009: Review cli/lib/interactive-workout-editor.ts for progression
logic. Ensure editor uses applyProgressionScheme() correctly for compound blocks. Update if needed."

# Testing (manual)
"Test ticket #009 Phase 3 manually in CLI editor: Create EMOM with density/volume progression,
view week 2/3, verify work_time behavior matches new rules. Document findings."

# Code quality
code-quality-assessor agent with:
"Review cli/lib/interactive-workout-editor.ts for ticket #009 Phase 3. Check: uses shared
progression logic, no duplicate rules, behavior consistent with phase2-parameters.ts."
```

---

## Testing Strategy

### Unit Tests

**Density Progression Tests** (`tests/unit/phase2-parameters.test.ts`):
- [ ] EMOM density: work_time static (10 -> 10 -> 10), reps increase (8 -> 10 -> 12)
- [ ] Circuit density: work_time static (12 -> 12 -> 12), rest_time decrease, reps increase
- [ ] AMRAP density: work_time static (8 -> 8 -> 8), reps increase naturally
- [ ] Interval density: work_time static (5 -> 5 -> 5), rest_time decrease
- [ ] Regular exercise density: work_time CAN increase (not compound block)
- [ ] Edge case: Compound parent with no sub_exercises still static

**Volume Progression Tests** (`tests/unit/phase2-parameters.test.ts`):
- [ ] EMOM volume (3 subs): 6min -> 9min (+3) -> 12min (+3)
- [ ] EMOM volume (2 subs): 4min -> 6min (+2) -> 8min (+2)
- [ ] EMOM volume (1 sub): 3min -> 4min (+1) -> 5min (+1)
- [ ] AMRAP volume: 6min -> 7min (+1) -> 8min (+1)
- [ ] Circuit volume: sets increase (3 -> 4 -> 5), time static OR time increase
- [ ] Interval volume: sets increase OR time increase (configurable)
- [ ] Rounding: 8.7min -> 9min, 12.2min -> 12min, 15.9min -> 16min
- [ ] Edge case: 0 sub_exercises, uses default 1min increase

**Parameterization Tests** (`tests/unit/phase2-parameters.test.ts`):
- [ ] parameterizeExercise() creates EMOM with correct density progression
- [ ] parameterizeExercise() creates EMOM with correct volume progression
- [ ] Sub-exercises inherit correct progression from parent

### Integration Tests

**End-to-End Generation Tests** (`tests/integration/workout-generation.test.ts`):
- [ ] Generate PPL workout with EMOM (density), verify static work_time
- [ ] Generate Full Body workout with AMRAP (volume), verify +1min/week
- [ ] Generate ULPPL workout with Circuit (density), verify static work_time, decreasing rest
- [ ] Verify all compound blocks in generated workouts follow new rules

### Manual Testing

**CLI Editor Tests**:
```bash
# Test 1: View density EMOM progression
npm run edit-workout <generated-workout-with-emom-density.json>
- Navigate to EMOM block
- Press 'w' to cycle weeks: week1 -> week2 -> week3
- Verify: work_time stays 10 minutes across all weeks
- Verify: sub-exercise reps increase (8 -> 10 -> 12)

# Test 2: View volume EMOM progression
npm run edit-workout <generated-workout-with-emom-volume.json>
- Navigate to EMOM block (3 sub-exercises)
- Press 'w' to cycle weeks
- Verify: work_time increases 6min -> 9min -> 12min
- Verify: Increases are whole numbers (+3 each week)

# Test 3: Create custom EMOM, verify progression
npm run cli
- Generate workout with EMOM
- Open editor
- Create new EMOM block with 'b', add 2 sub-exercises
- Set progression to density
- Verify: week1/week2/week3 work_time static
```

### Test Acceptance Criteria

- [ ] All unit tests pass (npm run test:unit)
- [ ] All integration tests pass (npm run test:integration)
- [ ] TypeScript compilation succeeds (npm run typecheck)
- [ ] Build succeeds (npm run build)
- [ ] Manual CLI testing checklist complete
- [ ] No regressions in existing density/volume progression for regular exercises

---

## Success Criteria

- [ ] Density progression for EMOM/Circuit/AMRAP/Interval keeps work_time STATIC
- [ ] Volume progression for EMOM increases work_time by (1min * sub_count) per week
- [ ] Volume progression for AMRAP increases work_time by 1min per week
- [ ] All compound block work_time values are whole minutes (no decimals)
- [ ] Regular exercises (non-compound) unaffected by changes
- [ ] Code follows CLAUDE.md standards (config-driven, fail loudly)
- [ ] Data structures comply with WORKOUT_SPEC.md
- [ ] TypeScript types properly used from types.ts
- [ ] Tests provide >80% coverage of modified progression logic
- [ ] Documentation updated in workout_generation_rules.json

---

## Dependencies

### Blocked By
- None (this is a bug fix for existing functionality)

### Blocks
- None (no other tickets depend on this fix)

### External Dependencies
- None (all logic is internal to phase2-parameters.ts)

---

## Risks & Mitigations

### Risk 1: Breaking Existing Regular Exercise Progression
- **Impact**: High
- **Probability**: Medium
- **Mitigation**: Add `isCompoundParent()` check to branch logic cleanly. Existing tests for regular exercises will catch regressions. Run full test suite before committing each phase.

### Risk 2: Inconsistent Rounding Across Code Paths
- **Impact**: Medium
- **Probability**: Low
- **Mitigation**: Create single `roundToWholeMinutes()` helper function used consistently. Add unit tests for rounding edge cases (0.4, 0.5, 0.6, etc.).

### Risk 3: Config Changes Breaking Existing Workouts
- **Impact**: Medium
- **Probability**: Low
- **Mitigation**: New config flags are additive (compound_parent_work_time_static, round_work_time_to_whole_minutes). Existing workouts regenerate with new rules. No breaking schema changes.

### Risk 4: Editor Using Duplicate Progression Logic
- **Impact**: Low
- **Probability**: Low
- **Mitigation**: Phase 3 explicitly reviews editor code. If editor has progression logic, refactor to use shared applyProgressionScheme() function. Document if editor doesn't need changes.

---

## Notes

### Design Decisions

1. **Config-Driven Approach**: All new rules added to workout_generation_rules.json rather than hardcoding in TypeScript. This maintains consistency with existing architecture.

2. **Compound Detection**: Use `category` field presence to detect compound parents (EMOM/Circuit/AMRAP/Interval). This is the canonical marker in WORKOUT_SPEC.md.

3. **Rounding Strategy**: Round to whole minutes (Math.round) rather than ceiling/floor to avoid systematic bias. 8.4 -> 8, 8.5 -> 9, 8.6 -> 9.

4. **Volume Progression Formula**: EMOM uses (1min * sub_count) because each sub-exercise needs time to complete. AMRAP uses flat 1min because rounds are self-paced.

5. **Backward Compatibility**: Existing workouts will regenerate with new rules. No migration needed since workouts are generated on-demand from questionnaire + exercise DB.

### Alternative Approaches Considered

1. **Density with Decreasing Time**: Could make work_time decrease week-to-week (10min -> 8min -> 6min). Rejected because too aggressive for beginners, increases injury risk.

2. **Volume with Percentage Increase**: Could use percentage-based increases (work_time * 1.25). Rejected because user explicitly requested whole-minute deltas.

3. **Separate Progression Types**: Could create "density_compound" and "volume_compound" as new progression types. Rejected because adds complexity; better to branch within existing types.

### Related Specifications

- **WORKOUT_SPEC.md** (lines 100-134): Compound exercise structure with sub_exercises
- **EXERCISE_HISTORY_SPEC.md** (lines 88-97): Compound exercise history tracking
- **workout_generation_rules.json** (lines 251-327): Current density/volume progression rules

---

## Commit Standards Reminder

**MANDATORY**: Follow CLAUDE.md commit message standards:
- Format: `type(scope): description under 50 chars`
- Types: feat (new volume rules), fix (density bug), test, refactor
- Scopes: engine (phase2-parameters), tests (test files)
- **NEVER include "Generated with [Claude Code]" or "Co-Authored-By: Claude"**

Example commits:
```
fix(engine): density progression keeps compound work_time static
feat(engine): add volume progression for compound exercises
test(engine): add compound progression unit tests
```

---

## Definition of Done

- [ ] All phases implemented and tested
- [ ] All unit tests passing (density, volume, rounding)
- [ ] All integration tests passing (end-to-end generation)
- [ ] TypeScript compilation succeeds
- [ ] Code reviewed (by code-quality-assessor agent)
- [ ] Success criteria met (static density time, proper volume increases)
- [ ] Manual CLI testing complete
- [ ] Committed with proper commit messages
- [ ] CLAUDE.md "Current Development Status" updated
- [ ] workout_generation_rules.json documentation updated
