import { error, redirect, isRedirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	handleDiscordCallback,
	generateExpiredCodeHTML,
	generateSignupsDisabledHTML,
	generateUserBlockedHTML,
	createDrizzleAdapter,
	type CookiesAdapter
} from '@pico/shared/server';

// CSRF state cookie name for OAuth (must match +page.server.ts)
const OAUTH_STATE_COOKIE = 'oauth_state';

// Environment variables
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI =
	process.env.DISCORD_REDIRECT_URI || 'https://picologs.com/auth/callback';
const WEBSOCKET_SERVER = process.env.WEBSOCKET_SERVER_URL || 'http://localhost:8080';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret';
const BROADCAST_API_KEY = process.env.BROADCAST_API_KEY;

// Validate required environment variables on startup
// These errors will appear in server logs if misconfigured
if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
	console.error('[Auth Callback] Missing required Discord OAuth credentials');
	if (!DISCORD_CLIENT_ID) console.error('  - DISCORD_CLIENT_ID is not set');
	if (!DISCORD_CLIENT_SECRET) console.error('  - DISCORD_CLIENT_SECRET is not set');
}

// Create database adapter using shared-svelte's drizzle-orm instance
const dbAdapter = createDrizzleAdapter();

export const GET: RequestHandler = async ({ url, cookies }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const error_param = url.searchParams.get('error');

	// Validate environment variables
	if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET || !JWT_SECRET) {
		throw error(500, 'Server configuration error - missing required environment variables');
	}

	// CSRF state validation for web OAuth flow
	// Desktop auth uses state starting with 'desktop:' which is validated by the server
	if (state?.startsWith('web:')) {
		const storedStateCookie = cookies.get(OAUTH_STATE_COOKIE);

		if (!storedStateCookie) {
			console.error('[Auth Callback] Missing OAuth state cookie');
			throw error(400, 'Missing OAuth state - please try logging in again');
		}

		try {
			const { state: storedState, expiry } = JSON.parse(storedStateCookie);

			if (state !== storedState) {
				console.error('[Auth Callback] State mismatch - possible CSRF attack');
				throw error(400, 'State mismatch - please try logging in again');
			}

			if (Date.now() > expiry) {
				console.error('[Auth Callback] OAuth state expired');
				throw error(400, 'Login session expired - please try again');
			}
		} catch (parseError) {
			if (parseError instanceof Error && 'status' in parseError) {
				throw parseError; // Re-throw HTTP errors
			}
			console.error('[Auth Callback] Invalid state cookie format');
			throw error(400, 'Invalid state - please try logging in again');
		}

		// Clear state cookie after successful validation
		cookies.delete(OAUTH_STATE_COOKIE, { path: '/' });
	}

	// Cookies adapter for SvelteKit
	const cookiesAdapter: CookiesAdapter = {
		set(name: string, value: string, options) {
			cookies.set(name, value, options);
		}
	};

	try {
		// Handle Discord OAuth callback using shared utilities
		const result = await handleDiscordCallback(
			{ code, state, error: error_param },
			{
				clientId: DISCORD_CLIENT_ID,
				clientSecret: DISCORD_CLIENT_SECRET,
				redirectUri: DISCORD_REDIRECT_URI,
				jwtSecret: JWT_SECRET,
				websocketServerUrl: WEBSOCKET_SERVER,
				nodeEnv: process.env.NODE_ENV,
				cookieDomain: process.env.NODE_ENV === 'production' ? 'picologs.com' : undefined
			},
			dbAdapter,
			cookiesAdapter
		);

		// Handle errors
		if (result.type === 'error') {
			if (result.code === 'EXPIRED_CODE') {
				return new Response(generateExpiredCodeHTML(), {
					status: result.status,
					headers: { 'Content-Type': 'text/html' }
				});
			}
			if (result.code === 'SIGNUPS_DISABLED') {
				return new Response(generateSignupsDisabledHTML(), {
					status: result.status,
					headers: { 'Content-Type': 'text/html' }
				});
			}
			if (result.code === 'USER_BLOCKED') {
				return new Response(generateUserBlockedHTML(), {
					status: result.status,
					headers: { 'Content-Type': 'text/html' }
				});
			}
			throw error(result.status, result.message);
		}

		// Handle desktop authentication
		if (result.type === 'desktop') {
			// Extract sessionId from state (format: 'desktop:{sessionId}')
			const sessionId = state?.replace('desktop:', '');

			if (!sessionId) {
				console.error('[Auth Callback] Missing sessionId in desktop state');
				throw error(400, 'Invalid desktop authentication state');
			}

			if (!BROADCAST_API_KEY) {
				console.error('[Auth Callback] BROADCAST_API_KEY not configured');
				throw error(500, 'Server configuration error');
			}

			// Push authentication result to desktop via WebSocket server
			try {
				const pushResponse = await fetch(`${WEBSOCKET_SERVER}/auth/desktop-complete`, {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${BROADCAST_API_KEY}`,
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						sessionId,
						jwt: result.jwtToken,
						user: {
							id: result.user.id,
							discordId: result.user.discordId,
							username: result.user.username,
							avatar: result.user.avatar,
							friendCode: result.user.friendCode
						}
					})
				});

				if (!pushResponse.ok) {
					const errorData = await pushResponse.json().catch(() => ({}));
					console.error('[Auth Callback] Failed to push auth to desktop:', {
						status: pushResponse.status,
						error: errorData
					});
					// Redirect to error page instead of failing completely
					redirect(302, '/auth/desktop/callback?error=push_failed');
				}

				console.log('[Auth Callback] Successfully pushed auth to desktop for session:', sessionId);
			} catch (fetchError) {
				console.error('[Auth Callback] Error pushing auth to desktop:', fetchError);
				redirect(302, '/auth/desktop/callback?error=server_error');
			}

			// Redirect to success page
			redirect(302, '/auth/desktop/callback?success=true');
		}

		// Handle web authentication - redirect to dashboard
		redirect(302, '/dashboard');
	} catch (err) {
		// Re-throw redirects - they are expected behavior, not errors
		if (isRedirect(err)) {
			throw err;
		}

		console.error('[Auth Callback] Unexpected error:', err);
		throw error(500, 'Authentication failed due to an unexpected error');
	}
};
