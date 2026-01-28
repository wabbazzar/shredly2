/**
 * Schedule Store - Manages schedule state and view navigation
 *
 * Provides reactive stores for:
 * - Active schedule
 * - Schedule library (all saved schedules)
 * - View state (calendar/week/day navigation)
 * - Edit preferences
 *
 * Integrates with IndexedDB for persistence via scheduleDb.ts
 */

import { writable, derived, get } from 'svelte/store';
import type {
  StoredSchedule,
  ScheduleViewState,
  EditPreferences,
  EditScope,
  ViewLevel,
  ScheduleModalState,
  WeekKey
} from '$lib/types/schedule';
import type { ParameterizedDay, ParameterizedExercise } from '$lib/engine/types';
import {
  getAllSchedules,
  getActiveSchedule,
  saveSchedule,
  deleteSchedule as dbDeleteSchedule,
  setActiveSchedule as dbSetActiveSchedule,
  duplicateSchedule as dbDuplicateSchedule
} from './scheduleDb';

// Browser check
const isBrowser = typeof window !== 'undefined';

// ============================================================================
// STORAGE KEYS
// ============================================================================

const EDIT_PREFERENCES_KEY = 'shredly_edit_preferences';
const VIEW_STATE_KEY = 'shredly_view_state';

// ============================================================================
// DEFAULT VALUES
// ============================================================================

const DEFAULT_VIEW_STATE: ScheduleViewState = {
  viewLevel: 'week',
  selectedWeek: 1,
  selectedDay: 1,
  isEditing: false,
  showLibrary: true
};

const DEFAULT_EDIT_PREFERENCES: EditPreferences = {
  defaultScope: 'all_weeks',
  rememberChoice: false
};

