# Ticket #008: Bug - Work Definition Toggle Weight Field Visibility

**Status**: Open
**Priority**: High
**Type**: bug
**Estimated Points**: 5
**Phase**: 1-CLI

---

## Summary

Fix architectural flaw in workout editor where weight fields disappear when toggling from reps mode to work_time mode, causing weighted time-based exercises to lose weight data. Implement metadata-driven field visibility rules using exercise database `external_load` and `isometric` properties.

## Background

The current workout editor (src/lib/engine/workout-editor.ts) has a critical bug in the `getAllEditableFields()` method where weight fields are only shown when `workMode === 'reps'` (lines 136-146). This creates invalid states for exercises that require weight in time-based mode:

**Example Problem**:
- "Dumbbell Weighted Crunches" (external_load: "always") is set to 3 sets x 12 reps @ 25 lbs
- User toggles to work_time mode (3 sets x 30 seconds)
- Weight field disappears from UI even though weighted crunches still need weight specification
- User cannot see or edit the weight value anymore

**Root Cause**:
```typescript
// Lines 136-146 in getAllEditableFields()
if (workMode === 'reps' && weekParams.weight !== undefined) {
  fields.push({ /* weight field */ });
}
```

This logic assumes weight is only relevant for rep-based exercises, but this is false for:
1. Time-based weighted exercises (weighted planks, timed weighted carries)
2. Weighted AMRAP circuits with time caps
3. Interval training with external load

**Exercise Database Metadata**:
- **147 exercises (56%)**: `external_load: "always"` - MUST always show weight field
- **101 exercises (39%)**: `external_load: "never"` - NEVER show weight field
- **13 exercises (5%)**: `external_load: "sometimes"` - Show weight if present
- **5 exercises (2%)**: `isometric: true` - Should ONLY allow work_time mode (never reps)
- **256 exercises (98%)**: `isometric: false` - Can use reps or work_time

The database already contains the metadata needed to make correct field visibility and toggle validation decisions.

---

## Technical Requirements

### Data Structures

Reference WORKOUT_SPEC.md for week parameters and exercise_database.json for metadata:

```typescript
// Exercise Database Metadata (exercise_database.json)
{
  "Dumbbell Weighted Crunches": {
    "category": "strength",
    "external_load": "always",  // ← MUST always show weight
    "isometric": false,         // ← Can toggle reps/work_time
    // ...
  },
  "Plank Hold": {
    "category": "mobility",
    "external_load": "never",   // ← NEVER show weight
    "isometric": true,          // ← ONLY work_time mode (block toggle to reps)
    // ...
  },
  "Wall Sit": {
    "category": "mobility",
    "external_load": "sometimes", // ← Show weight if present in data
    "isometric": true,
    // ...
  }
}

// Week Parameters (unchanged)
{
  "week1": {
    "sets": 3,
    "reps": 12,              // OR work_time_minutes
    "weight": "moderate",
    "rest_time_minutes": 1.5,
    "rest_time_unit": "minutes"
  }
}
```

### Code Locations

- Files to modify:
  - `src/lib/engine/workout-editor.ts`:
    - `getAllEditableFields()` (lines 86-240) - Fix weight field visibility rules
    - `toggleWorkDefinition()` (lines 853-927) - Add isometric validation
    - `toggleSubExerciseWorkDefinition()` (lines 932-1007) - Add isometric validation
  - Tests to modify:
    - `tests/unit/workout-editor-work-mode.test.ts` - Add metadata-driven visibility tests
    - `tests/unit/workout-editor-toggle-smart-time-units.test.ts` - Add isometric blocking tests

- Files to create:
  - None (all functionality added to existing files)

### Dependencies

- `src/data/exercise_database.json` - Source of truth for `external_load` and `isometric` metadata
- Existing `WorkoutEditor` class methods and patterns

### TypeScript Types

All types already exist in `src/lib/engine/types.ts`:

```typescript
// Exercise Database Entry (for reference)
interface ExerciseDatabaseEntry {
  category: string;
  external_load: "always" | "never" | "sometimes";
  isometric: boolean;
  // ... other fields
}

// No new types needed - use existing ParameterizedExercise and WeekParameters
```

---

## Implementation Plan

### Phase 1: Exercise Metadata Lookup Helper (2 points)

**Goal**: Add helper method to WorkoutEditor to lookup exercise metadata from database

**Steps**:
1. Add private method `getExerciseMetadata(exerciseName: string)` to WorkoutEditor class
   - Searches all categories in exercise_database.json for matching exercise name
   - Returns metadata object with `external_load`, `isometric`, etc.
   - Returns null if exercise not found (handles custom exercise names gracefully)
