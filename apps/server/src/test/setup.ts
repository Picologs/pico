/**
 * Vitest Test Setup
 *
 * This file is loaded AFTER env-loader.ts which loads .env.test.
 * It sets up the neon-testing helper for database integration tests.
 */

import { makeNeonTesting } from "neon-testing";
import { beforeAll, afterAll, beforeEach } from "vitest";
import { resetDbConnection } from "../lib/db";

console.log("[Test] Setting up neon-testing helper");

/**
 * Check if Neon credentials are configured
 */
export function hasNeonCredentials(): boolean {
  return !!(process.env.NEON_API_KEY && process.env.NEON_PROJECT_ID);
}

// ============================================================================
// Neon Testing Setup
// ============================================================================

// Cache for the neon-testing instance (lazy initialized)
let _neonTest: ReturnType<typeof makeNeonTesting> | null = null;
let _initialized = false;

/**
 * Create a neon-testing helper for database integration tests.
 *
 * Usage in test files:
 * ```typescript
 * import { withNeonTestBranch } from '../test/setup';
 *
 * describe('My Integration Tests', () => {
 *   withNeonTestBranch(); // Sets up beforeAll/afterAll hooks
 *
 *   it('should query the database', async () => {
 *     // DATABASE_URL is now set to an ephemeral Neon branch
 *     const result = await db.select().from(users);
 *   });
 * });
 * ```
 *
 * Note: Requires NEON_API_KEY and NEON_PROJECT_ID environment variables.
 * These should be set in .env.test or CI secrets.
 */
export function withNeonTestBranch() {
  // Check credentials at call time (after env files are loaded)
  const apiKey = process.env.NEON_API_KEY;
  const projectId = process.env.NEON_PROJECT_ID;

  console.log("[Test] withNeonTestBranch called");
  console.log(
    "[Test] NEON_API_KEY:",
    apiKey ? `${apiKey.slice(0, 10)}...` : "NOT SET",
  );
  console.log("[Test] NEON_PROJECT_ID:", projectId || "NOT SET");

  if (!apiKey || !projectId) {
    // Log warning only once
    if (!_initialized) {
      console.warn(
        "[Test] NEON_API_KEY or NEON_PROJECT_ID not set. Database tests will be skipped.",
      );
      _initialized = true;
    }
    // Just return early - tests using withNeonTestBranch should be wrapped in
    // describe.skipIf(!hasNeonCredentials()) if they need to be skipped
    return;
  }

  // Initialize neon-testing lazily
  if (!_neonTest) {
    console.log("[Test] Creating neon-testing instance...");
    _neonTest = makeNeonTesting({
      apiKey,
      projectId,
      autoCloseWebSockets: true,
      deleteBranch: true,
      endpoint: "pooler",
    });
    console.log("[Test] neon-testing instance created");
  }

  // Call the neon-testing setup (sets up beforeAll/afterAll)
  console.log("[Test] Calling neon-testing setup...");
  _neonTest();

  // Reset db connection after neon-testing sets up DATABASE_URL
  beforeAll(() => {
    console.log(
      "[Test] beforeAll: DATABASE_URL is now:",
      process.env.DATABASE_URL?.slice(0, 50) + "...",
    );
    resetDbConnection();
  });

  // Clean up after tests
  afterAll(() => {
    console.log("[Test] afterAll: cleaning up db connection");
    resetDbConnection();
  });
}

// ============================================================================
// Global Test Utilities
// ============================================================================

// Export for tests that need to reset connection manually
export { resetDbConnection };
