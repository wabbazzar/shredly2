<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { StoredSchedule } from '$lib/types/schedule';
	import type { ParameterizedExercise, WeekParameters } from '$lib/engine/types';
	import { getProgramDayDate, formatDayDate } from '$lib/utils/dateMapping';
	import { shouldShowWeightField } from '$lib/engine/exercise-metadata';

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

	// Get week parameters for an exercise
	function getWeekParams(exercise: ParameterizedExercise): WeekParameters | undefined {
		const key = `week${weekNumber}` as keyof ParameterizedExercise;
		return exercise[key] as WeekParameters | undefined;
	}

	// Format exercise parameters
	function formatParams(exercise: ParameterizedExercise): string {
		const params = getWeekParams(exercise);
		if (!params) return '';

		const parts: string[] = [];

		// Sets x Reps
		if (params.sets && params.reps) {
			parts.push(`${params.sets} x ${params.reps}`);
		} else if (params.sets) {
			parts.push(`${params.sets} sets`);
		}

		// Work time (for timed exercises)
		if (params.work_time_minutes !== undefined) {
			const timeValue = params.work_time_unit === 'seconds'
				? Math.round(params.work_time_minutes * 60)
				: params.work_time_minutes;
			const unit = params.work_time_unit === 'seconds' ? 's' : 'min';
			parts.push(`${timeValue}${unit}`);
		}

		// Weight
		if (shouldShowWeightField(exercise.name, params.weight) && params.weight) {
			if (typeof params.weight === 'string') {
				parts.push(params.weight);
			} else if (params.weight.type === 'percent_tm') {
				parts.push(`${params.weight.value}% TM`);
			} else if (params.weight.type === 'percent_bw') {
				parts.push(`${params.weight.value}% BW`);
			} else if (params.weight.type === 'absolute') {
				parts.push(`${params.weight.value} ${params.weight.unit}`);
			}
		}

		return parts.join(' | ');
	}

	// Format rest time
	function formatRest(exercise: ParameterizedExercise): string {
		const params = getWeekParams(exercise);
		if (!params?.rest_time_minutes) return '';

		if (params.rest_time_unit === 'seconds') {
			return `${Math.round(params.rest_time_minutes * 60)}s rest`;
		}
		return `${params.rest_time_minutes}min rest`;
	}

	// Check if exercise is a compound block
	function isCompoundBlock(exercise: ParameterizedExercise): boolean {
		return !!exercise.category && ['emom', 'amrap', 'circuit', 'interval'].includes(exercise.category);
	}

	// Get block type label and color
	function getBlockStyle(category: string): { label: string; colorClass: string } {
		switch (category) {
			case 'emom':
				return { label: 'EMOM', colorClass: 'border-blue-500 bg-blue-500/10' };
			case 'amrap':
				return { label: 'AMRAP', colorClass: 'border-green-500 bg-green-500/10' };
			case 'circuit':
				return { label: 'Circuit', colorClass: 'border-purple-500 bg-purple-500/10' };
			case 'interval':
				return { label: 'Interval', colorClass: 'border-orange-500 bg-orange-500/10' };
			default:
				return { label: category.toUpperCase(), colorClass: 'border-slate-500 bg-slate-500/10' };
		}
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
					<!-- Compound Block Card -->
					{@const blockStyle = getBlockStyle(exercise.category || '')}
					<div
						class="bg-slate-800 rounded-lg border-l-4 {blockStyle.colorClass}"
					>
						<!-- Block Header -->
						<div class="p-4 pb-2">
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-2">
									<span
										class="px-2 py-0.5 text-xs font-medium rounded
											   {exercise.category === 'emom' ? 'bg-blue-500/20 text-blue-400' : ''}
											   {exercise.category === 'amrap' ? 'bg-green-500/20 text-green-400' : ''}
											   {exercise.category === 'circuit' ? 'bg-purple-500/20 text-purple-400' : ''}
											   {exercise.category === 'interval' ? 'bg-orange-500/20 text-orange-400' : ''}"
									>
										{blockStyle.label}
									</span>
									<span class="text-sm text-slate-400">{formatParams(exercise)}</span>
								</div>
								<button
									on:click={() => handleExerciseEdit(index)}
									class="p-1.5 text-slate-400 hover:text-white transition-colors"
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
							</div>
						</div>

						<!-- Sub-exercises -->
						{#if exercise.sub_exercises && exercise.sub_exercises.length > 0}
							<div class="px-4 pb-4 space-y-2">
								{#each exercise.sub_exercises as subExercise}
									{@const subParams = subExercise[`week${weekNumber}` as keyof typeof subExercise] as WeekParameters | undefined}
									<div class="pl-4 border-l-2 border-slate-600">
										<div class="flex items-center justify-between">
											<span class="text-white">{subExercise.name}</span>
											<span class="text-sm text-slate-400">
												{#if subParams?.reps}
													{subParams.reps} reps
												{:else if subParams?.work_time_minutes}
													{subParams.work_time_unit === 'seconds'
														? Math.round(subParams.work_time_minutes * 60) + 's'
														: subParams.work_time_minutes + 'min'}
												{/if}
											</span>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{:else}
					<!-- Standard Exercise Card -->
					<div class="bg-slate-800 rounded-lg p-4">
						<div class="flex items-start justify-between">
							<div class="flex-1">
								<h4 class="font-medium text-white">{exercise.name}</h4>
								<div class="text-sm text-slate-400 mt-1">
									{formatParams(exercise)}
								</div>
								{#if formatRest(exercise)}
									<div class="text-xs text-slate-500 mt-1">
										{formatRest(exercise)}
									</div>
								{/if}
							</div>
							<button
								on:click={() => handleExerciseEdit(index)}
								class="p-1.5 text-slate-400 hover:text-white transition-colors"
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
						</div>
					</div>
				{/if}
			{/each}
		{:else}
			<div class="text-center py-8 text-slate-500">
				No exercises for this day
			</div>
		{/if}
	</div>
</div>