2. Add caching to avoid repeated JSON traversal for same exercise
3. Handle edge cases:
   - Compound exercise parent names (e.g., "EMOM 10 minutes") - return null
   - Custom user-created exercises not in database - return null (assume defaults)

**Files**:
- Modify: `src/lib/engine/workout-editor.ts` (add method around line 70)

**Testing**:
- [ ] Unit test: getExerciseMetadata returns correct metadata for known exercises
- [ ] Unit test: getExerciseMetadata returns null for compound parent names
- [ ] Unit test: getExerciseMetadata returns null for non-existent exercises
- [ ] Unit test: Caching prevents redundant database lookups

**Commit Message**:
```
feat(engine): add exercise metadata lookup to workout editor

- Add getExerciseMetadata() helper to WorkoutEditor class
- Lookup external_load and isometric properties from exercise database
- Cache results to avoid redundant JSON traversal
- Handle compound parents and custom exercises gracefully

Testing: 4 unit tests covering lookup, caching, edge cases
```

**Agent Invocations**:
```bash
# Implementation
shredly-code-writer agent: "Implement Phase 1 for ticket #008: Add getExerciseMetadata() helper method to WorkoutEditor class with caching"

# Testing
test-writer agent: "Write unit tests for getExerciseMetadata() from ticket #008 Phase 1"
test-critic agent: "Review test quality for getExerciseMetadata() tests"
test-writer agent: "Implement improvements suggested by test-critic"

# Code review
code-quality-assessor agent: "Review src/lib/engine/workout-editor.ts getExerciseMetadata() implementation from ticket #008 Phase 1"
```

---

### Phase 2: Fix Weight Field Visibility in getAllEditableFields() (3 points)

**Goal**: Replace workMode-based weight visibility with metadata-driven rules

**Steps**:
1. Modify `getAllEditableFields()` method (lines 136-146 and 210-221)
2. For parent exercises:
   - Lookup exercise metadata using `getExerciseMetadata(exercise.name)`
   - If metadata found, apply visibility rules based on `external_load`:
     - `"always"` → ALWAYS add weight field (regardless of workMode)
     - `"never"` → NEVER add weight field
     - `"sometimes"` → Add weight field if `weekParams.weight !== undefined`
   - If metadata NOT found (custom exercise), fall back to current behavior (show if present)
3. For sub-exercises (lines 210-221):
   - Apply same metadata-driven rules
   - Sub-exercises can have different metadata than parent
4. Remove old `if (workMode === 'reps' && weekParams.weight !== undefined)` logic
5. Preserve weight data during toggle operations (already handled in toggleWorkDefinition)

**Files**:
- Modify: `src/lib/engine/workout-editor.ts` (getAllEditableFields method)

**Testing**:
- [ ] Unit test: "Dumbbell Weighted Crunches" shows weight in BOTH reps and work_time modes
- [ ] Unit test: "Plank Hold" (external_load: never) NEVER shows weight field
- [ ] Unit test: "Wall Sit" (external_load: sometimes) shows weight only if present
- [ ] Unit test: Custom exercise name (not in DB) shows weight if present (fallback behavior)
- [ ] Unit test: Sub-exercises use their own metadata, not parent's metadata
- [ ] Integration test: Toggle "Dumbbell Weighted Crunches" from reps to work_time, weight field remains visible

**Commit Message**:
```
fix(engine): use exercise metadata for weight field visibility

- Replace workMode-based weight visibility with metadata-driven rules
- external_load:always → always show weight (both reps and work_time)
- external_load:never → never show weight
- external_load:sometimes → show weight if present in data
- Fix bug where weighted time-based exercises lost weight field
- Fallback to current behavior for custom exercises not in database

Fixes: Weight fields disappearing when toggling to work_time mode
Testing: 6 tests covering all external_load cases + toggle integration
```

**Agent Invocations**:
```bash
# Implementation
shredly-code-writer agent: "Implement Phase 2 for ticket #008: Fix weight field visibility in getAllEditableFields() using exercise metadata"

# Testing
test-writer agent: "Write tests for metadata-driven weight field visibility from ticket #008 Phase 2"
test-critic agent: "Review test coverage for all external_load cases and edge cases"
test-writer agent: "Implement test improvements and add missing edge case coverage"

# Code review
code-quality-assessor agent: "Review getAllEditableFields() changes from ticket #008 Phase 2"
```

---

### Phase 3: Add Isometric Toggle Validation (Future - Optional)

**Note**: This phase is marked as FUTURE because isometric validation is a nice-to-have enhancement, not critical for fixing the weight field bug. The bug fix (Phases 1-2) is complete and can be shipped without this validation.

**Goal**: Prevent toggling isometric exercises to reps mode (show clear error message)

