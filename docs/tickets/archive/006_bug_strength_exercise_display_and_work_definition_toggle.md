# Ticket #006: Bug - Strength Exercise Display and Work Definition Toggle

**Status**: Open
**Priority**: Medium
**Type**: bug
**Estimated Points**: 3
**Phase**: 1-CLI

---

## Summary

Fix incorrect display of strength exercises in schedule view (showing "minutes of work" and "TM" weight when inappropriate) and resolve the non-functional work definition toggle keyboard command.

## Background

The interactive workout editor currently has two display/interaction issues with strength exercises:

1. **Display Issue**: Strength exercises show "minutes of work" and weight as "TM" (Training Max) in all cases, even when the exercise has rep-based parameters or different weight types
2. **Toggle Command Issue**: The 'W' key is configured to toggle between rep-based and work_time-based definitions, but the command doesn't work as expected (potentially conflicts with 'w' for week mode)

### Current State

**File**: `/home/wabbazzar/code/shredly2/cli/cli_hotkeys.json`
- Line 30: `"toggle_work_definition": "W"` (capital W)
- Line 9: `"toggle_week_day_view": "w"` (lowercase w)

**File**: `/home/wabbazzar/code/shredly2/cli/lib/interactive-workout-editor.ts`
- Lines 163-169: Handles both 'd'/'D' and 'w'/'W' for view mode toggling
- Line 192: Calls `this.toggleWorkDefinition()` on hotkey 'W'
- Lines 759-772: Implements `toggleWorkDefinition()` method (calls workout-editor.ts)

**File**: `/home/wabbazzar/code/shredly2/src/lib/engine/workout-editor.ts`
- Lines 665-744: `toggleWorkDefinition()` implementation that swaps reps <-> work_time_minutes

**File**: `/home/wabbazzar/code/shredly2/cli/lib/workout-formatter.ts`
- Lines 533-599: `formatWeekProgressionInteractive()` - displays week-by-week progression
- Lines 443-528: `formatCompoundParentSets()` - displays parent compound exercise parameters
- Lines 605-707: `formatSubExercisesInteractive()` - displays sub-exercise parameters

### Root Cause Analysis

1. **Toggle Command**: The issue is likely that 'W' (capital W) conflicts with 'w' (lowercase w) in the key handling code at lines 163-169 of interactive-workout-editor.ts. The code checks `str === 'w' || str === 'W'` for week view, which captures the capital W before it reaches the toggle action check at line 192.

2. **Display Issue**: The formatter is correctly displaying all available fields in the workout data structure, but the generation engine may be populating inappropriate fields (both reps AND work_time, or using TM weight type for non-strength exercises).

## Technical Requirements

### Data Structures

Reference WORKOUT_SPEC.md:
- Strength exercises should use: `sets`, `reps`, `rest_time_minutes`, `rest_time_unit`, `weight` (optional)
- Time-based exercises should use: `work_time_minutes`, `work_time_unit`, `sets` (optional)
- **CRITICAL**: Reps and work_time are MUTUALLY EXCLUSIVE per the spec

Weight types from WORKOUT_SPEC.md:
- String descriptors: "light", "moderate", "moderate_heavy", "heavy", "max"
- Percentage of TM: `{type: "percent_tm", value: 70}`
- Percentage of BW: `{type: "percent_bw", value: 100}`
- Absolute: `{type: "absolute", value: 135, unit: "lbs"}`

### Code Locations

**Files to modify**:
- `/home/wabbazzar/code/shredly2/cli/lib/interactive-workout-editor.ts` - Fix key handling order
- `/home/wabbazzar/code/shredly2/cli/cli_hotkeys.json` - Reassign toggle key to avoid conflict
- `/home/wabbazzar/code/shredly2/cli/lib/workout-formatter.ts` - Add intelligent filtering of displayed fields

**Files to investigate**:
- `/home/wabbazzar/code/shredly2/src/lib/engine/parameter-assignment.ts` - Check if mutually exclusive constraint is enforced

### TypeScript Types

No new types needed. Existing types in `/home/wabbazzar/code/shredly2/src/lib/engine/types.ts`:

