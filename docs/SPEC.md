# Shredly 2.0 - Frontend Framework Specification

**Version**: 2.0
**Date**: 2026-01-03
**Status**: Planning Phase

---

## Framework Stack

**Core**: SvelteKit + Capacitor + Tailwind CSS

### Why This Stack?

1. **SvelteKit**: Simplest modern framework with best DX for single-person projects
2. **Capacitor**: Web-first, native mobile wrapper (iOS/Android from same codebase)
3. **Tailwind**: Responsive styling without framework bloat

### Architecture Philosophy

**Client-Side Only (Phase 1)**:
- No backend, no auth, no database
- All state in localStorage/IndexedDB
- Deterministic workout generation from questionnaire + exercise database
- Future: Optional login for sync + social features

**Front/Backend Dichotomy (Within Client)**:
- **Frontend**: UI components, views, user interactions (Svelte)
- **Backend**: Data structures, workout generation logic, exercise history (TypeScript)

---

## Key Architectural Decisions

### 1. Three-Tab UI Layout
- **Profile**: User stats (age, weight, height), PRs (personal records), historical performance
  - PRs can be manually entered initially, then auto-populate from workout history
  - Data used for workout generation and future smart assistant features
- **Schedule**: Workout calendar/program view (replaces old calendar/week/day views)
- **Live**: Active workout execution interface (timer, progression through exercises)
  - Smart screen that guides user through current workout in real-time

### 2. Terminal Prototype First
- Build workout generation logic as CLI app
- Test deterministic generation with you (Claude) quickly
- Validate data structures before adding UI layer
- **Files**: `cli/test-runner.ts`

### 3. Data-Driven Generation
**Inputs**:
- Questionnaire responses (13 questions)
- Exercise database (326 exercises, categorized)
- Exercise history (completed workouts, PRs, progressions)

**Output**: Deterministic workout program (JSON)

**Logic**:
- Match user goals → training split
- Match equipment → exercise pool
- Match experience → complexity/volume
- Progressive overload based on history
- Handle injuries/preferences as constraints

### 4. Core Data Structures

**Workout Template** (see WORKOUT_SPEC.md for complete specification):
```typescript
{
  id: string,
  name: string,
  weeks: number,
  daysPerWeek: number,
  days: {
    "1": {
      dayNumber: number,
      type: "gym" | "home" | "outdoor" | "recovery",
      focus: string,
      exercises: [{
        name: string,  // References exercise_database.json
        week1: { sets?: number, reps?: number | string, rest?: number, weight?: WeightSpec },
        week2: { /* progression */ },
        // ... weekN
        sub_exercises?: [...]  // For EMOM/AMRAP/Circuits
      }]
    }
    // Days not defined = implicit rest
  }
}
```

**Exercise History**:
```javascript
{
  userId: string,
  exerciseName: string,
  completions: [{
    date: string,
    sets: [{weight: number, reps: number, rpe: number}],
    notes: string
  }],
  personalRecords: {
    maxWeight: {weight: number, date: string},
    maxVolume: {volume: number, date: string}
  }
}
```

**User Profile & Progress** (localStorage):
```typescript
{
  userStats: {age: number, weight: number, height: number},
  personalRecords: {exerciseName: {weight: number, reps: number, date: string}},
  currentProgram: {programId, startDate},
  completedWorkouts: [{date, dayNumber, exercises: [...]}],
  measurements: [{date, weight, bodyFat, ...}],
  generatedPrograms: [{id, questionnaire, template, generatedAt}]
}
```

---

## Project Structure

