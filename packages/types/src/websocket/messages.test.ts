/**
 * WebSocket Messages Runtime Validation Tests
 *
 * Tests cover:
 * - Message serialization and deserialization
 * - Type guards for message validation
 * - JSON round-trip testing
 * - Message structure validation
 * - Edge cases and malformed messages
 */

import { describe, it, expect } from "vitest";
import type {
  BaseMessage,
  RegisterMessage,
  RegisteredMessage,
  PingMessage,
  PongMessage,
  GetFriendsRequest,
  FriendsListResponse,
  GetFriendRequestsRequest,
  FriendRequestsMessage,
  GetGroupsRequest,
  GroupsListResponse,
  GetGroupMembersRequest,
  GroupMembersResponse,
  UpdateGroupRequest,
  DeleteGroupRequest,
  LeaveGroupRequest,
  UpdateMemberRoleRequest,
  RemoveMemberFromGroupRequest,
  GetGroupInvitationsRequest,
  GroupInvitationsResponse,
  DashboardDataRequest,
  DashboardDataResponse,
  GetUserProfileRequest,
  UserProfileResponse,
  UpdateUserProfileRequest,
  SendLogsMessage,
  ErrorMessage,
  ClientMessage,
  ServerMessage,
  WebSocketMessage,
} from "./messages.js";

// ============================================================================
// Helper Functions for Runtime Validation
// ============================================================================

/**
 * Simulates JSON serialization and deserialization
 */
function jsonRoundTrip<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Type guard to check if message is a valid BaseMessage
 */
function isBaseMessage(msg: unknown): msg is BaseMessage {
  return (
    typeof msg === "object" &&
    msg !== null &&
    "type" in msg &&
    typeof (msg as any).type === "string"
  );
}

// ============================================================================
// Base Message Structure Tests
// ============================================================================

describe("WebSocket Messages - Base Message", () => {
  it("should validate minimal BaseMessage structure", () => {
    const msg: BaseMessage = {
      type: "test",
    };

    expect(isBaseMessage(msg)).toBe(true);
    expect(msg.type).toBe("test");
  });

  it("should validate BaseMessage with all optional fields", () => {
    const msg: BaseMessage = {
      type: "test",
      requestId: "req-123",
      timestamp: "2025-01-01T00:00:00Z",
      data: { key: "value" },
      error: "error message",
      message: "info message",
    };

    expect(isBaseMessage(msg)).toBe(true);
    expect(msg.requestId).toBe("req-123");
    expect(msg.timestamp).toBeDefined();
    expect(msg.data).toBeDefined();
    expect(msg.error).toBeDefined();
    expect(msg.message).toBeDefined();
  });

  it("should survive JSON round-trip", () => {
    const original: BaseMessage = {
      type: "test",
      requestId: "req-123",
      timestamp: "2025-01-01T00:00:00Z",
      data: { nested: { value: 42 } },
    };

    const roundTripped = jsonRoundTrip(original);

    expect(roundTripped).toEqual(original);
    expect(roundTripped.type).toBe("test");
    expect(roundTripped.data).toEqual({ nested: { value: 42 } });
  });
});

// ============================================================================
// Authentication Message Tests
// ============================================================================

describe("WebSocket Messages - Authentication", () => {
  it("should serialize and deserialize RegisterMessage", () => {
    const msg: RegisterMessage = {
      type: "register",
      userId: "discord-123",
      token: "jwt-token-here",
      metadata: {
        platform: "desktop",
        version: "1.0.0",
      },
    };

    const roundTripped = jsonRoundTrip(msg);

    expect(roundTripped.type).toBe("register");
    expect(roundTripped.userId).toBe("discord-123");
    expect(roundTripped.token).toBe("jwt-token-here");
    expect(roundTripped.metadata).toEqual({
      platform: "desktop",
      version: "1.0.0",
    });
  });

  it("should handle RegisterMessage without metadata", () => {
    const msg: RegisterMessage = {
      type: "register",
      userId: "discord-123",
      token: "jwt-token-here",
    };

    const roundTripped = jsonRoundTrip(msg);

    expect(roundTripped.type).toBe("register");
    expect(roundTripped.metadata).toBeUndefined();
  });

  it("should serialize and deserialize RegisteredMessage", () => {
    const msg: RegisteredMessage = {
      type: "registered",
      data: {
        message: "Successfully registered",
      },
    };

    const roundTripped = jsonRoundTrip(msg);

    expect(roundTripped.type).toBe("registered");
    expect(roundTripped.data?.message).toBe("Successfully registered");
  });

  it("should handle RegisteredMessage without data", () => {
    const msg: RegisteredMessage = {
      type: "registered",
    };

    const roundTripped = jsonRoundTrip(msg);

    expect(roundTripped.type).toBe("registered");
    expect(roundTripped.data).toBeUndefined();
  });
});

