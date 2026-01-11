# Schedule Tab Specification

**Version**: 1.0
**Status**: Draft
**Date**: 2026-01-10

---

## Overview

The Schedule tab is one of three main tabs in Shredly 2.0 (Profile, Schedule, Live). It provides workout program management including creation, loading, viewing, and editing of multi-week training schedules.

---

## Core Concepts

### Schedule vs Workout

- **Schedule**: A complete multi-week training program (3-6 weeks)
- **Workout Day**: A single day's exercises within a schedule
- **Active Schedule**: The currently selected schedule the user is following

### Data Flow

```
Profile Tab (Questionnaire Answers)
         |
         v
   Schedule Tab
   +-- Create --> Engine generates ParameterizedWorkout
   +-- Load --> Import from templates/files
   +-- View --> Calendar/Week/Day navigation
   +-- Edit --> Modify exercises, parameters, structure
         |
         v
   Live Tab (Execution & Tracking)
```

---

## Main Actions

### 1. Create (New Schedule)

**Flow**: Quick Customize

1. User taps "Create New"
2. Display summary of saved Profile questionnaire answers
3. Allow user to tweak any answers before generation
4. On confirm, call workout generator engine
5. Prompt for schedule name and start date
6. Save to schedule library, mark as active

**Engine Integration**:
- Uses `src/lib/engine/workout-generator.ts`
- Reads questionnaire answers from Profile storage
- Generates `ParameterizedWorkout` structure
- Same logic as CLI, shared code

### 2. Load (Existing Schedule)

**Sources** (phased implementation):

| Phase | Source | Description |
|-------|--------|-------------|
| 1 | Bundled Templates | Pre-made workout JSONs shipped with app |
| 2 | Import from File | User imports .json from device |
| 3 | Community Library | Remote library (requires backend) |

**Bundled Templates** (Phase 1):
- Located in `src/data/templates/` or `static/templates/`
- Examples: "PPL Beginner 4-Week", "Full Body 3x", "Upper/Lower Split"
- Validated `ParameterizedWorkout` JSON files

**Import from File** (Phase 2):
- Accept .json files matching `ParameterizedWorkout` schema
- Validate structure before import
- Show error if invalid format

### 3. View Current

Opens the active schedule in Calendar view (default).

---

## Navigation & Views

### View Hierarchy

```
Calendar View (zoomed out)
    |
    +-- tap week --> Week View
                        |
                        +-- tap day --> Day View
                                           |
                                           +-- back --> Week View
                        |
                        +-- back --> Calendar View
```

**Navigation Pattern**: Drill-down with back button

- Tap a week card to enter Week View
- Tap a day card to enter Day View
- Back button (or swipe right) to zoom out
- No pinch gestures (keep it simple)

### Calendar View

**Purpose**: Overview of entire program

**Display Elements**:
- Program name and total duration
- Week cards arranged vertically
- Each week shows: "Week N: [Date Range]" (e.g., "Week 1: Jan 13-19")

**Week Card Contents**:
- Week header with date range
- Day summaries showing: Day name + exercise count
- Example: "Push (8)" or "Upper Body (6)"
- Rest days shown collapsed (single line, muted style)

**Layout Example**:
```
+------------------------------------------+
| My Strength Program                      |
| 4 weeks | Started Jan 13                 |
+------------------------------------------+

+------------------------------------------+
| Week 1: Jan 13-19                        |
|------------------------------------------|
| Mon: Push (8)     | Tue: Pull (7)        |
| Wed: Rest         | Thu: Legs (9)        |
| Fri: Upper (6)    | Sat-Sun: Rest        |
+------------------------------------------+

+------------------------------------------+
| Week 2: Jan 20-26                        |
|------------------------------------------|
| Mon: Push (8)     | Tue: Pull (7)        |
| ...                                      |
+------------------------------------------+
```

### Week View

**Purpose**: See all days in a single week

**Display Elements**:
- Week header: "Week 2: Jan 20-26"
- Day cards for each day (workout days expanded, rest days collapsed)
- Progress indicator if week is current/past

