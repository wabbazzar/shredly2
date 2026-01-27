# Ticket #028: Fix - TRM Double-Discount Calculation

**Status**: Open
**Priority**: High
**Type**: fix
**Estimated Points**: 8 (fibonacci scale - 4 phases)
**Phase**: 3-History

---

## Summary

Fix the Training Max (TRM) calculation logic that incorrectly applies a "double discount" when deriving weight prescriptions from training sets. Currently, multi-rep training sets are treated as 1RM max attempts, causing calculated TRM values to be ~10% lower than intended.

---

## Objective

Eliminate the double-discount problem in TRM calculation by treating multi-rep sets (3+ reps) as Training Max values directly, rather than as estimated 1RM values that require further discounting.

---

## Validation Command

```bash
npm run test -- tests/unit/stores/oneRMCache.test.ts -v && npm run typecheck
```

**Exit condition**: All tests pass (including new tests for rep-threshold logic), TypeScript compiles without errors, and PRCard displays "Training Max" instead of "1RM".

---

## Acceptance Criteria

1. Sets with 1-2 reps are treated as max attempts: calculate estimated 1RM, then derive TRM (90% of 1RM)
2. Sets with 3+ reps are treated as training sets: Epley result IS the TRM directly (no 10% discount)
3. RPE only applies a discount when RPE >= 9: multiply TRM by RPE factor (0.96 for RPE 9, 1.0 for RPE 10)
4. RPE 1-8 does not adjust the calculation (normal training effort, no adjustment needed)
5. User overrides continue to take precedence over calculated values
6. Profile tab displays "Training Max" label instead of "Estimated 1RM" and "TRM"
7. All existing tests pass or are updated to reflect new calculation logic
8. ~10% increase in prescribed weights is expected and acceptable (no gradual rollout)

---

## Problem Statement

### Current Behavior (Incorrect)

User performs a working set: 165 lbs x 8 reps at RPE 8

1. Calculate "1RM" using Epley formula: `1RM = 165 * (1 + 8/30) = 209 lbs`
2. Adjust for RPE 8: `209 / 0.92 = 227 lbs` (estimated "true max")
3. Derive TRM as 90% of 1RM: `227 * 0.9 = 204 lbs`
4. Week 2 prescribes 85% of TRM: `204 * 0.85 = 173 lbs`

**Problem**: The 165x8 was already a submaximal training set (RPE 8 means 2 reps in reserve). The Epley formula assumes the user went to failure, but they didn't. So we're:
1. Calculating a "1RM" from a non-maximal set (already conservative)
2. Inflating it with RPE adjustment (assuming they could have done more)
3. Then discounting 10% again for TRM

This creates confusing and overly conservative weight prescriptions.

### Desired Behavior (Fixed)

User performs a working set: 165 lbs x 8 reps at RPE 8

1. Rep count is 3+ -> This is a training set, not a max attempt
2. Calculate Training Max using Epley: `TM = 165 * (1 + 8/30) = 209 lbs`
3. RPE is 8 (< 9) -> No adjustment needed for normal training effort
4. TRM = 209 lbs (rounded to 210 lbs)
5. Week 2 prescribes 85% of TRM: `210 * 0.85 = 178.5 -> 180 lbs`

**Result**: +7 lbs prescribed vs current calculation (173 vs 180), which is more appropriate for progressive overload.

### RPE Discount Logic (RPE 9-10 Only)

If someone logs RPE 9 or 10, they were pushing near failure - an effort level not sustainable for regular training. In this case, discount the TRM:

- **RPE 9**: `TRM = calculated_value * 0.96`
- **RPE 9.5**: `TRM = calculated_value * 0.98`
- **RPE 10**: `TRM = calculated_value * 1.0` (no discount - true max effort)

Example: 165 x 8 at RPE 9
1. Calculate TM: `165 * (1 + 8/30) = 209 lbs`
2. Apply RPE 9 discount: `209 * 0.96 = 200.6 -> 200 lbs`
3. TRM = 200 lbs

---

## Solution Overview

### Calculation Flow Changes

