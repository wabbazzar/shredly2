<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { TABS, type TabConfig } from '$lib/types/navigation';
	import { navigationStore } from '$lib/stores/navigation';

	function handleTabClick(tab: TabConfig) {
		navigationStore.navigateToTab(tab.id);
		goto(tab.path);
	}

	// Derive active path from page store
	$: activePath = $page.url.pathname;
</script>

<div
	class="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 pb-safe z-50"
	role="tablist"
	aria-label="Main navigation"
>
	<div class="flex justify-around items-center h-16 max-w-md mx-auto">
		{#each TABS as tab}
			{@const isActive = activePath === tab.path || (activePath === '/' && tab.id === 'schedule')}
			<button
				onclick={() => handleTabClick(tab)}
				class="relative flex flex-col items-center justify-center w-full h-full
               transition-colors duration-200 touch-manipulation
               {isActive ? 'text-indigo-400' : 'text-slate-500 active:text-slate-400'}"
				role="tab"
				aria-selected={isActive}
				aria-label={tab.label}
			>
				<!-- Icons -->
				{#if tab.id === 'profile'}
					<svg class="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
						/>
					</svg>
				{:else if tab.id === 'schedule'}
					<svg class="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
						/>
					</svg>
				{:else if tab.id === 'live'}
					<svg class="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
						/>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
				{/if}

				<span class="text-xs font-medium">{tab.label}</span>

				<!-- Active indicator dot -->
				{#if isActive}
					<div
						class="absolute bottom-1 w-1 h-1 bg-indigo-400 rounded-full transition-opacity duration-200"
					></div>
				{/if}
			</button>
		{/each}
	</div>
</div>
