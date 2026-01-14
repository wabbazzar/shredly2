# Ticket #024: Feature - Exercise History Integration with 1RM/TRM Calculation

**Status**: Open
**Priority**: High
**Type**: feature
**Estimated Points**: 13
**Phase**: 3-History

---

## Summary

Implement 1RM (One Rep Max) calculation from exercise history using Epley formula with RPE adjustment, add TRM (Training Rep Max) derivation, create an incremental cache system, and wire the data to Profile view PRs and Schedule/Live weight prescriptions.

## Background

Currently, the app stores exercise history in CSV format (history.ts, 629 lines) and users can manually enter 1RM values in the Profile tab (Big 4 lifts only). However, there is no automatic calculation of 1RM from logged workout data, no TRM derivation for weight prescriptions, and no display of PRs for exercises in the current workout program.

This ticket connects the data logged in DataEntryModal during Live workouts to:
1. Calculate estimated 1RM using Epley formula with RPE adjustment
2. Derive TRM (90% of 1RM) for weight prescriptions
3. Display PRs and recent activity in Profile for current program exercises
4. Pre-populate suggested weights in Schedule/Live views based on TRM

---

## Technical Requirements

### Data Structures

**Reference**: EXERCISE_HISTORY_SPEC.md (CSV schema with 20 columns)

#### 1RM Cache Structure

```typescript
// localStorage key: 'exercise_1rm_cache'
interface Exercise1RMCache {
  [exerciseName: string]: Exercise1RMEntry;
}

interface Exercise1RMEntry {
  estimated_1rm: number;         // Calculated 1RM in lbs
  trm: number;                   // Training Rep Max (90% of 1RM)
  last_updated: string;          // ISO date string
  data_points: number;           // Number of sets used in calculation
  is_stale: boolean;             // True if last data > 30 days old
  last_performed: string | null; // ISO date of most recent set
  user_override: number | null;  // Manual 1RM entry (takes precedence)
}
```

#### RPE Adjustment Factors

```typescript
// RPE to estimated max effort percentage
const RPE_ADJUSTMENT: Record<number, number> = {
  10: 1.00,    // True max effort
  9.5: 0.98,   // Near max
  9: 0.96,     // Very hard
  8.5: 0.94,   // Hard
  8: 0.92,     // Moderate-hard
  7.5: 0.90,   // Moderate
  7: 0.88,     // Somewhat hard
  6: 0.85,     // Easy-moderate
};
```

### Code Locations

**Files to modify:**
- `src/lib/stores/history.ts` (lines 424-469: getPersonalRecords function) - Add 1RM calculation
- `src/lib/stores/user.ts` (lines 98-123) - Wire cache updates, support override precedence
- `src/lib/components/live/DataEntryModal.svelte` (lines 84-109: handleSubmit) - Trigger cache update
- `src/routes/profile/+page.svelte` (entire file) - Add PR display section
- `src/lib/stores/liveSession.ts` (lines 84-119) - Use cache for weight suggestions

**Files to create:**
- `src/lib/stores/oneRMCache.ts` - New cache store with calculation logic
- `src/lib/components/profile/PRCard.svelte` - PR display card with inline edit
- `src/lib/components/profile/RecentActivity.svelte` - Recent activity summary

**Dependencies:**
- `src/lib/stores/schedule.ts` - Access current program exercises
- `src/lib/engine/types.ts` - WeightPrescription, LiveExercise types
- `src/lib/types/user.ts` - OneRepMax interface

### TypeScript Types

```typescript
// src/lib/stores/oneRMCache.ts

/**
 * Single data point for 1RM calculation
 */
export interface OneRMDataPoint {
  weight: number;
  reps: number;
  rpe: number | null;
  date: string;
  timestamp: string;
}

/**
 * Cached 1RM entry for an exercise
 */
export interface Exercise1RMEntry {
  estimated_1rm: number;
  trm: number;
  last_updated: string;
  data_points: number;
  is_stale: boolean;
  last_performed: string | null;
  user_override: number | null;
}

/**
 * Full cache structure
 */
export interface Exercise1RMCache {
  [exerciseName: string]: Exercise1RMEntry;
}

/**
 * Calculate 1RM options
 */
export interface Calculate1RMOptions {
  includeRPEAdjustment?: boolean;
  recencyHalfLifeDays?: number;
  staleThresholdDays?: number;
}

/**
 * PR display data for Profile view
 */
export interface ExercisePRDisplay {
  exerciseName: string;
  estimated1RM: number;
  trm: number;
  isStale: boolean;
  lastPerformed: string | null;
  daysSinceLastPerformed: number | null;
  hasUserOverride: boolean;
  userOverride: number | null;
  recentActivity: {
    lastWeight: number | null;
    lastReps: number | null;
    lastRPE: number | null;
    trend: 'up' | 'down' | 'stable' | null;
  };
}
```

