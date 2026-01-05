# Exercise History Specification v2.0

**Version**: 2.0.0
**Date**: 2026-01-03
**Status**: Approved

---

## Design Principles

1. **Tidy Data** - Each row is one set block, each column is one variable
2. **Append-Only CSV** - Historical data never modified, only appended to localStorage
3. **Compound Support** - Parent row + sub-exercise rows for EMOM/Circuit/AMRAP/Interval
4. **Cross-referenced** - All variable fields align with WORKOUT_SPEC.md

---

## Storage

**Location**: `localStorage` key: `shredly_exercise_history_v2`
**Format**: CSV (UTF-8, LF line endings)
**Capacity**: ~60,000 rows (5-10MB)

---

## CSV Schema (20 Columns)

```csv
date,timestamp,workout_program_id,week_number,day_number,exercise_name,exercise_order,is_compound_parent,compound_parent_name,set_number,reps,weight,weight_unit,work_time,rest_time,tempo,rpe,rir,completed,notes
```

---

## Column Definitions

### Core Metadata

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| `date` | ISO 8601 date | Yes | Date exercise performed |
| `timestamp` | ISO 8601 datetime | Yes | Exact time logged |
| `workout_program_id` | string | Yes | Links to workout program |
| `week_number` | integer | Yes | Week within program (1-indexed) |
| `day_number` | integer | Yes | Day within week (1-7) |
| `exercise_name` | string | Yes | Links to exercise_database.json |
| `exercise_order` | integer | Yes | Position in workout (0-indexed) |
| `is_compound_parent` | boolean | Yes | True if EMOM/Circuit/AMRAP/Interval parent |
| `compound_parent_name` | string \| null | No | Links sub-exercise to parent |
| `set_number` | integer | Yes | Set number (1-indexed) |

### Performance Data

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| `reps` | integer \| null | No | Reps completed |
| `weight` | float \| null | No | Weight used |
| `weight_unit` | string \| null | No | "lbs" or "kg" |
| `work_time` | integer \| null | No | Work duration (seconds) |
| `rest_time` | integer \| null | No | Rest interval (seconds) |
| `tempo` | string \| null | No | Lifting tempo (e.g., "3-1-2") |

### Subjective Tracking

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| `rpe` | integer \| null | No | Rate of Perceived Exertion (1-10) |
| `rir` | integer \| null | No | Reps In Reserve (0-5+) |
| `completed` | boolean | Yes | Was set performed? |
| `notes` | string \| null | No | User notes |

**RPE Scale**: 1=Very light, 7=Hard, 10=Max effort
**RIR Scale**: 0=Failure, 2=Could do 2 more, 5+=Easy

---

## Example Data

### Standalone Exercise (Bench Press)

```csv
date,timestamp,workout_program_id,week_number,day_number,exercise_name,exercise_order,is_compound_parent,compound_parent_name,set_number,reps,weight,weight_unit,work_time,rest_time,tempo,rpe,rir,completed,notes
2026-01-03,2026-01-03T14:23:45.123Z,strength-3week-ulppl,1,1,Bench Press,0,false,,1,5,135.0,lbs,,,90,,7,2,true,
2026-01-03,2026-01-03T14:25:30.456Z,strength-3week-ulppl,1,1,Bench Press,0,false,,2,5,135.0,lbs,,,90,,8,1,true,
```

### Compound Exercise (EMOM)

**Parent row + sub-exercise rows (same `exercise_order`, linked by `compound_parent_name`)**:

```csv
date,timestamp,workout_program_id,week_number,day_number,exercise_name,exercise_order,is_compound_parent,compound_parent_name,set_number,reps,weight,weight_unit,work_time,rest_time,tempo,rpe,rir,completed,notes
2026-01-03,2026-01-03T14:40:00.000Z,strength-3week-ulppl,1,1,EMOM 10 minutes,2,true,,1,,,,600,,,,true,Completed full block
2026-01-03,2026-01-03T14:40:15.000Z,strength-3week-ulppl,1,1,Pull-ups,2,false,EMOM 10 minutes,1,8,,,,,,,true,Minute 1
2026-01-03,2026-01-03T14:41:00.000Z,strength-3week-ulppl,1,1,Push-ups,2,false,EMOM 10 minutes,1,15,,,,,,,true,Minute 1
2026-01-03,2026-01-03T14:42:15.000Z,strength-3week-ulppl,1,1,Pull-ups,2,false,EMOM 10 minutes,2,8,,,,,,,true,Minute 2
2026-01-03,2026-01-03T14:43:00.000Z,strength-3week-ulppl,1,1,Push-ups,2,false,EMOM 10 minutes,2,14,,,,,,,true,Minute 2
```

---

## TypeScript Types

```typescript
export interface ExerciseHistoryRow {
  // Core metadata
  date: string;                      // ISO 8601 date
  timestamp: string;                 // ISO 8601 datetime
  workout_program_id: string;
  week_number: number;
  day_number: number;
  exercise_name: string;
  exercise_order: number;

  // Compound exercise linking
  is_compound_parent: boolean;       // true if EMOM/Circuit/AMRAP/Interval parent
  compound_parent_name: string | null;  // links sub-exercise to parent

  set_number: number;

  // Performance data
  reps: number | null;
  weight: number | null;
  weight_unit: 'lbs' | 'kg' | null;
  work_time: number | null;          // seconds
  rest_time: number | null;          // seconds
  tempo: string | null;

  // Subjective tracking
  rpe: number | null;                // 1-10
  rir: number | null;                // 0-5+
  completed: boolean;
  notes: string | null;
}
```

---

## Validation Rules

### Required Fields
- `date`, `timestamp`, `workout_program_id`, `week_number`, `day_number`, `exercise_name`, `exercise_order`, `set_number`, `completed`
- At least one of `reps` or `work_time` must be non-null

### Constraints
- `reps`: integer >= 0
- `weight`: float >= 0
- `weight_unit`: "lbs" or "kg"
- `work_time`, `rest_time`: integer >= 0 (seconds)
- `rpe`: integer 1-10
- `rir`: integer 0-5
- `week_number`: integer >= 1
- `day_number`: integer 1-7
- `set_number`: integer >= 1
- `is_compound_parent`: boolean
- `compound_parent_name`: null if `is_compound_parent=true`, string if sub-exercise

### Referential Integrity
- `exercise_name` must exist in exercise_database.json (or be a compound block name)
- `compound_parent_name` must reference a valid parent row's `exercise_name`

---

## Usage Notes

### Logging Standalone Exercise
```typescript
{
  is_compound_parent: false,
  compound_parent_name: null,
  // ... other fields
}
```

### Logging Compound Exercise
1. Create parent row: `is_compound_parent: true`, `compound_parent_name: null`, `work_time: 600`
2. Create sub-exercise rows: `is_compound_parent: false`, `compound_parent_name: "EMOM 10 minutes"`

### Personal Records
PRs calculated on-demand from CSV:
- Max weight at rep range (filter by `exercise_name`, `reps`, find max `weight`)
- Max volume in workout (sum `reps * weight` for `date` + `exercise_name`)
- Max reps at bodyweight (filter `weight=null`, find max `reps`)

### Progressive Overload
Use historical data to suggest next workout:
- If RIR >= 2 for recent sets → increase weight 2.5%
- If RIR < 1 → maintain weight
- If avg RPE > 8.5 for 4 workouts → suggest deload

---

**End of Specification**
