/**
 * Date Mapping Utilities for Schedule Tab
 *
 * Maps program days/weeks to actual calendar dates based on start date.
 */

/**
 * Get the actual calendar date for a program day.
 *
 * Day numbering: Program day 1 is the start date.
 * Days are consecutive within the program (Day 1, Day 2, etc.).
 * The weekNumber parameter helps calculate which calendar week.
 *
 * @param startDate - ISO date string for Day 1 (e.g., "2026-01-13")
 * @param programDayNumber - The day number in the program (1-based)
 * @param daysPerWeek - How many workout days per week
 * @returns Date object for this program day
 */
export function getProgramDayDate(startDate: string, programDayNumber: number, daysPerWeek: number): Date {
  const start = new Date(startDate);

  // Calculate which week this day is in (0-based for calculation)
  const weekIndex = Math.floor((programDayNumber - 1) / daysPerWeek);

  // Calculate which day within the week (0-based)
  const dayInWeek = (programDayNumber - 1) % daysPerWeek;

  // Each week is 7 calendar days
  // Add the week offset plus the day within week
  const totalCalendarDays = weekIndex * 7 + dayInWeek;

  const result = new Date(start);
  result.setDate(start.getDate() + totalCalendarDays);
  return result;
}

/**
 * Get the start and end calendar dates for a program week.
 *
 * @param startDate - ISO date string for Day 1
 * @param weekNumber - Which week (1-based)
 * @returns Object with start and end Date objects
 */
export function getWeekDateRange(startDate: string, weekNumber: number): { start: Date; end: Date } {
  const start = new Date(startDate);

  // Week 1 starts on startDate
  // Week 2 starts 7 days later, etc.
  const weekStart = new Date(start);
  weekStart.setDate(start.getDate() + (weekNumber - 1) * 7);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  return { start: weekStart, end: weekEnd };
}

/**
 * Format a date range as "Jan 13-19" or "Jan 28 - Feb 3" if crossing months.
 *
 * @param start - Start date
 * @param end - End date
 * @returns Formatted string
 */
export function formatDateRange(start: Date, end: Date): string {
  const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
  const startDay = start.getDate();
  const endDay = end.getDate();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay}-${endDay}`;
  }
  return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
}

/**
 * Format a single date as "Monday, Jan 20".
 *
 * @param date - Date to format
 * @returns Formatted string
 */
export function formatDayDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Format a single date as "Mon, Jan 20" (short weekday).
 *
 * @param date - Date to format
 * @returns Formatted string with short weekday
 */
export function formatDayDateShort(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Check if a date is today.
 *
 * @param date - Date to check
 * @returns true if the date is today
 */
export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

/**
 * Check if a date is in the past.
 *
 * @param date - Date to check
 * @returns true if the date is before today
 */
export function isPast(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  return checkDate < today;
}

/**
 * Get the weekday name for a date.
 *
 * @param date - Date to get weekday for
 * @returns Weekday name (e.g., "Monday")
 */
export function getWeekdayName(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

/**
 * Calculate which program day a calendar date falls on.
 *
 * @param startDate - ISO date string for Day 1
 * @param targetDate - The calendar date to check
 * @param daysPerWeek - How many workout days per week
 * @returns Program day number, or null if it's a rest day
 */
export function getProgramDayForDate(
  startDate: string,
  targetDate: Date,
  daysPerWeek: number
): number | null {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);

  // Calculate days since start
  const daysSinceStart = Math.floor((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSinceStart < 0) return null;

  // Calculate which calendar week (0-based)
  const weekIndex = Math.floor(daysSinceStart / 7);

  // Calculate day within calendar week (0-based, 0 = start day of week)
  const dayInCalendarWeek = daysSinceStart % 7;

  // If day in calendar week is >= daysPerWeek, it's a rest day
  if (dayInCalendarWeek >= daysPerWeek) {
    return null;
  }

  // Calculate program day number (1-based)
  return weekIndex * daysPerWeek + dayInCalendarWeek + 1;
}
