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
				globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}']
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
