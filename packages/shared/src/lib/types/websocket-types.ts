/**
 * WebSocket Types
 *
 * Shared types for the unified WebSocket manager and API namespaces
 */

// Import centralized types from @pico/types
import type {
  UserProfile,
  ProfileUpdateData,
  Friend,
  FriendRequest,
  Group,
  GroupMember,
  GroupInvitation,
  CreateGroupData,
  UpdateGroupData,
  Log,
  LogTransmit,
  LogSyncOptions,
  PaginationMetadata,
} from "@pico/types";

// Re-export imported types for convenience
export type {
  UserProfile,
  ProfileUpdateData,
  Friend,
  FriendRequest,
  Group,
  GroupMember,
  GroupInvitation,
  CreateGroupData,
  UpdateGroupData,
  Log,
  LogTransmit,
  LogSyncOptions,
  PaginationMetadata,
};

// ============================================================================
// Core Types
// ============================================================================

/**
 * WebSocket message structure
 */
export interface WebSocketMessage {
  /** Message type identifier */
  type: string;
  /** Unique request identifier for request-response pattern */
  requestId?: string;
  /** Optional message payload */
  data?: unknown;
  /** Error message if request failed */
  error?: string;
  /** Human-readable message */
  message?: string;
  /** Timestamp of message creation */
  timestamp?: string;
  /** Pagination metadata (for paginated responses) */
  pagination?: PaginationMetadata;
  /** Allow additional properties for server messages */
  [key: string]: unknown;
}

/**
 * Configuration for UnifiedWebSocketManager
 */
export interface UnifiedWebSocketConfig {
  /** WebSocket server URL (e.g., wss://example.com/ws) */
  url: string;
  /** User ID for authentication */
  userId: string;
  /** JWT token for authentication */
  token: string;
  /** Optional friend code for registration metadata */
  friendCode?: string;
  /** Optional metadata to send during registration */
  metadata?: Record<string, unknown>;

  // Connection lifecycle callbacks
  /** Callback when connection is established */
  onConnected?: () => void;
  /** Callback when connection is lost */
  onDisconnected?: () => void;
  /** Callback when registration with server is confirmed */
  onRegistered?: () => void;
  /** Callback when an error occurs */
  onError?: (error: Error) => void;

  // Configuration options
  /** Milliseconds between heartbeat pings (default: 30000) */
  heartbeatInterval?: number;
  /** Milliseconds between reconnection attempts (default: 1000) */
  reconnectInterval?: number;
  /** Maximum number of reconnection attempts (default: 10) */
  maxReconnectAttempts?: number;
  /** Default timeout for requests in milliseconds (default: 30000) */
  requestTimeout?: number;
  /** Enable debug logging (default: false) */
  debug?: boolean;
}

// ============================================================================
// Profile API Types
// ============================================================================

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T;
  pagination: PaginationMetadata;
}

/**
 * Profile API namespace
 */
export interface ProfileAPI {
  /** Get user profile */
  getProfile(userId?: string): Promise<UserProfile>;

  /** Update user profile */
  updateProfile(updates: ProfileUpdateData): Promise<UserProfile>;

  /** Delete user profile */
  deleteProfile(): Promise<void>;

  /** Subscribe to profile update events */
  onProfileUpdated(callback: (profile: UserProfile) => void): () => void;
}

// ============================================================================
// Friends API Types
// ============================================================================

/**
 * Friends API namespace
 */
export interface FriendsAPI {
  /** Get friends list with optional pagination */
  getFriends(options?: {
    page?: number;
    perPage?: number;
    sortBy?: "username" | "online" | "recent";
  }): Promise<PaginatedResponse<Friend[]>>;

  /** Get friend requests */
  getFriendRequests(): Promise<{
    incoming: FriendRequest[];
    outgoing: FriendRequest[];
  }>;

  /** Send friend request */
  sendFriendRequest(friendCode: string): Promise<void>;

  /** Accept friend request */
  acceptFriendRequest(friendshipId: string): Promise<void>;

  /** Deny friend request */
  denyFriendRequest(friendshipId: string): Promise<void>;

  /** Remove friend */
  removeFriend(friendshipId: string): Promise<void>;

  /** Subscribe to friend request received events */
  onFriendRequestReceived(
    callback: (request: FriendRequest) => void,
  ): () => void;

  /** Subscribe to friend request accepted events */
  onFriendRequestAccepted(callback: (data: unknown) => void): () => void;

  /** Subscribe to friends list changed events */
  onFriendsChanged(callback: () => void): () => void;

  /** Subscribe to friend online events */
  onFriendOnline(callback: (friendId: string) => void): () => void;

  /** Subscribe to friend offline events */
  onFriendOffline(callback: (friendId: string) => void): () => void;
}

// ============================================================================
// Groups API Types
// ============================================================================

/**
 * Groups API namespace
 */
