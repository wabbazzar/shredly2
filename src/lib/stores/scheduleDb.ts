/**
 * IndexedDB Wrapper for Schedule Persistence
 *
 * Provides CRUD operations for StoredSchedule objects.
 * Uses raw IndexedDB API (no external dependencies).
 */

import type { StoredSchedule } from '$lib/types/schedule';

const DB_NAME = 'shredly-schedules';
const DB_VERSION = 1;
const STORE_NAME = 'schedules';

let db: IDBDatabase | null = null;

/**
 * Open the IndexedDB database, creating object stores if needed.
 * Returns cached connection if already open.
 */
export async function openDatabase(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Create schedules store with indexes
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('createdAt', 'scheduleMetadata.createdAt', { unique: false });
        store.createIndex('isActive', 'scheduleMetadata.isActive', { unique: false });
      }
    };
  });
}

/**
 * Save or update a schedule in IndexedDB.
 * Uses put() which handles both insert and update.
 */
export async function saveSchedule(schedule: StoredSchedule): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(schedule);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Get a single schedule by ID.
 * Returns null if not found.
 */
export async function getSchedule(id: string): Promise<StoredSchedule | null> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

/**
 * Get all saved schedules.
 * Returns empty array if none exist.
 */
export async function getAllSchedules(): Promise<StoredSchedule[]> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

/**
 * Delete a schedule by ID.
 */
export async function deleteSchedule(id: string): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Set one schedule as active, deactivating all others.
 * Also stores the active schedule ID in localStorage for quick access.
 */
export async function setActiveSchedule(id: string): Promise<void> {
  const schedules = await getAllSchedules();

  // Deactivate all, activate selected
  for (const schedule of schedules) {
    const wasActive = schedule.scheduleMetadata.isActive;
    const shouldBeActive = schedule.id === id;

    if (wasActive !== shouldBeActive) {
      schedule.scheduleMetadata.isActive = shouldBeActive;
      schedule.scheduleMetadata.updatedAt = new Date().toISOString();
      await saveSchedule(schedule);
    }
  }

  // Store in localStorage for quick access on page load
  if (typeof window !== 'undefined') {
    localStorage.setItem('shredly-active-schedule-id', id);
  }
}

/**
 * Get the active schedule ID from localStorage.
 * Returns null if none set.
 */
export function getActiveScheduleId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('shredly-active-schedule-id');
}

/**
 * Get the currently active schedule.
 * First checks localStorage for quick access, then verifies in IndexedDB.
 */
export async function getActiveSchedule(): Promise<StoredSchedule | null> {
  const activeId = getActiveScheduleId();
  if (!activeId) {
    // No cached ID, search all schedules
    const schedules = await getAllSchedules();
    return schedules.find(s => s.scheduleMetadata.isActive) || null;
  }

  const schedule = await getSchedule(activeId);
  if (schedule && schedule.scheduleMetadata.isActive) {
    return schedule;
  }

  // Cached ID is stale, search all schedules
  const schedules = await getAllSchedules();
  const active = schedules.find(s => s.scheduleMetadata.isActive);
  if (active) {
    // Update localStorage cache
    localStorage.setItem('shredly-active-schedule-id', active.id);
  }
  return active || null;
}

/**
 * Duplicate a schedule with a new ID and name.
 * The duplicate is not set as active.
 */
export async function duplicateSchedule(id: string, newName?: string): Promise<StoredSchedule> {
  const original = await getSchedule(id);
  if (!original) {
    throw new Error(`Schedule with ID ${id} not found`);
  }

  const duplicate: StoredSchedule = {
    ...structuredClone(original),
    id: `schedule_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    name: newName || `${original.name} (Copy)`,
    scheduleMetadata: {
      ...original.scheduleMetadata,
      isActive: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      currentWeek: 1,
      currentDay: 1
    }
  };

  await saveSchedule(duplicate);
  return duplicate;
}

/**
 * Update schedule progress (current week and day).
 */
export async function updateScheduleProgress(id: string, currentWeek: number, currentDay: number): Promise<void> {
  const schedule = await getSchedule(id);
  if (!schedule) {
    throw new Error(`Schedule with ID ${id} not found`);
  }

  schedule.scheduleMetadata.currentWeek = currentWeek;
  schedule.scheduleMetadata.currentDay = currentDay;
  schedule.scheduleMetadata.updatedAt = new Date().toISOString();
  await saveSchedule(schedule);
}

/**
 * Close the database connection.
 * Useful for testing or cleanup.
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Delete the entire database.
 * WARNING: This removes all schedules permanently.
 */
export async function deleteDatabase(): Promise<void> {
  closeDatabase();
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}
