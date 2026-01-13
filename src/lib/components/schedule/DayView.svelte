<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { StoredSchedule } from '$lib/types/schedule';
	import type { ParameterizedDay, ParameterizedExercise, ParameterizedSubExercise, WeekParameters, Exercise } from '$lib/engine/types';
	import type { EditScope } from '$lib/types/schedule';
	import { saveScheduleToDb, activeSchedule } from '$lib/stores/schedule';
	import EditScopeModal from './EditScopeModal.svelte';
	import ProgressionModal from './ProgressionModal.svelte';
	import ExerciseBrowser from './ExerciseBrowser.svelte';
	import exerciseDatabase from '../../../data/exercise_database.json';

	export let schedule: StoredSchedule;
	export let weekNumber: number;
	export let dayNumber: number;

	const dispatch = createEventDispatcher<{
		back: void;
		scheduleUpdated: StoredSchedule;
	}>();

	// Use reactive schedule from store if available
	$: currentSchedule = $activeSchedule ?? schedule;

	// Get day data
	$: dayData = currentSchedule.days[dayNumber.toString()] as ParameterizedDay | undefined;

	// Edit scope memory for this session
	let rememberedScope: EditScope | null = null;
	let showScopeModal = false;
	let pendingEdit: {
		exerciseIndex: number;
		field: string;
		value: unknown;
		subExerciseIndex?: number;
	} | null = null;

	// Progression modal state
	let showProgressionModal = false;
	let progressionExercise: ParameterizedExercise | null = null;
	let progressionExerciseIndex: number = -1;
	let progressionField: string = '';
	let progressionSubExerciseIndex: number = -1; // -1 means parent exercise

	// Exercise browser state
	let showExerciseBrowser = false;
	let replacingExerciseIndex: number = -1;
	let replacingSubExerciseIndex: number = -1;
	let replacingExerciseName: string = '';
	let autoFilterCategory: string = '';
	let autoFilterMuscleGroups: string[] = [];
	let autoFilterEquipment: string[] = [];

	// Compound type switcher state
	let showCompoundTypeSwitcher = false;
	let compoundSwitcherExerciseIndex: number = -1;

	// Drag state for exercise reordering
	let draggedExerciseIndex: number | null = null;
	let highlightedExerciseIndex: number | null = null;

	// State for adding sub-exercises
	let addingSubExerciseToIndex: number = -1;

	// Compound types configuration
	const compoundTypes = [
		{ value: 'emom', label: 'EMOM', description: 'Every Minute On the Minute', color: 'bg-amber-600' },
		{ value: 'amrap', label: 'AMRAP', description: 'As Many Rounds As Possible', color: 'bg-rose-600' },
		{ value: 'circuit', label: 'CIRCUIT', description: 'Complete as Fast as Possible', color: 'bg-emerald-600' },
		{ value: 'interval', label: 'INTERVAL', description: 'Work/rest intervals', color: 'bg-cyan-600' }
	] as const;

	// Format time for display - under 90s shows seconds, otherwise minutes
	function formatTime(minutes: number | undefined, unit: string | undefined): string {
		if (minutes === undefined) return '-';

		// Convert to seconds for comparison
		const seconds = unit === 'seconds' ? Math.round(minutes * 60) : minutes * 60;

		if (seconds < 90) {
			return `${Math.round(seconds)}s`;
		}
		return `${(seconds / 60).toFixed(1).replace(/\.0$/, '')}min`;
	}

	// Format exercise parameters for display
	function formatParams(exercise: ParameterizedExercise | ParameterizedSubExercise, week: number): {
		sets?: number;
		reps?: number | string;
		workTime?: string;
		restTime?: string;
	} {
		const weekKey = `week${week}` as keyof typeof exercise;
		const params = exercise[weekKey] as WeekParameters | undefined;
		if (!params) return {};

		const result: { sets?: number; reps?: number | string; workTime?: string; restTime?: string } = {};

		if (params.sets) result.sets = params.sets;
		if (params.reps) result.reps = params.reps;
		if (params.work_time_minutes !== undefined) {
			result.workTime = formatTime(params.work_time_minutes, params.work_time_unit);
		}
		if (params.rest_time_minutes !== undefined) {
			result.restTime = formatTime(params.rest_time_minutes, params.rest_time_unit);
		}

		return result;
	}

	// Get display value for sets/reps
	function getSetsRepsDisplay(exercise: ParameterizedExercise | ParameterizedSubExercise, week: number): string {
		const params = formatParams(exercise, week);
		if (params.sets && params.reps) {
			return `${params.sets}x${params.reps}`;
		}
		if (params.workTime) {
			return params.workTime;
		}
		return '-';
	}

	// Check if exercise is a compound block
	function isCompoundBlock(exercise: ParameterizedExercise): boolean {
		return exercise.category === 'circuit' || exercise.category === 'interval' ||
		       exercise.category === 'emom' || exercise.category === 'amrap';
	}

	// Generate compound block name from sub-exercises
	// Format: "TYPE: Sub1 + Sub2 + Sub3"
	function generateCompoundBlockName(category: string, subExercises: ParameterizedSubExercise[]): string {
		const typePrefix = category.toUpperCase();
		if (!subExercises || subExercises.length === 0) {
			return `${typePrefix} Block`;
		}
		const subNames = subExercises.map(sub => sub.name).join(' + ');
		return `${typePrefix}: ${subNames}`;
	}

	// Get display info for compound block parent
	// CIRCUIT: shows "X rounds" (rounds through exercises)
	// EMOM/AMRAP: shows work_time (block duration)
	// INTERVAL: shows "X sets" (number of intervals)
	function getCompoundBlockDisplay(exercise: ParameterizedExercise, week: number): string {
		const category = exercise.category;
		const weekKey = `week${week}` as keyof typeof exercise;
		const weekParams = exercise[weekKey] as WeekParameters | undefined;

		if (category === 'emom' || category === 'amrap') {
			// Show block duration (work_time_minutes)
			if (weekParams?.work_time_minutes !== undefined) {
				return formatTime(weekParams.work_time_minutes, weekParams.work_time_unit);
			}
			// Fallback: check week1 if current week doesn't have data
			const week1Params = exercise.week1;
			if (week1Params?.work_time_minutes !== undefined) {
				return formatTime(week1Params.work_time_minutes, week1Params.work_time_unit);
			}
			return '-';
		} else if (category === 'circuit' || category === 'interval') {
			// Show sets/rounds
			if (weekParams?.sets !== undefined) {
				return `${weekParams.sets} rounds`;
			}
			// Fallback: check week1 if current week doesn't have data
			const week1Params = exercise.week1;
			if (week1Params?.sets !== undefined) {
				return `${week1Params.sets} rounds`;
			}
			return '-';
		}
		return '-';
	}

	// Get sub-exercise display based on parent block type
	// EMOM/AMRAP/CIRCUIT: sub-exercises use reps (sub_work_mode: "reps")
	// INTERVAL: sub-exercises use work_time/rest_time (sub_work_mode: "time")
	function getSubExerciseDisplay(subEx: ParameterizedSubExercise, parentCategory: string | undefined, week: number): string {
		const params = formatParams(subEx, week);

		if (parentCategory === 'interval') {
			// Interval sub-exercises show work_time / rest_time
			if (params.workTime) {
				return params.restTime ? `${params.workTime} / ${params.restTime}` : params.workTime;
			}
		}

		// EMOM/AMRAP/CIRCUIT sub-exercises show reps
		if (params.reps !== undefined) {
			return `${params.reps} reps`;
		}

		// Fallback - try work time
		if (params.workTime) {
			return params.workTime;
		}

		return '-';
	}

	// Get the primary editable field for sub-exercises based on parent category
	function getSubExerciseEditField(parentCategory: string | undefined): string {
		if (parentCategory === 'interval') {
			return 'work_time_minutes'; // Interval sub-exercises edit work time
		}
		return 'reps'; // EMOM/AMRAP/CIRCUIT sub-exercises edit reps
	}

	// Get the primary editable field for compound block parents
	function getCompoundBlockEditField(category: string | undefined): string {
		if (category === 'emom' || category === 'amrap') {
			return 'work_time_minutes'; // Block duration
		}
		return 'sets'; // Circuit/Interval use rounds/sets
	}

	// Handle clicking a progression field (opens progression modal)
	function handleProgressionClick(exerciseIndex: number, field: string, subExerciseIndex: number = -1) {
		progressionExercise = dayData?.exercises[exerciseIndex] ?? null;
		progressionExerciseIndex = exerciseIndex;
		progressionField = field;
		progressionSubExerciseIndex = subExerciseIndex;
		showProgressionModal = true;
	}

	// Handle clicking exercise name (opens exercise browser for replacement)
	function handleExerciseNameClick(exerciseIndex: number, exerciseName: string) {
		replacingExerciseIndex = exerciseIndex;
		replacingSubExerciseIndex = -1; // Reset sub-exercise index
		replacingExerciseName = exerciseName;

		// Lookup exercise metadata and set auto-filters
		const exerciseData = findExerciseInDatabase(exerciseName);
		autoFilterCategory = exerciseData?.category || '';
		autoFilterMuscleGroups = exerciseData?.muscle_groups || [];
		autoFilterEquipment = exerciseData?.equipment || [];

		showExerciseBrowser = true;
	}

	// Handle exercise selection from browser
	async function handleExerciseSelect(e: CustomEvent<{ name: string; exercise: Exercise }>) {
		showExerciseBrowser = false;

		if (replacingExerciseIndex < 0 || !dayData) return;

		// Check if this is a sub-exercise replacement
		if (replacingSubExerciseIndex >= 0) {
			// Apply sub-exercise replacement directly (no scope needed for sub-exercises)
			await applySubExerciseReplacement(e.detail.name);
		} else {
			// Check if we need scope confirmation for main exercise
			if (rememberedScope) {
				await applyExerciseReplacement(e.detail.name, rememberedScope);
			} else {
				pendingEdit = {
					exerciseIndex: replacingExerciseIndex,
					field: 'name',
					value: e.detail.name
				};
				showScopeModal = true;
			}
		}
	}

	// Apply sub-exercise replacement
	async function applySubExerciseReplacement(newName: string) {
		if (replacingExerciseIndex < 0 || replacingSubExerciseIndex < 0 || !dayData) return;

		const updatedSchedule = JSON.parse(JSON.stringify(currentSchedule)) as StoredSchedule;
		const exercise = updatedSchedule.days[dayNumber.toString()].exercises[replacingExerciseIndex];

		if (exercise.sub_exercises && exercise.sub_exercises[replacingSubExerciseIndex]) {
			exercise.sub_exercises[replacingSubExerciseIndex].name = newName;

			// Regenerate parent block name to reflect new sub-exercise
			if (exercise.category) {
				exercise.name = generateCompoundBlockName(exercise.category, exercise.sub_exercises);
			}
		}

		updatedSchedule.scheduleMetadata.updatedAt = new Date().toISOString();
		await saveScheduleToDb(updatedSchedule);
		dispatch('scheduleUpdated', updatedSchedule);

		replacingExerciseIndex = -1;
		replacingSubExerciseIndex = -1;
		replacingExerciseName = '';
	}

	// Handle scope selection from modal
	async function handleScopeSelected(e: CustomEvent<EditScope>) {
		const scope = e.detail;
		showScopeModal = false;

		if (pendingEdit?.field === 'name') {
			await applyExerciseReplacement(pendingEdit.value as string, scope);
		}
		pendingEdit = null;
	}

	// Apply exercise replacement with scope
	async function applyExerciseReplacement(newName: string, scope: EditScope) {
		if (replacingExerciseIndex < 0 || !dayData) return;

		const updatedSchedule = JSON.parse(JSON.stringify(currentSchedule)) as StoredSchedule;
		const day = updatedSchedule.days[dayNumber.toString()];
		const exercise = day.exercises[replacingExerciseIndex];

		// Update exercise name
		exercise.name = newName;

		// Note: In a full implementation, you'd also want to:
		// 1. Look up the new exercise in the database
		// 2. Update default parameters based on the new exercise
		// 3. Apply scope logic for other days if needed

		updatedSchedule.scheduleMetadata.updatedAt = new Date().toISOString();
		await saveScheduleToDb(updatedSchedule);
		dispatch('scheduleUpdated', updatedSchedule);

		replacingExerciseIndex = -1;
		replacingExerciseName = '';
	}

	// Handle progression modal save
	async function handleProgressionSave(e: CustomEvent<{
		exerciseIndex: number;
		field: string;
		weekValues: Record<string, number>;
		scope: EditScope;
		subExerciseIndex?: number;
	}>) {
		const { exerciseIndex, field, weekValues, scope, subExerciseIndex } = e.detail;

		// Deep clone the schedule to modify
		const updatedSchedule = JSON.parse(JSON.stringify(currentSchedule)) as StoredSchedule;
		const exercise = updatedSchedule.days[dayNumber.toString()].exercises[exerciseIndex];

		// Determine target: parent exercise or sub-exercise
		const isSubExercise = subExerciseIndex !== undefined && subExerciseIndex >= 0;
		const target = isSubExercise && exercise.sub_exercises
			? exercise.sub_exercises[subExerciseIndex]
			: exercise;

		// Apply values based on scope
		const weekKeys = Object.keys(weekValues);
		for (const weekKey of weekKeys) {
			const weekNum = parseInt(weekKey.replace('week', ''));
			const shouldApply =
				scope === 'all_weeks' ||
				(scope === 'this_week_and_remaining' && weekNum >= weekNumber) ||
				(scope === 'this_instance_only' && weekNum === weekNumber);

			if (shouldApply) {
				const weekParams = target[weekKey as keyof typeof target] as WeekParameters | undefined;
				if (weekParams) {
					(weekParams as Record<string, unknown>)[field] = weekValues[weekKey];
				}
			}
		}

		updatedSchedule.scheduleMetadata.updatedAt = new Date().toISOString();
		await saveScheduleToDb(updatedSchedule);
		dispatch('scheduleUpdated', updatedSchedule);

		showProgressionModal = false;
		progressionExercise = null;
		progressionSubExerciseIndex = -1;
	}

	function handleBackClick() {
		dispatch('back');
	}

	// Get category badge color
	function getCategoryColor(category?: string): string {
		switch (category) {
			case 'emom': return 'bg-amber-600';
			case 'amrap': return 'bg-rose-600';
			case 'circuit': return 'bg-emerald-600';
			case 'interval': return 'bg-cyan-600';
			default: return 'bg-indigo-600';
		}
	}

	// Get category label
	function getCategoryLabel(category?: string): string {
		switch (category) {
			case 'emom': return 'EMOM';
			case 'amrap': return 'AMRAP';
			case 'circuit': return 'CIRCUIT';
			case 'interval': return 'INTERVAL';
			default: return '';
		}
	}

	// Find exercise in database
	function findExerciseInDatabase(exerciseName: string): (Exercise & { category: string }) | null {
		const db = exerciseDatabase.exercise_database;
		for (const categoryKey of Object.keys(db.categories)) {
			const category = db.categories[categoryKey as keyof typeof db.categories];
			const exercises = category.exercises as Record<string, Exercise>;
			if (exercises[exerciseName]) {
				return { ...exercises[exerciseName], category: categoryKey };
			}
		}
		return null;
	}

	// Filter exercises by category and muscle group
	function filterExercisesByCategory(category: string, muscleGroups?: string[]): string[] {
		const db = exerciseDatabase.exercise_database;
		const matchingExercises: string[] = [];

		const categoryData = db.categories[category as keyof typeof db.categories];
		if (categoryData) {
			const exercises = categoryData.exercises as Record<string, Exercise>;
			for (const exerciseName of Object.keys(exercises)) {
				const exerciseData = exercises[exerciseName];
				// For strength exercises, also match muscle groups
				if (category === 'strength' && muscleGroups && muscleGroups.length > 0) {
					const hasOverlap = muscleGroups.some(mg => exerciseData.muscle_groups.includes(mg));
					if (hasOverlap) {
						matchingExercises.push(exerciseName);
					}
				} else {
					matchingExercises.push(exerciseName);
				}
			}
		}

		return matchingExercises;
	}

	// Handle clicking compound type badge (opens type switcher)
	function handleCompoundTypeBadgeClick(exerciseIndex: number) {
		compoundSwitcherExerciseIndex = exerciseIndex;
		showCompoundTypeSwitcher = true;
	}

	// Handle compound type selection
	async function handleCompoundTypeSelect(newType: 'emom' | 'amrap' | 'circuit' | 'interval') {
		if (compoundSwitcherExerciseIndex < 0 || !dayData) return;

		const updatedSchedule = JSON.parse(JSON.stringify(currentSchedule)) as StoredSchedule;
		const exercise = updatedSchedule.days[dayNumber.toString()].exercises[compoundSwitcherExerciseIndex];
		const oldType = exercise.category;

		// Update category
		exercise.category = newType;

		// Regenerate name with sub-exercises
		exercise.name = generateCompoundBlockName(newType, exercise.sub_exercises || []);

		// Convert week parameters based on type change
		// EMOM/AMRAP use work_time_minutes (block duration)
		// CIRCUIT/INTERVAL use sets (rounds)
		const usesWorkTime = (type: string | undefined) => type === 'emom' || type === 'amrap';
		const usesSets = (type: string | undefined) => type === 'circuit' || type === 'interval';

		const oldUsesWorkTime = usesWorkTime(oldType);
		const newUsesWorkTime = usesWorkTime(newType);
		const oldUsesSets = usesSets(oldType);
		const newUsesSets = usesSets(newType);

		// Get all week keys
		const weekKeys = Object.keys(exercise).filter(k => k.startsWith('week')) as Array<keyof typeof exercise>;

		for (const weekKey of weekKeys) {
			const weekParams = exercise[weekKey] as WeekParameters;
			if (!weekParams) continue;

			// Converting from work_time to sets (EMOM/AMRAP -> CIRCUIT/INTERVAL)
			if (oldUsesWorkTime && newUsesSets) {
				// Default to 4 rounds, remove work_time
				weekParams.sets = 4;
				delete weekParams.work_time_minutes;
				delete weekParams.work_time_unit;
			}
			// Converting from sets to work_time (CIRCUIT/INTERVAL -> EMOM/AMRAP)
			else if (oldUsesSets && newUsesWorkTime) {
				// Default to 10 minutes, remove sets
				weekParams.work_time_minutes = 10;
				weekParams.work_time_unit = 'minutes';
				delete weekParams.sets;
			}
		}

		// Update sub-exercise parameters based on new type
		// INTERVAL sub-exercises use work_time/rest_time
		// EMOM/AMRAP/CIRCUIT sub-exercises use reps
		if (exercise.sub_exercises) {
			const oldIsInterval = oldType === 'interval';
			const newIsInterval = newType === 'interval';

			if (oldIsInterval !== newIsInterval) {
				for (const subEx of exercise.sub_exercises) {
					const subWeekKeys = Object.keys(subEx).filter(k => k.startsWith('week')) as Array<keyof typeof subEx>;

					for (const weekKey of subWeekKeys) {
						const subWeekParams = subEx[weekKey] as WeekParameters;
						if (!subWeekParams) continue;

						if (newIsInterval) {
							// Converting TO interval: add work_time/rest_time, remove reps
							subWeekParams.work_time_minutes = 0.5; // 30 seconds
							subWeekParams.work_time_unit = 'seconds';
							subWeekParams.rest_time_minutes = 0.5; // 30 seconds
							subWeekParams.rest_time_unit = 'seconds';
							delete subWeekParams.reps;
						} else {
							// Converting FROM interval: add reps, remove work_time/rest_time
							subWeekParams.reps = 10;
							delete subWeekParams.work_time_minutes;
							delete subWeekParams.work_time_unit;
							delete subWeekParams.rest_time_minutes;
							delete subWeekParams.rest_time_unit;
						}
					}
				}
			}
		}

		updatedSchedule.scheduleMetadata.updatedAt = new Date().toISOString();
		await saveScheduleToDb(updatedSchedule);
		dispatch('scheduleUpdated', updatedSchedule);

		showCompoundTypeSwitcher = false;
		compoundSwitcherExerciseIndex = -1;
	}

	// Handle clicking sub-exercise name (opens exercise browser)
	function handleSubExerciseNameClick(exerciseIndex: number, subExerciseIndex: number, subExerciseName: string) {
		replacingExerciseIndex = exerciseIndex;
		replacingSubExerciseIndex = subExerciseIndex;
		replacingExerciseName = subExerciseName;

		// Lookup exercise metadata and set auto-filters
		const exerciseData = findExerciseInDatabase(subExerciseName);
		autoFilterCategory = exerciseData?.category || '';
		autoFilterMuscleGroups = exerciseData?.muscle_groups || [];
		autoFilterEquipment = exerciseData?.equipment || [];

		showExerciseBrowser = true;
	}

	// ==================== DRAG TO REORDER ====================

	function handleDragStart(e: DragEvent, exerciseIndex: number) {
		draggedExerciseIndex = exerciseIndex;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', exerciseIndex.toString());
		}
	}

	function handleDragEnd() {
		draggedExerciseIndex = null;
		highlightedExerciseIndex = null;
	}

	function handleDragOver(e: DragEvent, exerciseIndex: number) {
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move';
		}
		highlightedExerciseIndex = exerciseIndex;
	}

	function handleDragLeave() {
		// Highlight will be updated by dragover on other elements
	}

	async function handleDrop(e: DragEvent, targetIndex: number) {
		e.preventDefault();
		highlightedExerciseIndex = null;

		if (draggedExerciseIndex === null || draggedExerciseIndex === targetIndex) {
			draggedExerciseIndex = null;
			return;
		}

		// Reorder exercises
		const updatedSchedule = JSON.parse(JSON.stringify(currentSchedule)) as StoredSchedule;
		const exercises = updatedSchedule.days[dayNumber.toString()].exercises;

		// Remove from old position and insert at new position
		const [movedExercise] = exercises.splice(draggedExerciseIndex, 1);
		exercises.splice(targetIndex, 0, movedExercise);

		updatedSchedule.scheduleMetadata.updatedAt = new Date().toISOString();
		await saveScheduleToDb(updatedSchedule);
		dispatch('scheduleUpdated', updatedSchedule);
		draggedExerciseIndex = null;
	}

	// ==================== DELETE EXERCISE ====================

	async function handleDeleteExercise(exerciseIndex: number) {
		const updatedSchedule = JSON.parse(JSON.stringify(currentSchedule)) as StoredSchedule;
		const exercises = updatedSchedule.days[dayNumber.toString()].exercises;

		// Remove the exercise
		exercises.splice(exerciseIndex, 1);

		updatedSchedule.scheduleMetadata.updatedAt = new Date().toISOString();
		await saveScheduleToDb(updatedSchedule);
		dispatch('scheduleUpdated', updatedSchedule);
	}

	// ==================== ADD EXERCISE / BLOCK ====================

	// State for adding new exercises
	let isAddingExercise = false;

	function handleAddExercise() {
		// Open exercise browser in "add" mode
		replacingExerciseIndex = -1; // -1 indicates adding, not replacing
		replacingSubExerciseIndex = -1;
		replacingExerciseName = '';
		autoFilterCategory = '';
		autoFilterMuscleGroups = [];
		autoFilterEquipment = [];
		isAddingExercise = true;
		showExerciseBrowser = true;
	}

	async function handleAddBlock() {
		// Create empty compound block
		const updatedSchedule = JSON.parse(JSON.stringify(currentSchedule)) as StoredSchedule;
		const exercises = updatedSchedule.days[dayNumber.toString()].exercises;

		// Create new EMOM block by default (user can change type)
		const newBlock: ParameterizedExercise = {
			name: 'EMOM Block',
			category: 'emom',
			sub_exercises: [],
			week1: { work_time_minutes: 10, work_time_unit: 'minutes' },
			week2: { work_time_minutes: 10, work_time_unit: 'minutes' },
			week3: { work_time_minutes: 12, work_time_unit: 'minutes' },
			week4: { work_time_minutes: 12, work_time_unit: 'minutes' }
		};

		exercises.push(newBlock);

		updatedSchedule.scheduleMetadata.updatedAt = new Date().toISOString();
		await saveScheduleToDb(updatedSchedule);
		dispatch('scheduleUpdated', updatedSchedule);

		// Open compound type switcher for the new block
		compoundSwitcherExerciseIndex = exercises.length - 1;
		showCompoundTypeSwitcher = true;
	}

	// Handle adding sub-exercise to a compound block
	function handleAddSubExercise(exerciseIndex: number) {
		addingSubExerciseToIndex = exerciseIndex;
		replacingExerciseIndex = -1;
		replacingSubExerciseIndex = -1;
		replacingExerciseName = '';
		autoFilterCategory = '';
		autoFilterMuscleGroups = [];
		autoFilterEquipment = [];
		showExerciseBrowser = true;
	}

	// Modified exercise select handler to support adding exercises and sub-exercises
	async function handleExerciseSelectForAdd(e: CustomEvent<{ name: string; exercise: Exercise }>) {
		// Handle adding sub-exercise to compound block
		if (addingSubExerciseToIndex >= 0) {
			await handleAddSubExerciseSelect(e);
			return;
		}

		if (!isAddingExercise) {
			// Use existing replacement logic
			await handleExerciseSelect(e);
			return;
		}

		showExerciseBrowser = false;
		isAddingExercise = false;

		if (!dayData) return;

		const updatedSchedule = JSON.parse(JSON.stringify(currentSchedule)) as StoredSchedule;
		const exercises = updatedSchedule.days[dayNumber.toString()].exercises;

		// Look up exercise in database for default parameters
		const exerciseData = findExerciseInDatabase(e.detail.name);

		// Create new exercise with default parameters
		const newExercise: ParameterizedExercise = {
			name: e.detail.name,
			category: exerciseData?.category || 'strength',
			week1: { sets: 3, reps: 10, rest_time_minutes: 1.5, rest_time_unit: 'minutes' },
			week2: { sets: 3, reps: 10, rest_time_minutes: 1.5, rest_time_unit: 'minutes' },
			week3: { sets: 4, reps: 10, rest_time_minutes: 1.5, rest_time_unit: 'minutes' },
			week4: { sets: 4, reps: 10, rest_time_minutes: 1.5, rest_time_unit: 'minutes' }
		};

		exercises.push(newExercise);

		updatedSchedule.scheduleMetadata.updatedAt = new Date().toISOString();
		await saveScheduleToDb(updatedSchedule);
		dispatch('scheduleUpdated', updatedSchedule);
	}

	// Handle selection when adding sub-exercise
	async function handleAddSubExerciseSelect(e: CustomEvent<{ name: string; exercise: Exercise }>) {
		showExerciseBrowser = false;

		if (addingSubExerciseToIndex < 0 || !dayData) {
			addingSubExerciseToIndex = -1;
			return;
		}

		const updatedSchedule = JSON.parse(JSON.stringify(currentSchedule)) as StoredSchedule;
		const exercise = updatedSchedule.days[dayNumber.toString()].exercises[addingSubExerciseToIndex];

		// Initialize sub_exercises array if needed
		if (!exercise.sub_exercises) {
			exercise.sub_exercises = [];
		}

		// Determine parameters based on parent block type
		const isInterval = exercise.category === 'interval';

		// Create new sub-exercise with appropriate parameters
		const newSubExercise: ParameterizedSubExercise = {
			name: e.detail.name,
			week1: isInterval
				? { work_time_minutes: 0.5, work_time_unit: 'seconds', rest_time_minutes: 0.5, rest_time_unit: 'seconds' }
				: { reps: 10 },
			week2: isInterval
				? { work_time_minutes: 0.5, work_time_unit: 'seconds', rest_time_minutes: 0.5, rest_time_unit: 'seconds' }
				: { reps: 10 },
			week3: isInterval
				? { work_time_minutes: 0.583, work_time_unit: 'seconds', rest_time_minutes: 0.417, rest_time_unit: 'seconds' }
				: { reps: 12 },
			week4: isInterval
				? { work_time_minutes: 0.667, work_time_unit: 'seconds', rest_time_minutes: 0.333, rest_time_unit: 'seconds' }
				: { reps: 12 }
		};

		exercise.sub_exercises.push(newSubExercise);

		// Regenerate parent block name
		exercise.name = generateCompoundBlockName(exercise.category, exercise.sub_exercises);

		updatedSchedule.scheduleMetadata.updatedAt = new Date().toISOString();
		await saveScheduleToDb(updatedSchedule);
		dispatch('scheduleUpdated', updatedSchedule);

		addingSubExerciseToIndex = -1;
	}

