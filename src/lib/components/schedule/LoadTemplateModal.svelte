<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { saveScheduleToDb, setActiveSchedule, navigateToWeek } from '$lib/stores/schedule';
	import type { ParameterizedWorkout } from '$lib/engine/types';
	import type { StoredSchedule, DayMapping, Weekday } from '$lib/types/schedule';
	import DatePicker from './DatePicker.svelte';
	import { toLocalDateString } from '$lib/stores/history';

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
	let startDate: string = toLocalDateString(new Date());
	let isLoading = false;
	let error: string | null = null;

	// Import from file
	let importFile: File | null = null;
	let importMode = false;

	// Reset when modal opens
	$: if (isOpen) {
		selectedTemplate = null;
		startDate = toLocalDateString(new Date());
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
					currentDay: 1,
					dayMapping: createDefaultDayMapping(workout.daysPerWeek)
				}
			};

			// Save to IndexedDB and set as active
			await saveScheduleToDb(storedSchedule);
			await setActiveSchedule(storedSchedule.id);

			// Notify parent and navigate
			dispatch('loaded', storedSchedule);
			dispatch('close');
			navigateToWeek(1);
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
		class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3"
		on:click={handleBackdropClick}
	>
		<!-- Modal -->
		<div
			class="w-full max-w-sm bg-slate-800 rounded-xl flex flex-col max-h-[calc(100vh-1.5rem)] max-h-[calc(100dvh-1.5rem)]"
			on:click|stopPropagation
		>
			<!-- Header -->
			<div class="flex items-center justify-between px-4 py-3 border-b border-slate-700 flex-shrink-0">
				<h2 class="text-base font-semibold text-white">Load Schedule</h2>
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
					<div class="mb-3 p-2 bg-red-900/50 border border-red-700 rounded-lg">
						<p class="text-xs text-red-300">{error}</p>
					</div>
				{/if}

				<!-- Template Selection -->
				<div class="mb-4">
					<h3 class="text-xs font-medium text-slate-400 mb-2">Bundled Templates</h3>
					<div class="space-y-1.5">
						{#each templates as template}
							<button
								on:click={() => handleTemplateSelect(template)}
								class="w-full p-2 rounded-md text-left transition-colors
									   {selectedTemplate?.id === template.id && !importMode
									? 'bg-indigo-600 text-white'
									: 'bg-slate-700 text-white hover:bg-slate-600'}"
							>
								<div class="text-sm font-medium">{template.name}</div>
								<div
									class="text-xs
										   {selectedTemplate?.id === template.id && !importMode
										? 'text-indigo-200'
										: 'text-slate-400'}"
								>
									{template.weeks}wk | {template.daysPerWeek}d/wk | {template.difficulty}
								</div>
							</button>
						{/each}
					</div>
				</div>

				<!-- Import from File -->
				<div class="mb-4">
					<h3 class="text-xs font-medium text-slate-400 mb-2">Or Import File</h3>
					<label
						class="flex items-center justify-center gap-2 p-3 border-2 border-dashed
							   border-slate-600 rounded-md cursor-pointer hover:border-slate-500
							   transition-colors {importMode ? 'bg-indigo-600/20 border-indigo-500' : ''}"
					>
						<svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
							/>
						</svg>
						<span class="text-xs text-slate-400">
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
				<div class="overflow-hidden">
					<label class="block text-xs font-medium text-slate-400 mb-1.5">Start Date</label>
					<input
						type="date"
						value={startDate}
						on:change={(e) => handleStartDateChange(new CustomEvent('change', { detail: e.currentTarget.value }))}
						min={toLocalDateString(new Date())}
						class="w-full max-w-full py-1.5 px-2 text-sm bg-slate-700 border border-slate-600 rounded-md
							   text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
					/>
				</div>
			</div>

			<!-- Footer -->
			<div class="px-4 py-3 border-t border-slate-700 flex-shrink-0">
				<button
					on:click={handleLoad}
					disabled={isLoading || (!selectedTemplate && !importFile)}
					class="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700
						   text-white text-sm font-medium rounded-lg transition-colors
						   disabled:opacity-50 disabled:cursor-not-allowed
						   flex items-center justify-center gap-2"
				>
					{#if isLoading}
						<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
						Loading...
					{:else}
						Load Schedule
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

