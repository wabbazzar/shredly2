import { base } from '$app/paths';

export type TabId = 'profile' | 'schedule' | 'live';

export interface TabConfig {
	id: TabId;
	label: string;
	path: string;
}

// Use function to get tabs with current base path
export function getTabs(): TabConfig[] {
	return [
		{ id: 'profile', label: 'Profile', path: `${base}/profile` },
		{ id: 'schedule', label: 'Schedule', path: `${base}/schedule` },
		{ id: 'live', label: 'Live', path: `${base}/live` }
	];
}

// Static version for type checking (paths without base)
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
	swipeDisabled: boolean;
}
