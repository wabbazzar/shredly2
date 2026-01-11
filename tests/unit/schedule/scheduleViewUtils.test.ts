/**
 * Unit tests for schedule view utilities
 *
 * Tests calendar generation, week view data, day mapping, and swap operations
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getMondayOfWeek,
  getWeekStartDate,
  formatWeekDateRange,
  getGlobalDayMapping,
  getWeekOverrides,
  getEffectiveDayMapping,
  buildWeekdayToWorkoutDayMap,
  getWorkoutDaysInWeek,
  generateCalendarData,
  generateWeekViewData,
  swapDayMappingGlobal,
  swapDayMappingForWeek,
  formatExerciseParams,
  getWorkoutDayInfo,
  parseLocalDate
} from '../../../src/lib/utils/scheduleViewUtils.js';
import type { StoredSchedule, DayMapping, Weekday } from '../../../src/lib/types/schedule.js';
import type { ParameterizedExercise } from '../../../src/lib/engine/types.js';

// ============================================================================
// TEST FIXTURES
// ============================================================================

/**
 * Create a date at midnight local time
 * Avoids timezone issues with ISO date strings
 */
function createLocalDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function createTestSchedule(overrides?: Partial<StoredSchedule>): StoredSchedule {
  return {
    id: 'test-schedule-1',
    name: 'Test Schedule',
    version: '2.0.0',
    weeks: 4,
    daysPerWeek: 3,
    metadata: {
      goal: 'build_muscle',
      experience: 'intermediate',
      equipment: ['dumbbells', 'barbell']
    },
    days: {
      '1': {
        dayNumber: 1,
        focus: 'Push',
        type: 'training',
        exercises: [
          {
            name: 'Bench Press',
            week1: { sets: 3, reps: 10, rest_time_minutes: 2, rest_time_unit: 'minutes' },
            week2: { sets: 3, reps: 8 },
            week3: { sets: 4, reps: 6 },
            week4: { sets: 4, reps: 5 }
          } as ParameterizedExercise,
          {
            name: 'Shoulder Press',
            week1: { sets: 3, reps: 12 },
            week2: { sets: 3, reps: 10 },
            week3: { sets: 3, reps: 8 },
            week4: { sets: 4, reps: 6 }
          } as ParameterizedExercise
        ]
      },
      '2': {
        dayNumber: 2,
        focus: 'Pull',
        type: 'training',
        exercises: [
          {
            name: 'Deadlift',
            week1: { sets: 3, reps: 8 },
            week2: { sets: 3, reps: 6 },
            week3: { sets: 4, reps: 5 },
            week4: { sets: 4, reps: 4 }
          } as ParameterizedExercise
        ]
      },
      '3': {
        dayNumber: 3,
        focus: 'Legs',
        type: 'training',
        exercises: [
          {
            name: 'Squat',
            week1: { sets: 3, reps: 10 },
            week2: { sets: 3, reps: 8 },
            week3: { sets: 4, reps: 6 },
            week4: { sets: 4, reps: 5 }
          } as ParameterizedExercise
        ]
      }
    },
    scheduleMetadata: {
      isActive: true,
      startDate: '2026-01-12', // Monday, Jan 12, 2026
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      currentWeek: 1,
      currentDay: 1
    },
    ...overrides
  };
}

// ============================================================================
// DATE UTILITY TESTS
// ============================================================================

describe('getMondayOfWeek', () => {
  it('should return same date if given a Monday', () => {
    const monday = createLocalDate(2026, 1, 12); // Monday Jan 12, 2026
    const result = getMondayOfWeek(monday);

    expect(result.getDay()).toBe(1); // Monday = 1
    expect(result.getDate()).toBe(12);
  });

  it('should return Monday when given a Wednesday', () => {
    const wednesday = createLocalDate(2026, 1, 14); // Wednesday Jan 14
    const result = getMondayOfWeek(wednesday);

    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(12);
  });

  it('should return Monday when given a Sunday', () => {
    const sunday = createLocalDate(2026, 1, 18); // Sunday Jan 18
    const result = getMondayOfWeek(sunday);

    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(12); // Previous Monday is Jan 12
  });

  it('should return Monday when given a Saturday', () => {
    const saturday = createLocalDate(2026, 1, 17); // Saturday Jan 17
    const result = getMondayOfWeek(saturday);

    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(12); // Monday is Jan 12
  });

  it('should handle month boundaries', () => {
    const wednesday = createLocalDate(2026, 2, 4); // Wednesday Feb 4
    const result = getMondayOfWeek(wednesday);

    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(2); // Feb 2, 2026 is Monday
  });

  it('should set time to midnight', () => {
    const dateWithTime = new Date(2026, 0, 15, 14, 30, 0); // Jan 15, 2:30pm
    const result = getMondayOfWeek(dateWithTime);

    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
  });
});

