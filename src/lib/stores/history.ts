/**
 * Exercise History Store - CSV-based workout history logging
 *
 * Stores workout history in localStorage as CSV format per EXERCISE_HISTORY_SPEC.md
 * - 20-column CSV schema
 * - Append-only (historical data never modified)
 * - Support for compound exercises (parent + sub-exercise rows)
 */

import { writable, derived, get } from 'svelte/store';
import type { ExerciseLog, SetLog } from '$lib/engine/types';

// ============================================================================
// CONSTANTS
// ============================================================================

const HISTORY_KEY = 'shredly_exercise_history_v2';
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

// CSV column headers
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
  maxVolume: number | null; // weight * reps
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
// HELPER FUNCTIONS
// ============================================================================

/**
 * Escape CSV field value
 */
function escapeCSV(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  const str = String(value);

  // If contains comma, newline, or quote, wrap in quotes and escape inner quotes
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Parse CSV field value
 */
function parseCSVField(value: string): string {
  // Remove surrounding quotes and unescape inner quotes
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/""/g, '"');
  }
  return value;
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
 * Parse CSV line to HistoryRow
 */
function csvToRow(line: string): HistoryRow | null {
  // Simple CSV parsing (handles quoted fields)
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(parseCSVField(current));
      current = '';
    } else {
      current += char;
    }
  }
  values.push(parseCSVField(current));

  if (values.length !== 20) {
    return null;
  }

  return {
    date: values[0],
    timestamp: values[1],
    workout_program_id: values[2],
    week_number: parseInt(values[3]) || 0,
    day_number: parseInt(values[4]) || 0,
    exercise_name: values[5],
    exercise_order: parseInt(values[6]) || 0,
    is_compound_parent: values[7] === 'true',
    compound_parent_name: values[8] || null,
    set_number: parseInt(values[9]) || 0,
    reps: values[10] ? parseInt(values[10]) : null,
    weight: values[11] ? parseFloat(values[11]) : null,
    weight_unit: values[12] || null,
    work_time: values[13] ? parseInt(values[13]) : null,
    rest_time: values[14] ? parseInt(values[14]) : null,
    tempo: values[15] || null,
    rpe: values[16] ? parseInt(values[16]) : null,
    rir: values[17] ? parseInt(values[17]) : null,
    completed: values[18] === 'true',
    notes: values[19] || null
  };
}

/**
 * Load history from localStorage
 */
function loadHistory(): HistoryRow[] {
  if (!isBrowser) return [];

  try {
    const csv = localStorage.getItem(HISTORY_KEY);
    if (!csv) return [];

    const lines = csv.split('\n').filter(line => line.trim());

    // Skip header if present
    const startIndex = lines[0] === CSV_HEADERS.join(',') ? 1 : 0;

    const rows: HistoryRow[] = [];
    for (let i = startIndex; i < lines.length; i++) {
      const row = csvToRow(lines[i]);
      if (row) {
        rows.push(row);
      }
    }

    return rows;
  } catch (e) {
    console.error('Failed to load history:', e);
    return [];
  }
}

/**
 * Save history to localStorage
 */
function saveHistory(rows: HistoryRow[]): void {
  if (!isBrowser) return;

  try {
    const header = CSV_HEADERS.join(',');
    const lines = [header, ...rows.map(rowToCSV)];
    const csv = lines.join('\n');
    localStorage.setItem(HISTORY_KEY, csv);
  } catch (e) {
    console.error('Failed to save history:', e);
  }
}

// ============================================================================
// STORES
// ============================================================================

/**
 * Track if we've hydrated on the client
 */
let isHydrated = false;

/**
 * Exercise history store (all rows)
 * Initialized empty during SSR, hydrated on client-side first access
 */
function createExerciseHistoryStore() {
  // Start with empty array (SSR-safe)
  const { subscribe, set, update } = writable<HistoryRow[]>([]);

  // Track if auto-save should be enabled (disabled during hydration)
  let autoSaveEnabled = false;

  // Custom subscribe that hydrates on first client-side access
  const hydratingSubscribe: typeof subscribe = (run, invalidate) => {
    // Hydrate on first client-side subscription
    if (isBrowser && !isHydrated) {
      isHydrated = true;
      const rows = loadHistory();
      set(rows);
      autoSaveEnabled = true;
    }

    return subscribe(run, invalidate);
  };

  // Auto-save wrapper
  subscribe(rows => {
    if (autoSaveEnabled) {
      saveHistory(rows);
    }
  });

  return {
    subscribe: hydratingSubscribe,
    set: (rows: HistoryRow[]) => {
      if (isBrowser && !isHydrated) {
        isHydrated = true;
        autoSaveEnabled = true;
      }
      set(rows);
    },
    update
  };
}

