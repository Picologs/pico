/**
 * WebSocket Message Types
 *
 * Type definitions for all WebSocket messages exchanged between
 * the server and clients. Provides type safety for message handling.
 *
 * These types define the ~45 message types in the Picologs WebSocket protocol.
 *
 * @module types/websocket/messages
 */

import type {
  Friend,
  FriendRequest,
  Group,
  GroupMember,
  GroupInvitation,
  DiscoverableGroup,
  GroupJoinRequest,
  UserProfile,
  Log,
  PaginationMetadata,
} from "../index.js";

// ============================================================================
// Base Message Types
// ============================================================================

/**
 * Base WebSocket message structure
 * All messages extend this base type
 */
export interface BaseMessage {
  type: string;
  requestId?: string;
  timestamp?: string;
  data?: unknown;
  error?: string;
  message?: string;
}

// ============================================================================
// Friend Message Types
// ============================================================================

/**
 * Get friends request message
 */
export interface GetFriendsRequest extends BaseMessage {
  type: "get_friends";
  data?: {
    page?: number;
    perPage?: number;
    sortBy?: "username" | "online" | "recent";
  };
}

/**
 * Friends list response message
 */
export interface FriendsListResponse extends BaseMessage {
  type: "friends_list";
  data: Friend[];
  pagination: PaginationMetadata;
}

/**
 * Get friend requests message
 */
export interface GetFriendRequestsRequest extends BaseMessage {
  type: "get_friend_requests";
}

/**
 * Friend requests response message
 */
export interface FriendRequestsMessage extends BaseMessage {
  type: "friend_requests";
  data: {
    incoming: FriendRequest[];
    outgoing: FriendRequest[];
  };
}

// ============================================================================
// Group Message Types
// ============================================================================

/**
 * Get groups request message
 */
export interface GetGroupsRequest extends BaseMessage {
  type: "get_groups";
  data?: {
    includeMembers?: boolean;
  };
}

/**
 * Groups list response message
 */
export interface GroupsListResponse extends BaseMessage {
  type: "groups_list";
  data:
    | Group[]
    | {
        groups: Group[];
        members: Record<string, GroupMember[]>;
      };
}

/**
 * Get group members request message
 */
export interface GetGroupMembersRequest extends BaseMessage {
  type: "get_group_members";
  data: {
    groupId: string;
  };
}

/**
 * Group members response message
 */
export interface GroupMembersResponse extends BaseMessage {
  type: "group_members";
  data: { members: GroupMember[] };
}

/**
 * Update group request message
 */
export interface UpdateGroupRequest extends BaseMessage {
  type: "update_group";
  data: {
    groupId: string;
    name?: string;
    description?: string | null;
    avatar?: string | null;
    tags?: string[] | null;
  };
}

/**
 * Delete group request message
 */
export interface DeleteGroupRequest extends BaseMessage {
  type: "delete_group";
  data: {
    groupId: string;
  };
}

/**
 * Leave group request message
 */
export interface LeaveGroupRequest extends BaseMessage {
  type: "leave_group";
  data: {
    groupId: string;
  };
}

/**
 * Update member role request message
 */
export interface UpdateMemberRoleRequest extends BaseMessage {
  type: "update_member_role";
  data: {
    groupId: string;
    memberId: string;
    role: "member" | "admin";
  };
}

/**
 * Remove member from group request message
 */
export interface RemoveMemberFromGroupRequest extends BaseMessage {
  type: "remove_member_from_group";
  data: {
    groupId: string;
    memberId: string;
  };
}

/**
 * Get group invitations request message
 */
export interface GetGroupInvitationsRequest extends BaseMessage {
  type: "get_group_invitations";
}

/**
 * Group invitations response message
 */
export interface GroupInvitationsResponse extends BaseMessage {
  type: "group_invitations";
  data: GroupInvitation[];
}

// ============================================================================
// Group Discovery Message Types
// ============================================================================

/**
 * Get discoverable groups request message
 * Browse and search public groups
 */
export interface GetDiscoverableGroupsRequest extends BaseMessage {
  type: "get_discoverable_groups";
  data?: {
    /** Page number (default: 1) */
    page?: number;
    /** Items per page (default: 20, max: 50) */
    perPage?: number;
    /** Fuzzy search query for group name */
    search?: string;
    /** Filter by tags (array of tag strings) */
    tags?: string[];
    /** Sort order */
    sortBy?: "popular" | "recent" | "name";
  };
}

