import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'url';

const host = process.env.TAURI_DEV_HOST;
const isDev = process.env.NODE_ENV !== 'production';

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	// Local development: alias to shared package source for instant HMR
	resolve: {
		alias: isDev
			? {
					'@pico/shared': fileURLToPath(new URL('../../packages/shared/src/lib', import.meta.url)),
					'@pico/shared/server': fileURLToPath(
						new URL('../../packages/shared/src/lib/server', import.meta.url)
					),
					'@pico/shared/websocket': fileURLToPath(
						new URL('../../packages/shared/src/lib/websocket', import.meta.url)
					),
					'@pico/shared/types': fileURLToPath(
						new URL('../../packages/shared/src/lib/types', import.meta.url)
					),
					'@pico/shared/data/fleet.json': fileURLToPath(
						new URL('../../packages/shared/src/lib/data/fleet.json', import.meta.url)
					)
				}
			: {}
	},
	// Exclude from pre-bundling in dev for faster HMR
	optimizeDeps: {
		exclude: isDev ? ['@pico/shared'] : []
	},
	// Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
	//
	// 1. prevent vite from obscuring rust errors
	clearScreen: false,
	// 2. tauri expects a fixed port, fail if that port is not available
	server: {
		port: 1420,
		strictPort: true,
		host: host || false,
		hmr: host
			? {
					protocol: 'ws',
					host,
					port: 1421
				}
			: undefined,
		watch: {
			// 3. tell vite to ignore watching `src-tauri`
			ignored: ['**/src-tauri/**']
		},
		// Allow serving files from parent directory (for picologs-shared)
		fs: {
			allow: ['..']
		}
	}
});
