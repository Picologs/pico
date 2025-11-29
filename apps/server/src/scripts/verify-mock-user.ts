#!/usr/bin/env bun
/**
 * Verify Mock User Exists
 *
 * Checks if the mock user exists in the database and displays its details.
 *
 * Usage: bun run src/scripts/verify-mock-user.ts
 */

import { eq } from "drizzle-orm";
import { db, users } from "../lib/db";

async function verifyMockUser() {
  try {
    const mockUser = await db
      .select()
      .from(users)
      .where(eq(users.discordId, "mock-player-demo"))
      .limit(1);

    if (mockUser.length > 0) {
      console.log("✅ Mock user exists in database:\n");
      console.log(
        "═══════════════════════════════════════════════════════════════",
      );
      console.log("Database ID:   ", mockUser[0].id);
      console.log("Discord ID:    ", mockUser[0].discordId);
      console.log("Username:      ", mockUser[0].username);
      console.log("Friend Code:   ", mockUser[0].friendCode);
      console.log("Player Name:   ", mockUser[0].player);
      console.log("Avatar:        ", mockUser[0].avatar);
      console.log("Use Player:    ", mockUser[0].usePlayerAsDisplayName);
      console.log("Time Zone:     ", mockUser[0].timeZone);
      console.log("Created At:    ", mockUser[0].createdAt);
      console.log(
        "═══════════════════════════════════════════════════════════════\n",
      );
    } else {
      console.log("❌ Mock user not found in database");
      console.log("\nRun: bun run mock:setup");
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }

  process.exit(0);
}

verifyMockUser();
