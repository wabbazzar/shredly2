<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import exerciseDatabase from '../../../data/exercise_database.json';
	import type { Exercise } from '$lib/engine/types';

	export let isOpen: boolean;
	export let currentExerciseName = '';

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
	let selectedCategory = '';
	let selectedMuscleGroup = '';
	let selectedEquipment = '';

	// Reset filters when modal opens
	$: if (isOpen) {
		searchQuery = '';
		selectedCategory = '';
		selectedMuscleGroup = '';
		selectedEquipment = '';
	}

	// Get unique filter options
	$: categories = [...new Set(allExercises.map((e) => e.category))].sort();
	$: muscleGroups = [
		...new Set(allExercises.flatMap((e) => e.muscle_groups))
	].sort();
	$: equipmentOptions = [...new Set(allExercises.flatMap((e) => e.equipment))].sort();

	// Filter exercises
	$: filteredExercises = allExercises.filter((exercise) => {
		// Search query
		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			if (!exercise.name.toLowerCase().includes(query)) {
				return false;
			}
		}

		// Category filter
		if (selectedCategory && exercise.category !== selectedCategory) {
			return false;
		}

		// Muscle group filter
		if (selectedMuscleGroup && !exercise.muscle_groups.includes(selectedMuscleGroup)) {
			return false;
		}

		// Equipment filter
		if (selectedEquipment && !exercise.equipment.includes(selectedEquipment)) {
			return false;
		}

		return true;
	});

	// Selected exercise for preview
	let selectedExercise: FlatExercise | null = null;

	function handleExerciseClick(exercise: FlatExercise) {
		selectedExercise = exercise;
	}

	function handleConfirm() {
		if (selectedExercise) {
			dispatch('select', {
				name: selectedExercise.name,
				exercise: selectedExercise
			});
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
		}
	}

	function clearFilters() {
		searchQuery = '';
		selectedCategory = '';
		selectedMuscleGroup = '';
		selectedEquipment = '';
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen}
	<!-- Full-screen modal -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 bg-slate-900 z-50 flex flex-col"
		on:click={handleBackdropClick}
	>
		<!-- Header -->
		<div class="flex items-center justify-between p-4 border-b border-slate-700">
			<h2 class="text-lg font-semibold text-white">Select Exercise</h2>
			<button
				on:click={handleCancel}
				class="p-1 text-slate-400 hover:text-white transition-colors"
			>
				<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<!-- Search -->
		<div class="p-4 border-b border-slate-700">
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
					placeholder="Search exercises..."
					class="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg
						   text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
				/>
			</div>
		</div>

		<!-- Filters -->
		<div class="flex gap-2 p-4 overflow-x-auto border-b border-slate-700">
			<select
				bind:value={selectedCategory}
				class="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white"
			>
				<option value="">All Categories</option>
				{#each categories as category}
					<option value={category}>{category}</option>
				{/each}
			</select>

			<select
				bind:value={selectedMuscleGroup}
				class="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white"
			>
				<option value="">All Muscles</option>
				{#each muscleGroups as muscle}
					<option value={muscle}>{muscle}</option>
				{/each}
			</select>

			<select
				bind:value={selectedEquipment}
				class="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white"
			>
				<option value="">All Equipment</option>
				{#each equipmentOptions as equip}
					<option value={equip}>{equip}</option>
				{/each}
			</select>

			{#if searchQuery || selectedCategory || selectedMuscleGroup || selectedEquipment}
				<button
					on:click={clearFilters}
					class="px-3 py-1.5 text-sm text-indigo-400 hover:text-indigo-300"
				>
					Clear
				</button>
			{/if}
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
					<p>No exercises match your filters</p>
				</div>
			{:else}
				<div class="p-4 space-y-2">
					<p class="text-xs text-slate-500 mb-2">
						{filteredExercises.length} exercises
					</p>
					{#each filteredExercises as exercise}
						<button
							on:click={() => handleExerciseClick(exercise)}
							class="w-full p-3 rounded-lg text-left transition-colors
								   {selectedExercise?.name === exercise.name
								? 'bg-indigo-600 text-white'
								: exercise.name === currentExerciseName
									? 'bg-slate-700 text-white ring-1 ring-indigo-500'
									: 'bg-slate-800 text-white hover:bg-slate-700'}"
						>
							<div class="font-medium">{exercise.name}</div>
							<div
								class="text-sm mt-0.5 flex items-center gap-2
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

		<!-- Selected Exercise Preview -->
		{#if selectedExercise}
			<div class="border-t border-slate-700 p-4 bg-slate-800">
				<div class="flex items-start justify-between mb-2">
					<div>
						<h3 class="font-semibold text-white">{selectedExercise.name}</h3>
						<p class="text-sm text-slate-400">
							{selectedExercise.category} | {selectedExercise.difficulty}
						</p>
					</div>
				</div>
				<div class="flex flex-wrap gap-1 mb-3">
					{#each selectedExercise.muscle_groups as muscle}
						<span class="px-2 py-0.5 bg-slate-700 text-slate-300 text-xs rounded">
							{muscle}
						</span>
					{/each}
				</div>
				<div class="flex flex-wrap gap-1 mb-4">
					{#each selectedExercise.equipment as equip}
						<span class="px-2 py-0.5 bg-slate-600 text-slate-300 text-xs rounded">
							{equip}
						</span>
					{/each}
				</div>
				<button
					on:click={handleConfirm}
					class="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700
						   text-white font-medium rounded-lg transition-colors"
				>
					Select {selectedExercise.name}
				</button>
			</div>
		{/if}
	</div>
{/if}