```typescript
export interface WeekParameters {
  sets?: number;
  reps?: number | string;
  rest_time_minutes?: number;
  rest_time_unit?: 'seconds' | 'minutes';
  work_time_minutes?: number;
  work_time_unit?: 'seconds' | 'minutes';
  weight?: WeightSpecification;
  tempo?: string;
  // ... other fields
}
```

## Implementation Plan

### Phase 1: Fix Keyboard Command Conflict (2 points)

**Goal**: Resolve the 'W' key conflict so toggle_work_definition functions correctly

**Steps**:
1. Review key handling order in `interactive-workout-editor.ts` lines 163-169
2. Identify why capital 'W' is captured by week view toggle
3. Choose a new non-conflicting key for toggle_work_definition (suggestions: 't', 'm', 'x', '/')
4. Update `cli_hotkeys.json` with new key assignment
5. Update help text in `renderHelp()` method (line 948 in interactive-workout-editor.ts)
6. Test toggle functionality manually with generated workouts

**Files**:
- Modify: `/home/wabbazzar/code/shredly2/cli/cli_hotkeys.json` (line 30)
- Modify: `/home/wabbazzar/code/shredly2/cli/lib/interactive-workout-editor.ts` (line 948)
- Investigate: Lines 163-169 for key handling order

**Testing**:
- [ ] Generate workout with strength exercises (rep-based)
- [ ] Press new toggle key, verify conversion to work_time-based
- [ ] Press toggle key again, verify conversion back to rep-based
- [ ] Verify 'w'/'W' still switches to week view correctly
- [ ] Verify undo ('u') reverses the toggle

**Commit Message**:
```
fix(cli): resolve work definition toggle key conflict

- Change toggle_work_definition hotkey from 'W' to 't' to avoid conflict with week view
- Update help text to reflect new keybinding
- Fixes issue where 'W' was captured by week/day view toggle before reaching action handler
```

**Recommended Key**: 't' (for "toggle") since 't'/'T' are already used for field navigation but in a different context

### Phase 2: Intelligent Display Filtering (1 point)

**Goal**: Display only relevant fields based on exercise work definition mode

**Steps**:
1. Add helper function `determineWorkMode(weekParams)` that returns 'reps' | 'work_time' | 'both' | 'none'
2. Update `formatWeekProgressionInteractive()` to conditionally display fields:
   - If mode is 'reps': Show sets, reps, weight, rest
   - If mode is 'work_time': Show work_time (with unit), rest (optional)
   - If mode is 'both': Show warning or all fields with clear labels
3. Apply same logic to `formatCompoundParentSets()` and `formatSubExercisesInteractive()`
4. Handle weight display: Only show "TM" for percent_tm type, show descriptors as-is

**Files**:
- Modify: `/home/wabbazzar/code/shredly2/cli/lib/workout-formatter.ts` (lines 533-707)

**Testing**:
- [ ] View strength exercise with reps - should show sets, reps, weight, rest
- [ ] View mobility exercise with work_time - should show work time, NO reps
- [ ] View EMOM parent - should show work_time, NOT sets/reps
- [ ] View sub-exercises in EMOM - should show reps, weight (no work_time)
- [ ] Verify weight displays correctly: "moderate" not "TM", "70% TM" for percent_tm

**Commit Message**:
```
fix(cli): display only relevant fields based on work definition mode

- Add intelligent field filtering to show reps OR work_time (not both)
- Only display TM notation for percent_tm weight type
- Improve clarity for time-based vs rep-based exercises
```

---

## Testing Strategy

### Unit Tests

No unit tests required - this is CLI display/interaction logic

### Integration Tests

No automated integration tests - manual testing sufficient

### Manual Testing

**CLI Testing**:
```bash
# 1. Generate a workout with strength exercises
npm run cli
# Follow questionnaire prompts, select intermediate strength program

# 2. Open workout editor
cd cli && npx tsx edit-workout.ts ../tmp/generated_workout.json

# 3. Test toggle functionality
# - Navigate to a strength exercise (press 't' to jump to fields)
# - Verify exercise shows: "4 sets x 5 reps @ moderate, 90 seconds rest"
# - Press new toggle key (e.g., 't')
# - Verify exercise now shows: "30 seconds work, 90 seconds rest" (or similar)
# - Press 'u' to undo, verify it reverts
# - Press toggle key again, verify it switches back to work_time mode

# 4. Test display filtering
# - View strength exercise - should show reps, NOT work time
# - Press 'd' to switch to day view, navigate to mobility exercise
# - Verify mobility shows work_time, NOT reps
# - Navigate to EMOM compound exercise
# - Verify parent shows work_time (e.g., "10 minutes")
# - Verify sub-exercises show reps (e.g., "8 reps")

# 5. Test weight display
# - Navigate to exercise with string weight (e.g., "moderate")
# - Verify it displays as "moderate", NOT "moderate TM"
# - Navigate to exercise with percent_tm weight
# - Verify it displays as "70% TM" (with TM notation)
```

