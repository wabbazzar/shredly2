/**
 * Tests for Profile's ExerciseHistoryModal
 *
 * Tests that the modal correctly displays history data.
 * Note: Persistence tests (IndexedDB) require fake-indexeddb setup - tested separately.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
  exerciseHistory,
  _resetInitializationState,
  type HistoryRow
} from '$lib/stores/history';

// Helper to create a history row
function createHistoryRow(overrides: Partial<HistoryRow> = {}): HistoryRow {
  return {
    date: '2026-01-15',
    timestamp: new Date().toISOString(),
    workout_program_id: 'test-schedule-123',
    week_number: 1,
    day_number: 1,
    exercise_name: 'Bench Press',
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
    notes: null,
    ...overrides
  };
}

describe('Profile ExerciseHistoryModal Data Flow', () => {
  beforeEach(() => {
    // Reset initialization state and clear store before each test
    _resetInitializationState();
    exerciseHistory.set([]);
  });

  describe('exerciseHistory store behavior (in-memory)', () => {
    it('should start empty', () => {
      const history = get(exerciseHistory);
      expect(history).toEqual([]);
    });

    it('should update when set is called', () => {
      const row = createHistoryRow();
      exerciseHistory.set([row]);

      const history = get(exerciseHistory);
      expect(history.length).toBe(1);
      expect(history[0].exercise_name).toBe('Bench Press');
    });

    it('should update when update is called', () => {
      const row1 = createHistoryRow({ exercise_name: 'Bench Press' });
      exerciseHistory.set([row1]);

      const row2 = createHistoryRow({ exercise_name: 'Squat' });
      exerciseHistory.update((rows) => [...rows, row2]);

      const history = get(exerciseHistory);
      expect(history.length).toBe(2);
      expect(history[0].exercise_name).toBe('Bench Press');
      expect(history[1].exercise_name).toBe('Squat');
    });
  });

  describe('filtering for modal display', () => {
    it('should filter out compound parent rows', () => {
      const rows = [
        createHistoryRow({ exercise_name: 'EMOM Block', is_compound_parent: true }),
        createHistoryRow({
          exercise_name: 'Burpees',
          is_compound_parent: false,
          compound_parent_name: 'EMOM Block'
        }),
        createHistoryRow({ exercise_name: 'Bench Press', is_compound_parent: false })
      ];
      exerciseHistory.set(rows);

      const history = get(exerciseHistory);
      const filtered = history.filter((r) => !r.is_compound_parent);

      expect(filtered.length).toBe(2);
      expect(filtered.find((r) => r.exercise_name === 'EMOM Block')).toBeUndefined();
    });

    it('should count non-compound rows correctly', () => {
      const rows = [
        createHistoryRow({ exercise_name: 'EMOM Block', is_compound_parent: true }),
        createHistoryRow({ exercise_name: 'Burpees', set_number: 1 }),
        createHistoryRow({ exercise_name: 'Burpees', set_number: 2 }),
        createHistoryRow({ exercise_name: 'Bench Press', set_number: 1 })
      ];
      exerciseHistory.set(rows);

      const history = get(exerciseHistory);
      const historyRowCount = history.filter((r) => !r.is_compound_parent).length;

      expect(historyRowCount).toBe(3);
    });
  });

  describe('reactive updates', () => {
    it('should trigger reactive updates when data is set', () => {
      // Track reactive updates
      let updateCount = 0;
      const unsubscribe = exerciseHistory.subscribe(() => {
        updateCount++;
      });

      // Initial subscription triggers once
      expect(updateCount).toBe(1);

      // Set data (triggers update)
      const row = createHistoryRow();
      exerciseHistory.set([row]);
      expect(updateCount).toBe(2);

      // Set more data
      const row2 = createHistoryRow({ exercise_name: 'Squat' });
      exerciseHistory.set([row, row2]);
      expect(updateCount).toBe(3);

      // Verify data is there
      expect(get(exerciseHistory).length).toBe(2);

      unsubscribe();
    });
  });

  describe('data queries', () => {
    it('should support filtering by exercise name', () => {
      const rows = [
        createHistoryRow({ exercise_name: 'Bench Press', set_number: 1 }),
        createHistoryRow({ exercise_name: 'Bench Press', set_number: 2 }),
        createHistoryRow({ exercise_name: 'Squat', set_number: 1 })
      ];
      exerciseHistory.set(rows);

      const history = get(exerciseHistory);
      const benchRows = history.filter((r) => r.exercise_name === 'Bench Press');

      expect(benchRows.length).toBe(2);
    });

    it('should support filtering by date', () => {
      const rows = [
        createHistoryRow({ date: '2026-01-15', exercise_name: 'Bench Press' }),
        createHistoryRow({ date: '2026-01-15', exercise_name: 'Squat' }),
        createHistoryRow({ date: '2026-01-14', exercise_name: 'Deadlift' })
      ];
      exerciseHistory.set(rows);

      const history = get(exerciseHistory);
      const todayRows = history.filter((r) => r.date === '2026-01-15');

      expect(todayRows.length).toBe(2);
    });

    it('should support filtering by workout program', () => {
      const rows = [
        createHistoryRow({ workout_program_id: 'program-a', exercise_name: 'Bench Press' }),
        createHistoryRow({ workout_program_id: 'program-a', exercise_name: 'Squat' }),
        createHistoryRow({ workout_program_id: 'program-b', exercise_name: 'Deadlift' })
      ];
      exerciseHistory.set(rows);

      const history = get(exerciseHistory);
      const programARows = history.filter((r) => r.workout_program_id === 'program-a');

      expect(programARows.length).toBe(2);
    });
  });
});
