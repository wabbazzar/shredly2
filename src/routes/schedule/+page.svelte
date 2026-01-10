<script lang="ts">
	import { onMount } from 'svelte';
	import { navigationStore } from '$lib/stores/navigation';
	import {
		initializeScheduleStore,
		activeSchedule,
		viewState,
		navigateToCalendar,
		openModal
	} from '$lib/stores/schedule';
	import type { StoredSchedule } from '$lib/types/schedule';
	import ScheduleActions from '$lib/components/schedule/ScheduleActions.svelte';
	import ScheduleLibrary from '$lib/components/schedule/ScheduleLibrary.svelte';

	onMount(() => {
		navigationStore.setActiveTab('schedule');
		initializeScheduleStore();
	});

	function handleCreateClick() {
		openModal('create');
	}

	function handleLoadClick() {
		openModal('load');
	}

	function handleViewClick() {
		if ($activeSchedule) {
			navigateToCalendar();
		}
	}

	function handleScheduleSelect(schedule: StoredSchedule) {
		// When a schedule is selected from the library, view it
		// For now, just log - we'll implement CalendarView in Phase 4
		console.log('Selected schedule:', schedule.name);
	}
</script>

<div class="flex flex-col h-full bg-slate-900">
	<!-- Header -->
	<div class="px-4 pt-4 pb-2">
		<h1 class="text-2xl font-bold text-white">Schedule</h1>
		<p class="text-sm text-slate-400">Manage your workout programs</p>
	</div>

	<!-- Actions -->
	<ScheduleActions
		onCreateClick={handleCreateClick}
		onLoadClick={handleLoadClick}
		onViewClick={handleViewClick}
	/>

	<!-- Divider -->
	<div class="px-4 py-2">
		<div class="border-t border-slate-700"></div>
		<p class="text-xs text-slate-500 mt-2">Your Schedules</p>
	</div>

	<!-- Schedule Library -->
	<div class="flex-1 overflow-y-auto">
		<ScheduleLibrary onScheduleSelect={handleScheduleSelect} />
	</div>
</div>
