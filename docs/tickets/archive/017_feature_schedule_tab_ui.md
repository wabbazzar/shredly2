# Ticket #017: Feature - Schedule Tab UI with Workout Management

**Status**: Open
**Priority**: High
**Type**: feature
**Estimated Points**: 21 (across 7 phases)
**Phase**: 2-UI

---

## Summary

Build the Schedule tab UI for Shredly 2.0 with three main actions (Create, Load, View Current), drill-down navigation (Calendar/Week/Day views), full workout editing capabilities, and IndexedDB persistence. The UI must use the exact same `ParameterizedWorkout` structure from the engine with zero drift.

## Background

This is the second frontend ticket for Shredly 2.0. The navigation shell is complete (ticket #016) and the workout generation engine is fully tested (319 tests passing). The Schedule tab is the central hub for workout program management.

**Completed prerequisites:**
- Navigation shell with tabs (Profile, Schedule, Live)
- Workout generation engine (`src/lib/engine/`)
- CLI workout editor (`cli/lib/interactive-workout-editor.ts`)
- Exercise database (326 exercises)
- All engine types in `src/lib/engine/types.ts`

**User requirements:**
- Create new schedule from questionnaire answers (via engine)
- Load from bundled templates or imported files
- View current active schedule
- Drill-down navigation: Calendar -> Week -> Day
- Full editing: exercise swap, parameter changes, compound blocks
- Edit scope options: all weeks / this week + remaining / this instance only
- Multiple schedules with one active
- Real calendar dates mapped to workout days

**Critical constraint: ZERO DRIFT**
The GUI must store and manipulate the exact `ParameterizedWorkout` structure from the engine. No transformation or alternate format.

---

## Technical Requirements

### Framework Stack

This ticket uses the SvelteKit + Tailwind setup from ticket #016.

### Data Structures

**StoredSchedule** (extends ParameterizedWorkout):

```typescript
// src/lib/types/schedule.ts

import type { ParameterizedWorkout, ParameterizedDay, ParameterizedExercise } from '$lib/engine/types';

/**
 * Schedule-specific metadata (GUI-only, not part of engine output)
 */
export interface ScheduleMetadata {
  isActive: boolean;         // Is this the active schedule
  startDate: string;         // ISO date string "2026-01-13"
  createdAt: string;         // ISO timestamp
  updatedAt: string;         // ISO timestamp
  currentWeek: number;       // User's progress (1-based)
  currentDay: number;        // User's progress (1-based)
}

/**
 * Stored format wraps ParameterizedWorkout with schedule metadata
 * The core ParameterizedWorkout structure is UNCHANGED from engine output
 */
export interface StoredSchedule extends ParameterizedWorkout {
  scheduleMetadata: ScheduleMetadata;
}

/**
 * Edit scope for broadcasting changes
 */
export type EditScope = 'all_weeks' | 'this_week_and_remaining' | 'this_instance_only';

/**
 * Edit preference stored in localStorage
 */
export interface EditPreferences {
  defaultScope: EditScope;
  rememberChoice: boolean;
}

/**
 * View level for schedule navigation
 */
export type ViewLevel = 'calendar' | 'week' | 'day';

/**
 * Schedule view state
 */
export interface ScheduleViewState {
  viewLevel: ViewLevel;
  selectedWeek: number;      // 1-based
  selectedDay: number;       // 1-based (day number in program)
  isEditing: boolean;
}
```

**Navigation Context**:

```typescript
// src/lib/stores/schedule.ts

import { writable, derived } from 'svelte/store';
import type { StoredSchedule, ScheduleViewState, EditPreferences } from '$lib/types/schedule';

export const activeSchedule = writable<StoredSchedule | null>(null);
export const scheduleLibrary = writable<StoredSchedule[]>([]);

export const viewState = writable<ScheduleViewState>({
  viewLevel: 'calendar',
  selectedWeek: 1,
  selectedDay: 1,
  isEditing: false
});

export const editPreferences = writable<EditPreferences>({
  defaultScope: 'all_weeks',
  rememberChoice: false
});

// Derived stores
export const currentWeekData = derived(
  [activeSchedule, viewState],
  ([$schedule, $view]) => {
    if (!$schedule) return null;
    // Return exercises for selected week
    return getWeekData($schedule, $view.selectedWeek);
  }
);

export const currentDayData = derived(
  [activeSchedule, viewState],
  ([$schedule, $view]) => {
    if (!$schedule) return null;
    return $schedule.days[$view.selectedDay.toString()];
  }
);
```

### IndexedDB Schema

**Database**: `shredly-schedules` (version 1)

**Object Stores**:

1. `schedules`
   - keyPath: `id`
   - indexes: `name`, `scheduleMetadata.createdAt`, `scheduleMetadata.isActive`

2. `templates` (Phase 2+)
   - keyPath: `id`
   - indexes: `metadata.difficulty`, `metadata.tags`

### Code Locations

**Files to create:**
- `src/lib/types/schedule.ts` - TypeScript types
- `src/lib/stores/schedule.ts` - Svelte stores for schedule state
- `src/lib/stores/scheduleDb.ts` - IndexedDB operations
- `src/lib/components/schedule/CalendarView.svelte` - Calendar (zoomed out)
- `src/lib/components/schedule/WeekView.svelte` - Week view
- `src/lib/components/schedule/DayView.svelte` - Day view with exercises
- `src/lib/components/schedule/ExerciseCard.svelte` - Single exercise display
- `src/lib/components/schedule/CompoundBlockCard.svelte` - EMOM/Circuit/etc display
- `src/lib/components/schedule/ExerciseBrowser.svelte` - Full-screen exercise picker
- `src/lib/components/schedule/EditScopeModal.svelte` - Edit scope selection
- `src/lib/components/schedule/ScheduleActions.svelte` - Create/Load/View buttons
- `src/lib/components/schedule/ScheduleLibrary.svelte` - Schedule list
- `src/lib/utils/dateMapping.ts` - Day number to calendar date utilities
- `src/lib/utils/scheduleEditor.ts` - Edit operations (port from CLI editor)
- `static/templates/` - Bundled workout templates (JSON files)

**Files to modify:**
- `src/routes/schedule/+page.svelte` - Main schedule tab page
- `src/lib/engine/types.ts` - Add ScheduleMetadata export if needed

---

## Implementation Plan

### Phase 1: IndexedDB + Schedule Store (3 points)

**Goal**: Set up IndexedDB persistence and Svelte stores for schedule management.

**Steps**:
1. Create `src/lib/types/schedule.ts` with all TypeScript types
2. Create `src/lib/stores/scheduleDb.ts` with IndexedDB wrapper:
   - `openDatabase()` - Initialize database
   - `saveSchedule(schedule)` - Save/update schedule
   - `getSchedule(id)` - Load single schedule
   - `getAllSchedules()` - Load all schedules
   - `deleteSchedule(id)` - Remove schedule
   - `setActiveSchedule(id)` - Mark one as active
3. Create `src/lib/stores/schedule.ts` with Svelte stores:
   - `activeSchedule` - Current schedule being viewed
   - `scheduleLibrary` - All saved schedules
   - `viewState` - Current view level and selection
   - `editPreferences` - User's edit scope preference
4. Create localStorage helpers for quick settings:
   - Active schedule ID
   - Edit preferences
   - Last view state
5. Test database operations with sample schedule JSON

**Files**:
- Create: `src/lib/types/schedule.ts`
- Create: `src/lib/stores/scheduleDb.ts`
- Create: `src/lib/stores/schedule.ts`

**IndexedDB Wrapper**:
```typescript
// src/lib/stores/scheduleDb.ts

import type { StoredSchedule } from '$lib/types/schedule';

const DB_NAME = 'shredly-schedules';
const DB_VERSION = 1;
const STORE_NAME = 'schedules';

let db: IDBDatabase | null = null;

export async function openDatabase(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Create schedules store
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('createdAt', 'scheduleMetadata.createdAt', { unique: false });
        store.createIndex('isActive', 'scheduleMetadata.isActive', { unique: false });
      }
    };
  });
}

export async function saveSchedule(schedule: StoredSchedule): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(schedule);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getAllSchedules(): Promise<StoredSchedule[]> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function deleteSchedule(id: string): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function setActiveSchedule(id: string): Promise<void> {
  const schedules = await getAllSchedules();

  // Deactivate all, activate selected
  for (const schedule of schedules) {
    schedule.scheduleMetadata.isActive = schedule.id === id;
    await saveSchedule(schedule);
  }

  // Also store in localStorage for quick access
  localStorage.setItem('shredly-active-schedule-id', id);
}
```

**Testing**:
- [ ] IndexedDB opens successfully
- [ ] Schedule can be saved and retrieved
- [ ] Active schedule flag works correctly
- [ ] getAllSchedules returns all saved schedules
- [ ] deleteSchedule removes schedule
- [ ] localStorage stores active schedule ID
- [ ] TypeScript compilation succeeds

**Commit Message**:
```
feat(schedule): add IndexedDB persistence and stores

- Create schedule TypeScript types (StoredSchedule, EditScope, etc.)
- Add IndexedDB wrapper for schedule CRUD operations
- Create Svelte stores for schedule state management
- Add localStorage helpers for quick settings
- Zero drift: stores exact ParameterizedWorkout structure
```

---

### Phase 2: Schedule Actions + Library UI (3 points)

**Goal**: Build the main Schedule tab UI with Create/Load/View buttons and schedule library list.

**Steps**:
1. Create `src/lib/components/schedule/ScheduleActions.svelte`:
   - Three main buttons: Create, Load, View Current
   - Disabled states when no active schedule
2. Create `src/lib/components/schedule/ScheduleLibrary.svelte`:
   - List of all saved schedules
   - Schedule cards showing name, duration, start date, progress
   - Star icon for active schedule
   - Quick actions: Set Active, Duplicate, Delete
3. Update `src/routes/schedule/+page.svelte`:
   - Integrate ScheduleActions and ScheduleLibrary
   - Handle navigation to different views
4. Add placeholder for "no schedules" empty state
5. Style with Tailwind (dark theme matching nav shell)

**Files**:
- Create: `src/lib/components/schedule/ScheduleActions.svelte`
- Create: `src/lib/components/schedule/ScheduleLibrary.svelte`
- Modify: `src/routes/schedule/+page.svelte`

**ScheduleActions Layout**:
```svelte
<script lang="ts">
  import { activeSchedule, scheduleLibrary } from '$lib/stores/schedule';

  export let onCreateClick: () => void;
  export let onLoadClick: () => void;
  export let onViewClick: () => void;
</script>

<div class="flex gap-3 p-4">
  <button
    on:click={onCreateClick}
    class="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700
           text-white font-medium rounded-lg transition-colors"
  >
    Create New
  </button>

  <button
    on:click={onLoadClick}
    class="flex-1 py-3 px-4 bg-slate-700 hover:bg-slate-600
           text-white font-medium rounded-lg transition-colors"
  >
    Load
  </button>

  <button
    on:click={onViewClick}
    disabled={!$activeSchedule}
    class="flex-1 py-3 px-4 bg-slate-700 hover:bg-slate-600
           text-white font-medium rounded-lg transition-colors
           disabled:opacity-50 disabled:cursor-not-allowed"
  >
    View Current
  </button>
</div>
```

**Testing**:
- [ ] Three action buttons render correctly
- [ ] "View Current" is disabled when no active schedule
- [ ] Schedule library shows all saved schedules
- [ ] Active schedule has star indicator
- [ ] Set Active action works
- [ ] Delete action removes schedule from list
- [ ] Duplicate action creates copy
- [ ] Empty state shows when no schedules
- [ ] Responsive on mobile

**Commit Message**:
```
feat(schedule): add schedule actions and library UI

- Create ScheduleActions component with Create/Load/View buttons
- Create ScheduleLibrary with schedule cards
- Add active schedule indicator (star)
- Implement quick actions: Set Active, Duplicate, Delete
- Add empty state for no schedules
```

---

### Phase 3: Create Flow + Engine Integration (4 points)

**Goal**: Implement "Create New" flow that generates a workout from questionnaire answers.

**Steps**:
1. Create quick customize modal/flow:
   - Display current Profile questionnaire answers
   - Allow tweaking before generation
   - Show loading state during generation
2. Import and call workout generator engine:
   - `import { generateWorkout } from '$lib/engine/workout-generator'`
   - Pass questionnaire answers
   - Receive `ParameterizedWorkout`
3. Add schedule metadata to generated workout:
   - Generate UUID for id (or use engine's id)
   - Set startDate (default: today)
   - Set isActive: true
   - Set createdAt/updatedAt timestamps
4. Save to IndexedDB as `StoredSchedule`
5. Navigate to Calendar view of new schedule
6. Handle generation errors gracefully

**Files**:
- Create: `src/lib/components/schedule/CreateScheduleModal.svelte`
- Create: `src/lib/components/schedule/QuickCustomize.svelte`
- Modify: `src/routes/schedule/+page.svelte`

**Engine Integration**:
```typescript
// In CreateScheduleModal.svelte

import { generateWorkout } from '$lib/engine/workout-generator';
import { mapToLegacyAnswers, type QuestionnaireAnswers } from '$lib/engine/types';
import { saveSchedule, setActiveSchedule } from '$lib/stores/scheduleDb';
import type { StoredSchedule } from '$lib/types/schedule';

async function createSchedule(answers: QuestionnaireAnswers, startDate: string) {
  // Generate workout using shared engine
  const legacyAnswers = mapToLegacyAnswers(answers);
  const workout = await generateWorkout(legacyAnswers);

  // Add schedule metadata (GUI-only fields)
  const storedSchedule: StoredSchedule = {
    ...workout,
    scheduleMetadata: {
      isActive: true,
      startDate: startDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      currentWeek: 1,
      currentDay: 1
    }
  };

  // Save and set as active
  await saveSchedule(storedSchedule);
  await setActiveSchedule(storedSchedule.id);

  return storedSchedule;
}
```

**Testing**:
- [ ] Create button opens quick customize flow
- [ ] Profile answers display correctly
- [ ] Answers can be modified before generation
- [ ] Engine generates valid ParameterizedWorkout
- [ ] Schedule metadata is added correctly
- [ ] Schedule saves to IndexedDB
- [ ] New schedule becomes active
- [ ] Navigation to Calendar view works
- [ ] Error handling shows user-friendly message
- [ ] Loading state during generation

**Commit Message**:
```
feat(schedule): implement Create flow with engine integration

- Create quick customize modal for tweaking answers
- Integrate workout-generator.ts from shared engine
- Add schedule metadata to generated workout
- Save to IndexedDB and set as active
- Navigate to Calendar view after creation
- Handle generation errors gracefully
```

---

### Phase 4: Calendar + Week + Day Views (4 points)

**Goal**: Build the three view levels with drill-down navigation.

**Steps**:
1. Create `src/lib/components/schedule/CalendarView.svelte`:
   - Program header (name, weeks, start date)
   - Week cards with date ranges
   - Day summaries: focus name + exercise count
   - Rest days collapsed
   - Tap week -> navigate to Week View
2. Create `src/lib/components/schedule/WeekView.svelte`:
   - Week header with date range
   - Day cards for each day (expanded for workout days)
   - Exercise preview (first 3-4)
   - Tap day -> navigate to Day View
   - Back button to Calendar
3. Create `src/lib/components/schedule/DayView.svelte`:
   - Day header with date and focus
   - Full exercise list
   - Compound blocks grouped visually
   - Week context indicator
   - Back button to Week View
4. Create `src/lib/utils/dateMapping.ts`:
   - `getDayDate(startDate, dayNumber, weekNumber)` - Get actual date
   - `getWeekDateRange(startDate, weekNumber)` - Get week's date range
   - `formatDateRange(start, end)` - Format as "Jan 13-19"
5. Wire up navigation between views via viewState store

**Files**:
- Create: `src/lib/components/schedule/CalendarView.svelte`
- Create: `src/lib/components/schedule/WeekView.svelte`
- Create: `src/lib/components/schedule/DayView.svelte`
- Create: `src/lib/utils/dateMapping.ts`

**Date Mapping Utilities**:
```typescript
// src/lib/utils/dateMapping.ts

/**
 * Get the actual date for a workout day
 * Day 1 = startDate, each subsequent day adds (dayNumber - 1) + (weekNumber - 1) * 7
 */
export function getDayDate(startDate: string, dayNumber: number, weekNumber: number, daysPerWeek: number): Date {
  const start = new Date(startDate);
  // Calculate days offset: (week - 1) * 7 + day position within week
  const dayIndex = dayNumber - 1; // 0-based index of this day in program
  const weekOffset = (weekNumber - 1) * 7;

  // Map program day to actual calendar position
  // Program days are consecutive workout days, but map to specific weekdays
  const totalDays = weekOffset + dayIndex;
  const result = new Date(start);
  result.setDate(start.getDate() + totalDays);
  return result;
}

/**
 * Get date range for a week
 */
export function getWeekDateRange(startDate: string, weekNumber: number): { start: Date; end: Date } {
  const start = new Date(startDate);
  const weekStart = new Date(start);
  weekStart.setDate(start.getDate() + (weekNumber - 1) * 7);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  return { start: weekStart, end: weekEnd };
}

/**
 * Format date range as "Jan 13-19"
 */
export function formatDateRange(start: Date, end: Date): string {
  const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
  const startDay = start.getDate();
  const endDay = end.getDate();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay}-${endDay}`;
  }
  return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
}

