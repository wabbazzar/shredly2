export type TabId = 'profile' | 'schedule' | 'live';

export interface TabConfig {
	id: TabId;
	label: string;
	path: string;
}

export const TABS: TabConfig[] = [
	{ id: 'profile', label: 'Profile', path: '/profile' },
	{ id: 'schedule', label: 'Schedule', path: '/schedule' },
	{ id: 'live', label: 'Live', path: '/live' }
];

export const TAB_ORDER: TabId[] = ['profile', 'schedule', 'live'];

export interface NavigationState {
	activeTab: TabId;
	previousTab: TabId | null;
	transitionDirection: 'left' | 'right' | null;
}
