/**
 * Unit tests for user display name helper functions
 *
 * Tests cover:
 * - getDisplayName with different preferences
 * - Fallback behavior for missing names
 * - getSecondaryName complementary logic
 * - hasPlayerName validation
 * - formatUserDisplay formatting
 * - Edge cases (null, undefined, empty strings, whitespace)
 *
 * @module tests/users
 */

import { describe, it, expect } from "vitest";
import type { UserProfile } from "./core/user.js";
import {
  getDisplayName,
  getSecondaryName,
  hasPlayerName,
  formatUserDisplay,
} from "./core/user.js";

/**
 * Test suite for user display name helper functions
 */
describe("User Display Name Helpers", () => {
  // ============================================================================
  // getDisplayName Tests
  // ============================================================================

  describe("getDisplayName", () => {
    it("should return displayName if it is set", () => {
      const profile: UserProfile = {
        id: "user-1",
        discordId: "123456789",
        username: "john_doe",
        avatar: null,
        player: "JohnPlayer",
        timeZone: "America/New_York",
        usePlayerAsDisplayName: false,
        betaTester: false,
        friendCode: "ABC123",
        role: "user",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
        displayName: "CustomDisplayName",
      };

      expect(getDisplayName(profile)).toBe("CustomDisplayName");
    });

    it("should return player name when usePlayerAsDisplayName is true and player exists", () => {
      const profile: UserProfile = {
        id: "user-1",
        discordId: "123456789",
        username: "john_doe",
        avatar: null,
        player: "JohnPlayer",
        timeZone: "America/New_York",
        usePlayerAsDisplayName: true,
        betaTester: false,
        friendCode: "ABC123",
        role: "user",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      };

      expect(getDisplayName(profile)).toBe("JohnPlayer");
    });

    it("should return username when usePlayerAsDisplayName is true but player is null", () => {
      const profile: UserProfile = {
        id: "user-1",
        discordId: "123456789",
        username: "john_doe",
        avatar: null,
        player: null,
        timeZone: "America/New_York",
        usePlayerAsDisplayName: true,
        betaTester: false,
        friendCode: "ABC123",
        role: "user",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      };

      expect(getDisplayName(profile)).toBe("john_doe");
    });

    it("should return username when usePlayerAsDisplayName is false", () => {
      const profile: UserProfile = {
        id: "user-1",
        discordId: "123456789",
        username: "john_doe",
        avatar: null,
        player: "JohnPlayer",
        timeZone: "America/New_York",
        usePlayerAsDisplayName: false,
        betaTester: false,
        friendCode: "ABC123",
        role: "user",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      };

      expect(getDisplayName(profile)).toBe("john_doe");
    });

    it("should return username when no player name exists", () => {
      const profile: UserProfile = {
        id: "user-1",
        discordId: "123456789",
        username: "alice_smith",
        avatar: "avatar_hash_123",
        player: null,
        timeZone: "Europe/London",
        usePlayerAsDisplayName: false,
        betaTester: false,
        friendCode: null,
        role: "user",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      };

      expect(getDisplayName(profile)).toBe("alice_smith");
    });

    it("should return username when player is empty string and usePlayerAsDisplayName is true", () => {
      const profile: UserProfile = {
        id: "user-1",
        discordId: "123456789",
        username: "bob_jones",
        avatar: null,
        player: "",
        timeZone: "America/Los_Angeles",
        usePlayerAsDisplayName: true,
        betaTester: false,
        friendCode: "DEF456",
        role: "user",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      };

      expect(getDisplayName(profile)).toBe("bob_jones");
    });

    it("should prefer displayName over all other preferences", () => {
      const profile: UserProfile = {
        id: "user-1",
        discordId: "123456789",
        username: "john_doe",
        avatar: null,
        player: "JohnPlayer",
        timeZone: "America/New_York",
        usePlayerAsDisplayName: true,
        betaTester: false,
        friendCode: "ABC123",
        role: "user",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
        displayName: "PrefixedName",
      };

      expect(getDisplayName(profile)).toBe("PrefixedName");
    });

    it("should return whitespace-only player name even though it is technically truthy", () => {
      const profile: UserProfile = {
        id: "user-1",
        discordId: "123456789",
        username: "chris_wilson",
        avatar: null,
        player: "   ",
        timeZone: "America/Chicago",
        usePlayerAsDisplayName: true,
        betaTester: false,
        friendCode: "GHI789",
        role: "user",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      };

      // Whitespace-only string is truthy, so getDisplayName returns it
      expect(getDisplayName(profile)).toBe("   ");
    });

    it("should handle special characters in player name", () => {
      const profile: UserProfile = {
        id: "user-1",
        discordId: "123456789",
        username: "player_user",
        avatar: null,
        player: "Player-Name_123!@",
        timeZone: "America/New_York",
        usePlayerAsDisplayName: true,
        betaTester: false,
        friendCode: "ABC123",
        role: "user",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      };

      expect(getDisplayName(profile)).toBe("Player-Name_123!@");
    });

    it("should handle unicode characters in names", () => {
      const profile: UserProfile = {
        id: "user-1",
        discordId: "123456789",
        username: "user_日本語",
        avatar: null,
        player: "プレイヤー_Name",
        timeZone: "Asia/Tokyo",
        usePlayerAsDisplayName: true,
        betaTester: false,
        friendCode: "ABC123",
        role: "user",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      };

      expect(getDisplayName(profile)).toBe("プレイヤー_Name");
    });

    it("should handle empty displayName string gracefully", () => {
      const profile: UserProfile = {
        id: "user-1",
        discordId: "123456789",
        username: "fallback_user",
        avatar: null,
        player: "PlayerName",
        timeZone: "America/New_York",
        usePlayerAsDisplayName: false,
        betaTester: false,
        friendCode: "ABC123",
        role: "user",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
        displayName: "",
      };

      // Empty string is falsy, so should fall through to next logic
      expect(getDisplayName(profile)).toBe("fallback_user");
    });
  });

  // ============================================================================
  // getSecondaryName Tests
  // ============================================================================

  describe("getSecondaryName", () => {
    it("should return username when showing player as primary", () => {
      const profile: UserProfile = {
        id: "user-1",
        discordId: "123456789",
        username: "john_doe",
        avatar: null,
        player: "JohnPlayer",
        timeZone: "America/New_York",
        usePlayerAsDisplayName: true,
        betaTester: false,
        friendCode: "ABC123",
        role: "user",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      };

      expect(getSecondaryName(profile)).toBe("john_doe");
    });

    it("should return player name when showing username as primary", () => {
      const profile: UserProfile = {
        id: "user-1",
        discordId: "123456789",
        username: "john_doe",
        avatar: null,
        player: "JohnPlayer",
        timeZone: "America/New_York",
        usePlayerAsDisplayName: false,
        betaTester: false,
        friendCode: "ABC123",
        role: "user",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      };

      expect(getSecondaryName(profile)).toBe("JohnPlayer");
    });

    it("should return null when no player name and showing player as primary", () => {
      const profile: UserProfile = {
        id: "user-1",
        discordId: "123456789",
        username: "alice_smith",
        avatar: null,
        player: null,
        timeZone: "Europe/London",
        usePlayerAsDisplayName: true,
        betaTester: false,
        friendCode: null,
        role: "user",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      };

      expect(getSecondaryName(profile)).toBeNull();
    });

    it("should return null when no player name and showing username as primary", () => {
      const profile: UserProfile = {
        id: "user-1",
        discordId: "123456789",
        username: "bob_jones",
        avatar: "avatar_hash",
        player: null,
        timeZone: "America/Los_Angeles",
        usePlayerAsDisplayName: false,
        betaTester: false,
        friendCode: "DEF456",
        role: "user",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      };

      expect(getSecondaryName(profile)).toBeNull();
    });

    it("should return null when player is empty string and showing username as primary", () => {
      const profile: UserProfile = {
        id: "user-1",
        discordId: "123456789",
        username: "chris_wilson",
        avatar: null,
        player: "",
        timeZone: "America/Chicago",
        usePlayerAsDisplayName: false,
        betaTester: false,
        friendCode: "GHI789",
        role: "user",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      };

      expect(getSecondaryName(profile)).toBe("");
    });

    it("should return username when player is whitespace-only and showing player as primary", () => {
      const profile: UserProfile = {
        id: "user-1",
        discordId: "123456789",
        username: "david_lee",
        avatar: null,
        player: "   ",
        timeZone: "America/New_York",
        usePlayerAsDisplayName: true,
        betaTester: false,
        friendCode: "JKL012",
        role: "user",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      };

      // Whitespace-only player is truthy, so secondary name is username
      expect(getSecondaryName(profile)).toBe("david_lee");
    });

    it("should complement getDisplayName when using player as primary", () => {
      const profile: UserProfile = {
        id: "user-1",
        discordId: "123456789",
        username: "eve_johnson",
        avatar: null,
        player: "EvePlayer",
        timeZone: "Europe/Paris",
        usePlayerAsDisplayName: true,
        betaTester: false,
        friendCode: "MNO345",
        role: "user",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      };

      const displayName = getDisplayName(profile);
      const secondaryName = getSecondaryName(profile);

      expect(displayName).toBe("EvePlayer");
      expect(secondaryName).toBe("eve_johnson");
      expect(displayName).not.toBe(secondaryName);
    });

    it("should complement getDisplayName when using username as primary", () => {
      const profile: UserProfile = {
        id: "user-1",
        discordId: "123456789",
        username: "frank_miller",
        avatar: null,
        player: "FrankPlayer",
        timeZone: "America/Denver",
        usePlayerAsDisplayName: false,
        betaTester: false,
        friendCode: "PQR678",
        role: "user",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      };

      const displayName = getDisplayName(profile);
      const secondaryName = getSecondaryName(profile);

      expect(displayName).toBe("frank_miller");
      expect(secondaryName).toBe("FrankPlayer");
      expect(displayName).not.toBe(secondaryName);
    });
  });

  // ============================================================================
  // hasPlayerName Tests
  // ============================================================================

  describe("hasPlayerName", () => {
    it("should return true when player name is set", () => {
      const profile: UserProfile = {
        id: "user-1",
        discordId: "123456789",
        username: "john_doe",
        avatar: null,
        player: "JohnPlayer",
        timeZone: "America/New_York",
        usePlayerAsDisplayName: false,
        betaTester: false,
        friendCode: "ABC123",
        role: "user",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      };

      expect(hasPlayerName(profile)).toBe(true);
    });

    it("should return false when player is null", () => {
      const profile: UserProfile = {
        id: "user-1",
        discordId: "123456789",
        username: "alice_smith",
        avatar: null,
        player: null,
        timeZone: "Europe/London",
        usePlayerAsDisplayName: false,
        betaTester: false,
        friendCode: null,
        role: "user",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      };

      expect(hasPlayerName(profile)).toBe(false);
    });

    it("should return false when player is empty string", () => {
      const profile: UserProfile = {
        id: "user-1",
        discordId: "123456789",
        username: "bob_jones",
        avatar: "avatar_hash",
        player: "",
        timeZone: "America/Los_Angeles",
        usePlayerAsDisplayName: false,
        betaTester: false,
        friendCode: "DEF456",
        role: "user",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      };

      expect(hasPlayerName(profile)).toBe(false);
    });

    it("should return false when player is whitespace-only", () => {
      const profile: UserProfile = {
        id: "user-1",
        discordId: "123456789",
        username: "chris_wilson",
        avatar: null,
        player: "   ",
        timeZone: "America/Chicago",
        usePlayerAsDisplayName: false,
        betaTester: false,
        friendCode: "GHI789",
        role: "user",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      };

      expect(hasPlayerName(profile)).toBe(false);
    });

    it("should return true for player name with leading/trailing whitespace but non-whitespace content", () => {
      const profile: UserProfile = {
        id: "user-1",
        discordId: "123456789",
        username: "david_lee",
        avatar: null,
        player: "  Player  ",
        timeZone: "America/New_York",
        usePlayerAsDisplayName: false,
        betaTester: false,
        friendCode: "JKL012",
        role: "user",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      };

      expect(hasPlayerName(profile)).toBe(true);
    });

    it("should return true for single character player name", () => {
      const profile: UserProfile = {
        id: "user-1",
        discordId: "123456789",
        username: "eve_johnson",
        avatar: null,
        player: "A",
        timeZone: "Europe/Paris",
        usePlayerAsDisplayName: false,
        betaTester: false,
        friendCode: "MNO345",
        role: "user",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      };

      expect(hasPlayerName(profile)).toBe(true);
    });

    it("should return true for player name with special characters", () => {
      const profile: UserProfile = {
        id: "user-1",
        discordId: "123456789",
        username: "frank_miller",
        avatar: null,
        player: "Player-Name_123!@#",
        timeZone: "America/Denver",
        usePlayerAsDisplayName: false,
        betaTester: false,
        friendCode: "PQR678",
        role: "user",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      };

      expect(hasPlayerName(profile)).toBe(true);
    });
  });

  // ============================================================================
  // formatUserDisplay Tests
  // ============================================================================

  describe("formatUserDisplay", () => {
    it("should return only display name when no secondary name", () => {
      const profile: UserProfile = {
        id: "user-1",
        discordId: "123456789",
        username: "alice_smith",
        avatar: null,
        player: null,
        timeZone: "Europe/London",
        usePlayerAsDisplayName: false,
        betaTester: false,
        friendCode: null,
        role: "user",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      };

      expect(formatUserDisplay(profile)).toBe("alice_smith");
    });

    it("should return formatted display with both names when both exist", () => {
      const profile: UserProfile = {
        id: "user-1",
        discordId: "123456789",
        username: "john_doe",
        avatar: null,
        player: "JohnPlayer",
        timeZone: "America/New_York",
        usePlayerAsDisplayName: true,
        betaTester: false,
        friendCode: "ABC123",
        role: "user",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      };

      expect(formatUserDisplay(profile)).toBe("JohnPlayer (john_doe)");
    });

    it("should show player name as primary with username in parentheses when usePlayerAsDisplayName is true", () => {
      const profile: UserProfile = {
        id: "user-1",
        discordId: "123456789",
        username: "bob_jones",
        avatar: "avatar_hash",
        player: "BobPlayer",
        timeZone: "America/Los_Angeles",
        usePlayerAsDisplayName: true,
        betaTester: false,
        friendCode: "DEF456",
        role: "user",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      };

      expect(formatUserDisplay(profile)).toBe("BobPlayer (bob_jones)");
    });

    it("should show username as primary with player in parentheses when usePlayerAsDisplayName is false", () => {
      const profile: UserProfile = {
        id: "user-1",
        discordId: "123456789",
        username: "chris_wilson",
        avatar: null,
        player: "ChrisPlayer",
        timeZone: "America/Chicago",
        usePlayerAsDisplayName: false,
        betaTester: false,
        friendCode: "GHI789",
        role: "user",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      };

      expect(formatUserDisplay(profile)).toBe("chris_wilson (ChrisPlayer)");
    });

    it("should use custom displayName when set", () => {
      const profile: UserProfile = {
        id: "user-1",
        discordId: "123456789",
        username: "david_lee",
        avatar: null,
        player: "DavidPlayer",
        timeZone: "America/New_York",
        usePlayerAsDisplayName: false,
        betaTester: false,
        friendCode: "JKL012",
        role: "user",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
        displayName: "CustomName",
      };

      expect(formatUserDisplay(profile)).toBe("CustomName (DavidPlayer)");
    });

    it("should format with special characters in names", () => {
      const profile: UserProfile = {
        id: "user-1",
        discordId: "123456789",
        username: "eve_johnson-123",
        avatar: null,
        player: "Eve-Player_#1",
        timeZone: "Europe/Paris",
        usePlayerAsDisplayName: true,
        betaTester: false,
        friendCode: "MNO345",
        role: "user",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      };

      expect(formatUserDisplay(profile)).toBe(
        "Eve-Player_#1 (eve_johnson-123)",
      );
    });

    it("should format with unicode characters", () => {
      const profile: UserProfile = {
        id: "user-1",
        discordId: "123456789",
        username: "user_日本語",
        avatar: null,
        player: "プレイヤー_Name",
        timeZone: "Asia/Tokyo",
        usePlayerAsDisplayName: true,
        betaTester: false,
        friendCode: "NOP789",
        role: "user",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      };

      expect(formatUserDisplay(profile)).toBe("プレイヤー_Name (user_日本語)");
    });

    it("should not include secondary name in parentheses when it does not exist", () => {
      const profile: UserProfile = {
        id: "user-1",
        discordId: "123456789",
        username: "frank_miller",
        avatar: null,
        player: null,
        timeZone: "America/Denver",
        usePlayerAsDisplayName: false,
        betaTester: false,
        friendCode: "PQR678",
        role: "user",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      };

      expect(formatUserDisplay(profile)).not.toContain("(");
      expect(formatUserDisplay(profile)).not.toContain(")");
    });

    it("should include whitespace-only player name in format", () => {
      const profile: UserProfile = {
        id: "user-1",
        discordId: "123456789",
        username: "grace_anderson",
        avatar: null,
        player: "   ",
        timeZone: "America/Phoenix",
        usePlayerAsDisplayName: false,
        betaTester: false,
        friendCode: "STU901",
        role: "user",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      };

      // Whitespace-only player is truthy, so it's included in the format
      expect(formatUserDisplay(profile)).toBe("grace_anderson (   )");
    });
  });

  // ============================================================================
  // Integration Tests (Multiple Functions Together)
  // ============================================================================

  describe("Integration - Multiple Functions", () => {
    it("should work together coherently for complete user profile flow", () => {
      const profile: UserProfile = {
        id: "user-1",
        discordId: "123456789",
        username: "henry_clark",
        avatar: "avatar_xyz",
        player: "HenryPlayer",
        timeZone: "America/New_York",
        usePlayerAsDisplayName: true,
        betaTester: false,
        friendCode: "VWX234",
        role: "user",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      };

      // When using player as display name
      expect(hasPlayerName(profile)).toBe(true);
      expect(getDisplayName(profile)).toBe("HenryPlayer");
      expect(getSecondaryName(profile)).toBe("henry_clark");
      expect(formatUserDisplay(profile)).toBe("HenryPlayer (henry_clark)");
    });

    it("should work together coherently when player name not set", () => {
      const profile: UserProfile = {
        id: "user-1",
        discordId: "123456789",
        username: "iris_martin",
        avatar: null,
        player: null,
        timeZone: "Europe/Berlin",
        usePlayerAsDisplayName: true,
        betaTester: false,
        friendCode: null,
        role: "user",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      };

      // When player name is not available
      expect(hasPlayerName(profile)).toBe(false);
      expect(getDisplayName(profile)).toBe("iris_martin");
      expect(getSecondaryName(profile)).toBeNull();
      expect(formatUserDisplay(profile)).toBe("iris_martin");
    });

    it("should work together when switching display preference", () => {
      const playerFirstProfile: UserProfile = {
        id: "user-1",
        discordId: "123456789",
        username: "jack_taylor",
        avatar: null,
        player: "JackPlayer",
        timeZone: "America/Atlanta",
        usePlayerAsDisplayName: true,
        betaTester: false,
        friendCode: "YZA567",
        role: "user",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      };

      const usernameFirstProfile: UserProfile = {
        ...playerFirstProfile,
        usePlayerAsDisplayName: false,
      };

      // When showing player first
      expect(getDisplayName(playerFirstProfile)).toBe("JackPlayer");
      expect(getSecondaryName(playerFirstProfile)).toBe("jack_taylor");
      expect(formatUserDisplay(playerFirstProfile)).toBe(
        "JackPlayer (jack_taylor)",
      );

      // When showing username first
      expect(getDisplayName(usernameFirstProfile)).toBe("jack_taylor");
      expect(getSecondaryName(usernameFirstProfile)).toBe("JackPlayer");
      expect(formatUserDisplay(usernameFirstProfile)).toBe(
        "jack_taylor (JackPlayer)",
      );
    });
  });
});
