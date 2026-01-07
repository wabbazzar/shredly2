# Ticket #008: Bug - Editor Weighted Time-Based Exercise Field Visibility

**Status**: Open
**Priority**: High
**Type**: bug
**Estimated Points**: 9 (Phases 1-2: 5 points to fix bug, Phases 3-4: 4 points future enhancements)
**Phase**: 1-CLI

---

## Summary

Fix architectural flaw where generator (phase2-parameters.ts) and editor (workout-editor.ts) use DIFFERENT rules for weight field handling, causing weight fields to disappear when toggling weighted time-based exercises. Create shared exercise-metadata.ts module as single source of truth for BOTH systems.

## Background

### Critical Finding: Architectural Inconsistency

The codebase has a fundamental architectural problem where two systems use incompatible rules:

**Generator (phase2-parameters.ts)**: Uses `external_load` metadata from exercise database - CORRECT
- Lines 375-380: Looks up `exerciseExternalLoad = exerciseData[1].external_load`
- Line 110: `shouldAssignWeight = exerciseExternalLoad !== 'never'`
- Can correctly create exercises with BOTH work_time AND weight (e.g., weighted plank holds)

**Editor (workout-editor.ts)**: Uses `workMode` state instead of metadata - BUGGY
- Line 136: `if (workMode === 'reps' && weekParams.weight !== undefined)`
- Weight fields only shown for reps mode
- Hides weight when in work_time mode (even for external_load: "always" exercises)

**Result**: Generator creates weighted time-based exercises correctly, but editor can't display them!

### Example Problem Scenario

1. Generator creates: "Dumbbell Weighted Crunches" (external_load: "always") - 3 sets x 30 seconds @ 25 lbs
2. User opens workout in editor
3. Weight field is visible initially (workMode='reps' even though exercise has work_time)
4. User toggles to work_time mode with 't' key
5. Weight field DISAPPEARS from UI even though weighted crunches still need weight specification
6. User cannot see or edit the 25 lbs value anymore
7. Data is preserved but invisible (architectural flaw, not data loss)

### Exercise Database Metadata (Source of Truth)

The exercise database already contains the metadata needed to make correct decisions:

- **147 exercises (56%)**: `external_load: "always"` - MUST always show weight field
- **101 exercises (39%)**: `external_load: "never"` - NEVER show weight field
- **13 exercises (5%)**: `external_load: "sometimes"` - Show weight if present
- **5 exercises (2%)**: `isometric: true` - Should ONLY allow work_time mode (never reps)
- **256 exercises (98%)**: `isometric: false` - Can use reps or work_time

### Architectural Solution: Shared Module

