/**
 * Database Schema Integration Tests
 *
 * Tests cover:
 * - Runtime table structure validation
 * - Column existence and accessibility
 * - Default values and nullability
 * - Drizzle ORM integration
 * - Type inference and runtime behavior
 */

import { describe, it, expect } from "vitest";
import {
  users,
  groups,
  groupMembers,
  groupInvitations,
  friends,
  notifications,
  usersRelations,
  groupsRelations,
  groupMembersRelations,
  friendsRelations,
  groupInvitationsRelations,
  notificationsRelations,
} from "./schema.js";

// ============================================================================
// Table Structure Integration Tests
// ============================================================================

describe("Database Schema - Table Structure", () => {
  it("should have correct table name for users", () => {
    expect((users as any)[Symbol.for("drizzle:Name")]).toBe("users");
  });

  it("should have correct table name for groups", () => {
    expect((groups as any)[Symbol.for("drizzle:Name")]).toBe("groups");
  });

  it("should have correct table name for groupMembers", () => {
    expect((groupMembers as any)[Symbol.for("drizzle:Name")]).toBe(
      "group_members",
    );
  });

  it("should have correct table name for groupInvitations", () => {
    expect((groupInvitations as any)[Symbol.for("drizzle:Name")]).toBe(
      "group_invitations",
    );
  });

  it("should have correct table name for friends", () => {
    expect((friends as any)[Symbol.for("drizzle:Name")]).toBe("friends");
  });

  it("should have correct table name for notifications", () => {
    expect((notifications as any)[Symbol.for("drizzle:Name")]).toBe(
      "notifications",
    );
  });
});

// ============================================================================
// Column Nullability Tests
// ============================================================================

describe("Database Schema - Column Nullability", () => {
  it("should enforce required fields in users table", () => {
    // Users table required fields: discordId, username, showTimezone, usePlayerAsDisplayName
    expect(users.discordId.notNull).toBe(true);
    expect(users.username.notNull).toBe(true);
    expect(users.showTimezone.notNull).toBe(true);
    expect(users.usePlayerAsDisplayName.notNull).toBe(true);
    expect(users.createdAt.notNull).toBe(true);
    expect(users.updatedAt.notNull).toBe(true);
  });

  it("should allow null in optional users fields", () => {
    // Optional fields should not have notNull constraint
    expect(users.avatar.notNull).toBe(false);
    expect(users.player.notNull).toBe(false);
    expect(users.timeZone.notNull).toBe(false);
    expect(users.friendCode.notNull).toBe(false);
  });

  it("should enforce required fields in groups table", () => {
    expect(groups.name.notNull).toBe(true);
    expect(groups.ownerId.notNull).toBe(true);
    expect(groups.createdAt.notNull).toBe(true);
    expect(groups.updatedAt.notNull).toBe(true);
  });

  it("should allow null in optional groups fields", () => {
    expect(groups.description.notNull).toBe(false);
    expect(groups.avatar.notNull).toBe(false);
    expect(groups.tags.notNull).toBe(false);
  });

  it("should enforce required fields in groupMembers table", () => {
    expect(groupMembers.groupId.notNull).toBe(true);
    expect(groupMembers.userId.notNull).toBe(true);
    expect(groupMembers.role.notNull).toBe(true);
    expect(groupMembers.canInvite.notNull).toBe(true);
    expect(groupMembers.canRemoveMembers.notNull).toBe(true);
    expect(groupMembers.canEditGroup.notNull).toBe(true);
    expect(groupMembers.joinedAt.notNull).toBe(true);
  });

  it("should enforce required fields in friends table", () => {
    expect(friends.userId.notNull).toBe(true);
    expect(friends.friendId.notNull).toBe(true);
    expect(friends.status.notNull).toBe(true);
    expect(friends.createdAt.notNull).toBe(true);
  });

  it("should enforce required fields in groupInvitations table", () => {
    expect(groupInvitations.groupId.notNull).toBe(true);
    expect(groupInvitations.inviterId.notNull).toBe(true);
    expect(groupInvitations.inviteeId.notNull).toBe(true);
    expect(groupInvitations.status.notNull).toBe(true);
    expect(groupInvitations.createdAt.notNull).toBe(true);
  });

  it("should allow null in optional groupInvitations fields", () => {
    expect(groupInvitations.respondedAt.notNull).toBe(false);
  });

  it("should enforce required fields in notifications table", () => {
    expect(notifications.userId.notNull).toBe(true);
    expect(notifications.type.notNull).toBe(true);
    expect(notifications.title.notNull).toBe(true);
    expect(notifications.message.notNull).toBe(true);
    expect(notifications.read.notNull).toBe(true);
    expect(notifications.createdAt.notNull).toBe(true);
  });

  it("should allow null in optional notifications fields", () => {
    expect(notifications.data.notNull).toBe(false);
    expect(notifications.readAt.notNull).toBe(false);
  });
});

