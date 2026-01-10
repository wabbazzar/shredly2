<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { userStore } from '$lib/stores/user';
	import { saveScheduleToDb, setActiveSchedule, navigateToCalendar } from '$lib/stores/schedule';
	import { generateWorkout } from '$lib/engine/workout-generator';
	import type { QuestionnaireAnswers } from '$lib/engine/types';
	import type { StoredSchedule } from '$lib/types/schedule';
	import QuickCustomize from './QuickCustomize.svelte';

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

	// Reset state when modal opens
	$: if (isOpen) {
		answers = { ...initialAnswers };
		startDate = new Date().toISOString().split('T')[0];
		isGenerating = false;
		error = null;
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
			// Generate workout using the engine
			const workout = generateWorkout(answers);

			// Create StoredSchedule with metadata
			const storedSchedule: StoredSchedule = {
				...workout,
				scheduleMetadata: {
					isActive: true,
					startDate: startDate,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
					currentWeek: 1,
					currentDay: 1
				}
			};

			// Save to IndexedDB and set as active
			await saveScheduleToDb(storedSchedule);
			await setActiveSchedule(storedSchedule.id);

			// Notify parent and navigate
			dispatch('created', storedSchedule);
			dispatch('close');
			navigateToCalendar();
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
		class="fixed inset-0 bg-black/60 z-50 flex items-end justify-center"
		on:click={handleBackdropClick}
	>
		<!-- Modal -->
		<div
			class="w-full max-w-lg bg-slate-800 rounded-t-2xl max-h-[90vh] flex flex-col
				   animate-slide-up"
		>
			<!-- Header -->
			<div class="flex items-center justify-between p-4 border-b border-slate-700">
				<h2 class="text-lg font-semibold text-white">Create Schedule</h2>
				<button
					on:click={handleClose}
					class="p-1 text-slate-400 hover:text-white transition-colors"
				>
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-y-auto p-4">
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

			<!-- Footer -->
			<div class="p-4 border-t border-slate-700">
				<button
					on:click={handleGenerate}
					disabled={isGenerating}
					class="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700
						   text-white font-medium rounded-lg transition-colors
						   disabled:opacity-50 disabled:cursor-not-allowed
						   flex items-center justify-center gap-2"
				>
					{#if isGenerating}
						<div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
						Generating...
					{:else}
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M13 10V3L4 14h7v7l9-11h-7z"
							/>
						</svg>
						Generate Schedule
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	@keyframes slide-up {
		from {
			transform: translateY(100%);
		}
		to {
			transform: translateY(0);
		}
	}

	.animate-slide-up {
		animation: slide-up 0.3s ease-out;
	}
</style>
