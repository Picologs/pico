import { db } from "../../db/index.js";
import * as schema from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { generateUniqueFriendCode } from "../../utils/friendCode.js";
import type { DatabaseAdapter } from "./discord-callback.js";

/**
 * Creates a default database adapter using the shared drizzle-orm instance
 * This prevents type conflicts when consuming projects try to create their own adapters
 *
 * @returns DatabaseAdapter configured with shared-svelte's db instance
 */
export function createDrizzleAdapter(): DatabaseAdapter {
  const users = schema.users;
  const adminSettings = schema.adminSettings;

  return {
    async findUserByDiscordId(discordId: string) {
      const result = await db
        .select()
        .from(users)
        .where(eq(users.discordId, discordId))
        .limit(1);
      return result[0] || null;
    },

    async createUser(data: {
      discordId: string;
      username: string;
      avatar: string | null;
      friendCode: string;
    }) {
      const result = await db.insert(users).values(data).returning();
      return result[0];
    },

    async updateUser(userId: number | string, data: { friendCode?: string }) {
      const result = await db
        .update(users)
        .set(data)
        .where(eq(users.id, userId as string))
        .returning();
      return result[0];
    },

    async generateUniqueFriendCode() {
      return await generateUniqueFriendCode(db, users, eq);
    },

    async isSignupsEnabled() {
      const result = await db
        .select()
        .from(adminSettings)
        .where(eq(adminSettings.key, "signups_enabled"))
        .limit(1);

      // Default to enabled if no setting exists
      if (!result[0]) {
        return true;
      }

      // The value is stored as JSON, parse it
      return result[0].value === true || result[0].value === "true";
    },
  };
}
