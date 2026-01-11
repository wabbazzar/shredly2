# Ticket #014: Exercise Database Gap Analysis - Dumbbell/Bodyweight PULL Deficit

**Type**: data
**Status**: OPEN (Investigation)
**Created**: 2026-01-10
**Estimated Points**: TBD (pending investigation)

---

## Overview

Analysis of the exercise database (261 exercises) reveals gaps in movement pattern coverage for equipment-restricted scenarios. Users who select "dumbbells only" have limited PULL exercise options compared to PUSH and LEGS.

**Critical Finding**: PULL exercises are underrepresented for minimal-equipment users, but the gap is smaller than initially thought because the filter already includes bench.

---

## Executive Summary (Using Actual Filter Logic)

| Equipment Level   | PUSH | PULL | LEGS | CORE | COMPOUND | FULL_BODY | Total |
|-------------------|------|------|------|------|----------|-----------|-------|
| dumbbells_only    |   19 |    4 |   15 |    4 |        4 |         2 |    48 |
| bodyweight_only   |    6 |    2 |   15 |    2 |        1 |         2 |    28 |
| home_gym_basic    |   22 |    7 |   21 |    5 |        7 |         5 |    67 |

**PUSH:PULL Ratios:**
- dumbbells_only: **4.75:1** (19 PUSH vs 4 PULL)
- bodyweight_only: **3:1** (6 PUSH vs 2 PULL)
- home_gym_basic: **3.14:1** (22 PUSH vs 7 PULL)

The ideal PUSH:PULL ratio is approximately 1:1 for balanced programming.

---

## Current Filter Configuration

The equipment filter is defined in `src/lib/engine/exercise-selector.ts:160-175`:

```typescript
const equipmentByAccess: { [key: string]: string[] } = {
  commercial_gym: [...full list...],
  full_gym: [...full list...],
  home_gym_full: ["Barbell", "Dumbbell", "Dumbbells", "Bench", "Plates", "Pull-up Bar",
                   "Squat Rack", "Power Rack", "Kettlebell", "Resistance Bands",
                   "Chair", "Wall", "Mat", "Foam Roller", "None"],
  home_gym_basic: ["Dumbbell", "Dumbbells", "Bench", "Resistance Bands", "Kettlebell",
                    "Pull-up Bar", "Chair", "Wall", "Mat", "Foam Roller", "None"],
  dumbbells_only: ["Dumbbell", "Dumbbells", "Bench", "Chair", "Wall", "Mat", "None"],
  bodyweight_only: ["None", "Pull-up Bar", "Chair", "Wall", "Mat", "Box", "Platform"],
  minimal_equipment: ["None", "Resistance Bands", "Chair", "Wall", "Mat", "Dumbbell"]
};
```

**Key Observation**: `dumbbells_only` already includes `"Bench"` but NOT `"Pull-up Bar"`.

---

## Proposed Quick Fix: Add Pull-up Bar to dumbbells_only

### Rationale

For users selecting "dumbbells only", we should assume basic home equipment is available:
- **Bench** - Already included (good)
- **Pull-up Bar** - Missing, but doorframe pull-up bars are cheap and common

### Code Change Location

**File**: `src/lib/engine/exercise-selector.ts`
**Line**: 172

**Current:**
```typescript
dumbbells_only: ["Dumbbell", "Dumbbells", "Bench", "Chair", "Wall", "Mat", "None"],
```

**Proposed:**
```typescript
dumbbells_only: ["Dumbbell", "Dumbbells", "Bench", "Pull-up Bar", "Chair", "Wall", "Mat", "None"],
```

### Impact of This Change

Adding `"Pull-up Bar"` to `dumbbells_only` would unlock **4 additional PULL exercises**:

| Exercise | Equipment | Muscles |
|----------|-----------|---------|
| Pull-ups | Pull-up Bar | Lats, Biceps, Rhomboids |
| Bodyweight Chin/Pull-Ups | Pull-up Bar | Lats, Biceps, Rhomboids |
| Weighted Chin/Pull-Ups | Pull-up Bar, Weight Belt, Plates | Lats, Biceps, Rhomboids |
| Weighted Pull-Ups | Pull-up Bar, Weight Belt, Plates | Lats, Biceps, Rhomboids |

