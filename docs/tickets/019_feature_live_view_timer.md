# Ticket #019: Feature - Live View Timer

**Status**: Open
**Priority**: High
**Type**: feature
**Estimated Points**: 21 (across 6 phases)
**Phase**: 2-UI

---

## Summary

Implement the Live View timer feature with exercise-aware timing modes, visual phase states, audio cues, and data logging for workout execution tracking. This is the core interactive workout experience in Shredly 2.0.

## Background

The Live tab is one of the three core tabs in Shredly 2.0 (Profile, Schedule, Live). It provides real-time workout execution guidance with timers that adapt to exercise type (Strength, EMOM, AMRAP, Interval, Circuit). The timer feature needs to:

1. Guide users through workouts without constant screen monitoring (audio-first UX)
2. Handle different timing patterns for each exercise category
3. Log workout data at appropriate breakpoints
4. Continue running when app is backgrounded
5. Work seamlessly on mobile devices

This ticket implements the TIMER_SPEC.md specification, building on the completed Schedule tab infrastructure.

## Technical Requirements

### Data Structures

**Reference Documents**:
- `docs/TIMER_SPEC.md` - Complete timer specification
- `docs/EXERCISE_HISTORY_SPEC.md` - Data logging format (20-column CSV schema)
- `docs/WORKOUT_SPEC.md` - Exercise structure and weekly parameters

**New Data Files**:
- Create `src/data/timer_config.json` - Timer behavior configuration

**Storage Keys**:
- `shredly_exercise_history_v2` - CSV history data (localStorage)
- `shredly_live_session` - Active workout session (localStorage)
- `shredly_audio_config` - Audio preferences (localStorage)

### Code Locations

**Files to Create**:
- `src/lib/stores/liveSession.ts` - Live workout session store
- `src/lib/stores/history.ts` - Exercise history store (CSV management)
- `src/lib/engine/timer-engine.ts` - Timer state machine logic
- `src/lib/components/live/TimerDisplay.svelte` - Main timer component
- `src/lib/components/live/ExerciseList.svelte` - Bottom half exercise display
- `src/lib/components/live/DataEntryModal.svelte` - Post-set data entry
- `src/lib/components/live/ExerciseInfoModal.svelte` - Exercise details popup
- `src/lib/components/live/TimerControls.svelte` - Play/pause/next controls
- `src/lib/utils/audioManager.ts` - Audio cue management
- `src/data/timer_config.json` - Timer configuration
- `static/audio/countdown.mp3` - Countdown chirp sound
- `static/audio/work_complete.mp3` - Set completion chime
- `static/audio/block_complete.mp3` - Block/exercise completion
- `static/audio/minute_marker.mp3` - Minute marker for EMOM/AMRAP

**Files to Modify**:
- `src/routes/live/+page.svelte` - Replace placeholder with timer UI
- `src/lib/stores/schedule.ts` - Add helper to get workout for today
- `src/lib/engine/types.ts` - Add timer-related TypeScript types

### TypeScript Types

Add to `src/lib/engine/types.ts`:

```typescript
// Timer phase types
export type TimerPhase = 'idle' | 'work' | 'rest' | 'countdown' | 'complete' | 'paused' | 'entry';

// Timer mode based on exercise type
export type TimerMode = 'countdown' | 'count_up';

// Exercise category for timer behavior
export type TimerExerciseType = 'strength' | 'bodyweight' | 'emom' | 'amrap' | 'interval' | 'circuit';

export interface TimerState {
  mode: TimerMode;
  phase: TimerPhase;
  exerciseType: TimerExerciseType;

  // Time tracking
  totalSeconds: number;
  remainingSeconds: number;

  // Set/round tracking
  currentSet: number;
  totalSets: number;
  currentSubExercise: number;
  totalSubExercises: number;

  // Minute tracking (EMOM/AMRAP)
  currentMinute: number;
  totalMinutes: number;

  // Audio state
  audioEnabled: boolean;
  lastAudioCue: string | null;
}

export interface TimerConfig {
  exerciseType: TimerExerciseType;
  mode: TimerMode;
  phases: TimerPhase[];
  workCalculation: 'tempo_based' | 'fixed' | 'from_prescription';
  countdownBefore: TimerPhase | null;
  logTiming: 'after_each_set' | 'after_block';
  minuteMarkers: boolean;
}

export interface AudioConfig {
  enabled: boolean;
  countdownEnabled: boolean;
  completionEnabled: boolean;
  minuteMarkersEnabled: boolean;
  volume: number;
  duckMusic: boolean;
}

export interface LiveWorkoutSession {
  workoutId: string;
  scheduleId: string;
  weekNumber: number;
  dayNumber: number;
  startTime: string;  // ISO timestamp
  currentExerciseIndex: number;
  exercises: LiveExercise[];
  logs: ExerciseLog[];
  timerState: TimerState;
  audioConfig: AudioConfig;
  isPaused: boolean;
  pauseStartTime: string | null;
  totalPauseTime: number;  // seconds
}

export interface LiveExercise {
  exerciseName: string;
  exerciseType: TimerExerciseType;
  isCompoundParent: boolean;
  subExercises: LiveExercise[];
  prescription: {
    sets: number;
    reps: number | null;
    weight: number | null;
    weightUnit: 'lbs' | 'kg' | null;
    workTimeSeconds: number | null;
    restTimeSeconds: number | null;
    tempo: string | null;
  };
  completed: boolean;
  completedSets: number;
}

export interface SetLog {
  setNumber: number;
  reps: number | null;
  weight: number | null;
  weightUnit: 'lbs' | 'kg' | null;
  workTime: number | null;
  rpe: number | null;
  rir: number | null;
  completed: boolean;
  notes: string | null;
  timestamp: string;
}

export interface ExerciseLog {
  exerciseName: string;
  exerciseOrder: number;
  isCompoundParent: boolean;
  compoundParentName: string | null;
  sets: SetLog[];
  totalTime?: number;
  totalRounds?: number;
  timestamp: string;
}
```

### Timer Config JSON

Create `src/data/timer_config.json`:

```json
{
  "version": "1.0.0",
  "timer_behavior": {
    "strength": {
      "mode": "countdown",
      "phases": ["work", "rest"],
      "work_calculation": "tempo_based",
      "countdown_before": "work",
      "log_timing": "after_each_set"
    },
    "bodyweight": {
      "mode": "countdown",
      "phases": ["work", "rest"],
      "work_calculation": "tempo_based",
      "countdown_before": "work",
      "log_timing": "after_each_set"
    },
    "emom": {
      "mode": "countdown",
      "phases": ["continuous"],
      "minute_markers": true,
      "countdown_at_minute_end": true,
      "log_timing": "after_block"
    },
    "amrap": {
      "mode": "countdown",
      "phases": ["continuous"],
      "minute_markers": true,
      "countdown_at_minute_end": true,
      "log_timing": "after_block"
    },
    "interval": {
      "mode": "countdown",
      "phases": ["work", "rest"],
      "countdown_before": "work",
      "log_timing": "after_block"
    },
    "circuit": {
      "mode": "count_up",
      "phases": ["continuous"],
      "minute_markers": true,
      "log_timing": "after_block"
    }
  },
  "audio": {
    "countdown_seconds": [3, 2, 1],
    "sounds": {
      "countdown": "countdown.mp3",
      "work_complete": "work_complete.mp3",
      "block_complete": "block_complete.mp3",
      "minute_marker": "minute_marker.mp3"
    }
  },
  "visual": {
    "colors": {
      "work": "#22c55e",
      "rest": "#3b82f6",
      "countdown": "#eab308",
      "complete": "#a855f7",
      "paused": "#6b7280"
    }
  },
  "defaults": {
    "tempo_seconds_per_rep": 4,
    "min_rest_seconds": 10,
    "countdown_duration_seconds": 3
  }
}
```

---

## Implementation Plan

