/**
 * PR Lifecycle Tests - Manual PR, Historical PR, Cache, and Weight Prescription Integration
 *
 * Tests the complete data flow between:
 * - userStore.oneRepMaxes (manual PRs from profile page)
 * - exerciseHistory (workout completion data)
 * - oneRMCacheStore (calculated/cached 1RM values)
 * - DayView weight prescriptions (% TM calculations)
 * - Live view weight prescriptions
 *
 * Scenarios:
 * 1. Adding a manual PR → cache updates → DayView shows weight
 * 2. Removing a manual PR → cache clears → DayView shows %TM
 * 3. Historical PR only → cache calculates from history → DayView shows weight
 * 4. Manual PR overrides historical PR → cache uses manual → DayView uses manual
 * 5. Remove manual PR with history → cache recalculates from history
 * 6. App restart persistence for all scenarios
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { HistoryRow } from '$lib/stores/history';

// ============================================================================
// TEST HELPERS
// ============================================================================

function createHistoryRow(overrides: Partial<HistoryRow>): HistoryRow {
	const now = new Date();
	return {
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
		weight: 185,
		weight_unit: 'lbs',
		work_time: null,
		rest_time: null,
		tempo: null,
		rpe: 10,
		rir: null,
		completed: true,
		notes: null,
		...overrides
	};
}

/**
 * Simulate DayView weight calculation
 * This mirrors the logic in DayView.svelte calculateWeight()
 */
function calculateDayViewWeight(
	exerciseName: string,
	percentTM: number,
	getFromCache: (name: string) => { trm: number } | null
): { displayWeight: string; calculatedLbs: number | null } {
	const cacheEntry = getFromCache(exerciseName);
	if (cacheEntry && cacheEntry.trm > 0) {
		const calculatedLbs = Math.round((cacheEntry.trm * (percentTM / 100)) / 5) * 5;
		return {
			displayWeight: `${calculatedLbs}`,
			calculatedLbs
		};
	}
	return {
		displayWeight: `${percentTM}%`,
		calculatedLbs: null
	};
}

// ============================================================================
// MANUAL PR ADDITION TESTS
// ============================================================================

describe('Manual PR Addition', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('adding manual PR creates cache entry with correct TRM', async () => {
		const { setUserOverride, getFromCache, invalidateCache, deriveTRM } = await import(
			'$lib/stores/oneRMCache'
		);
		const { exerciseHistory } = await import('$lib/stores/history');

		invalidateCache();
		exerciseHistory.set([]);

		// User adds manual PR of 225 lbs for Bench Press
		setUserOverride('Bench Press', 225);

		const entry = getFromCache('Bench Press');
		expect(entry).not.toBeNull();
		expect(entry!.user_override).toBe(225);
		expect(entry!.trm).toBe(deriveTRM(225)); // 202.5
		expect(entry!.estimated_1rm).toBe(0); // No history
	});

	it('DayView shows calculated weight after manual PR addition', async () => {
		const { setUserOverride, getFromCache, invalidateCache } = await import(
			'$lib/stores/oneRMCache'
		);
		const { exerciseHistory } = await import('$lib/stores/history');

		invalidateCache();
		exerciseHistory.set([]);

		// User adds manual PR
		setUserOverride('Squat', 315);

		// Simulate DayView calculating weight at 80% TM
		const result = calculateDayViewWeight('Squat', 80, getFromCache);

		// TRM = 315 * 0.9 = 283.5
		// Weight at 80% = 283.5 * 0.8 = 226.8, rounded to 225
		expect(result.displayWeight).toBe('225');
		expect(result.calculatedLbs).toBe(225);
	});

	it('adding manual PR for exercise already in history uses override for TRM', async () => {
		const { setUserOverride, getFromCache, invalidateCache, deriveTRM } = await import(
			'$lib/stores/oneRMCache'
		);
		const { exerciseHistory } = await import('$lib/stores/history');

		invalidateCache();

		// Exercise has history data
		exerciseHistory.set([createHistoryRow({ exercise_name: 'Deadlift', weight: 315, reps: 5 })]);

		// User adds manual override (higher than calculated)
		setUserOverride('Deadlift', 405);

		const entry = getFromCache('Deadlift');
		expect(entry).not.toBeNull();
		expect(entry!.user_override).toBe(405);
		expect(entry!.estimated_1rm).toBeGreaterThan(0); // Calculated from history
		expect(entry!.trm).toBe(deriveTRM(405)); // Uses override, not calculated
	});
});

// ============================================================================
// MANUAL PR REMOVAL TESTS
// ============================================================================

