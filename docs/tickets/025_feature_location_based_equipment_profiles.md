# Ticket #025: Feature - Location-Based Equipment Profiles (Home vs Gym)

**Status**: In Progress
**Priority**: High
**Type**: feature
**Estimated Points**: 24 (fibonacci scale)
**Phase**: 2-UI

### Progress
- [x] **Phase 1**: Data Model and Types (3 pts) - COMPLETE
- [x] **Phase 2**: Equipment Editor Component (5 pts) - COMPLETE
- [ ] **Phase 3**: Day/Split Customizer (8 pts)
- [ ] **Phase 4**: Exercise Selector Equipment Filtering (5 pts)
- [ ] **Phase 5**: Schedule View Location Indicators (3 pts)

---

## Summary

Replace the simple three-option `equipment_access` questionnaire question with a location-aware system where users configure separate equipment profiles for "Home" and "Gym" locations, then assign which days of their weekly schedule will be at each location.

## Background

Currently, users select a single equipment access level (full_gym, dumbbells_only, bodyweight_only) that applies uniformly to all workout days. This is limiting for users who train at different locations throughout the week - for example, someone who goes to a full gym 3 days per week but also wants to do 2 home workouts with limited equipment.

The new system will:
1. Allow users to configure equipment available at "Home" and "Gym" separately
2. Let users assign which days go to which location
3. Filter exercises per-day based on that day's location equipment
4. Provide sensible defaults (Gym = all equipment, Home = basic equipment)

This creates more personalized workout programs that adapt to real-world training scenarios.

## Technical Requirements

### Data Structures

**New TypeScript types to add to `src/lib/types/user.ts`:**

```typescript
/**
 * All equipment types available in the exercise database
 * Derived from src/data/exercise_database.json equipment field values
 */
export const ALL_EQUIPMENT_TYPES = [
  'Barbell',
  'Dumbbell',
  'Dumbbells',
  'Kettlebell',
  'Bench',
  'Incline Bench',
  'Pull-up Bar',
  'Dip Station',
  'Parallel Bars',
  'Resistance Bands',
  'Resistance Band',
  'Cable Machine',
  'Squat Rack',
  'Power Rack',
  'Leg Extension Machine',
  'Belt Squat Machine',
  'Lat Pulldown Bar',
  'Rings',
  'Parallettes',
  'Box',
  'Platform',
  'Blocks',
  'Yoga Mat',
  'Foam Roller',
  'Chair',
  'Wall',
  'Weight Belt',
  'Chains',
  'Trap Bar',
  'Safety Squat Bar',
  'Cambered Bar',
  'Duffalo Bar',
  'Axle Bar',
  'Landmine Attachment',
  'T-Bar',
  'Battle Ropes',
  'Jump Rope',
  'Slingshot',
  'Nordic Curl Strap',
  'Anchor Point',
  'Plates',
  'Treadmill',
  'Stationary Bike',
  'Bicycle',
  'Rowing Machine',
  'Elliptical Machine',
  'Assault Bike',
  'Ski Erg',
  'Track',
  'Pool'
] as const;

export type EquipmentType = typeof ALL_EQUIPMENT_TYPES[number];

/**
 * Location types for workout days
 */
export type WorkoutLocation = 'home' | 'gym';

/**
 * Equipment profile for a specific location
 */
export interface LocationEquipmentProfile {
  location: WorkoutLocation;
  equipment: EquipmentType[];
}

/**
 * Day-to-location assignment for the weekly schedule
 */
export type DayLocationAssignment = Record<number, WorkoutLocation>; // dayNumber -> location

/**
 * Default equipment for each location
 */
export const DEFAULT_GYM_EQUIPMENT: EquipmentType[] = [
  'Barbell', 'Dumbbell', 'Dumbbells', 'Kettlebell', 'Bench', 'Incline Bench',
  'Pull-up Bar', 'Dip Station', 'Cable Machine', 'Squat Rack', 'Power Rack',
  'Leg Extension Machine', 'Lat Pulldown Bar', 'Box', 'Platform', 'Plates',
  'Yoga Mat', 'Foam Roller', 'Resistance Bands', 'Weight Belt', 'Trap Bar'
];

export const DEFAULT_HOME_EQUIPMENT: EquipmentType[] = [
  'Dumbbell', 'Dumbbells', 'Pull-up Bar', 'Resistance Bands', 'Resistance Band',
  'Bench', 'Yoga Mat', 'Foam Roller', 'Chair', 'Wall', 'Box', 'Jump Rope'
];
```

