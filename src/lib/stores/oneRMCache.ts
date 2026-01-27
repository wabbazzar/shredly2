/**
 * 1RM Cache Store - Calculates and caches estimated 1RM from exercise history
 *
 * Features:
 * - Epley formula: 1RM = weight * (1 + reps/30)
 * - RPE adjustment: divides by RPE factor to estimate true max
 * - Time-weighted averaging with 14-day half-life
 * - TRM derivation: 90% of calculated 1RM
 * - Stale data detection (>30 days)
 * - User override support (takes precedence)
 * - localStorage persistence
 */

import { writable, get } from 'svelte/store';
import { exerciseHistory, toLocalDateString, type HistoryRow } from './history';

// ============================================================================
// CONSTANTS
// ============================================================================

const CACHE_KEY = 'exercise_1rm_cache';
const isBrowser = typeof window !== 'undefined';

// Time-weighted averaging constants
const RECENCY_HALF_LIFE_DAYS = 14;
const STALE_THRESHOLD_DAYS = 30;

// TRM is 90% of 1RM (Jim Wendler's 5/3/1 standard)
const TRM_FACTOR = 0.90;

// Maximum reps for reliable Epley calculation
const MAX_REPS_FOR_CALCULATION = 10;

// Standard plate increment for rounding
const PLATE_INCREMENT = 5;

// Rep threshold for distinguishing max attempts from training sets
// Sets with 1-2 reps are treated as max attempts (calculate 1RM, then derive TRM)
// Sets with 3+ reps are treated as training sets (Epley result IS the TRM)
const MAX_REPS_FOR_1RM_ESTIMATION = 2;

// RPE threshold for applying discount
// Only RPE 9+ gets a discount (near-maximal effort not sustainable for training)
const HIGH_RPE_THRESHOLD = 9;

// High RPE discount factors (multiply TRM, don't divide)
// Only applies for RPE >= 9 (training sets at near-maximal effort)
const HIGH_RPE_DISCOUNT: Record<number, number> = {
	9: 0.96, // 1 rep in reserve
	9.5: 0.98, // 0.5 reps in reserve
	10: 1.0 // True max, no discount
};

/**
 * RPE to estimated max effort percentage
 * When RPE < 10, we divide by this factor to estimate true max
 */
const RPE_ADJUSTMENT: Record<number, number> = {
	10: 1.0, // True max effort
	9.5: 0.98, // Near max
	9: 0.96, // Very hard
	8.5: 0.94, // Hard
	8: 0.92, // Moderate-hard
	7.5: 0.9, // Moderate
	7: 0.88, // Somewhat hard
	6.5: 0.865, // Moderate-easy (interpolated)
	6: 0.85 // Easy-moderate
};

// ============================================================================
// TYPES
// ============================================================================

/**
 * Single data point for 1RM calculation
 */
export interface OneRMDataPoint {
	weight: number;
	reps: number;
	rpe: number | null;
	date: string;
	timestamp: string;
}

/**
 * Cached 1RM entry for an exercise
 */
export interface Exercise1RMEntry {
	estimated_1rm: number; // Calculated 1RM in lbs
	trm: number; // Training Rep Max (90% of 1RM)
	last_updated: string; // ISO date string
	data_points: number; // Number of sets used in calculation
	is_stale: boolean; // True if last data > 30 days old
	last_performed: string | null; // ISO date of most recent set
	user_override: number | null; // Manual 1RM entry (takes precedence)
}

/**
 * Full cache structure
 */
export interface Exercise1RMCache {
	[exerciseName: string]: Exercise1RMEntry;
}

/**
 * Calculate 1RM options
 */
export interface Calculate1RMOptions {
	includeRPEAdjustment?: boolean;
	recencyHalfLifeDays?: number;
	staleThresholdDays?: number;
}

/**
 * PR display data for Profile view
 */
