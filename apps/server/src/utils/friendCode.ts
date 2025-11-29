/**
 * Friend code generation utilities
 *
 * Provides utilities for generating unique friend codes.
 * Friend codes are 6-character alphanumeric strings used to identify users.
 */

import { eq } from "drizzle-orm";
import { db, users } from "../lib/db";

/**
 * Character set used for friend code generation
 * Contains uppercase letters A-Z and digits 0-9
 */
const FRIEND_CODE_CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/**
 * Length of generated friend codes
 */
const FRIEND_CODE_LENGTH = 6;

/**
 * Generate a random 6-character friend code
 *
 * This function generates a random friend code but does NOT check for uniqueness.
 *
 * @returns A random 6-character alphanumeric string
 */
function generateFriendCode(): string {
  return Array.from(
    { length: FRIEND_CODE_LENGTH },
    () =>
      FRIEND_CODE_CHARACTERS[
        Math.floor(Math.random() * FRIEND_CODE_CHARACTERS.length)
      ],
  ).join("");
}

/**
 * Generate a unique friend code with database uniqueness check
 *
 * This function generates random friend codes until it finds one that doesn't exist
 * in the database.
 *
 * @param maxAttempts - Maximum number of generation attempts (default: 100)
 * @returns A unique 6-character friend code
 * @throws Error if unable to generate a unique code after maxAttempts
 */
export async function generateUniqueFriendCode(
  maxAttempts: number = 100,
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const friendCode = generateFriendCode();

    // Check if code already exists in database
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.friendCode, friendCode))
      .limit(1);

    if (existing.length === 0) {
      return friendCode;
    }
  }

  throw new Error(
    `Failed to generate unique friend code after ${maxAttempts} attempts`,
  );
}