### Phase 1: Timer Engine Core (5 points)

**Goal**: Implement the timer state machine with phase transitions

**Steps**:
1. Create TypeScript types in `src/lib/engine/types.ts` (timer-related interfaces)
2. Create `src/lib/engine/timer-engine.ts` with:
   - `TimerEngine` class with state machine logic
   - `calculateWorkDuration()` - tempo-based work time calculation
   - `getTimerConfigForExercise()` - lookup timer behavior by exercise type
   - Phase transition methods: `startWork()`, `startRest()`, `startCountdown()`, `pause()`, `resume()`
   - Tick handler for countdown/count-up
3. Create `src/data/timer_config.json` with timer behavior configuration
4. Write unit tests for timer state machine transitions

**Files**:
- Create: `src/lib/engine/timer-engine.ts`
- Create: `src/data/timer_config.json`
- Modify: `src/lib/engine/types.ts` (add timer types)

**Testing**:
- [ ] Unit tests for TimerEngine state transitions in `tests/unit/timer-engine.test.ts`
- [ ] Unit tests for work duration calculation (4 sec/rep default)
- [ ] Unit tests for phase transitions (idle -> work -> rest -> complete)
- [ ] Unit tests for each exercise type timer behavior

**Commit Message**:
```
feat(live): add timer engine state machine

- Create TimerEngine class with phase transition logic
- Add timer config JSON for exercise-type behaviors
- Calculate work duration based on tempo (4 sec/rep default)
- Support countdown and count-up modes
```

**Agent Invocations**:
```bash
# Use shredly-code-writer for implementation
# Invoke: shredly-code-writer agent with "Implement Phase 1 for ticket #019 - Timer Engine Core"

# Use test-writer for test creation
# Invoke: test-writer agent with "Write tests for TimerEngine state machine from ticket #019 Phase 1"

# Use code-quality-assessor after implementation
# Invoke: code-quality-assessor agent with "Review timer-engine.ts from ticket #019 Phase 1"
```

---

### Phase 2: Live Session Store (4 points)

**Goal**: Create stores for live workout session state and persistence

**Steps**:
1. Create `src/lib/stores/liveSession.ts` with:
   - `liveSession` writable store for active session
   - `startWorkout()` - initialize session from schedule day
   - `pauseWorkout()`, `resumeWorkout()` - pause handling
   - `advanceToNextExercise()`, `advanceToNextSet()` - navigation
   - `saveSession()` - persist to localStorage
   - `loadSession()` - restore from localStorage
   - `endWorkout()` - finalize and clear session
2. Create helper in `src/lib/stores/schedule.ts` to get today's workout
3. Add session persistence to localStorage (key: `shredly_live_session`)
4. Write unit tests for session lifecycle

**Files**:
- Create: `src/lib/stores/liveSession.ts`
- Modify: `src/lib/stores/schedule.ts` (add `getTodaysWorkout()` helper)

**Testing**:
- [ ] Unit tests for session initialization from schedule
- [ ] Unit tests for pause/resume timing calculation
- [ ] Unit tests for exercise/set advancement
- [ ] Unit tests for localStorage persistence

**Commit Message**:
```
feat(live): add live session store with persistence

- Create liveSession store for active workout state
- Add session lifecycle methods (start, pause, resume, end)
- Persist session to localStorage for background recovery
- Add getTodaysWorkout helper to schedule store
```

**Agent Invocations**:
```bash
# Invoke: shredly-code-writer agent with "Implement Phase 2 for ticket #019 - Live Session Store"
# Invoke: test-writer agent with "Write tests for liveSession store from ticket #019 Phase 2"
```

---

### Phase 3: Timer Display UI (5 points)

**Goal**: Build the visual timer display component with phase-colored states

**Steps**:
1. Create `src/lib/components/live/TimerDisplay.svelte`:
   - Large countdown/count-up display (top 50% of screen)
   - Phase label with color coding (WORKING=green, RESTING=blue, etc.)
   - Set counter ("Set 2 of 4")
   - Minute counter for EMOM/AMRAP
   - CSS transitions for phase changes
