/**
 * Server-side utilities and middleware
 *
 * SvelteKit server hooks, middleware, and utilities for authentication,
 * redirects, and other server-side operations.
 *
 * @module lib/server
 */

export * from "./middleware/index.js";

// Export database connection and operators (server-only)
export {
  db,
  eq,
  and,
  or,
  not,
  isNull,
  isNotNull,
  inArray,
  notInArray,
  exists,
  notExists,
  between,
  notBetween,
  like,
  ilike,
  notIlike,
  gt,
  gte,
  lt,
  lte,
  ne,
  sql,
} from "../db/index.js";
export * as schema from "../db/schema.js";
export type {
  User,
  NewUser,
  Friend as DBTableFriend,
  NewFriend as DBTableNewFriend,
  Group as DBTableGroup,
  NewGroup as DBTableNewGroup,
  GroupMember as DBTableGroupMember,
  NewGroupMember as DBTableNewGroupMember,
  GroupInvitation as DBTableGroupInvitation,
  NewGroupInvitation as DBTableNewGroupInvitation,
} from "../db/schema.js";

// Export Discord OAuth callback handler
export {
  handleDiscordCallback,
  generateExpiredCodeHTML,
  generateSignupsDisabledHTML,
  generateUserBlockedHTML,
  generateDesktopAuthSuccessHTML,
} from "./auth/discord-callback.js";

export type {
  DiscordCallbackConfig,
  DatabaseAdapter,
  CookiesAdapter,
  AuthSuccessResult,
  AuthErrorResult,
} from "./auth/discord-callback.js";

// Export JWT token utilities
export { createWebSocketJWT } from "./auth/jwt-tokens.js";
export type { WebSocketJWTPayload } from "./auth/jwt-tokens.js";

// Export database adapter factory
export { createDrizzleAdapter } from "./auth/database-adapter.js";

// Export route handlers
export * from "./handlers/index.js";

// Export test utilities
export {
  createMockJWT,
  createTestUser,
  createTestUsers,
  createTestUserWithToken,
  cleanupTestUsers,
  generateTestDiscordId,
  resetTestDiscordIdCounter,
  isTestUser,
  TEST_DISCORD_ID_PREFIX,
} from "./test/index.js";
export type { CreateTestUserOptions } from "./test/index.js";

// Note: Log schema pattern extraction now happens in Rust (apps/desktop/src-tauri/src/lib.rs)
// Server-side only receives patterns via WebSocket from desktop clients
