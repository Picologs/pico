/**
 * WebSocket Message Types
 *
 * Type definitions for all WebSocket messages used in the Picologs desktop app.
 * These types match the messages handled by the desktop client and are compatible
 * with the server's WebSocket protocol.
 *
 * @module lib/types/websocket-messages
 */

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
// System Messages
// ============================================================================

/**
 * Ping message - Client keepalive request
 */
export interface PingMessage extends BaseMessage {
	type: 'ping';
}

/**
 * Pong message - Server keepalive response
 */
export interface PongMessage extends BaseMessage {
	type: 'pong';
}

// ============================================================================
// Authentication Messages
// ============================================================================

/**
 * Register message - Initial authentication message sent after connection
 */
export interface RegisterMessage extends BaseMessage {
	type: 'register';
	userId: string;
	token: string;
	metadata?: Record<string, any>;
}

/**
 * Register message (OAuth variant) - Used during OAuth flow
 */
export interface RegisterOAuthMessage extends BaseMessage {
	type: 'register';
	sessionId: string;
}

/**
 * Registered confirmation message - Sent by server after successful registration
 */
export interface RegisteredMessage extends BaseMessage {
	type: 'registered';
	data?: {
		message?: string;
	};
}

/**
 * Init desktop auth message - Initiates OAuth flow for desktop app
 */
export interface InitDesktopAuthMessage extends BaseMessage {
	type: 'init_desktop_auth';
	requestId: string;
	data: {
		sessionId: string;
	};
}

/**
 * Discord OAuth callback message - Sends OAuth code to server
 */
export interface DiscordOAuthCallbackMessage extends BaseMessage {
	type: 'discord_oauth_callback';
	requestId: string;
	data: {
		code: string;
		sessionId: string;
	};
}

/**
 * Desktop auth complete message - Server sends JWT and user after OAuth
 */
export interface DesktopAuthCompleteMessage extends BaseMessage {
	type: 'desktop_auth_complete';
	requestId: string;
	data: {
		jwt: string;
		user: {
			id: string;
			discordId: string;
			username: string;
			displayName: string;
			avatar: string | null;
			player: string | null;
			createdAt: string;
		};
	};
}

// ============================================================================
// Friend Messages
// ============================================================================

/**
 * Get friends request message
 */
export interface GetFriendsMessage extends BaseMessage {
	type: 'get_friends';
	requestId?: string;
	data?: {
		page?: number;
		perPage?: number;
		sortBy?: 'username' | 'online' | 'recent';
	};
}

/**
 * Friends list response message
 */
export interface FriendsListMessage extends BaseMessage {
	type: 'friends_list';
	requestId?: string;
	friends: Array<{
		id: string;
		discordId: string;
		username: string;
		displayName: string;
		avatar: string | null;
		player: string | null;
		isOnline: boolean;
		lastSeen: string | null;
	}>;
	pagination?: {
		page: number;
		perPage: number;
		total: number;
		totalPages: number;
	};
}

/**
 * Get friend requests message
 */
export interface GetFriendRequestsMessage extends BaseMessage {
	type: 'get_friend_requests';
	requestId?: string;
}

/**
 * Friend requests response message
 */
export interface FriendRequestsMessage extends BaseMessage {
	type: 'friend_requests';
	requestId?: string;
	incoming: Array<{
		id: string;
		discordId: string;
		username: string;
		displayName: string;
		avatar: string | null;
		player: string | null;
		requestedAt: string;
	}>;
	outgoing: Array<{
		id: string;
		discordId: string;
		username: string;
		displayName: string;
		avatar: string | null;
		player: string | null;
		requestedAt: string;
	}>;
}

/**
 * Send friend request message
 */
export interface SendFriendRequestMessage extends BaseMessage {
	type: 'send_friend_request';
	requestId?: string;
	data: {
		username: string;
	};
}

/**
 * Accept friend request message
 */
export interface AcceptFriendRequestMessage extends BaseMessage {
	type: 'accept_friend_request';
	requestId?: string;
	data: {
		friendshipId: string;
	};
}

/**
 * Deny friend request message
 */
