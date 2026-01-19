# Ticket #026: Fix - History Lookup Resilient to Start Date Changes

**Status**: Open
**Priority**: High
**Type**: fix
**Estimated Points**: 5 (fibonacci scale)
**Phase**: 3-History

---

## Summary

Fix exercise history lookup functions to use date-based filtering instead of week/day-based filtering, making history retrieval resilient to workout program start date changes.

## Background

When a user changes their workout program's start date (via the Schedule tab), historical exercise data becomes orphaned and inaccessible. This happens because:

1. **At log time**: History stores `week_number` and `day_number` calculated from the startDate at that moment
2. **At query time**: History queries filter by `week_number` and `day_number` calculated from the current startDate
3. **After startDate change**: The calculations no longer match, so previously logged data is not found

**Example Scenario**:
- User starts program on Monday Jan 6 (Week 1, Day 1)
- User logs a workout for Day 1 with `week_number=1, day_number=1`
- User changes start date to Monday Jan 13
- When viewing Live tab on Jan 6, `getTodaysHistoryForWorkout()` calculates `week_number=0` (before start) or different values
- Previously logged data for Jan 6 is orphaned because week/day filters don't match

**Impact**: Users who adjust their start date lose access to their workout history for session recovery and review mode. This is a data visibility bug, not a data loss bug (the data still exists in localStorage).

---

## Technical Requirements

### Current Implementation (Broken)

```typescript
// src/lib/stores/history.ts - getTodaysHistoryForWorkout()
const todaysRows = history.filter(
  r => r.date === today &&
    r.workout_program_id === workoutProgramId &&
    r.week_number === weekNumber &&      // BREAKS if startDate changed
    r.day_number === dayNumber
);
```

### Target Implementation (Fixed)

```typescript
// src/lib/stores/history.ts - getTodaysHistoryForWorkout()
const todaysRows = history.filter(
  r => r.date === today &&
    r.workout_program_id === workoutProgramId
  // week_number and day_number NOT used for filtering
  // They are still stored for analytics/reporting purposes
);
```

### Scope of Changes

| Function | Change |
|----------|--------|
| `getTodaysHistoryForWorkout()` | Remove `week_number` and `day_number` filter parameters from signature and filter logic |
| `hasLoggedTodaysWorkout()` | Remove `week_number` and `day_number` parameters, update to use simplified `getTodaysHistoryForWorkout()` |
| `getWeekPerformance()` | **NO CHANGE** - Keep using week_number filter (progression tracking needs week context) |
| `logSessionToHistory()` | **NO CHANGE** - Continue storing week_number/day_number (useful for analytics) |
| Callers in `live/+page.svelte` | Update call signatures |

### Data Structure Compliance

Per EXERCISE_HISTORY_SPEC.md:
- `week_number` and `day_number` remain **required fields** when logging
- They serve future analytics/reporting use cases
- They are simply not used for session recovery/today's history lookups

### TypeScript Types

No new types required. Function signatures change:

```typescript
// BEFORE
export function getTodaysHistoryForWorkout(
  workoutProgramId: string,
  weekNumber: number,
  dayNumber: number
): HistoryRow[] | null;

export function hasLoggedTodaysWorkout(
  workoutProgramId: string,
  weekNumber: number,
  dayNumber: number
): boolean;

// AFTER
export function getTodaysHistoryForWorkout(
  workoutProgramId: string
): HistoryRow[] | null;

export function hasLoggedTodaysWorkout(
  workoutProgramId: string
): boolean;
```

---

## Implementation Plan

### Phase 1: Update history.ts Functions (3 points)

**Goal**: Simplify `getTodaysHistoryForWorkout()` and `hasLoggedTodaysWorkout()` to use date+program_id only.

**Steps**:
1. Update `getTodaysHistoryForWorkout()`:
   - Remove `weekNumber` and `dayNumber` parameters from function signature
   - Remove week_number and day_number from filter condition
   - Keep date and workout_program_id filters
   - Keep deduplication logic unchanged
2. Update `hasLoggedTodaysWorkout()`:
   - Remove `weekNumber` and `dayNumber` parameters from function signature
   - Update call to `getTodaysHistoryForWorkout()` to match new signature

**Files**:
- Modify: `/home/wabbazzar/code/shredly2/src/lib/stores/history.ts` (lines 554-595)

**Code Changes**:

