/**
 * Type assertion tests for type-only modules
 *
 * These modules contain only TypeScript type definitions without runtime logic.
 * These tests verify type correctness and compatibility through type assertions
 * and structural validation.
 *
 * Modules covered:
 * - src/auth/oauth.ts
 * - src/core/friend.ts
 * - src/core/group.ts
 * - src/core/notification.ts
 * - src/websocket/messages.ts
 * - src/websocket/connection.ts
 */

import { describe, it, expect } from "vitest";
import type {
  // OAuth types
  DiscordTokenResponse,
  DiscordUser,
  OAuthSession,
  OAuthCallbackParams,
  // Friend types
  Friend,
  FriendRequest,
  FriendRequestsResponse,
  SendFriendRequestData,
  FriendRequestActionData,
  RemoveFriendData,
  // Group types
  Group,
  GroupRole,
  GroupMember,
  GroupInvitation,
  CreateGroupData,
  UpdateGroupData,
  InviteFriendToGroupData,
  GroupInvitationActionData,
  RemoveGroupMemberData,
  UpdateMemberRoleData,
  LeaveGroupData,
  DeleteGroupData,
  // Notification types
  Notification,
  NotificationTypeEnum,
  NotificationData,
  FriendRequestNotificationData,
  GroupInvitationNotificationData,
  SystemNotificationData,
  ActivityNotificationData,
  CreateNotificationData,
  GetNotificationsRequest,
  GetNotificationsResponse,
  MarkNotificationReadRequest,
  MarkAllNotificationsReadRequest,
  // WebSocket Message types
  BaseMessage,
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
  RegisterMessage,
  RegisteredMessage,
  SendLogsMessage,
  ErrorMessage,
  PingMessage,
  PongMessage,
  ClientMessage,
  ServerMessage,
  WebSocketMessage,
  // WebSocket Connection types
  WebSocketData,
  ClientInfo,
  WebSocketJWTPayload,
  AuthSession,
  BandwidthMetrics,
  RateLimit,
} from "./index.js";

// ============================================================================
// OAuth Types Tests
// ============================================================================

describe("OAuth Types", () => {
  it("should validate DiscordTokenResponse type", () => {
    const tokenResponse: DiscordTokenResponse = {
      access_token: "token123",
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: "refresh123",
      scope: "identify email",
    };

    expect(tokenResponse.access_token).toBe("token123");
    expect(tokenResponse.expires_in).toBe(3600);
  });

  it("should validate DiscordUser type with required fields", () => {
    const user: DiscordUser = {
      id: "123456789",
      username: "testuser",
      discriminator: "0",
      avatar: "avatar-hash",
      global_name: "Test User",
    };

    expect(user.id).toBeDefined();
    expect(user.username).toBeDefined();
  });

  it("should validate DiscordUser type with optional fields", () => {
    const user: DiscordUser = {
      id: "123456789",
      username: "testuser",
      discriminator: "0",
      avatar: null,
      global_name: "Test User",
      email: "test@example.com",
      verified: true,
      banner: "banner-hash",
      banner_color: "#000000",
      accent_color: 0x000000,
    };

    expect(user.email).toBe("test@example.com");
    expect(user.verified).toBe(true);
  });

  it("should validate OAuthSession type", () => {
    const session: OAuthSession = {
      otp: "ABC123",
      jwt: "jwt-token",
      createdAt: Date.now(),
      expiresAt: Date.now() + 600000,
      sessionId: "session-123",
      redirectUri: "http://localhost:8080/callback",
      metadata: { client: "desktop" },
    };

    expect(session.otp).toBe("ABC123");
    expect(session.expiresAt).toBeGreaterThan(session.createdAt);
  });

  it("should validate OAuthCallbackParams type", () => {
    const params: OAuthCallbackParams = {
      code: "auth-code-123",
      state: "state-123",
    };

    expect(params.code).toBeDefined();
    expect(params.state).toBeDefined();
  });

  it("should validate OAuthCallbackParams with error", () => {
    const params: OAuthCallbackParams = {
      code: "",
      state: "",
      error: "access_denied",
      error_description: "User denied access",
    };

    expect(params.error).toBe("access_denied");
  });
});

// ============================================================================
// Friend Types Tests
// ============================================================================

