/**
 * Tests for display name utility functions
 */

import { describe, it, expect } from "vitest";
import {
  getDisplayName,
  getSecondaryName,
  hasPlayerName,
  formatUserDisplay,
  getInitials,
  searchUsersByName,
  sortUsersByDisplayName,
  groupUsersByFirstLetter,
  getDisplayNameWithFallback,
  truncateDisplayName,
  matchesDisplayName,
  type DisplayNameUser,
} from "./display-name";

describe("getDisplayName", () => {
  it("should return player name when usePlayerAsDisplayName is true and player exists", () => {
    const user: DisplayNameUser = {
      username: "DiscordUser123",
      player: "SpaceCommander",
      usePlayerAsDisplayName: true,
    };
    expect(getDisplayName(user)).toBe("SpaceCommander");
  });

  it("should return username when usePlayerAsDisplayName is false", () => {
    const user: DisplayNameUser = {
      username: "DiscordUser123",
      player: "SpaceCommander",
      usePlayerAsDisplayName: false,
    };
    expect(getDisplayName(user)).toBe("DiscordUser123");
  });

  it("should return username when usePlayerAsDisplayName is undefined", () => {
    const user: DisplayNameUser = {
      username: "DiscordUser123",
      player: "SpaceCommander",
    };
    expect(getDisplayName(user)).toBe("DiscordUser123");
  });

  it("should return username when player is null even if usePlayerAsDisplayName is true", () => {
    const user: DisplayNameUser = {
      username: "DiscordUser123",
      player: null,
      usePlayerAsDisplayName: true,
    };
    expect(getDisplayName(user)).toBe("DiscordUser123");
  });

  it("should return username when player is undefined even if usePlayerAsDisplayName is true", () => {
    const user: DisplayNameUser = {
      username: "DiscordUser123",
      player: undefined,
      usePlayerAsDisplayName: true,
    };
    expect(getDisplayName(user)).toBe("DiscordUser123");
  });

  it("should return username when player is empty string even if usePlayerAsDisplayName is true", () => {
    const user: DisplayNameUser = {
      username: "DiscordUser123",
      player: "",
      usePlayerAsDisplayName: true,
    };
    expect(getDisplayName(user)).toBe("DiscordUser123");
  });
});

describe("getSecondaryName", () => {
  it("should return username when using player name as display", () => {
    const user: DisplayNameUser = {
      username: "DiscordUser123",
      player: "SpaceCommander",
      usePlayerAsDisplayName: true,
    };
    expect(getSecondaryName(user)).toBe("DiscordUser123");
  });

  it("should return player name when using username as display", () => {
    const user: DisplayNameUser = {
      username: "DiscordUser123",
      player: "SpaceCommander",
      usePlayerAsDisplayName: false,
    };
    expect(getSecondaryName(user)).toBe("SpaceCommander");
  });

  it("should return null when player is null and using username", () => {
    const user: DisplayNameUser = {
      username: "DiscordUser123",
      player: null,
      usePlayerAsDisplayName: false,
    };
    expect(getSecondaryName(user)).toBeNull();
  });

  it("should return null when player is null and using player (fallback to username)", () => {
    const user: DisplayNameUser = {
      username: "DiscordUser123",
      player: null,
      usePlayerAsDisplayName: true,
    };
    expect(getSecondaryName(user)).toBeNull();
  });

  it("should return null when usePlayerAsDisplayName is undefined and player exists", () => {
    const user: DisplayNameUser = {
      username: "DiscordUser123",
      player: "SpaceCommander",
    };
    expect(getSecondaryName(user)).toBe("SpaceCommander");
  });
});

describe("hasPlayerName", () => {
  it("should return true when player name exists", () => {
    expect(hasPlayerName({ player: "SpaceCommander" })).toBe(true);
  });

  it("should return false when player is null", () => {
    expect(hasPlayerName({ player: null })).toBe(false);
  });

  it("should return false when player is undefined", () => {
    expect(hasPlayerName({ player: undefined })).toBe(false);
  });

  it("should return false when player is empty string", () => {
    expect(hasPlayerName({ player: "" })).toBe(false);
  });

  it("should return false when player is only whitespace", () => {
    expect(hasPlayerName({ player: "   " })).toBe(false);
    expect(hasPlayerName({ player: "\t" })).toBe(false);
    expect(hasPlayerName({ player: "\n" })).toBe(false);
  });

  it("should return true when player has whitespace but also content", () => {
    expect(hasPlayerName({ player: "  Commander  " })).toBe(true);
  });
});

