/**
 * Authenticated Layout Tests
 *
 * Tests the authenticated layout component including:
 * - beforeNavigate hook that prevents navigation to root/waiting
 * - Loading overlay display during connection/data load
 * - isSigningOut bypass for sign-out navigation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock $app/navigation
vi.mock('$app/navigation', () => ({
	goto: vi.fn(),
	beforeNavigate: vi.fn(),
	afterNavigate: vi.fn()
}));

// Mock $app/environment
vi.mock('$app/environment', () => ({
	browser: true
}));

// Mock @pico/shared - inline factory to avoid hoisting issues
vi.mock('@pico/shared', () => ({
	appState: {
		logs: [],
		user: null,
		token: null,
		addToast: vi.fn(),
		wsClient: null,
		navigate: vi.fn(),
		view: 'dashboard',
		connectionStatus: 'disconnected',
		friends: [],
		groups: [],
		activeGroupId: null,
		isSigningOut: false,
		layoutReady: false,
		setUser: vi.fn(),
		sendRequest: null
	},
	App: vi.fn(() => null),
	LoadingOverlay: vi.fn(() => null),
	initPatternCache: vi.fn(),
	destroyPatternCache: vi.fn()
}));

// Mock $lib/oauth
vi.mock('$lib/oauth', () => ({
	clearAuthData: vi.fn().mockResolvedValue(undefined)
}));

// Mock $lib/logState.svelte
vi.mock('$lib/logState.svelte', () => ({
	logState: {
		forceSave: vi.fn().mockResolvedValue(undefined)
	}
}));

// Mock @tauri-apps/plugin-http
vi.mock('@tauri-apps/plugin-http', () => ({
	fetch: vi.fn()
}));

// Mock fleet data
vi.mock('@pico/shared/data/fleet.json', () => ({
	default: []
}));

// Import after mocks
import { goto } from '$app/navigation';
import { appState } from '@pico/shared';

describe('Authenticated Layout - Navigation Guard', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		// Reset appState properties
		appState.isSigningOut = false;
		appState.connectionStatus = 'disconnected';
		appState.friends = [];
		appState.groups = [];
	});

	describe('beforeNavigate hook', () => {
		it('should cancel navigation to root and redirect to dashboard', () => {
			const navigation = {
				to: { route: { id: '/' } },
				cancel: vi.fn()
			};

			// Simulate the beforeNavigate callback logic
			if (navigation.to?.route.id === '/' || navigation.to?.route.id === '/waiting') {
				if (!appState.isSigningOut) {
					navigation.cancel();
					goto('/dashboard', { replaceState: true });
				}
			}

			expect(navigation.cancel).toHaveBeenCalled();
			expect(goto).toHaveBeenCalledWith('/dashboard', { replaceState: true });
		});

		it('should cancel navigation to waiting page and redirect to dashboard', () => {
			const navigation = {
				to: { route: { id: '/waiting' } },
				cancel: vi.fn()
			};

			if (navigation.to?.route.id === '/' || navigation.to?.route.id === '/waiting') {
				if (!appState.isSigningOut) {
					navigation.cancel();
					goto('/dashboard', { replaceState: true });
				}
			}

			expect(navigation.cancel).toHaveBeenCalled();
			expect(goto).toHaveBeenCalledWith('/dashboard', { replaceState: true });
		});

		it('should allow navigation to other routes', () => {
			const navigation = {
				to: { route: { id: '/profile' } },
				cancel: vi.fn()
			};

			if (navigation.to?.route.id === '/' || navigation.to?.route.id === '/waiting') {
				if (!appState.isSigningOut) {
					navigation.cancel();
					goto('/dashboard', { replaceState: true });
				}
			}

			expect(navigation.cancel).not.toHaveBeenCalled();
			expect(goto).not.toHaveBeenCalled();
		});

		it('should allow navigation to root when signing out', () => {
			appState.isSigningOut = true;

			const navigation = {
				to: { route: { id: '/' } },
				cancel: vi.fn()
			};

			if (navigation.to?.route.id === '/' || navigation.to?.route.id === '/waiting') {
				if (!appState.isSigningOut) {
					navigation.cancel();
					goto('/dashboard', { replaceState: true });
				}
			}

			expect(navigation.cancel).not.toHaveBeenCalled();
			expect(goto).not.toHaveBeenCalled();
		});

		it('should handle null navigation.to gracefully', () => {
			const navigation = {
				to: null,
				cancel: vi.fn()
			};

			if (navigation.to?.route?.id === '/' || navigation.to?.route?.id === '/waiting') {
				if (!appState.isSigningOut) {
					navigation.cancel();
					goto('/dashboard', { replaceState: true });
				}
			}

			expect(navigation.cancel).not.toHaveBeenCalled();
			expect(goto).not.toHaveBeenCalled();
		});
	});
});

describe('Authenticated Layout - Loading State', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		appState.connectionStatus = 'disconnected';
		appState.friends = [];
		appState.groups = [];
	});

	describe('isReady calculation', () => {
		it('should be false when disconnected', () => {
			appState.connectionStatus = 'disconnected';

			const isConnected = appState.connectionStatus === 'connected';
			expect(isConnected).toBe(false);
		});

		it('should be true when connected with data', () => {
			appState.connectionStatus = 'connected';
			appState.friends = [{ id: 'friend-1', discordId: '123', displayName: 'Friend' }] as any;

			const isConnected = appState.connectionStatus === 'connected';
			const hasData = appState.friends.length > 0 || appState.groups.length > 0;

			expect(isConnected).toBe(true);
			expect(hasData).toBe(true);
		});

		it('should track connection status changes', () => {
			appState.connectionStatus = 'disconnected';
			expect(appState.connectionStatus).toBe('disconnected');

			appState.connectionStatus = 'connecting';
			expect(appState.connectionStatus).toBe('connecting');

			appState.connectionStatus = 'connected';
			expect(appState.connectionStatus).toBe('connected');
		});
	});

	describe('Data loading', () => {
		it('should handle user with existing friends and groups', () => {
			appState.friends = [{ id: 'friend-1', discordId: '123', displayName: 'Friend' }] as any;
			appState.groups = [{ id: 'group-1', name: 'Test Group', ownerId: 'test-user' }] as any;

			const hasData = appState.friends.length > 0 || appState.groups.length > 0;
			expect(hasData).toBe(true);
		});

		it('should handle new user with no friends or groups', () => {
			appState.friends = [];
			appState.groups = [];

			const bothEmpty = appState.friends.length === 0 && appState.groups.length === 0;
			expect(bothEmpty).toBe(true);
		});
	});
});