// ============================================================================
// Keepalive Message Tests
// ============================================================================

describe("WebSocket Messages - Keepalive", () => {
  it("should serialize and deserialize PingMessage", () => {
    const msg: PingMessage = {
      type: "ping",
    };

    const roundTripped = jsonRoundTrip(msg);

    expect(roundTripped.type).toBe("ping");
  });

  it("should serialize and deserialize PongMessage", () => {
    const msg: PongMessage = {
      type: "pong",
    };

    const roundTripped = jsonRoundTrip(msg);

    expect(roundTripped.type).toBe("pong");
  });
});

// ============================================================================
// Friend Message Tests
// ============================================================================

describe("WebSocket Messages - Friends", () => {
  it("should serialize GetFriendsRequest with pagination", () => {
    const msg: GetFriendsRequest = {
      type: "get_friends",
      data: {
        page: 2,
        perPage: 50,
        sortBy: "online",
      },
    };

    const roundTripped = jsonRoundTrip(msg);

    expect(roundTripped.type).toBe("get_friends");
    expect(roundTripped.data?.page).toBe(2);
    expect(roundTripped.data?.perPage).toBe(50);
    expect(roundTripped.data?.sortBy).toBe("online");
  });

  it("should handle GetFriendsRequest without data", () => {
    const msg: GetFriendsRequest = {
      type: "get_friends",
    };

    const roundTripped = jsonRoundTrip(msg);

    expect(roundTripped.type).toBe("get_friends");
    expect(roundTripped.data).toBeUndefined();
  });

  it("should serialize FriendsListResponse", () => {
    const msg: FriendsListResponse = {
      type: "friends_list",
      data: [
        {
          id: "friend-1",
          friendUserId: "user-2",
          friendDiscordId: "123456789",
          friendUsername: "friend1",
          friendDisplayName: "Friend One",
          friendAvatar: "avatar-hash",
          friendPlayer: "PlayerName",
          friendTimeZone: null,
          friendUsePlayerAsDisplayName: false,
          isOnline: true,
          status: "accepted",
          createdAt: "2025-01-01T00:00:00Z",
        },
      ],
      pagination: {
        total: 1,
        page: 1,
        perPage: 50,
        totalPages: 1,
        hasMore: false,
      },
    };

    const roundTripped = jsonRoundTrip(msg);

    expect(roundTripped.type).toBe("friends_list");
    expect(roundTripped.data).toHaveLength(1);
    expect(roundTripped.data[0].friendUsername).toBe("friend1");
    expect(roundTripped.pagination.total).toBe(1);
  });

  it("should serialize GetFriendRequestsRequest", () => {
    const msg: GetFriendRequestsRequest = {
      type: "get_friend_requests",
    };

    const roundTripped = jsonRoundTrip(msg);

    expect(roundTripped.type).toBe("get_friend_requests");
  });

  it("should serialize FriendRequestsMessage", () => {
    const msg: FriendRequestsMessage = {
      type: "friend_requests",
      data: {
        incoming: [
          {
            id: "req-1",
            fromUserId: "user-1",
            fromDiscordId: "123",
            fromUsername: "requester",
            fromDisplayName: "Requester",
            fromAvatar: null,
            fromPlayer: null,
            fromTimeZone: null,
            fromUsePlayerAsDisplayName: false,
            status: "pending",
            createdAt: "2025-01-01T00:00:00Z",
            direction: "incoming",
          },
        ],
        outgoing: [],
      },
    };

    const roundTripped = jsonRoundTrip(msg);

    expect(roundTripped.type).toBe("friend_requests");
    expect(roundTripped.data.incoming).toHaveLength(1);
    expect(roundTripped.data.outgoing).toHaveLength(0);
  });
});

// ============================================================================
// Group Message Tests
// ============================================================================