export interface ExercisePRDisplay {
	exerciseName: string;
	estimated1RM: number;
	trm: number;
	isStale: boolean;
	lastPerformed: string | null;
	daysSinceLastPerformed: number | null;
	hasUserOverride: boolean;
	userOverride: number | null;
	recentActivity: {
		lastWeight: number | null;
		lastReps: number | null;
		lastRPE: number | null;
		trend: 'up' | 'down' | 'stable' | null;
	};
}

// ============================================================================
// CORE CALCULATION FUNCTIONS
// ============================================================================

/**
 * Round down to nearest 5lb increment
 * Standard plates come in 5lb increments, so we round down for practical use
 */
export function roundDownToNearest5(value: number): number {
	if (value <= 0) return 0;
	return Math.floor(value / PLATE_INCREMENT) * PLATE_INCREMENT;
}

/**
 * Round to nearest 5 lbs (standard rounding, not always down)
 * Use this for training max calculations where we want accurate rounding.
 */
export function roundToNearest5(value: number): number {
	if (value <= 0) return 0;
	return Math.round(value / PLATE_INCREMENT) * PLATE_INCREMENT;
}

/**
 * Calculate 1RM using Epley formula
 * Formula: 1RM = weight * (1 + reps/30)
 *
 * @param weight - Weight lifted
 * @param reps - Reps completed (capped at 10 for accuracy)
 * @returns Estimated 1RM
 */
export function calculateEpley1RM(weight: number, reps: number): number {
	if (weight <= 0 || reps <= 0) {
		return 0;
	}

	// For 1 rep, the 1RM equals the weight
	if (reps === 1) {
		return weight;
	}

	// Cap reps at 10 for Epley accuracy
	const effectiveReps = Math.min(reps, MAX_REPS_FOR_CALCULATION);

	// Epley formula: weight * (1 + reps/30)
	return weight * (1 + effectiveReps / 30);
}

/**
 * Adjust calculated 1RM based on RPE
 * Divides by RPE factor to estimate true max from submaximal effort
 *
 * @deprecated Use calculateTrainingMax() instead for rep-threshold logic
 * @param raw1RM - Raw 1RM from Epley formula
 * @param rpe - Rate of Perceived Exertion (1-10)
 * @returns Adjusted 1RM
 */
export function adjustForRPE(raw1RM: number, rpe: number | null): number {
	if (rpe === null || raw1RM <= 0) {
		return raw1RM;
	}

	// Clamp RPE to valid range
	const clampedRPE = Math.max(6, Math.min(10, rpe));

	// Get adjustment factor (interpolate if needed)
	let factor = RPE_ADJUSTMENT[clampedRPE];
	if (factor === undefined) {
		// Interpolate between known values
		const lowerRPE = Math.floor(clampedRPE * 2) / 2;
		const upperRPE = Math.ceil(clampedRPE * 2) / 2;
		const lowerFactor = RPE_ADJUSTMENT[lowerRPE] ?? 1.0;
		const upperFactor = RPE_ADJUSTMENT[upperRPE] ?? 1.0;
		const t = (clampedRPE - lowerRPE) / (upperRPE - lowerRPE || 1);
		factor = lowerFactor + t * (upperFactor - lowerFactor);
	}

	// Divide by factor to estimate true max
	// (If RPE was 8 at 92% effort, true max = calculated / 0.92)
	return raw1RM / factor;
}

/**
 * Calculate days between two dates
 */
export function daysBetween(date1: string, date2: string): number {
	const d1 = new Date(date1);
	const d2 = new Date(date2);
	const diffMs = Math.abs(d2.getTime() - d1.getTime());
	return diffMs / (1000 * 60 * 60 * 24);
}

/**
 * Check if data is stale (>30 days old)
 */
export function isStale(lastPerformed: string | null, thresholdDays = STALE_THRESHOLD_DAYS): boolean {
	if (!lastPerformed) return true;
	const now = toLocalDateString(new Date());
	return daysBetween(lastPerformed, now) > thresholdDays;
}

/**
 * Calculate time weight for a data point using exponential decay
 * More recent data gets higher weight
 *
 * @param dataDate - Date of the data point
 * @param today - Today's date
 * @param halfLifeDays - Half-life for decay (default 14 days)
 * @returns Weight between 0 and 1
 */