**Steps**:
1. Modify `toggleWorkDefinition()` method (lines 853-927)
   - Before toggling, lookup exercise metadata
   - If `isometric: true` and attempting to toggle from work_time → reps, block and return error
   - Error message: "Cannot toggle [Exercise Name] to reps mode - isometric exercises must use work_time"
2. Modify `toggleSubExerciseWorkDefinition()` method (lines 932-1007)
   - Apply same validation for sub-exercises
3. Allow toggle from reps → work_time for isometric exercises (in case user misconfigured)

**Files**:
- Modify: `src/lib/engine/workout-editor.ts` (toggleWorkDefinition and toggleSubExerciseWorkDefinition)

**Testing**:
- [ ] Unit test: "Plank Hold" (isometric: true) blocks toggle from work_time to reps
- [ ] Unit test: "Plank Hold" allows toggle from reps to work_time (fix misconfiguration)
- [ ] Unit test: "Bench Press" (isometric: false) allows toggle in both directions
- [ ] Unit test: Sub-exercise isometric validation works independently of parent
- [ ] Manual CLI test: Try toggling "Plank Hold" and verify error message

**Commit Message**:
```
feat(engine): add isometric exercise toggle validation

- Block toggle from work_time to reps for isometric exercises
- Show clear error message explaining isometric constraint
- Allow toggle from reps to work_time (fixes misconfigurations)
- Apply validation to both parent and sub-exercises

Testing: 4 unit tests + manual CLI validation
```

**Agent Invocations**:
```bash
# Implementation
shredly-code-writer agent: "Implement Phase 3 for ticket #008: Add isometric toggle validation to prevent invalid reps mode"

# Testing
test-writer agent: "Write tests for isometric toggle validation from ticket #008 Phase 3"
test-critic agent: "Review test coverage for isometric validation edge cases"
test-writer agent: "Implement test improvements"

# Code review
code-quality-assessor agent: "Review toggle validation changes from ticket #008 Phase 3"
```

---

## Testing Strategy

### Unit Tests

**New test file**: `tests/unit/workout-editor-metadata-field-visibility.test.ts`

Test cases:
- [ ] getExerciseMetadata() returns correct metadata for known exercises
- [ ] getExerciseMetadata() handles compound parents and custom exercises
- [ ] external_load:always exercises show weight in reps mode
- [ ] external_load:always exercises show weight in work_time mode
- [ ] external_load:never exercises never show weight field
- [ ] external_load:sometimes exercises show weight only if present
- [ ] Custom exercises (not in DB) fall back to "show if present" behavior
- [ ] Sub-exercises use their own metadata independently

**Modify existing test file**: `tests/unit/workout-editor-toggle-smart-time-units.test.ts`

Test cases (Phase 3):
- [ ] isometric:true exercises block toggle from work_time to reps
- [ ] isometric:true exercises allow toggle from reps to work_time
- [ ] isometric:false exercises allow toggle in both directions

### Integration Tests

**Modify existing test file**: `tests/unit/workout-editor-work-mode.test.ts`

Test cases:
- [ ] "Dumbbell Weighted Crunches": Toggle reps→work_time, weight field remains visible
- [ ] "Dumbbell Weighted Crunches": Toggle work_time→reps, weight field remains visible
- [ ] "Plank Hold": Weight field never appears in any mode
- [ ] "Wall Sit" (external_load:sometimes): Weight field toggles based on data presence

### Manual Testing

**CLI (Phase 1)**:
```bash
npm run cli
# Generate workout with "Dumbbell Weighted Crunches"
# Navigate to exercise and verify weight field visible
# Toggle to work_time mode with 't' key
# Verify weight field STILL visible in field list
# Edit weight value to confirm field is interactive
```

**CLI (Phase 3 - Future)**:
```bash
npm run cli
# Generate workout with "Plank Hold" (isometric)
# Replace an exercise with "Plank Hold" if needed
# Try toggling with 't' key
# Verify error message appears blocking toggle to reps
```

### Test Acceptance Criteria

- [ ] All unit tests pass (npm run test:unit)
- [ ] All integration tests pass (npm test)
- [ ] TypeScript compilation succeeds (npm run typecheck)
- [ ] No regression in existing workout-editor tests
- [ ] Manual CLI testing confirms weight fields visible in both modes for external_load:always exercises

---

## Success Criteria

- [ ] Weight fields visible for external_load:always exercises in BOTH reps and work_time modes
- [ ] Weight fields never appear for external_load:never exercises
- [ ] Weight fields conditionally appear for external_load:sometimes exercises
- [ ] Toggling "Dumbbell Weighted Crunches" from reps to work_time preserves weight field visibility
- [ ] Custom exercises (not in database) fall back gracefully to "show if present" behavior
- [ ] Phase 3 (Future): Isometric exercises block invalid toggle to reps mode with clear error
- [ ] Code follows CLAUDE.md standards (TypeScript, ES Modules, fail loudly)
- [ ] Test coverage >80% for new metadata lookup logic
- [ ] No breaking changes to existing workout editor functionality
- [ ] getAllEditableFields() performance does not degrade (metadata lookup is cached)