```
BEFORE (Current - Double Discount):
  Epley(weight, reps) -> adjustForRPE() -> estimated_1rm -> deriveTRM(90%)

AFTER (Fixed - Rep-Threshold Logic):
  IF reps <= 2:
    // Max attempt: calculate 1RM, then derive TRM
    Epley(weight, reps) -> estimated_1rm -> deriveTRM(90%)
  ELSE (reps >= 3):
    // Training set: Epley result IS the TRM
    Epley(weight, reps) -> applyHighRPEDiscount() -> trm
```

### Key Changes

1. **Remove adjustForRPE() call for sets with 3+ reps** - RPE inflation no longer makes sense
2. **Add rep threshold constant**: `MAX_REPS_FOR_1RM_ESTIMATION = 2`
3. **Add high RPE discount function**: Only discounts for RPE >= 9
4. **Rename estimated_1rm field internally** - Keep for backward compatibility but calculate differently
5. **Update display labels** - "Training Max" instead of "Estimated 1RM" / "TRM (90%)"

---

## Architecture

### Files to Modify

| File | Changes |
|------|---------|
| `/home/wabbazzar/code/shredly2/src/lib/stores/oneRMCache.ts` | Core calculation logic changes, new constants, updated functions |
| `/home/wabbazzar/code/shredly2/src/lib/components/profile/PRCard.svelte` | Update display labels from "1RM" to "Training Max" |
| `/home/wabbazzar/code/shredly2/tests/unit/stores/oneRMCache.test.ts` | Update tests, add new test cases for rep threshold and RPE discount |

### No New Files Required

All changes are modifications to existing files.

---

## Task Checklist

### Phase 1: Core Calculation Logic

#### 1.1 Add New Constants and Types

- [ ] Add `MAX_REPS_FOR_1RM_ESTIMATION = 2` constant in oneRMCache.ts
- [ ] Add `HIGH_RPE_THRESHOLD = 9` constant for when RPE discount applies
- [ ] Add `HIGH_RPE_DISCOUNT` lookup table: `{ 9: 0.96, 9.5: 0.98, 10: 1.0 }`
- [ ] Update docstrings to reflect new calculation philosophy

#### 1.2 Create applyHighRPEDiscount() Function

- [ ] Create `applyHighRPEDiscount(value: number, rpe: number | null): number`
- [ ] Return value unchanged if RPE is null or < 9
- [ ] Apply discount factor for RPE 9, 9.5, 10 (multiply, not divide)
- [ ] Interpolate between known values for fractional RPE (e.g., 9.25)
- [ ] Add unit tests for all RPE values from 6-10

#### 1.3 Create calculateTrainingMax() Function

- [ ] Create `calculateTrainingMax(weight: number, reps: number, rpe: number | null): number`
- [ ] If reps <= 2: Use Epley formula, return as estimated 1RM (no TRM derivation yet)
- [ ] If reps >= 3: Use Epley formula, apply high RPE discount, return as TRM directly
- [ ] Round result to nearest 5 lbs
- [ ] Add comprehensive unit tests

#### 1.4 Tests (Phase 1)

- [ ] Test: `test_max_reps_threshold_1rep` - 1 rep treated as max attempt
- [ ] Test: `test_max_reps_threshold_2reps` - 2 reps treated as max attempt
- [ ] Test: `test_max_reps_threshold_3reps` - 3 reps treated as training set
- [ ] Test: `test_high_rpe_discount_rpe9` - RPE 9 applies 0.96 factor
- [ ] Test: `test_high_rpe_discount_rpe95` - RPE 9.5 applies 0.98 factor
- [ ] Test: `test_high_rpe_discount_rpe10` - RPE 10 applies 1.0 (no discount)
- [ ] Test: `test_high_rpe_discount_rpe8` - RPE 8 applies no discount
- [ ] Test: `test_high_rpe_discount_null_rpe` - null RPE applies no discount
- [ ] Test: `test_training_max_165x8_rpe8` - Verifies example from problem statement

**Phase 1 Validation**: `npm run test -- tests/unit/stores/oneRMCache.test.ts -t "calculateTrainingMax|applyHighRPEDiscount|max_reps_threshold" -v`

---

### Phase 2: Update Time-Weighted Average and Cache Entry

#### 2.1 Update getBestSetPerDay()

- [ ] Modify to use `calculateTrainingMax()` instead of `calculateEpley1RM() + adjustForRPE()`
- [ ] Ensure comparison logic still picks highest value per day
- [ ] Handle rep threshold when comparing sets (a 1x315 and 8x225 should compare correctly)

