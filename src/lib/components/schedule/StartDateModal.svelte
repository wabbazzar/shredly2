<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let isOpen: boolean;
	export let currentStartDate: string;

	const dispatch = createEventDispatcher<{
		close: void;
		save: string;
	}>();

	let selectedDate: string = currentStartDate;

	// Reset selected date when modal opens
	$: if (isOpen) {
		selectedDate = currentStartDate;
	}

	function handleClose() {
		dispatch('close');
	}

	function handleSave() {
		dispatch('save', selectedDate);
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

	// Format date for display
	function formatDisplayDate(dateStr: string): string {
		const [year, month, day] = dateStr.split('-').map(Number);
		const date = new Date(year, month - 1, day);
		return date.toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		});
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2"
		on:click={handleBackdropClick}
	>
		<!-- Modal - tight on mobile -->
		<div
			class="w-full max-w-[280px] bg-slate-800 rounded-xl"
			on:click|stopPropagation
		>
			<!-- Header - compact -->
			<div class="flex items-center justify-between px-3 py-2 border-b border-slate-700">
				<h2 class="text-sm font-semibold text-white">Set Start Date</h2>
				<button
					on:click={handleClose}
					class="p-0.5 text-slate-400 hover:text-white transition-colors"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>

			<!-- Content - compact -->
			<div class="p-3 space-y-3">
				<p class="text-xs text-slate-400">
					Choose when your program begins.
				</p>

				<div>
					<input
						type="date"
						bind:value={selectedDate}
						class="w-full py-1.5 px-2 text-sm bg-slate-700 border border-slate-600 rounded-lg
							   text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
					/>
				</div>

				{#if selectedDate}
					<div class="text-xs text-slate-500">
						Week 1 starts: {formatDisplayDate(selectedDate)}
					</div>
				{/if}
			</div>

			<!-- Footer - compact -->
			<div class="px-3 py-2 border-t border-slate-700 flex gap-2">
				<button
					on:click={handleClose}
					class="flex-1 py-1.5 px-3 bg-slate-700 hover:bg-slate-600
						   text-slate-300 text-xs font-medium rounded-lg transition-colors"
				>
					Cancel
				</button>
				<button
					on:click={handleSave}
					class="flex-1 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700
						   text-white text-xs font-medium rounded-lg transition-colors"
				>
					Save
				</button>
			</div>
		</div>
	</div>
{/if}