**Updates to `WorkoutPreferences` interface in `src/lib/types/user.ts`:**

```typescript
export interface WorkoutPreferences {
  goal: 'build_muscle' | 'tone' | 'lose_weight';
  session_duration: '20' | '30' | '60';
  experience_level: 'beginner' | 'intermediate' | 'advanced';
  // DEPRECATED - kept for backward compatibility migration
  equipment_access?: 'full_gym' | 'dumbbells_only' | 'bodyweight_only';
  // NEW: Location-based equipment
  homeEquipment: EquipmentType[];
  gymEquipment: EquipmentType[];
  dayLocations: DayLocationAssignment; // which days are home vs gym
  training_frequency: '2' | '3' | '4' | '5' | '6' | '7';
  program_duration: '3' | '4' | '6';
}
```

**Updates to workout day structure in `src/lib/engine/types.ts`:**

```typescript
// Add location field to day structure
export interface WorkoutDay {
  dayNumber: number;
  type: 'gym' | 'home' | 'outdoor' | 'recovery';
  location?: WorkoutLocation; // NEW: explicit location for equipment filtering
  focus: string;
  exercises: GeneratedExercise[];
}
```

### Code Locations

**Files to create:**
- `src/lib/components/profile/EquipmentEditor.svelte` - Equipment toggle component for profiles
- `src/lib/components/questionnaire/DayLocationSelector.svelte` - Day location assignment UI

**Files to modify:**
- `src/lib/types/user.ts` (lines 20-30) - Add new types and constants
- `src/lib/stores/user.ts` (lines 60-90) - Add migration logic and new methods
- `src/data/workout-questionnaire.json` - Update equipment question structure
- `src/lib/engine/exercise-selector.ts` (lines 156-181) - Update equipment filtering
- `src/lib/engine/phase1-structure.ts` (lines 136-150) - Update equipment mapping
- `src/routes/profile/+page.svelte` (lines 110-115, 316-335) - Add equipment profile editors
- `src/lib/components/schedule/CreateScheduleModal.svelte` - Update questionnaire flow

### Validation Rules

- Home equipment list must be a valid subset of ALL_EQUIPMENT_TYPES
- Gym equipment list must be a valid subset of ALL_EQUIPMENT_TYPES
- Day locations must map day numbers (1-7) to 'home' | 'gym'
- All training days must have a location assigned
- Backward compatibility: existing users with `equipment_access` must be migrated

---

## Implementation Plan

### Phase 1: Data Model and Types (3 points)

**Goal**: Define all new TypeScript types and update the user store with migration support

**Steps**:
1. Add new type definitions to `src/lib/types/user.ts`:
   - ALL_EQUIPMENT_TYPES constant (derived from exercise database)
   - EquipmentType type
   - WorkoutLocation type
   - LocationEquipmentProfile interface
   - DayLocationAssignment type
   - DEFAULT_GYM_EQUIPMENT constant
   - DEFAULT_HOME_EQUIPMENT constant
2. Update WorkoutPreferences interface with new fields
3. Update DEFAULT_USER with new preference structure
4. Add migration function to user store for existing users
5. Add helper methods to user store for updating equipment profiles

**Files**:
- Modify: `/home/wabbazzar/code/shredly2/src/lib/types/user.ts`
- Modify: `/home/wabbazzar/code/shredly2/src/lib/stores/user.ts`

**Testing**:
- [ ] Unit tests for type validation helpers
- [ ] Unit tests for migration function (old format -> new format)
- [ ] Unit tests for user store equipment update methods
- [ ] Verify DEFAULT_USER has valid equipment arrays

**Commit Message**:
```
feat(profile): add location-based equipment profile types

- Add ALL_EQUIPMENT_TYPES constant derived from exercise database
- Add WorkoutLocation, LocationEquipmentProfile, DayLocationAssignment types
- Add DEFAULT_GYM_EQUIPMENT and DEFAULT_HOME_EQUIPMENT constants
- Update WorkoutPreferences interface with homeEquipment, gymEquipment, dayLocations
- Add migration logic for existing users with legacy equipment_access field
```