export interface GroupsAPI {
  /** Get groups list */
  getGroups(
    includeMembers?: boolean,
  ): Promise<
    Group[] | { groups: Group[]; members: Record<string, GroupMember[]> }
  >;

  /** Get group members */
  getGroupMembers(groupId: string): Promise<GroupMember[]>;

  /** Get group invitations */
  getGroupInvitations(): Promise<GroupInvitation[]>;

  /** Create group */
  createGroup(data: CreateGroupData): Promise<{ id: string }>;

  /** Update group */
  updateGroup(data: UpdateGroupData): Promise<Group>;

  /** Delete group */
  deleteGroup(groupId: string): Promise<void>;

  /** Invite friend to group */
  inviteFriendToGroup(
    groupId: string,
    friendId: string,
  ): Promise<{ id: string }>;

  /** Accept group invitation */
  acceptGroupInvitation(invitationId: string): Promise<void>;

  /** Deny group invitation */
  denyGroupInvitation(invitationId: string): Promise<void>;

  /** Leave group */
  leaveGroup(groupId: string): Promise<void>;

  /** Remove member from group */
  removeMemberFromGroup(groupId: string, userId: string): Promise<void>;

  /** Update member role in group */
  updateMemberRole(data: {
    groupId: string;
    memberId: string;
    role: string;
  }): Promise<void>;

  /** Subscribe to group invitation received events */
  onGroupInvitationReceived(
    callback: (invitation: GroupInvitation) => void,
  ): () => void;

  /** Subscribe to groups list changed events */
  onGroupsChanged(callback: () => void): () => void;
}

// ============================================================================
// Logs API Types
// ============================================================================

/**
 * Logs API namespace
 */
export interface LogsAPI {
  /** Send single log */
  sendLog(log: LogTransmit): Promise<void>;

  /** Send batch logs */
  sendBatchLogs(logs: LogTransmit[], compressed?: boolean): Promise<void>;

  /** Send group log */
  sendGroupLog(groupId: string, log: LogTransmit): Promise<void>;

  /** Send batch group logs */
  sendBatchGroupLogs(
    groupId: string,
    logs: LogTransmit[],
    compressed?: boolean,
  ): Promise<void>;

  /** Request log sync */
  requestLogSync(
    targetUserId: string,
    options?: LogSyncOptions,
  ): Promise<Log[]>;

  /** Subscribe to log received events */
  onLogReceived(callback: (log: Log, senderId: string) => void): () => void;

  /** Subscribe to batch logs received events */
  onBatchLogsReceived(
    callback: (logs: Log[], senderId: string) => void,
  ): () => void;

  /** Subscribe to group log received events */
  onGroupLogReceived(callback: (log: Log, groupId: string) => void): () => void;
}

// ============================================================================
// Dashboard API Types
// ============================================================================

/**
 * Dashboard data request options
 */
export interface DashboardDataRequest {
  /** Page number for friends pagination (default: 1) */
  friendsPage?: number;
  /** Friends per page (default: 10, max: 100) */
  friendsPerPage?: number;
  /** Page number for groups pagination (default: 1) */
  groupsPage?: number;
  /** Groups per page (default: 10, max: 100) */
  groupsPerPage?: number;
  /** Whether to include full group member details (default: false) */
  includeGroupMembers?: boolean;
}

/**
 * Dashboard data response - Complete app state for authenticated layout initialization
 *
 * This represents the complete initial state sent when the authenticated layout loads.
 * After this, all updates are delivered as small delta events (friend_online, etc.).
 */
export interface DashboardDataResponse {
  /** Current user basic info */
  user: {
    /** User database ID (UUID) */
    id: string;
    /** Discord username */
    username: string;
    /** Avatar URL or null */
    avatar: string | null;
  };
  /** Paginated friends list (sorted by online status, then display name) */
  friends: Friend[];
  /** Pagination metadata for friends */
  friendsPagination: PaginationMetadata;
  /** Paginated groups list (sorted by name) */
  groups: Group[];
  /** Pagination metadata for groups */
  groupsPagination: PaginationMetadata;
  /** Group members map (only if includeGroupMembers: true) */
  groupMembers?: Record<string, GroupMember[]>;
  /** Logs array (always empty initially, populated via WS subscriptions) */
  logs: Log[];
  /** Pending notifications requiring user action */
  notifications: {
    /** Incoming friend requests (status='pending') */
    friendRequests: FriendRequest[];
    /** Incoming group invitations (status='pending') */
    groupInvitations: GroupInvitation[];
  };
}

/**
 * Dashboard API namespace
 */
export interface DashboardAPI {
  /** Get all dashboard data in a single optimized request */
  getDashboardData(
    options?: DashboardDataRequest,
  ): Promise<DashboardDataResponse>;

  /** Subscribe to dashboard data changed events */
  onDashboardDataChanged(callback: () => void): () => void;
}