export interface DenyFriendRequestMessage extends BaseMessage {
	type: 'deny_friend_request';
	requestId?: string;
	data: {
		friendshipId: string;
	};
}

/**
 * Remove friend message
 */
export interface RemoveFriendMessage extends BaseMessage {
	type: 'remove_friend';
	requestId?: string;
	data: {
		friendId: string;
	};
}

// ============================================================================
// Group Messages
// ============================================================================

/**
 * Get groups request message
 */
export interface GetGroupsMessage extends BaseMessage {
	type: 'get_groups';
	requestId?: string;
	data?: {
		includeMembers?: boolean;
	};
}

/**
 * Groups list response message
 */
export interface GroupsListMessage extends BaseMessage {
	type: 'groups_list';
	requestId?: string;
	groups: Array<{
		id: string;
		name: string;
		description: string | null;
		avatar: string | null;
		ownerId: string;
		createdAt: string;
		memberCount?: number;
		role?: 'owner' | 'admin' | 'member';
	}>;
}

/**
 * Get group members request message
 */
export interface GetGroupMembersMessage extends BaseMessage {
	type: 'get_group_members';
	requestId?: string;
	data: {
		groupId: string;
	};
}

/**
 * Group members response message
 */
export interface GroupMembersMessage extends BaseMessage {
	type: 'group_members';
	requestId?: string;
	data: Array<{
		userId: string;
		discordId: string;
		username: string;
		displayName: string;
		avatar: string | null;
		player: string | null;
		role: 'owner' | 'admin' | 'member';
		joinedAt: string;
		isOnline: boolean;
	}>;
}

/**
 * Create group message
 */
export interface CreateGroupMessage extends BaseMessage {
	type: 'create_group';
	requestId?: string;
	data: {
		name: string;
		description?: string | null;
		avatar?: string | null;
	};
}

/**
 * Update group message
 */
export interface UpdateGroupMessage extends BaseMessage {
	type: 'update_group';
	requestId?: string;
	data: {
		groupId: string;
		name?: string;
		description?: string | null;
		avatar?: string | null;
	};
}

/**
 * Invite friend to group message
 */
export interface InviteFriendToGroupMessage extends BaseMessage {
	type: 'invite_friend_to_group';
	requestId?: string;
	data: {
		groupId: string;
		friendId: string;
	};
}

/**
 * Accept group invitation message
 */
export interface AcceptGroupInvitationMessage extends BaseMessage {
	type: 'accept_group_invitation';
	requestId?: string;
	data: {
		invitationId: string;
	};
}

/**
 * Deny group invitation message
 */
export interface DenyGroupInvitationMessage extends BaseMessage {
	type: 'deny_group_invitation';
	requestId?: string;
	data: {
		invitationId: string;
	};
}

/**
 * Leave group message
 */
export interface LeaveGroupMessage extends BaseMessage {
	type: 'leave_group';
	requestId?: string;
	data: {
		groupId: string;
	};
}

/**
 * Remove group member message
 */
export interface RemoveGroupMemberMessage extends BaseMessage {
	type: 'remove_group_member';
	requestId?: string;
	data: {
		groupId: string;
		memberId: string;
	};
}

/**
 * Update member role message
 */
export interface UpdateMemberRoleMessage extends BaseMessage {
	type: 'update_member_role';
	requestId?: string;
	data: {
		groupId: string;
		memberId: string;
		role: 'member' | 'admin';
	};
}

/**
 * Delete group message
 */
export interface DeleteGroupMessage extends BaseMessage {
	type: 'delete_group';
	requestId?: string;
	data: {
		groupId: string;
	};
}

// ============================================================================
// Log Messages
// ============================================================================

/**
 * Single log message (to friends)
 */
export interface LogMessage extends BaseMessage {
	type: 'log';
	requestId?: string;
	data: {
		id: string;
		userId: string;
		player: string | null;
		emoji: string;
		line: string;
		timestamp: string;
		original: string;
		eventType?: string;
		metadata?: Record<string, any>;
	};
}

/**
 * Batch logs message (to friends)
 */
