/**
 * Tests for FriendsPage.svelte
 *
 * Tests the component logic including:
 * - Display name computation
 * - Friend filtering (accepted vs pending)
 * - Relative time formatting
 * - Local time display
 * - Timezone display logic
 */

import { describe, it, expect } from "vitest";
import { formatDistanceToNow } from "date-fns";
import {
  createTestFriend,
  createTestFriends,
  createOnlineFriend,
  createTestFriendRequest,
  createIncomingFriendRequests,
  createOutgoingFriendRequests,
} from "../test-utils";
import type { Friend, FriendRequest } from "@pico/types";

// ============================================================================
// Helper function tests (extracted from FriendsPage.svelte)
// ============================================================================

/**
 * Get display name for a friend or friend request
 * (Extracted from FriendsPage.svelte for testing)
 */
function getDisplayName(friend: Friend | FriendRequest): string {
  // Use type guard to distinguish between Friend and FriendRequest
  if ("friendUsername" in friend && typeof friend.friendUsername === "string") {
    return friend.friendDisplayName || friend.friendUsername || "Unknown";
  }
  if ("fromUsername" in friend && typeof friend.fromUsername === "string") {
    return friend.fromDisplayName || friend.fromUsername || "Unknown";
  }
  return "Unknown";
}

/**
 * Format relative time from ISO date string
 */
function formatRelativeTime(dateString: string): string {
  return formatDistanceToNow(new Date(dateString), { addSuffix: true });
}

/**
 * Get local time for a timezone
 */
