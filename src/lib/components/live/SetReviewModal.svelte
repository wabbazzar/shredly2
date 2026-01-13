<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { LiveExercise, SetLog, ExerciseLog } from '$lib/engine/types';
	import { shouldShowWeightField } from '$lib/engine/exercise-metadata';
	import { keyboardAware } from '$lib/actions/keyboardAware';

	export let exercise: LiveExercise;
	export let exerciseIndex: number;
	export let existingLog: ExerciseLog | null = null;

	const dispatch = createEventDispatcher<{
		save: { sets: SetLog[]; totalRounds?: number; totalTime?: number };
		close: void;
	}>();

	// Determine field visibility
	$: showWeight = shouldShowWeightField(exercise.exerciseName, null);
	$: isCompound = exercise.isCompoundParent;
	$: isAmrap = exercise.exerciseType === 'amrap';
	$: isCircuit = exercise.exerciseType === 'circuit';
	$: totalSets = exercise.prescription.sets;

	// Form state for each set
	interface SetFormData {
		reps: string;
		weight: string;
		rpe: string;
		completed: boolean;
	}

	let setsData: SetFormData[] = [];
	let weightUnit: 'lbs' | 'kg' = exercise.prescription.weightUnit ?? 'lbs';
	let roundsInput: string = '';
	let timeInput: string = '';

	// Initialize form data from existing logs or prescription
	function initializeFormData() {
		setsData = [];

		for (let i = 0; i < totalSets; i++) {
			const existingSet = existingLog?.sets[i];

			if (existingSet) {
				// Use existing logged data
				setsData.push({
					reps: existingSet.reps?.toString() ?? '',
					weight: existingSet.weight?.toString() ?? '',
					rpe: existingSet.rpe?.toString() ?? '',
					completed: existingSet.completed
				});
				if (existingSet.weightUnit) {
					weightUnit = existingSet.weightUnit;
				}
			} else {
				// Use prescription as default
				setsData.push({
					reps: exercise.prescription.reps?.toString() ?? '',
					weight: exercise.prescription.weight?.toString() ?? '',
					rpe: '',
					completed: false
				});
			}
		}

		// AMRAP rounds
		if (isAmrap && existingLog?.totalRounds !== undefined) {
			roundsInput = existingLog.totalRounds.toString();
		}

		// Circuit time
		if (isCircuit && existingLog?.totalTime !== undefined) {
			timeInput = formatTimeInput(existingLog.totalTime);
		}
	}

	// Initialize on mount and when exercise changes
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
		const sets: SetLog[] = setsData.map((data, i) => ({
			setNumber: i + 1,
			reps: data.reps ? parseInt(data.reps) : null,
			weight: data.weight ? parseFloat(data.weight) : null,
			weightUnit: showWeight && data.weight ? weightUnit : null,
			workTime: null,
			rpe: data.rpe ? parseInt(data.rpe) : null,
			rir: null,
			completed: data.completed || (data.reps !== '' || data.weight !== ''),
			notes: null,
			timestamp: new Date().toISOString()
		}));

		dispatch('save', {
			sets,
			totalRounds: isAmrap && roundsInput ? parseFloat(roundsInput) : undefined,
			totalTime: isCircuit ? parseTimeInput(timeInput) ?? undefined : undefined
		});
	}

	function handleClose() {
		dispatch('close');
	}

	function toggleSetCompleted(index: number) {
		setsData[index].completed = !setsData[index].completed;
	}

	// Quick RPE selection
	const rpeOptions = [6, 7, 8, 9, 10];
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" on:click|self={handleClose}>
	<div class="w-full max-w-lg bg-slate-800 rounded-2xl shadow-xl max-h-[90vh] overflow-hidden flex flex-col" use:keyboardAware>
		<!-- Header -->
		<div class="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
			<div>
				<h2 class="text-lg font-semibold text-white">{exercise.exerciseName}</h2>
				<p class="text-sm text-slate-400">
					{#if isCompound}
						{exercise.exerciseType.toUpperCase()} Block
					{:else}
						{totalSets} sets x {exercise.prescription.reps ?? '?'} reps
					{/if}
				</p>
			</div>
			<button
				class="p-2 text-slate-400 hover:text-white transition-colors"
				on:click={handleClose}
				aria-label="Close"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<!-- Scrollable content -->
		<div class="flex-1 overflow-y-auto p-4 space-y-3">
			{#if isAmrap}
				<!-- AMRAP: Total rounds input -->
				<div class="bg-slate-700/50 rounded-lg p-3">
					<label class="block text-sm font-medium text-slate-300 mb-2">Total Rounds Completed</label>
					<input
						type="number"
						inputmode="decimal"
						step="0.5"
						bind:value={roundsInput}
						on:focus={(e) => e.currentTarget.select()}
						class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-lg text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
						placeholder="e.g., 5.5"
					/>
					<p class="mt-1 text-xs text-slate-400">Decimal allowed (3.5 = 3 full + half round)</p>
				</div>
			{:else if isCircuit}
				<!-- Circuit: Total time input -->
				<div class="bg-slate-700/50 rounded-lg p-3">
					<label class="block text-sm font-medium text-slate-300 mb-2">Total Time</label>
					<input
						type="text"
						bind:value={timeInput}
						on:focus={(e) => e.currentTarget.select()}
						class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-lg text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
						placeholder="5:30"
					/>
					<p class="mt-1 text-xs text-slate-400">Format: MM:SS</p>
				</div>
			{:else}
				<!-- Regular sets -->
				{#each setsData as setData, i}
					<div class="bg-slate-700/50 rounded-lg p-3">
						<div class="flex items-center justify-between mb-2">
							<span class="text-sm font-medium text-slate-300">Set {i + 1}</span>
							<button
								type="button"
								class="text-xs px-2 py-1 rounded transition-colors
									{setData.completed ? 'bg-green-600 text-white' : 'bg-slate-600 text-slate-300 hover:bg-slate-500'}"
								on:click={() => toggleSetCompleted(i)}
							>
								{setData.completed ? 'Logged' : 'Not logged'}
							</button>
						</div>

						<div class="flex gap-2 flex-wrap">
							<!-- Reps -->
							<div class="flex-1 min-w-[60px]">
								<label class="block text-xs text-slate-400 mb-1">Reps</label>
								<input
									type="number"
									inputmode="numeric"
									bind:value={setData.reps}
									on:focus={(e) => e.currentTarget.select()}
									class="w-full px-2 py-2 bg-slate-700 border border-slate-600 rounded text-white text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
									placeholder="{exercise.prescription.reps ?? '-'}"
								/>
							</div>

							<!-- Weight -->
							{#if showWeight}
								<div class="flex-1 min-w-[70px]">
									<label class="block text-xs text-slate-400 mb-1">{weightUnit}</label>
									<input
										type="number"
										inputmode="decimal"
										step="2.5"
										bind:value={setData.weight}
										on:focus={(e) => e.currentTarget.select()}
										class="w-full px-2 py-2 bg-slate-700 border border-slate-600 rounded text-white text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
										placeholder="{exercise.prescription.weight ?? '-'}"
									/>
								</div>
							{/if}

							<!-- RPE -->
							<div class="w-14 flex-shrink-0">
								<label class="block text-xs text-slate-400 mb-1">RPE</label>
								<select
									bind:value={setData.rpe}
									class="w-full px-1 py-2 bg-slate-700 border border-slate-600 rounded text-white text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
								>
									<option value="">-</option>
									{#each rpeOptions as rpe}
										<option value={rpe.toString()}>{rpe}</option>
									{/each}
								</select>
							</div>
						</div>
					</div>
				{/each}

			{/if}
		</div>

		<!-- Actions -->
		<div class="flex gap-3 p-4 border-t border-slate-700 flex-shrink-0">
			<button
				type="button"
				class="flex-1 py-3 px-4 bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-600 transition-colors"
				on:click={handleClose}
			>
				Cancel
			</button>
			<button
				type="button"
				class="flex-1 py-3 px-4 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-500 transition-colors"
				on:click={handleSave}
			>
				Save
			</button>
		</div>
	</div>
</div>
