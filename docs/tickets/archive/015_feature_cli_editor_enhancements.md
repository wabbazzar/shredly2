# Ticket #015: Feature - CLI Editor Enhancements

**Status**: Open
**Priority**: Medium
**Type**: feature
**Estimated Points**: 8 (across 4 phases)
**Phase**: 1-CLI

---

## Summary

Enhance the CLI interactive workout editor with four improvements: add 'n' hotkey for interval blocks, show compound block information with 'i' key, add 'd' hotkey to detach exercises from compound blocks, and add push/pull/legs category filters in the exercise database modal.

## Background

The CLI workout editor currently has some gaps in functionality that limit user productivity:

1. **Inconsistent hotkeys**: The compound block type hotkeys are 'e'/'a'/'c' for EMOM/AMRAP/Circuit, but 'i' is missing for Interval (currently 'i' shows exercise info, which conflicts)
2. **No compound block info**: Users can see exercise info for regular exercises, but not for compound block types (EMOM/AMRAP/Circuit/Interval) - they have no way to learn what each block type means
3. **Sub-exercise lock-in**: Once exercises are in a compound block, they cannot be extracted as standalone exercises without deleting and re-adding
4. **Limited filtering**: The exercise database browser only has category filters (strength/cardio/etc) but lacks movement pattern filters (push/pull/legs) which would be useful for finding exercises that fit a day's focus

---

## Technical Requirements

### Data Structures

**workout_generation_rules.json already contains compound type definitions:**
- `compound_exercise_construction.circuit`: Contains `description` field
- `compound_exercise_construction.emom`: Contains `description` field
- `compound_exercise_construction.amrap`: Contains `description` field
- `compound_exercise_construction.interval`: Contains `description` field

**Exercise database (exercise_database.json):**
- Currently has no `movement_pattern` field
- Movement pattern can be derived from muscle groups using the existing `split_muscle_group_mapping` config

### Code Locations

**Files to modify:**
- `cli/lib/interactive-workout-editor.ts` (lines 266-290, 1474-1562 for hotkey and info logic)
- `cli/lib/exercise-db-browser.ts` (lines 15-35 for interfaces, 75-99 for filter options, 138-175 for filter rendering)
- `cli/cli_hotkeys.json` (lines 36-48 for compound block actions)
- `src/lib/engine/workout-editor.ts` (add new `detachSubExercise` method)

**Files to reference:**
- `src/data/workout_generation_rules.json` (compound block descriptions)
- `src/data/exercise_database.json` (exercise data)

### TypeScript Types

```typescript
// Movement pattern derived from muscle groups
type MovementPattern = 'push' | 'pull' | 'legs' | 'core' | 'full_body';

// Extended filter state for exercise browser
interface FilterState {
  categories: Set<string>;
  muscleGroups: Set<string>;
  equipment: Set<string>;
  difficulty: Set<string>;
  movementPatterns: Set<MovementPattern>;  // NEW
}

// Compound block info structure
interface CompoundBlockInfo {
  type: 'emom' | 'amrap' | 'circuit' | 'interval';
  description: string;
  baseConstituentExercises: number;
  excludeEquipment: string[];
  exclusionReason: string;
}
```

---

## Implementation Plan

### Phase 1: Add 'n' Hotkey for Interval Blocks (2 points)

**Goal**: Make the interval block type hotkey consistent with other compound block types by adding 'n' for iNterval (since 'i' is already used for info).

**Steps**:
1. Update `cli/cli_hotkeys.json` to add `"set_block_type_interval_alt": "n"` in view_mode.actions
2. In `cli/lib/interactive-workout-editor.ts`, modify the compound block type handler (around line 267) to handle 'n' as an alias for interval
3. Update the help screen (renderHelp method around line 1567) to document 'n' for interval
4. Update the compound block notes in cli_hotkeys.json

**Files**:
- Modify: `cli/cli_hotkeys.json` (add `set_block_type_interval_alt` key)
- Modify: `cli/lib/interactive-workout-editor.ts` (handleViewModeKey method, renderHelp method)

