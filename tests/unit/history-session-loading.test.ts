/**
 * Tests for history session loading flow
 *
 * Tests the full flow of:
 * 1. Logging a workout session to history
 * 2. Retrieving sessions via getCompletedSessions()
 * 3. Getting history rows via getHistoryForSession()
 * 4. Loading historical sessions via loadHistoricalSession()
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import {
  exerciseHistory,
  logSessionToHistory,
  getCompletedSessions,
  getHistoryForSession,
  getTodaysHistoryForWorkout,
  type HistoryRow
} from '$lib/stores/history';
import {
  liveSession,
  loadHistoricalSession,
  reconstructSessionFromHistory
} from '$lib/stores/liveSession';
import type { StoredSchedule } from '$lib/types/schedule';
import type { ExerciseLog } from '$lib/engine/types';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

vi.stubGlobal('localStorage', localStorageMock);

// Helper to create a mock schedule
function createMockSchedule(daysPerWeek: number = 3): StoredSchedule {
  const days: Record<string, any> = {};
  for (let i = 1; i <= daysPerWeek; i++) {
    days[i.toString()] = {
      dayNumber: i,
      type: 'training',
      focus: i === 1 ? 'Push' : i === 2 ? 'Pull' : 'Legs',
      exercises: [
        { name: 'Exercise A', week1: { sets: 3, reps: 10 }, week2: { sets: 3, reps: 10 }, week3: { sets: 3, reps: 10 } },
        { name: 'Exercise B', week1: { sets: 3, reps: 10 }, week2: { sets: 3, reps: 10 }, week3: { sets: 3, reps: 10 } }
      ]
    };
  }

  return {
    id: 'test-schedule-123',
    name: 'Test Schedule',
    description: 'Test',
    version: '2.0.0',
    weeks: 3,
    daysPerWeek,
    metadata: {
      difficulty: 'Intermediate',
      equipment: ['barbell'],
      estimatedDuration: '45 min',
      tags: []
    },
    days,
    scheduleMetadata: {
      startDate: '2026-01-13',
      dayMapping: { '1': 0, '2': 2, '3': 4 } // Mon, Wed, Fri
    }
  } as StoredSchedule;
}

// Helper to create exercise logs
function createExerciseLogs(): ExerciseLog[] {
  return [
    {
      exerciseName: 'Exercise A',
      exerciseOrder: 0,
      isCompoundParent: false,
      compoundParentName: null,
      sets: [
        { setNumber: 1, reps: 10, weight: 135, weightUnit: 'lbs', workTime: null, rpe: 7, rir: 3, completed: true, notes: null, timestamp: new Date().toISOString() },
        { setNumber: 2, reps: 10, weight: 135, weightUnit: 'lbs', workTime: null, rpe: 8, rir: 2, completed: true, notes: null, timestamp: new Date().toISOString() }
      ],
      timestamp: new Date().toISOString()
    },
    {
      exerciseName: 'Exercise B',
      exerciseOrder: 1,
      isCompoundParent: false,
      compoundParentName: null,
      sets: [
        { setNumber: 1, reps: 8, weight: 100, weightUnit: 'lbs', workTime: null, rpe: 8, rir: 2, completed: true, notes: null, timestamp: new Date().toISOString() }
      ],
      timestamp: new Date().toISOString()
    }
  ];
}

describe('History Session Loading', () => {
  beforeEach(() => {
    // Clear stores and localStorage before each test
    exerciseHistory.set([]);
    liveSession.set(null);
    localStorageMock.clear();
  });

  describe('logSessionToHistory', () => {
    it('should log exercise logs to history with correct structure', () => {
      const logs = createExerciseLogs();

      logSessionToHistory('test-schedule-123', 1, 1, logs);

      const history = get(exerciseHistory);
      expect(history.length).toBe(3); // 2 sets from Exercise A + 1 set from Exercise B

      // Check first row structure
      const firstRow = history[0];
      expect(firstRow.workout_program_id).toBe('test-schedule-123');
      expect(firstRow.week_number).toBe(1);
      expect(firstRow.day_number).toBe(1);
      expect(firstRow.exercise_name).toBe('Exercise A');
      expect(firstRow.completed).toBe(true);
    });

    it('should use today\'s date by default', () => {
      const logs = createExerciseLogs();
      const today = new Date().toISOString().split('T')[0];

      logSessionToHistory('test-schedule-123', 1, 1, logs);

      const history = get(exerciseHistory);
      expect(history[0].date).toBe(today);
    });

    it('should use override date when provided', () => {
      const logs = createExerciseLogs();
      const overrideDate = '2026-01-15';

      logSessionToHistory('test-schedule-123', 1, 1, logs, overrideDate);

      const history = get(exerciseHistory);
      expect(history[0].date).toBe(overrideDate);
    });
  });

  describe('getCompletedSessions', () => {
    it('should return empty array when no history exists', () => {
      const sessions = getCompletedSessions();
      expect(sessions).toEqual([]);
    });

    it('should return sessions grouped by date and program', () => {
      const logs = createExerciseLogs();

      // Log a session
      logSessionToHistory('test-schedule-123', 1, 1, logs);

      const sessions = getCompletedSessions();

      expect(sessions.length).toBe(1);
      expect(sessions[0].workoutProgramId).toBe('test-schedule-123');
      expect(sessions[0].weekNumber).toBe(1);
      expect(sessions[0].dayNumber).toBe(1);
      expect(sessions[0].exerciseCount).toBe(2); // 2 unique exercises
      expect(sessions[0].completedSetCount).toBe(3); // 3 total sets
    });

    it('should return sessions sorted by date descending', () => {
      const logs = createExerciseLogs();

      // Log sessions on different dates
      logSessionToHistory('test-schedule-123', 1, 1, logs, '2026-01-15');
      logSessionToHistory('test-schedule-123', 1, 2, logs, '2026-01-17');
      logSessionToHistory('test-schedule-123', 1, 3, logs, '2026-01-16');

      const sessions = getCompletedSessions();

      expect(sessions.length).toBe(3);
      expect(sessions[0].date).toBe('2026-01-17'); // Most recent first
      expect(sessions[1].date).toBe('2026-01-16');
      expect(sessions[2].date).toBe('2026-01-15');
    });
  });

  describe('getHistoryForSession', () => {
    it('should return null when no history exists for date/program', () => {
      const rows = getHistoryForSession('2026-01-15', 'test-schedule-123');
      expect(rows).toBeNull();
    });

    it('should return history rows for a specific session', () => {
      const logs = createExerciseLogs();

      logSessionToHistory('test-schedule-123', 1, 1, logs, '2026-01-15');

      const rows = getHistoryForSession('2026-01-15', 'test-schedule-123');

      expect(rows).not.toBeNull();
      expect(rows!.length).toBe(3);
      expect(rows![0].date).toBe('2026-01-15');
      expect(rows![0].workout_program_id).toBe('test-schedule-123');
    });

    it('should deduplicate rows keeping latest timestamp', () => {
      const logs = createExerciseLogs();

      // Log the same session twice (simulating re-saves)
      logSessionToHistory('test-schedule-123', 1, 1, logs, '2026-01-15');

      // Wait a bit and log again
      const laterLogs = createExerciseLogs();
      laterLogs[0].sets[0].weight = 140; // Changed weight
      logSessionToHistory('test-schedule-123', 1, 1, laterLogs, '2026-01-15');

      const rows = getHistoryForSession('2026-01-15', 'test-schedule-123');

      // Should only return 3 rows (deduplicated), not 6
      expect(rows!.length).toBe(3);
    });
  });

  describe('reconstructSessionFromHistory', () => {
    it('should throw error when day not found in schedule', () => {
      const schedule = createMockSchedule(3);
      const historyRows: HistoryRow[] = [{
        date: '2026-01-15',
        timestamp: new Date().toISOString(),
        workout_program_id: 'test-schedule-123',
        week_number: 1,
        day_number: 99, // Invalid day number
        exercise_name: 'Exercise A',
        exercise_order: 0,
        is_compound_parent: false,
        compound_parent_name: null,
        set_number: 1,
        reps: 10,
        weight: 135,
        weight_unit: 'lbs',
        work_time: null,
        rest_time: null,
        tempo: null,
        rpe: 7,
        rir: 3,
        completed: true,
        notes: null
      }];

      expect(() => {
        reconstructSessionFromHistory(schedule, 1, 99, historyRows);
      }).toThrow('Day 99 not found in schedule');
    });

    it('should reconstruct session with valid day number', () => {
      const schedule = createMockSchedule(3);
      const historyRows: HistoryRow[] = [{
        date: '2026-01-15',
        timestamp: new Date().toISOString(),
        workout_program_id: 'test-schedule-123',
        week_number: 1,
        day_number: 1,
        exercise_name: 'Exercise A',
        exercise_order: 0,
        is_compound_parent: false,
        compound_parent_name: null,
        set_number: 1,
        reps: 10,
        weight: 135,
        weight_unit: 'lbs',
        work_time: null,
        rest_time: null,
        tempo: null,
        rpe: 7,
        rir: 3,
        completed: true,
        notes: null
      }];

      const session = reconstructSessionFromHistory(schedule, 1, 1, historyRows, '2026-01-15');

      expect(session).not.toBeNull();
      expect(session.scheduleId).toBe('test-schedule-123');
      expect(session.weekNumber).toBe(1);
      expect(session.dayNumber).toBe(1);
      expect(session.isComplete).toBe(true);
      expect(session.historicalDate).toBe('2026-01-15');
    });
  });

  describe('loadHistoricalSession', () => {
    it('should not throw when loading a valid session', () => {
      const schedule = createMockSchedule(3);
      const logs = createExerciseLogs();

      // Log a session
      logSessionToHistory('test-schedule-123', 1, 1, logs, '2026-01-15');

      // Get the history rows
      const historyRows = getHistoryForSession('2026-01-15', 'test-schedule-123');
      expect(historyRows).not.toBeNull();

      // This should NOT throw
      expect(() => {
        loadHistoricalSession(schedule, '2026-01-15', historyRows!);
      }).not.toThrow();

      // Check the session was loaded
      const session = get(liveSession);
      expect(session).not.toBeNull();
      expect(session!.historicalDate).toBe('2026-01-15');
    });

    it('should handle day_number larger than daysPerWeek by converting to per-week key', () => {
      const schedule = createMockSchedule(3);

      // Create history with day_number = 4 (which would be day 1 of week 2 in a 3-day program)
      const historyRows: HistoryRow[] = [{
        date: '2026-01-15',
        timestamp: new Date().toISOString(),
        workout_program_id: 'test-schedule-123',
        week_number: 2,
        day_number: 4, // Global day number, should map to day 1
        exercise_name: 'Exercise A',
        exercise_order: 0,
        is_compound_parent: false,
        compound_parent_name: null,
        set_number: 1,
        reps: 10,
        weight: 135,
        weight_unit: 'lbs',
        work_time: null,
        rest_time: null,
        tempo: null,
        rpe: 7,
        rir: 3,
        completed: true,
        notes: null
      }];

      // This should NOT throw - it should convert day 4 -> day 1
      expect(() => {
        loadHistoricalSession(schedule, '2026-01-15', historyRows);
      }).not.toThrow();

      const session = get(liveSession);
      expect(session).not.toBeNull();
    });

    it('should work with today\'s workout saved and loaded', () => {
      const schedule = createMockSchedule(3);
      const logs = createExerciseLogs();
      const today = new Date().toISOString().split('T')[0];

      // Log today's session with day 1
      logSessionToHistory('test-schedule-123', 1, 1, logs);

      // Get completed sessions
      const sessions = getCompletedSessions();
      expect(sessions.length).toBe(1);
      expect(sessions[0].date).toBe(today);

      // Get history for this session
      const historyRows = getHistoryForSession(today, 'test-schedule-123');
      expect(historyRows).not.toBeNull();
      expect(historyRows!.length).toBe(3);

      // Load the session - this is the critical path that's failing
      expect(() => {
        loadHistoricalSession(schedule, today, historyRows!);
      }).not.toThrow();

      const session = get(liveSession);
      expect(session).not.toBeNull();
      expect(session!.isComplete).toBe(true);
    });
  });

  describe('Full flow: save and reload workout', () => {
    it('should save a workout and reload it successfully', () => {
      const schedule = createMockSchedule(3);
      const logs = createExerciseLogs();
      const today = new Date().toISOString().split('T')[0];

      // Step 1: Save workout
      logSessionToHistory(schedule.id, 1, 1, logs);

      // Step 2: Get list of sessions
      const sessions = getCompletedSessions();
      expect(sessions.length).toBeGreaterThan(0);

      const targetSession = sessions.find(s => s.date === today && s.workoutProgramId === schedule.id);
      expect(targetSession).toBeDefined();

      // Step 3: Get history rows for the session
      const historyRows = getHistoryForSession(targetSession!.date, targetSession!.workoutProgramId);
      expect(historyRows).not.toBeNull();

      // Step 4: Load the historical session
      loadHistoricalSession(schedule, targetSession!.date, historyRows!);

      // Step 5: Verify session is loaded correctly
      const session = get(liveSession);
      expect(session).not.toBeNull();
      expect(session!.scheduleId).toBe(schedule.id);
      expect(session!.isComplete).toBe(true);
      expect(session!.logs.length).toBeGreaterThan(0);
    });
  });
});