describe("formatUserDisplay", () => {
  it("should format with secondary name when both names exist and using player", () => {
    const user: DisplayNameUser = {
      username: "DiscordUser",
      player: "SpaceCommander",
      usePlayerAsDisplayName: true,
    };
    expect(formatUserDisplay(user)).toBe("SpaceCommander (DiscordUser)");
  });

  it("should format with secondary name when both names exist and using username", () => {
    const user: DisplayNameUser = {
      username: "DiscordUser",
      player: "SpaceCommander",
      usePlayerAsDisplayName: false,
    };
    expect(formatUserDisplay(user)).toBe("DiscordUser (SpaceCommander)");
  });

  it("should return only display name when no secondary name", () => {
    const user: DisplayNameUser = {
      username: "DiscordUser",
      player: null,
      usePlayerAsDisplayName: false,
    };
    expect(formatUserDisplay(user)).toBe("DiscordUser");
  });

  it("should return only username when player is empty", () => {
    const user: DisplayNameUser = {
      username: "DiscordUser",
      player: "",
      usePlayerAsDisplayName: false,
    };
    expect(formatUserDisplay(user)).toBe("DiscordUser");
  });
});

describe("getInitials", () => {
  it("should return initials from two-word names", () => {
    expect(getInitials("Space Commander")).toBe("SC");
    expect(getInitials("John Doe")).toBe("JD");
  });

  it("should return first letter for single-word names", () => {
    expect(getInitials("John")).toBe("J");
    expect(getInitials("Commander")).toBe("C");
  });

  it("should return empty string for empty input", () => {
    expect(getInitials("")).toBe("");
    expect(getInitials("   ")).toBe("");
  });

  it("should handle multiple spaces between words", () => {
    expect(getInitials("Space   Commander")).toBe("SC");
  });

  it("should handle leading/trailing whitespace", () => {
    expect(getInitials("  Space Commander  ")).toBe("SC");
  });

  it("should uppercase initials", () => {
    expect(getInitials("space commander")).toBe("SC");
    expect(getInitials("john")).toBe("J");
  });

  it("should only use first two words", () => {
    expect(getInitials("Space Commander Elite")).toBe("SC");
  });
});

describe("searchUsersByName", () => {
  const users: DisplayNameUser[] = [
    { username: "Alice", player: "SpaceAlice" },
    { username: "Bob", player: "CommanderBob" },
    { username: "Charlie", player: null },
    { username: "David", player: "SpaceExplorer" },
  ];

  it("should find users by username", () => {
    const result = searchUsersByName(users, "alice");
    expect(result).toHaveLength(1);
    expect(result[0].username).toBe("Alice");
  });

  it("should find users by player name", () => {
    const result = searchUsersByName(users, "space");
    expect(result).toHaveLength(2);
    expect(result.map((u) => u.username)).toEqual(["Alice", "David"]);
  });

  it("should be case-insensitive", () => {
    const result = searchUsersByName(users, "ALICE");
    expect(result).toHaveLength(1);
    expect(result[0].username).toBe("Alice");
  });

  it("should return all users for empty search term", () => {
    expect(searchUsersByName(users, "")).toHaveLength(4);
    expect(searchUsersByName(users, "   ")).toHaveLength(4);
  });

  it("should return empty array when no matches", () => {
    const result = searchUsersByName(users, "xyz");
    expect(result).toHaveLength(0);
  });

  it("should handle users with null player names", () => {
    const result = searchUsersByName(users, "charlie");
    expect(result).toHaveLength(1);
    expect(result[0].username).toBe("Charlie");
  });
});

describe("sortUsersByDisplayName", () => {
  const users: DisplayNameUser[] = [
    { username: "Charlie", player: "Alpha", usePlayerAsDisplayName: false },
    { username: "Alice", player: "Bravo", usePlayerAsDisplayName: false },
    { username: "Bob", player: "Charlie", usePlayerAsDisplayName: false },
  ];

  it("should sort ascending by default", () => {
    const result = sortUsersByDisplayName(users);
    expect(result.map((u) => u.username)).toEqual(["Alice", "Bob", "Charlie"]);
  });

  it("should sort ascending explicitly", () => {
    const result = sortUsersByDisplayName(users, "asc");
    expect(result.map((u) => u.username)).toEqual(["Alice", "Bob", "Charlie"]);
  });

  it("should sort descending", () => {
    const result = sortUsersByDisplayName(users, "desc");
    expect(result.map((u) => u.username)).toEqual(["Charlie", "Bob", "Alice"]);
  });

  it("should sort by player name when usePlayerAsDisplayName is true", () => {
    const usersWithPlayer: DisplayNameUser[] = [
      { username: "Charlie", player: "Zulu", usePlayerAsDisplayName: true },
      { username: "Alice", player: "Alpha", usePlayerAsDisplayName: true },
      { username: "Bob", player: "Bravo", usePlayerAsDisplayName: true },
    ];
    const result = sortUsersByDisplayName(usersWithPlayer);
    expect(result.map((u) => u.player)).toEqual(["Alpha", "Bravo", "Zulu"]);
  });

  it("should not mutate original array", () => {
    const original = [...users];
    sortUsersByDisplayName(users);
    expect(users).toEqual(original);
  });
});

