<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { EditScope } from '$lib/types/schedule';
	import { editPreferences, updateEditPreferences } from '$lib/stores/schedule';

	export let isOpen: boolean;
	export let weekNumber: number;

	const dispatch = createEventDispatcher<{
		select: EditScope;
		cancel: void;
	}>();

	let selectedScope: EditScope = $editPreferences.defaultScope;
	let rememberChoice = $editPreferences.rememberChoice;

	// Reset when modal opens
	$: if (isOpen) {
		selectedScope = $editPreferences.defaultScope;
		rememberChoice = $editPreferences.rememberChoice;
	}

	const scopeOptions: { value: EditScope; label: string; description: string }[] = [
		{
			value: 'all_weeks',
			label: 'All Weeks',
			description: 'Apply this change to every week in the program'
		},
		{
			value: 'this_week_and_remaining',
			label: 'This Week + Remaining',
			description: `Apply from Week ${weekNumber} to end of program`
		},
		{
			value: 'this_instance_only',
			label: 'This Week Only',
			description: `Only change Week ${weekNumber}, keep other weeks as-is`
		}
	];

	function handleSelect() {
		if (rememberChoice) {
			updateEditPreferences({
				defaultScope: selectedScope,
				rememberChoice: true
			});
		}
		dispatch('select', selectedScope);
	}

	function handleCancel() {
		dispatch('cancel');
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			handleCancel();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			handleCancel();
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3"
		on:click={handleBackdropClick}
	>
		<!-- Modal -->
		<div
			class="w-full max-w-xs bg-slate-800 rounded-xl shadow-xl"
			on:click|stopPropagation
		>
			<!-- Header -->
			<div class="px-4 py-3 border-b border-slate-700">
				<h3 class="text-base font-semibold text-white">Apply Change To</h3>
				<p class="text-xs text-slate-400 mt-0.5">Choose which weeks to update</p>
			</div>

			<!-- Options -->
			<div class="px-3 py-2 space-y-1.5">
				{#each scopeOptions as option}
					<button
						on:click={() => (selectedScope = option.value)}
						class="w-full p-2 rounded-md text-left transition-colors
							   {selectedScope === option.value
							? 'bg-indigo-600 text-white'
							: 'bg-slate-700 text-white hover:bg-slate-600'}"
					>
						<div class="text-sm font-medium">{option.label}</div>
						<div
							class="text-xs
								   {selectedScope === option.value ? 'text-indigo-200' : 'text-slate-400'}"
						>
							{option.description}
						</div>
					</button>
				{/each}
			</div>

			<!-- Remember checkbox -->
			<div class="px-3 pb-2">
				<label class="flex items-center gap-2 cursor-pointer">
					<input
						type="checkbox"
						bind:checked={rememberChoice}
						class="w-3.5 h-3.5 rounded border-slate-500 bg-slate-700 text-indigo-500
							   focus:ring-indigo-500 focus:ring-offset-0"
					/>
					<span class="text-xs text-slate-400">Remember for this session</span>
				</label>
			</div>

			<!-- Footer -->
			<div class="flex gap-2 px-3 py-3 border-t border-slate-700">
				<button
					on:click={handleCancel}
					class="flex-1 py-2 px-3 bg-slate-700 hover:bg-slate-600
						   text-white text-sm font-medium rounded-lg transition-colors"
				>
					Cancel
				</button>
				<button
					on:click={handleSelect}
					class="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700
						   text-white text-sm font-medium rounded-lg transition-colors"
				>
					Apply
				</button>
			</div>
		</div>
	</div>
{/if}