2. Create `src/lib/components/live/TimerControls.svelte`:
   - Pause/Resume button
   - Next button (skip current phase)
   - Stop button (end workout early)
3. Create `src/lib/components/live/ExerciseList.svelte`:
   - Bottom 50% exercise list
   - Current exercise highlighted
   - Next exercises dimmed
   - Info icon for exercise details
4. Update `src/routes/live/+page.svelte` to integrate components

**Files**:
- Create: `src/lib/components/live/TimerDisplay.svelte`
- Create: `src/lib/components/live/TimerControls.svelte`
- Create: `src/lib/components/live/ExerciseList.svelte`
- Modify: `src/routes/live/+page.svelte`

**Testing**:
- [ ] Manual test: Timer display shows correct phase colors
- [ ] Manual test: Set counter increments correctly
- [ ] Manual test: Exercise list highlights current exercise
- [ ] Manual test: Controls work (pause/resume/next)

**Commit Message**:
```
feat(live): add timer display and exercise list UI

- Create TimerDisplay component with phase colors
- Add TimerControls for pause/resume/next/stop
- Create ExerciseList showing current and upcoming
- Wire components into live route
```

**Agent Invocations**:
```bash
# Invoke: shredly-code-writer agent with "Implement Phase 3 for ticket #019 - Timer Display UI"
# Invoke: code-quality-assessor agent with "Review live view components from ticket #019 Phase 3"
```

---

### Phase 4: Data Entry and Logging (5 points)

**Goal**: Implement post-set data entry modal and history logging

**Steps**:
1. Create `src/lib/components/live/DataEntryModal.svelte`:
   - Weight input (if applicable per exercise-metadata.ts)
   - Reps input (pre-filled with prescription)
   - RPE slider (optional, 1-10)
   - Notes field
   - Submit button
2. Create `src/lib/stores/history.ts`:
   - `exerciseHistory` store for CSV data
   - `appendHistoryRow()` - add completed set to CSV
   - `loadHistory()` - read from localStorage
   - `exportHistoryCsv()` - export for backup
   - `getPersonalRecords()` - calculate PRs from history
3. Create `src/lib/components/live/ExerciseInfoModal.svelte`:
   - Exercise description from exercise_descriptions.json
   - Muscle groups, equipment
   - Last performance from history
4. Integrate data entry flow:
   - Strength: modal after each set
   - Compound blocks: modal after block ends

**Files**:
- Create: `src/lib/components/live/DataEntryModal.svelte`
- Create: `src/lib/components/live/ExerciseInfoModal.svelte`
- Create: `src/lib/stores/history.ts`
- Modify: `src/lib/stores/liveSession.ts` (add logging integration)

**Testing**:
- [ ] Unit tests for CSV row generation (20 columns per spec)
- [ ] Unit tests for PR calculation from history
- [ ] Manual test: Data entry modal appears after strength sets
- [ ] Manual test: Compound blocks log after block ends
- [ ] Manual test: Exercise info modal shows description

**Commit Message**:
```
feat(live): add data entry modal and history logging

- Create DataEntryModal for post-set input
- Create history store with CSV append logic
- Create ExerciseInfoModal for exercise details
- Log data per EXERCISE_HISTORY_SPEC.md schema
```

**Agent Invocations**:
```bash
# Invoke: shredly-code-writer agent with "Implement Phase 4 for ticket #019 - Data Entry and Logging"
# Invoke: test-writer agent with "Write tests for history CSV logging from ticket #019 Phase 4"
```

---

### Phase 5: Audio Cues (3 points)

**Goal**: Implement audio feedback for timer transitions

**Steps**:
1. Source/create audio files:
   - `static/audio/countdown.mp3` (~200ms chirp)
   - `static/audio/work_complete.mp3` (~500ms chime)
   - `static/audio/block_complete.mp3` (~800ms chime)
   - `static/audio/minute_marker.mp3` (~300ms beep)
