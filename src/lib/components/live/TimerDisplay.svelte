<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { TimerState, TimerPhase, LiveExercise, WeightPrescription, PreviousWeekPerformance } from '$lib/engine/types';
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

	// Format weight prescription for display
	function formatWeightPrescription(prescription: WeightPrescription | null): string | null {
		if (!prescription) return null;

		switch (prescription.type) {
			case 'qualitative':
				// Capitalize first letter: "heavy" -> "Heavy"
				const val = String(prescription.value);
				return val.charAt(0).toUpperCase() + val.slice(1);
			case 'percent_tm':
				return `${prescription.value}% TM`;
			case 'absolute':
				return `${prescription.value} ${prescription.unit || 'lbs'}`;
			default:
				return null;
		}
	}

	// Format previous week weight for compact display
	function formatPreviousWeek(prev: PreviousWeekPerformance | null): string | null {
		if (!prev || prev.weight === null) return null;
		let text = `${prev.weight}${prev.weightUnit || 'lbs'}`;
		if (prev.rpe) {
			text += ` @${prev.rpe}`;
		}
		return text;
	}

	// Reactive time display
	$: timeDisplay = formatTimeDisplay(timerState.remainingSeconds);
	$: phaseLabel = phaseLabels[timerState.phase] || 'READY';
	$: phaseColor = phaseColorClasses[timerState.phase] || 'bg-slate-700';
	$: phaseColorHex = getPhaseColor(timerState.phase);

	// Set counter display
	// During rest phase, show NEXT set number (anticipating what's coming)
	$: setDisplay = (() => {
		if (timerState.exerciseType === 'emom' || timerState.exerciseType === 'amrap') {
			return `Minute ${timerState.currentMinute} of ${timerState.totalMinutes}`;
		}
		if (timerState.totalSets > 1) {
			// During rest, display the upcoming set number (e.g., after set 1 work, show "Set 2 of 5")
			const displaySet = timerState.phase === 'rest'
				? Math.min(timerState.currentSet + 1, timerState.totalSets)
				: timerState.currentSet;
			return `Set ${displaySet} of ${timerState.totalSets}`;
		}
		return '';
	})();

	// Exercise name
	$: exerciseName = currentExercise?.exerciseName || '';

	// Weight prescription display
	$: weightPrescriptionText = formatWeightPrescription(currentExercise?.prescription.weightPrescription ?? null);
	$: previousWeekText = formatPreviousWeek(currentExercise?.prescription.previousWeek ?? null);

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
	class="flex flex-col items-center justify-center px-3 py-2"