describe("groupUsersByFirstLetter", () => {
  const users: DisplayNameUser[] = [
    { username: "Alice", player: null },
    { username: "Bob", player: null },
    { username: "Anna", player: null },
    { username: "Charlie", player: null },
    { username: "123User", player: null },
  ];

  it("should group users by first letter", () => {
    const result = groupUsersByFirstLetter(users);
    expect(result["A"]).toHaveLength(2);
    expect(result["B"]).toHaveLength(1);
    expect(result["C"]).toHaveLength(1);
  });

  it("should use # for non-alphabetic characters", () => {
    const result = groupUsersByFirstLetter(users);
    expect(result["#"]).toHaveLength(1);
    expect(result["#"][0].username).toBe("123User");
  });

  it("should uppercase letters", () => {
    const result = groupUsersByFirstLetter(users);
    expect(result).toHaveProperty("A");
    expect(result).not.toHaveProperty("a");
  });

  it("should handle empty array", () => {
    const result = groupUsersByFirstLetter([]);
    expect(Object.keys(result)).toHaveLength(0);
  });
});

describe("getDisplayNameWithFallback", () => {
  it("should return display name when valid", () => {
    const user: DisplayNameUser = {
      username: "Alice",
      player: null,
    };
    expect(getDisplayNameWithFallback(user)).toBe("Alice");
  });

  it("should return default fallback for empty username", () => {
    const user: DisplayNameUser = {
      username: "",
      player: null,
    };
    expect(getDisplayNameWithFallback(user)).toBe("Unknown User");
  });

  it("should return custom fallback when provided", () => {
    const user: DisplayNameUser = {
      username: "",
      player: null,
    };
    expect(getDisplayNameWithFallback(user, "Guest")).toBe("Guest");
  });

  it("should return fallback for whitespace-only username", () => {
    const user: DisplayNameUser = {
      username: "   ",
      player: null,
    };
    expect(getDisplayNameWithFallback(user)).toBe("Unknown User");
  });
});

describe("truncateDisplayName", () => {
  it("should not truncate names shorter than maxLength", () => {
    const user: DisplayNameUser = {
      username: "Bob",
      player: null,
    };
    expect(truncateDisplayName(user, 10)).toBe("Bob");
  });

  it("should truncate long names with ellipsis", () => {
    const user: DisplayNameUser = {
      username: "VeryLongUsernameHere",
      player: null,
    };
    expect(truncateDisplayName(user, 10)).toBe("VeryLon...");
  });

  it("should use default maxLength of 20", () => {
    const user: DisplayNameUser = {
      username: "ThisIsAVeryLongUsernameForTesting",
      player: null,
    };
    const result = truncateDisplayName(user);
    expect(result).toBe("ThisIsAVeryLongUs...");
    expect(result.length).toBe(20);
  });

  it("should not truncate names equal to maxLength", () => {
    const user: DisplayNameUser = {
      username: "TenLetters",
      player: null,
    };
    expect(truncateDisplayName(user, 10)).toBe("TenLetters");
  });
});

describe("matchesDisplayName", () => {
  const user: DisplayNameUser = {
    username: "Alice",
    player: "SpaceAlice",
  };

  it("should match username", () => {
    expect(matchesDisplayName(user, "alice")).toBe(true);
    expect(matchesDisplayName(user, "Alice")).toBe(true);
    expect(matchesDisplayName(user, "Ali")).toBe(true);
  });

  it("should match player name", () => {
    expect(matchesDisplayName(user, "space")).toBe(true);
    expect(matchesDisplayName(user, "Space")).toBe(true);
    expect(matchesDisplayName(user, "SpaceAlice")).toBe(true);
  });

  it("should be case-insensitive", () => {
    expect(matchesDisplayName(user, "ALICE")).toBe(true);
    expect(matchesDisplayName(user, "SPACE")).toBe(true);
  });

  it("should return true for empty search term", () => {
    expect(matchesDisplayName(user, "")).toBe(true);
    expect(matchesDisplayName(user, "   ")).toBe(true);
  });

  it("should return false when no match", () => {
    expect(matchesDisplayName(user, "bob")).toBe(false);
    expect(matchesDisplayName(user, "xyz")).toBe(false);
  });

  it("should handle user with null player", () => {
    const userNoPlayer: DisplayNameUser = {
      username: "Bob",
      player: null,
    };
    expect(matchesDisplayName(userNoPlayer, "bob")).toBe(true);
    expect(matchesDisplayName(userNoPlayer, "space")).toBe(false);
  });
});