2. Create `src/lib/utils/audioManager.ts`:
   - `AudioManager` class with Web Audio API
   - `playCountdown()` - 3-2-1 chirps
   - `playWorkComplete()`, `playBlockComplete()`, `playMinuteMarker()`
   - Volume control
   - Audio enable/disable toggle
3. Add audio config store:
   - Persist settings to localStorage
   - Master toggle, individual sound toggles
4. Integrate with TimerEngine:
   - Trigger audio on phase transitions
   - Countdown chirps at 3, 2, 1 seconds remaining

**Files**:
- Create: `src/lib/utils/audioManager.ts`
- Create: `static/audio/countdown.mp3`
- Create: `static/audio/work_complete.mp3`
- Create: `static/audio/block_complete.mp3`
- Create: `static/audio/minute_marker.mp3`
- Modify: `src/lib/engine/timer-engine.ts` (add audio callbacks)
- Modify: `src/lib/stores/liveSession.ts` (add audioConfig)

**Testing**:
- [ ] Manual test: Countdown chirps play at 3-2-1 seconds
- [ ] Manual test: Work complete chime plays after set
- [ ] Manual test: Minute markers play for EMOM/AMRAP
- [ ] Manual test: Audio toggle works correctly

**Commit Message**:
```
feat(live): add audio cues for timer transitions

- Create AudioManager with Web Audio API
- Add countdown chirps, completion chimes, minute markers
- Integrate audio triggers with timer engine
- Add audio config with localStorage persistence
```

**Agent Invocations**:
```bash
# Invoke: shredly-code-writer agent with "Implement Phase 5 for ticket #019 - Audio Cues"
# Invoke: code-quality-assessor agent with "Review audioManager.ts from ticket #019 Phase 5"
```

---

### Phase 6: Compound Exercise Timer Modes (4 points)

**Goal**: Implement specialized timer behavior for EMOM, AMRAP, Interval, Circuit

**Steps**:
1. Extend TimerEngine for EMOM:
   - Countdown from block_time_minutes
   - Highlight sub-exercise per minute rotation
   - Countdown chirps at seconds 57, 58, 59
2. Extend TimerEngine for AMRAP:
   - Countdown from block_time_minutes
   - Show all sub-exercises, minute markers
   - Prompt for total rounds at end
3. Extend TimerEngine for Interval:
   - Alternating work/rest per sub-exercise
   - Sub-exercise highlighting switches on phase change
4. Extend TimerEngine for Circuit:
   - Count-up stopwatch mode
   - Exercise checkboxes for optional tracking
   - Capture total time on "Done" tap
5. Update DataEntryModal for compound-specific fields:
   - AMRAP: total rounds input (decimal allowed)
   - Circuit: total time display
   - All: sub-exercise weight/reps

**Files**:
- Modify: `src/lib/engine/timer-engine.ts` (add compound modes)
- Modify: `src/lib/components/live/TimerDisplay.svelte` (sub-exercise display)
- Modify: `src/lib/components/live/DataEntryModal.svelte` (compound fields)
- Modify: `src/lib/components/live/ExerciseList.svelte` (sub-exercise highlighting)

**Testing**:
- [ ] Unit tests for EMOM minute rotation
- [ ] Unit tests for AMRAP round tracking
- [ ] Unit tests for Interval work/rest phases
- [ ] Unit tests for Circuit count-up mode
- [ ] Manual test: EMOM highlights sub-exercises by minute
- [ ] Manual test: AMRAP prompts for rounds at end
- [ ] Manual test: Interval alternates work/rest correctly
- [ ] Manual test: Circuit stopwatch captures total time

**Commit Message**:
```
feat(live): add compound exercise timer modes

- Implement EMOM minute rotation with sub-exercise highlight
- Add AMRAP countdown with round entry at end
- Add Interval work/rest alternation per sub-exercise
- Add Circuit count-up stopwatch with time capture
```

