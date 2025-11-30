/**
 * WebSocket Message Zod Schemas
 *
 * Runtime validation schemas for all WebSocket messages exchanged between
 * the server and clients. Provides contract testing capabilities.
 *
 * These schemas correspond to the TypeScript interfaces in ../messages.ts
 *
 * @module types/websocket/contracts/message-schemas
 */

import { z } from "zod";
import {
  PaginationMetadataSchema,
  UserProfileSchema,
  FriendSchema,
  FriendRequestSchema,
  GroupSchema,
  GroupMemberSchema,
  GroupInvitationSchema,
  DiscoverableGroupSchema,
  GroupJoinRequestSchema,
  LogTransmitSchema,
} from "./core-schemas.js";

// ============================================================================
// Base Message Schema
// ============================================================================

/**
 * Base message schema that all messages extend
 */
export const BaseMessageSchema = z.object({
  type: z.string(),
  requestId: z.string().optional(),
  timestamp: z.string().optional(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
});

// ============================================================================
// Authentication Messages
// ============================================================================

/**
 * Register message schema
 */
export const RegisterMessageSchema = BaseMessageSchema.extend({
  type: z.literal("register"),
  userId: z.string(),
  token: z.string(),
  metadata: z.record(z.string(), z.any()).optional(),
});

/**
 * Registered confirmation schema
 */
export const RegisteredMessageSchema = BaseMessageSchema.extend({
  type: z.literal("registered"),
  data: z
    .object({
      message: z.string().optional(),
    })
    .optional(),
});

// ============================================================================
// Keepalive Messages
// ============================================================================

/**
 * Ping message schema
 */
export const PingMessageSchema = BaseMessageSchema.extend({
  type: z.literal("ping"),
});

/**
 * Pong message schema
 */
export const PongMessageSchema = BaseMessageSchema.extend({
  type: z.literal("pong"),
});

// ============================================================================
// Error Messages
// ============================================================================

/**
 * Error message schema
 */
export const ErrorMessageSchema = BaseMessageSchema.extend({
  type: z.literal("error"),
  message: z.string(),
  error: z.string().optional(),
  data: z.any().optional(),
});

// ============================================================================
// Friend Messages
// ============================================================================

/**
 * Get friends request schema
 */
export const GetFriendsRequestSchema = BaseMessageSchema.extend({
  type: z.literal("get_friends"),
  data: z
    .object({
      page: z.number().int().min(1).optional(),
      perPage: z.number().int().min(1).optional(),
      sortBy: z.enum(["username", "online", "recent"]).optional(),
    })
    .optional(),
});

/**
 * Friends list response schema
 */
export const FriendsListResponseSchema = BaseMessageSchema.extend({
  type: z.literal("friends_list"),
  data: z.array(FriendSchema),
  pagination: PaginationMetadataSchema,
});

/**
 * Get friend requests schema
 */
export const GetFriendRequestsRequestSchema = BaseMessageSchema.extend({
  type: z.literal("get_friend_requests"),
});

/**
 * Friend requests response schema
 */
export const FriendRequestsMessageSchema = BaseMessageSchema.extend({
  type: z.literal("friend_requests"),
  data: z.object({
    incoming: z.array(FriendRequestSchema),
    outgoing: z.array(FriendRequestSchema),
  }),
});

/**
 * Send friend request schema
 */
export const SendFriendRequestMessageSchema = BaseMessageSchema.extend({
  type: z.literal("send_friend_request"),
  data: z.object({
    friendCode: z.string(),
  }),
});

/**
 * Accept friend request schema
 */
export const AcceptFriendRequestMessageSchema = BaseMessageSchema.extend({
  type: z.literal("accept_friend_request"),
  data: z.object({
    friendshipId: z.string().uuid(),
  }),
});

/**
 * Deny friend request schema
 */
export const DenyFriendRequestMessageSchema = BaseMessageSchema.extend({
  type: z.literal("deny_friend_request"),
  data: z.object({
    friendshipId: z.string().uuid(),
  }),
});

/**
 * Cancel friend request schema
 */
export const CancelFriendRequestMessageSchema = BaseMessageSchema.extend({
  type: z.literal("cancel_friend_request"),
  data: z.object({
    friendshipId: z.string().uuid(),
  }),
});

/**
 * Remove friend schema
 */
export const RemoveFriendMessageSchema = BaseMessageSchema.extend({
  type: z.literal("remove_friend"),
  data: z.object({
    friendshipId: z.string().uuid(),
  }),
});

/**
 * Friend profile updated broadcast schema
 */
export const FriendProfileUpdatedMessageSchema = BaseMessageSchema.extend({
  type: z.literal("friend_profile_updated"),
  data: z.object({
    discordId: z.string(),
    player: z.string().nullable(),
    username: z.string(),
    avatar: z.string().nullable(),
    usePlayerAsDisplayName: z.boolean(),
    displayName: z.string(),
    timeZone: z.string().nullable(),
    showTimezone: z.boolean(),
  }),
});

// ============================================================================
// Group Messages
// ============================================================================

/**
 * Get groups request schema
 */
export const GetGroupsRequestSchema = BaseMessageSchema.extend({
  type: z.literal("get_groups"),
  data: z
    .object({
      includeMembers: z.boolean().optional(),
    })
    .optional(),
});

/**
 * Groups list response schema
 */
export const GroupsListResponseSchema = BaseMessageSchema.extend({
  type: z.literal("groups_list"),
  data: z.union([
    z.array(GroupSchema),
    z.object({
      groups: z.array(GroupSchema),
      members: z.record(z.string(), z.array(GroupMemberSchema)),
    }),
  ]),
});

/**
 * Get group members request schema
 */
export const GetGroupMembersRequestSchema = BaseMessageSchema.extend({
  type: z.literal("get_group_members"),
  data: z.object({
    groupId: z.string().uuid(),
  }),
});

/**
 * Group members response schema
 */
export const GroupMembersResponseSchema = BaseMessageSchema.extend({
  type: z.literal("group_members"),
  data: z.object({
    members: z.array(GroupMemberSchema),
  }),
});

/**
 * Create group request schema
 */
export const CreateGroupMessageSchema = BaseMessageSchema.extend({
  type: z.literal("create_group"),
  data: z.object({
    name: z.string(),
    description: z.string().optional(),
    avatar: z.string().nullable().optional(),
    tags: z.array(z.string()).optional(),
    visibility: z.enum(["private", "discoverable"]).optional(),
    joinMethod: z.enum(["open", "request"]).optional(),
  }),
});

/**
 * Update group request schema
 */
export const UpdateGroupRequestSchema = BaseMessageSchema.extend({
  type: z.literal("update_group"),
  data: z.object({
    groupId: z.string().uuid(),
    name: z.string().optional(),
    description: z.string().nullable().optional(),
    avatar: z.string().nullable().optional(),
    tags: z.array(z.string()).nullable().optional(),
    visibility: z.enum(["private", "discoverable"]).optional(),
    joinMethod: z.enum(["open", "request"]).optional(),
  }),
});

/**
 * Delete group request schema
 */
export const DeleteGroupRequestSchema = BaseMessageSchema.extend({
  type: z.literal("delete_group"),
  data: z.object({
    groupId: z.string().uuid(),
  }),
});

/**
 * Leave group request schema
 */
export const LeaveGroupRequestSchema = BaseMessageSchema.extend({
  type: z.literal("leave_group"),
  data: z.object({
    groupId: z.string().uuid(),
  }),
});

/**
 * Update member role request schema
 */
export const UpdateMemberRoleRequestSchema = BaseMessageSchema.extend({
  type: z.literal("update_member_role"),
  data: z.object({
    groupId: z.string().uuid(),
    memberId: z.string().uuid(),
    role: z.enum(["member", "admin"]),
  }),
});

/**
 * Remove member from group request schema
 */
export const RemoveMemberFromGroupRequestSchema = BaseMessageSchema.extend({
  type: z.literal("remove_member_from_group"),
  data: z.object({
    groupId: z.string().uuid(),
    memberId: z.string().uuid(),
  }),
});

/**
 * Get group invitations request schema
 */
export const GetGroupInvitationsRequestSchema = BaseMessageSchema.extend({
  type: z.literal("get_group_invitations"),
});

/**
 * Group invitations response schema
 */
export const GroupInvitationsResponseSchema = BaseMessageSchema.extend({
  type: z.literal("group_invitations"),
  data: z.array(GroupInvitationSchema),
});

/**
 * Invite friend to group schema
 */
export const InviteFriendToGroupMessageSchema = BaseMessageSchema.extend({
  type: z.literal("invite_friend_to_group"),
  data: z.object({
    groupId: z.string().uuid(),
    friendId: z.string().uuid(),
  }),
});

/**
 * Accept group invitation schema
 */
export const AcceptGroupInvitationMessageSchema = BaseMessageSchema.extend({
  type: z.literal("accept_group_invitation"),
  data: z.object({
    invitationId: z.string().uuid(),
  }),
});

/**
 * Deny group invitation schema
 */
export const DenyGroupInvitationMessageSchema = BaseMessageSchema.extend({
  type: z.literal("deny_group_invitation"),
  data: z.object({
    invitationId: z.string().uuid(),
  }),
});

/**
 * Cancel group invitation schema
 */
export const CancelGroupInvitationMessageSchema = BaseMessageSchema.extend({
  type: z.literal("cancel_group_invitation"),
  data: z.object({
    invitationId: z.string().uuid(),
  }),
});

/**
 * Group member profile updated broadcast schema
 */
export const GroupMemberProfileUpdatedMessageSchema = BaseMessageSchema.extend({
  type: z.literal("group_member_profile_updated"),
  data: z.object({
    discordId: z.string(),
    player: z.string().nullable(),
    username: z.string(),
    avatar: z.string().nullable(),
    usePlayerAsDisplayName: z.boolean(),
    displayName: z.string(),
    timeZone: z.string().nullable(),
    showTimezone: z.boolean(),
  }),
});

// ============================================================================
// Group Discovery Messages
// ============================================================================

/**
 * Get discoverable groups request schema
 */
export const GetDiscoverableGroupsRequestSchema = BaseMessageSchema.extend({
  type: z.literal("get_discoverable_groups"),
  data: z
    .object({
      page: z.number().int().min(1).optional(),
      perPage: z.number().int().min(1).max(50).optional(),
      search: z.string().optional(),
      tags: z.array(z.string()).optional(),
      sortBy: z.enum(["popular", "recent", "name"]).optional(),
    })
    .optional(),
});

/**
 * Discoverable groups response schema
 */
export const DiscoverableGroupsResponseSchema = BaseMessageSchema.extend({
  type: z.literal("discoverable_groups"),
  data: z.object({
    groups: z.array(DiscoverableGroupSchema),
    pagination: PaginationMetadataSchema,
  }),
});

/**
 * Get discover tags request schema
 */
export const GetDiscoverTagsRequestSchema = BaseMessageSchema.extend({
  type: z.literal("get_discover_tags"),
});

/**
 * Discover tags response schema
 */
export const DiscoverTagsResponseSchema = BaseMessageSchema.extend({
  type: z.literal("discover_tags"),
  data: z.array(
    z.object({
      tag: z.string(),
      count: z.number().int().min(0),
    }),
  ),
});

/**
 * Join open group request schema
 */
export const JoinOpenGroupRequestSchema = BaseMessageSchema.extend({
  type: z.literal("join_open_group"),
  data: z.object({
    groupId: z.string().uuid(),
  }),
});

/**
 * Join open group response schema
 */
export const JoinOpenGroupResponseSchema = BaseMessageSchema.extend({
  type: z.literal("join_open_group_result"),
  data: z.object({
    success: z.boolean(),
    group: GroupSchema.optional(),
    error: z.string().optional(),
  }),
});

/**
 * Request join group request schema
 */
export const RequestJoinGroupRequestSchema = BaseMessageSchema.extend({
  type: z.literal("request_join_group"),
  data: z.object({
    groupId: z.string().uuid(),
    message: z.string().optional(),
  }),
});

/**
 * Request join group response schema
 */
export const RequestJoinGroupResponseSchema = BaseMessageSchema.extend({
  type: z.literal("request_join_group_result"),
  data: z.object({
    success: z.boolean(),
    requestId: z.string().uuid().optional(),
    error: z.string().optional(),
  }),
});

/**
 * Get join requests request schema
 */
export const GetJoinRequestsRequestSchema = BaseMessageSchema.extend({
  type: z.literal("get_join_requests"),
  data: z.object({
    groupId: z.string().uuid(),
  }),
});

/**
 * Join requests response schema
 */
export const JoinRequestsResponseSchema = BaseMessageSchema.extend({
  type: z.literal("join_requests"),
  data: z.array(GroupJoinRequestSchema),
});

/**
 * Review join request request schema
 */
export const ReviewJoinRequestRequestSchema = BaseMessageSchema.extend({
  type: z.literal("review_join_request"),
  data: z.object({
    requestId: z.string().uuid(),
    decision: z.enum(["approve", "deny"]),
  }),
});

/**
 * Review join request response schema
 */
export const ReviewJoinRequestResponseSchema = BaseMessageSchema.extend({
  type: z.literal("review_join_request_result"),
  data: z.object({
    success: z.boolean(),
    error: z.string().optional(),
  }),
});

/**
 * New join request notification schema
 */
export const NewJoinRequestMessageSchema = BaseMessageSchema.extend({
  type: z.literal("new_join_request"),
  data: GroupJoinRequestSchema,
});

/**
 * Join request reviewed notification schema
 */
export const JoinRequestReviewedMessageSchema = BaseMessageSchema.extend({
  type: z.literal("join_request_reviewed"),
  data: z.object({
    groupId: z.string().uuid(),
    groupName: z.string(),
    decision: z.enum(["approve", "deny"]),
    group: GroupSchema.optional(),
  }),
});

// ============================================================================
// Dashboard Messages
// ============================================================================

/**
 * Dashboard friend request schema (flattened format)
 */
export const DashboardFriendRequestSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  friendId: z.string().uuid(),
  status: z.string(),
  createdAt: z.string(),
  requesterDiscordId: z.string().nullable(),
  requesterUsername: z.string().nullable(),
  requesterDisplayName: z.string().nullable(),
  requesterAvatar: z.string().nullable(),
  requesterPlayer: z.string().nullable(),
});

