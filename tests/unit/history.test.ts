/**
 * History Store Unit Tests
 *
 * Tests for:
 * - CSV row generation (20 columns)
 * - Append operation
 * - PR calculation from history
 * - Compound exercise logging
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import {
  exerciseHistory,
  historyRowCount,
  exerciseNames,
  appendHistoryRow,
  appendHistoryRows,
  logSetToHistory,
  logSessionToHistory,
  getPersonalRecords,
  getExerciseStats,
  getLastPerformance,
  getTodaysHistoryForWorkout,
  hasLoggedTodaysWorkout,
  exportHistoryCsv,
  clearHistory,
  getStorageInfo,
  type HistoryRow
} from '../../src/lib/stores/history';
import type { ExerciseLog, SetLog } from '../../src/lib/engine/types';

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

  // Clear history for each test
  clearHistory();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ============================================================================
// TEST FIXTURES
// ============================================================================

function createMockHistoryRow(overrides: Partial<HistoryRow> = {}): HistoryRow {
  return {
    date: '2026-01-11',
    timestamp: '2026-01-11T10:30:00.000Z',
    workout_program_id: 'test-program-123',
    week_number: 1,
    day_number: 1,
    exercise_name: 'Bench Press',
    exercise_order: 0,
    is_compound_parent: false,
    compound_parent_name: null,
    set_number: 1,
    reps: 8,
    weight: 135,
    weight_unit: 'lbs',
    work_time: null,
    rest_time: 90,
    tempo: '3-1-2',
    rpe: 7,
    rir: 3,
    completed: true,
    notes: null,
    ...overrides
  };
}

function createMockSetLog(overrides: Partial<SetLog> = {}): SetLog {
  return {
    setNumber: 1,
    reps: 8,
    weight: 135,
    weightUnit: 'lbs',
    workTime: null,
    rpe: 7,
    rir: 3,
    completed: true,
    notes: null,
    timestamp: '2026-01-11T10:30:00.000Z',
    ...overrides
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('History Store', () => {
  describe('initial state', () => {
    it('should start empty', () => {
      expect(get(historyRowCount)).toBe(0);
      expect(get(exerciseHistory)).toEqual([]);
    });
  });

  describe('appendHistoryRow', () => {
    it('should add a single row', () => {
      const row = createMockHistoryRow();
      appendHistoryRow(row);

      expect(get(historyRowCount)).toBe(1);
      expect(get(exerciseHistory)[0]).toEqual(row);
    });

    it('should preserve all 20 columns', () => {
      const row = createMockHistoryRow();
      appendHistoryRow(row);

      const stored = get(exerciseHistory)[0];
      expect(stored.date).toBe('2026-01-11');
      expect(stored.timestamp).toBe('2026-01-11T10:30:00.000Z');
      expect(stored.workout_program_id).toBe('test-program-123');
      expect(stored.week_number).toBe(1);
      expect(stored.day_number).toBe(1);
      expect(stored.exercise_name).toBe('Bench Press');
      expect(stored.exercise_order).toBe(0);
      expect(stored.is_compound_parent).toBe(false);
      expect(stored.compound_parent_name).toBe(null);
      expect(stored.set_number).toBe(1);
      expect(stored.reps).toBe(8);
      expect(stored.weight).toBe(135);
      expect(stored.weight_unit).toBe('lbs');
      expect(stored.work_time).toBe(null);
      expect(stored.rest_time).toBe(90);
      expect(stored.tempo).toBe('3-1-2');
      expect(stored.rpe).toBe(7);
      expect(stored.rir).toBe(3);
      expect(stored.completed).toBe(true);
      expect(stored.notes).toBe(null);
    });
  });

  describe('appendHistoryRows', () => {
    it('should add multiple rows at once', () => {
      const rows = [
        createMockHistoryRow({ set_number: 1 }),
        createMockHistoryRow({ set_number: 2 }),
        createMockHistoryRow({ set_number: 3 })
      ];

      appendHistoryRows(rows);

      expect(get(historyRowCount)).toBe(3);
    });
  });

  describe('logSetToHistory', () => {
    it('should create history row from set log', () => {
      const setLog = createMockSetLog();

      logSetToHistory(
        'test-program-123',
        1,
        1,
        'Bench Press',
        0,
        setLog
      );

      expect(get(historyRowCount)).toBe(1);
      const row = get(exerciseHistory)[0];
      expect(row.exercise_name).toBe('Bench Press');
      expect(row.reps).toBe(8);
      expect(row.weight).toBe(135);
    });

    it('should handle compound parent logging', () => {
      const setLog = createMockSetLog();

      logSetToHistory(
        'test-program-123',
        1,
        1,
        'Pull-ups',
        2,
        setLog,
        {
          isCompoundParent: false,
          compoundParentName: 'EMOM Block'
        }
      );

      const row = get(exerciseHistory)[0];
      expect(row.is_compound_parent).toBe(false);
      expect(row.compound_parent_name).toBe('EMOM Block');
    });
  });

  describe('logSessionToHistory', () => {
    it('should log exercise logs from session', () => {
      const logs: ExerciseLog[] = [
        {
          exerciseName: 'Bench Press',
          exerciseOrder: 0,
          isCompoundParent: false,
          compoundParentName: null,
          sets: [
            createMockSetLog({ setNumber: 1 }),
            createMockSetLog({ setNumber: 2 }),
            createMockSetLog({ setNumber: 3 })
          ],
          timestamp: '2026-01-11T10:30:00.000Z'
        }
      ];

      logSessionToHistory('test-program-123', 1, 1, logs);

      expect(get(historyRowCount)).toBe(3);
    });

    it('should log compound parent row', () => {
      const logs: ExerciseLog[] = [
        {
          exerciseName: 'EMOM Block',
          exerciseOrder: 2,
          isCompoundParent: true,
          compoundParentName: null,
          sets: [],
          totalTime: 600,
          totalRounds: 5,
          timestamp: '2026-01-11T10:30:00.000Z'
        }
      ];

      logSessionToHistory('test-program-123', 1, 1, logs);

      const rows = get(exerciseHistory);
      expect(rows.length).toBe(1);
      expect(rows[0].is_compound_parent).toBe(true);
      expect(rows[0].work_time).toBe(600);
      expect(rows[0].notes).toBe('5 rounds');
    });
  });

  describe('getPersonalRecords', () => {
    it('should calculate max weight', () => {
      appendHistoryRows([
        createMockHistoryRow({ weight: 135, date: '2026-01-01' }),
        createMockHistoryRow({ weight: 145, date: '2026-01-05' }),
        createMockHistoryRow({ weight: 155, date: '2026-01-10' }),
        createMockHistoryRow({ weight: 140, date: '2026-01-11' })
      ]);

      const pr = getPersonalRecords('Bench Press');

      expect(pr.maxWeight).toBe(155);
      expect(pr.maxWeightDate).toBe('2026-01-10');
    });

    it('should calculate max reps', () => {
      appendHistoryRows([
        createMockHistoryRow({ reps: 8, date: '2026-01-01' }),
        createMockHistoryRow({ reps: 10, date: '2026-01-05' }),
        createMockHistoryRow({ reps: 12, date: '2026-01-10' }),
        createMockHistoryRow({ reps: 8, date: '2026-01-11' })
      ]);

      const pr = getPersonalRecords('Bench Press');

      expect(pr.maxReps).toBe(12);
      expect(pr.maxRepsDate).toBe('2026-01-10');
    });

    it('should calculate max volume', () => {
      appendHistoryRows([
        createMockHistoryRow({ weight: 100, reps: 10 }), // 1000
        createMockHistoryRow({ weight: 150, reps: 8 }),  // 1200
        createMockHistoryRow({ weight: 135, reps: 10 }) // 1350
      ]);

      const pr = getPersonalRecords('Bench Press');

      expect(pr.maxVolume).toBe(1350);
    });

    it('should return empty PRs for unknown exercise', () => {
      const pr = getPersonalRecords('Unknown Exercise');

      expect(pr.maxWeight).toBe(null);
      expect(pr.maxReps).toBe(null);
      expect(pr.maxVolume).toBe(null);
    });

    it('should ignore compound parent rows', () => {
      appendHistoryRows([
        createMockHistoryRow({ weight: 135, is_compound_parent: false }),
        createMockHistoryRow({ weight: null, is_compound_parent: true })
      ]);

      const pr = getPersonalRecords('Bench Press');

      expect(pr.maxWeight).toBe(135);
    });
  });

  describe('getExerciseStats', () => {
    it('should calculate total sets', () => {
      appendHistoryRows([
        createMockHistoryRow({ set_number: 1 }),
        createMockHistoryRow({ set_number: 2 }),
        createMockHistoryRow({ set_number: 3 }),
        createMockHistoryRow({ set_number: 4 })
      ]);

      const stats = getExerciseStats('Bench Press');

      expect(stats.totalSets).toBe(4);
    });

    it('should calculate total reps', () => {
      appendHistoryRows([
        createMockHistoryRow({ reps: 8 }),
        createMockHistoryRow({ reps: 8 }),
        createMockHistoryRow({ reps: 7 }),
        createMockHistoryRow({ reps: 6 })
      ]);

      const stats = getExerciseStats('Bench Press');

      expect(stats.totalReps).toBe(29);
    });

    it('should calculate average weight', () => {
      appendHistoryRows([
        createMockHistoryRow({ weight: 100 }),
        createMockHistoryRow({ weight: 120 }),
        createMockHistoryRow({ weight: 140 })
      ]);

      const stats = getExerciseStats('Bench Press');

      expect(stats.avgWeight).toBe(120);
    });

    it('should count unique sessions', () => {
      appendHistoryRows([
        createMockHistoryRow({ date: '2026-01-01', workout_program_id: 'prog-1' }),
        createMockHistoryRow({ date: '2026-01-01', workout_program_id: 'prog-1' }),
        createMockHistoryRow({ date: '2026-01-03', workout_program_id: 'prog-1' }),
        createMockHistoryRow({ date: '2026-01-05', workout_program_id: 'prog-1' })
      ]);

      const stats = getExerciseStats('Bench Press');

      expect(stats.sessionCount).toBe(3);
    });

    it('should track last performed date', () => {
      appendHistoryRows([
        createMockHistoryRow({ date: '2026-01-01' }),
        createMockHistoryRow({ date: '2026-01-05' }),
        createMockHistoryRow({ date: '2026-01-03' })
      ]);

      const stats = getExerciseStats('Bench Press');

      expect(stats.lastPerformed).toBe('2026-01-05');
    });
  });

  describe('getLastPerformance', () => {
    it('should return most recent row', () => {
      appendHistoryRows([
        createMockHistoryRow({ timestamp: '2026-01-01T10:00:00.000Z', weight: 100 }),
        createMockHistoryRow({ timestamp: '2026-01-05T10:00:00.000Z', weight: 130 }),
        createMockHistoryRow({ timestamp: '2026-01-03T10:00:00.000Z', weight: 120 })
      ]);

      const last = getLastPerformance('Bench Press');

      expect(last).not.toBe(null);
      expect(last?.weight).toBe(130);
    });

    it('should return null for no history', () => {
      const last = getLastPerformance('Unknown Exercise');

      expect(last).toBe(null);
    });
  });

  describe('exportHistoryCsv', () => {
    it('should include CSV header', () => {
      appendHistoryRow(createMockHistoryRow());

      const csv = exportHistoryCsv();
      const lines = csv.split('\n');

      expect(lines[0]).toContain('date,timestamp,workout_program_id');
    });

    it('should export all rows', () => {
      appendHistoryRows([
        createMockHistoryRow({ set_number: 1 }),
        createMockHistoryRow({ set_number: 2 }),
        createMockHistoryRow({ set_number: 3 })
      ]);

      const csv = exportHistoryCsv();
      const lines = csv.split('\n');

      expect(lines.length).toBe(4); // 1 header + 3 data rows
    });

    it('should escape commas and quotes in values', () => {
      appendHistoryRow(createMockHistoryRow({
        notes: 'Test, with "quotes" and commas'
      }));

      const csv = exportHistoryCsv();

      expect(csv).toContain('"Test, with ""quotes"" and commas"');
    });
  });

  describe('derived stores', () => {
    it('should track unique exercise names', () => {
      appendHistoryRows([
        createMockHistoryRow({ exercise_name: 'Bench Press' }),
        createMockHistoryRow({ exercise_name: 'Pull-ups' }),
        createMockHistoryRow({ exercise_name: 'Bench Press' }),
        createMockHistoryRow({ exercise_name: 'Squats' })
      ]);

      const names = get(exerciseNames);

      expect(names).toContain('Bench Press');
      expect(names).toContain('Pull-ups');
      expect(names).toContain('Squats');
      expect(names.length).toBe(3);
    });

    it('should exclude compound parent names from exercise list', () => {
      appendHistoryRows([
        createMockHistoryRow({ exercise_name: 'EMOM Block', is_compound_parent: true }),
        createMockHistoryRow({ exercise_name: 'Pull-ups', is_compound_parent: false })
      ]);

      const names = get(exerciseNames);

      expect(names).not.toContain('EMOM Block');
      expect(names).toContain('Pull-ups');
    });
  });

  describe('getStorageInfo', () => {
    it('should return row count and estimated size', () => {
      appendHistoryRows([
        createMockHistoryRow(),
        createMockHistoryRow(),
        createMockHistoryRow()
      ]);

      const info = getStorageInfo();

      expect(info.rowCount).toBe(3);
      expect(info.estimatedSize).toBeGreaterThan(0);
    });
  });

  describe('persistence', () => {
    it('should save to localStorage', () => {
      appendHistoryRow(createMockHistoryRow());

      expect(mockStorage['shredly_exercise_history_v2']).toBeDefined();
    });

    it('should contain CSV data in localStorage', () => {
      appendHistoryRow(createMockHistoryRow({ exercise_name: 'Test Exercise' }));

      const stored = mockStorage['shredly_exercise_history_v2'];
      expect(stored).toContain('Test Exercise');
    });
  });

  describe('getTodaysHistoryForWorkout', () => {
    it('should return null when no history exists', () => {
      const result = getTodaysHistoryForWorkout('test-program', 1, 1);
      expect(result).toBe(null);
    });

    it('should return rows for today\'s workout', () => {
      const today = new Date().toISOString().split('T')[0];
      appendHistoryRows([
        createMockHistoryRow({
          date: today,
          workout_program_id: 'test-program',
          week_number: 1,
          day_number: 1,
          exercise_name: 'Bench Press',
          set_number: 1
        }),
        createMockHistoryRow({
          date: today,
          workout_program_id: 'test-program',
          week_number: 1,
          day_number: 1,
          exercise_name: 'Bench Press',
          set_number: 2
        })
      ]);

      const result = getTodaysHistoryForWorkout('test-program', 1, 1);

      expect(result).not.toBe(null);
      expect(result?.length).toBe(2);
    });

    it('should exclude rows from different dates', () => {
      const today = new Date().toISOString().split('T')[0];
      appendHistoryRows([
        createMockHistoryRow({
          date: today,
          workout_program_id: 'test-program',
          week_number: 1,
          day_number: 1
        }),
        createMockHistoryRow({
          date: '2020-01-01', // Different date
          workout_program_id: 'test-program',
          week_number: 1,
          day_number: 1
        })
      ]);

      const result = getTodaysHistoryForWorkout('test-program', 1, 1);

      expect(result?.length).toBe(1);
    });

    it('should exclude rows from different programs', () => {
      const today = new Date().toISOString().split('T')[0];
      appendHistoryRows([
        createMockHistoryRow({
          date: today,
          workout_program_id: 'test-program',
          week_number: 1,
          day_number: 1
        }),
        createMockHistoryRow({
          date: today,
          workout_program_id: 'other-program', // Different program
          week_number: 1,
          day_number: 1
        })
      ]);

      const result = getTodaysHistoryForWorkout('test-program', 1, 1);

      expect(result?.length).toBe(1);
    });

    it('should deduplicate by keeping latest timestamp', () => {
      const today = new Date().toISOString().split('T')[0];
      appendHistoryRows([
        createMockHistoryRow({
          date: today,
          timestamp: `${today}T10:00:00.000Z`,
          workout_program_id: 'test-program',
          week_number: 1,
          day_number: 1,
          exercise_name: 'Bench Press',
          set_number: 1,
          weight: 100
        }),
        createMockHistoryRow({
          date: today,
          timestamp: `${today}T12:00:00.000Z`, // Later timestamp
          workout_program_id: 'test-program',
          week_number: 1,
          day_number: 1,
          exercise_name: 'Bench Press',
          set_number: 1,
          weight: 135 // Updated weight
        })
      ]);

      const result = getTodaysHistoryForWorkout('test-program', 1, 1);

      expect(result?.length).toBe(1);
      expect(result?.[0].weight).toBe(135); // Should have latest weight
    });
  });

  describe('hasLoggedTodaysWorkout', () => {
    it('should return false when no history exists', () => {
      const result = hasLoggedTodaysWorkout('test-program', 1, 1);
      expect(result).toBe(false);
    });

    it('should return true when history exists for today', () => {
      const today = new Date().toISOString().split('T')[0];
      appendHistoryRow(createMockHistoryRow({
        date: today,
        workout_program_id: 'test-program',
        week_number: 1,
        day_number: 1
      }));

      const result = hasLoggedTodaysWorkout('test-program', 1, 1);
      expect(result).toBe(true);
    });

    it('should return false for different week/day', () => {
      const today = new Date().toISOString().split('T')[0];
      appendHistoryRow(createMockHistoryRow({
        date: today,
        workout_program_id: 'test-program',
        week_number: 1,
        day_number: 1
      }));

      const result = hasLoggedTodaysWorkout('test-program', 2, 3);
      expect(result).toBe(false);
    });
  });
});