**Agent Invocations**:
```bash
# Use shredly-code-writer for implementation
# Invoke: shredly-code-writer agent with "Implement Phase 1 for ticket #025 - Data Model and Types"

# Use test-writer for test creation
# Invoke: test-writer agent with "Write tests for location equipment types from ticket #025 Phase 1"

# Use code-quality-assessor after implementation
# Invoke: code-quality-assessor agent with "Review src/lib/types/user.ts and src/lib/stores/user.ts from ticket #025 Phase 1"
```

---

### Phase 2: Equipment Editor Component (5 points)

**Goal**: Create reusable component for editing equipment at a location

**Steps**:
1. Create EquipmentEditor.svelte component with:
   - Categorized equipment display (Weights, Machines, Cardio, Accessories)
   - Toggle switches for each equipment type
   - "Select All" / "Clear All" buttons
   - Visual grouping for better UX
   - Responsive grid layout for mobile
2. Add equipment categories for grouping:
   ```typescript
   const EQUIPMENT_CATEGORIES = {
     'Free Weights': ['Barbell', 'Dumbbell', 'Dumbbells', 'Kettlebell', 'Plates', 'Trap Bar', ...],
     'Machines': ['Cable Machine', 'Leg Extension Machine', 'Belt Squat Machine', ...],
     'Cardio': ['Treadmill', 'Stationary Bike', 'Rowing Machine', ...],
     'Bodyweight': ['Pull-up Bar', 'Dip Station', 'Parallel Bars', 'Rings', ...],
     'Accessories': ['Bench', 'Yoga Mat', 'Foam Roller', 'Resistance Bands', ...]
   };
   ```
3. Integrate into Profile page as collapsible sections for Home and Gym

**Files**:
- Create: `/home/wabbazzar/code/shredly2/src/lib/components/profile/EquipmentEditor.svelte`
- Modify: `/home/wabbazzar/code/shredly2/src/routes/profile/+page.svelte`

**Testing**:
- [ ] Component renders all equipment types
- [ ] Toggle state persists to user store
- [ ] Select All / Clear All work correctly
- [ ] Mobile responsive layout verified
- [ ] Accessibility: proper labels and ARIA attributes

**Commit Message**:
```
feat(profile): add equipment editor component for location profiles

- Create EquipmentEditor.svelte with categorized equipment toggles
- Add equipment categories for visual grouping (Weights, Machines, Cardio, etc.)
- Integrate into Profile page with collapsible Home/Gym sections
- Support Select All / Clear All actions
- Responsive grid layout for mobile
```

**Agent Invocations**:
```bash
# Use shredly-code-writer for implementation
# Invoke: shredly-code-writer agent with "Implement Phase 2 for ticket #025 - Equipment Editor Component"

# Use test-writer for test creation
# Invoke: test-writer agent with "Write tests for EquipmentEditor.svelte from ticket #025 Phase 2"

# Use code-quality-assessor after implementation
# Invoke: code-quality-assessor agent with "Review EquipmentEditor.svelte and profile page from ticket #025 Phase 2"
```

---

### Phase 3: Day/Split Customizer in Questionnaire (8 points)

**Goal**: Replace equipment_access question with an interactive split customizer that lets users configure both day focus types AND locations

**Design Overview**:

The Days/Week selector is replaced with a dynamic "Your Week" section that shows day cards. Each card displays:
- **Focus type** (Push, Pull, Legs, etc.) - tap to change via dropdown
- **Location** (Home/Gym) - tap badge to toggle

```
Your Week (tap to customize)
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│Push  ▼ │ │Pull  ▼ │ │Legs  ▼ │ │Mobil ▼ │
│        │ │        │ │        │ │        │
│🏠 Home │ │🏋️ Gym │ │🏋️ Gym │ │🏠 Home │
└────────┘ └────────┘ └────────┘ └────────┘
  Day 1      Day 2      Day 3      Day 4     [+ Add]
```

**Key Features**:
1. **Add/Remove Days**: Users can add days (up to 7) or remove days (minimum 2) directly in this view
2. **Duplicate Focuses Allowed**: User can have two Push days if desired
3. **Equipment Mismatch Warning**: If user selects a barbell-heavy focus (e.g., Push-Strength, Legs) for a Home day but their home equipment doesn't include Barbell, show a warning badge

