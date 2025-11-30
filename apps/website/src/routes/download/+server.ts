import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const CDN_BASE = 'https://cdn.picologs.com/releases';

/**
 * Server-side redirect to the latest .msi download
 * Fetches latest.json from CDN to get the current version and MSI URL
 */
export const GET: RequestHandler = async () => {
	let downloadUrl: string | null = null;

	try {
		const response = await fetch(`${CDN_BASE}/latest.json`);

		if (!response.ok) {
			console.error('CDN fetch failed:', {
				status: response.status,
				statusText: response.statusText
			});
			throw new Error(`CDN fetch failed: ${response.status} ${response.statusText}`);
		}

		const data = await response.json();

		// Get the Windows download URL from latest.json
		downloadUrl = data.platforms?.['windows-x86_64']?.url;

		if (!downloadUrl) {
			console.error('No Windows download URL in latest.json:', data);
		}
	} catch (error) {
		console.error('Error fetching latest release:', error);
	}

	if (downloadUrl) {
		throw redirect(302, downloadUrl);
	} else {
		// Fallback to releases page
		throw redirect(302, '/releases/latest.json');
	}
};
