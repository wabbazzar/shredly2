<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { WorkoutSession, HistoryRow } from '$lib/stores/history';

	export let isOpen: boolean;
	export let session: WorkoutSession | null;
	export let rowsToDelete: HistoryRow[];

	const dispatch = createEventDispatcher<{
		confirm: void;
		cancel: void;
	}>();

	/**
	 * Format date for display
	 * e.g., "Mon, Jan 15"
	 */
	function formatDate(dateStr: string): string {
		const date = new Date(dateStr + 'T00:00:00');
		return date.toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		});
	}

	/**
	 * Get unique exercise names from rows
	 */
	function getUniqueExercises(rows: HistoryRow[]): string[] {
		const names = new Set<string>();
		for (const row of rows) {
			if (!row.is_compound_parent) {
				names.add(row.exercise_name);
			}
		}
		return Array.from(names);
	}

	/**
	 * Get summary stats from rows
	 */
	function getRowStats(rows: HistoryRow[]): { exercises: number; sets: number; compoundParents: number } {
		const exercises = new Set<string>();
		let sets = 0;
		let compoundParents = 0;

		for (const row of rows) {
			if (row.is_compound_parent) {
				compoundParents++;
			} else {
				exercises.add(row.exercise_name);
				sets++;
			}
		}

		return { exercises: exercises.size, sets, compoundParents };
	}

	function handleConfirm() {
		dispatch('confirm');
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

	$: stats = getRowStats(rowsToDelete);
	$: exerciseNames = getUniqueExercises(rowsToDelete);
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen && session}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3"
		on:click={handleBackdropClick}
	>
		<!-- Modal -->
		<div
			class="w-full max-w-sm bg-slate-800 rounded-xl shadow-xl max-h-[80vh] flex flex-col"
			on:click|stopPropagation
		>
			<!-- Header -->
			<div class="px-4 py-3 border-b border-slate-700 flex-shrink-0">
				<h3 class="text-base font-semibold text-white">Delete Workout?</h3>
				<p class="text-xs text-slate-400 mt-0.5">This action cannot be undone</p>
			</div>

			<!-- Content -->
			<div class="px-4 py-3 flex-1 overflow-y-auto">
				<!-- Session info -->
				<div class="bg-slate-900/50 rounded-lg p-3 mb-3">
					<div class="flex items-center justify-between mb-2">
						<span class="text-sm font-medium text-white">
							Week {session.weekNumber}, Day {session.dayNumber}
						</span>
						<span class="text-xs text-slate-400">
							{formatDate(session.date)}
						</span>
					</div>
					<div class="flex gap-3 text-xs text-slate-400">
						<span>{stats.exercises} exercises</span>
						<span>{stats.sets} sets</span>
						{#if stats.compoundParents > 0}
							<span>{stats.compoundParents} compound blocks</span>
						{/if}
					</div>
				</div>

				<!-- Rows to be deleted -->
				<div class="mb-3">
					<h4 class="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
						{rowsToDelete.length} history rows will be deleted:
					</h4>
					<div class="bg-slate-900/50 rounded-lg p-2 max-h-48 overflow-y-auto">
						<ul class="space-y-1">
							{#each exerciseNames as name}
								{@const exerciseRows = rowsToDelete.filter(r => r.exercise_name === name && !r.is_compound_parent)}
								<li class="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-slate-800">
									<span class="text-white truncate">{name}</span>
									<span class="text-slate-500 flex-shrink-0 ml-2">
										{exerciseRows.length} {exerciseRows.length === 1 ? 'set' : 'sets'}
									</span>
								</li>
							{/each}
						</ul>
					</div>
				</div>

				<!-- Warning -->
				<div class="flex items-start gap-2 p-2 bg-red-900/20 border border-red-900/50 rounded-lg">
					<svg class="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
					</svg>
					<p class="text-xs text-red-300">
						This will permanently remove all logged data for this workout including weights, reps, RPE, and notes.
					</p>
				</div>
			</div>

			<!-- Footer -->
			<div class="flex gap-2 px-4 py-3 border-t border-slate-700 flex-shrink-0">
				<button
					on:click={handleCancel}
					class="flex-1 py-2.5 px-3 bg-slate-700 hover:bg-slate-600
						   text-white text-sm font-medium rounded-lg transition-colors"
				>
					Cancel
				</button>
				<button
					on:click={handleConfirm}
					class="flex-1 py-2.5 px-3 bg-red-600 hover:bg-red-700
						   text-white text-sm font-medium rounded-lg transition-colors"
				>
					Delete
				</button>
			</div>
		</div>
	</div>
{/if}
