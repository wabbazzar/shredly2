<script lang="ts">
	import {
		scheduleLibrary,
		isLoading,
		setActiveSchedule,
		deleteScheduleFromDb,
		duplicateScheduleInDb
	} from '$lib/stores/schedule';
	import type { StoredSchedule } from '$lib/types/schedule';

	export let onScheduleSelect: (schedule: StoredSchedule) => void;

	// Format date for display
	function formatDate(isoDate: string): string {
		const date = new Date(isoDate);
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	// Calculate progress percentage
	function getProgress(schedule: StoredSchedule): number {
		const totalDays = schedule.weeks * schedule.daysPerWeek;
		const completedDays =
			(schedule.scheduleMetadata.currentWeek - 1) * schedule.daysPerWeek +
			schedule.scheduleMetadata.currentDay -
			1;
		return Math.min(100, Math.round((completedDays / totalDays) * 100));
	}

	// Handle schedule actions
	async function handleSetActive(e: Event, id: string) {
		e.stopPropagation();
		await setActiveSchedule(id);
	}

	async function handleDuplicate(e: Event, id: string) {
		e.stopPropagation();
		await duplicateScheduleInDb(id);
	}

	async function handleDelete(e: Event, id: string, name: string) {
		e.stopPropagation();
		if (confirm(`Delete "${name}"? This cannot be undone.`)) {
			await deleteScheduleFromDb(id);
		}
	}
</script>

<div class="py-1 lg:px-4 lg:pb-4">
	{#if $isLoading}
		<div class="flex items-center justify-center py-8 lg:py-12">
			<div class="animate-spin rounded-full h-6 w-6 lg:h-8 lg:w-8 border-b-2 border-indigo-400"></div>
		</div>
	{:else if $scheduleLibrary.length === 0}
		<!-- Empty state -->
		<div class="flex flex-col items-center justify-center py-8 lg:py-12 text-center">
			<svg
				class="w-12 h-12 lg:w-16 lg:h-16 mb-3 lg:mb-4 text-slate-600"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="1.5"
					d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
				/>
			</svg>
			<h3 class="text-base lg:text-lg font-medium text-slate-400 mb-1 lg:mb-2">No Schedules Yet</h3>
			<p class="text-xs lg:text-sm text-slate-500 max-w-xs">
				Create a new workout schedule or load one from templates to get started.
			</p>
		</div>
	{:else}
		<!-- Schedule list -->
		<div class="space-y-2 lg:space-y-3">
			{#each $scheduleLibrary as schedule (schedule.id)}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					on:click={() => onScheduleSelect(schedule)}
					on:keydown={(e) => e.key === 'Enter' && onScheduleSelect(schedule)}
					role="button"
					tabindex="0"
					class="w-full bg-slate-700/50 lg:bg-slate-800 rounded-lg p-3 lg:p-4 text-left hover:bg-slate-700 transition-colors cursor-pointer"
				>
					<div class="flex items-start justify-between mb-1.5 lg:mb-2">
						<div class="flex items-center gap-1.5 lg:gap-2">
							{#if schedule.scheduleMetadata.isActive}
								<svg class="w-4 h-4 lg:w-5 lg:h-5 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
									<path
										d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
									/>
								</svg>
							{/if}
							<h3 class="font-semibold text-sm lg:text-base text-white">{schedule.name}</h3>
						</div>
						<div class="flex gap-0.5 lg:gap-1">
							{#if !schedule.scheduleMetadata.isActive}
								<button
									on:click={(e) => handleSetActive(e, schedule.id)}
									class="p-1 lg:p-1.5 text-slate-400 hover:text-yellow-400 transition-colors"
									title="Set as active"
								>
									<svg class="w-3.5 h-3.5 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
										/>
									</svg>
								</button>
							{/if}
							<button
								on:click={(e) => handleDuplicate(e, schedule.id)}
								class="p-1 lg:p-1.5 text-slate-400 hover:text-indigo-400 transition-colors"
								title="Duplicate"
							>
								<svg class="w-3.5 h-3.5 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
									/>
								</svg>
							</button>
							<button
								on:click={(e) => handleDelete(e, schedule.id, schedule.name)}
								class="p-1 lg:p-1.5 text-slate-400 hover:text-red-400 transition-colors"
								title="Delete"
							>
								<svg class="w-3.5 h-3.5 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
									/>
								</svg>
							</button>
						</div>
					</div>

					<div class="flex items-center gap-2 lg:gap-4 text-xs lg:text-sm text-slate-400 mb-2 lg:mb-3">
						<span>{schedule.weeks}wk</span>
						<span>{schedule.daysPerWeek}d/wk</span>
						<span class="hidden sm:inline">Started {formatDate(schedule.scheduleMetadata.startDate)}</span>
					</div>

					<!-- Progress bar -->
					<div class="w-full bg-slate-600 lg:bg-slate-700 rounded-full h-1.5 lg:h-2">
						<div
							class="bg-indigo-500 h-1.5 lg:h-2 rounded-full transition-all"
							style="width: {getProgress(schedule)}%"
						></div>
					</div>
					<div class="text-xs text-slate-500 mt-1">
						Week {schedule.scheduleMetadata.currentWeek}, Day {schedule.scheduleMetadata.currentDay}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
