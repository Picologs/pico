/**
 * Friend code generation utilities
 *
 * Provides platform-agnostic utilities for generating unique friend codes.
 * Friend codes are 6-character alphanumeric strings used to identify users.
 *
 * @module friendCode
 */

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
 * For production use, you should verify uniqueness against your database using
 * `generateUniqueFriendCodeAsync`.
 *
 * @returns A random 6-character alphanumeric string
 *
 * @example
 * ```typescript
 * const code = generateFriendCode();
 * console.log(code); // "A3X9K2"
 * ```
 */
export function generateFriendCode(): string {
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
 * in your database. You must provide an async function that checks if a code exists.
 *
 * @param checkExists - Async function that returns true if a code already exists
 * @param maxAttempts - Maximum number of generation attempts (default: 100)
 * @returns A unique 6-character friend code
 * @throws Error if unable to generate a unique code after maxAttempts
 *
 * @example
 * ```typescript
 * // Example with database check
 * const code = await generateUniqueFriendCodeAsync(async (code) => {
 *   const existing = await db.select()
 *     .from(users)
 *     .where(eq(users.friendCode, code))
 *     .limit(1);
 *   return existing.length > 0;
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Example with in-memory check
 * const existingCodes = new Set(['ABC123', 'XYZ789']);
 * const code = await generateUniqueFriendCodeAsync(async (code) => {
 *   return existingCodes.has(code);
 * });
 * ```
 */
export async function generateUniqueFriendCodeAsync(
  checkExists: (code: string) => Promise<boolean>,
  maxAttempts: number = 100,
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const friendCode = generateFriendCode();
    const exists = await checkExists(friendCode);

    if (!exists) {
      return friendCode;
    }
  }

  throw new Error(
    `Failed to generate unique friend code after ${maxAttempts} attempts`,
  );
}

/**
 * Validate a friend code format
 *
 * Checks if a string matches the expected friend code format:
 * - Exactly 6 characters
 * - Only uppercase letters A-Z and digits 0-9
 *
 * @param code - The string to validate
 * @returns True if the code has valid format
 *
 * @example
 * ```typescript
 * isValidFriendCode('ABC123'); // true
 * isValidFriendCode('abc123'); // false (lowercase)
 * isValidFriendCode('ABC12');  // false (too short)
 * isValidFriendCode('ABC@23'); // false (invalid character)
 * ```
 */
export function isValidFriendCode(code: string): boolean {
  if (code.length !== FRIEND_CODE_LENGTH) {
    return false;
  }

  return /^[A-Z0-9]+$/.test(code);
}

/**
 * Normalize a friend code to uppercase
 *
 * Converts a friend code to uppercase for case-insensitive comparison.
 * Useful when accepting user input.
 *
 * @param code - The friend code to normalize
 * @returns The normalized friend code in uppercase
 *
 * @example
 * ```typescript
 * normalizeFriendCode('abc123'); // "ABC123"
 * normalizeFriendCode('AbC123'); // "ABC123"
 * ```
 */
export function normalizeFriendCode(code: string): string {
  return code.toUpperCase();
}

/**
 * Generate a unique 6-character friend code with database uniqueness check
 * @param db - The database instance
 * @param usersTable - The users table
 * @param eq - The drizzle eq function
 */
export async function generateUniqueFriendCode(
  db: any,
  usersTable: any,
  eq: (a: any, b: any) => any,
): Promise<string> {
  return generateUniqueFriendCodeAsync(async (code) => {
    const existing = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.friendCode, code))
      .limit(1);
    return existing.length > 0;
  });
}
