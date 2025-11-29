#!/usr/bin/env bun
/**
 * Setup Mock User for Development
 *
 * Creates a mock user in the database and generates a JWT token for the mock player service.
 * This script is idempotent - it will not create duplicate users.
 *
 * Usage: bun run src/scripts/setup-mock-user.ts
 */

import { eq } from "drizzle-orm";
import { db, users } from "../lib/db";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/constants";
import type { WebSocketJWTPayload } from "@pico/types";

// Mock user configuration
const MOCK_USER = {
  discordId: "mock-player-demo",
  username: "DemoPlayer",
  friendCode: "DEMO00",
  avatar: "https://cdn.discordapp.com/embed/avatars/0.png", // Default Discord avatar
  player: "MockPlayer",
  usePlayerAsDisplayName: true,
  timeZone: "UTC",
};

/**
 * Generate a JWT token for the mock user
 */
function generateJWT(userId: string): string {
  const payload: WebSocketJWTPayload = {
    userId,
    type: "websocket",
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: "365d", // Long expiration for persistent demo
    issuer: "picologs-website",
    audience: "picologs-websocket",
  });
}

/**
 * Setup mock user in database
 */
async function setupMockUser() {
  console.log("[Setup] Setting up mock user...");

  try {
    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.discordId, MOCK_USER.discordId))
      .limit(1);

    let userId: string;

    if (existingUser.length > 0) {
      console.log("[Setup] Mock user already exists");
      userId = existingUser[0].id;
      console.log("User ID:", userId);
    } else {
      console.log("[Setup] Creating mock user in database...");

      // Insert mock user
      const result = await db
        .insert(users)
        .values({
          discordId: MOCK_USER.discordId,
          username: MOCK_USER.username,
          friendCode: MOCK_USER.friendCode,
          avatar: MOCK_USER.avatar,
          player: MOCK_USER.player,
          usePlayerAsDisplayName: MOCK_USER.usePlayerAsDisplayName,
          timeZone: MOCK_USER.timeZone,
        })
        .returning({ id: users.id });

      userId = result[0].id;
      console.log("[Setup] Mock user created successfully");
      console.log("User ID:", userId);
    }

    // Generate JWT token
    console.log("\n[Setup] Generating JWT token...");
    const token = generateJWT(MOCK_USER.discordId);

    console.log("\n✅ Setup complete!\n");
    console.log(
      "═══════════════════════════════════════════════════════════════",
    );
    console.log("Mock User Details:");
    console.log(
      "═══════════════════════════════════════════════════════════════",
    );
    console.log("Discord ID:   ", MOCK_USER.discordId);
    console.log("Username:     ", MOCK_USER.username);
    console.log("Player Name:  ", MOCK_USER.player);
    console.log("Friend Code:  ", MOCK_USER.friendCode);
    console.log("Database ID:  ", userId);
    console.log(
      "═══════════════════════════════════════════════════════════════\n",
    );

    console.log("JWT Token (add to .env.local):");
    console.log(
      "═══════════════════════════════════════════════════════════════",
    );
    console.log("MOCK_JWT_TOKEN=" + token);
    console.log(
      "═══════════════════════════════════════════════════════════════\n",
    );

    console.log("Environment Configuration:");
    console.log(
      "═══════════════════════════════════════════════════════════════",
    );
    console.log("Add the following to your .env.local file:\n");
    console.log("# Mock Player Service Configuration");
    console.log("MOCK_SERVICE_ENABLED=true");
    console.log(`MOCK_PLAYER_DISCORD_ID=${MOCK_USER.discordId}`);
    console.log(`MOCK_PLAYER_NAME=${MOCK_USER.username}`);
    console.log("MOCK_WS_URL=ws://localhost:8080/ws");
    console.log("MOCK_JWT_TOKEN=" + token);
    console.log(
      "═══════════════════════════════════════════════════════════════\n",
    );

    console.log("Next Steps:");
    console.log("1. Copy the MOCK_JWT_TOKEN to your .env.local file");
    console.log("2. Enable the mock service: MOCK_SERVICE_ENABLED=true");
    console.log("3. Start the server: bun run dev");
    console.log("4. Start the mock service: bun run mock:start");
    console.log("5. Check status: bun run mock:status\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Setup failed:", error);
    process.exit(1);
  }
}

// Run setup
setupMockUser();