```typescript
// getTodaysHistoryForWorkout - BEFORE (lines 554-583)
export function getTodaysHistoryForWorkout(
  workoutProgramId: string,
  weekNumber: number,
  dayNumber: number
): HistoryRow[] | null {
  const today = new Date().toISOString().split('T')[0];
  const history = get(exerciseHistory);

  const todaysRows = history.filter(
    r => r.date === today &&
      r.workout_program_id === workoutProgramId &&
      r.week_number === weekNumber &&
      r.day_number === dayNumber
  );
  // ... deduplication logic
}

// getTodaysHistoryForWorkout - AFTER
export function getTodaysHistoryForWorkout(
  workoutProgramId: string
): HistoryRow[] | null {
  const today = new Date().toISOString().split('T')[0];
  const history = get(exerciseHistory);

  // Query by date + program_id only - resilient to start date changes
  // week_number and day_number are still stored but not used for filtering
  const todaysRows = history.filter(
    r => r.date === today &&
      r.workout_program_id === workoutProgramId
  );
  // ... deduplication logic unchanged
}

// hasLoggedTodaysWorkout - BEFORE (lines 588-595)
export function hasLoggedTodaysWorkout(
  workoutProgramId: string,
  weekNumber: number,
  dayNumber: number
): boolean {
  const rows = getTodaysHistoryForWorkout(workoutProgramId, weekNumber, dayNumber);
  return rows !== null && rows.length > 0;
}

// hasLoggedTodaysWorkout - AFTER
export function hasLoggedTodaysWorkout(
  workoutProgramId: string
): boolean {
  const rows = getTodaysHistoryForWorkout(workoutProgramId);
  return rows !== null && rows.length > 0;
}
```

**Testing**:
- [ ] Unit tests for new function signatures
- [ ] Test that date + program_id filtering works correctly
- [ ] Test that old data (with different week/day) is now found
- [ ] Verify deduplication still works

**Commit Message**:
```
fix(history): make history lookup resilient to start date changes

- Remove week_number/day_number params from getTodaysHistoryForWorkout()
- Remove week_number/day_number params from hasLoggedTodaysWorkout()
- Query by date + workout_program_id only
- week_number/day_number still stored for analytics, just not filtered
- Fixes bug where start date changes orphaned historical data
```

**Agent Invocations**:
```bash
# Use shredly-code-writer for implementation
# Invoke: shredly-code-writer agent with "Implement Phase 1 for ticket #026"

# Use test-writer for test creation
# Invoke: test-writer agent with "Write tests for updated history lookup functions from ticket #026 Phase 1"

# Use code-quality-assessor after implementation
# Invoke: code-quality-assessor agent with "Review history.ts changes from ticket #026 Phase 1"
```

---

### Phase 2: Update live/+page.svelte Callers (2 points)

**Goal**: Update all call sites in live/+page.svelte to use the new simplified function signatures.

**Steps**:
1. Find `getTodaysHistoryForWorkout()` call in onMount (line ~110)
2. Remove `weekNumber` and `dayNumber` arguments
3. Verify the logic still works with the new return value

**Files**:
- Modify: `/home/wabbazzar/code/shredly2/src/routes/live/+page.svelte` (line 110)

**Code Changes**:

```svelte
<!-- BEFORE (line 110) -->
const historyRows = getTodaysHistoryForWorkout(
  $activeSchedule.id,
  todaysWorkout.weekNumber,
  todaysWorkout.dayNumber
);

<!-- AFTER -->
const historyRows = getTodaysHistoryForWorkout(
  $activeSchedule.id
);
```

**Testing**:
- [ ] Manual test: Create schedule, log workout, change start date, verify history still appears
- [ ] Manual test: Live tab shows "Previous Workout" review mode correctly
- [ ] Manual test: Session recovery works after start date change

**Commit Message**:
```
fix(live): update history lookup calls to new signature

- Remove week_number/day_number args from getTodaysHistoryForWorkout call
- History lookup now resilient to start date changes
```

**Agent Invocations**:
```bash
# Use shredly-code-writer for implementation
# Invoke: shredly-code-writer agent with "Implement Phase 2 for ticket #026"

# Use code-quality-assessor after implementation
# Invoke: code-quality-assessor agent with "Review live/+page.svelte changes from ticket #026 Phase 2"
```

---

## Testing Strategy

### Unit Tests (Vitest)

Update `/home/wabbazzar/code/shredly2/tests/unit/history.test.ts`:

**New Tests to Add**:

