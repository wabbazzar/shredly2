/**
 * Exercise History Store - IndexedDB-backed workout history logging
 *
 * Stores workout history in IndexedDB for robust persistence.
 * Each history row is stored as a separate entry with UUID for atomic operations.
 *
 * Key design principles:
 * 1. IndexedDB as primary storage (like schedules)
 * 2. Explicit saves only - NO auto-save on store changes
 * 3. Append-only operations - never overwrite entire dataset
 * 4. Verification on load - detect potential data loss
 *
 * Migration: Automatically migrates from old localStorage format on first run.
 */

import { writable, derived, get } from 'svelte/store';
import type { ExerciseLog, SetLog } from '$lib/engine/types';
import {
  openHistoryDatabase,
  getAllRows,
  appendRows as dbAppendRows,
  deleteSessionRows as dbDeleteSessionRows,
  deleteExerciseRows as dbDeleteExerciseRows,
  updateSessionDate as dbUpdateSessionDate,
  migrateFromLocalStorage,
  saveBackupMetadata,
  verifyDataIntegrity,
  compactDatabase,
  clearAllRows
} from './historyDb';

// ============================================================================
// CONSTANTS
// ============================================================================

const isBrowser = typeof window !== 'undefined';

/**
 * Format date to YYYY-MM-DD in local timezone
 * Avoids toISOString() which converts to UTC
 */
export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// CSV column headers (for export only now)
const CSV_HEADERS = [
  'date',
  'timestamp',
  'workout_program_id',
  'week_number',
  'day_number',
  'exercise_name',
  'exercise_order',
  'is_compound_parent',
  'compound_parent_name',
  'set_number',
  'reps',
  'weight',
  'weight_unit',
  'work_time',
  'rest_time',
  'tempo',
  'rpe',
  'rir',
  'completed',
  'notes'
];

// ============================================================================
// TYPES
// ============================================================================

export interface HistoryRow {
  date: string;
  timestamp: string;
  workout_program_id: string;
  week_number: number;
  day_number: number;
  exercise_name: string;
  exercise_order: number;
  is_compound_parent: boolean;
  compound_parent_name: string | null;
  set_number: number;
  reps: number | null;
  weight: number | null;
  weight_unit: string | null;
  work_time: number | null;
  rest_time: number | null;
  tempo: string | null;
  rpe: number | null;
  rir: number | null;
  completed: boolean;
  notes: string | null;
}

export interface PersonalRecord {
  exerciseName: string;
  maxWeight: number | null;
  maxWeightUnit: string | null;
  maxWeightDate: string | null;
  maxReps: number | null;
  maxRepsDate: string | null;
  maxVolume: number | null;
  maxVolumeDate: string | null;
}

export interface ExerciseStats {
  totalSets: number;
  totalReps: number;
  totalVolume: number;
  avgWeight: number | null;
  avgReps: number | null;
  lastPerformed: string | null;
  sessionCount: number;
}

// ============================================================================
// STORE
// ============================================================================

/**
 * Track if we've initialized from IndexedDB
 */
let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

/**
 * Exercise history store
 * Initialized empty, populated from IndexedDB on client-side
 *
 * IMPORTANT: This store does NOT auto-save.
 * Use appendHistoryRows() or logSessionToHistory() to persist data.
 */
function createExerciseHistoryStore() {
  const { subscribe, set, update } = writable<HistoryRow[]>([]);

  return {
    subscribe,
    set,
    update,
    /**
     * Initialize the store from IndexedDB
     * Call this once at app startup
     */
    async initialize(): Promise<void> {
      if (!isBrowser) return;
      if (isInitialized) return;
      if (initializationPromise) return initializationPromise;

      initializationPromise = (async () => {
        try {
          // Open database
          await openHistoryDatabase();

          // Migrate from localStorage if needed
          const migration = await migrateFromLocalStorage();
          if (migration.migrated && migration.rowCount > 0) {
            console.log(`[History] ${migration.message}`);
          }

          // Compact database (remove old tombstones)
          await compactDatabase();

          // Load all rows
          const rows = await getAllRows();
          set(rows);

          // Verify data integrity
          const integrity = await verifyDataIntegrity();
          if (!integrity.intact) {
            console.warn(`[History] ${integrity.message}`);
          }

          // Update backup metadata
          if (rows.length > 0) {
            const latestTimestamp = rows.reduce(
              (latest, row) => (row.timestamp > latest ? row.timestamp : latest),
              rows[0].timestamp
            );
            saveBackupMetadata(rows.length, latestTimestamp);
          }

          isInitialized = true;
          console.log(`[History] Initialized with ${rows.length} rows from IndexedDB`);
        } catch (e) {
          console.error('[History] Failed to initialize:', e);
          // Store remains empty but don't crash
          isInitialized = true;
        } finally {
          initializationPromise = null;
        }
      })();

      return initializationPromise;
    }
  };
}

