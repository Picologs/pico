/**
 * Integration Test Utilities
 *
 * Provides helpers for integration testing of the WebSocket server:
 * - MockWebSocket for simulating connections
 * - Test data fixtures and factories
 * - JWT generation for authentication
 * - Database seeding and cleanup
 * - Connection simulation
 *
 * @module server/integration/test-utils
 */

import jwt from "jsonwebtoken";
import {
  db,
  users,
  friends,
  groups,
  groupMembers,
  groupInvitations,
  groupJoinRequests,
} from "../lib/db";
import {
  clients,
  userConnections,
  rateLimits,
  failedLoginAttempts,
  authSessions,
  authSessionOwners,
} from "../lib/state";
import { eq, or, and, like, inArray } from "drizzle-orm";
import type {
  DBUser,
  DBGroup,
  DBFriend,
  DBGroupMember,
  DBGroupJoinRequest,
} from "@pico/types";

// ============================================================================
// Configuration
// ============================================================================

const JWT_SECRET =
  process.env.JWT_SECRET || "test-jwt-secret-at-least-32-chars!!";
const TEST_PREFIX = "e2e-test-";

// ============================================================================
// MockWebSocket Class
// ============================================================================

/**
 * Mock WebSocket for testing
 * Captures sent messages and simulates WebSocket behavior
 */
export class MockWebSocket {
  messages: any[] = [];
  closed = false;
  readyState = 1; // OPEN
  subscriptions: Set<string> = new Set();

  send(data: string) {
    if (this.closed) throw new Error("WebSocket is closed");
    this.messages.push(JSON.parse(data));
  }

  close() {
    this.closed = true;
    this.readyState = 3; // CLOSED
  }

  // Mock Bun WebSocket pub/sub methods
  subscribe(topic: string) {
    this.subscriptions.add(topic);
  }

  unsubscribe(topic: string) {
    this.subscriptions.delete(topic);
  }

  isSubscribedTo(topic: string): boolean {
    return this.subscriptions.has(topic);
  }

  getLastMessage() {
    return this.messages[this.messages.length - 1];
  }

  getAllMessages() {
    return this.messages;
  }

  getMessagesByType(type: string) {
    return this.messages.filter((m) => m.type === type);
  }

  hasMessage(type: string) {
    return this.messages.some((m) => m.type === type);
  }

  getMessageCount() {
    return this.messages.length;
  }

  clear() {
    this.messages = [];
  }
}

// ============================================================================
// Test Data Fixtures
// ============================================================================

/**
 * Generate a unique test ID with the e2e prefix
 */
export function testId(suffix?: string): string {
  const unique = Math.random().toString(36).substring(2, 10);
  return `${TEST_PREFIX}${suffix || ""}${unique}`;
}

/**
 * Generate a test Discord ID (18-digit snowflake format for test users)
 */
