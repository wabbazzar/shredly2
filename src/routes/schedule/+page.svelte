<script lang="ts">
	import { onMount } from 'svelte';
	import { navigationStore } from '$lib/stores/navigation';
	import {
		initializeScheduleStore,
		activeSchedule,
		setActiveSchedule,
		viewState,
		showLibraryView,
		showDetailView,
		navigateToWeek,
		navigateToDay,
		navigateToCalendar
	} from '$lib/stores/schedule';
	import type { StoredSchedule } from '$lib/types/schedule';
	import ScheduleActions from '$lib/components/schedule/ScheduleActions.svelte';
	import ScheduleLibrary from '$lib/components/schedule/ScheduleLibrary.svelte';
	import CreateScheduleModal from '$lib/components/schedule/CreateScheduleModal.svelte';
	import LoadTemplateModal from '$lib/components/schedule/LoadTemplateModal.svelte';
	import CalendarView from '$lib/components/schedule/CalendarView.svelte';
	import WeekView from '$lib/components/schedule/WeekView.svelte';
	import DayView from '$lib/components/schedule/DayView.svelte';

	let showCreateModal = false;
	let showLoadModal = false;

	onMount(() => {
		navigationStore.setActiveTab('schedule');
		initializeScheduleStore();
	});

	function handleCreateClick() {
		showCreateModal = true;
	}

	function handleLoadClick() {
		showLoadModal = true;
	}

	function handleViewClick() {
		if ($activeSchedule) {
			showDetailView();
		}
	}

	async function handleScheduleSelect(schedule: StoredSchedule) {
		await setActiveSchedule(schedule.id);
		showDetailView();
	}

	function handleBackToLibrary() {
		showLibraryView();
	}

	function handleCreateModalClose() {
		showCreateModal = false;
	}

	function handleScheduleCreated(e: CustomEvent<StoredSchedule>) {
		showCreateModal = false;
		showDetailView();
	}

	function handleLoadModalClose() {
		showLoadModal = false;
	}

	function handleScheduleLoaded(e: CustomEvent<StoredSchedule>) {
		showLoadModal = false;
		showDetailView();
	}

	function handleWeekClick(e: CustomEvent<{ weekNumber: number }>) {
		navigateToWeek(e.detail.weekNumber);
	}

	function handleDayClick(e: CustomEvent<{ weekNumber: number; dayNumber: number }>) {
		navigateToDay(e.detail.weekNumber, e.detail.dayNumber);
	}

	function handleWeekBack() {
		navigateToCalendar();
	}

	function handleDayBack() {
		navigateToWeek($viewState.selectedWeek);
	}

	function handleScheduleUpdated(e: CustomEvent<StoredSchedule>) {
		// The store is already updated by saveScheduleToDb in the child component
		// The $activeSchedule reactive variable will automatically update
		// This handler exists for any additional side effects if needed
	}
</script>

<div class="h-full overflow-auto bg-slate-900 px-2 py-3 lg:px-8 lg:py-6">
	<div class="max-w-6xl mx-auto">
		{#if !$viewState.showLibrary && $activeSchedule}
			<!-- Schedule Detail View -->
			{#if $viewState.viewLevel === 'day'}
				<!-- Day View -->
				<section class="bg-slate-800 rounded-lg p-2 lg:p-4">
					<DayView
						schedule={$activeSchedule}
						weekNumber={$viewState.selectedWeek}
						dayNumber={$viewState.selectedDay}
						on:back={handleDayBack}
						on:scheduleUpdated={handleScheduleUpdated}
					/>
				</section>
			{:else if $viewState.viewLevel === 'week'}
				<!-- Week View -->
				<section class="bg-slate-800 rounded-lg p-2 lg:p-4">
					<WeekView
						schedule={$activeSchedule}
						weekNumber={$viewState.selectedWeek}
						on:dayClick={handleDayClick}
						on:back={handleWeekBack}
						on:scheduleUpdated={handleScheduleUpdated}
					/>
				</section>
			{:else}
				<!-- Calendar View (default) -->
				<!-- Header with icon and back button -->
				<div class="flex items-center justify-between mb-3 lg:mb-8">
					<div class="flex items-center gap-2 lg:gap-4">
						<!-- Calendar icon -->
						<div
							class="w-10 h-10 lg:w-20 lg:h-20 rounded-full bg-slate-700 flex items-center justify-center"
						>
							<svg class="w-5 h-5 lg:w-10 lg:h-10 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
							</svg>
						</div>
						<div>
							<h1 class="text-lg lg:text-3xl font-bold text-white">{$activeSchedule.name}</h1>
							<p class="text-slate-400 text-xs lg:text-base">
								{$activeSchedule.weeks} weeks | {$activeSchedule.daysPerWeek} days/week
							</p>
						</div>
					</div>

					<!-- Back button -->
					<button
						on:click={handleBackToLibrary}
						class="px-2 py-1 lg:px-4 lg:py-2 rounded-full text-xs lg:text-sm font-medium transition-colors
							   bg-slate-700 text-slate-300 hover:bg-slate-600"
					>
						All Schedules
					</button>
				</div>

				<!-- Calendar View -->
				<section class="bg-slate-800 rounded-lg p-2 lg:p-4">
					<CalendarView
						schedule={$activeSchedule}
						on:weekClick={handleWeekClick}
						on:dayClick={handleDayClick}
						on:scheduleUpdated={handleScheduleUpdated}
					/>
				</section>
			{/if}
		{:else}
			<!-- Schedule Library View -->
			<!-- Header with icon -->
			<div class="flex items-center justify-between mb-3 lg:mb-8">
				<div class="flex items-center gap-2 lg:gap-4">
					<!-- Calendar icon -->
					<div
						class="w-10 h-10 lg:w-20 lg:h-20 rounded-full bg-slate-700 flex items-center justify-center"
					>
						<svg class="w-5 h-5 lg:w-10 lg:h-10 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
						</svg>
					</div>
					<div>
						<h1 class="text-lg lg:text-3xl font-bold text-white">Schedule</h1>
						<p class="text-slate-400 text-xs lg:text-base">Manage your workout programs</p>
					</div>
				</div>
			</div>

			<!-- Actions -->
			<div class="mb-3 lg:mb-6">
				<ScheduleActions
					onCreateClick={handleCreateClick}
					onLoadClick={handleLoadClick}
					onViewClick={handleViewClick}
				/>
			</div>

			<!-- Schedule Library -->
			<section class="bg-slate-800 rounded-lg px-3 lg:px-4 divide-y divide-slate-700">
				<h2 class="text-xs font-semibold text-slate-500 uppercase tracking-wider py-2 lg:py-3">
					Your Schedules
				</h2>
				<div class="py-1 lg:py-2">
					<ScheduleLibrary onScheduleSelect={handleScheduleSelect} />
				</div>
			</section>
		{/if}

		<!-- Bottom padding for tab bar -->
		<div class="h-4"></div>
	</div>
</div>

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
