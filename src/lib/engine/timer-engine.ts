/**
 * Timer Engine - Core state machine for the Live View timer
 *
 * Handles:
 * - Timer state transitions (work, rest, countdown, paused, complete)
 * - Time tracking with drift correction
 * - Exercise-specific timer behavior (strength, EMOM, AMRAP, interval, circuit)
 * - Event emission for UI updates and audio cues
 */

import type {
  TimerState,
  TimerPhase,
  TimerMode,
  TimerExerciseType,
  TimerConfig,
  TimerEvent,
  TimerEventType,
  LiveExercise
} from './types';
import timerConfig from '../../data/timer_config.json';

// ============================================================================
// TYPES
// ============================================================================

export type TimerEventCallback = (event: TimerEvent) => void;

interface TimerBehaviorConfig {
  mode: TimerMode;
  phases: string[];
  work_calculation: string;
  countdown_before: string | null;
  countdown_at_minute_end?: boolean;
  work_complete_chime?: boolean;
  countdown_before_work?: boolean;
  log_timing: string;
  minute_markers: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TICK_INTERVAL_MS = 100; // Update every 100ms for smooth display
const COUNTDOWN_SECONDS = timerConfig.audio.countdown_seconds as number[];
const TEMPO_SECONDS_PER_REP = timerConfig.defaults.tempo_seconds_per_rep;
const DEFAULT_WORK_SECONDS = timerConfig.defaults.default_work_seconds;
const DEFAULT_REST_SECONDS = timerConfig.defaults.default_rest_seconds;
const MIN_REST_SECONDS = timerConfig.defaults.min_rest_seconds;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create initial timer state
 */
export function createInitialTimerState(): TimerState {
  return {
    mode: 'countdown',
    phase: 'idle',
    exerciseType: 'strength',

    totalSeconds: 0,
    remainingSeconds: 0,
    targetTimestamp: 0,

    currentSet: 1,
    totalSets: 1,
    currentSubExercise: 0,
    totalSubExercises: 0,

    currentMinute: 1,
    totalMinutes: 0,

    audioEnabled: true,
    lastAudioCue: null
  };
}

/**
 * Get timer configuration for a specific exercise type
 */
export function getTimerConfigForExercise(exerciseType: TimerExerciseType): TimerConfig {
  const behavior = timerConfig.timer_behavior[exerciseType] as TimerBehaviorConfig;

  if (!behavior) {
    // Default to strength behavior
    const defaultBehavior = timerConfig.timer_behavior.strength as TimerBehaviorConfig;
    return {
      exerciseType,
      mode: defaultBehavior.mode as TimerMode,
      phases: defaultBehavior.phases as ('work' | 'rest' | 'continuous')[],
      workCalculation: defaultBehavior.work_calculation as 'tempo_based' | 'fixed' | 'from_prescription',
      countdownBefore: defaultBehavior.countdown_before as 'work' | 'rest' | null,
      logTiming: defaultBehavior.log_timing as 'after_each_set' | 'after_block',
      minuteMarkers: defaultBehavior.minute_markers,
      workCompleteChime: defaultBehavior.work_complete_chime,
      countdownBeforeWork: defaultBehavior.countdown_before_work
    };
  }

  return {
    exerciseType,
    mode: behavior.mode as TimerMode,
    phases: behavior.phases as ('work' | 'rest' | 'continuous')[],
    workCalculation: behavior.work_calculation as 'tempo_based' | 'fixed' | 'from_prescription',
    countdownBefore: behavior.countdown_before as 'work' | 'rest' | null,
    countdownAtMinuteEnd: behavior.countdown_at_minute_end,
    logTiming: behavior.log_timing as 'after_each_set' | 'after_block',
    minuteMarkers: behavior.minute_markers,
    workCompleteChime: behavior.work_complete_chime,
    countdownBeforeWork: behavior.countdown_before_work
  };
}

/**
 * Calculate work duration based on exercise prescription
 *
 * For strength/bodyweight: reps * tempo_seconds_per_rep (default 4 sec/rep)
 * For others: use prescription work time or default
 */
export function calculateWorkDuration(
  exercise: LiveExercise,
  config: TimerConfig
): number {
  const { prescription, exerciseType } = exercise;

  switch (config.workCalculation) {
    case 'tempo_based': {
      // Calculate from reps and tempo
      const reps = prescription.reps ?? 10;
      const tempoSeconds = prescription.tempo
        ? parseTempoToSeconds(prescription.tempo)
        : TEMPO_SECONDS_PER_REP;
      return reps * tempoSeconds;
    }

    case 'from_prescription': {
      // Use prescribed work time
      if (prescription.workTimeSeconds) {
        return prescription.workTimeSeconds;
      }
      // For EMOM/AMRAP, work time is the total block time in minutes converted to seconds
      if (exerciseType === 'emom' || exerciseType === 'amrap') {
        // Block time should be stored in workTimeSeconds already (in seconds)
        return prescription.workTimeSeconds ?? 60;
      }
      return DEFAULT_WORK_SECONDS;
    }

    case 'fixed':
    default:
      return prescription.workTimeSeconds ?? DEFAULT_WORK_SECONDS;
  }
}

/**
 * Parse tempo string (e.g., "3-1-2") to total seconds per rep
 * Format: eccentric-pause-concentric
 */
export function parseTempoToSeconds(tempo: string): number {
  const parts = tempo.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    return TEMPO_SECONDS_PER_REP;
  }
  return parts.reduce((sum, val) => sum + val, 0);
}