---

## Implementation Plan

### Phase 1: 1RM Calculation Engine (5 points)

**Goal**: Implement core 1RM calculation logic using Epley formula with RPE adjustment and time-weighted averaging.

**Steps**:
1. Create `src/lib/stores/oneRMCache.ts` with:
   - Epley formula: `1RM = weight * (1 + reps/30)`
   - RPE adjustment: divide raw 1RM by RPE factor to get estimated true max
   - Time-weighted average with 14-day half-life for recent data (<30 days)
   - Stale data handling (>30 days: use best estimate without decay, flag as stale)
   - TRM calculation: `TRM = 1RM * 0.90`
2. Add `extractDataPointsFromHistory()` function to query history.ts CSV
3. Add `calculateWeighted1RM()` function with recency weighting
4. Add unit tests for all calculation scenarios

**Files**:
- Create: `src/lib/stores/oneRMCache.ts`
- Create: `tests/unit/stores/oneRMCache.test.ts`

**Testing**:
- [ ] Unit test: Epley formula calculation (various weight/rep combinations)
- [ ] Unit test: RPE adjustment factors
- [ ] Unit test: Time-weighted averaging with 14-day half-life
- [ ] Unit test: Stale data detection (>30 days)
- [ ] Unit test: TRM derivation (exactly 90% of 1RM)
- [ ] Run: `npm run test:unit`

**Commit Message**:
```
feat(history): add 1RM calculation engine with Epley formula

- Implement Epley formula: weight * (1 + reps/30)
- Add RPE adjustment factors (RPE 10 = 100%, RPE 8 = 92%, etc.)
- Add time-weighted averaging with 14-day half-life
- Handle stale data (>30 days) with flag instead of decay
- Derive TRM as 90% of calculated 1RM
```

**Agent Invocations**:
```bash
# Use shredly-code-writer for implementation
# Invoke: shredly-code-writer agent with "Implement Phase 1 for ticket #024: 1RM calculation engine"

# Use test-writer for test creation
# Invoke: test-writer agent with "Write unit tests for 1RM calculation in oneRMCache.ts from ticket #024"

# Use code-quality-assessor after implementation
# Invoke: code-quality-assessor agent with "Review oneRMCache.ts from ticket #024 Phase 1"
```

---

### Phase 2: Incremental Cache Store (3 points)

**Goal**: Create localStorage cache store with incremental update capability.

**Steps**:
1. Add localStorage persistence for cache (`exercise_1rm_cache` key)
2. Implement `updateCacheForExercise()` - incremental update for single exercise
3. Implement `fullRecalculateCache()` - full recalculation on app startup
4. Implement `getFromCache()` - O(1) lookup for Schedule/Live views
5. Add `invalidateCache()` for testing/debugging
6. Wire cache initialization to app startup

**Files**:
- Modify: `src/lib/stores/oneRMCache.ts`
- Modify: `src/routes/+layout.svelte` (add cache initialization)

**Testing**:
- [ ] Unit test: localStorage persistence (save/load)
- [ ] Unit test: Incremental update triggers correctly
- [ ] Unit test: Cache structure validation
- [ ] Unit test: O(1) lookup performance
- [ ] Run: `npm run test:unit`

**Commit Message**:
```
feat(history): add incremental 1RM cache with localStorage persistence

- Store cache in localStorage key 'exercise_1rm_cache'
- Incremental updates when new data logged
- Full recalculation on app startup
- O(1) lookup for Schedule/Live views
```

**Agent Invocations**:
```bash
# Use shredly-code-writer for implementation
# Invoke: shredly-code-writer agent with "Implement Phase 2 for ticket #024: incremental cache store"

# Use test-writer for test creation
# Invoke: test-writer agent with "Write unit tests for 1RM cache persistence from ticket #024"
```