**Steps**:
1. Create DaySplitCustomizer.svelte component:
   - Display day cards in a horizontal scrollable row
   - Each card shows focus dropdown + location toggle
   - "+ Add Day" button at end (disabled if at 7 days)
   - "X" button on each card to remove (disabled if at 2 days)
   - Color coding: Gym = indigo, Home = emerald

2. Focus type dropdown options (grouped):
   ```typescript
   const FOCUS_OPTIONS = {
     'Strength': ['Push', 'Pull', 'Legs', 'Upper', 'Lower'],
     'Strength+': ['Push-Strength', 'Pull-Strength', 'Legs-Strength'],
     'Volume': ['Push-Volume', 'Pull-Volume', 'Legs-Volume', 'Upper-Volume', 'Lower-Volume'],
     'HIIT': ['Push-HIIT', 'Pull-HIIT', 'Legs-HIIT', 'Upper-HIIT', 'Lower-HIIT'],
     'Recovery': ['FullBody-Mobility', 'Flexibility']
   };
   ```

3. Auto-assignment defaults:
   - Load from `prescriptive_splits[goal][frequency]` config
   - Assign locations by priority:
     - Legs, Pull → Gym (need racks/machines)
     - Push, Upper, Lower → Gym if available, else Home
     - Volume/HIIT variants → Home (can work with dumbbells)
     - Mobility/Flexibility → Home

4. Equipment mismatch detection (CONFIG-DRIVEN):

   Add to `workout_generation_rules.json`:
   ```json
   "focus_equipment_requirements": {
     "description": "Maps focus types to recommended equipment. Used to warn users when location equipment may be insufficient.",
     "Push": {
       "recommended": ["Barbell", "Bench"],
       "warning": "Bench press works best with a barbell and bench"
     },
     "Pull": {
       "recommended": ["Barbell", "Cable Machine"],
       "warning": "Deadlifts and rows work best with a barbell"
     },
     "Legs": {
       "recommended": ["Barbell", "Squat Rack"],
       "warning": "Squats work best with a barbell and rack"
     },
     "Push-Strength": {
       "recommended": ["Barbell", "Bench", "Power Rack"],
       "warning": "Heavy bench press requires barbell and rack"
     },
     "Pull-Strength": {
       "recommended": ["Barbell", "Power Rack"],
       "warning": "Heavy deadlifts require a barbell"
     },
     "Legs-Strength": {
       "recommended": ["Barbell", "Squat Rack", "Power Rack"],
       "warning": "Heavy squats require barbell and rack"
     },
     "Upper": {
       "recommended": ["Barbell", "Bench"],
       "warning": "Upper body compounds work best with a barbell"
     },
     "Lower": {
       "recommended": ["Barbell", "Squat Rack"],
       "warning": "Lower body compounds work best with a barbell"
     },
     "Push-Volume": {
       "recommended": ["Dumbbell"],
       "warning": null
     },
     "Pull-Volume": {
       "recommended": ["Dumbbell", "Pull-up Bar"],
       "warning": null
     },
     "Legs-Volume": {
       "recommended": ["Dumbbell"],
       "warning": null
     },
     "Push-HIIT": {
       "recommended": [],
       "warning": null
     },
     "Pull-HIIT": {
       "recommended": ["Pull-up Bar"],
       "warning": null
     },
     "Legs-HIIT": {
       "recommended": [],
       "warning": null
     },
     "Upper-HIIT": {
       "recommended": [],
       "warning": null
     },
     "Lower-HIIT": {
       "recommended": [],
       "warning": null
     },
     "Upper-Volume": {
       "recommended": ["Dumbbell"],
       "warning": null
     },
     "Lower-Volume": {
       "recommended": ["Dumbbell"],
       "warning": null
     },
     "FullBody-Mobility": {
       "recommended": ["Yoga Mat"],
       "warning": null
     },
     "Flexibility": {
       "recommended": ["Yoga Mat"],
       "warning": null
     }
   }
   ```

   Helper function reads from config:
   ```typescript
   import rules from '$data/workout_generation_rules.json';

   function getEquipmentWarning(focus: string, location: 'home' | 'gym', locationEquipment: string[]): string | null {
     const requirements = rules.focus_equipment_requirements[focus];
     if (!requirements || !requirements.warning) return null;

     const missingEquipment = requirements.recommended.filter(
       (eq: string) => !locationEquipment.includes(eq)
     );

     if (missingEquipment.length === 0) return null;
     return requirements.warning;
   }
   ```
   Show warning icon + tooltip with the config-driven message.