### Test Acceptance Criteria

- [ ] New toggle key does not conflict with existing commands
- [ ] Toggle switches between reps and work_time successfully
- [ ] Undo reverses toggle operation
- [ ] Strength exercises display sets/reps/weight/rest (no work_time)
- [ ] Time-based exercises display work_time (no reps)
- [ ] Compound exercises display parent work_time, sub-exercise reps
- [ ] Weight displays correct notation (TM only for percent_tm type)

---

## Success Criteria

- [ ] Work definition toggle command functions correctly with no key conflicts
- [ ] Help text accurately reflects new keybinding
- [ ] Strength exercises display rep-based parameters only (no work_time shown)
- [ ] Time-based exercises display work_time parameters only (no reps shown)
- [ ] Weight field shows appropriate notation (TM vs string descriptors)
- [ ] Toggle operation is fully reversible with undo
- [ ] Manual testing checklist complete

---

## Dependencies

### Blocked By
- None

### Blocks
- None (cosmetic/UX improvement)

### External Dependencies
- None (uses existing CLI infrastructure)

---

## Risks & Mitigations

### Risk 1: Key Conflict with Other Commands
- **Impact**: Medium
- **Probability**: Low (after choosing new key)
- **Mitigation**: Review all existing hotkeys in cli_hotkeys.json before assigning new key. Test all existing commands after change to ensure no regressions.

### Risk 2: Breaking Existing Workout Display
- **Impact**: Medium
- **Probability**: Low
- **Mitigation**: Use conditional logic (if field exists, show it) rather than removal. Test with multiple workout types (strength, cardio, EMOM, circuit).

### Risk 3: Mutually Exclusive Constraint Violation
- **Impact**: High
- **Probability**: Medium (may already exist in generated workouts)
- **Mitigation**: If Phase 2 reveals workouts with BOTH reps AND work_time, create follow-up ticket to fix parameter-assignment.ts generation logic. For this ticket, display both with a warning indicator.

---

## Notes

### Investigation Needed

Before Phase 1 implementation, investigate:
1. Why does lines 163-169 capture capital 'W' before line 192 action check?
2. Are there existing workouts in `tmp/` with both reps AND work_time defined?
3. What percentage of exercises use percent_tm vs string weight descriptors?

### Recommended New Hotkey

**Option 1: 'm' (for "mode")** - Clear semantic meaning, not currently used
**Option 2: 'x' (for "exchange/swap")** - Visual mnemonic for switching
**Option 3: 'Enter' (when on reps/work_time field)** - Context-aware toggle

**Preferred**: 'm' - clear, memorable, no conflicts

### Future Enhancements (Out of Scope)

- Add visual indicator (icon/badge) showing current mode (reps vs work_time)
- Add ability to toggle individual weeks (not just all weeks at once)
- Add validation warning when both reps AND work_time exist

---

## Commit Standards Reminder

**MANDATORY**: Follow CLAUDE.md commit message standards:
- Format: `type(scope): description under 50 chars`
- Types: feat, fix, docs, style, refactor, test, chore
- Scopes: cli, engine, questionnaire, profile, schedule, live, workout-gen, exercise-selector, progression, ui, mobile, history, prs, tests
- **NEVER include "Generated with [Claude Code]" or "Co-Authored-By: Claude"**

---

## Definition of Done

- [ ] Phase 1 implemented and tested
- [ ] Phase 2 implemented and tested
- [ ] All manual tests passing
- [ ] Help text updated
- [ ] Commits follow CLAUDE.md standards
- [ ] No regressions in existing commands
- [ ] CLAUDE.md "Current Development Status" updated if needed
