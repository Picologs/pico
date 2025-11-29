/**
 * Environment Loader
 *
 * This file MUST be loaded first in setupFiles to ensure
 * environment variables are set before any other modules load.
 */

// Polyfill WebSocket for Node.js (needed by neon-testing)
import WebSocket from "ws";
if (typeof globalThis.WebSocket === "undefined") {
  // @ts-expect-error - Adding WebSocket polyfill for Node.js
  globalThis.WebSocket = WebSocket;
}

import { config } from "dotenv";
import { resolve } from "path";

// Load .env.test
const result = config({ path: resolve(process.cwd(), ".env.test") });

if (result.error) {
  console.warn("[Test] Could not load .env.test:", result.error.message);
} else {
  console.log("[Test] Loaded .env.test successfully");
}

// Set test environment
process.env.NODE_ENV = "test";

// Fallback values if not in .env.test
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "test-jwt-secret-for-unit-tests-only-32chars!";
}
if (!process.env.DISCORD_CLIENT_ID) {
  process.env.DISCORD_CLIENT_ID = "test-client-id";
}
if (!process.env.DISCORD_CLIENT_SECRET) {
  process.env.DISCORD_CLIENT_SECRET = "test-client-secret";
}
if (!process.env.DISCORD_REDIRECT_URI) {
  process.env.DISCORD_REDIRECT_URI = "http://localhost:5173/auth/callback";
}