export const exerciseHistory = createExerciseHistoryStore();

/**
 * Initialize history from IndexedDB
 * Call this on client-side after SSR hydration
 */
export async function initializeHistory(): Promise<void> {
  return exerciseHistory.initialize();
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use initializeHistory() instead
 */
export function hydrateHistory(): void {
  // Start initialization but don't await (fire and forget for backward compat)
  exerciseHistory.initialize();
}

/**
 * Sync with storage - now a no-op since IndexedDB is source of truth
 * Kept for backward compatibility with visibility change handlers
 */
export function syncWithStorage(): void {
  // IndexedDB doesn't need this - it's always consistent
  // This was only needed for the fragile localStorage approach
}

/**
 * Reset initialization state (for testing only)
 * @internal
 */
export function _resetInitializationState(): void {
  isInitialized = false;
  initializationPromise = null;
}

// ============================================================================
// DERIVED STORES
// ============================================================================

/**
 * Total row count
 */
export const historyRowCount = derived(exerciseHistory, ($history) => $history.length);

/**
 * Unique exercise names in history
 */
export const exerciseNames = derived(exerciseHistory, ($history) => {
  const names = new Set<string>();
  for (const row of $history) {
    if (!row.is_compound_parent) {
      names.add(row.exercise_name);
    }
  }
  return Array.from(names).sort();
});

// ============================================================================
// ACTIONS - These persist to IndexedDB
// ============================================================================

/**
 * Append history rows and persist to IndexedDB
 * This is the primary way to add new history entries
 */
export async function appendHistoryRows(newRows: HistoryRow[]): Promise<void> {
  if (newRows.length === 0) return;

  // Persist to IndexedDB first (source of truth)
  await dbAppendRows(newRows);

  // Update in-memory store
  exerciseHistory.update((rows) => [...rows, ...newRows]);

  // Update backup metadata
  const allRows = get(exerciseHistory);
  if (allRows.length > 0) {
    const latestTimestamp = allRows.reduce(
      (latest, row) => (row.timestamp > latest ? row.timestamp : latest),
      allRows[0].timestamp
    );
    saveBackupMetadata(allRows.length, latestTimestamp);
  }
}

/**
 * Append a single history row
 */
export async function appendHistoryRow(row: HistoryRow): Promise<void> {
  await appendHistoryRows([row]);
}

/**
 * Log a completed set to history
 */
export async function logSetToHistory(
  workoutProgramId: string,
  weekNumber: number,
  dayNumber: number,
  exerciseName: string,
  exerciseOrder: number,
  setLog: SetLog,
  options?: {
    isCompoundParent?: boolean;
    compoundParentName?: string | null;
    restTime?: number | null;
    tempo?: string | null;
  }
): Promise<void> {
  const now = new Date();
  const row: HistoryRow = {
    date: toLocalDateString(now),
    timestamp: now.toISOString(),
    workout_program_id: workoutProgramId,
    week_number: weekNumber,
    day_number: dayNumber,
    exercise_name: exerciseName,
    exercise_order: exerciseOrder,
    is_compound_parent: options?.isCompoundParent ?? false,
    compound_parent_name: options?.compoundParentName ?? null,
    set_number: setLog.setNumber,
    reps: setLog.reps,
    weight: setLog.weight,
    weight_unit: setLog.weightUnit,
    work_time: setLog.workTime,
    rest_time: options?.restTime ?? null,
    tempo: options?.tempo ?? null,
    rpe: setLog.rpe,
    rir: setLog.rir,
    completed: setLog.completed,
    notes: setLog.notes
  };

  await appendHistoryRow(row);
}

/**
 * Log exercise logs from a session to history
 *
 * @param workoutProgramId - The schedule/program ID
 * @param weekNumber - Week number in the program
 * @param dayNumber - Day number (per-week index)
 * @param logs - Array of exercise logs to save
 * @param overrideDate - Optional date to use instead of today (for editing historical workouts)
 */
export async function logSessionToHistory(
  workoutProgramId: string,
  weekNumber: number,
  dayNumber: number,
  logs: ExerciseLog[],
  overrideDate?: string
): Promise<void> {
  const rows: HistoryRow[] = [];
  const now = new Date();
  const date = overrideDate ?? toLocalDateString(now);

  for (const log of logs) {
    // Log compound parent if applicable
    if (log.isCompoundParent) {
      const parentRow: HistoryRow = {
        date,
        timestamp: log.timestamp || now.toISOString(),
        workout_program_id: workoutProgramId,
        week_number: weekNumber,
        day_number: dayNumber,
        exercise_name: log.exerciseName,
        exercise_order: log.exerciseOrder,
        is_compound_parent: true,
        compound_parent_name: null,
        set_number: 1,
        reps: null,
        weight: null,
        weight_unit: null,
        work_time: log.totalTime ?? null,
        rest_time: null,
        tempo: null,
        rpe: null,
        rir: null,
        completed: true,
        notes: log.totalRounds ? `${log.totalRounds} rounds` : null
      };
      rows.push(parentRow);
    }

    // Log each set
    for (const setLog of log.sets) {
      const row: HistoryRow = {
        date,
        timestamp: setLog.timestamp || now.toISOString(),
        workout_program_id: workoutProgramId,
        week_number: weekNumber,
        day_number: dayNumber,
        exercise_name: log.exerciseName,
        exercise_order: log.exerciseOrder,
        is_compound_parent: false,
        compound_parent_name: log.compoundParentName,
        set_number: setLog.setNumber,
        reps: setLog.reps,
        weight: setLog.weight,
        weight_unit: setLog.weightUnit,
        work_time: setLog.workTime,
        rest_time: null,
        tempo: null,
        rpe: setLog.rpe,
        rir: setLog.rir,
        completed: setLog.completed,
        notes: setLog.notes
      };
      rows.push(row);
    }
  }

  await appendHistoryRows(rows);
}

// ============================================================================
// QUERIES (read from in-memory store)
// ============================================================================

/**
 * Get personal records for an exercise
 */
export function getPersonalRecords(exerciseName: string): PersonalRecord {
  const history = get(exerciseHistory);
  const exerciseRows = history.filter(
    (r) => r.exercise_name === exerciseName && !r.is_compound_parent && r.completed
  );

  const pr: PersonalRecord = {
    exerciseName,
    maxWeight: null,
    maxWeightUnit: null,
    maxWeightDate: null,
    maxReps: null,
    maxRepsDate: null,
    maxVolume: null,
    maxVolumeDate: null
  };

  for (const row of exerciseRows) {
    if (row.weight !== null && (pr.maxWeight === null || row.weight > pr.maxWeight)) {
      pr.maxWeight = row.weight;
      pr.maxWeightUnit = row.weight_unit;
      pr.maxWeightDate = row.date;
    }

    if (row.reps !== null && (pr.maxReps === null || row.reps > pr.maxReps)) {
      pr.maxReps = row.reps;
      pr.maxRepsDate = row.date;
    }

    if (row.weight !== null && row.reps !== null) {
      const volume = row.weight * row.reps;
      if (pr.maxVolume === null || volume > pr.maxVolume) {
        pr.maxVolume = volume;
        pr.maxVolumeDate = row.date;
      }
    }
  }

  return pr;
}

/**
 * Get statistics for an exercise
 */
export function getExerciseStats(exerciseName: string): ExerciseStats {
  const history = get(exerciseHistory);
  const exerciseRows = history.filter(
    (r) => r.exercise_name === exerciseName && !r.is_compound_parent && r.completed
  );

  const stats: ExerciseStats = {
    totalSets: exerciseRows.length,
    totalReps: 0,
    totalVolume: 0,
    avgWeight: null,
    avgReps: null,
    lastPerformed: null,
    sessionCount: 0
  };

  if (exerciseRows.length === 0) return stats;

  let weightSum = 0;
  let weightCount = 0;
  let repsSum = 0;
  let repsCount = 0;
  const sessions = new Set<string>();

  for (const row of exerciseRows) {
    if (row.reps !== null) {
      stats.totalReps += row.reps;
      repsSum += row.reps;
      repsCount++;
    }

    if (row.weight !== null && row.reps !== null) {
      stats.totalVolume += row.weight * row.reps;
    }

    if (row.weight !== null) {
      weightSum += row.weight;
      weightCount++;
    }

    sessions.add(`${row.date}-${row.workout_program_id}`);

    if (!stats.lastPerformed || row.date > stats.lastPerformed) {
      stats.lastPerformed = row.date;
    }
  }

  stats.avgWeight = weightCount > 0 ? weightSum / weightCount : null;
  stats.avgReps = repsCount > 0 ? repsSum / repsCount : null;
  stats.sessionCount = sessions.size;

  return stats;
}

/**
 * Get last performance for an exercise
 */
export function getLastPerformance(exerciseName: string): HistoryRow | null {
  const history = get(exerciseHistory);
  const exerciseRows = history.filter(
    (r) => r.exercise_name === exerciseName && !r.is_compound_parent && r.completed
  );

  if (exerciseRows.length === 0) return null;

  return exerciseRows.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )[0];
}

