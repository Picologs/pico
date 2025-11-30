/**
 * Shared test utilities for picologs-shared tests
 *
 * Provides helper functions for creating mock data and test fixtures.
 */

import type {
  Log,
  Friend,
  FriendRequest,
  Group,
  GroupMember,
  GroupInvitation,
  GroupJoinRequest,
  UserProfile,
  DiscoverableGroup,
} from "@pico/types";

/**
 * Create a test Log object with default values and optional overrides
 */
export function createTestLog(overrides: Partial<Log> = {}): Log {
  return {
    id: `log-${Date.now()}-${Math.random()}`,
    userId: "user-123",
    player: "TestPlayer",
    reportedBy: ["TestPlayer"],
    emoji: "📝",
    line: "Test log line",
    timestamp: new Date().toISOString(),
    original: "Original log line",
    open: false,
    ...overrides,
  };
}

/**
 * Create a timestamp relative to a base time
 */
export function createTimestamp(baseTime: Date, offsetMs: number): string {
  return new Date(baseTime.getTime() + offsetMs).toISOString();
}

/**
 * Create a mock scroll container with scroll properties for testing scroll behavior
 * Returns a plain object that mimics HTMLDivElement scroll properties
 */
export function createMockScrollContainer() {
  return {
    scrollHeight: 1000,
    clientHeight: 500,
    scrollTop: 0,
    scrollTo: function (options: ScrollToOptions | number, y?: number) {
      if (typeof options === "number") {
        this.scrollTop = options;
      } else if (options && typeof options.top === "number") {
        this.scrollTop = options.top;
      }
    },
  };
}

/**
 * Create multiple test logs with incremental IDs and timestamps
 */
export function createTestLogs(
  count: number,
  baseOverrides: Partial<Log> = {},
): Log[] {
  const baseTime = new Date("2025-01-01T00:00:00Z");
  return Array.from({ length: count }, (_, i) =>
    createTestLog({
      id: `log-${i}`,
      timestamp: createTimestamp(baseTime, i * 1000),
      ...baseOverrides,
    }),
  );
}

/**
 * Create a test log with children (for testing nested logs)
 */
export function createTestLogWithChildren(
  parentOverrides: Partial<Log> = {},
  childrenCount: number = 3,
): Log {
  const children = createTestLogs(childrenCount, { player: "ChildPlayer" });

  return createTestLog({
    id: "parent-log",
    eventType: "killing_spree",
    children,
    ...parentOverrides,
  });
}

// ============================================================================
// Friend Fixtures
// ============================================================================

/**
 * Create a test Friend object with default values and optional overrides
 */
export function createTestFriend(overrides: Partial<Friend> = {}): Friend {
  const id =
    overrides.id ||
    `friend-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    status: "accepted",
    createdAt: new Date().toISOString(),
    friendUserId: `user-${id}`,
    friendDiscordId: `discord-${Math.random().toString(36).slice(2, 18)}`,
    friendUsername: "TestFriend",
    friendDisplayName: "Test Friend",
    friendAvatar: null,
    friendPlayer: "TestPlayer",
    friendTimeZone: "America/New_York",
    friendUsePlayerAsDisplayName: false,
    friendCode: "ABCD1234",
    isOnline: false,
    isConnected: false,
    ...overrides,
  };
}

/**
 * Create multiple test friends
 */
export function createTestFriends(
  count: number,
  baseOverrides: Partial<Friend> = {},
): Friend[] {
  return Array.from({ length: count }, (_, i) =>
    createTestFriend({
      id: `friend-${i}`,
      friendUsername: `Friend${i}`,
      friendDisplayName: `Friend ${i}`,
      friendPlayer: `Player${i}`,
      ...baseOverrides,
    }),
  );
}

/**
 * Create an online friend for testing presence
 */
export function createOnlineFriend(overrides: Partial<Friend> = {}): Friend {
  return createTestFriend({
    isOnline: true,
    isConnected: true,
    ...overrides,
  });
}

/**
 * Create a test FriendRequest object
 */
export function createTestFriendRequest(
  overrides: Partial<FriendRequest> = {},
): FriendRequest {
  const id =
    overrides.id ||
    `request-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    status: "pending",
    createdAt: new Date().toISOString(),
    fromUserId: `user-${id}`,
    fromDiscordId: `discord-${Math.random().toString(36).slice(2, 18)}`,
    fromUsername: "RequesterUser",
    fromDisplayName: "Requester User",
    fromAvatar: null,
    fromPlayer: "RequesterPlayer",
    fromTimeZone: "Europe/London",
    fromUsePlayerAsDisplayName: false,
    direction: "incoming",
    ...overrides,
  };
}