</script>

<div class="day-container">
	<!-- Header -->
	<div class="flex items-center justify-between mb-4 lg:mb-6">
		<div class="flex items-center gap-2 lg:gap-4">
			<button class="back-button" on:click={handleBackClick}>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
				</svg>
			</button>
			<div>
				<h1 class="text-lg lg:text-2xl font-bold text-white">
					{#if dayData}
						{dayData.focus}
					{:else}
						Day {dayNumber}
					{/if}
				</h1>
				<p class="text-slate-400 text-xs lg:text-sm">
					Week {weekNumber} | Day {dayNumber}
					{#if dayData}
						| {dayData.type}
					{/if}
				</p>
			</div>
		</div>

		{#if rememberedScope}
			<button
				on:click={() => rememberedScope = null}
				class="text-xs text-slate-400 hover:text-white transition-colors"
			>
				Clear scope
			</button>
		{/if}
	</div>

	{#if dayData}
		<!-- Exercises -->
		<div class="space-y-3 lg:space-y-4">
			{#each dayData.exercises as exercise, i}
				{@const params = formatParams(exercise, weekNumber)}
				{@const isCompound = isCompoundBlock(exercise)}
				{@const isDragging = draggedExerciseIndex === i}
				{@const isHighlighted = highlightedExerciseIndex === i}

				<div class="exercise-wrapper">
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<section
						class="exercise-card bg-slate-800 rounded-lg divide-y divide-slate-700 overflow-hidden"
						class:dragging={isDragging}
						class:highlighted={isHighlighted}
						draggable="true"
						on:dragstart={(e) => handleDragStart(e, i)}
						on:dragend={handleDragEnd}
						on:dragover={(e) => handleDragOver(e, i)}
						on:dragleave={handleDragLeave}
						on:drop={(e) => handleDrop(e, i)}
					>
					<!-- Exercise Header -->
					{#if isCompound}
						<!-- Compound block header: two rows -->
						<div class="compound-header">
							<!-- Row 1: Badge + delete -->
							<div class="compound-header-top">
								<button
									class="text-xs font-medium px-1.5 py-0.5 rounded {getCategoryColor(exercise.category)} hover:opacity-80 transition-opacity inline-flex items-center gap-0.5"
									on:click={() => handleCompoundTypeBadgeClick(i)}
								>
									{getCategoryLabel(exercise.category)}
									<svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
									</svg>
								</button>
								<button
									class="delete-btn"
									on:click|stopPropagation={() => handleDeleteExercise(i)}
									aria-label="Delete exercise"
								>
									<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
									</svg>
								</button>
							</div>
							<!-- Row 2: Name + duration/rounds -->
							<div class="compound-header-bottom">
								<h3 class="text-sm lg:text-base font-semibold text-white truncate flex-1">
									{exercise.name}
								</h3>
								<button
									class="text-sm font-medium text-white hover:text-indigo-400 whitespace-nowrap transition-colors flex items-center gap-1 group flex-shrink-0"
									on:click={() => handleProgressionClick(i, getCompoundBlockEditField(exercise.category))}
								>
									{getCompoundBlockDisplay(exercise, weekNumber)}
									<svg class="w-3 h-3 text-slate-500 group-hover:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
									</svg>
								</button>
							</div>
						</div>
					{:else}
						<!-- Regular exercise header: single row -->
						<div class="exercise-header">
							<button
								class="text-left group flex-1 min-w-0"
								on:click={() => handleExerciseNameClick(i, exercise.name)}
							>
								<h3 class="text-sm lg:text-base font-semibold text-white group-hover:text-indigo-400 transition-colors flex items-center gap-1 truncate">
									{exercise.name}
									<svg class="w-3 h-3 text-slate-500 group-hover:text-indigo-400 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
									</svg>
								</h3>
							</button>
							<button
								class="delete-btn"
								on:click|stopPropagation={() => handleDeleteExercise(i)}
								aria-label="Delete exercise"
							>
								<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>
					{/if}

					<!-- Exercise Fields (hide sets/work_time for compound blocks - shown in header) -->
					<div class="fields-container">
						{#if params.sets !== undefined && !isCompound}
							<button
								class="field-row"
								on:click={() => handleProgressionClick(i, 'sets')}
							>
								<span class="field-label">Sets</span>
								<span class="field-value">
									{params.sets}
									<svg class="field-edit-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
									</svg>
								</span>
							</button>
						{/if}
						{#if params.reps !== undefined && !isCompound}
							<button
								class="field-row"
								on:click={() => handleProgressionClick(i, 'reps')}
							>
								<span class="field-label">Reps</span>
								<span class="field-value">
									{params.reps}
									<svg class="field-edit-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
									</svg>
								</span>
							</button>
						{/if}

						{#if params.workTime && !isCompound}
							<button
								class="field-row"
								on:click={() => handleProgressionClick(i, 'work_time_minutes')}
							>
								<span class="field-label">Work Time</span>
								<span class="field-value">
									{params.workTime}
									<svg class="field-edit-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
									</svg>
								</span>
							</button>
						{/if}

						{#if params.restTime}
							<button
								class="field-row"
								on:click={() => handleProgressionClick(i, 'rest_time_minutes')}
							>
								<span class="field-label">Rest Time</span>
								<span class="field-value">
									{params.restTime}
									<svg class="field-edit-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
									</svg>
								</span>
							</button>
						{/if}
					</div>

					<!-- Sub-exercises for compound blocks -->
					{#if isCompound}
						<div class="sub-exercises-section">
							{#if exercise.sub_exercises && exercise.sub_exercises.length > 0}
								{#each exercise.sub_exercises as subEx, subIndex}
									<div class="sub-exercise-row">
										<!-- Sub-exercise name - clickable to replace -->
										<button
											class="text-sm text-slate-300 hover:text-indigo-400 transition-colors truncate text-left flex items-center gap-1 flex-1 min-w-0"
											on:click={() => handleSubExerciseNameClick(i, subIndex, subEx.name)}
										>
											{subEx.name}
											<svg class="w-2.5 h-2.5 text-slate-500 flex-shrink-0 opacity-0 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
											</svg>
										</button>
										<!-- Parameters display -->
										<button
											class="text-xs font-medium text-slate-400 hover:text-indigo-400 flex-shrink-0 transition-colors"
											on:click={() => handleProgressionClick(i, getSubExerciseEditField(exercise.category), subIndex)}
										>
											{getSubExerciseDisplay(subEx, exercise.category, weekNumber)}
										</button>
									</div>
								{/each}
							{/if}
							<!-- Subtle add link -->
							<button
								class="add-sub-link"
								on:click={() => handleAddSubExercise(i)}
							>
								+ add
							</button>
						</div>
					{/if}
				</section>
				</div>
			{/each}
		</div>

		<!-- Add Exercise / Block Row -->
		<div class="add-row">
			<button class="add-btn" on:click={handleAddExercise}>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
				</svg>
				Exercise
			</button>
			<button class="add-btn" on:click={handleAddBlock}>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
				</svg>
				Block
			</button>
		</div>

		<!-- Hint -->
		<p class="text-center text-xs text-slate-500 mt-6">
			Tap name to replace | Tap values to edit | Hold and drag to reorder
		</p>
	{:else}
		<div class="text-center py-12 text-slate-400">
			<p>No exercises found for this day.</p>
		</div>
	{/if}

	<!-- Bottom padding for tab bar -->
	<div class="h-4"></div>
</div>

<!-- Edit Scope Modal -->
<EditScopeModal
	isOpen={showScopeModal}
	weekNumber={weekNumber}
	on:select={handleScopeSelected}
	on:cancel={() => { showScopeModal = false; pendingEdit = null; }}
/>

<!-- Progression Modal -->
{#if progressionExercise}
	<ProgressionModal
		isOpen={showProgressionModal}
		exercise={progressionExercise}
		exerciseIndex={progressionExerciseIndex}
		field={progressionField}
		currentWeek={weekNumber}
		totalWeeks={currentSchedule.weeks}
		subExerciseIndex={progressionSubExerciseIndex}
		on:close={() => { showProgressionModal = false; progressionExercise = null; progressionSubExerciseIndex = -1; }}
		on:save={handleProgressionSave}
	/>
{/if}

<!-- Exercise Browser -->
<ExerciseBrowser
	isOpen={showExerciseBrowser}
	currentExerciseName={replacingExerciseName}
	autoFilterCategory={autoFilterCategory}
	autoFilterMuscleGroups={autoFilterMuscleGroups}
	autoFilterEquipment={autoFilterEquipment}
	on:select={handleExerciseSelectForAdd}
	on:cancel={() => { showExerciseBrowser = false; replacingExerciseIndex = -1; replacingSubExerciseIndex = -1; isAddingExercise = false; addingSubExerciseToIndex = -1; }}
/>

<!-- Compound Type Switcher Modal -->
{#if showCompoundTypeSwitcher}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
		on:click={() => { showCompoundTypeSwitcher = false; compoundSwitcherExerciseIndex = -1; }}
	>
		<div
			class="bg-slate-800 w-full max-w-lg rounded-xl p-4"
			on:click|stopPropagation
		>
			<h3 class="text-lg font-semibold text-white mb-4 text-center">Change Block Type</h3>
			<div class="space-y-2">
				{#each compoundTypes as type}
					{@const currentExercise = dayData?.exercises[compoundSwitcherExerciseIndex]}
					{@const isSelected = currentExercise?.category === type.value}
					<button
						class="w-full p-3 rounded-lg text-left transition-colors flex items-center gap-3
							   {isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-white hover:bg-slate-600'}"
						on:click={() => handleCompoundTypeSelect(type.value)}
					>
						<span class="w-2 h-2 rounded-full {type.color}"></span>
						<div class="flex-1">
							<span class="font-medium">{type.label}</span>
							<span class="text-sm text-slate-400 ml-2">{type.description}</span>
						</div>
						{#if isSelected}
							<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
							</svg>
						{/if}
					</button>
				{/each}
			</div>
			<button
				class="w-full mt-4 py-2.5 text-slate-400 hover:text-white transition-colors"
				on:click={() => { showCompoundTypeSwitcher = false; compoundSwitcherExerciseIndex = -1; }}
			>
				Cancel
			</button>
		</div>
	</div>
{/if}

<!-- Drag hint -->
{#if draggedExerciseIndex !== null && highlightedExerciseIndex !== null}
	<div class="drag-hint">
		Reordering exercises
	</div>
{/if}


<style>
	.day-container {
		width: 100%;
		min-height: 100%;
	}

	.back-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
		background: rgb(51 65 85);
		border: none;
		border-radius: 0.5rem;
		color: rgb(148 163 184);
		cursor: pointer;
		transition: all 0.15s;
	}

	.back-button:hover {
		background: rgb(71 85 105);
		color: white;
	}

	.fields-container {
		padding: 0 0.75rem;
	}

	.field-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 0.5rem 0;
		border: none;
		border-bottom: 1px solid rgb(51 65 85);
		background: transparent;
		cursor: pointer;
		transition: background 0.15s;
	}

	.field-row:last-child {
		border-bottom: none;
	}

	.field-row:hover {
		background: rgba(99, 102, 241, 0.1);
		margin: 0 -0.75rem;
		padding-left: 0.75rem;
		padding-right: 0.75rem;
		width: calc(100% + 1.5rem);
	}

	.field-label {
		font-size: 0.875rem;
		color: rgb(148 163 184);
	}

	.field-value {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		color: white;
		font-weight: 500;
	}

	.field-edit-icon {
		width: 0.75rem;
		height: 0.75rem;
		color: rgb(100 116 139);
		transition: color 0.15s;
	}

	.field-row:hover .field-edit-icon {
		color: rgb(129 140 248);
	}

	/* ==================== DRAG TO REORDER ==================== */

	.exercise-wrapper {
		position: relative;
		overflow: hidden;
		border-radius: 0.5rem;
	}

	.exercise-card {
		position: relative;
		transition: transform 0.15s ease-out, opacity 0.15s, outline 0.15s;
		cursor: grab;
		user-select: none;
	}

	.exercise-card:active {
		cursor: grabbing;
	}

	.exercise-card.dragging {
		opacity: 0.5;
	}

	.exercise-card.highlighted {
		outline: 2px solid rgb(99 102 241);
		outline-offset: 2px;
		background: rgba(99, 102, 241, 0.1);
	}

	/* ==================== EXERCISE HEADER ==================== */

	.exercise-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.625rem 0.75rem;
	}

	/* ==================== COMPOUND BLOCK HEADER ==================== */

	.compound-header {
		padding: 0.5rem 0.75rem;
	}

	.compound-header-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.25rem;
	}

	.compound-header-bottom {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	/* ==================== DELETE BUTTON ==================== */

	.delete-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		background: transparent;
		border: none;
		border-radius: 0.25rem;
		color: rgb(71 85 105);
		cursor: pointer;
		transition: all 0.15s;
		flex-shrink: 0;
	}

	.exercise-header .delete-btn {
		margin-left: 0.5rem;
	}

	.delete-btn:hover {
		background: rgb(220 38 38);
		color: white;
	}

	.delete-btn:active {
		transform: scale(0.95);
	}

	/* ==================== SUB-EXERCISES ==================== */

	.sub-exercises-section {
		padding: 0.5rem 0.75rem;
		background: rgb(15 23 42 / 0.5);
	}

	.sub-exercise-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.25rem 0;
	}

	.add-sub-link {
		display: inline-block;
		padding: 0.25rem 0;
		margin-top: 0.25rem;
		background: transparent;
		border: none;
		color: rgb(100 116 139);
		font-size: 0.75rem;
		cursor: pointer;
		transition: color 0.15s;
	}

	.add-sub-link:hover {
		color: rgb(129 140 248);
	}

	/* ==================== ADD ROW ==================== */

	.add-row {
		display: flex;
		gap: 0.75rem;
		margin-top: 1rem;
	}

	.add-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.875rem 1rem;
		background: transparent;
		border: 2px dashed rgb(71 85 105);
		border-radius: 0.5rem;
		color: rgb(148 163 184);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s;
	}

	.add-btn:hover {
		border-color: rgb(99 102 241);
		color: rgb(129 140 248);
		background: rgba(99, 102, 241, 0.1);
	}

	.add-btn:active {
		transform: scale(0.98);
	}

	/* ==================== DRAG HINT ==================== */

	.drag-hint {
		position: fixed;
		bottom: 5rem;
		left: 50%;
		transform: translateX(-50%);
		background-color: rgb(30 41 59);
		border: 1px solid rgb(99 102 241);
		border-radius: 0.5rem;
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		color: white;
		z-index: 50;
		white-space: nowrap;
	}

	/* Desktop adjustments */
	@media (min-width: 1024px) {
		.add-row {
			max-width: 24rem;
		}

		.add-btn {
			padding: 1rem 1.25rem;
			font-size: 1rem;
		}
	}
</style>
