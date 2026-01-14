# Ticket #023: Chore - Exercise Database Cleanup and Expansion

**Status**: Completed
**Priority**: Medium
**Type**: chore
**Estimated Points**: 21
**Phase**: 1-Foundation

---

## Summary

Clean up anomalies in the exercise database (vague muscle groups, equipment inconsistencies, rep pattern standardization) and expand underrepresented categories (cardio, isometric, pull-up bar exercises) to provide better workout variety and generation quality.

## Background

**Current State (339 exercises)**:
- Category imbalance: strength (262/77%), mobility (50/15%), flexibility (20/6%), cardio (7/2%)
- Cardio category is critically underrepresented (only walks and 1 sprint)
- 9 vague/non-anatomical muscle group terms affecting 16 exercises
- 4 equipment inconsistencies affecting 9 exercises
- Only 5 isometric exercises and 5 pull-up bar exercises

**Why This Matters**:
- Workout generation relies on category diversity for balanced programs
- Vague muscle groups break filtering and muscle group coverage calculations
- Equipment inconsistencies confuse the equipment-based workout generation
- Limited cardio options means repetitive conditioning work
- Users with pull-up bars or seeking isometric training have few options

**Analysis Data**:
```
Category Distribution:
  cardio:      7 (2.1%)  <- CRITICAL
  flexibility: 20 (5.9%)
  mobility:    50 (14.7%)
  strength:    262 (77.3%)

Vague Muscle Groups (16 exercises):
  Upper Body (2), Lower Body (2), Stabilizers (2), Hips (2),
  Shins (2), Spine (2), IT Band (2), VMO (1), Grip (1)

Equipment Anomalies (9 exercises):
  Couch (1), Step (1), Light Weights (2), Bodyweight (5)
```

---

## Technical Requirements

### Data Files

**Primary files to modify**:
- `src/data/exercise_database.json` - Exercise metadata
- `src/data/exercise_descriptions.json` - Exercise descriptions

**Files to read for context**:
- `src/lib/engine/exercise-selector.ts` - How exercises are filtered
- `src/data/workout_generation_rules.json` - Category/equipment configs

### Exercise Schema

```typescript
interface Exercise {
  category: "strength" | "mobility" | "flexibility" | "cardio";
  typical_sets: number;
  typical_reps: string;  // "8-12", "30 seconds", "10"
  equipment: string[];
  muscle_groups: string[];
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  variations: string[];
  isometric: boolean;
  external_load: "always" | "sometimes" | "never";
}
```

### Valid Muscle Groups (canonical list)

**Upper Body**:
- Chest, Upper Chest, Shoulders, Front Delts, Side Delts, Rear Delts
- Lats, Upper Back, Back, Lower Back, Rhomboids, Traps, Middle Traps, Lower Traps
- Biceps, Triceps, Forearms, Brachialis, Rotator Cuff

**Lower Body**:
- Quadriceps, Hamstrings, Glutes, Calves, Adductors, Hip Flexors, Hip Abductors

**Core**:
- Core, Obliques

**Full Body**:
- Full Body, Cardiovascular, Legs

### Valid Equipment (canonical list)

**Gym**:
- Barbell, Plates, Dumbbells, Dumbbell, Kettlebell, Cable Machine
- Bench, Incline Bench, Squat Rack, Power Rack, Pull-up Bar
- Box, Platform, Resistance Band, Resistance Bands

**Specialty Bars** (keep as-is):
- Safety Squat Bar, Duffalo Bar, Trap Bar, Axle Bar, Cambered Bar
- T-Bar, Lat Pulldown Bar

**Machines** (keep as-is):
- Belt Squat Machine, Leg Extension Machine, Treadmill

**Other**:
- None, Wall, Foam Roller, Chains, Blocks, Weight Belt, Yoga Mat

---

## Implementation Phases

### Phase 1: Muscle Group Cleanup (3 points)

**Goal**: Replace vague muscle groups with anatomically correct terms

**Changes**:

