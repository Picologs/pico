/**
 * Types Module
 *
 * Centralized type definitions for the Picologs ecosystem.
 * This is the single source of truth for all type definitions used across:
 * - picologs (desktop app)
 * - website (SvelteKit app)
 * - bun-server (WebSocket server)
 * - shared-svelte (shared components and utilities)
 *
 * @module types
 */

// ============================================================================
// Core Domain Types
// ============================================================================

export type {
  Log,
  LogEventType,
  LogMetadata,
  ShipGroup,
  LogTransmit,
  RecentEvent,
  LogLine,
  LogSyncOptions,
  RawLogPattern,
} from "./core/log.js";

export { toLogTransmit, fromLogTransmit } from "./core/log.js";

export type { UserProfile, ProfileUpdateData } from "./core/user.js";

export {
  getDisplayName,
  getSecondaryName,
  hasPlayerName,
  formatUserDisplay,
} from "./core/user.js";

export type {
  Friend,
  FriendRequest,
  FriendRequestsResponse,
  SendFriendRequestData,
  FriendRequestActionData,
  RemoveFriendData,
} from "./core/friend.js";

export type {
  GroupRole,
  GroupVisibility,
  GroupJoinMethod,
  Group,
  GroupMember,
  GroupInvitation,
  GroupWithMembers,
  CreateGroupData,
  UpdateGroupData,
  InviteFriendToGroupData,
  GroupInvitationActionData,
  RemoveGroupMemberData,
  UpdateMemberRoleData,
  LeaveGroupData,
  DeleteGroupData,
  // Discovery types
  DiscoverableGroup,
  GroupJoinRequestStatus,
  GroupJoinRequest,
  RequestJoinGroupData,
  ReviewJoinRequestData,
} from "./core/group.js";

export type {
  NotificationType as NotificationTypeEnum,
  Notification,
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
} from "./core/notification.js";

// ============================================================================
// Database Types
// ============================================================================

export {
  users,
  groups,
  groupMembers,
  groupInvitations,
  groupJoinRequests,
  friends,
  notifications,
  usersRelations,
  groupsRelations,
  groupMembersRelations,
  friendsRelations,
  groupInvitationsRelations,
  groupJoinRequestsRelations,
  notificationsRelations,
  // Log schema discovery tables
  logPatterns,
  logPatternExamples,
  logTags,
  logPatternReports,
  logPatternsRelations,
  logPatternExamplesRelations,
  logTagsRelations,
  logPatternReportsRelations,
  // Admin tables
  adminSettings,
  adminAuditLog,
  adminSettingsRelations,
  adminAuditLogRelations,
} from "./database/schema.js";

export type {
  DBUser,
  DBNewUser,
  DBGroup,
  DBNewGroup,
  DBGroupMember,
  DBNewGroupMember,
  DBFriend,
  DBNewFriend,
  DBGroupInvitation,
  DBNewGroupInvitation,
  DBGroupJoinRequest,
  DBNewGroupJoinRequest,
  DBNotification,
  DBNewNotification,
  // Log schema discovery types
  DBLogPattern,
  DBNewLogPattern,
  DBLogPatternExample,
  DBNewLogPatternExample,
  DBLogTag,
  DBNewLogTag,
  DBLogPatternReport,
  DBNewLogPatternReport,
  // Admin types
  DBAdminSetting,
  DBNewAdminSetting,
  DBAdminAuditLog,
  DBNewAdminAuditLog,
} from "./database/schema.js";

// ============================================================================
// API Types
// ============================================================================

export type {
  PaginationMetadata,
  PaginatedResponse,
} from "./api/pagination.js";

export {
  calculateTotalPages,
  hasMorePages,
  createPaginationMetadata,
} from "./api/pagination.js";

// ============================================================================
// Authentication Types
// ============================================================================

export type { JWTPayload, JWTVerifyOptions, JWTErrorCode } from "./auth/jwt.js";

export { JWTError } from "./auth/jwt.js";

export type {
  DiscordTokenResponse,
  DiscordUser,
  OAuthSession,
  OAuthCallbackParams,
} from "./auth/oauth.js";

// ============================================================================
// WebSocket Types
// ============================================================================

export type {
  WebSocketData,
  ClientInfo,
  WebSocketJWTPayload,
  AuthSession,
  BandwidthMetrics,
  RateLimit,
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
  DashboardFriendRequest,
  DashboardGroupInvitation,
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
  // Clean inner data types (strips WebSocket wrapper)
  DashboardData,
  GroupMembersData,
} from "./websocket/index.js";

// ============================================================================
// UI Types
// ============================================================================

export type {
  NotificationType,
  NotificationOptions,
  NotificationCallback,
} from "./ui/notifications.js";

export { normalizeNotification, callNotification } from "./ui/notifications.js";
