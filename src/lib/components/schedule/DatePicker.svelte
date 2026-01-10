<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let value: string; // ISO date string
	export let label = 'Start Date';
	export let minDate: string | null = null;

	const dispatch = createEventDispatcher<{
		change: string;
	}>();

	// Get day of week name for preview
	$: dayOfWeek = (() => {
		if (!value) return '';
		const date = new Date(value + 'T00:00:00');
		return date.toLocaleDateString('en-US', { weekday: 'long' });
	})();

	function handleChange(e: Event) {
		const input = e.target as HTMLInputElement;
		value = input.value;
		dispatch('change', value);
	}
</script>

<div class="space-y-1">
	<label class="block text-sm font-medium text-slate-300">{label}</label>
	<div class="relative">
		<input
			type="date"
			{value}
			min={minDate}
			on:change={handleChange}
			class="w-full py-2.5 px-3 bg-slate-700 border border-slate-600 rounded-lg
				   text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
		/>
	</div>
	{#if dayOfWeek}
		<p class="text-sm text-slate-400">Day 1 will be on a {dayOfWeek}</p>
	{/if}
</div>
