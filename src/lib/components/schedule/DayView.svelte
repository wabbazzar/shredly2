<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { StoredSchedule } from '$lib/types/schedule';
	import { getProgramDayDate, formatDayDate } from '$lib/utils/dateMapping';
	import ExerciseCard from './ExerciseCard.svelte';
	import CompoundBlockCard from './CompoundBlockCard.svelte';

	export let schedule: StoredSchedule;
	export let weekNumber: number;
	export let dayNumber: number;

	const dispatch = createEventDispatcher<{
		exerciseEdit: { exerciseIndex: number };
		back: void;
	}>();

	// Get day data
	$: day = schedule.days[dayNumber.toString()];
	$: date = getProgramDayDate(schedule.scheduleMetadata.startDate, dayNumber, schedule.daysPerWeek);
	$: dateFormatted = formatDayDate(date);

	// Check if exercise is a compound block
	function isCompoundBlock(exercise: { category?: string }): boolean {
		return !!exercise.category && ['emom', 'amrap', 'circuit', 'interval'].includes(exercise.category);
	}

	function handleBack() {
		dispatch('back');
	}

	function handleExerciseEdit(exerciseIndex: number) {
		dispatch('exerciseEdit', { exerciseIndex });
	}
</script>

<div class="flex flex-col h-full bg-slate-900">
	<!-- Header -->
	<div class="px-4 pt-4 pb-3 border-b border-slate-700">
		<div class="flex items-center gap-3 mb-2">
			<button
				on:click={handleBack}
				class="p-1 text-slate-400 hover:text-white transition-colors"
			>
				<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
				</svg>
			</button>
			<div>
				<h2 class="text-xl font-bold text-white">{day?.focus || 'Day ' + dayNumber}</h2>
				<p class="text-sm text-slate-400">{dateFormatted} | Week {weekNumber}</p>
			</div>
		</div>
	</div>

	<!-- Exercise List -->
	<div class="flex-1 overflow-y-auto p-4 space-y-3">
		{#if day}
			{#each day.exercises as exercise, index}
				{#if isCompoundBlock(exercise)}
					<CompoundBlockCard
						{exercise}
						{weekNumber}
						on:edit={() => handleExerciseEdit(index)}
					/>
				{:else}
					<ExerciseCard
						{exercise}
						{weekNumber}
						on:edit={() => handleExerciseEdit(index)}
					/>
				{/if}
			{/each}
		{:else}
			<div class="text-center py-8 text-slate-500">
				No exercises for this day
			</div>
		{/if}
	</div>
</div>
