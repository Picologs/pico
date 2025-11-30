/**
 * Database connection for bun-server
 * Uses shared schema from @pico/types
 *
 * Connection is lazy-initialized to support test environments
 * where DATABASE_URL is set dynamically (e.g., neon-testing).
 */

import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import * as schema from "@pico/types";

// Lazy-initialized database connection
let _db: NeonDatabase<typeof schema> | null = null;
let _pool: Pool | null = null;

/**
 * Get the database instance (lazy-initialized)
 * This allows tests to set DATABASE_URL before first access
 */
function getDb(): NeonDatabase<typeof schema> {
  if (!_db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    _pool = new Pool({ connectionString });
    _db = drizzle(_pool, { schema });
  }
  return _db;
}

/**
 * Reset the database connection (for testing)
 * Call this before each test suite to ensure fresh connection
 */
export function resetDbConnection(): void {
  if (_pool) {
    _pool.end();
  }
  _db = null;
  _pool = null;
}

// Export db as a getter that lazily initializes
export const db = new Proxy({} as NeonDatabase<typeof schema>, {
  get(_, prop) {
    return getDb()[prop as keyof NeonDatabase<typeof schema>];
  },
});

// Re-export schema tables for convenience
export {
  users,
  friends,
  groups,
  groupMembers,
  groupInvitations,
  groupJoinRequests,
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
} from "@pico/types";
