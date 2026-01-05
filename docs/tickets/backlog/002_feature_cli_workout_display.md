# Ticket #001: Feature - CLI Workout Display Enhancement

**Status**: Open
**Priority**: Medium
**Type**: feature
**Estimated Points**: 3
**Phase**: 1-CLI

---

## Summary

Enhance the existing `npm run cli:interactive` command to display generated workouts in a formatted, human-readable view in the terminal. This display will become the foundation for future CLI editing functionality.

## Background

The interactive questionnaire CLI (`cli/interactive-questionnaire.ts`) currently generates workouts and offers to save them to JSON, but doesn't provide a clear, readable terminal view of the generated program. Users need to open the JSON file to inspect the workout, which is cumbersome for quick validation and iteration.

This ticket adds a formatted display step after generation that:
- Shows program overview (name, weeks, days/week, goal, equipment)
- Lists ALL exercises per day with category badges
- Displays compound exercises (EMOM, Circuit, AMRAP) with indented sub-exercises
- Shows full week-by-week progression for 2-3 "featured" exercises per day
- Uses ASCII-only formatting with colors (chalk or similar)

**Future Use**: This display formatter will be reused for a future CLI editing ticket that will enable:
- Adding/removing sets
- Swapping exercises (with exercise DB filtering)
- Adjusting reps, weight, tempo
- Adding/removing workouts
- Assigning calendar days (M, Tu, W, etc.) to dayNumber 1-7

## Technical Requirements

### Data Structures

This feature references WORKOUT_SPEC.md v2.0 for the workout data structure:

- **Top-level**: `ParameterizedWorkout` type (from `src/lib/engine/types.ts`)
- **Days**: `ParameterizedDay` with `dayNumber`, `type`, `focus`, `exercises[]`
- **Exercises**: `ParameterizedExercise` with `name`, `week1-weekN` progression
- **Compound exercises**: Have `category` field ("emom", "amrap", "circuit", "interval") and `sub_exercises[]` array

### Code Locations

- Files to create:
  - `cli/lib/workout-formatter.ts` (reusable display utilities)
- Files to modify:
  - `cli/interactive-questionnaire.ts` (lines 144-151, after workout generation, before save prompt)
  - `package.json` (possibly add chalk dependency)

### Dependencies

- External packages: `chalk` (for terminal colors) - check if already installed, add if needed
- Internal modules: `src/lib/engine/types.ts` (for TypeScript types)

### TypeScript Types

```typescript
// cli/lib/workout-formatter.ts

import type { ParameterizedWorkout, ParameterizedDay, ParameterizedExercise, WeekParameters } from '../../src/lib/engine/types.js';

/**
 * Format entire workout for terminal display
 */
export function formatWorkoutForTerminal(workout: ParameterizedWorkout): string;

/**
 * Format program overview (metadata)
 */
export function formatProgramOverview(workout: ParameterizedWorkout): string;

/**
 * Format a single day's workout
 */
export function formatDay(day: ParameterizedDay, weekCount: number): string;

/**
 * Format a single exercise (standalone or compound)
 */
export function formatExercise(
  exercise: ParameterizedExercise,
  exerciseNumber: number,
  weekCount: number,
  isFeatured: boolean
): string;

/**
 * Format sub-exercises for compound exercises (EMOM, Circuit, etc.)
 */
export function formatSubExercises(
  subExercises: ParameterizedSubExercise[],
  weekCount: number,
  parentCategory: string
): string;

/**
 * Format week-by-week progression for a single exercise
 */
export function formatWeekProgression(
  exerciseName: string,
  weekParams: { [key: string]: WeekParameters },
  weekCount: number
): string;

/**
 * Format category badge for exercise (e.g., [WARMUP], [STRENGTH], [EMOM])
 */
export function formatCategoryBadge(category: string): string;

/**
 * Determine which exercises should be "featured" (show full progression)
 * Strategy: First 2-3 exercises in main_strength_categories per day
 */
export function selectFeaturedExercises(exercises: ParameterizedExercise[]): Set<number>;
```

---

## Implementation Plan

### Phase 1: Create Formatter Module (3 points)

