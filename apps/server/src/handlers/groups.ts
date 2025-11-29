/**
 * Group-related message handlers
 */

import { eq, and, inArray, sql } from "drizzle-orm";
import {
  db,
  users,
  groups,
  groupMembers,
  groupInvitations,
  groupJoinRequests,
  notifications,
} from "../lib/db";
import {
  send,
  getDisplayName,
  broadcast,
  isValidUUID,
  isValidUserId,
} from "../lib/utils";
import { userConnections } from "../lib/state";
import { notifyAdmin } from "../services/email";
import type {
  GroupInvitationNotificationData,
  ActivityNotificationData,
} from "@pico/types";

/**
 * Create a notification in the database
 */
async function createNotification(
  userId: string,
  type: "group_invitation" | "activity",
  title: string,
  message: string,
  data: GroupInvitationNotificationData | ActivityNotificationData,
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

export async function getGroups(
  ws: any,
  userId: string,
  data: any,
  requestId?: string,
) {
  const includeMembers = data?.includeMembers ?? false;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.discordId, userId))
    .limit(1);
  if (!user)
    return send(ws, "groups_list", { groups: [] }, undefined, requestId);

  // Get user's groups
  const memberships = await db
    .select()
    .from(groupMembers)
    .where(eq(groupMembers.userId, user.id));
  const groupIds = memberships.map((m) => m.groupId);

  if (groupIds.length === 0)
    return send(ws, "groups_list", { groups: [] }, undefined, requestId);

  const userGroups = await db
    .select()
    .from(groups)
    .where(inArray(groups.id, groupIds));

  // Get actual member counts for each group
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

  // Get pending join request counts for groups where user is owner or admin
  const pendingJoinRequestCounts: Record<string, number> = {};
  const adminGroupIds = memberships
    .filter((m) => m.role === "owner" || m.role === "admin")
    .map((m) => m.groupId);

  if (adminGroupIds.length > 0) {
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
  }

  if (!includeMembers) {
    const groupList = userGroups.map((g) => {
      const membership = memberships.find((m) => m.groupId === g.id);
      const isOwnerOrAdmin =
        membership?.role === "owner" || membership?.role === "admin";
      return {
        id: g.id,
        name: g.name,
        description: g.description,
        avatar: g.avatar,
        tags: g.tags,
        ownerId: g.ownerId,
        visibility: g.visibility,
        joinMethod: g.joinMethod,
        createdAt: g.createdAt.toISOString(),
        updatedAt: g.updatedAt.toISOString(),
        memberCount: memberCounts[g.id] || 0,
        memberRole: membership?.role || "member",
        // Include pending count only for owners/admins of discoverable groups
        ...(isOwnerOrAdmin &&
        g.visibility === "discoverable" &&
        g.joinMethod === "request"
          ? { pendingJoinRequestCount: pendingJoinRequestCounts[g.id] || 0 }
          : {}),
      };
    });

    return send(ws, "groups_list", { groups: groupList }, undefined, requestId);
  }

  // Include members
  const allMembers = await db
    .select()
    .from(groupMembers)
    .where(inArray(groupMembers.groupId, groupIds));
  const memberUserIds = [...new Set(allMembers.map((m) => m.userId))];
  const memberUsers = await db
    .select()
    .from(users)
    .where(inArray(users.id, memberUserIds));

  const groupsWithMembers: any = {
    groups: userGroups.map((g) => {
      const membership = memberships.find((m) => m.groupId === g.id);
      const isOwnerOrAdmin =
        membership?.role === "owner" || membership?.role === "admin";
      return {
        id: g.id,
        name: g.name,
        description: g.description,
        avatar: g.avatar,
        tags: g.tags,
        ownerId: g.ownerId,
        visibility: g.visibility,
        joinMethod: g.joinMethod,
        createdAt: g.createdAt.toISOString(),
        updatedAt: g.updatedAt.toISOString(),
        memberCount: memberCounts[g.id] || 0,
        memberRole: membership?.role || "member",
        // Include pending count only for owners/admins of discoverable groups
        ...(isOwnerOrAdmin &&
        g.visibility === "discoverable" &&
        g.joinMethod === "request"
          ? { pendingJoinRequestCount: pendingJoinRequestCounts[g.id] || 0 }
          : {}),
      };
    }),
    members: {},
  };

  for (const g of userGroups) {
    const gMembers = allMembers.filter((m) => m.groupId === g.id);
    groupsWithMembers.members[g.id] = gMembers.map((m) => {
      const u = memberUsers.find((user) => user.id === m.userId);
      return {
        id: m.id,
        groupId: m.groupId,
        userId: m.userId,
        discordId: u?.discordId || null,
        username: u?.username || null,
        player: u?.player || null,
        usePlayerAsDisplayName: u?.usePlayerAsDisplayName ?? false,
        displayName: u
          ? u.usePlayerAsDisplayName && u.player
            ? u.player
            : u.username
          : "Unknown",
        avatar: u?.avatar || null,
        timeZone: u?.timeZone || null,
        role: m.role,
        canInvite: m.canInvite,
        canRemoveMembers: m.canRemoveMembers,
        canEditGroup: m.canEditGroup,
        joinedAt: m.joinedAt.toISOString(),
        isOnline: userConnections.has(u?.discordId || ""),
      };
    });
  }

  send(
    ws,
    "groups_list",
    { groups: groupsWithMembers.groups },
    undefined,
    requestId,
  );
}

