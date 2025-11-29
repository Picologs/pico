import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const CDN_BASE = 'https://cdn.picologs.com/releases';

/**
 * Proxy releases from Tigris CDN
 * Routes like /releases/latest.json → cdn.picologs.com/releases/latest.json
 */
export const GET: RequestHandler = async ({ params }) => {
	const path = params.path;

	if (!path) {
		throw redirect(302, `${CDN_BASE}/latest.json`);
	}

	throw redirect(302, `${CDN_BASE}/${path}`);
};
