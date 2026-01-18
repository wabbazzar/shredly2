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
	type EquipmentType,
	DEFAULT_USER,
	BIG_4_LIFTS,
	DEFAULT_HOME_EQUIPMENT,
	DEFAULT_GYM_EQUIPMENT,
	ageToBirthday
} from '$lib/types/user';

const STORAGE_KEY = 'shredly_user';

// Browser check that works without SvelteKit context
const isBrowser = typeof window !== 'undefined';

/**
 * Migrate legacy equipment_access field to new homeEquipment/gymEquipment arrays.
 * This handles users who have data from before ticket #025.
 */
function migrateEquipmentAccess(
	legacyAccess: 'full_gym' | 'dumbbells_only' | 'bodyweight_only'
): { homeEquipment: EquipmentType[]; gymEquipment: EquipmentType[] } {
	switch (legacyAccess) {
		case 'full_gym':
			return {
				homeEquipment: [...DEFAULT_HOME_EQUIPMENT],
				gymEquipment: [...DEFAULT_GYM_EQUIPMENT]
			};
		case 'dumbbells_only':
			return {
				homeEquipment: [
					'Bench',
					'Chair',
					'Dumbbell',
					'Dumbbells',
					'Wall',
					'Yoga Mat'
				] as EquipmentType[],
				gymEquipment: [
					'Bench',
					'Chair',
					'Dumbbell',
					'Dumbbells',
					'Pull-up Bar',
					'Wall',
					'Yoga Mat'
				] as EquipmentType[]
			};
		case 'bodyweight_only':
			return {
				homeEquipment: ['Box', 'Chair', 'Pull-up Bar', 'Wall', 'Yoga Mat'] as EquipmentType[],
				gymEquipment: [
					'Box',
					'Chair',
					'Platform',
					'Pull-up Bar',
					'Wall',
					'Yoga Mat'
				] as EquipmentType[]
			};
	}
}

/**
 * Migrate user data from older versions to current format.
 */
function migrateUserData(parsed: UserData): UserData {
	let migrated = { ...parsed };
	let needsMigration = false;

	// Migration: equipment_access -> homeEquipment/gymEquipment
	if (
		parsed.preferences.equipment_access &&
		(!parsed.preferences.homeEquipment || !parsed.preferences.gymEquipment)
	) {
		const { homeEquipment, gymEquipment } = migrateEquipmentAccess(
			parsed.preferences.equipment_access
		);
		migrated = {
			...migrated,
			preferences: {
				...migrated.preferences,
				homeEquipment,
				gymEquipment
			}
		};
		needsMigration = true;
	}

	// Ensure homeEquipment and gymEquipment exist with defaults
	if (!migrated.preferences.homeEquipment) {
		migrated.preferences.homeEquipment = [...DEFAULT_HOME_EQUIPMENT];
		needsMigration = true;
	}
	if (!migrated.preferences.gymEquipment) {
		migrated.preferences.gymEquipment = [...DEFAULT_GYM_EQUIPMENT];
		needsMigration = true;
	}

	// Migration: age -> birthday
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const profileAny = parsed.profile as any;
	if (profileAny.age !== undefined && !profileAny.birthday) {
		migrated = {
			...migrated,
			profile: {
				...migrated.profile,
				birthday: ageToBirthday(profileAny.age)
			}
		};
		needsMigration = true;
	}

	// Ensure birthday exists with default
	if (!migrated.profile.birthday) {
		migrated.profile.birthday = DEFAULT_USER.profile.birthday;
		needsMigration = true;
	}

	if (needsMigration) {
		migrated.updatedAt = new Date().toISOString();
	}

	return migrated;
}

function loadFromStorage(): UserData {
	if (!isBrowser) return DEFAULT_USER;

	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			let parsed = JSON.parse(stored) as UserData;

			// Run migrations for older data formats
			parsed = migrateUserData(parsed);

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
		},

		/**
		 * Update home equipment list
		 */
		updateHomeEquipment: (equipment: EquipmentType[]) => {
			update((data) => ({
				...data,
				preferences: { ...data.preferences, homeEquipment: equipment },
				updatedAt: new Date().toISOString()
			}));
		},

		/**
		 * Update gym equipment list
		 */
		updateGymEquipment: (equipment: EquipmentType[]) => {
			update((data) => ({
				...data,
				preferences: { ...data.preferences, gymEquipment: equipment },
				updatedAt: new Date().toISOString()
			}));
		},

		/**
		 * Toggle a single equipment item for a location
		 */
		toggleEquipment: (location: 'home' | 'gym', equipment: EquipmentType) => {
			update((data) => {
				const key = location === 'home' ? 'homeEquipment' : 'gymEquipment';
				const current = data.preferences[key];
				const newEquipment = current.includes(equipment)
					? current.filter((e) => e !== equipment)
					: [...current, equipment];

				return {
					...data,
					preferences: { ...data.preferences, [key]: newEquipment },
					updatedAt: new Date().toISOString()
				};
			});
		},

		/**
		 * Get equipment list for a location (non-reactive)
		 */
		getEquipment: (location: 'home' | 'gym'): EquipmentType[] => {
			const key = location === 'home' ? 'homeEquipment' : 'gymEquipment';
			return get({ subscribe }).preferences[key];
		},

		/**
		 * Remove a 1RM entry by exercise name
		 */
		removeOneRepMax: (exerciseName: string) => {
			update((data) => ({
				...data,
				oneRepMaxes: data.oneRepMaxes.filter((orm) => orm.exerciseName !== exerciseName),
				updatedAt: new Date().toISOString()
			}));
		}
	};
}

export const userStore = createUserStore();
