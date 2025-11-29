/**
 * User and Profile Types
 *
 * Core user/profile types used across all applications.
 * Standardized on "UserProfile" name to avoid confusion with database "User" type.
 *
 * @module types/core/user
 */

/**
 * User profile with Discord OAuth and Star Citizen data
 *
 * This is the canonical user profile type used across all applications.
 * Represents a user's account data with both Discord OAuth information
 * and Star Citizen player information.
 */
export interface UserProfile {
  /** Unique user ID (UUID) */
  id: string;

  /** Discord user ID (18-digit snowflake) */
  discordId: string;

  /** Discord username */
  username: string;

  /** Discord avatar hash (null if no avatar) */
  avatar: string | null;

  /** Star Citizen player name (null if not set) */
  player: string | null;

  /** User's timezone (IANA timezone string, e.g., "America/New_York") */
  timeZone: string | null;

  /** Whether to use Star Citizen player name instead of Discord username for display */
  usePlayerAsDisplayName: boolean;

  /** Whether user has access to beta features (e.g., log pattern discovery) */
  betaTester: boolean;

  /** Whether to show timezone in UI (UI preference) */
  showTimezone?: boolean;

  /** Friend code for easy friend requests (6-char alphanumeric, null if not generated) */
  friendCode: string | null;

  /** User role for access control */
  role: "user" | "admin";

  /** Account creation timestamp (ISO 8601) */
  createdAt: string;

  /** Last update timestamp (ISO 8601) */
  updatedAt: string;

  /**
   * Computed display name (not stored in database)
   * - If usePlayerAsDisplayName && player: returns player name
   * - Otherwise: returns username
   */
  displayName?: string;
}

/**
 * Profile update data (subset of UserProfile for updates)
 *
 * Only includes fields that can be updated by the user.
 * Used for API requests to update user profile.
 */
export interface ProfileUpdateData {
  /** Update Star Citizen player name */
  player?: string | null;

  /** Update timezone */
  timeZone?: string | null;

  /** Update display name preference */
  usePlayerAsDisplayName?: boolean;

  /** Update timezone visibility preference */
  showTimezone?: boolean;
}

/**
 * Calculate display name for a user based on their profile settings
 *
 * @param profile - User profile
 * @returns Display name (either player name or username)
 */
export function getDisplayName(profile: UserProfile): string {
  if (profile.displayName) {
    return profile.displayName;
  }

  if (profile.usePlayerAsDisplayName && profile.player) {
    return profile.player;
  }

  return profile.username;
}

/**
 * Get secondary name for display (opposite of display name)
 *
 * @param profile - User profile
 * @returns Secondary name (username if showing player, player if showing username)
 */
export function getSecondaryName(profile: UserProfile): string | null {
  if (profile.usePlayerAsDisplayName && profile.player) {
    return profile.username;
  }

  return profile.player;
}

/**
 * Check if user has a Star Citizen player name set
 *
 * @param profile - User profile
 * @returns True if player name is set
 */
export function hasPlayerName(profile: UserProfile): boolean {
  return profile.player !== null && profile.player.trim().length > 0;
}

/**
 * Format user for display with both names if available
 *
 * @param profile - User profile
 * @returns Formatted string (e.g., "PlayerName (Username)" or "Username")
 */
export function formatUserDisplay(profile: UserProfile): string {
  const displayName = getDisplayName(profile);
  const secondaryName = getSecondaryName(profile);

  if (secondaryName) {
    return `${displayName} (${secondaryName})`;
  }

  return displayName;
}