describe("WebSocket Messages - Groups", () => {
  it("should serialize GetGroupsRequest with includeMembers", () => {
    const msg: GetGroupsRequest = {
      type: "get_groups",
      data: {
        includeMembers: true,
      },
    };

    const roundTripped = jsonRoundTrip(msg);

    expect(roundTripped.type).toBe("get_groups");
    expect(roundTripped.data?.includeMembers).toBe(true);
  });

  it("should serialize GroupsListResponse with groups only", () => {
    const msg: GroupsListResponse = {
      type: "groups_list",
      data: [
        {
          id: "group-1",
          name: "Test Group",
          description: "A test group",
          avatar: null,
          tags: ["test"],
          ownerId: "user-1",
          memberRole: "owner",
          memberCount: 5,
          visibility: "private",
          joinMethod: "request",
          createdAt: "2025-01-01T00:00:00Z",
          updatedAt: "2025-01-01T00:00:00Z",
        },
      ],
    };

    const roundTripped = jsonRoundTrip(msg);

    expect(roundTripped.type).toBe("groups_list");
    expect(Array.isArray(roundTripped.data)).toBe(true);
    if (Array.isArray(roundTripped.data)) {
      expect(roundTripped.data).toHaveLength(1);
      expect(roundTripped.data[0].name).toBe("Test Group");
    }
  });

  it("should serialize GroupsListResponse with members", () => {
    const msg: GroupsListResponse = {
      type: "groups_list",
      data: {
        groups: [
          {
            id: "group-1",
            name: "Test Group",
            description: undefined,
            avatar: null,
            tags: [],
            ownerId: "user-1",
            memberRole: "owner",
            memberCount: 2,
            visibility: "private",
            joinMethod: "request",
            createdAt: "2025-01-01T00:00:00Z",
            updatedAt: "2025-01-01T00:00:00Z",
          },
        ],
        members: {
          "group-1": [
            {
              id: "member-1",
              groupId: "group-1",
              userId: "user-1",
              discordId: "123",
              username: "owner",
              displayName: "Owner",
              avatar: null,
              player: null,
              timeZone: null,
              role: "owner",
              canInvite: true,
              canRemoveMembers: true,
              canEditGroup: true,
              isOnline: true,
              joinedAt: "2025-01-01T00:00:00Z",
            },
          ],
        },
      },
    };

    const roundTripped = jsonRoundTrip(msg);

    expect(roundTripped.type).toBe("groups_list");
    expect(typeof roundTripped.data).toBe("object");
    if (
      typeof roundTripped.data === "object" &&
      !Array.isArray(roundTripped.data)
    ) {
      expect(roundTripped.data.groups).toHaveLength(1);
      expect(roundTripped.data.members["group-1"]).toHaveLength(1);
    }
  });

  it("should serialize GetGroupMembersRequest", () => {
    const msg: GetGroupMembersRequest = {
      type: "get_group_members",
      data: {
        groupId: "group-1",
      },
    };

    const roundTripped = jsonRoundTrip(msg);

    expect(roundTripped.type).toBe("get_group_members");
    expect(roundTripped.data.groupId).toBe("group-1");
  });

  it("should serialize GroupMembersResponse", () => {
    const msg: GroupMembersResponse = {
      type: "group_members",
      data: {
        members: [
          {
            id: "member-1",
            groupId: "group-1",
            userId: "user-1",
            discordId: "123",
            username: "member",
            displayName: "Member",
            avatar: null,
            player: null,
            timeZone: null,
            role: "member",
            canInvite: false,
            canRemoveMembers: false,
            canEditGroup: false,
            isOnline: false,
            joinedAt: "2025-01-01T00:00:00Z",
          },
        ],
      },
    };

    const roundTripped = jsonRoundTrip(msg);

    expect(roundTripped.type).toBe("group_members");
    expect(roundTripped.data.members).toHaveLength(1);
    expect(roundTripped.data.members[0].role).toBe("member");
  });

  it("should serialize UpdateGroupRequest", () => {
    const msg: UpdateGroupRequest = {
      type: "update_group",
      data: {
        groupId: "group-1",
        name: "Updated Name",
        description: "Updated description",
        avatar: "new-avatar",
        tags: ["new", "tags"],
      },
    };

    const roundTripped = jsonRoundTrip(msg);

    expect(roundTripped.type).toBe("update_group");
    expect(roundTripped.data.groupId).toBe("group-1");
    expect(roundTripped.data.name).toBe("Updated Name");
    expect(roundTripped.data.tags).toEqual(["new", "tags"]);
  });

  it("should serialize UpdateGroupRequest with null values", () => {
    const msg: UpdateGroupRequest = {
      type: "update_group",
      data: {
        groupId: "group-1",
        description: null,
        avatar: null,
        tags: null,
      },
    };

    const roundTripped = jsonRoundTrip(msg);

    expect(roundTripped.type).toBe("update_group");
    expect(roundTripped.data.description).toBeNull();
    expect(roundTripped.data.avatar).toBeNull();
    expect(roundTripped.data.tags).toBeNull();
  });

  it("should serialize DeleteGroupRequest", () => {
    const msg: DeleteGroupRequest = {
      type: "delete_group",
      data: {
        groupId: "group-1",
      },
    };

    const roundTripped = jsonRoundTrip(msg);

    expect(roundTripped.type).toBe("delete_group");
    expect(roundTripped.data.groupId).toBe("group-1");
  });

  it("should serialize LeaveGroupRequest", () => {
    const msg: LeaveGroupRequest = {
      type: "leave_group",
      data: {
        groupId: "group-1",
      },
    };

    const roundTripped = jsonRoundTrip(msg);

    expect(roundTripped.type).toBe("leave_group");
    expect(roundTripped.data.groupId).toBe("group-1");
  });

  it("should serialize UpdateMemberRoleRequest", () => {
    const msg: UpdateMemberRoleRequest = {
      type: "update_member_role",
      data: {
        groupId: "group-1",
        memberId: "member-1",
        role: "admin",
      },
    };

    const roundTripped = jsonRoundTrip(msg);

    expect(roundTripped.type).toBe("update_member_role");
    expect(roundTripped.data.role).toBe("admin");
  });

  it("should serialize RemoveMemberFromGroupRequest", () => {
    const msg: RemoveMemberFromGroupRequest = {
      type: "remove_member_from_group",
      data: {
        groupId: "group-1",
        memberId: "member-1",
      },
    };

    const roundTripped = jsonRoundTrip(msg);

    expect(roundTripped.type).toBe("remove_member_from_group");
    expect(roundTripped.data.memberId).toBe("member-1");
  });

  it("should serialize GetGroupInvitationsRequest", () => {
    const msg: GetGroupInvitationsRequest = {
      type: "get_group_invitations",
    };

    const roundTripped = jsonRoundTrip(msg);

    expect(roundTripped.type).toBe("get_group_invitations");
  });

  it("should serialize GroupInvitationsResponse", () => {
    const msg: GroupInvitationsResponse = {
      type: "group_invitations",
      data: [
        {
          id: "inv-1",
          groupId: "group-1",
          group: {
            id: "group-1",
            name: "Test Group",
            avatar: null,
          },
          inviterId: "user-1",
          inviterUsername: "inviter",
          inviterDisplayName: "Inviter",
          inviterAvatar: null,
          status: "pending",
          createdAt: "2025-01-01T00:00:00Z",
        },
      ],
    };

    const roundTripped = jsonRoundTrip(msg);

    expect(roundTripped.type).toBe("group_invitations");
    expect(roundTripped.data).toHaveLength(1);
    expect(roundTripped.data[0].status).toBe("pending");
  });
});

