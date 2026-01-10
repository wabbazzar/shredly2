<script lang="ts">
	import '../app.css';
	import BottomTabBar from '$lib/components/BottomTabBar.svelte';
	import SwipeContainer from '$lib/components/SwipeContainer.svelte';
	import { navigationStore } from '$lib/stores/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	// Track transition state
	let transitionDirection: 'left' | 'right' | null = null;
	let isTransitioning = false;

	// Subscribe to navigation store for transition direction
	$: navState = $navigationStore;
	$: {
		if (navState.transitionDirection && !isTransitioning) {
			transitionDirection = navState.transitionDirection;
			isTransitioning = true;

			// Clear transition after animation
			setTimeout(() => {
				isTransitioning = false;
				transitionDirection = null;
				navigationStore.clearTransition();
			}, 300);
		}
	}

	// Unique key for page transitions based on pathname
	$: pageKey = $page.url.pathname;
</script>

<div class="h-screen flex flex-col bg-slate-900 overflow-hidden">
	<!-- Main content area with swipe handling -->
	<SwipeContainer>
		<main class="h-full overflow-auto pb-20">
			{#key pageKey}
				<div
					class="h-full transition-transform duration-300 ease-out
                   {isTransitioning && transitionDirection === 'left' ? 'animate-slide-from-right' : ''}
                   {isTransitioning && transitionDirection === 'right' ? 'animate-slide-from-left' : ''}"
				>
					<slot />
				</div>
			{/key}
		</main>
	</SwipeContainer>

	<!-- Bottom tab navigation -->
	<BottomTabBar />
</div>

<style>
	@keyframes slide-from-right {
		from {
			transform: translateX(100%);
			opacity: 0.5;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}

	@keyframes slide-from-left {
		from {
			transform: translateX(-100%);
			opacity: 0.5;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}

	.animate-slide-from-right {
		animation: slide-from-right 300ms ease-out forwards;
	}

	.animate-slide-from-left {
		animation: slide-from-left 300ms ease-out forwards;
	}
</style>