**Goal**: Build reusable `workout-formatter.ts` module with all display functions

**Steps**:
1. Create `cli/lib/` directory if it doesn't exist
2. Create `cli/lib/workout-formatter.ts` with function stubs
3. Implement `formatProgramOverview()` - display name, weeks, days/week, metadata
4. Implement `formatCategoryBadge()` - return colored ASCII badge based on category
5. Implement `selectFeaturedExercises()` - identify 2-3 key exercises per day (heuristic: first 2-3 non-warmup exercises)
6. Implement `formatExercise()`:
   - Display exercise number and name
   - Show category badge
   - If featured: call `formatWeekProgression()`
   - If not featured: just show name and category
   - If compound (has `sub_exercises`): call `formatSubExercises()`
7. Implement `formatSubExercises()`:
   - Indent sub-exercises with "  - " prefix
   - Show sub-exercise names
   - Optionally show progression if featured
8. Implement `formatWeekProgression()`:
   - Display sets, reps, weight, rest_time, work_time for week1, week2, week3, etc.
   - Handle both flat `sets/reps` and `set_blocks[]` format
   - Handle different parameter combinations (strength vs cardio vs intervals)
9. Implement `formatDay()`:
   - Display day number, type, focus
   - Iterate through exercises, calling `formatExercise()` for each
10. Implement `formatWorkoutForTerminal()`:
    - Combine `formatProgramOverview()` + `formatDay()` for all days
    - Use ASCII box-drawing characters (only: +, -, |, =) for sections
11. Integrate into `cli/interactive-questionnaire.ts`:
    - Import `formatWorkoutForTerminal` after line 14
    - After line 148 (`console.log('Generated in ${endTime - startTime}ms')`), add:
      ```typescript
      // Display formatted workout
      const formattedWorkout = formatWorkoutForTerminal(workout);
      console.log('\n' + formattedWorkout);
      ```
    - Remove or minimize `displayWorkoutSummary()` function (lines 93-114) since new formatter is more comprehensive

**Files**:
- Create: `cli/lib/workout-formatter.ts`
- Modify: `cli/interactive-questionnaire.ts` (lines 14, 148-152, 93-114)

**Testing**:
- [ ] Run `npm run cli:interactive` with sample questionnaire answers
- [ ] Verify program overview displays correctly
- [ ] Verify all exercises listed per day
- [ ] Verify compound exercises show indented sub-exercises
- [ ] Verify 2-3 featured exercises per day show full Week 1-3 progression
- [ ] Verify non-featured exercises show name + category only
- [ ] Verify ASCII formatting is clean (no unicode corruption)
- [ ] Test with different workout structures (Full Body, ULPPL, etc.)

**Commit Message**:
```
feat(cli): add formatted workout display to interactive questionnaire

- Create cli/lib/workout-formatter.ts with reusable display utilities
- Implement formatWorkoutForTerminal() for comprehensive program view
- Show program overview, all exercises per day, compound sub-exercises
- Display full week-by-week progression for 2-3 featured exercises per day
- Use ASCII-only formatting with chalk colors for terminal display
- Integrate into cli/interactive-questionnaire.ts after generation step
- Foundation for future CLI editing functionality
```

**Agent Invocations**:
```bash
# Use shredly-code-writer for implementation
# Invoke: shredly-code-writer agent with "Implement Phase 1 for ticket #001"

# Use test-writer for manual testing checklist (no automated tests yet)
# Invoke: test-writer agent with "Create manual test checklist for CLI workout display from ticket #001"

# Use code-quality-assessor after implementation
# Invoke: code-quality-assessor agent with "Review cli/lib/workout-formatter.ts and cli/interactive-questionnaire.ts from ticket #001"
```

---

## Testing Strategy

### Unit Tests

- [ ] Test `formatCategoryBadge()` with various categories (warmup, strength, emom, amrap, circuit, interval)
- [ ] Test `selectFeaturedExercises()` with different exercise arrays (2 exercises, 10 exercises, etc.)
- [ ] Test `formatWeekProgression()` with:
  - Flat sets/reps format
  - set_blocks format
  - Time-based exercises (work_time, rest_time)
  - Weight specifications (string descriptors, percent_tm, absolute)
