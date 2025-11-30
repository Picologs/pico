/**
 * OAuth Module
 *
 * Handles Discord OAuth authentication flow for the desktop app using:
 * - WebSocket-based authentication push from server
 * - Tauri secure storage for JWT and user data
 *
 * Flow:
 * 1. User clicks sign in → Desktop establishes temporary WebSocket to /auth-ws
 * 2. App stores pending session ID and opens browser to website
 * 3. User authorizes with Discord on website
 * 4. Website exchanges code, generates JWT, calls server endpoint
 * 5. Server pushes JWT to desktop via existing WebSocket connection
 * 6. Desktop receives `desktop_auth_complete` message with JWT + user
 * 7. Desktop stores JWT in Tauri store and redirects to dashboard
 *
 * @module lib/oauth
 */

import { Store } from '@tauri-apps/plugin-store';
import { openUrl } from '@tauri-apps/plugin-opener';
import { goto } from '$app/navigation';
import { tick } from 'svelte';
import type { UserProfile } from '@pico/types';
import { appState } from '@pico/shared';
import { createWebSocketHandler } from '$lib/websocket-handler';

// ============================================================================
// Types
// ============================================================================

/**
 * Auth data stored in Tauri store
 */
interface StoredAuthData {
	jwt: string;
	user: UserProfile;
}

/**
 * Legacy stored auth format (for backward compatibility)
 * @deprecated Use StoredAuthData instead
 */
export interface StoredAuth {
	userId: string;
	token: string;
	user: UserProfile;
}

// ============================================================================
// Constants
// ============================================================================

const AUTH_STORE_FILE = 'auth.json';

// OAuth session timeout (10 minutes)
const OAUTH_SESSION_TIMEOUT_MS = 10 * 60 * 1000;

// ============================================================================
// Store Management
// ============================================================================

let authStore: Store | null = null;

/**
 * Get or initialize the auth store
 */