const DEFAULT_MODAL_STATE: ScheduleModalState = {
  activeModal: 'none',
  context: undefined
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function loadEditPreferences(): EditPreferences {
  if (!isBrowser) return DEFAULT_EDIT_PREFERENCES;

  try {
    const stored = localStorage.getItem(EDIT_PREFERENCES_KEY);
    if (stored) {
      return JSON.parse(stored) as EditPreferences;
    }
  } catch (e) {
    console.error('Failed to load edit preferences:', e);
  }

  return DEFAULT_EDIT_PREFERENCES;
}

function saveEditPreferences(prefs: EditPreferences): void {
  if (!isBrowser) return;

  try {
    localStorage.setItem(EDIT_PREFERENCES_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.error('Failed to save edit preferences:', e);
  }
}

function loadViewState(): ScheduleViewState {
  if (!isBrowser) return DEFAULT_VIEW_STATE;

  try {
    const stored = localStorage.getItem(VIEW_STATE_KEY);
    if (stored) {
      return JSON.parse(stored) as ScheduleViewState;
    }
  } catch (e) {
    console.error('Failed to load view state:', e);
  }

  return DEFAULT_VIEW_STATE;
}

function saveViewState(state: ScheduleViewState): void {
  if (!isBrowser) return;

  try {
    localStorage.setItem(VIEW_STATE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save view state:', e);
  }
}

// ============================================================================
// STORES
// ============================================================================

/**
 * The currently active schedule (or null if none)
 */
export const activeSchedule = writable<StoredSchedule | null>(null);

/**
 * All saved schedules
 */
export const scheduleLibrary = writable<StoredSchedule[]>([]);

/**
 * Current view state (navigation position)
 */
export const viewState = writable<ScheduleViewState>(loadViewState());

// Auto-save view state on changes
viewState.subscribe((state) => {
  saveViewState(state);
});

/**
 * Edit preferences (scope defaults)
 */
export const editPreferences = writable<EditPreferences>(loadEditPreferences());

// Auto-save edit preferences on changes
editPreferences.subscribe((prefs) => {
  saveEditPreferences(prefs);
});

/**
 * Modal state for schedule modals
 */
export const modalState = writable<ScheduleModalState>(DEFAULT_MODAL_STATE);

/**
 * Loading state for async operations
 */
export const isLoading = writable<boolean>(false);

/**
 * Initialization state - prevents duplicate IndexedDB queries
 */
let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

// ============================================================================
// DERIVED STORES
// ============================================================================

/**
 * Get exercises for the selected week
 */
export const currentWeekData = derived(
  [activeSchedule, viewState],
  ([$schedule, $view]): { dayNumber: number; day: ParameterizedDay }[] | null => {
    if (!$schedule) return null;

    const daysPerWeek = $schedule.daysPerWeek;
    const weekStart = ($view.selectedWeek - 1) * daysPerWeek + 1;
    const weekEnd = weekStart + daysPerWeek - 1;

    const weekDays: { dayNumber: number; day: ParameterizedDay }[] = [];
    for (let d = weekStart; d <= weekEnd; d++) {
      const day = $schedule.days[d.toString()];
      if (day) {
        weekDays.push({ dayNumber: d, day });
      }
    }

    return weekDays;
  }
);

/**
 * Get data for the selected day
 */
export const currentDayData = derived(
  [activeSchedule, viewState],
  ([$schedule, $view]): ParameterizedDay | null => {
    if (!$schedule) return null;
    return $schedule.days[$view.selectedDay.toString()] || null;
  }
);

/**
 * Get exercises for the current day with week parameters
 */
export const currentDayExercises = derived(
  [activeSchedule, viewState],
  ([$schedule, $view]): ParameterizedExercise[] | null => {
    if (!$schedule) return null;
    const day = $schedule.days[$view.selectedDay.toString()];
    return day?.exercises || null;
  }
);

/**
 * Whether there is an active schedule
 */
export const hasActiveSchedule = derived(
  activeSchedule,
  ($schedule) => $schedule !== null
);

/**
 * Count of saved schedules
 */
export const scheduleCount = derived(
  scheduleLibrary,
  ($library) => $library.length
);

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Initialize stores from IndexedDB
 * Call this on app startup - uses guard pattern to prevent duplicate queries
 */
export async function initializeScheduleStore(): Promise<void> {
  // Skip if already initialized
  if (isInitialized) return;

  // Return existing promise if initialization is in progress
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    isLoading.set(true);
    try {
      const [schedules, active] = await Promise.all([
        getAllSchedules(),
        getActiveSchedule()
      ]);

      scheduleLibrary.set(schedules);
      activeSchedule.set(active);

      // Default to current calendar week for active schedule
      if (active) {
        const currentWeek = calculateCurrentWeek(active);
        viewState.update(s => ({
          ...s,
          selectedWeek: currentWeek
        }));
      }

      isInitialized = true;
    } catch (e) {
      console.error('Failed to initialize schedule store:', e);
    } finally {
      isLoading.set(false);
      initializationPromise = null;
    }
  })();

  return initializationPromise;
}

/**
 * Set a schedule as active
 */
export async function setActiveSchedule(id: string): Promise<void> {
  isLoading.set(true);
  try {
    await dbSetActiveSchedule(id);

    // Update stores
    const schedules = await getAllSchedules();
    scheduleLibrary.set(schedules);
    const schedule = schedules.find(s => s.id === id) || null;
    activeSchedule.set(schedule);

    // Navigate to week view, defaulting to current calendar week
    const currentWeek = schedule ? calculateCurrentWeek(schedule) : 1;
    viewState.update(s => ({
      ...s,
      viewLevel: 'week',
      selectedWeek: currentWeek,
      selectedDay: 1
    }));
  } catch (e) {
    console.error('Failed to set active schedule:', e);
  } finally {
    isLoading.set(false);
  }
}

/**
 * Save a schedule (create or update)
 */
export async function saveScheduleToDb(schedule: StoredSchedule): Promise<void> {
  isLoading.set(true);
  try {
    await saveSchedule(schedule);

    // Update stores
    const schedules = await getAllSchedules();
    scheduleLibrary.set(schedules);

    // If this is the active schedule, update that too
    const currentActive = get(activeSchedule);
    if (schedule.scheduleMetadata.isActive || currentActive?.id === schedule.id) {
      activeSchedule.set(schedule);
    }
  } catch (e) {
    console.error('Failed to save schedule:', e);
    throw e;
  } finally {
    isLoading.set(false);
  }
}

/**
 * Delete a schedule
 */
export async function deleteScheduleFromDb(id: string): Promise<void> {
  isLoading.set(true);
  try {
    await dbDeleteSchedule(id);

    // Update stores
    const schedules = await getAllSchedules();
    scheduleLibrary.set(schedules);

    // If we deleted the active schedule, clear it
    const current = get(activeSchedule);
    if (current?.id === id) {
      activeSchedule.set(null);
    }
  } catch (e) {
    console.error('Failed to delete schedule:', e);
    throw e;
  } finally {
    isLoading.set(false);
  }
}

/**
 * Duplicate a schedule
 */
export async function duplicateScheduleInDb(id: string, newName?: string): Promise<StoredSchedule> {
  isLoading.set(true);
  try {
    const duplicate = await dbDuplicateSchedule(id, newName);

    // Update stores
    const schedules = await getAllSchedules();
    scheduleLibrary.set(schedules);

    return duplicate;
  } catch (e) {
    console.error('Failed to duplicate schedule:', e);
    throw e;
  } finally {
    isLoading.set(false);
  }
}

/**
 * Rename a schedule
 */
export async function renameScheduleInDb(id: string, newName: string): Promise<void> {
  const schedules = get(scheduleLibrary);
  const schedule = schedules.find(s => s.id === id);
  if (!schedule) {
    throw new Error(`Schedule not found: ${id}`);
  }

  const updatedSchedule: StoredSchedule = {
    ...schedule,
    name: newName,
    scheduleMetadata: {
      ...schedule.scheduleMetadata,
      updatedAt: new Date().toISOString()
    }
  };

  await saveScheduleToDb(updatedSchedule);
}

/**
 * Navigate to a specific view level
 */
export function navigateToView(level: ViewLevel, week?: number, day?: number): void {
  viewState.update(s => ({
    ...s,
    viewLevel: level,
    selectedWeek: week ?? s.selectedWeek,
    selectedDay: day ?? s.selectedDay,
    isEditing: false
  }));
}

/**
 * Navigate to calendar view
 */
export function navigateToCalendar(): void {
  navigateToView('calendar');
}

/**
 * Navigate to week view
 */
export function navigateToWeek(weekNumber: number): void {
  navigateToView('week', weekNumber);
}

/**
 * Navigate to day view
 */
export function navigateToDay(weekNumber: number, dayNumber: number): void {
  navigateToView('day', weekNumber, dayNumber);
}

/**
 * Go back one level in navigation
 */
export function navigateBack(): void {
  const current = get(viewState);
  if (current.viewLevel === 'day') {
    navigateToView('week');
  } else if (current.viewLevel === 'week') {
    navigateToView('calendar');
  }
}

/**
 * Navigate up one level in the view hierarchy
 * Used when re-tapping the schedule tab
 * day -> week -> library
 * Returns true if navigation occurred, false if already at top level
 */
export function navigateUp(): boolean {
  const current = get(viewState);

  if (current.viewLevel === 'day') {
    navigateToView('week');
    return true;
  } else if (!current.showLibrary) {
    // At week view (or legacy calendar), go to library
    showLibraryView();
    return true;
  }

  // Already at library (top level)
  return false;
}

/**
 * Toggle edit mode
 */
export function toggleEditMode(): void {
  viewState.update(s => ({
    ...s,
    isEditing: !s.isEditing
  }));
}

/**
 * Set edit mode
 */
export function setEditMode(isEditing: boolean): void {
  viewState.update(s => ({
    ...s,
    isEditing
  }));
}

/**
 * Update edit preferences
 */
export function updateEditPreferences(updates: Partial<EditPreferences>): void {
  editPreferences.update(p => ({
    ...p,
    ...updates
  }));
}

/**
 * Open a modal
 */
export function openModal(modal: ScheduleModalState['activeModal'], context?: Record<string, unknown>): void {
  modalState.set({ activeModal: modal, context });
}

/**
 * Close the current modal
 */
export function closeModal(): void {
  modalState.set(DEFAULT_MODAL_STATE);
}

/**
 * Get week key for accessing week parameters
 */
export function getWeekKeyForView(): WeekKey {
  const state = get(viewState);
  return `week${state.selectedWeek}` as WeekKey;
}

/**
 * Calculate which week of the program we're currently in based on the schedule's start date
 * Returns 1 if before start date, totalWeeks if after program ends
 */
export function calculateCurrentWeek(schedule: StoredSchedule): number {
  const startDateStr = schedule.scheduleMetadata.startDate;
  if (!startDateStr) return 1;

  // Parse YYYY-MM-DD as local date (not UTC)
  const [year, month, day] = startDateStr.split('-').map(Number);
  const startDate = new Date(year, month - 1, day);
  startDate.setHours(0, 0, 0, 0);

  // Get Monday of start week
  const startDay = startDate.getDay();
  const startDiff = startDay === 0 ? -6 : 1 - startDay;
  const programStartMonday = new Date(startDate);
  programStartMonday.setDate(startDate.getDate() + startDiff);

  // Get today at midnight
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Calculate days since program start Monday
  const daysDiff = Math.floor((today.getTime() - programStartMonday.getTime()) / (1000 * 60 * 60 * 24));

  // If before program start, return week 1
  if (daysDiff < 0) return 1;

  // Calculate week number (1-indexed)
  const weekNumber = Math.floor(daysDiff / 7) + 1;

  // Clamp to valid range (1 to totalWeeks)
  const totalWeeks = schedule.weeks || 4;
  return Math.max(1, Math.min(weekNumber, totalWeeks));
}

/**
 * Show library view
 */
export function showLibraryView(): void {
  viewState.update(s => ({
    ...s,
    showLibrary: true
  }));
}

/**
 * Show schedule detail view
 */
export function showDetailView(): void {
  viewState.update(s => ({
    ...s,
    showLibrary: false
  }));
}