- [ ] Test `formatSubExercises()` with EMOM, Circuit, AMRAP structures
- [ ] Test `formatExercise()` with featured and non-featured exercises
- [ ] Test `formatDay()` with various day structures
- [ ] Test `formatProgramOverview()` with different metadata

### Integration Tests

- [ ] Test full `formatWorkoutForTerminal()` with complete generated workout
- [ ] Test integration with `cli/interactive-questionnaire.ts` workflow

### Manual Testing

**CLI (Phase 1)**:
```bash
npm run cli:interactive
# Answer questionnaire questions
# Expected output after generation:
# 1. Program overview (name, weeks, days/week, difficulty, equipment, duration)
# 2. Day-by-day breakdown:
#    - Day number, type (gym/home/outdoor), focus (Push/Pull/Legs/etc.)
#    - All exercises listed with category badges
#    - Compound exercises show indented sub-exercises
#    - 2-3 featured exercises show full Week 1, Week 2, Week 3 progression
#    - Remaining exercises show name + category only
# 3. Clean ASCII formatting (no unicode box-drawing characters)
# 4. Colors enhance readability (badges, headers)
# 5. Output is concise (<100 lines for typical 3-week program)
```

**Test with different questionnaire inputs**:
1. Beginner, 3 days/week, bodyweight_only
2. Intermediate, 5 days/week, commercial_gym, ULPPL split
3. Advanced, 4 days/week, home_gym_full, upper_lower split

### Test Acceptance Criteria

- [ ] Display is concise (<100 lines for typical 3-week program)
- [ ] All exercises per day are visible
- [ ] Featured exercises show full progression (Week 1, 2, 3)
- [ ] Compound exercises clearly show parent + sub-exercises with indentation
- [ ] ASCII-only characters (no unicode corruption)
- [ ] Colors improve readability without overwhelming
- [ ] TypeScript compilation succeeds (`npm run typecheck`)
- [ ] Manual testing checklist complete

---

## Success Criteria

- [ ] `npm run cli:interactive` displays formatted workout after generation
- [ ] Program overview shows all metadata (name, weeks, days, difficulty, equipment, duration)
- [ ] All exercises listed per day with category badges
- [ ] Compound exercises (EMOM/Circuit/AMRAP/Interval) show indented sub-exercises
- [ ] 2-3 featured exercises per day show full week-by-week progression
- [ ] Non-featured exercises show name + category badge only
- [ ] Output is concise (<100 lines typical, ASCII-only)
- [ ] Code follows CLAUDE.md standards (ES Modules, TypeScript, no unicode)
- [ ] Formatter functions are reusable for future CLI editing ticket
- [ ] TypeScript types are properly imported from `src/lib/engine/types.ts`
- [ ] Manual testing passes for 3+ different questionnaire inputs

---

## Dependencies

### Blocked By
- None

### Blocks
- Future ticket: CLI Interactive Editing (will reuse `workout-formatter.ts`)

### External Dependencies
- `chalk` package (check if installed, add if needed: `npm install chalk`)

---

## Risks & Mitigations

### Risk 1: Output too verbose for large programs (12+ week programs)
- **Impact**: Medium
- **Probability**: Medium
- **Mitigation**:
  - Limit featured exercises to 2-3 per day (not all exercises)
  - For programs >6 weeks, only show Week 1, Week 6, and final week progression
  - Add optional `--compact` flag to show exercise names only (future enhancement)

### Risk 2: Compound exercise formatting unclear
- **Impact**: Low
- **Probability**: Low
- **Mitigation**:
  - Use clear indentation ("  - " prefix for sub-exercises)
  - Show parent name + category badge prominently
  - Test with all compound types (EMOM, Circuit, AMRAP, Interval)

### Risk 3: Unicode corruption in terminal output
- **Impact**: High
- **Probability**: Low
- **Mitigation**:
  - Use only ASCII characters: +, -, |, =, spaces
  - NEVER use unicode box-drawing characters (├─│└)
  - Test in multiple terminal environments (bash, zsh, Windows cmd)

