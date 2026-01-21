/**
 * IndexedDB Wrapper for Exercise History Persistence
 *
 * Provides robust, transactional storage for workout history.
 * Each history row is stored as a separate IndexedDB entry for atomic operations.
 *
 * Key design principles:
 * 1. Append-only writes - never overwrite entire dataset
 * 2. Explicit saves - no auto-save on store changes
 * 3. Row-level storage - each row is a separate entry with UUID
 * 4. Tombstoning for deletes - mark as deleted, compact periodically
 * 5. Backup to localStorage - lightweight backup for recovery
 */

import type { HistoryRow } from './history';

const DB_NAME = 'shredly-history';
const DB_VERSION = 1;
const STORE_NAME = 'history_rows';
const BACKUP_KEY = 'shredly_history_backup_v1';

// Browser check for SSR safety
const isBrowser = typeof window !== 'undefined' && typeof indexedDB !== 'undefined';

let db: IDBDatabase | null = null;
let dbOpenPromise: Promise<IDBDatabase | null> | null = null;

/**
 * Extended history row with IndexedDB-specific fields
 */
export interface StoredHistoryRow extends HistoryRow {
  /** Unique identifier for this row (UUID) */
  id: string;
  /** Tombstone marker - true if row has been "deleted" */
  deleted?: boolean;
  /** Version number for conflict resolution */
  version: number;
  /** When this row was stored in IndexedDB */
  storedAt: string;
}

/**
 * Generate a UUID v4
 */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Open the IndexedDB database, creating object stores if needed.
 * Returns cached connection if already open.
 * Uses singleton pattern to prevent multiple simultaneous opens.
 */
export async function openHistoryDatabase(): Promise<IDBDatabase | null> {
  if (!isBrowser) return null;
  if (db) return db;

  // If already opening, return the existing promise
  if (dbOpenPromise) return dbOpenPromise;

  dbOpenPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[HistoryDB] Failed to open database:', request.error);
      dbOpenPromise = null;
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;

      // Handle connection close (e.g., iOS killing the app)
      db.onclose = () => {
        console.log('[HistoryDB] Database connection closed');
        db = null;
        dbOpenPromise = null;
      };

      // Handle version change from another tab
      db.onversionchange = () => {
        console.log('[HistoryDB] Database version change detected, closing');
        db?.close();
        db = null;
        dbOpenPromise = null;
      };

      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Create history_rows store with indexes
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('exercise_name', 'exercise_name', { unique: false });
        store.createIndex('workout_program_id', 'workout_program_id', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        // Compound index for session queries
        store.createIndex('session', ['date', 'workout_program_id', 'week_number', 'day_number'], {
          unique: false
        });
        console.log('[HistoryDB] Created history_rows object store');
      }
    };
  });

  return dbOpenPromise;
}

/**
 * Convert a HistoryRow to StoredHistoryRow with generated ID
 */
function toStoredRow(row: HistoryRow): StoredHistoryRow {
  return {
    ...row,
    id: generateUUID(),
    deleted: false,
    version: 1,
    storedAt: new Date().toISOString()
  };
}

/**
 * Convert StoredHistoryRow back to HistoryRow (strip DB fields)
 */
function toHistoryRow(stored: StoredHistoryRow): HistoryRow {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, deleted, version, storedAt, ...row } = stored;
  return row;
}

/**
 * Append a single history row to IndexedDB
 * Returns the generated ID
 */
export async function appendRow(row: HistoryRow): Promise<string | null> {
  const database = await openHistoryDatabase();
  if (!database) return null;

  const storedRow = toStoredRow(row);

  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(storedRow);

    request.onerror = () => {
      console.error('[HistoryDB] Failed to append row:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(storedRow.id);
    };
  });
}

/**
 * Append multiple history rows to IndexedDB in a single transaction
 * Returns array of generated IDs
 */