/**
 * Format single date as "Monday, Jan 20"
 */
export function formatDayDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });
}
```

**Testing**:
- [ ] Calendar view shows all weeks with date ranges
- [ ] Week cards show day summaries (focus + count)
- [ ] Rest days shown collapsed
- [ ] Tap week navigates to Week View
- [ ] Week View shows expanded day cards
- [ ] Day cards show exercise preview
- [ ] Tap day navigates to Day View
- [ ] Day View shows full exercise list
- [ ] Back buttons work correctly
- [ ] Date calculations are correct
- [ ] Responsive on mobile

**Commit Message**:
```
feat(schedule): add Calendar, Week, and Day views

- Create CalendarView with week cards and date ranges
- Create WeekView with expanded day cards
- Create DayView with full exercise list
- Add date mapping utilities for calendar dates
- Implement drill-down navigation between views
- Rest days shown collapsed in Calendar/Week views
```

---

### Phase 5: Exercise Display Components (3 points)

**Goal**: Build exercise display components that match CLI formatter output.

**Steps**:
1. Create `src/lib/components/schedule/ExerciseCard.svelte`:
   - Display exercise name
   - Show sets x reps (or time for timed)
   - Show weight if applicable
   - Show rest period
   - Edit button (pencil icon)
   - Visual indication of exercise type
2. Create `src/lib/components/schedule/CompoundBlockCard.svelte`:
   - Block type label with color (EMOM=blue, AMRAP=green, etc.)
   - Sub-exercises indented
   - Block duration/sets display
   - Collapsible sub-exercise list
3. Port display logic from CLI formatter:
   - `cli/lib/interactive-workout-editor.ts` -> Svelte components
   - Same formatting rules for time fields
   - Same weight display logic
4. Use exercise metadata for field visibility:
   - Import from `src/lib/engine/exercise-metadata.ts`
   - Respect `external_load` rules

**Files**:
- Create: `src/lib/components/schedule/ExerciseCard.svelte`
- Create: `src/lib/components/schedule/CompoundBlockCard.svelte`
- Create: `src/lib/components/schedule/WeekParameterDisplay.svelte`

**ExerciseCard Structure**:
```svelte
<script lang="ts">
  import type { ParameterizedExercise, WeekParameters } from '$lib/engine/types';
  import { getExerciseMetadata, shouldShowWeight } from '$lib/engine/exercise-metadata';

  export let exercise: ParameterizedExercise;
  export let weekNumber: number;
  export let onEdit: () => void;

  $: weekKey = `week${weekNumber}` as keyof ParameterizedExercise;
  $: params = exercise[weekKey] as WeekParameters;
  $: metadata = getExerciseMetadata(exercise.name);
  $: showWeight = shouldShowWeight(exercise.name);
  $: isCompound = !!exercise.category;