/**
 * Get today's logged history for a specific workout program, deduplicated
 */
export function getTodaysHistoryForWorkout(workoutProgramId: string): HistoryRow[] | null {
  const today = toLocalDateString(new Date());
  const history = get(exerciseHistory);

  const todaysRows = history.filter(
    (r) => r.date === today && r.workout_program_id === workoutProgramId
  );

  if (todaysRows.length === 0) return null;

  const latestByKey = new Map<string, HistoryRow>();
  for (const row of todaysRows) {
    const key = `${row.exercise_name}|${row.set_number}|${row.is_compound_parent}`;
    const existing = latestByKey.get(key);
    if (!existing || new Date(row.timestamp).getTime() > new Date(existing.timestamp).getTime()) {
      latestByKey.set(key, row);
    }
  }

  return Array.from(latestByKey.values());
}

/**
 * Check if user has logged any exercises for today's workout
 */
export function hasLoggedTodaysWorkout(workoutProgramId: string): boolean {
  const rows = getTodaysHistoryForWorkout(workoutProgramId);
  return rows !== null && rows.length > 0;
}

/**
 * Get performance from a specific week in a workout program
 */
export function getWeekPerformance(
  exerciseName: string,
  workoutProgramId: string,
  weekNumber: number
): {
  weight: number | null;
  weightUnit: string | null;
  rpe: number | null;
  reps: number | null;
  weekNumber: number;
} | null {
  const history = get(exerciseHistory);

  const weekRows = history.filter(
    (r) =>
      r.exercise_name === exerciseName &&
      r.workout_program_id === workoutProgramId &&
      r.week_number === weekNumber &&
      !r.is_compound_parent &&
      r.completed
  );

  if (weekRows.length === 0) return null;

  const sortedRows = weekRows.sort((a, b) => {
    if ((b.weight ?? 0) !== (a.weight ?? 0)) {
      return (b.weight ?? 0) - (a.weight ?? 0);
    }
    return (b.reps ?? 0) - (a.reps ?? 0);
  });

  const bestSet = sortedRows[0];

  const rpeValues = weekRows.filter((r) => r.rpe !== null).map((r) => r.rpe!);
  const avgRpe =
    rpeValues.length > 0
      ? Math.round(rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length)
      : bestSet.rpe;

  return {
    weight: bestSet.weight,
    weightUnit: bestSet.weight_unit,
    rpe: avgRpe,
    reps: bestSet.reps,
    weekNumber
  };
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Summary of a completed workout session
 */
export interface WorkoutSession {
  date: string;
  workoutProgramId: string;
  weekNumber: number;
  dayNumber: number;
  exerciseCount: number;
  completedSetCount: number;
  earliestTimestamp: string;
}

/**
 * Get list of completed workout sessions from history
 */
export function getCompletedSessions(limit: number = 50): WorkoutSession[] {
  const history = get(exerciseHistory);

  const sessionMap = new Map<
    string,
    {
      date: string;
      workoutProgramId: string;
      weekNumber: number;
      dayNumber: number;
      exerciseNames: Set<string>;
      deduplicatedSets: Map<string, string>;
      earliestTimestamp: string;
    }
  >();

  for (const row of history) {
    if (row.is_compound_parent) continue;
    if (!row.completed) continue;

    const sessionKey = `${row.date}|${row.workout_program_id}|${row.week_number}|${row.day_number}`;

    if (!sessionMap.has(sessionKey)) {
      sessionMap.set(sessionKey, {
        date: row.date,
        workoutProgramId: row.workout_program_id,
        weekNumber: row.week_number,
        dayNumber: row.day_number,
        exerciseNames: new Set(),
        deduplicatedSets: new Map(),
        earliestTimestamp: row.timestamp
      });
    }

    const session = sessionMap.get(sessionKey)!;
    session.exerciseNames.add(row.exercise_name);

    const setKey = `${row.exercise_name}|${row.set_number}`;
    const existingTimestamp = session.deduplicatedSets.get(setKey);
    if (
      !existingTimestamp ||
      new Date(row.timestamp).getTime() > new Date(existingTimestamp).getTime()
    ) {
      session.deduplicatedSets.set(setKey, row.timestamp);
    }

    if (row.timestamp < session.earliestTimestamp) {
      session.earliestTimestamp = row.timestamp;
    }
  }

  const sessions: WorkoutSession[] = Array.from(sessionMap.values())
    .filter((s) => s.deduplicatedSets.size > 0)
    .map((s) => ({
      date: s.date,
      workoutProgramId: s.workoutProgramId,
      weekNumber: s.weekNumber,
      dayNumber: s.dayNumber,
      exerciseCount: s.exerciseNames.size,
      completedSetCount: s.deduplicatedSets.size,
      earliestTimestamp: s.earliestTimestamp
    }));

  sessions.sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;
    return b.earliestTimestamp.localeCompare(a.earliestTimestamp);
  });

  return sessions.slice(0, limit);
}

