// Tauri doesn't have a Node.js server to do proper SSR
// so we will use adapter-static to prerender the app (SSG)
// See: https://v2.tauri.app/start/frontend/sveltekit/ for more info
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			fallback: 'index.html', // Enable client-side routing for dynamic routes
			strict: false, // Allow all routes to fallback to index.html (required for Tauri)
			precompress: false
		}),
		// Disable SvelteKit's CSP nonces - Tauri handles CSP
		csp: {
			mode: 'auto',
			directives: {
				'default-src': undefined
			}
		}
	}
};

export default config;
