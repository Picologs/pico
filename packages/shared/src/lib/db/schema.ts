/**
 * Database Schema
 *
 * Uses database schema from @pico/shared for type compatibility.
 * Schema tables are defined locally to avoid Drizzle ORM version conflicts in the monorepo.
 *
 * @module lib/db/schema
 */

import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  index,
  unique,
  jsonb,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ============================================================================
// Tables (local definitions to avoid drizzle-orm version conflicts)
// ============================================================================

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    discordId: text("discord_id").notNull().unique(),
    username: text("username").notNull(),
    avatar: text("avatar"),
    player: text("player"),
    timeZone: text("time_zone"),
    showTimezone: boolean("show_timezone").notNull().default(true),
    usePlayerAsDisplayName: boolean("use_player_as_display_name")
      .notNull()
      .default(false),
    friendCode: text("friend_code").notNull().unique(),
    role: text("role").notNull().default("user"), // 'user' | 'admin'
    // Blocking fields
    blockedAt: timestamp("blocked_at"),
    blockedBy: uuid("blocked_by"),
    blockReason: text("block_reason"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    friendCodeIdx: index("users_friend_code_idx").on(table.friendCode),
    friendCodeFormatCheck: check(
      "friend_code_format_check",
      sql`length(friend_code) = 6 AND friend_code ~ '^[A-Z0-9]+$'`,
    ),
  }),
);

export const groups = pgTable(
  "groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    avatar: text("avatar"),
    tags: text("tags").array(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    ownerIdIdx: index("groups_owner_id_idx").on(table.ownerId),
    createdAtIdx: index("groups_created_at_idx").on(table.createdAt),
  }),
);

export const groupMembers = pgTable(
  "group_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"), // 'owner', 'admin', 'member'
    canInvite: boolean("can_invite").notNull().default(false),
    canRemoveMembers: boolean("can_remove_members").notNull().default(false),
    canEditGroup: boolean("can_edit_group").notNull().default(false),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index("group_members_user_id_idx").on(table.userId),
    groupIdIdx: index("group_members_group_id_idx").on(table.groupId),
    groupIdRoleIdx: index("group_members_group_id_role_idx").on(
      table.groupId,
      table.role,
    ),
    groupUserUnique: unique("group_members_group_id_user_id_unique").on(
      table.groupId,
      table.userId,
    ),
  }),
);

export const groupInvitations = pgTable(
  "group_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    inviterId: uuid("inviter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    inviteeId: uuid("invitee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"), // 'pending', 'accepted', 'denied'
    createdAt: timestamp("created_at").notNull().defaultNow(),
    respondedAt: timestamp("responded_at"),
  },
  (table) => ({
    inviteeIdStatusIdx: index("group_invitations_invitee_id_status_idx").on(
      table.inviteeId,
      table.status,
    ),
    inviterIdStatusIdx: index("group_invitations_inviter_id_status_idx").on(
      table.inviterId,
      table.status,
    ),
    groupIdStatusIdx: index("group_invitations_group_id_status_idx").on(
      table.groupId,
      table.status,
    ),
  }),
);

export const friends = pgTable(
  "friends",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    friendId: uuid("friend_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"), // 'pending', 'accepted'
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdStatusIdx: index("friends_user_id_status_idx").on(
      table.userId,
      table.status,
    ),
    friendIdStatusIdx: index("friends_friend_id_status_idx").on(
      table.friendId,
      table.status,
    ),
  }),
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // 'friend_request', 'group_invitation', 'system', 'activity'
    title: text("title").notNull(),
    message: text("message").notNull(),
    data: jsonb("data"), // Flexible JSON data storage for notification-specific info
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    readAt: timestamp("read_at"),
  },
  (table) => ({
    userIdIdx: index("notifications_user_id_idx").on(table.userId),
    userIdReadIdx: index("notifications_user_id_read_idx").on(
      table.userId,
      table.read,
    ),
    userIdTypeIdx: index("notifications_user_id_type_idx").on(
      table.userId,
      table.type,
    ),
    createdAtIdx: index("notifications_created_at_idx").on(table.createdAt),
  }),
);

// ============================================================================
// Admin Tables
// ============================================================================

