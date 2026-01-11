<script lang="ts">
	import { hasActiveSchedule } from '$lib/stores/schedule';

	export let onCreateClick: () => void;
	export let onLoadClick: () => void;
	export let onViewClick: () => void;
</script>

<div class="flex gap-2 lg:gap-3">
	<button
		on:click={onCreateClick}
		class="flex-1 py-2 px-2 lg:py-3 lg:px-4 bg-indigo-600 hover:bg-indigo-700
			   text-white text-sm lg:text-base font-medium rounded-lg transition-colors
			   flex items-center justify-center gap-1 lg:gap-2"
	>
		<svg class="w-4 h-4 lg:w-5 lg:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M12 4v16m8-8H4"
			/>
		</svg>
		Create
	</button>

	<button
		on:click={onLoadClick}
		class="flex-1 py-2 px-2 lg:py-3 lg:px-4 bg-slate-700 hover:bg-slate-600
			   text-white text-sm lg:text-base font-medium rounded-lg transition-colors
			   flex items-center justify-center gap-1 lg:gap-2"
	>
		<svg class="w-4 h-4 lg:w-5 lg:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
			/>
		</svg>
		Load
	</button>

	<button
		on:click={onViewClick}
		disabled={!$hasActiveSchedule}
		class="flex-1 py-2 px-2 lg:py-3 lg:px-4 bg-slate-700 hover:bg-slate-600
			   text-white text-sm lg:text-base font-medium rounded-lg transition-colors
			   disabled:opacity-50 disabled:cursor-not-allowed
			   flex items-center justify-center gap-1 lg:gap-2"
	>
		<svg class="w-4 h-4 lg:w-5 lg:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
			/>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
			/>
		</svg>
		View
	</button>
</div>
