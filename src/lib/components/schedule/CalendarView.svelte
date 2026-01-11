<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { StoredSchedule, DayMapping, Weekday } from '$lib/types/schedule';
	import { saveScheduleToDb, activeSchedule } from '$lib/stores/schedule';

	export let schedule: StoredSchedule;

	const dispatch = createEventDispatcher<{
		weekClick: { weekNumber: number };
		dayClick: { weekNumber: number; dayNumber: number };
		scheduleUpdated: StoredSchedule;
	}>();

	// Use reactive schedule from store if available, otherwise use prop
	$: currentSchedule = $activeSchedule ?? schedule;

	const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

	// Drag state
	let draggedDay: number | null = null;
	let highlightedColumn: Weekday | null = null;

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

	// Get global day mapping (default: consecutive starting Monday)
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

	// Get week-specific overrides (stored by WeekView)
	type WeekOverrides = { [weekNum: string]: DayMapping };

	function getWeekOverrides(sched: StoredSchedule): WeekOverrides {
		return (sched.scheduleMetadata as any).weekOverrides || {};
	}

	// Get effective day mapping for a specific week (global + week override)
	function getEffectiveDayMapping(sched: StoredSchedule, weekNumber: number): DayMapping {
		const globalMapping = getGlobalDayMapping(sched);
		const overrides = getWeekOverrides(sched);
		const weekOverride = overrides[weekNumber.toString()];

		if (weekOverride) {
			return { ...globalMapping, ...weekOverride };
		}
		return globalMapping;
	}

	$: globalDayMapping = getGlobalDayMapping(currentSchedule);

	// Parse start date (as local date) and get the Monday of that week
	$: startDate = parseLocalDate(currentSchedule.scheduleMetadata.startDate);
	$: weekStart = getMondayOfWeek(startDate);

	// Calculate total calendar weeks needed
	$: totalCalendarWeeks = currentSchedule.weeks;

	// Generate month data for the calendar
	interface CalendarMonth {
		year: number;
		month: number; // 0-11
		name: string;
		weeks: CalendarWeek[];
	}

	interface CalendarWeek {
		weekNumber: number; // 1-based workout week
		dates: CalendarDate[];
	}

	interface CalendarDate {
		date: Date;
		dayOfMonth: number;
		isCurrentMonth: boolean;
		workoutDay: number | null; // Workout day number if this date has one
		weekday: Weekday;
	}

	function generateCalendarData(
		sched: StoredSchedule,
		mondayStart: Date,
		numWeeks: number
	): CalendarMonth[] {
		const months: CalendarMonth[] = [];

		let currentMonday = new Date(mondayStart);
		let currentMonthData: CalendarMonth | null = null;

		for (let week = 1; week <= numWeeks; week++) {
			// Get effective mapping for this specific week (considers weekOverrides)
			const weekMapping = getEffectiveDayMapping(sched, week);

			// Create reverse mapping: weekday -> workout day for this week
			const weekdayToWorkoutDay: { [key: number]: number } = {};
			for (const [dayNum, weekday] of Object.entries(weekMapping)) {
				weekdayToWorkoutDay[weekday] = parseInt(dayNum);
			}

			// Determine the month based on Monday of this week
			const mondayMonth = currentMonday.getMonth();
			const mondayYear = currentMonday.getFullYear();

			// Check if we need a new month header
			if (!currentMonthData || currentMonthData.month !== mondayMonth || currentMonthData.year !== mondayYear) {
				if (currentMonthData && currentMonthData.weeks.length > 0) {
					months.push(currentMonthData);
				}
				currentMonthData = {
					year: mondayYear,
					month: mondayMonth,
					name: currentMonday.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
					weeks: []
				};
			}

			const weekDates: CalendarDate[] = [];

			for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
				const date = new Date(currentMonday);
				date.setDate(currentMonday.getDate() + dayOfWeek);

				// Check if this weekday has a workout (using week-specific mapping)
				const workoutDay = weekdayToWorkoutDay[dayOfWeek as Weekday] ?? null;

				weekDates.push({
					date,
					dayOfMonth: date.getDate(),
					isCurrentMonth: date.getMonth() === mondayMonth,
					workoutDay,
					weekday: dayOfWeek as Weekday
				});
			}

			if (currentMonthData) {
				currentMonthData.weeks.push({
					weekNumber: week,
					dates: weekDates
				});
			}

			// Move to next week
			currentMonday.setDate(currentMonday.getDate() + 7);
		}

		// Don't forget the last month
		if (currentMonthData && currentMonthData.weeks.length > 0) {
			months.push(currentMonthData);
		}

		return months;
	}

	// Explicitly depend on currentSchedule for reactivity (includes weekOverrides)
	$: calendarData = generateCalendarData(currentSchedule, weekStart, totalCalendarWeeks);

	// Get workout day info
	function getWorkoutDayInfo(dayNumber: number): { focus: string; exerciseCount: number } | null {
		const day = currentSchedule.days[dayNumber.toString()];
		if (!day) return null;
		return {
			focus: day.focus,
			exerciseCount: day.exercises.length
		};
	}

	// Drag handlers
	function handleDragStart(e: DragEvent, dayNumber: number) {
		draggedDay = dayNumber;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', dayNumber.toString());
		}
	}

	function handleDragEnd() {
		draggedDay = null;
		highlightedColumn = null;
	}

	function handleDragOver(e: DragEvent, weekday: Weekday) {
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move';
		}
		highlightedColumn = weekday;
	}

	function handleDragLeave() {
		// Only clear if we're leaving the calendar area entirely
		// The column highlight will be updated by dragover on other cells
	}

	async function handleDrop(e: DragEvent, targetWeekday: Weekday) {
		e.preventDefault();
		highlightedColumn = null;

		if (draggedDay === null) return;

		// Check if another workout day already occupies this weekday (in global mapping)
		const newMapping = { ...globalDayMapping };
		const existingDayAtTarget = Object.entries(newMapping).find(
			([_, weekday]) => weekday === targetWeekday
		);

		if (existingDayAtTarget) {
			const existingDayNum = parseInt(existingDayAtTarget[0]);
			if (existingDayNum !== draggedDay) {
				// Swap the days
				const draggedDayWeekday = newMapping[draggedDay.toString()];
				newMapping[existingDayNum.toString()] = draggedDayWeekday;
			}
		}

		// Update the dragged day's weekday
		newMapping[draggedDay.toString()] = targetWeekday;

		// Save the updated global mapping (clears any week-specific overrides for consistency)
		const updatedSchedule: StoredSchedule = {
			...currentSchedule,
			scheduleMetadata: {
				...currentSchedule.scheduleMetadata,
				dayMapping: newMapping,
				weekOverrides: {}, // Clear week overrides when global mapping changes
				updatedAt: new Date().toISOString()
			} as any
		};

		await saveScheduleToDb(updatedSchedule);
		dispatch('scheduleUpdated', updatedSchedule);
		draggedDay = null;
	}

	// Click handlers
	function handleWeekClick(weekNumber: number) {
		dispatch('weekClick', { weekNumber });
	}

	function handleDayClick(weekNumber: number, dayNumber: number) {
		dispatch('dayClick', { weekNumber, dayNumber });
	}

	// Format date
	function formatDateRange(week: CalendarWeek): string {
		const first = week.dates[0].date;
		const last = week.dates[6].date;
		const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
		return `${first.toLocaleDateString('en-US', opts)} - ${last.toLocaleDateString('en-US', opts)}`;
	}
