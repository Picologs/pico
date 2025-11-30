import { redirect, isRedirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { createWebSocketJWT } from '@pico/shared/server';

const WEBSOCKET_SERVER = process.env.WEBSOCKET_SERVER_URL || 'http://localhost:8080';
const JWT_SECRET = process.env.JWT_SECRET;
const BROADCAST_API_KEY = process.env.BROADCAST_API_KEY;

export const load: PageServerLoad = async ({ url, locals }) => {
	const sessionId = url.searchParams.get('session');

	if (!sessionId) {
		return { needsAuth: true, error: 'No session ID provided' };
	}

	// If user is already logged in, push JWT directly to desktop
	if (locals.user) {
		if (!JWT_SECRET) {
			console.error('[Auth Desktop] JWT_SECRET not configured');
			return { needsAuth: true, sessionId, error: 'Server configuration error' };
		}

		if (!BROADCAST_API_KEY) {
			console.error('[Auth Desktop] BROADCAST_API_KEY not configured');
			return { needsAuth: true, sessionId, error: 'Server configuration error' };
		}

		try {
			const jwt = await createWebSocketJWT(locals.user.discordId, JWT_SECRET);

			// Push to desktop via WebSocket server
			const response = await fetch(`${WEBSOCKET_SERVER}/auth/desktop-complete`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${BROADCAST_API_KEY}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					sessionId,
					jwt,
					user: {
						id: locals.user.id,
						discordId: locals.user.discordId,
						username: locals.user.username,
						avatar: locals.user.avatar,
						friendCode: locals.user.friendCode
					}
				})
			});

			if (response.ok) {
				console.log('[Auth Desktop] Successfully pushed auth to desktop for session:', sessionId);
				redirect(302, '/auth/desktop/callback?success=true');
			}

			const errorData = await response.json().catch(() => ({}));
			console.error('[Auth Desktop] Failed to push auth to desktop:', {
				status: response.status,
				error: errorData
			});

			return { needsAuth: true, sessionId, error: 'Failed to connect to desktop app' };
		} catch (error) {
			// Re-throw redirects - they are expected behavior, not errors
			if (isRedirect(error)) {
				throw error;
			}

			console.error('[Auth Desktop] Error pushing auth to desktop:', error);
			return { needsAuth: true, sessionId, error: 'Server error' };
		}
	}

	// Not logged in - client will redirect to Discord OAuth
	return { needsAuth: true, sessionId };
};