export function calculateTimeWeight(
	dataDate: string,
	today: string,
	halfLifeDays = RECENCY_HALF_LIFE_DAYS
): number {
	const daysAgo = daysBetween(dataDate, today);
	// Exponential decay: weight = 0.5^(daysAgo / halfLife)
	return Math.pow(0.5, daysAgo / halfLifeDays);
}

/**
 * Derive TRM (Training Rep Max) from 1RM
 * TRM = 90% of 1RM, rounded down to nearest 5lb
 */
export function deriveTRM(oneRM: number): number {
	return roundDownToNearest5(oneRM * TRM_FACTOR);
}

/**
 * Apply high RPE discount for near-maximal training sets
 * Only applies discount for RPE >= 9 (multiply, not divide)
 *
 * @param value - Calculated training max value
 * @param rpe - Rate of Perceived Exertion (1-10)
 * @returns Discounted value for near-maximal effort, unchanged otherwise
 */
export function applyHighRPEDiscount(value: number, rpe: number | null): number {
	if (rpe === null || value <= 0) {
		return value;
	}

	// Only apply discount for RPE >= 9
	if (rpe < HIGH_RPE_THRESHOLD) {
		return value;
	}

	// Clamp RPE to valid range
	const clampedRPE = Math.max(HIGH_RPE_THRESHOLD, Math.min(10, rpe));

	// Get discount factor (interpolate if needed)
	let factor = HIGH_RPE_DISCOUNT[clampedRPE];
	if (factor === undefined) {
		// Interpolate between known values
		const lowerRPE = Math.floor(clampedRPE * 2) / 2;
		const upperRPE = Math.ceil(clampedRPE * 2) / 2;
		const lowerFactor = HIGH_RPE_DISCOUNT[lowerRPE] ?? 1.0;
		const upperFactor = HIGH_RPE_DISCOUNT[upperRPE] ?? 1.0;
		const t = (clampedRPE - lowerRPE) / (upperRPE - lowerRPE || 1);
		factor = lowerFactor + t * (upperFactor - lowerFactor);
	}

	// Multiply by discount factor (0.96-1.0)
	return value * factor;
}

/**
 * Calculate Training Max from weight, reps, and RPE
 * Applies rep-threshold logic to avoid double-discount bug:
 * - Reps 1-2: Max attempt → calculate estimated 1RM (no TRM derivation yet)
 * - Reps 3+: Training set → Epley result IS the TRM (apply high RPE discount only)
 *
 * @param weight - Weight lifted
 * @param reps - Reps completed
 * @param rpe - Rate of Perceived Exertion (1-10)
 * @returns Training max value, rounded to nearest 5 lbs
 */
export function calculateTrainingMax(weight: number, reps: number, rpe: number | null): number {
	if (weight <= 0 || reps <= 0) {
		return 0;
	}

	// Calculate base value using Epley formula
	const epleyResult = calculateEpley1RM(weight, reps);

	if (reps <= MAX_REPS_FOR_1RM_ESTIMATION) {
		// Max attempt (1-2 reps): return estimated 1RM
		// (TRM derivation happens later at the entry level)
		return epleyResult;
	} else {
		// Training set (3+ reps): Epley result IS the TRM
		// Apply high RPE discount (only for RPE >= 9)
		const discounted = applyHighRPEDiscount(epleyResult, rpe);
		return roundToNearest5(discounted);
	}
}

/**
 * Get the best set per day from data points
 * "Best" = highest estimated 1RM (heaviest set takes precedence)
 *
 * @param dataPoints - Array of 1RM data points
 * @param includeRPEAdjustment - Whether to apply RPE adjustment
 * @returns Map of date -> best data point for that day
 */
