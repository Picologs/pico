/**
 * OAuth Module Tests
 *
 * Tests the OAuth module functionality including:
 * - Auth data storage (load/save/clear)
 * - Session management
 * - Legacy API compatibility
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create mock store at module level (accessible to all tests)
const mockStore = {
	get: vi.fn().mockResolvedValue(null),
	set: vi.fn().mockResolvedValue(undefined),
	delete: vi.fn().mockResolvedValue(undefined),
	save: vi.fn().mockResolvedValue(undefined)
};

// Mock @tauri-apps/plugin-store
vi.mock('@tauri-apps/plugin-store', () => ({
	Store: {
		load: vi.fn().mockResolvedValue(mockStore)
	}
}));

// Mock $app/navigation
vi.mock('$app/navigation', () => ({
	goto: vi.fn().mockResolvedValue(undefined)
}));

// Mock svelte tick
vi.mock('svelte', () => ({
	tick: vi.fn().mockResolvedValue(undefined)
}));

// Mock @tauri-apps/plugin-opener
vi.mock('@tauri-apps/plugin-opener', () => ({
	openUrl: vi.fn().mockResolvedValue(undefined)
}));

// Mock @pico/shared
vi.mock('@pico/shared', () => ({
	appState: {
		token: null,
		user: null,
		setUser: vi.fn(),
		addToast: vi.fn()
	}
}));

// Mock $lib/websocket-handler
vi.mock('$lib/websocket-handler', () => ({
	createWebSocketHandler: vi.fn()
}));

// Import modules after mocks
import { appState } from '@pico/shared';

describe('OAuth - Auth Data Storage', () => {
	beforeEach(async () => {
		vi.clearAllMocks();

		// Reset appState
		appState.token = null;
		appState.user = null;

		// Reset mock store to default behavior
		mockStore.get.mockReset().mockResolvedValue(null);
		mockStore.set.mockReset().mockResolvedValue(undefined);
		mockStore.delete.mockReset().mockResolvedValue(undefined);
	});

	describe('loadAuthData', () => {
		it('should return null when no auth data stored', async () => {
			const { loadAuthData } = await import('./oauth');
			const result = await loadAuthData();

			expect(result).toBeNull();
		});

		it('should return auth data when stored', async () => {
			const mockJwt = 'test-jwt-token';
			const mockUser = {
				id: 'user-id',
				discordId: '123456',
				username: 'TestUser',
				avatar: null
			};

			mockStore.get.mockImplementation((key: string) => {
				if (key === 'jwt') return Promise.resolve(mockJwt);
				if (key === 'user') return Promise.resolve(mockUser);
				return Promise.resolve(null);
			});

			const { loadAuthData } = await import('./oauth');
			const result = await loadAuthData();

			expect(result).toEqual({
				jwt: mockJwt,
				user: mockUser
			});
		});

		it('should return null if only jwt is stored (no user)', async () => {
			mockStore.get.mockImplementation((key: string) => {
				if (key === 'jwt') return Promise.resolve('test-jwt');
				return Promise.resolve(null);
			});

			const { loadAuthData } = await import('./oauth');
			const result = await loadAuthData();

			expect(result).toBeNull();
		});
	});

	describe('saveAuthData', () => {
		it('should save jwt and user to store', async () => {
			const jwt = 'new-jwt-token';
			const user = {
				id: 'user-id',
				discordId: '123456',
				username: 'TestUser',
				avatar: null
			};

			const { saveAuthData } = await import('./oauth');
			await saveAuthData(jwt, user as any);

			expect(mockStore.set).toHaveBeenCalledWith('jwt', jwt);
			expect(mockStore.set).toHaveBeenCalledWith('user', user);
		});
	});

	describe('clearAuthData', () => {
		it('should delete jwt and user from store', async () => {
			const { clearAuthData } = await import('./oauth');
			await clearAuthData();

			expect(mockStore.delete).toHaveBeenCalledWith('jwt');
			expect(mockStore.delete).toHaveBeenCalledWith('user');
		});
	});
});

describe('OAuth - Legacy API', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockStore.get.mockReset().mockResolvedValue(null);
	});

	describe('getStoredAuth', () => {
		it('should return null when no auth data', async () => {
			const { getStoredAuth } = await import('./oauth');
			const result = await getStoredAuth();

			expect(result).toBeNull();
		});

		it('should return legacy format when auth data exists', async () => {
			const mockJwt = 'test-jwt';
			const mockUser = {
				id: 'user-id',
				discordId: '123456',
				username: 'TestUser',
				avatar: null
			};

			mockStore.get.mockImplementation((key: string) => {
				if (key === 'jwt') return Promise.resolve(mockJwt);
				if (key === 'user') return Promise.resolve(mockUser);
				return Promise.resolve(null);
			});

			const { getStoredAuth } = await import('./oauth');
			const result = await getStoredAuth();

			expect(result).toEqual({
				userId: mockUser.discordId,
				token: mockJwt,
				user: mockUser
			});
		});
	});

	describe('signOut', () => {
		it('should call clearAuthData', async () => {
			const { signOut } = await import('./oauth');
			await signOut();

			expect(mockStore.delete).toHaveBeenCalledWith('jwt');
			expect(mockStore.delete).toHaveBeenCalledWith('user');
		});
	});

	describe('deprecated functions', () => {
		it('handleDeepLinkCallback should log warning', async () => {
			const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

			const { handleDeepLinkCallback } = await import('./oauth');
			await handleDeepLinkCallback('picologs://callback?code=test');

			expect(consoleWarn).toHaveBeenCalledWith(
				expect.stringContaining('Deep link callback is deprecated')
			);

			consoleWarn.mockRestore();
		});

		it('handleAuthComplete should log warning', async () => {
			const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

			const { handleAuthComplete } = await import('./oauth');
			await handleAuthComplete('test-code', 'test-state');

			expect(consoleWarn).toHaveBeenCalledWith(
				expect.stringContaining('handleAuthComplete is deprecated')
			);

			consoleWarn.mockRestore();
		});
	});
});

describe('OAuth - Testing API', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Clean up window object
		if (typeof window !== 'undefined') {
			delete (window as any).__OAUTH__;
		}
	});

	it('should expose OAuth functions to window object', async () => {
		const { exposeOAuthForTesting } = await import('./oauth');

		exposeOAuthForTesting();

		expect((window as any).__OAUTH__).toBeDefined();
		expect(typeof (window as any).__OAUTH__.initiateOAuthFlow).toBe('function');
		expect(typeof (window as any).__OAUTH__.loadAuthData).toBe('function');
		expect(typeof (window as any).__OAUTH__.saveAuthData).toBe('function');
		expect(typeof (window as any).__OAUTH__.clearAuthData).toBe('function');
	});
});

describe('OAuth - Session Management', () => {
	it('should generate unique session IDs', () => {
		const sessionId1 = crypto.randomUUID();
		const sessionId2 = crypto.randomUUID();

		expect(sessionId1).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
		);
		expect(sessionId2).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
		);
		expect(sessionId1).not.toBe(sessionId2);
	});
});
