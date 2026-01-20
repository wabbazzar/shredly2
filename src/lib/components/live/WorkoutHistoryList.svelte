<script lang="ts">
	import type { WorkoutSession } from '$lib/stores/history';
	import { createEventDispatcher } from 'svelte';

	export let sessions: WorkoutSession[];

	const dispatch = createEventDispatcher<{
		sessionClick: WorkoutSession;
	}>();

	/**
	 * Format date for display
	 * e.g., "Mon, Jan 15"
	 */
	function formatDate(dateStr: string): string {
		const date = new Date(dateStr + 'T00:00:00'); // Force local timezone
		return date.toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		});
	}

	/**
	 * Format date to YYYY-MM-DD in local timezone
	 */
	function toLocalDateString(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	/**
	 * Get relative date label
	 * e.g., "Today", "Yesterday", or formatted date
	 */
	function getRelativeDate(dateStr: string): { label: string; isRecent: boolean } {
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const todayStr = toLocalDateString(today);

		const yesterday = new Date(today);
		yesterday.setDate(yesterday.getDate() - 1);
		const yesterdayStr = toLocalDateString(yesterday);

		if (dateStr === todayStr) {
			return { label: 'Today', isRecent: true };
		} else if (dateStr === yesterdayStr) {
			return { label: 'Yesterday', isRecent: true };
		}
		return { label: formatDate(dateStr), isRecent: false };
	}

	function handleSessionClick(session: WorkoutSession) {
		dispatch('sessionClick', session);
	}
</script>

<div class="flex flex-col h-full">
	<!-- Header -->
	<div class="flex items-center justify-between px-4 py-3 border-b border-slate-700">
		<h2 class="text-lg font-semibold text-white">Completed Workouts</h2>
		<span class="px-2 py-0.5 text-xs bg-slate-700 text-slate-300 rounded-full">
			{sessions.length}
		</span>
	</div>

	{#if sessions.length === 0}
		<!-- Empty state -->
		<div class="flex-1 flex flex-col items-center justify-center p-6 text-center">
			<svg
				class="w-12 h-12 mb-4 text-slate-600"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="1.5"
					d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
				/>
			</svg>
			<p class="text-slate-400 text-sm">No completed workouts yet</p>
			<p class="text-slate-500 text-xs mt-1">Your workout history will appear here</p>
		</div>
	{:else}
		<!-- Session list -->
		<div class="flex-1 overflow-y-auto">
			{#each sessions as session}
				{@const dateInfo = getRelativeDate(session.date)}
				<button
					class="w-full flex items-center gap-4 px-4 py-3 hover:bg-slate-800/50 active:bg-slate-800 transition-colors border-b border-slate-800 text-left"
					on:click={() => handleSessionClick(session)}
				>
					<!-- Date column -->
					<div class="flex-shrink-0 w-20">
						<span
							class="text-sm font-medium {dateInfo.isRecent
								? 'text-indigo-400'
								: 'text-slate-300'}"
						>
							{dateInfo.label}
						</span>
					</div>

					<!-- Week/Day info -->
					<div class="flex-1 min-w-0">
						<div class="text-sm text-white truncate">
							Week {session.weekNumber}, Day {session.dayNumber}
						</div>
					</div>

					<!-- Stats badges -->
					<div class="flex items-center gap-2 flex-shrink-0">
						<!-- Exercise count -->
						<span
							class="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-slate-700 text-slate-300 rounded"
						>
							<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M4 6h16M4 10h16M4 14h16M4 18h16"
								/>
							</svg>
							{session.exerciseCount}
						</span>

						<!-- Set count -->
						<span
							class="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-indigo-900/50 text-indigo-300 rounded"
						>
							<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
							{session.completedSetCount}
						</span>
					</div>

					<!-- Chevron -->
					<svg
						class="w-5 h-5 text-slate-500 flex-shrink-0"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
					</svg>
				</button>
			{/each}
		</div>
	{/if}
</div>
