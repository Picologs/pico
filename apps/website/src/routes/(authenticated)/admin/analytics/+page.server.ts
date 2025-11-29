import type { PageServerLoad } from './$types';
import { db, schema } from '$lib/db';
import { count, sql, desc } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	// User stats
	const [userStats] = await db
		.select({
			totalUsers: count(),
			usersToday: sql<number>`count(*) filter (where created_at > now() - interval '1 day')`,
			usersThisWeek: sql<number>`count(*) filter (where created_at > now() - interval '7 days')`,
			usersThisMonth: sql<number>`count(*) filter (where created_at > now() - interval '30 days')`
		})
		.from(schema.users);

	// Group stats
	const [groupStats] = await db
		.select({
			totalGroups: count()
		})
		.from(schema.groups);

	// Friend stats
	const [friendStats] = await db
		.select({
			totalFriendships: count(),
			pendingRequests: sql<number>`count(*) filter (where status = 'pending')`,
			acceptedFriendships: sql<number>`count(*) filter (where status = 'accepted')`
		})
		.from(schema.friends);

	// Recent signups (last 10)
	const recentSignups = await db
		.select({
			id: schema.users.id,
			username: schema.users.username,
			discordId: schema.users.discordId,
			avatar: schema.users.avatar,
			createdAt: schema.users.createdAt
		})
		.from(schema.users)
		.orderBy(desc(schema.users.createdAt))
		.limit(10);

	// Log pattern stats - placeholder for future implementation
	// The logPatterns table is defined in the server schema, not website schema
	const logPatternStats = { totalPatterns: 0, handledPatterns: 0, unhandledPatterns: 0 };

	return {
		userStats: userStats ?? { totalUsers: 0, usersToday: 0, usersThisWeek: 0, usersThisMonth: 0 },
		groupStats: groupStats ?? { totalGroups: 0 },
		friendStats: friendStats ?? { totalFriendships: 0, pendingRequests: 0, acceptedFriendships: 0 },
		logPatternStats,
		recentSignups
	};
};
