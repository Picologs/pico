import type { PageServerLoad, Actions } from './$types';
import { db, schema } from '$lib/db';
import { eq } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	// System info
	const systemInfo = {
		nodeVersion: process.version,
		platform: process.platform,
		environment: process.env.NODE_ENV || 'development',
		wsUrl: process.env.WS_URL || 'wss://ws.picologs.com/ws',
		publicUrl: process.env.PUBLIC_URL || 'https://picologs.com'
	};

	// Get signups_enabled setting
	const [signupsSetting] = await db
		.select()
		.from(schema.adminSettings)
		.where(eq(schema.adminSettings.key, 'signups_enabled'))
		.limit(1);

	return {
		systemInfo,
		signupsEnabled: signupsSetting?.value === true || signupsSetting?.value === 'true' || signupsSetting === undefined
	};
};

export const actions: Actions = {
	toggleSignups: async ({ request, locals }) => {
		// Verify admin
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const enabled = formData.get('enabled') === 'true';

		// Get current user's database ID
		const [currentUser] = await db
			.select({ id: schema.users.id })
			.from(schema.users)
			.where(eq(schema.users.discordId, locals.user.discordId))
			.limit(1);

		if (!currentUser) {
			return fail(400, { error: 'User not found' });
		}

		// Upsert the setting
		await db
			.insert(schema.adminSettings)
			.values({
				key: 'signups_enabled',
				value: enabled,
				updatedAt: new Date(),
				updatedBy: currentUser.id
			})
			.onConflictDoUpdate({
				target: schema.adminSettings.key,
				set: {
					value: enabled,
					updatedAt: new Date(),
					updatedBy: currentUser.id
				}
			});

		// Create audit log entry
		await db.insert(schema.adminAuditLog).values({
			action: 'signups_toggled',
			adminUserId: currentUser.id,
			metadata: { enabled }
		});

		return { success: true, signupsEnabled: enabled };
	}
};
