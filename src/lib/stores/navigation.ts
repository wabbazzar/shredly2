import { writable } from 'svelte/store';
import { TAB_ORDER, type NavigationState, type TabId } from '$lib/types/navigation';

function createNavigationStore() {
	const { subscribe, update, set } = writable<NavigationState>({
		activeTab: 'schedule',
		previousTab: null,
		transitionDirection: null,
		swipeDisabled: false,
		isLandscape: false
	});

	return {
		subscribe,
		set,
		navigateToTab: (tabId: TabId) => {
			update((state) => {
				const currentIndex = TAB_ORDER.indexOf(state.activeTab);
				const targetIndex = TAB_ORDER.indexOf(tabId);
				return {
					...state,
					activeTab: tabId,
					previousTab: state.activeTab,
					transitionDirection: targetIndex > currentIndex ? 'left' : 'right'
				};
			});
		},
		swipeLeft: () => {
			update((state) => {
				const currentIndex = TAB_ORDER.indexOf(state.activeTab);
				if (currentIndex < TAB_ORDER.length - 1) {
					return {
						...state,
						activeTab: TAB_ORDER[currentIndex + 1],
						previousTab: state.activeTab,
						transitionDirection: 'left'
					};
				}
				return state;
			});
		},
		swipeRight: () => {
			update((state) => {
				const currentIndex = TAB_ORDER.indexOf(state.activeTab);
				if (currentIndex > 0) {
					return {
						...state,
						activeTab: TAB_ORDER[currentIndex - 1],
						previousTab: state.activeTab,
						transitionDirection: 'right'
					};
				}
				return state;
			});
		},
		setActiveTab: (tabId: TabId) => {
			update((state) => ({
				...state,
				activeTab: tabId,
				transitionDirection: null
			}));
		},
		clearTransition: () => {
			update((state) => ({
				...state,
				transitionDirection: null
			}));
		},
		disableSwipe: () => {
			update((state) => ({
				...state,
				swipeDisabled: true
			}));
		},
		enableSwipe: () => {
			update((state) => ({
				...state,
				swipeDisabled: false
			}));
		},
		setLandscape: (isLandscape: boolean) => {
			update((state) => ({
				...state,
				isLandscape
			}));
		}
	};
}

export const navigationStore = createNavigationStore();
