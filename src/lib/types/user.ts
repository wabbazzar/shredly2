/**
 * User Profile Types for Shredly 2.0
 *
 * Stores user stats, preferences, and personal records.
 * All data persists in localStorage (client-side only, Phase 1).
 */

export type UnitSystem = 'imperial' | 'metric';

export interface UserProfile {
	name: string;
	heightInches: number; // Always stored in inches internally
	weightLbs: number; // Always stored in lbs internally
	age: number;
	unitSystem: UnitSystem;
}

/**
 * Questionnaire preferences for workout generation.
 * These are the answers from workout-questionnaire.json.
 */
export interface WorkoutPreferences {
	goal: 'build_muscle' | 'tone' | 'lose_weight';
	session_duration: '20' | '30' | '60';
	experience_level: 'beginner' | 'intermediate' | 'advanced';
	equipment_access: 'full_gym' | 'dumbbells_only' | 'bodyweight_only';
	training_frequency: '2' | '3' | '4' | '5' | '6' | '7';
	program_duration: '3' | '4' | '6';
}

/**
 * One Rep Max for a specific lift.
 * Weight is always stored in lbs internally.
 */
export interface OneRepMax {
	exerciseName: string;
	weightLbs: number;
	updatedAt: string; // ISO date string
	isManual: boolean; // true if user entered, false if calculated from history
}

/**
 * The big 4 lifts that always show in Profile
 */
export const BIG_4_LIFTS = ['Bench Press', 'Squat', 'Deadlift', 'Overhead Press'] as const;
export type Big4Lift = (typeof BIG_4_LIFTS)[number];

/**
 * Complete user data structure
 */
export interface UserData {
	profile: UserProfile;
	preferences: WorkoutPreferences;
	oneRepMaxes: OneRepMax[];
	createdAt: string;
	updatedAt: string;
}

/**
 * Default user "V"
 */
export const DEFAULT_USER: UserData = {
	profile: {
		name: 'V',
		heightInches: 65, // 5'5"
		weightLbs: 140,
		age: 32,
		unitSystem: 'imperial'
	},
	preferences: {
		goal: 'build_muscle',
		session_duration: '30',
		experience_level: 'intermediate',
		equipment_access: 'full_gym',
		training_frequency: '4',
		program_duration: '4'
	},
	oneRepMaxes: [
		{
			exerciseName: 'Bench Press',
			weightLbs: 135,
			updatedAt: new Date().toISOString(),
			isManual: true
		},
		{ exerciseName: 'Squat', weightLbs: 135, updatedAt: new Date().toISOString(), isManual: true },
		{
			exerciseName: 'Deadlift',
			weightLbs: 135,
			updatedAt: new Date().toISOString(),
			isManual: true
		},
		{
			exerciseName: 'Overhead Press',
			weightLbs: 135,
			updatedAt: new Date().toISOString(),
			isManual: true
		}
	],
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString()
};

// Unit conversion helpers
export function inchesToFeetAndInches(totalInches: number): { feet: number; inches: number } {
	return {
		feet: Math.floor(totalInches / 12),
		inches: totalInches % 12
	};
}

export function feetAndInchesToInches(feet: number, inches: number): number {
	return feet * 12 + inches;
}

export function lbsToKg(lbs: number): number {
	return Math.round(lbs * 0.453592 * 10) / 10;
}

export function kgToLbs(kg: number): number {
	return Math.round(kg * 2.20462 * 10) / 10;
}

export function inchesToCm(inches: number): number {
	return Math.round(inches * 2.54);
}

export function cmToInches(cm: number): number {
	return Math.round(cm / 2.54 * 10) / 10;
}

export function formatHeight(inches: number, unitSystem: UnitSystem): string {
	if (unitSystem === 'imperial') {
		const { feet, inches: remainingInches } = inchesToFeetAndInches(inches);
		return `${feet}'${remainingInches}"`;
	}
	return `${inchesToCm(inches)} cm`;
}

export function formatWeight(lbs: number, unitSystem: UnitSystem): string {
	if (unitSystem === 'imperial') {
		return `${lbs} lbs`;
	}
	return `${lbsToKg(lbs)} kg`;
}
