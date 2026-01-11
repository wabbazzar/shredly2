<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { navigationStore } from '$lib/stores/navigation';
	import {
		liveSession,
		hasActiveSession,
		currentExercise,
		remainingExercises,
		sessionProgress,
		startWorkout,
		pauseWorkout,
		resumeWorkout,
		advanceToNextExercise,
		advanceToNextSet,
		endWorkout,
		clearSession,
		hasRecoverableSession,
		getTodaysWorkout,
		getWorkoutForDay,
		updateTimerState
	} from '$lib/stores/liveSession';
	import { activeSchedule, initializeScheduleStore } from '$lib/stores/schedule';
	import {
		TimerEngine,
		getTimerEngine,
		createInitialTimerState
	} from '$lib/engine/timer-engine';
	import type { TimerEvent, LiveExercise } from '$lib/engine/types';
	import TimerDisplay from '$lib/components/live/TimerDisplay.svelte';
	import TimerControls from '$lib/components/live/TimerControls.svelte';
	import ExerciseList from '$lib/components/live/ExerciseList.svelte';

	let timerEngine: TimerEngine;
	let unsubscribeTimer: (() => void) | null = null;

	// Local reactive state
	let timerState = createInitialTimerState();
	let showStartPrompt = false;
	let noScheduleMessage = '';

	onMount(async () => {
		navigationStore.setActiveTab('live');

		// Initialize timer engine
		timerEngine = getTimerEngine();
		unsubscribeTimer = timerEngine.subscribe(handleTimerEvent);

		// Initialize schedule store if needed
		await initializeScheduleStore();

		// Check for existing session
		if ($hasActiveSession && $currentExercise) {
			// Resume existing session
			timerEngine.initializeForExercise($currentExercise);
			timerState = timerEngine.getState();
		} else if ($activeSchedule) {
			// Check for today's workout
			const todaysWorkout = getTodaysWorkout($activeSchedule);
			if (todaysWorkout) {
				showStartPrompt = true;
			} else {
				noScheduleMessage = 'No workout scheduled for today';
			}
		} else {
			noScheduleMessage = 'No active schedule. Create one in the Schedule tab.';
		}
	});

	onDestroy(() => {
		if (unsubscribeTimer) {
			unsubscribeTimer();
		}
	});

	// Handle timer events
	function handleTimerEvent(event: TimerEvent) {
		timerState = event.state;
		updateTimerState(event.state);

		switch (event.type) {
			case 'set_complete':
				advanceToNextSet();
				break;
			case 'exercise_complete':
				// Stay on current exercise, wait for user to advance
				break;
		}
	}

	// Start today's workout
	function handleStartTodaysWorkout() {
		if (!$activeSchedule) return;

		const todaysWorkout = getTodaysWorkout($activeSchedule);
		if (!todaysWorkout) return;

		startWorkout($activeSchedule, todaysWorkout.weekNumber, todaysWorkout.dayNumber, todaysWorkout.day);
		showStartPrompt = false;

		// Initialize timer for first exercise
		if ($currentExercise) {
			timerEngine.initializeForExercise($currentExercise);
			timerState = timerEngine.getState();
		}
	}

	// Timer control handlers
	function handleStart() {
		if ($currentExercise) {
			timerEngine.initializeForExercise($currentExercise);
		}
		timerEngine.start();
	}

	function handlePause() {
		timerEngine.pause();
		pauseWorkout();
	}

	function handleResume() {
		timerEngine.resume();
		resumeWorkout();
	}

	function handleSkip() {
		if (timerState.phase === 'complete') {
			// Advance to next exercise
			const hasMore = advanceToNextExercise();
			if (hasMore && $currentExercise) {
				timerEngine.initializeForExercise($currentExercise);
				timerState = timerEngine.getState();
			}
		} else {
			// Skip current phase
			timerEngine.skip();
		}
	}

	function handleStop() {
		timerEngine.stop();
		const logs = endWorkout();
		// TODO: Save logs to history
		showStartPrompt = false;

		// Reset state
		timerState = createInitialTimerState();

		// Check if there's a workout for today again
		if ($activeSchedule) {
			const todaysWorkout = getTodaysWorkout($activeSchedule);
			if (todaysWorkout) {
				showStartPrompt = true;
			}
		}
	}

	// Exercise info handler
	function handleExerciseInfo(event: CustomEvent<{ exercise: LiveExercise; index: number }>) {
		// TODO: Show exercise info modal
		console.log('Exercise info:', event.detail);
	}

	// Check if there's a next exercise
	$: hasNextExercise = $liveSession
		? $liveSession.currentExerciseIndex < $liveSession.exercises.length - 1
		: false;
</script>

{#if $hasActiveSession && $liveSession}
	<!-- Active workout view -->
	<div class="flex flex-col h-full bg-slate-900">
		<!-- Timer Display (top half) -->
		<div class="flex-1 min-h-0" style="flex-basis: 50%;">
			<TimerDisplay
				{timerState}
				currentExercise={$currentExercise}
			/>
		</div>

		<!-- Exercise List (bottom half) -->
		<div class="flex-1 min-h-0 flex flex-col" style="flex-basis: 50%;">
			<ExerciseList
				exercises={$liveSession.exercises}
				currentIndex={$liveSession.currentExerciseIndex}
				on:info={handleExerciseInfo}
			/>

			<!-- Timer Controls -->
			<TimerControls
				phase={timerState.phase}
				{hasNextExercise}
				on:start={handleStart}
				on:pause={handlePause}
				on:resume={handleResume}
				on:skip={handleSkip}
				on:stop={handleStop}
			/>
		</div>
	</div>

{:else if showStartPrompt}
	<!-- Start workout prompt -->
	<div class="flex flex-col items-center justify-center h-full bg-slate-900 p-6">
		<svg
			class="w-20 h-20 mb-6 text-green-400"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="1.5"
				d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
			/>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="1.5"
				d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
			/>
		</svg>

		<h1 class="text-2xl font-bold text-white mb-2">Ready to Workout?</h1>

		{#if $activeSchedule}
			{@const todaysWorkout = getTodaysWorkout($activeSchedule)}
			{#if todaysWorkout}
				<p class="text-slate-400 text-center mb-6">
					Today's workout: <span class="text-white">{todaysWorkout.day.focus}</span>
					<br />
					<span class="text-sm">{todaysWorkout.day.exercises.length} exercises</span>
				</p>
			{/if}
		{/if}

		<button
			class="px-8 py-4 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-full text-lg transition-colors"
			on:click={handleStartTodaysWorkout}
		>
			Start Workout
		</button>

		<button
			class="mt-4 text-slate-400 hover:text-white transition-colors"
			on:click={() => (showStartPrompt = false)}
		>
			Not now
		</button>
	</div>

{:else}
	<!-- No workout / empty state -->
	<div class="flex flex-col items-center justify-center h-full bg-slate-900">
		<svg
			class="w-24 h-24 mb-6 text-indigo-400"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="1.5"
				d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
			/>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="1.5"
				d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
			/>
		</svg>
		<h1 class="text-3xl font-bold text-white mb-3">Live</h1>
		<p class="text-slate-400 text-center px-8 max-w-sm">
			{noScheduleMessage || 'Active workout execution with timer will appear here'}
		</p>

		{#if $activeSchedule}
			<button
				class="mt-6 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors"
				on:click={() => (showStartPrompt = true)}
			>
				Browse Workouts
			</button>
		{/if}
	</div>
{/if}
