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
  TimerExerciseType,
  WeightPrescription,
  PreviousWeekPerformance
} from '$lib/engine/types';
import { DEFAULT_AUDIO_CONFIG } from '$lib/engine/types';
import type { StoredSchedule, ParameterizedExercise, ParameterizedDay } from '$lib/types/schedule';
import { createInitialTimerState, getTimerExerciseType } from '$lib/engine/timer-engine';
import { getExerciseMetadata } from '$lib/engine/exercise-metadata';
import { activeSchedule } from './schedule';
import { getWeekPerformance } from './history';
import { userStore } from './user';
import timerConfig from '$lib/../data/timer_config.json';

// ============================================================================
// WEIGHT CALCULATION UTILITIES
// ============================================================================

/**
 * Weight calculation config from timer_config.json
 */
const weightConfig = timerConfig.weight_calculation;

/**
 * Get Training Max percentage from config (default: 90%)
 */
function getTrainingMaxPercentage(): number {
  return (weightConfig?.training_max_percentage ?? 90) / 100;
}

/**
 * Get weight rounding increment based on equipment type
 * Falls back to default_increment_lbs if equipment not specified
 */
function getWeightIncrement(equipmentType?: string): number {
  const rounding = weightConfig?.rounding;
  if (!rounding) return 5; // Safe default

  switch (equipmentType?.toLowerCase()) {
    case 'barbell':
      return rounding.barbell_increment_lbs ?? 5;
    case 'dumbbell':
    case 'dumbbells':
      return rounding.dumbbell_increment_lbs ?? 5;
    case 'cable':
      return rounding.cable_increment_lbs ?? 5;
    case 'machine':
      return rounding.machine_increment_lbs ?? 10;
    default:
      return rounding.default_increment_lbs ?? 5;
  }
}

/**
 * Round weight to nearest standard increment
 * Uses config-driven increment based on equipment type
 */
function roundToIncrement(weight: number, equipmentType?: string): number {
  const increment = getWeightIncrement(equipmentType);
  return Math.round(weight / increment) * increment;
}

/**
 * Get Training Max for an exercise from user's 1RM
 * TM = 1RM * (training_max_percentage from config)
 */
function getTrainingMax(exerciseName: string): number | null {
  const oneRepMax = userStore.getOneRepMax(exerciseName);
  if (!oneRepMax || oneRepMax.weightLbs <= 0) {
    return null;
  }
  return oneRepMax.weightLbs * getTrainingMaxPercentage();
}

/**
 * Calculate actual weight from a percentage of Training Max
 * Returns rounded weight in lbs, or null if no 1RM available
 */
function calculateWeightFromPercentTM(
  exerciseName: string,
  percentTM: number
): { weight: number; unit: 'lbs' | 'kg' } | null {
  const trainingMax = getTrainingMax(exerciseName);
  if (trainingMax === null) {
    return null;
  }

  // Calculate weight: TM * (percent / 100)
  const rawWeight = trainingMax * (percentTM / 100);

  // Get equipment type from exercise metadata for rounding
  const metadata = getExerciseMetadata(exerciseName);
  const equipmentType = metadata?.equipment?.[0]; // Use primary equipment

  // Round to config-driven increment
  const roundedWeight = roundToIncrement(rawWeight, equipmentType);

  return {
    weight: roundedWeight,
    unit: 'lbs' // Always stored internally as lbs
  };
}

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
 * Parse weight prescription from workout data
 * Handles both qualitative ("heavy") and object ({ type: "percent_tm", value: 80 }) formats
 */
function parseWeightPrescription(weightData: any): WeightPrescription | null {
  if (!weightData) return null;

  // Qualitative weight (beginner programs): "light", "moderate", "heavy"
  if (typeof weightData === 'string') {
    return {
      type: 'qualitative',
      value: weightData
    };
  }

  // Object format (intermediate/advanced programs)
  if (typeof weightData === 'object') {
    if (weightData.type === 'percent_tm') {
      return {
        type: 'percent_tm',
        value: weightData.value
      };
    }
    if (weightData.type === 'absolute') {
      return {
        type: 'absolute',
        value: weightData.value,
        unit: weightData.unit
      };
    }
  }

  return null;
}

