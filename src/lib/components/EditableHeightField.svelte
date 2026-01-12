<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import {
		inchesToFeetAndInches,
		feetAndInchesToInches,
		inchesToCm,
		cmToInches,
		type UnitSystem
	} from '$lib/types/user';

	export let heightInches: number;
	export let unitSystem: UnitSystem;

	const dispatch = createEventDispatcher<{ change: number }>();

	let editing = false;
	let feet: number;
	let inches: number;
	let cm: number;
	let feetInput: HTMLInputElement;
	let inchesInput: HTMLInputElement;
	let cmInput: HTMLInputElement;
	let editContainer: HTMLDivElement;

	// Reactive display value - explicitly depends on unitSystem and heightInches
	$: displayValue = (() => {
		if (unitSystem === 'imperial') {
			const parsed = inchesToFeetAndInches(heightInches);
			return `${parsed.feet}'${parsed.inches}"`;
		}
		return `${inchesToCm(heightInches)} cm`;
	})();

	async function startEdit() {
		if (unitSystem === 'imperial') {
			const parsed = inchesToFeetAndInches(heightInches);
			feet = parsed.feet;
			inches = parsed.inches;
		} else {
			cm = inchesToCm(heightInches);
		}
		editing = true;
		await tick();
		// Use requestAnimationFrame for better mobile keyboard triggering
		requestAnimationFrame(() => {
			if (unitSystem === 'imperial') {
				feetInput?.focus();
				feetInput?.select();
			} else {
				cmInput?.focus();
				cmInput?.select();
			}
		});
	}

	function save() {
		editing = false;
		let newInches: number;
		if (unitSystem === 'imperial') {
			newInches = feetAndInchesToInches(feet, inches);
		} else {
			newInches = cmToInches(cm);
		}
		if (newInches !== heightInches) {
			dispatch('change', newInches);
		}
	}

	function handleBlur(e: FocusEvent) {
		// Check if focus is moving to another element within our edit container
		const relatedTarget = e.relatedTarget as HTMLElement | null;
		if (relatedTarget && editContainer?.contains(relatedTarget)) {
			// Focus is moving within our edit area, don't save yet
			return;
		}
		// Focus left the edit area entirely, save now
		save();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			save();
		} else if (e.key === 'Escape') {
			editing = false;
		}
	}
</script>

<div class="flex items-center justify-between py-3">
	<span class="text-slate-400 text-sm">Height</span>

	{#if editing}
		{#if unitSystem === 'imperial'}
			<div bind:this={editContainer} class="flex items-center gap-1">
				<input
					bind:this={feetInput}
					bind:value={feet}
					type="number"
					inputmode="numeric"
					pattern="[0-9]*"
					min="3"
					max="8"
					onblur={handleBlur}
					onkeydown={handleKeydown}
					class="w-12 bg-slate-700 text-white text-right rounded px-2 py-1 text-sm
                 border border-indigo-500 outline-none focus:ring-1 focus:ring-indigo-400"
				/>
				<span class="text-slate-400 text-sm">ft</span>
				<input
					bind:this={inchesInput}
					bind:value={inches}
					type="number"
					inputmode="numeric"
					pattern="[0-9]*"
					min="0"
					max="11"
					onblur={handleBlur}
					onkeydown={handleKeydown}
					class="w-12 bg-slate-700 text-white text-right rounded px-2 py-1 text-sm
                 border border-indigo-500 outline-none focus:ring-1 focus:ring-indigo-400"
				/>
				<span class="text-slate-400 text-sm">in</span>
			</div>
		{:else}
			<div bind:this={editContainer} class="flex items-center gap-1">
				<input
					bind:this={cmInput}
					bind:value={cm}
					type="number"
					inputmode="numeric"
					pattern="[0-9]*"
					min="100"
					max="250"
					onblur={handleBlur}
					onkeydown={handleKeydown}
					class="w-16 bg-slate-700 text-white text-right rounded px-2 py-1 text-sm
                 border border-indigo-500 outline-none focus:ring-1 focus:ring-indigo-400"
				/>
				<span class="text-slate-400 text-sm">cm</span>
			</div>
		{/if}
	{:else}
		<button
			onclick={startEdit}
			class="text-white text-sm hover:text-indigo-400 transition-colors
             flex items-center gap-1 group"
		>
			<span>{displayValue}</span>
			<svg
				class="w-3 h-3 text-slate-500 group-hover:text-indigo-400 transition-colors"
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
		</button>
	{/if}
</div>
