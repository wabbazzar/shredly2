/**
 * User Store - Manages user profile, preferences, and PRs
 *
 * Persists to localStorage automatically on changes.
 * Initializes with default user "V" if no data exists.
 */

import { writable, get } from 'svelte/store';
import {
	type UserData,
	type UserProfile,
	type WorkoutPreferences,
	type OneRepMax,
	type UnitSystem,
	DEFAULT_USER,
	BIG_4_LIFTS
} from '$lib/types/user';

const STORAGE_KEY = 'shredly_user';

// Browser check that works without SvelteKit context
const isBrowser = typeof window !== 'undefined';

function loadFromStorage(): UserData {
	if (!isBrowser) return DEFAULT_USER;

	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			const parsed = JSON.parse(stored) as UserData;
			// Ensure Big 4 lifts exist (migration safety)
			const existingLiftNames = new Set(parsed.oneRepMaxes.map((orm) => orm.exerciseName));
			for (const lift of BIG_4_LIFTS) {
				if (!existingLiftNames.has(lift)) {
					parsed.oneRepMaxes.push({
						exerciseName: lift,
						weightLbs: 0,
						updatedAt: new Date().toISOString(),
						isManual: true
					});
				}
			}
			return parsed;
		}
	} catch (e) {
		console.error('Failed to load user data from localStorage:', e);
	}

	return DEFAULT_USER;
}

function saveToStorage(data: UserData): void {
	if (!isBrowser) return;

	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
	} catch (e) {
		console.error('Failed to save user data to localStorage:', e);
	}
}

function createUserStore() {
	const { subscribe, update, set } = writable<UserData>(loadFromStorage());

	// Auto-save on changes
	subscribe((data) => {
		saveToStorage(data);
	});

	return {
		subscribe,

		/**
		 * Update profile fields (name, height, weight, age)
		 */
		updateProfile: (updates: Partial<UserProfile>) => {
			update((data) => ({
				...data,
				profile: { ...data.profile, ...updates },
				updatedAt: new Date().toISOString()
			}));
		},

		/**
		 * Update workout preferences
		 */
		updatePreferences: (updates: Partial<WorkoutPreferences>) => {
			update((data) => ({
				...data,
				preferences: { ...data.preferences, ...updates },
				updatedAt: new Date().toISOString()
			}));
		},

		/**
		 * Update a single 1RM
		 */
		updateOneRepMax: (exerciseName: string, weightLbs: number, isManual = true) => {
			update((data) => {
				const existing = data.oneRepMaxes.find((orm) => orm.exerciseName === exerciseName);
				const now = new Date().toISOString();

				if (existing) {
					return {
						...data,
						oneRepMaxes: data.oneRepMaxes.map((orm) =>
							orm.exerciseName === exerciseName
								? { ...orm, weightLbs, updatedAt: now, isManual }
								: orm
						),
						updatedAt: now
					};
				}

				return {
					...data,
					oneRepMaxes: [
						...data.oneRepMaxes,
						{ exerciseName, weightLbs, updatedAt: now, isManual }
					],
					updatedAt: now
				};
			});
		},

		/**
		 * Set unit system (imperial/metric)
		 */
		setUnitSystem: (unitSystem: UnitSystem) => {
			update((data) => ({
				...data,
				profile: { ...data.profile, unitSystem },
				updatedAt: new Date().toISOString()
			}));
		},

		/**
		 * Get current profile data (non-reactive)
		 */
		getProfile: () => get({ subscribe }).profile,

		/**
		 * Get current preferences (non-reactive)
		 */
		getPreferences: () => get({ subscribe }).preferences,

		/**
		 * Get 1RM for a specific lift
		 */
		getOneRepMax: (exerciseName: string): OneRepMax | undefined => {
			return get({ subscribe }).oneRepMaxes.find((orm) => orm.exerciseName === exerciseName);
		},

		/**
		 * Reset to default user
		 */
		reset: () => {
			set(DEFAULT_USER);
		}
	};
}

export const userStore = createUserStore();