describe("Friend Types", () => {
  it("should validate Friend type with all fields", () => {
    const friend: Friend = {
      id: "friendship-123",
      status: "accepted",
      createdAt: "2025-01-01T00:00:00Z",
      friendUserId: "user-123",
      friendDiscordId: "123456789",
      friendUsername: "frienduser",
      friendDisplayName: "Friend Name",
      friendAvatar: "avatar-hash",
      friendPlayer: "Player Name",
      friendTimeZone: "America/New_York",
      friendUsePlayerAsDisplayName: true,
      friendCode: "FRIEND123",
      isOnline: true,
      isConnected: true,
    };

    expect(friend.status).toBe("accepted");
    expect(friend.isOnline).toBe(true);
  });

  it("should validate FriendRequest type", () => {
    const request: FriendRequest = {
      id: "request-123",
      status: "pending",
      createdAt: "2025-01-01T00:00:00Z",
      fromUserId: "user-123",
      fromDiscordId: "123456789",
      fromUsername: "requester",
      fromDisplayName: "Requester Name",
      fromAvatar: null,
      fromPlayer: null,
      fromTimeZone: null,
      fromUsePlayerAsDisplayName: false,
      direction: "incoming",
    };

    expect(request.direction).toMatch(/^(incoming|outgoing)$/);
  });

  it("should validate FriendRequestsResponse type", () => {
    const response: FriendRequestsResponse = {
      incoming: [],
      outgoing: [],
    };

    expect(response.incoming).toBeInstanceOf(Array);
    expect(response.outgoing).toBeInstanceOf(Array);
  });

  it("should validate SendFriendRequestData type", () => {
    const data: SendFriendRequestData = {
      friendCode: "FRIEND123",
    };

    expect(data.friendCode).toBeDefined();
  });

  it("should validate FriendRequestActionData type", () => {
    const data: FriendRequestActionData = {
      friendshipId: "friendship-123",
    };

    expect(data.friendshipId).toBeDefined();
  });

  it("should validate RemoveFriendData type", () => {
    const data: RemoveFriendData = {
      friendshipId: "friendship-123",
    };

    expect(data.friendshipId).toBeDefined();
  });
});

// ============================================================================
// Group Types Tests
// ============================================================================

