/**
 * Test utilities for e2e testing
 *
 * Provides mock JWT generation and test user creation utilities
 * that work across all Picologs projects without Discord dependency.
 *
 * @module server/test
 */

import { createWebSocketJWT } from "../auth/jwt-tokens.js";
import { generateFriendCode } from "../../utils/friendCode.js";
import type { NewUser } from "../../db/schema.js";

/**
 * Test Discord ID prefix
 * All test users have Discord IDs starting with this prefix
 */
export const TEST_DISCORD_ID_PREFIX = "90000000";

/**
 * Counter for generating unique test Discord IDs
 */
let testDiscordIdCounter = 0;

/**
 * Generate a fake Discord ID for testing
 *
 * Discord IDs are 18-digit snowflake strings. Test IDs start with 90000000
 * and are padded to 18 digits with a counter.
 *
 * @returns A fake Discord ID string (18 digits, starts with 90000000)
 *
 * @example
 * ```typescript
 * const discordId = generateTestDiscordId();
 * console.log(discordId); // "900000001234567890"
 * ```
 */
export function generateTestDiscordId(): string {
  const counter = testDiscordIdCounter++;
  // Pad to 18 digits total (90000000 is 8 digits, so 10 more needed)
  const paddedCounter = counter.toString().padStart(10, "0");
  return `${TEST_DISCORD_ID_PREFIX}${paddedCounter}`;
}

/**
 * Reset the test Discord ID counter
 *
 * Useful for test isolation to ensure predictable IDs
 */
export function resetTestDiscordIdCounter(): void {
  testDiscordIdCounter = 0;
}

/**
 * Create a mock JWT token for testing
 *
 * Generates a JWT token using the same signing method as production
 * but with test user Discord IDs. No Discord API calls required.
 *
 * @param discordId - Discord ID to include in JWT payload
 * @param secret - JWT secret key (must match server config)
 * @param expiresIn - Token expiration time (default: 1h for tests)
 * @returns Signed JWT token
 *
 * @example
 * ```typescript
 * const token = await createMockJWT('900000001234567890', process.env.JWT_SECRET);
 * // Use token in Authorization header or cookie
 * ```
 */
export async function createMockJWT(
  discordId: string,
  secret: string,
  expiresIn: string | number = "1h",
): Promise<string> {
  return await createWebSocketJWT(discordId, secret, expiresIn);
}

/**
 * Test user creation options
 */
export interface CreateTestUserOptions {
  /** Discord ID (auto-generated if not provided) */
  discordId?: string;
  /** Username (auto-generated if not provided) */
  username?: string;
  /** Avatar URL (optional) */
  avatar?: string | null;
  /** Player/character name (optional) */
  player?: string | null;
  /** Timezone (optional) */
  timeZone?: string | null;
  /** Show timezone in UI (default: true) */
  showTimezone?: boolean;
  /** Use player name as display name (default: false) */
  usePlayerAsDisplayName?: boolean;
  /** Friend code (auto-generated if not provided) */
  friendCode?: string;
}

/**
 * Create a test user in the database
 *
 * Generates a test user with fake Discord ID and unique friend code.
 * All test users have Discord IDs starting with "90000000" for easy cleanup.
 *
 * @param db - Drizzle database instance
 * @param usersTable - Users table schema
 * @param options - Optional user properties to override defaults
 * @returns The created user record
 *
 * @example
 * ```typescript
 * import { db, schema } from '@pico/shared/server';
 * import { createTestUser } from '@pico/shared/server/test';
 *
 * const testUser = await createTestUser(db, schema.users, {
 *   username: 'TestPlayer1',
 *   player: 'StarCitizen123'
 * });
 *
 * console.log(testUser.discordId); // "900000001234567890"
 * console.log(testUser.friendCode); // "ABC123"
 * ```
 */
