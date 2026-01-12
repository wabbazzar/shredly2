<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';

	onMount(() => {
		goto(`${base}/schedule`, { replaceState: true });
	});
</script>

<div class="flex items-center justify-center h-screen bg-slate-900">
	<div class="text-slate-400">Loading...</div>
</div>