export const exerciseHistory = createExerciseHistoryStore();

/**
 * Hydrate history from localStorage
 * Called on client-side after SSR hydration to load persisted data
 * Note: With the new self-hydrating store, this is mostly a no-op but kept for compatibility
 */
export function hydrateHistory(): void {
  if (!isBrowser) return;

  // Force hydration if not already done
  if (!isHydrated) {
    isHydrated = true;
    const rows = loadHistory();
    exerciseHistory.set(rows);
  }
}

/**
 * Reset hydration state (for testing only)
 * @internal
 */
export function _resetHydrationState(): void {
  isHydrated = false;
}

// ============================================================================
// DERIVED STORES
// ============================================================================

/**
 * Total row count
 */
export const historyRowCount = derived(exerciseHistory, $history => $history.length);

/**
 * Unique exercise names in history
 */
export const exerciseNames = derived(exerciseHistory, $history => {
  const names = new Set<string>();
  for (const row of $history) {
    if (!row.is_compound_parent) {
      names.add(row.exercise_name);
    }
  }
  return Array.from(names).sort();
});

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Append a history row
 */
export function appendHistoryRow(row: HistoryRow): void {
  exerciseHistory.update(rows => [...rows, row]);
}

/**
 * Append multiple history rows
 */
export function appendHistoryRows(newRows: HistoryRow[]): void {
  exerciseHistory.update(rows => [...rows, ...newRows]);
}

/**
 * Log a completed set to history
 */
export function logSetToHistory(
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
): void {
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

  appendHistoryRow(row);
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
export function logSessionToHistory(
  workoutProgramId: string,
  weekNumber: number,
  dayNumber: number,
  logs: ExerciseLog[],
  overrideDate?: string
): void {
  const rows: HistoryRow[] = [];
  const now = new Date();
  // Use override date if provided, otherwise use today
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

  appendHistoryRows(rows);
}

/**
 * Get personal records for an exercise
 */
export function getPersonalRecords(exerciseName: string): PersonalRecord {
  const history = get(exerciseHistory);
  const exerciseRows = history.filter(
    r => r.exercise_name === exerciseName && !r.is_compound_parent && r.completed
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
    // Max weight
    if (row.weight !== null && (pr.maxWeight === null || row.weight > pr.maxWeight)) {
      pr.maxWeight = row.weight;
      pr.maxWeightUnit = row.weight_unit;
      pr.maxWeightDate = row.date;
    }

    // Max reps (at same or higher weight as current max)
    if (row.reps !== null && (pr.maxReps === null || row.reps > pr.maxReps)) {
      pr.maxReps = row.reps;
      pr.maxRepsDate = row.date;
    }

    // Max volume (weight * reps)
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
    r => r.exercise_name === exerciseName && !r.is_compound_parent && r.completed
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

    // Track unique sessions by date + workout_program_id
    sessions.add(`${row.date}-${row.workout_program_id}`);

    // Track last performed
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
    r => r.exercise_name === exerciseName && !r.is_compound_parent && r.completed
  );

  if (exerciseRows.length === 0) return null;

  // Sort by timestamp descending and return first
  return exerciseRows.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )[0];
}

/**
 * Get today's logged history for a specific workout program, deduplicated
 * Returns null if no history exists for today's workout
 *
 * Queries by date + program_id only - resilient to start date changes.
 * week_number and day_number are still stored in history but not used for filtering.
 *
 * Deduplication: If multiple rows exist for the same (exercise_name, set_number, is_compound_parent),
 * only the row with the latest timestamp is returned.
 */