export interface BatchLogsMessage extends BaseMessage {
	type: 'batch_logs';
	requestId?: string;
	data: {
		logs: Array<{
			id: string;
			userId: string;
			player: string | null;
			emoji: string;
			line: string;
			timestamp: string;
			original: string;
			eventType?: string;
			metadata?: Record<string, any>;
		}>;
		compressed?: boolean;
		compressedData?: string;
	};
}

/**
 * Send group log message (single log to group)
 */
export interface SendGroupLogMessage extends BaseMessage {
	type: 'send_group_log';
	requestId?: string;
	data: {
		groupId: string;
		log: {
			id: string;
			userId: string;
			player: string | null;
			emoji: string;
			line: string;
			timestamp: string;
			original: string;
			eventType?: string;
			metadata?: Record<string, any>;
		};
	};
}

/**
 * Batch group logs message (multiple logs to group)
 */
export interface BatchGroupLogsMessage extends BaseMessage {
	type: 'batch_group_logs';
	requestId?: string;
	data: {
		groupId: string;
		logs: Array<{
			id: string;
			userId: string;
			player: string | null;
			emoji: string;
			line: string;
			timestamp: string;
			original: string;
			eventType?: string;
			metadata?: Record<string, any>;
		}>;
		compressed?: boolean;
		compressedData?: string;
	};
}

/**
 * Sync logs message - Delta sync for bandwidth optimization
 */
export interface SyncLogsMessage extends BaseMessage {
	type: 'sync_logs';
	requestId?: string;
	data: {
		lastSyncTimestamp?: string;
		friendId?: string;
		groupId?: string;
	};
}

// ============================================================================
// Notification Messages (Real-time Events)
// ============================================================================

/**
 * User came online notification
 */
export interface UserCameOnlineMessage extends BaseMessage {
	type: 'user_came_online';
	data: {
		userId: string;
		discordId: string;
		username: string;
		displayName: string;
		avatar: string | null;
	};
}

/**
 * User disconnected notification
 */
export interface UserDisconnectedMessage extends BaseMessage {
	type: 'user_disconnected';
	data: {
		userId: string;
		discordId: string;
		username: string;
		displayName: string;
	};
}

/**
 * Friend request received notification
 */
export interface FriendRequestReceivedMessage extends BaseMessage {
	type: 'friend_request_received';
	data: {
		friendshipId: string;
		fromUserId: string;
		fromDiscordId: string;
		fromUsername: string;
		fromDisplayName: string;
		fromAvatar: string | null;
		fromPlayer: string | null;
	};
}

/**
 * Friend request accepted notification
 */
export interface FriendRequestAcceptedMessage extends BaseMessage {
	type: 'friend_request_accepted';
	data: {
		friendshipId: string;
		friendId: string;
		friendDiscordId: string;
		friendUsername: string;
		friendDisplayName: string;
		friendAvatar: string | null;
	};
}

/**
 * Friend removed notification
 */
export interface FriendRemovedMessage extends BaseMessage {
	type: 'friend_removed';
	data: {
		friendId: string;
		friendUsername: string;
	};
}

/**
 * Group invitation received notification
 */
export interface GroupInvitationReceivedMessage extends BaseMessage {
	type: 'group_invitation_received';
	data: {
		invitationId: string;
		groupId: string;
		groupName: string;
		groupAvatar: string | null;
		inviterId: string;
		inviterUsername: string;
		inviterDisplayName: string;
		inviterAvatar: string | null;
	};
}

/**
 * Member joined group notification
 */
export interface MemberJoinedGroupMessage extends BaseMessage {
	type: 'member_joined_group';
	data: {
		groupId: string;
		groupName: string;
		userId: string;
		username: string;
		displayName: string;
		avatar: string | null;
	};
}

/**
 * Member left group notification
 */
export interface MemberLeftGroupMessage extends BaseMessage {
	type: 'member_left_group';
	data: {
		groupId: string;
		groupName: string;
		userId: string;
		username: string;
		displayName: string;
	};
}

// ============================================================================
// Dashboard Messages
// ============================================================================

/**
 * Get dashboard data request - Optimized single-call for all dashboard data
 */