**Agent Invocations**:
```bash
# Invoke: shredly-code-writer agent with "Implement Phase 6 for ticket #019 - Compound Timer Modes"
# Invoke: test-writer agent with "Write tests for compound timer modes from ticket #019 Phase 6"
```

---

## Testing Strategy

### Unit Tests (Vitest)

Location: `tests/unit/`

- [ ] `timer-engine.test.ts` - Timer state machine transitions
  - Phase transitions: idle -> work -> rest -> complete
  - Work duration calculation (tempo-based)
  - Countdown tick handling
  - Count-up tick handling
  - Each exercise type timer behavior

- [ ] `live-session.test.ts` - Session store lifecycle
  - Session initialization from schedule
  - Pause/resume timing
  - Exercise/set advancement
  - Session persistence to localStorage

- [ ] `history.test.ts` - History CSV management
  - CSV row generation (20 columns)
  - Append operation
  - PR calculation
  - Compound exercise logging

**Run**: `npm run test:unit -- timer-engine live-session history`

### Integration Tests (Vitest)

Location: `tests/integration/live/`

- [ ] `workout-flow.test.ts` - Full workout execution flow
  - Start workout from schedule
  - Complete strength exercise (4 sets)
  - Log data after each set
  - Advance to next exercise
  - Verify history CSV rows

- [ ] `compound-flow.test.ts` - Compound exercise flow
  - EMOM: minute rotation, block-end logging
  - AMRAP: countdown, round entry
  - Interval: work/rest phases
  - Circuit: stopwatch, time capture

**Run**: `npm run test:integration -- live`

### Manual Testing

**Strength Exercise Flow**:
1. Navigate to Live tab
2. Start today's workout (or select from schedule)
3. Verify timer displays work phase (green)
4. Wait for work phase to complete
5. Verify rest phase starts (blue)
6. Verify 3-2-1 countdown chirps before next work
7. Complete set, verify data entry modal appears
8. Enter weight/reps, submit
9. Verify set counter increments
10. Complete all sets, verify exercise advances

**EMOM Flow**:
1. Start workout with EMOM block
2. Verify countdown from block time
3. Verify sub-exercise highlights rotate each minute
4. Verify countdown chirps at :57, :58, :59
5. Block ends, verify data entry for all sub-exercises

**Audio Testing**:
1. Enable audio in settings
2. Verify countdown chirps play at 3, 2, 1
3. Verify work complete chime plays
4. Verify minute markers for EMOM/AMRAP
5. Disable audio, verify silence

**Mobile Testing**:
1. Test on iOS Safari
2. Test on Android Chrome
3. Verify touch targets are adequate
4. Verify timer readable in sunlight (high contrast)
5. Verify audio plays correctly

### Test Acceptance Criteria

- [ ] All unit tests pass (`npm run test:unit`)
- [ ] All integration tests pass (`npm run test:integration`)
- [ ] All tests pass together (`npm test`)
- [ ] TypeScript compilation succeeds (`npm run typecheck`)
- [ ] Build succeeds (`npm run build`)
- [ ] Manual testing checklist complete

---

## Success Criteria

- [ ] Timer engine supports all 5 exercise types (Strength, EMOM, AMRAP, Interval, Circuit)
- [ ] Visual phase states display correctly (work=green, rest=blue, countdown=yellow, complete=purple, paused=gray)
- [ ] Audio cues play at correct times (3-2-1 countdown, completion chimes, minute markers)
- [ ] Data entry modal appears at correct times (after each set for strength, after block for compound)
- [ ] Exercise history logs correctly per EXERCISE_HISTORY_SPEC.md (20 columns, compound parent linking)
- [ ] Session persists to localStorage and can be resumed after app restart
- [ ] UI is mobile-first with top-half timer, bottom-half exercise list
- [ ] Code follows CLAUDE.md standards
- [ ] TypeScript types are properly defined
- [ ] Tests provide >80% coverage of new code

---

## Dependencies

### Blocked By
- Ticket #017 (Schedule Tab UI) - COMPLETE: Need active schedule to start workout
- Ticket #018 (Default User Schedule Flow) - Provides test data for workouts

