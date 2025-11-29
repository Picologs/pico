/**
 * Dashboard-related message handlers
 * Combines friends, groups, and notifications into a single optimized query
 */

import { eq, or, and, inArray, sql } from "drizzle-orm";
import {
  db,
  users,
  friends,
  groups,
  groupMembers,
  groupInvitations,
  groupJoinRequests,
} from "../lib/db";
import { send, getDisplayName, isValidUserId } from "../lib/utils";
import { userConnections } from "../lib/state";

/**
 * Get dashboard data (friends, groups, friend requests, group invitations)
 * Optimized parallel query to load all initial app state in one request
 */
export async function getDashboardData(
  ws: any,
  userId: string,
  data: any,
  requestId?: string,
) {
  try {
    // Extract parameters with defaults
    const friendsPage = data?.friendsPage ?? 1;
    const friendsPerPage = Math.min(data?.friendsPerPage ?? 10, 100);
    const groupsPage = data?.groupsPage ?? 1;
    const groupsPerPage = Math.min(data?.groupsPerPage ?? 10, 100);
    const includeGroupMembers = data?.includeGroupMembers === true;

    console.log(
      `[get_dashboard_data] User: ${userId}, friendsPage: ${friendsPage}, friendsPerPage: ${friendsPerPage}, groupsPage: ${groupsPage}, groupsPerPage: ${groupsPerPage}, includeGroupMembers: ${includeGroupMembers}`,
    );

    // Validate pagination parameters
    if (
      friendsPage < 1 ||
      friendsPerPage < 1 ||
      friendsPerPage > 100 ||
      groupsPage < 1 ||
      groupsPerPage < 1 ||
      groupsPerPage > 100
    ) {
      return send(
        ws,
        "error",
        undefined,
        "Invalid pagination parameters. Page must be >= 1, perPage must be 1-100.",
        requestId,
      );
    }

    // First, find the user's database ID from their Discord ID
    const [currentUser] = await db
      .select()
      .from(users)
      .where(eq(users.discordId, userId))
      .limit(1);

    if (!currentUser) {
      // User not found - return empty dashboard
      return send(
        ws,
        "dashboard_data",
        {
          user: null,
          friends: [],
          friendsPagination: {
            page: 1,
            perPage: friendsPerPage,
            total: 0,
            totalPages: 0,
            hasMore: false,
          },
          groups: [],
          groupsPagination: {
            page: 1,
            perPage: groupsPerPage,
            total: 0,
            totalPages: 0,
            hasMore: false,
          },
          logs: [],
          notifications: {
            friendRequests: [],
            groupInvitations: [],
          },
        },
        undefined,
        requestId,
      );
    }

    // Run all queries in parallel: friends, groups, friend requests, group invitations
    const [friendsData, groupsData, friendRequestsData, groupInvitationsData] =
      await Promise.all([
        // Friends query with pagination
        (async () => {
          // Get total count of friends for pagination metadata
          const totalCountResult = await db
            .select({
              count: sql<number>`count(*)::int`,
            })
            .from(friends)
            .where(
              and(
                or(
                  eq(friends.userId, currentUser.id),
                  eq(friends.friendId, currentUser.id),
                ),
                eq(friends.status, "accepted"),
              ),
            );

          const total = totalCountResult[0]?.count ?? 0;
          const totalPages = Math.ceil(total / friendsPerPage);
          const hasMore = friendsPage < totalPages;

          // Calculate offset for pagination
          const offset = (friendsPage - 1) * friendsPerPage;

          // Query friendships with pagination
          const friendships = await db
            .select({
              id: friends.id,
              status: friends.status,
              createdAt: friends.createdAt,
              userId: friends.userId,
              friendId: friends.friendId,
            })
            .from(friends)
            .where(
              and(
                or(
                  eq(friends.userId, currentUser.id),
                  eq(friends.friendId, currentUser.id),
                ),
                eq(friends.status, "accepted"),
              ),
            )
            .limit(friendsPerPage)
            .offset(offset);

          // Get all friend user IDs
          const friendUserIds = Array.from(
            new Set(
              friendships.map((f) =>
                f.userId === currentUser.id ? f.friendId : f.userId,
              ),
            ),
          );

          // Fetch all friend user details
          const friendUsers =
            friendUserIds.length > 0
              ? await db
                  .select()
                  .from(users)
                  .where(inArray(users.id, friendUserIds))
              : [];

          // Map friendship data with user details
          const friendsList = friendUserIds.map((friendUserId) => {
            const friendship = friendships.find(
              (f) =>
                (f.userId === currentUser.id && f.friendId === friendUserId) ||
                (f.friendId === currentUser.id && f.userId === friendUserId),
            )!;

            const friendUser = friendUsers.find((u) => u.id === friendUserId);

            return {
              id: friendship.id,
              status: friendship.status,
              createdAt: friendship.createdAt.toISOString(),
              friendUserId: friendUserId,
              friendDiscordId: friendUser?.discordId || null,
              friendUsername: friendUser?.username || null,
              friendDisplayName:
                friendUser?.username &&
                friendUser?.player !== undefined &&
                friendUser?.usePlayerAsDisplayName !== undefined
                  ? getDisplayName({
                      username: friendUser.username,
                      player: friendUser.player,
                      usePlayerAsDisplayName: friendUser.usePlayerAsDisplayName,
                    })
                  : friendUser?.username || null,
              friendAvatar: friendUser?.avatar || null,
              friendPlayer: friendUser?.player || null,
              friendTimeZone: friendUser?.timeZone || null,
              friendUsePlayerAsDisplayName:
                friendUser?.usePlayerAsDisplayName ?? false,
              isOnline: userConnections.has(friendUser?.discordId || ""),
            };
          });

          // Sort by username/displayName (default sorting)
          friendsList.sort((a, b) => {
            return (a.friendDisplayName || "").localeCompare(
              b.friendDisplayName || "",
            );
          });

          return {
            friends: friendsList,
            pagination: {
              page: friendsPage,
              perPage: friendsPerPage,
              total,
              totalPages,
              hasMore,
            },
          };
        })(),

        // Groups query with pagination
        (async () => {
          // Get total count of groups for pagination metadata
          const totalCountResult = await db
            .select({
              count: sql<number>`count(*)::int`,
            })
            .from(groupMembers)
            .where(eq(groupMembers.userId, currentUser.id));

          const total = totalCountResult[0]?.count ?? 0;
          const totalPages = Math.ceil(total / groupsPerPage);
          const hasMore = groupsPage < totalPages;

          // Calculate offset for pagination
          const offset = (groupsPage - 1) * groupsPerPage;

          // Get groups where user is a member (with pagination)
          const userGroups = await db
            .select({
              id: groups.id,
              name: groups.name,
              description: groups.description,
              avatar: groups.avatar,
              ownerId: groups.ownerId,
              createdAt: groups.createdAt,
              updatedAt: groups.updatedAt,
              tags: groups.tags,
              visibility: groups.visibility,
              joinMethod: groups.joinMethod,
              memberRole: groupMembers.role,
            })
            .from(groupMembers)
            .innerJoin(groups, eq(groupMembers.groupId, groups.id))
            .where(eq(groupMembers.userId, currentUser.id))
            .limit(groupsPerPage)
            .offset(offset);

          // Fetch member counts for all groups
          const groupIds = userGroups.map((g) => g.id);
          const memberCounts: Record<string, number> = {};

          if (groupIds.length > 0) {
            const countResults = await db
              .select({
                groupId: groupMembers.groupId,
                count: sql<number>`count(*)::int`,
              })
              .from(groupMembers)
              .where(inArray(groupMembers.groupId, groupIds))
              .groupBy(groupMembers.groupId);

            for (const result of countResults) {
              memberCounts[result.groupId] = result.count;
            }
          }

          // Fetch pending join request counts for groups where user is owner/admin
          const pendingJoinRequestCounts: Record<string, number> = {};
          const pendingJoinRequests: Record<string, any[]> = {};
          const adminGroupIds = userGroups
            .filter((g) => g.memberRole === "owner" || g.memberRole === "admin")
            .map((g) => g.id);

          if (adminGroupIds.length > 0) {
            // Fetch counts
            const pendingCountResults = await db
              .select({
                groupId: groupJoinRequests.groupId,
                count: sql<number>`count(*)::int`,
              })
              .from(groupJoinRequests)
              .where(
                and(
                  inArray(groupJoinRequests.groupId, adminGroupIds),
                  eq(groupJoinRequests.status, "pending"),
                ),
              )
              .groupBy(groupJoinRequests.groupId);

            for (const result of pendingCountResults) {
              pendingJoinRequestCounts[result.groupId] = result.count;
            }

            // Also fetch actual join requests for notification dropdown
            const joinRequestResults = await db
              .select({
                request: groupJoinRequests,
                user: users,
                group: groups,
              })
              .from(groupJoinRequests)
              .innerJoin(users, eq(groupJoinRequests.userId, users.id))
              .innerJoin(groups, eq(groupJoinRequests.groupId, groups.id))
              .where(
                and(
                  inArray(groupJoinRequests.groupId, adminGroupIds),
                  eq(groupJoinRequests.status, "pending"),
                ),
              );

            // Group by groupId
            for (const row of joinRequestResults) {
              const groupId = row.request.groupId;
              if (!pendingJoinRequests[groupId]) {
                pendingJoinRequests[groupId] = [];
              }
              pendingJoinRequests[groupId].push({
                id: row.request.id,
                groupId,
                groupName: row.group.name,
                groupAvatar: row.group.avatar,
                userId: row.user.id,
                username: row.user.username,
                displayName: getDisplayName({
                  username: row.user.username,
                  player: row.user.player,
                  usePlayerAsDisplayName: row.user.usePlayerAsDisplayName,
                }),
                avatar: row.user.avatar,
                message: row.request.message,
                status: row.request.status,
                createdAt: row.request.createdAt.toISOString(),
              });
            }
          }

          // If includeGroupMembers is true, fetch all group members
          if (includeGroupMembers && userGroups.length > 0) {
            const allMembers = await db
              .select()
              .from(groupMembers)
              .innerJoin(users, eq(groupMembers.userId, users.id))
              .where(inArray(groupMembers.groupId, groupIds));

            // Group members by groupId
            const membersByGroup: Record<string, any[]> = {};
            for (const row of allMembers) {
              const gm = row.group_members;
              const u = row.users;

              if (!membersByGroup[gm.groupId]) {
                membersByGroup[gm.groupId] = [];
              }

              membersByGroup[gm.groupId].push({
                id: gm.id,
                groupId: gm.groupId,
                userId: u.id,
                discordId: u.discordId,
                username: u.username,
                displayName: getDisplayName({
                  username: u.username,
                  player: u.player,
                  usePlayerAsDisplayName: u.usePlayerAsDisplayName,
                }),
                avatar: u.avatar,
                player: u.player,
                timeZone: u.showTimezone !== false ? u.timeZone : null,
                usePlayerAsDisplayName: u.usePlayerAsDisplayName,
                role: gm.role,
                canInvite: gm.canInvite,
                canRemoveMembers: gm.canRemoveMembers,
                canEditGroup: gm.canEditGroup,
                joinedAt: gm.joinedAt.toISOString(),
              });
            }

            const formattedGroups = userGroups.map((g) => {
              const isOwnerOrAdmin =
                g.memberRole === "owner" || g.memberRole === "admin";
              return {
                ...g,
                createdAt: g.createdAt.toISOString(),
                updatedAt: g.updatedAt.toISOString(),
                memberCount: memberCounts[g.id] || 0,
                // Include pending count only for owners/admins of discoverable groups with request join method
                ...(isOwnerOrAdmin &&
                g.visibility === "discoverable" &&
                g.joinMethod === "request"
                  ? {
                      pendingJoinRequestCount:
                        pendingJoinRequestCounts[g.id] || 0,
                    }
                  : {}),
              };
            });

            return {
              groups: formattedGroups,
              members: membersByGroup,
              pendingJoinRequests,
              pagination: {
                page: groupsPage,
                perPage: groupsPerPage,
                total,
                totalPages,
                hasMore,
              },
            };
          } else {
            // Without members, just send the groups with member count
            const formattedGroups = userGroups.map((g) => {
              const isOwnerOrAdmin =
                g.memberRole === "owner" || g.memberRole === "admin";
              return {
                ...g,
                createdAt: g.createdAt.toISOString(),
                updatedAt: g.updatedAt.toISOString(),
                memberCount: memberCounts[g.id] || 0,
                // Include pending count only for owners/admins of discoverable groups with request join method
                ...(isOwnerOrAdmin &&
                g.visibility === "discoverable" &&
                g.joinMethod === "request"
                  ? {
                      pendingJoinRequestCount:
                        pendingJoinRequestCounts[g.id] || 0,
                    }
                  : {}),
              };
            });

            return {
              groups: formattedGroups,
              pendingJoinRequests,
              pagination: {
                page: groupsPage,
                perPage: groupsPerPage,
                total,
                totalPages,
                hasMore,
              },
            };
          }
        })(),

        // Friend requests query (incoming only)
        (async () => {
          const requests = await db
            .select({
              id: friends.id,
              userId: friends.userId,
              friendId: friends.friendId,
              status: friends.status,
              createdAt: friends.createdAt,
            })
            .from(friends)
            .where(
              and(
                eq(friends.friendId, currentUser.id),
                eq(friends.status, "pending"),
              ),
            );

          // Get user details for requesters
          const userIds = requests.map((r) => r.userId);
          const requestUsers =
            userIds.length > 0
              ? await db.select().from(users).where(inArray(users.id, userIds))
              : [];

          return requests.map((r) => {
            const requester = requestUsers.find((u) => u.id === r.userId);
            return {
              id: r.id,
              userId: r.userId,
              friendId: r.friendId,
              status: r.status,
              createdAt: r.createdAt.toISOString(),
              requesterDiscordId: requester?.discordId || null,
              requesterUsername: requester?.username || null,
              requesterDisplayName: requester
                ? getDisplayName({
                    username: requester.username,
                    player: requester.player,
                    usePlayerAsDisplayName: requester.usePlayerAsDisplayName,
                  })
                : null,
              requesterAvatar: requester?.avatar || null,
              requesterPlayer: requester?.player || null,
            };
          });
        })(),

        // Group invitations query (incoming only)
        (async () => {
          const invitations = await db
            .select()
            .from(groupInvitations)
            .where(
              and(
                eq(groupInvitations.inviteeId, currentUser.id),
                eq(groupInvitations.status, "pending"),
              ),
            );

          // Get group and inviter details
          const groupIds = invitations.map((i) => i.groupId);
          const inviterIds = invitations.map((i) => i.inviterId);

          const [groupsDetails, inviters] = await Promise.all([
            groupIds.length > 0
              ? db.select().from(groups).where(inArray(groups.id, groupIds))
              : Promise.resolve([]),
            inviterIds.length > 0
              ? db.select().from(users).where(inArray(users.id, inviterIds))
              : Promise.resolve([]),
          ]);

          return invitations.map((i) => {
            const group = groupsDetails.find((g) => g.id === i.groupId);
            const inviter = inviters.find((u) => u.id === i.inviterId);
            return {
              id: i.id,
              groupId: i.groupId,
              inviterId: i.inviterId,
              inviteeId: i.inviteeId,
              status: i.status,
              createdAt: i.createdAt.toISOString(),
              groupName: group?.name || null,
              groupAvatar: group?.avatar || null,
              inviterUsername: inviter?.username || null,
              inviterDisplayName: inviter
                ? getDisplayName({
                    username: inviter.username,
                    player: inviter.player,
                    usePlayerAsDisplayName: inviter.usePlayerAsDisplayName,
                  })
                : null,
              inviterAvatar: inviter?.avatar || null,
            };
          });
        })(),
      ]);

    // Construct complete app state response
    const responseData: any = {
      user: {
        id: currentUser.id,
        discordId: currentUser.discordId,
        username: currentUser.username,
        avatar: currentUser.avatar,
        player: currentUser.player,
        timeZone: currentUser.timeZone,
        usePlayerAsDisplayName: currentUser.usePlayerAsDisplayName,
        showTimezone: currentUser.showTimezone,
        friendCode: currentUser.friendCode,
        createdAt: currentUser.createdAt.toISOString(),
        updatedAt: currentUser.updatedAt.toISOString(),
      },
      friends: friendsData.friends,
      friendsPagination: friendsData.pagination,
      groups: groupsData.groups,
      groupsPagination: groupsData.pagination,
      logs: [], // Always empty initially - logs populated via WebSocket subscriptions
      notifications: {
        friendRequests: friendRequestsData,
        groupInvitations: groupInvitationsData,
      },
    };

    // If includeGroupMembers was true, include the members map
    if (groupsData.members) {
      responseData.groupMembers = groupsData.members;
    }

    // Include pending join requests for notification dropdown
    if (
      groupsData.pendingJoinRequests &&
      Object.keys(groupsData.pendingJoinRequests).length > 0
    ) {
      responseData.pendingJoinRequests = groupsData.pendingJoinRequests;
    }

    console.log(
      `[get_dashboard_data] Sent complete app state to ${userId}: ${friendsData.friends.length} friends, ${groupsData.groups.length} groups, ${friendRequestsData.length} friend requests, ${groupInvitationsData.length} group invitations`,
    );

    return send(ws, "dashboard_data", responseData, undefined, requestId);
  } catch (error) {
    console.error(
      `[get_dashboard_data] Error fetching dashboard data for ${userId}:`,
      error,
    );
    return send(
      ws,
      "error",
      undefined,
      "Error fetching dashboard data.",
      requestId,
    );
  }
}