5. Update QuickCustomize.svelte:
   - Remove old Days/Week button row
   - Remove old Equipment button row
   - Insert DaySplitCustomizer component
   - Pass homeEquipment from userStore for mismatch detection

6. Update QuestionnaireAnswers type to include:
   ```typescript
   interface DayConfig {
     focus: string;        // e.g., "Push", "Legs-HIIT"
     location: 'home' | 'gym';
   }

   interface QuestionnaireAnswers {
     goal: string;
     session_duration: string;
     experience_level: string;
     // REMOVED: equipment_access
     // REMOVED: training_frequency (now derived from dayConfigs.length)
     dayConfigs: DayConfig[];  // NEW: array of day configurations
     program_duration: string;
   }
   ```

**Files**:
- Create: `/home/wabbazzar/code/shredly2/src/lib/components/questionnaire/DaySplitCustomizer.svelte`
- Create: `/home/wabbazzar/code/shredly2/src/lib/components/questionnaire/DayCard.svelte`
- Modify: `/home/wabbazzar/code/shredly2/src/lib/components/schedule/QuickCustomize.svelte`
- Modify: `/home/wabbazzar/code/shredly2/src/lib/engine/types.ts` (QuestionnaireAnswers)
- Modify: `/home/wabbazzar/code/shredly2/src/data/workout_generation_rules.json` (add focus_equipment_requirements)

**Testing**:
- [ ] Component renders correct number of days from defaults
- [ ] Tap focus dropdown changes day type
- [ ] Tap location badge toggles Home/Gym
- [ ] Add day button works (up to 7)
- [ ] Remove day button works (minimum 2)
- [ ] Duplicate focuses allowed (two Push days)
- [ ] Equipment mismatch warning shows correctly
- [ ] Mobile touch targets are 44px minimum
- [ ] Horizontal scroll works on narrow screens

**Commit Message**:
```
feat(questionnaire): add interactive day/split customizer

- Create DaySplitCustomizer with day cards for focus + location
- Support add/remove days directly in questionnaire (2-7 days)
- Allow duplicate focus types (user choice)
- Show equipment mismatch warning for barbell focuses at home
- Load smart defaults from prescriptive_splits config
- Replace equipment_access and training_frequency questions
```

**Agent Invocations**:
```bash
# Use shredly-code-writer for implementation
# Invoke: shredly-code-writer agent with "Implement Phase 3 for ticket #025 - Day/Split Customizer"

# Use test-writer for test creation
# Invoke: test-writer agent with "Write tests for DaySplitCustomizer.svelte from ticket #025 Phase 3"

# Use code-quality-assessor after implementation
# Invoke: code-quality-assessor agent with "Review DaySplitCustomizer.svelte and QuickCustomize from ticket #025 Phase 3"
```

---

### Phase 4: Exercise Selector Equipment Filtering (5 points)

**Goal**: Update exercise selection to filter by day-specific location equipment

**Steps**:
1. Update `checkEquipmentAvailability()` in exercise-selector.ts:
   - Accept equipment array directly instead of access level string
   - Remove hardcoded equipmentByAccess mapping
2. Update `selectExercisesForDay()` to:
   - Accept dayLocation parameter
   - Look up equipment list for that location from preferences
   - Pass equipment array to filtering functions
3. Update `buildDayStructure()` in phase1-structure.ts:
   - Determine day type based on available equipment at location
   - If location has barbell -> can use full_gym structure
   - If no barbell but has dumbbells -> use dumbbells_only structure
   - If only bodyweight equipment -> use bodyweight_only structure
4. Update workout generator to pass location information through

**Files**:
- Modify: `/home/wabbazzar/code/shredly2/src/lib/engine/exercise-selector.ts`
- Modify: `/home/wabbazzar/code/shredly2/src/lib/engine/phase1-structure.ts`
- Modify: `/home/wabbazzar/code/shredly2/src/lib/engine/workout-generator.ts`

**Testing**:
- [ ] Unit tests for equipment array filtering
- [ ] Integration tests for day-specific exercise selection
- [ ] Verify gym days get gym-appropriate exercises
- [ ] Verify home days get home-appropriate exercises
- [ ] Backward compatibility with legacy equipment_access users

