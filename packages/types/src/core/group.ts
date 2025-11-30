/**
 * Group Types
 *
 * Group management types for organized log sharing and collaboration.
 * Includes roles, permissions, and invitations.
 *
 * @module types/core/group
 */

/**
 * Group role types
 */
export type GroupRole = "owner" | "admin" | "member";

/**
 * Group visibility types
 * - 'private': Only members can see the group (invite-only)
 * - 'discoverable': Listed publicly, anyone can find it
 */
export type GroupVisibility = "private" | "discoverable";

/**
 * Group join method types (only applies when visibility is 'discoverable')
 * - 'open': Anyone can join instantly
 * - 'request': Users must request to join and be approved
 */
export type GroupJoinMethod = "open" | "request";

/**
 * Group with member count and user's role
 *
 * This is the canonical Group type returned by the API.
 * Includes the current user's role in the group.
 */
export interface Group {
  /** Group ID (UUID) */
  id: string;

  /** Group name */
  name: string;

  /** Group description (optional) */
  description?: string;

  /** Group avatar URL/hash (null if no avatar) */
  avatar: string | null;

  /** Number of members in the group */
  memberCount: number;

  /** Current user's role in this group */
  memberRole: GroupRole;

  /** Group tags for categorization */
  tags: string[];

  /** Owner's user ID (UUID) */
  ownerId?: string;

  /** Group visibility: 'private' (default) or 'discoverable' */
  visibility: GroupVisibility;

  /** How users join when discoverable: 'open' or 'request' */
  joinMethod: GroupJoinMethod;

  /** Group creation timestamp (ISO 8601) */
  createdAt: string;

  /** Last update timestamp (ISO 8601) */
  updatedAt: string;

  /**
   * Number of pending join requests (only for owners/admins of discoverable groups)
   * Undefined for regular members or private groups
   */
  pendingJoinRequestCount?: number;
}

/**
 * Group member with user details and permissions
 *
 * Represents a member of a group with their role and permission flags.
 */
export interface GroupMember {
  /** Member's group membership ID (UUID) */
  id?: string;

  /** Group ID this member belongs to (UUID) */
  groupId: string;

  /** Member's user ID (UUID) */
  userId: string;

  /** Member's Discord ID */
  discordId: string;

  /** Member's Discord username */
  username: string;

  /** Member's computed display name */
  displayName: string;

  /** Member's Star Citizen player name */
  player: string | null;

  /** Member's Discord avatar hash */
  avatar: string | null;

  /** Member's timezone */
  timeZone: string | null;

  /** Member's role in the group */
  role: GroupRole;

  /** Whether member uses player name for display */
  usePlayerAsDisplayName?: boolean;

  /** Timestamp when member joined (ISO 8601) */
  joinedAt: string;

  /** Permission: Can invite new members */
  canInvite: boolean;

  /** Permission: Can remove other members */
  canRemoveMembers: boolean;

  /** Permission: Can edit group settings */
  canEditGroup: boolean;

  /**
   * Online status (UI state, not stored in database)
   * True if member has active WebSocket connection
   */
  isOnline?: boolean;

  /**
   * Connection status (UI state, not stored in database)
   * True if member is currently connected to WebSocket
   */
  isConnected?: boolean;
}

/**
 * Group invitation with group and inviter details
 *
 * Represents a pending invitation to join a group.
 */
export interface GroupInvitation {
  /** Invitation ID (UUID) */
  id: string;

  /** Group ID being invited to */
  groupId: string;

  /** Group details */
  group: {
    /** Group ID */
    id: string;

    /** Group name */
    name: string;

    /** Group description */
    description?: string;

    /** Group avatar */
    avatar: string | null;

    /** Group tags */
    tags?: string[];
  };

  /** Inviter's user ID */
  inviterId: string;

  /** Inviter's username */
  inviterUsername: string;

  /** Inviter's display name (respects usePlayerAsDisplayName preference) */
  inviterDisplayName?: string;

  /** Inviter's avatar (optional) */
  inviterAvatar?: string | null;

  /** Inviter's player name (optional) */
  inviterPlayer?: string | null;

  /** Invitation creation timestamp (ISO 8601) */
  createdAt: string;

  /** Invitation status (optional) */
  status?: string;

  /** Timestamp when responded (optional, ISO 8601) */
  respondedAt?: string;
}

/**
 * Group with optional members array for client-side state management.
 *
 * The Group type from the database doesn't include members, but the client
 * needs to cache members after fetching them. This type represents a group
 * that may have members loaded.
 *
 * @example
 * const group: GroupWithMembers = {
 *   ...dbGroup,
 *   members: await fetchGroupMembers(dbGroup.id)
 * };
 */
