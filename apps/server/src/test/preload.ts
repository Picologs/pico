/**
 * Test Preload - Set environment variables before any imports
 *
 * This file MUST be loaded before other modules to set required env vars.
 */

// Set test environment
process.env.NODE_ENV = "test";

// JWT secret for testing (meets 32 char minimum)
process.env.JWT_SECRET = "test-jwt-secret-for-unit-tests-only-32chars!";

// Discord OAuth (mocked in tests, but needed for validation)
process.env.DISCORD_CLIENT_ID = "test-client-id";
process.env.DISCORD_CLIENT_SECRET = "test-client-secret";
process.env.DISCORD_REDIRECT_URI = "http://localhost:5173/auth/callback";

// Database URL (tests should mock DB, but need a value)
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

console.log("[Test] Environment configured for testing");