export async function createGroup(
  ws: any,
  userId: string,
  data: any,
  requestId?: string,
) {
  const { name, description, avatar, tags, visibility, joinMethod } =
    data || {};

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return send(ws, "error", undefined, "Group name is required", requestId);
  }

  // Validate visibility and joinMethod
  const validVisibility =
    visibility === "discoverable" ? "discoverable" : "private";
  const validJoinMethod = joinMethod === "open" ? "open" : "request";

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.discordId, userId))
    .limit(1);
  if (!user) return send(ws, "error", undefined, "User not found", requestId);

  // Create group
  const [newGroup] = await db
    .insert(groups)
    .values({
      name: name.trim(),
      description: description || null,
      avatar: avatar || null,
      tags: tags || [],
      ownerId: user.id,
      visibility: validVisibility,
      joinMethod: validJoinMethod,
    })
    .returning();

  // Add creator as owner member
  await db.insert(groupMembers).values({
    groupId: newGroup.id,
    userId: user.id,
    role: "owner",
    canInvite: true,
    canRemoveMembers: true,
    canEditGroup: true,
  });

  send(
    ws,
    "group_created",
    {
      group: {
        id: newGroup.id,
        name: newGroup.name,
        description: newGroup.description,
        avatar: newGroup.avatar,
        tags: newGroup.tags,
        ownerId: newGroup.ownerId,
        visibility: newGroup.visibility,
        joinMethod: newGroup.joinMethod,
        createdAt: newGroup.createdAt.toISOString(),
        updatedAt: newGroup.updatedAt.toISOString(),
        memberCount: 1,
        memberRole: "owner",
      },
    },
    undefined,
    requestId,
  );

  // Subscribe to group topic
  ws.subscribe(`group:${newGroup.id}`);

  // Notify admin
  notifyAdmin(
    "New Group Created",
    `User "${user.username}" created group "${name.trim()}"`,
  );
}