**Day Card Contents** (workout day):
- Day of week + date (e.g., "Monday, Jan 20")
- Day name from workout (e.g., "Push Day")
- Exercise list preview (first 3-4 exercises)
- Total exercise count
- Estimated duration

**Rest Day Card** (collapsed):
- Single line: "Wednesday, Jan 22 - Rest"
- Muted styling, minimal height

### Day View

**Purpose**: Full exercise list with all parameters

**Display Elements**:
- Day header: "Monday, Jan 20 - Push Day"
- Week context: "Week 2 of 4"
- Full exercise list with:
  - Exercise name
  - Sets x Reps (or time for timed exercises)
  - Weight (if applicable)
  - Rest period
  - RPE/RIR targets
- Compound blocks visually grouped
- Edit button for each exercise
- Add exercise button at bottom

---

## Start Date & Day Mapping

### Start Date Selection

- User picks any date as start date
- Day 1 of program = selected start date
- No forced Monday alignment

### Day-to-Weekday Mapping

For a 4-day program starting Thursday, Jan 16:
- Day 1 = Thursday, Jan 16
- Day 2 = Friday, Jan 17
- Day 3 = Saturday, Jan 18
- Day 4 = Sunday, Jan 19
- Rest days fill remaining weekdays

### Changing Start Date

- User can change start date anytime
- All day mappings recalculate automatically
- Past completion data (if any) remains associated with original dates

---

## Editing Capabilities

### Edit Scope Options

When user makes an edit, prompt with scope selection:

| Option | Description |
|--------|-------------|
| All Weeks | Apply change to this exercise in every week |
| This Week + Remaining | Apply to current week and all future weeks |
| This Instance Only | Apply only to this specific day/week |

**"Remember My Answer" Toggle**:
- Checkbox: "Remember for this session"
- If checked, skip prompt for subsequent edits
- Reset on app close or schedule close
- Can be changed via settings gear in edit mode

### Editable Elements

#### Exercise Level
- Swap exercise (opens Exercise Browser)
- Change sets, reps, weight, rest, tempo
- Change RPE/RIR targets
- Delete exercise
- Reorder exercises (drag and drop)

#### Day Level
- Add exercise
- Add compound block (EMOM/AMRAP/Circuit/Interval)
- Copy day to another day
- Clear all exercises

#### Week Level
- Duplicate week
- Copy week structure to another week

#### Schedule Level
- Change schedule name
- Change start date
- Delete schedule

### Compound Block Editing

Full support matching CLI capabilities:

- **Create**: Add new EMOM/AMRAP/Circuit/Interval block
- **Change Type**: Convert between compound block types
- **Add Sub-Exercise**: Add exercises within block
- **Remove Sub-Exercise**: Delete from block
- **Edit Sub-Exercise**: Modify parameters
- **Delete Block**: Remove entire compound block

Visual treatment:
- Block container with type label (colored)
- Sub-exercises indented within container
- Drag handle for reordering within block

---

## Exercise Browser

**Trigger**: Tap "Swap" on exercise or "Add Exercise" button

**Display**: Full-screen modal

### Browser Layout

```
+------------------------------------------+
| Select Exercise                     [X]  |
+------------------------------------------+
| [Search exercises...]                    |
+------------------------------------------+
| Filters:                                 |
| [Equipment v] [Muscle v] [Category v]   |
+------------------------------------------+
| Bench Press                              |
| Chest | Barbell | Strength               |
|------------------------------------------|
| Incline Dumbbell Press                   |
| Chest | Dumbbell | Strength              |
|------------------------------------------|
| Push-Up                                  |
| Chest | Bodyweight | Bodyweight          |
+------------------------------------------+
```

### Filter Options

- **Equipment**: Barbell, Dumbbell, Cable, Machine, Bodyweight, etc.
- **Muscle Group**: Chest, Back, Shoulders, Legs, Arms, Core
- **Category**: Strength, Bodyweight, Cardio, Mobility, etc.
- **Search**: Free text search on exercise name

### Selection Behavior

1. User taps exercise
2. Show exercise details (description, muscles, equipment)
3. Confirm button to select
4. Modal closes, exercise replaced/added
5. Smart defaults applied (sets/reps based on category)