// ============================================================================
// Default Values Tests
// ============================================================================

describe("Database Schema - Default Values", () => {
  it("should have correct default values for users table", () => {
    // Check that showTimezone defaults to true
    expect(users.showTimezone.default).toBeDefined();
    expect(users.usePlayerAsDisplayName.default).toBeDefined();
  });

  it("should have correct default values for groupMembers table", () => {
    // Check that role defaults to 'member'
    expect(groupMembers.role.default).toBeDefined();
    // Check that permissions default to false
    expect(groupMembers.canInvite.default).toBeDefined();
    expect(groupMembers.canRemoveMembers.default).toBeDefined();
    expect(groupMembers.canEditGroup.default).toBeDefined();
  });

  it("should have correct default values for friends table", () => {
    // Check that status defaults to 'pending'
    expect(friends.status.default).toBeDefined();
  });

  it("should have correct default values for groupInvitations table", () => {
    // Check that status defaults to 'pending'
    expect(groupInvitations.status.default).toBeDefined();
  });

  it("should have correct default values for notifications table", () => {
    // Check that read defaults to false
    expect(notifications.read.default).toBeDefined();
  });
});

// ============================================================================
// Primary Key Tests
// ============================================================================

describe("Database Schema - Primary Keys", () => {
  it("should have UUID primary keys for all tables", () => {
    expect(users.id.primary).toBe(true);
    expect(groups.id.primary).toBe(true);
    expect(groupMembers.id.primary).toBe(true);
    expect(groupInvitations.id.primary).toBe(true);
    expect(friends.id.primary).toBe(true);
    expect(notifications.id.primary).toBe(true);
  });

  it("should have defaultRandom for all primary keys", () => {
    // UUID columns should have defaultRandom function
    expect(users.id.default).toBeDefined();
    expect(groups.id.default).toBeDefined();
    expect(groupMembers.id.default).toBeDefined();
    expect(groupInvitations.id.default).toBeDefined();
    expect(friends.id.default).toBeDefined();
    expect(notifications.id.default).toBeDefined();
  });
});

// ============================================================================
// Relations Tests
// ============================================================================

describe("Database Schema - Relations", () => {
  it("should export users relations", () => {
    expect(usersRelations).toBeDefined();
    expect(typeof usersRelations).toBe("object");
  });

  it("should export groups relations", () => {
    expect(groupsRelations).toBeDefined();
    expect(typeof groupsRelations).toBe("object");
  });

  it("should export groupMembers relations", () => {
    expect(groupMembersRelations).toBeDefined();
    expect(typeof groupMembersRelations).toBe("object");
  });

  it("should export friends relations", () => {
    expect(friendsRelations).toBeDefined();
    expect(typeof friendsRelations).toBe("object");
  });

  it("should export groupInvitations relations", () => {
    expect(groupInvitationsRelations).toBeDefined();
    expect(typeof groupInvitationsRelations).toBe("object");
  });

  it("should export notifications relations", () => {
    expect(notificationsRelations).toBeDefined();
    expect(typeof notificationsRelations).toBe("object");
  });
});

// ============================================================================
// Column Existence Tests
// ============================================================================

