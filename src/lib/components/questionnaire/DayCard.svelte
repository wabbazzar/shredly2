<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { WorkoutLocation } from '$lib/types/user';
	import rules from '$data/workout_generation_rules.json';

	export let dayNumber: number;
	export let focus: string;
	export let location: WorkoutLocation;
	export let homeEquipment: string[] = [];
	export let showRemove: boolean = true;
	export let isDragging: boolean = false;
	export let isDragOver: boolean = false;

	const dispatch = createEventDispatcher<{
		focusChange: string;
		locationToggle: void;
		remove: void;
		dragstart: number;
		dragover: number;
		dragend: void;
	}>();

	// Focus options grouped by category
	const FOCUS_OPTIONS = {
		Strength: ['Push', 'Pull', 'Legs', 'Upper', 'Lower'],
		'Strength+': ['Push-Strength', 'Pull-Strength', 'Legs-Strength'],
		Volume: ['Push-Volume', 'Pull-Volume', 'Legs-Volume', 'Upper-Volume', 'Lower-Volume'],
		HIIT: ['Push-HIIT', 'Pull-HIIT', 'Legs-HIIT', 'Upper-HIIT', 'Lower-HIIT'],
		Recovery: ['FullBody-Mobility', 'Flexibility']
	};

	// Flatten for dropdown
	const allFocusOptions = Object.values(FOCUS_OPTIONS).flat();

	// Check for equipment warning
	$: equipmentWarning = getEquipmentWarning(focus, location, homeEquipment);

	function getEquipmentWarning(
		focusType: string,
		loc: WorkoutLocation,
		equipment: string[]
	): string | null {
		if (loc !== 'home') return null;

		const requirements = (rules as Record<string, unknown>).focus_equipment_requirements as Record<
			string,
			{ recommended: string[]; warning: string | null }
		>;
		const req = requirements?.[focusType];
		if (!req || !req.warning) return null;

		const missingEquipment = req.recommended.filter((eq: string) => !equipment.includes(eq));
		if (missingEquipment.length === 0) return null;

		return req.warning;
	}

	function handleFocusChange(e: Event) {
		const target = e.target as HTMLSelectElement;
		dispatch('focusChange', target.value);
	}

	function handleLocationToggle() {
		dispatch('locationToggle');
	}

	function handleRemove() {
		dispatch('remove');
	}

	function handleDragStart(e: DragEvent) {
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', dayNumber.toString());
		}
		dispatch('dragstart', dayNumber);
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move';
		}
		dispatch('dragover', dayNumber);
	}

	function handleDragEnd() {
		dispatch('dragend');
	}

	// Location styling
	$: locationColor = location === 'gym' ? 'indigo' : 'emerald';
	$: locationIcon =
		location === 'gym'
			? 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'
			: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6';
</script>

<div
	draggable="true"
	ondragstart={handleDragStart}
	ondragover={handleDragOver}
	ondragend={handleDragEnd}
	class="relative bg-slate-700 rounded-lg p-3 min-w-[120px] flex flex-col gap-2
		   border-2 transition-all cursor-grab active:cursor-grabbing
		   {locationColor === 'indigo' ? 'border-indigo-500/30' : 'border-emerald-500/30'}
		   {isDragging ? 'opacity-50 scale-95' : ''}
		   {isDragOver ? 'border-white/50 scale-105' : ''}"
>
	<!-- Remove button -->
	{#if showRemove}
		<button
			type="button"
			onclick={handleRemove}
			class="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-slate-600 text-slate-400
				   hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center"
		>
			<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M6 18L18 6M6 6l12 12"
				/>
			</svg>
		</button>
	{/if}

	<!-- Day number label -->
	<div class="text-[10px] text-slate-500 font-medium text-center">Day {dayNumber}</div>

	<!-- Focus dropdown -->
	<select
		value={focus}
		onchange={handleFocusChange}
		class="w-full px-2 py-1.5 text-xs font-medium bg-slate-800 border border-slate-600
			   rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500
			   appearance-none cursor-pointer text-center"
	>
		{#each Object.entries(FOCUS_OPTIONS) as [group, options]}
			<optgroup label={group}>
				{#each options as option}
					<option value={option}>{option}</option>
				{/each}
			</optgroup>
		{/each}
	</select>

	<!-- Location toggle button -->
	<button
		type="button"
		onclick={handleLocationToggle}
		class="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium
			   transition-colors
			   {locationColor === 'indigo'
			? 'bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30'
			: 'bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30'}"
	>
		<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={locationIcon} />
		</svg>
		<span>{location === 'gym' ? 'Gym' : 'Home'}</span>
	</button>

	<!-- Equipment warning -->
	{#if equipmentWarning}
		<div
			class="flex items-start gap-1 px-1.5 py-1 bg-amber-900/30 rounded text-[10px] text-amber-300"
			title={equipmentWarning}
		>
			<svg class="w-3 h-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
				<path
					fill-rule="evenodd"
					d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
					clip-rule="evenodd"
				/>
			</svg>
			<span class="line-clamp-2">No barbell</span>
		</div>
	{/if}
</div>