export function testDiscordId(): string {
  // Use a recognizable test pattern that won't conflict with real Discord IDs
  return `${TEST_PREFIX}discord-${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

/**
 * Generate a test UUID
 */
export function testUUID(): string {
  return crypto.randomUUID();
}

/**
 * Generate a random 6-character friend code for testing
 * Uses alphanumeric characters for uniqueness
 */
export function generateRandomFriendCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Test user fixture factory
 */
export interface TestUserData {
  id?: string;
  discordId?: string;
  username?: string;
  avatar?: string | null;
  player?: string | null;
  timeZone?: string | null;
  usePlayerAsDisplayName?: boolean;
  friendCode?: string | null;
}

export function createTestUserData(
  overrides: TestUserData = {},
): Required<TestUserData> {
  const id = overrides.id || testUUID();
  return {
    id,
    discordId: overrides.discordId || testDiscordId(),
    username: overrides.username || `${TEST_PREFIX}user-${id.slice(0, 8)}`,
    avatar: overrides.avatar ?? null,
    player: overrides.player ?? null,
    timeZone: overrides.timeZone ?? "UTC",
    usePlayerAsDisplayName: overrides.usePlayerAsDisplayName ?? false,
    friendCode: overrides.friendCode ?? generateRandomFriendCode(),
  };
}

/**
 * Test group fixture factory
 */
export interface TestGroupData {
  id?: string;
  name?: string;
  description?: string | null;
  avatar?: string | null;
  tags?: string[];
  ownerId: string;
  visibility?: "private" | "discoverable";
  joinMethod?: "open" | "request";
}

export function createTestGroupData(
  overrides: TestGroupData,
): Required<TestGroupData> {
  const id = overrides.id || testUUID();
  return {
    id,
    name: overrides.name || `${TEST_PREFIX}group-${id.slice(0, 8)}`,
    description: overrides.description ?? "Test group description",
    avatar: overrides.avatar ?? null,
    tags: overrides.tags ?? ["test"],
    ownerId: overrides.ownerId,
    visibility: overrides.visibility ?? "private",
    joinMethod: overrides.joinMethod ?? "request",
  };
}

// ============================================================================
// JWT Generation
// ============================================================================

/**
 * Generate a valid JWT token for testing
 */
export function generateTestJWT(
  userId: string,
  options: {
    expiresIn?: string | number;
    issuer?: string;
    audience?: string;
  } = {},
): string {
  return jwt.sign(
    {
      userId,
      type: "websocket",
    },
    JWT_SECRET,
    {
      expiresIn: options.expiresIn || "1h",
      issuer: options.issuer || "picologs-website",
      audience: options.audience || "picologs-websocket",
    },
  );
}

/**
 * Generate an expired JWT for testing error handling
 */
export function generateExpiredJWT(userId: string): string {
  return jwt.sign(
    {
      userId,
      type: "websocket",
    },
    JWT_SECRET,
    {
      expiresIn: "-1h", // Already expired
      issuer: "picologs-website",
      audience: "picologs-websocket",
    },
  );
}

/**
 * Generate an invalid JWT (wrong secret)
 */
export function generateInvalidJWT(userId: string): string {
  return jwt.sign(
    {
      userId,
      type: "websocket",
    },
    "wrong-secret-key",
    {
      expiresIn: "1h",
      issuer: "picologs-website",
      audience: "picologs-websocket",
    },
  );
}

// ============================================================================
// Database Seeding
// ============================================================================

/**
 * Seed a test user into the database
 */
export async function seedTestUser(data?: TestUserData): Promise<DBUser> {
  const userData = createTestUserData(data);

  const [user] = await db
    .insert(users)
    .values({
      id: userData.id,
      discordId: userData.discordId,
      username: userData.username,
      avatar: userData.avatar,
      player: userData.player,
      timeZone: userData.timeZone,
      usePlayerAsDisplayName: userData.usePlayerAsDisplayName,
      friendCode: userData.friendCode,
    })
    .returning();

  return user;
}

/**
 * Seed multiple test users
 */
export async function seedTestUsers(count: number): Promise<DBUser[]> {
  const usersData = Array.from({ length: count }, () => createTestUserData());

  const seededUsers = await db
    .insert(users)
    .values(
      usersData.map((u) => ({
        id: u.id,
        discordId: u.discordId,
        username: u.username,
        avatar: u.avatar,
        player: u.player,
        timeZone: u.timeZone,
        usePlayerAsDisplayName: u.usePlayerAsDisplayName,
        friendCode: u.friendCode,
      })),
    )
    .returning();

  return seededUsers;
}

/**
 * Seed a test group into the database
 */
export async function seedTestGroup(data: TestGroupData): Promise<DBGroup> {
  const groupData = createTestGroupData(data);

  const [group] = await db
    .insert(groups)
    .values({
      id: groupData.id,
      name: groupData.name,
      description: groupData.description,
      avatar: groupData.avatar,
      tags: groupData.tags,
      ownerId: groupData.ownerId,
      visibility: groupData.visibility,
      joinMethod: groupData.joinMethod,
    })
    .returning();

  // Add owner as member
  await db.insert(groupMembers).values({
    groupId: group.id,
    userId: data.ownerId,
    role: "owner",
    canInvite: true,
    canRemoveMembers: true,
    canEditGroup: true,
  });

  return group;
}

/**
 * Seed a friendship between two users
 */
export async function seedFriendship(
  userId1: string,
  userId2: string,
  status: "pending" | "accepted" = "accepted",
): Promise<DBFriend> {
  const [friendship] = await db
    .insert(friends)
    .values({
      userId: userId1,
      friendId: userId2,
      status,
    })
    .returning();

  return friendship;
}

/**
 * Seed a group member
 */
export async function seedGroupMember(
  groupId: string,
  userId: string,
  role: "owner" | "admin" | "member" = "member",
): Promise<DBGroupMember> {
  const [member] = await db
    .insert(groupMembers)
    .values({
      groupId,
      userId,
      role,
      canInvite: role !== "member",
      canRemoveMembers: role === "owner" || role === "admin",
      canEditGroup: role === "owner" || role === "admin",
    })
    .returning();

  return member;
}

/**
 * Seed a join request for a group
 */
export async function seedJoinRequest(
  groupId: string,
  userId: string,
  message?: string,
  status: "pending" | "approved" | "denied" = "pending",
): Promise<DBGroupJoinRequest> {
  const [request] = await db
    .insert(groupJoinRequests)
    .values({
      groupId,
      userId,
      message: message || null,
      status,
    })
    .returning();

  return request;
}

// ============================================================================
// Database Cleanup
// ============================================================================

/**
 * Clean up all test data from the database
 * Uses the TEST_PREFIX pattern for safe identification
 */
export async function cleanupTestData(): Promise<{
  users: number;
  friends: number;
  groups: number;
  groupMembers: number;
  groupInvitations: number;
  groupJoinRequests: number;
}> {
  // Find all test users
  const testUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(like(users.discordId, `${TEST_PREFIX}%`));

  const testUserIds = testUsers.map((u) => u.id);

  if (testUserIds.length === 0) {
    return {
      users: 0,
      friends: 0,
      groups: 0,
      groupMembers: 0,
      groupInvitations: 0,
      groupJoinRequests: 0,
    };
  }

  // Delete in order to respect foreign key constraints
  // 1. Group join requests involving test users
  const deletedJoinRequests = await db
    .delete(groupJoinRequests)
    .where(inArray(groupJoinRequests.userId, testUserIds))
    .returning();

  // 2. Group invitations involving test users
  const deletedInvitations = await db
    .delete(groupInvitations)
    .where(
      or(
        inArray(groupInvitations.inviterId, testUserIds),
        inArray(groupInvitations.inviteeId, testUserIds),
      ),
    )
    .returning();

  // 3. Group members involving test users
  const deletedMembers = await db
    .delete(groupMembers)
    .where(inArray(groupMembers.userId, testUserIds))
    .returning();

  // 4. Groups owned by test users
  const deletedGroups = await db
    .delete(groups)
    .where(inArray(groups.ownerId, testUserIds))
    .returning();

  // 5. Friendships involving test users
  const deletedFriends = await db
    .delete(friends)
    .where(
      or(
        inArray(friends.userId, testUserIds),
        inArray(friends.friendId, testUserIds),
      ),
    )
    .returning();

  // 6. Test users
  const deletedUsers = await db
    .delete(users)
    .where(like(users.discordId, `${TEST_PREFIX}%`))
    .returning();

  return {
    users: deletedUsers.length,
    friends: deletedFriends.length,
    groups: deletedGroups.length,
    groupMembers: deletedMembers.length,
    groupInvitations: deletedInvitations.length,
    groupJoinRequests: deletedJoinRequests.length,
  };
}

// ============================================================================
// Connection State Management
// ============================================================================

/**
 * Clear all in-memory connection state
 * Call this in beforeEach/afterEach of tests
 */
export function clearConnectionState(): void {
  clients.clear();
  userConnections.clear();
  rateLimits.clear();
  failedLoginAttempts.clear();
  authSessions.clear();
  authSessionOwners.clear();
}

/**
 * Simulate a connected user
 * Returns the MockWebSocket for assertions
 */
export function simulateConnection(
  userId: string,
  connectionId?: string,
  metadata?: Record<string, any>,
): { ws: MockWebSocket; connectionId: string } {
  const ws = new MockWebSocket();
  const connId = connectionId || `conn-${testId()}`;

  clients.set(connId, {
    userId,
    ws: ws as any,
    ip: "127.0.0.1",
    metadata: metadata || {},
  });

  if (!userConnections.has(userId)) {
    userConnections.set(userId, new Set());
  }
  userConnections.get(userId)!.add(connId);

  return { ws, connectionId: connId };
}

/**
 * Simulate multiple connected users
 */
export function simulateConnections(
  userIds: string[],
): Map<string, { ws: MockWebSocket; connectionId: string }> {
  const connections = new Map<
    string,
    { ws: MockWebSocket; connectionId: string }
  >();

  for (const userId of userIds) {
    connections.set(userId, simulateConnection(userId));
  }

  return connections;
}

/**
 * Disconnect a simulated user
 */
export function simulateDisconnect(connectionId: string): void {
  const client = clients.get(connectionId);
  if (client) {
    const userConns = userConnections.get(client.userId);
    if (userConns) {
      userConns.delete(connectionId);
      if (userConns.size === 0) {
        userConnections.delete(client.userId);
      }
    }
    clients.delete(connectionId);
  }
}

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Wait for a condition to be true (with timeout)
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100,
): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (await condition()) return;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Wait for a specific message type on a MockWebSocket
 */
export async function waitForMessage(
  ws: MockWebSocket,
  type: string,
  timeout = 5000,
): Promise<any> {
  await waitFor(() => ws.hasMessage(type), timeout);
  return ws.getMessagesByType(type)[0];
}

/**
 * Create a test context with users and connections
 * Useful for complex integration tests
 */
export interface TestContext {
  users: DBUser[];
  connections: Map<string, { ws: MockWebSocket; connectionId: string }>;
  cleanup: () => Promise<void>;
}

export async function createTestContext(
  userCount: number,
  options: {
    connectAll?: boolean;
    createFriendships?: boolean;
  } = {},
): Promise<TestContext> {
  const { connectAll = true, createFriendships = false } = options;

  // Seed users
  const seededUsers = await seedTestUsers(userCount);

  // Create connections - use discordId since broadcast() looks up by discordId
  const connections = new Map<
    string,
    { ws: MockWebSocket; connectionId: string }
  >();
  if (connectAll) {
    for (const user of seededUsers) {
      connections.set(user.id, simulateConnection(user.discordId));
    }
  }

  // Create friendships between all users
  if (createFriendships && userCount > 1) {
    for (let i = 0; i < seededUsers.length; i++) {
      for (let j = i + 1; j < seededUsers.length; j++) {
        await seedFriendship(seededUsers[i].id, seededUsers[j].id, "accepted");
      }
    }
  }

  return {
    users: seededUsers,
    connections,
    cleanup: async () => {
      clearConnectionState();
      await cleanupTestData();
    },
  };
}

// ============================================================================
// Assertions
// ============================================================================

/**
 * Assert that a MockWebSocket received a specific message type
 */
export function assertReceivedMessage(
  ws: MockWebSocket,
  type: string,
  data?: Partial<any>,
): void {
  const messages = ws.getMessagesByType(type);
  if (messages.length === 0) {
    throw new Error(
      `Expected to receive message of type "${type}", but none found. Received: ${JSON.stringify(ws.getAllMessages().map((m) => m.type))}`,
    );
  }

  if (data) {
    const hasMatch = messages.some((msg) => {
      return Object.entries(data).every(([key, value]) => {
        return JSON.stringify(msg.data?.[key]) === JSON.stringify(value);
      });
    });

    if (!hasMatch) {
      throw new Error(
        `Expected message with data ${JSON.stringify(data)}, but got: ${JSON.stringify(messages.map((m) => m.data))}`,
      );
    }
  }
}

/**
 * Assert that a MockWebSocket did NOT receive a specific message type
 */
export function assertDidNotReceiveMessage(
  ws: MockWebSocket,
  type: string,
): void {
  if (ws.hasMessage(type)) {
    throw new Error(
      `Expected NOT to receive message of type "${type}", but found: ${JSON.stringify(ws.getMessagesByType(type))}`,
    );
  }
}

// ============================================================================
// Export All
// ============================================================================

export { TEST_PREFIX, JWT_SECRET };