/**
 * Dashboard group invitation schema (flattened format)
 */
export const DashboardGroupInvitationSchema = z.object({
  id: z.string().uuid(),
  groupId: z.string().uuid(),
  inviterId: z.string().uuid(),
  inviteeId: z.string().uuid(),
  status: z.string(),
  createdAt: z.string(),
  groupName: z.string().nullable(),
  groupAvatar: z.string().nullable(),
  inviterUsername: z.string().nullable(),
  inviterDisplayName: z.string().nullable(),
  inviterAvatar: z.string().nullable(),
});

/**
 * Dashboard data request schema
 */
export const DashboardDataRequestSchema = BaseMessageSchema.extend({
  type: z.literal("get_dashboard_data"),
  data: z
    .object({
      friendsPage: z.number().int().min(1).optional(),
      friendsPerPage: z.number().int().min(1).max(100).optional(),
      includeGroupMembers: z.boolean().optional(),
    })
    .optional(),
});

/**
 * Dashboard data response schema
 */
export const DashboardDataResponseSchema = BaseMessageSchema.extend({
  type: z.literal("dashboard_data"),
  data: z.object({
    user: z.object({
      id: z.string().uuid(),
      username: z.string(),
      avatar: z.string().nullable(),
    }),
    friends: z.array(FriendSchema),
    friendsPagination: PaginationMetadataSchema,
    groups: z.array(GroupSchema),
    groupsPagination: PaginationMetadataSchema,
    groupMembers: z.record(z.string(), z.array(GroupMemberSchema)).optional(),
    logs: z.array(LogTransmitSchema),
    notifications: z.object({
      friendRequests: z.array(DashboardFriendRequestSchema),
      groupInvitations: z.array(DashboardGroupInvitationSchema),
    }),
  }),
});

