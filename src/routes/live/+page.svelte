<script lang="ts">
	import { onMount } from 'svelte';
	import { navigationStore } from '$lib/stores/navigation';

	onMount(() => {
		navigationStore.setActiveTab('live');
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
			d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
		/>
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="1.5"
			d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
		/>
	</svg>
	<h1 class="text-3xl font-bold text-white mb-3">Live</h1>
	<p class="text-slate-400 text-center px-8 max-w-sm">
		Active workout execution with timer will appear here
	</p>
</div>