export function getBestSetPerDay(
	dataPoints: OneRMDataPoint[],
	includeRPEAdjustment = true
): Map<string, OneRMDataPoint> {
	const bestByDay = new Map<string, { point: OneRMDataPoint; estimatedValue: number }>();

	for (const point of dataPoints) {
		// Calculate training max value for this set
		const estimatedValue = calculateTrainingMax(point.weight, point.reps, point.rpe);

		const existing = bestByDay.get(point.date);
		if (!existing || estimatedValue > existing.estimatedValue) {
			bestByDay.set(point.date, { point, estimatedValue });
		}
	}

	// Return just the points
	const result = new Map<string, OneRMDataPoint>();
	bestByDay.forEach(({ point }, date) => {
		result.set(date, point);
	});
	return result;
}

/**
 * Calculate time-weighted average 1RM from multiple data points
 * Recent data is weighted higher using exponential decay
 *
 * IMPORTANT: Only uses the BEST set per day to avoid warmup/light sets
 * diluting the calculation. 165x6 takes precedence over 135x6 on the same day.
 *
 * @param dataPoints - Array of 1RM data points
 * @param options - Calculation options
 * @returns Weighted average 1RM
 */
export function calculateTimeWeightedAverage(
	dataPoints: OneRMDataPoint[],
	options: Calculate1RMOptions = {}
): number {
	if (dataPoints.length === 0) {
		return 0;
	}

	const { includeRPEAdjustment = true, recencyHalfLifeDays = RECENCY_HALF_LIFE_DAYS } = options;

	// Get only the best set per day (filters out warmup/light sets)
	const bestByDay = getBestSetPerDay(dataPoints, includeRPEAdjustment);

	const today = toLocalDateString(new Date());
	let weightedSum = 0;
	let totalWeight = 0;

	bestByDay.forEach((point, date) => {
		// Calculate training max value for this set
		const trainingMaxValue = calculateTrainingMax(point.weight, point.reps, point.rpe);

		// Calculate time weight (recent data weighted higher)
		const timeWeight = calculateTimeWeight(date, today, recencyHalfLifeDays);

		weightedSum += trainingMaxValue * timeWeight;
		totalWeight += timeWeight;
	});

	if (totalWeight === 0) {
		return 0;
	}

	return roundDownToNearest5(weightedSum / totalWeight);
}

// ============================================================================
// DATA EXTRACTION
// ============================================================================

/**
 * Extract data points from history for 1RM calculation
 * Filters for completed sets with weight and reps data
 *
 * @param exerciseName - Name of the exercise
 * @param history - Exercise history rows
 * @returns Array of data points suitable for 1RM calculation
 */
export function extractDataPointsFromHistory(
	exerciseName: string,
	history: HistoryRow[]
): OneRMDataPoint[] {
	const dataPoints: OneRMDataPoint[] = [];

	for (const row of history) {
		// Skip compound parents and incomplete sets
		if (row.is_compound_parent || !row.completed) {
			continue;
		}

		// Must match exercise name
		if (row.exercise_name !== exerciseName) {
			continue;
		}

		// Must have both weight and reps for Epley calculation
		if (row.weight === null || row.reps === null || row.weight <= 0 || row.reps <= 0) {
			continue;
		}

		dataPoints.push({
			weight: row.weight,
			reps: row.reps,
			rpe: row.rpe,
			date: row.date,
			timestamp: row.timestamp
		});
	}

	// Sort by date descending (most recent first)
	dataPoints.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

	return dataPoints;
}

/**
 * Get the most recent data point for an exercise
 */
export function getMostRecentDataPoint(
	exerciseName: string,
	history: HistoryRow[]
): OneRMDataPoint | null {
	const dataPoints = extractDataPointsFromHistory(exerciseName, history);
	return dataPoints.length > 0 ? dataPoints[0] : null;
}

/**
 * Calculate the trend direction based on recent performance
 * Uses best set per day to avoid trends from multiple sets in same session
 * Requires at least 2 unique days of data to show a trend
 */
