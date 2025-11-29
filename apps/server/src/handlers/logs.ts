/**
 * Log broadcasting handlers
 */

import { eq, and, or, inArray } from "drizzle-orm";
import { db, users, friends, groupMembers } from "../lib/db";
import {
  send,
  broadcast,
  compressLogs,
  decompressLogs,
  shouldCompress,
  isValidUUID,
} from "../lib/utils";
import { clients } from "../lib/state";
import { broadcastToDemo } from "../websocket/demo-handler";

export async function sendLogs(
  ws: any,
  userId: string,
  data: any,
  requestId?: string,
) {
  const { logs, target, compressed, compressedData } = data || {};

  if (!target || !target.type) {
    return send(ws, "error", undefined, "Invalid target", requestId);
  }

  let parsedLogs = logs;

  // Handle compression
  if (compressed && compressedData) {
    try {
      parsedLogs = decompressLogs(compressedData);
    } catch (e) {
      return send(
        ws,
        "error",
        undefined,
        "Failed to decompress logs",
        requestId,
      );
    }
  }

  if (!Array.isArray(parsedLogs) || parsedLogs.length === 0) {
    return send(ws, "error", undefined, "No logs provided", requestId);
  }

  // Handle public logs (demo/mock player) - bypass database lookup
  if (target.type === "public" && userId === "mock-player-demo") {
    broadcastToDemo(parsedLogs, userId);
    return send(
      ws,
      "logs_sent",
      { count: parsedLogs.length, recipients: 0, public: true },
      undefined,
      requestId,
    );
  }

  const [sender] = await db
    .select()
    .from(users)
    .where(eq(users.discordId, userId))
    .limit(1);
  if (!sender) return send(ws, "error", undefined, "User not found", requestId);

  // Handle friend logs (both 'friend' with specific discordId and 'friends' for all friends)
  if (target.type === "friend" || target.type === "friends") {
    let friendDiscordIds: string[];

    if (target.type === "friend") {
      // Specific friend targeting - validate discordId and verify friendship
      if (!target.discordId) {
        return send(
          ws,
          "error",
          undefined,
          "discordId required for friend target",
          requestId,
        );
      }

      // Verify friendship exists
      const [targetUser] = await db
        .select()
        .from(users)
        .where(eq(users.discordId, target.discordId))
        .limit(1);
      if (!targetUser) {
        return send(ws, "error", undefined, "Target user not found", requestId);
      }

      const [friendship] = await db
        .select()
        .from(friends)
        .where(
          and(
            or(
              and(
                eq(friends.userId, sender.id),
                eq(friends.friendId, targetUser.id),
              ),
              and(
                eq(friends.userId, targetUser.id),
                eq(friends.friendId, sender.id),
              ),
            ),
            eq(friends.status, "accepted"),
          ),
        )
        .limit(1);

      if (!friendship) {
        return send(
          ws,
          "error",
          undefined,
          "You are not friends with this user",
          requestId,
        );
      }

      friendDiscordIds = [target.discordId];
    } else {
      // Broadcast to all friends
      const friendships = await db
        .select()
        .from(friends)
        .where(
          and(
            or(eq(friends.userId, sender.id), eq(friends.friendId, sender.id)),
            eq(friends.status, "accepted"),
          ),
        );

      const friendIds = friendships.map((f) =>
        f.userId === sender.id ? f.friendId : f.userId,
      );
      // Include sender for self-broadcasting (enables multi-device viewing)
      friendIds.push(sender.id);

      // Fetch all users (friends + sender)
      const allUserIds = [...new Set(friendIds)]; // Deduplicate
      const friendUsers =
        allUserIds.length > 0
          ? await db.select().from(users).where(inArray(users.id, allUserIds))
          : [];
      friendDiscordIds = friendUsers.map((f) => f.discordId);
    }

    // Prepare message
    const shouldCompr = shouldCompress(parsedLogs);
    const message: any = {
      type: "log_received",
      data: {
        senderDiscordId: userId,
        fromUsername: sender.username,
        target: target,
      },
    };

    if (shouldCompr) {
      message.data.compressed = true;
      message.data.compressedData = compressLogs(parsedLogs);
      message.data.originalSize = JSON.stringify(parsedLogs).length;
      message.data.compressedSize = message.data.compressedData.length;
    } else {
      message.data.logs = parsedLogs;
    }

    // Broadcast to friends
    let sent = 0;
    for (const friendDiscordId of friendDiscordIds) {
      sent += broadcast([friendDiscordId], message.type, message.data);
    }

    // Additionally broadcast to demo subscribers if sender is mock player
    if (userId === "mock-player-demo") {
      broadcastToDemo(parsedLogs, userId);
    }

    return send(
      ws,
      "logs_sent",
      { count: parsedLogs.length, recipients: sent },
      undefined,
      requestId,
    );
  }

  // Handle group logs
  if (target.type === "group") {
    const { groupId } = target;

    if (!groupId || !isValidUUID(groupId)) {
      return send(ws, "error", undefined, "Invalid group ID", requestId);
    }

    // Verify membership
    const [membership] = await db
      .select()
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, sender.id),
        ),
      )
      .limit(1);

    if (!membership) {
      return send(
        ws,
        "error",
        undefined,
        "Not a member of this group",
        requestId,
      );
    }

    // Get all group members (exclude sender)
    const members = await db
      .select()
      .from(groupMembers)
      .where(eq(groupMembers.groupId, groupId));
    const memberUserIds = members
      .filter((m) => m.userId !== sender.id)
      .map((m) => m.userId);
    const memberUsers = await db
      .select()
      .from(users)
      .where(inArray(users.id, memberUserIds));
    const memberDiscordIds = memberUsers.map((u) => u.discordId);

    // Prepare message
    const shouldCompr = shouldCompress(parsedLogs);
    const message: any = {
      type: "group_logs_received",
      data: {
        fromDiscordId: userId,
        fromUsername: sender.username,
        groupId,
        target: { type: "group", groupId },
      },
    };

    if (shouldCompr) {
      message.data.compressed = true;
      message.data.compressedData = compressLogs(parsedLogs);
      message.data.originalSize = JSON.stringify(parsedLogs).length;
      message.data.compressedSize = message.data.compressedData.length;
    } else {
      message.data.logs = parsedLogs;
    }

    // Broadcast to group members via topic (more efficient)
    const topic = `group:${groupId}`;
    let sent = 0;

    for (const [connId, client] of clients.entries()) {
      if (
        client.userId !== userId &&
        memberDiscordIds.includes(client.userId)
      ) {
        try {
          client.ws.send(
            JSON.stringify({
              ...message,
              timestamp: new Date().toISOString(),
            }),
          );
          sent++;
        } catch (e) {
          console.error(`Error sending to ${client.userId}:`, e);
        }
      }
    }

    // Additionally broadcast to demo subscribers if sender is mock player
    if (userId === "mock-player-demo") {
      broadcastToDemo(parsedLogs, userId);
    }

    return send(
      ws,
      "logs_sent",
      { count: parsedLogs.length, recipients: sent, groupId },
      undefined,
      requestId,
    );
  }

  return send(ws, "error", undefined, "Invalid target type", requestId);
}