export function getTodaysHistoryForWorkout(
  workoutProgramId: string
): HistoryRow[] | null {
  const today = toLocalDateString(new Date());
  const history = get(exerciseHistory);

  // Filter by date + program_id only - resilient to start date changes
  const todaysRows = history.filter(
    r => r.date === today &&
      r.workout_program_id === workoutProgramId
  );

  if (todaysRows.length === 0) return null;

  // Deduplicate: keep latest row per (exercise_name, set_number, is_compound_parent)
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
 * Queries by date + program_id only - resilient to start date changes.
 */
export function hasLoggedTodaysWorkout(
  workoutProgramId: string
): boolean {
  const rows = getTodaysHistoryForWorkout(workoutProgramId);
  return rows !== null && rows.length > 0;
}

/**
 * Get performance from a specific week in a workout program
 * Used to show "what you did last week" for progressive overload guidance
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

  // Find rows for this exercise in the specified week of this program
  const weekRows = history.filter(
    r => r.exercise_name === exerciseName &&
      r.workout_program_id === workoutProgramId &&
      r.week_number === weekNumber &&
      !r.is_compound_parent &&
      r.completed
  );

  if (weekRows.length === 0) return null;

  // Get the heaviest weight used (typical "working set" approach)
  // If multiple sets, take the one with highest weight, or highest reps if same weight
  const sortedRows = weekRows.sort((a, b) => {
    // Sort by weight desc, then reps desc
    if ((b.weight ?? 0) !== (a.weight ?? 0)) {
      return (b.weight ?? 0) - (a.weight ?? 0);
    }
    return (b.reps ?? 0) - (a.reps ?? 0);
  });

  const bestSet = sortedRows[0];

  // Also get average RPE if multiple sets logged RPE
  const rpeValues = weekRows.filter(r => r.rpe !== null).map(r => r.rpe!);
  const avgRpe = rpeValues.length > 0
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
 * Clear all history (use with caution!)
 */
export function clearHistory(): void {
  exerciseHistory.set([]);
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

// ============================================================================
// WORKOUT SESSION QUERIES
// ============================================================================

/**
 * Summary of a completed workout session
 */
export interface WorkoutSession {
  date: string;                    // ISO date "2026-01-15"
  workoutProgramId: string;
  weekNumber: number;
  dayNumber: number;
  exerciseCount: number;
  completedSetCount: number;
  earliestTimestamp: string;
}

/**
 * Get list of completed workout sessions from history
 *
 * Groups history rows by (date, workout_program_id) to be resilient to start date changes.
 * Only includes sessions with at least 1 completed set.
 * Sorted by date descending (most recent first).
 *
 * @param limit Maximum number of sessions to return (default: 50)
 */
export function getCompletedSessions(limit: number = 50): WorkoutSession[] {
  const history = get(exerciseHistory);

  // Group by (date, workout_program_id)
  const sessionMap = new Map<string, {
    date: string;
    workoutProgramId: string;
    weekNumber: number;
    dayNumber: number;
    exerciseNames: Set<string>;
    // Track deduplicated sets: key = exercise_name|set_number, value = latest timestamp
    deduplicatedSets: Map<string, string>;
    earliestTimestamp: string;
  }>();

  for (const row of history) {
    // Skip compound parent rows (they don't represent actual sets)
    if (row.is_compound_parent) continue;

    // Only count completed sets
    if (!row.completed) continue;

    const sessionKey = `${row.date}|${row.workout_program_id}`;

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

    // Deduplicate: only count the latest entry for each (exercise_name, set_number)
    const setKey = `${row.exercise_name}|${row.set_number}`;
    const existingTimestamp = session.deduplicatedSets.get(setKey);
    if (!existingTimestamp || new Date(row.timestamp).getTime() > new Date(existingTimestamp).getTime()) {
      session.deduplicatedSets.set(setKey, row.timestamp);
    }

    // Track earliest timestamp
    if (row.timestamp < session.earliestTimestamp) {
      session.earliestTimestamp = row.timestamp;
    }
  }

  // Convert to array and filter out empty sessions
  const sessions: WorkoutSession[] = Array.from(sessionMap.values())
    .filter(s => s.deduplicatedSets.size > 0)
    .map(s => ({
      date: s.date,
      workoutProgramId: s.workoutProgramId,
      weekNumber: s.weekNumber,
      dayNumber: s.dayNumber,
      exerciseCount: s.exerciseNames.size,
      completedSetCount: s.deduplicatedSets.size, // Use deduplicated count
      earliestTimestamp: s.earliestTimestamp
    }));

  // Sort by date descending (most recent first)
  sessions.sort((a, b) => b.date.localeCompare(a.date));

  // Apply limit
  return sessions.slice(0, limit);
}

/**
 * Get history rows for a specific session
 *
 * Queries by date + program_id only - resilient to start date changes.
 * Returns deduplicated rows (latest per exercise_name + set_number + is_compound_parent).
 *
 * @param date ISO date string "2026-01-15"
 * @param workoutProgramId The schedule/program ID
 */
export function getHistoryForSession(
  date: string,
  workoutProgramId: string
): HistoryRow[] | null {
  const history = get(exerciseHistory);

  // Filter by date + program_id only - resilient to start date changes
  const sessionRows = history.filter(
    r => r.date === date && r.workout_program_id === workoutProgramId
  );

  if (sessionRows.length === 0) return null;

  // Deduplicate: keep latest row per (exercise_name, set_number, is_compound_parent)
  // This reuses the same deduplication logic from getTodaysHistoryForWorkout
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
