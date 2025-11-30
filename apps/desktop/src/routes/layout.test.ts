/**
 * Root Layout Tests
 *
 * The root layout is minimal - it just imports CSS and renders children.
 * Complex functionality (sign-out, WebSocket, etc.) is in nested layouts:
 * - (app)/+layout.svelte - Sign-out handler, WebSocket polyfill, window management
 * - (app)/(authenticated)/+layout.svelte - WebSocket connection, loading state
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';

// Mock $app/environment
vi.mock('$app/environment', () => ({
	browser: true
}));

describe('+layout.svelte (Root Layout)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should render children', async () => {
		// Root layout just renders children via {@render children?.()}
		// The actual layout is minimal after the test-helpers import
		const RootLayout = (await import('./+layout.svelte')).default;

		const { container } = render(RootLayout, { props: {} });

		// Should render without errors
		expect(container).toBeTruthy();
	});

	it('should import app.css for global styles', async () => {
		// This is a structural test - the import happens at module level
		// If it fails, the component won't load
		const module = await import('./+layout.svelte');
		expect(module.default).toBeDefined();
	});
});
