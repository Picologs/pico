/**
 * Display name utilities
 *
 * Provides platform-agnostic utilities for getting display names and avatar URLs for users.
 * Handles the logic of choosing between username and player name based on user preferences.
 *
 * @module display-name
 */

/**
 * User data structure for display name utilities
 */
export interface DisplayNameUser {
  /** Discord username */
  username: string;
  /** Star Citizen player name (optional) */
  player?: string | null;
  /** Whether to use player name as display name */
  usePlayerAsDisplayName?: boolean;
  /** Discord ID (for avatar URL generation) */
  discordId?: string | null;
  /** Avatar hash or full URL */
  avatar?: string | null;
}

/**
 * Get display name for a user
 *
 * Returns the player name if `usePlayerAsDisplayName` is true and player name exists,
 * otherwise returns the username.
 *
 * @param user - User object with username, player, and preference flag
 * @returns Display name (player name or username)
 *
 * @example
 * ```typescript
 * // User prefers player name
 * const user1 = {
 *   username: 'DiscordUser123',
 *   player: 'SpaceCommander',
 *   usePlayerAsDisplayName: true
 * };
 * getDisplayName(user1); // "SpaceCommander"
 *
 * // User prefers username
 * const user2 = {
 *   username: 'DiscordUser123',
 *   player: 'SpaceCommander',
 *   usePlayerAsDisplayName: false
 * };
 * getDisplayName(user2); // "DiscordUser123"
 *
 * // Player name not set
 * const user3 = {
 *   username: 'DiscordUser123',
 *   player: null,
 *   usePlayerAsDisplayName: true
 * };
 * getDisplayName(user3); // "DiscordUser123"
 * ```
 */
export function getDisplayName(user: DisplayNameUser): string {
  if (user.usePlayerAsDisplayName && user.player) {
    return user.player;
  }
  return user.username;
}

/**
 * Get secondary name for a user (the name not being used as display name)
 *
 * If using player name as display name, returns username.
 * If using username as display name, returns player name (or null if not set).
 *
 * @param user - User object with username, player, and preference flag
 * @returns Secondary name or null
 *
 * @example
 * ```typescript
 * // Using player name as display - shows username as secondary
 * const user1 = {
 *   username: 'DiscordUser123',
 *   player: 'SpaceCommander',
 *   usePlayerAsDisplayName: true
 * };
 * getSecondaryName(user1); // "DiscordUser123"
 *
 * // Using username as display - shows player name as secondary
 * const user2 = {
 *   username: 'DiscordUser123',
 *   player: 'SpaceCommander',
 *   usePlayerAsDisplayName: false
 * };
 * getSecondaryName(user2); // "SpaceCommander"
 *
 * // No player name - no secondary
 * const user3 = {
 *   username: 'DiscordUser123',
 *   player: null,
 *   usePlayerAsDisplayName: false
 * };
 * getSecondaryName(user3); // null
 * ```
 */
export function getSecondaryName(user: DisplayNameUser): string | null {
  if (user.usePlayerAsDisplayName && user.player) {
    return user.username;
  }
  if (!user.usePlayerAsDisplayName && user.player) {
    return user.player;
  }
  return null;
}

/**
 * Check if a user has a player name set
 *
 * @param user - User object with optional player field
 * @returns True if player name is set and non-empty
 *
 * @example
 * ```typescript
 * hasPlayerName({ username: 'User', player: 'Commander' }); // true
 * hasPlayerName({ username: 'User', player: null }); // false
 * hasPlayerName({ username: 'User', player: '' }); // false
 * ```
 */
export function hasPlayerName(user: Pick<DisplayNameUser, "player">): boolean {
  return Boolean(user.player && user.player.trim().length > 0);
}

/**
 * Format user display with both names if applicable
 *
 * Formats as "DisplayName (SecondaryName)" if secondary name exists,
 * otherwise just "DisplayName".
 *
 * @param user - User object with username, player, and preference flag
 * @returns Formatted display string
 *
 * @example
 * ```typescript
 * const user1 = {
 *   username: 'DiscordUser',
 *   player: 'SpaceCommander',
 *   usePlayerAsDisplayName: true
 * };
 * formatUserDisplay(user1); // "SpaceCommander (DiscordUser)"
 *
 * const user2 = {
 *   username: 'DiscordUser',
 *   player: null,
 *   usePlayerAsDisplayName: false
 * };
 * formatUserDisplay(user2); // "DiscordUser"
 * ```
 */
export function formatUserDisplay(user: DisplayNameUser): string {
  const displayName = getDisplayName(user);
  const secondaryName = getSecondaryName(user);

  if (secondaryName) {
    return `${displayName} (${secondaryName})`;
  }

  return displayName;
}

/**
 * Get initials from a display name
 *
 * Takes the first letter of the first two words in the name.
 * Useful for avatar fallbacks.
 *
 * @param name - Display name to get initials from
 * @returns Initials (1-2 characters, uppercase)
 *
 * @example
 * ```typescript
 * getInitials('Space Commander'); // "SC"
 * getInitials('John'); // "J"
 * getInitials(''); // ""
 * ```
 */
export function getInitials(name: string): string {
  if (!name || name.trim().length === 0) {
    return "";
  }

  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase();
  }

  return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
}