export function calculateTrend(
	dataPoints: OneRMDataPoint[]
): 'up' | 'down' | 'stable' | null {
	if (dataPoints.length < 2) {
		return null;
	}

	// Use best set per day to avoid false trends from warmup/working sets in same session
	const bestByDay = getBestSetPerDay(dataPoints, true);

	// Need at least 2 unique days to calculate trend
	if (bestByDay.size < 2) {
		return null;
	}

	// Sort days by date descending (most recent first)
	const sortedDays = Array.from(bestByDay.entries())
		.sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
		.slice(0, 5); // Take up to 5 most recent days

	// Calculate 1RM for each day's best set
	const estimates = sortedDays.map(([, point]) => calculateEpley1RM(point.weight, point.reps));

	// Compare most recent day to average of previous days
	const mostRecent = estimates[0];
	const previousAvg = estimates.slice(1).reduce((a, b) => a + b, 0) / (estimates.length - 1);

	const percentChange = ((mostRecent - previousAvg) / previousAvg) * 100;

	if (percentChange > 2) {
		return 'up';
	} else if (percentChange < -2) {
		return 'down';
	}
	return 'stable';
}

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

/**
 * Calculate 1RM entry for an exercise
 */
export function calculate1RMEntry(
	exerciseName: string,
	history: HistoryRow[],
	userOverride: number | null = null,
	options: Calculate1RMOptions = {}
): Exercise1RMEntry {
	const { staleThresholdDays = STALE_THRESHOLD_DAYS } = options;

	const dataPoints = extractDataPointsFromHistory(exerciseName, history);
	const lastPoint = dataPoints.length > 0 ? dataPoints[0] : null;

	// Calculate time-weighted average training max
	const calculatedTRM = calculateTimeWeightedAverage(dataPoints, options);

	// Determine if most sets are max attempts (1-2 reps) or training sets (3+ reps)
	const maxAttemptSets = dataPoints.filter(p => p.reps <= MAX_REPS_FOR_1RM_ESTIMATION).length;
	const trainingSets = dataPoints.filter(p => p.reps > MAX_REPS_FOR_1RM_ESTIMATION).length;

	let estimated1RM: number;
	let trm: number;

	if (userOverride !== null && userOverride > 0) {
		// User override takes precedence
		estimated1RM = calculatedTRM; // Keep calculated value for display
		trm = deriveTRM(userOverride);
	} else if (maxAttemptSets > trainingSets) {
		// Most sets are max attempts (1-2 reps)
		// calculatedTRM is an estimated 1RM, derive TRM from it
		estimated1RM = calculatedTRM;
		trm = deriveTRM(calculatedTRM);
	} else {
		// Most sets are training sets (3+ reps)
		// calculatedTRM IS the TRM (no further discount)
		estimated1RM = calculatedTRM;
		trm = calculatedTRM;
	}

	return {
		estimated_1rm: estimated1RM,
		trm: trm,
		last_updated: new Date().toISOString(),
		data_points: dataPoints.length,
		is_stale: isStale(lastPoint?.date ?? null, staleThresholdDays),
		last_performed: lastPoint?.date ?? null,
		user_override: userOverride
	};
}

/**
 * Load cache from localStorage
 */
function loadCache(): Exercise1RMCache {
	if (!isBrowser) return {};

	try {
		const stored = localStorage.getItem(CACHE_KEY);
		if (stored) {
			return JSON.parse(stored) as Exercise1RMCache;
		}
	} catch (e) {
		console.error('Failed to load 1RM cache:', e);
	}

	return {};
}

/**
 * Save cache to localStorage
 */
function saveCache(cache: Exercise1RMCache): void {
	if (!isBrowser) return;

	try {
		localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
	} catch (e) {
		console.error('Failed to save 1RM cache:', e);
	}
}

// ============================================================================
// STORE
// ============================================================================

/**
 * 1RM cache store
 */
export const oneRMCacheStore = writable<Exercise1RMCache>(loadCache());

// Auto-save on changes
oneRMCacheStore.subscribe((cache) => {
	saveCache(cache);
});

// ============================================================================
// STORE ACTIONS
// ============================================================================

/**
 * Update cache for a single exercise (incremental update)
 * Call this after logging a set
 */
