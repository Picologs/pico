/**
 * Comprehensive type tests for picologs-types
 *
 * Tests cover:
 * - Database schema integrity and Drizzle ORM table definitions
 * - Type narrowing in discriminated unions (WebSocket messages, Notifications)
 * - Complex nested type structures (Groups, GroupMembers, Logs)
 * - Type compatibility and transformations (LogTransmit conversion)
 * - Helper function correctness (pagination, user profile utilities)
 * - Type safety with discriminated unions
 */

import { describe, it, expect } from "vitest";
import type {
  DBUser,
  DBGroup,
  DBGroupMember,
  DBGroupInvitation,
  DBFriend,
  Log,
  LogTransmit,
  UserProfile,
  Friend,
  Group,
  GroupMember,
  GroupInvitation,
  ClientMessage,
  ServerMessage,
  WebSocketMessage,
  Notification,
  NotificationData,
  FriendRequestNotificationData,
  GroupInvitationNotificationData,
  SystemNotificationData,
  ActivityNotificationData,
  FriendRequest,
  PaginationMetadata,
} from "./index.js";
import {
  toLogTransmit,
  fromLogTransmit,
  getDisplayName,
  getSecondaryName,
  hasPlayerName,
  formatUserDisplay,
  calculateTotalPages,
  hasMorePages,
  createPaginationMetadata,
} from "./index.js";

// ============================================================================
// Database Schema Integrity Tests
// ============================================================================