export interface GetDashboardDataMessage extends BaseMessage {
	type: 'get_dashboard_data';
	requestId?: string;
	data?: {
		friendsPage?: number;
		friendsPerPage?: number;
		includeGroupMembers?: boolean;
	};
}

/**
 * Dashboard data response message
 */
export interface DashboardDataMessage extends BaseMessage {
	type: 'dashboard_data';
	requestId?: string;
	data: {
		friends: Array<{
			id: string;
			discordId: string;
			username: string;
			displayName: string;
			avatar: string | null;
			player: string | null;
			isOnline: boolean;
			lastSeen: string | null;
		}>;
		friendsPagination: {
			page: number;
			perPage: number;
			total: number;
			totalPages: number;
		};
		groups: Array<{
			id: string;
			name: string;
			description: string | null;
			avatar: string | null;
			ownerId: string;
			createdAt: string;
			memberCount?: number;
			role?: 'owner' | 'admin' | 'member';
		}>;
		groupMembers?: Record<
			string,
			Array<{
				userId: string;
				discordId: string;
				username: string;
				displayName: string;
				avatar: string | null;
				player: string | null;
				role: 'owner' | 'admin' | 'member';
				joinedAt: string;
				isOnline: boolean;
			}>
		>;
		logs: Array<{
			id: string;
			userId: string;
			player: string | null;
			emoji: string;
			line: string;
			timestamp: string;
			original: string;
			eventType?: string;
			metadata?: Record<string, any>;
		}>;
	};
}

// ============================================================================
// Error Messages
// ============================================================================

/**
 * Error message - Sent when an error occurs processing a message
 */
export interface ErrorMessage extends BaseMessage {
	type: 'error';
	requestId?: string;
	message: string;
	error?: string;
	data?: {
		message?: string;
		code?: string;
		details?: any;
	};
}

// ============================================================================
// Union Types
// ============================================================================

/**
 * All possible outgoing messages (client → server)
 */
export type OutgoingMessage =
	// System
	| PongMessage
	// Authentication
	| RegisterMessage
	| RegisterOAuthMessage
	| InitDesktopAuthMessage
	| DiscordOAuthCallbackMessage
	// Friends
	| GetFriendsMessage
	| GetFriendRequestsMessage
	| SendFriendRequestMessage
	| AcceptFriendRequestMessage
	| DenyFriendRequestMessage
	| RemoveFriendMessage
	// Groups
	| GetGroupsMessage
	| GetGroupMembersMessage
	| CreateGroupMessage
	| UpdateGroupMessage
	| InviteFriendToGroupMessage
	| AcceptGroupInvitationMessage
	| DenyGroupInvitationMessage
	| LeaveGroupMessage
	| RemoveGroupMemberMessage
	| UpdateMemberRoleMessage
	| DeleteGroupMessage
	// Logs
	| LogMessage
	| BatchLogsMessage
	| SendGroupLogMessage
	| BatchGroupLogsMessage
	| SyncLogsMessage
	// Dashboard
	| GetDashboardDataMessage;

/**
 * All possible incoming messages (server → client)
 */
export type IncomingMessage =
	// System
	| PingMessage
	// Authentication
	| RegisteredMessage
	| DesktopAuthCompleteMessage
	// Friends
	| FriendsListMessage
	| FriendRequestsMessage
	// Groups
	| GroupsListMessage
	| GroupMembersMessage
	// Logs (incoming logs from friends/groups)
	| LogMessage
	| BatchLogsMessage
	| SendGroupLogMessage
	| BatchGroupLogsMessage
	// Notifications
	| UserCameOnlineMessage
	| UserDisconnectedMessage
	| FriendRequestReceivedMessage
	| FriendRequestAcceptedMessage
	| FriendRemovedMessage
	| GroupInvitationReceivedMessage
	| MemberJoinedGroupMessage
	| MemberLeftGroupMessage
	// Dashboard
	| DashboardDataMessage
	// Errors
	| ErrorMessage;

/**
 * All possible WebSocket messages (bidirectional)
 */
export type WebSocketMessage = IncomingMessage | OutgoingMessage;
