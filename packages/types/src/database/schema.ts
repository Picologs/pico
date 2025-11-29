/**
 * Database Schema
 *
 * Shared Drizzle ORM schema definitions for Neon PostgreSQL database.
 * This is the single source of truth for database structure used by
 * both the website and bun-server.
 *
 * @module types/database/schema
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
  bigint,
  integer,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================================================
// Tables
// ============================================================================

/**
 * Users table - Discord OAuth users with Star Citizen player names
 */
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
    betaTester: boolean("beta_tester").notNull().default(false),
    friendCode: text("friend_code").unique(),
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
  }),
);

/**
 * Groups table - User-created groups for log sharing
 */
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
    /** Group visibility: 'private' (invite-only) or 'discoverable' (listed publicly) */
    visibility: text("visibility").notNull().default("private"),
    /** How users join when discoverable: 'open' (instant) or 'request' (approval needed) */
    joinMethod: text("join_method").notNull().default("request"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    ownerIdIdx: index("groups_owner_id_idx").on(table.ownerId),
    createdAtIdx: index("groups_created_at_idx").on(table.createdAt),
    visibilityIdx: index("groups_visibility_idx").on(table.visibility),
  }),
);

/**
 * Group Members table - Group membership with roles and permissions
 */
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

/**
 * Group Invitations table - Pending group invitations
 */
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

/**
 * Group Join Requests table - Requests to join discoverable groups
 * Used when a group has visibility='discoverable' and joinMethod='request'
 */
export const groupJoinRequests = pgTable(
  "group_join_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Optional message from the requester */
    message: text("message"),
    /** Request status: 'pending', 'approved', 'denied' */
    status: text("status").notNull().default("pending"),
    /** User who reviewed the request (owner/admin) */
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at"),
  },
  (table) => ({
    groupIdStatusIdx: index("group_join_requests_group_status_idx").on(
      table.groupId,
      table.status,
    ),
    userIdIdx: index("group_join_requests_user_idx").on(table.userId),
    groupUserUnique: unique("group_join_requests_group_user_unique").on(
      table.groupId,
      table.userId,
    ),
  }),
);

/**
 * Friends table - Bidirectional friend relationships
 */
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

/**
 * Notifications table - User notifications with full history
 */
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
// Log Schema Discovery Tables
// ============================================================================

/**
 * Log Patterns table - Catalog of discovered log event patterns
 * Used to track all log types seen across the app for parser development
 */
export const logPatterns = pgTable(
  "log_patterns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventName: text("event_name").notNull(), // e.g., "GenerateLocationProperty"
    severity: text("severity"), // Notice, Error, Trace, Warning, null
    signature: text("signature").notNull().unique(), // Normalized pattern hash
    regexPattern: text("regex_pattern"), // Generated regex for parsing (nullable)
    isHandled: boolean("is_handled").notNull().default(false), // true = already parsed
    firstSeenAt: timestamp("first_seen_at").notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
    totalOccurrences: bigint("total_occurrences", { mode: "number" })
      .notNull()
      .default(1),
    // Gap analysis columns for admin patterns page
    category: text("category").default("uncategorized"),
    priorityScore: integer("priority_score").default(0),
    suggestedEventType: text("suggested_event_type"),
    reviewStatus: text("review_status").default("pending"),
  },
  (table) => ({
    eventNameIdx: index("log_patterns_event_name_idx").on(table.eventName),
    isHandledIdx: index("log_patterns_is_handled_idx").on(table.isHandled),
    occurrencesIdx: index("log_patterns_occurrences_idx").on(
      table.totalOccurrences,
    ),
    signatureIdx: index("log_patterns_signature_idx").on(table.signature),
    priorityScoreIdx: index("log_patterns_priority_score_idx").on(
      table.priorityScore,
    ),
    categoryIdx: index("log_patterns_category_idx").on(table.category),
    reviewStatusIdx: index("log_patterns_review_status_idx").on(
      table.reviewStatus,
    ),
  }),
);

/**
 * Log Pattern Examples table - Up to 5 varied examples per pattern
 * Helps with regex development by showing different variations
 */
export const logPatternExamples = pgTable(
  "log_pattern_examples",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patternId: uuid("pattern_id")
      .notNull()
      .references(() => logPatterns.id, { onDelete: "cascade" }),
    exampleLine: text("example_line").notNull(),
    addedAt: timestamp("added_at").notNull().defaultNow(),
  },
  (table) => ({
    patternIdIdx: index("log_pattern_examples_pattern_id_idx").on(
      table.patternId,
    ),
    patternExampleUnique: unique(
      "log_pattern_examples_pattern_example_unique",
    ).on(table.patternId, table.exampleLine),
  }),
);

/**
 * Log Tags table - Team and subsystem tags associated with patterns
 * e.g., [Team_VFX], [Missions], [Network]
 */