**Commit Message**:
```
feat(engine): update exercise selection for location-based equipment

- Refactor checkEquipmentAvailability to accept equipment array
- Update selectExercisesForDay with dayLocation parameter
- Update buildDayStructure to derive day type from location equipment
- Pass location equipment through workout generation pipeline
- Maintain backward compatibility with legacy equipment_access
```

**Agent Invocations**:
```bash
# Use shredly-code-writer for implementation
# Invoke: shredly-code-writer agent with "Implement Phase 4 for ticket #025 - Exercise Selector Equipment Filtering"

# Use test-writer for test creation
# Invoke: test-writer agent with "Write tests for location-based equipment filtering from ticket #025 Phase 4"

# Use code-quality-assessor after implementation
# Invoke: code-quality-assessor agent with "Review exercise-selector.ts and phase1-structure.ts from ticket #025 Phase 4"
```

---

### Phase 5: Schedule View Location Indicators (3 points)

**Goal**: Display location (Home/Gym) on schedule day cards

**Steps**:
1. Update DayCard.svelte (or equivalent) to show location badge
2. Add location indicator with icon:
   - Gym: Building icon + "Gym" label
   - Home: Home icon + "Home" label
3. Store location in workout day structure when schedule is generated
4. Allow changing day location from schedule view (re-filters exercises on change)

**Files**:
- Modify: `/home/wabbazzar/code/shredly2/src/lib/components/schedule/DayCard.svelte` (or similar)
- Modify: `/home/wabbazzar/code/shredly2/src/lib/stores/schedule.ts`

**Testing**:
- [ ] Location badge displays correctly on day cards
- [ ] Location change triggers exercise re-filter
- [ ] Location persists after page reload
- [ ] Mobile layout accommodates location badge

**Commit Message**:
```
feat(schedule): add location indicators to day cards

- Display Home/Gym badge on schedule day cards
- Add building and home icons for visual distinction
- Store location in workout day structure
- Allow changing day location from schedule view
```

**Agent Invocations**:
```bash
# Use shredly-code-writer for implementation
# Invoke: shredly-code-writer agent with "Implement Phase 5 for ticket #025 - Schedule View Location Indicators"

# Use test-writer for test creation
# Invoke: test-writer agent with "Write tests for schedule location indicators from ticket #025 Phase 5"

# Use code-quality-assessor after implementation
# Invoke: code-quality-assessor agent with "Review schedule components from ticket #025 Phase 5"
```

---

## Testing Strategy

### Unit Tests (Vitest)

**Location**: `tests/unit/`

- [ ] Test `migrateEquipmentAccess()` migration function with all legacy values
- [ ] Test equipment type validation helpers
- [ ] Test day location assignment validation
- [ ] Test equipment array filtering in exercise-selector
- [ ] Test day type derivation from equipment array
- [ ] Test DEFAULT_GYM_EQUIPMENT and DEFAULT_HOME_EQUIPMENT are valid
- [ ] Run: `npm run test:unit`

### Integration Tests (Vitest)

**Location**: `tests/integration/`

- [ ] Test full workout generation with mixed home/gym days
- [ ] Test gym day gets barbell exercises when barbell in gym equipment
- [ ] Test home day doesn't get barbell exercises when barbell not in home equipment
- [ ] Test backward compatibility with legacy equipment_access users
- [ ] Run: `npm run test:integration`

### Manual Testing

**Profile Page**:
1. Open Profile tab
2. Expand "Home Equipment" section
3. Toggle equipment on/off
4. Verify changes persist after page reload
5. Repeat for "Gym Equipment" section

**Questionnaire Flow**:
1. Go to Schedule tab
2. Click "New Schedule"
3. Fill out questionnaire until Day Location step
4. Verify training days shown match frequency
5. Toggle days between Home/Gym
6. Complete schedule creation
7. Verify generated days have correct location

**Schedule View**:
1. View generated schedule
2. Verify location badges on day cards
3. Verify gym days have gym-appropriate exercises
4. Verify home days have home-appropriate exercises
5. Change a day's location
6. Verify exercises are re-filtered

**Mobile Testing**:
- Test on iOS simulator/device
- Test on Android emulator/device
- Verify equipment toggles have 44px+ touch targets
- Verify day location selector is usable on small screens