export async function inviteFriendToGroup(
  ws: any,
  userId: string,
  data: any,
  requestId?: string,
) {
  const { groupId, discordId, friendDiscordId } = data || {};
  const targetDiscordId = discordId || friendDiscordId;

  if (!groupId || !isValidUUID(groupId))
    return send(ws, "error", undefined, "Invalid group ID", requestId);
  if (!targetDiscordId || !isValidUserId(targetDiscordId))
    return send(ws, "error", undefined, "Invalid friend ID", requestId);

  const [inviter] = await db
    .select()
    .from(users)
    .where(eq(users.discordId, userId))
    .limit(1);
  const [invitee] = await db
    .select()
    .from(users)
    .where(eq(users.discordId, targetDiscordId))
    .limit(1);

  if (!inviter || !invitee)
    return send(ws, "error", undefined, "User not found", requestId);

  // Check inviter's permissions
  const [membership] = await db
    .select()
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, inviter.id),
      ),
    )
    .limit(1);

  if (!membership || !membership.canInvite) {
    return send(ws, "error", undefined, "No permission to invite", requestId);
  }

  // Check if already member
  const [existing] = await db
    .select()
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, invitee.id),
      ),
    )
    .limit(1);

  if (existing)
    return send(ws, "error", undefined, "User is already a member", requestId);

  // Check pending invitation
  const [pendingInvite] = await db
    .select()
    .from(groupInvitations)
    .where(
      and(
        eq(groupInvitations.groupId, groupId),
        eq(groupInvitations.inviteeId, invitee.id),
        eq(groupInvitations.status, "pending"),
      ),
    )
    .limit(1);

  if (pendingInvite)
    return send(ws, "error", undefined, "Invitation already sent", requestId);

  // Create invitation
  const [invitation] = await db
    .insert(groupInvitations)
    .values({
      groupId,
      inviterId: inviter.id,
      inviteeId: invitee.id,
      status: "pending",
    })
    .returning();

  // Get group details
  const [group] = await db
    .select()
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);

  // Create notification for invitee
  if (group) {
    const notificationData: GroupInvitationNotificationData = {
      type: "group_invitation",
      invitationId: invitation.id,
      groupId: group.id,
      groupName: group.name,
      groupAvatar: group.avatar,
      inviterId: inviter.id,
      inviterUsername: inviter.username,
      inviterDisplayName: getDisplayName(inviter),
      inviterAvatar: inviter.avatar,
    };

    await createNotification(
      invitee.id,
      "group_invitation",
      "Group Invitation",
      `${getDisplayName(inviter)} invited you to join ${group.name}`,
      notificationData,
    );
  }

  send(
    ws,
    "group_invitation_sent",
    { invitationId: invitation.id },
    undefined,
    requestId,
  );

  // Notify invitee if online
  if (group) {
    broadcast([friendDiscordId], "group_invitation_received", {
      id: invitation.id,
      groupId: group.id,
      groupName: group.name,
      groupAvatar: group.avatar,
      inviterDiscordId: inviter.discordId,
      inviterUsername: inviter.username,
      inviterDisplayName: getDisplayName(inviter),
      createdAt: invitation.createdAt.toISOString(),
    });
  }
}

export async function acceptGroupInvitation(
  ws: any,
  userId: string,
  data: any,
  requestId?: string,
) {
  const { invitationId } = data || {};

  if (!invitationId || !isValidUUID(invitationId)) {
    return send(ws, "error", undefined, "Invalid invitation ID", requestId);
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.discordId, userId))
    .limit(1);
  if (!user) return send(ws, "error", undefined, "User not found", requestId);

  const [invitation] = await db
    .select()
    .from(groupInvitations)
    .where(eq(groupInvitations.id, invitationId))
    .limit(1);
  if (!invitation)
    return send(ws, "error", undefined, "Invitation not found", requestId);

  if (invitation.inviteeId !== user.id)
    return send(ws, "error", undefined, "Not authorized", requestId);
  if (invitation.status !== "pending")
    return send(
      ws,
      "error",
      undefined,
      "Invitation already processed",
      requestId,
    );

  // Add as member
  await db.insert(groupMembers).values({
    groupId: invitation.groupId,
    userId: user.id,
    role: "member",
    canInvite: false,
    canRemoveMembers: false,
    canEditGroup: false,
  });

  // Update invitation
  await db
    .update(groupInvitations)
    .set({ status: "accepted" })
    .where(eq(groupInvitations.id, invitationId));

  // Get group data and member count
  const [group] = await db
    .select()
    .from(groups)
    .where(eq(groups.id, invitation.groupId))
    .limit(1);
  const members = await db
    .select()
    .from(groupMembers)
    .where(eq(groupMembers.groupId, invitation.groupId));
  const memberCount = members.length;

  // Build group object to send to client
  const groupData = group
    ? {
        id: group.id,
        name: group.name,
        description: group.description,
        avatar: group.avatar,
        tags: group.tags,
        ownerId: group.ownerId,
        visibility: group.visibility,
        joinMethod: group.joinMethod,
        createdAt: group.createdAt.toISOString(),
        updatedAt: group.updatedAt.toISOString(),
        memberCount,
        memberRole: "member" as const,
      }
    : null;

  send(
    ws,
    "group_invitation_accepted",
    { invitationId, groupId: invitation.groupId, group: groupData },
    undefined,
    requestId,
  );

  // Subscribe to group topic
  ws.subscribe(`group:${invitation.groupId}`);

  // Get member users for broadcast
  const memberUserIds = members.map((m) => m.userId);
  const memberUsers = await db
    .select()
    .from(users)
    .where(inArray(users.id, memberUserIds));

  // Notify all group members
  const discordIds = memberUsers
    .map((u) => u.discordId)
    .filter((id) => id !== userId);
  if (group) {
    broadcast(discordIds, "member_joined_group", {
      groupId: group.id,
      groupName: group.name,
      memberDiscordId: user.discordId,
      memberUsername: user.username,
      memberDisplayName: getDisplayName(user),
      memberAvatar: user.avatar,
    });
  }
}

