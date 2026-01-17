<script lang="ts">
	import { onMount } from 'svelte';
	import exerciseDatabase from '../../../data/exercise_database.json';
	import { lbsToKg, kgToLbs } from '$lib/types/user';

	interface Props {
		isOpen: boolean;
		unitSystem: 'imperial' | 'metric';
		onconfirm?: (exerciseName: string, weightLbs: number) => void;
		oncancel?: () => void;
	}

	let { isOpen, unitSystem, onconfirm, oncancel }: Props = $props();

	// Exercise list
	type FlatExercise = { name: string; category: string; muscle_groups: string[] };
	let allExercises: FlatExercise[] = $state([]);

	onMount(() => {
		const db = exerciseDatabase.exercise_database;
		const exercises: FlatExercise[] = [];
		for (const category of Object.values(db.categories)) {
			for (const [name, exercise] of Object.entries(category.exercises)) {
				exercises.push({
					name,
					category: (exercise as FlatExercise).category,
					muscle_groups: (exercise as FlatExercise).muscle_groups || []
				});
			}
		}
		exercises.sort((a, b) => a.name.localeCompare(b.name));
		allExercises = exercises;
	});

	// Search and selection state
	let searchQuery = $state('');
	let selectedExercise: FlatExercise | null = $state(null);
	let weightValue = $state('');

	// Reset state when modal opens
	$effect(() => {
		if (isOpen) {
			searchQuery = '';
			selectedExercise = null;
			weightValue = '';
		}
	});

	// Filter exercises based on search
	let filteredExercises = $derived(
		searchQuery.length < 2
			? []
			: allExercises.filter((ex) => ex.name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 20)
	);

	let weightUnit = $derived(unitSystem === 'imperial' ? 'lbs' : 'kg');

	function handleSelectExercise(exercise: FlatExercise) {
		selectedExercise = exercise;
		searchQuery = exercise.name;
	}

	function handleConfirm() {
		if (!selectedExercise || !weightValue) return;

		let weightLbs = parseFloat(weightValue);
		if (isNaN(weightLbs) || weightLbs <= 0) return;

		// Convert to lbs if metric
		if (unitSystem === 'metric') {
			weightLbs = kgToLbs(weightLbs);
		}

		onconfirm?.(selectedExercise.name, Math.round(weightLbs));
	}

	function handleCancel() {
		oncancel?.();
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			handleCancel();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			handleCancel();
		} else if (e.key === 'Enter' && selectedExercise && weightValue) {
			e.preventDefault();
			handleConfirm();
		}
	}

	let canConfirm = $derived(selectedExercise !== null && weightValue !== '' && parseFloat(weightValue) > 0);
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
	<!-- Modal backdrop -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
		onclick={handleBackdropClick}
	>
		<!-- Modal content -->
		<div
			class="bg-slate-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
			onclick={(e) => e.stopPropagation()}
		>
			<!-- Header -->
			<div class="flex items-center justify-between px-4 py-3 border-b border-slate-700">
				<h2 class="text-lg font-semibold text-white">Add PR</h2>
				<button
					onclick={handleCancel}
					class="p-2 text-slate-400 hover:text-white transition-colors rounded-lg"
					aria-label="Close"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-y-auto p-4 space-y-4">
				<!-- Exercise Search -->
				<div>
					<label for="exercise-search" class="block text-sm font-medium text-slate-300 mb-1.5">
						Exercise
					</label>
					<div class="relative">
						<svg
							class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
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
							id="exercise-search"
							type="text"
							bind:value={searchQuery}
							placeholder="Search exercises..."
							class="w-full pl-10 pr-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg
							       text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
						/>
					</div>

					<!-- Search Results -->
					{#if searchQuery.length >= 2 && !selectedExercise}
						<div class="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-600 bg-slate-900">
							{#if filteredExercises.length === 0}
								<div class="p-3 text-sm text-slate-400 text-center">No exercises found</div>
							{:else}
								{#each filteredExercises as exercise}
									<button
										onclick={() => handleSelectExercise(exercise)}
										class="w-full px-3 py-2.5 text-left hover:bg-slate-700 transition-colors border-b border-slate-700 last:border-b-0"
									>
										<div class="text-sm font-medium text-white">{exercise.name}</div>
										<div class="text-xs text-slate-400">
											{exercise.category} | {exercise.muscle_groups.slice(0, 2).join(', ')}
										</div>
									</button>
								{/each}
							{/if}
						</div>
					{/if}

					<!-- Selected Exercise Indicator -->
					{#if selectedExercise}
						<div class="mt-2 flex items-center gap-2 px-3 py-2 bg-indigo-600/20 rounded-lg border border-indigo-500/30">
							<svg class="w-4 h-4 text-indigo-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
							</svg>
							<span class="text-sm text-indigo-300 truncate">{selectedExercise.name}</span>
							<button
								onclick={() => {
									selectedExercise = null;
									searchQuery = '';
								}}
								class="ml-auto p-1 text-indigo-400 hover:text-indigo-300"
								aria-label="Clear selection"
							>
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>
					{/if}
				</div>

				<!-- Weight Input -->
				<div>
					<label for="weight-input" class="block text-sm font-medium text-slate-300 mb-1.5">
						1RM Weight
					</label>
					<div class="relative">
						<input
							id="weight-input"
							type="number"
							inputmode="decimal"
							bind:value={weightValue}
							placeholder="0"
							min="0"
							step="5"
							class="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg
							       text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-14"
						/>
						<span class="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">
							{weightUnit}
						</span>
					</div>
					<p class="mt-1.5 text-xs text-slate-500">
						TRM (Training Max) will be calculated as 90% of this value
					</p>
				</div>
			</div>

			<!-- Footer -->
			<div class="flex gap-3 px-4 py-3 border-t border-slate-700 bg-slate-800/50">
				<button
					onclick={handleCancel}
					class="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg
					       transition-colors font-medium"
				>
					Cancel
				</button>
				<button
					onclick={handleConfirm}
					disabled={!canConfirm}
					class="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg
					       transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
				>
					Add PR
				</button>
			</div>
		</div>
	</div>
{/if}