### Test Acceptance Criteria

- [ ] All unit tests pass (`npm run test:unit`)
- [ ] All integration tests pass (`npm run test:integration`)
- [ ] All tests pass together (`npm test`)
- [ ] TypeScript compilation succeeds (`npm run typecheck`)
- [ ] Build succeeds (`npm run build`)
- [ ] Manual testing checklist complete
- [ ] Existing tests still pass (no regressions)

---

## Success Criteria

- [ ] Users can configure separate equipment lists for Home and Gym
- [ ] Users can assign which days of the week are Home vs Gym
- [ ] Exercise selection correctly filters by day's location equipment
- [ ] Default equipment for Gym includes all common gym equipment
- [ ] Default equipment for Home includes basic home gym equipment
- [ ] Backward compatibility: existing users migrate seamlessly
- [ ] Questionnaire flow remains smooth (not too many steps)
- [ ] Schedule view clearly shows each day's location
- [ ] Code follows CLAUDE.md standards
- [ ] Data structures comply with existing types
- [ ] TypeScript types are properly defined
- [ ] Tests provide >80% coverage of new code
- [ ] Mobile UX is smooth (44px+ touch targets)

---

## Dependencies

### Blocked By
- None (no prior tickets required)

### Blocks
- Future tickets for location-based workout suggestions
- Future tickets for travel/vacation mode (temporary equipment changes)

### External Dependencies
- None (no external packages needed)

---

## Risks & Mitigations

### Risk 1: Migration Complexity for Existing Users
- **Impact**: Medium
- **Probability**: Medium
- **Mitigation**:
  - Implement migration function that maps legacy `equipment_access` to new structure
  - `full_gym` -> all gym equipment, home equipment = DEFAULT_HOME_EQUIPMENT
  - `dumbbells_only` -> gym = dumbbells + accessories, home = same
  - `bodyweight_only` -> both = bodyweight only equipment
  - Test migration thoroughly with all legacy values

### Risk 2: UI Complexity Increase in Questionnaire
- **Impact**: Medium
- **Probability**: Low
- **Mitigation**:
  - Keep day location selector visual and intuitive (tap to toggle)
  - Provide sensible auto-assignment defaults
  - Allow users to skip detailed equipment setup initially (use defaults)
  - Equipment editing is in Profile (advanced), not questionnaire (simple)

### Risk 3: Exercise Pool Too Small for Some Equipment Combinations
- **Impact**: Low
- **Probability**: Medium
- **Mitigation**:
  - Fall back to bodyweight exercises if filtered pool is too small
  - Show warning if equipment selection yields very limited exercises
  - Suggest adding equipment types that would unlock more exercises

### Risk 4: Performance Impact from Per-Day Equipment Lookup
- **Impact**: Low
- **Probability**: Low
- **Mitigation**:
  - Equipment arrays are small (< 50 items)
  - Lookup is O(n) with Set conversion for O(1) checks
  - Generation happens once on schedule creation, not on every view

---

## Notes

### Equipment Category Groupings for UI

For better UX in the EquipmentEditor, group equipment into categories:

```typescript
export const EQUIPMENT_CATEGORIES = {
  'Free Weights': [
    'Barbell', 'Dumbbell', 'Dumbbells', 'Kettlebell', 'Plates',
    'Trap Bar', 'Safety Squat Bar', 'Cambered Bar', 'Duffalo Bar', 'Axle Bar'
  ],
  'Benches & Racks': [
    'Bench', 'Incline Bench', 'Squat Rack', 'Power Rack', 'Box', 'Platform', 'Blocks'
  ],
  'Machines': [
    'Cable Machine', 'Leg Extension Machine', 'Belt Squat Machine',
    'Lat Pulldown Bar', 'Landmine Attachment', 'T-Bar'
  ],
  'Cardio Equipment': [
    'Treadmill', 'Stationary Bike', 'Bicycle', 'Rowing Machine',
    'Elliptical Machine', 'Assault Bike', 'Ski Erg', 'Track', 'Pool'
  ],
  'Bodyweight & Gymnastics': [
    'Pull-up Bar', 'Dip Station', 'Parallel Bars', 'Parallettes',
    'Rings', 'Nordic Curl Strap'
  ],
  'Bands & Cables': [
    'Resistance Bands', 'Resistance Band', 'Battle Ropes', 'Anchor Point'
  ],
  'Accessories': [
    'Yoga Mat', 'Foam Roller', 'Chair', 'Wall', 'Weight Belt',
    'Chains', 'Slingshot', 'Jump Rope'
  ]
};
```