export async function denyGroupInvitation(
  ws: any,
  userId: string,
  data: any,
  requestId?: string,
) {
  const { invitationId } = data || {};

  if (!invitationId || !isValidUUID(invitationId)) {
    return send(ws, "error", undefined, "Invalid invitation ID", requestId);
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.discordId, userId))
    .limit(1);
  if (!user) return send(ws, "error", undefined, "User not found", requestId);

  const [invitation] = await db
    .select()
    .from(groupInvitations)
    .where(eq(groupInvitations.id, invitationId))
    .limit(1);
  if (!invitation)
    return send(ws, "error", undefined, "Invitation not found", requestId);

  if (invitation.inviteeId !== user.id)
    return send(ws, "error", undefined, "Not authorized", requestId);

  // Update invitation
  await db
    .update(groupInvitations)
    .set({ status: "denied" })
    .where(eq(groupInvitations.id, invitationId));

  send(ws, "group_invitation_denied", { invitationId }, undefined, requestId);
}

export async function cancelGroupInvitation(
  ws: any,
  userId: string,
  data: any,
  requestId?: string,
) {
  const { invitationId } = data || {};

  if (!invitationId || !isValidUUID(invitationId)) {
    return send(ws, "error", undefined, "Invalid invitation ID", requestId);
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.discordId, userId))
    .limit(1);
  if (!user) return send(ws, "error", undefined, "User not found", requestId);

  const [invitation] = await db
    .select()
    .from(groupInvitations)
    .where(eq(groupInvitations.id, invitationId))
    .limit(1);
  if (!invitation)
    return send(ws, "error", undefined, "Invitation not found", requestId);

  // Validate that the user is the inviter (not the invitee)
  if (invitation.inviterId !== user.id) {
    return send(
      ws,
      "error",
      undefined,
      "Not authorized to cancel this invitation",
      requestId,
    );
  }

  // Validate that the invitation is still pending
  if (invitation.status !== "pending") {
    return send(
      ws,
      "error",
      undefined,
      "Can only cancel pending invitations",
      requestId,
    );
  }

  // Soft delete: update status to 'cancelled'
  await db
    .update(groupInvitations)
    .set({ status: "cancelled", respondedAt: new Date() })
    .where(eq(groupInvitations.id, invitationId));

  send(
    ws,
    "group_invitation_cancelled",
    { invitationId },
    undefined,
    requestId,
  );
}

export async function getGroupInvitations(
  ws: any,
  userId: string,
  requestId?: string,
) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.discordId, userId))
    .limit(1);
  if (!user)
    return send(
      ws,
      "group_invitations",
      { invitations: [] },
      undefined,
      requestId,
    );

  const invites = await db
    .select()
    .from(groupInvitations)
    .where(
      and(
        eq(groupInvitations.inviteeId, user.id),
        eq(groupInvitations.status, "pending"),
      ),
    );

  if (invites.length === 0)
    return send(
      ws,
      "group_invitations",
      { invitations: [] },
      undefined,
      requestId,
    );

  const groupIds = invites.map((i) => i.groupId);
  const inviterIds = invites.map((i) => i.inviterId);

  const groupList = await db
    .select()
    .from(groups)
    .where(inArray(groups.id, groupIds));
  const inviters = await db
    .select()
    .from(users)
    .where(inArray(users.id, inviterIds));

  const result = invites.map((inv) => {
    const group = groupList.find((g) => g.id === inv.groupId);
    const inviter = inviters.find((u) => u.id === inv.inviterId);

    return {
      id: inv.id,
      groupId: inv.groupId,
      groupName: group?.name || null,
      groupAvatar: group?.avatar || null,
      inviterDiscordId: inviter?.discordId || null,
      inviterUsername: inviter?.username || null,
      inviterDisplayName: inviter ? getDisplayName(inviter) : null,
      createdAt: inv.createdAt.toISOString(),
    };
  });

  send(ws, "group_invitations", { invitations: result }, undefined, requestId);
}

