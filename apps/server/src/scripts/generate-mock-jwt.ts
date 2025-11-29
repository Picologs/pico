#!/usr/bin/env bun
/**
 * Generate JWT Token for Mock User
 *
 * Generates a JWT token for the mock player service without modifying the database.
 * Useful if you need to regenerate the token or use a different mock user.
 *
 * Usage: bun run src/scripts/generate-mock-jwt.ts [discordId]
 *
 * Examples:
 *   bun run src/scripts/generate-mock-jwt.ts
 *   bun run src/scripts/generate-mock-jwt.ts custom-mock-user-id
 */

import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/constants";
import type { WebSocketJWTPayload } from "@pico/types";

// Get Discord ID from command line or use default
const discordId = process.argv[2] || "mock-player-demo";

/**
 * Generate a JWT token for the mock user
 */
function generateJWT(userId: string, expiresIn: string = "365d"): string {
  const payload: WebSocketJWTPayload = {
    userId,
    type: "websocket",
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn,
    issuer: "picologs-website",
    audience: "picologs-websocket",
  });
}

// Generate token
console.log("[Generate] Generating JWT token for:", discordId);

const token = generateJWT(discordId);

console.log("\n✅ JWT Token Generated!\n");
console.log("═══════════════════════════════════════════════════════════════");
console.log("Discord ID:", discordId);
console.log("Expires:   ", "365 days");
console.log(
  "═══════════════════════════════════════════════════════════════\n",
);

console.log("JWT Token (add to .env.local):");
console.log("═══════════════════════════════════════════════════════════════");
console.log("MOCK_JWT_TOKEN=" + token);
console.log(
  "═══════════════════════════════════════════════════════════════\n",
);

console.log("Environment Configuration:");
console.log("═══════════════════════════════════════════════════════════════");
console.log("Add the following to your .env.local file:\n");
console.log("# Mock Player Service Configuration");
console.log("MOCK_SERVICE_ENABLED=true");
console.log(`MOCK_PLAYER_DISCORD_ID=${discordId}`);
console.log("MOCK_PLAYER_NAME=DemoPlayer");
console.log("MOCK_WS_URL=ws://localhost:8080/ws");
console.log("MOCK_JWT_TOKEN=" + token);
console.log(
  "═══════════════════════════════════════════════════════════════\n",
);