### Auto-Assignment Logic Details

When loading defaults from `prescriptive_splits[goal][frequency]`, assign locations using this priority system.

**Gym Priority Order** (highest equipment dependency first):
| Priority | Focus Types | Reason |
|----------|-------------|--------|
| 1 | Legs, Legs-Strength | Squats need rack |
| 2 | Pull, Pull-Strength | Deadlifts, heavy rows |
| 3 | Push, Push-Strength | Bench press |
| 4 | Upper, Lower | Compound movements |
| 5 | Upper-Volume, Lower-Volume | Can work with dumbbells |
| 6 | Push-Volume, Pull-Volume, Legs-Volume | Dumbbell-friendly |
| 7 | All HIIT variants | Bodyweight works fine |
| 8 | FullBody-Mobility, Flexibility | No equipment needed |

**Algorithm**:
```typescript
function autoAssignLocations(dayConfigs: DayConfig[], defaultGymDays: number = 3): void {
  // Sort days by gym priority (lower = needs gym more)
  const priorityOrder = ['Legs', 'Legs-Strength', 'Pull', 'Pull-Strength', 'Push', 'Push-Strength',
                         'Upper', 'Lower', 'Upper-Volume', 'Lower-Volume',
                         'Push-Volume', 'Pull-Volume', 'Legs-Volume',
                         'Push-HIIT', 'Pull-HIIT', 'Legs-HIIT', 'Upper-HIIT', 'Lower-HIIT',
                         'FullBody-Mobility', 'Flexibility'];

  // Create array of indices sorted by priority
  const sortedIndices = dayConfigs
    .map((day, i) => ({ index: i, priority: priorityOrder.indexOf(day.focus) }))
    .sort((a, b) => a.priority - b.priority);

  // Assign gym to top N priority days
  sortedIndices.forEach((item, rank) => {
    dayConfigs[item.index].location = rank < defaultGymDays ? 'gym' : 'home';
  });
}
```

**Default Gym Days by Goal**:
- **build_muscle**: More gym days (strength needs equipment)
  - 2-3 days: all gym
  - 4+ days: 3 gym days
- **tone**: Balanced
  - 2-3 days: all gym
  - 4+ days: 2-3 gym days
- **lose_weight**: Fewer gym days (HIIT works at home)
  - 2 days: 1 gym, 1 home
  - 3+ days: 2 gym days max

### Backward Compatibility Mapping

```typescript
function migrateEquipmentAccess(
  legacyAccess: 'full_gym' | 'dumbbells_only' | 'bodyweight_only'
): { homeEquipment: EquipmentType[], gymEquipment: EquipmentType[] } {
  switch (legacyAccess) {
    case 'full_gym':
      return {
        homeEquipment: DEFAULT_HOME_EQUIPMENT,
        gymEquipment: DEFAULT_GYM_EQUIPMENT
      };
    case 'dumbbells_only':
      return {
        homeEquipment: ['Dumbbell', 'Dumbbells', 'Bench', 'Yoga Mat', 'Chair', 'Wall'],
        gymEquipment: ['Dumbbell', 'Dumbbells', 'Bench', 'Pull-up Bar', 'Yoga Mat', 'Chair', 'Wall']
      };
    case 'bodyweight_only':
      return {
        homeEquipment: ['Pull-up Bar', 'Chair', 'Wall', 'Yoga Mat', 'Box'],
        gymEquipment: ['Pull-up Bar', 'Chair', 'Wall', 'Yoga Mat', 'Box', 'Platform']
      };
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
- [ ] All tests passing (655+ existing + new tests)
- [ ] TypeScript compilation succeeds
- [ ] Code reviewed (by code-quality-assessor agent)
- [ ] Success criteria met
- [ ] Profile page has working equipment editors
- [ ] Questionnaire has day location selector
- [ ] Schedule shows location badges
- [ ] Exercise selection respects day equipment
- [ ] Migration works for existing users
- [ ] Committed with proper commit messages
- [ ] CLAUDE.md "Current Development Status" updated
