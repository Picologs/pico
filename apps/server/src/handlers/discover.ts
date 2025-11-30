/**
 * Group Discovery Handlers
 *
 * Handlers for discovering and joining public groups
 */

import { eq, and, ne, sql, desc, asc, inArray, ilike } from "drizzle-orm";
import {
  db,
  users,
  groups,
  groupMembers,
  groupJoinRequests,
  notifications,
} from "../lib/db";
import { send, getDisplayName, broadcast, isValidUUID } from "../lib/utils";
import { userConnections } from "../lib/state";
import { notifyAdmin } from "../services/email";
import type {
  DiscoverableGroup,
  GroupJoinRequest,
  ActivityNotificationData,
} from "@pico/types";

/**
 * Create a notification in the database
 */
async function createNotification(
  userId: string,
  type: "join_request" | "activity",
  title: string,
  message: string,
  data: ActivityNotificationData,
) {
  await db.insert(notifications).values({
    userId,
    type,
    title,
    message,
    data: data as any,
    read: false,
    createdAt: new Date(),
  });
}

/**
 * Get discoverable groups with pagination, search, and tag filtering
 */
export async function getDiscoverableGroups(
  ws: any,
  userId: string,
  data: any,
  requestId?: string,
) {
  const page = Math.max(1, data?.page ?? 1);
  const perPage = Math.min(Math.max(1, data?.perPage ?? 20), 50);
  const offset = (page - 1) * perPage;
  const search = data?.search?.trim() || "";
  const tags = Array.isArray(data?.tags)
    ? data.tags.filter((t: any) => typeof t === "string")
    : [];
  const sortBy = data?.sortBy || "popular";

  // Get the current user
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.discordId, userId))
    .limit(1);
  if (!user)
    return send(
      ws,
      "discoverable_groups",
      { groups: [], pagination: { page, perPage, total: 0, hasMore: false } },
      undefined,
      requestId,
    );

  // Get user's current group memberships
  const memberships = await db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .where(eq(groupMembers.userId, user.id));
  const memberGroupIds = memberships.map((m) => m.groupId);

  // Get user's pending join requests
  const pendingRequests = await db
    .select({ groupId: groupJoinRequests.groupId })
    .from(groupJoinRequests)
    .where(
      and(
        eq(groupJoinRequests.userId, user.id),
        eq(groupJoinRequests.status, "pending"),
      ),
    );
  const pendingGroupIds = new Set(pendingRequests.map((r) => r.groupId));

  // Build the base query conditions
  const conditions = [eq(groups.visibility, "discoverable")];

  // Exclude groups user is already a member of
  if (memberGroupIds.length > 0) {
    conditions.push(
      sql`${groups.id} NOT IN (${sql.join(
        memberGroupIds.map((id) => sql`${id}`),
        sql`, `,
      )})`,
    );
  }

  // Search filter (fuzzy name search using ILIKE for now)
  if (search.length >= 2) {
    conditions.push(ilike(groups.name, `%${search}%`));
  }

  // Tag filter
  if (tags.length > 0) {
    // Groups that have at least one of the specified tags
    conditions.push(
      sql`${groups.tags} && ARRAY[${sql.join(
        tags.map((t: string) => sql`${t}`),
        sql`, `,
      )}]::text[]`,
    );
  }

  // Count total
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(groups)
    .where(and(...conditions));
  const total = countResult?.count || 0;

  // Determine sort order
  let orderBy;
  switch (sortBy) {
    case "recent":
      orderBy = desc(groups.createdAt);
      break;
    case "name":
      orderBy = asc(groups.name);
      break;
    case "popular":
    default:
      // Sort by member count - we'll need to join with a subquery
      orderBy = desc(groups.createdAt); // Fallback for now, will improve with cached member count
      break;
  }

  // Get discoverable groups
  const discoverableGroups = await db
    .select({
      id: groups.id,
      name: groups.name,
      description: groups.description,
      avatar: groups.avatar,
      tags: groups.tags,
      joinMethod: groups.joinMethod,
      createdAt: groups.createdAt,
      ownerId: groups.ownerId,
    })
    .from(groups)
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(perPage)
    .offset(offset);

  if (discoverableGroups.length === 0) {
    return send(
      ws,
      "discoverable_groups",
      {
        groups: [],
        pagination: { page, perPage, total, hasMore: false },
      },
      undefined,
      requestId,
    );
  }

  // Get member counts for these groups
  const groupIds = discoverableGroups.map((g) => g.id);
  const memberCounts = await db
    .select({
      groupId: groupMembers.groupId,
      count: sql<number>`count(*)::int`,
    })
    .from(groupMembers)
    .where(inArray(groupMembers.groupId, groupIds))
    .groupBy(groupMembers.groupId);

  const memberCountMap: Record<string, number> = {};
  for (const mc of memberCounts) {
    memberCountMap[mc.groupId] = mc.count;
  }

  // Get owner info for these groups
  const ownerIds = [...new Set(discoverableGroups.map((g) => g.ownerId))];
  const owners = await db
    .select()
    .from(users)
    .where(inArray(users.id, ownerIds));
  const ownerMap: Record<string, { username: string; avatar: string | null }> =
    {};
  for (const owner of owners) {
    ownerMap[owner.id] = {
      username: getDisplayName(owner),
      avatar: owner.avatar,
    };
  }

  // Build response
  const result: DiscoverableGroup[] = discoverableGroups.map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description || undefined,
    avatar: g.avatar,
    tags: g.tags || [],
    memberCount: memberCountMap[g.id] || 0,
    joinMethod: (g.joinMethod as "open" | "request") || "request",
    createdAt: g.createdAt.toISOString(),
    ownerUsername: ownerMap[g.ownerId]?.username,
    ownerAvatar: ownerMap[g.ownerId]?.avatar,
    isJoined: false,
    hasPendingRequest: pendingGroupIds.has(g.id),
  }));

  // Sort by member count if 'popular' (now that we have counts)
  if (sortBy === "popular") {
    result.sort((a, b) => b.memberCount - a.memberCount);
  }

  send(
    ws,
    "discoverable_groups",
    {
      groups: result,
      pagination: {
        page,
        perPage,
        total,
        hasMore: page * perPage < total,
      },
    },
    undefined,
    requestId,
  );
}

