<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { LiveExercise } from '$lib/engine/types';
	import { getExerciseMetadata } from '$lib/engine/exercise-metadata';
	import { getPersonalRecords, getLastPerformance, type PersonalRecord } from '$lib/stores/history';

	export let exercise: LiveExercise;

	const dispatch = createEventDispatcher<{
		close: void;
	}>();

	// Get exercise metadata
	$: metadata = getExerciseMetadata(exercise.exerciseName);
	$: personalRecords = getPersonalRecords(exercise.exerciseName);
	$: lastPerformance = getLastPerformance(exercise.exerciseName);

	function handleClose() {
		dispatch('close');
	}

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return 'Never';
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" on:click|self={handleClose}>
	<div class="w-full max-w-md bg-slate-800 rounded-xl shadow-xl overflow-hidden max-h-[80vh] flex flex-col">
		<!-- Header -->
		<div class="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
			<h2 class="text-lg font-semibold text-white truncate pr-4">{exercise.exerciseName}</h2>
			<button
				class="p-2 text-slate-400 hover:text-white transition-colors flex-shrink-0"
				on:click={handleClose}
				aria-label="Close"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto p-4 space-y-6">
			<!-- Exercise Type Badge -->
			{#if exercise.exerciseType !== 'strength'}
				<div class="flex items-center gap-2">
					<span class="px-3 py-1 rounded-full text-sm font-medium uppercase
						{exercise.exerciseType === 'emom' ? 'bg-orange-500/20 text-orange-400' : ''}
						{exercise.exerciseType === 'amrap' ? 'bg-pink-500/20 text-pink-400' : ''}
						{exercise.exerciseType === 'circuit' ? 'bg-cyan-500/20 text-cyan-400' : ''}
						{exercise.exerciseType === 'interval' ? 'bg-rose-500/20 text-rose-400' : ''}
						{exercise.exerciseType === 'bodyweight' ? 'bg-teal-500/20 text-teal-400' : ''}"
					>
						{exercise.exerciseType}
					</span>
				</div>
			{/if}

			<!-- Metadata -->
			{#if metadata}
				<div class="space-y-3">
					{#if metadata.muscleGroups && metadata.muscleGroups.length > 0}
						<div>
							<h3 class="text-sm font-medium text-slate-400 mb-1">Muscle Groups</h3>
							<div class="flex flex-wrap gap-1">
								{#each metadata.muscleGroups as muscle}
									<span class="px-2 py-0.5 bg-slate-700 rounded text-sm text-white">
										{muscle}
									</span>
								{/each}
							</div>
						</div>
					{/if}

					{#if metadata.equipment && metadata.equipment.length > 0}
						<div>
							<h3 class="text-sm font-medium text-slate-400 mb-1">Equipment</h3>
							<div class="flex flex-wrap gap-1">
								{#each metadata.equipment as item}
									<span class="px-2 py-0.5 bg-slate-700 rounded text-sm text-white">
										{item}
									</span>
								{/each}
							</div>
						</div>
					{/if}

					{#if metadata.difficulty}
						<div>
							<h3 class="text-sm font-medium text-slate-400 mb-1">Difficulty</h3>
							<span class="text-white">{metadata.difficulty}</span>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Today's Prescription -->
			<div>
				<h3 class="text-sm font-medium text-slate-400 mb-2">Today's Prescription</h3>
				<div class="bg-slate-700/50 rounded-lg p-3">
					<div class="grid grid-cols-2 gap-2 text-sm">
						{#if exercise.prescription.sets > 1}
							<div>
								<span class="text-slate-400">Sets:</span>
								<span class="text-white ml-2">{exercise.prescription.sets}</span>
							</div>
						{/if}
						{#if exercise.prescription.reps}
							<div>
								<span class="text-slate-400">Reps:</span>
								<span class="text-white ml-2">{exercise.prescription.reps}</span>
							</div>
						{/if}
						{#if exercise.prescription.weight}
							<div>
								<span class="text-slate-400">Weight:</span>
								<span class="text-white ml-2">
									{exercise.prescription.weight} {exercise.prescription.weightUnit || 'lbs'}
								</span>
							</div>
						{/if}
						{#if exercise.prescription.workTimeSeconds}
							<div>
								<span class="text-slate-400">Time:</span>
								<span class="text-white ml-2">
									{Math.floor(exercise.prescription.workTimeSeconds / 60)}:{(exercise.prescription.workTimeSeconds % 60).toString().padStart(2, '0')}
								</span>
							</div>
						{/if}
						{#if exercise.prescription.restTimeSeconds}
							<div>
								<span class="text-slate-400">Rest:</span>
								<span class="text-white ml-2">{exercise.prescription.restTimeSeconds}s</span>
							</div>
						{/if}
					</div>
				</div>
			</div>

			<!-- Personal Records -->
			{#if personalRecords.maxWeight || personalRecords.maxReps}
				<div>
					<h3 class="text-sm font-medium text-slate-400 mb-2">Personal Records</h3>
					<div class="bg-slate-700/50 rounded-lg p-3 space-y-2">
						{#if personalRecords.maxWeight}
							<div class="flex justify-between text-sm">
								<span class="text-slate-400">Max Weight:</span>
								<span class="text-white">
									{personalRecords.maxWeight} {personalRecords.maxWeightUnit}
									<span class="text-slate-500 text-xs ml-1">
										({formatDate(personalRecords.maxWeightDate)})
									</span>
								</span>
							</div>
						{/if}
						{#if personalRecords.maxReps}
							<div class="flex justify-between text-sm">
								<span class="text-slate-400">Max Reps:</span>
								<span class="text-white">
									{personalRecords.maxReps}
									<span class="text-slate-500 text-xs ml-1">
										({formatDate(personalRecords.maxRepsDate)})
									</span>
								</span>
							</div>
						{/if}
						{#if personalRecords.maxVolume}
							<div class="flex justify-between text-sm">
								<span class="text-slate-400">Max Volume:</span>
								<span class="text-white">
									{personalRecords.maxVolume}
									<span class="text-slate-500 text-xs ml-1">
										({formatDate(personalRecords.maxVolumeDate)})
									</span>
								</span>
							</div>
						{/if}
					</div>
				</div>
			{/if}

			<!-- Last Performance -->
			{#if lastPerformance}
				<div>
					<h3 class="text-sm font-medium text-slate-400 mb-2">Last Performance</h3>
					<div class="bg-slate-700/50 rounded-lg p-3">
						<div class="text-sm text-slate-400 mb-1">
							{formatDate(lastPerformance.date)}
						</div>
						<div class="text-white">
							{#if lastPerformance.weight}
								{lastPerformance.weight} {lastPerformance.weight_unit}
							{/if}
							{#if lastPerformance.reps}
								{lastPerformance.weight ? ' x ' : ''}{lastPerformance.reps} reps
							{/if}
							{#if lastPerformance.rpe}
								<span class="text-slate-400 ml-2">@ RPE {lastPerformance.rpe}</span>
							{/if}
						</div>
					</div>
				</div>
			{:else}
				<div class="text-center text-slate-500 py-4">
					No history for this exercise yet
				</div>
			{/if}

			<!-- Sub-exercises for compound blocks -->
			{#if exercise.isCompoundParent && exercise.subExercises.length > 0}
				<div>
					<h3 class="text-sm font-medium text-slate-400 mb-2">Sub-exercises</h3>
					<div class="space-y-2">
						{#each exercise.subExercises as subEx}
							<div class="bg-slate-700/50 rounded-lg p-3">
								<div class="font-medium text-white">{subEx.exerciseName}</div>
								<div class="text-sm text-slate-400">
									{#if subEx.prescription.reps}
										{subEx.prescription.reps} reps
									{/if}
									{#if subEx.prescription.workTimeSeconds}
										{subEx.prescription.workTimeSeconds}s work
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<!-- Close Button -->
		<div class="p-4 border-t border-slate-700 flex-shrink-0">
			<button
				type="button"
				class="w-full py-3 px-4 bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-600 transition-colors"
				on:click={handleClose}
			>
				Close
			</button>
		</div>
	</div>
</div>
