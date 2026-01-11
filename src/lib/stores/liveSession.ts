/**
 * Live Session Store - Manages active workout session state
 *
 * Provides:
 * - Session lifecycle (start, pause, resume, end)
 * - Exercise/set navigation
 * - localStorage persistence for session recovery
 * - Integration with schedule store
 */

import { writable, derived, get } from 'svelte/store';
import type {
  LiveWorkoutSession,
  LiveExercise,
  ExerciseLog,
  SetLog,
  TimerState,
  AudioConfig,
  TimerExerciseType
} from '$lib/engine/types';
import { DEFAULT_AUDIO_CONFIG } from '$lib/engine/types';
import type { StoredSchedule, ParameterizedExercise, ParameterizedDay } from '$lib/types/schedule';
import { createInitialTimerState, getTimerExerciseType } from '$lib/engine/timer-engine';
import { getExerciseMetadata } from '$lib/engine/exercise-metadata';
import { activeSchedule } from './schedule';

// ============================================================================
// CONSTANTS
// ============================================================================

const LIVE_SESSION_KEY = 'shredly_live_session';
const AUDIO_CONFIG_KEY = 'shredly_audio_config';

const isBrowser = typeof window !== 'undefined';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Load session from localStorage
 */
function loadSession(): LiveWorkoutSession | null {
  if (!isBrowser) return null;

  try {
    const stored = localStorage.getItem(LIVE_SESSION_KEY);
    if (stored) {
      const session = JSON.parse(stored) as LiveWorkoutSession;
      return session;
    }
  } catch (e) {
    console.error('Failed to load live session:', e);
  }

  return null;
}

/**
 * Save session to localStorage
 */