describe('Manual PR Removal', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('removing manual PR (no history) clears cache entry', async () => {
		const { setUserOverride, clearUserOverride, getFromCache, invalidateCache } = await import(
			'$lib/stores/oneRMCache'
		);
		const { exerciseHistory } = await import('$lib/stores/history');

		invalidateCache();
		exerciseHistory.set([]);

		// Add then remove manual PR
		setUserOverride('Devil Press', 135);
		expect(getFromCache('Devil Press')).not.toBeNull();

		clearUserOverride('Devil Press');

		// With no history, entry should have TRM of 0 (effectively cleared)
		const entry = getFromCache('Devil Press');
		expect(entry).not.toBeNull(); // Entry exists but...
		expect(entry!.trm).toBe(0); // ...TRM is 0 because no override and no history
		expect(entry!.user_override).toBeNull();
	});

	it('DayView shows %TM after manual PR removal (no history)', async () => {
		const { setUserOverride, clearUserOverride, getFromCache, invalidateCache } = await import(
			'$lib/stores/oneRMCache'
		);
		const { exerciseHistory } = await import('$lib/stores/history');

		invalidateCache();
		exerciseHistory.set([]);

		// Add manual PR
		setUserOverride('Devil Press', 135);

		// Verify DayView shows calculated weight
		let result = calculateDayViewWeight('Devil Press', 80, getFromCache);
		expect(result.calculatedLbs).not.toBeNull();

		// Remove manual PR
		clearUserOverride('Devil Press');

		// DayView should now show %TM (no calculated weight)
		result = calculateDayViewWeight('Devil Press', 80, getFromCache);
		expect(result.displayWeight).toBe('80%');
		expect(result.calculatedLbs).toBeNull();
	});

	it('removing manual PR with history falls back to calculated 1RM', async () => {
		const { setUserOverride, clearUserOverride, getFromCache, invalidateCache, deriveTRM } =
			await import('$lib/stores/oneRMCache');
		const { exerciseHistory } = await import('$lib/stores/history');

		invalidateCache();

		// Exercise has history: 225 x 5 = ~262.5 calculated 1RM
		exerciseHistory.set([createHistoryRow({ exercise_name: 'Bench Press', weight: 225, reps: 5 })]);

		// User added manual override of 300
		setUserOverride('Bench Press', 300);
		expect(getFromCache('Bench Press')!.trm).toBe(deriveTRM(300)); // 270

		// Remove manual override
		clearUserOverride('Bench Press');

		// Should fall back to calculated from history
		const entry = getFromCache('Bench Press');
		expect(entry!.user_override).toBeNull();
		expect(entry!.estimated_1rm).toBeCloseTo(262.5, 0);
		expect(entry!.trm).toBeCloseTo(262.5 * 0.9, 0); // ~236.25
	});

	it('DayView uses historical TRM after manual PR removal', async () => {
		const { setUserOverride, clearUserOverride, getFromCache, invalidateCache } = await import(
			'$lib/stores/oneRMCache'
		);
		const { exerciseHistory } = await import('$lib/stores/history');

		invalidateCache();

		// History: 225 x 5 @ RPE 10 = 262.5 1RM, TRM = 236.25
		exerciseHistory.set([createHistoryRow({ exercise_name: 'Bench Press', weight: 225, reps: 5 })]);

		// Manual override of 300, TRM = 270
		setUserOverride('Bench Press', 300);

		// DayView at 80% TM = 270 * 0.8 = 216, rounded to 215
		let result = calculateDayViewWeight('Bench Press', 80, getFromCache);
		expect(result.calculatedLbs).toBe(215);

		// Remove override
		clearUserOverride('Bench Press');

		// DayView at 80% TM = 236.25 * 0.8 = 189, rounded to 190
		result = calculateDayViewWeight('Bench Press', 80, getFromCache);
		expect(result.calculatedLbs).toBe(190);
	});
});

// ============================================================================
// HISTORICAL PR ONLY TESTS
// ============================================================================