/**
 * Get popular tags from discoverable groups
 */
export async function getDiscoverTags(
  ws: any,
  userId: string,
  requestId?: string,
) {
  // Get all tags from discoverable groups and count them
  const result = await db
    .select({
      tags: groups.tags,
    })
    .from(groups)
    .where(eq(groups.visibility, "discoverable"));

  // Count tag occurrences
  const tagCounts: Record<string, number> = {};
  for (const row of result) {
    if (row.tags && Array.isArray(row.tags)) {
      for (const tag of row.tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }
  }

  // Sort by count descending and return top 20
  const sortedTags = Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  send(ws, "discover_tags", sortedTags, undefined, requestId);
}

/**
 * Join an open group (instant join)
 */
export async function joinOpenGroup(
  ws: any,
  userId: string,
  data: any,
  requestId?: string,
) {
  const { groupId } = data || {};

  if (!groupId || !isValidUUID(groupId)) {
    return send(
      ws,
      "join_open_group_result",
      { success: false, error: "Invalid group ID" },
      undefined,
      requestId,
    );
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.discordId, userId))
    .limit(1);
  if (!user)
    return send(
      ws,
      "join_open_group_result",
      { success: false, error: "User not found" },
      undefined,
      requestId,
    );

  // Get the group
  const [group] = await db
    .select()
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);
  if (!group) {
    return send(
      ws,
      "join_open_group_result",
      { success: false, error: "Group not found" },
      undefined,
      requestId,
    );
  }

  // Verify group is discoverable and open
  if (group.visibility !== "discoverable") {
    return send(
      ws,
      "join_open_group_result",
      { success: false, error: "Group is not discoverable" },
      undefined,
      requestId,
    );
  }

  if (group.joinMethod !== "open") {
    return send(
      ws,
      "join_open_group_result",
      { success: false, error: "This group requires approval to join" },
      undefined,
      requestId,
    );
  }

  // Check if already a member
  const [existingMember] = await db
    .select()
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)),
    )
    .limit(1);

  if (existingMember) {
    return send(
      ws,
      "join_open_group_result",
      { success: false, error: "Already a member of this group" },
      undefined,
      requestId,
    );
  }

  // Add user as member
  await db.insert(groupMembers).values({
    groupId,
    userId: user.id,
    role: "member",
    canInvite: false,
    canRemoveMembers: false,
    canEditGroup: false,
  });

  // Get member count
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId));

  // Build group response
  const groupResponse = {
    id: group.id,
    name: group.name,
    description: group.description,
    avatar: group.avatar,
    tags: group.tags || [],
    ownerId: group.ownerId,
    visibility: group.visibility as "private" | "discoverable",
    joinMethod: group.joinMethod as "open" | "request",
    createdAt: group.createdAt.toISOString(),
    updatedAt: group.updatedAt.toISOString(),
    memberCount: countResult?.count || 1,
    memberRole: "member" as const,
  };

  send(
    ws,
    "join_open_group_result",
    { success: true, group: groupResponse },
    undefined,
    requestId,
  );

  // Subscribe to group topic
  ws.subscribe(`group:${groupId}`);

  // Notify group members
  const members = await db
    .select()
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId));
  const memberUserIds = members.map((m) => m.userId);
  const memberUsers = await db
    .select()
    .from(users)
    .where(inArray(users.id, memberUserIds));
  const discordIds = memberUsers
    .map((u) => u.discordId)
    .filter((id) => id !== userId);

  broadcast(discordIds, "member_joined_group", {
    groupId: group.id,
    groupName: group.name,
    memberDiscordId: user.discordId,
    memberUsername: user.username,
    memberDisplayName: getDisplayName(user),
    memberAvatar: user.avatar,
  });
}