**Note**: Weighted variants require Weight Belt + Plates which aren't in the filter, so only **2 exercises** (Pull-ups, Bodyweight Chin/Pull-Ups) would actually be unlocked.

**Result After Change:**
- dumbbells_only PULL: 4 -> 6 exercises
- PUSH:PULL ratio: 4.75:1 -> 3.17:1 (improved)

---

## Current PULL Exercises by Equipment Level

### dumbbells_only PULL (4 exercises)

| Exercise | Equipment | Muscles |
|----------|-----------|---------|
| 1 Arm DB Row | Dumbbell, Bench | Lats, Rhomboids, Biceps |
| Dumbbell Bicep Curls | Dumbbells | Biceps, Forearms |
| Dumbbell Rows | Dumbbells | Lats, Rhomboids, Biceps |
| Single-arm Dumbbell Rows | Dumbbells, Bench | Lats, Rhomboids, Biceps |

### bodyweight_only PULL (2 exercises)

| Exercise | Equipment | Muscles |
|----------|-----------|---------|
| Bodyweight Chin/Pull-Ups | Pull-up Bar | Lats, Biceps, Rhomboids |
| Pull-ups | Pull-up Bar | Lats, Biceps, Rhomboids |

### home_gym_basic PULL (7 exercises)

| Exercise | Equipment | Muscles |
|----------|-----------|---------|
| 1 Arm DB Row | Dumbbell, Bench | Lats, Rhomboids, Biceps |
| Bodyweight Chin/Pull-Ups | Pull-up Bar | Lats, Biceps, Rhomboids |
| Dumbbell Bicep Curls | Dumbbells | Biceps, Forearms |
| Dumbbell Rows | Dumbbells | Lats, Rhomboids, Biceps |
| Kettlebell Gorilla Row | Kettlebell | Back, Biceps, Core |
| Pull-ups | Pull-up Bar | Lats, Biceps, Rhomboids |
| Single-arm Dumbbell Rows | Dumbbells, Bench | Lats, Rhomboids, Biceps |

---

## Exercises Excluded from dumbbells_only (Available in home_gym_basic)

19 exercises are in `home_gym_basic` but NOT in `dumbbells_only`:

### PULL (3 exercises) - High Priority Gap

| Exercise | Missing Equipment |
|----------|-------------------|
| Bodyweight Chin/Pull-Ups | Pull-up Bar |
| Pull-ups | Pull-up Bar |
| Kettlebell Gorilla Row | Kettlebell |

### Other Patterns (16 exercises)

- **COMPOUND (3)**: KB Swing, Kettlebell Halo, Kettlebell Swings - all require Kettlebell
- **CORE (1)**: Kettlebell Figure 8 - requires Kettlebell
- **FULL_BODY (3)**: Kettlebell Clean, Kettlebell Snatch, Turkish Get-Up - require Kettlebell
- **LEGS (6)**: Goblet Squat variants, Hanging Leg Raises, Kettlebell Rack Squat, Single-leg Deadlifts - require Kettlebell or Pull-up Bar
- **PUSH (3)**: Kettlebell Bottoms-Up Press, Kettlebell Windmill, Single-arm Overhead Carry - require Kettlebell

---

## Equipment That Would Unlock More PULL Exercises

| Equipment | PULL Exercises Unlocked | Exercise Names |
|-----------|------------------------|----------------|
| **Barbell** | 11 | Bent-Over Row, Strict Barbell Row, Barbell Cheat Row, Reverse Grip BB Row, Landmine Single Arm Row, Bent-Over Rows, Pendlay Row, Yates Row, Barbell Shrug, Barbell Curl, Meadows Row |
| **Plates** | 11 | (overlap with Barbell) |
| **Pull-up Bar** | 4 | Pull-ups, Weighted Chin/Pull-Ups, Weighted Pull-Ups, Bodyweight Chin/Pull-Ups |
| **Cable Machine** | 4 | Cable Row, Cable High Row, Lat Pulldown, Reverse Fly |
| **Kettlebell** | 1 | Kettlebell Gorilla Row |