export function updateCacheForExercise(
	exerciseName: string,
	userOverride: number | null = null
): void {
	const history = get(exerciseHistory);
	const entry = calculate1RMEntry(exerciseName, history, userOverride);

	oneRMCacheStore.update((cache) => ({
		...cache,
		[exerciseName]: entry
	}));
}

/**
 * Full recalculation of cache from history
 * Call this on app startup or after history import
 */
export function fullRecalculateCache(
	exerciseNames?: string[],
	userOverrides?: Record<string, number>
): void {
	const history = get(exerciseHistory);

	// If no exercise list provided, extract from history AND userOverrides
	// This ensures exercises with overrides but no history are included
	const historyNames = history.filter((r) => !r.is_compound_parent).map((r) => r.exercise_name);
	const overrideNames = userOverrides ? Object.keys(userOverrides) : [];
	const names = exerciseNames ?? Array.from(new Set([...historyNames, ...overrideNames]));

	const newCache: Exercise1RMCache = {};

	for (const name of names) {
		const override = userOverrides?.[name] ?? null;
		newCache[name] = calculate1RMEntry(name, history, override);
	}

	oneRMCacheStore.set(newCache);
}

/**
 * Get cached entry for an exercise (O(1) lookup)
 */
export function getFromCache(exerciseName: string): Exercise1RMEntry | null {
	const cache = get(oneRMCacheStore);
	return cache[exerciseName] ?? null;
}

/**
 * Set user override for an exercise
 * Override takes precedence for TRM calculation
 */
export function setUserOverride(exerciseName: string, overrideValue: number | null): void {
	const history = get(exerciseHistory);
	const entry = calculate1RMEntry(exerciseName, history, overrideValue);

	oneRMCacheStore.update((cache) => ({
		...cache,
		[exerciseName]: entry
	}));
}

/**
 * Clear user override for an exercise
 */
export function clearUserOverride(exerciseName: string): void {
	setUserOverride(exerciseName, null);
}

/**
 * Invalidate entire cache (for testing/debugging)
 */
export function invalidateCache(): void {
	oneRMCacheStore.set({});
}

/**
 * Get PR display data for Profile view
 */
export function getPRDisplayData(exerciseName: string): ExercisePRDisplay | null {
	const entry = getFromCache(exerciseName);
	if (!entry) return null;

	const history = get(exerciseHistory);
	const dataPoints = extractDataPointsFromHistory(exerciseName, history);

	// Get the BEST set from the most recent day (not just the chronologically last set)
	// This ensures we show 165x8 instead of 135x6 when both are logged in same session
	const bestByDay = getBestSetPerDay(dataPoints, true);
	const sortedDays = Array.from(bestByDay.entries()).sort(
		(a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime()
	);
	const mostRecentBest = sortedDays.length > 0 ? sortedDays[0][1] : null;

	// Calculate days since last performed
	let daysSinceLastPerformed: number | null = null;
	if (entry.last_performed) {
		const today = toLocalDateString(new Date());
		daysSinceLastPerformed = Math.round(daysBetween(entry.last_performed, today));
	}

	return {
		exerciseName,
		estimated1RM: entry.estimated_1rm,
		trm: entry.trm,
		isStale: entry.is_stale,
		lastPerformed: entry.last_performed,
		daysSinceLastPerformed,
		hasUserOverride: entry.user_override !== null,
		userOverride: entry.user_override,
		recentActivity: {
			lastWeight: mostRecentBest?.weight ?? null,
			lastReps: mostRecentBest?.reps ?? null,
			lastRPE: mostRecentBest?.rpe ?? null,
			trend: calculateTrend(dataPoints)
		}
	};
}

/**
 * Get all cached exercises with their PR data
 */
export function getAllPRDisplayData(): ExercisePRDisplay[] {
	const cache = get(oneRMCacheStore);
	const results: ExercisePRDisplay[] = [];

	for (const exerciseName of Object.keys(cache)) {
		const display = getPRDisplayData(exerciseName);
		if (display) {
			results.push(display);
		}
	}

	return results;
}