---

## Dependencies

### Blocked By
- None (ticket can be implemented immediately)

### Blocks
- None (independent bug fix)

### External Dependencies
- None (uses existing exercise_database.json)

---

## Risks & Mitigations

### Risk 1: Exercise Database Lookup Performance
- **Impact**: Medium
- **Probability**: Low
- **Mitigation**:
  - Implement caching in getExerciseMetadata() to avoid repeated JSON traversal
  - Cache results per exercise name for duration of editor session
  - Measure performance with 10+ exercise workout (should be <1ms per lookup)

### Risk 2: Compound Parent Name Handling
- **Impact**: Low
- **Probability**: Medium
- **Mitigation**:
  - getExerciseMetadata() returns null for compound parents (e.g., "EMOM 10 minutes")
  - Fallback behavior: compound parents use current logic (show weight if present)
  - Document that compound parents don't have metadata (expected behavior)

### Risk 3: Custom Exercise Names Not in Database
- **Impact**: Low
- **Probability**: Medium (future feature)
- **Mitigation**:
  - getExerciseMetadata() returns null for unknown exercises
  - Fallback to current behavior: show weight if present in data
  - This matches expected behavior for user-created exercises

### Risk 4: Breaking Existing Tests
- **Impact**: High
- **Probability**: Low
- **Mitigation**:
  - Run full test suite after each phase (npm test)
  - Review test output carefully for unexpected failures
  - Keep changes scoped to field visibility logic, not data modification
  - Existing toggle tests should pass unchanged (we're fixing visibility, not toggle behavior)

---

## Notes

### Design Decisions

1. **Metadata-Driven vs Hardcoded Rules**:
   - Choice: Use exercise database metadata (external_load, isometric)
   - Rationale: Single source of truth, scales to 261 exercises, no hardcoded exercise names
   - Alternative rejected: Hardcode list of weighted exercises (brittle, requires code changes when adding exercises)

2. **Fallback Behavior for Unknown Exercises**:
   - Choice: Show weight if present in data (current behavior)
   - Rationale: Gracefully handles custom user exercises not in database
   - Alternative rejected: Default to "always show weight" (too aggressive, clutters UI)

3. **Phase 3 (Isometric Validation) as Optional**:
   - Choice: Mark Phase 3 as FUTURE/Optional
   - Rationale: Phases 1-2 fix the critical bug (weight fields disappearing). Isometric validation is a nice-to-have enhancement that prevents user errors but doesn't block shipping the fix.
   - Can be implemented later as separate ticket if needed

### Related Issues from BUGS_WISHES.md

This ticket addresses the architectural issue mentioned in the user's context:
- Weight fields disappearing when toggling to work_time mode
- Invalid assumption that weight is only relevant for rep-based exercises

### Performance Considerations

- Exercise database lookup is O(n) per exercise name without caching
- With caching: O(1) after first lookup per unique exercise name
- Typical workout has 5-8 exercises, so max ~8 cache entries per workout
- Cache clears on new workout load (no memory leak)

---

## Commit Standards Reminder

**MANDATORY**: Follow CLAUDE.md commit message standards:
- Format: `type(scope): description under 50 chars`
- Types: feat, fix, docs, style, refactor, test, chore
- Scopes: cli, engine, questionnaire, profile, schedule, live, workout-gen, exercise-selector, progression, ui, mobile, history, prs, tests
- **NEVER include "🤖 Generated with [Claude Code]" or "Co-Authored-By: Claude"**

Example commits for this ticket:
```
feat(engine): add exercise metadata lookup to workout editor
fix(engine): use exercise metadata for weight field visibility
feat(engine): add isometric exercise toggle validation
test(engine): add metadata-driven field visibility tests
```

---

## Definition of Done

- [x] Ticket created with comprehensive implementation details
- [ ] Phase 1 implemented and tested (metadata lookup helper)
- [ ] Phase 2 implemented and tested (weight field visibility fix)
- [ ] Phase 3 implemented and tested (FUTURE - isometric validation)
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] TypeScript compilation succeeds
- [ ] Manual CLI testing complete
- [ ] Code reviewed (by code-quality-assessor agent)
- [ ] Success criteria met
- [ ] Committed with proper commit messages (one per phase)
- [ ] CLAUDE.md "Current Development Status" updated
- [ ] No regressions in existing functionality
