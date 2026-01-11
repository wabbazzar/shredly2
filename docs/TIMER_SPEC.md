# Timer Specification v1.0

**Version**: 1.0.0
**Date**: 2026-01-11
**Status**: Draft

---

## Design Principles

1. **Exercise-Aware Timing** - Timer behavior adapts to exercise type (strength, EMOM, AMRAP, Interval, Circuit)
2. **Data-Driven Configuration** - All timing parameters stored in config files, not hardcoded
3. **Audio-First UX** - Users can workout without looking at screen; audio cues guide transitions
4. **Background Persistence** - Timer continues running with audio when app is backgrounded
5. **Minimal Interruption** - Data entry happens at natural breakpoints (after sets/blocks)

---

## Live View Architecture

### Screen Layout (Mobile)

```
+----------------------------------+
|          TIMER DISPLAY           |  <- Top 50% of screen
|         (countdown/up)           |
|                                  |
|     [Phase Label: WORKING]       |
|        [ 00:45 ]                 |
|     [Set 2 of 4]                 |
+----------------------------------+
|       EXERCISE DISPLAY           |  <- Bottom 50%
|                                  |
| > Bench Press           [i]      |  <- Current exercise highlighted
|   4 reps @ 135 lbs               |
|                                  |
| - Bicep Curls           [i]      |  <- Next exercise dimmed
|   10 reps                        |
|                                  |
|        [NEXT]  [PAUSE]           |
+----------------------------------+
```

### Visual States

