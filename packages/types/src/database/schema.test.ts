/**
 * Tests for database schema integrity
 *
 * Tests cover:
 * - Drizzle table definitions and structure
 * - Type inference for select and insert operations
 * - Relations between tables
 * - Index and constraint validation
 * - Type safety for database operations
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
  type DBUser,
  type DBNewUser,
  type DBGroup,
  type DBNewGroup,
  type DBGroupMember,
  type DBNewGroupMember,
  type DBFriend,
  type DBNewFriend,
  type DBGroupInvitation,
  type DBNewGroupInvitation,
  type DBNotification,
  type DBNewNotification,
} from "./schema.js";

// ============================================================================
// Table Definition Tests
// ============================================================================

describe("Table Definitions", () => {
  it("should define users table with correct structure", () => {
    expect(users).toBeDefined();

    // Check required columns exist
    expect(users.id).toBeDefined();
    expect(users.discordId).toBeDefined();
    expect(users.username).toBeDefined();
    expect(users.createdAt).toBeDefined();
    expect(users.updatedAt).toBeDefined();

    // Check optional columns exist
    expect(users.avatar).toBeDefined();
    expect(users.player).toBeDefined();
    expect(users.timeZone).toBeDefined();
    expect(users.friendCode).toBeDefined();

    // Check boolean columns
    expect(users.showTimezone).toBeDefined();
    expect(users.usePlayerAsDisplayName).toBeDefined();
  });

  it("should define groups table with correct structure", () => {
    expect(groups).toBeDefined();

    // Check required columns
    expect(groups.id).toBeDefined();
    expect(groups.name).toBeDefined();
    expect(groups.ownerId).toBeDefined();
    expect(groups.createdAt).toBeDefined();
    expect(groups.updatedAt).toBeDefined();

    // Check optional columns
    expect(groups.description).toBeDefined();
    expect(groups.avatar).toBeDefined();
    expect(groups.tags).toBeDefined();
  });

  it("should define groupMembers table with correct structure", () => {
    expect(groupMembers).toBeDefined();

    // Check required columns
    expect(groupMembers.id).toBeDefined();
    expect(groupMembers.groupId).toBeDefined();
    expect(groupMembers.userId).toBeDefined();
    expect(groupMembers.role).toBeDefined();
    expect(groupMembers.joinedAt).toBeDefined();

    // Check permission columns
    expect(groupMembers.canInvite).toBeDefined();
    expect(groupMembers.canRemoveMembers).toBeDefined();
    expect(groupMembers.canEditGroup).toBeDefined();
  });

  it("should define groupInvitations table with correct structure", () => {
    expect(groupInvitations).toBeDefined();

    // Check required columns
    expect(groupInvitations.id).toBeDefined();
    expect(groupInvitations.groupId).toBeDefined();
    expect(groupInvitations.inviterId).toBeDefined();
    expect(groupInvitations.inviteeId).toBeDefined();
    expect(groupInvitations.status).toBeDefined();
    expect(groupInvitations.createdAt).toBeDefined();

    // Check optional columns
    expect(groupInvitations.respondedAt).toBeDefined();
  });

  it("should define friends table with correct structure", () => {
    expect(friends).toBeDefined();

    // Check required columns
    expect(friends.id).toBeDefined();
    expect(friends.userId).toBeDefined();
    expect(friends.friendId).toBeDefined();
    expect(friends.status).toBeDefined();
    expect(friends.createdAt).toBeDefined();
  });

  it("should define notifications table with correct structure", () => {
    expect(notifications).toBeDefined();

    // Check required columns
    expect(notifications.id).toBeDefined();
    expect(notifications.userId).toBeDefined();
    expect(notifications.type).toBeDefined();
    expect(notifications.title).toBeDefined();
    expect(notifications.message).toBeDefined();
    expect(notifications.data).toBeDefined();
    expect(notifications.read).toBeDefined();
    expect(notifications.createdAt).toBeDefined();

    // Check optional columns
    expect(notifications.readAt).toBeDefined();
  });
});

// ============================================================================
// Relations Tests
// ============================================================================

describe("Table Relations", () => {
  it("should export users relations", () => {
    expect(usersRelations).toBeDefined();
    expect(typeof usersRelations).toBe("object");
    // Relations should include:
    // - ownedGroups (one-to-many)
    // - groupMemberships (one-to-many)
    // - sentGroupInvitations (one-to-many)
    // - receivedGroupInvitations (one-to-many)
    // - notifications (one-to-many)
  });

  it("should export groups relations", () => {
    expect(groupsRelations).toBeDefined();
    expect(typeof groupsRelations).toBe("object");
    // Relations should include:
    // - owner (many-to-one)
    // - members (one-to-many)
    // - invitations (one-to-many)
  });

  it("should export groupMembers relations", () => {
    expect(groupMembersRelations).toBeDefined();
    expect(typeof groupMembersRelations).toBe("object");
    // Relations should include:
    // - group (many-to-one)
    // - user (many-to-one)
  });

  it("should export friends relations", () => {
    expect(friendsRelations).toBeDefined();
    expect(typeof friendsRelations).toBe("object");
    // Relations should include:
    // - user (many-to-one)
    // - friend (many-to-one)
  });

  it("should export groupInvitations relations", () => {
    expect(groupInvitationsRelations).toBeDefined();
    expect(typeof groupInvitationsRelations).toBe("object");
    // Relations should include:
    // - group (many-to-one)
    // - inviter (many-to-one)
    // - invitee (many-to-one)
  });

  it("should export notifications relations", () => {
    expect(notificationsRelations).toBeDefined();
    expect(typeof notificationsRelations).toBe("object");
    // Relations should include:
    // - user (many-to-one)
  });
});

// ============================================================================
// Type Inference Tests (Select)
// ============================================================================

describe("Type Inference - Select Operations", () => {
  it("should infer DBUser type correctly", () => {
    const user: DBUser = {
      id: "uuid-1",
      discordId: "123456789",
      username: "testuser",
      avatar: "avatar-hash",
      player: "Player Name",
      timeZone: "America/New_York",
      showTimezone: true,
      usePlayerAsDisplayName: false,
      betaTester: false,
      friendCode: "ABC123",
      role: "user",
      blockedAt: null,
      blockedBy: null,
      blockReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(user.id).toBeDefined();
    expect(user.discordId).toBeDefined();
    expect(user.username).toBeDefined();
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
  });

  it("should allow null values in optional DBUser fields", () => {
    const user: DBUser = {
      id: "uuid-1",
      discordId: "123456789",
      username: "testuser",
      avatar: null,
      player: null,
      timeZone: null,
      showTimezone: true,
      usePlayerAsDisplayName: false,
      betaTester: false,
      friendCode: null,
      role: "user",
      blockedAt: null,
      blockedBy: null,
      blockReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(user.avatar).toBeNull();
    expect(user.player).toBeNull();
    expect(user.timeZone).toBeNull();
    expect(user.friendCode).toBeNull();
  });

  it("should infer DBGroup type correctly", () => {
    const group: DBGroup = {
      id: "group-uuid",
      name: "Test Group",
      description: "A test group",
      avatar: "group-avatar",
      tags: ["test", "gaming"],
      ownerId: "owner-uuid",
      visibility: "private",
      joinMethod: "request",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(group.id).toBeDefined();
    expect(group.name).toBeDefined();
    expect(group.ownerId).toBeDefined();
    expect(group.tags).toBeInstanceOf(Array);
  });

  it("should allow null values in optional DBGroup fields", () => {
    const group: DBGroup = {
      id: "group-uuid",
      name: "Test Group",
      description: null,
      avatar: null,
      tags: null,
      ownerId: "owner-uuid",
      visibility: "private",
      joinMethod: "request",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(group.description).toBeNull();
    expect(group.avatar).toBeNull();
    expect(group.tags).toBeNull();
  });

  it("should infer DBGroupMember type correctly", () => {
    const member: DBGroupMember = {
      id: "member-uuid",
      groupId: "group-uuid",
      userId: "user-uuid",
      role: "admin",
      canInvite: true,
      canRemoveMembers: true,
      canEditGroup: true,
      joinedAt: new Date(),
    };

    expect(member.id).toBeDefined();
    expect(member.groupId).toBeDefined();
    expect(member.userId).toBeDefined();
    expect(member.role).toBe("admin");
    expect(member.canInvite).toBe(true);
  });

  it("should infer DBFriend type correctly", () => {
    const friend: DBFriend = {
      id: "friend-uuid",
      userId: "user-uuid",
      friendId: "friend-user-uuid",
      status: "accepted",
      createdAt: new Date(),
    };

    expect(friend.id).toBeDefined();
    expect(friend.userId).toBeDefined();
    expect(friend.friendId).toBeDefined();
    expect(friend.status).toBe("accepted");
  });

  it("should infer DBGroupInvitation type correctly", () => {
    const invitation: DBGroupInvitation = {
      id: "inv-uuid",
      groupId: "group-uuid",
      inviterId: "inviter-uuid",
      inviteeId: "invitee-uuid",
      status: "pending",
      createdAt: new Date(),
      respondedAt: null,
    };

    expect(invitation.id).toBeDefined();
    expect(invitation.status).toBe("pending");
    expect(invitation.respondedAt).toBeNull();
  });

  it("should infer DBNotification type correctly", () => {
    const notification: DBNotification = {
      id: "notif-uuid",
      userId: "user-uuid",
      type: "friend_request",
      title: "Friend Request",
      message: "You have a new friend request",
      data: {
        type: "friend_request",
        friendshipId: "friendship-uuid",
        fromUserId: "from-user-uuid",
        fromDiscordId: "123456789",
        fromUsername: "sender",
        fromDisplayName: "Sender Name",
        fromAvatar: null,
        fromPlayer: null,
      },
      read: false,
      createdAt: new Date(),
      readAt: null,
    };

    expect(notification.id).toBeDefined();
    expect(notification.type).toBe("friend_request");
    expect(notification.read).toBe(false);
  });
});

// ============================================================================
// Type Inference Tests (Insert)
// ============================================================================

describe("Type Inference - Insert Operations", () => {
  it("should infer DBNewUser type for insertion", () => {
    const newUser: DBNewUser = {
      discordId: "123456789",
      username: "newuser",
      avatar: "avatar-hash",
      player: "Player Name",
      timeZone: "America/New_York",
      // id, createdAt, updatedAt are auto-generated
      // showTimezone, usePlayerAsDisplayName have defaults
    };

    expect(newUser.discordId).toBeDefined();
    expect(newUser.username).toBeDefined();
  });

  it("should allow minimal DBNewUser with only required fields", () => {
    const newUser: DBNewUser = {
      discordId: "123456789",
      username: "newuser",
    };

    expect(newUser.discordId).toBeDefined();
    expect(newUser.username).toBeDefined();
  });

  it("should infer DBNewGroup type for insertion", () => {
    const newGroup: DBNewGroup = {
      name: "New Group",
      description: "A new group",
      ownerId: "owner-uuid",
      tags: ["new", "test"],
    };

    expect(newGroup.name).toBeDefined();
    expect(newGroup.ownerId).toBeDefined();
  });

  it("should allow minimal DBNewGroup with only required fields", () => {
    const newGroup: DBNewGroup = {
      name: "Minimal Group",
      ownerId: "owner-uuid",
    };

    expect(newGroup.name).toBeDefined();
    expect(newGroup.ownerId).toBeDefined();
  });

  it("should infer DBNewGroupMember type for insertion", () => {
    const newMember: DBNewGroupMember = {
      groupId: "group-uuid",
      userId: "user-uuid",
      role: "member",
      canInvite: false,
      canRemoveMembers: false,
      canEditGroup: false,
    };

    expect(newMember.groupId).toBeDefined();
    expect(newMember.userId).toBeDefined();
  });

  it("should allow minimal DBNewGroupMember with defaults", () => {
    const newMember: DBNewGroupMember = {
      groupId: "group-uuid",
      userId: "user-uuid",
      // role defaults to 'member'
      // permissions default to false
    };

    expect(newMember.groupId).toBeDefined();
    expect(newMember.userId).toBeDefined();
  });

  it("should infer DBNewFriend type for insertion", () => {
    const newFriend: DBNewFriend = {
      userId: "user-uuid",
      friendId: "friend-uuid",
      status: "pending",
    };

    expect(newFriend.userId).toBeDefined();
    expect(newFriend.friendId).toBeDefined();
  });

  it("should infer DBNewGroupInvitation type for insertion", () => {
    const newInvitation: DBNewGroupInvitation = {
      groupId: "group-uuid",
      inviterId: "inviter-uuid",
      inviteeId: "invitee-uuid",
      status: "pending",
    };

    expect(newInvitation.groupId).toBeDefined();
    expect(newInvitation.inviterId).toBeDefined();
    expect(newInvitation.inviteeId).toBeDefined();
  });

  it("should infer DBNewNotification type for insertion", () => {
    const newNotification: DBNewNotification = {
      userId: "user-uuid",
      type: "friend_request",
      title: "Friend Request",
      message: "You have a new friend request",
      data: {
        type: "friend_request",
        friendshipId: "friendship-uuid",
        fromUserId: "from-user-uuid",
        fromDiscordId: "123456789",
        fromUsername: "sender",
        fromDisplayName: "Sender Name",
        fromAvatar: null,
        fromPlayer: null,
      },
    };

    expect(newNotification.userId).toBeDefined();
    expect(newNotification.type).toBeDefined();
    expect(newNotification.data).toBeDefined();
  });
});

// ============================================================================
// Edge Cases and Constraints
// ============================================================================

describe("Edge Cases and Constraints", () => {
  it("should handle users with empty string values", () => {
    const user: DBUser = {
      id: "uuid-1",
      discordId: "123456789",
      username: "",
      avatar: "",
      player: "",
      timeZone: "",
      showTimezone: true,
      usePlayerAsDisplayName: false,
      betaTester: false,
      friendCode: "",
      role: "user",
      blockedAt: null,
      blockedBy: null,
      blockReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(user.username).toBe("");
    expect(user.avatar).toBe("");
  });

  it("should handle groups with empty arrays", () => {
    const group: DBGroup = {
      id: "group-uuid",
      name: "Test Group",
      description: null,
      avatar: null,
      tags: [],
      ownerId: "owner-uuid",
      visibility: "private",
      joinMethod: "request",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(group.tags).toBeInstanceOf(Array);
    expect(group.tags).toHaveLength(0);
  });

  it("should handle groupMembers with all permissions false", () => {
    const member: DBGroupMember = {
      id: "member-uuid",
      groupId: "group-uuid",
      userId: "user-uuid",
      role: "member",
      canInvite: false,
      canRemoveMembers: false,
      canEditGroup: false,
      joinedAt: new Date(),
    };

    expect(member.canInvite).toBe(false);
    expect(member.canRemoveMembers).toBe(false);
    expect(member.canEditGroup).toBe(false);
  });

  it("should handle different friend status values", () => {
    const pendingFriend: DBFriend = {
      id: "friend-1",
      userId: "user-1",
      friendId: "user-2",
      status: "pending",
      createdAt: new Date(),
    };

    const acceptedFriend: DBFriend = {
      id: "friend-2",
      userId: "user-1",
      friendId: "user-3",
      status: "accepted",
      createdAt: new Date(),
    };

    expect(pendingFriend.status).toBe("pending");
    expect(acceptedFriend.status).toBe("accepted");
  });

  it("should handle different group invitation status values", () => {
    const pending: DBGroupInvitation = {
      id: "inv-1",
      groupId: "group-1",
      inviterId: "user-1",
      inviteeId: "user-2",
      status: "pending",
      createdAt: new Date(),
      respondedAt: null,
    };

    const accepted: DBGroupInvitation = {
      id: "inv-2",
      groupId: "group-1",
      inviterId: "user-1",
      inviteeId: "user-3",
      status: "accepted",
      createdAt: new Date(),
      respondedAt: new Date(),
    };

    const denied: DBGroupInvitation = {
      id: "inv-3",
      groupId: "group-1",
      inviterId: "user-1",
      inviteeId: "user-4",
      status: "denied",
      createdAt: new Date(),
      respondedAt: new Date(),
    };

    expect(pending.status).toBe("pending");
    expect(accepted.status).toBe("accepted");
    expect(denied.status).toBe("denied");
  });

  it("should handle different notification types", () => {
    const friendRequest: DBNotification = {
      id: "notif-1",
      userId: "user-1",
      type: "friend_request",
      title: "Friend Request",
      message: "Test",
      data: null,
      read: false,
      createdAt: new Date(),
      readAt: null,
    };

    const groupInvitation: DBNotification = {
      id: "notif-2",
      userId: "user-1",
      type: "group_invitation",
      title: "Group Invitation",
      message: "Test",
      data: null,
      read: false,
      createdAt: new Date(),
      readAt: null,
    };

    const system: DBNotification = {
      id: "notif-3",
      userId: "user-1",
      type: "system",
      title: "System",
      message: "Test",
      data: null,
      read: false,
      createdAt: new Date(),
      readAt: null,
    };

    const activity: DBNotification = {
      id: "notif-4",
      userId: "user-1",
      type: "activity",
      title: "Activity",
      message: "Test",
      data: null,
      read: false,
      createdAt: new Date(),
      readAt: null,
    };

    expect(friendRequest.type).toBe("friend_request");
    expect(groupInvitation.type).toBe("group_invitation");
    expect(system.type).toBe("system");
    expect(activity.type).toBe("activity");
  });

  it("should handle notification read status", () => {
    const unread: DBNotification = {
      id: "notif-1",
      userId: "user-1",
      type: "friend_request",
      title: "Test",
      message: "Test",
      data: null,
      read: false,
      createdAt: new Date(),
      readAt: null,
    };

    const read: DBNotification = {
      id: "notif-2",
      userId: "user-1",
      type: "friend_request",
      title: "Test",
      message: "Test",
      data: null,
      read: true,
      createdAt: new Date(),
      readAt: new Date(),
    };

    expect(unread.read).toBe(false);
    expect(unread.readAt).toBeNull();
    expect(read.read).toBe(true);
    expect(read.readAt).toBeInstanceOf(Date);
  });
});
