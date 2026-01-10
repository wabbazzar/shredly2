<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { ParameterizedExercise, ParameterizedSubExercise, WeekParameters } from '$lib/engine/types';

	export let exercise: ParameterizedExercise;
	export let weekNumber: number;
	export let showEditButton = true;
	export let expanded = true;

	const dispatch = createEventDispatcher<{
		edit: void;
		toggle: void;
	}>();

	// Get block type styling
	$: blockStyle = (() => {
		switch (exercise.category) {
			case 'emom':
				return {
					label: 'EMOM',
					borderClass: 'border-blue-500',
					bgClass: 'bg-blue-500/10',
					badgeClass: 'bg-blue-500/20 text-blue-400'
				};
			case 'amrap':
				return {
					label: 'AMRAP',
					borderClass: 'border-green-500',
					bgClass: 'bg-green-500/10',
					badgeClass: 'bg-green-500/20 text-green-400'
				};
			case 'circuit':
				return {
					label: 'Circuit',
					borderClass: 'border-purple-500',
					bgClass: 'bg-purple-500/10',
					badgeClass: 'bg-purple-500/20 text-purple-400'
				};
			case 'interval':
				return {
					label: 'Interval',
					borderClass: 'border-orange-500',
					bgClass: 'bg-orange-500/10',
					badgeClass: 'bg-orange-500/20 text-orange-400'
				};
			default:
				return {
					label: exercise.category?.toUpperCase() || 'BLOCK',
					borderClass: 'border-slate-500',
					bgClass: 'bg-slate-500/10',
					badgeClass: 'bg-slate-500/20 text-slate-400'
				};
		}
	})();

	// Get week parameters for parent
	$: params = (() => {
		const key = `week${weekNumber}` as keyof ParameterizedExercise;
		return exercise[key] as WeekParameters | undefined;
	})();

	// Format block duration/sets
	$: blockParams = (() => {
		if (!params) return '';

		const parts: string[] = [];

		// Work time (for EMOM/AMRAP)
		if (params.work_time_minutes !== undefined) {
			if (params.work_time_unit === 'seconds') {
				parts.push(`${Math.round(params.work_time_minutes * 60)}s`);
			} else {
				parts.push(`${params.work_time_minutes}min`);
			}
		}

		// Sets (for Circuit/Interval)
		if (params.sets) {
			parts.push(`${params.sets} rounds`);
		}

		return parts.join(' | ');
	})();

	// Format sub-exercise parameters
	function getSubExerciseParams(subExercise: ParameterizedSubExercise): string {
		const key = `week${weekNumber}` as keyof ParameterizedSubExercise;
		const subParams = subExercise[key] as WeekParameters | undefined;
		if (!subParams) return '';

		if (subParams.reps) {
			return `${subParams.reps} reps`;
		}
		if (subParams.work_time_minutes !== undefined) {
			if (subParams.work_time_unit === 'seconds') {
				return `${Math.round(subParams.work_time_minutes * 60)}s`;
			}
			return `${subParams.work_time_minutes}min`;
		}
		return '';
	}

	function handleEdit() {
		dispatch('edit');
	}

	function handleToggle() {
		expanded = !expanded;
		dispatch('toggle');
	}
</script>

<div class="bg-slate-800 rounded-lg border-l-4 {blockStyle.borderClass} {blockStyle.bgClass}">
	<!-- Block Header -->
	<div class="p-4 pb-2">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				<span class="px-2 py-0.5 text-xs font-medium rounded {blockStyle.badgeClass}">
					{blockStyle.label}
				</span>
				<span class="text-sm text-slate-400">{blockParams}</span>
			</div>
			<div class="flex items-center gap-1">
				{#if exercise.sub_exercises && exercise.sub_exercises.length > 0}
					<button
						on:click={handleToggle}
						class="p-1.5 text-slate-400 hover:text-white transition-colors"
						aria-label={expanded ? 'Collapse' : 'Expand'}
					>
						<svg
							class="w-4 h-4 transition-transform {expanded ? '' : '-rotate-90'}"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M19 9l-7 7-7-7"
							/>
						</svg>
					</button>
				{/if}
				{#if showEditButton}
					<button
						on:click={handleEdit}
						class="p-1.5 text-slate-400 hover:text-white transition-colors"
						aria-label="Edit block"
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
	</div>

	<!-- Sub-exercises (collapsible) -->
	{#if expanded && exercise.sub_exercises && exercise.sub_exercises.length > 0}
		<div class="px-4 pb-4 space-y-2">
			{#each exercise.sub_exercises as subExercise}
				<div class="pl-4 border-l-2 border-slate-600">
					<div class="flex items-center justify-between">
						<span class="text-white">{subExercise.name}</span>
						<span class="text-sm text-slate-400">
							{getSubExerciseParams(subExercise)}
						</span>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
