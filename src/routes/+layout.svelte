<script lang="ts">
	import '../app.css';
	import BottomTabBar from '$lib/components/BottomTabBar.svelte';
	import SwipeContainer from '$lib/components/SwipeContainer.svelte';
	import { navigationStore } from '$lib/stores/navigation';
	import { initializeScheduleStore } from '$lib/stores/schedule';
	import { fullRecalculateCache } from '$lib/stores/oneRMCache';
	import { userStore } from '$lib/stores/user';
	import { get } from 'svelte/store';
	import { onMount } from 'svelte';

	// Track transition state
	let transitionDirection: 'left' | 'right' | null = null;
	let isTransitioning = false;
	let animationClass = '';

	// Handle animation completion
	function handleAnimationEnd() {
		isTransitioning = false;
		transitionDirection = null;
		animationClass = '';
		navigationStore.clearTransition();
	}

	// Subscribe to navigation store for transition direction
	$: navState = $navigationStore;
	$: {
		if (navState.transitionDirection && !isTransitioning) {
			transitionDirection = navState.transitionDirection;
			isTransitioning = true;
			animationClass =
				transitionDirection === 'left' ? 'animate-slide-from-right' : 'animate-slide-from-left';

			// Fallback timeout in case animationend doesn't fire
			setTimeout(() => {
				if (isTransitioning) handleAnimationEnd();
			}, 400);
		}
	}

	// Initialize stores once at app startup
	onMount(() => {
		initializeScheduleStore();

		// Initialize 1RM cache with user overrides
		const userData = get(userStore);
		const userOverrides: Record<string, number> = {};
		for (const orm of userData.oneRepMaxes) {
			if (orm.isManual && orm.weightLbs > 0) {
				userOverrides[orm.exerciseName] = orm.weightLbs;
			}
		}
		fullRecalculateCache(undefined, userOverrides);
	});
</script>

<div class="h-screen flex flex-col bg-slate-900 overflow-hidden">
	<!-- Main content area with swipe handling -->
	<SwipeContainer>
		<main class="h-full overflow-auto pb-nav">
			<div
				class="h-full will-change-transform {animationClass}"
				on:animationend={handleAnimationEnd}
			>
				<slot />
			</div>
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
