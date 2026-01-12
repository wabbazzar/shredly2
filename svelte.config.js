import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// GitHub Pages base path - set to repo name for github.io hosting
// NOTE: Remove paths.base when migrating to shredly.me (custom domain at root)
const isGitHubPages = process.env.GITHUB_PAGES === 'true';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: 'index.html',
			precompress: false,
			strict: true
		}),
		paths: {
			base: isGitHubPages ? '/shredly2' : ''
		},
		alias: {
			$lib: './src/lib',
			$data: './src/data'
		}
	}
};

export default config;
