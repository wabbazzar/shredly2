<script lang="ts">
	export let message = 'Loading...';
	export let fadeOut = false;
</script>

<div
	class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900 transition-opacity duration-300"
	class:opacity-0={fadeOut}
	class:pointer-events-none={fadeOut}
>
	<!-- Logo/Brand -->
	<div class="mb-8">
		<h1 class="text-4xl font-bold text-white tracking-tight">
			Shred<span class="text-indigo-400">ly</span>
		</h1>
	</div>

	<!-- Spinner -->
	<div class="relative">
		<div class="h-12 w-12 rounded-full border-4 border-slate-700"></div>
		<div class="absolute inset-0 h-12 w-12 rounded-full border-4 border-transparent border-t-indigo-500 animate-spin"></div>
	</div>

	<!-- Message -->
	<p class="mt-6 text-slate-400 text-sm">{message}</p>
</div>