/**
 * Create incoming friend requests
 */
export function createIncomingFriendRequests(count: number): FriendRequest[] {
  return Array.from({ length: count }, (_, i) =>
    createTestFriendRequest({
      id: `incoming-${i}`,
      fromUsername: `IncomingUser${i}`,
      fromDisplayName: `Incoming User ${i}`,
      direction: "incoming",
    }),
  );
}

/**
 * Create outgoing friend requests
 */
export function createOutgoingFriendRequests(count: number): FriendRequest[] {
  return Array.from({ length: count }, (_, i) =>
    createTestFriendRequest({
      id: `outgoing-${i}`,
      fromUsername: `OutgoingUser${i}`,
      fromDisplayName: `Outgoing User ${i}`,
      direction: "outgoing",
    }),
  );
}

// ============================================================================
// Group Fixtures
// ============================================================================

/**
 * Create a test Group object with default values and optional overrides
 */
export function createTestGroup(overrides: Partial<Group> = {}): Group {
  const id =
    overrides.id ||
    `group-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    name: "Test Group",
    description: "A test group for testing",
    avatar: null,
    memberCount: 1,
    memberRole: "member",
    tags: ["test", "dev"],
    ownerId: "owner-123",
    visibility: "private",
    joinMethod: "request",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create multiple test groups
 */
export function createTestGroups(
  count: number,
  baseOverrides: Partial<Group> = {},
): Group[] {
  return Array.from({ length: count }, (_, i) =>
    createTestGroup({
      id: `group-${i}`,
      name: `Group ${i}`,
      memberCount: i + 1,
      ...baseOverrides,
    }),
  );
}

/**
 * Create a group where user is owner
 */
export function createOwnedGroup(overrides: Partial<Group> = {}): Group {
  return createTestGroup({
    memberRole: "owner",
    ...overrides,
  });
}

/**
 * Create a group where user is admin
 */
export function createAdminGroup(overrides: Partial<Group> = {}): Group {
  return createTestGroup({
    memberRole: "admin",
    ...overrides,
  });
}

/**
 * Create a discoverable group
 */
export function createDiscoverableGroup(overrides: Partial<Group> = {}): Group {
  return createTestGroup({
    visibility: "discoverable",
    joinMethod: "open",
    ...overrides,
  });
}

/**
 * Create a test GroupMember object
 */
export function createTestGroupMember(
  overrides: Partial<GroupMember> = {},
): GroupMember {
  const userId =
    overrides.userId ||
    `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    id: `member-${userId}`,
    groupId: "group-123",
    userId,
    discordId: `discord-${Math.random().toString(36).slice(2, 18)}`,
    username: "MemberUser",
    displayName: "Member User",
    player: "MemberPlayer",
    avatar: null,
    timeZone: "America/New_York",
    role: "member",
    usePlayerAsDisplayName: false,
    joinedAt: new Date().toISOString(),
    canInvite: false,
    canRemoveMembers: false,
    canEditGroup: false,
    isOnline: false,
    isConnected: false,
    ...overrides,
  };
}

/**
 * Create multiple test group members
 */
export function createTestGroupMembers(
  count: number,
  baseOverrides: Partial<GroupMember> = {},
): GroupMember[] {
  return Array.from({ length: count }, (_, i) =>
    createTestGroupMember({
      userId: `user-${i}`,
      username: `Member${i}`,
      displayName: `Member ${i}`,
      player: `Player${i}`,
      ...baseOverrides,
    }),
  );
}

/**
 * Create a test GroupInvitation object
 */
