import { redirect } from '@sveltejs/kit';
import { loadAuthData } from '$lib/oauth';
import type { PageLoad } from './$types';

/**
 * Load function runs BEFORE the page component renders
 * This prevents the flash of unauthenticated content (FOUC)
 * by checking auth and redirecting to /dashboard before any UI is shown
 */
export const load: PageLoad = async () => {
	console.log('[+page.ts] Load function running - checking auth before render');

	// Check if user is authenticated (loads JWT from Tauri store)
	const authData = await loadAuthData();

	if (authData && authData.user && authData.jwt) {
		console.log('[+page.ts] User authenticated, redirecting to /dashboard');
		// Redirect to dashboard BEFORE the page renders (prevents flash)
		redirect(303, '/dashboard');
	}

	console.log('[+page.ts] User not authenticated, rendering offline page');

	// Return data to component indicating auth check is complete
	return {
		authChecked: true
	};
};