function saveSessionToStorage(session: LiveWorkoutSession | null): void {
  if (!isBrowser) return;

  try {
    if (session) {
      localStorage.setItem(LIVE_SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(LIVE_SESSION_KEY);
    }
  } catch (e) {
    console.error('Failed to save live session:', e);
  }
}

/**
 * Load audio config from localStorage
 */
function loadAudioConfig(): AudioConfig {
  if (!isBrowser) {
    return { ...DEFAULT_AUDIO_CONFIG };
  }

  try {
    const stored = localStorage.getItem(AUDIO_CONFIG_KEY);
    if (stored) {
      return JSON.parse(stored) as AudioConfig;
    }
  } catch (e) {
    console.error('Failed to load audio config:', e);
  }

  return { ...DEFAULT_AUDIO_CONFIG };
}

/**
 * Save audio config to localStorage
 */
function saveAudioConfig(config: AudioConfig): void {
  if (!isBrowser) return;

  try {
    localStorage.setItem(AUDIO_CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save audio config:', e);
  }
}

/**
 * Determine exercise type from parameterized exercise
 */
function determineExerciseType(exercise: ParameterizedExercise): TimerExerciseType {
  // Check if it's a compound block
  if (exercise.category) {
    const cat = exercise.category.toLowerCase();
    if (cat === 'emom') return 'emom';
    if (cat === 'amrap') return 'amrap';
    if (cat === 'circuit') return 'circuit';
    if (cat === 'interval') return 'interval';
  }

  // Check exercise metadata
  const metadata = getExerciseMetadata(exercise.name);
  if (metadata) {
    const cat = metadata.category?.toLowerCase() ?? '';
    if (cat === 'bodyweight' || cat === 'calisthenics') {
      return 'bodyweight';
    }
  }

  return 'strength';
}

/**
 * Convert ParameterizedExercise to LiveExercise
 */
function convertToLiveExercise(
  exercise: ParameterizedExercise,
  weekNumber: number
): LiveExercise {
  const weekKey = `week${weekNumber}` as keyof ParameterizedExercise;
  const weekParams = exercise[weekKey] as any;

  // Parse rest time
  let restTimeSeconds: number | null = null;
  if (weekParams?.rest_time_minutes !== undefined) {
    // Legacy format: rest_time_minutes with optional unit
    restTimeSeconds = weekParams.rest_time_minutes * 60;
    if (weekParams.rest_time_unit === 'seconds') {
      restTimeSeconds = weekParams.rest_time_minutes;
    }
  }
  if (weekParams?.rest_time_seconds !== undefined) {
    restTimeSeconds = weekParams.rest_time_seconds;
  }

  // Parse work time
  let workTimeSeconds: number | null = null;
  if (weekParams?.work_time_minutes !== undefined) {
    workTimeSeconds = weekParams.work_time_minutes * 60;
    if (weekParams.work_time_unit === 'seconds') {
      workTimeSeconds = weekParams.work_time_minutes;
    }
  }
  if (weekParams?.work_time_seconds !== undefined) {
    workTimeSeconds = weekParams.work_time_seconds;
  }
  // For EMOM/AMRAP, block_time_minutes is the total duration
  if (weekParams?.block_time_minutes !== undefined) {
    workTimeSeconds = weekParams.block_time_minutes * 60;
  }

  // Parse weight
  let weight: number | null = null;
  let weightUnit: 'lbs' | 'kg' | null = null;
  if (weekParams?.weight) {
    if (typeof weekParams.weight === 'object' && weekParams.weight.type === 'absolute') {
      weight = weekParams.weight.value;
      weightUnit = weekParams.weight.unit;
    }
    // For percent_tm or percent_bw, we'd need user's maxes - leave null for now
  }

  const exerciseType = determineExerciseType(exercise);
  const isCompoundParent = exercise.sub_exercises && exercise.sub_exercises.length > 0;

  // Convert sub-exercises
  const subExercises: LiveExercise[] = [];
  if (exercise.sub_exercises) {
    for (const subEx of exercise.sub_exercises) {
      const subWeekParams = subEx[weekKey] as any;
      let subRestTime: number | null = null;
      let subWorkTime: number | null = null;

      if (subWeekParams?.rest_time_seconds !== undefined) {
        subRestTime = subWeekParams.rest_time_seconds;
      }
      if (subWeekParams?.work_time_seconds !== undefined) {
        subWorkTime = subWeekParams.work_time_seconds;
      }

      subExercises.push({
        exerciseName: subEx.name,
        exerciseType: getTimerExerciseType(undefined, false),
        isCompoundParent: false,
        subExercises: [],
        prescription: {
          sets: subWeekParams?.sets ?? 1,
          reps: subWeekParams?.reps ?? null,
          weight: null,
          weightUnit: null,
          workTimeSeconds: subWorkTime,
          restTimeSeconds: subRestTime,
          tempo: subWeekParams?.tempo ?? null
        },
        completed: false,
        completedSets: 0
      });
    }
  }

  return {
    exerciseName: exercise.name,
    exerciseType,
    isCompoundParent: isCompoundParent ?? false,
    subExercises,
    prescription: {
      sets: weekParams?.sets ?? 1,
      reps: typeof weekParams?.reps === 'number' ? weekParams.reps : null,
      weight,
      weightUnit,
      workTimeSeconds,
      restTimeSeconds,
      tempo: weekParams?.tempo ?? null
    },
    completed: false,
    completedSets: 0
  };
}

/**
 * Convert a day's exercises to LiveExercise array
 */
function convertDayToLiveExercises(
  day: ParameterizedDay,
  weekNumber: number
): LiveExercise[] {
  return day.exercises.map(ex => convertToLiveExercise(ex, weekNumber));
}

/**
 * Get today's workout from active schedule
 * Returns the day that matches today based on schedule metadata
 */
export function getTodaysWorkout(schedule: StoredSchedule): {
  weekNumber: number;
  dayNumber: number;
  day: ParameterizedDay;
} | null {
  const { scheduleMetadata, days, daysPerWeek, weeks } = schedule;
  const { startDate, dayMapping } = scheduleMetadata;

  if (!startDate) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Parse startDate as local date (YYYY-MM-DD format)
  const [year, month, dayOfMonth] = startDate.split('-').map(Number);
  const start = new Date(year, month - 1, dayOfMonth);
  start.setHours(0, 0, 0, 0);

  // Calculate days since start
  const daysSinceStart = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSinceStart < 0) {
    // Program hasn't started yet
    return null;
  }

  // Calculate current week (0-indexed) based on calendar weeks since start
  const currentWeekIndex = Math.floor(daysSinceStart / 7);
  const weekNumber = currentWeekIndex + 1;

  if (weekNumber > weeks) {
    // Program has ended
    return null;
  }

  // Get today's day of week (0=Sunday, adjust to 0=Monday)
  let todayWeekday = today.getDay() - 1;
  if (todayWeekday < 0) todayWeekday = 6; // Sunday becomes 6

  // Find which workout day (if any) is scheduled for today
  if (dayMapping) {
    for (const [dayNum, weekday] of Object.entries(dayMapping)) {
      if (weekday === todayWeekday) {
        // This workout day is scheduled for today
        const globalDayNumber = (currentWeekIndex * daysPerWeek) + parseInt(dayNum);
        const day = days[globalDayNumber.toString()];

        if (day) {
          return {
            weekNumber,
            dayNumber: globalDayNumber,
            day
          };
        }
      }
    }
  }

  // No workout scheduled for today
  return null;
}

/**
 * Get workout for a specific day
 */
export function getWorkoutForDay(
  schedule: StoredSchedule,
  weekNumber: number,
  dayInWeek: number
): {
  dayNumber: number;
  day: ParameterizedDay;
} | null {
  const { days, daysPerWeek } = schedule;
  const dayNumber = ((weekNumber - 1) * daysPerWeek) + dayInWeek;
  const day = days[dayNumber.toString()];

  if (day) {
    return { dayNumber, day };
  }

  return null;
}

// ============================================================================
// STORES
// ============================================================================

/**
 * Active live workout session
 */
export const liveSession = writable<LiveWorkoutSession | null>(loadSession());

// Auto-save session on changes
liveSession.subscribe((session) => {
  saveSessionToStorage(session);
});

/**
 * Audio configuration
 */
export const audioConfig = writable<AudioConfig>(loadAudioConfig());

// Auto-save audio config on changes
audioConfig.subscribe((config) => {
  saveAudioConfig(config);
});

// ============================================================================
// DERIVED STORES
// ============================================================================

/**
 * Whether there is an active session
 */
export const hasActiveSession = derived(liveSession, ($session) => $session !== null);

/**
 * Current exercise in the session
 */
export const currentExercise = derived(liveSession, ($session): LiveExercise | null => {
  if (!$session) return null;
  return $session.exercises[$session.currentExerciseIndex] ?? null;
});

/**
 * Remaining exercises in the session
 */
export const remainingExercises = derived(liveSession, ($session): LiveExercise[] => {
  if (!$session) return [];
  return $session.exercises.slice($session.currentExerciseIndex + 1);
});

/**
 * Session progress (percentage)
 */
export const sessionProgress = derived(liveSession, ($session): number => {
  if (!$session || $session.exercises.length === 0) return 0;
  const completed = $session.exercises.filter(ex => ex.completed).length;
  return Math.round((completed / $session.exercises.length) * 100);
});

/**
 * Current timer state from session
 */
export const timerState = derived(liveSession, ($session): TimerState | null => {
  return $session?.timerState ?? null;
});

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Start a new workout session
 */
export function startWorkout(
  schedule: StoredSchedule,
  weekNumber: number,
  dayNumber: number,
  day: ParameterizedDay
): void {
  const exercises = convertDayToLiveExercises(day, weekNumber);
  const config = get(audioConfig);

  const session: LiveWorkoutSession = {
    workoutId: `${schedule.id}-${weekNumber}-${dayNumber}-${Date.now()}`,
    scheduleId: schedule.id,
    weekNumber,
    dayNumber,
    startTime: new Date().toISOString(),
    currentExerciseIndex: 0,
    exercises,
    logs: [],
    timerState: createInitialTimerState(),
    audioConfig: config,
    isPaused: false,
    pauseStartTime: null,
    totalPauseTime: 0
  };

  liveSession.set(session);
}

/**
 * Start today's workout from the active schedule
 */
export function startTodaysWorkout(): boolean {
  const schedule = get(activeSchedule);
  if (!schedule) return false;

  const todaysWorkout = getTodaysWorkout(schedule);
  if (!todaysWorkout) return false;

  startWorkout(schedule, todaysWorkout.weekNumber, todaysWorkout.dayNumber, todaysWorkout.day);
  return true;
}

/**
 * Pause the workout
 */
export function pauseWorkout(): void {
  liveSession.update(session => {
    if (!session || session.isPaused) return session;

    return {
      ...session,
      isPaused: true,
      pauseStartTime: new Date().toISOString()
    };
  });
}

/**
 * Resume the workout
 */
export function resumeWorkout(): void {
  liveSession.update(session => {
    if (!session || !session.isPaused) return session;

    let additionalPauseTime = 0;
    if (session.pauseStartTime) {
      const pauseStart = new Date(session.pauseStartTime).getTime();
      const now = Date.now();
      additionalPauseTime = Math.floor((now - pauseStart) / 1000);
    }

    return {
      ...session,
      isPaused: false,
      pauseStartTime: null,
      totalPauseTime: session.totalPauseTime + additionalPauseTime
    };
  });
}

/**
 * Update timer state
 */
export function updateTimerState(timerState: TimerState): void {
  liveSession.update(session => {
    if (!session) return session;
    return { ...session, timerState };
  });
}

/**
 * Advance to next exercise
 */
export function advanceToNextExercise(): boolean {
  let advanced = false;

  liveSession.update(session => {
    if (!session) return session;

    // Mark current exercise as complete
    const exercises = [...session.exercises];
    if (exercises[session.currentExerciseIndex]) {
      exercises[session.currentExerciseIndex] = {
        ...exercises[session.currentExerciseIndex],
        completed: true
      };
    }

    // Move to next
    const nextIndex = session.currentExerciseIndex + 1;
    if (nextIndex < exercises.length) {
      advanced = true;
      return {
        ...session,
        exercises,
        currentExerciseIndex: nextIndex,
        timerState: createInitialTimerState()
      };
    }

    // No more exercises
    return { ...session, exercises };
  });

  return advanced;
}

/**
 * Advance to next set
 */
export function advanceToNextSet(): boolean {
  let advanced = false;

  liveSession.update(session => {
    if (!session) return session;

    const exercises = [...session.exercises];
    const current = exercises[session.currentExerciseIndex];

    if (current && current.completedSets < current.prescription.sets) {
      exercises[session.currentExerciseIndex] = {
        ...current,
        completedSets: current.completedSets + 1
      };
      advanced = true;

      return { ...session, exercises };
    }

    return session;
  });

  return advanced;
}

/**
 * Log a completed set
 */
export function logSet(
  exerciseIndex: number,
  setLog: SetLog
): void {
  liveSession.update(session => {
    if (!session) return session;

    const logs = [...session.logs];
    const exercise = session.exercises[exerciseIndex];

    // Find or create exercise log
    let exerciseLog = logs.find(
      l => l.exerciseName === exercise.exerciseName && l.exerciseOrder === exerciseIndex
    );

    if (!exerciseLog) {
      exerciseLog = {
        exerciseName: exercise.exerciseName,
        exerciseOrder: exerciseIndex,
        isCompoundParent: exercise.isCompoundParent,
        compoundParentName: null,
        sets: [],
        timestamp: new Date().toISOString()
      };
      logs.push(exerciseLog);
    }

    exerciseLog.sets.push(setLog);

    return { ...session, logs };
  });
}

/**
 * Log a completed compound block
 */
export function logCompoundBlock(
  exerciseIndex: number,
  totalRounds?: number,
  totalTime?: number
): void {
  liveSession.update(session => {
    if (!session) return session;

    const logs = [...session.logs];
    const exercise = session.exercises[exerciseIndex];

    // Find or create exercise log
    let exerciseLog = logs.find(
      l => l.exerciseName === exercise.exerciseName && l.exerciseOrder === exerciseIndex
    );

    if (!exerciseLog) {
      exerciseLog = {
        exerciseName: exercise.exerciseName,
        exerciseOrder: exerciseIndex,
        isCompoundParent: exercise.isCompoundParent,
        compoundParentName: null,
        sets: [],
        totalRounds,
        totalTime,
        timestamp: new Date().toISOString()
      };
      logs.push(exerciseLog);
    } else {
      exerciseLog.totalRounds = totalRounds;
      exerciseLog.totalTime = totalTime;
    }

    return { ...session, logs };
  });
}

/**
 * End the workout session
 */
export function endWorkout(): ExerciseLog[] {
  const session = get(liveSession);
  const logs = session?.logs ?? [];

  liveSession.set(null);

  return logs;
}

/**
 * Clear the session without returning logs
 */
export function clearSession(): void {
  liveSession.set(null);
}

/**
 * Check if there's a recoverable session
 */
export function hasRecoverableSession(): boolean {
  const session = get(liveSession);
  if (!session) return false;

  // Check if session is recent (within 24 hours)
  const startTime = new Date(session.startTime).getTime();
  const now = Date.now();
  const hoursSinceStart = (now - startTime) / (1000 * 60 * 60);

  return hoursSinceStart < 24;
}

/**
 * Get session duration in seconds (excluding pause time)
 */
export function getSessionDuration(): number {
  const session = get(liveSession);
  if (!session) return 0;

  const startTime = new Date(session.startTime).getTime();
  const now = Date.now();
  const totalElapsed = Math.floor((now - startTime) / 1000);

  // Subtract pause time
  let currentPauseTime = 0;
  if (session.isPaused && session.pauseStartTime) {
    const pauseStart = new Date(session.pauseStartTime).getTime();
    currentPauseTime = Math.floor((now - pauseStart) / 1000);
  }

  return totalElapsed - session.totalPauseTime - currentPauseTime;
}

/**
 * Update audio configuration
 */
export function updateAudioConfig(updates: Partial<AudioConfig>): void {
  audioConfig.update(config => ({
    ...config,
    ...updates
  }));

  // Also update in session if active
  liveSession.update(session => {
    if (!session) return session;
    return {
      ...session,
      audioConfig: {
        ...session.audioConfig,
        ...updates
      }
    };
  });
}