// ============================================================================
// Dashboard Message Tests
// ============================================================================

describe("WebSocket Messages - Dashboard", () => {
  it("should serialize DashboardDataRequest with all options", () => {
    const msg: DashboardDataRequest = {
      type: "get_dashboard_data",
      data: {
        friendsPage: 2,
        friendsPerPage: 100,
        includeGroupMembers: true,
      },
    };

    const roundTripped = jsonRoundTrip(msg);

    expect(roundTripped.type).toBe("get_dashboard_data");
    expect(roundTripped.data?.friendsPage).toBe(2);
    expect(roundTripped.data?.friendsPerPage).toBe(100);
    expect(roundTripped.data?.includeGroupMembers).toBe(true);
  });

  it("should handle DashboardDataRequest without data", () => {
    const msg: DashboardDataRequest = {
      type: "get_dashboard_data",
    };

    const roundTripped = jsonRoundTrip(msg);

    expect(roundTripped.type).toBe("get_dashboard_data");
    expect(roundTripped.data).toBeUndefined();
  });

  it("should serialize DashboardDataResponse", () => {
    const msg: DashboardDataResponse = {
      type: "dashboard_data",
      data: {
        user: {
          id: "user-1",
          username: "testuser",
          avatar: null,
        },
        friends: [],
        friendsPagination: {
          total: 0,
          page: 1,
          perPage: 50,
          totalPages: 0,
          hasMore: false,
        },
        groups: [],
        groupsPagination: {
          total: 0,
          page: 1,
          perPage: 50,
          totalPages: 0,
          hasMore: false,
        },
        logs: [],
        notifications: {
          friendRequests: [],
          groupInvitations: [],
        },
      },
    };

    const roundTripped = jsonRoundTrip(msg);

    expect(roundTripped.type).toBe("dashboard_data");
    expect(roundTripped.data.friends).toEqual([]);
    expect(roundTripped.data.groups).toEqual([]);
    expect(roundTripped.data.logs).toEqual([]);
    expect(roundTripped.data.friendsPagination).toBeDefined();
  });

  it("should serialize DashboardDataResponse with groupMembers", () => {
    const msg: DashboardDataResponse = {
      type: "dashboard_data",
      data: {
        user: {
          id: "user-1",
          username: "testuser",
          avatar: null,
        },
        friends: [],
        friendsPagination: {
          total: 0,
          page: 1,
          perPage: 50,
          totalPages: 0,
          hasMore: false,
        },
        groups: [],
        groupsPagination: {
          total: 0,
          page: 1,
          perPage: 50,
          totalPages: 0,
          hasMore: false,
        },
        groupMembers: {
          "group-1": [],
        },
        logs: [],
        notifications: {
          friendRequests: [],
          groupInvitations: [],
        },
      },
    };

    const roundTripped = jsonRoundTrip(msg);

    expect(roundTripped.type).toBe("dashboard_data");
    expect(roundTripped.data.groupMembers).toBeDefined();
    expect(roundTripped.data.groupMembers?.["group-1"]).toEqual([]);
  });
});