export async function getGroupMembers(
  ws: any,
  userId: string,
  data: any,
  requestId?: string,
) {
  const { groupId } = data || {};

  if (!groupId || !isValidUUID(groupId)) {
    return send(ws, "error", undefined, "Invalid group ID", requestId);
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.discordId, userId))
    .limit(1);
  if (!user) return send(ws, "error", undefined, "User not found", requestId);

  // Verify membership
  const [membership] = await db
    .select()
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)),
    )
    .limit(1);

  if (!membership)
    return send(
      ws,
      "error",
      undefined,
      "Not a member of this group",
      requestId,
    );

  // Get all members
  const members = await db
    .select()
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId));
  const userIds = members.map((m) => m.userId);
  const memberUsers = await db
    .select()
    .from(users)
    .where(inArray(users.id, userIds));

  const result = members.map((m) => {
    const u = memberUsers.find((user) => user.id === m.userId);
    return {
      id: m.id,
      groupId: m.groupId,
      userId: m.userId,
      discordId: u?.discordId || "",
      username: u?.username || "Unknown",
      player: u?.player || null,
      usePlayerAsDisplayName: u?.usePlayerAsDisplayName ?? false,
      displayName: u
        ? u.usePlayerAsDisplayName && u.player
          ? u.player
          : u.username
        : "Unknown",
      avatar: u?.avatar || null,
      timeZone: u?.timeZone || null,
      role: m.role,
      canInvite: m.canInvite,
      canRemoveMembers: m.canRemoveMembers,
      canEditGroup: m.canEditGroup,
      joinedAt: m.joinedAt.toISOString(),
      isOnline: userConnections.has(u?.discordId || ""),
    };
  });

  send(ws, "group_members", { members: result }, undefined, requestId);
}

export async function updateGroup(
  ws: any,
  userId: string,
  data: any,
  requestId?: string,
) {
  const { groupId, name, description, avatar, tags, visibility, joinMethod } =
    data || {};

  if (!groupId || !isValidUUID(groupId)) {
    return send(ws, "error", undefined, "Invalid group ID", requestId);
  }

  // Validate field lengths
  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length === 0) {
      return send(
        ws,
        "error",
        undefined,
        "Group name must be a non-empty string",
        requestId,
      );
    }
    if (name.length > 50) {
      return send(
        ws,
        "error",
        undefined,
        "Group name must be 50 characters or less",
        requestId,
      );
    }
  }

  if (description !== undefined && description.length > 500) {
    return send(
      ws,
      "error",
      undefined,
      "Group description must be 500 characters or less",
      requestId,
    );
  }

  if (avatar !== undefined && avatar.length > 500) {
    return send(
      ws,
      "error",
      undefined,
      "Avatar URL must be 500 characters or less",
      requestId,
    );
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.discordId, userId))
    .limit(1);
  if (!user) return send(ws, "error", undefined, "User not found", requestId);

  // Verify the group exists
  const [group] = await db
    .select()
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);
  if (!group) return send(ws, "error", undefined, "Group not found", requestId);

  // Check if user has permission to edit
  const [membership] = await db
    .select()
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)),
    )
    .limit(1);

  if (!membership)
    return send(
      ws,
      "error",
      undefined,
      "You are not a member of this group",
      requestId,
    );

  const isOwner = group.ownerId === user.id;
  const isAdmin = membership.role === "admin";
  const canEditGroup = membership.canEditGroup;

  if (!isOwner && !isAdmin && !canEditGroup) {
    return send(
      ws,
      "error",
      undefined,
      "You do not have permission to edit this group",
      requestId,
    );
  }

  // Build update object with only provided fields
  const updateData: any = {};
  if (name !== undefined) updateData.name = name.trim();
  if (description !== undefined) updateData.description = description;
  if (avatar !== undefined) updateData.avatar = avatar;
  if (tags !== undefined)
    updateData.tags =
      tags && Array.isArray(tags) && tags.length > 0 ? tags : null;
  if (
    visibility !== undefined &&
    ["private", "discoverable"].includes(visibility)
  )
    updateData.visibility = visibility;
  if (joinMethod !== undefined && ["open", "request"].includes(joinMethod))
    updateData.joinMethod = joinMethod;

  // Update the group
  const [updatedGroup] = await db
    .update(groups)
    .set(updateData)
    .where(eq(groups.id, groupId))
    .returning();

  send(ws, "response", updatedGroup, undefined, requestId);

  // Broadcast to all group members
  const members = await db
    .select()
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId));
  const discordIds = (
    await db
      .select()
      .from(users)
      .where(
        inArray(
          users.id,
          members.map((m) => m.userId),
        ),
      )
  )
    .map((u) => u.discordId)
    .filter((id) => id !== userId);

  broadcast(discordIds, "group_updated", {
    groupId,
    group: updatedGroup,
  });
}