describe('Historical PR Only (No Manual Override)', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('completing workout creates cache entry from history', async () => {
		const { updateCacheForExercise, getFromCache, invalidateCache } = await import(
			'$lib/stores/oneRMCache'
		);
		const { exerciseHistory } = await import('$lib/stores/history');

		invalidateCache();
		exerciseHistory.set([]);

		// Simulate workout completion
		exerciseHistory.set([createHistoryRow({ exercise_name: 'Romanian Deadlift', weight: 185, reps: 8 })]);
		updateCacheForExercise('Romanian Deadlift');

		const entry = getFromCache('Romanian Deadlift');
		expect(entry).not.toBeNull();
		expect(entry!.user_override).toBeNull();
		expect(entry!.estimated_1rm).toBeGreaterThan(0);
		expect(entry!.trm).toBeGreaterThan(0);
	});

	it('DayView shows weight from historical PR', async () => {
		const { updateCacheForExercise, getFromCache, invalidateCache } = await import(
			'$lib/stores/oneRMCache'
		);
		const { exerciseHistory } = await import('$lib/stores/history');

		invalidateCache();

		// 185 x 8 = 185 * (1 + 8/30) = 234.33 1RM, TRM = 210.9
		exerciseHistory.set([createHistoryRow({ exercise_name: 'Romanian Deadlift', weight: 185, reps: 8 })]);
		updateCacheForExercise('Romanian Deadlift');

		// 80% of 210.9 = 168.72, rounded to 170
		const result = calculateDayViewWeight('Romanian Deadlift', 80, getFromCache);
		expect(result.calculatedLbs).toBe(170);
	});

	it('multiple history entries use time-weighted average', async () => {
		const { updateCacheForExercise, getFromCache, invalidateCache } = await import(
			'$lib/stores/oneRMCache'
		);
		const { exerciseHistory } = await import('$lib/stores/history');

		invalidateCache();

		const today = new Date();
		const lastWeek = new Date(today);
		lastWeek.setDate(lastWeek.getDate() - 7);

		// Recent: 200 x 5 (today), Old: 180 x 5 (1 week ago)
		exerciseHistory.set([
			createHistoryRow({
				exercise_name: 'Bench Press',
				weight: 200,
				reps: 5,
				date: today.toISOString().split('T')[0],
				timestamp: today.toISOString()
			}),
			createHistoryRow({
				exercise_name: 'Bench Press',
				weight: 180,
				reps: 5,
				date: lastWeek.toISOString().split('T')[0],
				timestamp: lastWeek.toISOString()
			})
		]);
		updateCacheForExercise('Bench Press');

		const entry = getFromCache('Bench Press');
		// Recent data (200x5=233) should be weighted more heavily than old data (180x5=210)
		// Result should be closer to 233 than to 210
		expect(entry!.estimated_1rm).toBeGreaterThan(220);
	});
});

// ============================================================================
// APP RESTART PERSISTENCE TESTS
// ============================================================================

describe('App Restart Persistence', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('manual PR persists across app restart', async () => {
		const { setUserOverride, fullRecalculateCache, getFromCache, invalidateCache, deriveTRM } =
			await import('$lib/stores/oneRMCache');
		const { exerciseHistory } = await import('$lib/stores/history');

		invalidateCache();
		exerciseHistory.set([]);

		// User sets manual PR
		setUserOverride('Overhead Press', 135);

		// Simulate app restart: cache cleared, then rebuilt with user overrides
		invalidateCache();
		const userOverrides = { 'Overhead Press': 135 };
		fullRecalculateCache(undefined, userOverrides);

		const entry = getFromCache('Overhead Press');
		expect(entry).not.toBeNull();
		expect(entry!.trm).toBe(deriveTRM(135));
	});

	it('removed manual PR does NOT persist after app restart', async () => {
		const { setUserOverride, clearUserOverride, fullRecalculateCache, getFromCache, invalidateCache } =
			await import('$lib/stores/oneRMCache');
		const { exerciseHistory } = await import('$lib/stores/history');

		invalidateCache();
		exerciseHistory.set([]);

		// Add then remove
		setUserOverride('Devil Press', 135);
		clearUserOverride('Devil Press');

		// Simulate app restart with NO override in userStore
		invalidateCache();
		fullRecalculateCache(undefined, {}); // Empty overrides

		// Should not be in cache (no history, no override)
		const entry = getFromCache('Devil Press');
		expect(entry).toBeNull();
	});

	it('historical PR persists after app restart', async () => {
		const { fullRecalculateCache, getFromCache, invalidateCache } = await import(
			'$lib/stores/oneRMCache'
		);
		const { exerciseHistory } = await import('$lib/stores/history');

		invalidateCache();

		// Historical data
		exerciseHistory.set([createHistoryRow({ exercise_name: 'Squat', weight: 275, reps: 5 })]);

		// Simulate app restart
		invalidateCache();
		fullRecalculateCache(undefined, {});

		const entry = getFromCache('Squat');
		expect(entry).not.toBeNull();
		expect(entry!.estimated_1rm).toBeGreaterThan(0);
	});

	it('manual override takes precedence over history after restart', async () => {
		const { fullRecalculateCache, getFromCache, invalidateCache, deriveTRM } = await import(
			'$lib/stores/oneRMCache'
		);
		const { exerciseHistory } = await import('$lib/stores/history');

		invalidateCache();

		// History: 225 x 5 = ~262.5 1RM
		exerciseHistory.set([createHistoryRow({ exercise_name: 'Bench Press', weight: 225, reps: 5 })]);

		// User override: 300
		const userOverrides = { 'Bench Press': 300 };

		// App restart
		invalidateCache();
		fullRecalculateCache(undefined, userOverrides);

		const entry = getFromCache('Bench Press');
		expect(entry!.user_override).toBe(300);
		expect(entry!.trm).toBe(deriveTRM(300)); // Uses override
		expect(entry!.estimated_1rm).toBeCloseTo(262.5, 0); // Still calculated from history
	});
});