**Testing**:
- [ ] Unit test: 'n' key on compound block parent changes type to interval
- [ ] Manual test: Create compound block, press 'n', verify changes to interval
- [ ] Verify 'i' still works for interval when on compound block parent

**Commit Message**:
```
feat(cli): add 'n' hotkey for interval block type

- Add 'n' as alternative hotkey for interval blocks
- Avoids conflict with 'i' for exercise info
- Update help screen with new hotkey
```

**Agent Invocations**:
```bash
# Use shredly-code-writer for implementation
# Invoke: shredly-code-writer agent with "Implement Phase 1 for ticket #015 - add 'n' hotkey for interval blocks"

# Use test-writer for test creation
# Invoke: test-writer agent with "Write tests for 'n' hotkey interval block type from ticket #015"

# Use code-quality-assessor after implementation
# Invoke: code-quality-assessor agent with "Review cli/lib/interactive-workout-editor.ts changes from ticket #015 Phase 1"
```

---

### Phase 2: Show Compound Block Information with 'i' Key (2 points)

**Goal**: When 'i' is pressed on a compound block parent (EMOM/AMRAP/Circuit/Interval), display information about that block type instead of trying to show exercise info.

**Steps**:
1. Create new function `showCompoundBlockInfo(blockType: string)` in interactive-workout-editor.ts
2. Read compound block descriptions from workout_generation_rules.json
3. In `showExerciseInfo()` method (around line 1475), detect if current exercise is a compound parent
4. If compound parent, call `showCompoundBlockInfo()` instead of looking up exercise descriptions
5. Display: block type name, description, constituent exercise count, excluded equipment and reason

**Files**:
- Modify: `cli/lib/interactive-workout-editor.ts` (add showCompoundBlockInfo method, modify showExerciseInfo)
- Reference: `src/data/workout_generation_rules.json` (import compound_exercise_construction)

**Testing**:
- [ ] Unit test: 'i' on EMOM block shows EMOM description
- [ ] Unit test: 'i' on regular exercise still shows exercise description
- [ ] Manual test: Create each block type, press 'i', verify correct info displayed

**Commit Message**:
```
feat(cli): show compound block info with 'i' key

- Display EMOM/AMRAP/Circuit/Interval descriptions from config
- Shows constituent count and equipment exclusions
- Regular exercises still show exercise descriptions
```

**Agent Invocations**:
```bash
# Use shredly-code-writer for implementation
# Invoke: shredly-code-writer agent with "Implement Phase 2 for ticket #015 - compound block info display"

# Use test-writer for test creation
# Invoke: test-writer agent with "Write tests for compound block info display from ticket #015"

# Use code-quality-assessor after implementation
# Invoke: code-quality-assessor agent with "Review showCompoundBlockInfo implementation from ticket #015 Phase 2"
```

---

### Phase 3: Add 'd' Hotkey to Detach Sub-Exercises (2 points)

**Goal**: Allow users to pop a sub-exercise out of a compound block and place it as a standalone exercise directly beneath the block.

**Steps**:
1. Add `"detach_sub_exercise": "d"` to cli_hotkeys.json view_mode.actions
2. Add `detachSubExercise(dayKey, exerciseIndex, subExerciseIndex)` method to `src/lib/engine/workout-editor.ts`
3. Method should:
   - Get the sub-exercise from the compound block
   - Remove it from sub_exercises array
   - Create a new standalone exercise with the same name
   - Apply smart defaults based on experience level
   - Insert it at position (exerciseIndex + 1)
   - Add to undo stack
4. In interactive-workout-editor.ts handleViewModeKey, add handler for 'd' key
5. Update help screen with new 'd' detach hotkey

**Files**:
- Create/Modify: `src/lib/engine/workout-editor.ts` (add detachSubExercise method)
- Modify: `cli/lib/interactive-workout-editor.ts` (handleViewModeKey, renderHelp)
- Modify: `cli/cli_hotkeys.json` (add detach_sub_exercise action)