/**
 * Request to join a group (requires approval)
 */
export async function requestJoinGroup(
  ws: any,
  userId: string,
  data: any,
  requestId?: string,
) {
  const { groupId, message } = data || {};

  if (!groupId || !isValidUUID(groupId)) {
    return send(
      ws,
      "request_join_group_result",
      { success: false, error: "Invalid group ID" },
      undefined,
      requestId,
    );
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.discordId, userId))
    .limit(1);
  if (!user)
    return send(
      ws,
      "request_join_group_result",
      { success: false, error: "User not found" },
      undefined,
      requestId,
    );

  // Get the group
  const [group] = await db
    .select()
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);
  if (!group) {
    return send(
      ws,
      "request_join_group_result",
      { success: false, error: "Group not found" },
      undefined,
      requestId,
    );
  }

  // Verify group is discoverable and requires request
  if (group.visibility !== "discoverable") {
    return send(
      ws,
      "request_join_group_result",
      { success: false, error: "Group is not discoverable" },
      undefined,
      requestId,
    );
  }

  if (group.joinMethod !== "request") {
    return send(
      ws,
      "request_join_group_result",
      { success: false, error: "This group allows open joining" },
      undefined,
      requestId,
    );
  }

  // Check if already a member
  const [existingMember] = await db
    .select()
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)),
    )
    .limit(1);

  if (existingMember) {
    return send(
      ws,
      "request_join_group_result",
      { success: false, error: "Already a member of this group" },
      undefined,
      requestId,
    );
  }

  // Check for existing pending request
  const [existingRequest] = await db
    .select()
    .from(groupJoinRequests)
    .where(
      and(
        eq(groupJoinRequests.groupId, groupId),
        eq(groupJoinRequests.userId, user.id),
        eq(groupJoinRequests.status, "pending"),
      ),
    )
    .limit(1);

  if (existingRequest) {
    return send(
      ws,
      "request_join_group_result",
      { success: false, error: "Join request already pending" },
      undefined,
      requestId,
    );
  }

  // Create join request
  const [joinRequest] = await db
    .insert(groupJoinRequests)
    .values({
      groupId,
      userId: user.id,
      message: message?.trim() || null,
      status: "pending",
    })
    .returning();

  send(
    ws,
    "request_join_group_result",
    { success: true, requestId: joinRequest.id },
    undefined,
    requestId,
  );

  // Build notification data for owner/admins
  const requestData: GroupJoinRequest = {
    id: joinRequest.id,
    groupId,
    groupName: group.name,
    groupAvatar: group.avatar,
    userId: user.id,
    username: user.username,
    displayName: getDisplayName(user),
    avatar: user.avatar,
    message: message?.trim() || undefined,
    status: "pending",
    createdAt: joinRequest.createdAt.toISOString(),
  };

  // Notify group owner and admins
  const admins = await db
    .select({ userId: groupMembers.userId })
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        sql`${groupMembers.role} IN ('owner', 'admin')`,
      ),
    );

  const adminUserIds = admins.map((a) => a.userId);
  const adminUsers = await db
    .select()
    .from(users)
    .where(inArray(users.id, adminUserIds));
  const adminDiscordIds = adminUsers.map((u) => u.discordId);

  broadcast(adminDiscordIds, "new_join_request", requestData);

  // Create notification for owner
  await createNotification(
    group.ownerId,
    "activity",
    "New Join Request",
    `${getDisplayName(user)} wants to join ${group.name}`,
    {
      type: "activity",
      action: "join_request",
      groupId,
      groupName: group.name,
      actorId: user.id,
      actorUsername: user.username,
      actorDisplayName: getDisplayName(user),
      actorAvatar: user.avatar,
    },
  );

  // Notify admin
  notifyAdmin(
    "Group Join Request",
    `User "${getDisplayName(user)}" requested to join "${group.name}"`,
  );
}

