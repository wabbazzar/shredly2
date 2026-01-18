/**
 * User Profile Types for Shredly 2.0
 *
 * Stores user stats, preferences, and personal records.
 * All data persists in localStorage (client-side only, Phase 1).
 */

export type UnitSystem = 'imperial' | 'metric';

/**
 * All equipment types available in the exercise database.
 * Derived from src/data/exercise_database.json equipment field values.
 * Note: "None" is excluded as it represents bodyweight (no equipment needed).
 */
export const ALL_EQUIPMENT_TYPES = [
	'Anchor Point',
	'Assault Bike',
	'Axle Bar',
	'Barbell',
	'Battle Ropes',
	'Belt Squat Machine',
	'Bench',
	'Bicycle',
	'Blocks',
	'Box',
	'Cable Machine',
	'Cambered Bar',
	'Chains',
	'Chair',
	'Dip Station',
	'Duffalo Bar',
	'Dumbbell',
	'Dumbbells',
	'Elliptical Machine',
	'Foam Roller',
	'Incline Bench',
	'Jump Rope',
	'Kettlebell',
	'Landmine Attachment',
	'Lat Pulldown Bar',
	'Leg Extension Machine',
	'Nordic Curl Strap',
	'Parallel Bars',
	'Parallettes',
	'Plates',
	'Platform',
	'Pool',
	'Power Rack',
	'Pull-up Bar',
	'Resistance Band',
	'Resistance Bands',
	'Rings',
	'Rowing Machine',
	'Safety Squat Bar',
	'Ski Erg',
	'Slingshot',
	'Squat Rack',
	'Stationary Bike',
	'T-Bar',
	'Track',
	'Trap Bar',
	'Treadmill',
	'Wall',
	'Weight Belt',
	'Yoga Mat'
] as const;

export type EquipmentType = (typeof ALL_EQUIPMENT_TYPES)[number];

/**
 * Location types for workout days
 */
export type WorkoutLocation = 'home' | 'gym';

/**
 * Equipment profile for a specific location
 */
export interface LocationEquipmentProfile {
	location: WorkoutLocation;
	equipment: EquipmentType[];
}

/**
 * Default equipment for gym - comprehensive commercial gym setup
 */
export const DEFAULT_GYM_EQUIPMENT: EquipmentType[] = [
	'Barbell',
	'Bench',
	'Box',
	'Cable Machine',
	'Dip Station',
	'Dumbbell',
	'Dumbbells',
	'Foam Roller',
	'Incline Bench',
	'Kettlebell',
	'Lat Pulldown Bar',
	'Leg Extension Machine',
	'Plates',
	'Platform',
	'Power Rack',
	'Pull-up Bar',
	'Resistance Bands',
	'Squat Rack',
	'Trap Bar',
	'Weight Belt',
	'Yoga Mat'
];

/**
 * Default equipment for home gym - basic home setup
 */
export const DEFAULT_HOME_EQUIPMENT: EquipmentType[] = [
	'Bench',
	'Box',
	'Chair',
	'Dumbbell',
	'Dumbbells',
	'Foam Roller',
	'Jump Rope',
	'Pull-up Bar',
	'Resistance Band',
	'Resistance Bands',
	'Wall',
	'Yoga Mat'
];

/**
 * Equipment categories for grouping in the UI
 */
export const EQUIPMENT_CATEGORIES: Record<string, EquipmentType[]> = {
	'Free Weights': [
		'Barbell',
		'Dumbbell',
		'Dumbbells',
		'Kettlebell',
		'Plates',
		'Trap Bar',
		'Safety Squat Bar',
		'Cambered Bar',
		'Duffalo Bar',
		'Axle Bar'
	],
	'Benches & Racks': [
		'Bench',
		'Incline Bench',
		'Squat Rack',
		'Power Rack',
		'Box',
		'Platform',
		'Blocks'
	],
	Machines: [
		'Cable Machine',
		'Leg Extension Machine',
		'Belt Squat Machine',
		'Lat Pulldown Bar',
		'Landmine Attachment',
		'T-Bar'
	],
	'Cardio Equipment': [
		'Treadmill',
		'Stationary Bike',
		'Bicycle',
		'Rowing Machine',
		'Elliptical Machine',
		'Assault Bike',
		'Ski Erg',
		'Track',
		'Pool'
	],
	'Bodyweight & Gymnastics': [
		'Pull-up Bar',
		'Dip Station',
		'Parallel Bars',
		'Parallettes',
		'Rings',
		'Nordic Curl Strap'
	],
	'Bands & Cables': ['Resistance Band', 'Resistance Bands', 'Battle Ropes', 'Anchor Point'],
	Accessories: [
		'Yoga Mat',
		'Foam Roller',
		'Chair',
		'Wall',
		'Weight Belt',
		'Chains',
		'Slingshot',
		'Jump Rope'
	]
};

export interface UserProfile {
	name: string;
	heightInches: number; // Always stored in inches internally
	weightLbs: number; // Always stored in lbs internally
	birthday: string; // ISO date string (YYYY-MM-DD)
	unitSystem: UnitSystem;
}

/**
 * Questionnaire preferences for workout generation.
 * These are the answers from workout-questionnaire.json.
 */
export interface WorkoutPreferences {
	goal: 'build_muscle' | 'tone' | 'lose_weight';
	session_duration: '20' | '30' | '45' | '60';
	experience_level: 'beginner' | 'intermediate' | 'advanced';
	/** @deprecated Use homeEquipment/gymEquipment instead. Kept for backward compatibility migration. */
	equipment_access?: 'full_gym' | 'dumbbells_only' | 'bodyweight_only';
	training_frequency: '2' | '3' | '4' | '5' | '6' | '7';
	program_duration: '3' | '4' | '6';
	/** Equipment available at home gym */
	homeEquipment: EquipmentType[];
	/** Equipment available at commercial gym */
	gymEquipment: EquipmentType[];
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
		birthday: '1994-01-15', // ~32 years old
		unitSystem: 'imperial'
	},
	preferences: {
		goal: 'build_muscle',
		session_duration: '30',
		experience_level: 'intermediate',
		training_frequency: '4',
		program_duration: '4',
		homeEquipment: [...DEFAULT_HOME_EQUIPMENT],
		gymEquipment: [...DEFAULT_GYM_EQUIPMENT]
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

/**
 * Calculate age from birthday string (YYYY-MM-DD format)
 */
export function calculateAge(birthday: string): number {
	const birthDate = new Date(birthday);
	const today = new Date();
	let age = today.getFullYear() - birthDate.getFullYear();
	const monthDiff = today.getMonth() - birthDate.getMonth();
	// Adjust if birthday hasn't occurred yet this year
	if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
		age--;
	}
	return age;
}

/**
 * Convert age to approximate birthday (assumes Jan 1 of birth year)
 */
export function ageToBirthday(age: number): string {
	const year = new Date().getFullYear() - age;
	return `${year}-01-01`;
}
