import { writable } from 'svelte/store';
import { TAB_ORDER, type NavigationState, type TabId } from '$lib/types/navigation';

function createNavigationStore() {
	const { subscribe, update, set } = writable<NavigationState>({
		activeTab: 'schedule',
		previousTab: null,
		transitionDirection: null
	});

	return {
		subscribe,
		set,
		navigateToTab: (tabId: TabId) => {
			update((state) => {
				const currentIndex = TAB_ORDER.indexOf(state.activeTab);
				const targetIndex = TAB_ORDER.indexOf(tabId);
				return {
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
		}
	};
}

export const navigationStore = createNavigationStore();