/**
 * Get pending join requests for a group (owner/admin only)
 */
export async function getJoinRequests(
  ws: any,
  userId: string,
  data: any,
  requestId?: string,
) {
  const { groupId } = data || {};

  if (!groupId || !isValidUUID(groupId)) {
    return send(ws, "join_requests", [], undefined, requestId);
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.discordId, userId))
    .limit(1);
  if (!user) return send(ws, "join_requests", [], undefined, requestId);

  // Check if user is owner or admin of the group
  const [membership] = await db
    .select()
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)),
    )
    .limit(1);

  if (
    !membership ||
    (membership.role !== "owner" && membership.role !== "admin")
  ) {
    return send(
      ws,
      "error",
      undefined,
      "Not authorized to view join requests",
      requestId,
    );
  }

  // Get the group
  const [group] = await db
    .select()
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);
  if (!group) return send(ws, "join_requests", [], undefined, requestId);

  // Get pending requests
  const requests = await db
    .select()
    .from(groupJoinRequests)
    .where(
      and(
        eq(groupJoinRequests.groupId, groupId),
        eq(groupJoinRequests.status, "pending"),
      ),
    );

  if (requests.length === 0) {
    return send(ws, "join_requests", [], undefined, requestId);
  }

  // Get requester user info
  const requesterIds = requests.map((r) => r.userId);
  const requesters = await db
    .select()
    .from(users)
    .where(inArray(users.id, requesterIds));
  const requesterMap: Record<string, (typeof requesters)[0]> = {};
  for (const req of requesters) {
    requesterMap[req.id] = req;
  }

  // Build response
  const result: GroupJoinRequest[] = requests.map((r) => {
    const requester = requesterMap[r.userId];
    return {
      id: r.id,
      groupId: r.groupId,
      groupName: group.name,
      groupAvatar: group.avatar,
      userId: r.userId,
      username: requester?.username || "Unknown",
      displayName: requester ? getDisplayName(requester) : "Unknown",
      avatar: requester?.avatar || null,
      message: r.message || undefined,
      status: r.status as "pending" | "approved" | "denied",
      createdAt: r.createdAt.toISOString(),
    };
  });

  send(ws, "join_requests", result, undefined, requestId);
}

/**
 * Review (approve/deny) a join request
 */