```
shredly2/
+-- cli/                          # Terminal prototype
|   +-- test-runner.ts            # CLI test harness
|   +-- sample-output.json        # Example generated programs
+-- src/
|   +-- routes/                   # SvelteKit pages
|   |   +-- +page.svelte          # Questionnaire
|   |   +-- profile/+page.svelte  # Profile tab (stats, PRs, history)
|   |   +-- schedule/+page.svelte # Schedule tab (workout calendar/program)
|   |   +-- live/+page.svelte     # Live tab (active workout execution)
|   +-- lib/
|   |   +-- stores/               # Svelte stores (state)
|   |   |   +-- workout.ts        # Current program
|   |   |   +-- history.ts        # Exercise history
|   |   |   +-- user.ts           # User preferences
|   |   +-- engine/               # SHARED generation logic (CLI + frontend)
|   |   |   +-- workout-generator.ts
|   |   |   +-- exercise-selector.ts
|   |   |   +-- progression-engine.ts
|   |   |   +-- types.ts          # Shared TypeScript types
|   |   +-- components/           # Reusable UI
|   |   |   +-- ExerciseCard.svelte
|   |   |   +-- WorkoutTimer.svelte
|   |   |   +-- ProgressChart.svelte
|   |   |   +-- PRTracker.svelte
|   +-- data/
|   |   +-- exercise-database.json
|   |   +-- questionnaire.json
|   |   +-- tom-defaults.json     # MySpace Tom default user
+-- static/                       # Assets
+-- capacitor.config.json         # Mobile config
+-- tailwind.config.js
+-- svelte.config.js
+-- tsconfig.json                 # TypeScript config
```

---

## Development Phases

### Phase 1: CLI Prototype (Week 1)
- Build workout generation as terminal app
- Test with various questionnaire inputs
- Validate exercise selection logic
- Ensure deterministic output (same input = same program)

### Phase 2: Core UI (Week 2-3)
- Port CLI logic to `lib/engine/`
- Build questionnaire flow in SvelteKit
- Implement three-tab layout (Profile, Schedule, Live)
- LocalStorage persistence for user stats and PRs

### Phase 3: History & Progression (Week 4)
- Exercise completion tracking in Live view
- Progressive overload calculations
- Auto-populate PRs from workout history
- Basic analytics in Profile tab

### Phase 4: Mobile Polish (Week 5)
- Capacitor integration
- Touch gestures (swipe between tabs, drag-to-reorder exercises)
- Offline-first architecture
- iOS/Android builds

### Phase 5: Future (Post-MVP)
- Optional login (Supabase or similar)
- Device sync across devices
- Smart workout assistant (uses PRs, history, user stats)
- Social features (share programs, workout buddies)
- Advanced analytics

---

## Technical Constraints

- **Language**: TypeScript for all code (CLI + frontend engine + UI). Shared generation logic runs in both Node and browser.
- **Node.js**: 20.x+ (LTS)
- **Target Browsers**: Modern evergreen (Chrome, Safari, Firefox last 2 versions)
- **Mobile**: iOS 14+, Android 10+
- **Bundle Size**: <200KB initial load (Svelte compiles small)
- **Offline**: Service worker for PWA (Phase 4)

---

## Workout Generation Algorithm

### Smart Muscle Group Balancing

**Purpose**: Ensure balanced primary muscle coverage (target ratio ≤5.0) across all split types.

**5-Tier Scoring System**:
1. **Tier 1** (Highest): Uncovered primary muscles → Score 2000+
2. **Tier 2** (High): Low-coverage primary muscles (≤2 hits) → Score 1000+
3. **Tier 3** (Medium): Uncovered secondary muscles → Score 100+
4. **Tier 4** (Low): Any muscle with coverage → Score 0-100
5. **Tier 5** (Lowest): Heavily covered muscles → Negative score

**Primary vs Secondary Muscles** (defined per split in `workout_generation_rules.json`):
- **Primary**: Must be balanced (e.g., Push = Chest/Shoulders/Triceps)
- **Secondary**: Can appear but won't dominate (e.g., Push = Traps/Core/Forearms)

**Determinism**:
- Production: No seed → random variety each generation
- Tests: Seed parameter → 100% reproducible (e.g., `generateWorkout(answers, 12345)`)

**Results**: Typical ratios 4-5 (down from 7-9), with rare edge cases at 7-8.

---

## Questions to Answer (Before UI Layer)

1. **Workout Generation Algorithm**: How to map questionnaire → training split?
2. **Exercise Selection**: How to filter 326 exercises to optimal subset?
3. **Progressive Overload**: What rules for week-to-week progression?
4. **Injury Handling**: How to exclude/substitute exercises based on text input?
5. **Determinism**: Should same input always generate same program, or add variance?

---

## Success Criteria

- Generate valid workout program from questionnaire in <2 seconds
- 100% client-side, zero backend dependencies (Phase 1)
- Responsive on mobile/desktop
- Exercise database drives all content (no hardcoded workouts)
- History tracking enables intelligent progression
- User can complete full workout tracking flow without internet

---

**Next Step**: Build CLI prototype to validate workout generation logic before touching UI.
