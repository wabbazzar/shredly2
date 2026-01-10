<script lang="ts">
	import { onMount } from 'svelte';
	import { navigationStore } from '$lib/stores/navigation';
	import {
		initializeScheduleStore,
		activeSchedule,
		viewState,
		navigateToCalendar,
		navigateToWeek,
		navigateToDay,
		navigateBack,
		setActiveSchedule
	} from '$lib/stores/schedule';
	import type { StoredSchedule } from '$lib/types/schedule';
	import ScheduleActions from '$lib/components/schedule/ScheduleActions.svelte';
	import ScheduleLibrary from '$lib/components/schedule/ScheduleLibrary.svelte';
	import CreateScheduleModal from '$lib/components/schedule/CreateScheduleModal.svelte';
	import CalendarView from '$lib/components/schedule/CalendarView.svelte';
	import WeekView from '$lib/components/schedule/WeekView.svelte';
	import DayView from '$lib/components/schedule/DayView.svelte';
	import LoadTemplateModal from '$lib/components/schedule/LoadTemplateModal.svelte';

	let showCreateModal = false;
	let showLoadModal = false;
	let showLibrary = true; // Show library by default

	onMount(() => {
		navigationStore.setActiveTab('schedule');
		initializeScheduleStore();
	});

	function handleCreateClick() {
		showCreateModal = true;
	}

	function handleLoadClick() {
		// Will be implemented in Phase 7
		showLoadModal = true;
	}

	function handleViewClick() {
		if ($activeSchedule) {
			showLibrary = false;
			navigateToCalendar();
		}
	}

	async function handleScheduleSelect(schedule: StoredSchedule) {
		// Set as active and view calendar
		await setActiveSchedule(schedule.id);
		showLibrary = false;
		navigateToCalendar();
	}

	function handleBackToLibrary() {
		showLibrary = true;
	}

	function handleCreateModalClose() {
		showCreateModal = false;
	}

	function handleScheduleCreated(e: CustomEvent<StoredSchedule>) {
		showCreateModal = false;
		showLibrary = false;
	}

	function handleLoadModalClose() {
		showLoadModal = false;
	}

	function handleScheduleLoaded(e: CustomEvent<StoredSchedule>) {
		showLoadModal = false;
		showLibrary = false;
	}

	function handleWeekSelect(e: CustomEvent<number>) {
		navigateToWeek(e.detail);
	}

	function handleDaySelect(e: CustomEvent<number>) {
		navigateToDay(e.detail);
	}

	function handleExerciseEdit(e: CustomEvent<{ exerciseIndex: number }>) {
		// Will be implemented in Phase 6
		console.log('Edit exercise:', e.detail.exerciseIndex);
	}
</script>

{#if !showLibrary && $activeSchedule}
	<!-- Schedule views (Calendar -> Week -> Day drill-down) -->
	{#if $viewState.viewLevel === 'week'}
		<WeekView
			schedule={$activeSchedule}
			weekNumber={$viewState.selectedWeek}
			on:daySelect={handleDaySelect}
			on:back={() => navigateToCalendar()}
		/>
	{:else if $viewState.viewLevel === 'day'}
		<DayView
			schedule={$activeSchedule}
			weekNumber={$viewState.selectedWeek}
			dayNumber={$viewState.selectedDay}
			on:exerciseEdit={handleExerciseEdit}
			on:back={navigateBack}
		/>
	{:else}
		<!-- Calendar view -->
		<div class="flex flex-col h-full bg-slate-900">
			<!-- Back to library button -->
			<div class="px-4 pt-4 pb-2">
				<button
					on:click={handleBackToLibrary}
					class="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
					</svg>
					Back to Library
				</button>
			</div>
			<CalendarView schedule={$activeSchedule} on:weekSelect={handleWeekSelect} />
		</div>
	{/if}
{:else}
	<!-- Schedule library view (no active schedule or showing library) -->
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
{/if}

<!-- Create Schedule Modal -->
<CreateScheduleModal
	isOpen={showCreateModal}
	on:close={handleCreateModalClose}
	on:created={handleScheduleCreated}
/>

<!-- Load Template Modal -->
<LoadTemplateModal
	isOpen={showLoadModal}
	on:close={handleLoadModalClose}
	on:loaded={handleScheduleLoaded}
/>