// ============================================================================
// Profile Message Tests
// ============================================================================

describe("WebSocket Messages - Profile", () => {
  it("should serialize GetUserProfileRequest", () => {
    const msg: GetUserProfileRequest = {
      type: "get_user_profile",
      data: {
        userId: "user-1",
      },
    };

    const roundTripped = jsonRoundTrip(msg);

    expect(roundTripped.type).toBe("get_user_profile");
    expect(roundTripped.data?.userId).toBe("user-1");
  });

  it("should handle GetUserProfileRequest without userId", () => {
    const msg: GetUserProfileRequest = {
      type: "get_user_profile",
    };

    const roundTripped = jsonRoundTrip(msg);

    expect(roundTripped.type).toBe("get_user_profile");
  });

  it("should serialize UserProfileResponse", () => {
    const msg: UserProfileResponse = {
      type: "user_profile",
      data: {
        id: "user-1",
        discordId: "123456789",
        username: "testuser",
        displayName: "Test User",
        avatar: "avatar-hash",
        player: "PlayerName",
        timeZone: "America/New_York",
        showTimezone: true,
        usePlayerAsDisplayName: false,
        betaTester: false,
        friendCode: "ABC123",
        role: "user",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      },
    };

    const roundTripped = jsonRoundTrip(msg);

    expect(roundTripped.type).toBe("user_profile");
    expect(roundTripped.data.username).toBe("testuser");
    expect(roundTripped.data.friendCode).toBe("ABC123");
  });

  it("should serialize UpdateUserProfileRequest", () => {
    const msg: UpdateUserProfileRequest = {
      type: "update_user_profile",
      data: {
        player: "NewPlayerName",
        timeZone: "Europe/London",
        usePlayerAsDisplayName: true,
      },
    };

    const roundTripped = jsonRoundTrip(msg);

    expect(roundTripped.type).toBe("update_user_profile");
    expect(roundTripped.data.player).toBe("NewPlayerName");
    expect(roundTripped.data.usePlayerAsDisplayName).toBe(true);
  });

  it("should serialize UpdateUserProfileRequest with null values", () => {
    const msg: UpdateUserProfileRequest = {
      type: "update_user_profile",
      data: {
        player: null,
        timeZone: null,
      },
    };

    const roundTripped = jsonRoundTrip(msg);

    expect(roundTripped.type).toBe("update_user_profile");
    expect(roundTripped.data.player).toBeNull();
    expect(roundTripped.data.timeZone).toBeNull();
  });
});

