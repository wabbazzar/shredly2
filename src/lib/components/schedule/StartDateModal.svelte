<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { StoredSchedule, DayMapping, Weekday } from '$lib/types/schedule';

	export let isOpen: boolean;
	export let currentStartDate: string;
	export let schedule: StoredSchedule | null = null;

	const dispatch = createEventDispatcher<{
		close: void;
		save: string;
	}>();

	let selectedDate: string = currentStartDate;
	let showCalendar = false;

	// Calendar state
	let viewMonth: number;
	let viewYear: number;

	const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

	// Reset when modal opens
	$: if (isOpen) {
		selectedDate = currentStartDate;
		showCalendar = false;
		const [year, month] = currentStartDate.split('-').map(Number);
		viewMonth = month - 1;
		viewYear = year;
	}

	// Get the day mapping for workout days
	function getDayMapping(): DayMapping {
		if (schedule?.scheduleMetadata?.dayMapping) {
			return schedule.scheduleMetadata.dayMapping;
		}
		// Default mapping if none exists
		const mapping: DayMapping = {};
		const daysPerWeek = schedule?.daysPerWeek || 3;
		for (let i = 1; i <= daysPerWeek; i++) {
			mapping[i.toString()] = ((i - 1) % 7) as Weekday;
		}
		return mapping;
	}

	// Get weekdays that have workouts (0=Mon, 1=Tue, etc.)
	$: workoutWeekdays = new Set(Object.values(getDayMapping()));

	// Get program duration in weeks
	$: programWeeks = schedule?.weeks || 4;

	// Calculate the Monday of the week containing the selected start date
	function getMondayOfWeek(date: Date): Date {
		const d = new Date(date);
		const day = d.getDay();
		const diff = day === 0 ? -6 : 1 - day;
		d.setDate(d.getDate() + diff);
		d.setHours(0, 0, 0, 0);
		return d;
	}

	// Check if a date falls within the program duration
	function isDateInProgram(date: Date, startDateStr: string, weeks: number): boolean {
		const [year, month, day] = startDateStr.split('-').map(Number);
		const programStart = getMondayOfWeek(new Date(year, month - 1, day));

		const programEnd = new Date(programStart);
		programEnd.setDate(programStart.getDate() + (weeks * 7) - 1);
		programEnd.setHours(23, 59, 59, 999);

		return date >= programStart && date <= programEnd;
	}

	// Generate calendar days for current view month
	interface CalendarDay {
		date: Date;
		dayOfMonth: number;
		isCurrentMonth: boolean;
		isToday: boolean;
		isSelected: boolean;
		weekday: Weekday;
		hasWorkout: boolean;
	}

	function generateCalendarDays(year: number, month: number, selDate: string): CalendarDay[] {
		const days: CalendarDay[] = [];
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		// Parse selected date for comparison
		const [selYear, selMonth, selDay] = selDate.split('-').map(Number);
		const selectedDateObj = new Date(selYear, selMonth - 1, selDay);

		// First day of month
		const firstDay = new Date(year, month, 1);

		// Find the Monday of the week containing the first day
		let startDate = new Date(firstDay);
		const firstDayOfWeek = firstDay.getDay();
		const daysToSubtract = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
		startDate.setDate(startDate.getDate() - daysToSubtract);

		// Generate 6 weeks of days
		for (let i = 0; i < 42; i++) {
			const date = new Date(startDate);
			date.setDate(startDate.getDate() + i);

			// Calculate weekday (0=Mon, 6=Sun)
			const jsDay = date.getDay();
			const weekday = (jsDay === 0 ? 6 : jsDay - 1) as Weekday;

			// Check if this date has a workout (must be a workout weekday AND within program duration)
			const isWorkoutWeekday = workoutWeekdays.has(weekday);
			const inProgram = isDateInProgram(date, selDate, programWeeks);
			const hasWorkout = isWorkoutWeekday && inProgram;

			days.push({
				date,
				dayOfMonth: date.getDate(),
				isCurrentMonth: date.getMonth() === month,
				isToday: date.getTime() === today.getTime(),
				isSelected: date.getTime() === selectedDateObj.getTime(),
				weekday,
				hasWorkout
			});
		}

		return days;
	}

	// Regenerate calendar when month, year, or selected date changes
	$: calendarDays = showCalendar ? generateCalendarDays(viewYear, viewMonth, selectedDate) : [];

	$: monthYearLabel = new Date(viewYear, viewMonth).toLocaleDateString('en-US', {
		month: 'long',
		year: 'numeric'
	});

	function handleClose() {
		dispatch('close');
	}

	function handleSave() {
		dispatch('save', selectedDate);
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			handleClose();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			if (showCalendar) {
				showCalendar = false;
			} else {
				handleClose();
			}
		}
	}

	function handleDateInputClick() {
		showCalendar = !showCalendar;
	}

	function handleDayClick(day: CalendarDay) {
		if (!day.isCurrentMonth) return;

		const year = day.date.getFullYear();
		const month = String(day.date.getMonth() + 1).padStart(2, '0');
		const dayNum = String(day.date.getDate()).padStart(2, '0');
		selectedDate = `${year}-${month}-${dayNum}`;
		// Keep calendar open so user can see updated workout days
	}

	function prevMonth() {
		if (viewMonth === 0) {
			viewMonth = 11;
			viewYear--;
		} else {
			viewMonth--;
		}
	}

	function nextMonth() {
		if (viewMonth === 11) {
			viewMonth = 0;
			viewYear++;
		} else {
			viewMonth++;
		}
	}

	// Format date for display
	function formatDisplayDate(dateStr: string): string {
		const [year, month, day] = dateStr.split('-').map(Number);
		const date = new Date(year, month - 1, day);
		return date.toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
		on:click={handleBackdropClick}
	>
		<div
			class="w-full max-w-sm bg-slate-800 rounded-xl overflow-hidden"
			on:click|stopPropagation
		>
			<!-- Header -->
			<div class="flex items-center justify-between px-4 py-3 border-b border-slate-700">
				<h2 class="text-base font-semibold text-white">Set Start Date</h2>
				<button
					on:click={handleClose}
					class="p-1 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-700"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Content -->
			<div class="p-4">
				<p class="text-sm text-slate-400 mb-3">
					Choose when your program begins.
				</p>

				<!-- Date display/button -->
				<button
					on:click={handleDateInputClick}
					class="w-full flex items-center justify-between px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-left hover:border-slate-500 transition-colors"
				>
					<span class="text-white text-sm">{formatDisplayDate(selectedDate)}</span>
					<svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
					</svg>
				</button>

				<!-- Calendar dropdown -->
				{#if showCalendar}
					<div class="mt-3 bg-slate-900 rounded-lg p-3 border border-slate-700">
						<!-- Month navigation -->
						<div class="flex items-center justify-between mb-3">
							<button
								on:click={prevMonth}
								class="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
							>
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
								</svg>
							</button>
							<span class="text-sm font-medium text-white">{monthYearLabel}</span>
							<button
								on:click={nextMonth}
								class="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
							>
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
								</svg>
							</button>
						</div>

						<!-- Weekday headers -->
						<div class="grid grid-cols-7 gap-1 mb-1">
							{#each WEEKDAYS as day, i}
								<div class="text-center text-xs font-medium py-1" class:text-indigo-400={workoutWeekdays.has(i)} class:text-slate-500={!workoutWeekdays.has(i)}>
									{day[0]}
								</div>
							{/each}
						</div>

						<!-- Calendar days -->
						<div class="grid grid-cols-7 gap-1">
							{#each calendarDays as day}
								<button
									on:click={() => handleDayClick(day)}
									disabled={!day.isCurrentMonth}
									class="relative aspect-square flex items-center justify-center text-sm rounded-lg transition-colors
										{day.isCurrentMonth ? 'hover:bg-slate-700' : 'opacity-30 cursor-default'}
										{day.isSelected ? 'bg-indigo-600 text-white' : ''}
										{day.isToday && !day.isSelected ? 'ring-1 ring-indigo-400' : ''}
										{!day.isSelected && day.isCurrentMonth ? 'text-slate-300' : ''}"
								>
									{day.dayOfMonth}
									<!-- Workout day indicator -->
									{#if day.hasWorkout && day.isCurrentMonth && !day.isSelected}
										<span class="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-400"></span>
									{/if}
								</button>
							{/each}
						</div>

						<!-- Legend -->
						<div class="mt-3 pt-3 border-t border-slate-700 flex items-center gap-4 text-xs text-slate-400">
							<div class="flex items-center gap-1.5">
								<span class="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
								<span>Workout day</span>
							</div>
						</div>
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div class="px-4 py-3 border-t border-slate-700 flex gap-2">
				<button
					on:click={handleClose}
					class="flex-1 py-2 px-4 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium rounded-lg transition-colors"
				>
					Cancel
				</button>
				<button
					on:click={handleSave}
					class="flex-1 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
				>
					Save
				</button>
			</div>
		</div>
	</div>
{/if}
