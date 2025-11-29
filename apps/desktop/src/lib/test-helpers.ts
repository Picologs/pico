/**
 * Test Helpers Module
 *
 * This module provides test utilities that are ONLY available in debug/test builds.
 * The entire module is tree-shaken out of production builds via dead code elimination.
 *
 * Usage in E2E tests:
 * ```typescript
 * await browser.execute(() => window.__TEST_HELPERS__.injectAuth(jwt, user));
 * ```
 *
 * @module lib/test-helpers
 */

import type {
	UserProfile,
	Log,
	Friend,
	FriendRequest,
	FriendRequestsResponse,
	Group,
	GroupWithMembers
} from '@pico/types';
import type { ConnectionStatus } from '@pico/shared';

// Only execute in test or development mode - completely eliminated in production
if (import.meta.env.MODE === 'test' || import.meta.env.DEV) {
	console.log('[TestHelpers] Initializing test helpers (debug build only)');

	// Expose test helpers on window for E2E access
	window.__TEST_HELPERS__ = {
		/**
		 * Inject authentication state directly (bypasses OAuth flow)
		 * Use for E2E tests that need authenticated state
		 */
		injectAuth: async (jwt: string, user: UserProfile): Promise<void> => {
			const { saveAuthData } = await import('./oauth');
			const { appState } = await import('@pico/shared');

			await saveAuthData(jwt, user);
			appState.token = jwt;
			appState.setUser(user);

			console.log('[TestHelpers] Auth injected for user:', user.username);
		},

		/**
		 * Clear all authentication state
		 * Use for test cleanup
		 */
		clearAuth: async (): Promise<void> => {
			const { clearAuthData } = await import('./oauth');
			const { appState } = await import('@pico/shared');

			await clearAuthData();
			appState.token = null;
			appState.setUser(null);

			console.log('[TestHelpers] Auth cleared');
		},

		/**
		 * Load current auth state
		 * Use for assertions in E2E tests
		 */
		loadAuth: async (): Promise<{ jwt: string; user: UserProfile } | null> => {
			const { loadAuthData } = await import('./oauth');
			return loadAuthData();
		},

		/**
		 * Get current appState for assertions
		 */
		getAppState: async () => {
			const { appState } = await import('@pico/shared');
			return {
				token: appState.token,
				user: appState.user,
				isAuthenticated: !!appState.token
			};
		},

		/**
		 * Inject logs directly into storage
		 * Use for testing log display without file watching
		 */
		injectLogs: async (logs: Log[]): Promise<void> => {
			const { Store } = await import('@tauri-apps/plugin-store');
			const store = await Store.load('logs.json');
			await store.set('logs', logs);
			console.log('[TestHelpers] Injected', logs.length, 'logs');
		},

		/**
		 * Clear all stored logs
		 */
		clearLogs: async (): Promise<void> => {
			const { Store } = await import('@tauri-apps/plugin-store');
			const store = await Store.load('logs.json');
			await store.delete('logs');
			await store.delete('lastLineCount');
			console.log('[TestHelpers] Logs cleared');
		},

		/**
		 * Get stored logs for assertions
		 */
		getLogs: async (): Promise<Log[]> => {
			const { Store } = await import('@tauri-apps/plugin-store');
			const store = await Store.load('logs.json');
			return (await store.get<Log[]>('logs')) ?? [];
		},

		/**
		 * Trigger log file selection programmatically
		 * Bypasses file picker dialog for E2E tests
		 */
		selectLogFile: async (path: string): Promise<void> => {
			// Emit event that logWatcher listens for
			window.dispatchEvent(new CustomEvent('test-select-log', { detail: path }));
			console.log('[TestHelpers] Log file selected:', path);
		},

		/**
		 * Navigate to a route programmatically
		 */
		navigate: async (route: string): Promise<void> => {
			const { goto } = await import('$app/navigation');
			await goto(route);
			console.log('[TestHelpers] Navigated to:', route);
		},

		/**
		 * Add a toast notification (for testing toast UI)
		 */
		addToast: async (
			message: string,
			type: 'success' | 'error' | 'info' = 'info'
		): Promise<void> => {
			const { appState } = await import('@pico/shared');
			appState.addToast(message, type);
		},

		/**
		 * Clear all stores (full reset for test isolation)
		 */
		clearAllStores: async (): Promise<void> => {
			const { Store } = await import('@tauri-apps/plugin-store');

			const stores = ['auth.json', 'logs.json', 'settings.json'];
			for (const storeName of stores) {
				try {
					const store = await Store.load(storeName);
					await store.clear();
				} catch {
					// Store may not exist, ignore
				}
			}
			console.log('[TestHelpers] All stores cleared');
		},

		/**
		 * Get raw store contents for debugging
		 */
		getStoreContents: async (storeName: string): Promise<Record<string, unknown>> => {
			const { Store } = await import('@tauri-apps/plugin-store');
			const store = await Store.load(storeName);
			const entries: Record<string, unknown> = {};

			// Store.entries() returns an iterator
			for (const [key, value] of await store.entries()) {
				entries[key] = value;
			}

			return entries;
		},

		/**
		 * Wait for a condition to be true (useful for async assertions)
		 */
		waitFor: async (
			conditionFn: () => boolean | Promise<boolean>,
			timeoutMs: number = 5000
		): Promise<void> => {
			const startTime = Date.now();
			while (Date.now() - startTime < timeoutMs) {
				if (await conditionFn()) {
					return;
				}
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
			throw new Error(`waitFor timed out after ${timeoutMs}ms`);
		},

		// ===== WebSocket Helpers =====

		/**
		 * Check if WebSocket is connected
		 */
		isWebSocketConnected: (): boolean => {
			// Access connection status from appState
			const { appState } = require('@pico/shared');
			return appState.connectionStatus === 'connected';
		},

		/**
		 * Simulate WebSocket disconnection
		 * Note: WebSocket management is now handled internally by @pico/shared
		 */
		simulateDisconnect: async (): Promise<void> => {
			const { appState } = await import('@pico/shared');
			appState.connectionStatus = 'disconnected';
			console.log('[TestHelpers] WebSocket disconnect simulated');
		},

		/**
		 * Simulate WebSocket reconnection
		 * Note: WebSocket management is now handled internally by @pico/shared
		 */
		simulateReconnect: async (): Promise<void> => {
			const { appState } = await import('@pico/shared');
			appState.connectionStatus = 'connected';
			console.log('[TestHelpers] WebSocket reconnect simulated');
		},

		// ===== Player/Log Helpers =====

		/**
		 * Get current player name from appState
		 */
		getCurrentPlayer: (): string | null => {
			const { appState } = require('@pico/shared');
			return appState.user?.player ?? null;
		},

		/**
		 * Get selected log file path
		 */
		getSelectedLogFile: async (): Promise<string | null> => {
			const { Store } = await import('@tauri-apps/plugin-store');
			const store = await Store.load('logs.json');
			return (await store.get<string>('logFilePath')) ?? null;
		},

		/**
		 * Set selected log file path (for test setup)
		 */
		setSelectedLogFile: async (path: string): Promise<void> => {
			const { Store } = await import('@tauri-apps/plugin-store');
			const store = await Store.load('logs.json');
			await store.set('logFilePath', path);
			await store.save();
			console.log('[TestHelpers] Log file path set:', path);
		},

		/**
		 * Append a line to a log file (requires Rust backend command)
		 */
		appendToLogFile: async (line: string): Promise<void> => {
			const { invoke } = await import('@tauri-apps/api/core');
			const logPath = await window.__TEST_HELPERS__?.getSelectedLogFile?.();
			if (logPath) {
				await invoke('test_append_log_line', { path: logPath, line });
				console.log('[TestHelpers] Appended line to log file');
			} else {
				throw new Error('No log file selected');
			}
		},

		// ===== Friend/Group State Helpers =====

		/**
		 * Clear all friends from appState
		 */
		clearFriends: async (): Promise<void> => {
			const { appState } = await import('@pico/shared');
			appState.friends = [];
			console.log('[TestHelpers] Friends cleared');
		},

		/**
		 * Clear all groups from appState
		 */
		clearGroups: async (): Promise<void> => {
			const { appState } = await import('@pico/shared');
			appState.groups = [];
			console.log('[TestHelpers] Groups cleared');
		},

		/**
		 * Inject friends array into appState
		 */
		injectFriends: async (friends: Friend[]): Promise<void> => {
			const { appState } = await import('@pico/shared');
			appState.friends = friends;
			console.log('[TestHelpers] Injected', friends.length, 'friends');
		},

		/**
		 * Inject groups array into appState
		 */
		injectGroups: async (groups: Group[]): Promise<void> => {
			const { appState } = await import('@pico/shared');
			appState.groups = groups;
			console.log('[TestHelpers] Injected', groups.length, 'groups');
		},

		/**
		 * Add a pending friend request to appState
		 */
		addPendingFriendRequest: async (request: Partial<FriendRequest>): Promise<void> => {
			const { appState } = await import('@pico/shared');
			const fullRequest: FriendRequest = {
				id: `test-request-${Date.now()}`,
				status: 'pending',
				createdAt: new Date().toISOString(),
				fromUserId: request.fromUserId || 'test-sender',
				fromDiscordId: request.fromDiscordId || 'test-discord-id',
				fromUsername: request.fromUsername || 'TestRequester',
				fromDisplayName: request.fromDisplayName || 'Test Requester',
				fromAvatar: request.fromAvatar || null,
				fromPlayer: request.fromPlayer || null,
				fromTimeZone: request.fromTimeZone || null,
				fromUsePlayerAsDisplayName: request.fromUsePlayerAsDisplayName || false,
				direction: request.direction || 'incoming',
				...request
			} as FriendRequest;

			appState.addFriendRequest(fullRequest);
			console.log('[TestHelpers] Added pending friend request');
		},

		// ===== Filter Helpers =====

		/**
		 * Get active filters from filter state
		 */
		getActiveFilters: async () => {
			const { filterState } = await import('@pico/shared');
			return {
				friendId: filterState?.activeFriendId ?? null,
				groupId: filterState?.activeGroupId ?? null,
				eventTypes: filterState?.eventTypes ? Array.from(filterState.eventTypes) : []
			};
		},

		/**
		 * Set active filters in filter state
		 */
		setActiveFilters: async (filters: {
			friendId?: string | null;
			groupId?: string | null;
			eventTypes?: string[];
		}): Promise<void> => {
			const { filterState } = await import('@pico/shared');
			if (filters.friendId !== undefined && filterState?.setActiveFriendId) {
				filterState.setActiveFriendId(filters.friendId);
			}
			if (filters.groupId !== undefined && filterState?.setActiveGroupId) {
				filterState.setActiveGroupId(filters.groupId);
			}
			// Note: filterState uses Set-based API (toggleEventType, enableAllEventTypes, etc.)
			// Individual eventTypes filtering would require toggling each type
			console.log('[TestHelpers] Filters updated');
		},

		// ===== Error Simulation Helpers =====

		/**
		 * Simulate an API error (shows toast)
		 */
		simulateApiError: async (message: string = 'Simulated API error'): Promise<void> => {
			const { appState } = await import('@pico/shared');
			appState.addToast(message, 'error');
		},

		/**
		 * Simulate an auth error (clears auth and shows toast)
		 */
		simulateAuthError: async (): Promise<void> => {
			const { clearAuthData } = await import('./oauth');
			const { appState } = await import('@pico/shared');

			await clearAuthData();
			appState.token = null;
			appState.setUser(null);
			appState.addToast('Authentication failed', 'error');
			console.log('[TestHelpers] Auth error simulated');
		},

		/**
		 * Simulate file permission error
		 */
		simulateFilePermissionError: async (): Promise<void> => {
			const { appState } = await import('@pico/shared');
			appState.addToast('Permission denied - cannot access file', 'error');
		},

		// ===== Deep Link Simulation =====

		/**
		 * Simulate a deep link callback (for OAuth testing)
		 */
		simulateDeepLink: async (url: string): Promise<void> => {
			if (url.startsWith('picologs://auth/callback')) {
				const urlObj = new URL(url);
				const code = urlObj.searchParams.get('code');
				const state = urlObj.searchParams.get('state');
				if (code && state) {
					// Dispatch custom event that auth handler listens for
					window.dispatchEvent(new CustomEvent('deep-link-auth', { detail: { code, state } }));
					console.log('[TestHelpers] Deep link simulated');
				}
			} else {
				console.log('[TestHelpers] Unhandled deep link:', url);
			}
		},

		// ===== Extended Auth Helpers =====

		/**
		 * Set auth with custom data (more flexible than injectAuth)
		 */
		setAuth: async (data: { token: string | null; user: UserProfile | null }): Promise<void> => {
			const { saveAuthData, clearAuthData } = await import('./oauth');
			const { appState } = await import('@pico/shared');

			if (data.token && data.user) {
				await saveAuthData(data.token, data.user);
				appState.token = data.token;
				appState.setUser(data.user);
			} else {
				await clearAuthData();
				appState.token = null;
				appState.setUser(null);
			}
			console.log('[TestHelpers] Auth state updated');
		},

		/**
		 * Get full appState for comprehensive assertions
		 */
		getFullAppState: async () => {
			const { appState } = await import('@pico/shared');
			return {
				token: appState.token,
				user: appState.user,
				friends: appState.friends,
				groups: appState.groups,
				friendRequests: appState.friendRequests,
				connectionStatus: appState.connectionStatus,
				isAuthenticated: !!appState.token
			};
		}
	};

	console.log('[TestHelpers] Test helpers exposed to window.__TEST_HELPERS__');
}

// TypeScript declaration for window
declare global {
	interface Window {
		__TEST_HELPERS__?: {
			// Original helpers
			injectAuth: (jwt: string, user: UserProfile) => Promise<void>;
			clearAuth: () => Promise<void>;
			loadAuth: () => Promise<{ jwt: string; user: UserProfile } | null>;
			getAppState: () => Promise<{
				token: string | null;
				user: UserProfile | null;
				isAuthenticated: boolean;
			}>;
			injectLogs: (logs: Log[]) => Promise<void>;
			clearLogs: () => Promise<void>;
			getLogs: () => Promise<Log[]>;
			selectLogFile: (path: string) => Promise<void>;
			navigate: (route: string) => Promise<void>;
			addToast: (message: string, type?: 'success' | 'error' | 'info') => Promise<void>;
			clearAllStores: () => Promise<void>;
			getStoreContents: (storeName: string) => Promise<Record<string, unknown>>;
			waitFor: (conditionFn: () => boolean | Promise<boolean>, timeoutMs?: number) => Promise<void>;

			// WebSocket helpers
			isWebSocketConnected: () => boolean;
			simulateDisconnect: () => Promise<void>;
			simulateReconnect: () => Promise<void>;

			// Player/Log helpers
			getCurrentPlayer: () => string | null;
			getSelectedLogFile: () => Promise<string | null>;
			setSelectedLogFile: (path: string) => Promise<void>;
			appendToLogFile: (line: string) => Promise<void>;

			// Friend/Group state helpers
			clearFriends: () => Promise<void>;
			clearGroups: () => Promise<void>;
			injectFriends: (friends: Friend[]) => Promise<void>;
			injectGroups: (groups: GroupWithMembers[]) => Promise<void>;
			addPendingFriendRequest: (request: Partial<FriendRequest>) => Promise<void>;

			// Filter helpers
			getActiveFilters: () => Promise<{
				friendId: string | null;
				groupId: string | null;
				eventTypes: string[];
			}>;
			setActiveFilters: (filters: {
				friendId?: string | null;
				groupId?: string | null;
				eventTypes?: string[];
			}) => Promise<void>;

			// Error simulation helpers
			simulateApiError: (message?: string) => Promise<void>;
			simulateAuthError: () => Promise<void>;
			simulateFilePermissionError: () => Promise<void>;

			// Deep link simulation
			simulateDeepLink: (url: string) => Promise<void>;

			// Extended auth helpers
			setAuth: (data: { token: string | null; user: UserProfile | null }) => Promise<void>;
			getFullAppState: () => Promise<{
				token: string | null;
				user: UserProfile | null;
				friends: Friend[];
				groups: GroupWithMembers[];
				friendRequests: FriendRequestsResponse;
				connectionStatus: ConnectionStatus;
				isAuthenticated: boolean;
			}>;
		};
	}
}

export {};
