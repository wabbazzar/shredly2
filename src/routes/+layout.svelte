<script lang="ts">
	import '../app.css';
	import BottomTabBar from '$lib/components/BottomTabBar.svelte';
	import SwipeContainer from '$lib/components/SwipeContainer.svelte';
	import LoadingScreen from '$lib/components/LoadingScreen.svelte';
	import { navigationStore } from '$lib/stores/navigation';
	import { initializeScheduleStore } from '$lib/stores/schedule';
	import { fullRecalculateCache } from '$lib/stores/oneRMCache';
	import { initializeHistory } from '$lib/stores/history';
	import { userStore } from '$lib/stores/user';
	import { get } from 'svelte/store';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';

	let isAppReady = false;
	let minTimeElapsed = false;
	let isFadingOut = false;
	let showLoadingScreen = true;

	const MIN_LOADING_TIME = 800; // ms - enough to see, not enough to annoy
	const FADE_DURATION = 300; // ms - matches transition-opacity duration-300

	// Landscape mode detection for hiding nav bar on live view (mobile only)
	let landscapeMediaQuery: MediaQueryList | null = null;

	function handleLandscapeChange(e: MediaQueryListEvent | MediaQueryList) {
		navigationStore.setLandscape(e.matches);
	}

	// Determine if nav bar should be hidden (live tab + landscape mode on mobile)
	$: isLiveTab = $page.url.pathname.includes('/live');
	$: hideNavBar = isLiveTab && $navigationStore.isLandscape;

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

	/**
	 * Request persistent storage to prevent browser from clearing localStorage/IndexedDB
	 * Without this, PWA storage is "best effort" and can be evicted by the browser
	 */
	async function requestPersistentStorage(): Promise<void> {
		if (!browser || !navigator.storage?.persist) return;

		try {
			const isPersistent = await navigator.storage.persist();
			if (isPersistent) {
				console.log('[Storage] Persistent storage granted');
			} else {
				console.warn('[Storage] Persistent storage denied - data may be cleared by browser');
			}
		} catch (e) {
			console.warn('[Storage] Failed to request persistent storage:', e);
		}
	}

	// Initialize stores once at app startup
	onMount(async () => {
		// Start minimum time timer
		setTimeout(() => {
			minTimeElapsed = true;
		}, MIN_LOADING_TIME);

		// Set up landscape mode detection (mobile only - max-height prevents desktop from matching)
		if (browser) {
			landscapeMediaQuery = window.matchMedia('(orientation: landscape) and (max-height: 600px)');
			handleLandscapeChange(landscapeMediaQuery);
			landscapeMediaQuery.addEventListener('change', handleLandscapeChange);
		}

		// Request persistent storage FIRST - prevents browser from clearing our data
		await requestPersistentStorage();

		// CRITICAL: Initialize history from IndexedDB (migrates from localStorage if needed)
		// This uses the same robust pattern as schedules
		await initializeHistory();

		// CRITICAL: Await IndexedDB initialization for schedules
		// Without this, reload during initialization can lose data
		await initializeScheduleStore();

		// Initialize 1RM cache with user overrides (depends on history being initialized)
		const userData = get(userStore);
		const userOverrides: Record<string, number> = {};
		for (const orm of userData.oneRepMaxes) {
			if (orm.isManual && orm.weightLbs > 0) {
				userOverrides[orm.exerciseName] = orm.weightLbs;
			}
		}
		fullRecalculateCache(undefined, userOverrides);

		// App is ready ONLY after all async initialization is complete
		isAppReady = true;
	});

	onDestroy(() => {
		if (landscapeMediaQuery) {
			landscapeMediaQuery.removeEventListener('change', handleLandscapeChange);
		}
	});
</script>

{#if showLoadingScreen}
	<LoadingScreen fadeOut={isFadingOut} />
{/if}

<div class="h-full flex flex-col bg-slate-900 overflow-hidden">
	<!-- Main content area with swipe handling -->
	<SwipeContainer>
		<main class="h-full overflow-auto {hideNavBar ? '' : 'pb-nav'}">
			<div
				class="h-full {isTransitioning ? 'will-change-transform' : ''} {animationClass}"
				on:animationend={handleAnimationEnd}
			>
				<slot />
			</div>
		</main>
	</SwipeContainer>

	<!-- Bottom tab navigation - hidden in landscape mode on mobile live view -->
	{#if !hideNavBar}
		<BottomTabBar />
	{/if}
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