describe("Group Types", () => {
  it("should validate GroupRole type", () => {
    const owner: GroupRole = "owner";
    const admin: GroupRole = "admin";
    const member: GroupRole = "member";

    expect(owner).toBe("owner");
    expect(admin).toBe("admin");
    expect(member).toBe("member");
  });

  it("should validate Group type", () => {
    const group: Group = {
      id: "group-123",
      name: "Test Group",
      description: "A test group",
      avatar: "avatar-hash",
      memberCount: 5,
      memberRole: "admin",
      tags: ["test", "gaming"],
      ownerId: "owner-123",
      visibility: "private",
      joinMethod: "request",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    };

    expect(group.memberCount).toBe(5);
    expect(group.tags).toHaveLength(2);
  });

  it("should validate GroupMember type", () => {
    const member: GroupMember = {
      id: "member-123",
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
  });

  it("should validate GroupInvitation type", () => {
    const invitation: GroupInvitation = {
      id: "inv-123",
      groupId: "group-123",
      group: {
        id: "group-123",
        name: "Test Group",
        description: "A test group",
        avatar: "avatar-hash",
        tags: ["test"],
      },
      inviterId: "inviter-123",
      inviterUsername: "inviter",
      inviterDisplayName: "Inviter Name",
      inviterAvatar: "avatar-hash",
      inviterPlayer: "Inviter Player",
      createdAt: "2025-01-01T00:00:00Z",
      status: "pending",
    };

    expect(invitation.group.id).toBe(invitation.groupId);
  });

  it("should validate CreateGroupData type", () => {
    const data: CreateGroupData = {
      name: "New Group",
      description: "A new group",
      avatar: "avatar-hash",
      tags: ["new"],
    };

    expect(data.name).toBeDefined();
  });

  it("should validate UpdateGroupData type", () => {
    const data: UpdateGroupData = {
      groupId: "group-123",
      name: "Updated Name",
      description: "Updated description",
    };

    expect(data.groupId).toBeDefined();
  });

  it("should validate InviteFriendToGroupData type", () => {
    const data: InviteFriendToGroupData = {
      groupId: "group-123",
      friendId: "friend-123",
    };

    expect(data.groupId).toBeDefined();
    expect(data.friendId).toBeDefined();
  });

  it("should validate GroupInvitationActionData type", () => {
    const data: GroupInvitationActionData = {
      invitationId: "inv-123",
    };

    expect(data.invitationId).toBeDefined();
  });

  it("should validate RemoveGroupMemberData type", () => {
    const data: RemoveGroupMemberData = {
      groupId: "group-123",
      userId: "user-123",
    };

    expect(data.groupId).toBeDefined();
    expect(data.userId).toBeDefined();
  });

  it("should validate UpdateMemberRoleData type", () => {
    const data: UpdateMemberRoleData = {
      groupId: "group-123",
      memberId: "member-123",
      role: "admin",
      canInvite: true,
      canRemoveMembers: false,
      canEditGroup: true,
    };

    expect(data.role).toBe("admin");
  });

  it("should validate LeaveGroupData type", () => {
    const data: LeaveGroupData = {
      groupId: "group-123",
    };

    expect(data.groupId).toBeDefined();
  });

  it("should validate DeleteGroupData type", () => {
    const data: DeleteGroupData = {
      groupId: "group-123",
    };

    expect(data.groupId).toBeDefined();
  });
});

// ============================================================================
// Notification Types Tests
// ============================================================================

describe("Notification Types", () => {
  it("should validate NotificationTypeEnum values", () => {
    const friendRequest: NotificationTypeEnum = "friend_request";
    const groupInvitation: NotificationTypeEnum = "group_invitation";
    const system: NotificationTypeEnum = "system";
    const activity: NotificationTypeEnum = "activity";

    expect(friendRequest).toBe("friend_request");
    expect(groupInvitation).toBe("group_invitation");
    expect(system).toBe("system");
    expect(activity).toBe("activity");
  });

  it("should validate FriendRequestNotificationData type", () => {
    const data: FriendRequestNotificationData = {
      type: "friend_request",
      friendshipId: "friendship-123",
      fromUserId: "user-123",
      fromDiscordId: "123456789",
      fromUsername: "sender",
      fromDisplayName: "Sender Name",
      fromAvatar: null,
      fromPlayer: null,
    };

    expect(data.type).toBe("friend_request");
    expect(data.friendshipId).toBeDefined();
  });

  it("should validate GroupInvitationNotificationData type", () => {
    const data: GroupInvitationNotificationData = {
      type: "group_invitation",
      invitationId: "inv-123",
      groupId: "group-123",
      groupName: "Test Group",
      groupAvatar: null,
      inviterId: "inviter-123",
      inviterUsername: "inviter",
      inviterDisplayName: "Inviter Name",
      inviterAvatar: null,
    };

    expect(data.type).toBe("group_invitation");
    expect(data.groupId).toBeDefined();
  });

  it("should validate SystemNotificationData type", () => {
    const data: SystemNotificationData = {
      type: "system",
      category: "maintenance",
      actionUrl: "https://example.com",
      actionLabel: "Learn more",
    };

    expect(data.category).toMatch(
      /^(announcement|maintenance|update|warning)$/,
    );
  });

  it("should validate ActivityNotificationData type", () => {
    const data: ActivityNotificationData = {
      type: "activity",
      activityType: "friend_online",
      relatedUserId: "user-123",
      relatedUsername: "friend",
      relatedDisplayName: "Friend Name",
    };

    expect(data.activityType).toBe("friend_online");
  });

  it("should validate Notification type", () => {
    const notification: Notification = {
      id: "notif-123",
      userId: "user-123",
      type: "friend_request",
      title: "Friend Request",
      message: "You have a new friend request",
      data: {
        type: "friend_request",
        friendshipId: "friendship-123",
        fromUserId: "from-user-123",
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

  it("should validate CreateNotificationData type", () => {
    const data: CreateNotificationData = {
      userId: "user-123",
      type: "system",
      title: "System Notification",
      message: "Test message",
      data: {
        type: "system",
        category: "announcement",
      },
    };

    expect(data.userId).toBeDefined();
  });

  it("should validate GetNotificationsRequest type", () => {
    const request: GetNotificationsRequest = {
      page: 1,
      perPage: 20,
      unreadOnly: true,
      type: "friend_request",
    };

    expect(request.page).toBe(1);
  });

  it("should validate GetNotificationsResponse type", () => {
    const response: GetNotificationsResponse = {
      notifications: [],
      pagination: {
        page: 1,
        perPage: 20,
        total: 0,
        totalPages: 1,
      },
    };

    expect(response.notifications).toBeInstanceOf(Array);
  });

  it("should validate MarkNotificationReadRequest type", () => {
    const request: MarkNotificationReadRequest = {
      notificationId: "notif-123",
    };

    expect(request.notificationId).toBeDefined();
  });

  it("should validate MarkAllNotificationsReadRequest type", () => {
    const request: MarkAllNotificationsReadRequest = {
      type: "friend_request",
    };

    expect(request.type).toBe("friend_request");
  });
});

// ============================================================================
// WebSocket Message Types Tests
// ============================================================================

describe("WebSocket Message Types", () => {
  it("should validate BaseMessage type", () => {
    const message: BaseMessage = {
      type: "test",
      requestId: "req-123",
      timestamp: "2025-01-01T00:00:00Z",
      data: { test: true },
    };

    expect(message.type).toBeDefined();
  });

  it("should validate RegisterMessage type", () => {
    const message: RegisterMessage = {
      type: "register",
      userId: "user-123",
      token: "jwt-token",
      metadata: { client: "web" },
    };

    expect(message.type).toBe("register");
    expect(message.userId).toBeDefined();
    expect(message.token).toBeDefined();
  });

  it("should validate GetFriendsRequest type", () => {
    const message: GetFriendsRequest = {
      type: "get_friends",
      data: {
        page: 1,
        perPage: 50,
        sortBy: "online",
      },
    };

    expect(message.type).toBe("get_friends");
  });

  it("should validate DashboardDataRequest type", () => {
    const message: DashboardDataRequest = {
      type: "get_dashboard_data",
      data: {
        friendsPage: 1,
        friendsPerPage: 50,
        includeGroupMembers: true,
      },
    };

    expect(message.type).toBe("get_dashboard_data");
    expect(message.data?.includeGroupMembers).toBe(true);
  });

  it("should validate SendLogsMessage type", () => {
    const message: SendLogsMessage = {
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

    expect(message.type).toBe("send_logs");
    expect(message.data.target.type).toMatch(/^(friends|group)$/);
  });

  it("should validate ErrorMessage type", () => {
    const message: ErrorMessage = {
      type: "error",
      message: "An error occurred",
      error: "INVALID_TOKEN",
    };

    expect(message.type).toBe("error");
    expect(message.message).toBeDefined();
  });

  it("should validate PingMessage and PongMessage types", () => {
    const ping: PingMessage = { type: "ping" };
    const pong: PongMessage = { type: "pong" };

    expect(ping.type).toBe("ping");
    expect(pong.type).toBe("pong");
  });

  it("should validate ClientMessage union type", () => {
    const messages: ClientMessage[] = [
      { type: "register", userId: "user-123", token: "token" },
      { type: "ping" },
      { type: "get_friends" },
      { type: "get_dashboard_data" },
    ];

    expect(messages).toHaveLength(4);
  });

  it("should validate ServerMessage union type", () => {
    const messages: ServerMessage[] = [
      { type: "registered" },
      { type: "pong" },
      {
        type: "friends_list",
        data: [],
        pagination: {
          page: 1,
          perPage: 50,
          total: 0,
          totalPages: 1,
          hasMore: false,
        },
      },
      { type: "error", message: "Error", error: "ERROR_CODE" },
    ];

    expect(messages).toHaveLength(4);
  });
});

// ============================================================================
// WebSocket Connection Types Tests
// ============================================================================

describe("WebSocket Connection Types", () => {
  it("should validate WebSocketData type", () => {
    const data: WebSocketData = {
      connectionId: "conn-123",
      userId: "user-123",
      clientIp: "127.0.0.1",
      authOnly: false,
    };

    expect(data.connectionId).toBeDefined();
    expect(data.userId).toBeDefined();
  });

  it("should validate ClientInfo type", () => {
    const info: ClientInfo = {
      userId: "user-123",
      ws: {},
      ip: "127.0.0.1",
      metadata: { client: "web" },
    };

    expect(info.userId).toBeDefined();
    expect(info.ip).toBeDefined();
  });

  it("should validate WebSocketJWTPayload type", () => {
    const payload: WebSocketJWTPayload = {
      userId: "123456789",
      type: "websocket",
      iat: Date.now() / 1000,
      exp: Date.now() / 1000 + 3600,
      iss: "picologs",
      aud: "websocket",
    };

    expect(payload.type).toBe("websocket");
    expect(payload.userId).toBeDefined();
  });

  it("should validate AuthSession type", () => {
    const session: AuthSession = {
      otp: "ABC123",
      jwt: "jwt-token",
      createdAt: Date.now(),
    };

    expect(session.otp).toBeDefined();
    expect(session.jwt).toBeDefined();
  });

  it("should validate BandwidthMetrics type", () => {
    const metrics: BandwidthMetrics = {
      messagesSent: 100,
      messagesSkippedOffline: 5,
      lastResetTime: Date.now(),
    };

    expect(metrics.messagesSent).toBe(100);
    expect(metrics.messagesSkippedOffline).toBe(5);
  });

  it("should validate RateLimit type", () => {
    const rateLimit: RateLimit = {
      count: 10,
      resetTime: Date.now() + 60000,
    };

    expect(rateLimit.count).toBe(10);
    expect(rateLimit.resetTime).toBeGreaterThan(Date.now());
  });
});