</script>

<div class="calendar-container">
	{#each calendarData as month}
		<!-- Month header -->
		<div class="month-header">
			{month.name}
		</div>

		<!-- Weekday header row -->
		<div class="weekday-header">
			{#each WEEKDAYS as day, i}
				<div
					class="weekday-cell"
					class:highlighted={highlightedColumn === i}
				>
					{day}
				</div>
			{/each}
		</div>

		<!-- Calendar weeks -->
		{#each month.weeks as week}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="week-row"
				on:click={() => handleWeekClick(week.weekNumber)}
			>
				<!-- Week label -->
				<div class="week-label">
					<span class="week-num">W{week.weekNumber}</span>
					<span class="week-range">{formatDateRange(week)}</span>
				</div>

				<!-- Day cells -->
				<div class="week-cells">
					{#each week.dates as calDate, i}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="day-cell"
							class:highlighted={highlightedColumn === i}
							class:has-workout={calDate.workoutDay !== null}
							class:dragging={draggedDay === calDate.workoutDay}
							class:other-month={!calDate.isCurrentMonth}
							on:dragover={(e) => handleDragOver(e, i as Weekday)}
							on:dragleave={handleDragLeave}
							on:drop={(e) => handleDrop(e, i as Weekday)}
							on:click|stopPropagation={() => calDate.workoutDay && handleDayClick(week.weekNumber, calDate.workoutDay)}
						>
							<span class="date-num" class:muted={!calDate.isCurrentMonth}>{calDate.dayOfMonth}</span>

							{#if calDate.workoutDay !== null}
								{@const dayInfo = getWorkoutDayInfo(calDate.workoutDay)}
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<div
									class="workout-badge"
									draggable="true"
									on:dragstart={(e) => handleDragStart(e, calDate.workoutDay!)}
									on:dragend={handleDragEnd}
									on:click|stopPropagation={() => handleDayClick(week.weekNumber, calDate.workoutDay!)}
								>
									<span class="day-label">D{calDate.workoutDay}</span>
									{#if dayInfo}
										<span class="day-focus">{dayInfo.focus}</span>
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/each}
	{/each}

	<!-- Drag indicator -->
	{#if draggedDay !== null && highlightedColumn !== null}
		<div class="drag-hint">
			Drop to assign Day {draggedDay} to {WEEKDAYS[highlightedColumn]} for all weeks
		</div>
	{/if}
</div>

<style>
	.calendar-container {
		width: 100%;
		max-width: 100%;
		overflow-x: hidden;
		user-select: none;
	}

	.month-header {
		font-size: 0.875rem;
		font-weight: 600;
		color: white;
		padding: 0.75rem 0 0.5rem;
		border-bottom: 1px solid rgb(51 65 85); /* slate-700 */
	}

	.weekday-header {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: 1px;
		padding: 0.375rem 0;
	}

	.weekday-cell {
		text-align: center;
		font-size: 0.5rem;
		font-weight: 500;
		color: rgb(148 163 184); /* slate-400 */
		text-transform: uppercase;
		padding: 0.125rem;
		transition: background-color 0.15s;
		min-width: 0;
	}

	.weekday-cell.highlighted {
		background-color: rgba(99, 102, 241, 0.3); /* indigo-500/30 */
		color: white;
	}

	.week-row {
		border-bottom: 1px solid rgb(51 65 85); /* slate-700 */
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.week-row:hover {
		background-color: rgba(51, 65, 85, 0.5); /* slate-700/50 */
	}

	.week-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 0;
		font-size: 0.625rem;
		color: rgb(148 163 184); /* slate-400 */
	}

	.week-num {
		font-weight: 600;
		color: rgb(99 102 241); /* indigo-500 */
		min-width: 1.5rem;
	}

	.week-range {
		color: rgb(100 116 139); /* slate-500 */
	}

	.week-cells {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: 1px;
	}

	.day-cell {
		min-height: 3rem;
		min-width: 0;
		padding: 0.125rem;
		background-color: rgb(30 41 59); /* slate-800 */
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		transition: background-color 0.15s;
		position: relative;
		overflow: hidden;
	}

	.day-cell.highlighted {
		background-color: rgba(99, 102, 241, 0.2); /* indigo-500/20 */
	}

	.day-cell.has-workout {
		background-color: rgb(51 65 85); /* slate-700 */
	}

	.day-cell.has-workout.highlighted {
		background-color: rgba(99, 102, 241, 0.4); /* indigo-500/40 */
	}

	.day-cell.dragging {
		opacity: 0.5;
	}

	.day-cell.other-month {
		background-color: rgb(15 23 42); /* slate-900 */
	}

	.date-num {
		font-size: 0.625rem;
		color: rgb(100 116 139); /* slate-500 */
	}

	.date-num.muted {
		color: rgb(71 85 105); /* slate-600 */
	}

	.workout-badge {
		background-color: rgb(99 102 241); /* indigo-500 */
		border-radius: 0.125rem;
		padding: 0.0625rem 0.125rem;
		cursor: grab;
		display: flex;
		flex-direction: column;
		gap: 0;
		max-width: 100%;
		overflow: hidden;
	}

	.workout-badge:active {
		cursor: grabbing;
	}

	.day-label {
		font-size: 0.5rem;
		font-weight: 600;
		color: white;
		line-height: 1.2;
	}

	.day-focus {
		font-size: 0.4375rem;
		color: rgba(255, 255, 255, 0.8);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		line-height: 1.2;
	}

	.drag-hint {
		position: fixed;
		bottom: 5rem;
		left: 50%;
		transform: translateX(-50%);
		background-color: rgb(30 41 59); /* slate-800 */
		border: 1px solid rgb(99 102 241); /* indigo-500 */
		border-radius: 0.5rem;
		padding: 0.5rem 1rem;
		font-size: 0.75rem;
		color: white;
		z-index: 50;
		white-space: nowrap;
	}

	/* Larger screens */
	@media (min-width: 640px) {
		.month-header {
			font-size: 1rem;
			padding: 1rem 0 0.75rem;
		}

		.weekday-header {
			padding: 0.5rem 0;
		}

		.weekday-cell {
			font-size: 0.75rem;
			padding: 0.25rem;
		}

		.week-label {
			font-size: 0.75rem;
			padding: 0.5rem 0;
		}

		.day-cell {
			min-height: 4rem;
			padding: 0.375rem;
		}

		.date-num {
			font-size: 0.75rem;
		}

		.workout-badge {
			padding: 0.25rem 0.375rem;
			border-radius: 0.25rem;
		}

		.day-label {
			font-size: 0.75rem;
		}

		.day-focus {
			font-size: 0.625rem;
		}
	}

	@media (min-width: 1024px) {
		.day-cell {
			min-height: 5rem;
		}
	}
</style>