</script>

{#if isCompound}
  <CompoundBlockCard {exercise} {weekNumber} {onEdit} />
{:else}
  <div class="bg-slate-800 rounded-lg p-4 mb-2">
    <div class="flex justify-between items-start">
      <div class="flex-1">
        <h4 class="font-medium text-white">{exercise.name}</h4>
        <div class="text-sm text-slate-400 mt-1">
          {#if params.sets && params.reps}
            {params.sets} x {params.reps}
          {/if}
          {#if showWeight && params.weight}
            <span class="mx-2">|</span>
            {typeof params.weight === 'string' ? params.weight : params.weight.value}
          {/if}
          {#if params.rest_time_minutes}
            <span class="mx-2">|</span>
            {formatRestTime(params.rest_time_minutes, params.rest_time_unit)}
          {/if}
        </div>
      </div>
      <button
        on:click={onEdit}
        class="p-2 text-slate-400 hover:text-white transition-colors"
        aria-label="Edit exercise"
      >
        <!-- Pencil icon SVG -->
      </button>
    </div>
  </div>
{/if}
```

**Compound Block Colors**:
```css
/* In app.css or component */
.block-emom { @apply border-l-4 border-blue-500; }
.block-amrap { @apply border-l-4 border-green-500; }
.block-circuit { @apply border-l-4 border-purple-500; }
.block-interval { @apply border-l-4 border-orange-500; }
```

**Testing**:
- [ ] Standard exercises display correctly
- [ ] Sets x Reps format matches CLI
- [ ] Weight shows only when appropriate
- [ ] Rest time formatting correct
- [ ] Compound blocks have colored type indicator
- [ ] Sub-exercises indented within block
- [ ] EMOM shows total time
- [ ] AMRAP shows total time
- [ ] Circuit shows sets
- [ ] Interval shows sets and work/rest
- [ ] Edit button visible and clickable

**Commit Message**:
```
feat(schedule): add exercise display components

- Create ExerciseCard for standard exercises
- Create CompoundBlockCard for EMOM/AMRAP/Circuit/Interval
- Port display logic from CLI formatter
- Use exercise-metadata.ts for field visibility
- Add colored type indicators for compound blocks
- Add edit buttons for inline editing
```

---

### Phase 6: Exercise Browser + Editing (4 points)

**Goal**: Build the exercise browser modal and edit capabilities.

**Steps**:
1. Create `src/lib/components/schedule/ExerciseBrowser.svelte`:
   - Full-screen modal
   - Search input with debounce
   - Filter dropdowns: Equipment, Muscle Group, Category
   - Exercise list with virtual scrolling (if needed)
   - Exercise details on selection
   - Confirm selection button
2. Create `src/lib/components/schedule/EditScopeModal.svelte`:
   - Three options: All weeks, This week + remaining, This instance only
   - "Remember for this session" checkbox
   - Cancel and Confirm buttons
3. Create `src/lib/utils/scheduleEditor.ts`:
   - Port editing logic from `cli/lib/interactive-workout-editor.ts`
   - `swapExercise(schedule, dayNumber, exerciseIndex, newExercise, scope)`
   - `updateExerciseParams(schedule, dayNumber, exerciseIndex, params, scope)`
   - `deleteExercise(schedule, dayNumber, exerciseIndex)`
   - `addExercise(schedule, dayNumber, exercise)`
4. Wire up edit flow:
   - Tap edit button -> open editor
   - Select new exercise -> show scope modal
   - Apply changes -> save to IndexedDB
   - Update view

**Files**:
- Create: `src/lib/components/schedule/ExerciseBrowser.svelte`
- Create: `src/lib/components/schedule/EditScopeModal.svelte`
- Create: `src/lib/components/schedule/ExerciseEditor.svelte`
- Create: `src/lib/utils/scheduleEditor.ts`

**Schedule Editor Utilities**:
```typescript
// src/lib/utils/scheduleEditor.ts

import type { StoredSchedule, EditScope } from '$lib/types/schedule';
import type { ParameterizedExercise, WeekParameters } from '$lib/engine/types';

/**
 * Swap an exercise with a new one
 * Applies change according to edit scope
 */
export function swapExercise(
  schedule: StoredSchedule,
  dayNumber: number,
  exerciseIndex: number,
  newExercise: ParameterizedExercise,
  scope: EditScope,
  currentWeek: number
): StoredSchedule {
  const updated = structuredClone(schedule);
  const day = updated.days[dayNumber.toString()];

  if (scope === 'all_weeks') {
    // Replace exercise entirely
    day.exercises[exerciseIndex] = newExercise;
  } else if (scope === 'this_week_and_remaining') {
    // Keep weeks before currentWeek, update currentWeek and later
    const existing = day.exercises[exerciseIndex];
    const merged = { ...newExercise };

    for (let w = 1; w < currentWeek; w++) {
      const weekKey = `week${w}` as keyof ParameterizedExercise;
      if (existing[weekKey]) {
        (merged as any)[weekKey] = existing[weekKey];
      }
    }

    day.exercises[exerciseIndex] = merged;
  } else {
    // this_instance_only - only change specific week
    // This is complex - need to keep exercise but change params for one week
    // For exercise swap, this might mean keeping old exercise but noting preference
    // For simplicity, we'll just update the current week's params
    const existing = day.exercises[exerciseIndex];
    const weekKey = `week${currentWeek}` as keyof ParameterizedExercise;
    (existing as any)[weekKey] = (newExercise as any)[weekKey];
  }

  updated.scheduleMetadata.updatedAt = new Date().toISOString();
  return updated;
}

/**
 * Update exercise parameters for a specific field
 */
export function updateExerciseParams(
  schedule: StoredSchedule,
  dayNumber: number,
  exerciseIndex: number,
  field: keyof WeekParameters,
  value: any,
  scope: EditScope,
  currentWeek: number
): StoredSchedule {
  const updated = structuredClone(schedule);
  const exercise = updated.days[dayNumber.toString()].exercises[exerciseIndex];

  const weeksToUpdate = getWeeksToUpdate(scope, currentWeek, schedule.weeks);

  for (const week of weeksToUpdate) {
    const weekKey = `week${week}` as keyof ParameterizedExercise;
    const params = exercise[weekKey] as WeekParameters;
    if (params) {
      (params as any)[field] = value;
    }
  }

  updated.scheduleMetadata.updatedAt = new Date().toISOString();
  return updated;
}

function getWeeksToUpdate(scope: EditScope, currentWeek: number, totalWeeks: number): number[] {
  if (scope === 'all_weeks') {
    return Array.from({ length: totalWeeks }, (_, i) => i + 1);
  } else if (scope === 'this_week_and_remaining') {
    return Array.from({ length: totalWeeks - currentWeek + 1 }, (_, i) => currentWeek + i);
  } else {
    return [currentWeek];
  }
}
```

**Testing**:
- [ ] Exercise browser opens as full-screen modal
- [ ] Search filters exercises by name
- [ ] Equipment filter works
- [ ] Muscle group filter works
- [ ] Category filter works
- [ ] Exercise selection shows details
- [ ] Confirm selection triggers scope modal
- [ ] Edit scope options work correctly
- [ ] "Remember for session" checkbox works
- [ ] Changes persist to IndexedDB
- [ ] View updates after edit
- [ ] Undo is possible (store previous state)

**Commit Message**:
```
feat(schedule): add exercise browser and editing

- Create ExerciseBrowser modal with search and filters
- Create EditScopeModal for broadcast options
- Port editing logic from CLI editor
- Implement scope-aware exercise swap
- Implement parameter updates with scope
- Save edits to IndexedDB immediately
```

---

### Phase 7: Load Templates + Start Date (3 points)

**Goal**: Implement Load functionality and start date selection.

**Steps**:
1. Create bundled templates in `static/templates/`:
   - `ppl-beginner-4week.json`
   - `fullbody-3day.json`
   - `upper-lower-4week.json`
2. Create template loading flow:
   - List available templates
   - Show template details (name, weeks, focus)
   - Select template -> prompt for start date
   - Create StoredSchedule from template
3. Create date picker for start date:
   - Default to today
   - Calendar widget for selection
   - Show day-of-week for Day 1
4. Create file import (Phase 2 of Load):
   - File input for .json files
   - Validate ParameterizedWorkout structure
   - Handle invalid files gracefully
5. Allow changing start date on existing schedule:
   - Edit start date from schedule settings
   - Recalculate all date mappings

**Files**:
- Create: `static/templates/ppl-beginner-4week.json`
- Create: `static/templates/fullbody-3day.json`
- Create: `static/templates/upper-lower-4week.json`
- Create: `src/lib/components/schedule/LoadTemplateModal.svelte`
- Create: `src/lib/components/schedule/DatePicker.svelte`
- Create: `src/lib/components/schedule/ImportFile.svelte`

**Template Format**:
Templates are valid `ParameterizedWorkout` JSON files:
```json
{
  "id": "template_ppl_beginner_4week",
  "name": "Push/Pull/Legs - Beginner",
  "description": "4-week PPL program for beginners",
  "version": "2.0.0",
  "weeks": 4,
  "daysPerWeek": 3,
  "metadata": {
    "difficulty": "Beginner",
    "equipment": ["commercial_gym"],
    "estimatedDuration": "45-60",
    "tags": ["ppl", "beginner", "3_days_week", "full_gym"]
  },
  "days": {
    "1": { ... },
    "2": { ... },
    "3": { ... }
  }
}
```

**Testing**:
- [ ] Templates load from static folder
- [ ] Template list shows available options
- [ ] Template details display correctly
- [ ] Start date picker works
- [ ] Selected date maps correctly to Day 1
- [ ] File import accepts valid JSON
- [ ] File import rejects invalid format
- [ ] Start date can be changed on existing schedule
- [ ] Date mappings update when start date changes

**Commit Message**:
```
feat(schedule): add template loading and start date

- Create bundled workout templates (PPL, Full Body, Upper/Lower)
- Create LoadTemplateModal with template browser
- Add DatePicker for start date selection
- Implement file import with validation
- Allow changing start date on existing schedules
- Recalculate date mappings on start date change
```

---

## Testing Strategy

### Unit Tests (Vitest)

Location: `tests/unit/schedule/`

- [ ] `scheduleDb.test.ts` - IndexedDB operations
  - Database opens successfully
  - CRUD operations work
  - Active schedule flag management
- [ ] `scheduleStore.test.ts` - Svelte store logic
  - Store initialization
  - Derived store calculations
  - State updates
- [ ] `scheduleEditor.test.ts` - Edit utilities
  - swapExercise with all scopes
  - updateExerciseParams with all scopes
  - deleteExercise
  - addExercise
- [ ] `dateMapping.test.ts` - Date calculations
  - getDayDate calculations
  - getWeekDateRange calculations
  - formatDateRange output

### Component Tests (Vitest + Testing Library)

Location: `tests/unit/components/schedule/`

- [ ] `ExerciseCard.test.ts`
  - Renders exercise name and params
  - Edit button triggers callback
  - Weight shown only when appropriate
- [ ] `CompoundBlockCard.test.ts`
  - Renders block type with correct color
  - Shows sub-exercises
  - Collapsible behavior
- [ ] `ExerciseBrowser.test.ts`
  - Search filters exercises
  - Filter dropdowns work
  - Selection triggers callback

### Integration Tests

Location: `tests/integration/schedule/`

- [ ] `schedule-flow.test.ts`
  - Create schedule end-to-end
  - Load template end-to-end
  - Edit exercise and verify persistence
  - Navigation between views

### Manual Testing

**Create Flow**:
1. Click "Create New"
2. Verify questionnaire answers display
3. Modify an answer
4. Click Generate
5. Verify schedule created and displayed
6. Verify saved to IndexedDB (check DevTools)

**Load Flow**:
1. Click "Load"
2. Select bundled template
3. Pick start date
4. Verify schedule created
5. Verify dates map correctly

**Navigation**:
1. View Calendar
2. Tap week -> verify Week View
3. Tap day -> verify Day View
4. Back button -> verify navigation
5. Swipe (if enabled) -> verify no conflict

**Editing**:
1. In Day View, tap edit on exercise
2. Swap exercise via browser
3. Select "All Weeks" scope
4. Verify change in all weeks
5. Repeat with other scopes

---

## Success Criteria

- [ ] Create new schedule from questionnaire answers
- [ ] Load schedule from bundled templates
- [ ] Import schedule from .json file
- [ ] View schedule in Calendar/Week/Day views
- [ ] Navigate between views via drill-down
- [ ] Edit exercises with scope options
- [ ] Exercise browser with search and filters
- [ ] Multiple schedules with one active
- [ ] Start date selection with correct mapping
- [ ] Changes persist to IndexedDB
- [ ] **ZERO DRIFT**: Stored structure matches engine ParameterizedWorkout exactly
- [ ] Works on mobile browsers
- [ ] All tests pass
- [ ] TypeScript compilation succeeds

---

## Dependencies

### Blocked By
- Ticket #016: Navigation Shell (COMPLETE)
- Working workout generation engine (COMPLETE)

### Blocks
- Ticket #018 (future): Live Tab - workout execution
- Ticket #019 (future): Profile Tab - history display

### External Dependencies
- idb (optional) - IndexedDB wrapper library (or use raw API)
- date-fns (optional) - Date manipulation (or use native Date)

---

## Risks & Mitigations

### Risk 1: IndexedDB Browser Compatibility
- **Impact**: Medium
- **Probability**: Low
- **Mitigation**: IndexedDB is widely supported. Test on Safari, Chrome, Firefox. Add localStorage fallback for critical data.

### Risk 2: Large Schedule Data Performance
- **Impact**: Low
- **Probability**: Low
- **Mitigation**: Schedules are 3-6 weeks with ~20 exercises/day. Even 100KB JSON is fast. If needed, add lazy loading for Day View.

### Risk 3: Edit Scope Logic Complexity
- **Impact**: Medium
- **Probability**: Medium
- **Mitigation**: Thorough unit tests for scheduleEditor.ts. Use structuredClone for immutable updates. Review against CLI editor logic.

### Risk 4: Date Mapping Edge Cases
- **Impact**: Low
- **Probability**: Medium
- **Mitigation**: Comprehensive dateMapping tests. Handle timezone issues by using date strings (ISO format without time).

### Risk 5: Engine Integration Issues
- **Impact**: High
- **Probability**: Low
- **Mitigation**: Engine is already tested (319 tests). Import directly from $lib/engine. Verify browser compatibility of engine code.

---

## Notes

### Design Decisions

1. **StoredSchedule vs ParameterizedWorkout**: We extend rather than wrap to keep data flat and queryable in IndexedDB.

2. **scheduleMetadata separation**: GUI-only fields in separate object to make it obvious what's engine data vs schedule state.

3. **Edit Scope**: Three options cover all use cases. "Remember for session" reduces friction for bulk edits.

4. **No Undo in IndexedDB**: Changes are immediate. Could add undo buffer in memory if needed.

5. **Templates as JSON files**: Simple, no build step, easy to add more. Could fetch from API in Phase 3.

### Future Considerations

- **Compound block creation**: Full EMOM/AMRAP/Circuit creation UI (like CLI 'b' key)
- **Drag-to-reorder**: Reorder exercises within a day
- **Week duplication**: Copy week structure
- **Export schedule**: Download as JSON
- **Share schedule**: Generate shareable link

### Related CLI Code

Port these functions from CLI:
- `cli/lib/interactive-workout-editor.ts`:
  - `createCompoundBlock()`
  - `setCompoundBlockType()`
  - `swapExercise()`
  - `updateExerciseField()`

---

## Commit Standards Reminder

**MANDATORY**: Follow CLAUDE.md commit message standards:
- Format: `type(scope): description under 50 chars`
- Types: feat, fix, docs, style, refactor, test, chore
- Scopes: schedule, ui, stores
- **NEVER include "Generated with Claude Code" or "Co-Authored-By: Claude"**

---

## Definition of Done

- [ ] All 7 phases implemented and tested
- [ ] All tests passing (unit + integration)
- [ ] TypeScript compilation succeeds
- [ ] Code reviewed (by code-quality-assessor agent)
- [ ] Success criteria met
- [ ] Manual testing on mobile devices completed
- [ ] Zero drift verified (stored data matches engine output)
- [ ] Committed with proper commit messages
- [ ] CLAUDE.md "Current Development Status" updated