**Testing**:
- [ ] Unit test: detachSubExercise removes from compound and inserts standalone
- [ ] Unit test: detached exercise has correct progression/intensity defaults
- [ ] Unit test: undo restores sub-exercise to compound block
- [ ] Manual test: Create compound with 3 exercises, detach middle one, verify structure

**Commit Message**:
```
feat(cli): add 'd' hotkey to detach sub-exercises

- Detach sub-exercises from compound blocks as standalone
- Preserves exercise settings with smart defaults applied
- Full undo support for detach operation
```

**Agent Invocations**:
```bash
# Use shredly-code-writer for implementation
# Invoke: shredly-code-writer agent with "Implement Phase 3 for ticket #015 - detach sub-exercise feature"

# Use test-writer for test creation
# Invoke: test-writer agent with "Write tests for detachSubExercise from ticket #015"

# Use code-quality-assessor after implementation
# Invoke: code-quality-assessor agent with "Review detachSubExercise implementation from ticket #015 Phase 3"
```

---

### Phase 4: Add Push/Pull/Legs Filters in Exercise Browser (2 points)

**Goal**: Add movement pattern filters (push/pull/legs) to the exercise database modal alongside existing category filters.

**Steps**:
1. Create `deriveMovementPattern(exercise: ExerciseData): MovementPattern` function using muscle group mapping from workout_generation_rules.json
2. Update FilterState interface to include `movementPatterns: Set<MovementPattern>`
3. Update getFilterOptions to include movement patterns derived from all exercises
4. Add 'p' hotkey for filter-movement mode in exercise-db-browser.ts
5. Update filterExercises to apply movement pattern filter
6. Update renderFilters to show active movement pattern filters
7. Update mode indicator and help text

**Movement Pattern Derivation Logic**:
```typescript
// Use split_muscle_group_mapping from workout_generation_rules.json
const pushMuscles = ['Chest', 'Shoulders', 'Triceps', 'Front Delts', 'Side Delts'];
const pullMuscles = ['Back', 'Biceps', 'Lats', 'Rhomboids', 'Traps', 'Rear Delts'];
const legsMuscles = ['Quadriceps', 'Hamstrings', 'Glutes', 'Calves', 'Adductors'];
const coreMuscles = ['Core', 'Abs', 'Obliques'];

function deriveMovementPattern(exercise: ExerciseData): MovementPattern {
  const muscles = exercise.muscle_groups;
  const hasPush = muscles.some(m => pushMuscles.includes(m));
  const hasPull = muscles.some(m => pullMuscles.includes(m));
  const hasLegs = muscles.some(m => legsMuscles.includes(m));
  const hasCore = muscles.some(m => coreMuscles.includes(m));

  if (muscles.includes('Full Body')) return 'full_body';
  if (hasLegs && !hasPush && !hasPull) return 'legs';
  if (hasPush && !hasPull && !hasLegs) return 'push';
  if (hasPull && !hasPush && !hasLegs) return 'pull';
  if (hasCore && !hasPush && !hasPull && !hasLegs) return 'core';
  return 'full_body'; // Default for mixed
}
```

**Files**:
- Modify: `cli/lib/exercise-db-browser.ts` (FilterState interface, getFilterOptions, filterExercises, handleNormalMode, handleFilterMode, renderModeIndicator)

**Testing**:
- [ ] Unit test: deriveMovementPattern correctly classifies exercises
- [ ] Unit test: movement pattern filter reduces exercise list correctly
- [ ] Manual test: Filter by 'push', verify only push exercises shown
- [ ] Manual test: Combine category + movement pattern filters

**Commit Message**:
```
feat(cli): add push/pull/legs filters in exercise browser

- Derive movement pattern from muscle groups
- Add 'p' hotkey to enter movement pattern filter mode
- Filter by push/pull/legs/core/full_body patterns
```

**Agent Invocations**:
```bash
# Use shredly-code-writer for implementation
# Invoke: shredly-code-writer agent with "Implement Phase 4 for ticket #015 - movement pattern filters"

# Use test-writer for test creation
# Invoke: test-writer agent with "Write tests for movement pattern filtering from ticket #015"

# Use code-quality-assessor after implementation
# Invoke: code-quality-assessor agent with "Review exercise-db-browser.ts changes from ticket #015 Phase 4"
```

