<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let value: string | number;
	export let label: string;
	export let type: 'text' | 'number' = 'text';
	export let suffix: string = '';
	export let min: number | undefined = undefined;
	export let max: number | undefined = undefined;

	const dispatch = createEventDispatcher<{ change: string | number }>();

	let editing = false;
	let inputValue: string | number;
	let inputEl: HTMLInputElement;

	function startEdit(e?: Event) {
		// Prevent any default behavior including focus on the trigger
		e?.preventDefault();
		e?.stopPropagation();
		inputValue = value;
		editing = true;
		// Focus synchronously for iOS keyboard support
		inputEl?.focus();
		inputEl?.select();
	}

	function save() {
		editing = false;
		const newValue = type === 'number' ? Number(inputValue) : inputValue;
		if (newValue !== value) {
			dispatch('change', newValue);
		}
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
	<span class="text-slate-400 text-sm">{label}</span>

	<!-- Always render input, toggle visibility with CSS for synchronous focus -->
	<div class="flex items-center gap-1" class:hidden={!editing}>
		<input
			bind:this={inputEl}
			bind:value={inputValue}
			{type}
			{min}
			{max}
			onblur={save}
			onkeydown={handleKeydown}
			class="w-24 bg-slate-700 text-white text-right rounded px-2 py-1 text-sm
               border border-indigo-500 outline-none focus:ring-1 focus:ring-indigo-400"
		/>
		{#if suffix}
			<span class="text-slate-400 text-sm">{suffix}</span>
		{/if}
	</div>

	<!-- Always render clickable display, toggle visibility with CSS -->
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div
		onpointerdown={startEdit}
		role="button"
		tabindex="-1"
		style="-webkit-tap-highlight-color: transparent; touch-action: manipulation; user-select: none;"
		class="text-white text-sm hover:text-indigo-400 transition-colors
             flex items-center gap-1 group cursor-pointer"
		class:hidden={editing}
	>
		<span>{value}{suffix ? ` ${suffix}` : ''}</span>
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
	</div>
</div>
