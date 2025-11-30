import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Handle GET requests (direct navigation to /auth/signout)
export const GET: RequestHandler = async ({ cookies }) => {
	cookies.delete('discord_token', { path: '/' });
	cookies.delete('discord_info', { path: '/' });
	cookies.delete('jwt_token', { path: '/' });
	return redirect(303, '/');
};

// Handle POST requests (programmatic sign-out)
export const POST: RequestHandler = async ({ cookies }) => {
	cookies.delete('discord_token', { path: '/' });
	cookies.delete('discord_info', { path: '/' });
	cookies.delete('jwt_token', { path: '/' });
	return new Response(null, { status: 200 });
};