---

## Testing Strategy

### Unit Tests (Vitest)

- [ ] Test 'n' hotkey triggers interval block type change in tests/unit/workout-editor.test.ts
- [ ] Test showCompoundBlockInfo returns correct info for each block type
- [ ] Test detachSubExercise correctly modifies workout structure
- [ ] Test detachSubExercise undo restores original state
- [ ] Test deriveMovementPattern classifies exercises correctly
- [ ] Test filterExercises respects movement pattern filter
- [ ] Run: `npm run test:unit`

### Integration Tests (Vitest)

- [ ] Test full editor flow: create compound block, change type with 'n', detach sub-exercise
- [ ] Test exercise browser: apply multiple filters including movement pattern
- [ ] Run: `npm run test:integration`

### Manual Testing

**CLI**:
```bash
npm run cli
# Load a workout file
# Test Phase 1: Navigate to compound block, press 'n', verify interval type
# Test Phase 2: Press 'i' on compound block parent, verify block info shown
# Test Phase 3: Navigate to sub-exercise, press 'd', verify detachment
# Test Phase 4: Press 'e' to open browser, press 'p', filter by push/pull/legs
```

### Test Acceptance Criteria

- [ ] All unit tests pass (`npm run test:unit`)
- [ ] All integration tests pass (`npm run test:integration`)
- [ ] All tests pass together (`npm test`)
- [ ] TypeScript compilation succeeds (`npm run typecheck`)
- [ ] Build succeeds (`npm run build`)
- [ ] Manual testing checklist complete

---

## Success Criteria

- [ ] 'n' key on compound block parent changes type to interval
- [ ] 'i' key on compound block parent shows block type description from config
- [ ] 'd' key on sub-exercise detaches it as standalone exercise below the block
- [ ] Exercise browser has 'p' hotkey for push/pull/legs filter mode
- [ ] All hotkeys documented in help screen (?/h)
- [ ] All operations support undo where applicable
- [ ] Code follows CLAUDE.md standards
- [ ] TypeScript types are properly defined
- [ ] Tests provide >80% coverage of new code

---

## Dependencies

### Blocked By
- None

### Blocks
- None (these are quality-of-life improvements)

### External Dependencies
- None

---

## Risks & Mitigations

### Risk 1: Hotkey Conflicts
- **Impact**: Medium
- **Probability**: Low
- **Mitigation**: 'n' for interval avoids 'i' conflict; 'd' is unused; 'p' is unused in browser

### Risk 2: Movement Pattern Derivation Accuracy
- **Impact**: Low
- **Probability**: Medium
- **Mitigation**: Use config-driven muscle group mappings for consistency; 'full_body' as safe fallback for mixed exercises

### Risk 3: Detach Operation Complexity
- **Impact**: Medium
- **Probability**: Low
- **Mitigation**: Reuse existing insertExercise logic; comprehensive undo support; validate compound block remains valid after detach

---

## Notes

**Hotkey Design Decisions**:
- 'n' for iNterval (since 'i' is taken by info) - follows mnemonic pattern
- 'd' for detach - intuitive action name
- 'p' for pattern - distinct from 'm' (muscles), 'c' (categories), 'e' (equipment)

**Movement Pattern Categories**:
The five movement patterns (push/pull/legs/core/full_body) align with common training split terminology and provide intuitive filtering for users familiar with PPL or Upper/Lower splits.

**Compound Block Info Source**:
Using workout_generation_rules.json ensures the displayed info matches the actual generation behavior, maintaining a single source of truth.

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
- [ ] All tests passing
- [ ] TypeScript compilation succeeds
- [ ] Code reviewed (by code-quality-assessor agent)
- [ ] Success criteria met
- [ ] Help screen updated with all new hotkeys
- [ ] Committed with proper commit messages
- [ ] CLAUDE.md "Current Development Status" updated
