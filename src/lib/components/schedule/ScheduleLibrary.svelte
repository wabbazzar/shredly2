<script lang="ts">
	import {
		scheduleLibrary,
		isLoading,
		setActiveSchedule,
		deleteScheduleFromDb,
		duplicateScheduleInDb,
		renameScheduleInDb
	} from '$lib/stores/schedule';
	import type { StoredSchedule } from '$lib/types/schedule';
	import ScheduleCard from './ScheduleCard.svelte';

	export let onScheduleSelect: (schedule: StoredSchedule) => void;

	// Handle schedule actions
	async function handleSetActive(e: CustomEvent<string>) {
		await setActiveSchedule(e.detail);
	}

	async function handleDuplicate(e: CustomEvent<string>) {
		await duplicateScheduleInDb(e.detail);
	}

	async function handleDelete(e: CustomEvent<{ id: string; name: string }>) {
		if (confirm(`Delete "${e.detail.name}"? This cannot be undone.`)) {
			await deleteScheduleFromDb(e.detail.id);
		}
	}

	async function handleRename(e: CustomEvent<{ id: string; name: string }>) {
		await renameScheduleInDb(e.detail.id, e.detail.name);
	}

	function handleDownload(e: CustomEvent<StoredSchedule>) {
		const schedule = e.detail;
		const json = JSON.stringify(schedule, null, 2);
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		// Sanitize filename: replace spaces and special chars
		const safeName = schedule.name.replace(/[^a-zA-Z0-9-_]/g, '_').toLowerCase();
		a.download = `${safeName}.json`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
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
				<ScheduleCard
					{schedule}
					on:select={(e) => onScheduleSelect(e.detail)}
					on:rename={handleRename}
					on:setActive={handleSetActive}
					on:duplicate={handleDuplicate}
					on:download={handleDownload}
					on:delete={handleDelete}
				/>
			{/each}
		</div>
	{/if}
</div>