| Phase | Color | Label |
|-------|-------|-------|
| Work | Green (#22c55e) | "WORKING" |
| Rest | Blue (#3b82f6) | "RESTING" |
| Countdown (3-2-1) | Yellow (#eab308) | "GET READY" |
| Complete | Purple (#a855f7) | "COMPLETE" |
| Paused | Gray (#6b7280) | "PAUSED" |

---

## Timer Modes by Exercise Type

### 1. Strength Exercises

**Timer Behavior**: Alternating Work/Rest countdown

**Work Duration Calculation**:
```typescript
work_seconds = tempo_seconds_per_rep * reps
// Default: 4 seconds/rep (from workout_generation_rules.json)
// Example: 4 reps * 4 sec = 16 seconds work period
```

**Rest Duration**: From exercise prescription (rest_time field, typically 60-180 seconds)

**Flow**:
```
Set 1: [WORK 16s] -> [REST 120s] -> Data Entry (weight/reps)
Set 2: [WORK 16s] -> [REST 120s] -> Data Entry
Set 3: [WORK 16s] -> [REST 120s] -> Data Entry
Set 4: [WORK 16s] -> Complete -> [NEXT EXERCISE]
```

**Audio Cues**:
- 3, 2, 1 chirps at end of REST period (before work starts)
- Completion chime when set ends (work period complete)

**Data Entry**: After each set
- Fields: weight (number), reps (number), RPE (optional 1-10)
- Pre-filled with prescribed values, user adjusts if needed

---

### 2. EMOM (Every Minute On the Minute)

**Timer Behavior**: Countdown from block_time_minutes (e.g., 7 minutes)

**Minute Tracking**: Sub-exercises rotate each minute
- Minute 1: Exercise A
- Minute 2: Exercise B
- Minute 3: Exercise A
- (continues alternating)

**Display**: Highlight current sub-exercise, dim others

**Audio Cues**:
- 3, 2, 1 chirps at seconds 57, 58, 59 of each minute
- Completion chime when full block ends

**Data Entry**: After block ends
- Shows all sub-exercises
- Fields per sub-exercise: weight (if applicable), reps
- Pre-filled with prescribed values

---

### 3. AMRAP (As Many Rounds As Possible)

**Timer Behavior**: Countdown from block_time_minutes (e.g., 8 minutes)

**Round Tracking**: User enters total rounds at end

**Display**: Show all sub-exercises in circuit order

**Audio Cues**:
- 3, 2, 1 chirps at end of each minute (indexing, not exercise change)
- Completion chime when block ends

**Data Entry**: After block ends
- Total rounds completed (decimal allowed, e.g., "3.5")
- Weight/reps per sub-exercise (if applicable)

---

### 4. Interval Training

**Timer Behavior**: Alternating Work/Rest per sub-exercise

**Calculation**:
```typescript
// From workout_generation_rules.json intensity_profiles.interval
work_seconds = sub_work_time_seconds  // e.g., 40
rest_seconds = sub_rest_time_seconds  // e.g., 20
```

**Flow** (2 sub-exercises, 4 sets):
```
Set 1: [WORK 40s Ex.A] -> [REST 20s] -> [WORK 40s Ex.B] -> [REST 20s]
Set 2: [WORK 40s Ex.A] -> [REST 20s] -> [WORK 40s Ex.B] -> [REST 20s]
... (continues for all sets)
```

**Display**: Highlight current sub-exercise (context switches like EMOM)

**Audio Cues**:
- 3, 2, 1 chirps at end of REST period (before work starts)
- Completion chime when each work period ends
- Final completion chime when block ends

**Data Entry**: After block ends
- Fields per sub-exercise: reps (if applicable)

---

### 5. Circuit Training

**Timer Behavior**: Count UP (stopwatch) - user completes as fast as possible

**Goal**: Complete prescribed work in minimum time

**Display**:
- Stopwatch counting up from 0:00
- All exercises shown with completion checkboxes
- User taps exercise when complete (optional tracking)

**Audio Cues**:
- Optional minute markers (chirp at each minute elapsed)
- Completion chime when user taps "Done"

**Data Entry**: After block ends
- Total time taken (auto-captured from stopwatch)
- Rounds completed (if multi-round circuit)
- Weight/reps per sub-exercise (if applicable)

---

## Audio Specification

### Sound Files Required

| Sound | File | Duration | Use Case |
|-------|------|----------|----------|
| Countdown Chirp | `countdown.mp3` | ~200ms | 3, 2, 1 before work |
| Work Complete | `work_complete.mp3` | ~500ms | End of work period |
| Block Complete | `block_complete.mp3` | ~800ms | End of exercise/block |
| Minute Marker | `minute_marker.mp3` | ~300ms | EMOM/AMRAP minute |

### Audio Behavior

**Background Audio**:
- Timer audio continues when app is backgrounded
- Uses Capacitor Background Task + Audio Session
- iOS: Configure audio session for playback
- Android: Foreground service with notification

**Music Ducking** (Nice to Have):
- Reduce background music volume during countdown chirps
- Restore volume after audio cue completes
- Requires native audio focus management

### Audio Configuration

```typescript
interface AudioConfig {
  enabled: boolean;           // Master toggle
  countdown_enabled: boolean; // 3-2-1 chirps
  completion_enabled: boolean; // End-of-period chimes
  minute_markers_enabled: boolean; // EMOM/AMRAP minute chirps
  volume: number;             // 0.0 - 1.0
  duck_music: boolean;        // Reduce music volume during cues
}
```

---

## Data Logging

### When to Log

| Exercise Type | Log Timing | Data Collected |
|---------------|------------|----------------|
| Strength | After each set | weight, reps, RPE (optional) |
| EMOM | After block ends | weight/reps per sub-exercise |
| AMRAP | After block ends | total_rounds, weight/reps per sub |
| Interval | After block ends | reps per sub-exercise |
| Circuit | After block ends | total_time, rounds, weight/reps per sub |

### Field Visibility Rules

Use existing logic from `src/lib/utils/exercise-metadata.ts`:
- `shouldShowWeight()`: Based on exercise's `external_load` field
- `shouldShowReps()`: Based on exercise's work_mode (not isometric)
- `shouldShowTime()`: For time-based exercises

### Data Structure (per EXERCISE_HISTORY_SPEC.md)

```typescript
interface SetLog {
  set_number: number;
  reps: number | null;
  weight: number | null;
  weight_unit: 'lbs' | 'kg' | null;
  work_time: number | null;  // For circuits (time to complete)
  rpe: number | null;
  rir: number | null;
  completed: boolean;
  notes: string | null;
}
```

---

## Timer State Machine

```
                    +--------+
                    | IDLE   |  <- Initial state
                    +--------+
                         |
                    [Start Workout]
                         v
+--------+         +----------+         +--------+
| PAUSED | <-----> | RUNNING  | ------> | ENTRY  |
+--------+         +----------+         +--------+
  ^                     |                    |
  |                     |               [Submit Data]
  |                     v                    |
  |               +-----------+              |
  +-------------- | COUNTDOWN | <------------+
                  +-----------+
                         |
                    [0 reached]
                         v
                  +----------+
                  | COMPLETE |
                  +----------+
```

### States

| State | Description |
|-------|-------------|
| IDLE | No workout active |
| RUNNING | Timer counting (work or rest phase) |
| COUNTDOWN | 3-2-1 countdown before next phase |
| PAUSED | User paused timer |
| ENTRY | Data entry screen visible |
| COMPLETE | Exercise/block finished, awaiting next |

---

## Configuration Data Structure

Add to `src/data/timer_config.json`:

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

## TypeScript Types

```typescript
// Timer phase types
type TimerPhase = 'work' | 'rest' | 'countdown' | 'complete' | 'paused';

// Timer mode based on exercise type
type TimerMode = 'countdown' | 'count_up';

// Exercise category for timer behavior
type TimerExerciseType = 'strength' | 'bodyweight' | 'emom' | 'amrap' | 'interval' | 'circuit';

interface TimerState {
  mode: TimerMode;
  phase: TimerPhase;
  exerciseType: TimerExerciseType;

  // Time tracking
  totalSeconds: number;      // Total duration for this phase
  remainingSeconds: number;  // Countdown: seconds left. Count-up: seconds elapsed

  // Set/round tracking
  currentSet: number;
  totalSets: number;
  currentSubExercise: number;  // For compound blocks
  totalSubExercises: number;

  // Minute tracking (EMOM/AMRAP)
  currentMinute: number;
  totalMinutes: number;

  // Audio state
  audioEnabled: boolean;
  lastAudioCue: string | null;
}

interface TimerConfig {
  exerciseType: TimerExerciseType;
  mode: TimerMode;
  phases: TimerPhase[];
  workCalculation: 'tempo_based' | 'fixed' | 'from_prescription';
  countdownBefore: TimerPhase | null;
  logTiming: 'after_each_set' | 'after_block';
  minuteMarkers: boolean;
}

interface LiveWorkoutSession {
  workoutId: string;
  startTime: Date;
  currentExerciseIndex: number;
  exercises: LiveExercise[];
  logs: ExerciseLog[];
  timerState: TimerState;
  audioConfig: AudioConfig;
}

interface LiveExercise {
  exerciseName: string;
  exerciseType: TimerExerciseType;
  isCompoundParent: boolean;
  subExercises: LiveExercise[];  // For compound blocks
  prescription: {
    sets: number;
    reps: number | null;
    weight: number | null;
    workTime: number | null;
    restTime: number | null;
  };
}

interface ExerciseLog {
  exerciseName: string;
  timestamp: Date;
  sets: SetLog[];
  totalTime?: number;  // For circuits
  totalRounds?: number;  // For AMRAP
}
```

---

## Background Timer Implementation

### Capacitor Requirements

**iOS**:
- Enable "Background Modes" > "Audio, AirPlay, and Picture in Picture"
- Configure AVAudioSession for playback
- Use silent audio loop to keep app active (standard fitness app pattern)

**Android**:
- Foreground Service with persistent notification
- Show timer countdown in notification
- "Workout in Progress" notification

### Implementation Notes

```typescript
// Pseudo-code for background timer
class BackgroundTimer {
  private intervalId: number | null = null;
  private targetTime: number = 0;

  start(durationSeconds: number) {
    this.targetTime = Date.now() + (durationSeconds * 1000);

    // Use requestAnimationFrame for foreground
    // Use setInterval with drift correction for background
    this.tick();
  }

  private tick() {
    const remaining = Math.max(0, this.targetTime - Date.now());
    this.updateDisplay(Math.ceil(remaining / 1000));

    if (remaining <= 0) {
      this.onComplete();
    } else {
      // Check for audio cues
      if (remaining <= 3000) {
        this.playCountdown(Math.ceil(remaining / 1000));
      }
      requestAnimationFrame(() => this.tick());
    }
  }
}
```

---

## Future Extensibility

### Audio Workout Instructions (Future)

Structure for MP3 voice instructions:

```typescript
interface AudioInstruction {
  exerciseName: string;
  files: {
    intro: string;      // "Next up: Bench Press. 4 sets of 5 reps."
    formCues: string;   // "Keep your core tight, drive through your heels"
    motivation: string; // "You've got this! Last set!"
  };
  playAt: 'exercise_start' | 'mid_set' | 'final_set';
}
```

### Auto-Progress Mode (Future)

For fat-loss/cardio workouts without strength focus:
- Skip data entry screens
- Auto-advance between exercises
- Use prescribed values for logging
- Mimics Peloton/Barry's class experience

---

## Implementation Phases

### Phase 1: Core Timer
- Timer state machine
- Countdown/count-up modes
- Phase transitions (work/rest)
- Basic audio cues (web audio API)

### Phase 2: Exercise Integration
- Strength exercise flow
- Data entry after sets
- History logging (per EXERCISE_HISTORY_SPEC.md)

### Phase 3: Compound Blocks
- EMOM minute tracking
- AMRAP round tracking
- Interval work/rest phases
- Circuit stopwatch mode

### Phase 4: Background & Audio
- Capacitor background task
- Persistent audio session
- Notification controls
- Music ducking (nice to have)

### Phase 5: Polish
- Animations and transitions
- Haptic feedback
- Exercise info modals
- Voice instructions (future)

---

## Notes from v1 Implementation

Reviewed `/home/wabbazzar/code/shredly/scripts/timer-overlay.js` and `background-timer.js`.

### Patterns to Consider

1. **WakeLock API** - Prevents screen from sleeping during workout
2. **Service Worker for Background** - v1 used SW message passing for background timer persistence
3. **iOS-Specific Handling** - Separate `iOSTimerNotifications` class for iOS quirks
4. **Visibility API** - `document.visibilitychange` + `window.blur/focus` for background detection
5. **Fullscreen Mode** - Double-tap to toggle fullscreen timer view
6. **AudioManager Class** - Centralized audio cue management

### Key Differences for v2

| v1 | v2 |
|----|-----|
| Vanilla JS classes | SvelteKit components + Svelte stores |
| Service Worker for background | Capacitor Background Task plugin |
| Manual DOM manipulation | Reactive Svelte bindings |
| Global timer singleton | Scoped to Live route with stores |

### Browser APIs to Use

```typescript
// WakeLock (keep screen on)
const wakeLock = await navigator.wakeLock.request('screen');

// Visibility detection
document.addEventListener('visibilitychange', () => {
  if (document.hidden) handleBackground();
  else handleForeground();
});

// Web Audio API (for low-latency audio)
const audioContext = new AudioContext();
```

---

**End of Specification**
