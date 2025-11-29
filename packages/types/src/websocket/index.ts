/**
 * WebSocket Module
 *
 * Export barrel for all WebSocket-related types including
 * connection state, authentication, metrics, and message protocol.
 *
 * @module types/websocket
 */

// Connection & Authentication Types
export type {
  WebSocketData,
  ClientInfo,
  WebSocketJWTPayload,
  AuthSession,
  BandwidthMetrics,
  RateLimit,
} from "./connection.js";

// Message Protocol Types
export type {
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
  // Discovery message types
  GetDiscoverableGroupsRequest,
  DiscoverableGroupsResponse,
  GetDiscoverTagsRequest,
  DiscoverTagsResponse,
  JoinOpenGroupRequest,
  JoinOpenGroupResponse,
  RequestJoinGroupRequest,
  RequestJoinGroupResponse,
  GetJoinRequestsRequest,
  JoinRequestsResponse,
  ReviewJoinRequestRequest,
  ReviewJoinRequestResponse,
  NewJoinRequestMessage,
  JoinRequestReviewedMessage,
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
} from "./messages.js";

// Profile updated broadcast message types
export type {
  FriendProfileUpdatedMessage,
  GroupMemberProfileUpdatedMessage,
} from "./messages.js";

// Contract Schemas (Zod)
export * from "./contracts/index.js";