export async function appendRows(rows: HistoryRow[]): Promise<string[]> {
  if (rows.length === 0) return [];

  const database = await openHistoryDatabase();
  if (!database) return [];

  const storedRows = rows.map(toStoredRow);

  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const ids: string[] = [];

    tx.onerror = () => {
      console.error('[HistoryDB] Transaction failed:', tx.error);
      reject(tx.error);
    };

    tx.oncomplete = () => {
      resolve(ids);
    };

    for (const storedRow of storedRows) {
      const request = store.put(storedRow);
      request.onsuccess = () => {
        ids.push(storedRow.id);
      };
    }
  });
}

/**
 * Get all non-deleted history rows
 */
export async function getAllRows(): Promise<HistoryRow[]> {
  const database = await openHistoryDatabase();
  if (!database) return [];

  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onerror = () => {
      console.error('[HistoryDB] Failed to get all rows:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      const storedRows = (request.result || []) as StoredHistoryRow[];
      // Filter out deleted rows and convert to HistoryRow
      const rows = storedRows.filter((r) => !r.deleted).map(toHistoryRow);
      resolve(rows);
    };
  });
}

/**
 * Get row count (non-deleted)
 */
export async function getRowCount(): Promise<number> {
  const database = await openHistoryDatabase();
  if (!database) return 0;

  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const storedRows = (request.result || []) as StoredHistoryRow[];
      const count = storedRows.filter((r) => !r.deleted).length;
      resolve(count);
    };
  });
}

/**
 * Delete rows for a specific exercise within a session (tombstone - mark as deleted)
 * Used when editing a single exercise in a completed workout
 * Returns number of rows marked as deleted
 */
export async function deleteExerciseRows(
  date: string,
  workoutProgramId: string,
  weekNumber: number,
  dayNumber: number,
  exerciseOrder: number
): Promise<number> {
  const database = await openHistoryDatabase();
  if (!database) return 0;

  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('session');
    const range = IDBKeyRange.only([date, workoutProgramId, weekNumber, dayNumber]);
    const request = index.openCursor(range);

    let deletedCount = 0;

    request.onerror = () => {
      console.error('[HistoryDB] Failed to delete exercise rows:', request.error);
      reject(request.error);
    };

    tx.oncomplete = () => {
      resolve(deletedCount);
    };

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        const row = cursor.value as StoredHistoryRow;
        // Match by exercise_order (includes parent + sub-exercises at same order)
        if (!row.deleted && row.exercise_order === exerciseOrder) {
          row.deleted = true;
          row.version += 1;
          cursor.update(row);
          deletedCount++;
        }
        cursor.continue();
      }
    };
  });
}

/**
 * Delete rows for a specific session (tombstone - mark as deleted)
 * Returns number of rows marked as deleted
 */
export async function deleteSessionRows(
  date: string,
  workoutProgramId: string,
  weekNumber: number,
  dayNumber: number
): Promise<number> {
  const database = await openHistoryDatabase();
  if (!database) return 0;

  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('session');
    const range = IDBKeyRange.only([date, workoutProgramId, weekNumber, dayNumber]);
    const request = index.openCursor(range);

    let deletedCount = 0;

    request.onerror = () => {
      console.error('[HistoryDB] Failed to delete session rows:', request.error);
      reject(request.error);
    };

    tx.oncomplete = () => {
      resolve(deletedCount);
    };

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        const row = cursor.value as StoredHistoryRow;
        if (!row.deleted) {
          row.deleted = true;
          row.version += 1;
          cursor.update(row);
          deletedCount++;
        }
        cursor.continue();
      }
    };
  });
}

/**
 * Update date for all rows in a session
 * Returns number of rows updated
 */
export async function updateSessionDate(
  originalDate: string,
  workoutProgramId: string,
  weekNumber: number,
  dayNumber: number,
  newDate: string
): Promise<number> {
  const database = await openHistoryDatabase();
  if (!database) return 0;

  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('session');
    const range = IDBKeyRange.only([originalDate, workoutProgramId, weekNumber, dayNumber]);
    const request = index.openCursor(range);

    let updatedCount = 0;

    request.onerror = () => reject(request.error);
    tx.oncomplete = () => resolve(updatedCount);

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        const row = cursor.value as StoredHistoryRow;
        if (!row.deleted) {
          // Update date and timestamp
          const originalTimestamp = new Date(row.timestamp);
          const newTimestamp = new Date(newDate + 'T00:00:00');
          newTimestamp.setHours(originalTimestamp.getHours());
          newTimestamp.setMinutes(originalTimestamp.getMinutes());
          newTimestamp.setSeconds(originalTimestamp.getSeconds());
          newTimestamp.setMilliseconds(originalTimestamp.getMilliseconds());

          row.date = newDate;
          row.timestamp = newTimestamp.toISOString();
          row.version += 1;
          cursor.update(row);
          updatedCount++;
        }
        cursor.continue();
      }
    };
  });
}

