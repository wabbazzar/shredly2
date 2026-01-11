/**
 * Schedule Tab Types for Shredly 2.0
 *
 * Extends ParameterizedWorkout with GUI-specific metadata for schedule management.
 * CRITICAL: Zero drift - the core ParameterizedWorkout structure is UNCHANGED.
 */

import type { ParameterizedWorkout, ParameterizedDay, ParameterizedExercise } from '$lib/engine/types';

/**
 * Weekday index (0=Monday, 6=Sunday)
 */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Maps workout day numbers to weekdays
 * Key: workout day number (1-based, e.g., "1", "2", "3")
 * Value: weekday index (0=Monday, 6=Sunday)
 */
export interface DayMapping {
  [dayNumber: string]: Weekday;
}

/**
 * Schedule-specific metadata (GUI-only, not part of engine output)
 */
export interface ScheduleMetadata {
  /** Is this the active schedule */
  isActive: boolean;
  /** ISO date string "2026-01-13" for Day 1 of the program */
  startDate: string;
  /** ISO timestamp when schedule was created */
  createdAt: string;
  /** ISO timestamp when schedule was last modified */
  updatedAt: string;
  /** User's current progress - which week they're on (1-based) */
  currentWeek: number;
  /** User's current progress - which day they're on (1-based) */
  currentDay: number;
  /** Maps workout day numbers to weekdays (0=Monday, 6=Sunday) */
  dayMapping?: DayMapping;
}

/**
 * Stored format wraps ParameterizedWorkout with schedule metadata.
 * The core ParameterizedWorkout structure is UNCHANGED from engine output.
 *
 * ZERO DRIFT: We extend ParameterizedWorkout and add scheduleMetadata as a
 * separate nested object. This preserves the exact engine output structure.
 */
export interface StoredSchedule extends ParameterizedWorkout {
  /** GUI-only metadata for schedule management */
  scheduleMetadata: ScheduleMetadata;
}

/**
 * Edit scope for broadcasting changes across weeks.
 *
 * - all_weeks: Apply to all weeks in the program
 * - this_week_and_remaining: Apply to current week and all future weeks
 * - this_instance_only: Apply only to this specific week
 */
export type EditScope = 'all_weeks' | 'this_week_and_remaining' | 'this_instance_only';

/**
 * Edit preference stored in localStorage
 */
export interface EditPreferences {
  /** Default scope for edit operations */
  defaultScope: EditScope;
  /** Whether to remember the user's scope choice for this session */
  rememberChoice: boolean;
}

/**
 * View level for schedule navigation (drill-down)
 */
export type ViewLevel = 'calendar' | 'week' | 'day';

/**
 * Schedule view state - tracks current navigation position
 */
export interface ScheduleViewState {
  /** Current view level in the drill-down hierarchy */
  viewLevel: ViewLevel;
  /** Selected week number (1-based) */
  selectedWeek: number;
  /** Selected day number (1-based, day number in program, not calendar day) */
  selectedDay: number;
  /** Whether currently in edit mode */
  isEditing: boolean;
  /** Whether showing library view vs detail view */
  showLibrary: boolean;
}

/**
 * Schedule action types for the main schedule tab
 */
export type ScheduleAction = 'create' | 'load' | 'view';

/**
 * Modal state for schedule modals
 */
export interface ScheduleModalState {
  /** Which modal is currently open */
  activeModal: 'none' | 'create' | 'load' | 'editScope' | 'exerciseBrowser';
  /** Context data for the modal (varies by modal type) */
  context?: Record<string, unknown>;
}

/**
 * Helper type for week keys in ParameterizedExercise
 */
export type WeekKey = 'week1' | 'week2' | 'week3' | 'week4' | 'week5' | 'week6' | 'week8' | 'week12' | 'week16';

/**
 * Helper function to get week key from week number
 */
export function getWeekKey(weekNumber: number): WeekKey {
  return `week${weekNumber}` as WeekKey;
}

/**
 * Helper function to get valid week keys for a given program duration
 */
export function getValidWeekKeys(weeks: number): WeekKey[] {
  const allWeeks: WeekKey[] = ['week1', 'week2', 'week3', 'week4', 'week5', 'week6', 'week8', 'week12', 'week16'];
  return allWeeks.filter(key => {
    const weekNum = parseInt(key.replace('week', ''));
    return weekNum <= weeks;
  });
}

/**
 * Re-export types from engine for convenience
 */
export type { ParameterizedWorkout, ParameterizedDay, ParameterizedExercise };
