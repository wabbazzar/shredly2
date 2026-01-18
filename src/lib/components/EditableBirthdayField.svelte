<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { calculateAge } from '$lib/types/user';

	export let birthday: string; // ISO date string (YYYY-MM-DD)

	const dispatch = createEventDispatcher<{ change: string }>();

	let editing = false;
	let inputValue: string;
	let inputEl: HTMLInputElement;

	// Calculate age for display
	$: displayAge = calculateAge(birthday);

	// Get max date (today) and min date (130 years ago) for date picker
	$: maxDate = new Date().toISOString().split('T')[0];
	$: minDate = (() => {
		const d = new Date();
		d.setFullYear(d.getFullYear() - 130);
		return d.toISOString().split('T')[0];
	})();

	function startEdit(e?: Event) {
		e?.preventDefault();
		e?.stopPropagation();
		inputValue = birthday;
		editing = true;
		// Focus synchronously for iOS support
		inputEl?.focus();
	}

	function save() {
		editing = false;
		if (inputValue && inputValue !== birthday) {
			dispatch('change', inputValue);
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
	<span class="text-slate-400 text-sm">Age</span>

	<!-- Always render input, toggle visibility with CSS for synchronous focus -->
	<div class="flex items-center gap-1" class:hidden={!editing}>
		<input
			bind:this={inputEl}
			bind:value={inputValue}
			type="date"
			min={minDate}
			max={maxDate}
			onblur={save}
			onkeydown={handleKeydown}
			class="bg-slate-700 text-white rounded px-2 py-1 text-sm
               border border-indigo-500 outline-none focus:ring-1 focus:ring-indigo-400"
		/>
	</div>

	<!-- Always render clickable display, toggle visibility with CSS -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		onpointerdown={startEdit}
		role="button"
		tabindex="-1"
		style="-webkit-tap-highlight-color: transparent; touch-action: manipulation; user-select: none;"
		class="text-white text-sm hover:text-indigo-400 transition-colors
             flex items-center gap-1 group cursor-pointer"
		class:hidden={editing}
	>
		<span>{displayAge} years</span>
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
