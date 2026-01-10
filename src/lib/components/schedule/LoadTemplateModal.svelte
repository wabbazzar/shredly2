<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { saveScheduleToDb, setActiveSchedule, navigateToCalendar } from '$lib/stores/schedule';
	import type { ParameterizedWorkout } from '$lib/engine/types';
	import type { StoredSchedule } from '$lib/types/schedule';
	import DatePicker from './DatePicker.svelte';

	export let isOpen: boolean;

	const dispatch = createEventDispatcher<{
		close: void;
		loaded: StoredSchedule;
	}>();

	// Available templates (bundled in static/templates)
	const templates = [
		{
			id: 'muscle-gain-4week',
			name: 'Muscle Building - 4 Week',
			description: '4-day intermediate program focused on muscle gain',
			file: '/templates/muscle-gain-4week.json',
			weeks: 4,
			daysPerWeek: 4,
			difficulty: 'Intermediate'
		},
		{
			id: 'fat-loss-3week',
			name: 'Fat Loss - 3 Week',
			description: '3-day beginner program for fat loss',
			file: '/templates/fat-loss-3week.json',
			weeks: 3,
			daysPerWeek: 3,
			difficulty: 'Beginner'
		},
		{
			id: 'general-fitness-4week',
			name: 'General Fitness - 4 Week',
			description: '2-day beginner program for overall fitness',
			file: '/templates/general-fitness-4week.json',
			weeks: 4,
			daysPerWeek: 2,
			difficulty: 'Beginner'
		}
	];

	let selectedTemplate: (typeof templates)[0] | null = null;
	let startDate: string = new Date().toISOString().split('T')[0];
	let isLoading = false;
	let error: string | null = null;

	// Import from file
	let importFile: File | null = null;
	let importMode = false;

	// Reset when modal opens
	$: if (isOpen) {
		selectedTemplate = null;
		startDate = new Date().toISOString().split('T')[0];
		isLoading = false;
		error = null;
		importFile = null;
		importMode = false;
	}

	function handleTemplateSelect(template: (typeof templates)[0]) {
		selectedTemplate = template;
		importMode = false;
	}

	function handleStartDateChange(e: CustomEvent<string>) {
		startDate = e.detail;
	}

	function handleFileChange(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			importFile = input.files[0];
			selectedTemplate = null;
			importMode = true;
		}
	}

	async function handleLoad() {
		isLoading = true;
		error = null;

		try {
			let workout: ParameterizedWorkout;

			if (importMode && importFile) {
				// Load from imported file
				const text = await importFile.text();
				workout = JSON.parse(text) as ParameterizedWorkout;

				// Validate structure
				if (!workout.id || !workout.name || !workout.days) {
					throw new Error('Invalid workout file format');
				}
			} else if (selectedTemplate) {
				// Fetch template from static folder
				const response = await fetch(selectedTemplate.file);
				if (!response.ok) {
					throw new Error(`Failed to load template: ${response.statusText}`);
				}
				workout = (await response.json()) as ParameterizedWorkout;
			} else {
				throw new Error('No template or file selected');
			}

			// Create StoredSchedule with metadata
			const storedSchedule: StoredSchedule = {
				...workout,
				// Generate new ID to avoid conflicts
				id: `schedule_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
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
			dispatch('loaded', storedSchedule);
			dispatch('close');
			navigateToCalendar();
		} catch (e) {
			console.error('Failed to load template:', e);
			error = e instanceof Error ? e.message : 'Failed to load template';
		} finally {
			isLoading = false;
		}
	}

	function handleClose() {
		dispatch('close');
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
				<h2 class="text-lg font-semibold text-white">Load Schedule</h2>
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

				<!-- Template Selection -->
				<div class="mb-6">
					<h3 class="text-sm font-medium text-slate-300 mb-3">Bundled Templates</h3>
					<div class="space-y-2">
						{#each templates as template}
							<button
								on:click={() => handleTemplateSelect(template)}
								class="w-full p-3 rounded-lg text-left transition-colors
									   {selectedTemplate?.id === template.id && !importMode
									? 'bg-indigo-600 text-white'
									: 'bg-slate-700 text-white hover:bg-slate-600'}"
							>
								<div class="font-medium">{template.name}</div>
								<div
									class="text-sm mt-0.5
										   {selectedTemplate?.id === template.id && !importMode
										? 'text-indigo-200'
										: 'text-slate-400'}"
								>
									{template.weeks} weeks | {template.daysPerWeek} days/week |
									{template.difficulty}
								</div>
							</button>
						{/each}
					</div>
				</div>

				<!-- Import from File -->
				<div class="mb-6">
					<h3 class="text-sm font-medium text-slate-300 mb-3">Or Import from File</h3>
					<label
						class="flex items-center justify-center gap-2 p-4 border-2 border-dashed
							   border-slate-600 rounded-lg cursor-pointer hover:border-slate-500
							   transition-colors {importMode ? 'bg-indigo-600/20 border-indigo-500' : ''}"
					>
						<svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
							/>
						</svg>
						<span class="text-sm text-slate-400">
							{importFile ? importFile.name : 'Choose .json file'}
						</span>
						<input
							type="file"
							accept=".json"
							on:change={handleFileChange}
							class="hidden"
						/>
					</label>
				</div>

				<!-- Start Date -->
				<DatePicker
					value={startDate}
					on:change={handleStartDateChange}
					minDate={new Date().toISOString().split('T')[0]}
				/>
			</div>

			<!-- Footer -->
			<div class="p-4 border-t border-slate-700">
				<button
					on:click={handleLoad}
					disabled={isLoading || (!selectedTemplate && !importFile)}
					class="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700
						   text-white font-medium rounded-lg transition-colors
						   disabled:opacity-50 disabled:cursor-not-allowed
						   flex items-center justify-center gap-2"
				>
					{#if isLoading}
						<div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
						Loading...
					{:else}
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
							/>
						</svg>
						Load Schedule
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