/**
 * Get history rows for a specific session
 */
export function getHistoryForSession(
  date: string,
  workoutProgramId: string,
  weekNumber?: number,
  dayNumber?: number
): HistoryRow[] | null {
  const history = get(exerciseHistory);

  const sessionRows = history.filter((r) => {
    if (r.date !== date || r.workout_program_id !== workoutProgramId) return false;
    if (weekNumber !== undefined && r.week_number !== weekNumber) return false;
    if (dayNumber !== undefined && r.day_number !== dayNumber) return false;
    return true;
  });

  if (sessionRows.length === 0) return null;

  const latestByKey = new Map<string, HistoryRow>();
  for (const row of sessionRows) {
    const key = `${row.exercise_name}|${row.set_number}|${row.is_compound_parent}`;
    const existing = latestByKey.get(key);
    if (!existing || new Date(row.timestamp).getTime() > new Date(existing.timestamp).getTime()) {
      latestByKey.set(key, row);
    }
  }

  return Array.from(latestByKey.values());
}

/**
 * Get ALL history rows for a session (not deduplicated) - for deletion preview
 */
export function getSessionRowsForDeletion(
  date: string,
  workoutProgramId: string,
  weekNumber: number,
  dayNumber: number
): HistoryRow[] {
  const history = get(exerciseHistory);

  return history.filter(
    (r) =>
      r.date === date &&
      r.workout_program_id === workoutProgramId &&
      r.week_number === weekNumber &&
      r.day_number === dayNumber
  );
}

