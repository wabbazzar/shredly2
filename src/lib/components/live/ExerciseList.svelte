<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { LiveExercise, ExerciseLog } from '$lib/engine/types';
	import { shouldShowWeightField } from '$lib/engine/exercise-metadata';
	import { getFromCache } from '$lib/stores/oneRMCache';
	import { calculateWorkoutTimeFromLiveExercises, formatWorkoutTime } from '$lib/utils/workoutTimeEstimate';

	export let exercises: LiveExercise[];
	export let currentIndex: number;
	export let currentSubExerciseIndex: number = 0;
	export let exerciseLogs: Map<number, ExerciseLog> = new Map();

	// Calculate estimated workout time
	$: estimatedTimeSeconds = calculateWorkoutTimeFromLiveExercises(exercises);
	$: estimatedTimeDisplay = formatWorkoutTime(estimatedTimeSeconds);

	/**
	 * Calculate weight from cache at render time (like DayView does)
	 * This ensures we always show the latest cached TRM values
	 */
	function calculateWeightFromCache(exerciseName: string, percentTM: number): number | null {
		const cacheEntry = getFromCache(exerciseName);
		if (cacheEntry && cacheEntry.trm > 0) {
			return Math.round(cacheEntry.trm * (percentTM / 100) / 5) * 5; // Round to nearest 5
		}
		return null;
	}

	/**
	 * Get the display weight for an exercise - prefer cache calculation over pre-calculated
	 */
	function getDisplayWeight(exercise: LiveExercise): { weight: number | null; unit: string; fromCache: boolean } {
		// First try to calculate from cache (most up-to-date)
		if (exercise.prescription.weightPrescription?.type === 'percent_tm') {
			const cachedWeight = calculateWeightFromCache(
				exercise.exerciseName,
				exercise.prescription.weightPrescription.value
			);
			if (cachedWeight !== null) {
				return { weight: cachedWeight, unit: 'lbs', fromCache: true };
			}
		}

		// Fall back to pre-calculated weight from session
		if (exercise.prescription.weight) {
			return {
				weight: exercise.prescription.weight,
				unit: exercise.prescription.weightUnit || 'lbs',
				fromCache: false
			};
		}

		return { weight: null, unit: 'lbs', fromCache: false };
	}

	const dispatch = createEventDispatcher<{
		info: { exercise: LiveExercise; index: number };
		select: { exercise: LiveExercise; index: number };
		review: { exercise: LiveExercise; index: number };
		finish: void;
	}>();

	// Handle clicking on an exercise row
	function handleExerciseClick(exercise: LiveExercise, index: number) {
		// In review mode (currentIndex === -1), all exercises are reviewable
		if (currentIndex === -1) {
			dispatch('review', { exercise, index });
			return;
		}
		// Skip to future exercises
		if (index > currentIndex && !exercise.completed) {
			dispatch('select', { exercise, index });
		}
		// Review completed/skipped exercises
		else if (exercise.completed || exercise.skipped) {
			dispatch('review', { exercise, index });
		}
	}

	// Handle clicking on the status icon
	function handleStatusIconClick(event: MouseEvent, exercise: LiveExercise, index: number) {
		event.stopPropagation();
		// In review mode (currentIndex === -1), all exercises are reviewable
		if (currentIndex === -1) {
			dispatch('review', { exercise, index });
			return;
		}
		// Open review modal for completed or skipped exercises
		if (exercise.completed || exercise.skipped) {
			dispatch('review', { exercise, index });
		}
	}

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

		// Show weight - calculate from cache at render time (like DayView)
		const showWeightForExercise = shouldShowWeightField(exercise.exerciseName);
		if (showWeightForExercise) {
			const displayWeight = getDisplayWeight(exercise);
			if (displayWeight.weight !== null) {
				parts.push(`${displayWeight.weight} ${displayWeight.unit}`);
			} else if (exercise.prescription.weightPrescription) {
				// Fallback to prescription display when no cached weight
				const wp = exercise.prescription.weightPrescription;
				if (wp.type === 'qualitative') {
					parts.push(String(wp.value));
				} else if (wp.type === 'percent_tm') {
					parts.push(`${wp.value}% TM`);
				} else if (wp.type === 'absolute') {
					parts.push(`${wp.value} ${wp.unit || 'lbs'}`);
				}
			}
		}

		return parts.join(' | ');
	}

	// Get progress indicator
	function getProgressText(exercise: LiveExercise): string {
		if (exercise.completed && !exercise.skipped) return 'Done';
		if (exercise.completedSets > 0) {
			return `${exercise.completedSets}/${exercise.prescription.sets}`;
		}
		return '';
	}

	// Format logged data summary for display
	function formatLoggedData(exerciseIndex: number, exercise: LiveExercise): string {
		const log = exerciseLogs.get(exerciseIndex);
		if (!log) return '';

		// AMRAP - show rounds
		if (exercise.exerciseType === 'amrap' && log.totalRounds !== undefined) {
			return `${log.totalRounds} rounds`;
		}

		// Circuit - show time
		if (exercise.exerciseType === 'circuit' && log.totalTime !== undefined) {
			const mins = Math.floor(log.totalTime / 60);
			const secs = log.totalTime % 60;
			return `${mins}:${secs.toString().padStart(2, '0')}`;
		}

		// Regular sets - show weight x reps for each set
		if (log.sets.length === 0) return '';

		const showWeight = shouldShowWeightField(exercise.exerciseName, null);

		// Group identical sets together
		const repsList = log.sets.map(s => s.reps ?? 0);
		const weights = log.sets.map(s => s.weight);
		const unit = log.sets[0]?.weightUnit ?? 'lbs';

		// Check if all weights are the same
		const allSameWeight = weights.every(w => w === weights[0]);

		if (showWeight && allSameWeight && weights[0]) {
			// Format: "135 lbs x 8,8,8,7"
			return `${weights[0]} ${unit} x ${repsList.join(',')}`;
		} else if (showWeight) {
			// Format: "135x8, 145x8, 155x6"
			return log.sets.map(s => {
				if (s.weight) {
					return `${s.weight}x${s.reps ?? '?'}`;
				}
				return `${s.reps ?? '?'}`;
			}).join(', ');
		} else {
			// No weight - just show reps: "8,8,8,7 reps"
			return `${repsList.join(',')} reps`;
		}
	}

	// Format sub-exercise prescription for display (includes weight when applicable)
	function formatSubExercisePrescription(subEx: LiveExercise): string {
		const parts: string[] = [];

		// Add reps if present
		if (subEx.prescription.reps) {
			parts.push(`${subEx.prescription.reps} reps`);
		}

		// Add work time if present (for interval sub-exercises)
		if (subEx.prescription.workTimeSeconds && !subEx.prescription.reps) {
			const secs = subEx.prescription.workTimeSeconds;
			if (secs >= 60) {
				const mins = Math.floor(secs / 60);
				const remainingSecs = secs % 60;
				if (remainingSecs > 0) {
					parts.push(`${mins}:${remainingSecs.toString().padStart(2, '0')}`);
				} else {
					parts.push(`${mins} min`);
				}
			} else {
				parts.push(`${secs}s`);
			}
		}

		// Add weight if applicable - calculate from cache at render time (like DayView)
		const showWeight = shouldShowWeightField(subEx.exerciseName);
		if (showWeight) {
			const displayWeight = getDisplayWeight(subEx);
			if (displayWeight.weight !== null) {
				parts.push(`${displayWeight.weight} ${displayWeight.unit}`);
			} else if (subEx.prescription.weightPrescription) {
				// Fallback to prescription display (% TM or qualitative)
				const wp = subEx.prescription.weightPrescription;
				if (wp.type === 'qualitative') {
					parts.push(String(wp.value));
				} else if (wp.type === 'percent_tm') {
					parts.push(`${wp.value}% TM`);
				} else if (wp.type === 'absolute') {
					parts.push(`${wp.value} ${wp.unit || 'lbs'}`);
				}
			}
		}

		return parts.join(' @ ');
	}
