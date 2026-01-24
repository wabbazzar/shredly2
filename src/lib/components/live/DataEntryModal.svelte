<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { LiveExercise, SetLog } from '$lib/engine/types';
	import { shouldShowWeightField, getExerciseMetadata, getDefaultWorkMode } from '$lib/engine/exercise-metadata';
	import { keyboardAware } from '$lib/actions/keyboardAware';

	export let exercise: LiveExercise;
	export let setNumber: number;
	export let isCompoundBlock = false;
	export let totalRounds: number | null = null;
	export let totalTime: number | null = null;

	// Sub-exercise data entry type (includes both reps/time AND weight)
	interface SubExerciseData {
		name: string;
		reps: string;
		weight: string;
		weightUnit: 'lbs' | 'kg';
		workMode: 'reps' | 'work_time';
		showWeight: boolean;
	}

	// Legacy type for dispatch (for backward compatibility with liveSession logging)
	interface SubExerciseWeight {
		name: string;
		reps: number | null;
		weight: string;
		weightUnit: 'lbs' | 'kg';
		showWeight: boolean;
	}

	const dispatch = createEventDispatcher<{
		submit: { setLog: SetLog; totalRounds?: number; totalTime?: number; subExerciseWeights?: SubExerciseWeight[] };
		cancel: void;
	}>();

	// Form state for regular exercises
	let reps: string = exercise.prescription.reps?.toString() ?? '';
	let weight: string = exercise.prescription.weight?.toString() ?? '';
	let weightUnit: 'lbs' | 'kg' = exercise.prescription.weightUnit ?? 'lbs';
	let rpe: string = '';
	let roundsInput: string = totalRounds?.toString() ?? '';
	let timeInput: string = totalTime ? formatTimeInput(totalTime) : '';

	// Sub-exercise data state (for compound blocks - tracks reps/time AND weight per sub-exercise)
	let subExerciseData: SubExerciseData[] = [];

	// Expandable sections
	let showRpeSection = false;

	// Initialize sub-exercise data if this is a compound block (EMOM/Interval/AMRAP/Circuit)
	$: if (isCompoundBlock && exercise.subExercises.length > 0) {
		subExerciseData = exercise.subExercises.map(subEx => {
			const metadata = getExerciseMetadata(subEx.exerciseName);
			const showSubWeight = metadata?.external_load !== 'never';
			const workMode = getDefaultWorkMode(subEx.exerciseName);

			// For time-based mode, use prescription workTimeSeconds or default
			let repsValue = '';
			if (workMode === 'work_time') {
				const seconds = subEx.prescription.workTimeSeconds ?? 30;
				repsValue = formatTimeInput(seconds);
			} else {
				repsValue = subEx.prescription.reps?.toString() ?? '';
			}

			return {
				name: subEx.exerciseName,
				reps: repsValue,
				weight: subEx.prescription.weight?.toString() ?? '',
				weightUnit: subEx.prescription.weightUnit ?? 'lbs',
				workMode,
				showWeight: showSubWeight
			};
		});
	}

	// Check if any sub-exercises have weight fields to show
	$: hasSubExerciseWeights = isCompoundBlock && subExerciseData.some(s => s.showWeight);

	// Check if we need to show sub-exercise performance inputs (EMOM/Interval)
	$: showSubExercisePerformance = isCompoundBlock && (exercise.exerciseType === 'emom' || exercise.exerciseType === 'interval');

	// Determine which fields to show
	// Compound blocks don't have their own weight - only sub-exercises do
	$: showWeight = !isCompoundBlock && shouldShowWeightField(exercise.exerciseName, null);
	$: showReps = !isCompoundBlock;
	$: showRounds = isCompoundBlock && exercise.exerciseType === 'amrap';
	$: showTime = isCompoundBlock && exercise.exerciseType === 'circuit';

	function formatTimeInput(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	function parseTimeInput(value: string): number | null {
		// Try MM:SS format
		const match = value.match(/^(\d+):(\d{1,2})$/);
		if (match) {
			return parseInt(match[1]) * 60 + parseInt(match[2]);
		}
		// Try seconds only
		const secs = parseInt(value);
		if (!isNaN(secs)) {
			return secs;
		}
		return null;
	}

	function handleSubmit() {
		const setLog: SetLog = {
			setNumber,
			reps: reps ? parseInt(reps) : null,
			weight: weight ? parseFloat(weight) : null,
			weightUnit: showWeight && weight ? weightUnit : null,
			workTime: showTime ? parseTimeInput(timeInput) : null,
			rpe: rpe ? parseInt(rpe) : null,
			rir: null,
			completed: true,
			notes: null,
			timestamp: new Date().toISOString()
		};

		// Convert subExerciseData to SubExerciseWeight format for logging
		// This includes reps per sub-exercise (not per block)
		let subExerciseWeights: SubExerciseWeight[] | undefined;
		if (isCompoundBlock && subExerciseData.length > 0) {
			subExerciseWeights = subExerciseData
				.filter(s => s.showWeight || s.reps) // Include if has weight OR reps
				.map(s => {
					let parsedReps: number | null = null;
					if (s.workMode === 'work_time') {
						// For time-based exercises, parse as time and store in reps as seconds
						parsedReps = parseTimeInput(s.reps);
					} else {
						parsedReps = s.reps ? parseInt(s.reps) : null;
					}
					return {
						name: s.name,
						reps: parsedReps,
						weight: s.weight,
						weightUnit: s.weightUnit,
						showWeight: s.showWeight
					};
				});
		}

		dispatch('submit', {
			setLog,
			totalRounds: showRounds && roundsInput ? parseFloat(roundsInput) : undefined,
			totalTime: showTime ? parseTimeInput(timeInput) ?? undefined : undefined,
			subExerciseWeights
		});
	}

	function handleCancel() {
		dispatch('cancel');
	}

	// RPE buttons - compact range
	const rpeOptions = [7, 8, 9, 10];
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3" on:click={handleCancel}>
	<div
		class="w-full max-w-xs landscape:max-w-md bg-slate-800 rounded-xl shadow-xl overflow-hidden max-h-[90vh] overflow-y-auto"
		on:click|stopPropagation
		use:keyboardAware
	>
		<!-- Compact Header -->
		<div class="px-4 py-3 bg-slate-700/50">
			<div class="flex items-center justify-between">
				<h2 class="text-base font-semibold text-white truncate">
					{#if isCompoundBlock}
						{exercise.exerciseName}
					{:else}
						Set {setNumber}
					{/if}
				</h2>
				{#if !isCompoundBlock}
					<span class="text-xs text-slate-400 truncate ml-2 max-w-[140px]">{exercise.exerciseName}</span>
				{/if}
			</div>
		</div>

		<!-- Form - Compact -->
		<div class="px-4 py-3 space-y-3">
			<!-- Primary inputs: Reps & Weight side by side -->
			{#if showReps || showWeight}
				<div class="flex gap-2">
					{#if showReps && !showRounds}
						<div class="flex-1">
							<label for="reps" class="text-xs text-slate-400 mb-1 block">Reps</label>
							<input
								id="reps"
								type="number"
								inputmode="numeric"
								bind:value={reps}
								on:focus={(e) => e.currentTarget.select()}
								class="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-lg text-center font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
								placeholder={exercise.prescription.reps?.toString() ?? '-'}
							/>
						</div>
					{/if}

					{#if showWeight}
						<div class="flex-1">
							<label for="weight" class="text-xs text-slate-400 mb-1 block">{weightUnit}</label>
							<input
								id="weight"
								type="number"
								inputmode="decimal"
								step="2.5"
								bind:value={weight}
								on:focus={(e) => e.currentTarget.select()}
								class="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-lg text-center font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
								placeholder={exercise.prescription.weight?.toString() ?? '-'}
							/>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Rounds (AMRAP) -->
			{#if showRounds}
				<div>
					<label for="rounds" class="text-xs text-slate-400 mb-1 block">Rounds completed</label>
					<input
						id="rounds"
						type="number"
						inputmode="decimal"
						step="0.5"
						bind:value={roundsInput}
						on:focus={(e) => e.currentTarget.select()}
						class="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-lg text-center font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
						placeholder="e.g., 5.5"
					/>
				</div>
			{/if}

			<!-- Time (Circuit) -->
			{#if showTime}
				<div>
					<label for="time" class="text-xs text-slate-400 mb-1 block">Time (MM:SS)</label>
					<input
						id="time"
						type="text"
						bind:value={timeInput}
						on:focus={(e) => e.currentTarget.select()}
						class="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-lg text-center font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
						placeholder="5:30"
					/>
				</div>
			{/if}

			<!-- Sub-exercise performance data (EMOM/Interval: reps + weight per exercise) -->
			{#if showSubExercisePerformance && subExerciseData.length > 0}
				<div class="space-y-2">
					<p class="text-xs text-slate-400 font-medium">Performance per exercise</p>
					{#each subExerciseData as subEx, idx}
						<div class="bg-slate-700/30 rounded-lg p-2">
							<span class="block text-xs text-slate-300 mb-1.5 truncate">{subEx.name}</span>
							<div class="flex items-center gap-2">
								<!-- Reps or Time input based on work mode -->
								<div class="flex-1">
									<input
										type={subEx.workMode === 'work_time' ? 'text' : 'number'}
										inputmode={subEx.workMode === 'work_time' ? 'text' : 'numeric'}
										bind:value={subEx.reps}
										on:focus={(e) => e.currentTarget.select()}
										class="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
										placeholder={subEx.workMode === 'work_time' ? '0:30' : (exercise.subExercises[idx]?.prescription.reps?.toString() ?? '-')}
									/>
									<span class="block text-[10px] text-slate-500 mt-0.5 text-center">
										{subEx.workMode === 'work_time' ? 'time' : 'reps'}
									</span>
								</div>
								<!-- Weight input (only if showWeight) -->
								{#if subEx.showWeight}
									<div class="flex-1">
										<input
											type="number"
											inputmode="decimal"
											step="2.5"
											bind:value={subEx.weight}
											on:focus={(e) => e.currentTarget.select()}
											class="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
											placeholder={exercise.subExercises[idx]?.prescription.weight?.toString() ?? '-'}
										/>
										<span class="block text-[10px] text-slate-500 mt-0.5 text-center">{subEx.weightUnit}</span>
									</div>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{:else if hasSubExerciseWeights}
				<!-- Fallback: Sub-exercise weights only (AMRAP/Circuit - no per-exercise reps needed) -->
				<div class="space-y-1.5">
					<p class="text-xs text-slate-400 font-medium">Weight per exercise</p>
					{#each subExerciseData as subEx, idx}
						{#if subEx.showWeight}
							<div class="flex items-center gap-2">
								<span class="flex-1 text-xs text-slate-400 truncate">{subEx.name}</span>
								<input
									type="number"
									inputmode="decimal"
									step="2.5"
									bind:value={subEx.weight}
									on:focus={(e) => e.currentTarget.select()}
									class="w-16 px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
									placeholder={exercise.subExercises[idx]?.prescription.weight?.toString() ?? '-'}
								/>
								<span class="text-xs text-slate-500 w-6">{subEx.weightUnit}</span>
							</div>
						{/if}
					{/each}
				</div>
			{/if}

			<!-- RPE - Collapsible -->
			<div>
				<button
					type="button"
					class="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-300 transition-colors"
					on:click={() => showRpeSection = !showRpeSection}
				>
					{#if showRpeSection}
						<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
						</svg>
						Hide RPE {rpe ? `(${rpe})` : ''}
					{:else}
						<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
						</svg>
						Add RPE {rpe ? `(${rpe})` : ''}
					{/if}
				</button>
				{#if showRpeSection}
					<div class="flex gap-1.5 mt-2">
						{#each rpeOptions as option}
							<button
								type="button"
								class="flex-1 py-1.5 rounded text-xs font-medium transition-colors
									{rpe === option.toString()
										? 'bg-indigo-600 text-white'
										: 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white'}"
								on:click={() => (rpe = rpe === option.toString() ? '' : option.toString())}
							>
								{option}
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<!-- Actions - Compact -->
		<div class="flex border-t border-slate-700">
			<button
				type="button"
				class="flex-1 py-3 text-slate-400 font-medium hover:bg-slate-700/50 transition-colors"
				on:click={handleCancel}
			>
				Skip
			</button>
			<div class="w-px bg-slate-700"></div>
			<button
				type="button"
				class="flex-1 py-3 text-indigo-400 font-medium hover:bg-indigo-600/20 transition-colors"
				on:click={handleSubmit}
			>
				Done
			</button>
		</div>
	</div>
</div>

