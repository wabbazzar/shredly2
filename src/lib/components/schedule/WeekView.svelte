<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { StoredSchedule, DayMapping, Weekday } from '$lib/types/schedule';
	import type { ParameterizedDay, ParameterizedExercise, WeekParameters } from '$lib/engine/types';
	import { activeSchedule, saveScheduleToDb, viewState, navigateToWeek } from '$lib/stores/schedule';

	export let schedule: StoredSchedule;

	const dispatch = createEventDispatcher<{
		dayClick: { weekNumber: number; dayNumber: number };
		back: void;
		scheduleUpdated: StoredSchedule;
		setStartDate: void;
		allSchedules: void;
	}>();

	// Use reactive schedule from store if available, otherwise use prop
	$: currentSchedule = $activeSchedule ?? schedule;

	// Total weeks in program
	$: totalWeeks = currentSchedule.weeks || 4;
	$: allWeekNumbers = Array.from({ length: totalWeeks }, (_, i) => i + 1);

	// Currently selected week - synced from viewState store
	$: selectedWeek = $viewState.selectedWeek;

	const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

	// Expanded state for accordion - keyed by weekday number
	let expandedDays: Set<number> = new Set();

	// Expanded state for compound blocks - keyed by "weekday-exerciseIndex"
	let expandedCompounds: Set<string> = new Set();

	// Check if any day is expanded (for scroll control)
	$: hasExpandedDay = expandedDays.size > 0;

	function toggleExpanded(weekday: number) {
		if (expandedDays.has(weekday)) {
			expandedDays.delete(weekday);
		} else {
			expandedDays.add(weekday);
		}
		expandedDays = expandedDays; // trigger reactivity
	}

	function toggleCompoundExpanded(weekday: number, exerciseIndex: number) {
		const key = `${weekday}-${exerciseIndex}`;
		if (expandedCompounds.has(key)) {
			expandedCompounds.delete(key);
		} else {
			expandedCompounds.add(key);
		}
		expandedCompounds = expandedCompounds; // trigger reactivity
	}

	// Drag state for day reordering
	let draggedWeekday: Weekday | null = null;
	let highlightedWeekday: Weekday | null = null;

	// Parse YYYY-MM-DD string as local date (not UTC)
	// This avoids timezone issues where '2026-01-12' becomes Jan 11 in US timezones
	function parseLocalDate(dateString: string): Date {
		const [year, month, day] = dateString.split('-').map(Number);
		return new Date(year, month - 1, day);
	}

	// Get Monday of the week containing a date
	function getMondayOfWeek(date: Date): Date {
		const d = new Date(date);
		const day = d.getDay();
		// JavaScript: 0=Sunday, 1=Monday, ... 6=Saturday
		// We want Monday as 0
		const diff = day === 0 ? -6 : 1 - day;
		d.setDate(d.getDate() + diff);
		d.setHours(0, 0, 0, 0);
		return d;
	}

	// Get base day mapping (global, for all weeks)
	function getGlobalDayMapping(sched: StoredSchedule): DayMapping {
		if (sched.scheduleMetadata.dayMapping) {
			return sched.scheduleMetadata.dayMapping;
		}
		// Default: days 1, 2, 3... map to Mon, Tue, Wed...
		const mapping: DayMapping = {};
		for (let i = 1; i <= sched.daysPerWeek; i++) {
			mapping[i.toString()] = ((i - 1) % 7) as Weekday;
		}
		return mapping;
	}

	// Get week-specific day mapping override (stored as weekOverrides in scheduleMetadata)
	// This allows a specific week to have different day assignments than the global mapping
	type WeekOverrides = { [weekNum: string]: DayMapping };

	function getWeekOverrides(sched: StoredSchedule): WeekOverrides {
		return (sched.scheduleMetadata as any).weekOverrides || {};
	}

	function getEffectiveDayMapping(sched: StoredSchedule, week: number): DayMapping {
		const globalMapping = getGlobalDayMapping(sched);
		const overrides = getWeekOverrides(sched);
		const weekOverride = overrides[week.toString()];

		if (weekOverride) {
			return { ...globalMapping, ...weekOverride };
		}
		return globalMapping;
	}

	// Parse start date and get program start Monday
	$: startDate = parseLocalDate(currentSchedule.scheduleMetadata.startDate);
	$: programStart = getMondayOfWeek(startDate);

	// Get workout day numbers (1 to daysPerWeek)
	$: workoutDayNumbers = (() => {
		const days: number[] = [];
		for (let i = 1; i <= currentSchedule.daysPerWeek; i++) {
			days.push(i);
		}
		return days;
	})();

	// Generate 7 days for a specific week
	interface WeekDay {
		weekday: Weekday;
		weekdayShort: string;
		date: Date;
		workoutDay: number | null;
		dayData: ParameterizedDay | null;
	}

	function getWeekDays(weekNum: number): WeekDay[] {
		const dayMapping = getEffectiveDayMapping(currentSchedule, weekNum);

		// Build reverse mapping: weekday index -> workout day number
		const weekdayToWorkoutDay: { [key: number]: number } = {};
		for (const [dayNum, weekday] of Object.entries(dayMapping)) {
			const dayNumber = parseInt(dayNum);
			if (workoutDayNumbers.includes(dayNumber)) {
				weekdayToWorkoutDay[weekday] = dayNumber;
			}
		}

		// Get week start date
		const weekStartDate = new Date(programStart);
		weekStartDate.setDate(programStart.getDate() + (weekNum - 1) * 7);

		const days: WeekDay[] = [];
		for (let i = 0; i < 7; i++) {
			const date = new Date(weekStartDate);
			date.setDate(weekStartDate.getDate() + i);

			const workoutDayNum = weekdayToWorkoutDay[i] ?? null;
			const dayData = workoutDayNum ? currentSchedule.days[workoutDayNum.toString()] : null;

			days.push({
				weekday: i as Weekday,
				weekdayShort: WEEKDAYS[i],
				date,
				workoutDay: workoutDayNum,
				dayData
			});
		}
		return days;
	}

	// Build all weeks data
	interface WeekData {
		weekNumber: number;
		days: WeekDay[];
		dateRange: string;
	}

	// Get current week data (include currentSchedule as dependency to trigger re-render on schedule changes)
	$: currentWeekDays = currentSchedule ? getWeekDays(selectedWeek) : [];
	$: currentWeekDateRange = (() => {
		const days = currentWeekDays;
		const startD = days[0].date;
		const endD = days[6].date;
		const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
		return `${startD.toLocaleDateString('en-US', opts)} - ${endD.toLocaleDateString('en-US', opts)}`;
	})();

	// Format date for display
	function formatDate(date: Date): string {
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	// Get high-level exercise summary for a day
	function getExerciseSummary(day: ParameterizedDay): string[] {
		// Return just the exercise names for the list
		return day.exercises.map(ex => ex.name);
	}

	// Check if exercise is a compound block parent
	function isCompoundBlock(exercise: ParameterizedExercise): boolean {
		return ['emom', 'amrap', 'circuit', 'interval'].includes(exercise.category);
	}

	// Get display name for compound blocks
	function getCompoundBlockLabel(exercise: ParameterizedExercise): string {
		const labels: Record<string, string> = {
			emom: 'EMOM',
			amrap: 'AMRAP',
			circuit: 'Circuit',
			interval: 'Interval'
		};
		return labels[exercise.category] || exercise.category;
	}

	// Format exercise parameters for display (high-level)
	function formatExerciseParams(exercise: ParameterizedExercise, week: number): string {
		const weekKey = `week${week}` as keyof ParameterizedExercise;
		const params = exercise[weekKey] as WeekParameters | undefined;
		if (!params) return '';

		// Compound blocks: no params shown (just the type label)
		if (isCompoundBlock(exercise)) {
			return '';
		}

		const parts: string[] = [];
		if (params.sets && params.reps) {
			parts.push(`${params.sets}x${params.reps}`);
		} else if (params.work_time_minutes) {
			if (params.work_time_unit === 'seconds') {
				parts.push(`${Math.round(params.work_time_minutes * 60)}s`);
			} else {
				parts.push(`${params.work_time_minutes}min`);
			}
		}
		return parts.join(' ');
	}

	// Build weekday to workout day mapping for current week (needed for drag)
	$: currentWeekdayToWorkoutDay = (() => {
		const dayMapping = getEffectiveDayMapping(currentSchedule, selectedWeek);
		const mapping: { [key: number]: number } = {};
		for (const [dayNum, weekday] of Object.entries(dayMapping)) {
			const dayNumber = parseInt(dayNum);
			if (workoutDayNumbers.includes(dayNumber)) {
				mapping[weekday] = dayNumber;
			}
		}
		return mapping;
	})();

	// Drag handlers
	function handleDragStart(e: DragEvent, weekday: Weekday) {
		draggedWeekday = weekday;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', weekday.toString());
		}
	}

	function handleDragEnd() {
		draggedWeekday = null;
		highlightedWeekday = null;
	}

	function handleDragOver(e: DragEvent, weekday: Weekday) {
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move';
		}
		highlightedWeekday = weekday;
	}

	function handleDragLeave() {
		// Highlight will be updated by dragover on other cells
	}

	async function handleDrop(e: DragEvent, targetWeekday: Weekday) {
		e.preventDefault();
		highlightedWeekday = null;

		if (draggedWeekday === null || draggedWeekday === targetWeekday) {
			draggedWeekday = null;
			return;
		}

		// Get current week's effective mapping
		const globalMapping = getGlobalDayMapping(currentSchedule);
		const weekOverrides = getWeekOverrides(currentSchedule);
		const currentWeekMapping = { ...globalMapping, ...(weekOverrides[selectedWeek.toString()] || {}) };

		// Find workout days at source and target weekdays
		const sourceWorkoutDay = currentWeekdayToWorkoutDay[draggedWeekday];
		const targetWorkoutDay = currentWeekdayToWorkoutDay[targetWeekday];

		// Build new week override
		const newWeekMapping: DayMapping = { ...currentWeekMapping };

		if (sourceWorkoutDay !== undefined && targetWorkoutDay !== undefined) {
			// Swap the weekdays
			newWeekMapping[sourceWorkoutDay.toString()] = targetWeekday;
			newWeekMapping[targetWorkoutDay.toString()] = draggedWeekday;
		} else if (sourceWorkoutDay !== undefined) {
			// Move source to target (target is rest day)
			newWeekMapping[sourceWorkoutDay.toString()] = targetWeekday;
		}
		// If neither has a workout day, nothing to do

		// Save week-specific override
		const updatedWeekOverrides: WeekOverrides = { ...weekOverrides };
		updatedWeekOverrides[selectedWeek.toString()] = newWeekMapping;

		const updatedSchedule: StoredSchedule = {
			...currentSchedule,
			scheduleMetadata: {
				...currentSchedule.scheduleMetadata,
				weekOverrides: updatedWeekOverrides,
				updatedAt: new Date().toISOString()
			} as any
		};

		await saveScheduleToDb(updatedSchedule);
		dispatch('scheduleUpdated', updatedSchedule);
		draggedWeekday = null;
	}

	// Click handlers
	function handleDayClick(weekNum: number, workoutDay: number) {
		dispatch('dayClick', { weekNumber: weekNum, dayNumber: workoutDay });
	}

	function handleBackClick() {
		dispatch('back');
	}

	function handleSetStartDate() {
		dispatch('setStartDate');
	}

	function handleAllSchedules() {
		dispatch('allSchedules');
	}
