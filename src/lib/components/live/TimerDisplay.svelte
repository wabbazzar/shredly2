<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { TimerState, TimerPhase, LiveExercise } from '$lib/engine/types';
	import { formatTimeDisplay, getPhaseColor } from '$lib/engine/timer-engine';

	export let timerState: TimerState;
	export let currentExercise: LiveExercise | null = null;

	// Phase display labels
	const phaseLabels: Record<TimerPhase, string> = {
		idle: 'READY',
		work: 'WORKING',
		rest: 'RESTING',
		countdown: 'GET READY',
		complete: 'COMPLETE',
		paused: 'PAUSED',
		entry: 'LOG SET'
	};

	// Phase color classes (Tailwind)
	const phaseColorClasses: Record<TimerPhase, string> = {
		idle: 'bg-slate-700',
		work: 'bg-green-600',
		rest: 'bg-blue-600',
		countdown: 'bg-yellow-500',
		complete: 'bg-purple-600',
		paused: 'bg-slate-600',
		entry: 'bg-amber-500'
	};

	// Reactive time display
	$: timeDisplay = formatTimeDisplay(timerState.remainingSeconds);
	$: phaseLabel = phaseLabels[timerState.phase] || 'READY';
	$: phaseColor = phaseColorClasses[timerState.phase] || 'bg-slate-700';
	$: phaseColorHex = getPhaseColor(timerState.phase);

	// Set counter display
	$: setDisplay = (() => {
		if (timerState.exerciseType === 'emom' || timerState.exerciseType === 'amrap') {
			return `Minute ${timerState.currentMinute} of ${timerState.totalMinutes}`;
		}
		if (timerState.totalSets > 1) {
			return `Set ${timerState.currentSet} of ${timerState.totalSets}`;
		}
		return '';
	})();

	// Exercise name
	$: exerciseName = currentExercise?.exerciseName || '';

	// Sub-exercise display for compound blocks
	$: subExerciseDisplay = (() => {
		if (!currentExercise?.isCompoundParent || currentExercise.subExercises.length === 0) {
			return null;
		}
		const subEx = currentExercise.subExercises[timerState.currentSubExercise];
		return subEx?.exerciseName || null;
	})();
</script>

<div
	class="flex flex-col items-center justify-center h-full {phaseColor} transition-colors duration-300"
	style="background-color: {phaseColorHex}"
>
	<!-- Phase Label -->
	<div class="text-white/80 text-lg font-medium tracking-wider mb-2">
		{phaseLabel}
	</div>

	<!-- Timer Display -->
	<div class="text-white text-7xl sm:text-8xl font-mono font-bold tracking-tight mb-4">
		{timeDisplay}
	</div>

	<!-- Set Counter -->
	{#if setDisplay}
		<div class="text-white/90 text-xl font-medium mb-4">
			{setDisplay}
		</div>
	{/if}

	<!-- Exercise Name -->
	{#if exerciseName}
		<div class="text-white text-2xl font-semibold text-center px-4 mb-2">
			{exerciseName}
		</div>
	{/if}

	<!-- Sub-exercise Name (for compound blocks) -->
	{#if subExerciseDisplay}
		<div class="text-white/80 text-lg font-medium text-center px-4">
			{subExerciseDisplay}
		</div>
	{/if}

	<!-- Prescription display -->
	{#if currentExercise && timerState.phase !== 'idle'}
		<div class="mt-4 text-white/70 text-sm flex gap-4">
			{#if currentExercise.prescription.reps}
				<span>{currentExercise.prescription.reps} reps</span>
			{/if}
			{#if currentExercise.prescription.weight}
				<span>
					{currentExercise.prescription.weight}
					{currentExercise.prescription.weightUnit || 'lbs'}
				</span>
			{/if}
		</div>
	{/if}
</div>
