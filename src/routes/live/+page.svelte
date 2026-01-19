<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { navigationStore } from '$lib/stores/navigation';
	import {
		liveSession,
		hasActiveSession,
		isWorkoutComplete,
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
		updateTimerState,
		logCompletedSet,
		skipToExercise,
		getExerciseLog,
		updateExerciseLogs,
		logSubExerciseWeights,
		reconstructSessionFromHistory
	} from '$lib/stores/liveSession';
	import { activeSchedule } from '$lib/stores/schedule';
	import { logSessionToHistory, getTodaysHistoryForWorkout } from '$lib/stores/history';
	import { updateCacheForExercise } from '$lib/stores/oneRMCache';
	import {
		TimerEngine,
		getTimerEngine,
		createInitialTimerState,
		getPhaseColor
	} from '$lib/engine/timer-engine';
	import { getAudioManager } from '$lib/utils/audioManager';
	import type { TimerEvent, LiveExercise, SetLog } from '$lib/engine/types';
	import TimerDisplay from '$lib/components/live/TimerDisplay.svelte';
	import TimerControls from '$lib/components/live/TimerControls.svelte';
	import ExerciseList from '$lib/components/live/ExerciseList.svelte';
	import ExerciseDescription from '$lib/components/live/ExerciseDescription.svelte';
	import DataEntryModal from '$lib/components/live/DataEntryModal.svelte';
	import ExerciseInfoModal from '$lib/components/live/ExerciseInfoModal.svelte';
	import SetReviewModal from '$lib/components/live/SetReviewModal.svelte';
	import type { ExerciseLog } from '$lib/engine/types';

	let timerEngine: TimerEngine;
	let unsubscribeTimer: (() => void) | null = null;
	let audioManager: ReturnType<typeof getAudioManager>;

	// Local reactive state
	let timerState = createInitialTimerState();
	let showStartPrompt = false;
	let noScheduleMessage = '';
	let isReady = false; // Defers heavy work until after first paint
	let isHistoryReviewMode = false; // True when showing previously logged workout

	// Modal state
	let showDataEntry = false;
	let dataEntryExercise: LiveExercise | null = null;
	let dataEntrySetNumber = 1;
	let showExerciseInfo = false;
	let exerciseInfoExercise: LiveExercise | null = null;

	// Review modal state (for viewing/editing completed exercises)
	let showReviewModal = false;
	let reviewExercise: LiveExercise | null = null;
	let reviewExerciseIndex: number | null = null;
	let reviewExistingLog: ExerciseLog | null = null;
	let reviewSubExerciseLogs: Map<string, ExerciseLog> = new Map();

	// Build exercise logs map for ExerciseList
	$: exerciseLogs = buildExerciseLogsMap($liveSession);

	function buildExerciseLogsMap(session: typeof $liveSession): Map<number, ExerciseLog> {
		const map = new Map<number, ExerciseLog>();
		if (!session) return map;

		for (const log of session.logs) {
			map.set(log.exerciseOrder, log);
		}
		return map;
	}

	onMount(() => {
		// Note: setActiveTab is handled by BottomTabBar.navigateToTab() - no duplicate call needed

		// Defer heavy initialization until after first paint for smoother transitions
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				// Initialize audio manager
				audioManager = getAudioManager();

				// Initialize timer engine
				timerEngine = getTimerEngine();
				unsubscribeTimer = timerEngine.subscribe(handleTimerEvent);

				// Check for existing session
				if ($hasActiveSession && $currentExercise) {
					// Resume existing session
					timerEngine.initializeForExercise($currentExercise);
					timerState = timerEngine.getState();
				} else if ($activeSchedule) {
					// Check for today's workout
					const todaysWorkout = getTodaysWorkout($activeSchedule);
					if (todaysWorkout) {
						// Check if user has already logged exercises for today's workout
						const historyRows = getTodaysHistoryForWorkout(
							$activeSchedule.id,
							todaysWorkout.weekNumber,
							todaysWorkout.dayNumber
						);

						if (historyRows && historyRows.length > 0) {
							// Reconstruct session from history for review mode
							const reconstructedSession = reconstructSessionFromHistory(
								$activeSchedule,
								todaysWorkout.weekNumber,
								todaysWorkout.dayNumber,
								historyRows
							);
							liveSession.set(reconstructedSession);
							isHistoryReviewMode = true;
						} else {
							showStartPrompt = true;
						}
					} else {
						noScheduleMessage = 'No workout scheduled for today';
					}
				} else {
					noScheduleMessage = 'No active schedule. Create one in the Schedule tab.';
				}

				isReady = true;
			});
		});
	});

	// Initialize audio on first user interaction
	async function initializeAudio() {
		if (audioManager) {
			await audioManager.initialize();
		}
	}

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
			case 'countdown_tick':
				// Play countdown beep
				if (event.countdownValue) {
					audioManager?.playCountdown(event.countdownValue);
				}
				break;

			case 'set_complete':
				advanceToNextSet();
				audioManager?.playWorkComplete();
				break;

			case 'minute_marker':
				audioManager?.playMinuteMarker();
				break;

			case 'work_phase_complete':
				// Play work phase completion chime (for interval work->rest transitions)
				audioManager?.playMinuteMarker();
				break;

			case 'exercise_complete':
				audioManager?.playExerciseComplete();
				// Auto-advance to next exercise
				const hasMoreExercises = advanceToNextExercise();
				if (hasMoreExercises && $currentExercise) {
					// Initialize timer for next exercise and auto-start
					timerEngine.initializeForExercise($currentExercise);
					timerState = timerEngine.getState();
					// Small delay before starting next exercise
					setTimeout(() => {
						timerEngine.start();
					}, 500);
				} else {
					// Workout complete
					audioManager?.playSessionComplete();
					handleStop();
				}
				break;

			case 'phase_change':
				// Show data entry modal when entering entry phase
				if (event.state.phase === 'entry' && $currentExercise) {
					dataEntryExercise = $currentExercise;
					dataEntrySetNumber = event.state.currentSet;
					showDataEntry = true;
				}
				break;
		}
	}

	// Start today's workout
	async function handleStartTodaysWorkout() {
		if (!$activeSchedule) return;

		// Initialize audio on first user gesture
		await initializeAudio();

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
	async function handleStart() {
		// Initialize audio on first user gesture
		await initializeAudio();

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
		const result = endWorkout();

		// Save logs to history if session had data
		if (result && result.logs.length > 0 && $liveSession) {
			logSessionToHistory(
				$liveSession.scheduleId,
				$liveSession.weekNumber,
				$liveSession.dayNumber,
				result.logs
			);
			audioManager?.playSessionComplete();

			// Update 1RM cache for all logged exercises
			// Use Set to deduplicate exercise names (including sub-exercises)
			const exerciseNames = new Set<string>();
			for (const log of result.logs) {
				if (!log.isCompoundParent) {
					exerciseNames.add(log.exerciseName);
				}
			}
			for (const name of exerciseNames) {
				updateCacheForExercise(name);
			}
		}

		// Reset timer state but keep session for review
		timerState = createInitialTimerState();
	}

	// Start a new workout (clears completed session first)
	function handleStartNewWorkout() {
		clearSession();
		showStartPrompt = false;
		isHistoryReviewMode = false;

		// Check if there's a workout for today
		if ($activeSchedule) {
			const todaysWorkout = getTodaysWorkout($activeSchedule);
			if (todaysWorkout) {
				showStartPrompt = true;
			} else {
				noScheduleMessage = 'No workout scheduled for today';
			}
		}
	}

	// Done with workout - clear session and return to start prompt
	function handleDone() {
		clearSession();
		isHistoryReviewMode = false;

		// Go back to start prompt if there's a workout for today
		if ($activeSchedule) {
			const todaysWorkout = getTodaysWorkout($activeSchedule);
			if (todaysWorkout) {
				showStartPrompt = true;
				noScheduleMessage = '';
				return;
			}
		}
		noScheduleMessage = 'No workout scheduled for today';
	}

	// Exercise info handler
	function handleExerciseInfo(event: CustomEvent<{ exercise: LiveExercise; index: number }>) {
		exerciseInfoExercise = event.detail.exercise;
		showExerciseInfo = true;
	}

	// Handle clicking on a future exercise to skip to it
	function handleExerciseSelect(event: CustomEvent<{ exercise: LiveExercise; index: number }>) {
		const { exercise, index } = event.detail;

		// Stop the current timer
		timerEngine.stop();

		// Skip to the selected exercise
		const skipped = skipToExercise(index);

		if (skipped && $currentExercise) {
			// Initialize timer for the new current exercise
			timerEngine.initializeForExercise($currentExercise);
			timerState = timerEngine.getState();
		}
	}

	// Handle clicking on a completed/skipped exercise to review/edit data
	function handleExerciseReview(event: CustomEvent<{ exercise: LiveExercise; index: number }>) {
		const { exercise, index } = event.detail;

		// Get existing log data
		const existingLog = getExerciseLog(index);

		// Get sub-exercise logs for compound blocks
		reviewSubExerciseLogs = new Map();
		if (exercise.isCompoundParent && exercise.subExercises && $liveSession) {
			for (const subEx of exercise.subExercises) {
				const subLog = $liveSession.logs.find(
					l => l.exerciseName === subEx.exerciseName && l.compoundParentName === exercise.exerciseName
				);
				if (subLog) {
					reviewSubExerciseLogs.set(subEx.exerciseName, subLog);
				}
			}
		}

		reviewExercise = exercise;
		reviewExerciseIndex = index;
		reviewExistingLog = existingLog;
		showReviewModal = true;
	}

	// Sub-exercise weight type (matches DataEntryModal/SetReviewModal)
	interface SubExerciseWeight {
		name: string;
		weight: string;
		weightUnit: 'lbs' | 'kg';
		showWeight: boolean;
	}

	// Data entry modal handlers (for live timer flow)
	function handleDataEntrySubmit(event: CustomEvent<{
		setLog: SetLog;
		totalRounds?: number;
		totalTime?: number;
		subExerciseWeights?: SubExerciseWeight[];
	}>) {
		const { setLog, totalRounds, totalTime, subExerciseWeights } = event.detail;

		if (dataEntryExercise) {
			// Normal logging for current exercise during timer flow
			logCompletedSet(setLog, totalRounds, totalTime);

			// Log sub-exercise weights as separate ExerciseLog entries
			if (subExerciseWeights && subExerciseWeights.length > 0 && $liveSession) {
				logSubExerciseWeights(
					$liveSession.currentExerciseIndex,
					dataEntryExercise.exerciseName,
					subExerciseWeights
				);
			}

			// Close modal and continue
			showDataEntry = false;
			dataEntryExercise = null;

			// Tell timer engine to exit data entry mode
			timerEngine.exitDataEntry();
		}
	}

	function handleDataEntryCancel() {
		// Skip logging, just close modal
		showDataEntry = false;
		dataEntryExercise = null;

		// Tell timer engine to exit data entry mode
		timerEngine.exitDataEntry();
	}

	// Review modal handlers (for viewing/editing any exercise)
	function handleReviewSave(event: CustomEvent<{
		sets: SetLog[];
		totalRounds?: number;
		totalTime?: number;
		subExerciseWeights?: SubExerciseWeight[];
	}>) {
		const { sets, totalRounds, totalTime, subExerciseWeights } = event.detail;

		if (reviewExerciseIndex !== null && reviewExercise && $liveSession) {
			updateExerciseLogs(reviewExerciseIndex, sets, totalRounds, totalTime);

			// Also update sub-exercise weights in session logs (so they persist when modal reopens)
			// Use replaceExisting=true to replace existing data rather than appending
			if (subExerciseWeights && subExerciseWeights.length > 0) {
				logSubExerciseWeights(reviewExerciseIndex, reviewExercise.exerciseName, subExerciseWeights, true);
			}

			// Also log to history and update 1RM cache (for review mode edits)
			const exerciseLog = {
				exerciseName: reviewExercise.exerciseName,
				exerciseOrder: reviewExerciseIndex,
				isCompoundParent: reviewExercise.isCompoundParent,
				compoundParentName: null,
				sets,
				totalRounds,
				totalTime,
				timestamp: new Date().toISOString()
			};

			// Build array of logs including sub-exercises
			const logsToSave = [exerciseLog];

			// Create sub-exercise logs if weights were entered
			if (subExerciseWeights && subExerciseWeights.length > 0) {
				const now = new Date().toISOString();
				for (const subEx of subExerciseWeights) {
					if (!subEx.weight || !subEx.showWeight) continue;
					const weight = parseFloat(subEx.weight);
					if (isNaN(weight) || weight <= 0) continue;

					// Find the sub-exercise prescription for reps
					const subExercise = reviewExercise.subExercises?.find(s => s.exerciseName === subEx.name);
					const reps = subExercise?.prescription.reps ?? null;

					logsToSave.push({
						exerciseName: subEx.name,
						exerciseOrder: reviewExerciseIndex,
						isCompoundParent: false,
						compoundParentName: reviewExercise.exerciseName,
						sets: [{
							setNumber: 1,
							reps,
							weight,
							weightUnit: subEx.weightUnit,
							workTime: null,
							rpe: null,
							rir: null,
							completed: true,
							notes: null,
							timestamp: now
						}],
						timestamp: now
					});
				}
			}

			// Log to history
			logSessionToHistory(
				$liveSession.scheduleId,
				$liveSession.weekNumber,
				$liveSession.dayNumber,
				logsToSave
			);

			// Update 1RM cache for this exercise (and sub-exercises if compound)
			if (!reviewExercise.isCompoundParent) {
				updateCacheForExercise(reviewExercise.exerciseName);
			} else if (reviewExercise.subExercises) {
				for (const sub of reviewExercise.subExercises) {
					updateCacheForExercise(sub.exerciseName);
				}
			}
		}

		showReviewModal = false;
		reviewExercise = null;
		reviewExerciseIndex = null;
		reviewExistingLog = null;
		reviewSubExerciseLogs = new Map();
	}

	function handleReviewClose() {
		showReviewModal = false;
		reviewExercise = null;
		reviewExerciseIndex = null;
		reviewExistingLog = null;
		reviewSubExerciseLogs = new Map();
	}

	function handleExerciseInfoClose() {
		showExerciseInfo = false;
		exerciseInfoExercise = null;
	}

	// Check if there's a next exercise
	$: hasNextExercise = $liveSession
		? $liveSession.currentExerciseIndex < $liveSession.exercises.length - 1
		: false;
</script>

{#if $hasActiveSession && $liveSession}
	<!-- Active workout view - calc height accounts for 4rem nav bar + safe area -->
	<!-- Mobile: stacked (col), Desktop: side-by-side (row) -->
	<div class="flex flex-col lg:flex-row bg-slate-900" style="height: calc(100dvh - 4rem - env(safe-area-inset-bottom, 0px))">
		{#if $isWorkoutComplete}
			<!-- Workout Complete - Full width review mode -->
			<div class="flex-1 min-h-0 flex flex-col">
				<!-- Completion Header -->
				<div class="{isHistoryReviewMode ? 'bg-indigo-900/50 border-indigo-700' : 'bg-green-900/50 border-green-700'} border-b p-4">
					<div class="flex items-center justify-between max-w-4xl mx-auto">
						<div class="flex items-center gap-3">
							<svg class="w-8 h-8 {isHistoryReviewMode ? 'text-indigo-400' : 'text-green-400'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								{#if isHistoryReviewMode}
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
								{:else}
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
								{/if}
							</svg>
							<div>
								<h2 class="text-lg font-semibold text-white">
									{isHistoryReviewMode ? 'Previous Workout' : 'Workout Complete!'}
								</h2>
								<p class="text-sm {isHistoryReviewMode ? 'text-indigo-300' : 'text-green-300'}">
									{isHistoryReviewMode
										? 'Review or edit your logged data from earlier today'
										: 'Tap any exercise to review or edit your data'}
								</p>
							</div>
						</div>
						{#if isHistoryReviewMode}
							<button
								class="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg transition-colors"
								on:click={handleStartNewWorkout}
							>
								Start New Workout
							</button>
						{:else}
							<button
								class="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg transition-colors"
								on:click={handleDone}
							>
								Done
							</button>
						{/if}
					</div>
				</div>

				<!-- Exercise List for Review -->
				<div class="flex-1 min-h-0 overflow-auto">
					<ExerciseList
						exercises={$liveSession.exercises}
						currentIndex={-1}
						currentSubExerciseIndex={null}
						{exerciseLogs}
						on:info={handleExerciseInfo}
						on:select={handleExerciseSelect}
						on:review={handleExerciseReview}
					/>
				</div>
			</div>
		{:else}
			<!-- Timer Side (left on desktop, top on mobile) -->
			<div class="flex-1 min-h-0 flex flex-col lg:w-1/2 lg:flex-none" style="flex-basis: 50%;">
				<!-- Timer + Controls: centered vertically together -->
				<div class="flex-1 min-h-0 flex flex-col items-center justify-center" style="background-color: {getPhaseColor(timerState.phase)}">
					<TimerDisplay
						{timerState}
						currentExercise={$currentExercise}
					/>
					<div class="mt-4">
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
				<!-- Exercise Description (desktop only, anchored to bottom) -->
				<div class="hidden lg:block flex-shrink-0">
					<ExerciseDescription
						currentExercise={$currentExercise}
						{timerState}
						phaseColor={getPhaseColor(timerState.phase)}
					/>
				</div>
			</div>

			<!-- Exercise List (right on desktop, bottom on mobile) -->
			<div class="flex-1 min-h-0 flex flex-col lg:w-1/2 lg:flex-none" style="flex-basis: 50%;">
				<ExerciseList
					exercises={$liveSession.exercises}
					currentIndex={$liveSession.currentExerciseIndex}
					currentSubExerciseIndex={timerState.currentSubExercise}
					{exerciseLogs}
					on:info={handleExerciseInfo}
					on:select={handleExerciseSelect}
					on:review={handleExerciseReview}
					on:finish={handleStop}
				/>
			</div>
		{/if}
	</div>

{:else if showStartPrompt}
	<!-- Start workout prompt - calc height accounts for nav bar -->
	<div class="flex flex-col items-center justify-center bg-slate-900 p-6" style="height: calc(100dvh - 4rem - env(safe-area-inset-bottom, 0px))">
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
	<!-- No workout / empty state - calc height accounts for nav bar -->
	<div class="flex flex-col items-center justify-center bg-slate-900" style="height: calc(100dvh - 4rem - env(safe-area-inset-bottom, 0px))">
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

<!-- Data Entry Modal -->
{#if showDataEntry && dataEntryExercise}
	<DataEntryModal
		exercise={dataEntryExercise}
		setNumber={dataEntrySetNumber}
		isCompoundBlock={dataEntryExercise.isCompoundParent}
		on:submit={handleDataEntrySubmit}
		on:cancel={handleDataEntryCancel}
	/>
{/if}

<!-- Exercise Info Modal -->
{#if showExerciseInfo && exerciseInfoExercise}
	<ExerciseInfoModal
		exercise={exerciseInfoExercise}
		on:close={handleExerciseInfoClose}
	/>
{/if}

<!-- Set Review Modal (for viewing/editing logged data) -->
{#if showReviewModal && reviewExercise && reviewExerciseIndex !== null}
	<SetReviewModal
		exercise={reviewExercise}
		exerciseIndex={reviewExerciseIndex}
		existingLog={reviewExistingLog}
		subExerciseLogs={reviewSubExerciseLogs}
		on:save={handleReviewSave}
		on:close={handleReviewClose}
	/>
{/if}
