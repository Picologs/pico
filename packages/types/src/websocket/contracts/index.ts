/**
 * WebSocket Contract Schemas
 *
 * Runtime validation schemas for all WebSocket messages and core types.
 * Used for contract testing and runtime validation.
 *
 * @module types/websocket/contracts
 */

// Core type schemas
export {
  // Pagination
  PaginationMetadataSchema,

  // User/Profile
  UserProfileSchema,
  ProfileUpdateDataSchema,

  // Friends
  FriendSchema,
  FriendRequestSchema,
  FriendRequestsResponseSchema,

  // Groups
  GroupRoleSchema,
  GroupVisibilitySchema,
  GroupJoinMethodSchema,
  GroupSchema,
  GroupMemberSchema,
  GroupInvitationSchema,
  DiscoverableGroupSchema,
  GroupJoinRequestStatusSchema,
  GroupJoinRequestSchema,

  // Logs
  LogEventTypeSchema,
  LogMetadataSchema,
  ShipGroupSchema,
  LogSchema,
  LogTransmitSchema,

  // Type exports
  type PaginationMetadataSchemaType,
  type UserProfileSchemaType,
  type FriendSchemaType,
  type FriendRequestSchemaType,
  type GroupSchemaType,
  type GroupMemberSchemaType,
  type GroupInvitationSchemaType,
  type DiscoverableGroupSchemaType,
  type GroupJoinRequestSchemaType,
  type LogSchemaType,
  type LogTransmitSchemaType,
} from "./core-schemas.js";

// Message schemas
export {
  // Base
  BaseMessageSchema,

  // Authentication
  RegisterMessageSchema,
  RegisteredMessageSchema,

  // Keepalive
  PingMessageSchema,
  PongMessageSchema,

  // Errors
  ErrorMessageSchema,

  // Friends
  GetFriendsRequestSchema,
  FriendsListResponseSchema,
  GetFriendRequestsRequestSchema,
  FriendRequestsMessageSchema,
  SendFriendRequestMessageSchema,
  AcceptFriendRequestMessageSchema,
  DenyFriendRequestMessageSchema,
  CancelFriendRequestMessageSchema,
  RemoveFriendMessageSchema,
  FriendProfileUpdatedMessageSchema,

  // Groups
  GetGroupsRequestSchema,
  GroupsListResponseSchema,
  GetGroupMembersRequestSchema,
  GroupMembersResponseSchema,
  CreateGroupMessageSchema,
  UpdateGroupRequestSchema,
  DeleteGroupRequestSchema,
  LeaveGroupRequestSchema,
  UpdateMemberRoleRequestSchema,
  RemoveMemberFromGroupRequestSchema,
  GetGroupInvitationsRequestSchema,
  GroupInvitationsResponseSchema,
  InviteFriendToGroupMessageSchema,
  AcceptGroupInvitationMessageSchema,
  DenyGroupInvitationMessageSchema,
  CancelGroupInvitationMessageSchema,
  GroupMemberProfileUpdatedMessageSchema,

  // Discovery
  GetDiscoverableGroupsRequestSchema,
  DiscoverableGroupsResponseSchema,
  GetDiscoverTagsRequestSchema,
  DiscoverTagsResponseSchema,
  JoinOpenGroupRequestSchema,
  JoinOpenGroupResponseSchema,
  RequestJoinGroupRequestSchema,
  RequestJoinGroupResponseSchema,
  GetJoinRequestsRequestSchema,
  JoinRequestsResponseSchema,
  ReviewJoinRequestRequestSchema,
  ReviewJoinRequestResponseSchema,
  NewJoinRequestMessageSchema,
  JoinRequestReviewedMessageSchema,

  // Dashboard
  DashboardFriendRequestSchema,
  DashboardGroupInvitationSchema,
  DashboardDataRequestSchema,
  DashboardDataResponseSchema,

  // Profile
  GetUserProfileRequestSchema,
  UserProfileResponseSchema,
  UpdateUserProfileRequestSchema,
  DeleteUserProfileRequestSchema,

  // Logs
  SendLogsMessageSchema,
  BatchLogsMessageSchema,
  BatchGroupLogsMessageSchema,

  // Log Schema Discovery
  ReportLogPatternsRequestSchema,
  GetLogPatternStatsRequestSchema,

  // Union schemas
  ClientMessageSchema,
  ServerMessageSchema,
  WebSocketMessageSchema,

  // Registry
  MessageSchemas,
  type MessageType,

  // Validators
  validateMessage,
  validateWebSocketMessage,
} from "./message-schemas.js";
