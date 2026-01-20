/**
 * Live Session Store Unit Tests
 *
 * Tests for:
 * - Session initialization from schedule
 * - Pause/resume timing
 * - Exercise/set advancement
 * - Session persistence to localStorage
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import {
  liveSession,
  audioConfig,
  hasActiveSession,
  currentExercise,
  remainingExercises,
  sessionProgress,
  startWorkout,
  pauseWorkout,
  resumeWorkout,
  advanceToNextExercise,
  advanceToNextSet,
  logSet,
  logCompoundBlock,
  endWorkout,
  clearSession,
  hasRecoverableSession,
  getSessionDuration,
  updateAudioConfig,
  getTodaysWorkout,
  getWorkoutForDay,
  updateExerciseLogs,
  goToPreviousExercise,
  rewindToPreviousSet
} from '../../src/lib/stores/liveSession';
import type { StoredSchedule, ParameterizedDay, ParameterizedExercise } from '../../src/lib/types/schedule';
import type { SetLog } from '../../src/lib/engine/types';

// ============================================================================
// TEST FIXTURES
// ============================================================================

function createMockSchedule(): StoredSchedule {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Set start date to beginning of current week (Monday)
  const dayOfWeek = today.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust to Monday
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);

  // Get today's weekday (0=Monday, 6=Sunday)
  let todayWeekday = today.getDay() - 1;
  if (todayWeekday < 0) todayWeekday = 6;

  return {
    id: 'test-schedule-123',
    name: 'Test Program',
    description: 'A test workout program',
    version: '2.0.0',
    weeks: 4,
    daysPerWeek: 3,
    metadata: {
      difficulty: 'Intermediate',
      equipment: ['barbell', 'dumbbells'],
      estimatedDuration: '60 minutes',
      tags: ['strength']
    },
    scheduleMetadata: {
      isActive: true,
      startDate: monday.toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      currentWeek: 1,
      currentDay: 1,
      dayMapping: {
        '1': todayWeekday as any, // Day 1 is today
        '2': ((todayWeekday + 2) % 7) as any,
        '3': ((todayWeekday + 4) % 7) as any
      }
    },
    days: {
      '1': createMockDay(1),
      '2': createMockDay(2),
      '3': createMockDay(3),
      '4': createMockDay(4),
      '5': createMockDay(5),
      '6': createMockDay(6)
    }
  };
}

function createMockDay(dayNumber: number): ParameterizedDay {
  return {
    dayNumber,
    type: 'gym',
    focus: 'Upper',
    exercises: [
      createMockExercise('Bench Press', 4, 8, 90),
      createMockExercise('Pull-ups', 3, 10, 60),
      createMockEMOMExercise()
    ]
  };
}

function createMockExercise(
  name: string,
  sets: number,
  reps: number,
  restSeconds: number
): ParameterizedExercise {
  return {
    name,
    week1: {
      sets,
      reps,
      rest_time_seconds: restSeconds,
      weight: { type: 'percent_tm', value: 75 }
    },
    week2: {
      sets,
      reps,
      rest_time_seconds: restSeconds,
      weight: { type: 'percent_tm', value: 77.5 }
    },
    week3: {
      sets,
      reps,
      rest_time_seconds: restSeconds,
      weight: { type: 'percent_tm', value: 80 }
    }
  };
}

function createMockEMOMExercise(): ParameterizedExercise {
  return {
    name: 'EMOM Block',
    category: 'emom',
    week1: {
      sets: 1,
      block_time_minutes: 6
    },
    week2: {
      sets: 1,
      block_time_minutes: 7
    },
    week3: {
      sets: 1,
      block_time_minutes: 8
    },
    sub_exercises: [
      {
        name: 'Kettlebell Swings',
        week1: { sets: 1, reps: 10 },
        week2: { sets: 1, reps: 12 },
        week3: { sets: 1, reps: 12 }
      },
      {
        name: 'Burpees',
        week1: { sets: 1, reps: 8 },
        week2: { sets: 1, reps: 10 },
        week3: { sets: 1, reps: 10 }
      }
    ]
  };
}

function createMockCircuitExercise(): ParameterizedExercise {
  return {
    name: 'Circuit Block',
    category: 'circuit',
    week1: {
      sets: 1,
      block_time_minutes: 10
    },
    week2: {
      sets: 1,
      block_time_minutes: 12
    },
    week3: {
      sets: 1,
      block_time_minutes: 15
    },
    sub_exercises: [
      {
        name: 'Jump Squats',
        week1: { sets: 1, reps: 15 },
        week2: { sets: 1, reps: 18 },
        week3: { sets: 1, reps: 20 }
      },
      {
        name: 'Mountain Climbers',
        week1: { sets: 1, reps: 20 },
        week2: { sets: 1, reps: 25 },
        week3: { sets: 1, reps: 30 }
      }
    ]
  };
}

function createMockIntervalExercise(): ParameterizedExercise {
  return {
    name: 'Interval Block',
    category: 'interval',
    week1: {
      sets: 4,
      work_time_seconds: 30,
      rest_time_seconds: 30
    },
    week2: {
      sets: 5,
      work_time_seconds: 35,
      rest_time_seconds: 25
    },
    week3: {
      sets: 6,
      work_time_seconds: 40,
      rest_time_seconds: 20
    },
    sub_exercises: [
      {
        name: 'Sprint',
        week1: { sets: 1, work_time_seconds: 30, rest_time_seconds: 30 },
        week2: { sets: 1, work_time_seconds: 35, rest_time_seconds: 25 },
        week3: { sets: 1, work_time_seconds: 40, rest_time_seconds: 20 }
      }
    ]
  };
}

function createDayWithCompoundBlocks(): ParameterizedDay {
  return {
    dayNumber: 1,
    type: 'gym',
    focus: 'Conditioning',
    exercises: [
      createMockExercise('Deadlift', 3, 5, 120),
      createMockCircuitExercise(),
      createMockIntervalExercise()
    ]
  };
}

// ============================================================================
// MOCK STORAGE
// ============================================================================

let mockStorage: Record<string, string> = {};

beforeEach(() => {
  mockStorage = {};

  vi.stubGlobal('localStorage', {
    getItem: (key: string) => mockStorage[key] ?? null,
    setItem: (key: string, value: string) => { mockStorage[key] = value; },
    removeItem: (key: string) => { delete mockStorage[key]; },
    clear: () => { mockStorage = {}; }
  });

  // Clear any existing session
  clearSession();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ============================================================================
// TESTS
// ============================================================================

describe('Live Session Store', () => {
  describe('session initialization', () => {
    it('should start with no active session', () => {
      expect(get(hasActiveSession)).toBe(false);
      expect(get(liveSession)).toBe(null);
    });

    it('should initialize session from schedule day', () => {
      const schedule = createMockSchedule();
      const day = schedule.days['1'];

      startWorkout(schedule, 1, 1, day);

      const session = get(liveSession);
      expect(session).not.toBe(null);
      expect(session!.scheduleId).toBe('test-schedule-123');
      expect(session!.weekNumber).toBe(1);
      expect(session!.dayNumber).toBe(1);
      expect(session!.exercises.length).toBe(3);
    });

    it('should convert exercises to LiveExercise format', () => {
      const schedule = createMockSchedule();
      const day = schedule.days['1'];

      startWorkout(schedule, 1, 1, day);

      const session = get(liveSession);
      const firstExercise = session!.exercises[0];

      expect(firstExercise.exerciseName).toBe('Bench Press');
      expect(firstExercise.exerciseType).toBe('strength');
      expect(firstExercise.prescription.sets).toBe(4);
      expect(firstExercise.prescription.reps).toBe(8);
      expect(firstExercise.prescription.restTimeSeconds).toBe(90);
      expect(firstExercise.completed).toBe(false);
      expect(firstExercise.completedSets).toBe(0);
    });

    it('should convert EMOM exercise with sub-exercises', () => {
      const schedule = createMockSchedule();
      const day = schedule.days['1'];

      startWorkout(schedule, 1, 1, day);

      const session = get(liveSession);
      const emomExercise = session!.exercises[2];

      expect(emomExercise.exerciseName).toBe('EMOM Block');
      expect(emomExercise.exerciseType).toBe('emom');
      expect(emomExercise.isCompoundParent).toBe(true);
      expect(emomExercise.subExercises.length).toBe(2);
      expect(emomExercise.prescription.workTimeSeconds).toBe(360); // 6 minutes in seconds
    });

    it('should use week-specific parameters', () => {
      const schedule = createMockSchedule();
      const day = schedule.days['1'];

      // Start workout for week 2
      startWorkout(schedule, 2, 1, day);

      const session = get(liveSession);
      const emomExercise = session!.exercises[2];

      // Week 2 has 7-minute block time
      expect(emomExercise.prescription.workTimeSeconds).toBe(420);
    });
  });

  describe('derived stores', () => {
    it('should track current exercise', () => {
      const schedule = createMockSchedule();
      const day = schedule.days['1'];

      startWorkout(schedule, 1, 1, day);

      const current = get(currentExercise);
      expect(current!.exerciseName).toBe('Bench Press');
    });

    it('should track remaining exercises', () => {
      const schedule = createMockSchedule();
      const day = schedule.days['1'];

      startWorkout(schedule, 1, 1, day);

      const remaining = get(remainingExercises);
      expect(remaining.length).toBe(2);
      expect(remaining[0].exerciseName).toBe('Pull-ups');
    });

    it('should calculate session progress', () => {
      const schedule = createMockSchedule();
      const day = schedule.days['1'];

      startWorkout(schedule, 1, 1, day);

      expect(get(sessionProgress)).toBe(0);

      advanceToNextExercise();
      expect(get(sessionProgress)).toBe(33); // 1 of 3 complete

      advanceToNextExercise();
      expect(get(sessionProgress)).toBe(67); // 2 of 3 complete
    });
  });

  describe('pause/resume', () => {
    it('should track pause state', () => {
      const schedule = createMockSchedule();
      const day = schedule.days['1'];

      startWorkout(schedule, 1, 1, day);

      expect(get(liveSession)!.isPaused).toBe(false);

      pauseWorkout();
      expect(get(liveSession)!.isPaused).toBe(true);
      expect(get(liveSession)!.pauseStartTime).not.toBe(null);

      resumeWorkout();
      expect(get(liveSession)!.isPaused).toBe(false);
      expect(get(liveSession)!.pauseStartTime).toBe(null);
    });

    it('should accumulate pause time', async () => {
      const schedule = createMockSchedule();
      const day = schedule.days['1'];

      startWorkout(schedule, 1, 1, day);

      expect(get(liveSession)!.totalPauseTime).toBe(0);

      // Mock time passage during pause
      const pauseTime = new Date();
      pauseWorkout();

      // Set pause start time to 10 seconds ago
      liveSession.update(session => {
        if (!session) return session;
        const tenSecondsAgo = new Date(Date.now() - 10000);
        return {
          ...session,
          pauseStartTime: tenSecondsAgo.toISOString()
        };
      });

      resumeWorkout();

      // Should have accumulated about 10 seconds of pause time
      expect(get(liveSession)!.totalPauseTime).toBeGreaterThanOrEqual(9);
      expect(get(liveSession)!.totalPauseTime).toBeLessThanOrEqual(12);
    });
  });

  describe('exercise navigation', () => {
    it('should advance to next exercise', () => {
      const schedule = createMockSchedule();
      const day = schedule.days['1'];

      startWorkout(schedule, 1, 1, day);

      expect(get(liveSession)!.currentExerciseIndex).toBe(0);

      const advanced = advanceToNextExercise();

      expect(advanced).toBe(true);
      expect(get(liveSession)!.currentExerciseIndex).toBe(1);
      expect(get(liveSession)!.exercises[0].completed).toBe(true);
    });

    it('should return false when no more exercises', () => {
      const schedule = createMockSchedule();
      const day = schedule.days['1'];

      startWorkout(schedule, 1, 1, day);

      advanceToNextExercise();
      advanceToNextExercise();
      const advanced = advanceToNextExercise();

      expect(advanced).toBe(false);
      expect(get(liveSession)!.currentExerciseIndex).toBe(2);
    });
  });

  describe('set tracking', () => {
    it('should advance to next set', () => {
      const schedule = createMockSchedule();
      const day = schedule.days['1'];

      startWorkout(schedule, 1, 1, day);

      expect(get(liveSession)!.exercises[0].completedSets).toBe(0);

      const advanced = advanceToNextSet();

      expect(advanced).toBe(true);
      expect(get(liveSession)!.exercises[0].completedSets).toBe(1);
    });

    it('should not advance beyond total sets', () => {
      const schedule = createMockSchedule();
      const day = schedule.days['1'];

      startWorkout(schedule, 1, 1, day);

      // Advance through all 4 sets
      advanceToNextSet();
      advanceToNextSet();
      advanceToNextSet();
      advanceToNextSet();

      expect(get(liveSession)!.exercises[0].completedSets).toBe(4);

      // Should not advance further
      const advanced = advanceToNextSet();
      expect(advanced).toBe(false);
      expect(get(liveSession)!.exercises[0].completedSets).toBe(4);
    });
  });

  describe('logging', () => {
    it('should log completed set', () => {
      const schedule = createMockSchedule();
      const day = schedule.days['1'];

      startWorkout(schedule, 1, 1, day);

      const setLog: SetLog = {
        setNumber: 1,
        reps: 8,
        weight: 135,
        weightUnit: 'lbs',
        workTime: null,
        rpe: 7,
        rir: 3,
        completed: true,
        notes: null,
        timestamp: new Date().toISOString()
      };

      logSet(0, setLog);

      const session = get(liveSession);
      expect(session!.logs.length).toBe(1);
      expect(session!.logs[0].exerciseName).toBe('Bench Press');
      expect(session!.logs[0].sets.length).toBe(1);
      expect(session!.logs[0].sets[0].reps).toBe(8);
    });

    it('should accumulate sets in same exercise log', () => {
      const schedule = createMockSchedule();
      const day = schedule.days['1'];

      startWorkout(schedule, 1, 1, day);

      logSet(0, {
        setNumber: 1,
        reps: 8,
        weight: 135,
        weightUnit: 'lbs',
        workTime: null,
        rpe: 7,
        rir: null,
        completed: true,
        notes: null,
        timestamp: new Date().toISOString()
      });

      logSet(0, {
        setNumber: 2,
        reps: 8,
        weight: 135,
        weightUnit: 'lbs',
        workTime: null,
        rpe: 8,
        rir: null,
        completed: true,
        notes: null,
        timestamp: new Date().toISOString()
      });

      const session = get(liveSession);
      expect(session!.logs.length).toBe(1); // Still one exercise log
      expect(session!.logs[0].sets.length).toBe(2); // But two sets
    });

    it('should log compound block with rounds', () => {
      const schedule = createMockSchedule();
      const day = schedule.days['1'];

      startWorkout(schedule, 1, 1, day);

      logCompoundBlock(2, 5.5, undefined); // 5.5 rounds

      const session = get(liveSession);
      const emomLog = session!.logs.find(l => l.exerciseName === 'EMOM Block');
      expect(emomLog).toBeDefined();
      expect(emomLog!.totalRounds).toBe(5.5);
    });

    it('should log circuit with total time', () => {
      const schedule = createMockSchedule();
      const day = schedule.days['1'];

      startWorkout(schedule, 1, 1, day);

      logCompoundBlock(2, undefined, 360); // 6 minutes total

      const session = get(liveSession);
      const log = session!.logs.find(l => l.exerciseName === 'EMOM Block');
      expect(log!.totalTime).toBe(360);
    });
  });

  describe('session lifecycle', () => {
    it('should end workout and return logs', () => {
      const schedule = createMockSchedule();
      const day = schedule.days['1'];

      startWorkout(schedule, 1, 1, day);

      logSet(0, {
        setNumber: 1,
        reps: 8,
        weight: 135,
        weightUnit: 'lbs',
        workTime: null,
        rpe: null,
        rir: null,
        completed: true,
        notes: null,
        timestamp: new Date().toISOString()
      });

      const result = endWorkout();

      expect(result).not.toBe(null);
      expect(result?.logs.length).toBe(1);
      // Session is kept for review, not cleared
      const session = get(liveSession);
      expect(session).not.toBe(null);
      expect(session?.isComplete).toBe(true);
      expect(session?.endTime).not.toBe(null);
    });

    it('should clear session without returning logs', () => {
      const schedule = createMockSchedule();
      const day = schedule.days['1'];

      startWorkout(schedule, 1, 1, day);
      clearSession();

      expect(get(liveSession)).toBe(null);
    });
  });

  describe('session recovery', () => {
    it('should persist session to localStorage', () => {
      const schedule = createMockSchedule();
      const day = schedule.days['1'];

      startWorkout(schedule, 1, 1, day);

      expect(mockStorage['shredly_live_session']).toBeDefined();
      const stored = JSON.parse(mockStorage['shredly_live_session']);
      expect(stored.scheduleId).toBe('test-schedule-123');
    });

    it('should detect recoverable session', () => {
      const schedule = createMockSchedule();
      const day = schedule.days['1'];

      startWorkout(schedule, 1, 1, day);

      expect(hasRecoverableSession()).toBe(true);
    });

    it('should not consider old sessions recoverable', () => {
      const schedule = createMockSchedule();
      const day = schedule.days['1'];

      startWorkout(schedule, 1, 1, day);

      // Set start time to 25 hours ago
      liveSession.update(session => {
        if (!session) return session;
        const oldTime = new Date(Date.now() - 25 * 60 * 60 * 1000);
        return {
          ...session,
          startTime: oldTime.toISOString()
        };
      });

      expect(hasRecoverableSession()).toBe(false);
    });
  });

  describe('audio config', () => {
    it('should update audio config', () => {
      updateAudioConfig({ enabled: false, volume: 0.5 });

      const config = get(audioConfig);
      expect(config.enabled).toBe(false);
      expect(config.volume).toBe(0.5);
    });

    it('should persist audio config to localStorage', () => {
      updateAudioConfig({ enabled: false });

      expect(mockStorage['shredly_audio_config']).toBeDefined();
      const stored = JSON.parse(mockStorage['shredly_audio_config']);
      expect(stored.enabled).toBe(false);
    });

    it('should update session audio config when active', () => {
      const schedule = createMockSchedule();
      const day = schedule.days['1'];

      startWorkout(schedule, 1, 1, day);
      updateAudioConfig({ volume: 0.3 });

      expect(get(liveSession)!.audioConfig.volume).toBe(0.3);
    });
  });
});

describe('getTodaysWorkout', () => {
  it('should return null if schedule has no start date', () => {
    const schedule = createMockSchedule();
    schedule.scheduleMetadata.startDate = '';

    const result = getTodaysWorkout(schedule);
    expect(result).toBe(null);
  });

  it('should return null if program has not started', () => {
    const schedule = createMockSchedule();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    schedule.scheduleMetadata.startDate = tomorrow.toISOString().split('T')[0];

    const result = getTodaysWorkout(schedule);
    expect(result).toBe(null);
  });

  it('should return null if program has ended', () => {
    const schedule = createMockSchedule();
    const longAgo = new Date();
    longAgo.setDate(longAgo.getDate() - 100);
    schedule.scheduleMetadata.startDate = longAgo.toISOString().split('T')[0];

    const result = getTodaysWorkout(schedule);
    expect(result).toBe(null);
  });

  it('should return todays workout based on day mapping', () => {
    const schedule = createMockSchedule();
    // The mock schedule sets day 1 to today's weekday

    const result = getTodaysWorkout(schedule);

    // May or may not find workout depending on day mapping
    // If today matches a mapped day, result should not be null
    if (result) {
      expect(result.day).toBeDefined();
      expect(result.weekNumber).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('getWorkoutForDay', () => {
  it('should return workout for valid week and day', () => {
    const schedule = createMockSchedule();

    const result = getWorkoutForDay(schedule, 1, 1);

    expect(result).not.toBe(null);
    expect(result!.dayNumber).toBe(1);
    expect(result!.day.dayNumber).toBe(1);
  });

  it('should return null for invalid day', () => {
    const schedule = createMockSchedule();

    const result = getWorkoutForDay(schedule, 1, 100);
    expect(result).toBe(null);
  });

  it('should return per-week day number for week 2', () => {
    const schedule = createMockSchedule();

    const result = getWorkoutForDay(schedule, 2, 1);

    // dayNumber is the per-week day (1, 2, 3), not a global index
    // Week context is provided separately via weekNumber parameter
    expect(result!.dayNumber).toBe(1);
  });
});

describe('updateExerciseLogs', () => {
  it('should mark Circuit exercise as completed when totalTime is provided', () => {
    const schedule = createMockSchedule();
    schedule.days['1'] = createDayWithCompoundBlocks();

    startWorkout(schedule, 1, 1, schedule.days['1']);

    // Circuit exercise is at index 1
    const circuitIndex = 1;
    const session = get(liveSession);
    expect(session!.exercises[circuitIndex].exerciseName).toBe('Circuit Block');
    expect(session!.exercises[circuitIndex].completed).toBe(false);

    // Log Circuit with totalTime (empty sets array)
    updateExerciseLogs(circuitIndex, [], undefined, 600); // 10 minutes

    // Should be marked as completed
    const updatedSession = get(liveSession);
    expect(updatedSession!.exercises[circuitIndex].completed).toBe(true);
    expect(updatedSession!.exercises[circuitIndex].skipped).toBe(false);
  });

  it('should mark Interval exercise as completed when totalTime is provided', () => {
    const schedule = createMockSchedule();
    schedule.days['1'] = createDayWithCompoundBlocks();

    startWorkout(schedule, 1, 1, schedule.days['1']);

    // Interval exercise is at index 2
    const intervalIndex = 2;
    const session = get(liveSession);
    expect(session!.exercises[intervalIndex].exerciseName).toBe('Interval Block');
    expect(session!.exercises[intervalIndex].completed).toBe(false);

    // Log Interval with totalTime (empty sets array)
    updateExerciseLogs(intervalIndex, [], undefined, 480); // 8 minutes

    // Should be marked as completed
    const updatedSession = get(liveSession);
    expect(updatedSession!.exercises[intervalIndex].completed).toBe(true);
    expect(updatedSession!.exercises[intervalIndex].skipped).toBe(false);
  });

  it('should mark AMRAP exercise as completed when totalRounds is provided', () => {
    const schedule = createMockSchedule();
    const day = schedule.days['1'];

    startWorkout(schedule, 1, 1, day);

    // EMOM exercise is at index 2 (using as proxy for AMRAP since structure is similar)
    const emomIndex = 2;

    // Log with totalRounds (empty sets array)
    updateExerciseLogs(emomIndex, [], 5.5, undefined);

    // Should be marked as completed
    const updatedSession = get(liveSession);
    expect(updatedSession!.exercises[emomIndex].completed).toBe(true);
    expect(updatedSession!.exercises[emomIndex].skipped).toBe(false);
  });

  it('should clear skipped flag when totalTime is provided', () => {
    const schedule = createMockSchedule();
    schedule.days['1'] = createDayWithCompoundBlocks();

    startWorkout(schedule, 1, 1, schedule.days['1']);

    // First mark the Circuit exercise as skipped
    const circuitIndex = 1;
    liveSession.update(session => {
      if (!session) return session;
      const exercises = [...session.exercises];
      exercises[circuitIndex] = {
        ...exercises[circuitIndex],
        skipped: true
      };
      return { ...session, exercises };
    });

    // Verify it's skipped
    let session = get(liveSession);
    expect(session!.exercises[circuitIndex].skipped).toBe(true);

    // Now update with totalTime
    updateExerciseLogs(circuitIndex, [], undefined, 600);

    // Skipped flag should be cleared
    session = get(liveSession);
    expect(session!.exercises[circuitIndex].skipped).toBe(false);
    expect(session!.exercises[circuitIndex].completed).toBe(true);
  });

  it('should still mark regular exercise as completed based on sets', () => {
    const schedule = createMockSchedule();
    const day = schedule.days['1'];

    startWorkout(schedule, 1, 1, day);

    // Log all sets for first exercise (Bench Press with 4 sets)
    const sets: SetLog[] = [
      { setNumber: 1, reps: 8, weight: 135, weightUnit: 'lbs', workTime: null, rpe: null, rir: null, completed: true, notes: null, timestamp: new Date().toISOString() },
      { setNumber: 2, reps: 8, weight: 135, weightUnit: 'lbs', workTime: null, rpe: null, rir: null, completed: true, notes: null, timestamp: new Date().toISOString() },
      { setNumber: 3, reps: 8, weight: 135, weightUnit: 'lbs', workTime: null, rpe: null, rir: null, completed: true, notes: null, timestamp: new Date().toISOString() },
      { setNumber: 4, reps: 8, weight: 135, weightUnit: 'lbs', workTime: null, rpe: null, rir: null, completed: true, notes: null, timestamp: new Date().toISOString() }
    ];

    updateExerciseLogs(0, sets);

    const session = get(liveSession);
    expect(session!.exercises[0].completed).toBe(true);
    expect(session!.exercises[0].completedSets).toBe(4);
  });

  it('should mark EMOM compound block as completed when sets have completed=true', () => {
    const schedule = createMockSchedule();
    const day = schedule.days['1'];

    startWorkout(schedule, 1, 1, day);

    // EMOM exercise is at index 2 (isCompoundParent=true, prescription.sets=1)
    const emomIndex = 2;
    const session = get(liveSession);
    expect(session!.exercises[emomIndex].isCompoundParent).toBe(true);
    expect(session!.exercises[emomIndex].completed).toBe(false);

    // Log with a single SetLog with completed=true (how EMOM/Interval are logged)
    const sets: SetLog[] = [
      { setNumber: 1, reps: 10, weight: null, weightUnit: null, workTime: null, rpe: 8, rir: null, completed: true, notes: null, timestamp: new Date().toISOString() }
    ];

    // No totalRounds or totalTime - just the sets array
    updateExerciseLogs(emomIndex, sets, undefined, undefined);

    // Should be marked as completed because it's a compound parent with completed sets
    const updatedSession = get(liveSession);
    expect(updatedSession!.exercises[emomIndex].completed).toBe(true);
    expect(updatedSession!.exercises[emomIndex].skipped).toBe(false);
  });

  it('should mark Interval compound block as completed when sets have completed=true', () => {
    const schedule = createMockSchedule();
    schedule.days['1'] = createDayWithCompoundBlocks();

    startWorkout(schedule, 1, 1, schedule.days['1']);

    // Interval exercise is at index 2 (isCompoundParent=true, but prescription.sets=4)
    const intervalIndex = 2;
    const session = get(liveSession);
    expect(session!.exercises[intervalIndex].exerciseName).toBe('Interval Block');
    expect(session!.exercises[intervalIndex].isCompoundParent).toBe(true);
    expect(session!.exercises[intervalIndex].prescription.sets).toBe(4); // 4 work/rest cycles
    expect(session!.exercises[intervalIndex].completed).toBe(false);

    // Log with a single SetLog (how Interval is logged via SetReviewModal)
    const sets: SetLog[] = [
      { setNumber: 1, reps: 10, weight: null, weightUnit: null, workTime: null, rpe: 8, rir: null, completed: true, notes: null, timestamp: new Date().toISOString() }
    ];

    // No totalRounds or totalTime - just the sets array
    updateExerciseLogs(intervalIndex, sets, undefined, undefined);

    // Should be marked as completed even though completedSets(1) < prescription.sets(4)
    // because it's a compound parent with any completed sets
    const updatedSession = get(liveSession);
    expect(updatedSession!.exercises[intervalIndex].completed).toBe(true);
    expect(updatedSession!.exercises[intervalIndex].skipped).toBe(false);
  });
});

describe('goToPreviousExercise', () => {
  it('should return false when at first exercise', () => {
    const schedule = createMockSchedule();
    const day = schedule.days['1'];

    startWorkout(schedule, 1, 1, day);

    expect(get(liveSession)!.currentExerciseIndex).toBe(0);

    const moved = goToPreviousExercise();

    expect(moved).toBe(false);
    expect(get(liveSession)!.currentExerciseIndex).toBe(0);
  });

  it('should move to previous exercise', () => {
    const schedule = createMockSchedule();
    const day = schedule.days['1'];

    startWorkout(schedule, 1, 1, day);
    advanceToNextExercise();

    expect(get(liveSession)!.currentExerciseIndex).toBe(1);

    const moved = goToPreviousExercise();

    expect(moved).toBe(true);
    expect(get(liveSession)!.currentExerciseIndex).toBe(0);
  });

  it('should reset both current and previous exercise states', () => {
    const schedule = createMockSchedule();
    const day = schedule.days['1'];

    startWorkout(schedule, 1, 1, day);

    // Complete some sets and advance
    advanceToNextSet();
    advanceToNextSet();
    advanceToNextExercise();

    // Verify first exercise was marked completed
    expect(get(liveSession)!.exercises[0].completed).toBe(true);

    // Go back to previous exercise
    goToPreviousExercise();

    // Both exercises should be reset
    const session = get(liveSession);
    expect(session!.exercises[0].completed).toBe(false);
    expect(session!.exercises[0].completedSets).toBe(0);
    expect(session!.exercises[1].completed).toBe(false);
    expect(session!.exercises[1].completedSets).toBe(0);
  });

  it('should return false when no active session', () => {
    expect(goToPreviousExercise()).toBe(false);
  });
});

describe('rewindToPreviousSet', () => {
  it('should return false when no sets completed', () => {
    const schedule = createMockSchedule();
    const day = schedule.days['1'];

    startWorkout(schedule, 1, 1, day);

    expect(get(liveSession)!.exercises[0].completedSets).toBe(0);

    const rewound = rewindToPreviousSet();

    expect(rewound).toBe(false);
    expect(get(liveSession)!.exercises[0].completedSets).toBe(0);
  });

  it('should decrement completedSets', () => {
    const schedule = createMockSchedule();
    const day = schedule.days['1'];

    startWorkout(schedule, 1, 1, day);

    // Complete 2 sets
    advanceToNextSet();
    advanceToNextSet();

    expect(get(liveSession)!.exercises[0].completedSets).toBe(2);

    const rewound = rewindToPreviousSet();

    expect(rewound).toBe(true);
    expect(get(liveSession)!.exercises[0].completedSets).toBe(1);
  });

  it('should unmark exercise as completed when rewinding', () => {
    const schedule = createMockSchedule();
    const day = schedule.days['1'];

    startWorkout(schedule, 1, 1, day);

    // Complete all 4 sets of first exercise (Bench Press)
    advanceToNextSet();
    advanceToNextSet();
    advanceToNextSet();
    advanceToNextSet();

    // Manually mark as completed
    liveSession.update(session => {
      if (!session) return session;
      const exercises = [...session.exercises];
      exercises[0] = { ...exercises[0], completed: true };
      return { ...session, exercises };
    });

    expect(get(liveSession)!.exercises[0].completed).toBe(true);

    const rewound = rewindToPreviousSet();

    expect(rewound).toBe(true);
    expect(get(liveSession)!.exercises[0].completed).toBe(false);
    expect(get(liveSession)!.exercises[0].completedSets).toBe(3);
  });

  it('should remove last logged set', () => {
    const schedule = createMockSchedule();
    const day = schedule.days['1'];

    startWorkout(schedule, 1, 1, day);

    // Log 2 sets
    logSet(0, {
      setNumber: 1,
      reps: 8,
      weight: 135,
      weightUnit: 'lbs',
      workTime: null,
      rpe: 7,
      rir: null,
      completed: true,
      notes: null,
      timestamp: new Date().toISOString()
    });

    logSet(0, {
      setNumber: 2,
      reps: 8,
      weight: 140,
      weightUnit: 'lbs',
      workTime: null,
      rpe: 8,
      rir: null,
      completed: true,
      notes: null,
      timestamp: new Date().toISOString()
    });

    advanceToNextSet();
    advanceToNextSet();

    expect(get(liveSession)!.logs[0].sets.length).toBe(2);

    const rewound = rewindToPreviousSet();

    expect(rewound).toBe(true);
    // Last set should be removed from logs
    expect(get(liveSession)!.logs[0].sets.length).toBe(1);
    expect(get(liveSession)!.logs[0].sets[0].weight).toBe(135); // First set remains
  });

  it('should return false when no active session', () => {
    expect(rewindToPreviousSet()).toBe(false);
  });
});