Create `src/lib/engine/exercise-metadata.ts` as standalone module that BOTH generator and editor import. This ensures:
- Single source of truth for field visibility rules
- Both systems use SAME logic
- Easy to extend with new metadata-driven features
- Performance optimized with caching
- Clear separation of concerns

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
    "typical_reps": "8-15",
    "difficulty": "intermediate",
    "muscle_groups": ["core"],
    "equipment": ["dumbbells"]
  },
  "Plank Hold": {
    "category": "mobility",
    "external_load": "never",   // ← NEVER show weight
    "isometric": true,          // ← ONLY work_time mode (block toggle to reps)
    "difficulty": "beginner",
    "muscle_groups": ["core"],
    "equipment": ["bodyweight"]
  },
  "Wall Sit": {
    "category": "mobility",
    "external_load": "sometimes", // ← Show weight if present in data
    "isometric": true,
    "difficulty": "beginner",
    "muscle_groups": ["quads"],
    "equipment": ["bodyweight"]
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

### Core Field Visibility Rule (Used by BOTH Generator and Editor)

```typescript
if (external_load === "always")    → ALWAYS show/assign weight
if (external_load === "never")     → NEVER show/assign weight
if (external_load === "sometimes") → show/assign weight if present in data
```

### Code Locations

**Files to create**:
- `src/lib/engine/exercise-metadata.ts` (NEW standalone module)
- `tests/unit/exercise-metadata.test.ts` (NEW comprehensive unit tests)

**Files to modify**:
- `src/lib/engine/workout-editor.ts`:
  - Import from shared module: `import { shouldShowWeightField } from './exercise-metadata.js'`
  - Replace lines 136-146: Remove `if (workMode === 'reps' && weekParams.weight !== undefined)`
  - Add: `if (shouldShowWeightField(exercise.name, weekParams.weight))`
  - Update sub-exercise weight visibility (lines 210-221) similarly
  - Remove `determineWorkMode()` method if no longer needed

- `src/lib/engine/phase2-parameters.ts` (FUTURE - Phase 3):
  - Import: `import { shouldAssignWeightOnGeneration } from './exercise-metadata.js'`
  - Replace lines 375-382 (manual lookup): Remove inline database search
  - Replace line 110: Change `exerciseExternalLoad !== 'never'` to `shouldAssignWeightOnGeneration(exercise.name)`

**Files to modify (tests)**:
- `tests/unit/workout-editor-work-mode.test.ts` - Add metadata-driven visibility tests
- `tests/unit/workout-editor-toggle-smart-time-units.test.ts` - Add isometric blocking tests

### Dependencies

- `src/data/exercise_database.json` - Source of truth for `external_load` and `isometric` metadata
- Existing `WorkoutEditor` class methods and patterns

### TypeScript Types

New interfaces in `src/lib/engine/exercise-metadata.ts`:

```typescript
export interface ExerciseMetadata {
  category: string;
  external_load: 'never' | 'sometimes' | 'always';
  isometric: boolean;
  typical_reps?: string;
  difficulty: string;
  muscle_groups: string[];
  equipment: string[];
}
```

All other types already exist in `src/lib/engine/types.ts`.

---

## Implementation Plan

### Phase 1: Create Shared Exercise Metadata Module (2 points)

**Goal**: Create standalone module with exercise metadata lookup and field visibility rules as single source of truth for BOTH generator and editor

**Steps**:
1. Create new file `src/lib/engine/exercise-metadata.ts`
2. Implement singleton cache for performance (avoid repeated JSON traversal)
3. Implement public API functions:
   - `getExerciseMetadata(exerciseName: string): ExerciseMetadata | null`
   - `shouldShowWeightField(exerciseName: string, currentWeight?: any): boolean`
   - `shouldAssignWeightOnGeneration(exerciseName: string): boolean`
   - `canToggleToReps(exerciseName: string): boolean`
   - `canToggleToWorkTime(exerciseName: string): boolean`
   - `getDefaultWorkMode(exerciseName: string): 'reps' | 'work_time'`
4. Handle edge cases:
   - Compound exercise parent names (e.g., "EMOM 10 minutes") - return null
   - Custom user-created exercises not in database - return null (graceful fallback)
   - Cache results to prevent repeated lookups

**Key Implementation Details**:

```typescript
// Singleton cache for performance
class ExerciseMetadataCache {
  private cache = new Map<string, ExerciseMetadata | null>();

  get(exerciseName: string): ExerciseMetadata | null {
    if (this.cache.has(exerciseName)) {
      return this.cache.get(exerciseName)!;
    }

    // Search exercise_database.json
    const metadata = findExerciseInDatabase(exerciseName);
    this.cache.set(exerciseName, metadata);
    return metadata;
  }

  clear(): void {
    this.cache.clear();
  }
}

// Public API
export function getExerciseMetadata(exerciseName: string): ExerciseMetadata | null {
  return metadataCache.get(exerciseName);
}

export function shouldShowWeightField(exerciseName: string, currentWeight?: any): boolean {
  const metadata = getExerciseMetadata(exerciseName);
  if (!metadata) {
    // Fallback for custom exercises: show weight if present in data
    return currentWeight !== undefined;
  }

  switch (metadata.external_load) {
    case 'always':
      return true; // ALWAYS show weight
    case 'never':
      return false; // NEVER show weight
    case 'sometimes':
      return currentWeight !== undefined; // Show if present
  }
}

export function shouldAssignWeightOnGeneration(exerciseName: string): boolean {
  const metadata = getExerciseMetadata(exerciseName);
  if (!metadata) {
    return false; // Custom exercises default to no weight
  }

  return metadata.external_load !== 'never';
}

export function canToggleToReps(exerciseName: string): boolean {
  const metadata = getExerciseMetadata(exerciseName);
  if (!metadata) {
    return true; // Custom exercises can toggle freely
  }

  return !metadata.isometric; // Isometric exercises can't use reps
}

export function canToggleToWorkTime(exerciseName: string): boolean {
  // All exercises can use work_time mode
  return true;
}

export function getDefaultWorkMode(exerciseName: string): 'reps' | 'work_time' {
  const metadata = getExerciseMetadata(exerciseName);
  if (!metadata) {
    return 'reps'; // Default for custom exercises
  }

  return metadata.isometric ? 'work_time' : 'reps';
}
```

**Files**:
- Create: `src/lib/engine/exercise-metadata.ts`

**Testing Requirements**:
- [ ] Unit test: getExerciseMetadata returns correct metadata for known exercises (Bench Press, Push-ups, Plank Hold)
- [ ] Unit test: getExerciseMetadata returns null for unknown exercises
- [ ] Unit test: Caching prevents repeated lookups (same object reference returned on second call)
- [ ] Unit test: shouldShowWeightField() for all external_load cases (always, never, sometimes)
- [ ] Unit test: shouldAssignWeightOnGeneration() matches generator needs
- [ ] Unit test: canToggleToReps() blocks isometric exercises
- [ ] Unit test: canToggleToWorkTime() allows all exercises
- [ ] Unit test: getDefaultWorkMode() returns work_time for isometric, reps otherwise
- [ ] Unit test: Fallback behavior for custom exercises (not in database)

**Commit Message**:
```
feat(engine): create shared exercise metadata module

- Add standalone exercise-metadata.ts module as single source of truth
- Implement singleton cache for performance (O(1) after first lookup)
- Add public API: shouldShowWeightField, shouldAssignWeightOnGeneration
- Add toggle validation: canToggleToReps, canToggleToWorkTime
- Handle custom exercises gracefully (fallback to defaults)
- Core rule: external_load metadata drives field visibility

Testing: 9 unit tests covering lookup, caching, all external_load cases, fallbacks
```

**Agent Invocations**:
```bash
# Implementation
shredly-code-writer: "Implement Phase 1 for ticket #008: Create shared exercise-metadata.ts module with caching and public API"

# Testing
test-writer: "Write comprehensive unit tests for exercise-metadata.ts module from ticket #008 Phase 1"
test-critic: "Review test coverage for metadata caching and all external_load cases"
test-writer: "Implement improvements suggested by test-critic for exercise-metadata tests"

# Code review
code-quality-assessor: "Review src/lib/engine/exercise-metadata.ts for performance and maintainability"
```

---

### Phase 2: Migrate Editor to Use Shared Module (3 points)

**Goal**: Update workout-editor.ts to use shared metadata module instead of workMode-based logic, fixing the critical bug where weight fields disappear

**Steps**:
1. Add import to `src/lib/engine/workout-editor.ts`:
   ```typescript
   import { shouldShowWeightField } from './exercise-metadata.js';
   ```
2. Modify `getAllEditableFields()` method (lines 136-146):
   - REMOVE: `if (workMode === 'reps' && weekParams.weight !== undefined)`
   - ADD: `if (shouldShowWeightField(exercise.name, weekParams.weight))`
3. Update sub-exercise weight visibility (lines 210-221) with same logic
4. Test that weight fields now visible for external_load:always exercises in BOTH modes
5. Verify existing toggle behavior preserves weight data (already working, just visibility fix)

**Benefits**:
- Fixes bug: Weight fields now visible for weighted time-based exercises
- Editor follows SAME rules as generator
- Single source of truth for field visibility
- No code duplication (logic lives in shared module)

**Files**:
- Modify: `src/lib/engine/workout-editor.ts` (getAllEditableFields method)

**Testing Requirements**:
- [ ] Unit test: "Dumbbell Weighted Crunches" shows weight in BOTH reps and work_time modes
- [ ] Unit test: "Plank Hold" (external_load: never) NEVER shows weight
- [ ] Unit test: "Wall Sit" (external_load: sometimes) shows weight only if present
- [ ] Unit test: Custom exercise name (not in DB) shows weight if present (fallback behavior)
- [ ] Unit test: Sub-exercises use their own metadata, not parent's metadata
- [ ] Integration test: Toggle "Dumbbell Weighted Crunches" from reps to work_time, weight field remains visible
- [ ] Integration test: Toggle back to reps, weight field still visible
- [ ] Regression test: All existing workout-editor tests still pass

**Commit Message**:
```
fix(engine): migrate editor to shared metadata module

- Import shouldShowWeightField from exercise-metadata.ts
- Replace workMode-based weight visibility with metadata-driven rules
- Fix bug: weighted time-based exercises now show weight in both modes
- Apply same logic to parent exercises and sub-exercises
- Remove workMode dependency from field visibility logic

Fixes: Weight fields disappearing when toggling to work_time mode
Testing: 8 tests covering all external_load cases, toggle scenarios, regressions
```

**Agent Invocations**:
```bash
# Implementation
shredly-code-writer: "Implement Phase 2 for ticket #008: Migrate editor to use shared metadata module for weight field visibility"

# Testing
test-writer: "Write tests for metadata-driven weight field visibility in editor from ticket #008 Phase 2"
test-critic: "Review test coverage for all external_load cases and toggle scenarios"
test-writer: "Implement test improvements and add missing edge case coverage"

# Code review
code-quality-assessor: "Review workout-editor.ts changes from ticket #008 Phase 2 for correctness and performance"
```

---

### Phase 3: Migrate Generator to Use Shared Module (FUTURE - 2 points)

**Note**: This phase ensures complete consistency but is NOT required to fix the critical bug (Phases 1-2 fix it). Can be implemented separately for full architectural consistency.

**Goal**: Update phase2-parameters.ts to use shared metadata module, eliminating code duplication and ensuring both systems use identical logic

**Steps**:
1. Add import to `src/lib/engine/phase2-parameters.ts`:
   ```typescript
   import { shouldAssignWeightOnGeneration } from './exercise-metadata.js';
   ```
2. REMOVE lines 375-382 (manual database lookup):
   ```typescript
   // OLD CODE - DELETE THIS
   const exerciseData = Object.entries(exerciseDatabase).find(
     ([name, data]) => name === exercise.name
   );
   const exerciseExternalLoad = exerciseData?.[1].external_load;
   ```
3. REPLACE line 110 (weight assignment check):
   ```typescript
   // OLD: const shouldAssignWeight = exerciseExternalLoad !== 'never';
   // NEW:
   const shouldAssignWeight = shouldAssignWeightOnGeneration(exercise.name);
   ```
4. Remove `exerciseExternalLoad` parameter passing (simplify code)
5. Verify all existing generator tests still pass

**Benefits**:
- Both generator and editor use SAME shared module
- Reduced code duplication (removes ~8 lines of manual lookup)
- Easier to add new metadata rules (change once in shared module, applies everywhere)
- Complete architectural consistency
- Simplified codebase (one source of truth)

**Files**:
- Modify: `src/lib/engine/phase2-parameters.ts` (weight assignment logic)

**Testing Requirements**:
- [ ] Verify all existing generator tests still pass (no regression)
- [ ] Unit test: Generator uses shared module for weight assignment
- [ ] Unit test: Generated exercises match external_load metadata rules
- [ ] Integration test: Generated workouts match editor field visibility (end-to-end consistency)
- [ ] Integration test: Weighted time-based exercises generated correctly with weight values

**Commit Message**:
```
refactor(engine): migrate generator to shared metadata module

- Import shouldAssignWeightOnGeneration from exercise-metadata.ts
- Remove manual database lookup code (lines 375-382)
- Replace exerciseExternalLoad check with shared module call
- Simplify code by removing parameter passing
- Ensure generator and editor use identical weight assignment logic

Testing: All existing tests pass + 5 new tests for shared module integration
```

**Agent Invocations**:
```bash
# Implementation
shredly-code-writer: "Implement Phase 3 for ticket #008: Migrate generator to shared metadata module for complete architectural consistency"

# Testing
test-writer: "Write tests verifying generator uses shared module correctly from ticket #008 Phase 3"
test-critic: "Review test coverage for generator-editor consistency"
test-writer: "Implement test improvements"

# Code review
code-quality-assessor: "Review phase2-parameters.ts changes from ticket #008 Phase 3 for consistency and maintainability"
```

---

### Phase 4: Add Isometric Toggle Validation (FUTURE - Optional, 2 points)

**Note**: This is a nice-to-have enhancement that prevents user errors, not critical for bug fix. Can skip if not needed or implement as separate ticket.

**Goal**: Use shared module to block invalid toggles for isometric exercises with clear error messages

**Steps**:
1. Add import to `src/lib/engine/workout-editor.ts`:
   ```typescript
   import { canToggleToReps } from './exercise-metadata.js';
   ```
2. Modify `toggleWorkDefinition()` method:
   - Before toggling from work_time to reps, check `canToggleToReps(exercise.name)`
   - If false (isometric exercise), return error: "Cannot toggle [Exercise Name] to reps mode - isometric exercises must use work_time"
   - Allow toggle from reps to work_time (fixes misconfigurations)
3. Modify `toggleSubExerciseWorkDefinition()` with same validation
4. Test with CLI to verify error message appears

**Benefits**:
- Prevents invalid states (isometric exercises with reps)
- Clear error messages guide users
- Uses shared module for validation rules
- Optional: Can skip if not needed

**Files**:
- Modify: `src/lib/engine/workout-editor.ts` (toggleWorkDefinition, toggleSubExerciseWorkDefinition)

**Testing Requirements**:
- [ ] Unit test: "Plank Hold" (isometric: true) blocks toggle from work_time to reps
- [ ] Unit test: "Plank Hold" allows toggle from reps to work_time (fix misconfiguration)
- [ ] Unit test: "Bench Press" (isometric: false) allows toggle in both directions
- [ ] Unit test: Sub-exercise isometric validation works independently of parent
- [ ] Manual CLI test: Try toggling "Plank Hold" and verify error message displays

**Commit Message**:
```
feat(engine): add isometric exercise toggle validation

- Import canToggleToReps from exercise-metadata.ts
- Block toggle from work_time to reps for isometric exercises
- Show clear error message explaining isometric constraint
- Allow toggle from reps to work_time (fixes misconfigurations)
- Apply validation to both parent and sub-exercises

Testing: 5 tests covering isometric validation + manual CLI verification
```

**Agent Invocations**:
```bash
# Implementation
shredly-code-writer: "Implement Phase 4 for ticket #008: Add isometric toggle validation using shared metadata module"

# Testing
test-writer: "Write tests for isometric toggle validation from ticket #008 Phase 4"
test-critic: "Review test coverage for isometric validation edge cases"
test-writer: "Implement test improvements"

# Code review
code-quality-assessor: "Review toggle validation changes from ticket #008 Phase 4"
```

---

## Testing Strategy

### Unit Tests

**New test file**: `tests/unit/exercise-metadata.test.ts`

Test cases (Phase 1):
- [ ] getExerciseMetadata() returns correct metadata for known exercises (Bench Press, Push-ups, Plank Hold)
- [ ] getExerciseMetadata() returns null for compound parents (EMOM, Circuit names)
- [ ] getExerciseMetadata() returns null for custom exercises not in database
- [ ] Caching: Second call for same exercise returns cached object (same reference)
- [ ] shouldShowWeightField() returns true for external_load:always exercises
- [ ] shouldShowWeightField() returns false for external_load:never exercises
- [ ] shouldShowWeightField() checks currentWeight for external_load:sometimes exercises
- [ ] shouldAssignWeightOnGeneration() returns true for external_load:always/sometimes
- [ ] shouldAssignWeightOnGeneration() returns false for external_load:never
- [ ] canToggleToReps() returns false for isometric:true exercises
- [ ] canToggleToReps() returns true for isometric:false exercises
- [ ] canToggleToWorkTime() always returns true
- [ ] getDefaultWorkMode() returns 'work_time' for isometric exercises
- [ ] getDefaultWorkMode() returns 'reps' for non-isometric exercises
- [ ] Fallback behavior: Custom exercises show weight if present in data

**Modify existing test file**: `tests/unit/workout-editor-work-mode.test.ts`

Test cases (Phase 2):
- [ ] "Dumbbell Weighted Crunches": getAllEditableFields() shows weight in reps mode
- [ ] "Dumbbell Weighted Crunches": getAllEditableFields() shows weight in work_time mode
- [ ] "Dumbbell Weighted Crunches": Toggle reps→work_time, weight field remains visible
- [ ] "Dumbbell Weighted Crunches": Toggle work_time→reps, weight field remains visible
- [ ] "Plank Hold": Weight field NEVER appears in any mode (external_load:never)
- [ ] "Wall Sit" (external_load:sometimes): Weight field appears only if present in data
- [ ] Custom exercise: Weight field shows if present (fallback behavior)
- [ ] Sub-exercises: Use own metadata, not parent's metadata

**New test file**: `tests/unit/workout-editor-toggle-validation.test.ts` (Phase 4)

Test cases:
- [ ] "Plank Hold" (isometric:true): Toggle from work_time to reps blocked with error
- [ ] "Plank Hold": Toggle from reps to work_time allowed (fixes misconfiguration)
- [ ] "Bench Press" (isometric:false): Toggle in both directions allowed
- [ ] Sub-exercise isometric validation independent of parent

### Integration Tests

**Modify existing test file**: `tests/integration/workout-generation.test.ts` (Phase 3)

Test cases:
- [ ] Generator assigns weight to external_load:always exercises (time-based or reps)
- [ ] Generator never assigns weight to external_load:never exercises
- [ ] Generator assigns weight to external_load:sometimes exercises
- [ ] Generated workout has consistent weight fields with editor visibility rules

### Manual Testing

**CLI (Phases 1-2 - Bug Fix)**:
```bash
npm run cli
# Generate workout with "Dumbbell Weighted Crunches" (or manually add it)
# Expected: Exercise generated with work_time AND weight

# Navigate to "Dumbbell Weighted Crunches" exercise in editor
# Press 'e' to edit
# Verify weight field visible in field list

# Press 't' to toggle to work_time mode
# Press 'e' again
# Verify weight field STILL visible in field list (BUG FIXED!)

# Edit weight value (press Enter on weight field)
# Verify field is interactive and accepts changes

# Press 't' again to toggle back to reps
# Verify weight field still visible and preserves edited value
```

**CLI (Phase 3 - Generator Integration)**:
```bash
npm run cli
# Generate multiple workouts with different questionnaire inputs
# Verify weighted time-based exercises have weight values assigned
# Check that external_load:never exercises (Plank Hold) never have weight
# Verify consistency: generator creates what editor can display
```

**CLI (Phase 4 - Isometric Validation)**:
```bash
npm run cli
# Generate workout with "Plank Hold" (or manually add it)
# Navigate to "Plank Hold" exercise
# Try toggling to reps mode with 't' key
# Expected: Error message appears blocking toggle
# Message: "Cannot toggle Plank Hold to reps mode - isometric exercises must use work_time"

# Toggle a non-isometric exercise (Bench Press)
# Expected: Toggle works in both directions without error
```

### Test Acceptance Criteria

- [ ] All unit tests pass (npm run test:unit)
- [ ] All integration tests pass (npm test)
- [ ] TypeScript compilation succeeds (npm run typecheck)
- [ ] No regression in existing workout-editor tests
- [ ] No regression in existing generator tests
- [ ] Manual CLI testing confirms weight fields visible in both modes for external_load:always exercises
- [ ] Code coverage >80% for new exercise-metadata.ts module

---

## Success Criteria

**Phases 1-2 (Bug Fix - MUST COMPLETE)**:
- [ ] Shared exercise-metadata.ts module created with comprehensive public API
- [ ] Weight fields visible for external_load:always exercises in BOTH reps and work_time modes
- [ ] Weight fields never appear for external_load:never exercises
- [ ] Weight fields conditionally appear for external_load:sometimes exercises
- [ ] Toggling "Dumbbell Weighted Crunches" from reps to work_time preserves weight field visibility
- [ ] Editor uses shared module instead of workMode-based logic
- [ ] Custom exercises (not in database) fall back gracefully to "show if present" behavior
- [ ] Metadata lookup is cached for performance (O(1) after first lookup)

**Phase 3 (Generator Consistency - FUTURE)**:
- [ ] Generator uses shared module for weight assignment
- [ ] Code duplication eliminated (~8 lines of manual lookup removed)
- [ ] Both generator and editor use identical weight assignment logic
- [ ] Generated workouts match editor field visibility rules (end-to-end consistency)

**Phase 4 (Isometric Validation - FUTURE/OPTIONAL)**:
- [ ] Isometric exercises block invalid toggle to reps mode with clear error message
- [ ] Toggle validation uses shared module (canToggleToReps)

**General**:
- [ ] Code follows CLAUDE.md standards (TypeScript, ES Modules, fail loudly)
- [ ] Test coverage >80% for new shared module
- [ ] No breaking changes to existing workout editor functionality
- [ ] No regression in existing generator functionality
- [ ] getAllEditableFields() performance does not degrade

---

## Dependencies

### Blocked By
- None (ticket can be implemented immediately)

### Blocks
- None (independent bug fix that becomes foundation for future metadata-driven features)

### External Dependencies
- None (uses existing exercise_database.json)

---

## Risks & Mitigations

### Risk 1: Exercise Database Lookup Performance
- **Impact**: Medium
- **Probability**: Low
- **Mitigation**:
  - Implement singleton cache in Phase 1 to avoid repeated JSON traversal
  - Cache results per exercise name for duration of editor session
  - Measure performance with 10+ exercise workout (should be <1ms per lookup)
  - O(n) on first lookup per exercise, O(1) on subsequent lookups

### Risk 2: Compound Parent Name Handling
- **Impact**: Low
- **Probability**: Medium
- **Mitigation**:
  - getExerciseMetadata() returns null for compound parents (e.g., "EMOM 10 minutes")
  - Fallback behavior: compound parents use current logic (show weight if present)
  - Document that compound parents don't have metadata (expected behavior)
  - Test specifically with compound exercises

### Risk 3: Custom Exercise Names Not in Database
- **Impact**: Low
- **Probability**: Medium (future feature)
- **Mitigation**:
  - getExerciseMetadata() returns null for unknown exercises
  - Fallback to current behavior: show weight if present in data
  - This matches expected behavior for user-created exercises
  - Document fallback behavior in module comments

### Risk 4: Breaking Existing Tests
- **Impact**: High
- **Probability**: Low
- **Mitigation**:
  - Run full test suite after each phase (npm test)
  - Review test output carefully for unexpected failures
  - Keep changes scoped to field visibility logic in Phase 2
  - Phase 3 should not change generator behavior, only implementation
  - Commit after each phase for easy rollback

### Risk 5: Generator-Editor Inconsistency During Partial Implementation
- **Impact**: Medium
- **Probability**: High (during Phases 1-2)
- **Mitigation**:
  - Phases 1-2 fix the critical bug (editor matches what generator creates)
  - Phase 3 is FUTURE enhancement for complete consistency
  - Can ship Phases 1-2 immediately, implement Phase 3 later
  - Both systems will work correctly even if using different implementations temporarily

---

## Notes

### Design Decisions

1. **Shared Module Architecture**:
   - Choice: Create standalone `exercise-metadata.ts` module (not helper inside WorkoutEditor)
   - Rationale: Both generator and editor need same logic; single source of truth prevents drift
   - Strategic benefit: Current bug becomes beachhead for unified architecture
   - Future: Can add more metadata-driven features (difficulty adjustments, equipment substitutions)

2. **Metadata-Driven vs Hardcoded Rules**:
   - Choice: Use exercise database metadata (external_load, isometric)
   - Rationale: Single source of truth, scales to 261 exercises, no hardcoded exercise names
   - Alternative rejected: Hardcode list of weighted exercises (brittle, requires code changes when adding exercises)

3. **Fallback Behavior for Unknown Exercises**:
   - Choice: Show weight if present in data (current behavior)
   - Rationale: Gracefully handles custom user exercises not in database
   - Alternative rejected: Default to "always show weight" (too aggressive, clutters UI)

4. **Phased Implementation Strategy**:
   - Phases 1-2 (5 points): Fix critical bug, editor uses shared module
   - Phase 3 (2 points): Generator uses shared module (FUTURE - full consistency)
   - Phase 4 (2 points): Isometric validation (FUTURE/OPTIONAL - nice-to-have)
   - Rationale: Can ship bug fix immediately (Phases 1-2), implement full consistency later

5. **Singleton Cache Pattern**:
   - Choice: Singleton cache instance in module
   - Rationale: Avoids repeated JSON traversal, O(1) after first lookup
   - Memory impact: Minimal (~8 entries per workout, ~1KB total)
   - Alternative rejected: No caching (O(n) on every field render, poor UX)

### Strategic Benefit

This ticket transforms a simple bug fix into an architectural improvement:
- **Immediate**: Fixes weight field disappearing bug (Phases 1-2)
- **Short-term**: Eliminates code duplication in generator (Phase 3)
- **Long-term**: Foundation for metadata-driven features (difficulty scaling, equipment substitution, progression rules)

Once shared module exists, both generator and editor can evolve together with consistent rules. Future tickets can extend the module with new metadata-driven logic.

### Related Issues from BUGS_WISHES.md

This ticket addresses the architectural issue discovered in codebase analysis:
- Weight fields disappearing when toggling to work_time mode
- Invalid assumption that weight is only relevant for rep-based exercises
- Inconsistency between generator (correct) and editor (buggy) implementations

### Performance Considerations

- Exercise database lookup is O(n) per exercise name without caching (n = 261 exercises)
- With singleton cache: O(1) after first lookup per unique exercise name
- Typical workout has 5-8 exercises, so max ~8 cache entries per workout
- Cache memory footprint: ~1KB for 8 entries
- Cache clears on module reload (no memory leak in hot-reload dev environment)
- Expected performance: <1ms per lookup, unnoticeable to user

---

## Commit Standards Reminder

**MANDATORY**: Follow CLAUDE.md commit message standards:
- Format: `type(scope): description under 50 chars`
- Types: feat, fix, docs, style, refactor, test, chore
- Scopes: cli, engine, questionnaire, profile, schedule, live, workout-gen, exercise-selector, progression, ui, mobile, history, prs, tests
- **NEVER include "🤖 Generated with [Claude Code]" or "Co-Authored-By: Claude"**

Example commits for this ticket:
```
feat(engine): create shared exercise metadata module
fix(engine): migrate editor to shared metadata module
refactor(engine): migrate generator to shared metadata module
feat(engine): add isometric exercise toggle validation
test(engine): add comprehensive exercise metadata tests
```

---

## Definition of Done

**Phases 1-2 (Bug Fix - Ship Immediately)**:
- [ ] Phase 1 implemented and tested (shared metadata module)
- [ ] Phase 2 implemented and tested (editor uses shared module)
- [ ] All unit tests passing (npm run test:unit)
- [ ] All integration tests passing (npm test)
- [ ] TypeScript compilation succeeds (npm run typecheck)
- [ ] Manual CLI testing complete (weight fields visible in both modes)
- [ ] Code reviewed (by code-quality-assessor agent)
- [ ] Success criteria met (bug fixed)
- [ ] Committed with proper commit messages (one per phase)
- [ ] CLAUDE.md "Current Development Status" updated
- [ ] No regressions in existing functionality

**Phases 3-4 (Future Enhancements - Optional)**:
- [ ] Phase 3 implemented and tested (generator uses shared module)
- [ ] Phase 4 implemented and tested (isometric validation)
- [ ] All tests passing (no regressions)
- [ ] Full architectural consistency achieved (generator + editor use shared module)
- [ ] Code reviewed and documented

---

## Key Changes from Original Ticket

1. **Architectural Scope**: Transformed from simple bug fix to shared module creation
2. **Phase 1 Changed**: Was "helper in WorkoutEditor", now "standalone module for BOTH systems"
3. **Phase 3 Added**: Migrate generator to shared module (ensures full consistency)
4. **Phase 4 Renamed**: Was Phase 3, now Phase 4 (isometric validation still optional)
5. **Total Points**: Increased from 5 to 9 points (2+3+2+2)
6. **Ship Strategy**: Phases 1-2 (5 points) fix bug and can ship immediately
7. **Future Work**: Phases 3-4 (4 points) are enhancements for full consistency

**Strategic Win**: Current bug becomes foundation for unified architecture. Both systems can evolve together with consistent metadata-driven rules.