---

### Phase 3: DataEntryModal Integration (2 points)

**Goal**: Wire DataEntryModal submit to trigger cache updates when new workout data is logged.

**Steps**:
1. Import `updateCacheForExercise` from oneRMCache in DataEntryModal
2. After `logSetToHistory()` in handleSubmit, call cache update
3. Ensure compound block sub-exercises also trigger cache updates
4. Add debouncing to prevent excessive recalculations during rapid logging

**Files**:
- Modify: `src/lib/components/live/DataEntryModal.svelte` (lines 84-109)
- Modify: `src/routes/live/+page.svelte` (handle cache update after session)

**Testing**:
- [ ] Integration test: Log set -> cache updated for that exercise
- [ ] Integration test: Compound block logs update all sub-exercise caches
- [ ] Manual test: Complete workout, verify cache updated
- [ ] Run: `npm run test:integration`

**Commit Message**:
```
feat(live): wire DataEntryModal to update 1RM cache on submit

- Update cache incrementally when set is logged
- Handle compound block sub-exercises
- Add debouncing for rapid logging
```

**Agent Invocations**:
```bash
# Use shredly-code-writer for implementation
# Invoke: shredly-code-writer agent with "Implement Phase 3 for ticket #024: DataEntryModal cache integration"

# Use test-writer for test creation
# Invoke: test-writer agent with "Write integration tests for DataEntryModal cache updates from ticket #024"
```

---

### Phase 4: Profile View PR Display (5 points)

**Goal**: Add PR cards to Profile view for exercises in current workout program with inline edit capability.

**Steps**:
1. Create `PRCard.svelte` component:
   - Display exercise name, calculated 1RM, TRM
   - Show stale indicator if >30 days since last data
   - Inline edit button to override calculated 1RM
   - Save override to user store (takes precedence)
2. Create `RecentActivity.svelte` component:
   - Show last performed date
   - Show recent trend (weight going up/down/stable)
   - Show last logged weight/reps/RPE
3. Modify `profile/+page.svelte`:
   - Add new "Personal Records" section
   - Query current program exercises from schedule store
   - Display PRCard for each exercise in program
   - Group by day/focus for organization
4. Wire user override to oneRMCache (override takes precedence)

**Files**:
- Create: `src/lib/components/profile/PRCard.svelte`
- Create: `src/lib/components/profile/RecentActivity.svelte`
- Modify: `src/routes/profile/+page.svelte`
- Modify: `src/lib/stores/user.ts` (wire override to cache)

**Testing**:
- [ ] Unit test: PRCard displays correct data from cache
- [ ] Unit test: PRCard inline edit saves to user store
- [ ] Unit test: Override takes precedence over calculated value
- [ ] Unit test: Stale indicator shows when >30 days
- [ ] Manual test: Profile shows PRs for current program exercises only
- [ ] Run: `npm run test:unit`

**Commit Message**:
```
feat(profile): add PR cards with inline 1RM override for current program

- Create PRCard component with 1RM, TRM, stale indicator
- Create RecentActivity component for trend display
- Show PRs only for exercises in current workout program
- Inline edit allows manual 1RM override (takes precedence)
```

**Agent Invocations**:
```bash
# Use shredly-code-writer for implementation
# Invoke: shredly-code-writer agent with "Implement Phase 4 for ticket #024: Profile PR display"

# Use test-writer for test creation
# Invoke: test-writer agent with "Write unit tests for PRCard and RecentActivity from ticket #024"

# Use code-quality-assessor after implementation
# Invoke: code-quality-assessor agent with "Review PRCard.svelte and profile page changes from ticket #024"
```

---

### Phase 5: Schedule/Live Weight Prescriptions (3 points)

**Goal**: Use TRM from cache to calculate and display weight prescriptions in Schedule and Live views.

**Steps**:
1. Modify `liveSession.ts` `calculateWeightFromPercentTM()`:
   - Check cache first (O(1) lookup)
   - Use TRM from cache instead of user 1RM directly
   - Fall back to user store 1RM if no cache entry
   - Respect user override (already handled in cache)
2. Add weight suggestion display in DataEntryModal:
   - Show "Suggested: X lbs (80% TRM)" above weight input
   - Pre-fill weight input with suggested value
