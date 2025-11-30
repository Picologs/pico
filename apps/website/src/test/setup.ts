/**
 * Vitest global setup file for website tests
 * Configures test environment and provides shared SvelteKit mocks
 */

import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock $app/environment for SvelteKit
vi.mock('$app/environment', () => ({
	dev: false,
	browser: true,
	building: false
}));

// Mock $app/navigation for SvelteKit
vi.mock('$app/navigation', () => ({
	goto: vi.fn().mockResolvedValue(undefined),
	invalidate: vi.fn().mockResolvedValue(undefined),
	invalidateAll: vi.fn().mockResolvedValue(undefined),
	preloadData: vi.fn().mockResolvedValue(undefined),
	preloadCode: vi.fn().mockResolvedValue(undefined),
	beforeNavigate: vi.fn(),
	afterNavigate: vi.fn(),
	onNavigate: vi.fn(),
	pushState: vi.fn(),
	replaceState: vi.fn()
}));

// Mock $app/stores for SvelteKit
vi.mock('$app/stores', () => ({
	page: {
		subscribe: vi.fn((fn: (value: unknown) => void) => {
			fn({ url: new URL('http://localhost/'), params: {} });
			return () => {};
		})
	},
	navigating: {
		subscribe: vi.fn((fn: (value: unknown) => void) => {
			fn(null);
			return () => {};
		})
	},
	updated: {
		subscribe: vi.fn((fn: (value: unknown) => void) => {
			fn(false);
			return () => {};
		}),
		check: vi.fn().mockResolvedValue(false)
	}
}));

// Mock $app/forms for SvelteKit
vi.mock('$app/forms', () => ({
	enhance: vi.fn(() => ({ destroy: vi.fn() })),
	applyAction: vi.fn(),
	deserialize: vi.fn()
}));

// Mock $env/dynamic/public
vi.mock('$env/dynamic/public', () => ({
	env: {
		PUBLIC_WS_URL: 'ws://localhost:8080'
	}
}));

// Mock $env/dynamic/private
vi.mock('$env/dynamic/private', () => ({
	env: {
		JWT_SECRET: 'test-jwt-secret',
		DISCORD_CLIENT_ID: 'test-client-id',
		DISCORD_CLIENT_SECRET: 'test-client-secret'
	}
}));

// Mock $lib/db
vi.mock('$lib/db', () => ({
	db: {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		insert: vi.fn().mockReturnThis(),
		values: vi.fn().mockReturnThis(),
		update: vi.fn().mockReturnThis(),
		set: vi.fn().mockReturnThis(),
		delete: vi.fn().mockReturnThis(),
		returning: vi.fn().mockResolvedValue([])
	},
	schema: {}
}));

// Mock WebSocket for browser tests
class MockWebSocket {
	static CONNECTING = 0;
	static OPEN = 1;
	static CLOSING = 2;
	static CLOSED = 3;

	readyState = MockWebSocket.CONNECTING;
	url: string;
	onopen: ((event: Event) => void) | null = null;
	onmessage: ((event: MessageEvent) => void) | null = null;
	onerror: ((event: Event) => void) | null = null;
	onclose: ((event: CloseEvent) => void) | null = null;

	constructor(url: string) {
		this.url = url;
		// Simulate async connection
		setTimeout(() => {
			this.readyState = MockWebSocket.OPEN;
			if (this.onopen) {
				this.onopen(new Event('open'));
			}
		}, 0);
	}

	send(_data: string): void {
		// Mock send - do nothing
	}

	close(): void {
		this.readyState = MockWebSocket.CLOSED;
		if (this.onclose) {
			this.onclose(new CloseEvent('close'));
		}
	}
}

// @ts-expect-error - Mocking global WebSocket
global.WebSocket = MockWebSocket;

// Mock fetch for API calls
global.fetch = vi.fn().mockResolvedValue({
	ok: true,
	json: vi.fn().mockResolvedValue({}),
	text: vi.fn().mockResolvedValue('')
});

// Global test utilities
export const resetMocks = () => {
	vi.clearAllMocks();
};
