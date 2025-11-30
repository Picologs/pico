/**
 * WebSocket connection handlers
 * Manages open, message, and close events
 */

import { eq, or, and, inArray } from "drizzle-orm";
import { db, users, friends, groupMembers } from "../lib/db";
import {
  clients,
  userConnections,
  connectionsPerIp,
  authSessionOwners,
  isLoginBlocked,
  recordFailedLogin,
  clearFailedLogins,
} from "../lib/state";
import {
  verifyToken,
  isValidUserId,
  sanitizeMetadata,
  checkRateLimit,
  send,
  getDisplayName,
  broadcast,
} from "../lib/utils";
import {
  subscribeToDemo,
  unsubscribeFromDemo,
  cleanupDemoSubscriber,
} from "./demo-handler";
import { dispatchMessage } from "./dispatcher";
import { notifyAdmin } from "../services/email";

import type { ServerWebSocket } from "bun";

const MAX_CONNECTIONS_PER_IP = parseInt(
  process.env.MAX_CONNECTIONS_PER_IP || "10",
);

/**
 * Handle WebSocket connection open
 */
export function handleOpen(ws: ServerWebSocket<any>): void {
  const data = ws.data as any;

  // Check IP connection limit
  const ipCount = (connectionsPerIp.get(data.ip) || 0) + 1;
  if (ipCount > MAX_CONNECTIONS_PER_IP) {
    ws.close(1008, "Too many connections from this IP");
    return;
  }
  connectionsPerIp.set(data.ip, ipCount);

  send(ws, "welcome", { connectionId: data.connectionId });

  // Handle demo-only connections (auto-subscribe, no auth required)
  if (data.isDemoOnly) {
    subscribeToDemo(ws, "mock-player-demo");
    send(ws, "demo_subscribed", {
      userId: "mock-player-demo",
      mode: "demo",
      message: "Connected to Picologs demo feed",
    });
    console.log(
      `[Demo] Client auto-subscribed - Connection: ${data.connectionId}, IP: ${data.ip}`,
    );
    return; // Skip registration timeout
  }

  // Set registration timeout (30s)
  data.registrationTimeout = setTimeout(() => {
    if (!data.userId) {
      ws.close(1008, "Registration timeout");
    }
  }, 30000);
}

/**
 * Handle user registration message
 */