describe("Database Schema Integrity", () => {
  it("should have valid DBUser type with required fields", () => {
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
  });

  it("should allow optional fields in DBUser", () => {
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
  });

  it("should have valid DBGroup type with references", () => {
    const group: DBGroup = {
      id: "group-uuid-1",
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

    expect(group.ownerId).toBeDefined();
    expect(group.tags).toBeInstanceOf(Array);
  });

  it("should have valid DBGroupMember with permissions", () => {
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

    expect(member.role).toMatch(/^(owner|admin|member)$/);
    expect(typeof member.canInvite).toBe("boolean");
  });

  it("should have valid DBGroupInvitation with status", () => {
    const invitation: DBGroupInvitation = {
      id: "inv-uuid",
      groupId: "group-uuid",
      inviterId: "inviter-uuid",
      inviteeId: "invitee-uuid",
      status: "pending",
      createdAt: new Date(),
      respondedAt: null,
    };

    expect(invitation.status).toMatch(/^(pending|accepted|denied)$/);
  });

  it("should have valid DBFriend with relationship", () => {
    const friend: DBFriend = {
      id: "friend-uuid",
      userId: "user-uuid",
      friendId: "friend-user-uuid",
      status: "accepted",
      createdAt: new Date(),
    };

    expect(friend.userId).not.toEqual(friend.friendId);
    expect(friend.status).toMatch(/^(pending|accepted)$/);
  });
});

// ============================================================================
// WebSocket Message Discriminated Union Tests
// ============================================================================

describe("WebSocket Message Type Narrowing", () => {
  it("should correctly narrow RegisterMessage type", () => {
    const msg: ClientMessage = {
      type: "register",
      userId: "user-123",
      token: "jwt-token",
      metadata: { client: "web" },
    };

    expect(msg.type).toBe("register");
    if (msg.type === "register") {
      expect(msg.userId).toBeDefined();
      expect(msg.token).toBeDefined();
    }
  });

  it("should correctly narrow GetFriendsRequest type", () => {
    const msg: ClientMessage = {
      type: "get_friends",
      data: {
        page: 1,
        perPage: 50,
        sortBy: "online",
      },
    };

    expect(msg.type).toBe("get_friends");
    if (msg.type === "get_friends") {
      expect(msg.data?.page).toBe(1);
    }
  });

  it("should correctly narrow DashboardDataRequest with optional groupMembers", () => {
    const msg: ClientMessage = {
      type: "get_dashboard_data",
      data: {
        friendsPage: 1,
        friendsPerPage: 50,
        includeGroupMembers: true,
      },
    };

    expect(msg.type).toBe("get_dashboard_data");
    if (msg.type === "get_dashboard_data") {
      expect(msg.data?.includeGroupMembers).toBe(true);
    }
  });

  it("should correctly narrow SendLogsMessage with target type", () => {
    const msg: ClientMessage = {
      type: "send_logs",
      data: {
        logs: [],
        target: {
          type: "group",
          groupId: "group-123",
        },
        compressed: false,
      },
    };

    expect(msg.type).toBe("send_logs");
    if (msg.type === "send_logs") {
      expect(msg.data.target.type).toMatch(/^(friends|group)$/);
      if (msg.data.target.type === "group") {
        expect(msg.data.target.groupId).toBeDefined();
      }
    }
  });

  it("should correctly narrow PingMessage", () => {
    const msg: ClientMessage = {
      type: "ping",
    };

    expect(msg.type).toBe("ping");
  });

  it("should correctly narrow ErrorMessage on server", () => {
    const msg: ServerMessage = {
      type: "error",
      message: "Something went wrong",
      error: "INVALID_TOKEN",
    };

    expect(msg.type).toBe("error");
    if (msg.type === "error") {
      expect(msg.message).toBeDefined();
    }
  });

  it("should correctly narrow FriendsListResponse", () => {
    const msg: ServerMessage = {
      type: "friends_list",
      data: [],
      pagination: {
        page: 1,
        perPage: 50,
        total: 100,
        totalPages: 2,
        hasMore: true,
      },
    };

    expect(msg.type).toBe("friends_list");
    if (msg.type === "friends_list") {
      expect(msg.pagination.page).toBe(1);
    }
  });

  it("should correctly narrow DashboardDataResponse with optional groupMembers", () => {
    const msg: ServerMessage = {
      type: "dashboard_data",
      data: {
        user: { id: "user-1", username: "testuser", avatar: null },
        friends: [],
        friendsPagination: {
          page: 1,
          perPage: 50,
          total: 0,
          totalPages: 1,
          hasMore: false,
        },
        groups: [],
        groupsPagination: {
          page: 1,
          perPage: 50,
          total: 0,
          totalPages: 1,
          hasMore: false,
        },
        logs: [],
        notifications: { friendRequests: [], groupInvitations: [] },
      },
    };

    expect(msg.type).toBe("dashboard_data");
    if (msg.type === "dashboard_data") {
      expect(msg.data.groupMembers).toBeUndefined();
    }
  });
});

// ============================================================================
// Notification Discriminated Union Tests
// ============================================================================

describe("Notification Type Narrowing", () => {
  it("should correctly narrow FriendRequestNotificationData", () => {
    const data: NotificationData = {
      type: "friend_request",
      friendshipId: "friendship-123",
      fromUserId: "user-123",
      fromDiscordId: "123456789",
      fromUsername: "testuser",
      fromDisplayName: "Test User",
      fromAvatar: "avatar-hash",
      fromPlayer: "Player Name",
    };

    expect(data.type).toBe("friend_request");
    if (data.type === "friend_request") {
      expect(data.friendshipId).toBeDefined();
      expect(data.fromUserId).toBeDefined();
    }
  });

  it("should correctly narrow GroupInvitationNotificationData", () => {
    const data: NotificationData = {
      type: "group_invitation",
      invitationId: "inv-123",
      groupId: "group-123",
      groupName: "Test Group",
      groupAvatar: "group-avatar",
      inviterId: "inviter-123",
      inviterUsername: "inviter",
      inviterDisplayName: "Inviter Name",
      inviterAvatar: "inviter-avatar",
    };

    expect(data.type).toBe("group_invitation");
    if (data.type === "group_invitation") {
      expect(data.groupId).toBeDefined();
      expect(data.inviterId).toBeDefined();
    }
  });

  it("should correctly narrow SystemNotificationData", () => {
    const data: NotificationData = {
      type: "system",
      category: "maintenance",
      actionUrl: "https://example.com",
      actionLabel: "Learn more",
    };

    expect(data.type).toBe("system");
    if (data.type === "system") {
      expect(data.category).toMatch(
        /^(announcement|maintenance|update|warning)$/,
      );
    }
  });

  it("should correctly narrow ActivityNotificationData", () => {
    const data: NotificationData = {
      type: "activity",
      activityType: "friend_online",
      relatedUserId: "user-123",
      relatedUsername: "testuser",
      relatedDisplayName: "Test User",
    };

    expect(data.type).toBe("activity");
    if (data.type === "activity") {
      expect(data.activityType).toMatch(
        /^(friend_online|friend_offline|friend_joined_group|friend_left_group|group_member_joined|group_member_left)$/,
      );
    }
  });

  it("should handle Notification with discriminated data field", () => {
    const notification: Notification = {
      id: "notif-123",
      userId: "user-123",
      type: "friend_request",
      title: "Friend Request",
      message: "You have a new friend request",
      data: {
        type: "friend_request",
        friendshipId: "friendship-123",
        fromUserId: "sender-123",
        fromDiscordId: "123456789",
        fromUsername: "sender",
        fromDisplayName: "Sender Name",
        fromAvatar: null,
        fromPlayer: null,
      },
      read: false,
      createdAt: "2025-01-01T00:00:00Z",
      readAt: null,
    };

    expect(notification.type).toBe(notification.data.type);
  });
});

// ============================================================================
// Complex Nested Type Structure Tests
// ============================================================================

describe("Complex Nested Types", () => {
  it("should handle GroupInvitation with nested Group object", () => {
    const invitation: GroupInvitation = {
      id: "inv-123",
      groupId: "group-123",
      group: {
        id: "group-123",
        name: "Test Group",
        description: "A test group",
        avatar: "avatar-hash",
        tags: ["test", "gaming"],
      },
      inviterId: "inviter-123",
      inviterUsername: "inviter",
      inviterDisplayName: "Inviter Name",
      inviterAvatar: "inviter-avatar",
      inviterPlayer: "Inviter Player",
      createdAt: "2025-01-01T00:00:00Z",
      status: "pending",
    };

    expect(invitation.group.id).toBe(invitation.groupId);
    expect(invitation.group.tags).toBeInstanceOf(Array);
  });

  it("should handle Log with nested ShipGroup", () => {
    const log: Log = {
      id: "log-123",
      userId: "user-123",
      player: "Player Name",
      emoji: "🚀",
      line: "Quantum jump initiated",
      timestamp: "2025-01-01T00:00:00Z",
      original: "[00:00:00.000] Quantum jump initiated",
      open: false,
      eventType: "quantum_travel",
      ship: {
        vehicleId: "ship-123",
        vehicleName: "Avenger Titan",
        team: "user-team",
        location: "Stanton",
        events: [],
      },
    };

    expect(log.ship?.vehicleId).toBeDefined();
    expect(log.ship?.events).toBeInstanceOf(Array);
  });

  it("should handle Log with recursive children structure", () => {
    const childLog: Log = {
      id: "log-child-123",
      userId: "user-123",
      player: "Player Name",
      emoji: "💀",
      line: "Killed by Crash",
      timestamp: "2025-01-01T00:00:01Z",
      original: "[00:00:01.000] Killed by Crash",
      open: false,
      eventType: "actor_death",
    };

    const parentLog: Log = {
      id: "log-parent-123",
      userId: "user-123",
      player: "Player Name",
      emoji: "💥",
      line: "Killing spree",
      timestamp: "2025-01-01T00:00:00Z",
      original: "[00:00:00.000] Killing spree",
      open: false,
      eventType: "killing_spree",
      children: [childLog],
    };

    expect(parentLog.children).toBeInstanceOf(Array);
    expect(parentLog.children?.[0].eventType).toBe("actor_death");
  });

  it("should handle GroupMember with all permission flags", () => {
    const member: GroupMember = {
      id: "member-uuid",
      groupId: "group-123",
      userId: "user-123",
      discordId: "123456789",
      username: "testuser",
      displayName: "Test User",
      player: "Player Name",
      avatar: "avatar-hash",
      timeZone: "America/New_York",
      role: "admin",
      usePlayerAsDisplayName: true,
      joinedAt: "2025-01-01T00:00:00Z",
      canInvite: true,
      canRemoveMembers: true,
      canEditGroup: true,
      isOnline: true,
      isConnected: true,
    };

    expect(member.canInvite).toBe(true);
    expect(member.canRemoveMembers).toBe(true);
    expect(member.canEditGroup).toBe(true);
  });

  it("should handle Friend with all fields including optional online status", () => {
    const friend: Friend = {
      id: "friend-123",
      status: "accepted",
      createdAt: "2025-01-01T00:00:00Z",
      friendUserId: "friend-user-123",
      friendDiscordId: "123456789",
      friendUsername: "frienduser",
      friendDisplayName: "Friend Name",
      friendAvatar: "friend-avatar",
      friendPlayer: "Friend Player",
      friendTimeZone: "America/New_York",
      friendUsePlayerAsDisplayName: true,
      friendCode: "ABCD123",
      isOnline: true,
      isConnected: true,
    };

    expect(friend.friendUserId).toBeDefined();
    expect(friend.isOnline).toBe(true);
  });

  it("should handle FriendRequest with direction indicator", () => {
    const request: FriendRequest = {
      id: "request-123",
      status: "pending",
      createdAt: "2025-01-01T00:00:00Z",
      fromUserId: "from-user-123",
      fromDiscordId: "123456789",
      fromUsername: "fromuser",
      fromDisplayName: "From User",
      fromAvatar: "from-avatar",
      fromPlayer: "From Player",
      fromTimeZone: "America/New_York",
      fromUsePlayerAsDisplayName: false,
      direction: "incoming",
    };

    expect(request.direction).toMatch(/^(incoming|outgoing)$/);
  });
});

// ============================================================================
// Log Transmission Conversion Tests
// ============================================================================

describe("Log Transmission Conversions", () => {
  it("should convert Log to LogTransmit removing original and open fields", () => {
    const log: Log = {
      id: "log-123",
      userId: "user-123",
      player: "Player Name",
      emoji: "🚀",
      line: "Quantum jump initiated",
      timestamp: "2025-01-01T00:00:00Z",
      original: "[00:00:00.000] Quantum jump initiated",
      open: true,
      eventType: "quantum_travel",
    };

    const transmit = toLogTransmit(log);

    expect(transmit).not.toHaveProperty("original");
    expect(transmit).not.toHaveProperty("open");
    expect(transmit.id).toBe(log.id);
    expect(transmit.timestamp).toBe(log.timestamp);
  });

  it("should recursively convert nested Log children to LogTransmit", () => {
    const log: Log = {
      id: "log-parent",
      userId: "user-123",
      player: "Player",
      emoji: "💥",
      line: "Killing spree",
      timestamp: "2025-01-01T00:00:00Z",
      original: "[00:00:00.000] Killing spree",
      open: false,
      eventType: "killing_spree",
      children: [
        {
          id: "log-child-1",
          userId: "user-123",
          player: "Player",
          emoji: "💀",
          line: "Killed enemy",
          timestamp: "2025-01-01T00:00:01Z",
          original: "[00:00:01.000] Killed enemy",
          open: false,
          eventType: "actor_death",
        },
      ],
    };

    const transmit = toLogTransmit(log);

    expect(transmit.children).toBeDefined();
    expect(transmit.children).toBeInstanceOf(Array);
    expect(transmit.children?.[0]).not.toHaveProperty("original");
    expect(transmit.children?.[0]).not.toHaveProperty("open");
  });

  it("should convert LogTransmit back to Log with default values", () => {
    const transmit: LogTransmit = {
      id: "log-123",
      userId: "user-123",
      player: "Player Name",
      emoji: "🚀",
      line: "Quantum jump",
      timestamp: "2025-01-01T00:00:00Z",
      eventType: "quantum_travel",
    };

    const log = fromLogTransmit(transmit);

    expect(log.original).toBe("");
    expect(log.open).toBe(false);
    expect(log.id).toBe(transmit.id);
  });

  it("should allow custom defaults in fromLogTransmit", () => {
    const transmit: LogTransmit = {
      id: "log-123",
      userId: "user-123",
      player: "Player",
      emoji: "🚀",
      line: "Quantum jump",
      timestamp: "2025-01-01T00:00:00Z",
    };

    const log = fromLogTransmit(transmit, {
      original: "[original]",
      open: true,
    });

    expect(log.original).toBe("[original]");
    expect(log.open).toBe(true);
  });

  it("should recursively convert nested LogTransmit children", () => {
    const transmit: LogTransmit = {
      id: "log-parent",
      userId: "user-123",
      player: "Player",
      emoji: "💥",
      line: "Killing spree",
      timestamp: "2025-01-01T00:00:00Z",
      eventType: "killing_spree",
      children: [
        {
          id: "log-child-1",
          userId: "user-123",
          player: "Player",
          emoji: "💀",
          line: "Killed enemy",
          timestamp: "2025-01-01T00:00:01Z",
          eventType: "actor_death",
        },
      ],
    };

    const log = fromLogTransmit(transmit);

    expect(log.children).toBeDefined();
    expect(log.children?.[0].original).toBe("");
    expect(log.children?.[0].open).toBe(false);
  });

  it("should handle empty children arrays", () => {
    const log: Log = {
      id: "log-123",
      userId: "user-123",
      player: "Player",
      emoji: "🚀",
      line: "Event",
      timestamp: "2025-01-01T00:00:00Z",
      original: "[original]",
      open: false,
      children: [],
    };

    const transmit = toLogTransmit(log);
    expect(transmit.children).toBeUndefined();

    const reconstructed = fromLogTransmit(transmit);
    expect(reconstructed.children).toBeUndefined();
  });
});

// ============================================================================
// User Profile Helper Function Tests
// ============================================================================

describe("User Profile Helper Functions", () => {
  it("getDisplayName should return player name when usePlayerAsDisplayName is true", () => {
    const profile: UserProfile = {
      id: "user-123",
      discordId: "123456789",
      username: "discorduser",
      avatar: "avatar-hash",
      player: "Player Name",
      timeZone: "America/New_York",
      usePlayerAsDisplayName: true,
      betaTester: false,
      friendCode: "ABC123",
      role: "user",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    };

    expect(getDisplayName(profile)).toBe("Player Name");
  });

  it("getDisplayName should return username when usePlayerAsDisplayName is false", () => {
    const profile: UserProfile = {
      id: "user-123",
      discordId: "123456789",
      username: "discorduser",
      avatar: "avatar-hash",
      player: "Player Name",
      timeZone: "America/New_York",
      usePlayerAsDisplayName: false,
      betaTester: false,
      friendCode: "ABC123",
      role: "user",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    };

    expect(getDisplayName(profile)).toBe("discorduser");
  });

  it("getDisplayName should return username when player is null", () => {
    const profile: UserProfile = {
      id: "user-123",
      discordId: "123456789",
      username: "discorduser",
      avatar: "avatar-hash",
      player: null,
      timeZone: "America/New_York",
      usePlayerAsDisplayName: true,
      betaTester: false,
      friendCode: "ABC123",
      role: "user",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    };

    expect(getDisplayName(profile)).toBe("discorduser");
  });

  it("getSecondaryName should return username when showing player name", () => {
    const profile: UserProfile = {
      id: "user-123",
      discordId: "123456789",
      username: "discorduser",
      avatar: "avatar-hash",
      player: "Player Name",
      timeZone: "America/New_York",
      usePlayerAsDisplayName: true,
      betaTester: false,
      friendCode: "ABC123",
      role: "user",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    };

    expect(getSecondaryName(profile)).toBe("discorduser");
  });

  it("getSecondaryName should return player name when showing username", () => {
    const profile: UserProfile = {
      id: "user-123",
      discordId: "123456789",
      username: "discorduser",
      avatar: "avatar-hash",
      player: "Player Name",
      timeZone: "America/New_York",
      usePlayerAsDisplayName: false,
      betaTester: false,
      friendCode: "ABC123",
      role: "user",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    };

    expect(getSecondaryName(profile)).toBe("Player Name");
  });

  it("hasPlayerName should return true when player is non-empty string", () => {
    const profile: UserProfile = {
      id: "user-123",
      discordId: "123456789",
      username: "discorduser",
      avatar: "avatar-hash",
      player: "Player Name",
      timeZone: "America/New_York",
      usePlayerAsDisplayName: false,
      betaTester: false,
      friendCode: "ABC123",
      role: "user",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    };

    expect(hasPlayerName(profile)).toBe(true);
  });

  it("hasPlayerName should return false when player is null", () => {
    const profile: UserProfile = {
      id: "user-123",
      discordId: "123456789",
      username: "discorduser",
      avatar: "avatar-hash",
      player: null,
      timeZone: "America/New_York",
      usePlayerAsDisplayName: false,
      betaTester: false,
      friendCode: "ABC123",
      role: "user",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    };

    expect(hasPlayerName(profile)).toBe(false);
  });

  it("hasPlayerName should return false when player is empty string", () => {
    const profile: UserProfile = {
      id: "user-123",
      discordId: "123456789",
      username: "discorduser",
      avatar: "avatar-hash",
      player: "   ",
      timeZone: "America/New_York",
      usePlayerAsDisplayName: false,
      betaTester: false,
      friendCode: "ABC123",
      role: "user",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    };

    expect(hasPlayerName(profile)).toBe(false);
  });

  it("formatUserDisplay should show both names when player exists", () => {
    const profile: UserProfile = {
      id: "user-123",
      discordId: "123456789",
      username: "discorduser",
      avatar: "avatar-hash",
      player: "Player Name",
      timeZone: "America/New_York",
      usePlayerAsDisplayName: true,
      betaTester: false,
      friendCode: "ABC123",
      role: "user",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    };

    expect(formatUserDisplay(profile)).toBe("Player Name (discorduser)");
  });

  it("formatUserDisplay should show only primary name when no secondary name", () => {
    const profile: UserProfile = {
      id: "user-123",
      discordId: "123456789",
      username: "discorduser",
      avatar: "avatar-hash",
      player: null,
      timeZone: "America/New_York",
      usePlayerAsDisplayName: false,
      betaTester: false,
      friendCode: "ABC123",
      role: "user",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    };

    expect(formatUserDisplay(profile)).toBe("discorduser");
  });
});

// ============================================================================
// Pagination Helper Function Tests
// ============================================================================

describe("Pagination Helper Functions", () => {
  it("calculateTotalPages should handle zero items", () => {
    expect(calculateTotalPages(0, 10)).toBe(1);
  });

  it("calculateTotalPages should round up partial pages", () => {
    expect(calculateTotalPages(25, 10)).toBe(3);
  });

  it("calculateTotalPages should handle exact page boundaries", () => {
    expect(calculateTotalPages(50, 10)).toBe(5);
  });

  it("calculateTotalPages should handle single item", () => {
    expect(calculateTotalPages(1, 10)).toBe(1);
  });

  it("calculateTotalPages should return 1 for invalid perPage", () => {
    expect(calculateTotalPages(100, 0)).toBe(1);
    expect(calculateTotalPages(100, -1)).toBe(1);
  });

  it("hasMorePages should return true when not on last page", () => {
    expect(hasMorePages(1, 5)).toBe(true);
  });

  it("hasMorePages should return false when on last page", () => {
    expect(hasMorePages(5, 5)).toBe(false);
  });

  it("hasMorePages should return false when beyond last page", () => {
    expect(hasMorePages(6, 5)).toBe(false);
  });

  it("createPaginationMetadata should create valid metadata", () => {
    const metadata = createPaginationMetadata(2, 25, 100);

    expect(metadata.page).toBe(2);
    expect(metadata.perPage).toBe(25);
    expect(metadata.total).toBe(100);
    expect(metadata.totalPages).toBe(4);
    expect(metadata.hasMore).toBe(true);
  });

  it("createPaginationMetadata should have hasMore false on last page", () => {
    const metadata = createPaginationMetadata(4, 25, 100);

    expect(metadata.hasMore).toBe(false);
  });

  it("createPaginationMetadata should handle single page", () => {
    const metadata = createPaginationMetadata(1, 100, 50);

    expect(metadata.totalPages).toBe(1);
    expect(metadata.hasMore).toBe(false);
  });
});

// ============================================================================
// Type Compatibility Tests
// ============================================================================

describe("Type Compatibility", () => {
  it("should allow Group to be used in GroupsListResponse", () => {
    const groups: Group[] = [
      {
        id: "group-1",
        name: "Test Group",
        avatar: null,
        memberCount: 5,
        memberRole: "admin",
        tags: [],
        visibility: "private",
        joinMethod: "request",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      },
    ];

    expect(groups).toHaveLength(1);
    expect(groups[0].memberCount).toBe(5);
  });

  it("should allow Friend to be used in FriendsListResponse", () => {
    const friends: Friend[] = [
      {
        id: "friendship-1",
        status: "accepted",
        createdAt: "2025-01-01T00:00:00Z",
        friendUserId: "user-1",
        friendDiscordId: "123",
        friendUsername: "user",
        friendDisplayName: "User",
        friendAvatar: null,
        friendPlayer: null,
        friendTimeZone: null,
        friendUsePlayerAsDisplayName: false,
      },
    ];

    expect(friends).toHaveLength(1);
    expect(friends[0].status).toBe("accepted");
  });

  it("should allow pagination metadata with correct structure", () => {
    const pagination: PaginationMetadata = {
      page: 1,
      perPage: 50,
      total: 250,
      totalPages: 5,
      hasMore: true,
    };

    expect(pagination.totalPages).toBe(5);
    expect(pagination.hasMore).toBe(true);
  });

  it("should handle optional fields in UserProfile correctly", () => {
    const profile1: UserProfile = {
      id: "user-1",
      discordId: "123",
      username: "user",
      avatar: null,
      player: null,
      timeZone: null,
      usePlayerAsDisplayName: false,
      showTimezone: true,
      betaTester: false,
      friendCode: null,
      role: "user",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    };

    const profile2: UserProfile = {
      id: "user-2",
      discordId: "456",
      username: "user2",
      avatar: "hash",
      player: "PlayerName",
      timeZone: "UTC",
      usePlayerAsDisplayName: true,
      betaTester: false,
      friendCode: "CODE123",
      role: "user",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    };

    expect(profile1.avatar).toBeNull();
    expect(profile2.avatar).not.toBeNull();
  });
});

// ============================================================================
// Edge Cases and Boundary Tests
// ============================================================================

describe("Edge Cases and Boundary Conditions", () => {
  it("should handle very large pagination values", () => {
    const metadata = createPaginationMetadata(999999, 1000, 999999000);
    expect(metadata.page).toBe(999999);
    expect(metadata.totalPages).toBeGreaterThan(0);
  });

  it("should handle Log with empty metadata", () => {
    const log: Log = {
      id: "log-123",
      userId: "user-123",
      player: "Player",
      emoji: "🚀",
      line: "Event",
      timestamp: "2025-01-01T00:00:00Z",
      original: "Original",
      open: false,
      metadata: {},
    };

    expect(log.metadata).toBeDefined();
    expect(Object.keys(log.metadata!)).toHaveLength(0);
  });

  it("should handle Log with deeply nested children", () => {
    const level3: Log = {
      id: "log-3",
      userId: "user",
      player: "P",
      emoji: "3",
      line: "L3",
      timestamp: "2025-01-01T00:00:03Z",
      original: "O3",
      open: false,
    };

    const level2: Log = {
      id: "log-2",
      userId: "user",
      player: "P",
      emoji: "2",
      line: "L2",
      timestamp: "2025-01-01T00:00:02Z",
      original: "O2",
      open: false,
      children: [level3],
    };

    const level1: Log = {
      id: "log-1",
      userId: "user",
      player: "P",
      emoji: "1",
      line: "L1",
      timestamp: "2025-01-01T00:00:01Z",
      original: "O1",
      open: false,
      children: [level2],
    };

    const transmit = toLogTransmit(level1);
    const reconstructed = fromLogTransmit(transmit);

    expect(reconstructed.children?.[0].children?.[0].id).toBe("log-3");
  });

  it("should handle GroupMember with minimal permissions", () => {
    const member: GroupMember = {
      groupId: "group-1",
      userId: "user-1",
      discordId: "123",
      username: "user",
      displayName: "User",
      player: null,
      avatar: null,
      timeZone: null,
      role: "member",
      canInvite: false,
      canRemoveMembers: false,
      canEditGroup: false,
      joinedAt: "2025-01-01T00:00:00Z",
    };

    expect(member.canInvite).toBe(false);
    expect(member.canRemoveMembers).toBe(false);
    expect(member.canEditGroup).toBe(false);
  });

  it("should handle Friend with no online status fields", () => {
    const friend: Friend = {
      id: "friend-1",
      status: "pending",
      createdAt: "2025-01-01T00:00:00Z",
      friendUserId: "user-1",
      friendDiscordId: "123",
      friendUsername: "user",
      friendDisplayName: "User",
      friendAvatar: null,
      friendPlayer: null,
      friendTimeZone: null,
      friendUsePlayerAsDisplayName: false,
    };

    expect(friend.isOnline).toBeUndefined();
    expect(friend.isConnected).toBeUndefined();
  });
});