/**
 * Batch logs to friends - sends logs to friends with batch_logs_received message type
 */
export async function batchLogs(
  ws: any,
  userId: string,
  data: any,
  requestId?: string,
) {
  const { logs, target, compressed, compressedData } = data || {};

  let parsedLogs = logs;

  // Handle compression
  if (compressed && compressedData) {
    try {
      parsedLogs = decompressLogs(compressedData);
    } catch (e) {
      return send(
        ws,
        "error",
        undefined,
        "Failed to decompress logs",
        requestId,
      );
    }
  }

  if (!Array.isArray(parsedLogs) || parsedLogs.length === 0) {
    return send(ws, "error", undefined, "No logs provided", requestId);
  }

  const [sender] = await db
    .select()
    .from(users)
    .where(eq(users.discordId, userId))
    .limit(1);
  if (!sender) return send(ws, "error", undefined, "User not found", requestId);

  // Determine target (default to 'friends' if not specified, or use provided target)
  const resolvedTarget = target || { type: "friends" };

  // Handle friend logs (both 'friend' with specific discordId and 'friends' for all friends)
  if (resolvedTarget.type === "friend" || resolvedTarget.type === "friends") {
    let friendDiscordIds: string[];

    if (resolvedTarget.type === "friend") {
      // Specific friend targeting - validate discordId and verify friendship
      if (!resolvedTarget.discordId) {
        return send(
          ws,
          "error",
          undefined,
          "discordId required for friend target",
          requestId,
        );
      }

      // Verify friendship exists
      const [targetUser] = await db
        .select()
        .from(users)
        .where(eq(users.discordId, resolvedTarget.discordId))
        .limit(1);
      if (!targetUser) {
        return send(ws, "error", undefined, "Target user not found", requestId);
      }

      const [friendship] = await db
        .select()
        .from(friends)
        .where(
          and(
            or(
              and(
                eq(friends.userId, sender.id),
                eq(friends.friendId, targetUser.id),
              ),
              and(
                eq(friends.userId, targetUser.id),
                eq(friends.friendId, sender.id),
              ),
            ),
            eq(friends.status, "accepted"),
          ),
        )
        .limit(1);

      if (!friendship) {
        return send(
          ws,
          "error",
          undefined,
          "You are not friends with this user",
          requestId,
        );
      }

      friendDiscordIds = [resolvedTarget.discordId];
    } else {
      // Broadcast to all friends
      const friendships = await db
        .select()
        .from(friends)
        .where(
          and(
            or(eq(friends.userId, sender.id), eq(friends.friendId, sender.id)),
            eq(friends.status, "accepted"),
          ),
        );

      const friendIds = friendships.map((f) =>
        f.userId === sender.id ? f.friendId : f.userId,
      );
      // Include sender for self-broadcasting (enables multi-device viewing)
      friendIds.push(sender.id);

      // Fetch all users (friends + sender)
      const allUserIds = [...new Set(friendIds)]; // Deduplicate
      const friendUsers =
        allUserIds.length > 0
          ? await db.select().from(users).where(inArray(users.id, allUserIds))
          : [];
      friendDiscordIds = friendUsers.map((f) => f.discordId);
    }

    // Prepare message with batch_logs_received type
    const shouldCompr = shouldCompress(parsedLogs);
    const message: any = {
      type: "batch_logs_received",
      data: {
        senderDiscordId: userId,
        fromUsername: sender.username,
        target: resolvedTarget,
      },
    };

    if (shouldCompr) {
      message.data.compressed = true;
      message.data.compressedData = compressLogs(parsedLogs);
      message.data.originalSize = JSON.stringify(parsedLogs).length;
      message.data.compressedSize = message.data.compressedData.length;
    } else {
      message.data.logs = parsedLogs;
    }

    // Broadcast to friends
    let sent = 0;
    for (const friendDiscordId of friendDiscordIds) {
      sent += broadcast([friendDiscordId], message.type, message.data);
    }

    console.log(
      `[Broadcast] Batch logs from ${userId}: found ${friendDiscordIds.length} recipients, sent to ${sent} connections`,
    );
    if (friendDiscordIds.length > 0 && sent === 0) {
      console.warn(
        `[Broadcast] WARNING: Found ${friendDiscordIds.length} recipients but sent to 0 connections - recipients may be offline`,
      );
    }

    // Additionally broadcast to demo subscribers if sender is mock player
    if (userId === "mock-player-demo") {
      broadcastToDemo(parsedLogs, userId);
    }

    return send(
      ws,
      "logs_sent",
      { count: parsedLogs.length, recipients: sent },
      undefined,
      requestId,
    );
  }

  // Handle group logs
  if (resolvedTarget.type === "group") {
    const { groupId } = resolvedTarget;

    if (!groupId || !isValidUUID(groupId)) {
      return send(ws, "error", undefined, "Invalid group ID", requestId);
    }

    // Verify membership
    const [membership] = await db
      .select()
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, sender.id),
        ),
      )
      .limit(1);

    if (!membership) {
      return send(
        ws,
        "error",
        undefined,
        "Not a member of this group",
        requestId,
      );
    }

    // Get all group members (exclude sender)
    const members = await db
      .select()
      .from(groupMembers)
      .where(eq(groupMembers.groupId, groupId));
    const memberUserIds = members
      .filter((m) => m.userId !== sender.id)
      .map((m) => m.userId);
    const memberUsers = await db
      .select()
      .from(users)
      .where(inArray(users.id, memberUserIds));
    const memberDiscordIds = memberUsers.map((u) => u.discordId);

    // Prepare message with batch_logs_received type
    const shouldCompr = shouldCompress(parsedLogs);
    const message: any = {
      type: "batch_logs_received",
      data: {
        senderDiscordId: userId,
        fromUsername: sender.username,
        groupId,
        target: { type: "group", groupId },
      },
    };

    if (shouldCompr) {
      message.data.compressed = true;
      message.data.compressedData = compressLogs(parsedLogs);
      message.data.originalSize = JSON.stringify(parsedLogs).length;
      message.data.compressedSize = message.data.compressedData.length;
    } else {
      message.data.logs = parsedLogs;
    }

    // Broadcast to group members via topic (more efficient)
    let sent = 0;

    for (const [connId, client] of clients.entries()) {
      if (
        client.userId !== userId &&
        memberDiscordIds.includes(client.userId)
      ) {
        try {
          client.ws.send(
            JSON.stringify({
              ...message,
              timestamp: new Date().toISOString(),
            }),
          );
          sent++;
        } catch (e) {
          console.error(`Error sending to ${client.userId}:`, e);
        }
      }
    }

    // Additionally broadcast to demo subscribers if sender is mock player
    if (userId === "mock-player-demo") {
      broadcastToDemo(parsedLogs, userId);
    }

    return send(
      ws,
      "logs_sent",
      { count: parsedLogs.length, recipients: sent, groupId },
      undefined,
      requestId,
    );
  }

  return send(ws, "error", undefined, "Invalid target type", requestId);
}

/**
 * Batch logs to group - wrapper for sendLogs with group target
 */
export async function batchGroupLogs(
  ws: any,
  userId: string,
  data: any,
  requestId?: string,
) {
  const { groupId, ...rest } = data;
  return sendLogs(
    ws,
    userId,
    {
      ...rest,
      target: { type: "group", groupId },
    },
    requestId,
  );
}