export function createTestGroupInvitation(
  overrides: Partial<GroupInvitation> = {},
): GroupInvitation {
  const id =
    overrides.id ||
    `invitation-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    groupId: "group-123",
    group: {
      id: "group-123",
      name: "Test Group",
      description: "A test group",
      avatar: null,
      tags: ["test"],
    },
    inviterId: "inviter-123",
    inviterUsername: "InviterUser",
    inviterDisplayName: "Inviter User",
    inviterAvatar: null,
    inviterPlayer: "InviterPlayer",
    createdAt: new Date().toISOString(),
    status: "pending",
    ...overrides,
  };
}

/**
 * Create a test GroupJoinRequest object
 */
export function createTestJoinRequest(
  overrides: Partial<GroupJoinRequest> = {},
): GroupJoinRequest {
  const id =
    overrides.id ||
    `join-request-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    groupId: "group-123",
    groupName: "Test Group",
    groupAvatar: null,
    userId: "user-456",
    username: "testuser",
    displayName: "Test User",
    avatar: null,
    status: "pending",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================================================
// User Profile Fixtures
// ============================================================================

/**
 * Create a test UserProfile object with default values and optional overrides
 */
export function createTestUserProfile(
  overrides: Partial<UserProfile> = {},
): UserProfile {
  const id =
    overrides.id ||
    `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    discordId: `discord-${Math.random().toString(36).slice(2, 18)}`,
    username: "TestUser",
    avatar: null,
    player: "TestPlayer",
    timeZone: "America/New_York",
    usePlayerAsDisplayName: false,
    betaTester: false,
    showTimezone: true,
    friendCode: "ABCD1234",
    role: "user",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    displayName: "TestUser",
    ...overrides,
  };
}

/**
 * Create a user profile with player name as display name
 */
export function createPlayerDisplayProfile(
  overrides: Partial<UserProfile> = {},
): UserProfile {
  return createTestUserProfile({
    usePlayerAsDisplayName: true,
    displayName: "TestPlayer",
    ...overrides,
  });
}

/**
 * Create a user profile with no player name set
 */
export function createNewUserProfile(
  overrides: Partial<UserProfile> = {},
): UserProfile {
  return createTestUserProfile({
    player: null,
    displayName: undefined,
    ...overrides,
  });
}

// ============================================================================
// Discover Page Fixtures
// ============================================================================

/**
 * Create a test DiscoverableGroup object
 */
export function createTestDiscoverableGroup(
  overrides: Partial<DiscoverableGroup> = {},
): DiscoverableGroup {
  const id =
    overrides.id ||
    `discover-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    name: "Discoverable Group",
    description: "A discoverable test group",
    avatar: null,
    tags: ["pve", "trading"],
    memberCount: 10,
    joinMethod: "open",
    createdAt: new Date().toISOString(),
    ownerUsername: "GroupOwner",
    ownerAvatar: null,
    isJoined: false,
    hasPendingRequest: false,
    ...overrides,
  };
}

/**
 * Create multiple discoverable groups for testing
 */
export function createTestDiscoverableGroups(
  count: number,
  baseOverrides: Partial<DiscoverableGroup> = {},
): DiscoverableGroup[] {
  return Array.from({ length: count }, (_, i) =>
    createTestDiscoverableGroup({
      id: `discover-${i}`,
      name: `Discoverable Group ${i}`,
      memberCount: (i + 1) * 5,
      ...baseOverrides,
    }),
  );
}

/**
 * Create a request-to-join discoverable group
 */
export function createRequestToJoinGroup(
  overrides: Partial<DiscoverableGroup> = {},
): DiscoverableGroup {
  return createTestDiscoverableGroup({
    joinMethod: "request",
    ...overrides,
  });
}

/**
 * Create a discoverable group user has already joined
 */
export function createJoinedDiscoverableGroup(
  overrides: Partial<DiscoverableGroup> = {},
): DiscoverableGroup {
  return createTestDiscoverableGroup({
    isJoined: true,
    ...overrides,
  });
}

/**
 * Create a discoverable group with pending join request
 */
export function createPendingRequestGroup(
  overrides: Partial<DiscoverableGroup> = {},
): DiscoverableGroup {
  return createTestDiscoverableGroup({
    joinMethod: "request",
    hasPendingRequest: true,
    ...overrides,
  });
}

// ============================================================================
// Backlog Test Fixtures
// ============================================================================

/**
 * Create test logs for backlog testing
 * Logs are created with timestamps spread over specified hours
 *
 * @param count - Number of logs to create
 * @param hoursSpread - How many hours to spread the logs over (default: 24)
 * @returns Array of logs with timestamps spread over the specified time period
 */
export function createBacklogLogs(
  count: number,
  hoursSpread: number = 24,
): Log[] {
  const now = Date.now();
  const msPerLog = (hoursSpread * 60 * 60 * 1000) / count;

  return Array.from({ length: count }, (_, i) =>
    createTestLog({
      id: `backlog-log-${i}`,
      timestamp: new Date(now - (count - i) * msPerLog).toISOString(),
      line: `Backlog test event ${i}`,
    }),
  );
}
