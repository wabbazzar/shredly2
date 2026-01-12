<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { TimerPhase } from '$lib/engine/types';
	import { getPhaseColor } from '$lib/engine/timer-engine';

	export let phase: TimerPhase;
	export let hasNextExercise: boolean = true;

	const dispatch = createEventDispatcher<{
		start: void;
		pause: void;
		resume: void;
		skip: void;
		stop: void;
	}>();

	$: isPaused = phase === 'paused';
	$: isIdle = phase === 'idle';
	$: isComplete = phase === 'complete';
	$: isEntry = phase === 'entry';
	$: isRunning = !isPaused && !isIdle && !isComplete && !isEntry;
	$: phaseColorHex = getPhaseColor(phase);
</script>

<div
	class="flex items-center justify-center gap-3 py-2 px-3"
>
	<!-- Stop Button -->
	<button
		class="w-11 h-11 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors"
		on:click={() => dispatch('stop')}
		aria-label="Stop workout"
	>
		<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
			<rect x="6" y="6" width="12" height="12" rx="1" />
		</svg>
	</button>

	<!-- Main Action Button (Play/Pause) -->
	{#if isIdle}
		<button
			class="w-14 h-14 rounded-full bg-white/30 hover:bg-white/40 text-white flex items-center justify-center transition-colors"
			on:click={() => dispatch('start')}
			aria-label="Start timer"
		>
			<svg class="w-7 h-7 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
				<path d="M8 5v14l11-7z" />
			</svg>
		</button>
	{:else if isPaused}
		<button
			class="w-14 h-14 rounded-full bg-white/30 hover:bg-white/40 text-white flex items-center justify-center transition-colors"
			on:click={() => dispatch('resume')}
			aria-label="Resume timer"
		>
			<svg class="w-7 h-7 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
				<path d="M8 5v14l11-7z" />
			</svg>
		</button>
	{:else if isComplete}
		{#if hasNextExercise}
			<button
				class="w-14 h-14 rounded-full bg-white/30 hover:bg-white/40 text-white flex items-center justify-center transition-colors"
				on:click={() => dispatch('skip')}
				aria-label="Next exercise"
			>
				<svg class="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
					<path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" />
				</svg>
			</button>
		{:else}
			<button
				class="w-14 h-14 rounded-full bg-white/30 hover:bg-white/40 text-white flex items-center justify-center transition-colors"
				on:click={() => dispatch('stop')}
				aria-label="Finish workout"
			>
				<svg class="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
					<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
				</svg>
			</button>
		{/if}
	{:else if isEntry}
		<!-- No main button during entry - wait for data entry modal -->
		<div class="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
			<svg class="w-7 h-7 text-white/50" fill="currentColor" viewBox="0 0 24 24">
				<path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
			</svg>
		</div>
	{:else}
		<button
			class="w-14 h-14 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors"
			on:click={() => dispatch('pause')}
			aria-label="Pause timer"
		>
			<svg class="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
				<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
			</svg>
		</button>
	{/if}

	<!-- Skip/Next Button -->
	<button
		class="w-11 h-11 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
		on:click={() => dispatch('skip')}
		disabled={isIdle || isEntry}
		aria-label="Skip to next"
	>
		<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
			<path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
		</svg>
	</button>
</div>
