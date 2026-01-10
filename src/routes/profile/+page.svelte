<script lang="ts">
	import { onMount } from 'svelte';
	import { navigationStore } from '$lib/stores/navigation';

	onMount(() => {
		navigationStore.setActiveTab('profile');
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
			d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
		/>
	</svg>
	<h1 class="text-3xl font-bold text-white mb-3">Profile</h1>
	<p class="text-slate-400 text-center px-8 max-w-sm">
		User stats, PRs, and workout history will appear here
	</p>
</div>
