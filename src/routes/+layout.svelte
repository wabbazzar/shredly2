<script lang="ts">
	import '../app.css';
	import BottomTabBar from '$lib/components/BottomTabBar.svelte';
	import SwipeContainer from '$lib/components/SwipeContainer.svelte';
	import LoadingScreen from '$lib/components/LoadingScreen.svelte';
	import { navigationStore } from '$lib/stores/navigation';
	import { initializeScheduleStore } from '$lib/stores/schedule';
	import { fullRecalculateCache } from '$lib/stores/oneRMCache';
	import { hydrateHistory } from '$lib/stores/history';
	import { userStore } from '$lib/stores/user';
	import { get } from 'svelte/store';
	import { onMount } from 'svelte';

	let isAppReady = false;
	let minTimeElapsed = false;
	let isFadingOut = false;
	let showLoadingScreen = true;

	const MIN_LOADING_TIME = 800; // ms - enough to see, not enough to annoy
	const FADE_DURATION = 300; // ms - matches transition-opacity duration-300

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

			// Fallback timeout in case animationend doesn't fire (must match CSS animation duration)
			setTimeout(() => {
				if (isTransitioning) handleAnimationEnd();
			}, 300);
		}
	}

	// Dismiss loading screen with fade when both conditions met
	function dismissLoadingScreen() {
		if (isAppReady && minTimeElapsed && !isFadingOut) {
			isFadingOut = true;
			setTimeout(() => {
				showLoadingScreen = false;
			}, FADE_DURATION);
		}
	}

	// Watch for conditions to dismiss
	$: if (isAppReady && minTimeElapsed) dismissLoadingScreen();

	// Initialize stores once at app startup
	onMount(() => {
		// Start minimum time timer
		setTimeout(() => {
			minTimeElapsed = true;
		}, MIN_LOADING_TIME);

		// Hydrate stores from localStorage (SSR sends empty arrays)
		hydrateHistory();
		initializeScheduleStore();

		// Initialize 1RM cache with user overrides (depends on history being hydrated)
		const userData = get(userStore);
		const userOverrides: Record<string, number> = {};
		for (const orm of userData.oneRepMaxes) {
			if (orm.isManual && orm.weightLbs > 0) {
				userOverrides[orm.exerciseName] = orm.weightLbs;
			}
		}
		fullRecalculateCache(undefined, userOverrides);

		// App is ready
		isAppReady = true;
	});
</script>

{#if showLoadingScreen}
	<LoadingScreen fadeOut={isFadingOut} />
{/if}

<div class="h-full flex flex-col bg-slate-900 overflow-hidden">
	<!-- Main content area with swipe handling -->
	<SwipeContainer>
		<main class="h-full overflow-auto pb-nav">
			<div
				class="h-full {isTransitioning ? 'will-change-transform' : ''} {animationClass}"
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
