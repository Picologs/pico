import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ parent }) => {
	const { user } = await parent();

	// Only allow admin users
	if (user.role !== 'admin') {
		redirect(303, '/dashboard');
	}

	return { user };
};