// ============================================================================
// Profile Messages
// ============================================================================

/**
 * Get user profile request schema
 */
export const GetUserProfileRequestSchema = BaseMessageSchema.extend({
  type: z.literal("get_user_profile"),
  data: z
    .object({
      userId: z.string().uuid().optional(),
    })
    .optional(),
});

/**
 * User profile response schema
 */
export const UserProfileResponseSchema = BaseMessageSchema.extend({
  type: z.literal("user_profile"),
  data: UserProfileSchema,
});

/**
 * Update user profile request schema
 */
export const UpdateUserProfileRequestSchema = BaseMessageSchema.extend({
  type: z.literal("update_user_profile"),
  data: z.object({
    player: z.string().nullable().optional(),
    timeZone: z.string().nullable().optional(),
    usePlayerAsDisplayName: z.boolean().optional(),
  }),
});

/**
 * Delete user profile request schema
 */
export const DeleteUserProfileRequestSchema = BaseMessageSchema.extend({
  type: z.literal("delete_user_profile"),
});

// ============================================================================
// Log Messages
// ============================================================================

/**
 * Send logs message schema (consolidated)
 */
export const SendLogsMessageSchema = BaseMessageSchema.extend({
  type: z.literal("send_logs"),
  data: z.object({
    logs: z.array(LogTransmitSchema),
    target: z.object({
      type: z.enum(["friends", "group"]),
      groupId: z.string().uuid().optional(),
    }),
    compressed: z.boolean().optional(),
    compressedData: z.string().optional(),
  }),
});

