/**
 * Admin handlers for user management and app settings
 */

import { eq } from "drizzle-orm";
import { db, users, adminSettings, adminAuditLog } from "../lib/db";
import { clients, userConnections } from "../lib/state";
import { send } from "../lib/utils";

/**
 * Verify that the requesting user is an admin
 */
async function verifyAdmin(userId: string): Promise<{ isAdmin: boolean; adminUser: any | null }> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.discordId, userId))
    .limit(1);

  if (!user) {
    return { isAdmin: false, adminUser: null };
  }

  return { isAdmin: user.role === "admin", adminUser: user };
}

/**
 * Disconnect all WebSocket connections for a user
 */
function disconnectUser(discordId: string, reason: string): number {
  const connectionIds = userConnections.get(discordId);
  if (!connectionIds) return 0;

  let disconnected = 0;
  for (const connId of connectionIds) {
    const client = clients.get(connId);
    if (client) {
      try {
        client.ws.close(1008, reason); // 1008 = Policy Violation
        disconnected++;
      } catch (e) {
        console.error(`[Admin] Failed to disconnect connection ${connId}:`, e);
      }
    }
  }
  return disconnected;
}

/**
 * Block a user
 */
export async function blockUser(
  ws: any,
  userId: string,
  data: any,
  requestId?: string
) {
  // Verify admin permissions
  const { isAdmin, adminUser } = await verifyAdmin(userId);
  if (!isAdmin || !adminUser) {
    return send(ws, "error", undefined, "Unauthorized - admin access required", requestId);
  }

  const { targetUserId, reason } = data || {};
  if (!targetUserId) {
    return send(ws, "error", undefined, "Missing targetUserId", requestId);
  }

  // Get target user
  const [targetUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  if (!targetUser) {
    return send(ws, "error", undefined, "User not found", requestId);
  }

  // Prevent self-blocking (check first for more specific error message)
  if (targetUser.discordId === userId) {
    return send(ws, "error", undefined, "Cannot block yourself", requestId);
  }

  // Prevent blocking admins
  if (targetUser.role === "admin") {
    return send(ws, "error", undefined, "Cannot block admin users", requestId);
  }

  // Check if already blocked
  if (targetUser.blockedAt) {
    return send(ws, "error", undefined, "User is already blocked", requestId);
  }

  // Block the user
  const now = new Date();
  await db
    .update(users)
    .set({
      blockedAt: now,
      blockedBy: adminUser.id,
      blockReason: reason || null,
    })
    .where(eq(users.id, targetUserId));

  // Create audit log entry
  await db.insert(adminAuditLog).values({
    action: "user_blocked",
    targetUserId: targetUserId,
    adminUserId: adminUser.id,
    metadata: {
      reason: reason || null,
      targetUsername: targetUser.username,
      targetDiscordId: targetUser.discordId,
    },
  });

  // Disconnect all of the blocked user's WebSocket connections
  const disconnectedCount = disconnectUser(
    targetUser.discordId,
    "Your account has been suspended"
  );

  console.log(`[Admin] User blocked: ${targetUser.username} (${targetUser.discordId}) by ${adminUser.username}. Disconnected ${disconnectedCount} connections.`);

  send(ws, "admin_user_blocked", {
    success: true,
    userId: targetUserId,
    username: targetUser.username,
    disconnectedConnections: disconnectedCount,
  }, undefined, requestId);
}

/**
 * Unblock a user
 */
export async function unblockUser(
  ws: any,
  userId: string,
  data: any,
  requestId?: string
) {
  // Verify admin permissions
  const { isAdmin, adminUser } = await verifyAdmin(userId);
  if (!isAdmin || !adminUser) {
    return send(ws, "error", undefined, "Unauthorized - admin access required", requestId);
  }

  const { targetUserId } = data || {};
  if (!targetUserId) {
    return send(ws, "error", undefined, "Missing targetUserId", requestId);
  }

  // Get target user
  const [targetUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  if (!targetUser) {
    return send(ws, "error", undefined, "User not found", requestId);
  }

  // Check if actually blocked
  if (!targetUser.blockedAt) {
    return send(ws, "error", undefined, "User is not blocked", requestId);
  }

  // Unblock the user
  await db
    .update(users)
    .set({
      blockedAt: null,
      blockedBy: null,
      blockReason: null,
    })
    .where(eq(users.id, targetUserId));

  // Create audit log entry
  await db.insert(adminAuditLog).values({
    action: "user_unblocked",
    targetUserId: targetUserId,
    adminUserId: adminUser.id,
    metadata: {
      targetUsername: targetUser.username,
      targetDiscordId: targetUser.discordId,
      previouslyBlockedBy: targetUser.blockedBy,
      previousBlockReason: targetUser.blockReason,
    },
  });

  console.log(`[Admin] User unblocked: ${targetUser.username} (${targetUser.discordId}) by ${adminUser.username}`);

  send(ws, "admin_user_unblocked", {
    success: true,
    userId: targetUserId,
    username: targetUser.username,
  }, undefined, requestId);
}

/**
 * Toggle signups enabled/disabled
 */
export async function toggleSignups(
  ws: any,
  userId: string,
  data: any,
  requestId?: string
) {
  // Verify admin permissions
  const { isAdmin, adminUser } = await verifyAdmin(userId);
  if (!isAdmin || !adminUser) {
    return send(ws, "error", undefined, "Unauthorized - admin access required", requestId);
  }

  const { enabled } = data || {};
  if (typeof enabled !== "boolean") {
    return send(ws, "error", undefined, "Missing or invalid 'enabled' boolean", requestId);
  }

  // Get current setting for audit log
  const [currentSetting] = await db
    .select()
    .from(adminSettings)
    .where(eq(adminSettings.key, "signups_enabled"))
    .limit(1);

  const previousValue = currentSetting?.value;

  // Upsert the setting
  await db
    .insert(adminSettings)
    .values({
      key: "signups_enabled",
      value: enabled,
      updatedAt: new Date(),
      updatedBy: adminUser.id,
    })
    .onConflictDoUpdate({
      target: adminSettings.key,
      set: {
        value: enabled,
        updatedAt: new Date(),
        updatedBy: adminUser.id,
      },
    });

  // Create audit log entry
  await db.insert(adminAuditLog).values({
    action: "signups_toggled",
    adminUserId: adminUser.id,
    metadata: {
      enabled,
      previousValue,
    },
  });

  console.log(`[Admin] Signups ${enabled ? "enabled" : "disabled"} by ${adminUser.username}`);

  send(ws, "admin_signups_toggled", {
    success: true,
    signupsEnabled: enabled,
  }, undefined, requestId);
}

/**
 * Get admin settings
 */
export async function getAdminSettings(
  ws: any,
  userId: string,
  data: any,
  requestId?: string
) {
  // Verify admin permissions
  const { isAdmin, adminUser } = await verifyAdmin(userId);
  if (!isAdmin || !adminUser) {
    return send(ws, "error", undefined, "Unauthorized - admin access required", requestId);
  }

  // Get all settings
  const settings = await db.select().from(adminSettings);

  // Convert to object
  const settingsObj: Record<string, any> = {};
  for (const s of settings) {
    settingsObj[s.key] = {
      value: s.value,
      updatedAt: s.updatedAt?.toISOString(),
      updatedBy: s.updatedBy,
    };
  }

  // Get recent audit log
  const recentAuditLog = await db
    .select()
    .from(adminAuditLog)
    .orderBy(adminAuditLog.createdAt)
    .limit(20);

  send(ws, "admin_settings", {
    settings: settingsObj,
    signupsEnabled: settingsObj.signups_enabled?.value ?? true,
    recentAuditLog: recentAuditLog.map((log) => ({
      id: log.id,
      action: log.action,
      targetUserId: log.targetUserId,
      adminUserId: log.adminUserId,
      metadata: log.metadata,
      createdAt: log.createdAt.toISOString(),
    })),
  }, undefined, requestId);
}
