/**
 * Application State Tests
 *
 * Tests the website application state module
 */

import { describe, it, expect, vi } from 'vitest';

// Mock shared appState
const mockAppState = {
	user: null,
	token: null,
	logs: [],
	friends: [],
	groups: [],
	notifications: [],
	sendRequest: null,
	addToast: vi.fn(),
	clearLogs: vi.fn()
};

vi.mock('@pico/shared', () => ({
	appState: mockAppState
}));

describe('Application State', () => {
	describe('State Export', () => {
		it('should export appState from shared module', async () => {
			const stateModule = await import('./state.svelte');
			expect(stateModule.appState).toBeDefined();
		});

		it('should use shared global app state', async () => {
			const { appState } = await import('./state.svelte');
			expect(appState).toBe(mockAppState);
		});
	});

	describe('User State', () => {
		it('should have null user initially', async () => {
			const { appState } = await import('./state.svelte');
			expect(appState.user).toBeNull();
		});

		it('should allow setting user', async () => {
			const { appState } = await import('./state.svelte');

			const mockUser = {
				id: 'user-123',
				discordId: '123456789',
				username: 'TestUser',
				avatar: null,
				player: null,
				timeZone: null,
				usePlayerAsDisplayName: false,
				betaTester: false,
				friendCode: null,
				role: 'user' as const,
				createdAt: '2024-01-01T00:00:00Z',
				updatedAt: '2024-01-01T00:00:00Z'
			};

			appState.user = mockUser;
			expect(appState.user).toEqual(mockUser);
		});
	});

	describe('Token State', () => {
		it('should have null token initially', async () => {
			const { appState } = await import('./state.svelte');
			expect(appState.token).toBeNull();
		});

		it('should allow setting token', async () => {
			const { appState } = await import('./state.svelte');

			const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
			appState.token = mockToken;

			expect(appState.token).toBe(mockToken);
		});
	});

	describe('Logs State', () => {
		it('should have empty logs array initially', async () => {
			const { appState } = await import('./state.svelte');
			expect(appState.logs).toEqual([]);
		});
	});

	describe('Friends State', () => {
		it('should have friends array', async () => {
			const { appState } = await import('./state.svelte');
			expect(Array.isArray(appState.friends)).toBe(true);
		});
	});

	describe('Groups State', () => {
		it('should have groups array', async () => {
			const { appState } = await import('./state.svelte');
			expect(Array.isArray(appState.groups)).toBe(true);
		});
	});

	describe('Notifications State', () => {
		it('should have notifications array', async () => {
			const { appState } = await import('./state.svelte');
			expect(Array.isArray(appState.notifications)).toBe(true);
		});
	});

	describe('Toast Functionality', () => {
		it('should have addToast function', async () => {
			const { appState } = await import('./state.svelte');
			expect(typeof appState.addToast).toBe('function');
		});
	});

	describe('Clear Logs Functionality', () => {
		it('should have clearLogs function', async () => {
			const { appState } = await import('./state.svelte');
			expect(typeof appState.clearLogs).toBe('function');
		});
	});
});