/**
 * Discoverable groups response message
 */
export interface DiscoverableGroupsResponse extends BaseMessage {
  type: "discoverable_groups";
  data: {
    groups: DiscoverableGroup[];
    pagination: PaginationMetadata;
  };
}

/**
 * Get popular tags from discoverable groups
 */
export interface GetDiscoverTagsRequest extends BaseMessage {
  type: "get_discover_tags";
}

/**
 * Discover tags response message
 */
export interface DiscoverTagsResponse extends BaseMessage {
  type: "discover_tags";
  data: Array<{ tag: string; count: number }>;
}

/**
 * Join an open group (instant join)
 */
export interface JoinOpenGroupRequest extends BaseMessage {
  type: "join_open_group";
  data: {
    groupId: string;
  };
}

/**
 * Result of joining an open group
 */
export interface JoinOpenGroupResponse extends BaseMessage {
  type: "join_open_group_result";
  data: {
    success: boolean;
    group?: Group;
    error?: string;
  };
}

/**
 * Request to join a group (requires approval)
 */
export interface RequestJoinGroupRequest extends BaseMessage {
  type: "request_join_group";
  data: {
    groupId: string;
    /** Optional message to group owner/admins */
    message?: string;
  };
}

/**
 * Result of requesting to join a group
 */
export interface RequestJoinGroupResponse extends BaseMessage {
  type: "request_join_group_result";
  data: {
    success: boolean;
    requestId?: string;
    error?: string;
  };
}

/**
 * Get pending join requests for a group (owner/admin only)
 */
export interface GetJoinRequestsRequest extends BaseMessage {
  type: "get_join_requests";
  data: {
    groupId: string;
  };
}

/**
 * Join requests response message
 */
export interface JoinRequestsResponse extends BaseMessage {
  type: "join_requests";
  data: GroupJoinRequest[];
}

/**
 * Review (approve/deny) a join request
 */
export interface ReviewJoinRequestRequest extends BaseMessage {
  type: "review_join_request";
  data: {
    requestId: string;
    decision: "approve" | "deny";
  };
}

/**
 * Result of reviewing a join request
 */
export interface ReviewJoinRequestResponse extends BaseMessage {
  type: "review_join_request_result";
  data: {
    success: boolean;
    error?: string;
  };
}

/**
 * Notification: New join request received (sent to group owner/admins)
 */
export interface NewJoinRequestMessage extends BaseMessage {
  type: "new_join_request";
  data: GroupJoinRequest;
}

/**
 * Notification: Join request was reviewed (sent to requester)
 */
export interface JoinRequestReviewedMessage extends BaseMessage {
  type: "join_request_reviewed";
  data: {
    groupId: string;
    groupName: string;
    decision: "approve" | "deny";
    /** Included if approved - the group the user just joined */
    group?: Group;
  };
}

// ============================================================================
// Dashboard Message Types
// ============================================================================

/**
 * Dashboard data request options
 * Optimized single-call request for dashboard data
 */
export interface DashboardDataRequest extends BaseMessage {
  type: "get_dashboard_data";
  data?: {
    /** Page number for friends pagination (default: 1) */
    friendsPage?: number;
    /** Friends per page (default: 50, max: 100) */
    friendsPerPage?: number;
    /** Whether to include full group member details (default: false) */
    includeGroupMembers?: boolean;
  };
}

/**
 * Friend request structure as returned by dashboard_data endpoint
 * Note: Different field naming from FriendRequest (uses requester* instead of from*)
 */
export interface DashboardFriendRequest {
  /** Friendship record ID */
  id: string;
  /** User ID who sent the request */
  userId: string;
  /** User ID who received the request */
  friendId: string;
  /** Request status */
  status: string;
  /** ISO timestamp when request was created */
  createdAt: string;
  /** Discord ID of requester */
  requesterDiscordId: string | null;
  /** Username of requester */
  requesterUsername: string | null;
  /** Display name of requester */
  requesterDisplayName: string | null;
  /** Avatar URL of requester */
  requesterAvatar: string | null;
  /** Player name of requester */
  requesterPlayer: string | null;
}