#### 2.2 Update calculateTimeWeightedAverage()

- [ ] Remove `includeRPEAdjustment` option (no longer needed)
- [ ] Use `calculateTrainingMax()` for each data point
- [ ] For 1-2 rep sets, the result is estimated 1RM (needs TRM derivation later)
- [ ] For 3+ rep sets, the result IS the TRM
- [ ] Track whether result is "1rm" or "trm" for downstream derivation

#### 2.3 Update calculate1RMEntry()

- [ ] Refactor to handle mixed rep counts in history
- [ ] Use weighted average of training max values
- [ ] For final TRM derivation:
  - If most sets are 1-2 reps: derive TRM as 90% of average
  - If most sets are 3+ reps: average IS the TRM (no further discount)
- [ ] Update `estimated_1rm` field calculation (for display/backward compat)
- [ ] Ensure user_override still takes precedence

#### 2.4 Tests (Phase 2)

- [ ] Test: `test_time_weighted_avg_all_training_sets` - All 3+ rep sets, no double discount
- [ ] Test: `test_time_weighted_avg_all_max_attempts` - All 1-2 rep sets, TRM derived from 1RM
- [ ] Test: `test_time_weighted_avg_mixed_reps` - Mix of rep ranges, weighted appropriately
- [ ] Test: `test_cache_entry_no_double_discount` - Verify 165x8 scenario gives ~210 TRM not ~204
- [ ] Test: `test_user_override_still_precedent` - Override beats calculated value

**Phase 2 Validation**: `npm run test -- tests/unit/stores/oneRMCache.test.ts -t "time_weighted|cache_entry|user_override" -v`

---

### Phase 3: Update Existing Tests

#### 3.1 Update adjustForRPE() Tests

- [ ] Keep adjustForRPE() for backward compatibility but mark as deprecated
- [ ] Update tests that relied on old behavior
- [ ] Add deprecation notice in docstring

#### 3.2 Update calculateTimeWeightedAverage() Tests

- [ ] Remove tests for `includeRPEAdjustment` option
- [ ] Update expected values to reflect new calculation
- [ ] Test: Verify warmup set dilution fix still works with new logic

#### 3.3 Update calculate1RMEntry() Tests

- [ ] Update expected `estimated_1rm` values
- [ ] Update expected `trm` values (should be ~10% higher for training sets)
- [ ] Verify stale detection still works
- [ ] Verify data_points count still accurate

#### 3.4 Update Integration Tests

- [ ] Update `getPRDisplayData Integration` tests for new values
- [ ] Update `User Override Persistence` tests
- [ ] Verify Profile scenario test passes with new logic

**Phase 3 Validation**: `npm run test -- tests/unit/stores/oneRMCache.test.ts -v` (all tests)

---

### Phase 4: UI Label Updates

#### 4.1 Update PRCard.svelte Display Labels

- [ ] Change "1RM" label to "Training Max" (line 126)
- [ ] Remove "TRM (90%)" secondary label (line 133) - no longer accurate
- [ ] Keep single "Training Max" value display with edit capability
- [ ] Update `displayed1RM` reactive variable name to `displayedTrainingMax`
- [ ] Maintain click-to-edit functionality for user overrides

#### 4.2 Update Profile Page Sorting

- [ ] Update `sortedPRData` comparison to use `trm` instead of `estimated1RM` (if needed)
- [ ] Verify sort order still makes sense with new values

#### 4.3 Update Tooltips and Help Text (if any)

- [ ] Search for "1RM" strings in UI components
- [ ] Update any tooltips explaining the calculation
- [ ] Ensure consistent terminology throughout

#### 4.4 Tests (Phase 4)

- [ ] Manual test: Verify PRCard shows "Training Max" label
- [ ] Manual test: Verify edit functionality still works
- [ ] Manual test: Verify correct value displays after workout completion
- [ ] Manual test: Verify metric conversion still works

**Phase 4 Validation**: `npm run build && npm run preview` (manual UI verification)

---

## Test Commands

