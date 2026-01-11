/**
 * Schedule View Utilities
 *
 * Pure functions for calendar and week view calculations.
 * Extracted from Svelte components for testability.
 */

import type { StoredSchedule, DayMapping, Weekday } from '$lib/types/schedule';
import type { ParameterizedDay, ParameterizedExercise, WeekParameters } from '$lib/engine/types';

// ============================================================================
// TYPES
// ============================================================================

export interface CalendarDate {
  date: Date;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  workoutDay: number | null;
  weekday: Weekday;
}

export interface CalendarWeek {
  weekNumber: number;
  dates: CalendarDate[];
}

export interface CalendarMonth {
  year: number;
  month: number;
  name: string;
  weeks: CalendarWeek[];
}

export interface WeekDay {
  weekday: Weekday;
  weekdayName: string;
  weekdayShort: string;
  date: Date;
  workoutDay: number | null;
  dayData: ParameterizedDay | null;
}

export type WeekOverrides = { [weekNum: string]: DayMapping };

// ============================================================================
// DATE UTILITIES
// ============================================================================

/**
 * Parse an ISO date string (YYYY-MM-DD) as a local date
 * Avoids timezone issues with new Date('YYYY-MM-DD')
 */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

/**
 * Get Monday of the week containing a date
 * Returns a new Date set to midnight on that Monday
 */
export function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // JavaScript: 0=Sunday, 1=Monday, ... 6=Saturday
  // We want Monday as 0
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get the Monday for a specific week number in a program
 */
export function getWeekStartDate(programStart: Date, weekNumber: number): Date {
  const monday = getMondayOfWeek(programStart);
  const result = new Date(monday);
  result.setDate(result.getDate() + (weekNumber - 1) * 7);
  return result;
}

/**
 * Format date range for week display
 */
