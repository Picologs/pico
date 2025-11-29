/**
 * Test-only auth endpoint for Playwright E2E tests
 *
 * Uses Discord's refresh token flow to authenticate programmatically
 * without browser OAuth interaction.
 *
 * Only enabled when PLAYWRIGHT_TEST=true
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, schema } from '$lib/db';
import { eq } from 'drizzle-orm';

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const TEST_REFRESH_TOKEN = process.env.TEST_REFRESH_TOKEN;
const PLAYWRIGHT_TEST = process.env.PLAYWRIGHT_TEST === 'true';

export const POST: RequestHandler = async ({ cookies }) => {
	// Only allow in test mode
	if (!PLAYWRIGHT_TEST) {
		throw error(404, 'Not found');
	}

	if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET || !TEST_REFRESH_TOKEN) {
		throw error(500, 'Missing Discord credentials or test refresh token');
	}

	try {
		// Step 1: Exchange refresh token for new access token
		const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			body: new URLSearchParams({
				client_id: DISCORD_CLIENT_ID,
				client_secret: DISCORD_CLIENT_SECRET,
				grant_type: 'refresh_token',
				refresh_token: TEST_REFRESH_TOKEN
			})
		});

		if (!tokenResponse.ok) {
			const errorData = await tokenResponse.text();
			console.error('Discord token refresh failed:', errorData);
			throw error(500, 'Failed to refresh Discord token');
		}

		const tokens = await tokenResponse.json();
		const { access_token } = tokens;

		// Step 2: Fetch user info from Discord
		const userResponse = await fetch('https://discord.com/api/users/@me', {
			headers: {
				Authorization: `Bearer ${access_token}`
			}
		});

		if (!userResponse.ok) {
			throw error(500, 'Failed to fetch Discord user info');
		}

		const discordUser = await userResponse.json();

		// Step 3: Create or update user in database
		const [user] = await db
			.insert(schema.users)
			.values({
				discordId: discordUser.id,
				username: discordUser.username,
				avatar: discordUser.avatar
			})
			.onConflictDoUpdate({
				target: schema.users.discordId,
				set: {
					username: discordUser.username,
					avatar: discordUser.avatar,
					updatedAt: new Date()
				}
			})
			.returning();

		// Step 4: Set auth cookies (matching OAuth callback behavior)
		const discordInfo = {
			id: user.id,
			discordId: user.discordId,
			username: user.username,
			avatar: user.avatar,
			player: user.player,
			friendCode: user.friendCode
		};

		cookies.set('discord_token', JSON.stringify(tokens), {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: false, // false for localhost testing
			maxAge: tokens.expires_in
		});

		cookies.set('discord_info', JSON.stringify(discordInfo), {
			path: '/',
			httpOnly: false,
			sameSite: 'lax',
			secure: false,
			maxAge: tokens.expires_in
		});

		return json({
			success: true,
			user: discordInfo
		});
	} catch (err) {
		console.error('Test auth error:', err);
		throw error(500, err instanceof Error ? err.message : 'Authentication failed');
	}
};