/**
 * Delete a workout session from history
 * Persists to IndexedDB and updates in-memory store
 */
export async function deleteSession(
  date: string,
  workoutProgramId: string,
  weekNumber: number,
  dayNumber: number
): Promise<number> {
  // Delete from IndexedDB first (source of truth)
  const deletedCount = await dbDeleteSessionRows(date, workoutProgramId, weekNumber, dayNumber);

  if (deletedCount > 0) {
    // Update in-memory store
    exerciseHistory.update((rows) =>
      rows.filter(
        (r) =>
          !(
            r.date === date &&
            r.workout_program_id === workoutProgramId &&
            r.week_number === weekNumber &&
            r.day_number === dayNumber
          )
      )
    );

    // Update backup metadata
    const allRows = get(exerciseHistory);
    const latestTimestamp =
      allRows.length > 0
        ? allRows.reduce(
            (latest, row) => (row.timestamp > latest ? row.timestamp : latest),
            allRows[0].timestamp
          )
        : null;
    saveBackupMetadata(allRows.length, latestTimestamp);
  }

  return deletedCount;
}

/**
 * Delete rows for a specific exercise within a session
 * Used when editing a single exercise in a completed workout
 * Persists to IndexedDB and updates in-memory store
 */
export async function deleteExerciseRows(
  date: string,
  workoutProgramId: string,
  weekNumber: number,
  dayNumber: number,
  exerciseOrder: number
): Promise<number> {
  // Delete from IndexedDB first (source of truth)
  const deletedCount = await dbDeleteExerciseRows(
    date,
    workoutProgramId,
    weekNumber,
    dayNumber,
    exerciseOrder
  );

  if (deletedCount > 0) {
    // Update in-memory store
    exerciseHistory.update((rows) =>
      rows.filter(
        (r) =>
          !(
            r.date === date &&
            r.workout_program_id === workoutProgramId &&
            r.week_number === weekNumber &&
            r.day_number === dayNumber &&
            r.exercise_order === exerciseOrder
          )
      )
    );

    // Update backup metadata
    const allRows = get(exerciseHistory);
    const latestTimestamp =
      allRows.length > 0
        ? allRows.reduce(
            (latest, row) => (row.timestamp > latest ? row.timestamp : latest),
            allRows[0].timestamp
          )
        : null;
    saveBackupMetadata(allRows.length, latestTimestamp);
  }

  return deletedCount;
}

