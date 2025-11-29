/**
 * Contract Verification Tests
 *
 * These tests validate that all WebSocket message schemas are correctly defined
 * and can validate real message structures. Contract tests ensure that:
 *
 * 1. All schemas can parse valid data
 * 2. All schemas reject invalid data
 * 3. Request/response pairs are properly matched
 * 4. All message types in the registry are functional
 *
 * @module types/websocket/contracts/contracts.test
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  // Core schemas
  PaginationMetadataSchema,
  UserProfileSchema,
  FriendSchema,
  FriendRequestSchema,
  GroupSchema,
  GroupMemberSchema,
  GroupInvitationSchema,
  DiscoverableGroupSchema,
  GroupJoinRequestSchema,
  LogSchema,
  LogTransmitSchema,

  // Message schemas
  MessageSchemas,
  validateMessage,
  validateWebSocketMessage,
  ClientMessageSchema,
  ServerMessageSchema,

  // Individual message schemas for detailed testing
  RegisterMessageSchema,
  DashboardDataResponseSchema,
  FriendsListResponseSchema,
  GroupsListResponseSchema,
} from "./index.js";

// ============================================================================
// Test Fixtures
// ============================================================================

const validUUID = "123e4567-e89b-12d3-a456-426614174000";
const validTimestamp = "2025-01-27T12:00:00.000Z";

const fixtures = {
  paginationMetadata: {
    page: 1,
    perPage: 20,
    total: 100,
    totalPages: 5,
    hasMore: true,
  },

  userProfile: {
    id: validUUID,
    discordId: "123456789012345678",
    username: "testuser",
    avatar: "abc123",
    player: "TestPlayer",
    timeZone: "America/New_York",
    usePlayerAsDisplayName: true,
    showTimezone: true,
    friendCode: "ABC123",
    role: "user" as const,
    createdAt: validTimestamp,
    updatedAt: validTimestamp,
    displayName: "TestPlayer",
  },

  friend: {
    id: validUUID,
    status: "accepted",
    createdAt: validTimestamp,
    friendUserId: validUUID,
    friendDiscordId: "123456789012345678",
    friendUsername: "friend_user",
    friendDisplayName: "FriendPlayer",
    friendAvatar: "def456",
    friendPlayer: "FriendPlayer",
    friendTimeZone: "Europe/London",
    friendUsePlayerAsDisplayName: true,
    friendCode: "XYZ789",
    isOnline: true,
    isConnected: true,
  },

  friendRequest: {
    id: validUUID,
    status: "pending",
    createdAt: validTimestamp,
    fromUserId: validUUID,
    fromDiscordId: "123456789012345678",
    fromUsername: "requester",
    fromDisplayName: "RequesterPlayer",
    fromAvatar: null,
    fromPlayer: "RequesterPlayer",
    fromTimeZone: null,
    fromUsePlayerAsDisplayName: true,
    direction: "incoming" as const,
  },

  group: {
    id: validUUID,
    name: "Test Group",
    description: "A test group",
    avatar: null,
    memberCount: 5,
    memberRole: "owner" as const,
    tags: ["gaming", "star-citizen"],
    ownerId: validUUID,
    visibility: "discoverable" as const,
    joinMethod: "request" as const,
    createdAt: validTimestamp,
    updatedAt: validTimestamp,
    pendingJoinRequestCount: 2,
  },

  groupMember: {
    id: validUUID,
    groupId: validUUID,
    userId: validUUID,
    discordId: "123456789012345678",
    username: "member",
    displayName: "MemberPlayer",
    player: "MemberPlayer",
    avatar: null,
    timeZone: "UTC",
    role: "member" as const,
    usePlayerAsDisplayName: true,
    joinedAt: validTimestamp,
    canInvite: false,
    canRemoveMembers: false,
    canEditGroup: false,
    isOnline: false,
    isConnected: false,
  },

  groupInvitation: {
    id: validUUID,
    groupId: validUUID,
    group: {
      id: validUUID,
      name: "Invited Group",
      description: "Group you were invited to",
      avatar: null,
      tags: ["test"],
    },
    inviterId: validUUID,
    inviterUsername: "inviter",
    inviterDisplayName: "InviterPlayer",
    inviterAvatar: null,
    inviterPlayer: "InviterPlayer",
    createdAt: validTimestamp,
    status: "pending",
  },

  discoverableGroup: {
    id: validUUID,
    name: "Public Group",
    description: "A public group",
    avatar: null,
    tags: ["public", "open"],
    memberCount: 10,
    joinMethod: "open" as const,
    createdAt: validTimestamp,
    ownerUsername: "group_owner",
    ownerAvatar: null,
    isJoined: false,
    hasPendingRequest: false,
  },

  groupJoinRequest: {
    id: validUUID,
    groupId: validUUID,
    groupName: "Requested Group",
    groupAvatar: null,
    userId: validUUID,
    username: "joiner",
    displayName: "JoinerPlayer",
    avatar: null,
    message: "I want to join!",
    status: "pending" as const,
    createdAt: validTimestamp,
  },

  log: {
    id: "log-123",
    userId: validUUID,
    player: "TestPlayer",
    emoji: "💀",
    line: "TestPlayer was killed by Enemy",
    timestamp: validTimestamp,
    original: "<2025-01-27T12:00:00> [Actor] Death event...",
    open: false,
    reportedBy: [validUUID],
    eventType: "actor_death" as const,
    metadata: {
      victimName: "TestPlayer",
      killerName: "Enemy",
      weaponClass: "Laser Rifle",
    },
  },

  logTransmit: {
    id: "log-123",
    userId: validUUID,
    player: "TestPlayer",
    emoji: "💀",
    line: "TestPlayer was killed by Enemy",
    timestamp: validTimestamp,
    reportedBy: [validUUID],
    eventType: "actor_death" as const,
    metadata: {
      victimName: "TestPlayer",
      killerName: "Enemy",
    },
  },
};

// ============================================================================
// Core Schema Tests
// ============================================================================

describe("Core Schemas", () => {
  describe("PaginationMetadataSchema", () => {
    it("validates correct pagination data", () => {
      const result = PaginationMetadataSchema.safeParse(
        fixtures.paginationMetadata,
      );
      expect(result.success).toBe(true);
    });

    it("rejects negative page number", () => {
      const result = PaginationMetadataSchema.safeParse({
        ...fixtures.paginationMetadata,
        page: -1,
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing required fields", () => {
      const result = PaginationMetadataSchema.safeParse({
        page: 1,
        perPage: 20,
        // missing total, totalPages, hasMore
      });
      expect(result.success).toBe(false);
    });
  });

  describe("UserProfileSchema", () => {
    it("validates correct user profile", () => {
      const result = UserProfileSchema.safeParse(fixtures.userProfile);
      expect(result.success).toBe(true);
    });

    it("accepts null optional fields", () => {
      const result = UserProfileSchema.safeParse({
        ...fixtures.userProfile,
        avatar: null,
        player: null,
        timeZone: null,
        friendCode: null,
      });
      expect(result.success).toBe(true);
    });

    it("validates role enum", () => {
      const resultUser = UserProfileSchema.safeParse({
        ...fixtures.userProfile,
        role: "user",
      });
      expect(resultUser.success).toBe(true);

      const resultAdmin = UserProfileSchema.safeParse({
        ...fixtures.userProfile,
        role: "admin",
      });
      expect(resultAdmin.success).toBe(true);

      const resultInvalid = UserProfileSchema.safeParse({
        ...fixtures.userProfile,
        role: "superuser",
      });
      expect(resultInvalid.success).toBe(false);
    });
  });

  describe("FriendSchema", () => {
    it("validates correct friend data", () => {
      const result = FriendSchema.safeParse(fixtures.friend);
      expect(result.success).toBe(true);
    });

    it("accepts optional fields as undefined", () => {
      const { isOnline, isConnected, friendCode, ...required } =
        fixtures.friend;
      const result = FriendSchema.safeParse(required);
      expect(result.success).toBe(true);
    });
  });

  describe("FriendRequestSchema", () => {
    it("validates correct friend request", () => {
      const result = FriendRequestSchema.safeParse(fixtures.friendRequest);
      expect(result.success).toBe(true);
    });

    it("validates direction enum", () => {
      const incoming = FriendRequestSchema.safeParse({
        ...fixtures.friendRequest,
        direction: "incoming",
      });
      expect(incoming.success).toBe(true);

      const outgoing = FriendRequestSchema.safeParse({
        ...fixtures.friendRequest,
        direction: "outgoing",
      });
      expect(outgoing.success).toBe(true);

      const invalid = FriendRequestSchema.safeParse({
        ...fixtures.friendRequest,
        direction: "unknown",
      });
      expect(invalid.success).toBe(false);
    });
  });

  describe("GroupSchema", () => {
    it("validates correct group data", () => {
      const result = GroupSchema.safeParse(fixtures.group);
      expect(result.success).toBe(true);
    });

    it("validates role enum", () => {
      const roles = ["owner", "admin", "member"];
      roles.forEach((role) => {
        const result = GroupSchema.safeParse({
          ...fixtures.group,
          memberRole: role,
        });
        expect(result.success).toBe(true);
      });
    });

    it("validates visibility enum", () => {
      const visibilities = ["private", "discoverable"];
      visibilities.forEach((visibility) => {
        const result = GroupSchema.safeParse({
          ...fixtures.group,
          visibility,
        });
        expect(result.success).toBe(true);
      });
    });

    it("validates joinMethod enum", () => {
      const methods = ["open", "request"];
      methods.forEach((joinMethod) => {
        const result = GroupSchema.safeParse({
          ...fixtures.group,
          joinMethod,
        });
        expect(result.success).toBe(true);
      });
    });
  });

  describe("GroupMemberSchema", () => {
    it("validates correct group member", () => {
      const result = GroupMemberSchema.safeParse(fixtures.groupMember);
      expect(result.success).toBe(true);
    });
  });

  describe("GroupInvitationSchema", () => {
    it("validates correct group invitation", () => {
      const result = GroupInvitationSchema.safeParse(fixtures.groupInvitation);
      expect(result.success).toBe(true);
    });
  });

  describe("DiscoverableGroupSchema", () => {
    it("validates correct discoverable group", () => {
      const result = DiscoverableGroupSchema.safeParse(
        fixtures.discoverableGroup,
      );
      expect(result.success).toBe(true);
    });
  });

  describe("GroupJoinRequestSchema", () => {
    it("validates correct join request", () => {
      const result = GroupJoinRequestSchema.safeParse(
        fixtures.groupJoinRequest,
      );
      expect(result.success).toBe(true);
    });

    it("validates status enum", () => {
      const statuses = ["pending", "approved", "denied"];
      statuses.forEach((status) => {
        const result = GroupJoinRequestSchema.safeParse({
          ...fixtures.groupJoinRequest,
          status,
        });
        expect(result.success).toBe(true);
      });
    });
  });

  describe("LogSchema", () => {
    it("validates correct log", () => {
      const result = LogSchema.safeParse(fixtures.log);
      expect(result.success).toBe(true);
    });

    it("validates log with children (recursive)", () => {
      const logWithChildren = {
        ...fixtures.log,
        eventType: "killing_spree",
        children: [
          { ...fixtures.log, id: "child-1" },
          { ...fixtures.log, id: "child-2" },
        ],
      };
      const result = LogSchema.safeParse(logWithChildren);
      expect(result.success).toBe(true);
    });
  });

  describe("LogTransmitSchema", () => {
    it("validates correct log transmit (without original/open)", () => {
      const result = LogTransmitSchema.safeParse(fixtures.logTransmit);
      expect(result.success).toBe(true);
    });
  });
});

// ============================================================================
// Message Schema Registry Tests
// ============================================================================

describe("Message Schema Registry", () => {
  it("has schemas for all expected message types", () => {
    const expectedTypes = [
      // Auth
      "register",
      "registered",
      // Keepalive
      "ping",
      "pong",
      // Errors
      "error",
      // Friends
      "get_friends",
      "friends_list",
      "get_friend_requests",
      "friend_requests",
      "send_friend_request",
      "accept_friend_request",
      "deny_friend_request",
      "cancel_friend_request",
      "remove_friend",
      "friend_profile_updated",
      // Groups
      "get_groups",
      "groups_list",
      "get_group_members",
      "group_members",
      "create_group",
      "update_group",
      "delete_group",
      "leave_group",
      "update_member_role",
      "remove_member_from_group",
      "get_group_invitations",
      "group_invitations",
      "invite_friend_to_group",
      "accept_group_invitation",
      "deny_group_invitation",
      "cancel_group_invitation",
      "group_member_profile_updated",
      // Discovery
      "get_discoverable_groups",
      "discoverable_groups",
      "get_discover_tags",
      "discover_tags",
      "join_open_group",
      "join_open_group_result",
      "request_join_group",
      "request_join_group_result",
      "get_join_requests",
      "join_requests",
      "review_join_request",
      "review_join_request_result",
      "new_join_request",
      "join_request_reviewed",
      // Dashboard
      "get_dashboard_data",
      "dashboard_data",
      // Profile
      "get_user_profile",
      "user_profile",
      "update_user_profile",
      "delete_user_profile",
      // Logs
      "send_logs",
      "batch_logs",
      "batch_group_logs",
      // Log Schema Discovery
      "report_log_patterns",
      "get_log_pattern_stats",
    ];

    expectedTypes.forEach((type) => {
      expect(MessageSchemas[type as keyof typeof MessageSchemas]).toBeDefined();
    });
  });

  it("all schemas in registry have safeParse function", () => {
    Object.entries(MessageSchemas).forEach(([type, schema]) => {
      expect(schema.safeParse).toBeDefined();
      expect(typeof schema.safeParse).toBe("function");
    });
  });
});

// ============================================================================
// Message Validation Tests
// ============================================================================

describe("Message Validation", () => {
  describe("validateMessage helper", () => {
    it("validates register message", () => {
      const result = validateMessage("register", {
        type: "register",
        userId: validUUID,
        token: "jwt-token-here",
      });
      expect(result.success).toBe(true);
    });

    it("validates ping message", () => {
      const result = validateMessage("ping", { type: "ping" });
      expect(result.success).toBe(true);
    });

    it("rejects malformed message", () => {
      const result = validateMessage("register", {
        type: "register",
        // missing userId and token
      });
      expect(result.success).toBe(false);
    });
  });

  describe("validateWebSocketMessage helper", () => {
    it("validates client messages", () => {
      const result = validateWebSocketMessage({
        type: "get_friends",
        data: { page: 1, perPage: 20 },
      });
      expect(result.success).toBe(true);
    });

    it("validates server messages", () => {
      const result = validateWebSocketMessage({
        type: "pong",
      });
      expect(result.success).toBe(true);
    });
  });
});

// ============================================================================
// Request/Response Pair Tests
// ============================================================================

describe("Request/Response Pairs", () => {
  const requestResponsePairs = [
    { request: "get_friends", response: "friends_list" },
    { request: "get_friend_requests", response: "friend_requests" },
    { request: "get_groups", response: "groups_list" },
    { request: "get_group_members", response: "group_members" },
    { request: "get_group_invitations", response: "group_invitations" },
    { request: "get_discoverable_groups", response: "discoverable_groups" },
    { request: "get_discover_tags", response: "discover_tags" },
    { request: "get_join_requests", response: "join_requests" },
    { request: "get_dashboard_data", response: "dashboard_data" },
    { request: "get_user_profile", response: "user_profile" },
    { request: "ping", response: "pong" },
    { request: "register", response: "registered" },
    { request: "join_open_group", response: "join_open_group_result" },
    { request: "request_join_group", response: "request_join_group_result" },
    { request: "review_join_request", response: "review_join_request_result" },
  ];

  requestResponsePairs.forEach(({ request, response }) => {
    it(`${request} -> ${response} pair exists`, () => {
      expect(
        MessageSchemas[request as keyof typeof MessageSchemas],
      ).toBeDefined();
      expect(
        MessageSchemas[response as keyof typeof MessageSchemas],
      ).toBeDefined();
    });
  });
});

// ============================================================================
// Complex Message Tests
// ============================================================================

describe("Complex Messages", () => {
  describe("DashboardDataResponse", () => {
    it("validates complete dashboard response", () => {
      const dashboardResponse = {
        type: "dashboard_data",
        data: {
          user: {
            id: validUUID,
            username: "testuser",
            avatar: null,
          },
          friends: [fixtures.friend],
          friendsPagination: fixtures.paginationMetadata,
          groups: [fixtures.group],
          groupsPagination: fixtures.paginationMetadata,
          logs: [],
          notifications: {
            friendRequests: [
              {
                id: validUUID,
                userId: validUUID,
                friendId: validUUID,
                status: "pending",
                createdAt: validTimestamp,
                requesterDiscordId: "123456789012345678",
                requesterUsername: "requester",
                requesterDisplayName: "RequesterPlayer",
                requesterAvatar: null,
                requesterPlayer: "RequesterPlayer",
              },
            ],
            groupInvitations: [
              {
                id: validUUID,
                groupId: validUUID,
                inviterId: validUUID,
                inviteeId: validUUID,
                status: "pending",
                createdAt: validTimestamp,
                groupName: "Test Group",
                groupAvatar: null,
                inviterUsername: "inviter",
                inviterDisplayName: "InviterPlayer",
                inviterAvatar: null,
              },
            ],
          },
        },
      };

      const result = DashboardDataResponseSchema.safeParse(dashboardResponse);
      expect(result.success).toBe(true);
    });
  });

  describe("FriendsListResponse", () => {
    it("validates friends list with pagination", () => {
      const response = {
        type: "friends_list",
        data: [fixtures.friend],
        pagination: fixtures.paginationMetadata,
      };

      const result = FriendsListResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });

  describe("GroupsListResponse", () => {
    it("validates groups array format", () => {
      const response = {
        type: "groups_list",
        data: [fixtures.group],
      };

      const result = GroupsListResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it("validates groups with members format", () => {
      const response = {
        type: "groups_list",
        data: {
          groups: [fixtures.group],
          members: {
            [validUUID]: [fixtures.groupMember],
          },
        },
      };

      const result = GroupsListResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe("Error Handling", () => {
  it("provides detailed error information on validation failure", () => {
    const result = UserProfileSchema.safeParse({
      id: "not-a-uuid",
      discordId: 123, // should be string
      username: null, // should be string
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });

  it("error message schema validates correctly", () => {
    const errorMsg = {
      type: "error",
      message: "Something went wrong",
      error: "INVALID_REQUEST",
      requestId: "req-123",
    };

    const result = validateMessage("error", errorMsg);
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// Union Schema Tests
// ============================================================================

describe("Union Schemas", () => {
  describe("ClientMessageSchema", () => {
    it("discriminates by type field", () => {
      const messages = [
        { type: "register", userId: validUUID, token: "token" },
        { type: "ping" },
        { type: "get_friends" },
        { type: "get_groups" },
      ];

      messages.forEach((msg) => {
        const result = ClientMessageSchema.safeParse(msg);
        expect(result.success).toBe(true);
      });
    });

    it("rejects unknown message types", () => {
      const result = ClientMessageSchema.safeParse({
        type: "unknown_message",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("ServerMessageSchema", () => {
    it("discriminates by type field", () => {
      const messages = [
        { type: "registered" },
        { type: "pong" },
        {
          type: "friends_list",
          data: [],
          pagination: fixtures.paginationMetadata,
        },
      ];

      messages.forEach((msg) => {
        const result = ServerMessageSchema.safeParse(msg);
        expect(result.success).toBe(true);
      });
    });
  });
});

// ============================================================================
// Total Schema Count
// ============================================================================

describe("Schema Coverage", () => {
  it("has at least 50 message type schemas", () => {
    const schemaCount = Object.keys(MessageSchemas).length;
    expect(schemaCount).toBeGreaterThanOrEqual(50);
  });
});