```bash
# Run all oneRMCache tests
npm run test -- tests/unit/stores/oneRMCache.test.ts -v

# Run only new calculation tests
npm run test -- tests/unit/stores/oneRMCache.test.ts -t "calculateTrainingMax|applyHighRPEDiscount" -v

# Run full test suite
npm test

# Type checking
npm run typecheck

# Build for production
npm run build
```

---

## Constraints

- **DO NOT** remove the `estimated_1rm` field from the cache entry type - needed for backward compatibility
- **DO NOT** change localStorage cache key - existing cache will be recalculated on next load
- **DO NOT** modify history.ts or history data structure - calculation changes only
- **DO** maintain backward compatibility with existing user overrides
- **DO** keep adjustForRPE() function (deprecated) for any external references
- **DO** round all weight values to nearest 5 lbs using existing `roundDownToNearest5()`

---

## Examples

### Example 1: Training Set (3+ reps, RPE 8)

**Input**: 165 lbs x 8 reps @ RPE 8

| Step | Before (Bug) | After (Fixed) |
|------|--------------|---------------|
| Epley | 209 lbs | 209 lbs |
| RPE Adjust | 209 / 0.92 = 227 lbs | No adjustment (RPE < 9) |
| TRM Derive | 227 * 0.9 = 204 lbs | 209 lbs IS the TRM |
| **Final TRM** | **204 lbs** | **210 lbs** |
| 85% Prescription | 173 lbs | 178 -> 180 lbs |

### Example 2: Training Set (3+ reps, RPE 9)

**Input**: 165 lbs x 8 reps @ RPE 9

| Step | Before (Bug) | After (Fixed) |
|------|--------------|---------------|
| Epley | 209 lbs | 209 lbs |
| RPE Adjust | 209 / 0.96 = 218 lbs | 209 * 0.96 = 201 lbs |
| TRM Derive | 218 * 0.9 = 196 lbs | 201 lbs IS the TRM |
| **Final TRM** | **196 lbs** | **200 lbs** |

### Example 3: Max Attempt (1-2 reps)

**Input**: 275 lbs x 2 reps @ RPE 10

| Step | Before | After (Same) |
|------|--------|--------------|
| Epley | 275 * (1 + 2/30) = 293 lbs | 293 lbs |
| RPE Adjust | No adjustment (RPE 10) | No adjustment (RPE 10) |
| TRM Derive | 293 * 0.9 = 264 lbs | 293 * 0.9 = 264 lbs |
| **Final TRM** | **264 lbs** | **264 lbs** (unchanged) |

### Example 4: Max Attempt with RPE 9

**Input**: 275 lbs x 1 rep @ RPE 9

| Step | Before | After |
|------|--------|-------|
| Epley | 275 lbs (1 rep = weight) | 275 lbs |
| RPE Adjust | 275 / 0.96 = 286 lbs | No change (inflation doesn't make sense) |
| TRM Derive | 286 * 0.9 = 257 lbs | 275 * 0.9 = 248 lbs |
| **Final TRM** | **257 lbs** | **248 lbs** |

Note: For 1-2 rep sets, we do NOT inflate based on RPE. A 1-rep at RPE 9 means the user grinded it out with one rep in reserve - we trust that weight as their working max.

---

## Migration Notes

### Automatic Recalculation

On app startup, `fullRecalculateCache()` is called which will automatically recalculate all TRM values using the new logic. No manual migration needed.

### Expected User Impact

- Users will see TRM values increase by approximately 5-10% for exercises trained with 3+ rep sets
- Weight prescriptions will increase proportionally
- This is intentional and correct - the previous values were overly conservative
- Users who set manual overrides will not be affected (overrides take precedence)

### Cache Key Unchanged

The localStorage key `exercise_1rm_cache` remains the same. Old cache data will be overwritten on first recalculation.

---

## Related Tickets

- **Ticket #024**: Exercise History 1RM/TRM Integration (original implementation)
- **Ticket #027**: Complete Data Transferability (backup/restore - cache is regenerated on import)

---

## Technical Debt Notes

After this fix, consider future improvements:

1. **Rename cache field**: `estimated_1rm` -> `estimated_training_max` (breaking change, needs migration)
2. **Remove adjustForRPE()**: Once confirmed no external dependencies, remove deprecated function
3. **Add rep count to cache entry**: Store whether TRM was derived from max attempts or training sets
4. **Progressive overload suggestions**: Use trend data to suggest when to increase weights
