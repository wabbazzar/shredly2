<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import type { LiveExercise, SetLog, ExerciseLog } from '$lib/engine/types';
	import { shouldShowWeightField, getExerciseMetadata } from '$lib/engine/exercise-metadata';
	import { keyboardAware } from '$lib/actions/keyboardAware';

	export let exercise: LiveExercise;
	export let exerciseIndex: number;
	export let existingLog: ExerciseLog | null = null;

	const dispatch = createEventDispatcher<{
		save: { sets: SetLog[]; totalRounds?: number; totalTime?: number; subExerciseWeights?: SubExerciseWeight[] };
		close: void;
	}>();

	// Sub-exercise weight entry type (matches DataEntryModal)
	interface SubExerciseWeight {
		name: string;
		weight: string;
		weightUnit: 'lbs' | 'kg';
		showWeight: boolean;
	}

	// Determine field visibility
	$: showWeight = !isCompound && shouldShowWeightField(exercise.exerciseName, null);
	$: isCompound = exercise.isCompoundParent;
	$: isAmrap = exercise.exerciseType === 'amrap';
	$: isCircuit = exercise.exerciseType === 'circuit';
	$: isEmom = exercise.exerciseType === 'emom';
	$: isInterval = exercise.exerciseType === 'interval';
	$: totalSets = exercise.prescription.sets;

	// Form state for each set (only used for non-compound exercises)
	interface SetFormData {
		reps: string;
		weight: string;
		rpe: string;
	}

	let setsData: SetFormData[] = [];
	let weightUnit: 'lbs' | 'kg' = exercise.prescription.weightUnit ?? 'lbs';
	let roundsInput: string = '';
	let timeInput: string = '';
	let repsInput: string = '';
	let rpeInput: string = '';
	let showRpeColumn = false;
	let showRpeSection = false;

	// Sub-exercise weight state (for compound blocks)
	let subExerciseWeights: SubExerciseWeight[] = [];

	// Input refs for keyboard navigation
	let inputRefs: HTMLInputElement[][] = [];

	// Check if any sub-exercises have weight fields
	// Computed directly in initializeFormData() to avoid reactive timing issues
	let hasSubExerciseWeights = false;

	// Check if a set is complete (required fields filled)
	function isSetComplete(setData: SetFormData): boolean {
		const hasReps = setData.reps !== '' && parseInt(setData.reps) > 0;
		if (showWeight) {
			const hasWeight = setData.weight !== '' && parseFloat(setData.weight) > 0;
			return hasReps && hasWeight;
		}
		return hasReps;
	}

	// Initialize form data from existing logs or prescription
	function initializeFormData() {
		setsData = [];
		inputRefs = [];
		subExerciseWeights = [];

		// Use direct property access (not reactive variable) to avoid timing issues
		const isCompoundBlock = exercise.isCompoundParent;

		// Initialize sub-exercise weights for compound blocks
		if (isCompoundBlock && exercise.subExercises && exercise.subExercises.length > 0) {
			subExerciseWeights = exercise.subExercises.map(subEx => {
				const metadata = getExerciseMetadata(subEx.exerciseName);
				const showSubWeight = metadata?.external_load !== 'never';
				return {
					name: subEx.exerciseName,
					weight: subEx.prescription.weight?.toString() ?? '',
					weightUnit: subEx.prescription.weightUnit ?? 'lbs',
					showWeight: showSubWeight
				};
			});
			// Compute hasSubExerciseWeights after populating the array
			hasSubExerciseWeights = subExerciseWeights.some(s => s.showWeight);
		} else {
			hasSubExerciseWeights = false;
		}

		// For compound blocks, use single-entry form (not per-set rows)
		if (isCompoundBlock) {
			// Initialize from existing log if available
			if (existingLog?.totalRounds != null) {
				roundsInput = existingLog.totalRounds.toString();
			}
			if (existingLog?.totalTime != null) {
				timeInput = formatTimeInput(existingLog.totalTime);
			}
			// For EMOM/Interval, initialize reps from first set if logged
			const exType = exercise.exerciseType;
			if ((exType === 'emom' || exType === 'interval') && existingLog?.sets?.[0]?.reps != null) {
				repsInput = existingLog.sets[0].reps.toString();
			} else {
				repsInput = exercise.prescription.reps?.toString() ?? '';
			}
			// Initialize RPE from first set if logged
			if (existingLog?.sets?.[0]?.rpe != null) {
				rpeInput = existingLog.sets[0].rpe.toString();
				showRpeSection = true;
			}
			return;
		}

		// Non-compound: initialize per-set form data
		const numSets = exercise.prescription.sets;
		for (let i = 0; i < numSets; i++) {
			const existingSet = existingLog?.sets[i];

			if (existingSet) {
				setsData.push({
					reps: existingSet.reps?.toString() ?? '',
					weight: existingSet.weight?.toString() ?? '',
					rpe: existingSet.rpe?.toString() ?? ''
				});
				if (existingSet.weightUnit) {
					weightUnit = existingSet.weightUnit;
				}
				// Show RPE column if any set has RPE logged
				if (existingSet.rpe) {
					showRpeColumn = true;
				}
			} else {
				setsData.push({
					reps: exercise.prescription.reps?.toString() ?? '',
					weight: exercise.prescription.weight?.toString() ?? '',
					rpe: ''
				});
			}
			inputRefs.push([]);
		}
	}

	$: if (exercise) {
		initializeFormData();
	}

	function formatTimeInput(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	function parseTimeInput(value: string): number | null {
		const match = value.match(/^(\d+):(\d{1,2})$/);
		if (match) {
			return parseInt(match[1]) * 60 + parseInt(match[2]);
		}
		const secs = parseInt(value);
		if (!isNaN(secs)) {
			return secs;
		}
		return null;
	}

	function handleSave() {
		// Compound blocks: single entry form (matches DataEntryModal pattern)
		if (isCompound) {
			// Create a single SetLog for compound blocks
			const setLog: SetLog = {
				setNumber: 1,
				reps: (isEmom || isInterval) && repsInput ? parseInt(repsInput) : null,
				weight: null,
				weightUnit: null,
				workTime: isCircuit ? parseTimeInput(timeInput) : null,
				rpe: rpeInput ? parseInt(rpeInput) : null,
				rir: null,
				completed: true,
				notes: null,
				timestamp: new Date().toISOString()
			};

			// Include sub-exercise weights if present
			const weightedSubExercises = hasSubExerciseWeights
				? subExerciseWeights.filter(s => s.showWeight && s.weight)
				: undefined;

			dispatch('save', {
				sets: [setLog],
				totalRounds: isAmrap && roundsInput ? parseFloat(roundsInput) : undefined,
				totalTime: isCircuit ? parseTimeInput(timeInput) ?? undefined : undefined,
				subExerciseWeights: weightedSubExercises
			});
			return;
		}

		// Non-compound: per-set data
		const sets: SetLog[] = setsData.map((data, i) => ({
			setNumber: i + 1,
			reps: data.reps ? parseInt(data.reps) : null,
			weight: data.weight ? parseFloat(data.weight) : null,
			weightUnit: showWeight && data.weight ? weightUnit : null,
			workTime: null,
			rpe: data.rpe ? parseInt(data.rpe) : null,
			rir: null,
			completed: isSetComplete(data),
			notes: null,
			timestamp: new Date().toISOString()
		}));

		dispatch('save', {
			sets,
			totalRounds: undefined,
			totalTime: undefined
		});
	}

	function handleClose() {
		dispatch('close');
	}

	// Keyboard navigation - move between cells
	function handleKeyDown(event: KeyboardEvent, rowIdx: number, colIdx: number) {
		const numCols = showWeight ? (showRpeColumn ? 3 : 2) : (showRpeColumn ? 2 : 1);

		if (event.key === 'ArrowDown') {
			event.preventDefault();
			const nextRow = rowIdx + 1;
			if (nextRow < totalSets && inputRefs[nextRow]?.[colIdx]) {
				inputRefs[nextRow][colIdx].focus();
			}
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			const prevRow = rowIdx - 1;
			if (prevRow >= 0 && inputRefs[prevRow]?.[colIdx]) {
				inputRefs[prevRow][colIdx].focus();
			}
		} else if (event.key === 'ArrowRight') {
			event.preventDefault();
			const nextCol = colIdx + 1;
			if (nextCol < numCols && inputRefs[rowIdx]?.[nextCol]) {
				inputRefs[rowIdx][nextCol].focus();
			} else if (rowIdx + 1 < totalSets && inputRefs[rowIdx + 1]?.[0]) {
				// Wrap to next row
				inputRefs[rowIdx + 1][0].focus();
			}
		} else if (event.key === 'ArrowLeft') {
			event.preventDefault();
			const prevCol = colIdx - 1;
			if (prevCol >= 0 && inputRefs[rowIdx]?.[prevCol]) {
				inputRefs[rowIdx][prevCol].focus();
			} else if (rowIdx > 0) {
				// Wrap to previous row last column
				const lastCol = numCols - 1;
				if (inputRefs[rowIdx - 1]?.[lastCol]) {
					inputRefs[rowIdx - 1][lastCol].focus();
				}
			}
		} else if (event.key === 'Enter') {
			event.preventDefault();
			// Move to next cell or save if last
			const nextCol = colIdx + 1;
			if (nextCol < numCols && inputRefs[rowIdx]?.[nextCol]) {
				inputRefs[rowIdx][nextCol].focus();
			} else if (rowIdx + 1 < totalSets && inputRefs[rowIdx + 1]?.[0]) {
				inputRefs[rowIdx + 1][0].focus();
			} else {
				handleSave();
			}
		}
	}

	const rpeOptions = [7, 8, 9, 10];
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3"
	on:click={handleClose}
	on:keydown={(e) => e.key === 'Escape' && handleClose()}
>
	<div
		class="w-full max-w-sm bg-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col"
		on:click|stopPropagation
		use:keyboardAware
	>
		<!-- Compact Header -->
		<div class="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
			<div class="min-w-0 flex-1">
				<h2 class="text-base font-semibold text-white truncate">{exercise.exerciseName}</h2>
				<p class="text-xs text-slate-400">
					{#if isCompound}
						{exercise.exerciseType.toUpperCase()} Block
					{:else}
						{totalSets} sets × {exercise.prescription.reps ?? '?'} reps
						{#if showWeight && exercise.prescription.weight}
							@ {exercise.prescription.weight}{weightUnit}
						{/if}
					{/if}
				</p>
			</div>
			<button
				class="p-1.5 -mr-1 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-700/50"
				on:click={handleClose}
				aria-label="Close"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<!-- Content -->
		<div class="px-4 py-3 space-y-3">
			{#if isAmrap}
				<!-- AMRAP: Total rounds input -->
				<div class="bg-slate-700/30 rounded-lg p-3">
					<label class="block text-xs font-medium text-slate-300 mb-1.5">Total Rounds Completed</label>
					<input
						type="number"
						inputmode="decimal"
						step="0.5"
						bind:value={roundsInput}
						on:focus={(e) => e.currentTarget.select()}
						class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-lg text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
						placeholder="e.g., 5.5"
					/>
					<p class="mt-1 text-xs text-slate-500">Decimal allowed (3.5 = 3 full + half round)</p>
				</div>
			{:else if isCircuit}
				<!-- Circuit: Total time input -->
				<div class="bg-slate-700/30 rounded-lg p-3">
					<label class="block text-xs font-medium text-slate-300 mb-1.5">Total Time</label>
					<input
						type="text"
						bind:value={timeInput}
						on:focus={(e) => e.currentTarget.select()}
						class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-lg text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
						placeholder="5:30"
					/>
					<p class="mt-1 text-xs text-slate-500">Format: MM:SS</p>
				</div>
			{:else if isEmom || isInterval}
				<!-- EMOM/Interval: Reps input -->
				<div class="bg-slate-700/30 rounded-lg p-3">
					<label class="block text-xs font-medium text-slate-300 mb-1.5">Reps per round</label>
					<input
						type="number"
						inputmode="numeric"
						bind:value={repsInput}
						on:focus={(e) => e.currentTarget.select()}
						class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-lg text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
						placeholder={exercise.prescription.reps?.toString() ?? '-'}
					/>
				</div>
			{:else}
				<!-- Regular exercise: Column Headers -->
				<div class="flex items-center gap-2 mb-2 px-1">
					<div class="w-7 text-xs text-slate-500 font-medium"></div>
					<div class="flex-1 text-xs text-slate-500 font-medium text-center">Reps</div>
					{#if showWeight}
						<div class="flex-1 text-xs text-slate-500 font-medium text-center">{weightUnit}</div>
					{/if}
					{#if showRpeColumn}
						<div class="w-12 text-xs text-slate-500 font-medium text-center">RPE</div>
					{/if}
					<div class="w-5"></div>
				</div>

				<!-- Set Rows -->
				<div class="space-y-1.5">
					{#each setsData as setData, i}
						{@const complete = isSetComplete(setData)}
						<div
							class="flex items-center gap-2 p-1.5 rounded-lg transition-colors
								{complete ? 'bg-green-900/20' : 'bg-slate-700/30'}"
						>
							<!-- Set Number -->
							<div class="w-7 text-sm font-medium text-slate-400 text-center">{i + 1}</div>

							<!-- Reps -->
							<input
								type="number"
								inputmode="numeric"
								bind:this={inputRefs[i][0]}
								bind:value={setData.reps}
								on:focus={(e) => e.currentTarget.select()}
								on:keydown={(e) => handleKeyDown(e, i, 0)}
								class="flex-1 px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm text-center focus:outline-none focus:ring-1 focus:ring-indigo-500 min-w-0"
								placeholder="{exercise.prescription.reps ?? '-'}"
							/>

							<!-- Weight -->
							{#if showWeight}
								<input
									type="number"
									inputmode="decimal"
									step="2.5"
									bind:this={inputRefs[i][1]}
									bind:value={setData.weight}
									on:focus={(e) => e.currentTarget.select()}
									on:keydown={(e) => handleKeyDown(e, i, 1)}
									class="flex-1 px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm text-center focus:outline-none focus:ring-1 focus:ring-indigo-500 min-w-0"
									placeholder="{exercise.prescription.weight ?? '-'}"
								/>
							{/if}

							<!-- RPE (when expanded) -->
							{#if showRpeColumn}
								<select
									bind:this={inputRefs[i][showWeight ? 2 : 1]}
									bind:value={setData.rpe}
									on:keydown={(e) => handleKeyDown(e, i, showWeight ? 2 : 1)}
									class="w-12 px-1 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm text-center focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none"
								>
									<option value="">-</option>
									{#each rpeOptions as rpe}
										<option value={rpe.toString()}>{rpe}</option>
									{/each}
								</select>
							{/if}

							<!-- Auto-checkmark when complete -->
							<div class="w-5 h-5 flex items-center justify-center">
								{#if complete}
									<svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
									</svg>
								{/if}
							</div>
						</div>
					{/each}
				</div>

				<!-- RPE Toggle for regular exercises -->
				<button
					type="button"
					class="flex items-center gap-1 mt-3 text-xs text-slate-400 hover:text-slate-300 transition-colors"
					on:click={() => showRpeColumn = !showRpeColumn}
				>
					{#if showRpeColumn}
						<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
						</svg>
						Hide RPE
					{:else}
						<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
						</svg>
						Add RPE
					{/if}
				</button>
			{/if}

			<!-- Sub-exercise weights (for compound blocks) -->
			{#if hasSubExerciseWeights}
				<div class="space-y-1.5">
					<p class="text-xs text-slate-400 font-medium">Weight per exercise</p>
					{#each subExerciseWeights as subEx, idx}
						{#if subEx.showWeight}
							<div class="flex items-center gap-2">
								<span class="flex-1 text-xs text-slate-400 truncate">{subEx.name}</span>
								<input
									type="number"
									inputmode="decimal"
									step="2.5"
									bind:value={subEx.weight}
									on:focus={(e) => e.currentTarget.select()}
									class="w-16 px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
									placeholder={exercise.subExercises[idx]?.prescription.weight?.toString() ?? '-'}
								/>
								<span class="text-xs text-slate-500 w-6">{subEx.weightUnit}</span>
							</div>
						{/if}
					{/each}
				</div>
			{/if}

			<!-- RPE for compound blocks -->
			{#if isCompound}
				<button
					type="button"
					class="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-300 transition-colors"
					on:click={() => showRpeSection = !showRpeSection}
				>
					{#if showRpeSection}
						<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
						</svg>
						Hide RPE {rpeInput ? `(${rpeInput})` : ''}
					{:else}
						<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
						</svg>
						Add RPE {rpeInput ? `(${rpeInput})` : ''}
					{/if}
				</button>
				{#if showRpeSection}
					<div class="flex gap-1.5">
						{#each rpeOptions as option}
							<button
								type="button"
								class="flex-1 py-1.5 rounded text-xs font-medium transition-colors
									{rpeInput === option.toString()
										? 'bg-indigo-600 text-white'
										: 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white'}"
								on:click={() => (rpeInput = rpeInput === option.toString() ? '' : option.toString())}
							>
								{option}
							</button>
						{/each}
					</div>
				{/if}
			{/if}
		</div>

		<!-- Compact Footer -->
		<div class="flex gap-2 px-4 py-3 border-t border-slate-700/50">
			<button
				type="button"
				class="flex-1 py-2.5 px-3 bg-slate-700 text-slate-200 rounded-lg text-sm font-medium hover:bg-slate-600 active:bg-slate-500 transition-colors"
				on:click={handleClose}
			>
				Cancel
			</button>
			<button
				type="button"
				class="flex-1 py-2.5 px-3 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-500 active:bg-indigo-400 transition-colors"
				on:click={handleSave}
			>
				Save
			</button>
		</div>
	</div>
</div>