// ============================================================================
// Log Message Tests
// ============================================================================

describe("WebSocket Messages - Logs", () => {
  it("should serialize SendLogsMessage for friends", () => {
    const msg: SendLogsMessage = {
      type: "send_logs",
      data: {
        logs: [
          {
            id: "log-1",
            userId: "user-1",
            player: "Player1",
            emoji: "💀",
            line: "Player1 killed Player2",
            timestamp: "2025-01-01T00:00:00Z",
            original: "raw log line",
            open: false,
          },
        ],
        target: {
          type: "friends",
        },
        compressed: false,
      },
    };

    const roundTripped = jsonRoundTrip(msg);

    expect(roundTripped.type).toBe("send_logs");
    expect(roundTripped.data.logs).toHaveLength(1);
    expect(roundTripped.data.target.type).toBe("friends");
    expect(roundTripped.data.compressed).toBe(false);
  });

  it("should serialize SendLogsMessage for group", () => {
    const msg: SendLogsMessage = {
      type: "send_logs",
      data: {
        logs: [],
        target: {
          type: "group",
          groupId: "group-1",
        },
        compressed: true,
        compressedData: "base64-compressed-data",
      },
    };

    const roundTripped = jsonRoundTrip(msg);

    expect(roundTripped.type).toBe("send_logs");
    expect(roundTripped.data.target.type).toBe("group");
    expect(roundTripped.data.target.groupId).toBe("group-1");
    expect(roundTripped.data.compressed).toBe(true);
    expect(roundTripped.data.compressedData).toBe("base64-compressed-data");
  });
});

// ============================================================================
// Error Message Tests
// ============================================================================

describe("WebSocket Messages - Error", () => {
  it("should serialize ErrorMessage", () => {
    const msg: ErrorMessage = {
      type: "error",
      message: "Something went wrong",
      error: "INTERNAL_ERROR",
      data: {
        code: 500,
        details: "Stack trace here",
      },
    };

    const roundTripped = jsonRoundTrip(msg);

    expect(roundTripped.type).toBe("error");
    expect(roundTripped.message).toBe("Something went wrong");
    expect(roundTripped.error).toBe("INTERNAL_ERROR");
    expect(roundTripped.data).toBeDefined();
  });

  it("should handle minimal ErrorMessage", () => {
    const msg: ErrorMessage = {
      type: "error",
      message: "Error occurred",
    };

    const roundTripped = jsonRoundTrip(msg);

    expect(roundTripped.type).toBe("error");
    expect(roundTripped.message).toBe("Error occurred");
  });
});

// ============================================================================
// Union Type Tests
// ============================================================================

describe("WebSocket Messages - Union Types", () => {
  it("should accept all ClientMessage types", () => {
    const messages: ClientMessage[] = [
      { type: "register", userId: "user-1", token: "token" },
      { type: "ping" },
      { type: "get_friends" },
      { type: "get_friend_requests" },
      { type: "get_groups" },
      { type: "get_group_members", data: { groupId: "group-1" } },
      { type: "get_group_invitations" },
      { type: "update_group", data: { groupId: "group-1" } },
      { type: "delete_group", data: { groupId: "group-1" } },
      { type: "leave_group", data: { groupId: "group-1" } },
      {
        type: "update_member_role",
        data: { groupId: "group-1", memberId: "member-1", role: "admin" },
      },
      {
        type: "remove_member_from_group",
        data: { groupId: "group-1", memberId: "member-1" },
      },
      { type: "get_user_profile" },
      { type: "update_user_profile", data: {} },
      { type: "get_dashboard_data" },
      { type: "send_logs", data: { logs: [], target: { type: "friends" } } },
    ];

    expect(messages).toHaveLength(16);
    messages.forEach((msg) => {
      expect(isBaseMessage(msg)).toBe(true);
    });
  });

  it("should accept all ServerMessage types", () => {
    const messages: ServerMessage[] = [
      { type: "registered" },
      { type: "pong" },
      {
        type: "friends_list",
        data: [],
        pagination: {
          total: 0,
          page: 1,
          perPage: 50,
          totalPages: 0,
          hasMore: false,
        },
      },
      { type: "friend_requests", data: { incoming: [], outgoing: [] } },
      { type: "groups_list", data: [] },
      { type: "group_members", data: { members: [] } },
      { type: "group_invitations", data: [] },
      {
        type: "user_profile",
        data: {
          id: "user-1",
          discordId: "123",
          username: "user",
          displayName: "User",
          avatar: null,
          player: null,
          timeZone: null,
          showTimezone: true,
          usePlayerAsDisplayName: false,
          betaTester: false,
          friendCode: null,
          role: "user",
          createdAt: "2025-01-01T00:00:00Z",
          updatedAt: "2025-01-01T00:00:00Z",
        },
      },
      {
        type: "dashboard_data",
        data: {
          user: { id: "user-1", username: "testuser", avatar: null },
          friends: [],
          friendsPagination: {
            total: 0,
            page: 1,
            perPage: 50,
            totalPages: 0,
            hasMore: false,
          },
          groups: [],
          groupsPagination: {
            total: 0,
            page: 1,
            perPage: 50,
            totalPages: 0,
            hasMore: false,
          },
          logs: [],
          notifications: { friendRequests: [], groupInvitations: [] },
        },
      },
      { type: "error", message: "Error" },
    ];

    expect(messages).toHaveLength(10);
    messages.forEach((msg) => {
      expect(isBaseMessage(msg)).toBe(true);
    });
  });

  it("should accept both client and server messages as WebSocketMessage", () => {
    const messages: WebSocketMessage[] = [
      { type: "ping" },
      { type: "pong" },
      { type: "register", userId: "user-1", token: "token" },
      { type: "registered" },
      { type: "error", message: "Error" },
    ];

    expect(messages).toHaveLength(5);
    messages.forEach((msg) => {
      expect(isBaseMessage(msg)).toBe(true);
    });
  });
});