export async function deleteGroup(
  ws: any,
  userId: string,
  data: any,
  requestId?: string,
) {
  const { groupId } = data || {};

  if (!groupId || !isValidUUID(groupId)) {
    return send(ws, "error", undefined, "Invalid group ID", requestId);
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.discordId, userId))
    .limit(1);
  if (!user) return send(ws, "error", undefined, "User not found", requestId);

  const [group] = await db
    .select()
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);
  if (!group) return send(ws, "error", undefined, "Group not found", requestId);

  // Only owner can delete
  if (group.ownerId !== user.id) {
    return send(
      ws,
      "error",
      undefined,
      "Only the group owner can delete the group",
      requestId,
    );
  }

  // Get all members for notification
  const members = await db
    .select()
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId));
  const memberUserIds = members.map((m) => m.userId);

  // Delete in transaction
  await db.transaction(async (tx) => {
    await tx
      .delete(groupInvitations)
      .where(eq(groupInvitations.groupId, groupId));
    await tx.delete(groupMembers).where(eq(groupMembers.groupId, groupId));
    await tx.delete(groups).where(eq(groups.id, groupId));
  });

  send(ws, "response", { success: true }, undefined, requestId);

  // Notify all former members
  const discordIds = (
    await db.select().from(users).where(inArray(users.id, memberUserIds))
  ).map((u) => u.discordId);

  broadcast(discordIds, "group_deleted", { groupId });
}

export async function leaveGroup(
  ws: any,
  userId: string,
  data: any,
  requestId?: string,
) {
  const { groupId } = data || {};

  if (!groupId || !isValidUUID(groupId)) {
    return send(ws, "error", undefined, "Invalid group ID", requestId);
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.discordId, userId))
    .limit(1);
  if (!user) return send(ws, "error", undefined, "User not found", requestId);

  const [group] = await db
    .select()
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);
  if (!group) return send(ws, "error", undefined, "Group not found", requestId);

  // Check if user is a member
  const [membership] = await db
    .select()
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)),
    )
    .limit(1);

  if (!membership)
    return send(
      ws,
      "error",
      undefined,
      "You are not a member of this group",
      requestId,
    );

  // Owners cannot leave - they must transfer ownership or delete the group
  if (group.ownerId === user.id) {
    return send(
      ws,
      "error",
      undefined,
      "Group owners cannot leave. Transfer ownership or delete the group instead",
      requestId,
    );
  }

  // Remove the member
  await db.delete(groupMembers).where(eq(groupMembers.id, membership.id));

  send(ws, "response", { success: true }, undefined, requestId);

  // Notify remaining group members
  const members = await db
    .select()
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId));
  const discordIds = (
    await db
      .select()
      .from(users)
      .where(
        inArray(
          users.id,
          members.map((m) => m.userId),
        ),
      )
  ).map((u) => u.discordId);

  broadcast(discordIds, "member_left_group", {
    groupId,
    userId: user.discordId,
    username: user.username,
  });
}

