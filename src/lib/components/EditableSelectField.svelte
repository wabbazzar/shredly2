<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	interface Option {
		value: string;
		label: string;
	}

	export let value: string;
	export let label: string;
	export let options: Option[];

	const dispatch = createEventDispatcher<{ change: string }>();

	let editing = false;
	let selectEl: HTMLSelectElement;

	function startEdit() {
		editing = true;
		setTimeout(() => selectEl?.focus(), 0);
	}

	function handleChange() {
		editing = false;
		dispatch('change', selectEl.value);
	}

	function handleBlur() {
		editing = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			editing = false;
		}
	}

	function getDisplayLabel(): string {
		const option = options.find((o) => o.value === value);
		return option?.label ?? value;
	}
</script>

<div class="flex items-center justify-between py-3">
	<span class="text-slate-400 text-sm">{label}</span>

	{#if editing}
		<select
			bind:this={selectEl}
			{value}
			onchange={handleChange}
			onblur={handleBlur}
			onkeydown={handleKeydown}
			class="bg-slate-700 text-white text-sm rounded px-2 py-1
             border border-indigo-500 outline-none focus:ring-1 focus:ring-indigo-400"
		>
			{#each options as option}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>
	{:else}
		<button
			onclick={startEdit}
			class="text-white text-sm hover:text-indigo-400 transition-colors
             flex items-center gap-1 group"
		>
			<span>{getDisplayLabel()}</span>
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
					d="M19 9l-7 7-7-7"
				/>
			</svg>
		</button>
	{/if}
</div>
