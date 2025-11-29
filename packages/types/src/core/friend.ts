/**
 * Friend Types
 *
 * Friend relationship types used across all applications.
 * Uses API response format with flattened fields for efficient querying.
 *
 * @module types/core/friend
 */

/**
 * Friend relationship with computed display names and online status
 *
 * This is the canonical Friend type returned by the API. It uses a flattened
 * structure where friend details are prefixed with "friend" to avoid nesting.
 *
 * The API joins the users table twice (once for the current user, once for the friend)
 * and returns the friend's details in flattened format.
 */
export interface Friend {
  /** Friendship relationship ID (UUID) */
  id: string;

  /** Friendship status: 'pending' | 'accepted' */
  status: string;

  /** Friendship creation timestamp (ISO 8601) */
  createdAt: string;

  /** Friend's user ID (UUID) */
  friendUserId: string;

  /** Friend's Discord ID (18-digit snowflake) */
  friendDiscordId: string;

  /** Friend's Discord username */
  friendUsername: string;

  /** Friend's computed display name (player name or username) */
  friendDisplayName: string;

  /** Friend's Discord avatar hash (null if no avatar) */
  friendAvatar: string | null;

  /** Friend's Star Citizen player name (null if not set) */
  friendPlayer: string | null;

  /** Friend's timezone (IANA string, null if not set) */
  friendTimeZone: string | null;

  /** Friend's display name preference */
  friendUsePlayerAsDisplayName: boolean;

  /** Friend's friend code (for sharing, null if not generated) */
  friendCode?: string | null;

  /**
   * Online status (UI state, not stored in database)
   * True if friend has active WebSocket connection
   */
  isOnline?: boolean;

  /**
   * Connection status (UI state, not stored in database)
   * True if friend is currently connected to WebSocket
   */
  isConnected?: boolean;
}

/**
 * Friend request with direction indicator
 *
 * Represents a pending friend request with full user details.
 * Direction indicates whether request was sent by or to the current user.
 */
export interface FriendRequest {
  /** Friend request ID (UUID) */
  id: string;

  /** Request status: 'pending' | 'accepted' | 'denied' */
  status: string;

  /** Request creation timestamp (ISO 8601) */
  createdAt: string;

  /** Requester's user ID (UUID) */
  fromUserId: string;

  /** Requester's Discord ID */
  fromDiscordId: string;

  /** Requester's Discord username */
  fromUsername: string;

  /** Requester's computed display name */
  fromDisplayName: string;

  /** Requester's Discord avatar hash */
  fromAvatar: string | null;

  /** Requester's Star Citizen player name */
  fromPlayer: string | null;

  /** Requester's timezone */
  fromTimeZone: string | null;

  /** Requester's display name preference */
  fromUsePlayerAsDisplayName: boolean;

  /**
   * Request direction from current user's perspective
   * - 'incoming': Request sent TO the current user (can accept/deny)
   * - 'outgoing': Request sent BY the current user (pending their response)
   */
  direction: "incoming" | "outgoing";
}

/**
 * Combined friend requests response
 */
export interface FriendRequestsResponse {
  /** Friend requests sent to the current user */
  incoming: FriendRequest[];

  /** Friend requests sent by the current user */
  outgoing: FriendRequest[];
}

/**
 * Send friend request data (request payload)
 */
export interface SendFriendRequestData {
  /** Friend code or Discord ID to send request to */
  friendCode: string;
}

/**
 * Friend request action data (accept/deny)
 */
export interface FriendRequestActionData {
  /** Friendship ID to accept/deny */
  friendshipId: string;
}

/**
 * Remove friend data
 */
export interface RemoveFriendData {
  /** Friendship ID to remove */
  friendshipId: string;
}