/**
 * Flattened group invitation structure optimized for dashboard queries.
 *
 * This differs from GroupInvitation by using a flat structure with direct
 * properties instead of nested objects. This allows for more efficient
 * SQL queries by avoiding joins or subqueries.
 *
 * Use GroupInvitation for detailed invitation views where nested data
 * is more convenient. Use DashboardGroupInvitation for list views where
 * performance matters.
 *
 * @example
 * // GroupInvitation (nested): { group: { name: "...", avatar: "..." } }
 * // DashboardGroupInvitation (flat): { groupName: "...", groupAvatar: "..." }
 */
export interface DashboardGroupInvitation {
  /** Invitation record ID */
  id: string;
  /** Group ID */
  groupId: string;
  /** User ID who sent the invitation */
  inviterId: string;
  /** User ID who received the invitation */
  inviteeId: string;
  /** Invitation status */
  status: string;
  /** ISO timestamp when invitation was created */
  createdAt: string;
  /** Group name */
  groupName: string | null;
  /** Group avatar URL */
  groupAvatar: string | null;
  /** Username of inviter */
  inviterUsername: string | null;
  /** Display name of inviter */
  inviterDisplayName: string | null;
  /** Avatar URL of inviter */
  inviterAvatar: string | null;
}

/**
 * Dashboard data response containing all necessary data for the dashboard
 * Single optimized call that replaces 3 sequential requests (get_friends, get_friend_requests, get_groups)
 */
export interface DashboardDataResponse extends BaseMessage {
  type: "dashboard_data";
  data: {
    /** Current user information */
    user: {
      /** User's database ID */
      id: string;
      /** User's username */
      username: string;
      /** User's avatar URL */
      avatar: string | null;
    };
    /** Paginated friends list */
    friends: Friend[];
    /** Pagination metadata for friends */
    friendsPagination: PaginationMetadata;
    /** Groups list */
    groups: Group[];
    /** Pagination metadata for groups */
    groupsPagination: PaginationMetadata;
    /** Group members map (only if includeGroupMembers: true) */
    groupMembers?: Record<string, GroupMember[]>;
    /** Pending join requests for groups the user is owner/admin of (for notification dropdown) */
    pendingJoinRequests?: Record<string, GroupJoinRequest[]>;
    /** Recent logs from friends and groups (always empty initially, populated via subscriptions) */
    logs: Log[];
    /** Notifications */
    notifications: {
      /** Incoming friend requests */
      friendRequests: DashboardFriendRequest[];
      /** Group invitations */
      groupInvitations: DashboardGroupInvitation[];
    };
  };
}

// ============================================================================
// Clean Inner Data Types
// ============================================================================

/**
 * Clean inner data types for client usage (strips WebSocket wrapper)
 *
 * These type aliases extract the 'data' field from response messages,
 * allowing cleaner type annotations in client code.
 *
 * @example
 * // Instead of: sendRequest<DashboardDataResponse['data']>
 * // Use: sendRequest<DashboardData>
 */

/**
 * Dashboard data without WebSocket wrapper
 * Extracted from DashboardDataResponse['data']
 */
export type DashboardData = DashboardDataResponse["data"];

/**
 * Group members data without WebSocket wrapper
 * Extracted from GroupMembersResponse['data']
 */
export type GroupMembersData = GroupMembersResponse["data"];

// ============================================================================
// Profile Message Types
// ============================================================================

/**
 * Get user profile request message
 */
export interface GetUserProfileRequest extends BaseMessage {
  type: "get_user_profile";
  data?: {
    userId?: string;
  };
}

/**
 * User profile response message
 */
export interface UserProfileResponse extends BaseMessage {
  type: "user_profile";
  data: UserProfile;
}

/**
 * Update user profile request message
 */
export interface UpdateUserProfileRequest extends BaseMessage {
  type: "update_user_profile";
  data: {
    player?: string | null;
    timeZone?: string | null;
    usePlayerAsDisplayName?: boolean;
  };
}

/**
 * Friend profile updated broadcast message
 * Sent to all friends when a user's profile is updated
 */