export function formatWeekDateRange(weekStart: Date): string {
  const endDate = new Date(weekStart);
  endDate.setDate(endDate.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${weekStart.toLocaleDateString('en-US', opts)} - ${endDate.toLocaleDateString('en-US', opts)}`;
}

// ============================================================================
// DAY MAPPING UTILITIES
// ============================================================================

/**
 * Get global day mapping from schedule (or default if not set)
 * Default: days 1, 2, 3... map to Mon, Tue, Wed...
 */
export function getGlobalDayMapping(schedule: StoredSchedule): DayMapping {
  if (schedule.scheduleMetadata.dayMapping) {
    return schedule.scheduleMetadata.dayMapping;
  }
  const mapping: DayMapping = {};
  for (let i = 1; i <= schedule.daysPerWeek; i++) {
    mapping[i.toString()] = ((i - 1) % 7) as Weekday;
  }
  return mapping;
}

/**
 * Get week-specific overrides from schedule metadata
 */
export function getWeekOverrides(schedule: StoredSchedule): WeekOverrides {
  return (schedule.scheduleMetadata as any).weekOverrides || {};
}

/**
 * Get effective day mapping for a specific week
 * Combines global mapping with week-specific overrides
 */
export function getEffectiveDayMapping(schedule: StoredSchedule, weekNumber: number): DayMapping {
  const globalMapping = getGlobalDayMapping(schedule);
  const overrides = getWeekOverrides(schedule);
  const weekOverride = overrides[weekNumber.toString()];

  if (weekOverride) {
    return { ...globalMapping, ...weekOverride };
  }
  return globalMapping;
}

/**
 * Build reverse mapping: weekday index -> workout day number
 */
export function buildWeekdayToWorkoutDayMap(
  dayMapping: DayMapping,
  workoutDaysInWeek: number[]
): { [weekday: number]: number } {
  const mapping: { [key: number]: number } = {};
  for (const [dayNum, weekday] of Object.entries(dayMapping)) {
    const dayNumber = parseInt(dayNum);
    if (workoutDaysInWeek.includes(dayNumber)) {
      mapping[weekday] = dayNumber;
    }
  }
  return mapping;
}

/**
 * Get workout day numbers (always 1 to daysPerWeek).
 * The schedule has days["1"], days["2"], etc. - same structure for all weeks.
 * Week number affects which week parameters are shown (week1, week2, etc.), not day keys.
 *
 * Note: weekNumber param is kept for API compatibility but is not used.
 */
export function getWorkoutDaysInWeek(_weekNumber: number, daysPerWeek: number): number[] {
  const days: number[] = [];
  for (let i = 1; i <= daysPerWeek; i++) {
    days.push(i);
  }
  return days;
}

// ============================================================================
// CALENDAR GENERATION
// ============================================================================

/**
 * Generate calendar data for the entire program
 */
export function generateCalendarData(
  dayMapping: DayMapping,
  mondayStart: Date,
  numWeeks: number
): CalendarMonth[] {
  const months: CalendarMonth[] = [];

  // Create reverse mapping: weekday -> workout day
  const weekdayToWorkoutDay: { [key: number]: number } = {};
  for (const [dayNum, weekday] of Object.entries(dayMapping)) {
    weekdayToWorkoutDay[weekday] = parseInt(dayNum);
  }

  let currentMonday = new Date(mondayStart);
  let currentMonthData: CalendarMonth | null = null;

  for (let week = 1; week <= numWeeks; week++) {
    const mondayMonth = currentMonday.getMonth();
    const mondayYear = currentMonday.getFullYear();

    // Check if we need a new month header
    if (!currentMonthData || currentMonthData.month !== mondayMonth || currentMonthData.year !== mondayYear) {
      if (currentMonthData && currentMonthData.weeks.length > 0) {
        months.push(currentMonthData);
      }
      currentMonthData = {
        year: mondayYear,
        month: mondayMonth,
        name: currentMonday.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        weeks: []
      };
    }

    const weekDates: CalendarDate[] = [];

    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      const date = new Date(currentMonday);
      date.setDate(currentMonday.getDate() + dayOfWeek);

      const workoutDay = weekdayToWorkoutDay[dayOfWeek as Weekday] ?? null;

      weekDates.push({
        date,
        dayOfMonth: date.getDate(),
        isCurrentMonth: date.getMonth() === mondayMonth,
        workoutDay,
        weekday: dayOfWeek as Weekday
      });
    }

    if (currentMonthData) {
      currentMonthData.weeks.push({
        weekNumber: week,
        dates: weekDates
      });
    }

    // Move to next week
    currentMonday.setDate(currentMonday.getDate() + 7);
  }

  // Don't forget the last month
  if (currentMonthData && currentMonthData.weeks.length > 0) {
    months.push(currentMonthData);
  }

  return months;
}

// ============================================================================
// WEEK VIEW GENERATION
// ============================================================================

const WEEKDAYS_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
const WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/**
 * Generate week view data for a specific week
 */
export function generateWeekViewData(
  schedule: StoredSchedule,
  weekNumber: number
): WeekDay[] {
  const startDate = parseLocalDate(schedule.scheduleMetadata.startDate);
  const programStart = getMondayOfWeek(startDate);
  const weekStartDate = getWeekStartDate(programStart, weekNumber);

  const dayMapping = getEffectiveDayMapping(schedule, weekNumber);
  const workoutDaysInWeek = getWorkoutDaysInWeek(weekNumber, schedule.daysPerWeek);
  const weekdayToWorkoutDay = buildWeekdayToWorkoutDayMap(dayMapping, workoutDaysInWeek);

  const days: WeekDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStartDate);
    date.setDate(weekStartDate.getDate() + i);

    const workoutDayNum = weekdayToWorkoutDay[i] ?? null;
    const dayData = workoutDayNum ? schedule.days[workoutDayNum.toString()] : null;

    days.push({
      weekday: i as Weekday,
      weekdayName: WEEKDAYS_FULL[i],
      weekdayShort: WEEKDAYS_SHORT[i],
      date,
      workoutDay: workoutDayNum,
      dayData
    });
  }

  return days;
}

// ============================================================================
// DAY SWAPPING
// ============================================================================

/**
 * Swap day mapping for all weeks (global change)
 */
export function swapDayMappingGlobal(
  schedule: StoredSchedule,
  draggedDay: number,
  targetWeekday: Weekday
): StoredSchedule {
  const currentMapping = getGlobalDayMapping(schedule);
  const newMapping = { ...currentMapping };

  // Find if another workout day already occupies the target weekday
  const existingDayAtTarget = Object.entries(newMapping).find(
    ([_, weekday]) => weekday === targetWeekday
  );

  if (existingDayAtTarget) {
    const existingDayNum = parseInt(existingDayAtTarget[0]);
    if (existingDayNum !== draggedDay) {
      // Swap the days
      const draggedDayWeekday = newMapping[draggedDay.toString()];
      newMapping[existingDayNum.toString()] = draggedDayWeekday;
    }
  }

  newMapping[draggedDay.toString()] = targetWeekday;

  return {
    ...schedule,
    scheduleMetadata: {
      ...schedule.scheduleMetadata,
      dayMapping: newMapping,
      updatedAt: new Date().toISOString()
    }
  };
}

/**
 * Swap day mapping for a specific week only
 */
export function swapDayMappingForWeek(
  schedule: StoredSchedule,
  weekNumber: number,
  sourceWeekday: Weekday,
  targetWeekday: Weekday
): StoredSchedule {
  const globalMapping = getGlobalDayMapping(schedule);
  const weekOverrides = getWeekOverrides(schedule);
  const currentWeekMapping = { ...globalMapping, ...(weekOverrides[weekNumber.toString()] || {}) };

  const workoutDaysInWeek = getWorkoutDaysInWeek(weekNumber, schedule.daysPerWeek);
  const weekdayToWorkoutDay = buildWeekdayToWorkoutDayMap(currentWeekMapping, workoutDaysInWeek);

  const sourceWorkoutDay = weekdayToWorkoutDay[sourceWeekday];
  const targetWorkoutDay = weekdayToWorkoutDay[targetWeekday];

  const newWeekMapping: DayMapping = { ...currentWeekMapping };

  if (sourceWorkoutDay !== undefined && targetWorkoutDay !== undefined) {
    // Swap the weekdays
    newWeekMapping[sourceWorkoutDay.toString()] = targetWeekday;
    newWeekMapping[targetWorkoutDay.toString()] = sourceWeekday;
  } else if (sourceWorkoutDay !== undefined) {
    // Move source to target (target is rest day)
    newWeekMapping[sourceWorkoutDay.toString()] = targetWeekday;
  }

  const updatedWeekOverrides: WeekOverrides = { ...weekOverrides };
  updatedWeekOverrides[weekNumber.toString()] = newWeekMapping;

  return {
    ...schedule,
    scheduleMetadata: {
      ...schedule.scheduleMetadata,
      weekOverrides: updatedWeekOverrides,
      updatedAt: new Date().toISOString()
    } as any
  };
}

// ============================================================================
// EXERCISE DISPLAY UTILITIES
// ============================================================================

/**
 * Format exercise parameters for display (high-level summary)
 */
export function formatExerciseParams(exercise: ParameterizedExercise, weekNumber: number): string {
  const weekKey = `week${weekNumber}` as keyof ParameterizedExercise;
  const params = exercise[weekKey] as WeekParameters | undefined;
  if (!params) return '';

  const parts: string[] = [];
  if (params.sets && params.reps) {
    parts.push(`${params.sets}x${params.reps}`);
  } else if (params.work_time_minutes) {
    if (params.work_time_unit === 'seconds') {
      parts.push(`${Math.round(params.work_time_minutes * 60)}s`);
    } else {
      parts.push(`${params.work_time_minutes}min`);
    }
  }
  return parts.join(' ');
}

/**
 * Get workout day info for calendar display
 */
export function getWorkoutDayInfo(
  schedule: StoredSchedule,
  dayNumber: number
): { focus: string; exerciseCount: number } | null {
  const day = schedule.days[dayNumber.toString()];
  if (!day) return null;
  return {
    focus: day.focus,
    exerciseCount: day.exercises.length
  };
}