>
	<!-- Phase Label -->
	<div class="text-white/80 text-sm font-medium tracking-wider mb-1">
		{phaseLabel}
	</div>

	<!-- Timer Display -->
	<div class="text-white text-5xl sm:text-6xl font-mono font-bold tracking-tight mb-1">
		{timeDisplay}
	</div>

	<!-- Set Counter -->
	{#if setDisplay}
		<div class="text-white/90 text-base font-medium mb-1">
			{setDisplay}
		</div>
	{/if}

	<!-- Exercise Name with Type Badge -->
	{#if exerciseName}
		<div class="flex flex-wrap items-center justify-center gap-1.5 mb-1 max-w-full px-2">
			{#if exerciseTypeColor}
				<span class="px-1.5 py-0.5 {exerciseTypeColor} text-white text-[10px] font-medium rounded uppercase flex-shrink-0">
					{timerState.exerciseType}
				</span>
			{/if}
			<span class="text-white text-lg font-semibold text-center break-words">
				{exerciseName}
			</span>
		</div>
	{/if}

	<!-- EMOM/Interval: Show current sub-exercise prominently -->
	{#if currentSubExercise && (timerState.exerciseType === 'emom' || timerState.exerciseType === 'interval')}
		{@const subWeightText = formatWeightPrescription(currentSubExercise.prescription.weightPrescription ?? null)}
		{@const subPrevText = formatPreviousWeek(currentSubExercise.prescription.previousWeek ?? null)}
		<div class="bg-white/20 rounded-lg px-3 py-1.5 mb-1 max-w-full">
			<div class="text-white font-medium text-base truncate">
				{currentSubExercise.exerciseName}
			</div>
			<!-- Reps and weight info -->
			<div class="flex items-center gap-1.5 text-white/80 text-xs flex-wrap justify-center">
				{#if currentSubExercise.prescription.reps}
					<span>{currentSubExercise.prescription.reps} reps</span>
				{/if}
				{#if subWeightText}
					<span class="px-1 py-0.5 bg-white/20 rounded font-medium">{subWeightText}</span>
				{/if}
				{#if currentSubExercise.prescription.weight}
					<span class="text-white/60">
						({currentSubExercise.prescription.weight}{currentSubExercise.prescription.weightUnit || 'lbs'})
					</span>
				{/if}
			</div>
			{#if subPrevText}
				<div class="text-white/50 text-[10px] flex items-center justify-center gap-1 mt-0.5">
					<svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<span>Last: {subPrevText}</span>
				</div>
			{/if}
		</div>
	{/if}

	<!-- AMRAP/Circuit: Show all sub-exercises -->
	{#if (timerState.exerciseType === 'amrap' || timerState.exerciseType === 'circuit') && allSubExercises.length > 0}
		<div class="bg-white/10 rounded-lg px-3 py-1.5 mt-1 w-full max-w-xs">
			<div class="text-white/60 text-[10px] font-medium uppercase mb-0.5">Sub-exercises</div>
			{#each allSubExercises as subEx, idx}
				{@const subWeightText = formatWeightPrescription(subEx.prescription.weightPrescription ?? null)}
				{@const subWeight = subEx.prescription.weight}
				{@const subUnit = subEx.prescription.weightUnit || 'lbs'}
				<!-- Circuit: show all equal (self-paced), AMRAP: highlight current -->
				<div class="text-white text-xs leading-tight py-0.5 {timerState.exerciseType === 'circuit' ? '' : (idx === timerState.currentSubExercise ? 'font-semibold' : 'opacity-70')}">
					<span class="truncate">{subEx.exerciseName}</span>
					<span class="text-white/60 ml-1">
						{#if subEx.prescription.reps}x{subEx.prescription.reps}{/if}
						{#if subWeightText}
							<span class="ml-1 px-1 py-0.5 bg-white/20 rounded">{subWeightText}</span>
						{/if}
						{#if subWeight}
							<span class="ml-1">({subWeight}{subUnit})</span>
						{/if}
					</span>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Weight Prescription Badge (for non-compound exercises) -->
	{#if currentExercise && !currentExercise.isCompoundParent && (weightPrescriptionText || previousWeekText)}
		<div class="mt-1.5 flex flex-col items-center gap-0.5">
			<!-- Prescription + Reps row -->
			<div class="flex items-center gap-1.5 text-white/90 text-xs">
				{#if currentExercise.prescription.reps}
					<span class="font-medium">{currentExercise.prescription.reps} reps</span>
				{/if}
				{#if weightPrescriptionText}
					<span class="px-1.5 py-0.5 bg-white/20 rounded font-medium">
						{weightPrescriptionText}
					</span>
				{/if}
				{#if currentExercise.prescription.weight}
					<span class="text-white/70">
						({currentExercise.prescription.weight}{currentExercise.prescription.weightUnit || 'lbs'})
					</span>
				{/if}
			</div>
			<!-- Previous week row -->
			{#if previousWeekText}
				<div class="text-white/60 text-[10px] flex items-center gap-1">
					<svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<span>Last: {previousWeekText}</span>
				</div>
			{/if}
		</div>
	{:else if currentExercise && !currentExercise.isCompoundParent && timerState.phase !== 'idle'}
		<!-- Fallback: show basic prescription if no weight prescription data -->
		<div class="mt-1.5 text-white/70 text-xs flex gap-2">
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