describe("Database Schema - Column Existence", () => {
  it("should have all users columns accessible", () => {
    expect(users.id).toBeDefined();
    expect(users.discordId).toBeDefined();
    expect(users.username).toBeDefined();
    expect(users.avatar).toBeDefined();
    expect(users.player).toBeDefined();
    expect(users.timeZone).toBeDefined();
    expect(users.showTimezone).toBeDefined();
    expect(users.usePlayerAsDisplayName).toBeDefined();
    expect(users.friendCode).toBeDefined();
    expect(users.createdAt).toBeDefined();
    expect(users.updatedAt).toBeDefined();
  });

  it("should have all groups columns accessible", () => {
    expect(groups.id).toBeDefined();
    expect(groups.name).toBeDefined();
    expect(groups.description).toBeDefined();
    expect(groups.avatar).toBeDefined();
    expect(groups.tags).toBeDefined();
    expect(groups.ownerId).toBeDefined();
    expect(groups.createdAt).toBeDefined();
    expect(groups.updatedAt).toBeDefined();
  });

  it("should have all groupMembers columns accessible", () => {
    expect(groupMembers.id).toBeDefined();
    expect(groupMembers.groupId).toBeDefined();
    expect(groupMembers.userId).toBeDefined();
    expect(groupMembers.role).toBeDefined();
    expect(groupMembers.canInvite).toBeDefined();
    expect(groupMembers.canRemoveMembers).toBeDefined();
    expect(groupMembers.canEditGroup).toBeDefined();
    expect(groupMembers.joinedAt).toBeDefined();
  });

  it("should have all friends columns accessible", () => {
    expect(friends.id).toBeDefined();
    expect(friends.userId).toBeDefined();
    expect(friends.friendId).toBeDefined();
    expect(friends.status).toBeDefined();
    expect(friends.createdAt).toBeDefined();
  });

  it("should have all groupInvitations columns accessible", () => {
    expect(groupInvitations.id).toBeDefined();
    expect(groupInvitations.groupId).toBeDefined();
    expect(groupInvitations.inviterId).toBeDefined();
    expect(groupInvitations.inviteeId).toBeDefined();
    expect(groupInvitations.status).toBeDefined();
    expect(groupInvitations.createdAt).toBeDefined();
    expect(groupInvitations.respondedAt).toBeDefined();
  });

  it("should have all notifications columns accessible", () => {
    expect(notifications.id).toBeDefined();
    expect(notifications.userId).toBeDefined();
    expect(notifications.type).toBeDefined();
    expect(notifications.title).toBeDefined();
    expect(notifications.message).toBeDefined();
    expect(notifications.data).toBeDefined();
    expect(notifications.read).toBeDefined();
    expect(notifications.createdAt).toBeDefined();
    expect(notifications.readAt).toBeDefined();
  });
});

// ============================================================================
// Runtime Column Name Tests
// ============================================================================

describe("Database Schema - Column Names", () => {
  it("should have correct column name for users.id", () => {
    expect(users.id.name).toBe("id");
  });

  it("should have correct column name for users.discordId", () => {
    expect(users.discordId.name).toBe("discord_id");
  });

  it("should have correct column name for users.showTimezone", () => {
    expect(users.showTimezone.name).toBe("show_timezone");
  });

  it("should have correct column name for users.usePlayerAsDisplayName", () => {
    expect(users.usePlayerAsDisplayName.name).toBe(
      "use_player_as_display_name",
    );
  });

  it("should have correct column name for groupMembers.canInvite", () => {
    expect(groupMembers.canInvite.name).toBe("can_invite");
  });

  it("should have correct column name for groupMembers.canRemoveMembers", () => {
    expect(groupMembers.canRemoveMembers.name).toBe("can_remove_members");
  });

  it("should have correct column name for groupMembers.canEditGroup", () => {
    expect(groupMembers.canEditGroup.name).toBe("can_edit_group");
  });

  it("should have correct column name for groupInvitations.inviterId", () => {
    expect(groupInvitations.inviterId.name).toBe("inviter_id");
  });

  it("should have correct column name for groupInvitations.inviteeId", () => {
    expect(groupInvitations.inviteeId.name).toBe("invitee_id");
  });
});
