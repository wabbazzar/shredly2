<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { WorkoutSession } from '$lib/stores/history';

	export let isOpen: boolean;
	export let session: WorkoutSession | null;

	const dispatch = createEventDispatcher<{
		confirm: { newDate: string };
		cancel: void;
	}>();

	let selectedDate = '';
	let showCalendar = false;

	// Calendar state
	let viewMonth: number;
	let viewYear: number;

	const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

	// Reset when modal opens with new session
	$: if (isOpen && session) {
		selectedDate = session.date;
		showCalendar = false;
		const [year, month] = session.date.split('-').map(Number);
		viewMonth = month - 1;
		viewYear = year;
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

	$: hasChanged = selectedDate && session && selectedDate !== session.date;

	function handleCancel() {
		dispatch('cancel');
	}

	function handleConfirm() {
		if (hasChanged) {
			dispatch('confirm', { newDate: selectedDate });
		} else {
			dispatch('cancel');
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
		} else if (e.key === 'Enter' && hasChanged) {
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

{#if isOpen && session}
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
				<h2 class="text-base font-semibold text-white">Change Workout Date</h2>
				<button
					on:click={handleCancel}
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
					Week {session.weekNumber}, Day {session.dayNumber}
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
			</div>

			<!-- Footer -->
			<div class="px-4 py-3 border-t border-slate-700 flex gap-2">
				<button
					on:click={handleCancel}
					class="flex-1 py-2 px-4 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium rounded-lg transition-colors"
				>
					Cancel
				</button>
				<button
					on:click={handleConfirm}
					disabled={!hasChanged}
					class="flex-1 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
				>
					Save
				</button>
			</div>
		</div>
	</div>
{/if}
