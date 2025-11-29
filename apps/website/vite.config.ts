import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type UserConfig } from 'vite';
import devtoolsJson from 'vite-plugin-devtools-json';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'url';

const isDev = process.env.NODE_ENV !== 'production';
const isTest = process.env.NODE_ENV === 'test' || process.env.PLAYWRIGHT_TEST === 'true';
const useSourceAliases = isDev || isTest;

export default defineConfig(() => ({
	plugins: [tailwindcss(), devtoolsJson(), sveltekit()] as any,
	server: {
		port: 5173,
		strictPort: true,
		fs: {
			// Allow serving files from parent directory (for linked packages)
			allow: ['..']
		},
		watch: useSourceAliases
			? {
					// Force Vite to watch the linked package source files
					ignored: ['!**/node_modules/@pico/shared/**']
				}
			: undefined
	},
	optimizeDeps: {
		// Exclude linked package from pre-bundling in dev/test mode
		// This forces Vite to transform source files on-demand for HMR
		exclude: useSourceAliases ? ['@pico/shared'] : []
	},
	resolve: {
		alias: useSourceAliases
			? {
					// In dev/test mode, point directly to source files for instant HMR
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
					'@pico/types': fileURLToPath(new URL('../../packages/types/src', import.meta.url))
				}
			: undefined
	},
	build: {
		rollupOptions: {
			external: ['sharp']
		}
	}
}));
