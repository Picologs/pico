import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { createWebSocketJWT } from '@pico/shared/server';
import { db, schema } from '$lib/db';
import { eq } from 'drizzle-orm';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

export const load: LayoutServerLoad = async ({ locals, cookies, url }) => {
	// Use the user from locals (set by hooks.server.ts with fresh DB data)
	if (!locals.user) {
		cookies.delete('discord_token', { path: '/' });
		cookies.delete('discord_info', { path: '/' });
		return redirect(303, '/');
	}

	// Generate WebSocket JWT token for authenticated user
	const wsToken = await createWebSocketJWT(locals.user.discordId, JWT_SECRET);

	// Get user's database ID for queries
	const [dbUser] = await db
		.select()
		.from(schema.users)
		.where(eq(schema.users.discordId, locals.user.discordId))
		.limit(1);

	if (!dbUser) {
		return redirect(303, '/');
	}

	return {
		user: locals.user,
		wsToken,
		groups: [] // Will be loaded via WebSocket in App.svelte
	};
};