/**
 * Batch logs message schema (legacy)
 */
export const BatchLogsMessageSchema = BaseMessageSchema.extend({
  type: z.literal("batch_logs"),
  data: z.object({
    logs: z.array(LogTransmitSchema),
  }),
});

/**
 * Batch group logs message schema (legacy)
 */
export const BatchGroupLogsMessageSchema = BaseMessageSchema.extend({
  type: z.literal("batch_group_logs"),
  data: z.object({
    groupId: z.string().uuid(),
    logs: z.array(LogTransmitSchema),
  }),
});

// ============================================================================
// Log Schema Discovery Messages
// ============================================================================

/**
 * Report log patterns request schema
 */
export const ReportLogPatternsRequestSchema = BaseMessageSchema.extend({
  type: z.literal("report_log_patterns"),
  data: z.object({
    patterns: z.array(
      z.object({
        eventName: z.string().nullable(),
        severity: z.string().nullable(),
        teams: z.array(z.string()),
        subsystems: z.array(z.string()),
        signature: z.string(),
        exampleLine: z.string(),
      }),
    ),
  }),
});

/**
 * Get log pattern stats request schema
 */
export const GetLogPatternStatsRequestSchema = BaseMessageSchema.extend({
  type: z.literal("get_log_pattern_stats"),
});