3. Update Schedule DayView to show TRM-based weights:
   - Display calculated weight next to percent_tm prescription
   - Show "No 1RM" indicator if weight cannot be calculated

**Files**:
- Modify: `src/lib/stores/liveSession.ts` (lines 84-119)
- Modify: `src/lib/components/live/DataEntryModal.svelte`
- Modify: `src/lib/components/schedule/DayView.svelte`

**Testing**:
- [ ] Unit test: Weight calculation uses cache TRM
- [ ] Unit test: User override takes precedence in calculation
- [ ] Unit test: Fallback to user store when no cache
- [ ] Manual test: DataEntryModal shows suggested weight
- [ ] Manual test: Schedule shows calculated weights
- [ ] Run: `npm run test:unit`

**Commit Message**:
```
feat(schedule,live): use TRM cache for weight prescriptions

- Calculate weights from TRM in cache (O(1) lookup)
- Show suggested weight in DataEntryModal
- Display calculated weights in Schedule DayView
- Respect user override precedence
```

**Agent Invocations**:
```bash
# Use shredly-code-writer for implementation
# Invoke: shredly-code-writer agent with "Implement Phase 5 for ticket #024: Schedule/Live weight prescriptions"

# Use test-writer for test creation
# Invoke: test-writer agent with "Write tests for weight prescription display from ticket #024"

# Use code-quality-assessor after implementation
# Invoke: code-quality-assessor agent with "Review liveSession and DayView changes from ticket #024"
```

---

## Testing Strategy

### Unit Tests (Vitest)

**1RM Calculation Tests** (`tests/unit/stores/oneRMCache.test.ts`):
- [ ] `calculateEpley1RM()` - 135lbs x 10 reps = 180lbs
- [ ] `calculateEpley1RM()` - 225lbs x 5 reps = 262.5lbs
- [ ] `calculateEpley1RM()` - Edge case: 1 rep returns same weight
- [ ] `adjustForRPE()` - RPE 10 = no adjustment
- [ ] `adjustForRPE()` - RPE 8 = divide by 0.92
- [ ] `adjustForRPE()` - RPE 7 = divide by 0.88
- [ ] `adjustForRPE()` - Null RPE = no adjustment
- [ ] `calculateTimeWeightedAverage()` - Recent data weighted higher
- [ ] `calculateTimeWeightedAverage()` - 14-day half-life correct
- [ ] `isStale()` - >30 days returns true
- [ ] `isStale()` - <30 days returns false
- [ ] `deriveTRM()` - exactly 90% of 1RM

**Cache Tests** (`tests/unit/stores/oneRMCache.test.ts`):
- [ ] `saveToLocalStorage()` - persists correctly
- [ ] `loadFromLocalStorage()` - loads correctly
- [ ] `updateCacheForExercise()` - incremental update works
- [ ] `getFromCache()` - O(1) lookup
- [ ] `fullRecalculateCache()` - rebuilds from history
- [ ] User override takes precedence over calculated

**PRCard Tests** (`tests/unit/components/PRCard.test.ts`):
- [ ] Displays exercise name, 1RM, TRM
- [ ] Shows stale indicator when appropriate
- [ ] Inline edit saves to user store
- [ ] Override value displayed when set

Run: `npm run test:unit`

### Integration Tests (Vitest)

**Data Flow Tests** (`tests/integration/oneRMFlow.test.ts`):
- [ ] Log set -> cache updated -> Profile reflects change
- [ ] User override -> cache respects override -> Live shows override
- [ ] Stale exercise -> Profile shows indicator -> Live still calculates

Run: `npm run test:integration`

### Manual Testing

**Live View Flow**:
1. Start a workout with Bench Press (has 1RM)
2. Complete a set with weight + reps + RPE
3. Verify DataEntryModal shows suggested weight
4. Navigate to Profile tab
5. Verify PRCard shows updated 1RM estimate

**Profile Override Flow**:
1. Navigate to Profile tab
2. Tap edit on Bench Press PRCard
3. Enter manual 1RM value
4. Start Live workout with Bench Press
5. Verify weight prescription uses override value

**Stale Data Flow**:
1. Create history entry >30 days ago (manual)
2. Navigate to Profile tab
3. Verify stale indicator appears
4. Verify 1RM still calculated (without decay)

