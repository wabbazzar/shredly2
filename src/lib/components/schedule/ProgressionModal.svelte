<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { ParameterizedExercise, ParameterizedSubExercise, WeekParameters } from '$lib/engine/types';
	import type { EditScope } from '$lib/types/schedule';
	import { keyboardAware } from '$lib/actions/keyboardAware';

	export let isOpen: boolean;
	export let exercise: ParameterizedExercise;
	export let exerciseIndex: number;
	export let field: string; // 'sets', 'reps', 'work_time_minutes', 'rest_time_minutes'
	export let currentWeek: number;
	export let totalWeeks: number;
	export let subExerciseIndex: number = -1; // -1 means parent exercise

	const dispatch = createEventDispatcher<{
		close: void;
		save: {
			exerciseIndex: number;
			field: string;
			weekValues: Record<string, number>;
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

	// Edit values for each week (stored in seconds for time fields)
	let weekValues: Record<string, number> = {};
	let selectedScope: EditScope = 'this_week_and_remaining';

	// Track the display mode for each week - locked when modal opens to prevent mid-typing mode switches
	let displayModes: Record<string, 'seconds' | 'minutes'> = {};
	// Track local input values to prevent mid-typing conversions
	let localInputs: Record<string, string> = {};

	// Get field display info
	function getFieldInfo(f: string): { label: string; isTime: boolean } {
		switch (f) {
			case 'sets':
				return { label: 'Sets', isTime: false };
			case 'reps':
				return { label: 'Reps', isTime: false };
			case 'work_time_minutes':
				return { label: 'Work Time', isTime: true };
			case 'rest_time_minutes':
				return { label: 'Rest Time', isTime: true };
			default:
				return { label: f, isTime: false };
		}
	}

	// Get suffix based on display mode
	function getTimeSuffix(mode: 'seconds' | 'minutes'): string {
		return mode === 'seconds' ? 's' : 'min';
	}

	// Format display value based on mode
	function formatTimeValue(seconds: number, mode: 'seconds' | 'minutes'): number {
		return mode === 'seconds' ? seconds : Math.round(seconds / 60 * 10) / 10;
	}

	// Determine initial display mode based on value (only called when modal opens)
	function determineDisplayMode(seconds: number): 'seconds' | 'minutes' {
		return seconds < 90 ? 'seconds' : 'minutes';
	}

	// Parse input value back to seconds based on locked display mode
	function parseTimeInput(value: number, mode: 'seconds' | 'minutes'): number {
		if (mode === 'minutes') {
			return Math.round(value * 60);
		}
		return value;
	}

	$: fieldInfo = getFieldInfo(field);

	// Initialize week values when modal opens
	$: if (isOpen && exercise && targetExercise) {
		weekValues = {};
		displayModes = {};
		localInputs = {};
		for (let w = 1; w <= totalWeeks; w++) {
			const weekKey = `week${w}`;
			const params = targetExercise[weekKey as keyof typeof targetExercise] as WeekParameters | undefined;
			if (params) {
				let value = (params as Record<string, unknown>)[field];
				// Convert minutes to seconds for internal storage if it's a time field
				if (fieldInfo.isTime && typeof value === 'number') {
					const unit = (params as Record<string, unknown>)[field.replace('_minutes', '_unit')];
					if (unit === 'seconds') {
						value = Math.round(value * 60);
					} else {
						value = Math.round(value * 60); // Convert minutes to seconds for editing
					}
				}
				const seconds = typeof value === 'number' ? value : 0;
				weekValues[weekKey] = seconds;
				// Lock the display mode based on initial value - won't change during editing
				if (fieldInfo.isTime) {
					displayModes[weekKey] = determineDisplayMode(seconds);
					localInputs[weekKey] = String(formatTimeValue(seconds, displayModes[weekKey]));
				} else {
					localInputs[weekKey] = String(seconds);
				}
			}
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

	// Handle local input change (during typing - no conversion)
	function handleLocalInput(weekKey: string, value: string) {
		localInputs[weekKey] = value;
		localInputs = localInputs; // Trigger reactivity
	}

	// Commit value on blur - convert to seconds using locked display mode
	function commitValue(weekKey: string) {
		const inputVal = parseFloat(localInputs[weekKey]) || 0;
		const mode = displayModes[weekKey] || 'seconds';

		if (fieldInfo.isTime) {
			weekValues[weekKey] = parseTimeInput(inputVal, mode);
		} else {
			weekValues[weekKey] = inputVal;
		}
		weekValues = weekValues; // Trigger reactivity
	}

	// Handle save
	function handleSave() {
		// Commit all local inputs first (in case user clicks Save without blurring)
		for (const weekKey of Object.keys(localInputs)) {
			commitValue(weekKey);
		}

		// Convert seconds back to minutes for time fields
		const finalValues: Record<string, number> = {};
		for (const [weekKey, value] of Object.entries(weekValues)) {
			if (fieldInfo.isTime) {
				finalValues[weekKey] = value / 60; // Convert back to minutes
			} else {
				finalValues[weekKey] = value;
			}
		}

		dispatch('save', {
			exerciseIndex,
			field,
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
					<h3 class="text-base font-semibold text-white">Edit {fieldInfo.label}</h3>
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
						{@const mode = displayModes[weekKey] || 'seconds'}
						{@const suffix = fieldInfo.isTime ? getTimeSuffix(mode) : ''}

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
							<div class="flex items-center gap-1">
								<input
									type="number"
									value={localInputs[weekKey] ?? '0'}
									on:input={(e) => handleLocalInput(weekKey, e.currentTarget.value)}
									on:blur={() => commitValue(weekKey)}
									on:focus={(e) => e.currentTarget.select()}
									disabled={!isEditable}
									min="0"
									step={fieldInfo.isTime && mode === 'minutes' ? '0.5' : '1'}
									class="w-16 bg-slate-700 text-white text-right rounded px-2 py-1 text-sm
										   border border-slate-600 focus:border-indigo-500 focus:outline-none
										   disabled:opacity-50 disabled:cursor-not-allowed"
								/>
								{#if suffix}
									<span class="text-xs text-slate-400 w-8">{suffix}</span>
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