/**
 * Compact the database by permanently removing tombstoned rows
 * Call this periodically (e.g., on app startup or after N deletes)
 */
export async function compactDatabase(): Promise<number> {
  const database = await openHistoryDatabase();
  if (!database) return 0;

  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.openCursor();

    let removedCount = 0;

    request.onerror = () => reject(request.error);
    tx.oncomplete = () => {
      if (removedCount > 0) {
        console.log(`[HistoryDB] Compacted database, removed ${removedCount} tombstoned rows`);
      }
      resolve(removedCount);
    };

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        const row = cursor.value as StoredHistoryRow;
        if (row.deleted) {
          cursor.delete();
          removedCount++;
        }
        cursor.continue();
      }
    };
  });
}

/**
 * Clear all data from the database
 * WARNING: This is destructive - use with caution
 */
export async function clearAllRows(): Promise<void> {
  const database = await openHistoryDatabase();
  if (!database) return;

  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.clear();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      console.log('[HistoryDB] Cleared all history rows');
      resolve();
    };
  });
}

// ============================================================================
// BACKUP FUNCTIONS
// ============================================================================

/**
 * Create a lightweight backup of row count and latest timestamp in localStorage
 * This helps detect data loss on recovery
 */
export function saveBackupMetadata(rowCount: number, latestTimestamp: string | null): void {
  if (!isBrowser) return;

  try {
    const backup = {
      rowCount,
      latestTimestamp,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(BACKUP_KEY, JSON.stringify(backup));
  } catch (e) {
    console.warn('[HistoryDB] Failed to save backup metadata:', e);
  }
}

/**
 * Load backup metadata from localStorage
 */
export function loadBackupMetadata(): {
  rowCount: number;
  latestTimestamp: string | null;
  savedAt: string;
} | null {
  if (!isBrowser) return null;

  try {
    const stored = localStorage.getItem(BACKUP_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch (e) {
    console.warn('[HistoryDB] Failed to load backup metadata:', e);
    return null;
  }
}

/**
 * Verify data integrity by comparing IndexedDB with backup metadata
 * Returns true if data appears intact, false if potential data loss detected
 */
export async function verifyDataIntegrity(): Promise<{
  intact: boolean;
  dbRowCount: number;
  backupRowCount: number | null;
  message: string;
}> {
  const dbRowCount = await getRowCount();
  const backup = loadBackupMetadata();

  if (!backup) {
    return {
      intact: true,
      dbRowCount,
      backupRowCount: null,
      message: 'No backup metadata to compare (first run or cleared)'
    };
  }

  // Allow for small variations (user might have deleted sessions legitimately)
  // But flag if we lost more than 10% of data
  const threshold = Math.max(5, backup.rowCount * 0.1);
  const lostRows = backup.rowCount - dbRowCount;

  if (lostRows > threshold) {
    return {
      intact: false,
      dbRowCount,
      backupRowCount: backup.rowCount,
      message: `Potential data loss detected: expected ~${backup.rowCount} rows, found ${dbRowCount} (lost ${lostRows})`
    };
  }

  return {
    intact: true,
    dbRowCount,
    backupRowCount: backup.rowCount,
    message: `Data appears intact: ${dbRowCount} rows (backup had ${backup.rowCount})`
  };
}

// ============================================================================
// MIGRATION FROM LOCALSTORAGE
// ============================================================================

const OLD_HISTORY_KEY = 'shredly_exercise_history_v2';
const MIGRATION_COMPLETE_KEY = 'shredly_history_migration_v1';

/**
 * Check if migration from localStorage has been completed
 */
export function isMigrationComplete(): boolean {
  if (!isBrowser) return true;
  return localStorage.getItem(MIGRATION_COMPLETE_KEY) === 'true';
}

/**
 * Migrate history data from localStorage to IndexedDB
 * This is a one-time operation on first run after update
 */
export async function migrateFromLocalStorage(): Promise<{
  migrated: boolean;
  rowCount: number;
  message: string;
}> {
  if (!isBrowser) {
    return { migrated: false, rowCount: 0, message: 'Not in browser' };
  }

  // Check if already migrated
  if (isMigrationComplete()) {
    return { migrated: false, rowCount: 0, message: 'Migration already complete' };
  }

  // Check if there's data to migrate
  const oldCsv = localStorage.getItem(OLD_HISTORY_KEY);
  if (!oldCsv) {
    localStorage.setItem(MIGRATION_COMPLETE_KEY, 'true');
    return { migrated: true, rowCount: 0, message: 'No localStorage data to migrate' };
  }

  // Parse the old CSV data
  const rows = parseOldCsv(oldCsv);
  if (rows.length === 0) {
    localStorage.setItem(MIGRATION_COMPLETE_KEY, 'true');
    return { migrated: true, rowCount: 0, message: 'No valid rows in localStorage' };
  }

  console.log(`[HistoryDB] Migrating ${rows.length} rows from localStorage to IndexedDB...`);

  try {
    // Append all rows to IndexedDB
    await appendRows(rows);

    // Save backup metadata
    const latestTimestamp = rows.reduce(
      (latest, row) => (row.timestamp > latest ? row.timestamp : latest),
      rows[0].timestamp
    );
    saveBackupMetadata(rows.length, latestTimestamp);

    // Mark migration complete
    localStorage.setItem(MIGRATION_COMPLETE_KEY, 'true');

    // Clear old localStorage data (keep a backup just in case)
    const backupKey = OLD_HISTORY_KEY + '_backup';
    localStorage.setItem(backupKey, oldCsv);
    localStorage.removeItem(OLD_HISTORY_KEY);

    console.log(`[HistoryDB] Migration complete: ${rows.length} rows migrated`);
    return {
      migrated: true,
      rowCount: rows.length,
      message: `Successfully migrated ${rows.length} rows from localStorage`
    };
  } catch (e) {
    console.error('[HistoryDB] Migration failed:', e);
    return {
      migrated: false,
      rowCount: 0,
      message: `Migration failed: ${e instanceof Error ? e.message : 'Unknown error'}`
    };
  }
}

/**
 * Parse the old CSV format from localStorage
 */
function parseOldCsv(csv: string): HistoryRow[] {
  const lines = csv.split('\n').filter((line) => line.trim());
  if (lines.length === 0) return [];

  // CSV headers (for reference)
  const expectedHeaders = [
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

  // Skip header if present
  const startIndex = lines[0] === expectedHeaders.join(',') ? 1 : 0;

  const rows: HistoryRow[] = [];
  for (let i = startIndex; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    if (row) {
      rows.push(row);
    }
  }

  return rows;
}

/**
 * Parse a single CSV line to HistoryRow
 */
function parseCsvLine(line: string): HistoryRow | null {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(parseField(current));
      current = '';
    } else {
      current += char;
    }
  }
  values.push(parseField(current));

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

function parseField(value: string): string {
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/""/g, '"');
  }
  return value;
}

// ============================================================================
// CLOSE / CLEANUP
// ============================================================================

/**
 * Close the database connection
 */
export function closeHistoryDatabase(): void {
  if (db) {
    db.close();
    db = null;
    dbOpenPromise = null;
  }
}

/**
 * Delete the entire database
 * WARNING: This removes all history permanently
 */
export async function deleteHistoryDatabase(): Promise<void> {
  closeHistoryDatabase();
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      localStorage.removeItem(MIGRATION_COMPLETE_KEY);
      console.log('[HistoryDB] Database deleted');
      resolve();
    };
  });
}
