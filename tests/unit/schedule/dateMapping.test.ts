/**
 * Unit tests for date mapping utilities
 */
import { describe, it, expect } from 'vitest';
import {
  getProgramDayDate,
  getWeekDateRange,
  formatDateRange,
  formatDayDate,
  formatDayDateShort,
  isToday,
  isPast,
  getWeekdayName,
  getProgramDayForDate
} from '../../../src/lib/utils/dateMapping.js';

describe('dateMapping', () => {
  // Use a fixed start date for predictable tests
  const startDate = '2026-01-13'; // A Monday

  describe('getProgramDayDate', () => {
    it('should return start date for day 1', () => {
      const result = getProgramDayDate(startDate, 1, 3);
      expect(result.toISOString().split('T')[0]).toBe('2026-01-13');
    });

    it('should return correct date for day 2 in 3-day program', () => {
      const result = getProgramDayDate(startDate, 2, 3);
      expect(result.toISOString().split('T')[0]).toBe('2026-01-14');
    });

    it('should return correct date for day 3 in 3-day program', () => {
      const result = getProgramDayDate(startDate, 3, 3);
      expect(result.toISOString().split('T')[0]).toBe('2026-01-15');
    });

    it('should handle week rollover correctly for 3-day program', () => {
      // Day 4 should be in week 2, which starts 7 calendar days after week 1
      const result = getProgramDayDate(startDate, 4, 3);
      expect(result.toISOString().split('T')[0]).toBe('2026-01-20');
    });

    it('should handle 5-day program correctly', () => {
      // Day 5 = last day of week 1 (Friday Jan 17)
      const result = getProgramDayDate(startDate, 5, 5);
      expect(result.toISOString().split('T')[0]).toBe('2026-01-17');
    });

    it('should handle 5-day program week 2', () => {
      // Day 6 = first day of week 2 (Monday Jan 20)
      const result = getProgramDayDate(startDate, 6, 5);
      expect(result.toISOString().split('T')[0]).toBe('2026-01-20');
    });
  });

  describe('getWeekDateRange', () => {
    it('should return correct range for week 1', () => {
      const result = getWeekDateRange(startDate, 1);
      expect(result.start.toISOString().split('T')[0]).toBe('2026-01-13');
      expect(result.end.toISOString().split('T')[0]).toBe('2026-01-19');
    });

    it('should return correct range for week 2', () => {
      const result = getWeekDateRange(startDate, 2);
      expect(result.start.toISOString().split('T')[0]).toBe('2026-01-20');
      expect(result.end.toISOString().split('T')[0]).toBe('2026-01-26');
    });

    it('should return correct range for week 4', () => {
      const result = getWeekDateRange(startDate, 4);
      expect(result.start.toISOString().split('T')[0]).toBe('2026-02-03');
      expect(result.end.toISOString().split('T')[0]).toBe('2026-02-09');
    });
  });

  describe('formatDateRange', () => {
    it('should format same-month range correctly', () => {
      const start = new Date(2026, 0, 13); // Jan 13, 2026
      const end = new Date(2026, 0, 19);   // Jan 19, 2026
      expect(formatDateRange(start, end)).toBe('Jan 13-19');
    });

    it('should format cross-month range correctly', () => {
      const start = new Date(2026, 0, 27); // Jan 27, 2026
      const end = new Date(2026, 1, 2);    // Feb 2, 2026
      expect(formatDateRange(start, end)).toBe('Jan 27 - Feb 2');
    });
  });

  describe('formatDayDate', () => {
    it('should include weekday, month and day number', () => {
      const date = new Date(2026, 0, 13); // Jan 13, 2026 (Tuesday locally)
      const result = formatDayDate(date);
      // Check format includes expected parts - exact weekday depends on timezone
      expect(result).toContain('Jan');
      expect(result).toContain('13');
      // Should have a weekday name
      expect(result).toMatch(/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/);
    });
  });

  describe('formatDayDateShort', () => {
    it('should format with short weekday', () => {
      const date = new Date(2026, 0, 13); // Jan 13, 2026
      const result = formatDayDateShort(date);
      expect(result).toContain('Jan');
      expect(result).toContain('13');
      // Should have a short weekday name
      expect(result).toMatch(/Mon|Tue|Wed|Thu|Fri|Sat|Sun/);
    });
  });

  describe('isToday', () => {
    it('should return true for today', () => {
      const today = new Date();
      expect(isToday(today)).toBe(true);
    });

    it('should return false for yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(isToday(yesterday)).toBe(false);
    });
  });

  describe('isPast', () => {
    it('should return true for yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(isPast(yesterday)).toBe(true);
    });

    it('should return false for tomorrow', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(isPast(tomorrow)).toBe(false);
    });

    it('should return false for today', () => {
      const today = new Date();
      expect(isPast(today)).toBe(false);
    });
  });

  describe('getWeekdayName', () => {
    it('should return a valid weekday name', () => {
      const date = new Date(2026, 0, 16); // Jan 16, 2026
      const result = getWeekdayName(date);
      expect(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']).toContain(result);
    });

    it('should return Friday for new Date(2026, 0, 16)', () => {
      const date = new Date(2026, 0, 16); // Jan 16, 2026 is a Friday
      expect(getWeekdayName(date)).toBe('Friday');
    });
  });

  describe('getProgramDayForDate', () => {
    it('should return program day number for valid workout day', () => {
      // Use the dates returned by getProgramDayDate to ensure consistency
      const day1Date = getProgramDayDate(startDate, 1, 3);
      const result = getProgramDayForDate(startDate, day1Date, 3);
      expect(result).toBe(1);
    });

    it('should return sequential day numbers', () => {
      const day2Date = getProgramDayDate(startDate, 2, 3);
      const result = getProgramDayForDate(startDate, day2Date, 3);
      expect(result).toBe(2);
    });

    it('should return null for rest day in 3-day program', () => {
      // Day 4 in a 3-day week is a rest day
      const day1Date = getProgramDayDate(startDate, 1, 3);
      const restDay = new Date(day1Date);
      restDay.setDate(restDay.getDate() + 3); // 4th day of calendar week
      const result = getProgramDayForDate(startDate, restDay, 3);
      expect(result).toBeNull();
    });

    it('should handle week 2 correctly', () => {
      const day4Date = getProgramDayDate(startDate, 4, 3);
      const result = getProgramDayForDate(startDate, day4Date, 3);
      expect(result).toBe(4);
    });
  });
});