export interface FriendProfileUpdatedMessage extends BaseMessage {
  type: "friend_profile_updated";
  data: {
    discordId: string;
    player: string | null;
    username: string;
    avatar: string | null;
    usePlayerAsDisplayName: boolean;
    displayName: string;
    /** User's timezone (null if showTimezone is false) */
    timeZone: string | null;
    /** Whether the user wants to show their timezone */
    showTimezone: boolean;
  };
}

/**
 * Group member profile updated broadcast message
 * Sent to all group members when a member's profile is updated
 */
export interface GroupMemberProfileUpdatedMessage extends BaseMessage {
  type: "group_member_profile_updated";
  data: {
    discordId: string;
    player: string | null;
    username: string;
    avatar: string | null;
    usePlayerAsDisplayName: boolean;
    displayName: string;
    /** User's timezone (null if showTimezone is false) */
    timeZone: string | null;
    /** Whether the user wants to show their timezone */
    showTimezone: boolean;
  };
}

// ============================================================================
// Authentication Message Types
// ============================================================================

/**
 * Register message
 * Initial authentication message sent after connection
 */
export interface RegisterMessage extends BaseMessage {
  type: "register";
  userId: string;
  token: string;
  metadata?: Record<string, any>;
}

/**
 * Registered confirmation message
 * Sent by server after successful registration
 */
export interface RegisteredMessage extends BaseMessage {
  type: "registered";
  data?: {
    message?: string;
  };
}

// ============================================================================
// Log Message Types
// ============================================================================

/**
 * Send logs message (consolidated)
 * Replaces legacy: send_log, send_batch_logs, send_group_log, batch_group_logs
 */
export interface SendLogsMessage extends BaseMessage {
  type: "send_logs";
  data: {
    logs: Log[];
    target: {
      type: "friends" | "group";
      groupId?: string;
    };
    compressed?: boolean;
    compressedData?: string;
  };
}

// ============================================================================
// Error Message Types
// ============================================================================

/**
 * Error message
 * Sent when an error occurs processing a message
 */
export interface ErrorMessage extends BaseMessage {
  type: "error";
  message: string;
  error?: string;
  data?: any;
}

// ============================================================================
// Keepalive Message Types
// ============================================================================

/**
 * Ping message
 * Client keepalive request
 */
export interface PingMessage extends BaseMessage {
  type: "ping";
}

/**
 * Pong message
 * Server keepalive response
 */
export interface PongMessage extends BaseMessage {
  type: "pong";
}

// ============================================================================
// Union Types
// ============================================================================

/**
 * All possible client-to-server messages
 */
export type ClientMessage =
  | RegisterMessage
  | PingMessage
  | GetFriendsRequest
  | GetFriendRequestsRequest
  | GetGroupsRequest
  | GetGroupMembersRequest
  | GetGroupInvitationsRequest
  | UpdateGroupRequest
  | DeleteGroupRequest
  | LeaveGroupRequest
  | UpdateMemberRoleRequest
  | RemoveMemberFromGroupRequest
  // Discovery messages
  | GetDiscoverableGroupsRequest
  | GetDiscoverTagsRequest
  | JoinOpenGroupRequest
  | RequestJoinGroupRequest
  | GetJoinRequestsRequest
  | ReviewJoinRequestRequest
  | GetUserProfileRequest
  | UpdateUserProfileRequest
  | DashboardDataRequest
  | SendLogsMessage;

/**
 * All possible server-to-client messages
 */
export type ServerMessage =
  | RegisteredMessage
  | PongMessage
  | FriendsListResponse
  | FriendRequestsMessage
  | GroupsListResponse
  | GroupMembersResponse
  | GroupInvitationsResponse
  // Discovery responses
  | DiscoverableGroupsResponse
  | DiscoverTagsResponse
  | JoinOpenGroupResponse
  | RequestJoinGroupResponse
  | JoinRequestsResponse
  | ReviewJoinRequestResponse
  // Discovery notifications
  | NewJoinRequestMessage
  | JoinRequestReviewedMessage
  | UserProfileResponse
  | FriendProfileUpdatedMessage
  | GroupMemberProfileUpdatedMessage
  | DashboardDataResponse
  | ErrorMessage;

/**
 * All possible WebSocket messages (bidirectional)
 */
export type WebSocketMessage = ClientMessage | ServerMessage;