async function handleRegistration(
  ws: ServerWebSocket<any>,
  msg: any,
): Promise<void> {
  const data = ws.data as any;

  if (data.registrationTimeout) {
    clearTimeout(data.registrationTimeout);
    data.registrationTimeout = undefined;
  }

  // Check if IP is blocked due to too many failed login attempts
  const loginBlock = isLoginBlocked(data.ip);
  if (loginBlock.blocked) {
    const blockedMinutes = Math.ceil((loginBlock.blockedFor || 0) / 60000);
    ws.close(
      1008,
      `Too many failed login attempts. Try again in ${blockedMinutes} minutes.`,
    );
    return;
  }

  // Auth-only connections use sessionId-based auth
  if (data.authOnly) {
    const sessionId = msg.sessionId;
    if (!sessionId) {
      ws.close(1008, "Missing sessionId");
      return;
    }

    const authUserId = `auth-session-${sessionId}`;
    data.userId = authUserId;
    authSessionOwners.set(sessionId, data.connectionId);

    clients.set(data.connectionId, {
      userId: authUserId,
      ws,
      ip: data.ip,
      metadata: { isAuthOnly: true, sessionId },
    });

    // Store session mapping for CSRF protection during OAuth callback
    authSessionOwners.set(sessionId, data.connectionId);

    if (!userConnections.has(authUserId))
      userConnections.set(authUserId, new Set());
    userConnections.get(authUserId)!.add(data.connectionId);

    setTimeout(() => ws.close(1000, "Auth session expired"), 120000);
    return send(ws, "registered", { userId: authUserId });
  }

  // Normal authentication with JWT
  const { userId, token, metadata, timeZone } = msg;

  if (!userId || !isValidUserId(userId)) {
    recordFailedLogin(data.ip);
    ws.close(1008, "Invalid userId");
    return;
  }

  if (!token) {
    recordFailedLogin(data.ip);
    ws.close(1008, "Missing token");
    return;
  }

  const verified = verifyToken(token);

  if (!verified || verified.userId !== userId) {
    recordFailedLogin(data.ip);
    ws.close(1008, "Invalid token");
    return;
  }

  // Check if user is blocked before completing registration
  try {
    const [user] = await db
      .select({ blockedAt: users.blockedAt })
      .from(users)
      .where(eq(users.discordId, userId))
      .limit(1);

    if (user?.blockedAt) {
      console.warn("[WebSocket] Blocked user attempted connection:", {
        userId,
        blockedAt: user.blockedAt,
        ip: data.ip,
      });
      ws.close(1008, "Your account has been suspended");
      return;
    }
  } catch (e) {
    console.error("[WebSocket] Error checking blocked status:", e);
    // Continue with registration even if blocked check fails
    // Better to allow potentially blocked user than block legitimate users
  }

  // Successful authentication - clear any failed login attempts for this IP
  clearFailedLogins(data.ip);

  data.userId = userId;
  const sanitized = metadata ? sanitizeMetadata(metadata) : {};

  clients.set(data.connectionId, {
    userId,
    ws,
    ip: data.ip,
    metadata: sanitized || {},
  });
  if (!userConnections.has(userId)) userConnections.set(userId, new Set());
  userConnections.get(userId)!.add(data.connectionId);

  ws.subscribe(`user:${userId}`);

  send(ws, "registered", { userId, connectionId: data.connectionId });

  // Skip database operations for mock player (demo feed only)
  if (userId === "mock-player-demo") {
    return;
  }

  // Subscribe to groups and notify friends
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.discordId, userId))
      .limit(1);
    if (user) {
      // Auto-save timezone on every connection
      if (timeZone && typeof timeZone === "string") {
        await db.update(users).set({ timeZone }).where(eq(users.id, user.id));
        user.timeZone = timeZone;
      }

      // Send full user profile immediately after registration
      const userProfile = {
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
      };
      send(ws, "user_profile_updated", userProfile);

      const groups = await db
        .select({ groupId: groupMembers.groupId })
        .from(groupMembers)
        .where(eq(groupMembers.userId, user.id));
      groups.forEach((g) => ws.subscribe(`group:${g.groupId}`));

      // Notify friends/groups of online status (only on first connection)
      const connCount = userConnections.get(userId)?.size || 0;
      if (connCount === 1) {
        // Notify admin of user coming online
        notifyAdmin(
          "User Connected",
          `"${getDisplayName(user)}" (${user.discordId}) came online`,
        );
        // Get friends
        const friendships = await db
          .select()
          .from(friends)
          .where(
            and(
              or(eq(friends.userId, user.id), eq(friends.friendId, user.id)),
              eq(friends.status, "accepted"),
            ),
          );

        const friendIds = friendships.map((f) =>
          f.userId === user.id ? f.friendId : f.userId,
        );
        const friendUsers =
          friendIds.length > 0
            ? await db.select().from(users).where(inArray(users.id, friendIds))
            : [];
        const friendDiscordIds = friendUsers.map((f) => f.discordId);

        broadcast(friendDiscordIds, "user_came_online", {
          discordId: user.discordId,
          username: user.username,
          displayName: getDisplayName(user),
          avatar: user.avatar,
        });

        // Get group members
        const groupIds = groups.map((g) => g.groupId);
        if (groupIds.length > 0) {
          const allMembers = await db
            .select()
            .from(groupMembers)
            .where(inArray(groupMembers.groupId, groupIds));
          const memberIds = [
            ...new Set(allMembers.map((m) => m.userId)),
          ].filter((id) => id !== user.id);
          const memberUsers = await db
            .select()
            .from(users)
            .where(inArray(users.id, memberIds));
          const memberDiscordIds = memberUsers.map((u) => u.discordId);

          broadcast(memberDiscordIds, "user_came_online", {
            discordId: user.discordId,
            username: user.username,
            displayName: getDisplayName(user),
            avatar: user.avatar,
          });
        }
      }
    }
  } catch (e) {
    console.error("Error during registration:", e);
  }
}

/**
 * Handle WebSocket message
 */