### Test Acceptance Criteria

- [ ] All unit tests pass (`npm run test:unit`)
- [ ] All integration tests pass (`npm run test:integration`)
- [ ] All tests pass together (`npm test`)
- [ ] TypeScript compilation succeeds (`npm run typecheck`)
- [ ] Build succeeds (`npm run build`)
- [ ] Manual testing checklist complete

---

## Success Criteria

- [ ] Epley formula correctly calculates 1RM from weight/reps
- [ ] RPE adjustment modifies estimate appropriately
- [ ] Time-weighted average uses 14-day half-life
- [ ] Stale data (>30 days) flagged but still used
- [ ] User override always takes precedence
- [ ] TRM = 90% of 1RM exactly
- [ ] Cache updates incrementally on set log
- [ ] Cache recalculates fully on app startup
- [ ] Profile shows PRs for current program exercises only
- [ ] PRCard displays 1RM, TRM, stale indicator
- [ ] Inline edit saves override to user store
- [ ] DataEntryModal shows suggested weight from TRM
- [ ] Schedule DayView shows calculated weights
- [ ] Code follows CLAUDE.md standards
- [ ] Data structures comply with EXERCISE_HISTORY_SPEC.md
- [ ] TypeScript types are properly defined
- [ ] Tests provide >80% coverage of new code

---

## Dependencies

### Blocked By
- None (builds on existing history.ts infrastructure)

### Blocks
- Future: Progressive overload suggestions based on history trends
- Future: Smart workout assistant with PR awareness
- Future: Social features with PR sharing

### External Dependencies
- None

---

## Risks & Mitigations

### Risk 1: Performance impact from cache calculations on startup
- **Impact**: Medium
- **Probability**: Low
- **Mitigation**: Full recalculation is O(n) on history rows. With 60,000 row capacity and simple calculations, should complete in <100ms. Add performance logging to verify.

### Risk 2: Incorrect 1RM estimates for low-rep ranges
- **Impact**: Medium
- **Probability**: Medium
- **Mitigation**: Epley formula is well-validated for 1-10 rep range. Document that estimates may be less accurate for >10 reps. Consider capping at 10 reps for calculation.

### Risk 3: User confusion between calculated and manual 1RM
- **Impact**: Low
- **Probability**: Medium
- **Mitigation**: Clear visual distinction in PRCard - show "Calculated" badge for auto-calculated, "Manual" badge for overrides. Show last updated date.

### Risk 4: Cache becomes stale/invalid after history import
- **Impact**: Low
- **Probability**: Low
- **Mitigation**: Add manual "Recalculate PRs" button in Profile. CSV import should trigger full recalculation.

---

## Notes

### Epley Formula Reference
The Epley formula (`1RM = weight * (1 + reps/30)`) is widely used and validated for estimating 1RM from submaximal efforts. It works best for:
- Rep ranges 1-10 (most accurate)
- Compound movements (Bench, Squat, Deadlift, Press)
- Trained individuals with consistent technique

### RPE Integration
RPE (Rate of Perceived Exertion) on a 1-10 scale indicates how close to failure a set was:
- RPE 10 = Absolute max, could not do another rep
- RPE 9 = Could do 1 more rep
- RPE 8 = Could do 2 more reps
- RPE 7 = Could do 3 more reps

When RPE < 10, we adjust the calculated 1RM upward by dividing by the RPE factor. This accounts for the fact that the set was not performed at true max effort.

### TRM (Training Rep Max)
Using 90% of 1RM as TRM is industry standard (popularized by Jim Wendler's 5/3/1 program). This provides:
- Built-in buffer for fatigue/bad days
- Room for progressive overload
- Safer training weights for consistent progress

### Current Program Exercise List
To get exercises in the current program:
```typescript
const schedule = get(activeSchedule);
const exerciseNames = new Set<string>();
if (schedule) {
  for (const day of Object.values(schedule.days)) {
    for (const exercise of day.exercises) {
      exerciseNames.add(exercise.name);
      if (exercise.sub_exercises) {
        for (const sub of exercise.sub_exercises) {
          exerciseNames.add(sub.name);
        }
      }
    }
  }
}
```

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
- [ ] Documentation updated (if needed)
- [ ] Committed with proper commit messages
- [ ] CLAUDE.md "Current Development Status" updated
