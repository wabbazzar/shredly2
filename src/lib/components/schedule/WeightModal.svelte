<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { ParameterizedExercise, ParameterizedSubExercise, WeekParameters, WeightSpecification } from '$lib/engine/types';
	import type { EditScope } from '$lib/types/schedule';
	import { getFromCache } from '$lib/stores/oneRMCache';
	import { getLastPerformance } from '$lib/stores/history';
	import { keyboardAware } from '$lib/actions/keyboardAware';

	export let isOpen: boolean;
	export let exercise: ParameterizedExercise;
	export let exerciseIndex: number;
	export let currentWeek: number;
	export let totalWeeks: number;
	export let subExerciseIndex: number = -1; // -1 means parent exercise

	const dispatch = createEventDispatcher<{
		close: void;
		save: {
			exerciseIndex: number;
			weekValues: Record<string, WeightSpecification>;
			scope: EditScope;
			subExerciseIndex?: number;
		};
	}>();

	// Get target for editing (parent or sub-exercise)
	$: targetExercise = subExerciseIndex >= 0 && exercise.sub_exercises
		? exercise.sub_exercises[subExerciseIndex]
		: exercise;
	$: targetName = subExerciseIndex >= 0 && exercise.sub_exercises
		? exercise.sub_exercises[subExerciseIndex]?.name ?? exercise.name
		: exercise.name;

	// Get TRM and history data for context
	$: cacheEntry = getFromCache(targetName);
	$: lastPerformance = getLastPerformance(targetName);
	$: trm = cacheEntry?.trm ?? null;
	$: oneRM = cacheEntry?.oneRM ?? null;

	// Edit values for each week (stored as percent TM)
	let weekValues: Record<string, number> = {};
	let selectedScope: EditScope = 'this_week_and_remaining';

	// Get current weight type from week1 to determine editing mode
	$: currentWeightType = getWeightType(targetExercise);

	function getWeightType(ex: ParameterizedExercise | ParameterizedSubExercise): 'percent_tm' | 'absolute' | 'qualitative' | 'none' {
		const params = ex.week1 as WeekParameters | undefined;
		if (!params?.weight) return 'none';

		if (typeof params.weight === 'string') return 'qualitative';
		if (params.weight.type === 'percent_tm') return 'percent_tm';
		if (params.weight.type === 'absolute') return 'absolute';
		return 'none';
	}

	// Extract percent value from weight specification
	function getPercentValue(weight: WeightSpecification | undefined): number {
		if (!weight) return 70; // Default
		if (typeof weight === 'object' && weight.type === 'percent_tm') {
			return weight.value;
		}
		return 70; // Default for other types
	}

	// Calculate weight from percent TM
	function calculateWeight(percent: number): number | null {
		if (!trm || trm <= 0) return null;
		return Math.round(trm * (percent / 100) / 5) * 5; // Round to nearest 5
	}

	// Initialize week values when modal opens
	$: if (isOpen && exercise && targetExercise) {
		weekValues = {};
		for (let w = 1; w <= totalWeeks; w++) {
			const weekKey = `week${w}`;
			const params = targetExercise[weekKey as keyof typeof targetExercise] as WeekParameters | undefined;
			weekValues[weekKey] = getPercentValue(params?.weight);
		}
	}

	// Get which weeks are editable based on scope
	function isWeekEditable(weekNum: number): boolean {
		switch (selectedScope) {
			case 'all_weeks':
				return true;
			case 'this_week_and_remaining':
				return weekNum >= currentWeek;
			case 'this_instance_only':
				return weekNum === currentWeek;
		}
	}

	// Handle save
	function handleSave() {
		const finalValues: Record<string, WeightSpecification> = {};

		for (const [weekKey, percent] of Object.entries(weekValues)) {
			finalValues[weekKey] = {
				type: 'percent_tm',
				value: percent
			};
		}

		dispatch('save', {
			exerciseIndex,
			weekValues: finalValues,
			scope: selectedScope,
			subExerciseIndex: subExerciseIndex >= 0 ? subExerciseIndex : undefined
		});
	}

	function handleClose() {
		dispatch('close');
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			handleClose();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			handleClose();
		}
	}

	const scopeOptions: { value: EditScope; label: string }[] = [
		{ value: 'all_weeks', label: 'All Weeks' },
		{ value: 'this_week_and_remaining', label: 'This Week + Remaining' },
		{ value: 'this_instance_only', label: 'This Week Only' }
	];
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
		on:click={handleBackdropClick}
	>
		<!-- Modal -->
		<div
			class="w-full max-w-md bg-slate-800 rounded-xl shadow-xl max-h-[85vh] overflow-hidden flex flex-col"
			use:keyboardAware
			on:click|stopPropagation
		>
			<!-- Header -->
			<div class="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
				<div>
					<h3 class="text-base font-semibold text-white">Edit Weight</h3>
					<p class="text-xs text-slate-400 mt-0.5">{targetName}</p>
				</div>
				<button
					on:click={handleClose}
					class="p-1 text-slate-400 hover:text-white transition-colors"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Context Info -->
			<div class="px-4 py-3 bg-slate-900/50 border-b border-slate-700">
				<div class="grid grid-cols-2 gap-3 text-sm">
					{#if oneRM}
						<div>
							<span class="text-slate-500">1RM:</span>
							<span class="text-white font-medium ml-1">{Math.round(oneRM)} lbs</span>
						</div>
					{/if}
					{#if trm}
						<div>
							<span class="text-slate-500">TRM (90%):</span>
							<span class="text-white font-medium ml-1">{Math.round(trm)} lbs</span>
						</div>
					{/if}
					{#if lastPerformance?.weight}
						<div class="col-span-2">
							<span class="text-slate-500">Last performed:</span>
							<span class="text-emerald-400 font-medium ml-1">
								{lastPerformance.weight} {lastPerformance.weight_unit ?? 'lbs'}
								{#if lastPerformance.reps}
									x {lastPerformance.reps} reps
								{/if}
								{#if lastPerformance.rpe}
									@ RPE {lastPerformance.rpe}
								{/if}
							</span>
						</div>
					{/if}
					{#if !oneRM && !trm && !lastPerformance?.weight}
						<div class="col-span-2 text-slate-500 italic">
							No history data yet. Weights shown as % TM.
						</div>
					{/if}
				</div>
			</div>

			<!-- Scope Selector -->
			<div class="px-4 py-3 border-b border-slate-700">
				<p class="text-xs text-slate-500 uppercase tracking-wider mb-2">Apply To</p>
				<div class="flex gap-2">
					{#each scopeOptions as option}
						<button
							on:click={() => (selectedScope = option.value)}
							class="flex-1 py-1.5 px-2 text-xs font-medium rounded-lg transition-colors
								   {selectedScope === option.value
							? 'bg-indigo-600 text-white'
							: 'bg-slate-700 text-slate-300 hover:bg-slate-600'}"
						>
							{option.label}
						</button>
					{/each}
				</div>
			</div>

			<!-- Week Values -->
			<div class="flex-1 overflow-y-auto px-4 py-3">
				<div class="space-y-2">
					{#each Array(totalWeeks) as _, i}
						{@const weekNum = i + 1}
						{@const weekKey = `week${weekNum}`}
						{@const isEditable = isWeekEditable(weekNum)}
						{@const isCurrent = weekNum === currentWeek}
						{@const percent = weekValues[weekKey] ?? 70}
						{@const calculatedWeight = calculateWeight(percent)}

						<div
							class="flex items-center justify-between py-2 px-3 rounded-lg transition-colors
								   {isCurrent ? 'bg-indigo-900/30 ring-1 ring-indigo-500' : ''}
								   {!isEditable ? 'opacity-50' : ''}"
						>
							<div class="flex items-center gap-2">
								<span class="text-sm text-slate-400 w-16">Week {weekNum}</span>
								{#if isCurrent}
									<span class="text-xs bg-indigo-600 text-white px-1.5 py-0.5 rounded">Current</span>
								{/if}
							</div>
							<div class="flex items-center gap-2">
								<input
									type="number"
									bind:value={weekValues[weekKey]}
									disabled={!isEditable}
									min="50"
									max="100"
									step="5"
									class="w-16 bg-slate-700 text-white text-right rounded px-2 py-1 text-sm
										   border border-slate-600 focus:border-indigo-500 focus:outline-none
										   disabled:opacity-50 disabled:cursor-not-allowed"
								/>
								<span class="text-xs text-slate-400 w-6">%</span>
								{#if calculatedWeight}
									<span class="text-sm text-emerald-400 font-medium w-16 text-right">
										{calculatedWeight} lbs
									</span>
								{:else}
									<span class="text-sm text-slate-500 w-16 text-right">--</span>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- Footer -->
			<div class="flex gap-2 px-4 py-3 border-t border-slate-700">
				<button
					on:click={handleClose}
					class="flex-1 py-2.5 px-4 bg-slate-700 hover:bg-slate-600
						   text-white text-sm font-medium rounded-lg transition-colors"
				>
					Cancel
				</button>
				<button
					on:click={handleSave}
					class="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700
						   text-white text-sm font-medium rounded-lg transition-colors"
				>
					Save Changes
				</button>
			</div>
		</div>
	</div>
{/if}