/**
 * Search users by display name (case-insensitive)
 *
 * Searches both username and player name fields.
 *
 * @param users - Array of users to search
 * @param searchTerm - Term to search for
 * @returns Filtered array of users matching the search term
 *
 * @example
 * ```typescript
 * const users = [
 *   { username: 'Alice', player: 'SpaceAlice' },
 *   { username: 'Bob', player: 'CommanderBob' },
 *   { username: 'Charlie', player: null }
 * ];
 * searchUsersByName(users, 'space'); // [{ username: 'Alice', player: 'SpaceAlice' }]
 * searchUsersByName(users, 'bob'); // [{ username: 'Bob', player: 'CommanderBob' }]
 * ```
 */
export function searchUsersByName<T extends DisplayNameUser>(
  users: T[],
  searchTerm: string,
): T[] {
  if (!searchTerm || searchTerm.trim().length === 0) {
    return users;
  }

  const term = searchTerm.toLowerCase().trim();
  return users.filter(
    (user) =>
      user.username.toLowerCase().includes(term) ||
      (user.player && user.player.toLowerCase().includes(term)),
  );
}

/**
 * Sort users by display name alphabetically
 *
 * @param users - Array of users to sort
 * @param direction - Sort direction: 'asc' (ascending) or 'desc' (descending)
 * @returns Sorted array of users
 *
 * @example
 * ```typescript
 * const users = [
 *   { username: 'Charlie', player: 'Alpha' },
 *   { username: 'Alice', player: 'Bravo' },
 *   { username: 'Bob', player: 'Charlie' }
 * ];
 * sortUsersByDisplayName(users, 'asc');
 * // [Alice, Bob, Charlie] (sorted by username by default)
 * ```
 */
export function sortUsersByDisplayName<T extends DisplayNameUser>(
  users: T[],
  direction: "asc" | "desc" = "asc",
): T[] {
  const sorted = [...users].sort((a, b) => {
    const nameA = getDisplayName(a).toLowerCase();
    const nameB = getDisplayName(b).toLowerCase();
    return direction === "asc"
      ? nameA.localeCompare(nameB)
      : nameB.localeCompare(nameA);
  });

  return sorted;
}

/**
 * Group users by first letter of display name
 *
 * Useful for creating alphabetically grouped lists.
 *
 * @param users - Array of users to group
 * @returns Object mapping first letters to arrays of users
 *
 * @example
 * ```typescript
 * const users = [
 *   { username: 'Alice', player: null },
 *   { username: 'Bob', player: null },
 *   { username: 'Anna', player: null }
 * ];
 * groupUsersByFirstLetter(users);
 * // {
 * //   A: [{ username: 'Alice' }, { username: 'Anna' }],
 * //   B: [{ username: 'Bob' }]
 * // }
 * ```
 */
export function groupUsersByFirstLetter<T extends DisplayNameUser>(
  users: T[],
): Record<string, T[]> {
  const groups: Record<string, T[]> = {};

  users.forEach((user) => {
    const displayName = getDisplayName(user);
    const firstLetter = displayName.charAt(0).toUpperCase();
    const letter = /[A-Z]/.test(firstLetter) ? firstLetter : "#";

    if (!groups[letter]) {
      groups[letter] = [];
    }

    groups[letter].push(user);
  });

  return groups;
}

/**
 * Get display name with fallback text
 *
 * Returns a fallback text if display name is empty or only whitespace.
 *
 * @param user - User object
 * @param fallback - Fallback text (default: 'Unknown User')
 * @returns Display name or fallback
 *
 * @example
 * ```typescript
 * getDisplayNameWithFallback({ username: '', player: null });
 * // "Unknown User"
 *
 * getDisplayNameWithFallback({ username: '', player: null }, 'Guest');
 * // "Guest"
 *
 * getDisplayNameWithFallback({ username: 'Alice', player: null });
 * // "Alice"
 * ```
 */
export function getDisplayNameWithFallback(
  user: DisplayNameUser,
  fallback: string = "Unknown User",
): string {
  const displayName = getDisplayName(user);
  return displayName.trim().length > 0 ? displayName : fallback;
}

/**
 * Truncate display name to a maximum length
 *
 * Adds ellipsis (...) if name is longer than maxLength.
 *
 * @param user - User object
 * @param maxLength - Maximum length (default: 20)
 * @returns Truncated display name
 *
 * @example
 * ```typescript
 * const user = { username: 'VeryLongUsernameHere', player: null };
 * truncateDisplayName(user, 10);
 * // "VeryLongUs..."
 *
 * truncateDisplayName({ username: 'Bob', player: null }, 10);
 * // "Bob"
 * ```
 */
export function truncateDisplayName(
  user: DisplayNameUser,
  maxLength: number = 20,
): string {
  const displayName = getDisplayName(user);

  if (displayName.length <= maxLength) {
    return displayName;
  }

  return displayName.slice(0, maxLength - 3) + "...";
}

/**
 * Check if display name matches a search term (case-insensitive)
 *
 * Searches in both username and player name fields.
 *
 * @param user - User to check
 * @param searchTerm - Term to search for
 * @returns True if display name matches search term
 *
 * @example
 * ```typescript
 * const user = { username: 'Alice', player: 'SpaceAlice' };
 * matchesDisplayName(user, 'alice'); // true
 * matchesDisplayName(user, 'space'); // true
 * matchesDisplayName(user, 'bob');   // false
 * ```
 */
export function matchesDisplayName(
  user: DisplayNameUser,
  searchTerm: string,
): boolean {
  if (!searchTerm || searchTerm.trim().length === 0) {
    return true;
  }

  const term = searchTerm.toLowerCase().trim();
  const username = user.username.toLowerCase();
  const player = user.player?.toLowerCase() || "";

  return username.includes(term) || player.includes(term);
}
