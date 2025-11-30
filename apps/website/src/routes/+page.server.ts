import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

// CSRF state cookie name for OAuth
const OAUTH_STATE_COOKIE = 'oauth_state';
const STATE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

export const load: PageServerLoad = async ({ request, cookies }) => {
	const url = new URL(request.url);
	const discordInfo = cookies.get('discord_info');
	const discordInfoParsed = discordInfo ? JSON.parse(discordInfo) : null;

	const player = url.searchParams.get('player');
	const version = url.searchParams.get('version');

	if (version) {
		cookies.set('version', version, { path: '/' });
	}

	const groupId = cookies.get('group_id');

	if (player) {
		cookies.set('player', player, { path: '/' });
	}

	if (discordInfoParsed && discordInfoParsed.player && groupId) {
		return redirect(302, '/dashboard');
	}

	if (discordInfoParsed && !discordInfoParsed.player && player) {
		return redirect(302, '/claim-player');
	}

	if (discordInfo && !groupId) {
		return redirect(302, '/dashboard');
	}

	if (discordInfo) {
		const discordInfo = JSON.parse(cookies.get('discord_info') as string);
		if (discordInfo.player) {
			return redirect(302, '/dashboard');
		}
	}
};

export const actions = {
	default: async ({ cookies }) => {
		// Generate CSRF state with web prefix
		const state = `web:${crypto.randomUUID()}`;

		// Store state in httpOnly cookie for validation on callback
		cookies.set(
			OAUTH_STATE_COOKIE,
			JSON.stringify({ state, expiry: Date.now() + STATE_EXPIRY_MS }),
			{
				httpOnly: true,
				secure: true,
				sameSite: 'lax',
				maxAge: 600, // 10 minutes
				path: '/'
			}
		);

		redirect(
			302,
			`https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&response_type=code&redirect_uri=${process.env.DISCORD_REDIRECT_URI}&scope=identify&state=${encodeURIComponent(state)}`
		);
	}
} satisfies Actions;