| Vague Term | Exercises | Action |
|------------|-----------|--------|
| Upper Body | Upper Body Dynamic Warm-up, Dynamic Upper Body Warm-up | Remove (warmup routines don't need muscle groups) |
| Lower Body | Lower Body Warm-up, Dynamic Lower Body Warm-up | Remove (warmup routines don't need muscle groups) |
| Stabilizers | Single-Leg Stands, Tandem Walking | Replace with `Core` |
| Hips | Mobility Work, Child's Pose Stretch | Replace with `Hip Flexors` |
| Shins | Heel Walks, Ankle Pumps | Replace with `Calves` (tibialis is minor) |
| Spine | Cat-Cow Stretches, Seated Spinal Twist | Replace with `Core` |
| IT Band | IT Band Roll, IT Band Stretch | Replace with `Glutes` (IT band is connective tissue) |
| VMO | Terminal Knee Extensions | Replace with `Quadriceps` |
| Grip | Kettlebell Figure 8 | Replace with `Forearms` |

**Validation**:
- Run `npm run typecheck`
- Run muscle group analysis script to confirm no vague terms remain

---

### Phase 2: Equipment Cleanup (2 points)

**Goal**: Standardize equipment terminology

**Changes**:

| Current | Exercise | Action |
|---------|----------|--------|
| Couch | Couch Stretch | Replace with `Wall` (can use wall for same stretch) |
| Step | Step-Ups | Replace with `Box` |
| Light Weights | Progressive Warm-up, Power Prep Warm-up | Replace with `Dumbbells` |
| Bodyweight | Walking Lunges, Curtsy Lunges, Lateral Lunges, Calf Raises, Single-Leg Romanian Deadlift | Replace with `None` |

**Validation**:
- Run equipment analysis script to confirm no anomalies
- Verify exercises still appear in equipment-filtered searches

---

### Phase 3: Rep Pattern Standardization (2 points)

**Goal**: Standardize rep patterns for consistency

**Changes**:

| Current | Exercises | Action |
|---------|-----------|--------|
| "40 meters" | Single-Arm Farmers Carry | Change to `"30-40 meters"` (range format) |
| "20-30 meters" | Bear Crawl, Crab Walk | Keep (already range format) |
| "Multiple" | Jumping Jacks, High Knees, Butt Kicks, etc. (6 exercises) | Change to `"20-30"` reps |

**Note**: Time-based reps ("X minutes") are valid for mobility/flexibility/cardio and should remain.

**Validation**:
- Run rep pattern analysis script
- Confirm no "Multiple" or standalone distance values remain

---

### Phase 4: Cardio Category Expansion (5 points)

**Goal**: Add 15+ cardio exercises for workout variety

**Exercises to Add**:

```json
{
  "Running": {
    "category": "cardio",
    "typical_sets": 1,
    "typical_reps": "20-30 minutes",
    "equipment": ["None"],
    "muscle_groups": ["Cardiovascular", "Legs"],
    "difficulty": "Beginner",
    "variations": ["Jogging", "Sprint Intervals"],
    "isometric": false,
    "external_load": "never"
  },
  "Jogging": {
    "category": "cardio",
    "typical_sets": 1,
    "typical_reps": "15-30 minutes",
    "equipment": ["None"],
    "muscle_groups": ["Cardiovascular", "Legs"],
    "difficulty": "Beginner",
    "variations": ["Running"],
    "isometric": false,
    "external_load": "never"
  },
  "Cycling": {
    "category": "cardio",
    "typical_sets": 1,
    "typical_reps": "20-40 minutes",
    "equipment": ["None"],
    "muscle_groups": ["Cardiovascular", "Quadriceps", "Glutes"],
    "difficulty": "Beginner",
    "variations": ["Stationary Bike"],
    "isometric": false,
    "external_load": "never"
  },
  "Stationary Bike": {
    "category": "cardio",
    "typical_sets": 1,
    "typical_reps": "20-30 minutes",
    "equipment": ["None"],
    "muscle_groups": ["Cardiovascular", "Quadriceps"],
    "difficulty": "Beginner",
    "variations": ["Cycling"],
    "isometric": false,
    "external_load": "never"
  },
  "Rowing Machine": {
    "category": "cardio",
    "typical_sets": 1,
    "typical_reps": "15-20 minutes",
    "equipment": ["None"],
    "muscle_groups": ["Cardiovascular", "Back", "Legs"],
    "difficulty": "Beginner",
    "variations": [],
    "isometric": false,
    "external_load": "never"
  },
  "Jump Rope": {
    "category": "cardio",
    "typical_sets": 3,
    "typical_reps": "60 seconds",
    "equipment": ["None"],
    "muscle_groups": ["Cardiovascular", "Calves", "Shoulders"],
    "difficulty": "Intermediate",
    "variations": ["Double Unders"],
    "isometric": false,
    "external_load": "never"
  },
  "Double Unders": {
    "category": "cardio",
    "typical_sets": 3,
    "typical_reps": "20-30",
    "equipment": ["None"],
    "muscle_groups": ["Cardiovascular", "Calves", "Shoulders"],
    "difficulty": "Advanced",
    "variations": ["Jump Rope"],
    "isometric": false,
    "external_load": "never"
  },
  "Stair Climbing": {
    "category": "cardio",
    "typical_sets": 1,
    "typical_reps": "10-15 minutes",
    "equipment": ["None"],
    "muscle_groups": ["Cardiovascular", "Quadriceps", "Glutes", "Calves"],
    "difficulty": "Intermediate",
    "variations": [],
    "isometric": false,
    "external_load": "never"
  },
  "Elliptical": {
    "category": "cardio",
    "typical_sets": 1,
    "typical_reps": "20-30 minutes",
    "equipment": ["None"],
    "muscle_groups": ["Cardiovascular", "Full Body"],
    "difficulty": "Beginner",
    "variations": [],
    "isometric": false,
    "external_load": "never"
  },
  "Swimming": {
    "category": "cardio",
    "typical_sets": 1,
    "typical_reps": "20-30 minutes",
    "equipment": ["None"],
    "muscle_groups": ["Cardiovascular", "Full Body"],
    "difficulty": "Intermediate",
    "variations": [],
    "isometric": false,
    "external_load": "never"
  },
  "Battle Ropes": {
    "category": "cardio",
    "typical_sets": 4,
    "typical_reps": "30 seconds",
    "equipment": ["None"],
    "muscle_groups": ["Cardiovascular", "Shoulders", "Core"],
    "difficulty": "Intermediate",
    "variations": [],
    "isometric": false,
    "external_load": "never"
  },
  "Assault Bike": {
    "category": "cardio",
    "typical_sets": 1,
    "typical_reps": "10-20 minutes",
    "equipment": ["None"],
    "muscle_groups": ["Cardiovascular", "Full Body"],
    "difficulty": "Intermediate",
    "variations": [],
    "isometric": false,
    "external_load": "never"
  },
  "Ski Erg": {
    "category": "cardio",
    "typical_sets": 1,
    "typical_reps": "10-15 minutes",
    "equipment": ["None"],
    "muscle_groups": ["Cardiovascular", "Lats", "Core"],
    "difficulty": "Intermediate",
    "variations": [],
    "isometric": false,
    "external_load": "never"
  },
  "Sprint Intervals": {
    "category": "cardio",
    "typical_sets": 8,
    "typical_reps": "30 seconds",
    "equipment": ["None"],
    "muscle_groups": ["Cardiovascular", "Legs"],
    "difficulty": "Advanced",
    "variations": ["Running"],
    "isometric": false,
    "external_load": "never"
  },
  "Hill Sprints": {
    "category": "cardio",
    "typical_sets": 6,
    "typical_reps": "20 seconds",
    "equipment": ["None"],
    "muscle_groups": ["Cardiovascular", "Glutes", "Quadriceps"],
    "difficulty": "Advanced",
    "variations": ["Sprint Intervals"],
    "isometric": false,
    "external_load": "never"
  }
}
```

**Also add descriptions to exercise_descriptions.json for each**

**Validation**:
- Cardio category should have 20+ exercises after this phase
- Run category analysis to confirm

---

### Phase 5: Isometric and Pull-up Bar Expansion (5 points)

**Goal**: Add isometric holds and pull-up bar exercises

**Isometric Exercises to Add**:

```json
{
  "Dead Hang": {
    "category": "strength",
    "typical_sets": 3,
    "typical_reps": "30-60 seconds",
    "equipment": ["Pull-up Bar"],
    "muscle_groups": ["Forearms", "Lats", "Shoulders"],
    "difficulty": "Beginner",
    "variations": ["Active Hang"],
    "isometric": true,
    "external_load": "never"
  },
  "Active Hang": {
    "category": "strength",
    "typical_sets": 3,
    "typical_reps": "20-30 seconds",
    "equipment": ["Pull-up Bar"],
    "muscle_groups": ["Lats", "Shoulders", "Core"],
    "difficulty": "Intermediate",
    "variations": ["Dead Hang"],
    "isometric": true,
    "external_load": "never"
  },
  "L-Sit": {
    "category": "strength",
    "typical_sets": 3,
    "typical_reps": "10-20 seconds",
    "equipment": ["None"],
    "muscle_groups": ["Core", "Hip Flexors", "Triceps"],
    "difficulty": "Advanced",
    "variations": ["Tuck L-Sit"],
    "isometric": true,
    "external_load": "never"
  },
  "Tuck L-Sit": {
    "category": "strength",
    "typical_sets": 3,
    "typical_reps": "15-30 seconds",
    "equipment": ["None"],
    "muscle_groups": ["Core", "Hip Flexors"],
    "difficulty": "Intermediate",
    "variations": ["L-Sit"],
    "isometric": true,
    "external_load": "never"
  },
  "Arch Hold": {
    "category": "strength",
    "typical_sets": 3,
    "typical_reps": "20-30 seconds",
    "equipment": ["None"],
    "muscle_groups": ["Lower Back", "Glutes"],
    "difficulty": "Beginner",
    "variations": ["Superman Hold"],
    "isometric": true,
    "external_load": "never"
  },
  "Superman Hold": {
    "category": "strength",
    "typical_sets": 3,
    "typical_reps": "20-30 seconds",
    "equipment": ["None"],
    "muscle_groups": ["Lower Back", "Glutes", "Shoulders"],
    "difficulty": "Beginner",
    "variations": ["Arch Hold"],
    "isometric": true,
    "external_load": "never"
  },
  "Glute Bridge Hold": {
    "category": "strength",
    "typical_sets": 3,
    "typical_reps": "30-45 seconds",
    "equipment": ["None"],
    "muscle_groups": ["Glutes", "Hamstrings", "Core"],
    "difficulty": "Beginner",
    "variations": ["Glute Bridge"],
    "isometric": true,
    "external_load": "never"
  },
  "Horse Stance": {
    "category": "strength",
    "typical_sets": 3,
    "typical_reps": "30-60 seconds",
    "equipment": ["None"],
    "muscle_groups": ["Quadriceps", "Glutes", "Core"],
    "difficulty": "Intermediate",
    "variations": ["Wall Sit"],
    "isometric": true,
    "external_load": "never"
  }
}
```

**Pull-up Bar Exercises to Add**:

```json
{
  "Chin-Up": {
    "category": "strength",
    "typical_sets": 3,
    "typical_reps": "6-10",
    "equipment": ["Pull-up Bar"],
    "muscle_groups": ["Biceps", "Lats", "Rhomboids"],
    "difficulty": "Intermediate",
    "variations": ["Pull-ups"],
    "isometric": false,
    "external_load": "never"
  },
  "Neutral Grip Pull-Up": {
    "category": "strength",
    "typical_sets": 3,
    "typical_reps": "6-10",
    "equipment": ["Pull-up Bar"],
    "muscle_groups": ["Lats", "Biceps", "Brachialis"],
    "difficulty": "Intermediate",
    "variations": ["Pull-ups", "Chin-Up"],
    "isometric": false,
    "external_load": "never"
  },
  "Muscle-Up": {
    "category": "strength",
    "typical_sets": 3,
    "typical_reps": "3-5",
    "equipment": ["Pull-up Bar"],
    "muscle_groups": ["Lats", "Chest", "Triceps", "Core"],
    "difficulty": "Advanced",
    "variations": ["Pull-ups"],
    "isometric": false,
    "external_load": "never"
  },
  "Toes to Bar": {
    "category": "strength",
    "typical_sets": 3,
    "typical_reps": "8-12",
    "equipment": ["Pull-up Bar"],
    "muscle_groups": ["Core", "Hip Flexors", "Lats"],
    "difficulty": "Advanced",
    "variations": ["Hanging Leg Raises"],
    "isometric": false,
    "external_load": "never"
  },
  "Hanging Knee Raise": {
    "category": "strength",
    "typical_sets": 3,
    "typical_reps": "10-15",
    "equipment": ["Pull-up Bar"],
    "muscle_groups": ["Core", "Hip Flexors"],
    "difficulty": "Intermediate",
    "variations": ["Hanging Leg Raises"],
    "isometric": false,
    "external_load": "never"
  },
  "Scapular Pull-Up": {
    "category": "strength",
    "typical_sets": 3,
    "typical_reps": "10-15",
    "equipment": ["Pull-up Bar"],
    "muscle_groups": ["Lower Traps", "Rhomboids", "Lats"],
    "difficulty": "Beginner",
    "variations": ["Active Hang"],
    "isometric": false,
    "external_load": "never"
  }
}
```

**Validation**:
- Isometric exercises should be 12+ (up from 5)
- Pull-up Bar exercises should be 11+ (up from 5)

---

### Phase 6: Strength Gaps (2 points)

**Goal**: Add commonly missing strength exercises

**Note**: The following already exist and were removed from this list:
- Pike Push-ups (exists)
- Diamond Push-ups (exists)
- Pistol Squat (exists)
- Barbell Good Morning (exists)

**Exercises to Add**:

```json
{
  "Nordic Curl": {
    "category": "strength",
    "typical_sets": 3,
    "typical_reps": "4-8",
    "equipment": ["None"],
    "muscle_groups": ["Hamstrings"],
    "difficulty": "Advanced",
    "variations": ["Romanian Deadlift"],
    "isometric": false,
    "external_load": "never"
  },
  "Sissy Squat": {
    "category": "strength",
    "typical_sets": 3,
    "typical_reps": "8-12",
    "equipment": ["None"],
    "muscle_groups": ["Quadriceps"],
    "difficulty": "Intermediate",
    "variations": ["Goblet Squat"],
    "isometric": false,
    "external_load": "never"
  },
  "Handstand Push-Up": {
    "category": "strength",
    "typical_sets": 3,
    "typical_reps": "3-6",
    "equipment": ["Wall"],
    "muscle_groups": ["Shoulders", "Triceps", "Core"],
    "difficulty": "Advanced",
    "variations": ["Pike Push-ups"],
    "isometric": false,
    "external_load": "never"
  },
  "Dip": {
    "category": "strength",
    "typical_sets": 3,
    "typical_reps": "8-12",
    "equipment": ["None"],
    "muscle_groups": ["Triceps", "Chest", "Shoulders"],
    "difficulty": "Intermediate",
    "variations": ["Tricep Dips"],
    "isometric": false,
    "external_load": "sometimes"
  }
}
```

**Validation**:
- Run full analysis script to verify all categories balanced
- Total exercises should be 365+ after all phases

---

## Testing Strategy

### Unit Tests
- None required (data-only changes)

### Integration Tests
- Run workout generation with various questionnaire inputs
- Verify new exercises appear in generated workouts
- Verify cardio exercises appear in programs with cardio goals

### Manual Testing
- Generate workouts with different equipment settings
- Verify new muscle groups filter correctly in Exercise Browser
- Spot-check exercise descriptions display correctly

---

## Success Criteria

1. **No vague muscle groups**: All 9 vague terms replaced or removed
2. **Equipment standardized**: No anomalies (Couch, Step, Light Weights, Bodyweight)
3. **Cardio expanded**: 20+ cardio exercises (up from 7)
4. **Isometric expanded**: 12+ isometric exercises (up from 5)
5. **Pull-up Bar expanded**: 11+ exercises (up from 5)
6. **Total exercises**: 365+ (up from 339)
7. **All JSON valid**: Both data files parse without errors
8. **Tests pass**: All existing tests still pass
9. **Validation scripts integrated**: Exercise DB validation runs as part of `npm run typecheck`

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking exercise references in variations | Update variation arrays when renaming |
| Workout generation breaks | Run integration tests after each phase |
| Missing descriptions for new exercises | Add descriptions in same commit as exercises |
| Category imbalance persists | Verify counts after each phase |

---

## Dependencies

- None (standalone data cleanup)

---

## Notes

- Phases can be done in any order, but 1-3 (cleanup) should precede 4-6 (expansion)
- Each phase should be a separate commit for easy rollback
- Run analysis script after each phase to verify progress
- Consider adding more exercises in future tickets (machines, resistance bands)

---

## Phase 7: Validation Script Integration (2 points)

**Goal**: Integrate exercise database validation into standard typecheck to maintain data quality going forward

**Scripts to Create** (`scripts/validate-exercise-db.ts`):

```typescript
/**
 * Exercise Database Validation Script
 * Run as part of npm run typecheck to ensure data quality
 */

// Validation checks:
// 1. JSON validity (parse without errors)
// 2. No vague muscle groups (Upper Body, Lower Body, Stabilizers, etc.)
// 3. No equipment anomalies (Couch, Light Weights, Bodyweight, etc.)
// 4. No duplicate exercises (plural/singular, case variants)
// 5. All exercises have required fields
// 6. All variation references point to existing exercises
// 7. Category distribution warnings (cardio < 10%, etc.)
```

**Package.json Updates**:

```json
{
  "scripts": {
    "validate:exercises": "tsx scripts/validate-exercise-db.ts",
    "typecheck": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json && npm run validate:exercises"
  }
}
```

**Validation Rules (configurable)**:

```typescript
const INVALID_MUSCLE_GROUPS = [
  'Upper Body', 'Lower Body', 'Stabilizers', 'Hips', 'Shins',
  'Spine', 'IT Band', 'VMO', 'Grip', 'Cardio', 'None', 'Knees'
];

const INVALID_EQUIPMENT = [
  'Couch', 'Light Weights', 'Bodyweight', 'Varies', 'Kitchen', 'Towel'
];

const CATEGORY_MINIMUMS = {
  cardio: 15,
  flexibility: 15,
  mobility: 30,
  strength: 100
};
```

**Exit Codes**:
- 0: All validations pass
- 1: Critical errors (invalid JSON, missing fields, invalid terms)
- 2: Warnings only (category imbalance, low counts)

**CI Integration**:
- Validation runs on every PR via `npm run typecheck`
- Blocks merge if critical errors found
- Logs warnings but allows merge for non-critical issues

---

## Data Quality Principles

Going forward, the exercise database should be maintained with these principles:

1. **Anatomically Correct Muscle Groups**: Use specific muscle names, not body regions
2. **Standardized Equipment**: Use canonical equipment names from the approved list
3. **Singular Exercise Names**: Prefer singular form (Squat, not Squats)
4. **Consistent Capitalization**: Capital after hyphens (Single-Leg, not Single-leg)
5. **Abbreviations**: DB for Dumbbell only when name exceeds 15 characters
6. **No Duplicates**: Check for existing exercises before adding new ones
7. **Complete Descriptions**: Every exercise in database must have a description
8. **Balanced Categories**: Maintain reasonable distribution across categories
