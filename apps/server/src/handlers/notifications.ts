/**
 * Notification-related message handlers
 */

import { eq, and, desc, sql } from "drizzle-orm";
import { db, users, notifications } from "../lib/db";
import { send } from "../lib/utils";
import type {
  Notification,
  GetNotificationsRequest,
  GetNotificationsResponse,
  MarkNotificationReadRequest,
  MarkAllNotificationsReadRequest,
} from "@pico/types";

/**
 * Get notifications for the current user
 */
export async function getNotifications(
  ws: any,
  userId: string,
  data: GetNotificationsRequest,
) {
  const page = data?.page ?? 1;
  const perPage = Math.min(data?.perPage ?? 20, 100);
  const unreadOnly = data?.unreadOnly ?? false;
  const type = data?.type;

  if (page < 1 || perPage < 1) {
    return send(ws, "error", undefined, "Invalid pagination parameters");
  }

  // Get user
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.discordId, userId))
    .limit(1);
  if (!user) {
    return send(ws, "error", undefined, "User not found");
  }

  // Build where clause
  let whereClause = eq(notifications.userId, user.id);
  if (unreadOnly) {
    whereClause = and(whereClause, eq(notifications.read, false)) as any;
  }
  if (type) {
    whereClause = and(whereClause, eq(notifications.type, type)) as any;
  }

  // Get total count
  const [{ count: total }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(whereClause);

  const totalPages = Math.ceil(total / perPage);
  const offset = (page - 1) * perPage;

  // Get notifications
  const notificationList = await db
    .select()
    .from(notifications)
    .where(whereClause)
    .orderBy(desc(notifications.createdAt))
    .limit(perPage)
    .offset(offset);

  // Format response
  const formattedNotifications: Notification[] = notificationList.map((n) => ({
    id: n.id,
    userId: n.userId,
    type: n.type as any,
    title: n.title,
    message: n.message,
    data: n.data as any,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
    readAt: n.readAt?.toISOString() || null,
  }));

  const response: GetNotificationsResponse = {
    notifications: formattedNotifications,
    pagination: {
      page,
      perPage,
      total,
      totalPages,
    },
  };

  send(ws, "notifications_list", response);
}

/**
 * Mark a single notification as read
 */
export async function markNotificationRead(
  ws: any,
  userId: string,
  data: MarkNotificationReadRequest,
) {
  const notificationId = data?.notificationId;

  if (!notificationId) {
    return send(ws, "error", undefined, "Notification ID is required");
  }

  // Get user
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.discordId, userId))
    .limit(1);
  if (!user) {
    return send(ws, "error", undefined, "User not found");
  }

  // Verify notification belongs to user and update
  const result = await db
    .update(notifications)
    .set({ read: true, readAt: new Date() })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, user.id),
      ),
    )
    .returning();

  if (result.length === 0) {
    return send(ws, "error", undefined, "Notification not found");
  }

  send(ws, "notification_read", { notificationId, success: true });
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsRead(
  ws: any,
  userId: string,
  data?: MarkAllNotificationsReadRequest,
) {
  const type = data?.type;

  // Get user
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.discordId, userId))
    .limit(1);
  if (!user) {
    return send(ws, "error", undefined, "User not found");
  }

  // Build where clause
  let whereClause = and(
    eq(notifications.userId, user.id),
    eq(notifications.read, false),
  ) as any;
  if (type) {
    whereClause = and(whereClause, eq(notifications.type, type)) as any;
  }

  // Update all unread notifications
  await db
    .update(notifications)
    .set({ read: true, readAt: new Date() })
    .where(whereClause);

  send(ws, "all_notifications_read", { success: true, type });
}