// ============================================================================
// Union Schemas (All Messages)
// ============================================================================

/**
 * All client-to-server message schemas
 */
export const ClientMessageSchema = z.discriminatedUnion("type", [
  RegisterMessageSchema,
  PingMessageSchema,
  GetFriendsRequestSchema,
  GetFriendRequestsRequestSchema,
  SendFriendRequestMessageSchema,
  AcceptFriendRequestMessageSchema,
  DenyFriendRequestMessageSchema,
  CancelFriendRequestMessageSchema,
  RemoveFriendMessageSchema,
  GetGroupsRequestSchema,
  GetGroupMembersRequestSchema,
  CreateGroupMessageSchema,
  UpdateGroupRequestSchema,
  DeleteGroupRequestSchema,
  LeaveGroupRequestSchema,
  UpdateMemberRoleRequestSchema,
  RemoveMemberFromGroupRequestSchema,
  GetGroupInvitationsRequestSchema,
  InviteFriendToGroupMessageSchema,
  AcceptGroupInvitationMessageSchema,
  DenyGroupInvitationMessageSchema,
  CancelGroupInvitationMessageSchema,
  GetDiscoverableGroupsRequestSchema,
  GetDiscoverTagsRequestSchema,
  JoinOpenGroupRequestSchema,
  RequestJoinGroupRequestSchema,
  GetJoinRequestsRequestSchema,
  ReviewJoinRequestRequestSchema,
  GetUserProfileRequestSchema,
  UpdateUserProfileRequestSchema,
  DeleteUserProfileRequestSchema,
  DashboardDataRequestSchema,
  SendLogsMessageSchema,
  BatchLogsMessageSchema,
  BatchGroupLogsMessageSchema,
  ReportLogPatternsRequestSchema,
  GetLogPatternStatsRequestSchema,
]);

/**
 * All server-to-client message schemas
 */
export const ServerMessageSchema = z.discriminatedUnion("type", [
  RegisteredMessageSchema,
  PongMessageSchema,
  ErrorMessageSchema,
  FriendsListResponseSchema,
  FriendRequestsMessageSchema,
  FriendProfileUpdatedMessageSchema,
  GroupsListResponseSchema,
  GroupMembersResponseSchema,
  GroupInvitationsResponseSchema,
  GroupMemberProfileUpdatedMessageSchema,
  DiscoverableGroupsResponseSchema,
  DiscoverTagsResponseSchema,
  JoinOpenGroupResponseSchema,
  RequestJoinGroupResponseSchema,
  JoinRequestsResponseSchema,
  ReviewJoinRequestResponseSchema,
  NewJoinRequestMessageSchema,
  JoinRequestReviewedMessageSchema,
  UserProfileResponseSchema,
  DashboardDataResponseSchema,
]);

/**
 * All WebSocket messages (bidirectional)
 */