export async function createTestUser(
  db: any,
  usersTable: any,
  options: CreateTestUserOptions = {},
): Promise<NewUser & { id: string; createdAt: Date; updatedAt: Date }> {
  const discordId = options.discordId || generateTestDiscordId();
  const username = options.username || `TestUser${discordId.slice(-6)}`;
  const friendCode = options.friendCode || generateFriendCode();

  const [user] = await db
    .insert(usersTable)
    .values({
      discordId,
      username,
      avatar: options.avatar ?? null,
      player: options.player ?? null,
      timeZone: options.timeZone ?? "UTC",
      showTimezone: options.showTimezone ?? true,
      usePlayerAsDisplayName: options.usePlayerAsDisplayName ?? false,
      friendCode,
    })
    .returning();

  return user;
}

/**
 * Create multiple test users in parallel
 *
 * @param db - Drizzle database instance
 * @param usersTable - Users table schema
 * @param count - Number of users to create
 * @param baseOptions - Base options to apply to all users
 * @returns Array of created user records
 *
 * @example
 * ```typescript
 * const users = await createTestUsers(db, schema.users, 5, {
 *   timeZone: 'UTC'
 * });
 * console.log(users.length); // 5
 * ```
 */
export async function createTestUsers(
  db: any,
  usersTable: any,
  count: number,
  baseOptions: CreateTestUserOptions = {},
): Promise<(NewUser & { id: string; createdAt: Date; updatedAt: Date })[]> {
  const promises = Array.from({ length: count }, (_, i) =>
    createTestUser(db, usersTable, {
      ...baseOptions,
      username: baseOptions.username
        ? `${baseOptions.username}${i + 1}`
        : undefined,
    }),
  );

  return Promise.all(promises);
}

/**
 * Clean up all test users from the database
 *
 * Deletes all users with Discord IDs starting with "90000000".
 * Safe to run after each test or test suite.
 *
 * @param db - Drizzle database instance
 * @param usersTable - Users table schema
 * @param like - Drizzle like operator
 * @returns Number of users deleted
 *
 * @example
 * ```typescript
 * import { db, schema, like } from '@pico/shared/server';
 * import { cleanupTestUsers } from '@pico/shared/server/test';
 *
 * // After tests
 * const deleted = await cleanupTestUsers(db, schema.users, like);
 * console.log(`Cleaned up ${deleted} test users`);
 * ```
 */
export async function cleanupTestUsers(
  db: any,
  usersTable: any,
  like: (a: any, b: string) => any,
): Promise<number> {
  const result = await db
    .delete(usersTable)
    .where(like(usersTable.discordId, `${TEST_DISCORD_ID_PREFIX}%`))
    .returning();

  return result.length;
}

/**
 * Check if a Discord ID is a test user
 *
 * @param discordId - Discord ID to check
 * @returns True if this is a test user
 *
 * @example
 * ```typescript
 * isTestUser('900000001234567890'); // true
 * isTestUser('123456789012345678'); // false
 * ```
 */
export function isTestUser(discordId: string): boolean {
  return discordId.startsWith(TEST_DISCORD_ID_PREFIX);
}

/**
 * Create a test user with a JWT token
 *
 * Convenience function that creates a user and generates a JWT in one call.
 *
 * @param db - Drizzle database instance
 * @param usersTable - Users table schema
 * @param secret - JWT secret key
 * @param options - Optional user properties
 * @returns Object containing user record and JWT token
 *
 * @example
 * ```typescript
 * const { user, token } = await createTestUserWithToken(
 *   db,
 *   schema.users,
 *   process.env.JWT_SECRET,
 *   { username: 'TestPlayer' }
 * );
 *
 * // Use token in tests
 * await page.setExtraHTTPHeaders({
 *   Authorization: `Bearer ${token}`
 * });
 * ```
 */
export async function createTestUserWithToken(
  db: any,
  usersTable: any,
  secret: string,
  options: CreateTestUserOptions = {},
): Promise<{
  user: NewUser & { id: string; createdAt: Date; updatedAt: Date };
  token: string;
}> {
  const user = await createTestUser(db, usersTable, options);
  const token = await createMockJWT(user.discordId, secret, "1h");

  return { user, token };
}