---

## Suggested Exercise Database Additions

Even with the filter fix, we should add more variety to the database.

### Priority 1: Pure Dumbbell PULL (No Bench Required)

| Exercise Name | Primary Muscles | Equipment | Difficulty |
|--------------|----------------|-----------|------------|
| Dumbbell Shrug | Traps, Upper Back | Dumbbells | Beginner |
| Hammer Curls | Biceps, Brachialis | Dumbbells | Beginner |
| Zottman Curls | Biceps, Forearms | Dumbbells | Intermediate |
| Concentration Curls | Biceps | Dumbbell | Beginner |
| Dumbbell High Pull | Traps, Rear Delts | Dumbbells | Intermediate |
| Prone Y-Raise | Rear Delts, Lower Traps | Dumbbells | Beginner |
| Prone T-Raise | Rear Delts, Rhomboids | Dumbbells | Beginner |
| Standing Reverse Fly | Rear Delts, Rhomboids | Dumbbells | Beginner |

### Priority 2: Bodyweight PULL (No Equipment)

| Exercise Name | Primary Muscles | Equipment | Difficulty |
|--------------|----------------|-----------|------------|
| Prone Superman | Lower Back, Glutes, Rear Delts | None | Beginner |
| Reverse Snow Angel | Rear Delts, Rhomboids, Traps | None | Beginner |
| Prone Y-T-W Raises | Rear Delts, Traps, Rhomboids | None | Beginner |
| Scapular Retractions | Rhomboids, Middle Traps | None | Beginner |

---

## Implementation Plan

### Phase 1: Filter Fix (Quick Win) - 1 point

1. Add `"Pull-up Bar"` to `dumbbells_only` equipment list
2. **File**: `src/lib/engine/exercise-selector.ts:172`
3. Update tests if needed
4. Verify with analysis script

### Phase 2: Exercise Database Additions - 3-5 points

1. Add 8+ dumbbell PULL exercises to database
2. Add 4+ bodyweight PULL exercises to database
3. Ensure proper metadata (muscle_groups, difficulty, equipment, external_load, isometric)
4. Run analysis script to verify improved ratios

---

## Success Criteria

After implementation:
- [ ] `dumbbells_only` PULL exercises >= 8 (from 4)
- [ ] `bodyweight_only` PULL exercises >= 6 (from 2)
- [ ] PUSH:PULL ratio for `dumbbells_only` <= 2.5:1 (from 4.75:1)
- [ ] Generated workouts for dumbbells-only users show exercise variety on PULL days
- [ ] All new exercises have proper metadata

---

## Testing Strategy

1. Run `npx tsx tmp/exercise-analysis-v2.ts` to verify counts
2. Generate sample workouts with `equipment_access: "dumbbells_only"`
3. Verify PULL day exercises have variety
4. Check no duplicate exercise names in database

---

## Related Files

| File | Purpose |
|------|---------|
| `src/lib/engine/exercise-selector.ts:160-175` | Equipment filter definition |
| `src/lib/engine/exercise-selector.ts:177-181` | `hasEquipmentAccess()` function |
| `src/data/exercise_database.json` | Exercise database |
| `tmp/exercise-analysis-v2.ts` | Analysis script (uses actual filter logic) |

---

## Decision Points

1. **Add Pull-up Bar to dumbbells_only?** - Recommended, assumes basic home equipment
2. **Add Kettlebell to dumbbells_only?** - Optional, less common in home gyms
3. **Which new exercises to add?** - See Priority 1 and 2 lists above
4. **Rename "dumbbells_only" to "home_basics"?** - Would better reflect bench + pull-up bar inclusion

---

**Investigation Status**: Analysis complete with corrected numbers. Ready for implementation decision.
