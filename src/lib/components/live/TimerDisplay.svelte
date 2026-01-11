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
	$: currentSubExercise = (() => {
		if (!currentExercise?.isCompoundParent || currentExercise.subExercises.length === 0) {
			return null;
		}
		return currentExercise.subExercises[timerState.currentSubExercise];
	})();

	// For AMRAP/Circuit, show all sub-exercises
	$: allSubExercises = currentExercise?.isCompoundParent
		? currentExercise.subExercises
		: [];

	// Exercise type badge color
	$: exerciseTypeColor = (() => {
		switch (timerState.exerciseType) {
			case 'emom': return 'bg-orange-500';
			case 'amrap': return 'bg-pink-500';
			case 'circuit': return 'bg-cyan-500';
			case 'interval': return 'bg-rose-500';
			default: return null;
		}
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

	<!-- Exercise Name with Type Badge -->
	{#if exerciseName}
		<div class="flex items-center gap-2 mb-2">
			{#if exerciseTypeColor}
				<span class="px-2 py-0.5 {exerciseTypeColor} text-white text-xs font-medium rounded uppercase">
					{timerState.exerciseType}
				</span>
			{/if}
			<span class="text-white text-2xl font-semibold text-center">
				{exerciseName}
			</span>
		</div>
	{/if}

	<!-- EMOM/Interval: Show current sub-exercise prominently -->
	{#if currentSubExercise && (timerState.exerciseType === 'emom' || timerState.exerciseType === 'interval')}
		<div class="bg-white/20 rounded-lg px-4 py-2 mb-2">
			<div class="text-white font-medium text-lg">
				{currentSubExercise.exerciseName}
			</div>
			{#if currentSubExercise.prescription.reps}
				<div class="text-white/80 text-sm">
					{currentSubExercise.prescription.reps} reps
				</div>
			{/if}
		</div>
	{/if}

	<!-- AMRAP/Circuit: Show all sub-exercises -->
	{#if (timerState.exerciseType === 'amrap' || timerState.exerciseType === 'circuit') && allSubExercises.length > 0}
		<div class="bg-white/10 rounded-lg px-4 py-2 mt-2 max-w-sm w-full">
			<div class="text-white/60 text-xs font-medium uppercase mb-1">Sub-exercises</div>
			{#each allSubExercises as subEx, idx}
				<div class="text-white text-sm py-0.5 {idx === timerState.currentSubExercise ? 'font-semibold' : 'opacity-70'}">
					{subEx.exerciseName}
					{#if subEx.prescription.reps}
						<span class="text-white/60 ml-1">x{subEx.prescription.reps}</span>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	<!-- Regular exercise prescription display -->
	{#if currentExercise && !currentExercise.isCompoundParent && timerState.phase !== 'idle'}
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
