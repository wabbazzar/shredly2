<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { StoredSchedule } from '$lib/types/schedule';
	import type { ParameterizedExercise } from '$lib/engine/types';
	import { getWeekDateRange, formatDateRange, getProgramDayDate, formatDayDateShort } from '$lib/utils/dateMapping';

	export let schedule: StoredSchedule;
	export let weekNumber: number;

	const dispatch = createEventDispatcher<{
		daySelect: number;
		back: void;
	}>();

	// Calculate week data
	$: weekDateRange = getWeekDateRange(schedule.scheduleMetadata.startDate, weekNumber);
	$: weekFormatted = formatDateRange(weekDateRange.start, weekDateRange.end);

	// Get days for this week
	$: days = (() => {
		const startDay = (weekNumber - 1) * schedule.daysPerWeek + 1;
		const endDay = startDay + schedule.daysPerWeek - 1;

		const result: {
			dayNumber: number;
			focus: string;
			date: Date;
			dateFormatted: string;
			exercises: ParameterizedExercise[];
			isCurrent: boolean;
		}[] = [];

		for (let d = startDay; d <= endDay; d++) {
			const day = schedule.days[d.toString()];
			if (day) {
				const date = getProgramDayDate(schedule.scheduleMetadata.startDate, d, schedule.daysPerWeek);
				result.push({
					dayNumber: d,
					focus: day.focus,
					date,
					dateFormatted: formatDayDateShort(date),
					exercises: day.exercises,
					isCurrent:
						weekNumber === schedule.scheduleMetadata.currentWeek &&
						d === schedule.scheduleMetadata.currentDay
				});
			}
		}

		return result;
	})();

	// Get first 3 exercise names for preview
	function getExercisePreview(exercises: ParameterizedExercise[]): string[] {
		return exercises.slice(0, 3).map((e) => {
			// Clean up compound exercise names
			if (e.name.includes(':')) {
				return e.name.split(':')[0].trim();
			}
			return e.name;
		});
	}

	function handleDayClick(dayNumber: number) {
		dispatch('daySelect', dayNumber);
	}

	function handleBack() {
		dispatch('back');
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
				<h2 class="text-xl font-bold text-white">Week {weekNumber}</h2>
				<p class="text-sm text-slate-400">{weekFormatted}</p>
			</div>
		</div>
	</div>

	<!-- Day Cards -->
	<div class="flex-1 overflow-y-auto p-4 space-y-3">
		{#each days as day}
			<button
				on:click={() => handleDayClick(day.dayNumber)}
				class="w-full bg-slate-800 rounded-lg p-4 text-left hover:bg-slate-750 transition-colors
					   {day.isCurrent ? 'ring-2 ring-indigo-500' : ''}"
			>
				<!-- Day Header -->
				<div class="flex items-center justify-between mb-3">
					<div class="flex items-center gap-2">
						<span class="font-semibold text-white">{day.focus}</span>
						{#if day.isCurrent}
							<span class="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 text-xs rounded-full">
								Today
							</span>
						{/if}
					</div>
					<span class="text-sm text-slate-400">{day.dateFormatted}</span>
				</div>

				<!-- Exercise Preview -->
				<div class="space-y-1">
					{#each getExercisePreview(day.exercises) as exerciseName}
						<div class="text-sm text-slate-400 flex items-center gap-2">
							<span class="w-1.5 h-1.5 bg-slate-600 rounded-full"></span>
							{exerciseName}
						</div>
					{/each}
					{#if day.exercises.length > 3}
						<div class="text-xs text-slate-500 mt-1">
							+{day.exercises.length - 3} more exercises
						</div>
					{/if}
				</div>
			</button>
		{/each}
	</div>
</div>