</script>

<div class="flex flex-col h-full bg-slate-900 overflow-y-auto">
	<div class="p-3 border-b border-slate-700">
		<div class="flex items-center justify-between">
			<h2 class="text-white/70 text-sm font-medium uppercase tracking-wider">Exercises</h2>
			{#if estimatedTimeSeconds > 0}
				<span class="text-xs text-indigo-400 font-medium flex items-center gap-1">
					<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					{estimatedTimeDisplay}
				</span>
			{/if}
		</div>
	</div>

	<div class="flex-1 overflow-y-auto pb-8">
		{#each exercises as exercise, index}
			{@const isCurrent = index === currentIndex}
			{@const isPast = exercise.completed && !exercise.skipped}
			{@const isSkipped = exercise.skipped}
			{@const isFuture = index > currentIndex && !exercise.completed}
			{@const isClickable = isFuture || isPast || isSkipped}
			{@const loggedData = formatLoggedData(index, exercise)}

			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<div
				class="flex items-start p-3 border-b border-slate-700/50 transition-colors
				{isCurrent ? 'bg-slate-800' : ''}
				{isPast ? 'hover:bg-slate-800/30 cursor-pointer' : ''}
				{isSkipped ? 'bg-yellow-900/20 hover:bg-yellow-900/30 cursor-pointer' : ''}
				{isFuture ? 'opacity-70 cursor-pointer hover:bg-slate-800/50' : ''}"
				on:click={() => handleExerciseClick(exercise, index)}
				on:keydown={(e) => e.key === 'Enter' && handleExerciseClick(exercise, index)}
				role={isClickable ? 'button' : undefined}
				tabindex={isClickable ? 0 : -1}
			>
				<!-- Status indicator -->
				<button
					class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mr-3 transition-colors
					{isCurrent ? 'bg-green-600' : ''}
					{isPast ? 'bg-green-600/80 hover:bg-green-500' : ''}
					{isSkipped ? 'bg-yellow-500 hover:bg-yellow-400' : ''}
					{isFuture ? 'bg-slate-700' : ''}"
					on:click={(e) => handleStatusIconClick(e, exercise, index)}
					aria-label={isPast || isSkipped ? 'View/edit logged data' : undefined}
				>
					{#if isSkipped}
						<span class="text-black font-bold text-sm">!</span>
					{:else if isPast}
						<svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
							<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
						</svg>
					{:else if isCurrent}
						<span class="text-white font-bold text-sm">{index + 1}</span>
					{:else}
						<span class="text-slate-400 text-sm">{index + 1}</span>
					{/if}
				</button>

				<!-- Exercise info -->
				<div class="flex-1 min-w-0">
					<div class="flex items-center gap-2 mb-1">
						<span
							class="font-medium truncate
							{isPast ? 'line-through text-slate-400' : ''}
							{isSkipped ? 'text-yellow-400' : ''}
							{!isPast && !isSkipped ? 'text-white' : ''}"
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
								{@const subPrescription = formatSubExercisePrescription(subEx)}
								<div class="text-xs py-0.5 {isCurrentSub ? 'text-white font-medium' : 'text-slate-500'}">
									{#if isCurrentSub}
										<span class="text-green-400 mr-1">▸</span>
									{/if}
									{subEx.exerciseName}
									{#if subPrescription}
										<span class="{isCurrentSub ? 'text-slate-300' : 'text-slate-600'}">({subPrescription})</span>
									{/if}
								</div>
							{/each}
						</div>
					{/if}

					<!-- Progress indicator / Logged data -->
					{#if isSkipped}
						<div class="mt-1 text-xs text-yellow-400">
							{#if loggedData}
								{loggedData} - tap to edit
							{:else if exercise.completedSets > 0}
								{exercise.completedSets}/{exercise.prescription.sets} sets - tap to continue
							{:else}
								Skipped - tap to log
							{/if}
						</div>
					{:else if isPast && loggedData}
						<div class="mt-1 text-xs text-green-400">
							{loggedData}
						</div>
					{:else if getProgressText(exercise)}
						<div class="mt-1 text-xs {isPast ? 'text-green-400' : 'text-slate-500'}">
							{getProgressText(exercise)}
						</div>
					{/if}
				</div>

				<!-- Info button -->
				<button
					class="flex-shrink-0 w-8 h-8 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white flex items-center justify-center transition-colors ml-2"
					on:click|stopPropagation={() => dispatch('info', { exercise, index })}
					aria-label="Exercise info"
				>
					<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
						<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
					</svg>
				</button>
			</div>
		{/each}

		<!-- Finish workout button (only during active workout, not review mode) -->
		{#if currentIndex !== -1}
			<div class="p-4">
				<button
					class="w-full py-3 px-4 bg-green-600 hover:bg-green-500 active:bg-green-700 text-white font-medium rounded-lg transition-colors"
					on:click={() => dispatch('finish')}
				>
					Finish Workout & Review
				</button>
			</div>
		{/if}
	</div>
</div>