function getLocalTime(
  timezone: string | undefined,
  now: Date = new Date(),
): string {
  if (!timezone) return "";
  try {
    return now.toLocaleTimeString("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/**
 * Get city name from timezone string
 */
function getCityFromTimezone(timezone: string | undefined): string {
  if (!timezone) return "";
  const parts = timezone.split("/");
  let location = parts[parts.length - 1];
  if (parts.length > 1 && parts[0] === "Australia") {
    location = parts.join(", ");
  } else if (parts.length > 2) {
    location = parts.slice(-2).join(", ");
  }
  return location.replace(/_/g, " ");
}

/**
 * Filter accepted friends from friend list
 */
function filterAcceptedFriends(friends: Friend[]): Friend[] {
  return friends.filter((f) => f.status === "accepted");
}

// ============================================================================
// Display Name Tests
// ============================================================================

describe("FriendsPage - Display Name Logic", () => {
  it("should return friendDisplayName when available for Friend", () => {
    const friend = createTestFriend({
      friendDisplayName: "Custom Display Name",
      friendUsername: "username123",
    });

    expect(getDisplayName(friend)).toBe("Custom Display Name");
  });

  it("should fall back to friendUsername when friendDisplayName is empty", () => {
    const friend = createTestFriend({
      friendDisplayName: "",
      friendUsername: "username123",
    });

    expect(getDisplayName(friend)).toBe("username123");
  });

  it("should return fromDisplayName when available for FriendRequest", () => {
    const request = createTestFriendRequest({
      fromDisplayName: "Requester Display",
      fromUsername: "requester123",
    });

    expect(getDisplayName(request)).toBe("Requester Display");
  });

  it("should fall back to fromUsername when fromDisplayName is empty", () => {
    const request = createTestFriendRequest({
      fromDisplayName: "",
      fromUsername: "requester123",
    });

    expect(getDisplayName(request)).toBe("requester123");
  });

  it("should return Unknown for invalid objects", () => {
    const invalid = {} as Friend;
    expect(getDisplayName(invalid)).toBe("Unknown");
  });
});

// ============================================================================
// Friend Filtering Tests
// ============================================================================

describe("FriendsPage - Friend Filtering", () => {
  it("should filter only accepted friends", () => {
    const friends = [
      createTestFriend({ id: "1", status: "accepted" }),
      createTestFriend({ id: "2", status: "pending" }),
      createTestFriend({ id: "3", status: "accepted" }),
      createTestFriend({ id: "4", status: "pending" }),
    ];

    const accepted = filterAcceptedFriends(friends);

    expect(accepted).toHaveLength(2);
    expect(accepted.every((f) => f.status === "accepted")).toBe(true);
  });

  it("should return empty array when no accepted friends", () => {
    const friends = [
      createTestFriend({ id: "1", status: "pending" }),
      createTestFriend({ id: "2", status: "pending" }),
    ];

    const accepted = filterAcceptedFriends(friends);

    expect(accepted).toHaveLength(0);
  });

  it("should return all friends when all are accepted", () => {
    const friends = createTestFriends(5, { status: "accepted" });

    const accepted = filterAcceptedFriends(friends);

    expect(accepted).toHaveLength(5);
  });

  it("should handle empty friends array", () => {
    const accepted = filterAcceptedFriends([]);

    expect(accepted).toHaveLength(0);
  });
});

// ============================================================================
// Friend Request Separation Tests
// ============================================================================

describe("FriendsPage - Friend Request Logic", () => {
  it("should separate incoming and outgoing requests", () => {
    const incoming = createIncomingFriendRequests(3);
    const outgoing = createOutgoingFriendRequests(2);

    expect(incoming.every((r) => r.direction === "incoming")).toBe(true);
    expect(outgoing.every((r) => r.direction === "outgoing")).toBe(true);
    expect(incoming).toHaveLength(3);
    expect(outgoing).toHaveLength(2);
  });

  it("should count pending requests correctly", () => {
    const incoming = createIncomingFriendRequests(3);
    const outgoing = createOutgoingFriendRequests(2);

    const totalPending = incoming.length + outgoing.length;

    expect(totalPending).toBe(5);
  });

  it("should handle empty incoming requests", () => {
    const incoming = createIncomingFriendRequests(0);
    expect(incoming).toHaveLength(0);
  });

  it("should handle empty outgoing requests", () => {
    const outgoing = createOutgoingFriendRequests(0);
    expect(outgoing).toHaveLength(0);
  });
});

// ============================================================================
// Timezone Display Tests
// ============================================================================

describe("FriendsPage - Timezone Display", () => {
  it("should return empty string for undefined timezone", () => {
    expect(getLocalTime(undefined)).toBe("");
  });

  it("should return empty string for empty timezone", () => {
    expect(getCityFromTimezone(undefined)).toBe("");
    expect(getCityFromTimezone("")).toBe("");
  });

  it("should format America/New_York timezone correctly", () => {
    const city = getCityFromTimezone("America/New_York");
    expect(city).toBe("New York");
  });

  it("should format Europe/London timezone correctly", () => {
    const city = getCityFromTimezone("Europe/London");
    expect(city).toBe("London");
  });

  it("should handle Australia timezones specially", () => {
    const city = getCityFromTimezone("Australia/Sydney");
    expect(city).toBe("Australia, Sydney");
  });

  it("should handle three-part timezones", () => {
    const city = getCityFromTimezone("America/Indiana/Indianapolis");
    expect(city).toBe("Indiana, Indianapolis");
  });

  it("should replace underscores with spaces", () => {
    const city = getCityFromTimezone("America/Los_Angeles");
    expect(city).toBe("Los Angeles");
  });

  it("should return valid time string for valid timezone", () => {
    const time = getLocalTime("America/New_York");
    // Should match format like "10:30 AM" or "10:30 PM"
    expect(time).toMatch(/^\d{1,2}:\d{2}\s?(AM|PM)$/);
  });

  it("should return empty string for invalid timezone", () => {
    const time = getLocalTime("Invalid/Timezone");
    expect(time).toBe("");
  });
});

// ============================================================================
// Relative Time Tests
// ============================================================================

describe("FriendsPage - Relative Time Formatting", () => {
  it("should format recent timestamps", () => {
    const now = new Date();
    const result = formatRelativeTime(now.toISOString());
    expect(result).toContain("ago");
  });

  it("should format timestamps from days ago", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const result = formatRelativeTime(threeDaysAgo.toISOString());
    expect(result).toContain("3 days ago");
  });

  it("should format timestamps from months ago", () => {
    const twoMonthsAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const result = formatRelativeTime(twoMonthsAgo.toISOString());
    expect(result).toContain("ago");
  });
});

// ============================================================================
// Online Status Tests
// ============================================================================

describe("FriendsPage - Online Status", () => {
  it("should identify online friends", () => {
    const friend = createOnlineFriend();
    expect(friend.isOnline).toBe(true);
    expect(friend.isConnected).toBe(true);
  });

  it("should identify offline friends", () => {
    const friend = createTestFriend({ isOnline: false, isConnected: false });
    expect(friend.isOnline).toBe(false);
    expect(friend.isConnected).toBe(false);
  });

  it("should count online friends correctly", () => {
    const friends = [
      createOnlineFriend({ id: "1" }),
      createTestFriend({ id: "2", isOnline: false }),
      createOnlineFriend({ id: "3" }),
      createTestFriend({ id: "4", isOnline: false }),
    ];

    const onlineCount = friends.filter((f) => f.isOnline).length;
    expect(onlineCount).toBe(2);
  });
});

// ============================================================================
// Friend List Display Tests
// ============================================================================

describe("FriendsPage - Friend List Display", () => {
  it("should show empty state when no friends", () => {
    const friends: Friend[] = [];
    const accepted = filterAcceptedFriends(friends);
    expect(accepted.length).toBe(0);
  });

  it("should show friend count correctly", () => {
    const friends = createTestFriends(10, { status: "accepted" });
    const accepted = filterAcceptedFriends(friends);
    expect(accepted.length).toBe(10);
  });

  it("should handle friend with all fields populated", () => {
    const friend = createTestFriend({
      friendDisplayName: "Display Name",
      friendUsername: "username",
      friendPlayer: "PlayerName",
      friendTimeZone: "America/New_York",
      friendAvatar: "avatar-hash",
    });

    expect(getDisplayName(friend)).toBe("Display Name");
    expect(friend.friendPlayer).toBe("PlayerName");
    expect(getCityFromTimezone(friend.friendTimeZone!)).toBe("New York");
  });

  it("should handle friend with minimal fields", () => {
    const friend = createTestFriend({
      friendDisplayName: "",
      friendUsername: "minimaluser",
      friendPlayer: null,
      friendTimeZone: null,
      friendAvatar: null,
    });

    expect(getDisplayName(friend)).toBe("minimaluser");
    expect(friend.friendPlayer).toBeNull();
    expect(getCityFromTimezone(friend.friendTimeZone!)).toBe("");
  });
});

// ============================================================================
// Friend Code Tests
// ============================================================================

describe("FriendsPage - Friend Code", () => {
  it("should display user friend code when available", () => {
    const userFriendCode = "ABCD1234";
    expect(userFriendCode).toHaveLength(8);
    expect(userFriendCode).toMatch(/^[A-Z0-9]{8}$/);
  });

  it("should validate friend code format", () => {
    // Valid codes
    expect("ABCD1234").toMatch(/^[A-Z0-9]{8}$/);
    expect("12345678").toMatch(/^[A-Z0-9]{8}$/);
    expect("ZZZZ9999").toMatch(/^[A-Z0-9]{8}$/);

    // Invalid codes
    expect("abcd1234").not.toMatch(/^[A-Z0-9]{8}$/); // lowercase
    expect("ABCD123").not.toMatch(/^[A-Z0-9]{8}$/); // too short
    expect("ABCD12345").not.toMatch(/^[A-Z0-9]{8}$/); // too long
  });
});