/**
 * Admin Settings table - Key-value store for runtime app configuration
 * Used for feature flags like signups_enabled
 */
export const adminSettings = pgTable("admin_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => users.id),
});

/**
 * Admin Audit Log table - Tracks admin actions for accountability
 * Records actions like user blocks, setting changes, etc.
 */
export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    action: text("action").notNull(), // 'user_blocked', 'user_unblocked', 'signups_toggled'
    targetUserId: uuid("target_user_id").references(() => users.id),
    adminUserId: uuid("admin_user_id")
      .notNull()
      .references(() => users.id),
    metadata: jsonb("metadata"), // { reason, previousState, etc. }
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    targetUserIdx: index("admin_audit_log_target_user_idx").on(
      table.targetUserId,
    ),
    adminUserIdx: index("admin_audit_log_admin_user_idx").on(table.adminUserId),
    createdAtIdx: index("admin_audit_log_created_at_idx").on(table.createdAt),
  }),
);

// ============================================================================
// Relations
// ============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  ownedGroups: many(groups),
  groupMemberships: many(groupMembers),
  sentGroupInvitations: many(groupInvitations, { relationName: "inviter" }),
  receivedGroupInvitations: many(groupInvitations, { relationName: "invitee" }),
  notifications: many(notifications),
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
  owner: one(users, {
    fields: [groups.ownerId],
    references: [users.id],
  }),
  members: many(groupMembers),
  invitations: many(groupInvitations),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, {
    fields: [groupMembers.groupId],
    references: [groups.id],
  }),
  user: one(users, {
    fields: [groupMembers.userId],
    references: [users.id],
  }),
}));

export const friendsRelations = relations(friends, ({ one }) => ({
  user: one(users, {
    fields: [friends.userId],
    references: [users.id],
  }),
  friend: one(users, {
    fields: [friends.friendId],
    references: [users.id],
  }),
}));

export const groupInvitationsRelations = relations(
  groupInvitations,
  ({ one }) => ({
    group: one(groups, {
      fields: [groupInvitations.groupId],
      references: [groups.id],
    }),
    inviter: one(users, {
      fields: [groupInvitations.inviterId],
      references: [users.id],
      relationName: "inviter",
    }),
    invitee: one(users, {
      fields: [groupInvitations.inviteeId],
      references: [users.id],
      relationName: "invitee",
    }),
  }),
);

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const adminSettingsRelations = relations(adminSettings, ({ one }) => ({
  updater: one(users, {
    fields: [adminSettings.updatedBy],
    references: [users.id],
  }),
}));

export const adminAuditLogRelations = relations(adminAuditLog, ({ one }) => ({
  targetUser: one(users, {
    fields: [adminAuditLog.targetUserId],
    references: [users.id],
    relationName: "targetUser",
  }),
  admin: one(users, {
    fields: [adminAuditLog.adminUserId],
    references: [users.id],
    relationName: "admin",
  }),
}));

// ============================================================================
// Local type exports (inferred from local tables)
// ============================================================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Friend = typeof friends.$inferSelect;
export type NewFriend = typeof friends.$inferInsert;
export type Group = typeof groups.$inferSelect;
export type NewGroup = typeof groups.$inferInsert;
export type GroupMember = typeof groupMembers.$inferSelect;
export type NewGroupMember = typeof groupMembers.$inferInsert;
export type GroupInvitation = typeof groupInvitations.$inferSelect;
export type NewGroupInvitation = typeof groupInvitations.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type AdminSetting = typeof adminSettings.$inferSelect;
export type NewAdminSetting = typeof adminSettings.$inferInsert;
export type AdminAuditLog = typeof adminAuditLog.$inferSelect;
export type NewAdminAuditLog = typeof adminAuditLog.$inferInsert;

// Re-export centralized types from types package for cross-package compatibility
// These types are used by API managers and WebSocket communication
export type {
  DBUser,
  DBNewUser,
  DBGroup,
  DBNewGroup,
  DBGroupMember,
  DBNewGroupMember,
  DBFriend,
  DBNewFriend,
  DBGroupInvitation,
  DBNewGroupInvitation,
  DBNotification,
  DBNewNotification,
} from "@pico/types";
