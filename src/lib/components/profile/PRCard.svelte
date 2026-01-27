<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { ExercisePRDisplay } from '$lib/stores/oneRMCache';
	import { lbsToKg } from '$lib/types/user';

	export let prData: ExercisePRDisplay;
	export let unitSystem: 'imperial' | 'metric' = 'imperial';

	const dispatch = createEventDispatcher<{
		override: { exerciseName: string; value: number };
	}>();

	// Edit state
	let isEditing = false;
	let editValue = '';

	// Convert weights for display
	$: displayedTrainingMax = unitSystem === 'imperial' ? prData.trm : lbsToKg(prData.trm);
	$: displayedOverride = prData.userOverride
		? (unitSystem === 'imperial' ? prData.userOverride : lbsToKg(prData.userOverride))
		: null;
	$: weightUnit = unitSystem === 'imperial' ? 'lbs' : 'kg';

	// Format days since last performed
	$: daysAgoText = formatDaysAgo(prData.daysSinceLastPerformed);

	function formatDaysAgo(days: number | null): string {
		if (days === null) return 'Never';
		if (days === 0) return 'Today';
		if (days === 1) return 'Yesterday';
		if (days < 7) return `${days}d ago`;
		if (days < 30) return `${Math.floor(days / 7)}w ago`;
		return `${Math.floor(days / 30)}mo ago`;
	}

	// Trend indicator
	$: trendIcon = prData.recentActivity.trend === 'up' ? 'trending-up'
		: prData.recentActivity.trend === 'down' ? 'trending-down'
		: null;

	function startEdit() {
		editValue = displayedOverride?.toString() ?? displayedTrainingMax.toString();
		isEditing = true;
	}

	function cancelEdit() {
		isEditing = false;
		editValue = '';
	}

	function saveEdit() {
		const numValue = parseFloat(editValue);
		if (!isNaN(numValue) && numValue > 0) {
			// Convert back to lbs if metric
			const lbsValue = unitSystem === 'metric' ? numValue / 0.453592 : numValue;
			dispatch('override', { exerciseName: prData.exerciseName, value: Math.round(lbsValue) });
		}
		isEditing = false;
		editValue = '';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			saveEdit();
		} else if (e.key === 'Escape') {
			cancelEdit();
		}
	}
</script>

<div class="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
	<!-- Header row: Exercise name + stale indicator -->
	<div class="flex items-center justify-between mb-2">
		<h3 class="text-sm font-medium text-white truncate flex-1">
			{prData.exerciseName}
		</h3>
		<div class="flex items-center gap-1.5">
			{#if prData.isStale}
				<span class="text-xs text-amber-400/80 bg-amber-400/10 px-1.5 py-0.5 rounded">
					Stale
				</span>
			{/if}
			{#if prData.hasUserOverride}
				<span class="text-xs text-indigo-400/80 bg-indigo-400/10 px-1.5 py-0.5 rounded">
					Manual
				</span>
			{:else if prData.estimated1RM > 0}
				<span class="text-xs text-slate-500/80 bg-slate-700/30 px-1.5 py-0.5 rounded">
					Calculated
				</span>
			{/if}
		</div>
	</div>

	<!-- Main values: 1RM and TRM -->
	<div class="flex items-end justify-between mb-2">
		<div>
			{#if isEditing}
				<div class="flex items-center gap-2">
					<input
						type="number"
						inputmode="decimal"
						bind:value={editValue}
						on:keydown={handleKeydown}
						on:blur={saveEdit}
						class="w-20 px-2 py-1 bg-slate-700 border border-indigo-500 rounded text-white text-lg font-bold focus:outline-none"
						autofocus
					/>
					<span class="text-slate-400 text-sm">{weightUnit}</span>
				</div>
			{:else}
				<button
					on:click={startEdit}
					class="group flex items-baseline gap-1 hover:bg-slate-700/50 rounded px-1 -mx-1 transition-colors"
				>
					<span class="text-2xl font-bold text-white">
						{prData.trm > 0 ? Math.round(displayedTrainingMax) : '--'}
					</span>
					<span class="text-slate-400 text-sm">{weightUnit}</span>
					<svg class="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 ml-1 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
					</svg>
				</button>
			{/if}
			<span class="text-xs text-slate-500">Training Max</span>
		</div>
	</div>

	<!-- Activity footer -->
	<div class="flex items-center justify-between text-xs text-slate-400 border-t border-slate-700/50 pt-2">
		<div class="flex items-center gap-1.5">
			{#if trendIcon === 'trending-up'}
				<svg class="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
				</svg>
			{:else if trendIcon === 'trending-down'}
				<svg class="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" />
				</svg>
			{/if}
			<span>{daysAgoText}</span>
		</div>

		{#if prData.recentActivity.lastWeight !== null}
			<span class="text-slate-500">
				Best: {prData.recentActivity.lastWeight}{weightUnit}
				{#if prData.recentActivity.lastReps !== null}
					x{prData.recentActivity.lastReps}
				{/if}
			</span>
		{:else}
			<span class="text-slate-500">No data</span>
		{/if}
	</div>
</div>
