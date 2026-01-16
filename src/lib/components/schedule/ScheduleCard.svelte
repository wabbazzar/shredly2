<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { StoredSchedule } from '$lib/types/schedule';

	export let schedule: StoredSchedule;

	const dispatch = createEventDispatcher<{
		select: StoredSchedule;
		rename: { id: string; name: string };
		setActive: string;
		duplicate: string;
		download: StoredSchedule;
		delete: { id: string; name: string };
	}>();

	// Editing state
	let isEditing = false;
	let editValue = '';
	let inputEl: HTMLInputElement;

	// Overflow menu state
	let menuOpen = false;

	// Format date for display
	function formatDate(isoDate: string): string {
		const date = new Date(isoDate);
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric'
		});
	}

	// Calculate progress percentage
	function getProgress(): number {
		const totalDays = schedule.weeks * schedule.daysPerWeek;
		const completedDays =
			(schedule.scheduleMetadata.currentWeek - 1) * schedule.daysPerWeek +
			schedule.scheduleMetadata.currentDay -
			1;
		return Math.min(100, Math.round((completedDays / totalDays) * 100));
	}

	// Start editing the name
	function startEdit(e: Event) {
		e.preventDefault();
		e.stopPropagation();
		editValue = schedule.name;
		isEditing = true;
		// Focus synchronously for iOS keyboard support
		inputEl?.focus();
		inputEl?.select();
	}

	// Save the edited name
	function saveEdit() {
		isEditing = false;
		const trimmed = editValue.trim();
		if (trimmed && trimmed !== schedule.name) {
			dispatch('rename', { id: schedule.id, name: trimmed });
		}
	}

	// Handle keyboard in edit mode
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			saveEdit();
		} else if (e.key === 'Escape') {
			isEditing = false;
		}
	}

	// Toggle overflow menu
	function toggleMenu(e: Event) {
		e.stopPropagation();
		menuOpen = !menuOpen;
	}

	// Close menu when clicking outside
	function closeMenu() {
		menuOpen = false;
	}

	// Handle card click (select schedule)
	function handleCardClick() {
		if (!isEditing && !menuOpen) {
			dispatch('select', schedule);
		}
	}

	// Action handlers
	function handleSetActive(e: Event) {
		e.stopPropagation();
		dispatch('setActive', schedule.id);
	}

	function handleDuplicate(e: Event) {
		e.stopPropagation();
		menuOpen = false;
		dispatch('duplicate', schedule.id);
	}

	function handleDownload(e: Event) {
		e.stopPropagation();
		menuOpen = false;
		dispatch('download', schedule);
	}

	function handleDelete(e: Event) {
		e.stopPropagation();
		menuOpen = false;
		dispatch('delete', { id: schedule.id, name: schedule.name });
	}
</script>

<svelte:window on:click={closeMenu} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	on:click={handleCardClick}
	on:keydown={(e) => e.key === 'Enter' && handleCardClick()}
	role="button"
	tabindex="0"
	class="w-full bg-slate-700/50 lg:bg-slate-800 rounded-lg p-3 lg:p-4 text-left hover:bg-slate-700 transition-colors cursor-pointer relative"
>
	<!-- Header Row: Name + Actions -->
	<div class="flex items-center gap-2 mb-2">
		<!-- Active indicator -->
		{#if schedule.scheduleMetadata.isActive}
			<svg class="w-4 h-4 text-yellow-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
				<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
			</svg>
		{/if}

		<!-- Editable Name -->
		<div class="flex-1 min-w-0">
			<!-- Input (always rendered, toggled with CSS) -->
			<input
				bind:this={inputEl}
				bind:value={editValue}
				type="text"
				on:blur={saveEdit}
				on:keydown={handleKeydown}
				on:click|stopPropagation
				class="w-full bg-slate-600 text-white font-semibold text-sm lg:text-base rounded px-2 py-1
				       border border-indigo-500 outline-none focus:ring-1 focus:ring-indigo-400"
				class:hidden={!isEditing}
			/>

			<!-- Display (always rendered, toggled with CSS) -->
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<div
				on:pointerdown={startEdit}
				role="button"
				tabindex="-1"
				style="-webkit-tap-highlight-color: transparent; touch-action: manipulation; user-select: none;"
				class="flex items-center gap-1.5 group cursor-pointer truncate"
				class:hidden={isEditing}
			>
				<span class="font-semibold text-sm lg:text-base text-white truncate hover:text-indigo-400 transition-colors">
					{schedule.name}
				</span>
				<svg
					class="w-3 h-3 text-slate-500 group-hover:text-indigo-400 transition-colors flex-shrink-0"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
					/>
				</svg>
			</div>
		</div>

		<!-- Set Active Button (only for non-active) -->
		{#if !schedule.scheduleMetadata.isActive}
			<button
				on:click={handleSetActive}
				class="p-1.5 text-slate-400 hover:text-yellow-400 transition-colors flex-shrink-0"
				title="Set as active"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
					/>
				</svg>
			</button>
		{/if}

		<!-- Overflow Menu Button -->
		<div class="relative flex-shrink-0">
			<button
				on:click={toggleMenu}
				class="p-1.5 text-slate-400 hover:text-white transition-colors"
				title="More actions"
			>
				<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
					<circle cx="12" cy="6" r="2" />
					<circle cx="12" cy="12" r="2" />
					<circle cx="12" cy="18" r="2" />
				</svg>
			</button>

			<!-- Dropdown Menu -->
			{#if menuOpen}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					on:click|stopPropagation
					class="absolute right-0 top-full mt-1 bg-slate-700 rounded-lg shadow-xl border border-slate-600 py-1 z-50 min-w-[140px]"
				>
					<button
						on:click={handleDuplicate}
						class="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-600 hover:text-white transition-colors"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
							/>
						</svg>
						Duplicate
					</button>
					<button
						on:click={handleDownload}
						class="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-600 hover:text-white transition-colors"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
							/>
						</svg>
						Download
					</button>
					<hr class="my-1 border-slate-600" />
					<button
						on:click={handleDelete}
						class="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-slate-600 hover:text-red-300 transition-colors"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
							/>
						</svg>
						Delete
					</button>
				</div>
			{/if}
		</div>
	</div>

	<!-- Metadata Row -->
	<div class="flex items-center gap-2 text-xs text-slate-400 mb-2">
		<span>{schedule.weeks} weeks</span>
		<span class="text-slate-600">|</span>
		<span>{schedule.daysPerWeek}d/wk</span>
		<span class="text-slate-600">|</span>
		<span>Started {formatDate(schedule.scheduleMetadata.startDate)}</span>
	</div>

	<!-- Progress Bar -->
	<div class="w-full bg-slate-600 rounded-full h-1.5">
		<div
			class="bg-indigo-500 h-1.5 rounded-full transition-all"
			style="width: {getProgress()}%"
		></div>
	</div>
	<div class="flex items-center justify-between mt-1">
		<span class="text-xs text-slate-500">
			Week {schedule.scheduleMetadata.currentWeek}, Day {schedule.scheduleMetadata.currentDay}
		</span>
		<span class="text-xs text-slate-500">{getProgress()}%</span>
	</div>
</div>