### Blocks
- Future: Background timer persistence (Phase 4 - Mobile Polish)
- Future: Voice instructions feature
- Future: PR auto-population in Profile tab

### External Dependencies
- Audio files needed (can be generated or sourced from free libraries):
  - countdown.mp3
  - work_complete.mp3
  - block_complete.mp3
  - minute_marker.mp3

---

## Risks & Mitigations

### Risk 1: Web Audio API browser compatibility
- **Impact**: Medium
- **Probability**: Low
- **Mitigation**: Use AudioContext with fallback to HTMLAudioElement. Test on Safari, Chrome, Firefox.

### Risk 2: Timer drift during long workouts
- **Impact**: Medium
- **Probability**: Medium
- **Mitigation**: Use `Date.now()` target time approach instead of interval accumulation. Recalculate remaining time each tick.

### Risk 3: Audio doesn't play on mobile without user interaction
- **Impact**: High
- **Probability**: High
- **Mitigation**: Initialize AudioContext on first user tap (start workout button). iOS requires user gesture before audio playback.

### Risk 4: localStorage quota exceeded for history
- **Impact**: Medium
- **Probability**: Low (capacity is ~60,000 rows)
- **Mitigation**: Add storage monitoring, warn user when approaching limit, provide export/clear options.

### Risk 5: Complex compound exercise state management
- **Impact**: Medium
- **Probability**: Medium
- **Mitigation**: Implement Phase 1-4 first with strength exercises, then add compound modes in Phase 6. Keep state machine simple with clear transitions.

---

## Notes

### Audio File Requirements
Audio files should be:
- Short duration (<1 second except block_complete)
- Low file size (<50KB each)
- Distinct and recognizable
- Not annoying when repeated

Consider using synthesized tones via Web Audio API as an alternative to MP3 files.

### Timer Accuracy
Use `requestAnimationFrame` for foreground timing (smooth updates) with fallback to `setInterval` for background. Always calculate remaining time from target timestamp, not accumulated intervals.

### Exercise Metadata Integration
Use existing `src/lib/engine/exercise-metadata.ts` functions:
- `shouldShowWeightField()` - Determine if weight input should appear
- `getExerciseMetadata()` - Get exercise details for info modal

### Mobile Considerations
- Large touch targets for timer controls (min 44x44px)
- High contrast colors for outdoor visibility
- WakeLock API to prevent screen sleep during workout
- Visibility API to detect background/foreground transitions

---

## Out of Scope (Future Tickets)

1. **Background timer persistence** - Capacitor Background Task plugin, foreground service notification (Phase 4 - Mobile Polish)
2. **Music ducking** - Reduce music volume during audio cues
3. **Voice instructions** - MP3 exercise instructions
4. **Auto-progress mode** - Skip data entry for cardio/fat-loss workouts
5. **Haptic feedback** - Vibration on phase transitions
6. **Rest timer suggestions** - AI-based rest period optimization
7. **Social sharing** - Share workout completion

---

## Commit Standards Reminder

**MANDATORY**: Follow CLAUDE.md commit message standards:
- Format: `type(scope): description under 50 chars`
- Types: feat, fix, docs, style, refactor, test, chore
- Scopes: cli, engine, questionnaire, profile, schedule, live, workout-gen, exercise-selector, progression, ui, mobile, history, prs, tests
- **NEVER include "Generated with [Claude Code]" or "Co-Authored-By: Claude"**

---

## Definition of Done

- [ ] All 6 phases implemented and tested
- [ ] All tests passing (unit + integration)
- [ ] TypeScript compilation succeeds
- [ ] Code reviewed (by code-quality-assessor agent)
- [ ] Success criteria met
- [ ] Audio files sourced/created
- [ ] Manual testing complete on desktop + mobile
- [ ] Committed with proper commit messages
- [ ] CLAUDE.md "Current Development Status" updated

---

**End of Ticket #019**
