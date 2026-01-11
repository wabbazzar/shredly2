<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { LiveExercise, SetLog } from '$lib/engine/types';
	import { shouldShowWeightField } from '$lib/engine/exercise-metadata';

	export let exercise: LiveExercise;
	export let setNumber: number;
	export let isCompoundBlock = false;
	export let totalRounds: number | null = null;
	export let totalTime: number | null = null;

	const dispatch = createEventDispatcher<{
		submit: { setLog: SetLog; totalRounds?: number; totalTime?: number };
		cancel: void;
	}>();

	// Form state
	let reps: string = exercise.prescription.reps?.toString() ?? '';
	let weight: string = exercise.prescription.weight?.toString() ?? '';
	let weightUnit: 'lbs' | 'kg' = exercise.prescription.weightUnit ?? 'lbs';
	let rpe: string = '';
	let notes: string = '';
	let roundsInput: string = totalRounds?.toString() ?? '';
	let timeInput: string = totalTime ? formatTimeInput(totalTime) : '';

	// Determine which fields to show
	$: showWeight = shouldShowWeightField(exercise.exerciseName, null);
	$: showReps = !isCompoundBlock || exercise.exerciseType !== 'circuit';
	$: showRounds = isCompoundBlock && exercise.exerciseType === 'amrap';
	$: showTime = isCompoundBlock && exercise.exerciseType === 'circuit';

	function formatTimeInput(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	function parseTimeInput(value: string): number | null {
		// Try MM:SS format
		const match = value.match(/^(\d+):(\d{1,2})$/);
		if (match) {
			return parseInt(match[1]) * 60 + parseInt(match[2]);
		}
		// Try seconds only
		const secs = parseInt(value);
		if (!isNaN(secs)) {
			return secs;
		}
		return null;
	}

	function handleSubmit() {
		const setLog: SetLog = {
			setNumber,
			reps: reps ? parseInt(reps) : null,
			weight: weight ? parseFloat(weight) : null,
			weightUnit: showWeight && weight ? weightUnit : null,
			workTime: showTime ? parseTimeInput(timeInput) : null,
			rpe: rpe ? parseInt(rpe) : null,
			rir: null,
			completed: true,
			notes: notes.trim() || null,
			timestamp: new Date().toISOString()
		};

		dispatch('submit', {
			setLog,
			totalRounds: showRounds && roundsInput ? parseFloat(roundsInput) : undefined,
			totalTime: showTime ? parseTimeInput(timeInput) ?? undefined : undefined
		});
	}

	function handleCancel() {
		dispatch('cancel');
	}

	// RPE buttons
	const rpeOptions = [6, 7, 8, 9, 10];
</script>

<div class="fixed inset-0 z-50 flex items-end justify-center bg-black/60" on:click|self={handleCancel}>
	<div class="w-full max-w-lg bg-slate-800 rounded-t-2xl shadow-xl animate-slide-up">
		<!-- Header -->
		<div class="flex items-center justify-between p-4 border-b border-slate-700">
			<div>
				<h2 class="text-lg font-semibold text-white">
					{#if isCompoundBlock}
						Log {exercise.exerciseName}
					{:else}
						Set {setNumber}
					{/if}
				</h2>
				<p class="text-sm text-slate-400">{exercise.exerciseName}</p>
			</div>
			<button
				class="p-2 text-slate-400 hover:text-white transition-colors"
				on:click={handleCancel}
				aria-label="Close"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<!-- Form -->
		<div class="p-4 space-y-4">
			<!-- Reps & Weight Row -->
			{#if showReps || showWeight}
				<div class="grid grid-cols-2 gap-4">
					{#if showReps && !showRounds}
						<div>
							<label for="reps" class="block text-sm font-medium text-slate-300 mb-1">Reps</label>
							<input
								id="reps"
								type="number"
								inputmode="numeric"
								bind:value={reps}
								class="w-full px-3 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white text-lg text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
								placeholder={exercise.prescription.reps?.toString() ?? '10'}
							/>
						</div>
					{/if}

					{#if showWeight}
						<div>
							<label for="weight" class="block text-sm font-medium text-slate-300 mb-1">Weight</label>
							<div class="flex gap-2">
								<input
									id="weight"
									type="number"
									inputmode="decimal"
									step="2.5"
									bind:value={weight}
									class="flex-1 px-3 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white text-lg text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
									placeholder={exercise.prescription.weight?.toString() ?? '0'}
								/>
								<select
									bind:value={weightUnit}
									class="px-2 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
								>
									<option value="lbs">lbs</option>
									<option value="kg">kg</option>
								</select>
							</div>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Rounds (AMRAP) -->
			{#if showRounds}
				<div>
					<label for="rounds" class="block text-sm font-medium text-slate-300 mb-1">Total Rounds</label>
					<input
						id="rounds"
						type="number"
						inputmode="decimal"
						step="0.5"
						bind:value={roundsInput}
						class="w-full px-3 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white text-lg text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
						placeholder="e.g., 5.5"
					/>
					<p class="mt-1 text-xs text-slate-400">Decimal rounds allowed (e.g., 3.5 = 3 full + half)</p>
				</div>
			{/if}

			<!-- Time (Circuit) -->
			{#if showTime}
				<div>
					<label for="time" class="block text-sm font-medium text-slate-300 mb-1">Total Time</label>
					<input
						id="time"
						type="text"
						bind:value={timeInput}
						class="w-full px-3 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white text-lg text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
						placeholder="5:30"
					/>
					<p class="mt-1 text-xs text-slate-400">Format: MM:SS or seconds</p>
				</div>
			{/if}

			<!-- RPE -->
			<div>
				<label class="block text-sm font-medium text-slate-300 mb-2">RPE (Optional)</label>
				<div class="flex gap-2">
					{#each rpeOptions as option}
						<button
							type="button"
							class="flex-1 py-2 rounded-lg text-sm font-medium transition-colors
								{rpe === option.toString()
									? 'bg-indigo-600 text-white'
									: 'bg-slate-700 text-slate-300 hover:bg-slate-600'}"
							on:click={() => (rpe = rpe === option.toString() ? '' : option.toString())}
						>
							{option}
						</button>
					{/each}
				</div>
				<p class="mt-1 text-xs text-slate-400">
					6=Easy, 8=Hard, 10=Max
				</p>
			</div>

			<!-- Notes -->
			<div>
				<label for="notes" class="block text-sm font-medium text-slate-300 mb-1">Notes (Optional)</label>
				<input
					id="notes"
					type="text"
					bind:value={notes}
					class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
					placeholder="e.g., felt strong, grip fatigued"
				/>
			</div>
		</div>

		<!-- Actions -->
		<div class="flex gap-3 p-4 border-t border-slate-700">
			<button
				type="button"
				class="flex-1 py-3 px-4 bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-600 transition-colors"
				on:click={handleCancel}
			>
				Skip
			</button>
			<button
				type="button"
				class="flex-1 py-3 px-4 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-500 transition-colors"
				on:click={handleSubmit}
			>
				Log Set
			</button>
		</div>
	</div>
</div>

<style>
	@keyframes slide-up {
		from {
			transform: translateY(100%);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	.animate-slide-up {
		animation: slide-up 0.2s ease-out;
	}
</style>
