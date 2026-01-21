/**
 * Unit tests for 1RM Cache Store
 *
 * Tests:
 * - Epley formula calculation
 * - RPE adjustment factors
 * - Time-weighted averaging
 * - Stale data detection
 * - TRM derivation
 * - Cache operations
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
	calculateEpley1RM,
	adjustForRPE,
	deriveTRM,
	isStale,
	daysBetween,
	calculateTimeWeight,
	calculateTimeWeightedAverage,
	getBestSetPerDay,
	extractDataPointsFromHistory,
	calculate1RMEntry,
	calculateTrend,
	type OneRMDataPoint
} from '$lib/stores/oneRMCache';
import type { HistoryRow } from '$lib/stores/history';

// ============================================================================
// EPLEY FORMULA TESTS
// ============================================================================

describe('calculateEpley1RM', () => {
	it('calculates correctly for 135lbs x 10 reps', () => {
		// Epley: 135 * (1 + 10/30) = 135 * 1.333 = 180
		const result = calculateEpley1RM(135, 10);
		expect(result).toBeCloseTo(180, 1);
	});

	it('calculates correctly for 225lbs x 5 reps', () => {
		// Epley: 225 * (1 + 5/30) = 225 * 1.167 = 262.5
		const result = calculateEpley1RM(225, 5);
		expect(result).toBeCloseTo(262.5, 1);
	});

	it('returns same weight for 1 rep', () => {
		const result = calculateEpley1RM(315, 1);
		expect(result).toBe(315);
	});

	it('returns 0 for 0 weight', () => {
		const result = calculateEpley1RM(0, 5);
		expect(result).toBe(0);
	});

	it('returns 0 for 0 reps', () => {
		const result = calculateEpley1RM(135, 0);
		expect(result).toBe(0);
	});

	it('returns 0 for negative weight', () => {
		const result = calculateEpley1RM(-135, 5);
		expect(result).toBe(0);
	});

	it('caps reps at 10 for accuracy', () => {
		// With 15 reps, should use 10 for calculation
		const with15Reps = calculateEpley1RM(100, 15);
		const with10Reps = calculateEpley1RM(100, 10);
		expect(with15Reps).toBe(with10Reps);
	});

	it('handles various weight/rep combinations', () => {
		// 185 x 8 = 185 * (1 + 8/30) = 185 * 1.267 = 234.3
		expect(calculateEpley1RM(185, 8)).toBeCloseTo(234.3, 0);

		// 275 x 3 = 275 * (1 + 3/30) = 275 * 1.1 = 302.5
		expect(calculateEpley1RM(275, 3)).toBeCloseTo(302.5, 1);

		// 405 x 2 = 405 * (1 + 2/30) = 405 * 1.067 = 432
		expect(calculateEpley1RM(405, 2)).toBeCloseTo(432, 0);
	});
});

// ============================================================================
// RPE ADJUSTMENT TESTS
// ============================================================================

describe('adjustForRPE', () => {
	it('returns same value for RPE 10 (no adjustment)', () => {
		const result = adjustForRPE(180, 10);
		expect(result).toBe(180);
	});

	it('divides by 0.92 for RPE 8', () => {
		// 180 / 0.92 = 195.65
		const result = adjustForRPE(180, 8);
		expect(result).toBeCloseTo(195.65, 1);
	});

	it('divides by 0.88 for RPE 7', () => {
		// 180 / 0.88 = 204.55
		const result = adjustForRPE(180, 7);
		expect(result).toBeCloseTo(204.55, 1);
	});

	it('returns same value for null RPE (no adjustment)', () => {
		const result = adjustForRPE(180, null);
		expect(result).toBe(180);
	});

	it('clamps RPE at 6 minimum', () => {
		// RPE 5 should be treated as RPE 6 (0.85)
		const resultAt5 = adjustForRPE(180, 5);
		const resultAt6 = adjustForRPE(180, 6);
		expect(resultAt5).toBe(resultAt6);
	});

	it('clamps RPE at 10 maximum', () => {
		// RPE 11 should be treated as RPE 10 (1.0)
		const resultAt11 = adjustForRPE(180, 11);
		expect(resultAt11).toBe(180);
	});

	it('handles RPE 9 correctly', () => {
		// 200 / 0.96 = 208.33
		const result = adjustForRPE(200, 9);
		expect(result).toBeCloseTo(208.33, 1);
	});

	it('handles RPE 9.5 correctly', () => {
		// 200 / 0.98 = 204.08
		const result = adjustForRPE(200, 9.5);
		expect(result).toBeCloseTo(204.08, 1);
	});

	it('returns 0 for 0 input', () => {
		const result = adjustForRPE(0, 8);
		expect(result).toBe(0);
	});

	it('interpolates between known RPE values', () => {
		// RPE 8.25 should interpolate between 8 (0.92) and 8.5 (0.94)
		// Should be around 0.93
		const at8 = adjustForRPE(100, 8);
		const at8_5 = adjustForRPE(100, 8.5);
		const at8_25 = adjustForRPE(100, 8.25);
		expect(at8_25).toBeGreaterThan(at8_5);
		expect(at8_25).toBeLessThan(at8);
	});
});

// ============================================================================
// TRM DERIVATION TESTS
// ============================================================================

describe('deriveTRM', () => {
	it('calculates exactly 90% of 1RM', () => {
		expect(deriveTRM(200)).toBe(180);
		expect(deriveTRM(315)).toBe(283.5);
		expect(deriveTRM(100)).toBe(90);
	});

	it('rounds to one decimal place', () => {
		// 333.33... * 0.9 = 300
		expect(deriveTRM(333.33)).toBe(300);
	});

	it('handles 0 input', () => {
		expect(deriveTRM(0)).toBe(0);
	});
});

// ============================================================================
// STALE DATA DETECTION TESTS
// ============================================================================

describe('isStale', () => {
	it('returns true for null lastPerformed', () => {
		expect(isStale(null)).toBe(true);
	});

	it('returns true for >30 days ago', () => {
		const oldDate = new Date();
		oldDate.setDate(oldDate.getDate() - 35);
		expect(isStale(oldDate.toISOString().split('T')[0])).toBe(true);
	});

	it('returns false for <30 days ago', () => {
		const recentDate = new Date();
		recentDate.setDate(recentDate.getDate() - 10);
		expect(isStale(recentDate.toISOString().split('T')[0])).toBe(false);
	});

	it('returns false for today', () => {
		const today = new Date().toISOString().split('T')[0];
		expect(isStale(today)).toBe(false);
	});

	it('respects custom threshold', () => {
		const date = new Date();
		date.setDate(date.getDate() - 10);
		const dateStr = date.toISOString().split('T')[0];

		expect(isStale(dateStr, 5)).toBe(true); // 10 days > 5 threshold
		expect(isStale(dateStr, 15)).toBe(false); // 10 days < 15 threshold
	});
});

describe('daysBetween', () => {
	it('calculates days between two dates', () => {
		const d1 = '2026-01-01';
		const d2 = '2026-01-10';
		expect(daysBetween(d1, d2)).toBe(9);
	});

	it('is commutative (order does not matter)', () => {
		const d1 = '2026-01-01';
		const d2 = '2026-01-10';
		expect(daysBetween(d1, d2)).toBe(daysBetween(d2, d1));
	});

	it('returns 0 for same date', () => {
		const d = '2026-01-15';
		expect(daysBetween(d, d)).toBe(0);
	});
});

// ============================================================================
// TIME-WEIGHTED AVERAGING TESTS
// ============================================================================

describe('calculateTimeWeight', () => {
	it('returns 1 for today', () => {
		const today = new Date().toISOString().split('T')[0];
		expect(calculateTimeWeight(today, today)).toBeCloseTo(1, 5);
	});

	it('returns 0.5 at half-life (14 days)', () => {
		const today = new Date().toISOString().split('T')[0];
		const twoWeeksAgo = new Date();
		twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
		const weight = calculateTimeWeight(twoWeeksAgo.toISOString().split('T')[0], today);
		expect(weight).toBeCloseTo(0.5, 1);
	});

	it('returns 0.25 at two half-lives (28 days)', () => {
		const today = new Date().toISOString().split('T')[0];
		const fourWeeksAgo = new Date();
		fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
		const weight = calculateTimeWeight(fourWeeksAgo.toISOString().split('T')[0], today);
		expect(weight).toBeCloseTo(0.25, 1);
	});

	it('respects custom half-life', () => {
		const today = new Date().toISOString().split('T')[0];
		const sevenDaysAgo = new Date();
		sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

		// With 7-day half-life, 7 days ago = 0.5
		const weight = calculateTimeWeight(sevenDaysAgo.toISOString().split('T')[0], today, 7);
		expect(weight).toBeCloseTo(0.5, 1);
	});
});

// ============================================================================
// BEST SET PER DAY TESTS
// ============================================================================

describe('getBestSetPerDay', () => {
	const today = new Date().toISOString().split('T')[0];

	it('returns empty map for empty input', () => {
		const result = getBestSetPerDay([]);
		expect(result.size).toBe(0);
	});

	it('selects heaviest set when same reps on same day', () => {
		const dataPoints: OneRMDataPoint[] = [
			{ weight: 135, reps: 6, rpe: null, date: today, timestamp: new Date().toISOString() },
			{ weight: 165, reps: 6, rpe: null, date: today, timestamp: new Date().toISOString() }
		];

		const result = getBestSetPerDay(dataPoints, false);
		expect(result.size).toBe(1);

		const best = result.get(today);
		expect(best?.weight).toBe(165);
	});

	it('considers 1RM estimate, not just raw weight', () => {
		// 200x3 = 200 * 1.1 = 220 1RM
		// 185x8 = 185 * 1.267 = 234.3 1RM
		// 185x8 is "better" despite lower weight
		const dataPoints: OneRMDataPoint[] = [
			{ weight: 200, reps: 3, rpe: null, date: today, timestamp: new Date().toISOString() },
			{ weight: 185, reps: 8, rpe: null, date: today, timestamp: new Date().toISOString() }
		];

		const result = getBestSetPerDay(dataPoints, false);
		const best = result.get(today);
		expect(best?.weight).toBe(185);
		expect(best?.reps).toBe(8);
	});

	it('keeps one best set per unique date', () => {
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		const yesterdayStr = yesterday.toISOString().split('T')[0];

		const dataPoints: OneRMDataPoint[] = [
			{ weight: 100, reps: 10, rpe: null, date: today, timestamp: new Date().toISOString() },
			{ weight: 150, reps: 10, rpe: null, date: today, timestamp: new Date().toISOString() },
			{ weight: 100, reps: 10, rpe: null, date: yesterdayStr, timestamp: yesterday.toISOString() },
			{ weight: 140, reps: 10, rpe: null, date: yesterdayStr, timestamp: yesterday.toISOString() }
		];

		const result = getBestSetPerDay(dataPoints, false);
		expect(result.size).toBe(2);
		expect(result.get(today)?.weight).toBe(150);
		expect(result.get(yesterdayStr)?.weight).toBe(140);
	});

	it('applies RPE adjustment when comparing sets', () => {
		// 165x6 at RPE 8 = 165 * 1.2 / 0.92 = 215.2 1RM
		// 135x6 at RPE 10 = 135 * 1.2 / 1.0 = 162 1RM
		// 165x6 should win
		const dataPoints: OneRMDataPoint[] = [
			{ weight: 135, reps: 6, rpe: 10, date: today, timestamp: new Date().toISOString() },
			{ weight: 165, reps: 6, rpe: 8, date: today, timestamp: new Date().toISOString() }
		];

		const result = getBestSetPerDay(dataPoints, true);
		const best = result.get(today);
		expect(best?.weight).toBe(165);
	});
});

describe('calculateTimeWeightedAverage', () => {
	const today = new Date().toISOString().split('T')[0];

	it('returns 0 for empty data points', () => {
		expect(calculateTimeWeightedAverage([])).toBe(0);
	});

	it('weights recent data higher', () => {
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		const lastMonth = new Date();
		lastMonth.setDate(lastMonth.getDate() - 30);

		const dataPoints: OneRMDataPoint[] = [
			{
				weight: 200,
				reps: 5,
				rpe: 10,
				date: yesterday.toISOString().split('T')[0],
				timestamp: yesterday.toISOString()
			},
			{
				weight: 150,
				reps: 5,
				rpe: 10,
				date: lastMonth.toISOString().split('T')[0],
				timestamp: lastMonth.toISOString()
			}
		];

		const result = calculateTimeWeightedAverage(dataPoints);

		// Recent 200x5 = 233.33 1RM should dominate over old 150x5 = 175 1RM
		// Result should be much closer to 233 than 175
		expect(result).toBeGreaterThan(200);
		expect(result).toBeLessThan(235);
	});

	it('applies RPE adjustment by default', () => {
		const dataPoints: OneRMDataPoint[] = [
			{
				weight: 180,
				reps: 1,
				rpe: 8, // At 92% effort
				date: today,
				timestamp: new Date().toISOString()
			}
		];

		// 180 at RPE 8 -> 180 / 0.92 = 195.65
		const result = calculateTimeWeightedAverage(dataPoints);
		expect(result).toBeCloseTo(195.7, 0);
	});

	it('can disable RPE adjustment', () => {
		const dataPoints: OneRMDataPoint[] = [
			{
				weight: 180,
				reps: 1,
				rpe: 8,
				date: today,
				timestamp: new Date().toISOString()
			}
		];

		const result = calculateTimeWeightedAverage(dataPoints, { includeRPEAdjustment: false });
		expect(result).toBe(180);
	});

	it('handles null RPE without error', () => {
		const dataPoints: OneRMDataPoint[] = [
			{
				weight: 200,
				reps: 5,
				rpe: null,
				date: today,
				timestamp: new Date().toISOString()
			}
		];

		// 200 x 5 = 200 * (1 + 5/30) = 233.33
		const result = calculateTimeWeightedAverage(dataPoints);
		expect(result).toBeCloseTo(233.3, 0);
	});

	it('uses best set per day, not average of all sets (fixes warmup set dilution)', () => {
		// Bug: 135x6 (warmup) was diluting 165x6 (working set)
		// Fix: Use heaviest set per day for PR calculation
		const dataPoints: OneRMDataPoint[] = [
			{
				weight: 135,
				reps: 6,
				rpe: 6,
				date: today,
				timestamp: new Date().toISOString()
			},
			{
				weight: 165,
				reps: 6,
				rpe: 8,
				date: today,
				timestamp: new Date().toISOString()
			}
		];

		const result = calculateTimeWeightedAverage(dataPoints);

		// 165x6 at RPE 8 = 165 * (1 + 6/30) / 0.92 = 198 / 0.92 = 215.2
		// 135x6 at RPE 6 = 135 * (1 + 6/30) / 0.85 = 162 / 0.85 = 190.6
		// Best set is 165x6 with 215.2 1RM estimate - this is what should be used
		expect(result).toBeCloseTo(215.2, 0);
	});

	it('takes best from each day when multiple days have multiple sets', () => {
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		const yesterdayStr = yesterday.toISOString().split('T')[0];

		const dataPoints: OneRMDataPoint[] = [
			// Today: warmup then working set
			{ weight: 95, reps: 10, rpe: 5, date: today, timestamp: new Date().toISOString() },
			{ weight: 135, reps: 8, rpe: 9, date: today, timestamp: new Date().toISOString() },
			// Yesterday: warmup then working set
			{ weight: 95, reps: 10, rpe: 5, date: yesterdayStr, timestamp: yesterday.toISOString() },
			{ weight: 130, reps: 8, rpe: 9, date: yesterdayStr, timestamp: yesterday.toISOString() }
		];

		const result = calculateTimeWeightedAverage(dataPoints);

		// Today best: 135x8 at RPE 9 = 135 * 1.267 / 0.96 = 178.1
		// Yesterday best: 130x8 at RPE 9 = 130 * 1.267 / 0.96 = 171.5
		// Time-weighted average heavily favors today (more recent)
		// Should be closer to 178 than to the average of all sets
		expect(result).toBeGreaterThan(170);
		expect(result).toBeLessThan(180);
	});
});

// ============================================================================
// DATA EXTRACTION TESTS
// ============================================================================

describe('extractDataPointsFromHistory', () => {
	const createRow = (overrides: Partial<HistoryRow>): HistoryRow => ({
		date: '2026-01-10',
		timestamp: '2026-01-10T10:00:00.000Z',
		workout_program_id: 'test-program',
		week_number: 1,
		day_number: 1,
		exercise_name: 'Bench Press',
		exercise_order: 0,
		is_compound_parent: false,
		compound_parent_name: null,
		set_number: 1,
		reps: 5,
		weight: 135,
		weight_unit: 'lbs',
		work_time: null,
		rest_time: null,
		tempo: null,
		rpe: 8,
		rir: null,
		completed: true,
		notes: null,
		...overrides
	});

	it('extracts valid data points for exercise', () => {
		const history: HistoryRow[] = [
			createRow({ weight: 135, reps: 5, timestamp: '2026-01-10T10:00:00.000Z' }),
			createRow({ weight: 145, reps: 5, set_number: 2, timestamp: '2026-01-10T10:05:00.000Z' }),
			createRow({ exercise_name: 'Squat', weight: 200, reps: 5 }) // Different exercise
		];

		const result = extractDataPointsFromHistory('Bench Press', history);

		expect(result).toHaveLength(2);
		expect(result[0].weight).toBe(145); // Most recent first
		expect(result[1].weight).toBe(135);
	});

	it('skips compound parent rows', () => {
		const history: HistoryRow[] = [
			createRow({ is_compound_parent: true, weight: null, reps: null }),
			createRow({ weight: 135, reps: 5 })
		];

		const result = extractDataPointsFromHistory('Bench Press', history);
		expect(result).toHaveLength(1);
	});

	it('skips incomplete sets', () => {
		const history: HistoryRow[] = [
			createRow({ completed: false }),
			createRow({ completed: true, weight: 135, reps: 5 })
		];

		const result = extractDataPointsFromHistory('Bench Press', history);
		expect(result).toHaveLength(1);
	});

	it('skips rows without weight', () => {
		const history: HistoryRow[] = [
			createRow({ weight: null }),
			createRow({ weight: 135, reps: 5 })
		];

		const result = extractDataPointsFromHistory('Bench Press', history);
		expect(result).toHaveLength(1);
	});

	it('skips rows without reps', () => {
		const history: HistoryRow[] = [
			createRow({ reps: null }),
			createRow({ weight: 135, reps: 5 })
		];

		const result = extractDataPointsFromHistory('Bench Press', history);
		expect(result).toHaveLength(1);
	});

	it('sorts by timestamp descending', () => {
		const history: HistoryRow[] = [
			createRow({ timestamp: '2026-01-08T10:00:00.000Z', weight: 130 }),
			createRow({ timestamp: '2026-01-10T10:00:00.000Z', weight: 140 }),
			createRow({ timestamp: '2026-01-09T10:00:00.000Z', weight: 135 })
		];

		const result = extractDataPointsFromHistory('Bench Press', history);

		expect(result[0].weight).toBe(140); // Most recent
		expect(result[1].weight).toBe(135);
		expect(result[2].weight).toBe(130); // Oldest
	});
});

// ============================================================================
// CALCULATE TREND TESTS
// ============================================================================

describe('calculateTrend', () => {
	it('returns null for single data point', () => {
		const dataPoints: OneRMDataPoint[] = [
			{ weight: 135, reps: 5, rpe: null, date: '2026-01-10', timestamp: '2026-01-10T10:00:00.000Z' }
		];
		expect(calculateTrend(dataPoints)).toBeNull();
	});

	it('returns null for empty data points', () => {
		expect(calculateTrend([])).toBeNull();
	});

	it('returns "up" when most recent is >2% higher', () => {
		const dataPoints: OneRMDataPoint[] = [
			{ weight: 150, reps: 5, rpe: null, date: '2026-01-10', timestamp: '2026-01-10T10:00:00.000Z' },
			{ weight: 135, reps: 5, rpe: null, date: '2026-01-08', timestamp: '2026-01-08T10:00:00.000Z' },
			{ weight: 135, reps: 5, rpe: null, date: '2026-01-06', timestamp: '2026-01-06T10:00:00.000Z' }
		];
		expect(calculateTrend(dataPoints)).toBe('up');
	});

	it('returns "down" when most recent is >2% lower', () => {
		const dataPoints: OneRMDataPoint[] = [
			{ weight: 120, reps: 5, rpe: null, date: '2026-01-10', timestamp: '2026-01-10T10:00:00.000Z' },
			{ weight: 135, reps: 5, rpe: null, date: '2026-01-08', timestamp: '2026-01-08T10:00:00.000Z' },
			{ weight: 140, reps: 5, rpe: null, date: '2026-01-06', timestamp: '2026-01-06T10:00:00.000Z' }
		];
		expect(calculateTrend(dataPoints)).toBe('down');
	});

	it('returns "stable" when within 2%', () => {
		const dataPoints: OneRMDataPoint[] = [
			{ weight: 136, reps: 5, rpe: null, date: '2026-01-10', timestamp: '2026-01-10T10:00:00.000Z' },
			{ weight: 135, reps: 5, rpe: null, date: '2026-01-08', timestamp: '2026-01-08T10:00:00.000Z' },
			{ weight: 134, reps: 5, rpe: null, date: '2026-01-06', timestamp: '2026-01-06T10:00:00.000Z' }
		];
		expect(calculateTrend(dataPoints)).toBe('stable');
	});
});

// ============================================================================
// CACHE ENTRY CALCULATION TESTS
// ============================================================================

describe('calculate1RMEntry', () => {
	const createRow = (overrides: Partial<HistoryRow>): HistoryRow => ({
		date: '2026-01-10',
		timestamp: '2026-01-10T10:00:00.000Z',
		workout_program_id: 'test-program',
		week_number: 1,
		day_number: 1,
		exercise_name: 'Bench Press',
		exercise_order: 0,
		is_compound_parent: false,
		compound_parent_name: null,
		set_number: 1,
		reps: 5,
		weight: 135,
		weight_unit: 'lbs',
		work_time: null,
		rest_time: null,
		tempo: null,
		rpe: 8,
		rir: null,
		completed: true,
		notes: null,
		...overrides
	});

	it('calculates entry with correct fields', () => {
		const history: HistoryRow[] = [
			createRow({ weight: 135, reps: 5, rpe: 10 })
		];

		const entry = calculate1RMEntry('Bench Press', history);

		expect(entry.estimated_1rm).toBeGreaterThan(0);
		// TRM should be ~90% of 1RM (rounding may cause slight variation)
		expect(entry.trm).toBeCloseTo(entry.estimated_1rm * 0.9, 0);
		expect(entry.data_points).toBe(1);
		expect(entry.last_performed).toBe('2026-01-10');
		expect(entry.user_override).toBeNull();
		expect(entry.last_updated).toBeTruthy();
	});

	it('uses user override for TRM calculation', () => {
		const history: HistoryRow[] = [
			createRow({ weight: 135, reps: 5, rpe: 10 })
		];

		const entry = calculate1RMEntry('Bench Press', history, 200);

		// TRM should be based on override (200), not calculated value
		expect(entry.trm).toBe(deriveTRM(200));
		expect(entry.user_override).toBe(200);
	});

	it('handles empty history', () => {
		const entry = calculate1RMEntry('Bench Press', []);

		expect(entry.estimated_1rm).toBe(0);
		expect(entry.trm).toBe(0);
		expect(entry.data_points).toBe(0);
		expect(entry.is_stale).toBe(true);
		expect(entry.last_performed).toBeNull();
	});

	it('marks data as stale when >30 days old', () => {
		const oldDate = new Date();
		oldDate.setDate(oldDate.getDate() - 35);
		const dateStr = oldDate.toISOString().split('T')[0];

		const history: HistoryRow[] = [
			createRow({ date: dateStr, timestamp: oldDate.toISOString() })
		];

		const entry = calculate1RMEntry('Bench Press', history);
		expect(entry.is_stale).toBe(true);
	});

	it('marks data as fresh when <30 days old', () => {
		const recentDate = new Date();
		recentDate.setDate(recentDate.getDate() - 5);
		const dateStr = recentDate.toISOString().split('T')[0];

		const history: HistoryRow[] = [
			createRow({ date: dateStr, timestamp: recentDate.toISOString() })
		];

		const entry = calculate1RMEntry('Bench Press', history);
		expect(entry.is_stale).toBe(false);
	});
});

// ============================================================================
// CACHE STORE OPERATIONS TESTS
// ============================================================================

describe('Cache Store Operations', () => {
	beforeEach(() => {
		// Clear any cached state before each test
		vi.resetModules();
	});

	it('getFromCache returns null for non-existent exercise', async () => {
		const { getFromCache, invalidateCache } = await import('$lib/stores/oneRMCache');
		invalidateCache();
		expect(getFromCache('NonExistentExercise')).toBeNull();
	});

	it('invalidateCache clears all cached entries', async () => {
		const { oneRMCacheStore, invalidateCache } = await import('$lib/stores/oneRMCache');
		const { get } = await import('svelte/store');

		// Set some data
		oneRMCacheStore.set({
			'Bench Press': {
				estimated_1rm: 200,
				trm: 180,
				last_updated: new Date().toISOString(),
				data_points: 5,
				is_stale: false,
				last_performed: '2026-01-10',
				user_override: null
			}
		});

		// Verify data exists
		expect(Object.keys(get(oneRMCacheStore))).toHaveLength(1);

		// Clear cache
		invalidateCache();

		// Verify cache is empty
		expect(Object.keys(get(oneRMCacheStore))).toHaveLength(0);
	});

	it('setUserOverride updates cache entry with override', async () => {
		const { oneRMCacheStore, setUserOverride, getFromCache, deriveTRM } = await import(
			'$lib/stores/oneRMCache'
		);

		// Need to set up exerciseHistory mock first
		const { exerciseHistory } = await import('$lib/stores/history');
		exerciseHistory.set([]);

		setUserOverride('Bench Press', 225);

		const entry = getFromCache('Bench Press');
		expect(entry).not.toBeNull();
		expect(entry!.user_override).toBe(225);
		expect(entry!.trm).toBe(deriveTRM(225));
	});

	it('clearUserOverride removes override from cache entry', async () => {
		const { setUserOverride, clearUserOverride, getFromCache } = await import(
			'$lib/stores/oneRMCache'
		);
		const { exerciseHistory } = await import('$lib/stores/history');
		exerciseHistory.set([]);

		// Set override first
		setUserOverride('Bench Press', 225);
		expect(getFromCache('Bench Press')!.user_override).toBe(225);

		// Clear override
		clearUserOverride('Bench Press');
		expect(getFromCache('Bench Press')!.user_override).toBeNull();
	});
});

// ============================================================================
// PR DISPLAY DATA INTEGRATION TESTS
// ============================================================================

describe('getPRDisplayData Integration', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('returns PR data after logging history and updating cache', async () => {
		const { updateCacheForExercise, getPRDisplayData, invalidateCache } = await import(
			'$lib/stores/oneRMCache'
		);
		const { exerciseHistory } = await import('$lib/stores/history');

		// Clear any existing state
		invalidateCache();

		// Simulate logging history (as handleStop does via logSessionToHistory)
		const now = new Date();
		exerciseHistory.set([
			{
				date: now.toISOString().split('T')[0],
				timestamp: now.toISOString(),
				workout_program_id: 'test-program',
				week_number: 1,
				day_number: 1,
				exercise_name: 'Yates Rows',
				exercise_order: 0,
				is_compound_parent: false,
				compound_parent_name: null,
				set_number: 1,
				reps: 8,
				weight: 135,
				weight_unit: 'lbs',
				work_time: null,
				rest_time: null,
				tempo: null,
				rpe: 8,
				rir: null,
				completed: true,
				notes: null
			}
		]);

		// Update cache for the exercise (as handleStop does)
		updateCacheForExercise('Yates Rows');

		// Now get PR display data (as Profile view does)
		const prData = getPRDisplayData('Yates Rows');

		// This should NOT be null - we just logged data for this exercise
		expect(prData).not.toBeNull();
		expect(prData!.exerciseName).toBe('Yates Rows');
		expect(prData!.estimated1RM).toBeGreaterThan(0);
		expect(prData!.trm).toBeGreaterThan(0);
		expect(prData!.recentActivity.lastWeight).toBe(135);
		expect(prData!.recentActivity.lastReps).toBe(8);
	});

	it('returns null when cache entry does not exist for exercise', async () => {
		const { getPRDisplayData, invalidateCache } = await import('$lib/stores/oneRMCache');

		invalidateCache();

		// No cache entry for this exercise
		const prData = getPRDisplayData('NonExistentExercise');
		expect(prData).toBeNull();
	});

	it('returns PR data with correct calculated 1RM using Epley formula', async () => {
		const { updateCacheForExercise, getPRDisplayData, invalidateCache, calculateEpley1RM } =
			await import('$lib/stores/oneRMCache');
		const { exerciseHistory } = await import('$lib/stores/history');

		invalidateCache();

		const now = new Date();
		exerciseHistory.set([
			{
				date: now.toISOString().split('T')[0],
				timestamp: now.toISOString(),
				workout_program_id: 'test-program',
				week_number: 1,
				day_number: 1,
				exercise_name: 'Bench Press',
				exercise_order: 0,
				is_compound_parent: false,
				compound_parent_name: null,
				set_number: 1,
				reps: 5,
				weight: 225,
				weight_unit: 'lbs',
				work_time: null,
				rest_time: null,
				tempo: null,
				rpe: 10, // Max effort, no RPE adjustment
				rir: null,
				completed: true,
				notes: null
			}
		]);

		updateCacheForExercise('Bench Press');
		const prData = getPRDisplayData('Bench Press');

		expect(prData).not.toBeNull();
		// Epley: 225 * (1 + 5/30) = 225 * 1.167 = 262.5
		const expected1RM = calculateEpley1RM(225, 5);
		expect(prData!.estimated1RM).toBeCloseTo(expected1RM, 0);
		// TRM is 90% of 1RM
		expect(prData!.trm).toBeCloseTo(expected1RM * 0.9, 0);
	});

	it('PROFILE SCENARIO: shows PR for exercise in current program after workout completion', async () => {
		// This test simulates exactly what happens in production:
		// 1. User has active schedule with "Yates Rows" exercise
		// 2. User completes workout, logs 135 lbs x 8 reps for "Yates Rows"
		// 3. handleStop() calls logSessionToHistory() then updateCacheForExercise()
		// 4. Profile view should show PR for "Yates Rows"

		const { updateCacheForExercise, getPRDisplayData, invalidateCache, getFromCache } =
			await import('$lib/stores/oneRMCache');
		const { exerciseHistory, logSessionToHistory } = await import('$lib/stores/history');

		// Clear initial state
		invalidateCache();
		exerciseHistory.set([]);

		// Step 1: Simulate logSessionToHistory() being called (as in handleStop)
		const logs = [
			{
				exerciseName: 'Yates Rows',
				exerciseOrder: 0,
				isCompoundParent: false,
				compoundParentName: null,
				sets: [
					{
						setNumber: 1,
						reps: 8,
						weight: 135,
						weightUnit: 'lbs' as const,
						workTime: null,
						rpe: 8,
						rir: null,
						completed: true,
						notes: null,
						timestamp: new Date().toISOString()
					}
				],
				timestamp: new Date().toISOString()
			}
		];

		await logSessionToHistory('test-schedule-id', 1, 1, logs);

		// Step 2: Simulate cache update (as in handleStop)
		updateCacheForExercise('Yates Rows');

		// Step 3: Verify cache has entry
		const cacheEntry = getFromCache('Yates Rows');
		expect(cacheEntry).not.toBeNull();
		expect(cacheEntry!.estimated_1rm).toBeGreaterThan(0);

		// Step 4: Simulate Profile view calling getPRDisplayData
		// The Profile view extracts exercise names from the schedule, then calls getPRDisplayData for each
		const programExercises = ['Yates Rows', 'Bench Press', 'Deadlift']; // Simulated schedule exercises

		const programPRData = programExercises
			.map((name) => getPRDisplayData(name))
			.filter((pr) => pr !== null);

		// The Yates Rows PR should be in the list
		const yatesRowsPR = programPRData.find((pr) => pr!.exerciseName === 'Yates Rows');
		expect(yatesRowsPR).not.toBeUndefined();
		expect(yatesRowsPR!.estimated1RM).toBeGreaterThan(0);
		expect(yatesRowsPR!.recentActivity.lastWeight).toBe(135);
		expect(yatesRowsPR!.recentActivity.lastReps).toBe(8);
	});
});

// ============================================================================
// USER OVERRIDE PERSISTENCE TESTS (App Restart Scenarios)
// ============================================================================

describe('User Override Persistence (App Restart)', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('fullRecalculateCache includes exercises from userOverrides even without history', async () => {
		const { fullRecalculateCache, getFromCache, invalidateCache, deriveTRM } = await import(
			'$lib/stores/oneRMCache'
		);
		const { exerciseHistory } = await import('$lib/stores/history');

		// Clear initial state
		invalidateCache();
		exerciseHistory.set([]); // No history at all

		// User has manual overrides for exercises (loaded from userStore on app start)
		const userOverrides: Record<string, number> = {
			'Bench Press': 225,
			'Squat': 315
		};

		// Simulate app startup: fullRecalculateCache is called
		fullRecalculateCache(undefined, userOverrides);

		// Even with no history, exercises with overrides should be in cache
		const benchEntry = getFromCache('Bench Press');
		const squatEntry = getFromCache('Squat');

		expect(benchEntry).not.toBeNull();
		expect(benchEntry!.user_override).toBe(225);
		expect(benchEntry!.trm).toBe(deriveTRM(225)); // 202.5

		expect(squatEntry).not.toBeNull();
		expect(squatEntry!.user_override).toBe(315);
		expect(squatEntry!.trm).toBe(deriveTRM(315)); // 283.5
	});

	it('fullRecalculateCache merges history exercises with userOverrides exercises', async () => {
		const { fullRecalculateCache, getFromCache, invalidateCache } = await import(
			'$lib/stores/oneRMCache'
		);
		const { exerciseHistory } = await import('$lib/stores/history');

		invalidateCache();

		// Exercise A has history but no override
		// Exercise B has override but no history
		// Exercise C has both history and override

		const now = new Date();
		exerciseHistory.set([
			{
				date: now.toISOString().split('T')[0],
				timestamp: now.toISOString(),
				workout_program_id: 'test-program',
				week_number: 1,
				day_number: 1,
				exercise_name: 'Deadlift', // Exercise A: history only
				exercise_order: 0,
				is_compound_parent: false,
				compound_parent_name: null,
				set_number: 1,
				reps: 5,
				weight: 315,
				weight_unit: 'lbs',
				work_time: null,
				rest_time: null,
				tempo: null,
				rpe: 10,
				rir: null,
				completed: true,
				notes: null
			},
			{
				date: now.toISOString().split('T')[0],
				timestamp: now.toISOString(),
				workout_program_id: 'test-program',
				week_number: 1,
				day_number: 1,
				exercise_name: 'Bench Press', // Exercise C: both history and override
				exercise_order: 1,
				is_compound_parent: false,
				compound_parent_name: null,
				set_number: 1,
				reps: 5,
				weight: 185,
				weight_unit: 'lbs',
				work_time: null,
				rest_time: null,
				tempo: null,
				rpe: 10,
				rir: null,
				completed: true,
				notes: null
			}
		]);

		const userOverrides: Record<string, number> = {
			'Squat': 405, // Exercise B: override only
			'Bench Press': 225 // Exercise C: override takes precedence for TRM
		};

		fullRecalculateCache(undefined, userOverrides);

		// Exercise A (Deadlift): from history only
		const deadliftEntry = getFromCache('Deadlift');
		expect(deadliftEntry).not.toBeNull();
		expect(deadliftEntry!.estimated_1rm).toBeGreaterThan(0);
		expect(deadliftEntry!.user_override).toBeNull();

		// Exercise B (Squat): from override only (no history)
		const squatEntry = getFromCache('Squat');
		expect(squatEntry).not.toBeNull();
		expect(squatEntry!.user_override).toBe(405);
		expect(squatEntry!.estimated_1rm).toBe(0); // No history data
		expect(squatEntry!.trm).toBeCloseTo(405 * 0.9, 0); // TRM uses override

		// Exercise C (Bench Press): both history and override
		const benchEntry = getFromCache('Bench Press');
		expect(benchEntry).not.toBeNull();
		expect(benchEntry!.user_override).toBe(225);
		expect(benchEntry!.estimated_1rm).toBeGreaterThan(0); // From history
		expect(benchEntry!.trm).toBeCloseTo(225 * 0.9, 0); // TRM uses override, not calculated
	});

	it('user override persists after app restart simulation', async () => {
		// This test simulates:
		// 1. User sets override on Profile page
		// 2. App "restarts" (fullRecalculateCache called with userOverrides from userStore)
		// 3. DayView should still show calculated weight

		const { setUserOverride, fullRecalculateCache, getFromCache, invalidateCache, deriveTRM } =
			await import('$lib/stores/oneRMCache');
		const { exerciseHistory } = await import('$lib/stores/history');

		invalidateCache();
		exerciseHistory.set([]);

		// Step 1: User sets override (simulating profile page action)
		setUserOverride('Romanian Deadlift', 185);

		// Verify cache entry exists
		let entry = getFromCache('Romanian Deadlift');
		expect(entry).not.toBeNull();
		expect(entry!.trm).toBe(deriveTRM(185));

		// Step 2: Simulate app restart - cache is rebuilt from userStore overrides
		// In real app, +layout.svelte calls fullRecalculateCache with userOverrides from userStore
		const userOverridesFromUserStore: Record<string, number> = {
			'Romanian Deadlift': 185 // This would come from userStore.oneRepMaxes
		};

		// Clear cache to simulate fresh start
		invalidateCache();
		expect(getFromCache('Romanian Deadlift')).toBeNull();

		// Rebuild cache (as +layout.svelte does)
		fullRecalculateCache(undefined, userOverridesFromUserStore);

		// Step 3: Verify cache still has the entry
		entry = getFromCache('Romanian Deadlift');
		expect(entry).not.toBeNull();
		expect(entry!.user_override).toBe(185);
		expect(entry!.trm).toBe(deriveTRM(185));
	});

	it('DayView weight calculation works with override-only exercises (no history)', async () => {
		// This tests the exact scenario reported in the bug:
		// - User sets PR on profile
		// - DayView shows calculated weight
		// - App restarts, weight shows "%TM" instead

		const { fullRecalculateCache, getFromCache, invalidateCache, deriveTRM } = await import(
			'$lib/stores/oneRMCache'
		);
		const { exerciseHistory } = await import('$lib/stores/history');

		invalidateCache();
		exerciseHistory.set([]);

		// User has override for an exercise in their program
		const userOverrides: Record<string, number> = {
			'Bulgarian Split Squat': 135
		};

		// App starts, cache is rebuilt
		fullRecalculateCache(undefined, userOverrides);

		// DayView calls getFromCache to calculate weight
		const entry = getFromCache('Bulgarian Split Squat');

		// This must NOT be null - it should have the user override
		expect(entry).not.toBeNull();
		expect(entry!.trm).toBe(deriveTRM(135)); // 121.5

		// Simulate DayView weight calculation: weight = TRM * (percent / 100)
		const percentTM = 80; // 80% of TRM
		const calculatedWeight = Math.round(entry!.trm * (percentTM / 100) / 5) * 5;
		expect(calculatedWeight).toBe(95); // 121.5 * 0.8 = 97.2, rounded to nearest 5 = 95
	});
});