/**
 * Get rest duration for an exercise
 */
export function calculateRestDuration(exercise: LiveExercise): number {
  const restSeconds = exercise.prescription.restTimeSeconds;
  if (restSeconds && restSeconds > 0) {
    return Math.max(restSeconds, MIN_REST_SECONDS);
  }
  return DEFAULT_REST_SECONDS;
}

/**
 * Get the color for a timer phase
 */
export function getPhaseColor(phase: TimerPhase): string {
  const colors = timerConfig.visual.colors as Record<string, string>;
  return colors[phase] ?? colors.idle;
}

/**
 * Format seconds as MM:SS display
 */
export function formatTimeDisplay(seconds: number): string {
  const absSeconds = Math.abs(Math.floor(seconds));
  const mins = Math.floor(absSeconds / 60);
  const secs = absSeconds % 60;
  const sign = seconds < 0 ? '-' : '';
  return `${sign}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Determine exercise type from category
 */
export function getTimerExerciseType(
  category: string | undefined,
  isBodyweight: boolean = false
): TimerExerciseType {
  if (category) {
    const lowerCategory = category.toLowerCase();
    if (lowerCategory === 'emom') return 'emom';
    if (lowerCategory === 'amrap') return 'amrap';
    if (lowerCategory === 'circuit') return 'circuit';
    if (lowerCategory === 'interval') return 'interval';
  }

  return isBodyweight ? 'bodyweight' : 'strength';
}

// ============================================================================
// TIMER ENGINE CLASS
// ============================================================================

export class TimerEngine {
  private state: TimerState;
  private config: TimerConfig;
  private exercise: LiveExercise | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private callbacks: Set<TimerEventCallback> = new Set();
  private lastTickSecond: number = -1;

  constructor() {
    this.state = createInitialTimerState();
    this.config = getTimerConfigForExercise('strength');
  }

  // --------------------------------------------------------------------------
  // PUBLIC API
  // --------------------------------------------------------------------------

  /**
   * Get current timer state (immutable copy)
   */
  getState(): TimerState {
    return { ...this.state };
  }

  /**
   * Get current timer configuration
   */
  getConfig(): TimerConfig {
    return { ...this.config };
  }

  /**
   * Subscribe to timer events
   */
  subscribe(callback: TimerEventCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * Initialize timer for an exercise
   */
  initializeForExercise(exercise: LiveExercise): void {
    this.exercise = exercise;
    this.config = getTimerConfigForExercise(exercise.exerciseType);

    const workDuration = calculateWorkDuration(exercise, this.config);
    const restDuration = calculateRestDuration(exercise);

    this.state = {
      ...createInitialTimerState(),
      mode: this.config.mode,
      exerciseType: exercise.exerciseType,
      totalSets: exercise.prescription.sets,
      totalSubExercises: exercise.subExercises?.length ?? 0,
      audioEnabled: this.state.audioEnabled // Preserve audio setting
    };

    // For EMOM/AMRAP, set up minute tracking
    if (exercise.exerciseType === 'emom' || exercise.exerciseType === 'amrap') {
      const blockTimeSeconds = exercise.prescription.workTimeSeconds ?? 60;
      this.state.totalMinutes = Math.ceil(blockTimeSeconds / 60);
      this.state.totalSeconds = blockTimeSeconds;
    } else {
      this.state.totalSeconds = workDuration;
    }

    this.emit('phase_change');
  }

  /**
   * Start the timer (begin work phase or countdown)
   */
  start(): void {
    if (this.state.phase !== 'idle' && this.state.phase !== 'paused') {
      return;
    }

    if (this.config.countdownBefore === 'work') {
      this.startCountdown('work');
    } else {
      this.startWork();
    }
  }

  /**
   * Start countdown before a phase
   */
  startCountdown(nextPhase: 'work' | 'rest'): void {
    const previousPhase = this.state.phase;
    const countdownDuration = timerConfig.defaults.countdown_duration_seconds;

    this.state = {
      ...this.state,
      phase: 'countdown',
      totalSeconds: countdownDuration,
      remainingSeconds: countdownDuration,
      targetTimestamp: Date.now() + countdownDuration * 1000
    };

    // Store the next phase to transition to
    (this.state as any)._nextPhase = nextPhase;

    this.startTicking();
    this.emit('phase_change', previousPhase);
  }

  /**
   * Get current sub-exercise (for Interval blocks)
   */
  private getCurrentSubExercise(): LiveExercise | null {
    if (!this.exercise || !this.exercise.subExercises || this.exercise.subExercises.length === 0) {
      return null;
    }
    return this.exercise.subExercises[this.state.currentSubExercise] || null;
  }

  /**
   * Start work phase
   */
  startWork(): void {
    if (!this.exercise) return;

    const previousPhase = this.state.phase;

    // For Interval, use sub-exercise work time
    let workDuration: number;
    if (this.state.exerciseType === 'interval') {
      const subExercise = this.getCurrentSubExercise();
      if (subExercise?.prescription.workTimeSeconds) {
        workDuration = subExercise.prescription.workTimeSeconds;
      } else {
        workDuration = calculateWorkDuration(this.exercise, this.config);
      }
    } else {
      workDuration = calculateWorkDuration(this.exercise, this.config);
    }

    this.state = {
      ...this.state,
      phase: 'work',
      totalSeconds: workDuration,
      remainingSeconds: this.config.mode === 'count_up' ? 0 : workDuration,
      targetTimestamp: this.config.mode === 'count_up'
        ? Date.now()  // For count-up, track start time
        : Date.now() + workDuration * 1000
    };

    this.startTicking();
    this.emit('phase_change', previousPhase);
  }

  /**
   * Start rest phase
   */
  startRest(): void {
    if (!this.exercise) return;

    const previousPhase = this.state.phase;

    // For Interval, use sub-exercise rest time
    let restDuration: number;
    if (this.state.exerciseType === 'interval') {
      const subExercise = this.getCurrentSubExercise();
      if (subExercise?.prescription.restTimeSeconds) {
        restDuration = subExercise.prescription.restTimeSeconds;
      } else {
        restDuration = calculateRestDuration(this.exercise);
      }
    } else {
      restDuration = calculateRestDuration(this.exercise);
    }

    this.state = {
      ...this.state,
      phase: 'rest',
      totalSeconds: restDuration,
      remainingSeconds: restDuration,
      targetTimestamp: Date.now() + restDuration * 1000
    };

    this.startTicking();
    this.emit('phase_change', previousPhase);
  }

  /**
   * Pause the timer
   */
  pause(): void {
    if (this.state.phase === 'idle' || this.state.phase === 'paused' || this.state.phase === 'complete') {
      return;
    }

    const previousPhase = this.state.phase;
    (this.state as any)._pausedFrom = previousPhase;

    this.state = {
      ...this.state,
      phase: 'paused'
    };

    this.stopTicking();
    this.emit('phase_change', previousPhase);
  }

  /**
   * Resume from pause
   */
  resume(): void {
    if (this.state.phase !== 'paused') {
      return;
    }

    const previousPhase = 'paused' as TimerPhase;
    const resumePhase = (this.state as any)._pausedFrom || 'work';

    // Recalculate target timestamp based on remaining time
    this.state = {
      ...this.state,
      phase: resumePhase,
      targetTimestamp: this.config.mode === 'count_up'
        ? Date.now() - this.state.remainingSeconds * 1000  // For count-up, adjust start time
        : Date.now() + this.state.remainingSeconds * 1000
    };

    delete (this.state as any)._pausedFrom;

    this.startTicking();
    this.emit('phase_change', previousPhase);
  }

  /**
   * Skip to next phase or set
   * For EMOM/AMRAP: skips to next minute instead of completing the block
   */
  skip(): void {
    if (this.state.phase === 'idle' || this.state.phase === 'complete') {
      return;
    }

    this.stopTicking();

    // Handle based on current phase
    switch (this.state.phase) {
      case 'countdown':
        // Skip countdown, start work immediately
        this.startWork();
        break;

      case 'work':
        // For EMOM/AMRAP: skip to next minute instead of completing
        if (this.state.exerciseType === 'emom' || this.state.exerciseType === 'amrap') {
          this.skipToNextMinute();
        } else {
          // Skip work, move to rest or next set
          this.handleWorkComplete();
        }
        break;

      case 'rest':
        // Skip rest, move to next set
        this.handleRestComplete();
        break;

      case 'paused':
        // Resume and skip
        this.resume();
        this.skip();
        break;
    }
  }

  /**
   * Skip to next minute for EMOM/AMRAP blocks
   * If on last minute, completes the exercise
   */
  private skipToNextMinute(): void {
    // Check if we're on the last minute
    if (this.state.currentMinute >= this.state.totalMinutes) {
      // On last minute - complete the block
      this.handleWorkComplete();
      return;
    }

    // Advance to next minute
    this.state.currentMinute++;

    // For EMOM, rotate to next sub-exercise
    if (this.state.exerciseType === 'emom' && this.state.totalSubExercises > 0) {
      this.state.currentSubExercise = (this.state.currentMinute - 1) % this.state.totalSubExercises;
    }

    // Emit minute marker
    this.emit('minute_marker');

    // Calculate new remaining time (time left from current minute to end)
    const elapsedMinutes = this.state.currentMinute - 1;
    const remainingSeconds = this.state.totalSeconds - (elapsedMinutes * 60);

    this.state.remainingSeconds = remainingSeconds;
    this.state.targetTimestamp = Date.now() + remainingSeconds * 1000;

    // Resume ticking
    this.startTicking();
  }

  /**
   * Stop the timer completely
   */
  stop(): void {
    this.stopTicking();
    const previousPhase = this.state.phase;

    this.state = {
      ...createInitialTimerState(),
      audioEnabled: this.state.audioEnabled
    };

    this.exercise = null;
    this.emit('phase_change', previousPhase);
  }

  /**
   * Advance to next set
   */
  advanceSet(): void {
    if (this.state.currentSet < this.state.totalSets) {
      this.state.currentSet++;
      this.emit('set_complete');
    }
  }

  /**
   * Mark current exercise as complete
   */
  completeExercise(): void {
    const previousPhase = this.state.phase;
    this.stopTicking();

    this.state = {
      ...this.state,
      phase: 'complete'
    };

    this.emit('exercise_complete');
    this.emit('phase_change', previousPhase);
  }

  /**
   * Set audio enabled state
   */
  setAudioEnabled(enabled: boolean): void {
    this.state.audioEnabled = enabled;
  }

  /**
   * Update sub-exercise index (for EMOM rotation)
   */
  setCurrentSubExercise(index: number): void {
    if (index >= 0 && index < this.state.totalSubExercises) {
      this.state.currentSubExercise = index;
    }
  }

  /**
   * Enter data entry phase
   */
  enterDataEntry(): void {
    if (this.state.phase === 'complete' || this.state.phase === 'idle') {
      return;
    }

    const previousPhase = this.state.phase;
    (this.state as any)._entryFrom = previousPhase;

    this.stopTicking();
    this.state = {
      ...this.state,
      phase: 'entry'
    };

    this.emit('phase_change', previousPhase);
  }

  /**
   * Exit data entry phase
   */
  exitDataEntry(): void {
    if (this.state.phase !== 'entry') {
      return;
    }

    delete (this.state as any)._entryFrom;

    // For strength/bodyweight: DATA ENTRY -> REST -> next WORK
    // After logging, start rest period (unless it's the last set)
    if (this.config.logTiming === 'after_each_set') {
      // Check if this was the last set
      if (this.state.currentSet >= this.state.totalSets) {
        this.completeExercise();
        return;
      }

      // Start rest period - set advances after rest completes
      if (this.config.phases.includes('rest')) {
        this.startRest();
      } else {
        // No rest phase - advance set and start next work
        this.state.currentSet++;
        if (this.config.countdownBefore === 'work') {
          this.startCountdown('work');
        } else {
          this.startWork();
        }
      }
      return;
    }

    // For compound blocks (after_block logging):
    // Data entry happens at the end, so complete the exercise
    this.completeExercise();
  }

  // --------------------------------------------------------------------------
  // PRIVATE METHODS
  // --------------------------------------------------------------------------

  private startTicking(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    // Set to -1 so the first tick properly detects the initial second
    this.lastTickSecond = -1;

    // Emit initial countdown tick if starting in countdown phase
    if (this.state.phase === 'countdown') {
      const initialSecond = Math.ceil(this.state.remainingSeconds);
      if (COUNTDOWN_SECONDS.includes(initialSecond)) {
        this.emit('countdown_tick', undefined, initialSecond);
        this.lastTickSecond = initialSecond;
      }
    }

    this.intervalId = setInterval(() => this.tick(), TICK_INTERVAL_MS);
  }

  private stopTicking(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private tick(): void {
    const now = Date.now();

    // Count-up mode only applies during work phase, not countdown phase
    // Countdown phase always counts down (3, 2, 1)
    const useCountUp = this.config.mode === 'count_up' && this.state.phase === 'work';

    if (useCountUp) {
      // Count up mode (circuit work phase)
      const elapsed = (now - this.state.targetTimestamp) / 1000;
      this.state.remainingSeconds = elapsed;

      // Check for minute markers
      const currentSecond = Math.floor(elapsed);
      if (currentSecond !== this.lastTickSecond) {
        this.lastTickSecond = currentSecond;

        // Minute marker check
        if (this.config.minuteMarkers && currentSecond > 0 && currentSecond % 60 === 0) {
          this.state.currentMinute = Math.floor(currentSecond / 60) + 1;
          this.emit('minute_marker');
        }
      }
    } else {
      // Countdown mode
      const remaining = Math.max(0, (this.state.targetTimestamp - now) / 1000);
      this.state.remainingSeconds = remaining;

      const currentSecond = Math.ceil(remaining);

      // Check for state changes
      if (currentSecond !== this.lastTickSecond) {
        this.lastTickSecond = currentSecond;

        // Countdown audio cues (3, 2, 1) - phase-specific behavior
        if (COUNTDOWN_SECONDS.includes(currentSecond)) {
          // Always play countdown during countdown phase (pre-work)
          if (this.state.phase === 'countdown') {
            this.emit('countdown_tick', undefined, currentSecond);
          }
          // For intervals with countdownBeforeWork: play countdown during rest phase
          else if (this.state.phase === 'rest' && this.config.countdownBeforeWork) {
            this.emit('countdown_tick', undefined, currentSecond);
          }
          // For non-interval exercises in work phase (strength/bodyweight): play countdown
          else if (this.state.phase === 'work' && !this.config.countdownBeforeWork) {
            this.emit('countdown_tick', undefined, currentSecond);
          }
        }

        // Minute marker check for EMOM/AMRAP
        if (this.config.minuteMarkers) {
          const totalElapsed = this.state.totalSeconds - remaining;
          const currentMinuteNumber = Math.floor(totalElapsed / 60) + 1;
          if (currentMinuteNumber !== this.state.currentMinute && currentMinuteNumber <= this.state.totalMinutes) {
            this.state.currentMinute = currentMinuteNumber;
            // For EMOM, rotate sub-exercises
            if (this.state.exerciseType === 'emom' && this.state.totalSubExercises > 0) {
              this.state.currentSubExercise = (currentMinuteNumber - 1) % this.state.totalSubExercises;
            }
            this.emit('minute_marker');
          }

          // EMOM minute-end countdown (at 57, 58, 59 seconds into each minute)
          // This triggers countdown beeps before each minute marker
          if (this.config.countdownAtMinuteEnd && this.state.exerciseType === 'emom') {
            const secondsIntoMinute = Math.floor(totalElapsed % 60);
            // Emit countdown at 57, 58, 59 (3, 2, 1 seconds before next minute)
            if (secondsIntoMinute >= 57 && secondsIntoMinute <= 59) {
              const countdownValue = 60 - secondsIntoMinute;
              // Only emit once per second (check if we haven't already emitted for this second)
              if (this.lastTickSecond !== currentSecond) {
                this.emit('countdown_tick', undefined, countdownValue);
              }
            }
          }
        }

        // Timer complete
        if (remaining <= 0) {
          this.handlePhaseComplete();
          return;
        }
      }
    }

    this.emit('tick');
  }

  private handlePhaseComplete(): void {
    this.stopTicking();

    switch (this.state.phase) {
      case 'countdown': {
        const nextPhase = (this.state as any)._nextPhase || 'work';
        delete (this.state as any)._nextPhase;
        if (nextPhase === 'work') {
          this.startWork();
        } else {
          this.startRest();
        }
        break;
      }

      case 'work':
        this.handleWorkComplete();
        break;

      case 'rest':
        this.handleRestComplete();
        break;
    }
  }

  private handleWorkComplete(): void {
    // For strength/bodyweight (after_each_set): WORK -> DATA ENTRY -> REST flow
    // Show data entry immediately after work so user can log while fresh
    if (this.config.logTiming === 'after_each_set') {
      this.emit('set_complete');
      this.enterDataEntry();
      return;
    }

    // For compound blocks (after_block): EMOM/AMRAP/Circuit/Interval
    // These run continuously - when work phase ends, the ENTIRE block is done
    // (The work phase IS the whole block for continuous phases)

    // For Interval with work/rest phases: handle sub-exercise cycling
    if (this.state.exerciseType === 'interval' && this.config.phases.includes('rest')) {
      // Emit work phase complete chime if configured (for intervals)
      if (this.config.workCompleteChime) {
        this.emit('work_phase_complete');
      }

      // Interval: cycle through work/rest for each sub-exercise
      const totalSubExercises = this.state.totalSubExercises || 1;
      const currentSubIdx = this.state.currentSubExercise;

      // Move to next sub-exercise or next set
      if (currentSubIdx < totalSubExercises - 1) {
        // More sub-exercises in this set - start rest then next sub-exercise work
        this.state.currentSubExercise++;
        this.startRest();
        return;
      } else {
        // Completed all sub-exercises for this set
        if (this.state.currentSet < this.state.totalSets) {
          // More sets to go
          this.state.currentSubExercise = 0;
          this.state.currentSet++;
          this.startRest();
          return;
        }
        // All sets done - fall through to enter data entry
      }
    }

    // Block complete - emit set_complete and enter data entry
    this.emit('set_complete');
    this.enterDataEntry();
  }

  private handleRestComplete(): void {
    // For strength/bodyweight: REST completes -> advance set -> start next work
    if (this.config.logTiming === 'after_each_set') {
      this.state.currentSet++;

      // Check if all sets done
      if (this.state.currentSet > this.state.totalSets) {
        this.completeExercise();
        return;
      }

      // Start countdown for next work phase
      if (this.config.countdownBefore === 'work') {
        this.startCountdown('work');
      } else {
        this.startWork();
      }
      return;
    }

    // For Interval: after rest, start next work phase (for current sub-exercise)
    // Note: When countdownBeforeWork is true, the countdown already played during rest phase,
    // so we skip the separate countdown phase and go directly to work
    if (this.state.exerciseType === 'interval') {
      if (this.config.countdownBeforeWork) {
        // Countdown already played at end of rest - go directly to work
        this.startWork();
      } else if (this.config.countdownBefore === 'work') {
        this.startCountdown('work');
      } else {
        this.startWork();
      }
      return;
    }

    // For other compound blocks (shouldn't normally have rest phases)
    this.advanceSet();

    // Start next set
    if (this.state.currentSet <= this.state.totalSets) {
      if (this.config.countdownBefore === 'work') {
        this.startCountdown('work');
      } else {
        this.startWork();
      }
    } else {
      this.completeExercise();
    }
  }

  private emit(type: TimerEventType, previousPhase?: TimerPhase, countdownValue?: number): void {
    const event: TimerEvent = {
      type,
      state: this.getState(),
      previousPhase,
      countdownValue
    };

    this.callbacks.forEach(cb => cb(event));
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

let timerEngineInstance: TimerEngine | null = null;

/**
 * Get the singleton timer engine instance
 */
export function getTimerEngine(): TimerEngine {
  if (!timerEngineInstance) {
    timerEngineInstance = new TimerEngine();
  }
  return timerEngineInstance;
}

/**
 * Reset the timer engine (for testing)
 */
export function resetTimerEngine(): void {
  if (timerEngineInstance) {
    timerEngineInstance.stop();
    timerEngineInstance = null;
  }
}