export const WebSocketMessageSchema = z.union([
  ClientMessageSchema,
  ServerMessageSchema,
]);

// ============================================================================
// Message Schema Registry
// ============================================================================

/**
 * Registry of all message schemas by type
 * Useful for contract testing and validation
 */
export const MessageSchemas = {
  // Authentication
  register: RegisterMessageSchema,
  registered: RegisteredMessageSchema,

  // Keepalive
  ping: PingMessageSchema,
  pong: PongMessageSchema,

  // Errors
  error: ErrorMessageSchema,

  // Friends
  get_friends: GetFriendsRequestSchema,
  friends_list: FriendsListResponseSchema,
  get_friend_requests: GetFriendRequestsRequestSchema,
  friend_requests: FriendRequestsMessageSchema,
  send_friend_request: SendFriendRequestMessageSchema,
  accept_friend_request: AcceptFriendRequestMessageSchema,
  deny_friend_request: DenyFriendRequestMessageSchema,
  cancel_friend_request: CancelFriendRequestMessageSchema,
  remove_friend: RemoveFriendMessageSchema,
  friend_profile_updated: FriendProfileUpdatedMessageSchema,

  // Groups
  get_groups: GetGroupsRequestSchema,
  groups_list: GroupsListResponseSchema,
  get_group_members: GetGroupMembersRequestSchema,
  group_members: GroupMembersResponseSchema,
  create_group: CreateGroupMessageSchema,
  update_group: UpdateGroupRequestSchema,
  delete_group: DeleteGroupRequestSchema,
  leave_group: LeaveGroupRequestSchema,
  update_member_role: UpdateMemberRoleRequestSchema,
  remove_member_from_group: RemoveMemberFromGroupRequestSchema,
  get_group_invitations: GetGroupInvitationsRequestSchema,
  group_invitations: GroupInvitationsResponseSchema,
  invite_friend_to_group: InviteFriendToGroupMessageSchema,
  accept_group_invitation: AcceptGroupInvitationMessageSchema,
  deny_group_invitation: DenyGroupInvitationMessageSchema,
  cancel_group_invitation: CancelGroupInvitationMessageSchema,
  group_member_profile_updated: GroupMemberProfileUpdatedMessageSchema,

  // Discovery
  get_discoverable_groups: GetDiscoverableGroupsRequestSchema,
  discoverable_groups: DiscoverableGroupsResponseSchema,
  get_discover_tags: GetDiscoverTagsRequestSchema,
  discover_tags: DiscoverTagsResponseSchema,
  join_open_group: JoinOpenGroupRequestSchema,
  join_open_group_result: JoinOpenGroupResponseSchema,
  request_join_group: RequestJoinGroupRequestSchema,
  request_join_group_result: RequestJoinGroupResponseSchema,
  get_join_requests: GetJoinRequestsRequestSchema,
  join_requests: JoinRequestsResponseSchema,
  review_join_request: ReviewJoinRequestRequestSchema,
  review_join_request_result: ReviewJoinRequestResponseSchema,
  new_join_request: NewJoinRequestMessageSchema,
  join_request_reviewed: JoinRequestReviewedMessageSchema,

  // Dashboard
  get_dashboard_data: DashboardDataRequestSchema,
  dashboard_data: DashboardDataResponseSchema,

  // Profile
  get_user_profile: GetUserProfileRequestSchema,
  user_profile: UserProfileResponseSchema,
  update_user_profile: UpdateUserProfileRequestSchema,
  delete_user_profile: DeleteUserProfileRequestSchema,

  // Logs
  send_logs: SendLogsMessageSchema,
  batch_logs: BatchLogsMessageSchema,
  batch_group_logs: BatchGroupLogsMessageSchema,

  // Log Schema Discovery
  report_log_patterns: ReportLogPatternsRequestSchema,
  get_log_pattern_stats: GetLogPatternStatsRequestSchema,
} as const;

/**
 * Type for message schema keys
 */
export type MessageType = keyof typeof MessageSchemas;

/**
 * Helper to validate a message against its schema
 */
export function validateMessage<T extends MessageType>(type: T, data: unknown) {
  return MessageSchemas[type].safeParse(data) as ReturnType<
    (typeof MessageSchemas)[T]["safeParse"]
  >;
}

/**
 * Helper to validate any WebSocket message
 */
export function validateWebSocketMessage(data: unknown) {
  return WebSocketMessageSchema.safeParse(data);
}
