<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import exerciseDatabase from '../../../data/exercise_database.json';
	import exerciseDescriptions from '../../../data/exercise_descriptions.json';
	import type { Exercise } from '$lib/engine/types';

	export let isOpen: boolean;
	export let currentExerciseName = '';
	export let autoFilterCategory = '';
	export let autoFilterMuscleGroups: string[] = [];
	export let autoFilterEquipment: string[] = [];

	const dispatch = createEventDispatcher<{
		select: { name: string; exercise: Exercise };
		cancel: void;
	}>();

	// Flatten exercise database
	type FlatExercise = Exercise & { name: string };
	let allExercises: FlatExercise[] = [];

	onMount(() => {
		const db = exerciseDatabase.exercise_database;
		allExercises = [];
		for (const category of Object.values(db.categories)) {
			for (const [name, exercise] of Object.entries(category.exercises)) {
				allExercises.push({ ...exercise, name } as FlatExercise);
			}
		}
		// Sort alphabetically
		allExercises.sort((a, b) => a.name.localeCompare(b.name));
	});

	// Search and filter state
	let searchQuery = '';
	let selectedCategories: string[] = [];
	let selectedMuscleGroups: string[] = [];
	let selectedEquipment: string[] = [];

	// Active filter chips for display
	type FilterChip = {
		type: 'category' | 'muscle' | 'equipment';
		value: string;
	};
	let activeFilters: FilterChip[] = [];

	// Current exercise for reference
	let currentExercise: FlatExercise | null = null;

	// Sync filter chips from filter arrays
	function syncFilterChips() {
		activeFilters = [
			...selectedCategories.map((cat) => ({ type: 'category' as const, value: cat })),
			...selectedMuscleGroups.map((mg) => ({ type: 'muscle' as const, value: mg })),
			...selectedEquipment.map((eq) => ({ type: 'equipment' as const, value: eq }))
		];
	}

	// Auto-apply filters when modal opens
	$: if (isOpen) {
		// Auto-apply filters based on current exercise
		if (autoFilterCategory) {
			selectedCategories = [autoFilterCategory];
		} else {
			selectedCategories = [];
		}

		if (autoFilterMuscleGroups.length > 0) {
			selectedMuscleGroups = [...autoFilterMuscleGroups];
		} else {
			selectedMuscleGroups = [];
		}

		if (autoFilterEquipment.length > 0) {
			selectedEquipment = [...autoFilterEquipment];
		} else {
			selectedEquipment = [];
		}

		// Find current exercise and set as selected
		const current = allExercises.find((ex) => ex.name === currentExerciseName);
		if (current) {
			currentExercise = current;
			selectedExercise = current;
		}

		// Sync active filter chips
		syncFilterChips();
	}

	// Get unique filter options
	$: categories = [...new Set(allExercises.map((e) => e.category))].sort();
	$: muscleGroups = [
		...new Set(allExercises.flatMap((e) => e.muscle_groups))
	].sort();
	$: equipmentOptions = [...new Set(allExercises.flatMap((e) => e.equipment))].sort();

	// Filter exercises with multi-select AND logic
	$: filteredExercises = allExercises.filter((exercise) => {
		// Search query
		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			if (!exercise.name.toLowerCase().includes(query)) {
				return false;
			}
		}

		// Categories filter (OR logic - if multiple selected, match any)
		if (selectedCategories.length > 0 && !selectedCategories.includes(exercise.category)) {
			return false;
		}

		// Muscle groups filter (AND logic - exercise must have ALL selected muscle groups)
		if (selectedMuscleGroups.length > 0) {
			const hasAll = selectedMuscleGroups.every((mg) =>
				exercise.muscle_groups.includes(mg)
			);
			if (!hasAll) return false;
		}

		// Equipment filter (AND logic - exercise must have ALL selected equipment)
		if (selectedEquipment.length > 0) {
			const hasAll = selectedEquipment.every((eq) => exercise.equipment.includes(eq));
			if (!hasAll) return false;
		}

		return true;
	});

	// Selected exercise for preview
	let selectedExercise: FlatExercise | null = null;

	// Description modal state (mobile only)
	let showDescriptionModal = false;

	function handleExerciseClick(exercise: FlatExercise) {
		// Update selected exercise for preview (don't dispatch event yet)
		selectedExercise = exercise;
	}

	function handleShuffle() {
		if (filteredExercises.length === 0) return;

		// Exclude current selection from shuffle pool
		const shufflePool = filteredExercises.filter((ex) => ex.name !== selectedExercise?.name);
		if (shufflePool.length === 0) return;

		// Random selection
		const randomIndex = Math.floor(Math.random() * shufflePool.length);
		selectedExercise = shufflePool[randomIndex];
	}

	function handleConfirm() {
		if (selectedExercise && selectedExercise.name !== currentExerciseName) {
			dispatch('select', {
				name: selectedExercise.name,
				exercise: selectedExercise
			});
		} else {
			// No change, just close
			handleCancel();
		}
	}

	function handleCancel() {
		dispatch('cancel');
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			handleCancel();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			handleCancel();
		} else if (e.key === 'Enter' && selectedExercise) {
			e.preventDefault();
			handleConfirm();
		}
	}

	function removeFilter(type: 'category' | 'muscle' | 'equipment', value: string) {
		if (type === 'category') {
			selectedCategories = selectedCategories.filter((c) => c !== value);
		} else if (type === 'muscle') {
			selectedMuscleGroups = selectedMuscleGroups.filter((mg) => mg !== value);
		} else if (type === 'equipment') {
			selectedEquipment = selectedEquipment.filter((eq) => eq !== value);
		}
		syncFilterChips();
	}

	function clearAllFilters() {
		searchQuery = '';
		selectedCategories = [];
		selectedMuscleGroups = [];
		selectedEquipment = [];
		syncFilterChips();
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen}
	<!-- Modal backdrop - z-[60] to appear above BottomTabBar (z-50) -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-[60] bg-slate-900 lg:bg-black/60 lg:px-8 lg:py-6 flex flex-col lg:items-center lg:justify-center"
		on:click={handleBackdropClick}
	>
		<!-- Modal content - full screen on mobile, constrained card on desktop -->
		<div
			class="flex flex-col h-full w-full lg:h-auto lg:max-h-[85vh] lg:max-w-6xl lg:bg-slate-900 lg:rounded-xl lg:overflow-hidden"
			on:click|stopPropagation
		>
			<!-- Search -->
			<div class="p-2.5 md:p-4 border-b border-slate-700">
				<div class="relative">
					<svg
						class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
						/>
					</svg>
					<input
						type="text"
						bind:value={searchQuery}
						on:focus={(e) => e.currentTarget.select()}
						placeholder="Search exercises..."
						class="w-full pl-10 pr-4 py-2 md:py-2.5 bg-slate-800 border border-slate-600 rounded-lg
							   text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
					/>
				</div>
			</div>

			<!-- Current Selection Section -->
			{#if selectedExercise}
				<div class="p-2.5 md:p-4 bg-slate-800 border-b border-slate-700 md:max-h-[40vh] md:overflow-y-auto">
					<div class="flex items-center justify-between gap-1.5">
						<p class="text-base md:text-lg font-semibold text-white truncate flex-1 min-w-0">{selectedExercise.name}</p>
						<div class="flex items-center gap-1.5 flex-shrink-0">
							<!-- Info button (mobile only) -->
							{#if exerciseDescriptions[selectedExercise.name]?.description}
								<button
									on:click={() => (showDescriptionModal = true)}
									class="md:hidden px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg
									       transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed
									       whitespace-nowrap min-h-[44px]"
									aria-label="View exercise description"
								>
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
										/>
									</svg>
								</button>
							{/if}
							<!-- Shuffle button -->
							<button
								on:click={handleShuffle}
								disabled={filteredExercises.length === 0}
								class="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg
								       transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed
								       whitespace-nowrap min-h-[44px]"
								aria-label="Shuffle exercise"
							>
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
									/>
								</svg>
								<span class="text-sm hidden sm:inline">Shuffle</span>
							</button>
							{#if selectedExercise.name !== currentExerciseName}
								<span class="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full">
									Changed
								</span>
							{/if}
						</div>
					</div>

					<!-- Description (desktop only) -->
					{#if exerciseDescriptions[selectedExercise.name]?.description}
						{@const desc = exerciseDescriptions[selectedExercise.name].description}
						<div class="hidden md:block space-y-3 text-sm mt-3">
							<div>
								<h4 class="text-xs font-medium text-slate-400 mb-1 uppercase tracking-wide">
									Overview
								</h4>
								<p class="text-slate-300 leading-relaxed">{desc.overview}</p>
							</div>
							<div>
								<h4 class="text-xs font-medium text-slate-400 mb-1 uppercase tracking-wide">
									Setup
								</h4>
								<p class="text-slate-300 leading-relaxed">{desc.setup}</p>
							</div>
							<div>
								<h4 class="text-xs font-medium text-slate-400 mb-1 uppercase tracking-wide">
									Movement
								</h4>
								<p class="text-slate-300 leading-relaxed">{desc.movement}</p>
							</div>
							<div>
								<h4 class="text-xs font-medium text-slate-400 mb-1 uppercase tracking-wide">
									Cues
								</h4>
								<p class="text-slate-300 leading-relaxed italic">{desc.cues}</p>
							</div>
						</div>
					{:else}
						<p class="hidden md:block text-sm text-slate-400 italic">No description available</p>
					{/if}
				</div>
			{/if}

			<!-- Filter Chips Display -->
			{#if activeFilters.length > 0}
				<div class="flex flex-wrap gap-1.5 px-2.5 py-2 md:px-4 border-b border-slate-700">
					{#each activeFilters as filter}
						<button
							on:click={() => removeFilter(filter.type, filter.value)}
							class="flex items-center gap-1 px-2 py-1 bg-indigo-600 text-white text-xs rounded-full
							       hover:bg-indigo-700 transition-colors min-h-[28px]"
							aria-label="Remove {filter.value} filter"
						>
							<span>{filter.value}</span>
							<svg class="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					{/each}
					<button
						on:click={clearAllFilters}
						class="px-2 py-1 text-slate-400 hover:text-white text-xs transition-colors min-h-[28px]"
						aria-label="Clear all filters"
					>
						Clear all
					</button>
				</div>
			{/if}

			<!-- Filters -->
			<div class="flex gap-1.5 px-2.5 py-2 md:px-4 md:py-3 border-b border-slate-700">
				<select
					on:change={(e) => {
						const val = e.currentTarget.value;
						if (val && !selectedCategories.includes(val)) {
							selectedCategories = [...selectedCategories, val];
							syncFilterChips();
						}
						e.currentTarget.value = ''; // Reset to placeholder
					}}
					class="flex-1 min-w-0 px-2 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-xs lg:text-sm text-white min-h-[44px]"
					aria-label="Add category filter"
				>
					<option value="">+ Category</option>
					{#each categories as category}
						{#if !selectedCategories.includes(category)}
							<option value={category}>{category}</option>
						{/if}
					{/each}
				</select>

				<select
					on:change={(e) => {
						const val = e.currentTarget.value;
						if (val && !selectedMuscleGroups.includes(val)) {
							selectedMuscleGroups = [...selectedMuscleGroups, val];
							syncFilterChips();
						}
						e.currentTarget.value = ''; // Reset to placeholder
					}}
					class="flex-1 min-w-0 px-2 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-xs lg:text-sm text-white min-h-[44px]"
					aria-label="Add muscle group filter"
				>
					<option value="">+ Muscle</option>
					{#each muscleGroups as muscle}
						{#if !selectedMuscleGroups.includes(muscle)}
							<option value={muscle}>{muscle}</option>
						{/if}
					{/each}
				</select>

				<select
					on:change={(e) => {
						const val = e.currentTarget.value;
						if (val && !selectedEquipment.includes(val)) {
							selectedEquipment = [...selectedEquipment, val];
							syncFilterChips();
						}
						e.currentTarget.value = ''; // Reset to placeholder
					}}
					class="flex-1 min-w-0 px-2 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-xs lg:text-sm text-white min-h-[44px]"
					aria-label="Add equipment filter"
				>
					<option value="">+ Equipment</option>
					{#each equipmentOptions as equip}
						{#if !selectedEquipment.includes(equip)}
							<option value={equip}>{equip}</option>
						{/if}
					{/each}
				</select>
			</div>

			<!-- Exercise List -->
			<div class="flex-1 overflow-y-auto">
				{#if filteredExercises.length === 0}
					<div class="flex flex-col items-center justify-center py-12 text-slate-500">
						<svg class="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="1.5"
								d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						<p>No matches</p>
					</div>
				{:else}
					<div class="p-2.5 md:p-4 pb-safe space-y-1.5">
						<p class="text-xs text-slate-500 mb-1">
							{filteredExercises.length} exercises
						</p>
						{#each filteredExercises as exercise}
							<button
								on:click={() => handleExerciseClick(exercise)}
								class="w-full p-2.5 md:p-3 rounded-lg text-left transition-colors
									   {selectedExercise?.name === exercise.name
									? 'bg-indigo-600 text-white'
									: exercise.name === currentExerciseName
										? 'bg-slate-700 text-white ring-1 ring-indigo-500'
										: 'bg-slate-800 text-white hover:bg-slate-700'}"
							>
								<div class="font-medium text-sm md:text-base">{exercise.name}</div>
								<div
									class="text-xs md:text-sm mt-0.5 flex items-center gap-2
										   {selectedExercise?.name === exercise.name ? 'text-indigo-200' : 'text-slate-400'}"
								>
									<span>{exercise.category}</span>
									<span class="text-slate-600">|</span>
									<span>{exercise.muscle_groups.slice(0, 2).join(', ')}</span>
								</div>
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Footer with confirmation buttons -->
			<div
				class="sticky bottom-20 p-2.5 md:p-4 bg-slate-800 border-t border-slate-700 flex gap-2"
			>
				<button
					on:click={handleCancel}
					class="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg
					       transition-colors font-medium min-h-[44px]"
					aria-label="Cancel"
				>
					Cancel
				</button>
				<button
					on:click={handleConfirm}
					disabled={!selectedExercise}
					class="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg
					       transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
					aria-label="Confirm selection"
				>
					Confirm
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Exercise Description Modal (Mobile Only) -->
{#if showDescriptionModal && selectedExercise && exerciseDescriptions[selectedExercise.name]?.description}
	{@const desc = exerciseDescriptions[selectedExercise.name].description}
	<div
		class="md:hidden fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-3"
		on:click={() => (showDescriptionModal = false)}
		on:keydown={(e) => e.key === 'Escape' && (showDescriptionModal = false)}
		role="button"
		tabindex="-1"
	>
		<div
			class="bg-slate-800 rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto"
			on:click={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			aria-labelledby="description-title"
		>
			<!-- Header -->
			<div class="sticky top-0 bg-slate-800 border-b border-slate-700 p-3 flex items-center justify-between">
				<h2 id="description-title" class="text-base font-semibold text-white">
					{selectedExercise.name}
				</h2>
				<button
					on:click={() => (showDescriptionModal = false)}
					class="p-1 text-slate-400 hover:text-white transition-colors"
					aria-label="Close description"
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

			<!-- Description Content -->
			<div class="p-3 space-y-3 text-sm">
				<div>
					<h3 class="text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Overview</h3>
					<p class="text-slate-300 leading-relaxed">{desc.overview}</p>
				</div>
				<div>
					<h3 class="text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Setup</h3>
					<p class="text-slate-300 leading-relaxed">{desc.setup}</p>
				</div>
				<div>
					<h3 class="text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Movement</h3>
					<p class="text-slate-300 leading-relaxed">{desc.movement}</p>
				</div>
				<div>
					<h3 class="text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Cues</h3>
					<p class="text-slate-300 leading-relaxed italic">{desc.cues}</p>
				</div>
			</div>

			<!-- Close Button -->
			<div class="sticky bottom-0 p-3 bg-slate-800 border-t border-slate-700">
				<button
					on:click={() => (showDescriptionModal = false)}
					class="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg
					       transition-colors font-medium min-h-[44px]"
				>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}
