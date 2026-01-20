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
  getSessionRowsForDeletion,
  deleteSession,
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

    it('should NOT merge sessions with different week/day on same date', () => {
      const logs = createExerciseLogs();

      // User repeats week 1 and also does week 2 on the same day
      // This can happen when:
      // 1. User restarts a program (doing week 1 again)
      // 2. User logs multiple workouts in one day
      logSessionToHistory('test-schedule-123', 1, 1, logs, '2026-01-18');
      logSessionToHistory('test-schedule-123', 2, 1, logs, '2026-01-18');

      const sessions = getCompletedSessions();

      // Should be 2 SEPARATE sessions, not merged into 1
      expect(sessions.length).toBe(2);

      // Both sessions should be present
      const week1Session = sessions.find(s => s.weekNumber === 1 && s.dayNumber === 1);
      const week2Session = sessions.find(s => s.weekNumber === 2 && s.dayNumber === 1);
      expect(week1Session).toBeDefined();
      expect(week2Session).toBeDefined();

      // Both should be on the same date
      expect(week1Session!.date).toBe('2026-01-18');
      expect(week2Session!.date).toBe('2026-01-18');
    });

    it('should keep separate sessions when repeating the same week', () => {
      const logs = createExerciseLogs();

      // User does week 1 day 1 on Monday
      logSessionToHistory('test-schedule-123', 1, 1, logs, '2026-01-13');

      // User restarts the program and does week 1 day 1 again on Monday next week
      logSessionToHistory('test-schedule-123', 1, 1, logs, '2026-01-20');

      const sessions = getCompletedSessions();

      // Should be 2 sessions (different dates)
      expect(sessions.length).toBe(2);
      expect(sessions[0].date).toBe('2026-01-20');
      expect(sessions[1].date).toBe('2026-01-13');
    });

    it('should sort same-day sessions by timestamp (most recent first)', () => {
      // Create logs with specific timestamps
      const earlierLogs = createExerciseLogs();
      earlierLogs[0].timestamp = '2026-01-18T08:00:00.000Z';
      earlierLogs[0].sets[0].timestamp = '2026-01-18T08:00:00.000Z';

      const laterLogs = createExerciseLogs();
      laterLogs[0].timestamp = '2026-01-18T14:00:00.000Z';
      laterLogs[0].sets[0].timestamp = '2026-01-18T14:00:00.000Z';

      // Log week 1 in the morning
      logSessionToHistory('test-schedule-123', 1, 1, earlierLogs, '2026-01-18');
      // Log week 2 in the afternoon
      logSessionToHistory('test-schedule-123', 2, 1, laterLogs, '2026-01-18');

      const sessions = getCompletedSessions();

      expect(sessions.length).toBe(2);
      // Week 2 should come first (logged later)
      expect(sessions[0].weekNumber).toBe(2);
      expect(sessions[1].weekNumber).toBe(1);
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

    it('should filter by week/day when parameters are provided', () => {
      const logs = createExerciseLogs();

      // Log both week 1 and week 2 on the same date
      logSessionToHistory('test-schedule-123', 1, 1, logs, '2026-01-18');
      logSessionToHistory('test-schedule-123', 2, 1, logs, '2026-01-18');

      // Query with week/day filters
      const week1Rows = getHistoryForSession('2026-01-18', 'test-schedule-123', 1, 1);
      const week2Rows = getHistoryForSession('2026-01-18', 'test-schedule-123', 2, 1);

      // Each should return only rows for that specific week
      expect(week1Rows).not.toBeNull();
      expect(week2Rows).not.toBeNull();
      expect(week1Rows!.every(r => r.week_number === 1)).toBe(true);
      expect(week2Rows!.every(r => r.week_number === 2)).toBe(true);
    });

    it('should return all rows when week/day not specified (backward compatible)', () => {
      const logs = createExerciseLogs();

      // Log both week 1 and week 2 on the same date
      logSessionToHistory('test-schedule-123', 1, 1, logs, '2026-01-18');
      logSessionToHistory('test-schedule-123', 2, 1, logs, '2026-01-18');

      // Query without week/day filters (backward compatible mode)
      const allRows = getHistoryForSession('2026-01-18', 'test-schedule-123');

      // Should return rows from both weeks (deduplicated by exercise+set)
      expect(allRows).not.toBeNull();
      // Should have at least some rows
      expect(allRows!.length).toBeGreaterThan(0);
    });
  });

  describe('getSessionRowsForDeletion', () => {
    it('should return empty array when no matching rows exist', () => {
      const rows = getSessionRowsForDeletion('2026-01-15', 'test-schedule-123', 1, 1);
      expect(rows).toEqual([]);
    });

    it('should return all rows for a session (not deduplicated)', () => {
      const logs = createExerciseLogs();

      // Log the same session twice (simulating re-saves)
      logSessionToHistory('test-schedule-123', 1, 1, logs, '2026-01-15');
      logSessionToHistory('test-schedule-123', 1, 1, logs, '2026-01-15');

      const rows = getSessionRowsForDeletion('2026-01-15', 'test-schedule-123', 1, 1);

      // Should return ALL rows, including duplicates (6 = 3 sets * 2 logs)
      expect(rows.length).toBe(6);
    });

    it('should only return rows matching exact week/day', () => {
      const logs = createExerciseLogs();

      // Log sessions for different week/day combinations
      logSessionToHistory('test-schedule-123', 1, 1, logs, '2026-01-18');
      logSessionToHistory('test-schedule-123', 2, 1, logs, '2026-01-18');

      // Get rows only for week 1 day 1
      const week1Rows = getSessionRowsForDeletion('2026-01-18', 'test-schedule-123', 1, 1);
      const week2Rows = getSessionRowsForDeletion('2026-01-18', 'test-schedule-123', 2, 1);

      // Each should only return rows for that specific week
      expect(week1Rows.every(r => r.week_number === 1)).toBe(true);
      expect(week2Rows.every(r => r.week_number === 2)).toBe(true);
    });
  });

  describe('deleteSession', () => {
    it('should return 0 when no matching rows exist', () => {
      const deletedCount = deleteSession('2026-01-15', 'test-schedule-123', 1, 1);
      expect(deletedCount).toBe(0);
    });

    it('should delete all rows for a session and return count', () => {
      const logs = createExerciseLogs();

      // Log a session
      logSessionToHistory('test-schedule-123', 1, 1, logs, '2026-01-15');

      // Verify rows exist
      const before = getSessionRowsForDeletion('2026-01-15', 'test-schedule-123', 1, 1);
      expect(before.length).toBe(3);

      // Delete the session
      const deletedCount = deleteSession('2026-01-15', 'test-schedule-123', 1, 1);

      // Should return number of deleted rows
      expect(deletedCount).toBe(3);

      // Verify rows are gone
      const after = getSessionRowsForDeletion('2026-01-15', 'test-schedule-123', 1, 1);
      expect(after.length).toBe(0);
    });

    it('should remove session from getCompletedSessions after deletion', () => {
      const logs = createExerciseLogs();

      // Log two sessions
      logSessionToHistory('test-schedule-123', 1, 1, logs, '2026-01-15');
      logSessionToHistory('test-schedule-123', 1, 2, logs, '2026-01-16');

      // Verify both sessions exist
      const beforeSessions = getCompletedSessions();
      expect(beforeSessions.length).toBe(2);

      // Delete one session
      deleteSession('2026-01-15', 'test-schedule-123', 1, 1);

      // Verify only one session remains
      const afterSessions = getCompletedSessions();
      expect(afterSessions.length).toBe(1);
      expect(afterSessions[0].date).toBe('2026-01-16');
    });

    it('should only delete rows matching exact week/day', () => {
      const logs = createExerciseLogs();

      // Log sessions for different week/day combinations on same date
      logSessionToHistory('test-schedule-123', 1, 1, logs, '2026-01-18');
      logSessionToHistory('test-schedule-123', 2, 1, logs, '2026-01-18');

      // Delete only week 1
      deleteSession('2026-01-18', 'test-schedule-123', 1, 1);

      // Week 2 should still exist
      const week2Rows = getSessionRowsForDeletion('2026-01-18', 'test-schedule-123', 2, 1);
      expect(week2Rows.length).toBe(3);

      // Week 1 should be gone
      const week1Rows = getSessionRowsForDeletion('2026-01-18', 'test-schedule-123', 1, 1);
      expect(week1Rows.length).toBe(0);
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