export type GroupWithMembers = Group & {
  /**
   * Optional array of group members.
   * - undefined: Members not loaded yet
   * - []: Members loaded but group is empty
   * - [...]: Members loaded and present
   */
  members?: GroupMember[];
};

/**
 * Create group data (request payload)
 */
export interface CreateGroupData {
  /** Group name (required) */
  name: string;

  /** Group description (optional) */
  description?: string;

  /** Group avatar URL/hash (optional) */
  avatar?: string | null;

  /** Group tags (optional) */
  tags?: string[];

  /** Group visibility (optional, defaults to 'private') */
  visibility?: GroupVisibility;

  /** Join method when discoverable (optional, defaults to 'request') */
  joinMethod?: GroupJoinMethod;
}

/**
 * Update group data (request payload)
 */
export interface UpdateGroupData {
  /** Group ID to update */
  groupId: string;

  /** New group name (optional) */
  name?: string;

  /** New group description (optional) */
  description?: string;

  /** New group avatar (optional) */
  avatar?: string | null;

  /** New group tags (optional) */
  tags?: string[];

  /** New visibility setting (optional) */
  visibility?: GroupVisibility;

  /** New join method (optional) */
  joinMethod?: GroupJoinMethod;
}

/**
 * Invite friend to group data
 */
export interface InviteFriendToGroupData {
  /** Group ID to invite to */
  groupId: string;

  /** Friend's user ID to invite */
  friendId: string;
}

/**
 * Group invitation action data (accept/deny)
 */
export interface GroupInvitationActionData {
  /** Invitation ID to accept/deny */
  invitationId: string;
}

/**
 * Remove group member data
 */
export interface RemoveGroupMemberData {
  /** Group ID */
  groupId: string;

  /** User ID to remove */
  userId: string;
}

/**
 * Update member role data
 */
export interface UpdateMemberRoleData {
  /** Group ID */
  groupId: string;

  /** Member's user ID */
  memberId: string;

  /** New role */
  role: GroupRole;

  /** Permission flags (optional) */
  canInvite?: boolean;
  canRemoveMembers?: boolean;
  canEditGroup?: boolean;
}

/**
 * Leave group data
 */
export interface LeaveGroupData {
  /** Group ID to leave */
  groupId: string;
}

/**
 * Delete group data
 */
export interface DeleteGroupData {
  /** Group ID to delete */
  groupId: string;
}

// ============================================================================
// Discovery Types
// ============================================================================

/**
 * Minimal public info for discoverable groups (used in browse/search)
 * Does not include memberRole since user is not a member
 */
export interface DiscoverableGroup {
  /** Group ID (UUID) */
  id: string;

  /** Group name */
  name: string;

  /** Group description (optional) */
  description?: string;

  /** Group avatar URL/hash (null if no avatar) */
  avatar: string | null;

  /** Group tags for categorization */
  tags: string[];

  /** Number of members in the group */
  memberCount: number;

  /** How users join: 'open' (instant) or 'request' (approval needed) */
  joinMethod: GroupJoinMethod;

  /** Group creation timestamp (ISO 8601) */
  createdAt: string;

  /** Owner's username (for display) */
  ownerUsername?: string;

  /** Owner's avatar (for display) */
  ownerAvatar?: string | null;

  /** Whether the current user is already a member */
  isJoined?: boolean;

  /** Whether the current user has a pending join request */
  hasPendingRequest?: boolean;
}

/**
 * Join request status types
 */
export type GroupJoinRequestStatus = "pending" | "approved" | "denied";

/**
 * Group join request (for request-based discoverable groups)
 */
export interface GroupJoinRequest {
  /** Request ID (UUID) */
  id: string;

  /** Group ID being requested */
  groupId: string;

  /** Group name (for display) */
  groupName: string;

  /** Group avatar (for display) */
  groupAvatar: string | null;

  /** Requester's user ID (UUID) */
  userId: string;

  /** Requester's Discord username */
  username: string;

  /** Requester's computed display name */
  displayName: string;

  /** Requester's avatar */
  avatar: string | null;

  /** Optional message from the requester */
  message?: string;

  /** Request status */
  status: GroupJoinRequestStatus;

  /** Request creation timestamp (ISO 8601) */
  createdAt: string;
}

/**
 * Request to join a discoverable group
 */
export interface RequestJoinGroupData {
  /** Group ID to request joining */
  groupId: string;

  /** Optional message to group owner/admins */
  message?: string;
}

/**
 * Review (approve/deny) a join request
 */
export interface ReviewJoinRequestData {
  /** Join request ID */
  requestId: string;

  /** Decision: 'approve' or 'deny' */
  decision: "approve" | "deny";
}
