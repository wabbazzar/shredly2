/**
 * Tests for Profile's ExerciseHistoryModal
 *
 * Tests that the modal correctly displays history data
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { exerciseHistory, hydrateHistory, _resetHydrationState, type HistoryRow } from '$lib/stores/history';

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
    // Reset hydration state and clear localStorage before each test
    _resetHydrationState();
    localStorageMock.clear();
    // Note: Don't call exerciseHistory.set([]) here as it triggers hydration
  });

  describe('exerciseHistory store behavior', () => {
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

    it('should persist to localStorage when updated', () => {
      const row = createHistoryRow();
      exerciseHistory.set([row]);

      // Check localStorage
      const csv = localStorageMock.getItem('shredly_exercise_history_v2');
      expect(csv).not.toBeNull();
      expect(csv).toContain('Bench Press');
    });

    it('should hydrate from localStorage correctly', () => {
      // First, set some data (which persists to localStorage)
      const row = createHistoryRow();
      exerciseHistory.set([row]);

      // Verify data is saved
      expect(localStorageMock.getItem('shredly_exercise_history_v2')).toContain('Bench Press');

      // Reset hydration state (simulating page reload)
      _resetHydrationState();

      // The next subscription/access should trigger hydration from localStorage
      const history = get(exerciseHistory);
      expect(history.length).toBe(1);
      expect(history[0].exercise_name).toBe('Bench Press');
    });
  });

  describe('filtering for modal display', () => {
    it('should filter out compound parent rows', () => {
      const rows = [
        createHistoryRow({ exercise_name: 'EMOM Block', is_compound_parent: true }),
        createHistoryRow({ exercise_name: 'Burpees', is_compound_parent: false, compound_parent_name: 'EMOM Block' }),
        createHistoryRow({ exercise_name: 'Bench Press', is_compound_parent: false })
      ];
      exerciseHistory.set(rows);

      const history = get(exerciseHistory);
      const filtered = history.filter(r => !r.is_compound_parent);

      expect(filtered.length).toBe(2);
      expect(filtered.find(r => r.exercise_name === 'EMOM Block')).toBeUndefined();
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
      const historyRowCount = history.filter(r => !r.is_compound_parent).length;

      expect(historyRowCount).toBe(3);
    });
  });

  describe('hydration timing', () => {
    it('should self-hydrate on first subscription', () => {
      // Simulate existing data in localStorage (from previous session)
      const row = createHistoryRow();

      // Manually write to localStorage to simulate pre-existing data
      const header = 'date,timestamp,workout_program_id,week_number,day_number,exercise_name,exercise_order,is_compound_parent,compound_parent_name,set_number,reps,weight,weight_unit,work_time,rest_time,tempo,rpe,rir,completed,notes';
      const rowCsv = `${row.date},${row.timestamp},${row.workout_program_id},${row.week_number},${row.day_number},${row.exercise_name},${row.exercise_order},${row.is_compound_parent},${row.compound_parent_name ?? ''},${row.set_number},${row.reps ?? ''},${row.weight ?? ''},${row.weight_unit ?? ''},${row.work_time ?? ''},${row.rest_time ?? ''},${row.tempo ?? ''},${row.rpe ?? ''},${row.rir ?? ''},${row.completed},${row.notes ?? ''}`;
      localStorageMock.setItem('shredly_exercise_history_v2', `${header}\n${rowCsv}`);

      // First subscription should trigger hydration
      const history = get(exerciseHistory);
      expect(history.length).toBe(1);
      expect(history[0].exercise_name).toBe('Bench Press');
    });

    it('should trigger reactive updates when data is set', () => {
      // Track reactive updates
      let updateCount = 0;
      const unsubscribe = exerciseHistory.subscribe(() => {
        updateCount++;
      });

      // Initial subscription triggers once (with hydration)
      expect(updateCount).toBe(1);

      // Set data (triggers update + saves to localStorage)
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

    it('should preserve data across simulated page reloads', () => {
      // Set some data
      const row = createHistoryRow();
      exerciseHistory.set([row]);

      // Verify it's in localStorage
      expect(localStorageMock.getItem('shredly_exercise_history_v2')).toContain('Bench Press');

      // Simulate page reload by resetting hydration state
      _resetHydrationState();

      // Access store again (should hydrate from localStorage)
      const history = get(exerciseHistory);
      expect(history.length).toBe(1);
      expect(history[0].exercise_name).toBe('Bench Press');
    });
  });
});