export async function updateMemberRole(
  ws: any,
  userId: string,
  data: any,
  requestId?: string,
) {
  const { groupId, memberId, role } = data || {};

  if (!groupId || !isValidUUID(groupId)) {
    return send(ws, "error", undefined, "Invalid group ID", requestId);
  }

  if (!memberId || !isValidUUID(memberId)) {
    return send(ws, "error", undefined, "Invalid member ID", requestId);
  }

  if (!role || !["member", "admin"].includes(role)) {
    return send(
      ws,
      "error",
      undefined,
      'Invalid role. Must be "member" or "admin"',
      requestId,
    );
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.discordId, userId))
    .limit(1);
  if (!user) return send(ws, "error", undefined, "User not found", requestId);

  const [group] = await db
    .select()
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);
  if (!group) return send(ws, "error", undefined, "Group not found", requestId);

  // Only the owner can change roles
  if (group.ownerId !== user.id) {
    return send(
      ws,
      "error",
      undefined,
      "Only the group owner can change member roles",
      requestId,
    );
  }

  // Get target member
  const [targetMember] = await db
    .select()
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, memberId)),
    )
    .limit(1);

  if (!targetMember)
    return send(
      ws,
      "error",
      undefined,
      "Member not found in this group",
      requestId,
    );

  // Cannot change the owner's role
  if (targetMember.role === "owner") {
    return send(
      ws,
      "error",
      undefined,
      "Cannot change the owner's role",
      requestId,
    );
  }

  // Update the role and permissions
  const canInvite = role === "admin";
  const canRemoveMembers = role === "admin";
  const canEditGroup = role === "admin";

  await db
    .update(groupMembers)
    .set({ role, canInvite, canRemoveMembers, canEditGroup })
    .where(eq(groupMembers.id, targetMember.id));

  send(ws, "response", { success: true }, undefined, requestId);

  // Notify all group members
  const members = await db
    .select()
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId));
  const discordIds = (
    await db
      .select()
      .from(users)
      .where(
        inArray(
          users.id,
          members.map((m) => m.userId),
        ),
      )
  ).map((u) => u.discordId);

  broadcast(discordIds, "member_role_updated", {
    groupId,
    memberId,
    role,
  });
}

export async function removeMemberFromGroup(
  ws: any,
  userId: string,
  data: any,
  requestId?: string,
) {
  const { groupId, memberId } = data || {};

  if (!groupId || !isValidUUID(groupId)) {
    return send(ws, "error", undefined, "Invalid group ID", requestId);
  }

  if (!memberId || !isValidUUID(memberId)) {
    return send(ws, "error", undefined, "Invalid member ID", requestId);
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.discordId, userId))
    .limit(1);
  if (!user) return send(ws, "error", undefined, "User not found", requestId);

  const [group] = await db
    .select()
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);
  if (!group) return send(ws, "error", undefined, "Group not found", requestId);

  // Check if requester has permission
  const [requesterMembership] = await db
    .select()
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)),
    )
    .limit(1);

  if (!requesterMembership) {
    return send(
      ws,
      "error",
      undefined,
      "You are not a member of this group",
      requestId,
    );
  }

  const isOwner = group.ownerId === user.id;
  const canRemove = requesterMembership.canRemoveMembers;

  if (!isOwner && !canRemove) {
    return send(
      ws,
      "error",
      undefined,
      "You do not have permission to remove members",
      requestId,
    );
  }

  // Get target member
  const [targetMember] = await db
    .select()
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, memberId)),
    )
    .limit(1);

  if (!targetMember)
    return send(
      ws,
      "error",
      undefined,
      "Member not found in this group",
      requestId,
    );

  // Cannot remove the owner
  if (targetMember.role === "owner") {
    return send(
      ws,
      "error",
      undefined,
      "Cannot remove the group owner",
      requestId,
    );
  }

  // Admins can only remove regular members, not other admins (unless requester is owner)
  if (targetMember.role === "admin" && !isOwner) {
    return send(
      ws,
      "error",
      undefined,
      "Only the owner can remove admins",
      requestId,
    );
  }

  // Remove the member
  await db.delete(groupMembers).where(eq(groupMembers.id, targetMember.id));

  send(ws, "response", { success: true }, undefined, requestId);

  // Get target user for notification
  const [targetUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, memberId))
    .limit(1);

  // Notify all group members (including the removed member)
  const members = await db
    .select()
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId));
  const discordIds = (
    await db
      .select()
      .from(users)
      .where(
        inArray(
          users.id,
          members.map((m) => m.userId),
        ),
      )
  ).map((u) => u.discordId);

  if (targetUser) {
    discordIds.push(targetUser.discordId);
  }

  broadcast(discordIds, "member_removed_from_group", {
    groupId,
    memberId,
    userId: targetUser?.discordId,
    username: targetUser?.username,
  });
}
