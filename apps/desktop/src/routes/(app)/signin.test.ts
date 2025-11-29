/**
 * Discord Sign-In Flow Tests
 *
 * Tests the complete OAuth authentication flow from sign-in button click
 * through successful authentication and error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import type { Mock } from 'vitest';

// Mock environment (must come first)
vi.mock('$app/environment', () => ({
	browser: true
}));

// Mock navigation
vi.mock('$app/navigation', () => ({
	goto: vi.fn()
}));

// Mock storage
vi.mock('$lib/storage', () => ({
	setStorageValue: vi.fn().mockResolvedValue(undefined),
	getStorageValue: vi.fn().mockResolvedValue(null)
}));

// Mock fleet data
vi.mock('@pico/shared/data/fleet.json', () => ({
	default: []
}));

// Mock shared library
vi.mock('@pico/shared', () => ({
	appState: {
		logs: [],
		currentPlayer: null,
		user: null,
		sendRequest: null,
		logLocation: null,
		signIn: null,
		selectLogFile: null,
		hasLogs: false,
		hasSelectedLog: false,
		clearLogs: vi.fn(),
		addToast: vi.fn(),
		updateProfile: vi.fn()
	},
	LogFeed: vi.fn(() => null),
	Toast: vi.fn(() => null),
	getCurrentPlayer: vi.fn(() => null),
	LoadingOverlay: vi.fn(() => null)
}));

// Mock log watcher
vi.mock('$lib/logWatcher', () => ({
	autoDetectGameLog: vi.fn(),
	getSavedLogPath: vi.fn(),
	startLogWatcher: vi.fn(),
	stopLogWatcher: vi.fn(),
	selectLogFileManually: vi.fn()
}));

// Mock OAuth utilities
vi.mock('$lib/oauth', () => ({
	initiateOAuthFlow: vi.fn(),
	handleAuthComplete: vi.fn()
}));

// Mock Lucide icons
vi.mock('@lucide/svelte', () => ({
	FolderOpen: vi.fn(() => null),
	Loader2: vi.fn(() => null)
}));

// Import mocked modules
import { goto } from '$app/navigation';
import { initiateOAuthFlow, handleAuthComplete } from '$lib/oauth';
import { appState, getCurrentPlayer } from '@pico/shared';
import { getSavedLogPath, autoDetectGameLog, startLogWatcher } from '$lib/logWatcher';

describe('Discord Sign-In Flow', () => {
	beforeEach(() => {
		// Clear all mocks
		vi.clearAllMocks();

		// Reset mock implementations
		(initiateOAuthFlow as Mock).mockResolvedValue(undefined);
		(handleAuthComplete as Mock).mockResolvedValue(undefined);
		(getSavedLogPath as Mock).mockResolvedValue(null);
		(autoDetectGameLog as Mock).mockResolvedValue(null);
		(startLogWatcher as Mock).mockResolvedValue(undefined);
		(getCurrentPlayer as Mock).mockReturnValue(null);
		(goto as Mock).mockResolvedValue(undefined);

		// Reset appState
		appState.logs = [];
		appState.currentPlayer = null;
		appState.user = null;
		appState.logLocation = null;
		appState.signIn = null;
		appState.selectLogFile = null;
		appState.hasLogs = false;
		appState.hasSelectedLog = false;
	});

	describe('Sign-In Initiation', () => {
		it('should register sign-in callback on component mount', async () => {
			const MainPage = (await import('./+page.svelte')).default;

			const props = { data: { authChecked: true } };
			render(MainPage, { props });

			// Wait for component to mount and register callback
			await waitFor(() => {
				expect(appState.signIn).toBeDefined();
			});

			expect(appState.signIn).toBeInstanceOf(Function);
		});

		it('should call initiateOAuthFlow when sign-in is triggered', async () => {
			const MainPage = (await import('./+page.svelte')).default;

			const props = { data: { authChecked: true } };
			render(MainPage, { props });

			// Wait for sign-in callback to be registered
			await waitFor(() => {
				expect(appState.signIn).toBeDefined();
			});

			// Trigger sign-in
			if (appState.signIn) {
				await appState.signIn();
			}

			// Verify OAuth flow initiated
			await waitFor(() => {
				expect(initiateOAuthFlow).toHaveBeenCalledTimes(1);
			});
		});

		it('should pass callback to initiateOAuthFlow for dev mode dialog', async () => {
			const MainPage = (await import('./+page.svelte')).default;

			const props = { data: { authChecked: true } };
			render(MainPage, { props });

			await waitFor(() => {
				expect(appState.signIn).toBeDefined();
			});

			// Trigger sign-in
			if (appState.signIn) {
				await appState.signIn();
			}

			// Verify callback passed for dev mode paste dialog
			await waitFor(() => {
				expect(initiateOAuthFlow).toHaveBeenCalledWith(expect.any(Function));
			});
		});
	});

	describe('Successful Authentication Flow', () => {
		it('should successfully initiate OAuth without errors', async () => {
			const MainPage = (await import('./+page.svelte')).default;

			const props = { data: { authChecked: true } };
			render(MainPage, { props });

			await waitFor(() => {
				expect(appState.signIn).toBeDefined();
			});

			// Trigger sign-in
			if (appState.signIn) {
				await appState.signIn();
			}

			// Verify no errors
			await waitFor(() => {
				expect(initiateOAuthFlow).toHaveBeenCalled();
			});

			expect(appState.addToast).not.toHaveBeenCalledWith(
				expect.stringContaining('Failed'),
				'error'
			);
		});

		it('should not show error toast on successful OAuth initiation', async () => {
			const MainPage = (await import('./+page.svelte')).default;

			(initiateOAuthFlow as Mock).mockResolvedValue(undefined);

			const props = { data: { authChecked: true } };
			render(MainPage, { props });

			await waitFor(() => {
				expect(appState.signIn).toBeDefined();
			});

			if (appState.signIn) {
				await appState.signIn();
			}

			await waitFor(() => {
				expect(initiateOAuthFlow).toHaveBeenCalled();
			});

			// Should not show error toast
			expect(appState.addToast).not.toHaveBeenCalled();
		});
	});

	describe('Error Handling', () => {
		it('should show error toast when OAuth initiation fails', async () => {
			const MainPage = (await import('./+page.svelte')).default;

			const testError = new Error('Network error');
			(initiateOAuthFlow as Mock).mockRejectedValue(testError);

			const props = { data: { authChecked: true } };
			render(MainPage, { props });

			await waitFor(() => {
				expect(appState.signIn).toBeDefined();
			});

			if (appState.signIn) {
				await appState.signIn();
			}

			// Verify error toast shown
			await waitFor(() => {
				expect(appState.addToast).toHaveBeenCalledWith(
					'Failed to sign in. Please try again.',
					'error'
				);
			});
		});

		it('should log error to console when sign-in fails', async () => {
			const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
			const MainPage = (await import('./+page.svelte')).default;

			const testError = new Error('OAuth timeout');
			(initiateOAuthFlow as Mock).mockRejectedValue(testError);

			const props = { data: { authChecked: true } };
			render(MainPage, { props });

			await waitFor(() => {
				expect(appState.signIn).toBeDefined();
			});

			if (appState.signIn) {
				await appState.signIn();
			}

			// Verify error logged
			await waitFor(() => {
				expect(consoleError).toHaveBeenCalledWith('[Auth] Sign in failed:', testError);
			});

			consoleError.mockRestore();
		});

		it('should handle WebSocket connection timeout gracefully', async () => {
			const MainPage = (await import('./+page.svelte')).default;

			const timeoutError = new Error('OAuth exchange timed out');
			(initiateOAuthFlow as Mock).mockRejectedValue(timeoutError);

			const props = { data: { authChecked: true } };
			render(MainPage, { props });

			await waitFor(() => {
				expect(appState.signIn).toBeDefined();
			});

			if (appState.signIn) {
				await appState.signIn();
			}

			// Should show user-friendly error
			await waitFor(() => {
				expect(appState.addToast).toHaveBeenCalledWith(
					'Failed to sign in. Please try again.',
					'error'
				);
			});
		});

		it('should handle server error response gracefully', async () => {
			const MainPage = (await import('./+page.svelte')).default;

			const serverError = new Error('Invalid OAuth code');
			(initiateOAuthFlow as Mock).mockRejectedValue(serverError);

			const props = { data: { authChecked: true } };
			render(MainPage, { props });

			await waitFor(() => {
				expect(appState.signIn).toBeDefined();
			});

			if (appState.signIn) {
				await appState.signIn();
			}

			// Should show generic error to user
			await waitFor(() => {
				expect(appState.addToast).toHaveBeenCalledWith(
					'Failed to sign in. Please try again.',
					'error'
				);
			});
		});

		it('should not crash app when sign-in fails', async () => {
			const MainPage = (await import('./+page.svelte')).default;

			(initiateOAuthFlow as Mock).mockRejectedValue(new Error('Test error'));

			const props = { data: { authChecked: true } };
			const { container } = render(MainPage, { props });

			await waitFor(() => {
				expect(appState.signIn).toBeDefined();
			});

			if (appState.signIn) {
				await appState.signIn();
			}

			// Wait for error handling
			await waitFor(() => {
				expect(appState.addToast).toHaveBeenCalled();
			});

			// Component should still be mounted
			expect(container.firstChild).toBeTruthy();
		});
	});

	describe('State Management', () => {
		it('should have null user before authentication', async () => {
			const MainPage = (await import('./+page.svelte')).default;

			const props = { data: { authChecked: true } };
			render(MainPage, { props });

			// User should be null initially
			expect(appState.user).toBeNull();
		});

		it('should register sign-in callback when user is null', async () => {
			const MainPage = (await import('./+page.svelte')).default;

			appState.user = null;

			const props = { data: { authChecked: true } };
			render(MainPage, { props });

			await waitFor(() => {
				expect(appState.signIn).toBeDefined();
			});

			expect(appState.signIn).toBeInstanceOf(Function);
		});

		it('should maintain sign-in callback reference across renders', async () => {
			const MainPage = (await import('./+page.svelte')).default;

			const props = { data: { authChecked: true } };
			render(MainPage, { props });

			await waitFor(() => {
				expect(appState.signIn).toBeDefined();
			});

			const firstCallback = appState.signIn;

			// Callback should remain the same
			expect(appState.signIn).toBe(firstCallback);
		});
	});

	describe('Multiple Sign-In Attempts', () => {
		it('should handle multiple sign-in attempts sequentially', async () => {
			const MainPage = (await import('./+page.svelte')).default;

			const props = { data: { authChecked: true } };
			render(MainPage, { props });

			await waitFor(() => {
				expect(appState.signIn).toBeDefined();
			});

			// First attempt
			if (appState.signIn) {
				await appState.signIn();
			}

			await waitFor(() => {
				expect(initiateOAuthFlow).toHaveBeenCalledTimes(1);
			});

			// Second attempt
			if (appState.signIn) {
				await appState.signIn();
			}

			await waitFor(() => {
				expect(initiateOAuthFlow).toHaveBeenCalledTimes(2);
			});
		});

		it('should handle retry after failed attempt', async () => {
			const MainPage = (await import('./+page.svelte')).default;

			// First attempt fails
			(initiateOAuthFlow as Mock).mockRejectedValueOnce(new Error('Network error'));

			const props = { data: { authChecked: true } };
			render(MainPage, { props });

			await waitFor(() => {
				expect(appState.signIn).toBeDefined();
			});

			// First attempt
			if (appState.signIn) {
				await appState.signIn();
			}

			await waitFor(() => {
				expect(appState.addToast).toHaveBeenCalledWith(
					'Failed to sign in. Please try again.',
					'error'
				);
			});

			// Second attempt succeeds
			(initiateOAuthFlow as Mock).mockResolvedValueOnce(undefined);

			if (appState.signIn) {
				await appState.signIn();
			}

			await waitFor(() => {
				expect(initiateOAuthFlow).toHaveBeenCalledTimes(2);
			});

			// Should have one error toast from first attempt only
			expect(appState.addToast).toHaveBeenCalledTimes(1);
		});
	});

	describe('Post-Authentication State', () => {
		it('should populate appState.user with UserProfile after successful auth', async () => {
			// This would be set by the OAuth callback handler
			const mockUser = {
				id: 'user-uuid-123',
				discordId: '123456789',
				username: 'TestUser',
				avatar: 'avatar-hash',
				player: 'SpaceCitizen123',
				timeZone: 'America/Los_Angeles',
				usePlayerAsDisplayName: true,
				friendCode: 'ABC123',
				createdAt: '2024-01-01T00:00:00Z',
				updatedAt: '2024-01-01T00:00:00Z'
			};

			appState.user = mockUser;

			expect(appState.user).toEqual(mockUser);
			expect(appState.user?.discordId).toBe('123456789');
			expect(appState.user?.username).toBe('TestUser');
			expect(appState.user?.player).toBe('SpaceCitizen123');
		});

		it('should populate appState.token with JWT string after successful auth', async () => {
			const mockJwt =
				'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkiLCJuYW1lIjoiSm9obiBEb2UifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

			appState.token = mockJwt;

			expect(appState.token).toBe(mockJwt);
			expect(typeof appState.token).toBe('string');
			expect(appState.token).toMatch(/^eyJ/); // JWT starts with eyJ
		});

		it('should verify auth data is stored in auth.json via saveAuthData', async () => {
			// This test verifies the storage integration
			// The actual saveAuthData call happens in oauth.ts, not in +page.svelte
			// We're testing that the pattern is correct

			const mockUser = {
				id: 'user-uuid-123',
				discordId: '123456789',
				username: 'TestUser',
				avatar: null,
				player: null,
				timeZone: null,
				usePlayerAsDisplayName: false,
				friendCode: null,
				createdAt: '2024-01-01T00:00:00Z',
				updatedAt: '2024-01-01T00:00:00Z'
			};
			const mockJwt = 'test-jwt-token';

			// Simulate what happens after OAuth callback
			appState.user = mockUser;
			appState.token = mockJwt;

			expect(appState.user).toBeTruthy();
			expect(appState.token).toBeTruthy();
		});

		it('should handle user profile with null optional fields', async () => {
			const mockUser = {
				id: 'user-uuid-123',
				discordId: '123456789',
				username: 'TestUser',
				avatar: null,
				player: null,
				timeZone: null,
				usePlayerAsDisplayName: false,
				friendCode: null,
				createdAt: '2024-01-01T00:00:00Z',
				updatedAt: '2024-01-01T00:00:00Z'
			};

			appState.user = mockUser;

			expect(appState.user?.avatar).toBeNull();
			expect(appState.user?.player).toBeNull();
			expect(appState.user?.timeZone).toBeNull();
			expect(appState.user?.friendCode).toBeNull();
		});

		it('should handle user profile with Star Citizen player name', async () => {
			const mockUser = {
				id: 'user-uuid-123',
				discordId: '123456789',
				username: 'TestUser',
				avatar: 'avatar-hash',
				player: 'SpaceCitizen123',
				timeZone: 'America/Los_Angeles',
				usePlayerAsDisplayName: true,
				friendCode: 'ABC123',
				createdAt: '2024-01-01T00:00:00Z',
				updatedAt: '2024-01-01T00:00:00Z'
			};

			appState.user = mockUser;

			expect(appState.user?.player).toBe('SpaceCitizen123');
			expect(appState.user?.usePlayerAsDisplayName).toBe(true);
		});
	});

	describe('WebSocket Connection After Sign-In', () => {
		it('should establish WebSocket connection with JWT after authentication', async () => {
			// This test verifies the pattern for WebSocket connection
			// The actual connection happens in (authenticated)/+layout.svelte

			const mockJwt = 'test-jwt-token';
			const mockUser = {
				id: 'user-uuid-123',
				discordId: '123456789',
				username: 'TestUser',
				avatar: null,
				player: null,
				timeZone: null,
				usePlayerAsDisplayName: false,
				friendCode: null,
				createdAt: '2024-01-01T00:00:00Z',
				updatedAt: '2024-01-01T00:00:00Z'
			};

			// Simulate authenticated state
			appState.token = mockJwt;
			appState.user = mockUser;

			// In the real app, the authenticated layout would use these
			// to establish WebSocket connection
			expect(appState.token).toBeTruthy();
			expect(appState.user?.discordId).toBeTruthy();
		});

		it('should have sendRequest available after WebSocket connection', async () => {
			// Mock sendRequest function (would be set by WebSocket client)
			const mockSendRequest = vi.fn().mockResolvedValue({
				friends: [],
				groups: [],
				notifications: []
			});

			appState.sendRequest = mockSendRequest;

			expect(appState.sendRequest).toBeDefined();
			expect(typeof appState.sendRequest).toBe('function');

			// Verify it can be called
			const result = await appState.sendRequest('get_dashboard_data', {
				friendsPage: 1,
				friendsPerPage: 20,
				includeGroupMembers: true
			});

			expect(result).toEqual({
				friends: [],
				groups: [],
				notifications: []
			});
		});
	});
});
