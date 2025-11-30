// Environment configuration and constants

export const PORT = process.env.PORT || 8080;
export const HOST = process.env.HOST || "0.0.0.0";
export const BROADCAST_API_KEY = process.env.BROADCAST_API_KEY;

// SECURITY: JWT secret validation - fail-fast if not properly configured
// In test environment, allow undefined JWT_SECRET (set by test setup)
export const JWT_SECRET = process.env.JWT_SECRET;

const isTestEnv = process.env.NODE_ENV === "test" || !!process.env.VITEST;

if (!JWT_SECRET && !isTestEnv) {
  console.error("[FATAL] JWT_SECRET environment variable is not set.");
  console.error(
    "[FATAL] Set JWT_SECRET to a cryptographically secure random string (minimum 32 characters).",
  );
  process.exit(1);
}

if (
  JWT_SECRET &&
  JWT_SECRET !== "test-jwt-secret-for-unit-tests-only-32chars!" &&
  (JWT_SECRET === "dev-secret-key" || JWT_SECRET.length < 32)
) {
  console.error("[FATAL] JWT_SECRET is too weak. Use at least 32 characters.");
  console.error(
    "[FATAL] Generate a secure secret with: openssl rand -base64 32",
  );
  process.exit(1);
}

// Discord OAuth configuration
export const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
export const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
export const DISCORD_REDIRECT_URI =
  process.env.DISCORD_REDIRECT_URI ||
  "http://localhost:5173/auth/desktop/callback";

if (!DISCORD_CLIENT_ID && !isTestEnv) {
  console.error("[FATAL] DISCORD_CLIENT_ID environment variable is not set.");
  console.error(
    "[FATAL] Get your Discord OAuth client ID from https://discord.com/developers/applications",
  );
  process.exit(1);
}

if (!DISCORD_CLIENT_SECRET && !isTestEnv) {
  console.error(
    "[FATAL] DISCORD_CLIENT_SECRET environment variable is not set.",
  );
  console.error(
    "[FATAL] Get your Discord OAuth client secret from https://discord.com/developers/applications",
  );
  process.exit(1);
}

export const MAX_MESSAGE_SIZE = 100 * 1024; // 100KB max message size
export const MAX_METADATA_SIZE = 10 * 1024; // 10KB max metadata size
export const DATABASE_URL = process.env.DATABASE_URL;

// Connection limits
export const MAX_CONNECTIONS_PER_IP = parseInt(
  process.env.MAX_CONNECTIONS_PER_IP || "10",
);

// Rate limiting - WebSocket messages per user
// In test environment, use much higher limits to avoid rate limiting in tests
const isRateLimitTestEnv = isTestEnv || process.env.PORT === "8081";
export const WS_RATE_LIMIT = isRateLimitTestEnv ? 10000 : 100; // messages per window for authenticated users
export const WS_RATE_LIMIT_UNAUTH = isRateLimitTestEnv ? 5000 : 30; // messages per window for unauthenticated connections (stricter)
export const WS_RATE_WINDOW = 60 * 1000; // 60 seconds

// Rate limiting - HTTP requests per IP
export const HTTP_RATE_LIMIT = 30; // requests per window
export const HTTP_RATE_WINDOW = 60 * 1000; // 60 seconds

// Compression constants
export const COMPRESSION_THRESHOLD_BYTES = 5 * 1024; // 5KB - compress if payload is larger
export const COMPRESSION_THRESHOLD_LOGS = 10; // 10 logs - compress if more than this many

// Session timeouts
export const SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes
export const REGISTRATION_TIMEOUT = 30000; // 30 seconds
export const AUTH_SESSION_TIMEOUT = 120000; // 2 minutes

// Email notifications (Resend)
export const RESEND_API_KEY = process.env.RESEND_API_KEY;
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
export const EMAIL_ENABLED = !!RESEND_API_KEY && !!ADMIN_EMAIL;
