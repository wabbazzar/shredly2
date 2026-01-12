<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { navigationStore } from '$lib/stores/navigation';
	import { TAB_ORDER, getTabs, type TabId } from '$lib/types/navigation';

	const SWIPE_THRESHOLD = 50; // Minimum px to trigger swipe
	const VELOCITY_THRESHOLD = 0.3; // Minimum velocity (px/ms)

	let startX = 0;
	let startY = 0;
	let startTime = 0;
	let isDragging = false;
	let isHorizontal: boolean | null = null;

	function getTabPath(tabId: TabId): string {
		const tabs = getTabs();
		const tab = tabs.find((t) => t.id === tabId);
		return tab?.path ?? `${base}/schedule`;
	}

	function getCurrentTabId(): TabId {
		const path = $page.url.pathname;
		const tabs = getTabs();
		const tab = tabs.find((t) => t.path === path);
		return tab?.id ?? 'schedule';
	}

	function handleTouchStart(e: TouchEvent) {
		startX = e.touches[0].clientX;
		startY = e.touches[0].clientY;
		startTime = Date.now();
		isDragging = true;
		isHorizontal = null;
	}

	function handleTouchMove(e: TouchEvent) {
		if (!isDragging) return;

		const currentX = e.touches[0].clientX;
		const currentY = e.touches[0].clientY;
		const deltaX = currentX - startX;
		const deltaY = currentY - startY;

		// Determine swipe direction on first significant movement
		if (isHorizontal === null && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
			isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);
		}

		// If vertical scroll is dominant, cancel horizontal swipe
		if (isHorizontal === false) {
			isDragging = false;
			return;
		}

		// Prevent default scrolling during horizontal swipe
		if (isHorizontal === true && Math.abs(deltaX) > 10) {
			e.preventDefault();
		}
	}

	function handleTouchEnd(e: TouchEvent) {
		if (!isDragging || isHorizontal !== true) {
			isDragging = false;
			isHorizontal = null;
			return;
		}

		const endX = e.changedTouches[0].clientX;
		const deltaX = endX - startX;
		const duration = Date.now() - startTime;
		const velocity = Math.abs(deltaX) / duration;

		// Check if swipe meets threshold
		if (Math.abs(deltaX) > SWIPE_THRESHOLD || velocity > VELOCITY_THRESHOLD) {
			const currentTabId = getCurrentTabId();
			const currentIndex = TAB_ORDER.indexOf(currentTabId);

			if (deltaX > 0 && currentIndex > 0) {
				// Swipe right -> go to previous tab
				const prevTab = TAB_ORDER[currentIndex - 1];
				navigationStore.navigateToTab(prevTab);
				goto(getTabPath(prevTab));
			} else if (deltaX < 0 && currentIndex < TAB_ORDER.length - 1) {
				// Swipe left -> go to next tab
				const nextTab = TAB_ORDER[currentIndex + 1];
				navigationStore.navigateToTab(nextTab);
				goto(getTabPath(nextTab));
			}
		}

		isDragging = false;
		isHorizontal = null;
	}
</script>

<div
	class="flex-1 overflow-hidden touch-pan-y"
	ontouchstart={handleTouchStart}
	ontouchmove={handleTouchMove}
	ontouchend={handleTouchEnd}
	role="tabpanel"
>
	<slot />
</div>