### Risk 4: Chalk color support varies by terminal
- **Impact**: Low
- **Probability**: Medium
- **Mitigation**:
  - Use `chalk` library which auto-detects terminal color support
  - Ensure output is readable without colors (colors are enhancement only)
  - Test in color and no-color terminals

---

## Notes

### Design Decisions

1. **Featured Exercise Selection**: Use heuristic of "first 2-3 non-warmup exercises per day" rather than trying to identify "main compound lifts" from exercise database, to keep logic simple and deterministic.

2. **Progression Display**: Show all weeks (Week 1, Week 2, Week 3) for 3-week programs. For longer programs (6+ weeks), consider showing Week 1, midpoint, and final week to keep output concise.

3. **Compound Exercise Indentation**: Use "  - " prefix for sub-exercises to clearly show hierarchy without complex ASCII tree structures.

4. **Color Scheme** (tentative):
   - Headers (day focus): cyan/bold
   - Category badges: yellow (warmup), green (strength), magenta (emom/circuit/amrap), blue (cardio/mobility)
   - Exercise names: white/default
   - Progression details: gray/dim

5. **Output Length**: Target <100 lines for typical 3-week, 5-day program. If output exceeds 150 lines, consider adding `--compact` mode in future iteration.

### Future Enhancements (Not in this ticket)

- Interactive navigation (press 'n' for next day, 'p' for previous)
- Filtering (show only warmup, only strength, etc.)
- Export to markdown format
- Comparison view (show differences between weeks side-by-side)

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
- [ ] TypeScript compilation succeeds
- [ ] `npm run cli:interactive` displays formatted workout
- [ ] Manual testing checklist complete (3+ different inputs)
- [ ] Code reviewed (by code-quality-assessor agent if available)
- [ ] Success criteria met
- [ ] Committed with proper commit message
- [ ] CLAUDE.md "Current Development Status" updated

---

## Example Output Format

```
============================================================
WORKOUT PROGRAM GENERATED
============================================================
Program: 3-Week ULPPL Strength Program
Description: Upper/Lower/Push/Pull/Legs progressive density program
Version: 2.0.0
Weeks: 3
Days per Week: 5
Difficulty: Intermediate
Equipment: Barbell, Dumbbells, Pull-up Bar, Bench
Estimated Duration: 60 minutes
============================================================

DAY 1: Push (Gym)
------------------------------------------------------------
1. [WARMUP] Dynamic Upper Body Warm-up
2. [STRENGTH] Bench Press (FEATURED)
   Week 1: 4 sets x 5 reps @ 70% TM, 90s rest
   Week 2: 4 sets x 4 reps @ 75% TM, 75s rest
   Week 3: 4 sets x 3 reps @ 80% TM, 60s rest
3. [STRENGTH] Overhead Press (FEATURED)
   Week 1: 4 sets x 5 reps @ moderate, 90s rest
   Week 2: 4 sets x 4 reps @ moderate_heavy, 75s rest
   Week 3: 4 sets x 3 reps @ heavy, 60s rest
4. [EMOM] EMOM 10 minutes: Pull-ups / Push-ups
   - Pull-ups
     Week 1: 8 reps | Week 2: 10 reps | Week 3: 12 reps
   - Push-ups
     Week 1: 15 reps | Week 2: 18 reps | Week 3: 20 reps
5. [CARDIO] Evening Walk

DAY 2: Lower (Gym)
------------------------------------------------------------
1. [WARMUP] Dynamic Lower Body Warm-up
2. [STRENGTH] Deadlift (FEATURED)
   Week 1: 5 sets x 5 reps @ 75% TM, 120s rest
   Week 2: 5 sets x 4 reps @ 80% TM, 120s rest
   Week 3: 5 sets x 3 reps @ 85% TM, 120s rest
3. [STRENGTH] Back Squat
4. [ACCESSORY] Romanian Deadlift
5. [MOBILITY] Pigeon Pose

... (Days 3-5)

============================================================
```

---

**Estimated Implementation Time**: 2-3 hours
