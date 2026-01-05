# Workout Template Specification v2.0

**Version**: 2.0.0
**Date**: 2026-01-03
**Status**: Approved for Implementation

---

## Design Principles

1. **Explicitness over cleverness** - No magic, no assumptions
2. **Flexible schemas** - Only include fields that are needed
3. **Exercise-level granularity** - Full control at the exercise level
4. **Exercise DB as source of truth** - Reference exercises by name, metadata lives in DB
5. **Categories, not sections** - UI handles grouping, data stays flat
6. **Concrete outputs** - Generated workouts have explicit week-by-week values, no template variables

---

## Top-Level Workout Structure

```json
{
  "id": "string",
  "name": "string",
  "description": "string",
  "version": "string",
  "weeks": number,
  "daysPerWeek": number,
  "metadata": {
    "difficulty": "Beginner | Intermediate | Advanced | Expert",
    "equipment": ["string"],
    "estimatedDuration": "string",
    "tags": ["string"]
  },
  "days": {
    "1": { /* Day structure */ },
    "2": { /* Day structure */ }
    // Days not defined = implicit rest days
  }
}
```

### Key Rules:
- **Rest days are implicit**: If a day number isn't defined, it's a rest day
- **Days object**: Keys are day numbers (1-7), values are day objects
- **daysPerWeek**: Indicates how many training days per week (doesn't have to match defined days count)

---

## Day Structure

```json
{
  "dayNumber": number,
  "type": "gym | home | outdoor | recovery",
  "focus": "string",  // e.g., "Push", "Pull", "Legs", "Upper", "Full Body"
  "exercises": [
    { /* Exercise structure */ }
  ]
}
```

### Key Rules:
- **No sections**: Exercises are a flat array
- **Category-based grouping**: UI groups exercises by `category` field for display
- **Exercise order**: Array order determines workout sequence

---

## Exercise Structure

### Base Exercise

```json
{
  "name": "string",  // Lookup key for exercise_database.json
  "category_override": "string | null",  // Optional: override DB category (rare)
  "week1": { /* Progression data */ },
  "week2": { /* Progression data */ },
  "week3": { /* Progression data */ }
  // ... weekN for each week in program
}
```

### Compound Exercise (EMOM/AMRAP/Circuit/Interval)

```json
{
  "name": "EMOM 10 minutes",
  "category": "emom",
  "week1": {
    "work_time_minutes": 10,
    "work_time_unit": "minutes"
  },
  "week2": {
    "work_time_minutes": 12,
    "work_time_unit": "minutes"
  },
  "week3": {
    "work_time_minutes": 15,
    "work_time_unit": "minutes"
  },
  "sub_exercises": [
    {
      "name": "Pull-ups",
      "week1": {"reps": 8},
      "week2": {"reps": 10},
      "week3": {"reps": 12}
    },
    {
      "name": "Push-ups",
      "week1": {"reps": 15},
      "week2": {"reps": 18},
      "week3": {"reps": 20}
    }
  ]
}
```

### Key Rules:
- **Exercise reference**: `name` field references exercise_database.json for metadata
- **Category override**: Use `category_override` only when DB category doesn't fit (should be rare)
- **Sub-exercises**: Have their own weekly progression, independent of parent
- **Weekly progression**: Explicit for every week (week1, week2, ..., weekN)

---

## Weekly Progression Data (Flexible Schema)

Each `weekN` object contains only the fields relevant to that exercise type. **No null fields**.

### Common Fields:

| Field | Type | Description | Used For |
|-------|------|-------------|----------|
| `sets` | number | Number of sets | Strength, bodyweight |
| `reps` | number \| string | Reps per set (e.g., `5`, `"8-12"`, `"AMRAP"`) | Strength, bodyweight |
| `work_time_minutes` | number | Duration value (interpreted based on unit) | Mobility, cardio, intervals, EMOM |
| `work_time_unit` | "seconds" \| "minutes" | Explicit time unit for work_time | Mobility, cardio, intervals, EMOM |
| `rest_time_minutes` | number | Rest interval value (interpreted based on unit) | Strength, intervals, Tabata |
| `rest_time_unit` | "seconds" \| "minutes" | Explicit time unit for rest_time | Strength, intervals, Tabata |
| `weight` | mixed | Weight specification (see Weight Spec below) | Strength |
| `tempo` | string | Lifting tempo (e.g., `"3-1-2"`) | Strength (optional) |

**Note on Time Fields**: Time values are stored with explicit units to avoid floating point precision errors and ambiguity. The field name includes `_minutes` for backwards compatibility, but the actual unit is determined by the `_unit` field. For example:
- `work_time_minutes: 30, work_time_unit: "seconds"` = 30 seconds
- `rest_time_minutes: 2, rest_time_unit: "minutes"` = 2 minutes

### Examples by Exercise Type:

**Strength Exercise**:
```json
{
  "week1": {
    "sets": 4,
    "reps": 5,
    "rest_time_minutes": 3,
    "rest_time_unit": "minutes",
    "weight": "moderate"
  }
}
```

**Mobility/Cardio (Time-Based)**:
```json
{
  "week1": {
    "work_time_minutes": 8,
    "work_time_unit": "minutes"
  }
}
```

**Interval Exercise**:
```json
{
  "week1": {
    "sets": 3,
    "work_time_minutes": 45,
    "work_time_unit": "seconds",
    "rest_time_minutes": 15,
    "rest_time_unit": "seconds"
  }
}
```

**EMOM Parent**:
```json
{
  "week1": {
    "work_time_minutes": 10,
    "work_time_unit": "minutes"
  }
}
```

---

## Intra-Week Set Variation (set_blocks)

For advanced programs that vary weight/reps across sets within the same workout (e.g., nSuns):

```json
{
  "name": "Bench Press",
  "week1": {
    "set_blocks": [
      {"sets": 4, "reps": 4, "weight": {"type": "percent_tm", "value": 72.3}},
      {"sets": 2, "reps": 4, "weight": {"type": "percent_tm", "value": 76.6}},
      {"sets": 1, "reps": 4, "weight": {"type": "percent_tm", "value": 78.7}}
    ]
  }
}
```

### Key Rules:
- **set_blocks**: Array of set block objects
- **Each block**: Specifies sets, reps, and parameters for that block
- **Execution order**: Blocks are performed in array order
- **Mutually exclusive**: Use `set_blocks` OR flat `sets/reps`, never both

---

## Weight Specification (Extensible)

Weight can be specified in multiple formats:

### Format 1: Relative Descriptor (String)

```json
{"weight": "light"}
{"weight": "moderate"}
{"weight": "moderate_heavy"}
{"weight": "heavy"}
{"weight": "max"}
```

**Use case**: Beginner-friendly, no calculations needed

### Format 2: Percentage of Training Max (Object)

```json
{"weight": {"type": "percent_tm", "value": 70}}
{"weight": {"type": "percent_tm", "value": 85.5}}
```

**Use case**: Powerlifting/strength programs, requires user TM input

### Format 3: Percentage of Bodyweight (Object)

```json
{"weight": {"type": "percent_bw", "value": 50}}
{"weight": {"type": "percent_bw", "value": 100}}
```

**Use case**: Bodyweight-relative exercises (weighted dips, pull-ups)

### Format 4: Absolute Weight (Object)

```json
{"weight": {"type": "absolute", "value": 135, "unit": "lbs"}}
{"weight": {"type": "absolute", "value": 60, "unit": "kg"}}
```

**Use case**: Fixed-weight exercises, rehab protocols

### Key Rules:
- **Extensible**: New weight types can be added without breaking existing workouts
- **Type discrimination**: Check `typeof weight` to determine format (string vs object)
- **User preference**: Generation engine chooses appropriate type based on user experience/equipment

---

## Complete Example Workout

```json
{
  "id": "strength-3week-ulppl",
  "name": "3-Week ULPPL Strength Program",
  "description": "Upper/Lower/Push/Pull/Legs progressive density program",
  "version": "2.0.0",
  "weeks": 3,
  "daysPerWeek": 5,
  "metadata": {
    "difficulty": "Intermediate",
    "equipment": ["Barbell", "Dumbbells", "Pull-up Bar", "Bench"],
    "estimatedDuration": "60 minutes",
    "tags": ["strength", "hypertrophy", "progressive_density"]
  },
  "days": {
    "1": {
      "dayNumber": 1,
      "type": "gym",
      "focus": "Push",
      "exercises": [
        {
          "name": "Dynamic Upper Body Warm-up",
          "week1": {"work_time": "8 minutes"},
          "week2": {"work_time": "8 minutes"},
          "week3": {"work_time": "8 minutes"}
        },
        {
          "name": "Bench Press",
          "week1": {
            "set_blocks": [
              {"sets": 4, "reps": 5, "rest_time": 90, "weight": {"type": "percent_tm", "value": 70}}
            ]
          },
          "week2": {
            "set_blocks": [
              {"sets": 4, "reps": 4, "rest_time": 75, "weight": {"type": "percent_tm", "value": 75}}
            ]
          },
          "week3": {
            "set_blocks": [
              {"sets": 4, "reps": 3, "rest_time": 60, "weight": {"type": "percent_tm", "value": 80}}
            ]
          }
        },
        {
          "name": "Overhead Press",
          "week1": {
            "set_blocks": [
              {"sets": 4, "reps": 5, "rest_time": 90, "weight": "moderate"}
            ]
          },
          "week2": {
            "set_blocks": [
              {"sets": 4, "reps": 4, "rest_time": 75, "weight": "moderate_heavy"}
            ]
          },
          "week3": {
            "set_blocks": [
              {"sets": 4, "reps": 3, "rest_time": 60, "weight": "heavy"}
            ]
          }
        },
        {
          "name": "EMOM 10 minutes: Pull-ups / Push-ups",
          "category": "emom",
          "week1": {"work_time": "10 minutes"},
          "week2": {"work_time": "12 minutes"},
          "week3": {"work_time": "15 minutes"},
          "sub_exercises": [
            {
              "name": "Pull-ups",
              "week1": {"reps": 8},
              "week2": {"reps": 10},
              "week3": {"reps": 12}
            },
            {
              "name": "Push-ups",
              "week1": {"reps": 15},
              "week2": {"reps": 18},
              "week3": {"reps": 20}
            }
          ]
        },
        {
          "name": "Evening Walk",
          "week1": {"work_time": "18 minutes"},
          "week2": {"work_time": "18 minutes"},
          "week3": {"work_time": "18 minutes"}
        }
      ]
    },
    "2": {
      "dayNumber": 2,
      "type": "gym",
      "focus": "Lower",
      "exercises": [
        {
          "name": "Dynamic Lower Body Warm-up",
          "week1": {"work_time": "5 minutes"},
          "week2": {"work_time": "5 minutes"},
          "week3": {"work_time": "5 minutes"}
        },
        {
          "name": "Deadlift",
          "week1": {
            "set_blocks": [
              {"sets": 5, "reps": 5, "rest_time": 120, "weight": {"type": "percent_tm", "value": 75}}
            ]
          },
          "week2": {
            "set_blocks": [
              {"sets": 5, "reps": 4, "rest_time": 120, "weight": {"type": "percent_tm", "value": 80}}
            ]
          },
          "week3": {
            "set_blocks": [
              {"sets": 5, "reps": 3, "rest_time": 120, "weight": {"type": "percent_tm", "value": 85}}
            ]
          }
        }
      ]
    }
    // Days 3, 4, 5 defined similarly
    // Days 6, 7 not defined = implicit rest days
  }
}
```

---

## Migration from Current Templates

### ULPPL Template Migration

**Before** (weeklyProgression variables):
```json
{
  "weeklyProgression": {
    "strengthReps": {
      "week1": "5",
      "week2": "4",
      "week3": "3"
    }
  },
  "exercises": [
    {
      "name": "Bench Press",
      "sets": 4,
      "reps": "{{strengthReps}}"
    }
  ]
}
```

**After** (explicit week-by-week):
```json
{
  "exercises": [
    {
      "name": "Bench Press",
      "week1": {"sets": 4, "reps": 5, "rest_time": 90},
      "week2": {"sets": 4, "reps": 4, "rest_time": 75},
      "week3": {"sets": 4, "reps": 3, "rest_time": 60}
    }
  ]
}
```

### nSuns Template Migration

**Before** (complex schemas + variables):
```json
{
  "setupFields": {
    "primaryBenchPress": {...},
    "primaryBenchPress1RM": {...}
  },
  "weightCalculationSchemas": {...},
  "exercises": [
    {
      "name": "{{primaryBenchPress}}",
      "weight": "{{benchPressWeight}}"
    }
  ]
}
```

**After** (concrete generated workout):
```json
{
  "exercises": [
    {
      "name": "Flat Bench Press",
      "week1": {
        "set_blocks": [
          {"sets": 4, "reps": 4, "weight": {"type": "percent_tm", "value": 72.3}},
          {"sets": 2, "reps": 4, "weight": {"type": "percent_tm", "value": 76.6}}
        ]
      }
    }
  ]
}
```

**Note**: `setupFields` and `weightCalculationSchemas` logic moves to **generation engine**, not the output JSON.

---

## Validation Rules

### Required Fields:
- Top-level: `id`, `name`, `version`, `weeks`, `daysPerWeek`, `days`
- Day: `dayNumber`, `type`, `focus`, `exercises`
- Exercise: `name`, `week1` through `weekN` (where N = workout.weeks)

### Constraints:
- `dayNumber` must be 1-7
- `weeks` must be > 0
- `daysPerWeek` must be 1-7
- Every exercise must have progression data for ALL weeks (week1, week2, ..., weekN)
- `set_blocks` and flat `sets/reps` are mutually exclusive
- If `sub_exercises` exists, parent must have `category` field

### Optional Fields:
- `category_override` (use sparingly)
- `tempo`, `weight` (context-dependent)
- `metadata.tags`

---

## Generation Engine Responsibilities

The **workout generation engine** (CLI prototype) is responsible for:

1. **Questionnaire interpretation**: Map answers to workout parameters
2. **Exercise selection**: Filter exercise DB based on equipment, goals, experience
3. **Progression calculation**: Determine week-by-week progression for each exercise
4. **Weight assignment**: Choose appropriate weight type (descriptor vs percent_tm vs absolute)
5. **Concrete output**: Generate complete workout JSON with explicit weekN values for every exercise

**Generation engine does NOT**:
- Use template variables in output JSON
- Require user to fill in blanks
- Produce "blueprints" that need further processing

**Output is ready-to-use** by the frontend immediately.

---

## Frontend Responsibilities

The **frontend** (UI) is responsible for:

1. **Category-based grouping**: Group exercises by `category` for visual sections
2. **Week selection**: Show appropriate `weekN` data based on user's current week
3. **Exercise metadata lookup**: Fetch `muscle_groups`, `equipment`, `difficulty` from exercise DB
4. **Workout rendering**: Display exercises, sets, reps, rest times
5. **Completion tracking**: Record what user actually performed (saved to exercise history)

**Frontend does NOT**:
- Substitute template variables
- Calculate progressions
- Generate workouts

---

## Data Flow Summary

```
User fills questionnaire
         ↓
Generation Engine (CLI)
  - Selects exercises from exercise DB
  - Calculates week-by-week progression
  - Generates concrete workout JSON
         ↓
Workout JSON (complete, explicit)
         ↓
Frontend (UI)
  - Groups by category
  - Renders current week
  - Tracks completion
```

---

## Next Steps

1. **Exercise Database Spec**: Define exercise metadata structure, predefined categories
2. **Exercise History Spec**: Define completion tracking data structure
3. **Questionnaire Mapping**: Rules for questionnaire → workout parameters
4. **Generation Engine**: CLI implementation of workout generation logic
5. **MySpace Tom**: Default user data for testing

---

**End of Workout Template Specification v2.0**