</script>

<div class="week-container" class:scrollable={hasExpandedDay}>
	<!-- Header row -->
	<div class="header-row">
		<button class="back-button" on:click={handleAllSchedules} aria-label="All schedules">
			<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
			</svg>
		</button>
		<button class="calendar-btn" on:click={handleSetStartDate} aria-label="Set start date">
			<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
			</svg>
		</button>
	</div>

	<!-- Week selector with date range -->
	<div class="week-row">
		<div class="week-selector">
			<span class="week-label">Week</span>
			{#each allWeekNumbers as weekNum}
				<button
					class="week-btn"
					class:active={selectedWeek === weekNum}
					on:click={() => navigateToWeek(weekNum)}
				>
					{weekNum}
				</button>
			{/each}
		</div>
		<span class="date-range">{currentWeekDateRange}</span>
	</div>

	<!-- Days list for selected week -->
	<div class="days-container">
		{#each currentWeekDays as day}
			{@const isRest = day.workoutDay === null}
			{@const dayExpanded = expandedDays.has(day.weekday)}
			{@const isDragging = draggedWeekday === day.weekday}
			{@const isHighlighted = highlightedWeekday === day.weekday}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="day-card"
				class:rest={isRest}
				class:expanded={dayExpanded}
				class:dragging={isDragging}
				class:highlighted={isHighlighted}
				draggable={!isRest}
				on:dragstart={(e) => !isRest && handleDragStart(e, day.weekday)}
				on:dragend={handleDragEnd}
				on:dragover={(e) => handleDragOver(e, day.weekday)}
				on:dragleave={handleDragLeave}
				on:drop={(e) => handleDrop(e, day.weekday)}
			>
				<!-- Header row -->
				<button
					class="day-header"
					on:click={() => {
						if (!isRest && day.workoutDay) {
							handleDayClick(selectedWeek, day.workoutDay);
						}
					}}
				>
					<span class="weekday-name">{day.weekdayShort}</span>
					<span class="date">{formatDate(day.date)}</span>
					{#if isRest}
						<span class="rest-label">Rest</span>
					{:else if day.dayData}
						<span class="focus-label">{day.dayData.focus}</span>
						<!-- Location indicator (v2.1) -->
						<span class="location-badge" class:gym={day.dayData.type === 'gym'} class:home={day.dayData.type === 'home'}>
							{#if day.dayData.type === 'gym'}
								<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
									<path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z"/>
								</svg>
							{:else}
								<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
									<path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
								</svg>
							{/if}
						</span>
					{/if}
					<!-- Expand/collapse button -->
					{#if !isRest && day.dayData}
						<button
							class="expand-btn"
							on:click|stopPropagation={() => toggleExpanded(day.weekday)}
							aria-label={dayExpanded ? 'Collapse exercises' : 'Expand exercises'}
						>
							<svg
								class="w-5 h-5 transition-transform"
								class:rotate-180={dayExpanded}
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
							</svg>
						</button>
					{/if}
				</button>

				<!-- Expandable exercises section -->
				{#if dayExpanded && !isRest && day.dayData}
					<div class="exercises-section">
						<ul class="exercise-list">
							{#each day.dayData.exercises as exercise, exIndex}
								{@const params = formatExerciseParams(exercise, selectedWeek)}
								{@const isCompound = isCompoundBlock(exercise)}
								{@const hasSubs = isCompound && exercise.sub_exercises && exercise.sub_exercises.length > 0}
								<li class="exercise-item" class:compound={isCompound}>
									<div class="exercise-row">
										<span class="exercise-name">
											{#if isCompound}
												{getCompoundBlockLabel(exercise)}
											{:else}
												{exercise.name}
											{/if}
										</span>
										<div class="exercise-actions">
											{#if params}
												<span class="exercise-params">{params}</span>
											{/if}
											{#if hasSubs}
												<button
													class="compound-expand-btn"
													on:click|stopPropagation={() => toggleCompoundExpanded(day.weekday, exIndex)}
													aria-label={expandedCompounds.has(`${day.weekday}-${exIndex}`) ? 'Collapse sub-exercises' : 'Expand sub-exercises'}
												>
													<svg
														class="w-4 h-4 transition-transform"
														class:rotate-180={expandedCompounds.has(`${day.weekday}-${exIndex}`)}
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
													>
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
													</svg>
												</button>
											{/if}
										</div>
									</div>
									<!-- Sub-exercises -->
									{#if expandedCompounds.has(`${day.weekday}-${exIndex}`) && exercise.sub_exercises}
										<ul class="sub-exercise-list">
											{#each exercise.sub_exercises as subEx}
												<li class="sub-exercise-item">
													<span class="sub-exercise-name">{subEx.name}</span>
												</li>
											{/each}
										</ul>
									{/if}
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>
		{/each}
	</div>

	<!-- Drag indicator -->
	{#if draggedWeekday !== null && highlightedWeekday !== null}
		<div class="drag-hint">
			Swap days for Week {selectedWeek}
		</div>
	{/if}
</div>

<style>
	.week-container {
		width: 100%;
		min-height: 100%;
		user-select: none;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.week-container.scrollable {
		overflow-y: auto;
	}

	/* Header row */
	.header-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.back-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
		background: rgb(51 65 85);
		border: none;
		border-radius: 0.5rem;
		color: rgb(148 163 184);
		cursor: pointer;
		transition: all 0.15s;
		flex-shrink: 0;
	}

	.back-button:hover {
		background: rgb(71 85 105);
		color: white;
	}

	.calendar-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
		background: rgb(51 65 85);
		border: none;
		border-radius: 0.5rem;
		color: rgb(99 102 241);
		cursor: pointer;
		transition: all 0.15s;
		flex-shrink: 0;
	}

	.calendar-btn:hover {
		background: rgb(71 85 105);
		color: rgb(129 140 248);
	}

	/* Week row with selector and date range */
	.week-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.date-range {
		font-size: 0.75rem;
		color: rgb(100 116 139);
		flex-shrink: 0;
	}

	/* Week selector */
	.week-selector {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		flex-wrap: wrap;
	}

	.week-label {
		font-size: 0.875rem;
		font-weight: 600;
		color: white;
		margin-right: 0.125rem;
	}

	.week-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 2.25rem;
		height: 2.25rem;
		padding: 0.375rem;
		background: rgb(51 65 85);
		border: 2px solid transparent;
		border-radius: 0.5rem;
		color: rgb(148 163 184);
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s;
	}

	.week-btn:hover {
		background: rgb(71 85 105);
		color: white;
	}

	.week-btn.active {
		background: rgb(99 102 241);
		border-color: rgb(129 140 248);
		color: white;
	}

	/* Days list */
	.days-container {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		flex: 1;
	}

	.day-card {
		display: flex;
		flex-direction: column;
		background: rgb(30 41 59);
		border-radius: 0.5rem;
		overflow: hidden;
		transition: all 0.15s;
	}

	.day-card.rest {
		background: rgb(15 23 42);
	}

	.day-card.dragging {
		opacity: 0.5;
	}

	.day-card.highlighted {
		background: rgba(99, 102, 241, 0.2);
		outline: 2px solid rgb(99 102 241);
	}

	/* Header row */
	.day-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.875rem 1rem;
		background: transparent;
		border: none;
		width: 100%;
		text-align: left;
		cursor: pointer;
		transition: background 0.15s;
		min-height: 3.5rem;
	}

	/* Only apply hover on devices that support it (not touch) */
	@media (hover: hover) {
		.day-card:not(.rest) .day-header:hover {
			background: rgb(51 65 85);
		}
	}

	.day-card.rest .day-header {
		cursor: default;
	}

	.weekday-name {
		font-size: 1rem;
		font-weight: 600;
		color: white;
		min-width: 2.5rem;
	}

	.date {
		font-size: 0.875rem;
		color: rgb(148 163 184);
		min-width: 4rem;
	}

	.focus-label {
		font-size: 1rem;
		font-weight: 500;
		color: rgb(129 140 248);
		flex: 1;
	}

	/* Location badge */
	.location-badge {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.25rem;
		border-radius: 0.25rem;
		flex-shrink: 0;
	}

	.location-badge.gym {
		background: rgb(67 56 202 / 0.3);
		color: rgb(165 180 252);
	}

	.location-badge.home {
		background: rgb(5 150 105 / 0.3);
		color: rgb(110 231 183);
	}

	.rest-label {
		font-size: 1rem;
		font-weight: 500;
		color: rgb(100 116 139);
		flex: 1;
	}

	.expand-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem;
		background: transparent;
		border: none;
		color: rgb(148 163 184);
		cursor: pointer;
		border-radius: 0.375rem;
		transition: all 0.15s;
		min-width: 44px;
		min-height: 44px;
	}

	.expand-btn:hover {
		background: rgb(51 65 85);
		color: white;
	}

	.rotate-180 {
		transform: rotate(180deg);
	}

	/* Expandable exercises section */
	.exercises-section {
		padding: 0.75rem 1rem;
		padding-left: 3rem;
		background: rgb(15 23 42);
		border-top: 1px solid rgb(51 65 85);
	}

	.exercise-list {
		list-style: none;
		margin: 0;
		padding: 0;
		width: 100%;
	}

	.exercise-item {
		display: flex;
		flex-direction: column;
		padding: 0.375rem 0;
		font-size: 0.9375rem;
		color: rgb(203 213 225);
	}

	.exercise-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
	}

	.exercise-name {
		flex: 1;
		line-height: 1.4;
	}

	.exercise-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.exercise-item.compound .exercise-name {
		color: rgb(129 140 248);
		font-weight: 500;
		font-size: 0.8125rem;
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}

	.compound-expand-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.25rem;
		background: transparent;
		border: none;
		color: rgb(129 140 248);
		cursor: pointer;
		border-radius: 0.25rem;
		transition: all 0.15s;
	}

	.compound-expand-btn:hover {
		background: rgb(51 65 85);
		color: rgb(165 180 252);
	}

	.sub-exercise-list {
		list-style: none;
		margin: 0.5rem 0 0 0;
		padding: 0 0 0 1rem;
		border-left: 2px solid rgb(99 102 241 / 0.3);
	}

	.sub-exercise-item {
		padding: 0.25rem 0;
		font-size: 0.8125rem;
		color: rgb(148 163 184);
	}

	.sub-exercise-name {
		line-height: 1.4;
	}

	.exercise-params {
		flex-shrink: 0;
		font-size: 0.8125rem;
		font-weight: 600;
		color: rgb(199 210 254);
		background: rgb(67 56 202 / 0.3);
		padding: 0.25rem 0.5rem;
		border-radius: 0.25rem;
	}

	/* Drag hint */
	.drag-hint {
		position: fixed;
		bottom: 5rem;
		left: 50%;
		transform: translateX(-50%);
		background-color: rgb(30 41 59);
		border: 1px solid rgb(99 102 241);
		border-radius: 0.5rem;
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		color: white;
		z-index: 50;
		white-space: nowrap;
	}

	/* Desktop */
	@media (min-width: 1024px) {
		.header-row {
			margin-bottom: 1rem;
		}

		.week-row {
			margin-bottom: 1rem;
		}

		.date-range {
			font-size: 0.875rem;
		}

		.week-selector {
			gap: 0.5rem;
		}

		.week-label {
			font-size: 1rem;
		}

		.week-btn {
			min-width: 2.75rem;
			height: 2.75rem;
			font-size: 1rem;
		}

		.days-container {
			gap: 0.625rem;
		}

		.day-header {
			padding: 1rem 1.25rem;
			gap: 1rem;
		}

		.weekday-name {
			font-size: 1.125rem;
			min-width: 3rem;
		}

		.date {
			font-size: 1rem;
			min-width: 5rem;
		}

		.focus-label {
			font-size: 1.125rem;
		}

		.exercises-section {
			padding: 1rem 1.25rem;
			padding-left: 4rem;
		}

		.exercise-item {
			font-size: 1rem;
			padding: 0.5rem 0;
		}

		.exercise-item.compound .exercise-name {
			font-size: 0.875rem;
		}

		.exercise-params {
			font-size: 0.875rem;
		}
	}
</style>
