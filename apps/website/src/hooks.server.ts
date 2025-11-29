import { type Handle } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { createAuthMiddleware, createWWWRedirectMiddleware } from '@pico/shared/server';
import { db, schema } from '$lib/db';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
	throw new Error('JWT_SECRET environment variable is required');
}

// Create reusable middleware instances
const handleWWWRedirect = createWWWRedirectMiddleware({
	domain: 'picologs.com'
});

const handleAuth = createAuthMiddleware({
	db,
	jwtSecret: JWT_SECRET,
	schema,
	env: {
		nodeEnv: process.env.NODE_ENV,
		jwtIssuer: 'picologs-website',
		jwtAudience: 'picologs-websocket'
	},
	debug: process.env.NODE_ENV !== 'production'
});

export const handle: Handle = async ({ event, resolve }) => {
	// Chain handlers: WWW redirect -> Auth -> Security Headers
	return handleWWWRedirect({
		event,
		resolve: async (e) => {
			const response = await handleAuth({ event: e, resolve });
			// Add security headers to all responses
			response.headers.set('X-Content-Type-Options', 'nosniff');
			response.headers.set('X-Frame-Options', 'DENY');
			response.headers.set('X-XSS-Protection', '1; mode=block');
			response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
			const connectSrc = dev
				? "'self' http://localhost:8080 ws://localhost:8080 wss://ws.picologs.com https://ws.picologs.com https://discord.com"
				: "'self' wss://ws.picologs.com https://ws.picologs.com https://discord.com";
			response.headers.set(
				'Content-Security-Policy',
				"default-src 'self'; " +
					"script-src 'self' 'unsafe-inline'; " +
					"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
					"font-src 'self' https://fonts.gstatic.com; " +
					"img-src 'self' https://cdn.picologs.com https://cdn.discordapp.com data: blob:; " +
					`connect-src ${connectSrc};`
			);
			return response;
		}
	});
};
