import { redirect } from '@sveltejs/kit';
import { loadAuthData } from '$lib/oauth';
import type { LayoutLoad } from './$types';

export const ssr = false;
export const prerender = true;

export const load: LayoutLoad = async () => {
	console.log('[AuthLayout Load] Checking authentication...');

	const authData = await loadAuthData();

	if (!authData || !authData.jwt || !authData.user) {
		console.log('[AuthLayout Load] Not authenticated, redirecting to /');
		throw redirect(303, '/');
	}

	console.log('[AuthLayout Load] Authenticated:', {
		userId: authData.user.discordId,
		username: authData.user.username
	});

	return {
		user: authData.user,
		token: authData.jwt
	};
};