```typescript
describe('getTodaysHistoryForWorkout (date-based)', () => {
  it('should return null when no history exists', () => {
    const result = getTodaysHistoryForWorkout('test-program');
    expect(result).toBe(null);
  });

  it('should return all rows for today regardless of week/day values', () => {
    const today = new Date().toISOString().split('T')[0];
    appendHistoryRows([
      createMockHistoryRow({
        date: today,
        workout_program_id: 'test-program',
        week_number: 1,  // Different week numbers
        day_number: 1,
        exercise_name: 'Bench Press',
        set_number: 1
      }),
      createMockHistoryRow({
        date: today,
        workout_program_id: 'test-program',
        week_number: 3,  // Different week number (simulating start date change)
        day_number: 2,
        exercise_name: 'Squats',
        set_number: 1
      })
    ]);

    const result = getTodaysHistoryForWorkout('test-program');

    expect(result).not.toBe(null);
    expect(result?.length).toBe(2);  // Both rows returned
  });

  it('should find history after start date change (regression test)', () => {
    const today = new Date().toISOString().split('T')[0];
    // Simulate: user logged workout when week_number=1, then changed start date
    appendHistoryRow(createMockHistoryRow({
      date: today,
      workout_program_id: 'test-program',
      week_number: 1,  // Original week when logged
      day_number: 1,
      exercise_name: 'Bench Press'
    }));

    // Query should find it regardless of what week/day calculation returns now
    const result = getTodaysHistoryForWorkout('test-program');

    expect(result).not.toBe(null);
    expect(result?.length).toBe(1);
  });

  it('should exclude rows from different dates', () => {
    const today = new Date().toISOString().split('T')[0];
    appendHistoryRows([
      createMockHistoryRow({
        date: today,
        workout_program_id: 'test-program'
      }),
      createMockHistoryRow({
        date: '2020-01-01',  // Different date
        workout_program_id: 'test-program'
      })
    ]);

    const result = getTodaysHistoryForWorkout('test-program');

    expect(result?.length).toBe(1);
  });

  it('should exclude rows from different programs', () => {
    const today = new Date().toISOString().split('T')[0];
    appendHistoryRows([
      createMockHistoryRow({
        date: today,
        workout_program_id: 'test-program'
      }),
      createMockHistoryRow({
        date: today,
        workout_program_id: 'other-program'
      })
    ]);

    const result = getTodaysHistoryForWorkout('test-program');

    expect(result?.length).toBe(1);
  });

  it('should still deduplicate by keeping latest timestamp', () => {
    const today = new Date().toISOString().split('T')[0];
    appendHistoryRows([
      createMockHistoryRow({
        date: today,
        timestamp: `${today}T10:00:00.000Z`,
        workout_program_id: 'test-program',
        exercise_name: 'Bench Press',
        set_number: 1,
        weight: 100
      }),
      createMockHistoryRow({
        date: today,
        timestamp: `${today}T12:00:00.000Z`,
        workout_program_id: 'test-program',
        exercise_name: 'Bench Press',
        set_number: 1,
        weight: 135
      })
    ]);

    const result = getTodaysHistoryForWorkout('test-program');

    expect(result?.length).toBe(1);
    expect(result?.[0].weight).toBe(135);
  });
});

describe('hasLoggedTodaysWorkout (date-based)', () => {
  it('should return false when no history exists', () => {
    const result = hasLoggedTodaysWorkout('test-program');
    expect(result).toBe(false);
  });

  it('should return true when history exists for today', () => {
    const today = new Date().toISOString().split('T')[0];
    appendHistoryRow(createMockHistoryRow({
      date: today,
      workout_program_id: 'test-program'
    }));

    const result = hasLoggedTodaysWorkout('test-program');
    expect(result).toBe(true);
  });

  it('should return true regardless of stored week/day values', () => {
    const today = new Date().toISOString().split('T')[0];
    appendHistoryRow(createMockHistoryRow({
      date: today,
      workout_program_id: 'test-program',
      week_number: 99,  // Arbitrary week number (shouldn't matter)
      day_number: 7     // Arbitrary day number (shouldn't matter)
    }));

    const result = hasLoggedTodaysWorkout('test-program');
    expect(result).toBe(true);
  });
});
```

**Tests to Remove/Update**:

```typescript
// REMOVE these tests (they test old behavior with week/day params):
// - 'should return false for different week/day' in hasLoggedTodaysWorkout
// - Tests that pass week_number/day_number to getTodaysHistoryForWorkout

// UPDATE existing tests to use new signatures (remove week/day arguments)
```

- Run: `npm run test:unit`

### Integration Tests

No new integration tests required. The existing Live session integration tests will validate the full flow.

### Manual Testing

**Test Case 1: Basic Flow**:
```bash
npm run dev
# 1. Create a new schedule
# 2. Go to Live tab, start workout
# 3. Log some exercises
# 4. End workout
# 5. Refresh page
# 6. Go to Live tab - should show "Previous Workout" review mode
```

