<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { userStore } from '$lib/stores/user';
	import { saveScheduleToDb, setActiveSchedule, navigateToWeek } from '$lib/stores/schedule';
	import { navigationStore } from '$lib/stores/navigation';
	import { generateWorkout, type EquipmentProfiles } from '$lib/engine/workout-generator';
	import type { QuestionnaireAnswers } from '$lib/engine/types';
	import type { StoredSchedule, DayMapping, Weekday } from '$lib/types/schedule';
	import QuickCustomize from './QuickCustomize.svelte';

	// Create default day mapping (consecutive days starting Monday)
	function createDefaultDayMapping(daysPerWeek: number): DayMapping {
		const mapping: DayMapping = {};
		for (let i = 1; i <= daysPerWeek; i++) {
			mapping[i.toString()] = ((i - 1) % 7) as Weekday;
		}
		return mapping;
	}

	export let isOpen: boolean;

	const dispatch = createEventDispatcher<{
		close: void;
		created: StoredSchedule;
	}>();

	// Get initial answers from user preferences
	$: initialAnswers = {
		goal: $userStore.preferences.goal,
		session_duration: $userStore.preferences.session_duration,
		experience_level: $userStore.preferences.experience_level,
		equipment_access: $userStore.preferences.equipment_access,
		training_frequency: $userStore.preferences.training_frequency,
		program_duration: $userStore.preferences.program_duration
	} as QuestionnaireAnswers;

	let answers: QuestionnaireAnswers = { ...initialAnswers };
	let startDate: string = new Date().toISOString().split('T')[0];
	let isGenerating = false;
	let error: string | null = null;

	// Reset state when modal opens/closes and manage swipe
	$: if (isOpen) {
		answers = { ...initialAnswers };
		startDate = new Date().toISOString().split('T')[0];
		isGenerating = false;
		error = null;
		navigationStore.disableSwipe();
	} else {
		navigationStore.enableSwipe();
	}

	function handleAnswersChange(e: CustomEvent<QuestionnaireAnswers>) {
		answers = e.detail;
	}

	function handleStartDateChange(e: CustomEvent<string>) {
		startDate = e.detail;
	}

	function handleClose() {
		dispatch('close');
	}

	async function handleGenerate() {
		isGenerating = true;
		error = null;

		try {
			// Build equipment profiles from user store (v2.1)
			const equipmentProfiles: EquipmentProfiles = {
				homeEquipment: $userStore.preferences.homeEquipment ?? [],
				gymEquipment: $userStore.preferences.gymEquipment ?? []
			};

			// Generate workout using the engine with location-based equipment
			const workout = generateWorkout(answers, undefined, equipmentProfiles);

			// Create StoredSchedule with metadata
			const storedSchedule: StoredSchedule = {
				...workout,
				scheduleMetadata: {
					isActive: true,
					startDate: startDate,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
					currentWeek: 1,
					currentDay: 1,
					dayMapping: createDefaultDayMapping(workout.daysPerWeek)
				}
			};

			// Save to IndexedDB and set as active
			await saveScheduleToDb(storedSchedule);
			await setActiveSchedule(storedSchedule.id);

			// Notify parent and navigate
			dispatch('created', storedSchedule);
			dispatch('close');
			navigateToWeek(1);
		} catch (e) {
			console.error('Failed to generate workout:', e);
			error = e instanceof Error ? e.message : 'Failed to generate workout. Please try again.';
		} finally {
			isGenerating = false;
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			handleClose();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			handleClose();
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 pb-20"
		on:click={handleBackdropClick}
	>
		<!-- Modal -->
		<div
			class="w-full max-w-sm bg-slate-800 rounded-xl flex flex-col max-h-[calc(100vh-1.5rem)] max-h-[calc(100dvh-1.5rem)]"
			on:click|stopPropagation
		>
			<!-- Header -->
			<div class="flex items-center justify-between px-4 py-3 border-b border-slate-700 flex-shrink-0">
				<h2 class="text-base font-semibold text-white">Create Schedule</h2>
				<button
					on:click={handleClose}
					class="p-1 text-slate-400 hover:text-white transition-colors"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>

			<!-- Content - scrollable -->
			<div class="flex-1 overflow-y-auto overscroll-contain px-3 py-2">
				{#if error}
					<div class="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg">
						<p class="text-sm text-red-300">{error}</p>
					</div>
				{/if}

				<QuickCustomize
					{answers}
					{startDate}
					on:change={handleAnswersChange}
					on:startDateChange={handleStartDateChange}
				/>
			</div>

			<!-- Footer - always visible -->
			<div class="px-4 py-3 border-t border-slate-700 flex-shrink-0">
				<button
					on:click={handleGenerate}
					disabled={isGenerating}
					class="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700
						   text-white text-sm font-medium rounded-lg transition-colors
						   disabled:opacity-50 disabled:cursor-not-allowed
						   flex items-center justify-center gap-2"
				>
					{#if isGenerating}
						<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
						Generating...
					{:else}
						Generate Schedule
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

