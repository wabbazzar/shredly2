<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { StoredSchedule } from '$lib/types/schedule';
	import { getWeekDateRange, formatDateRange, getProgramDayDate, formatDayDateShort } from '$lib/utils/dateMapping';

	export let schedule: StoredSchedule;

	const dispatch = createEventDispatcher<{
		weekSelect: number;
		back: void;
	}>();

	// Calculate week data
	$: weeks = Array.from({ length: schedule.weeks }, (_, i) => {
		const weekNumber = i + 1;
		const dateRange = getWeekDateRange(schedule.scheduleMetadata.startDate, weekNumber);

		// Get days for this week
		const startDay = (weekNumber - 1) * schedule.daysPerWeek + 1;
		const endDay = startDay + schedule.daysPerWeek - 1;

		const days: { dayNumber: number; focus: string; exerciseCount: number }[] = [];
		for (let d = startDay; d <= endDay; d++) {
			const day = schedule.days[d.toString()];
			if (day) {
				days.push({
					dayNumber: d,
					focus: day.focus,
					exerciseCount: day.exercises.length
				});
			}
		}

		return {
			weekNumber,
			dateRange,
			formattedRange: formatDateRange(dateRange.start, dateRange.end),
			days,
			isCurrent: weekNumber === schedule.scheduleMetadata.currentWeek
		};
	});

	function handleWeekClick(weekNumber: number) {
		dispatch('weekSelect', weekNumber);
	}
</script>

<div class="flex flex-col h-full bg-slate-900">
	<!-- Header -->
	<div class="px-4 pt-4 pb-3 border-b border-slate-700">
		<div class="flex items-center justify-between mb-2">
			<h2 class="text-xl font-bold text-white">{schedule.name}</h2>
		</div>
		<div class="flex items-center gap-4 text-sm text-slate-400">
			<span>{schedule.weeks} weeks</span>
			<span class="text-slate-600">|</span>
			<span>{schedule.daysPerWeek} days/week</span>
			<span class="text-slate-600">|</span>
			<span>{schedule.metadata.difficulty}</span>
		</div>
	</div>

	<!-- Week Cards -->
	<div class="flex-1 overflow-y-auto p-4 space-y-3">
		{#each weeks as week}
			<button
				on:click={() => handleWeekClick(week.weekNumber)}
				class="w-full bg-slate-800 rounded-lg p-4 text-left hover:bg-slate-750 transition-colors
					   {week.isCurrent ? 'ring-2 ring-indigo-500' : ''}"
			>
				<!-- Week Header -->
				<div class="flex items-center justify-between mb-3">
					<div class="flex items-center gap-2">
						<span class="font-semibold text-white">Week {week.weekNumber}</span>
						{#if week.isCurrent}
							<span
								class="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 text-xs rounded-full"
							>
								Current
							</span>
						{/if}
					</div>
					<span class="text-sm text-slate-400">{week.formattedRange}</span>
				</div>

				<!-- Day Summaries -->
				<div class="grid grid-cols-{Math.min(week.days.length, 4)} gap-2">
					{#each week.days as day}
						<div
							class="bg-slate-700/50 rounded px-3 py-2 text-center"
						>
							<div class="text-xs text-slate-400 mb-0.5">Day {day.dayNumber}</div>
							<div class="text-sm text-white font-medium truncate">{day.focus}</div>
							<div class="text-xs text-slate-500">{day.exerciseCount} exercises</div>
						</div>
					{/each}
				</div>
			</button>
		{/each}
	</div>
</div>
