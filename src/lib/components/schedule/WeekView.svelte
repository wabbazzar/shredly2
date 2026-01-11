<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { StoredSchedule, DayMapping, Weekday } from '$lib/types/schedule';
	import type { ParameterizedDay, ParameterizedExercise, WeekParameters } from '$lib/engine/types';
	import { saveScheduleToDb, activeSchedule } from '$lib/stores/schedule';

	export let schedule: StoredSchedule;
	export let weekNumber: number;

	const dispatch = createEventDispatcher<{
		dayClick: { weekNumber: number; dayNumber: number };
		back: void;
		scheduleUpdated: StoredSchedule;
	}>();

	// Use reactive schedule from store if available, otherwise use prop
	$: currentSchedule = $activeSchedule ?? schedule;

	const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
	const WEEKDAYS_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

	// Drag state
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

	$: dayMapping = getEffectiveDayMapping(currentSchedule, weekNumber);

	// Parse start date (as local date) and get the Monday of the week for this specific week
	$: startDate = parseLocalDate(currentSchedule.scheduleMetadata.startDate);
	$: programStart = getMondayOfWeek(startDate);
	$: weekStartDate = (() => {
		const d = new Date(programStart);
		d.setDate(d.getDate() + (weekNumber - 1) * 7);
		return d;
	})();

	// Workout day numbers are always 1 to daysPerWeek
	// (the schedule has days["1"], days["2"], etc. - same structure for all weeks)
	// Week number affects which week parameters are shown (week1, week2, etc.), not day keys
	$: workoutDaysInWeek = (() => {
		const daysPerWeek = currentSchedule.daysPerWeek;
		const days: number[] = [];
		for (let i = 1; i <= daysPerWeek; i++) {
			days.push(i);
		}
		return days;
	})();

	// Build reverse mapping: weekday index -> workout day number for this week
	$: weekdayToWorkoutDay = (() => {
		const mapping: { [key: number]: number } = {};
		for (const [dayNum, weekday] of Object.entries(dayMapping)) {
			const dayNumber = parseInt(dayNum);
			if (workoutDaysInWeek.includes(dayNumber)) {
				mapping[weekday] = dayNumber;
			}
		}
		return mapping;
	})();

	// Generate 7 days for display (Mon-Sun)
	interface WeekDay {
		weekday: Weekday;
		weekdayName: string;
		weekdayShort: string;
		date: Date;
		workoutDay: number | null;
		dayData: ParameterizedDay | null;
	}

	$: weekDays = (() => {
		const days: WeekDay[] = [];
		for (let i = 0; i < 7; i++) {
			const date = new Date(weekStartDate);
			date.setDate(weekStartDate.getDate() + i);

			const workoutDayNum = weekdayToWorkoutDay[i] ?? null;
			const dayData = workoutDayNum ? currentSchedule.days[workoutDayNum.toString()] : null;

			days.push({
				weekday: i as Weekday,
				weekdayName: WEEKDAYS_FULL[i],
				weekdayShort: WEEKDAYS[i],
				date,
				workoutDay: workoutDayNum,
				dayData
			});
		}
		return days;
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

	// Format exercise parameters for display (high-level)
	function formatExerciseParams(exercise: ParameterizedExercise, week: number): string {
		const weekKey = `week${week}` as keyof ParameterizedExercise;
		const params = exercise[weekKey] as WeekParameters | undefined;
		if (!params) return '';

		// Circuit/Interval: show rounds count
		if (exercise.category === 'circuit' || exercise.category === 'interval') {
			if (params.sets) {
				return `${params.sets}r`;
			}
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

	// Drag handlers for week-specific swapping
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
		// Column highlight will be updated by dragover on other cells
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
		const currentWeekMapping = { ...globalMapping, ...(weekOverrides[weekNumber.toString()] || {}) };

		// Find workout days at source and target weekdays
		const sourceWorkoutDay = weekdayToWorkoutDay[draggedWeekday];
		const targetWorkoutDay = weekdayToWorkoutDay[targetWeekday];

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
		updatedWeekOverrides[weekNumber.toString()] = newWeekMapping;

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
	function handleDayClick(workoutDay: number) {
		dispatch('dayClick', { weekNumber, dayNumber: workoutDay });
	}

	function handleBackClick() {
		dispatch('back');
	}

	// Format week date range
	$: weekDateRange = (() => {
		const endDate = new Date(weekStartDate);
		endDate.setDate(endDate.getDate() + 6);
		const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
		return `${weekStartDate.toLocaleDateString('en-US', opts)} - ${endDate.toLocaleDateString('en-US', opts)}`;
	})();
</script>

<div class="week-container">
	<!-- Header -->
	<div class="week-header">
		<button class="back-button" on:click={handleBackClick}>
			<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
			</svg>
			<span>Calendar</span>
		</button>
		<div class="week-title">
			<span class="week-num">Week {weekNumber}</span>
			<span class="week-range">{weekDateRange}</span>
		</div>
	</div>

	<!-- Days grid - responsive layout -->
	<div class="days-container">
		{#each weekDays as day}
			{@const isRest = day.workoutDay === null}
			{@const isDragging = draggedWeekday === day.weekday}
			{@const isHighlighted = highlightedWeekday === day.weekday}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="day-card"
				class:rest={isRest}
				class:dragging={isDragging}
				class:highlighted={isHighlighted}
				draggable={!isRest}
				on:dragstart={(e) => !isRest && handleDragStart(e, day.weekday)}
				on:dragend={handleDragEnd}
				on:dragover={(e) => handleDragOver(e, day.weekday)}
				on:dragleave={handleDragLeave}
				on:drop={(e) => handleDrop(e, day.weekday)}
				on:click={() => day.workoutDay && handleDayClick(day.workoutDay)}
			>
				<!-- Left/Top info section -->
				<div class="day-info">
					<div class="date-weekday">
						<span class="weekday-name">{day.weekdayShort}</span>
						<span class="date">{formatDate(day.date)}</span>
					</div>
					<div class="workout-title">
						{#if isRest}
							<span class="rest-label">Rest</span>
						{:else if day.dayData}
							<span class="focus-label">{day.dayData.focus}</span>
							<span class="day-type">({day.dayData.type})</span>
						{/if}
					</div>
				</div>

				<!-- Right/Bottom exercises section -->
				<div class="exercises-section">
					{#if isRest}
						<div class="rest-content">
							<span class="rest-icon">
								<svg class="w-6 h-6 lg:w-8 lg:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
								</svg>
							</span>
						</div>
					{:else if day.dayData}
						<ul class="exercise-list">
							{#each day.dayData.exercises.slice(0, 6) as exercise, i}
								{@const params = formatExerciseParams(exercise, weekNumber)}
								<li class="exercise-item">
									<span class="exercise-name">{exercise.name}</span>
									{#if params}
										<span class="exercise-params">{params}</span>
									{/if}
								</li>
							{/each}
							{#if day.dayData.exercises.length > 6}
								<li class="exercise-overflow">
									+{day.dayData.exercises.length - 6} more...
								</li>
							{/if}
						</ul>
					{/if}
				</div>
			</div>
		{/each}
	</div>

	<!-- Drag indicator -->
	{#if draggedWeekday !== null && highlightedWeekday !== null}
		<div class="drag-hint">
			Swap days for Week {weekNumber} only
		</div>
	{/if}
</div>

<style>
	.week-container {
		width: 100%;
		min-height: 100%;
		user-select: none;
	}

	.week-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.5rem 0 1rem;
		border-bottom: 1px solid rgb(51 65 85); /* slate-700 */
		margin-bottom: 1rem;
	}

	.back-button {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.375rem 0.75rem;
		background: rgb(51 65 85);
		border: none;
		border-radius: 0.5rem;
		color: rgb(148 163 184);
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.back-button:hover {
		background: rgb(71 85 105);
		color: white;
	}

	.week-title {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.week-num {
		font-size: 1.125rem;
		font-weight: 600;
		color: white;
	}

	.week-range {
		font-size: 0.75rem;
		color: rgb(148 163 184);
	}

	/* Mobile: vertical stack */
	.days-container {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.day-card {
		display: flex;
		flex-direction: row;
		background: rgb(30 41 59); /* slate-800 */
		border-radius: 0.5rem;
		overflow: hidden;
		cursor: pointer;
		transition: all 0.15s;
		min-height: 5rem;
	}

	.day-card:hover:not(.rest) {
		background: rgb(51 65 85);
	}

	.day-card.rest {
		cursor: default;
		background: rgb(15 23 42); /* slate-900 */
	}

	.day-card.dragging {
		opacity: 0.5;
	}

	.day-card.highlighted {
		background: rgba(99, 102, 241, 0.2);
		outline: 2px solid rgb(99 102 241);
	}

	/* Left info section (mobile) */
	.day-info {
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding: 0.75rem;
		background: rgb(51 65 85);
		min-width: 6rem;
		max-width: 6rem;
	}

	.day-card.rest .day-info {
		background: rgb(30 41 59);
	}

	.date-weekday {
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.weekday-name {
		font-size: 0.875rem;
		font-weight: 600;
		color: white;
	}

	.date {
		font-size: 0.625rem;
		color: rgb(148 163 184);
	}

	.workout-title {
		margin-top: 0.375rem;
	}

	.focus-label {
		font-size: 0.75rem;
		font-weight: 500;
		color: rgb(129 140 248); /* indigo-400 */
	}

	.day-type {
		font-size: 0.625rem;
		color: rgb(100 116 139);
		display: block;
	}

	.rest-label {
		font-size: 0.875rem;
		font-weight: 500;
		color: rgb(100 116 139);
	}

	/* Right exercises section (mobile) */
	.exercises-section {
		flex: 1;
		padding: 0.5rem 0.75rem;
		overflow: hidden;
		display: flex;
		align-items: center;
	}

	.rest-content {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		color: rgb(71 85 105);
	}

	.exercise-list {
		list-style: none;
		margin: 0;
		padding: 0;
		width: 100%;
	}

	.exercise-item {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		padding: 0.125rem 0;
		font-size: 0.75rem;
		color: rgb(203 213 225);
		gap: 0.5rem;
	}

	.exercise-name {
		flex: 1;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		line-height: 1.3;
	}

	.exercise-params {
		flex-shrink: 0;
		min-width: 3.5rem;
		text-align: center;
		font-size: 0.625rem;
		color: rgb(100 116 139);
		background: rgb(51 65 85);
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
	}

	.exercise-overflow {
		font-size: 0.625rem;
		color: rgb(100 116 139);
		padding-top: 0.25rem;
	}

	.drag-hint {
		position: fixed;
		bottom: 5rem;
		left: 50%;
		transform: translateX(-50%);
		background-color: rgb(30 41 59);
		border: 1px solid rgb(99 102 241);
		border-radius: 0.5rem;
		padding: 0.5rem 1rem;
		font-size: 0.75rem;
		color: white;
		z-index: 50;
		white-space: nowrap;
	}

	/* Desktop: horizontal grid */
	@media (min-width: 1024px) {
		.week-header {
			padding: 0.75rem 0 1.5rem;
		}

		.week-num {
			font-size: 1.5rem;
		}

		.week-range {
			font-size: 0.875rem;
		}

		.days-container {
			display: grid;
			grid-template-columns: repeat(7, 1fr);
			gap: 0.75rem;
		}

		.day-card {
			flex-direction: column;
			min-height: 20rem;
		}

		/* Top info section (desktop) */
		.day-info {
			min-width: unset;
			max-width: unset;
			padding: 0.75rem 1rem;
			min-height: 4rem;
		}

		.weekday-name {
			font-size: 1rem;
		}

		.date {
			font-size: 0.75rem;
		}

		.focus-label {
			font-size: 0.875rem;
		}

		.day-type {
			font-size: 0.75rem;
		}

		/* Bottom exercises section (desktop) */
		.exercises-section {
			flex: 1;
			padding: 0.75rem 1rem;
			align-items: flex-start;
		}

		.exercise-item {
			font-size: 0.8125rem;
			padding: 0.25rem 0;
		}

		.exercise-params {
			font-size: 0.6875rem;
		}

		.rest-content {
			justify-content: center;
			align-items: center;
			height: 100%;
		}
	}
</style>
