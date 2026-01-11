<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { LiveExercise } from '$lib/engine/types';

	export let exercises: LiveExercise[];
	export let currentIndex: number;
	export let currentSubExerciseIndex: number = 0;

	const dispatch = createEventDispatcher<{
		info: { exercise: LiveExercise; index: number };
	}>();

	// Get exercise type badge color
	function getTypeBadgeClass(type: string): string {
		switch (type) {
			case 'emom':
				return 'bg-orange-500';
			case 'amrap':
				return 'bg-pink-500';
			case 'circuit':
				return 'bg-cyan-500';
			case 'interval':
				return 'bg-rose-500';
			case 'bodyweight':
				return 'bg-teal-500';
			default:
				return 'bg-slate-500';
		}
	}

	// Format prescription for display
	function formatPrescription(exercise: LiveExercise): string {
		const parts: string[] = [];

		if (exercise.prescription.sets > 1) {
			parts.push(`${exercise.prescription.sets} sets`);
		}

		if (exercise.prescription.reps) {
			parts.push(`${exercise.prescription.reps} reps`);
		}

		if (exercise.prescription.workTimeSeconds) {
			const mins = Math.floor(exercise.prescription.workTimeSeconds / 60);
			const secs = exercise.prescription.workTimeSeconds % 60;
			if (mins > 0 && secs > 0) {
				parts.push(`${mins}:${secs.toString().padStart(2, '0')}`);
			} else if (mins > 0) {
				parts.push(`${mins} min`);
			} else {
				parts.push(`${secs}s`);
			}
		}

		if (exercise.prescription.weight) {
			parts.push(
				`${exercise.prescription.weight} ${exercise.prescription.weightUnit || 'lbs'}`
			);
		}

		return parts.join(' | ');
	}

	// Get progress indicator
	function getProgressText(exercise: LiveExercise): string {
		if (exercise.completed) return 'Done';
		if (exercise.completedSets > 0) {
			return `${exercise.completedSets}/${exercise.prescription.sets}`;
		}
		return '';
	}
</script>

<div class="flex flex-col h-full bg-slate-900 overflow-y-auto">
	<div class="p-3 border-b border-slate-700">
		<h2 class="text-white/70 text-sm font-medium uppercase tracking-wider">Exercises</h2>
	</div>

	<div class="flex-1 overflow-y-auto">
		{#each exercises as exercise, index}
			{@const isCurrent = index === currentIndex}
			{@const isPast = exercise.completed}
			{@const isFuture = index > currentIndex && !exercise.completed}

			<div
				class="flex items-start p-3 border-b border-slate-700/50 transition-colors
				{isCurrent ? 'bg-slate-800' : ''}
				{isPast ? 'opacity-50' : ''}
				{isFuture ? 'opacity-70' : ''}"
			>
				<!-- Status indicator -->
				<div class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mr-3
					{isCurrent ? 'bg-green-600' : ''}
					{isPast ? 'bg-slate-600' : ''}
					{isFuture ? 'bg-slate-700' : ''}"
				>
					{#if isPast}
						<svg class="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 24 24">
							<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
						</svg>
					{:else if isCurrent}
						<span class="text-white font-bold text-sm">{index + 1}</span>
					{:else}
						<span class="text-slate-400 text-sm">{index + 1}</span>
					{/if}
				</div>

				<!-- Exercise info -->
				<div class="flex-1 min-w-0">
					<div class="flex items-center gap-2 mb-1">
						<span
							class="text-white font-medium truncate
							{isPast ? 'line-through text-slate-400' : ''}"
						>
							{exercise.exerciseName}
						</span>

						{#if exercise.exerciseType !== 'strength'}
							<span
								class="flex-shrink-0 text-xs px-2 py-0.5 rounded-full text-white uppercase font-medium
								{getTypeBadgeClass(exercise.exerciseType)}"
							>
								{exercise.exerciseType}
							</span>
						{/if}
					</div>

					<div class="text-slate-400 text-sm">
						{formatPrescription(exercise)}
					</div>

					<!-- Sub-exercises for compound blocks -->
					{#if exercise.isCompoundParent && exercise.subExercises.length > 0}
						<div class="mt-2 pl-2 border-l-2 border-slate-600">
							{#each exercise.subExercises as subEx, subIdx}
								{@const isCurrentSub = isCurrent && subIdx === currentSubExerciseIndex}
								<div class="text-xs py-0.5 {isCurrentSub ? 'text-white font-medium' : 'text-slate-500'}">
									{#if isCurrentSub}
										<span class="text-green-400 mr-1">▸</span>
									{/if}
									{subEx.exerciseName}
									{#if subEx.prescription.reps}
										<span class="{isCurrentSub ? 'text-slate-300' : 'text-slate-600'}">({subEx.prescription.reps} reps)</span>
									{/if}
								</div>
							{/each}
						</div>
					{/if}

					<!-- Progress indicator -->
					{#if getProgressText(exercise)}
						<div class="mt-1 text-xs {isPast ? 'text-green-400' : 'text-slate-500'}">
							{getProgressText(exercise)}
						</div>
					{/if}
				</div>

				<!-- Info button -->
				<button
					class="flex-shrink-0 w-8 h-8 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white flex items-center justify-center transition-colors ml-2"
					on:click={() => dispatch('info', { exercise, index })}
					aria-label="Exercise info"
				>
					<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
						<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
					</svg>
				</button>
			</div>
		{/each}
	</div>
</div>
