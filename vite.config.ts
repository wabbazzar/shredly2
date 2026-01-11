import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit(),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			manifest: false, // Use static/manifest.json instead
			workbox: {
				globPatterns: ['client/**/*.{js,css,html,ico,png,svg,woff,woff2}'],
				globIgnores: ['**/node_modules/**'],
				runtimeCaching: [
					{
						urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
						handler: 'CacheFirst',
						options: {
							cacheName: 'google-fonts-cache',
							expiration: {
								maxEntries: 10,
								maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
							},
							cacheableResponse: {
								statuses: [0, 200]
							}
						}
					}
				]
			},
			devOptions: {
				enabled: false // Disable PWA in dev mode to avoid caching issues
			}
		})
	],
	server: {
		port: 5173,
		strictPort: false
	},
	build: {
		target: 'es2022'
	}
});
