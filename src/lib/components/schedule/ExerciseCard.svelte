<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { ParameterizedExercise, WeekParameters } from '$lib/engine/types';
	import { shouldShowWeightField } from '$lib/engine/exercise-metadata';

	export let exercise: ParameterizedExercise;
	export let weekNumber: number;
	export let showEditButton = true;

	const dispatch = createEventDispatcher<{
		edit: void;
	}>();

	// Get week parameters
	$: params = (() => {
		const key = `week${weekNumber}` as keyof ParameterizedExercise;
		return exercise[key] as WeekParameters | undefined;
	})();

	// Format sets x reps
	$: setsReps = (() => {
		if (!params) return '';
		if (params.sets && params.reps) {
			return `${params.sets} x ${params.reps}`;
		}
		if (params.sets) {
			return `${params.sets} sets`;
		}
		return '';
	})();

	// Format work time
	$: workTime = (() => {
		if (!params?.work_time_minutes) return '';
		if (params.work_time_unit === 'seconds') {
			return `${Math.round(params.work_time_minutes * 60)}s`;
		}
		return `${params.work_time_minutes}min`;
	})();

	// Format weight
	$: weight = (() => {
		if (!params?.weight) return '';
		if (!shouldShowWeightField(exercise.name, params.weight)) return '';

		if (typeof params.weight === 'string') {
			return params.weight;
		}
		if (params.weight.type === 'percent_tm') {
			return `${params.weight.value}% TM`;
		}
		if (params.weight.type === 'percent_bw') {
			return `${params.weight.value}% BW`;
		}
		if (params.weight.type === 'absolute') {
			return `${params.weight.value} ${params.weight.unit}`;
		}
		return '';
	})();

	// Format rest time
	$: restTime = (() => {
		if (!params?.rest_time_minutes) return '';
		if (params.rest_time_unit === 'seconds') {
			return `${Math.round(params.rest_time_minutes * 60)}s rest`;
		}
		return `${params.rest_time_minutes}min rest`;
	})();

	// Combine parameters for display
	$: displayParams = [setsReps, workTime, weight].filter(Boolean).join(' | ');

	function handleEdit() {
		dispatch('edit');
	}
</script>

<div class="bg-slate-800 rounded-lg p-4">
	<div class="flex items-start justify-between">
		<div class="flex-1">
			<h4 class="font-medium text-white">{exercise.name}</h4>
			{#if displayParams}
				<div class="text-sm text-slate-400 mt-1">
					{displayParams}
				</div>
			{/if}
			{#if restTime}
				<div class="text-xs text-slate-500 mt-1">
					{restTime}
				</div>
			{/if}
		</div>
		{#if showEditButton}
			<button
				on:click={handleEdit}
				class="p-1.5 text-slate-400 hover:text-white transition-colors"
				aria-label="Edit exercise"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
					/>
				</svg>
			</button>
		{/if}
	</div>
</div>