---

## Multiple Schedules

### Schedule Library

- List of all saved schedules
- One schedule marked as "Active" (star icon)
- Quick actions: Set Active, Duplicate, Delete, Export

### Schedule Card

```
+------------------------------------------+
| My Strength Program              [star]  |
| 4 weeks | Push/Pull/Legs                 |
| Started: Jan 13, 2026                    |
| Progress: Week 2, Day 3                  |
+------------------------------------------+
```

### Active Schedule

- Only one schedule can be active at a time
- Active schedule is default view when opening Schedule tab
- Changing active schedule prompts confirmation

---

## Data Model

### CRITICAL: Zero Drift from Engine Output

The Schedule tab **MUST** use the exact same `ParameterizedWorkout` structure generated by `src/lib/engine/workout-generator.ts`. There is **NO transformation** or alternate format for the GUI.

**Principles**:
1. Engine generates `ParameterizedWorkout` (same as CLI)
2. GUI stores `ParameterizedWorkout` directly in IndexedDB
3. GUI edits mutate the same structure in place
4. GUI displays by reading the same structure
5. Live tab will consume the same structure for execution

### ParameterizedWorkout Structure (from types.ts)

```typescript
interface ParameterizedWorkout {
  id: string;                    // "workout_tone_beg_1768080148157"
  name: string;                  // "General Fitness Beginner Program"
  description: string;
  version: string;               // "2.0.0"
  weeks: number;                 // 3-6
  daysPerWeek: number;           // 2-7
  metadata: WorkoutMetadata;
  days: {
    [dayNumber: string]: ParameterizedDay;  // "1", "2", "3" (string keys)
  };
}

interface ParameterizedDay {
  dayNumber: number;
  type: "gym" | "home" | "outdoor" | "recovery";
  focus: string;                 // "Push", "Pull", "Legs", etc.
  exercises: ParameterizedExercise[];
}

interface ParameterizedExercise {
  name: string;
  category?: "emom" | "amrap" | "circuit" | "interval";  // Compound blocks only
  week1: WeekParameters;
  week2: WeekParameters;
  week3: WeekParameters;
  week4?: WeekParameters;        // Optional for 4+ week programs
  week5?: WeekParameters;
  week6?: WeekParameters;
  sub_exercises?: ParameterizedSubExercise[];  // Compound blocks only
}

interface WeekParameters {
  sets?: number;
  reps?: number | string;        // number or "8-12" or "AMRAP"
  work_time_minutes?: number;    // For timed exercises
  work_time_unit?: "seconds" | "minutes";
  rest_time_minutes?: number;
  rest_time_unit?: "seconds" | "minutes";
  weight?: string | object;      // "heavy", "moderate", or structured
}
```

### Example Exercise (from engine output)

**Standard strength exercise**:
```json
{
  "name": "Feet up Bench",
  "week1": { "sets": 3, "reps": 4, "rest_time_minutes": 2.5, "rest_time_unit": "minutes", "weight": "heavy" },
  "week2": { "sets": 3, "reps": 4, "rest_time_minutes": 2.5, "rest_time_unit": "minutes", "weight": "heavy" },
  "week3": { "sets": 4, "reps": 5, "rest_time_minutes": 2.5, "rest_time_unit": "minutes", "weight": "heavy" }
}
```

**Compound block (EMOM)**:
```json
{
  "name": "EMOM: Prone Dumbbell W-Raise + Pull-ups",
  "week1": { "work_time_minutes": 12, "work_time_unit": "minutes" },
  "week2": { "work_time_minutes": 12, "work_time_unit": "minutes" },
  "week3": { "work_time_minutes": 12, "work_time_unit": "minutes" },
  "category": "emom",
  "sub_exercises": [
    { "name": "Prone Dumbbell W-Raise", "week1": { "reps": 4, "weight": "heavy" }, ... },
    { "name": "Pull-ups", "week1": { "reps": 4 }, ... }
  ]
}
```