export async function handleMessage(
  ws: ServerWebSocket<any>,
  message: string | Buffer,
): Promise<void> {
  const data = ws.data as any;

  // Parse message
  let msg: any;
  try {
    msg = JSON.parse(message.toString());
  } catch {
    ws.close(1002, "Invalid JSON");
    return;
  }

  const type = msg.type;

  // Handle registration (exempt from rate limiting to allow connections)
  if (type === "register") {
    return handleRegistration(ws, msg);
  }

  // Rate limiting for all messages (after registration)
  const rateLimitKey = data.userId || data.ip;
  const limit = data.userId ? 100 : 30;
  if (!checkRateLimit(`ws:${rateLimitKey}`, limit, 60000)) {
    return send(ws, "error", undefined, "Too many messages");
  }

  // Handle ping (no authentication required - used for keepalive and rate limit testing)
  if (type === "ping") {
    return send(ws, "pong");
  }

  // Handle demo subscriptions (no authentication required)
  if (type === "subscribe_demo") {
    const userId = msg.data?.userId || "mock-player-demo";
    subscribeToDemo(ws, userId);
    return send(ws, "demo_subscribed", {
      userId,
      message: "Subscribed to demo logs",
    });
  }

  if (type === "unsubscribe_demo") {
    // Fire and forget - don't block response
    unsubscribeFromDemo(ws).catch((err) =>
      console.error("[Demo] Unsubscribe error:", err),
    );
    return send(ws, "demo_unsubscribed", {
      message: "Unsubscribed from demo logs",
    });
  }

  // All other messages require authentication (except demo-only connections)
  if (!data.userId && !data.isDemoOnly) {
    return send(ws, "error", undefined, "Not authenticated");
  }

  // Demo-only connections can only receive, not send
  if (data.isDemoOnly) {
    return send(ws, "error", undefined, "Demo connections are read-only");
  }

  // Dispatch to handlers
  try {
    await dispatchMessage(ws, data.userId, type, msg.data, msg.requestId);
  } catch (error) {
    console.error(`Error handling ${type}:`, error);
    send(ws, "error", undefined, "Internal server error", msg.requestId);
  }
}

/**
 * Handle WebSocket connection close
 */
export async function handleClose(ws: ServerWebSocket<any>): Promise<void> {
  const data = ws.data as any;

  // Clean up demo subscription
  cleanupDemoSubscriber(ws);

  // Decrement IP connection count
  const ipCount = connectionsPerIp.get(data.ip) || 0;
  if (ipCount <= 1) {
    connectionsPerIp.delete(data.ip);
  } else {
    connectionsPerIp.set(data.ip, ipCount - 1);
  }

  // Clear registration timeout
  if (data.registrationTimeout) {
    clearTimeout(data.registrationTimeout);
  }

  // Clean up client
  if (data.userId) {
    clients.delete(data.connectionId);

    const conns = userConnections.get(data.userId);
    if (conns) {
      conns.delete(data.connectionId);
      if (conns.size === 0) {
        userConnections.delete(data.userId);

        // Notify friends/groups of offline status (only when last connection closes)
        if (!data.authOnly) {
          try {
            const [user] = await db
              .select()
              .from(users)
              .where(eq(users.discordId, data.userId))
              .limit(1);
            if (user) {
              // Notify friends
              const friendships = await db
                .select()
                .from(friends)
                .where(
                  and(
                    or(
                      eq(friends.userId, user.id),
                      eq(friends.friendId, user.id),
                    ),
                    eq(friends.status, "accepted"),
                  ),
                );

              const friendIds = friendships.map((f) =>
                f.userId === user.id ? f.friendId : f.userId,
              );
              const friendUsers =
                friendIds.length > 0
                  ? await db
                      .select()
                      .from(users)
                      .where(inArray(users.id, friendIds))
                  : [];
              const friendDiscordIds = friendUsers.map((f) => f.discordId);

              broadcast(friendDiscordIds, "user_disconnected", {
                discordId: user.discordId,
                username: user.username,
              });

              // Notify group members
              const groups = await db
                .select({ groupId: groupMembers.groupId })
                .from(groupMembers)
                .where(eq(groupMembers.userId, user.id));
              const groupIds = groups.map((g) => g.groupId);

              if (groupIds.length > 0) {
                const allMembers = await db
                  .select()
                  .from(groupMembers)
                  .where(inArray(groupMembers.groupId, groupIds));
                const memberIds = [
                  ...new Set(allMembers.map((m) => m.userId)),
                ].filter((id) => id !== user.id);
                const memberUsers = await db
                  .select()
                  .from(users)
                  .where(inArray(users.id, memberIds));
                const memberDiscordIds = memberUsers.map((u) => u.discordId);

                broadcast(memberDiscordIds, "user_disconnected", {
                  discordId: user.discordId,
                  username: user.username,
                });
              }
            }
          } catch (e) {
            console.error("Error during disconnect notification:", e);
          }
        }
      }
    }
  }
}
