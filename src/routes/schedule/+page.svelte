<script lang="ts">
	import { onMount } from 'svelte';
	import { navigationStore } from '$lib/stores/navigation';

	onMount(() => {
		navigationStore.setActiveTab('schedule');
	});
</script>

<div class="flex flex-col items-center justify-center h-full bg-slate-900">
	<svg
		class="w-24 h-24 mb-6 text-indigo-400"
		fill="none"
		stroke="currentColor"
		viewBox="0 0 24 24"
	>
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="1.5"
			d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
		/>
	</svg>
	<h1 class="text-3xl font-bold text-white mb-3">Schedule</h1>
	<p class="text-slate-400 text-center px-8 max-w-sm">
		Your workout program and calendar will appear here
	</p>
</div>