// ============================================================================
// DAYVIEW AND LIVEVIEW WEIGHT PRESCRIPTION TESTS
// ============================================================================

describe('Weight Prescription Display', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('shows %TM when no cache entry exists', async () => {
		const { getFromCache, invalidateCache } = await import('$lib/stores/oneRMCache');

		invalidateCache();

		const result = calculateDayViewWeight('Unknown Exercise', 75, getFromCache);
		expect(result.displayWeight).toBe('75%');
		expect(result.calculatedLbs).toBeNull();
	});

	it('shows %TM when cache entry has TRM of 0', async () => {
		const { oneRMCacheStore, getFromCache, invalidateCache } = await import(
			'$lib/stores/oneRMCache'
		);

		invalidateCache();

		// Manually set a cache entry with TRM of 0
		oneRMCacheStore.set({
			'Zeroed Exercise': {
				estimated_1rm: 0,
				trm: 0,
				last_updated: new Date().toISOString(),
				data_points: 0,
				is_stale: true,
				last_performed: null,
				user_override: null
			}
		});

		const result = calculateDayViewWeight('Zeroed Exercise', 80, getFromCache);
		expect(result.displayWeight).toBe('80%');
		expect(result.calculatedLbs).toBeNull();
	});

	it('rounds weight to nearest 5 lbs', async () => {
		const { setUserOverride, getFromCache, invalidateCache } = await import(
			'$lib/stores/oneRMCache'
		);
		const { exerciseHistory } = await import('$lib/stores/history');

		invalidateCache();
		exerciseHistory.set([]);

		// 1RM = 227, TRM = 204.3, 80% = 163.44 → should round to 165
		setUserOverride('Test Exercise', 227);

		const result = calculateDayViewWeight('Test Exercise', 80, getFromCache);
		expect(result.calculatedLbs).toBe(165);
	});

	it('different %TM values calculate correctly', async () => {
		const { setUserOverride, getFromCache, invalidateCache } = await import(
			'$lib/stores/oneRMCache'
		);
		const { exerciseHistory } = await import('$lib/stores/history');

		invalidateCache();
		exerciseHistory.set([]);

		// 1RM = 300, TRM = 270
		setUserOverride('Squat', 300);

		// 70% = 270 * 0.7 = 189 → 190
		expect(calculateDayViewWeight('Squat', 70, getFromCache).calculatedLbs).toBe(190);

		// 80% = 270 * 0.8 = 216 → 215
		expect(calculateDayViewWeight('Squat', 80, getFromCache).calculatedLbs).toBe(215);

		// 85% = 270 * 0.85 = 229.5 → 230
		expect(calculateDayViewWeight('Squat', 85, getFromCache).calculatedLbs).toBe(230);

		// 90% = 270 * 0.9 = 243 → 245
		expect(calculateDayViewWeight('Squat', 90, getFromCache).calculatedLbs).toBe(245);
	});
});

// ============================================================================
// PROFILE PAGE INTEGRATION TESTS
// ============================================================================