// ============================================================================
// Edge Cases and Malformed Messages
// ============================================================================

describe("WebSocket Messages - Edge Cases", () => {
  it("should reject non-object values", () => {
    expect(isBaseMessage(null)).toBe(false);
    expect(isBaseMessage(undefined)).toBe(false);
    expect(isBaseMessage("string")).toBe(false);
    expect(isBaseMessage(123)).toBe(false);
    expect(isBaseMessage(true)).toBe(false);
    expect(isBaseMessage([])).toBe(false);
  });

  it("should reject objects without type field", () => {
    expect(isBaseMessage({})).toBe(false);
    expect(isBaseMessage({ data: "value" })).toBe(false);
  });

  it("should reject objects with non-string type", () => {
    expect(isBaseMessage({ type: 123 })).toBe(false);
    expect(isBaseMessage({ type: null })).toBe(false);
    expect(isBaseMessage({ type: {} })).toBe(false);
  });

  it("should handle empty string type", () => {
    const msg = { type: "" };
    expect(isBaseMessage(msg)).toBe(true); // Valid but not useful
  });

  it("should preserve extra fields during JSON round-trip", () => {
    const msg = {
      type: "test",
      extra: "field",
      nested: {
        data: "value",
      },
    };

    const roundTripped = jsonRoundTrip(msg);

    expect(roundTripped).toEqual(msg);
    expect(roundTripped.extra).toBe("field");
    expect(roundTripped.nested.data).toBe("value");
  });

  it("should handle messages with requestId for tracking", () => {
    const msg: BaseMessage = {
      type: "get_friends",
      requestId: "req-123-456",
    };

    const roundTripped = jsonRoundTrip(msg);

    expect(roundTripped.requestId).toBe("req-123-456");
  });

  it("should handle messages with timestamp", () => {
    const now = new Date().toISOString();
    const msg: BaseMessage = {
      type: "ping",
      timestamp: now,
    };

    const roundTripped = jsonRoundTrip(msg);

    expect(roundTripped.timestamp).toBe(now);
  });

  it("should handle deeply nested data structures", () => {
    const msg: BaseMessage = {
      type: "test",
      data: {
        level1: {
          level2: {
            level3: {
              value: "deeply nested",
              array: [1, 2, 3],
              null: null,
              boolean: true,
            },
          },
        },
      },
    };

    const roundTripped = jsonRoundTrip(msg);

    expect(roundTripped.data).toBeDefined();
    if (typeof roundTripped.data === "object" && roundTripped.data !== null) {
      const data = roundTripped.data as any;
      expect(data.level1.level2.level3.value).toBe("deeply nested");
      expect(data.level1.level2.level3.array).toEqual([1, 2, 3]);
    }
  });
});
