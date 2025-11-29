/**
 * User profile handlers
 */

import { eq, or, and, inArray } from "drizzle-orm";
import {
  db,
  users,
  friends,
  groupMembers,
  groupInvitations,
  groups,
} from "../lib/db";
import { send } from "../lib/utils";
import { getDisplayName } from "../utils/display-name";
import { broadcastToUsers } from "../services/broadcast";

export async function getUserProfile(
  ws: any,
  userId: string,
  data: any,
  requestId?: string,
) {
  const targetUserId = data?.userId || userId;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.discordId, targetUserId))
    .limit(1);

  if (!user) {
    return send(ws, "error", undefined, "User not found", requestId);
  }

  send(
    ws,
    "user_profile",
    {
      id: user.id,
      discordId: user.discordId,
      username: user.username,
      avatar: user.avatar,
      player: user.player,
      timeZone: user.timeZone,
      showTimezone: user.showTimezone,
      usePlayerAsDisplayName: user.usePlayerAsDisplayName,
      friendCode: user.friendCode,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    },
    undefined,
    requestId,
  );
}

export async function updateUserProfile(
  ws: any,
  userId: string,
  data: any,
  requestId?: string,
) {
  const { player, timeZone, usePlayerAsDisplayName, showTimezone } = data || {};

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.discordId, userId))
    .limit(1);
  if (!user) return send(ws, "error", undefined, "User not found", requestId);

  // Store original player name for change detection
  const originalPlayer = user.player;

  const updates: any = {};
  // Normalize player name (trim whitespace)
  if (player !== undefined) updates.player = player?.trim() || null;
  if (timeZone !== undefined) updates.timeZone = timeZone;
  if (usePlayerAsDisplayName !== undefined)
    updates.usePlayerAsDisplayName = usePlayerAsDisplayName;
  if (showTimezone !== undefined) updates.showTimezone = showTimezone;

  if (Object.keys(updates).length === 0) {
    return send(ws, "error", undefined, "No updates provided", requestId);
  }

  const [updated] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, user.id))
    .returning();

  send(
    ws,
    "user_profile_updated",
    {
      id: updated.id,
      discordId: updated.discordId,
      username: updated.username,
      avatar: updated.avatar,
      player: updated.player,
      timeZone: updated.timeZone,
      showTimezone: updated.showTimezone,
      usePlayerAsDisplayName: updated.usePlayerAsDisplayName,
      friendCode: updated.friendCode,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      playerChanged: originalPlayer !== updated.player,
    },
    undefined,
    requestId,
  );

  // Broadcast profile update to all friends
  const friendships = await db
    .select({ friendId: friends.friendId, userId: friends.userId })
    .from(friends)
    .where(
      and(
        or(eq(friends.userId, user.id), eq(friends.friendId, user.id)),
        eq(friends.status, "accepted"),
      ),
    );

  if (friendships.length > 0) {
    // Extract friend Discord IDs (the other user in each friendship)
    const friendUserIds = friendships.map((f) =>
      f.userId === user.id ? f.friendId : f.userId,
    );

    // Fetch friend Discord IDs
    const friendUsers = await db
      .select({ discordId: users.discordId })
      .from(users)
      .where(inArray(users.id, friendUserIds));

    const friendDiscordIds = friendUsers.map((u) => u.discordId);

    if (friendDiscordIds.length > 0) {
      broadcastToUsers(friendDiscordIds, "friend_profile_updated", {
        discordId: updated.discordId,
        player: updated.player,
        username: updated.username,
        avatar: updated.avatar,
        usePlayerAsDisplayName: updated.usePlayerAsDisplayName,
        displayName: getDisplayName(updated),
        timeZone: updated.showTimezone !== false ? updated.timeZone : null,
        showTimezone: updated.showTimezone ?? true,
      });
    }
  }

  // Broadcast profile update to all group members
  const userGroupMemberships = await db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .where(eq(groupMembers.userId, user.id));

  if (userGroupMemberships.length > 0) {
    const groupIds = userGroupMemberships.map((m) => m.groupId);

    // Get all members from these groups (excluding the current user)
    const groupMembersList = await db
      .select({ userId: groupMembers.userId })
      .from(groupMembers)
      .where(
        and(
          inArray(groupMembers.groupId, groupIds),
          // Exclude the current user to avoid sending update to themselves
          // User already received their own update via user_profile_updated
          // Not a perfect exclusion since we need to compare against user.id,
          // but the broadcast will filter by discordId anyway
        ),
      );

    if (groupMembersList.length > 0) {
      const memberUserIds = groupMembersList.map((m) => m.userId);

      // Fetch member Discord IDs
      const memberUsers = await db
        .select({ discordId: users.discordId })
        .from(users)
        .where(
          and(
            inArray(users.id, memberUserIds),
            // Exclude the current user from receiving duplicate broadcasts
            // They already received user_profile_updated on line 55
            // This prevents sending the same update twice
            // (once as user_profile_updated, once as group_member_profile_updated)
          ),
        );

      const memberDiscordIds = memberUsers
        .map((u) => u.discordId)
        .filter((id) => id !== updated.discordId); // Final filter to exclude self

      if (memberDiscordIds.length > 0) {
        broadcastToUsers(memberDiscordIds, "group_member_profile_updated", {
          discordId: updated.discordId,
          player: updated.player,
          username: updated.username,
          avatar: updated.avatar,
          usePlayerAsDisplayName: updated.usePlayerAsDisplayName,
          displayName: getDisplayName(updated),
          timeZone: updated.showTimezone !== false ? updated.timeZone : null,
          showTimezone: updated.showTimezone ?? true,
        });
      }
    }
  }
}

export async function deleteUserProfile(
  ws: any,
  userId: string,
  data: any,
  requestId?: string,
) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.discordId, userId))
    .limit(1);
  if (!user) return send(ws, "error", undefined, "User not found", requestId);

  try {
    // Wrap all deletes in a transaction to ensure atomicity
    await db.transaction(async (tx) => {
      // Delete user's friends (both directions)
      await tx
        .delete(friends)
        .where(or(eq(friends.userId, user.id), eq(friends.friendId, user.id)));

      // Delete user's group memberships
      await tx.delete(groupMembers).where(eq(groupMembers.userId, user.id));

      // Delete user's group invitations (both as inviter and invitee)
      await tx
        .delete(groupInvitations)
        .where(
          or(
            eq(groupInvitations.inviterId, user.id),
            eq(groupInvitations.inviteeId, user.id),
          ),
        );

      // Delete groups owned by user
      await tx.delete(groups).where(eq(groups.ownerId, user.id));

      // Delete user (must be last due to foreign key constraints)
      await tx.delete(users).where(eq(users.id, user.id));
    });

    send(
      ws,
      "user_profile_deleted",
      { data: { success: true } },
      undefined,
      requestId,
    );
  } catch (error) {
    console.error("Error deleting user profile:", error);
    send(ws, "error", undefined, "Failed to delete profile", requestId);
  }
}
