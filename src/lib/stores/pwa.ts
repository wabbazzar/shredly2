/**
 * PWA Update Store
 *
 * Tracks service worker registration and provides manual update functionality.
 * Works with @vite-pwa/sveltekit's autoUpdate registration.
 */

import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

export interface PwaState {
	/** Whether an update is available and waiting */
	updateAvailable: boolean;
	/** Whether we're currently checking for updates */
	checking: boolean;
	/** Last check timestamp */
	lastChecked: Date | null;
	/** Service worker registration (if available) */
	registration: ServiceWorkerRegistration | null;
	/** Error message if check failed */
	error: string | null;
}

const initialState: PwaState = {
	updateAvailable: false,
	checking: false,
	lastChecked: null,
	registration: null,
	error: null
};

function createPwaStore() {
	const { subscribe, set, update } = writable<PwaState>(initialState);

	// Initialize service worker listener
	if (browser && 'serviceWorker' in navigator) {
		navigator.serviceWorker.ready.then((registration) => {
			update((state) => ({ ...state, registration }));

			// Listen for new service worker waiting
			registration.addEventListener('updatefound', () => {
				const newWorker = registration.installing;
				if (newWorker) {
					newWorker.addEventListener('statechange', () => {
						if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
							// New update available and waiting
							update((state) => ({ ...state, updateAvailable: true }));
						}
					});
				}
			});

			// Check if there's already a waiting worker
			if (registration.waiting) {
				update((state) => ({ ...state, updateAvailable: true }));
			}
		});

		// Listen for controller change (new SW activated)
		navigator.serviceWorker.addEventListener('controllerchange', () => {
			// New service worker has taken control
			// IMPORTANT: Don't reload immediately - give async operations time to complete
			// This prevents data loss during reload if IndexedDB operations are in flight
			console.log('[PWA] Service worker update detected, scheduling graceful reload...');

			// Brief delay ensures any pending localStorage/IndexedDB writes complete
			// Longer delays (30s) would be safer but hurt UX - 2s is a reasonable compromise
			setTimeout(() => {
				console.log('[PWA] Applying service worker update...');
				window.location.reload();
			}, 2000);
		});
	}

	return {
		subscribe,

		/**
		 * Check for updates manually
		 * Returns true if an update was found
		 */
		async checkForUpdates(): Promise<boolean> {
			if (!browser || !('serviceWorker' in navigator)) {
				return false;
			}

			// Check if we have a registration already, or if one is pending
			const currentState = get({ subscribe });
			if (!currentState.registration) {
				// Try to get registration with a timeout (no SW in dev mode)
				try {
					const registration = await Promise.race([
						navigator.serviceWorker.getRegistration(),
						new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 2000))
					]);

					if (!registration) {
						update((state) => ({
							...state,
							error: 'No service worker registered (dev mode?)'
						}));
						return false;
					}

					update((state) => ({ ...state, registration }));
				} catch {
					update((state) => ({
						...state,
						error: 'Service worker not available'
					}));
					return false;
				}
			}

			update((state) => ({ ...state, checking: true, error: null }));

			try {
				const registration = get({ subscribe }).registration!;

				// Force check for new service worker
				await registration.update();

				update((state) => ({
					...state,
					checking: false,
					lastChecked: new Date()
				}));

				// If there's a waiting worker, update is available
				if (registration.waiting) {
					update((state) => ({ ...state, updateAvailable: true }));
					return true;
				}

				return false;
			} catch (err) {
				update((state) => ({
					...state,
					checking: false,
					error: err instanceof Error ? err.message : 'Failed to check for updates'
				}));
				return false;
			}
		},

		/**
		 * Apply waiting update and reload
		 */
		async applyUpdate(): Promise<void> {
			const state = get({ subscribe });

			if (state.registration?.waiting) {
				// Tell the waiting service worker to skip waiting
				state.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
				// The controllerchange event will trigger a reload
			} else {
				// No waiting worker, just reload to be safe
				window.location.reload();
			}
		},

		/**
		 * Force reload the app (clears page cache)
		 */
		forceReload(): void {
			if (browser) {
				window.location.reload();
			}
		},

		/**
		 * Nuclear option: unregister service worker, clear caches, reload
		 * Use when updates aren't coming through
		 */
		async forceHardRefresh(): Promise<void> {
			if (!browser) return;

			try {
				// Unregister all service workers
				if ('serviceWorker' in navigator) {
					const registrations = await navigator.serviceWorker.getRegistrations();
					await Promise.all(registrations.map((r) => r.unregister()));
				}

				// Clear all caches
				if ('caches' in window) {
					const cacheNames = await caches.keys();
					await Promise.all(cacheNames.map((name) => caches.delete(name)));
				}

				// Force reload from network
				window.location.reload();
			} catch (err) {
				console.error('Force refresh failed:', err);
				window.location.reload();
			}
		}
	};
}

export const pwaStore = createPwaStore();

// App version (from package.json at build time would require import)
export const APP_VERSION = '2.0.0';