describe('getWeekStartDate', () => {
  it('should return program start for week 1', () => {
    const programStart = createLocalDate(2026, 1, 12); // Monday Jan 12
    const result = getWeekStartDate(programStart, 1);

    expect(result.getDate()).toBe(12);
    expect(result.getMonth()).toBe(0); // January
  });

  it('should return second Monday for week 2', () => {
    const programStart = createLocalDate(2026, 1, 12);
    const result = getWeekStartDate(programStart, 2);

    expect(result.getDate()).toBe(19); // Jan 19
    expect(result.getMonth()).toBe(0);
  });

  it('should return fourth Monday for week 4', () => {
    const programStart = createLocalDate(2026, 1, 12);
    const result = getWeekStartDate(programStart, 4);

    expect(result.getDate()).toBe(2); // Feb 2 (Jan 12 + 21 days)
    expect(result.getMonth()).toBe(1); // February
  });

  it('should handle non-Monday program start by finding the Monday', () => {
    const wednesday = createLocalDate(2026, 1, 14); // Wednesday Jan 14
    const result = getWeekStartDate(wednesday, 1);

    expect(result.getDay()).toBe(1); // Monday
    expect(result.getDate()).toBe(12); // Previous Monday Jan 12
  });
});

describe('formatWeekDateRange', () => {
  it('should format date range correctly', () => {
    const weekStart = createLocalDate(2026, 1, 12); // Monday Jan 12
    const result = formatWeekDateRange(weekStart);

    expect(result).toMatch(/Jan 12.*Jan 18/); // Mon Jan 12 to Sun Jan 18
  });

  it('should handle month boundary', () => {
    const weekStart = createLocalDate(2026, 1, 26); // Mon Jan 26, ends Sun Feb 1
    const result = formatWeekDateRange(weekStart);

    expect(result).toMatch(/Jan 26.*Feb 1/);
  });
});

// ============================================================================
// DAY MAPPING TESTS
// ============================================================================

describe('getGlobalDayMapping', () => {
  it('should return existing dayMapping if set', () => {
    const schedule = createTestSchedule({
      scheduleMetadata: {
        isActive: true,
        startDate: '2026-01-12',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        currentWeek: 1,
        currentDay: 1,
        dayMapping: { '1': 2, '2': 4, '3': 6 } // Wed, Fri, Sun
      }
    });

    const result = getGlobalDayMapping(schedule);

    expect(result['1']).toBe(2); // Wednesday
    expect(result['2']).toBe(4); // Friday
    expect(result['3']).toBe(6); // Sunday
  });

  it('should return default consecutive mapping if not set', () => {
    const schedule = createTestSchedule();

    const result = getGlobalDayMapping(schedule);

    expect(result['1']).toBe(0); // Monday
    expect(result['2']).toBe(1); // Tuesday
    expect(result['3']).toBe(2); // Wednesday
  });

  it('should handle 5-day schedule default mapping', () => {
    const schedule = createTestSchedule({ daysPerWeek: 5 });

    const result = getGlobalDayMapping(schedule);

    expect(result['1']).toBe(0); // Monday
    expect(result['2']).toBe(1); // Tuesday
    expect(result['3']).toBe(2); // Wednesday
    expect(result['4']).toBe(3); // Thursday
    expect(result['5']).toBe(4); // Friday
  });
});

describe('getWeekOverrides', () => {
  it('should return empty object if no overrides', () => {
    const schedule = createTestSchedule();
    const result = getWeekOverrides(schedule);

    expect(result).toEqual({});
  });

  it('should return weekOverrides if set', () => {
    const schedule = createTestSchedule();
    (schedule.scheduleMetadata as any).weekOverrides = {
      '2': { '1': 3, '2': 4, '3': 5 }
    };

    const result = getWeekOverrides(schedule);

    expect(result['2']).toEqual({ '1': 3, '2': 4, '3': 5 });
  });
});