export async function reviewJoinRequest(
  ws: any,
  userId: string,
  data: any,
  requestId?: string,
) {
  const { requestId: joinRequestId, decision } = data || {};

  if (!joinRequestId || !isValidUUID(joinRequestId)) {
    return send(
      ws,
      "review_join_request_result",
      { success: false, error: "Invalid request ID" },
      undefined,
      requestId,
    );
  }

  if (!decision || !["approve", "deny"].includes(decision)) {
    return send(
      ws,
      "review_join_request_result",
      { success: false, error: "Invalid decision" },
      undefined,
      requestId,
    );
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.discordId, userId))
    .limit(1);
  if (!user)
    return send(
      ws,
      "review_join_request_result",
      { success: false, error: "User not found" },
      undefined,
      requestId,
    );

  // Get the join request
  const [joinRequest] = await db
    .select()
    .from(groupJoinRequests)
    .where(eq(groupJoinRequests.id, joinRequestId))
    .limit(1);

  if (!joinRequest) {
    return send(
      ws,
      "review_join_request_result",
      { success: false, error: "Request not found" },
      undefined,
      requestId,
    );
  }

  if (joinRequest.status !== "pending") {
    return send(
      ws,
      "review_join_request_result",
      { success: false, error: "Request already processed" },
      undefined,
      requestId,
    );
  }

  // Check if user is owner or admin of the group
  const [membership] = await db
    .select()
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, joinRequest.groupId),
        eq(groupMembers.userId, user.id),
      ),
    )
    .limit(1);

  if (
    !membership ||
    (membership.role !== "owner" && membership.role !== "admin")
  ) {
    return send(
      ws,
      "review_join_request_result",
      { success: false, error: "Not authorized" },
      undefined,
      requestId,
    );
  }

  // Get the group
  const [group] = await db
    .select()
    .from(groups)
    .where(eq(groups.id, joinRequest.groupId))
    .limit(1);
  if (!group) {
    return send(
      ws,
      "review_join_request_result",
      { success: false, error: "Group not found" },
      undefined,
      requestId,
    );
  }

  // Update request status
  await db
    .update(groupJoinRequests)
    .set({
      status: decision === "approve" ? "approved" : "denied",
      reviewedBy: user.id,
      reviewedAt: new Date(),
    })
    .where(eq(groupJoinRequests.id, joinRequestId));

  let groupResponse = null;

  if (decision === "approve") {
    // Add user as member
    await db.insert(groupMembers).values({
      groupId: joinRequest.groupId,
      userId: joinRequest.userId,
      role: "member",
      canInvite: false,
      canRemoveMembers: false,
      canEditGroup: false,
    });

    // Get member count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(groupMembers)
      .where(eq(groupMembers.groupId, joinRequest.groupId));

    groupResponse = {
      id: group.id,
      name: group.name,
      description: group.description,
      avatar: group.avatar,
      tags: group.tags || [],
      ownerId: group.ownerId,
      visibility: group.visibility as "private" | "discoverable",
      joinMethod: group.joinMethod as "open" | "request",
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
      memberCount: countResult?.count || 1,
      memberRole: "member" as const,
    };
  }

  send(
    ws,
    "review_join_request_result",
    { success: true },
    undefined,
    requestId,
  );

  // Notify the requester
  const [requester] = await db
    .select()
    .from(users)
    .where(eq(users.id, joinRequest.userId))
    .limit(1);

  if (requester) {
    broadcast([requester.discordId], "join_request_reviewed", {
      groupId: group.id,
      groupName: group.name,
      decision,
      group: groupResponse,
    });
  }

  // If approved, also notify other group members
  if (decision === "approve" && requester) {
    const members = await db
      .select()
      .from(groupMembers)
      .where(eq(groupMembers.groupId, joinRequest.groupId));
    const memberUserIds = members.map((m) => m.userId);
    const memberUsers = await db
      .select()
      .from(users)
      .where(inArray(users.id, memberUserIds));
    const discordIds = memberUsers
      .map((u) => u.discordId)
      .filter((id) => id !== requester.discordId && id !== userId);

    broadcast(discordIds, "member_joined_group", {
      groupId: group.id,
      groupName: group.name,
      memberDiscordId: requester.discordId,
      memberUsername: requester.username,
      memberDisplayName: getDisplayName(requester),
      memberAvatar: requester.avatar,
    });
  }
}
