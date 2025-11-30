import { eq, and, or } from "drizzle-orm";
import { db, users, friends } from "../lib/db";

/**
 * SECURITY: Verify that two users are friends with 'accepted' status
 * This prevents unauthorized log broadcasting to non-friends
 * @param senderDiscordId - Discord ID of the sender
 * @param targetDiscordId - Discord ID of the target user
 * @returns true if they are friends, false otherwise
 */
export async function verifyFriendship(
  senderDiscordId: string,
  targetDiscordId: string,
): Promise<boolean> {
  try {
    // Get both users from database
    const [currentUser] = await db
      .select()
      .from(users)
      .where(eq(users.discordId, senderDiscordId))
      .limit(1);

    const [targetUser] = await db
      .select()
      .from(users)
      .where(eq(users.discordId, targetDiscordId))
      .limit(1);

    if (!currentUser || !targetUser) {
      return false;
    }

    // Check if friendship exists with 'accepted' status (bidirectional check)
    const [friendship] = await db
      .select()
      .from(friends)
      .where(
        and(
          or(
            and(
              eq(friends.userId, currentUser.id),
              eq(friends.friendId, targetUser.id),
            ),
            and(
              eq(friends.userId, targetUser.id),
              eq(friends.friendId, currentUser.id),
            ),
          ),
          eq(friends.status, "accepted"),
        ),
      )
      .limit(1);

    return !!friendship;
  } catch (error) {
    console.error("[Security] Error verifying friendship:", error);
    return false;
  }
}