describe('getEffectiveDayMapping', () => {
  it('should return global mapping for week without overrides', () => {
    const schedule = createTestSchedule({
      scheduleMetadata: {
        isActive: true,
        startDate: '2026-01-12',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        currentWeek: 1,
        currentDay: 1,
        dayMapping: { '1': 0, '2': 2, '3': 4 } // Mon, Wed, Fri
      }
    });

    const result = getEffectiveDayMapping(schedule, 1);

    expect(result).toEqual({ '1': 0, '2': 2, '3': 4 });
  });

  it('should merge week overrides with global mapping', () => {
    const schedule = createTestSchedule({
      scheduleMetadata: {
        isActive: true,
        startDate: '2026-01-12',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        currentWeek: 1,
        currentDay: 1,
        dayMapping: { '1': 0, '2': 2, '3': 4 } // Mon, Wed, Fri
      }
    });
    (schedule.scheduleMetadata as any).weekOverrides = {
      '2': { '1': 1 } // Day 1 moved to Tuesday for week 2
    };

    const result = getEffectiveDayMapping(schedule, 2);

    expect(result['1']).toBe(1); // Overridden to Tuesday
    expect(result['2']).toBe(2); // Still Wednesday (from global)
    expect(result['3']).toBe(4); // Still Friday (from global)
  });
});