describe('Profile Page Integration (handleRemove1RM bug)', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('BUG REPRO: handleRemove1RM must clear cache entry', async () => {
		// This test reproduces the bug where:
		// 1. User adds manual PR via profile page
		// 2. User removes PR from profile page
		// 3. DayView still shows calculated weight (should show %TM)

		const { setUserOverride, clearUserOverride, getFromCache, invalidateCache } = await import(
			'$lib/stores/oneRMCache'
		);
		const { exerciseHistory } = await import('$lib/stores/history');

		invalidateCache();
		exerciseHistory.set([]);

		// Step 1: User adds manual PR (simulates handleAdd1RM)
		// In profile page: userStore.updateOneRepMax() + setUserOverride()
		setUserOverride('Devil Press', 70);

		// Verify DayView shows calculated weight
		let entry = getFromCache('Devil Press');
		expect(entry!.trm).toBeGreaterThan(0);
		let result = calculateDayViewWeight('Devil Press', 80, getFromCache);
		expect(result.calculatedLbs).not.toBeNull();

		// Step 2: User removes PR (simulates handleRemove1RM)
		// BUG: Profile page ONLY calls userStore.removeOneRepMax()
		// It should ALSO call clearUserOverride()
		clearUserOverride('Devil Press');

		// Step 3: Verify DayView shows %TM (not calculated weight)
		entry = getFromCache('Devil Press');
		expect(entry!.trm).toBe(0);
		result = calculateDayViewWeight('Devil Press', 80, getFromCache);
		expect(result.displayWeight).toBe('80%');
		expect(result.calculatedLbs).toBeNull();
	});

	it('removing PR for exercise with history preserves historical calculation', async () => {
		// When user removes manual override but history exists,
		// DayView should fall back to historical TRM

		const { setUserOverride, clearUserOverride, getFromCache, invalidateCache, deriveTRM } =
			await import('$lib/stores/oneRMCache');
		const { exerciseHistory } = await import('$lib/stores/history');

		invalidateCache();

		// Exercise has workout history: 185 x 5 = ~216 1RM
		exerciseHistory.set([createHistoryRow({ exercise_name: 'Bench Press', weight: 185, reps: 5 })]);

		// User adds manual override (higher): 275 1RM, TRM = 247.5
		setUserOverride('Bench Press', 275);

		let entry = getFromCache('Bench Press');
		expect(entry!.trm).toBe(deriveTRM(275));

		// User removes override - should fall back to historical
		clearUserOverride('Bench Press');

		entry = getFromCache('Bench Press');
		expect(entry!.user_override).toBeNull();
		// TRM should be ~90% of 216 = ~194.4
		expect(entry!.trm).toBeCloseTo(216 * 0.9, 0);

		// DayView should use historical TRM
		const result = calculateDayViewWeight('Bench Press', 80, getFromCache);
		// 194.4 * 0.8 = 155.5 → 155
		expect(result.calculatedLbs).toBe(155);
	});
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('Edge Cases', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('setting override to 0 is treated as clearing override', async () => {
		const { setUserOverride, getFromCache, invalidateCache } = await import(
			'$lib/stores/oneRMCache'
		);
		const { exerciseHistory } = await import('$lib/stores/history');

		invalidateCache();
		exerciseHistory.set([]);

		// Set then "clear" by setting to 0
		setUserOverride('Bench Press', 225);
		setUserOverride('Bench Press', 0);

		const entry = getFromCache('Bench Press');
		// When override is 0, TRM should be 0 (no history to fall back to)
		expect(entry!.trm).toBe(0);
	});

	it('sub-exercises in compound blocks can have independent overrides', async () => {
		const { setUserOverride, getFromCache, invalidateCache, deriveTRM } = await import(
			'$lib/stores/oneRMCache'
		);
		const { exerciseHistory } = await import('$lib/stores/history');

		invalidateCache();
		exerciseHistory.set([]);

		// Set different overrides for exercises in an EMOM block
		setUserOverride('Kettlebell Swings', 53);
		setUserOverride('Push-ups', 0); // Bodyweight, no override needed
		setUserOverride('Goblet Squats', 45);

		expect(getFromCache('Kettlebell Swings')!.trm).toBe(deriveTRM(53));
		expect(getFromCache('Goblet Squats')!.trm).toBe(deriveTRM(45));
		expect(getFromCache('Push-ups')!.trm).toBe(0); // No TRM for bodyweight
	});

	it('updating override replaces previous override', async () => {
		const { setUserOverride, getFromCache, invalidateCache, deriveTRM } = await import(
			'$lib/stores/oneRMCache'
		);
		const { exerciseHistory } = await import('$lib/stores/history');

		invalidateCache();
		exerciseHistory.set([]);

		setUserOverride('Bench Press', 225);
		expect(getFromCache('Bench Press')!.trm).toBe(deriveTRM(225));

		setUserOverride('Bench Press', 275);
		expect(getFromCache('Bench Press')!.trm).toBe(deriveTRM(275));

		setUserOverride('Bench Press', 315);
		expect(getFromCache('Bench Press')!.trm).toBe(deriveTRM(315));
	});
});