/**
 * Convert ParameterizedExercise to LiveExercise
 */
function convertToLiveExercise(
  exercise: ParameterizedExercise,
  weekNumber: number,
  workoutProgramId: string
): LiveExercise {
  const weekKey = `week${weekNumber}` as keyof ParameterizedExercise;
  const weekParams = exercise[weekKey] as any;

  // Parse rest time
  // Note: *_time_minutes fields store values converted to minutes, so multiply by 60
  let restTimeSeconds: number | null = null;
  if (weekParams?.rest_time_seconds !== undefined) {
    restTimeSeconds = weekParams.rest_time_seconds;
  } else if (weekParams?.rest_time_minutes !== undefined) {
    restTimeSeconds = weekParams.rest_time_minutes * 60;
  }

  // Parse work time
  let workTimeSeconds: number | null = null;
  if (weekParams?.work_time_seconds !== undefined) {
    workTimeSeconds = weekParams.work_time_seconds;
  } else if (weekParams?.work_time_minutes !== undefined) {
    workTimeSeconds = weekParams.work_time_minutes * 60;
  }
  // For EMOM/AMRAP, block_time_minutes is the total duration
  if (weekParams?.block_time_minutes !== undefined) {
    workTimeSeconds = weekParams.block_time_minutes * 60;
  }

  // Parse weight and calculate from % TM if applicable
  let weight: number | null = null;
  let weightUnit: 'lbs' | 'kg' | null = null;
  if (weekParams?.weight) {
    if (typeof weekParams.weight === 'object') {
      if (weekParams.weight.type === 'absolute') {
        weight = weekParams.weight.value;
        weightUnit = weekParams.weight.unit;
      } else if (weekParams.weight.type === 'percent_tm') {
        // Calculate actual weight from % TM using user's 1RM
        const calculated = calculateWeightFromPercentTM(exercise.name, weekParams.weight.value);
        if (calculated) {
          weight = calculated.weight;
          weightUnit = calculated.unit;
        }
      }
    }
  }

  // Parse weight prescription for display
  const weightPrescription = parseWeightPrescription(weekParams?.weight);

  // Get previous week's performance (if week > 1)
  let previousWeek: PreviousWeekPerformance | null = null;
  if (weekNumber > 1) {
    const prevWeekData = getWeekPerformance(exercise.name, workoutProgramId, weekNumber - 1);
    if (prevWeekData) {
      previousWeek = {
        weight: prevWeekData.weight,
        weightUnit: prevWeekData.weightUnit as 'lbs' | 'kg' | null,
        rpe: prevWeekData.rpe,
        reps: prevWeekData.reps,
        weekNumber: prevWeekData.weekNumber
      };
    }
  }

  const exerciseType = determineExerciseType(exercise);
  const isCompoundParent = exercise.sub_exercises && exercise.sub_exercises.length > 0;

  // Convert sub-exercises
  const subExercises: LiveExercise[] = [];
  if (exercise.sub_exercises) {
    for (const subEx of exercise.sub_exercises) {
      const subWeekParams = (subEx as any)[weekKey] as any;

      // Parse sub-exercise rest time
      // Note: work_time_minutes always stores the value converted to minutes,
      // regardless of the original unit. So we always multiply by 60 to get seconds.
      let subRestTime: number | null = null;
      if (subWeekParams?.rest_time_seconds !== undefined) {
        subRestTime = subWeekParams.rest_time_seconds;
      } else if (subWeekParams?.rest_time_minutes !== undefined) {
        // Value is stored in minutes - convert to seconds
        subRestTime = subWeekParams.rest_time_minutes * 60;
      }

      // Parse sub-exercise work time
      let subWorkTime: number | null = null;
      if (subWeekParams?.work_time_seconds !== undefined) {
        subWorkTime = subWeekParams.work_time_seconds;
      } else if (subWeekParams?.work_time_minutes !== undefined) {
        // Value is stored in minutes - convert to seconds
        subWorkTime = subWeekParams.work_time_minutes * 60;
      }

      // Parse sub-exercise weight and calculate from % TM if applicable
      let subWeight: number | null = null;
      let subWeightUnit: 'lbs' | 'kg' | null = null;
      if (subWeekParams?.weight) {
        if (typeof subWeekParams.weight === 'object') {
          if (subWeekParams.weight.type === 'absolute') {
            subWeight = subWeekParams.weight.value;
            subWeightUnit = subWeekParams.weight.unit;
          } else if (subWeekParams.weight.type === 'percent_tm') {
            // Calculate actual weight from % TM using user's 1RM
            const subCalculated = calculateWeightFromPercentTM(subEx.name, subWeekParams.weight.value);
            if (subCalculated) {
              subWeight = subCalculated.weight;
              subWeightUnit = subCalculated.unit;
            }
          }
        }
      }

      // Parse sub-exercise weight prescription
      const subWeightPrescription = parseWeightPrescription(subWeekParams?.weight);

      // Get previous week's performance for sub-exercise
      let subPreviousWeek: PreviousWeekPerformance | null = null;
      if (weekNumber > 1) {
        const subPrevWeekData = getWeekPerformance(subEx.name, workoutProgramId, weekNumber - 1);
        if (subPrevWeekData) {
          subPreviousWeek = {
            weight: subPrevWeekData.weight,
            weightUnit: subPrevWeekData.weightUnit as 'lbs' | 'kg' | null,
            rpe: subPrevWeekData.rpe,
            reps: subPrevWeekData.reps,
            weekNumber: subPrevWeekData.weekNumber
          };
        }
      }

      subExercises.push({
        exerciseName: subEx.name,
        exerciseType: getTimerExerciseType(undefined, false),
        isCompoundParent: false,
        subExercises: [],
        prescription: {
          sets: subWeekParams?.sets ?? 1,
          reps: subWeekParams?.reps ?? null,
          weight: subWeight,
          weightUnit: subWeightUnit,
          workTimeSeconds: subWorkTime,
          restTimeSeconds: subRestTime,
          tempo: subWeekParams?.tempo ?? null,
          weightPrescription: subWeightPrescription,
          previousWeek: subPreviousWeek
        },
        completed: false,
        completedSets: 0,
        skipped: false
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
      tempo: weekParams?.tempo ?? null,
      weightPrescription,
      previousWeek
    },
    completed: false,
    completedSets: 0,
    skipped: false
  };
}

/**
 * Convert a day's exercises to LiveExercise array
 */
function convertDayToLiveExercises(
  day: ParameterizedDay,
  weekNumber: number,
  workoutProgramId: string
): LiveExercise[] {
  return day.exercises.map(ex => convertToLiveExercise(ex, weekNumber, workoutProgramId));
}

/**
 * Get the Monday of the week containing a date
 * This matches the CalendarView logic for week alignment
 */
function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // JavaScript: 0=Sunday, 1=Monday, ... 6=Saturday
  // We want Monday as the start of the week
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get effective day mapping for a specific week
 * Merges global dayMapping with week-specific overrides (matches CalendarView logic)
 */
function getEffectiveDayMapping(
  scheduleMetadata: StoredSchedule['scheduleMetadata'],
  weekNumber: number,
  daysPerWeek: number
): Record<string, number> {
  // Get global mapping (default if not set)
  let globalMapping: Record<string, number> = {};
  if (scheduleMetadata.dayMapping) {
    globalMapping = { ...scheduleMetadata.dayMapping };
  } else {
    // Default: days 1, 2, 3... map to Mon(0), Tue(1), Wed(2)...
    for (let i = 1; i <= daysPerWeek; i++) {
      globalMapping[i.toString()] = (i - 1) % 7;
    }
  }

  // Check for week-specific overrides (stored in scheduleMetadata.weekOverrides)
  const weekOverrides = (scheduleMetadata as any).weekOverrides as Record<string, Record<string, number>> | undefined;
  if (weekOverrides && weekOverrides[weekNumber.toString()]) {
    return { ...globalMapping, ...weekOverrides[weekNumber.toString()] };
  }

  return globalMapping;
}

/**
 * Get today's workout from active schedule
 * Returns the day that matches today based on schedule metadata
 *
 * Week alignment logic matches CalendarView:
 * - Week 1 starts from the Monday of the week containing startDate
 * - Workouts are placed on weekdays according to dayMapping
 * - Week-specific overrides are considered
 */
export function getTodaysWorkout(schedule: StoredSchedule): {
  weekNumber: number;
  dayNumber: number;
  day: ParameterizedDay;
} | null {
  const { scheduleMetadata, days, daysPerWeek, weeks } = schedule;
  const { startDate } = scheduleMetadata;

  if (!startDate) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Parse startDate as local date (YYYY-MM-DD format)
  const [year, month, dayOfMonth] = startDate.split('-').map(Number);
  const start = new Date(year, month - 1, dayOfMonth);
  start.setHours(0, 0, 0, 0);

  // Get the Monday of the week containing startDate (matches CalendarView logic)
  const weekStart = getMondayOfWeek(start);

  // Calculate days since the Monday of week 1
  const daysSinceWeekStart = Math.floor((today.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSinceWeekStart < 0) {
    // We're before the first week's Monday
    return null;
  }

  // Calculate current week (0-indexed) based on calendar weeks since weekStart
  const currentWeekIndex = Math.floor(daysSinceWeekStart / 7);
  const weekNumber = currentWeekIndex + 1;

  if (weekNumber > weeks) {
    // Program has ended
    return null;
  }

  // Get today's day of week (0=Monday, 6=Sunday to match dayMapping)
  let todayWeekday = today.getDay() - 1;
  if (todayWeekday < 0) todayWeekday = 6; // Sunday becomes 6

  // Get effective day mapping for this week (considers week-specific overrides)
  const effectiveMapping = getEffectiveDayMapping(scheduleMetadata, weekNumber, daysPerWeek);

  // Find which workout day (if any) is scheduled for today
  for (const [dayNum, weekday] of Object.entries(effectiveMapping)) {
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
  const exercises = convertDayToLiveExercises(day, weekNumber, schedule.id);
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
 * Skip forward to a specific exercise
 * Marks all exercises between current and target as skipped (incomplete data)
 * Returns true if skip was successful
 */
export function skipToExercise(targetIndex: number): boolean {
  let skipped = false;

  liveSession.update(session => {
    if (!session) return session;
    if (targetIndex <= session.currentExerciseIndex) return session;
    if (targetIndex >= session.exercises.length) return session;

    const exercises = [...session.exercises];

    // Mark all exercises between current and target as skipped
    for (let i = session.currentExerciseIndex; i < targetIndex; i++) {
      exercises[i] = {
        ...exercises[i],
        skipped: true,
        completed: true  // Mark as "done" so we can move past it
      };
    }

    skipped = true;
    return {
      ...session,
      exercises,
      currentExerciseIndex: targetIndex,
      timerState: createInitialTimerState()
    };
  });

  return skipped;
}

/**
 * Mark a skipped exercise as logged (user retroactively filled in data)
 * Clears the skipped flag so the warning indicator is removed
 */
export function markExerciseLogged(exerciseIndex: number): void {
  liveSession.update(session => {
    if (!session) return session;
    if (exerciseIndex < 0 || exerciseIndex >= session.exercises.length) return session;

    const exercises = [...session.exercises];
    exercises[exerciseIndex] = {
      ...exercises[exerciseIndex],
      skipped: false
    };

    return { ...session, exercises };
  });
}

/**
 * Log a completed set for a specific exercise (for retroactive logging)
 * Also increments completedSets counter
 */
export function logSetForExercise(
  exerciseIndex: number,
  setLog: SetLog,
  totalRounds?: number,
  totalTime?: number
): void {
  const session = get(liveSession);
  if (!session) return;

  const exercise = session.exercises[exerciseIndex];
  if (!exercise) return;

  if (exercise.isCompoundParent && (totalRounds !== undefined || totalTime !== undefined)) {
    logCompoundBlock(exerciseIndex, totalRounds, totalTime);
    // For compound blocks, mark as fully logged after single entry
    markExerciseLogged(exerciseIndex);
  } else {
    logSet(exerciseIndex, setLog);

    // Increment completedSets for the exercise
    liveSession.update(s => {
      if (!s) return s;
      const exercises = [...s.exercises];
      const ex = exercises[exerciseIndex];
      if (ex) {
        const newCompletedSets = ex.completedSets + 1;
        exercises[exerciseIndex] = {
          ...ex,
          completedSets: newCompletedSets,
          // Clear skipped flag only when all sets are logged
          skipped: newCompletedSets >= ex.prescription.sets ? false : ex.skipped
        };
      }
      return { ...s, exercises };
    });
  }
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
 * Log a completed set from the data entry modal
 * Handles both regular sets and compound blocks
 */
export function logCompletedSet(
  setLog: SetLog,
  totalRounds?: number,
  totalTime?: number
): void {
  const session = get(liveSession);
  if (!session) return;

  const exerciseIndex = session.currentExerciseIndex;
  const exercise = session.exercises[exerciseIndex];

  if (exercise.isCompoundParent && (totalRounds !== undefined || totalTime !== undefined)) {
    // Log as compound block
    logCompoundBlock(exerciseIndex, totalRounds, totalTime);
  } else {
    // Log as regular set
    logSet(exerciseIndex, setLog);
  }
}

/**
 * End the workout session
 */
export function endWorkout(): { logs: ExerciseLog[]; session: LiveWorkoutSession } | null {
  const session = get(liveSession);
  if (!session) return null;

  const logs = session.logs ?? [];

  liveSession.set(null);

  return { logs, session };
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

/**
 * Get the exercise log for a specific exercise by index
 * Returns the log data if it exists, null otherwise
 */
export function getExerciseLog(exerciseIndex: number): ExerciseLog | null {
  const session = get(liveSession);
  if (!session) return null;

  const exercise = session.exercises[exerciseIndex];
  if (!exercise) return null;

  return session.logs.find(
    l => l.exerciseName === exercise.exerciseName && l.exerciseOrder === exerciseIndex
  ) ?? null;
}

/**
 * Update all sets for an exercise at once
 * Used for bulk editing from the multi-set review modal
 */
export function updateExerciseLogs(
  exerciseIndex: number,
  sets: SetLog[],
  totalRounds?: number,
  totalTime?: number
): void {
  liveSession.update(session => {
    if (!session) return session;

    const exercise = session.exercises[exerciseIndex];
    if (!exercise) return session;

    const logs = [...session.logs];

    // Find existing log or create new one
    const existingIndex = logs.findIndex(
      l => l.exerciseName === exercise.exerciseName && l.exerciseOrder === exerciseIndex
    );

    const exerciseLog: ExerciseLog = {
      exerciseName: exercise.exerciseName,
      exerciseOrder: exerciseIndex,
      isCompoundParent: exercise.isCompoundParent,
      compoundParentName: null,
      sets,
      totalRounds,
      totalTime,
      timestamp: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      logs[existingIndex] = exerciseLog;
    } else {
      logs.push(exerciseLog);
    }

    // Update exercise state
    const exercises = [...session.exercises];
    const completedSets = sets.filter(s => s.completed).length;
    exercises[exerciseIndex] = {
      ...exercise,
      completedSets,
      // Clear skipped flag if any data was logged
      skipped: sets.length > 0 ? false : exercise.skipped,
      // Mark as completed if all sets are done
      completed: completedSets >= exercise.prescription.sets || exercise.completed
    };

    return { ...session, logs, exercises };
  });
}
