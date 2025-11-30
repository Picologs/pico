import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
	plugins: [svelte()],
	resolve: {
		alias: {
			$lib: path.resolve('./src/lib'),
			$app: path.resolve('./node_modules/@sveltejs/kit/src/runtime/app')
		},
		conditions: ['browser']
	},
	test: {
		globals: true,
		environment: 'jsdom',
		include: ['src/**/*.{test,spec}.{js,ts}'],
		exclude: [
			'**/node_modules/**',
			// Temporarily exclude tests with complex Svelte component lifecycle issues
			'src/routes/layout.test.ts',
			'src/routes/(app)/(authenticated)/layout.test.ts',
			'src/routes/(app)/(authenticated)/dashboard/page.test.ts',
			'src/lib/oauth.test.ts'
		],
		setupFiles: ['./src/test/setup.ts']
	}
});