export const logTags = pgTable(
  "log_tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patternId: uuid("pattern_id")
      .notNull()
      .references(() => logPatterns.id, { onDelete: "cascade" }),
    tagType: text("tag_type").notNull(), // 'team' or 'subsystem'
    tagValue: text("tag_value").notNull(), // e.g., "Team_VFX", "Missions"
  },
  (table) => ({
    patternIdIdx: index("log_tags_pattern_id_idx").on(table.patternId),
    patternTagUnique: unique("log_tags_pattern_tag_unique").on(
      table.patternId,
      table.tagType,
      table.tagValue,
    ),
  }),
);

/**
 * Log Pattern Reports table - Optional per-user occurrence tracking
 * For analyzing frequency patterns across different users
 */
export const logPatternReports = pgTable(
  "log_pattern_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patternId: uuid("pattern_id")
      .notNull()
      .references(() => logPatterns.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id), // Optional, can be null for anonymous
    occurrences: integer("occurrences").notNull().default(1),
    reportedAt: timestamp("reported_at").notNull().defaultNow(),
  },
  (table) => ({
    patternIdIdx: index("log_pattern_reports_pattern_id_idx").on(
      table.patternId,
    ),
    userIdIdx: index("log_pattern_reports_user_id_idx").on(table.userId),
  }),
);

/**
 * Gap Analysis Baselines table - Stores snapshots of pattern state for comparison
 * Used to track changes in log patterns across game patches
 */
export const gapAnalysisBaselines = pgTable(
	'gap_analysis_baselines',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		name: text('name').notNull(),
		description: text('description'),
		createdBy: uuid('created_by')
			.notNull()
			.references(() => users.id),
		createdAt: timestamp('created_at').notNull().defaultNow(),
		snapshotData: jsonb('snapshot_data').notNull()
	},
	(table) => ({
		createdAtIdx: index('gap_analysis_baselines_created_at_idx').on(table.createdAt)
	})
);

// ============================================================================
// Admin Tables
// ============================================================================

/**
 * Admin Settings table - Key-value store for runtime app configuration
 * Used for feature flags like signups_enabled
 */
export const adminSettings = pgTable('admin_settings', {
	key: text('key').primaryKey(),
	value: jsonb('value').notNull(),
	updatedAt: timestamp('updated_at').notNull().defaultNow(),
	updatedBy: uuid('updated_by').references(() => users.id),
});

/**
 * Admin Audit Log table - Tracks admin actions for accountability
 * Records actions like user blocks, setting changes, etc.
 */
export const adminAuditLog = pgTable(
	'admin_audit_log',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		action: text('action').notNull(), // 'user_blocked', 'user_unblocked', 'signups_toggled'
		targetUserId: uuid('target_user_id').references(() => users.id),
		adminUserId: uuid('admin_user_id').notNull().references(() => users.id),
		metadata: jsonb('metadata'), // { reason, previousState, etc. }
		createdAt: timestamp('created_at').notNull().defaultNow(),
	},
	(table) => ({
		targetUserIdx: index('admin_audit_log_target_user_idx').on(table.targetUserId),
		adminUserIdx: index('admin_audit_log_admin_user_idx').on(table.adminUserId),
		createdAtIdx: index('admin_audit_log_created_at_idx').on(table.createdAt),
	})
);

// ============================================================================
// Relations
// ============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  ownedGroups: many(groups),
  groupMemberships: many(groupMembers),
  sentGroupInvitations: many(groupInvitations, { relationName: "inviter" }),
  receivedGroupInvitations: many(groupInvitations, { relationName: "invitee" }),
  groupJoinRequests: many(groupJoinRequests),
  notifications: many(notifications),
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
  owner: one(users, {
    fields: [groups.ownerId],
    references: [users.id],
  }),
  members: many(groupMembers),
  invitations: many(groupInvitations),
  joinRequests: many(groupJoinRequests),
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

export const groupJoinRequestsRelations = relations(
  groupJoinRequests,
  ({ one }) => ({
    group: one(groups, {
      fields: [groupJoinRequests.groupId],
      references: [groups.id],
    }),
    user: one(users, {
      fields: [groupJoinRequests.userId],
      references: [users.id],
    }),
    reviewer: one(users, {
      fields: [groupJoinRequests.reviewedBy],
      references: [users.id],
    }),
  }),
);

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const logPatternsRelations = relations(logPatterns, ({ many }) => ({
  examples: many(logPatternExamples),
  tags: many(logTags),
  reports: many(logPatternReports),
}));

export const logPatternExamplesRelations = relations(
  logPatternExamples,
  ({ one }) => ({
    pattern: one(logPatterns, {
      fields: [logPatternExamples.patternId],
      references: [logPatterns.id],
    }),
  }),
);

export const logTagsRelations = relations(logTags, ({ one }) => ({
  pattern: one(logPatterns, {
    fields: [logTags.patternId],
    references: [logPatterns.id],
  }),
}));