**Test Case 2: Start Date Change (Regression)**:
```bash
npm run dev
# 1. Create schedule with start date = today
# 2. Go to Live tab, log a workout
# 3. Go to Schedule tab, change start date to tomorrow
# 4. Go back to Live tab
# 5. Should still show "Previous Workout" with logged data (NOT "Start Workout" prompt)
```

**Test Case 3: Multiple Workouts Same Day**:
```bash
npm run dev
# 1. Create schedule
# 2. Log workout for Day 1
# 3. End session
# 4. Start new workout (simulating second session)
# 5. Both sessions should be visible in review mode
```

### Test Acceptance Criteria

- [ ] All unit tests pass (`npm run test:unit`)
- [ ] All integration tests pass (`npm run test:integration`)
- [ ] All tests pass together (`npm test`)
- [ ] TypeScript compilation succeeds (`npm run typecheck`)
- [ ] Build succeeds (`npm run build`)
- [ ] Manual testing checklist complete
- [ ] No console errors in browser

---

## Success Criteria

- [ ] `getTodaysHistoryForWorkout()` queries by date + program_id only (no week/day)
- [ ] `hasLoggedTodaysWorkout()` queries by date + program_id only (no week/day)
- [ ] Start date changes do NOT orphan historical workout data
- [ ] Session recovery works correctly after start date change
- [ ] Live tab "Previous Workout" review mode works after start date change
- [ ] `getWeekPerformance()` unchanged (still uses week_number for progression)
- [ ] `logSessionToHistory()` unchanged (still stores week_number/day_number)
- [ ] Code follows CLAUDE.md standards
- [ ] All tests pass (667+ tests)
- [ ] TypeScript compilation succeeds

---

## Dependencies

### Blocked By
- None

### Blocks
- None

### External Dependencies
- None

---

## Risks & Mitigations

### Risk 1: Multiple workouts logged on same day with different focus areas
- **Impact**: Medium
- **Probability**: Low
- **Mitigation**: The deduplication logic already handles this by using (exercise_name, set_number, is_compound_parent) as the key. Different exercises will all be returned. If the same exercise is logged multiple times, the latest timestamp wins (existing behavior preserved).

### Risk 2: getWeekPerformance() used elsewhere with wrong expectations
- **Impact**: Low
- **Probability**: Low
- **Mitigation**: `getWeekPerformance()` is specifically designed for progressive overload comparisons within a program run (e.g., "what did you do last week for this exercise"). It correctly uses week_number because that's the appropriate semantic for progression tracking. No change needed.

### Risk 3: Historical data interpretation in future analytics
- **Impact**: Low
- **Probability**: Medium
- **Mitigation**: week_number and day_number are still stored in every row. Future analytics features can still use these fields. The change only affects real-time session recovery queries.

---

## Notes

### Why not remove week/day from storage entirely?

The `week_number` and `day_number` fields remain valuable for:
1. **Historical context**: "When in my program did I do this workout?"
2. **Analytics**: Weekly volume comparisons, day-of-week patterns
3. **Progressive overload**: `getWeekPerformance()` uses week_number to compare same exercise across weeks
4. **Export/debugging**: CSV exports include full context

The issue is using them for **queries that should be date-based**, not their existence.

### Alternative considered: Recalculate week/day at query time

This was rejected because:
- Would require passing schedule to every history query
- Adds complexity and potential for bugs
- Date + program_id is the correct semantic for "today's workout" queries

### Behavior after fix

| Scenario | Before | After |
|----------|--------|-------|
| User logs workout, no changes | Works | Works |
| User logs workout, changes start date | History not found | History found |
| User logs 2 workouts same day | Both found | Both found |
| Weekly progression comparison | Works | Works (unchanged) |

---

## Commit Standards Reminder

**MANDATORY**: Follow CLAUDE.md commit message standards:
- Format: `type(scope): description under 50 chars`
- Types: feat, fix, docs, style, refactor, test, chore
- Scopes: cli, engine, questionnaire, profile, schedule, live, workout-gen, exercise-selector, progression, ui, mobile, history, prs, tests
- **NEVER include "Generated with [Claude Code]" or "Co-Authored-By: Claude"**

---

## Definition of Done

- [ ] Phase 1 implemented and tested (history.ts functions updated)
- [ ] Phase 2 implemented and tested (live/+page.svelte callers updated)
- [ ] All unit tests pass (including new regression tests)
- [ ] All integration tests pass
- [ ] TypeScript compilation succeeds
- [ ] Manual testing confirms fix works
- [ ] Code reviewed (by code-quality-assessor agent)
- [ ] Success criteria met
- [ ] Committed with proper commit messages
- [ ] CLAUDE.md "Current Development Status" updated