async function getAuthStore(): Promise<Store> {
	if (!authStore) {
		authStore = await Store.load(AUTH_STORE_FILE);
	}
	return authStore;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Initialize OAuth handler
 *
 * This is now a no-op since we no longer use deep links.
 * Kept for backward compatibility with existing code that calls it.
 *
 * @deprecated No longer needed - WebSocket push doesn't require initialization
 */
export async function initializeDeepLinkHandler(): Promise<void> {
	// No-op - WebSocket push doesn't need initialization
	console.log('[OAuth] Using WebSocket push authentication (no deep link handler needed)');
}

/**
 * Start Discord OAuth flow with WebSocket push
 *
 * Opens the browser to the Discord OAuth page via the website bridge.
 * Establishes a WebSocket connection and waits for the server to push
 * the authentication result after the user completes OAuth in the browser.
 *
 * @param showPasteDialog - Legacy parameter, no longer used
 */
export async function initiateOAuthFlow(showPasteDialog?: () => void): Promise<void> {
	try {
		// Generate session ID
		const sessionId = crypto.randomUUID();

		// Store session ID AND timestamp for validation
		const store = await getAuthStore();
		await store.set('pending_oauth_session', {
			sessionId,
			createdAt: Date.now()
		});

		// Determine website URL based on environment
		const websiteUrl =
			import.meta.env.VITE_WEBSITE_URL_DEV ||
			import.meta.env.VITE_WEBSITE_URL_PROD ||
			'https://picologs.com';

		// Determine WebSocket URL based on environment - use /auth-ws for OAuth
		let wsUrl =
			import.meta.env.VITE_WS_URL_DEV ||
			import.meta.env.VITE_WS_URL_PROD ||
			'wss://ws.picologs.com/ws';

		// Replace /ws with /auth-ws for OAuth endpoint
		wsUrl = wsUrl.replace(/\/ws$/, '/auth-ws');

		console.log('[OAuth] Starting OAuth flow with session:', sessionId);

		// Create WebSocket connection and wait for auth result
		const authPromise = waitForAuthPush(wsUrl, sessionId);

		// Open browser to auth page
		const authUrl = `${websiteUrl}/auth/desktop?session=${sessionId}`;
		console.log('[OAuth] Opening browser to:', authUrl);
		await openUrl(authUrl);

		// Wait for authentication to complete via WebSocket push
		const result = await authPromise;

		// Save auth data to Tauri store
		await saveAuthData(result.jwt, result.user);

		// Update appState for reactive UI updates
		appState.token = result.jwt;
		appState.setUser(result.user);

		// Wait for reactive updates to propagate
		await tick();

		// Clean up pending OAuth session
		await store.delete('pending_oauth_session');

		// Show success toast
		appState.addToast('Signed in successfully!', 'success');

		// Redirect to dashboard (authenticated layout)
		await goto('/dashboard');
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : 'Authentication failed';
		appState.addToast(errorMsg, 'error');
		console.error('[OAuth] OAuth flow failed:', error);
		throw error;
	}
}

/**
 * Wait for authentication result via WebSocket push
 *
 * Connects to the auth WebSocket endpoint, registers with the sessionId,
 * and waits for the server to push the authentication result.
 *
 * @param wsUrl - WebSocket URL (/auth-ws endpoint)
 * @param sessionId - Session ID for CSRF protection
 * @returns JWT and user profile from server
 */
function waitForAuthPush(
	wsUrl: string,
	sessionId: string
): Promise<{ jwt: string; user: UserProfile }> {
	return new Promise((resolve, reject) => {
		let resolved = false;

		// Timeout after 10 minutes (matches session timeout)
		const timeout = setTimeout(() => {
			if (!resolved) {
				resolved = true;
				authHandler.disconnect();
				reject(new Error('Authentication timed out. Please try again.'));
			}
		}, OAUTH_SESSION_TIMEOUT_MS);

		// Create WebSocket handler for OAuth flow
		const authHandler = createWebSocketHandler({
			url: wsUrl,
			autoReconnect: false, // Auth is temporary, no reconnection
			onConnect: () => {
				console.log('[OAuth] Connected to auth WebSocket, registering session');
				// Register this connection with the sessionId
				authHandler.send({
					type: 'register',
					sessionId
				});
			},
			onMessage: (message) => {
				console.log('[OAuth] Received message:', message.type);

				// Handle registration confirmation
				if (message.type === 'registered') {
					console.log('[OAuth] Session registered, waiting for auth push...');
					return;
				}

				// Handle desktop_auth_complete from server (pushed after website completes OAuth)
				if (message.type === 'desktop_auth_complete' && message.data?.jwt && message.data?.user) {
					if (!resolved) {
						resolved = true;
						clearTimeout(timeout);
						authHandler.disconnect();

						const jwt = message.data.jwt;
						const serverUser = message.data.user;

						console.log('[OAuth] Received auth push, user:', serverUser.username);

						// Map server user to UserProfile format
						const user: UserProfile = {
							id: serverUser.id,
							discordId: serverUser.discordId,
							username: serverUser.username,
							avatar: serverUser.avatar,
							player: serverUser.player || null,
							timeZone: serverUser.timeZone || null,
							usePlayerAsDisplayName: serverUser.usePlayerAsDisplayName || false,
							betaTester: serverUser.betaTester || false,
							friendCode: serverUser.friendCode || null,
							role: serverUser.role || 'user',
							createdAt: serverUser.createdAt || new Date().toISOString(),
							updatedAt: serverUser.updatedAt || new Date().toISOString()
						};

						resolve({ jwt, user });
					}
					return;
				}

				// Handle error responses
				if (message.type === 'error') {
					console.error('[OAuth] Error from server:', message);
					const errorMsg =
						message.data?.message || message.message || message.error || 'Authentication failed';

					if (!resolved) {
						resolved = true;
						clearTimeout(timeout);
						authHandler.disconnect();
						reject(new Error(errorMsg));
					}
				}
			},
			onError: (error) => {
				console.error('[OAuth] WebSocket error:', error);
				if (!resolved) {
					resolved = true;
					clearTimeout(timeout);
					reject(new Error('Connection failed. Please try again.'));
				}
			},
			onDisconnect: () => {
				if (!resolved) {
					resolved = true;
					clearTimeout(timeout);
					reject(new Error('Connection closed unexpectedly. Please try again.'));
				}
			}
		});

		// Start the connection
		try {
			authHandler.connect();
		} catch (error) {
			clearTimeout(timeout);
			reject(error);
		}
	});
}

// ============================================================================
// Storage Functions
// ============================================================================

/**
 * Load stored auth data from Tauri store
 *
 * @returns Auth data (JWT + user) or null if not found
 */
export async function loadAuthData(): Promise<StoredAuthData | null> {
	try {
		const store = await getAuthStore();
		const jwt = await store.get<string>('jwt');
		const user = await store.get<UserProfile>('user');

		if (!jwt || !user) {
			return null;
		}

		return { jwt, user };
	} catch (error) {
		console.error('[OAuth] Failed to load auth data:', error);
		return null;
	}
}

/**
 * Save auth data to Tauri store
 *
 * @param jwt - JWT token from server
 * @param user - User profile from server
 */
export async function saveAuthData(jwt: string, user: UserProfile): Promise<void> {
	try {
		const store = await getAuthStore();
		await store.set('jwt', jwt);
		await store.set('user', user);
		// In Tauri v2, store.set() auto-saves, no need to call save()
	} catch (error) {
		console.error('[OAuth] Failed to save auth data:', error);
		throw error;
	}
}

/**
 * Clear stored auth data (sign out)
 *
 * Removes JWT and user data from Tauri store.
 */
export async function clearAuthData(): Promise<void> {
	try {
		const store = await getAuthStore();
		await store.delete('jwt');
		await store.delete('user');
		// In Tauri v2, store.delete() auto-saves, no need to call save()
	} catch (error) {
		console.error('[OAuth] Failed to clear auth data:', error);
		throw error;
	}
}

// ============================================================================
// Legacy API (for backward compatibility)
// ============================================================================

/**
 * Get stored authentication from Tauri store
 * @deprecated Use loadAuthData instead
 */
export async function getStoredAuth(): Promise<StoredAuth | null> {
	const authData = await loadAuthData();

	if (!authData) {
		return null;
	}

	return {
		userId: authData.user.discordId,
		token: authData.jwt,
		user: authData.user
	};
}

/**
 * Sign out and clear stored auth
 * @deprecated Use clearAuthData instead
 */
export async function signOut(): Promise<void> {
	await clearAuthData();
}

/**
 * Handle deep link callback URL
 * @deprecated No longer used - WebSocket push replaces deep links
 */
export async function handleDeepLinkCallback(url: string): Promise<void> {
	console.warn('[OAuth] Deep link callback is deprecated. Auth is now handled via WebSocket push.');
}

/**
 * Handle auth complete
 * @deprecated No longer used - auth is handled in initiateOAuthFlow
 */
export async function handleAuthComplete(code: string, state: string): Promise<void> {
	console.warn('[OAuth] handleAuthComplete is deprecated. Auth is now handled via WebSocket push.');
}

// ============================================================================
// Testing API (exposed to window object in browser for E2E tests)
// ============================================================================

/**
 * Expose OAuth functions to window object for testing
 * Called from +layout.svelte during initialization
 */
export function exposeOAuthForTesting(): void {
	if (typeof window !== 'undefined') {
		(window as any).__OAUTH__ = {
			initiateOAuthFlow,
			loadAuthData,
			saveAuthData,
			clearAuthData
		};
		console.log('[OAuth] Testing API exposed to window.__OAUTH__');
	}
}
