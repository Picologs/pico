/**
 * Notification Types
 *
 * Notification types for user notifications with full history tracking.
 * Supports friend requests, group invitations, system notifications, and activity updates.
 *
 * @module types/core/notification
 */

/**
 * Notification type enum
 */
export type NotificationType =
  | "friend_request"
  | "group_invitation"
  | "system"
  | "activity";

/**
 * Base notification interface
 */
export interface Notification {
  /** Notification ID (UUID) */
  id: string;

  /** User ID this notification belongs to (UUID) */
  userId: string;

  /** Notification type */
  type: NotificationType;

  /** Notification title */
  title: string;

  /** Notification message */
  message: string;

  /** Type-specific notification data */
  data: NotificationData;

  /** Whether notification has been read */
  read: boolean;

  /** Notification creation timestamp (ISO 8601) */
  createdAt: string;

  /** Notification read timestamp (ISO 8601, null if unread) */
  readAt: string | null;
}

/**
 * Union type for notification-specific data
 */
export type NotificationData =
  | FriendRequestNotificationData
  | GroupInvitationNotificationData
  | SystemNotificationData
  | ActivityNotificationData;

/**
 * Friend request notification data
 */
export interface FriendRequestNotificationData {
  type: "friend_request";
  /** Friendship ID */
  friendshipId: string;
  /** Requester's user ID */
  fromUserId: string;
  /** Requester's Discord ID */
  fromDiscordId: string;
  /** Requester's username */
  fromUsername: string;
  /** Requester's display name */
  fromDisplayName: string;
  /** Requester's avatar */
  fromAvatar: string | null;
  /** Requester's player name */
  fromPlayer: string | null;
}

/**
 * Group invitation notification data
 */
export interface GroupInvitationNotificationData {
  type: "group_invitation";
  /** Group invitation ID */
  invitationId: string;
  /** Group ID */
  groupId: string;
  /** Group name */
  groupName: string;
  /** Group avatar */
  groupAvatar: string | null;
  /** Inviter's user ID */
  inviterId: string;
  /** Inviter's username */
  inviterUsername: string;
  /** Inviter's display name */
  inviterDisplayName: string;
  /** Inviter's avatar */
  inviterAvatar: string | null;
}

/**
 * System notification data
 */
export interface SystemNotificationData {
  type: "system";
  /** System notification category */
  category: "announcement" | "maintenance" | "update" | "warning";
  /** Optional action URL */
  actionUrl?: string;
  /** Optional action label */
  actionLabel?: string;
}

/**
 * Activity notification data
 */
export interface ActivityNotificationData {
  type: "activity";
  /** Activity type */
  activityType:
    | "friend_online"
    | "friend_offline"
    | "friend_joined_group"
    | "friend_left_group"
    | "group_member_joined"
    | "group_member_left";
  /** Related user ID (if applicable) */
  relatedUserId?: string;
  /** Related user username */
  relatedUsername?: string;
  /** Related user display name */
  relatedDisplayName?: string;
  /** Related group ID (if applicable) */
  relatedGroupId?: string;
  /** Related group name */
  relatedGroupName?: string;
}

/**
 * Create notification request
 */
export interface CreateNotificationData {
  /** User ID to send notification to */
  userId: string;
  /** Notification type */
  type: NotificationType;
  /** Notification title */
  title: string;
  /** Notification message */
  message: string;
  /** Notification data */
  data: NotificationData;
}

/**
 * Get notifications request
 */
export interface GetNotificationsRequest {
  /** Page number (1-indexed) */
  page?: number;
  /** Number of notifications per page */
  perPage?: number;
  /** Filter by read/unread status */
  unreadOnly?: boolean;
  /** Filter by notification type */
  type?: NotificationType;
}

/**
 * Get notifications response
 */
export interface GetNotificationsResponse {
  /** Array of notifications */
  notifications: Notification[];
  /** Pagination metadata */
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Mark notification as read request
 */
export interface MarkNotificationReadRequest {
  /** Notification ID to mark as read */
  notificationId: string;
}

/**
 * Mark all notifications as read request
 */
export interface MarkAllNotificationsReadRequest {
  /** Optional: Only mark notifications of this type */
  type?: NotificationType;
}