export const logPatternReportsRelations = relations(
  logPatternReports,
  ({ one }) => ({
    pattern: one(logPatterns, {
      fields: [logPatternReports.patternId],
      references: [logPatterns.id],
    }),
    user: one(users, {
      fields: [logPatternReports.userId],
      references: [users.id],
    }),
  }),
);

export const gapAnalysisBaselinesRelations = relations(gapAnalysisBaselines, ({ one }) => ({
	creator: one(users, {
		fields: [gapAnalysisBaselines.createdBy],
		references: [users.id]
	})
}));

export const adminSettingsRelations = relations(adminSettings, ({ one }) => ({
	updater: one(users, {
		fields: [adminSettings.updatedBy],
		references: [users.id]
	})
}));

export const adminAuditLogRelations = relations(adminAuditLog, ({ one }) => ({
	targetUser: one(users, {
		fields: [adminAuditLog.targetUserId],
		references: [users.id],
		relationName: 'targetUser'
	}),
	admin: one(users, {
		fields: [adminAuditLog.adminUserId],
		references: [users.id],
		relationName: 'admin'
	})
}));

// ============================================================================
// Inferred Types
// ============================================================================

/**
 * User type (inferred from users table)
 */
export type DBUser = typeof users.$inferSelect;

/**
 * New user data for insertion
 */
export type DBNewUser = typeof users.$inferInsert;

/**
 * Group type (inferred from groups table)
 */
export type DBGroup = typeof groups.$inferSelect;

/**
 * New group data for insertion
 */
export type DBNewGroup = typeof groups.$inferInsert;

/**
 * Group member type (inferred from groupMembers table)
 */
export type DBGroupMember = typeof groupMembers.$inferSelect;

/**
 * New group member data for insertion
 */
export type DBNewGroupMember = typeof groupMembers.$inferInsert;

/**
 * Friend type (inferred from friends table)
 */
export type DBFriend = typeof friends.$inferSelect;

/**
 * New friend data for insertion
 */
export type DBNewFriend = typeof friends.$inferInsert;

/**
 * Group invitation type (inferred from groupInvitations table)
 */
export type DBGroupInvitation = typeof groupInvitations.$inferSelect;

/**
 * New group invitation data for insertion
 */
export type DBNewGroupInvitation = typeof groupInvitations.$inferInsert;

/**
 * Group join request type (inferred from groupJoinRequests table)
 */
export type DBGroupJoinRequest = typeof groupJoinRequests.$inferSelect;

/**
 * New group join request data for insertion
 */
export type DBNewGroupJoinRequest = typeof groupJoinRequests.$inferInsert;

/**
 * Notification type (inferred from notifications table)
 */
export type DBNotification = typeof notifications.$inferSelect;

/**
 * New notification data for insertion
 */
export type DBNewNotification = typeof notifications.$inferInsert;

/**
 * Log pattern type (inferred from logPatterns table)
 */
export type DBLogPattern = typeof logPatterns.$inferSelect;

/**
 * New log pattern data for insertion
 */
export type DBNewLogPattern = typeof logPatterns.$inferInsert;

/**
 * Log pattern example type (inferred from logPatternExamples table)
 */
export type DBLogPatternExample = typeof logPatternExamples.$inferSelect;

/**
 * New log pattern example data for insertion
 */
export type DBNewLogPatternExample = typeof logPatternExamples.$inferInsert;

/**
 * Log tag type (inferred from logTags table)
 */
export type DBLogTag = typeof logTags.$inferSelect;

/**
 * New log tag data for insertion
 */
export type DBNewLogTag = typeof logTags.$inferInsert;

/**
 * Log pattern report type (inferred from logPatternReports table)
 */
export type DBLogPatternReport = typeof logPatternReports.$inferSelect;

/**
 * New log pattern report data for insertion
 */
export type DBNewLogPatternReport = typeof logPatternReports.$inferInsert;

/**
 * Gap analysis baseline type (inferred from gapAnalysisBaselines table)
 */
export type DBGapAnalysisBaseline = typeof gapAnalysisBaselines.$inferSelect;

/**
 * New gap analysis baseline data for insertion
 */
export type DBNewGapAnalysisBaseline = typeof gapAnalysisBaselines.$inferInsert;

/**
 * Admin settings type (inferred from adminSettings table)
 */
export type DBAdminSetting = typeof adminSettings.$inferSelect;

/**
 * New admin settings data for insertion
 */
export type DBNewAdminSetting = typeof adminSettings.$inferInsert;

/**
 * Admin audit log type (inferred from adminAuditLog table)
 */
export type DBAdminAuditLog = typeof adminAuditLog.$inferSelect;

/**
 * New admin audit log data for insertion
 */
export type DBNewAdminAuditLog = typeof adminAuditLog.$inferInsert;