/**
 * Update the date of a workout session in history
 */
export async function updateSessionDate(
  originalDate: string,
  workoutProgramId: string,
  weekNumber: number,
  dayNumber: number,
  newDate: string
): Promise<number> {
  // Update in IndexedDB first
  const updatedCount = await dbUpdateSessionDate(
    originalDate,
    workoutProgramId,
    weekNumber,
    dayNumber,
    newDate
  );

  if (updatedCount > 0) {
    // Update in-memory store
    exerciseHistory.update((rows) =>
      rows.map((r) => {
        if (
          r.date === originalDate &&
          r.workout_program_id === workoutProgramId &&
          r.week_number === weekNumber &&
          r.day_number === dayNumber
        ) {
          const originalTimestamp = new Date(r.timestamp);
          const newTimestamp = new Date(newDate + 'T00:00:00');
          newTimestamp.setHours(originalTimestamp.getHours());
          newTimestamp.setMinutes(originalTimestamp.getMinutes());
          newTimestamp.setSeconds(originalTimestamp.getSeconds());
          newTimestamp.setMilliseconds(originalTimestamp.getMilliseconds());

          return {
            ...r,
            date: newDate,
            timestamp: newTimestamp.toISOString()
          };
        }
        return r;
      })
    );
  }

  return updatedCount;
}

// ============================================================================
// EXPORT / UTILITY
// ============================================================================

/**
 * Escape CSV field value
 */
function escapeCSV(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Convert HistoryRow to CSV line
 */
function rowToCSV(row: HistoryRow): string {
  return [
    escapeCSV(row.date),
    escapeCSV(row.timestamp),
    escapeCSV(row.workout_program_id),
    escapeCSV(row.week_number),
    escapeCSV(row.day_number),
    escapeCSV(row.exercise_name),
    escapeCSV(row.exercise_order),
    escapeCSV(row.is_compound_parent),
    escapeCSV(row.compound_parent_name),
    escapeCSV(row.set_number),
    escapeCSV(row.reps),
    escapeCSV(row.weight),
    escapeCSV(row.weight_unit),
    escapeCSV(row.work_time),
    escapeCSV(row.rest_time),
    escapeCSV(row.tempo),
    escapeCSV(row.rpe),
    escapeCSV(row.rir),
    escapeCSV(row.completed),
    escapeCSV(row.notes)
  ].join(',');
}

/**
 * Export history as CSV string
 */
export function exportHistoryCsv(): string {
  const rows = get(exerciseHistory);
  const header = CSV_HEADERS.join(',');
  const lines = [header, ...rows.map(rowToCSV)];
  return lines.join('\n');
}

/**
 * Clear all history
 * WARNING: This is destructive!
 */
export async function clearHistory(): Promise<void> {
  await clearAllRows();
  exerciseHistory.set([]);
  saveBackupMetadata(0, null);
}

/**
 * Get storage usage info
 */
export function getStorageInfo(): { rowCount: number; estimatedSize: number } {
  const rows = get(exerciseHistory);
  const csv = exportHistoryCsv();
  return {
    rowCount: rows.length,
    estimatedSize: new Blob([csv]).size
  };
}

// Legacy exports for backward compatibility
export function _resetHydrationState(): void {
  _resetInitializationState();
}