describe('getWorkoutDaysInWeek', () => {
  // Note: Workout day numbers are always 1 to daysPerWeek, regardless of week number.
  // The schedule has days["1"], days["2"], etc. - same structure for all weeks.
  // Week number affects which week parameters are shown (week1, week2, etc.), not day keys.

  it('should return days 1-3 for week 1 with 3 days/week', () => {
    const result = getWorkoutDaysInWeek(1, 3);

    expect(result).toEqual([1, 2, 3]);
  });

  it('should return days 1-3 for week 2 with 3 days/week (same as week 1)', () => {
    const result = getWorkoutDaysInWeek(2, 3);

    expect(result).toEqual([1, 2, 3]);
  });

  it('should return days 1-5 for week 1 with 5 days/week', () => {
    const result = getWorkoutDaysInWeek(1, 5);

    expect(result).toEqual([1, 2, 3, 4, 5]);
  });

  it('should return days 1-5 for week 2 with 5 days/week (same as week 1)', () => {
    const result = getWorkoutDaysInWeek(2, 5);

    expect(result).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('buildWeekdayToWorkoutDayMap', () => {
  it('should build reverse mapping for workout days in week', () => {
    const dayMapping: DayMapping = { '1': 0, '2': 2, '3': 4 }; // Mon, Wed, Fri
    const workoutDaysInWeek = [1, 2, 3];

    const result = buildWeekdayToWorkoutDayMap(dayMapping, workoutDaysInWeek);

    expect(result[0]).toBe(1); // Monday -> Day 1
    expect(result[2]).toBe(2); // Wednesday -> Day 2
    expect(result[4]).toBe(3); // Friday -> Day 3
    expect(result[1]).toBeUndefined(); // Tuesday has no workout
  });

  it('should only include days that are in the current week', () => {
    const dayMapping: DayMapping = { '1': 0, '2': 2, '3': 4 };
    const workoutDaysInWeek = [4, 5, 6]; // Week 2

    const result = buildWeekdayToWorkoutDayMap(dayMapping, workoutDaysInWeek);

    // No workouts should map since days 1-3 are not in week 2
    expect(Object.keys(result).length).toBe(0);
  });
});

// ============================================================================
// CALENDAR GENERATION TESTS
// ============================================================================

describe('generateCalendarData', () => {
  it('should generate calendar with correct number of weeks', () => {
    const dayMapping: DayMapping = { '1': 0, '2': 1, '3': 2 };
    const mondayStart = createLocalDate(2026, 1, 12);

    const result = generateCalendarData(dayMapping, mondayStart, 4);

    // All weeks should be present across all months
    const totalWeeks = result.reduce((sum, month) => sum + month.weeks.length, 0);
    expect(totalWeeks).toBe(4);
  });

  it('should assign workout days to correct weekdays', () => {
    const dayMapping: DayMapping = { '1': 0, '2': 2, '3': 4 }; // Mon, Wed, Fri
    const mondayStart = createLocalDate(2026, 1, 12);

    const result = generateCalendarData(dayMapping, mondayStart, 1);

    const week1 = result[0].weeks[0];
    expect(week1.dates[0].workoutDay).toBe(1); // Monday = Day 1
    expect(week1.dates[1].workoutDay).toBeNull(); // Tuesday = rest
    expect(week1.dates[2].workoutDay).toBe(2); // Wednesday = Day 2
    expect(week1.dates[3].workoutDay).toBeNull(); // Thursday = rest
    expect(week1.dates[4].workoutDay).toBe(3); // Friday = Day 3
    expect(week1.dates[5].workoutDay).toBeNull(); // Saturday = rest
    expect(week1.dates[6].workoutDay).toBeNull(); // Sunday = rest
  });

  it('should handle month transitions correctly', () => {
    const dayMapping: DayMapping = { '1': 0 };
    const mondayStart = createLocalDate(2026, 1, 26); // Week that spans Jan-Feb

    const result = generateCalendarData(dayMapping, mondayStart, 2);

    // Should have at least one month
    expect(result.length).toBeGreaterThanOrEqual(1);

    // Check that dates are generated correctly
    const firstWeek = result[0].weeks[0];
    expect(firstWeek.dates.length).toBe(7);
  });

  it('should mark dates not in current month correctly', () => {
    const dayMapping: DayMapping = { '1': 0 };
    const mondayStart = createLocalDate(2026, 1, 26); // Mon Jan 26

    const result = generateCalendarData(dayMapping, mondayStart, 1);

    const week = result[0].weeks[0];
    // Sun Feb 1 should be marked as not current month (January)
    const sundayDate = week.dates[6];
    expect(sundayDate.date.getMonth()).toBe(1); // February
    expect(sundayDate.isCurrentMonth).toBe(false);
  });

  it('should include week numbers correctly', () => {
    const dayMapping: DayMapping = { '1': 0 };
    const mondayStart = createLocalDate(2026, 1, 12);

    const result = generateCalendarData(dayMapping, mondayStart, 4);

    const allWeeks = result.flatMap(m => m.weeks);
    expect(allWeeks.map(w => w.weekNumber)).toEqual([1, 2, 3, 4]);
  });
});

// ============================================================================
// WEEK VIEW TESTS
// ============================================================================

describe('generateWeekViewData', () => {
  it('should generate 7 days for a week', () => {
    const schedule = createTestSchedule();
    const result = generateWeekViewData(schedule, 1);

    expect(result.length).toBe(7);
  });

  it('should include workout days with dayData', () => {
    const schedule = createTestSchedule();
    const result = generateWeekViewData(schedule, 1);

    // With default mapping (Mon=1, Tue=2, Wed=3)
    expect(result[0].workoutDay).toBe(1);
    expect(result[0].dayData).not.toBeNull();
    expect(result[0].dayData?.focus).toBe('Push');

    expect(result[1].workoutDay).toBe(2);
    expect(result[1].dayData?.focus).toBe('Pull');

    expect(result[2].workoutDay).toBe(3);
    expect(result[2].dayData?.focus).toBe('Legs');
  });

  it('should mark rest days correctly', () => {
    const schedule = createTestSchedule();
    const result = generateWeekViewData(schedule, 1);

    // Days without workouts
    expect(result[3].workoutDay).toBeNull(); // Thursday
    expect(result[3].dayData).toBeNull();
    expect(result[4].workoutDay).toBeNull(); // Friday
    expect(result[5].workoutDay).toBeNull(); // Saturday
    expect(result[6].workoutDay).toBeNull(); // Sunday
  });

  it('should respect week-specific overrides', () => {
    const schedule = createTestSchedule();
    (schedule.scheduleMetadata as any).weekOverrides = {
      '2': { '1': 3, '2': 4, '3': 5 } // Thu, Fri, Sat for week 2
    };

    const week2 = generateWeekViewData(schedule, 2);

    // Week 2 has days 4, 5, 6 mapped to Thu, Fri, Sat
    expect(week2[0].workoutDay).toBeNull(); // Monday - rest
    expect(week2[1].workoutDay).toBeNull(); // Tuesday - rest
    expect(week2[2].workoutDay).toBeNull(); // Wednesday - rest
    // Note: The dayData won't exist because we only have 3 days defined
  });

  it('should include correct weekday names', () => {
    const schedule = createTestSchedule();
    const result = generateWeekViewData(schedule, 1);

    expect(result[0].weekdayName).toBe('Monday');
    expect(result[0].weekdayShort).toBe('Mon');
    expect(result[6].weekdayName).toBe('Sunday');
    expect(result[6].weekdayShort).toBe('Sun');
  });

  it('should calculate correct dates for each week', () => {
    const schedule = createTestSchedule();

    const week1 = generateWeekViewData(schedule, 1);
    const week2 = generateWeekViewData(schedule, 2);

    // Week 1 starts Jan 12 (schedule startDate is Jan 12)
    expect(week1[0].date.getDate()).toBe(12);
    expect(week1[0].date.getMonth()).toBe(0); // January

    // Week 2 starts Jan 19
    expect(week2[0].date.getDate()).toBe(19);
    expect(week2[0].date.getMonth()).toBe(0);
  });
});

// ============================================================================
// DAY SWAPPING TESTS
// ============================================================================

describe('swapDayMappingGlobal', () => {
  it('should move workout day to new weekday', () => {
    const schedule = createTestSchedule();
    const result = swapDayMappingGlobal(schedule, 1, 4 as Weekday); // Move day 1 to Friday

    expect(result.scheduleMetadata.dayMapping?.['1']).toBe(4);
    expect(result.scheduleMetadata.updatedAt).not.toBe(schedule.scheduleMetadata.updatedAt);
  });

  it('should swap when target weekday has another workout', () => {
    const schedule = createTestSchedule({
      scheduleMetadata: {
        isActive: true,
        startDate: '2026-01-12',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        currentWeek: 1,
        currentDay: 1,
        dayMapping: { '1': 0, '2': 1, '3': 2 } // Mon, Tue, Wed
      }
    });

    // Move day 1 (Mon) to Tuesday (where day 2 is)
    const result = swapDayMappingGlobal(schedule, 1, 1 as Weekday);

    expect(result.scheduleMetadata.dayMapping?.['1']).toBe(1); // Day 1 now on Tuesday
    expect(result.scheduleMetadata.dayMapping?.['2']).toBe(0); // Day 2 now on Monday
  });

  it('should not mutate original schedule', () => {
    const schedule = createTestSchedule();
    const originalMapping = { ...getGlobalDayMapping(schedule) };

    swapDayMappingGlobal(schedule, 1, 4 as Weekday);

    expect(getGlobalDayMapping(schedule)).toEqual(originalMapping);
  });
});

describe('swapDayMappingForWeek', () => {
  it('should create week-specific override', () => {
    const schedule = createTestSchedule({
      scheduleMetadata: {
        isActive: true,
        startDate: '2026-01-12',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        currentWeek: 1,
        currentDay: 1,
        dayMapping: { '1': 0, '2': 1, '3': 2 } // Mon, Tue, Wed
      }
    });
    // Use week 1 where days 1, 2, 3 are active
    const result = swapDayMappingForWeek(schedule, 1, 0 as Weekday, 4 as Weekday);

    const overrides = getWeekOverrides(result);
    expect(overrides['1']).toBeDefined();
  });

  it('should swap workouts between two weekdays', () => {
    const schedule = createTestSchedule({
      scheduleMetadata: {
        isActive: true,
        startDate: '2026-01-12',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        currentWeek: 1,
        currentDay: 1,
        dayMapping: { '1': 0, '2': 1, '3': 2 } // Mon, Tue, Wed
      }
    });

    // Swap Mon (day 1) and Tue (day 2) for week 1 (days 1, 2, 3 are in week 1)
    const result = swapDayMappingForWeek(schedule, 1, 0 as Weekday, 1 as Weekday);

    const overrides = getWeekOverrides(result);
    expect(overrides['1']['1']).toBe(1); // Day 1 on Tuesday
    expect(overrides['1']['2']).toBe(0); // Day 2 on Monday
  });

  it('should only affect specified week', () => {
    const schedule = createTestSchedule({
      scheduleMetadata: {
        isActive: true,
        startDate: '2026-01-12',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        currentWeek: 1,
        currentDay: 1,
        dayMapping: { '1': 0, '2': 1, '3': 2 } // Mon, Tue, Wed
      }
    });
    // Swap Monday workout to Friday for week 1 only
    const result = swapDayMappingForWeek(schedule, 1, 0 as Weekday, 4 as Weekday);

    // Week 2 should still use global mapping (days 4,5,6 mapped to Mon,Tue,Wed)
    const week2Mapping = getEffectiveDayMapping(result, 2);
    expect(week2Mapping['1']).toBe(0); // Day 1 still Monday in global

    // Week 1 should have the override
    const week1Mapping = getEffectiveDayMapping(result, 1);
    expect(week1Mapping['1']).toBe(4); // Now Friday
  });

  it('should not mutate original schedule', () => {
    const schedule = createTestSchedule();

    swapDayMappingForWeek(schedule, 1, 0 as Weekday, 4 as Weekday);

    expect(getWeekOverrides(schedule)).toEqual({});
  });
});

// ============================================================================
// EXERCISE DISPLAY TESTS
// ============================================================================

describe('formatExerciseParams', () => {
  it('should format sets x reps', () => {
    const exercise = {
      name: 'Bench Press',
      week1: { sets: 3, reps: 10 }
    } as ParameterizedExercise;

    const result = formatExerciseParams(exercise, 1);

    expect(result).toBe('3x10');
  });

  it('should format work time in minutes', () => {
    const exercise = {
      name: 'Plank',
      week1: { work_time_minutes: 2, work_time_unit: 'minutes' }
    } as ParameterizedExercise;

    const result = formatExerciseParams(exercise, 1);

    expect(result).toBe('2min');
  });

  it('should format work time in seconds', () => {
    const exercise = {
      name: 'Plank',
      week1: { work_time_minutes: 0.5, work_time_unit: 'seconds' }
    } as ParameterizedExercise;

    const result = formatExerciseParams(exercise, 1);

    expect(result).toBe('30s');
  });

  it('should return empty string for missing week', () => {
    const exercise = {
      name: 'Bench Press',
      week1: { sets: 3, reps: 10 }
    } as ParameterizedExercise;

    const result = formatExerciseParams(exercise, 5);

    expect(result).toBe('');
  });

  it('should prefer sets x reps over work time', () => {
    const exercise = {
      name: 'Exercise',
      week1: { sets: 3, reps: 10, work_time_minutes: 2 }
    } as ParameterizedExercise;

    const result = formatExerciseParams(exercise, 1);

    expect(result).toBe('3x10');
  });
});

describe('getWorkoutDayInfo', () => {
  it('should return focus and exercise count for valid day', () => {
    const schedule = createTestSchedule();
    const result = getWorkoutDayInfo(schedule, 1);

    expect(result).not.toBeNull();
    expect(result?.focus).toBe('Push');
    expect(result?.exerciseCount).toBe(2);
  });

  it('should return null for invalid day', () => {
    const schedule = createTestSchedule();
    const result = getWorkoutDayInfo(schedule, 99);

    expect(result).toBeNull();
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Calendar and Week View Integration', () => {
  it('should maintain consistency between calendar and week view data', () => {
    const schedule = createTestSchedule();

    const calendarData = generateCalendarData(
      getGlobalDayMapping(schedule),
      getMondayOfWeek(createLocalDate(2026, 1, 12)),
      schedule.weeks
    );

    // Get week 1 from calendar
    const calWeek1 = calendarData[0].weeks[0];

    // Get week 1 from week view
    const weekView1 = generateWeekViewData(schedule, 1);

    // Both should have same workout day assignments
    for (let i = 0; i < 7; i++) {
      expect(calWeek1.dates[i].workoutDay).toBe(weekView1[i].workoutDay);
    }
  });

  it('should handle week override for week 1', () => {
    const schedule = createTestSchedule({
      scheduleMetadata: {
        isActive: true,
        startDate: '2026-01-12',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        currentWeek: 1,
        currentDay: 1,
        dayMapping: { '1': 0, '2': 1, '3': 2 } // Mon, Tue, Wed by default
      }
    });
    // Override week 1: days 1, 2, 3 move to Fri, Sat, Sun
    (schedule.scheduleMetadata as any).weekOverrides = {
      '1': { '1': 4, '2': 5, '3': 6 } // Fri, Sat, Sun for week 1
    };

    // Week 1 from week view should use overrides
    const weekView1 = generateWeekViewData(schedule, 1);

    // Days 1, 2, 3 should be on Fri, Sat, Sun
    expect(weekView1[4].workoutDay).toBe(1); // Friday = Day 1
    expect(weekView1[5].workoutDay).toBe(2); // Saturday = Day 2
    expect(weekView1[6].workoutDay).toBe(3); // Sunday = Day 3
    expect(weekView1[0].workoutDay).toBeNull(); // Monday should be rest
    expect(weekView1[1].workoutDay).toBeNull(); // Tuesday should be rest
    expect(weekView1[2].workoutDay).toBeNull(); // Wednesday should be rest
  });

  it('should generate correct data for multi-week, multi-month program', () => {
    const schedule = createTestSchedule({ weeks: 8 });

    const calendarData = generateCalendarData(
      getGlobalDayMapping(schedule),
      getMondayOfWeek(createLocalDate(2026, 1, 12)),
      8
    );

    // Should span multiple months
    expect(calendarData.length).toBeGreaterThan(1);

    // Total weeks should be 8
    const totalWeeks = calendarData.reduce((sum, month) => sum + month.weeks.length, 0);
    expect(totalWeeks).toBe(8);
  });
});
