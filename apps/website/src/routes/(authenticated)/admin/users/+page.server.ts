import type { PageServerLoad, Actions } from './$types';
import { db, schema } from '$lib/db';
import { desc, count, sql, eq } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ url }) => {
	const page = Number(url.searchParams.get('page')) || 1;
	const limit = 20;
	const offset = (page - 1) * limit;

	// Get users with pagination (including blocking fields)
	const users = await db
		.select({
			id: schema.users.id,
			discordId: schema.users.discordId,
			username: schema.users.username,
			avatar: schema.users.avatar,
			player: schema.users.player,
			role: schema.users.role,
			betaTester: schema.users.betaTester,
			friendCode: schema.users.friendCode,
			createdAt: schema.users.createdAt,
			blockedAt: schema.users.blockedAt,
			blockedBy: schema.users.blockedBy,
			blockReason: schema.users.blockReason
		})
		.from(schema.users)
		.orderBy(desc(schema.users.createdAt))
		.limit(limit)
		.offset(offset);

	// Get total count
	const [{ total }] = await db.select({ total: count() }).from(schema.users);

	// Get stats
	const [stats] = await db
		.select({
			totalUsers: count(),
			adminCount: sql<number>`count(*) filter (where role = 'admin')`,
			betaTesterCount: sql<number>`count(*) filter (where beta_tester = true)`,
			recentSignups: sql<number>`count(*) filter (where created_at > now() - interval '7 days')`,
			blockedCount: sql<number>`count(*) filter (where blocked_at is not null)`
		})
		.from(schema.users);

	return {
		users,
		pagination: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit)
		},
		stats: {
			totalUsers: stats?.totalUsers ?? 0,
			adminCount: stats?.adminCount ?? 0,
			betaTesterCount: stats?.betaTesterCount ?? 0,
			recentSignups: stats?.recentSignups ?? 0,
			blockedCount: stats?.blockedCount ?? 0
		}
	};
};

export const actions: Actions = {
	blockUser: async ({ request, locals }) => {
		// Verify admin
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const targetUserId = formData.get('userId') as string;
		const reason = formData.get('reason') as string | null;

		if (!targetUserId) {
			return fail(400, { error: 'Missing userId' });
		}

		// Get current admin user's database ID
		const [adminUser] = await db
			.select({ id: schema.users.id })
			.from(schema.users)
			.where(eq(schema.users.discordId, locals.user.discordId))
			.limit(1);

		if (!adminUser) {
			return fail(400, { error: 'Admin user not found' });
		}

		// Get target user
		const [targetUser] = await db
			.select()
			.from(schema.users)
			.where(eq(schema.users.id, targetUserId))
			.limit(1);

		if (!targetUser) {
			return fail(404, { error: 'User not found' });
		}

		// Prevent blocking admins
		if (targetUser.role === 'admin') {
			return fail(400, { error: 'Cannot block admin users' });
		}

		// Check if already blocked
		if (targetUser.blockedAt) {
			return fail(400, { error: 'User is already blocked' });
		}

		// Block the user
		await db
			.update(schema.users)
			.set({
				blockedAt: new Date(),
				blockedBy: adminUser.id,
				blockReason: reason || null
			})
			.where(eq(schema.users.id, targetUserId));

		// Create audit log entry
		await db.insert(schema.adminAuditLog).values({
			action: 'user_blocked',
			targetUserId: targetUserId,
			adminUserId: adminUser.id,
			metadata: {
				reason: reason || null,
				targetUsername: targetUser.username,
				targetDiscordId: targetUser.discordId
			}
		});

		return { success: true, action: 'blocked', userId: targetUserId };
	},

	unblockUser: async ({ request, locals }) => {
		// Verify admin
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const targetUserId = formData.get('userId') as string;

		if (!targetUserId) {
			return fail(400, { error: 'Missing userId' });
		}

		// Get current admin user's database ID
		const [adminUser] = await db
			.select({ id: schema.users.id })
			.from(schema.users)
			.where(eq(schema.users.discordId, locals.user.discordId))
			.limit(1);

		if (!adminUser) {
			return fail(400, { error: 'Admin user not found' });
		}

		// Get target user
		const [targetUser] = await db
			.select()
			.from(schema.users)
			.where(eq(schema.users.id, targetUserId))
			.limit(1);

		if (!targetUser) {
			return fail(404, { error: 'User not found' });
		}

		// Check if actually blocked
		if (!targetUser.blockedAt) {
			return fail(400, { error: 'User is not blocked' });
		}

		// Unblock the user
		await db
			.update(schema.users)
			.set({
				blockedAt: null,
				blockedBy: null,
				blockReason: null
			})
			.where(eq(schema.users.id, targetUserId));

		// Create audit log entry
		await db.insert(schema.adminAuditLog).values({
			action: 'user_unblocked',
			targetUserId: targetUserId,
			adminUserId: adminUser.id,
			metadata: {
				targetUsername: targetUser.username,
				targetDiscordId: targetUser.discordId,
				previouslyBlockedBy: targetUser.blockedBy,
				previousBlockReason: targetUser.blockReason
			}
		});

		return { success: true, action: 'unblocked', userId: targetUserId };
	}
};
