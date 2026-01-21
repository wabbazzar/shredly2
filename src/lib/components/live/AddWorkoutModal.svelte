<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { StoredSchedule } from '$lib/types/schedule';

	export let isOpen: boolean;
	export let schedule: StoredSchedule | null;

	const dispatch = createEventDispatcher<{
		confirm: { weekNumber: number; dayNumber: number; date: string };
		cancel: void;
	}>();

	let selectedWeek = 1;
	let selectedDay = 1;
	let selectedDate = '';
	let showCalendar = false;

	// Calendar state
	let viewMonth: number;
	let viewYear: number;

	const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

	// Reset when modal opens
	$: if (isOpen && schedule) {
		selectedWeek = 1;
		selectedDay = 1;
		showCalendar = false;
		// Default to today's date
		const today = new Date();
		const year = today.getFullYear();
		const month = String(today.getMonth() + 1).padStart(2, '0');
		const day = String(today.getDate()).padStart(2, '0');
		selectedDate = `${year}-${month}-${day}`;
		viewMonth = today.getMonth();
		viewYear = today.getFullYear();
	}

	// Generate options
	$: weekOptions = schedule ? Array.from({ length: schedule.weeks }, (_, i) => i + 1) : [];
	$: dayOptions = schedule ? Array.from({ length: schedule.daysPerWeek }, (_, i) => i + 1) : [];

	// Get day focus from schedule
	function getDayFocus(dayNum: number): string {
		if (!schedule || !schedule.days[dayNum.toString()]) return '';
		return schedule.days[dayNum.toString()].focus || '';
	}

	// Today's date for max constraint
	$: today = new Date();

	// Generate calendar days for current view month
	interface CalendarDay {
		date: Date;
		dayOfMonth: number;
		isCurrentMonth: boolean;
		isToday: boolean;
		isSelected: boolean;
		isFuture: boolean;
	}

	function generateCalendarDays(year: number, month: number, selDate: string): CalendarDay[] {
		const days: CalendarDay[] = [];
		const todayDate = new Date();
		todayDate.setHours(0, 0, 0, 0);

		// Parse selected date for comparison
		const [selYear, selMonth, selDay] = selDate.split('-').map(Number);
		const selectedDateObj = new Date(selYear, selMonth - 1, selDay);

		// First day of month
		const firstDay = new Date(year, month, 1);

		// Find the Monday of the week containing the first day
		const startDate = new Date(firstDay);
		const firstDayOfWeek = firstDay.getDay();
		const daysToSubtract = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
		startDate.setDate(startDate.getDate() - daysToSubtract);

		// Generate 6 weeks of days
		for (let i = 0; i < 42; i++) {
			const date = new Date(startDate);
			date.setDate(startDate.getDate() + i);
			date.setHours(0, 0, 0, 0);

			days.push({
				date,
				dayOfMonth: date.getDate(),
				isCurrentMonth: date.getMonth() === month,
				isToday: date.getTime() === todayDate.getTime(),
				isSelected: date.getTime() === selectedDateObj.getTime(),
				isFuture: date > todayDate
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

	$: canConfirm = selectedWeek > 0 && selectedDay > 0 && selectedDate;

	function handleCancel() {
		dispatch('cancel');
	}

	function handleConfirm() {
		if (canConfirm) {
			dispatch('confirm', {
				weekNumber: selectedWeek,
				dayNumber: selectedDay,
				date: selectedDate
			});
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			handleCancel();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			if (showCalendar) {
				showCalendar = false;
			} else {
				handleCancel();
			}
		} else if (e.key === 'Enter' && canConfirm) {
			handleConfirm();
		}
	}

	function handleDateInputClick() {
		showCalendar = !showCalendar;
	}

	function handleDayClick(day: CalendarDay) {
		if (!day.isCurrentMonth || day.isFuture) return;

		const year = day.date.getFullYear();
		const month = String(day.date.getMonth() + 1).padStart(2, '0');
		const dayNum = String(day.date.getDate()).padStart(2, '0');
		selectedDate = `${year}-${month}-${dayNum}`;
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

{#if isOpen && schedule}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2"
		on:click={handleBackdropClick}
	>
		<div
			class="w-full max-w-sm bg-slate-800 rounded-xl flex flex-col max-h-[85vh]"
			on:click|stopPropagation
		>
			<!-- Header with actions (buttons at top to avoid bottom nav bar issues on mobile) -->
			<div class="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-700">
				<button
					on:click={handleCancel}
					class="p-2 text-slate-400 hover:text-white transition-colors rounded-lg"
					aria-label="Cancel"
				>
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
				<h2 class="text-base font-semibold text-white">Add Workout</h2>
				<button
					on:click={handleConfirm}
					disabled={!canConfirm}
					class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg
					       transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
					aria-label="Add workout"
				>
					Add
				</button>
			</div>

			<!-- Content (scrollable) -->
			<div class="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
				<!-- Week & Day selectors - side by side -->
				<div class="flex gap-3">
					<!-- Week selector -->
					<div class="flex-1">
						<label for="week-select" class="block text-xs font-medium text-slate-400 mb-1.5">
							Week
						</label>
						<select
							id="week-select"
							bind:value={selectedWeek}
							class="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
						>
							{#each weekOptions as week}
								<option value={week}>Week {week}</option>
							{/each}
						</select>
					</div>

					<!-- Day selector -->
					<div class="flex-1">
						<label for="day-select" class="block text-xs font-medium text-slate-400 mb-1.5">
							Day
						</label>
						<select
							id="day-select"
							bind:value={selectedDay}
							class="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
						>
							{#each dayOptions as day}
								<option value={day}>
									Day {day}{getDayFocus(day) ? ` - ${getDayFocus(day)}` : ''}
								</option>
							{/each}
						</select>
					</div>
				</div>

				<!-- Date selector -->
				<div>
					<label class="block text-xs font-medium text-slate-400 mb-1.5">
						Date
					</label>
					<button
						on:click={handleDateInputClick}
						class="w-full flex items-center justify-between px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-left hover:border-slate-500 transition-colors"
					>
						<span class="text-white text-sm">{formatDisplayDate(selectedDate)}</span>
						<svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
						</svg>
					</button>
				</div>

				<!-- Calendar dropdown -->
				{#if showCalendar}
					<div class="bg-slate-900 rounded-lg p-3 border border-slate-700">
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
							{#each WEEKDAYS as day}
								<div class="text-center text-xs font-medium py-1 text-slate-500">
									{day[0]}
								</div>
							{/each}
						</div>

						<!-- Calendar days -->
						<div class="grid grid-cols-7 gap-1">
							{#each calendarDays as day}
								<button
									on:click={() => handleDayClick(day)}
									disabled={!day.isCurrentMonth || day.isFuture}
									class="relative aspect-square flex items-center justify-center text-sm rounded-lg transition-colors
										{day.isCurrentMonth && !day.isFuture ? 'hover:bg-slate-700' : 'opacity-30 cursor-default'}
										{day.isSelected ? 'bg-indigo-600 text-white' : ''}
										{day.isToday && !day.isSelected ? 'ring-1 ring-indigo-400' : ''}
										{!day.isSelected && day.isCurrentMonth && !day.isFuture ? 'text-slate-300' : ''}"
								>
									{day.dayOfMonth}
								</button>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Info text -->
				<p class="text-xs text-slate-500">
					Log a workout you did on a specific date. You'll be able to enter your actual weights, reps, and other data after selecting.
				</p>
			</div>
		</div>
	</div>
{/if}