**Compound block (Interval)**:
```json
{
  "name": "INTERVAL: Dumbbell Lateral Raise + KB Swing",
  "week1": { "sets": 3 },
  "category": "interval",
  "sub_exercises": [
    {
      "name": "Dumbbell Lateral Raise",
      "week1": { "work_time_minutes": 0.666, "work_time_unit": "seconds", "rest_time_minutes": 0.416, "rest_time_unit": "seconds", "weight": "moderate" }
    }
  ]
}
```

---

## Data Persistence

### Storage Strategy

| Data Type | Storage | Reason |
|-----------|---------|--------|
| Schedules | IndexedDB | Large data, exact ParameterizedWorkout structure |
| Active Schedule ID | localStorage | Quick access |
| Edit Preferences | localStorage | Small, frequent access |
| UI State | localStorage | View positions, last viewed |

### IndexedDB Schema

**Database**: `shredly-schedules`

**Object Stores**:

1. **schedules**
   - Key: `id` (from ParameterizedWorkout.id)
   - Value: `StoredSchedule` (ParameterizedWorkout + schedule metadata)
   - Indexes: `name`, `createdAt`, `isActive`

2. **templates** (Phase 2)
   - Key: `id`
   - Value: Template workout data (also ParameterizedWorkout format)
   - Indexes: `category`, `difficulty`

### StoredSchedule Type

The stored format wraps `ParameterizedWorkout` with schedule-specific metadata:

```typescript
interface StoredSchedule {
  // === ParameterizedWorkout fields (UNCHANGED) ===
  id: string;
  name: string;
  description: string;
  version: string;
  weeks: number;
  daysPerWeek: number;
  metadata: WorkoutMetadata;
  days: { [dayNumber: string]: ParameterizedDay };

  // === Schedule-specific metadata (ADDED) ===
  scheduleMetadata: {
    isActive: boolean;         // Is this the active schedule
    startDate: string;         // ISO date string (e.g., "2026-01-13")
    createdAt: string;         // ISO timestamp
    updatedAt: string;         // ISO timestamp
    currentWeek: number;       // User's progress (1-based)
    currentDay: number;        // User's progress (1-based)
  };
}
```

**Key Design Decision**: Schedule metadata is stored in a separate `scheduleMetadata` object to keep the core `ParameterizedWorkout` structure untouched. This allows:
- Direct re-use of engine types
- Easy export (strip `scheduleMetadata` to get clean ParameterizedWorkout)
- No drift between CLI and GUI data models

---

## Copy & Duplicate Features

### Copy Day

1. Long-press or menu on day card
2. Select "Copy Day"
3. Choose target day(s) - can multi-select
4. Confirm copy
5. Target days receive same exercises (adjusted for week if needed)

### Duplicate Week

1. Long-press or menu on week card
2. Select "Duplicate Week"
3. Choose target week position (before/after current)
4. New week inserted, schedule extended
5. Limit: Cannot exceed 6 weeks total

---

## Error Handling

### Validation on Edit

- Exercise must exist in database
- Sets must be 1-10
- Reps must be 1-50 (or time for timed exercises)
- Weight must be non-negative
- Rest must be 0-600 seconds

### Invalid State Prevention

- Cannot delete last exercise from a day
- Cannot delete last day from a week
- Cannot have empty compound block (auto-delete if last sub-exercise removed)

### Data Integrity

- All edits immediately persisted to IndexedDB
- Version field incremented on edit
- Undo buffer in memory (last 10 actions)

---

## Accessibility

- All interactive elements keyboard accessible
- ARIA labels on icons and buttons
- Color not sole indicator of state
- Touch targets minimum 44x44px
- Screen reader announcements on navigation

---

## Performance Considerations

- Lazy load week/day content
- Virtual scrolling for long exercise lists
- Debounce search input in Exercise Browser
- Cache exercise database in memory
- Batch IndexedDB writes

---

## Future Considerations (Out of Scope)

- Workout history integration (Live tab)
- Progress analytics
- Social sharing
- Cloud sync
- AI-powered suggestions

---

## Related Documents

- **WORKOUT_SPEC.md**: Data structure specification
- **EXERCISE_HISTORY_SPEC.md**: History tracking format
- **SPEC.md**: Overall architecture
- **src/lib/engine/types.ts**: TypeScript type definitions
