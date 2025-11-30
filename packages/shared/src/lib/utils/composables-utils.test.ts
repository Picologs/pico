/**
 * Composables Utilities Tests
 *
 * Tests for pure utility functions shared between layout composables.
 */

import { describe, it, expect } from "vitest";
import {
  transformFriendFromAPI,
  updateFriendOnlineStatus,
  updateGroupMemberOnlineStatus,
  copyTextToClipboard,
} from "./composables-utils";
import type { Friend, GroupMember } from "@pico/types";

describe("transformFriendFromAPI", () => {
  it("should transform API friend data to Friend format", () => {
    const apiFriend = {
      id: "friend-123",
      status: "accepted",
      createdAt: "2025-01-15T12:00:00.000Z",
      friendUserId: "user-456",
      friendDiscordId: "789012345",
      friendUsername: "john_doe",
      friendDisplayName: "John Doe",
      friendAvatar: "avatar.png",
      friendPlayer: "PlayerJohn",
      friendTimeZone: "America/New_York",
      friendUsePlayerAsDisplayName: true,
      friendCode: "ABC123",
    };

    const result = transformFriendFromAPI(apiFriend);

    expect(result.id).toBe("friend-123");
    expect(result.status).toBe("accepted");
    expect(result.createdAt).toBe("2025-01-15T12:00:00.000Z");
    expect(result.friendUserId).toBe("user-456");
    expect(result.friendDiscordId).toBe("789012345");
    expect(result.friendUsername).toBe("john_doe");
    expect(result.friendDisplayName).toBe("John Doe");
    expect(result.friendAvatar).toBe("avatar.png");
    expect(result.friendPlayer).toBe("PlayerJohn");
    expect(result.friendTimeZone).toBe("America/New_York");
    expect(result.friendUsePlayerAsDisplayName).toBe(true);
    expect(result.friendCode).toBe("ABC123");
    expect(result.isOnline).toBe(false);
    expect(result.isConnected).toBe(false);
  });

  it("should use username as displayName fallback", () => {
    const apiFriend = {
      friendUserId: "user-123",
      friendDiscordId: "456",
      friendUsername: "fallback_user",
      // friendDisplayName is missing
    };

    const result = transformFriendFromAPI(apiFriend);

    expect(result.friendDisplayName).toBe("fallback_user");
  });

  it("should use default values for missing optional fields", () => {
    const apiFriend = {
      friendUserId: "user-123",
      friendDiscordId: "456",
      friendUsername: "minimal_user",
    };

    const result = transformFriendFromAPI(apiFriend);

    expect(result.status).toBe("accepted");
    expect(result.friendPlayer).toBeNull();
    expect(result.friendTimeZone).toBeNull();
    expect(result.friendUsePlayerAsDisplayName).toBe(false);
    expect(result.friendCode).toBeNull();
    expect(result.isOnline).toBe(false);
    expect(result.isConnected).toBe(false);
  });

  it("should set createdAt to current date if missing", () => {
    const apiFriend = {
      friendUserId: "user-123",
      friendDiscordId: "456",
      friendUsername: "test_user",
    };

    const beforeCall = new Date().toISOString();
    const result = transformFriendFromAPI(apiFriend);
    const afterCall = new Date().toISOString();

    // Should be between before and after call timestamps
    expect(result.createdAt).toBeDefined();
    expect(result.createdAt >= beforeCall).toBe(true);
    expect(result.createdAt <= afterCall).toBe(true);
  });

  it("should always set isOnline and isConnected to false", () => {
    const apiFriend = {
      friendUserId: "user-123",
      friendDiscordId: "456",
      friendUsername: "test_user",
      isOnline: true, // Even if provided, should be overridden
      isConnected: true,
    };

    const result = transformFriendFromAPI(apiFriend);

    expect(result.isOnline).toBe(false);
    expect(result.isConnected).toBe(false);
  });
});

describe("updateFriendOnlineStatus", () => {
  const mockFriends: Friend[] = [
    {
      id: "1",
      status: "accepted",
      createdAt: "2025-01-15T12:00:00.000Z",
      friendUserId: "user-1",
      friendDiscordId: "111",
      friendUsername: "user1",
      friendDisplayName: "User One",
      friendAvatar: null,
      friendPlayer: null,
      friendTimeZone: null,
      friendUsePlayerAsDisplayName: false,
      friendCode: null,
      isOnline: false,
      isConnected: false,
    },
    {
      id: "2",
      status: "accepted",
      createdAt: "2025-01-15T12:00:00.000Z",
      friendUserId: "user-2",
      friendDiscordId: "222",
      friendUsername: "user2",
      friendDisplayName: "User Two",
      friendAvatar: null,
      friendPlayer: null,
      friendTimeZone: null,
      friendUsePlayerAsDisplayName: false,
      friendCode: null,
      isOnline: false,
      isConnected: false,
    },
  ];

  it("should update friend online status", () => {
    const result = updateFriendOnlineStatus(mockFriends, "111", true);

    expect(result[0].isOnline).toBe(true);
    expect(result[1].isOnline).toBe(false);
  });

  it("should not mutate original array", () => {
    const original = [...mockFriends];
    const result = updateFriendOnlineStatus(mockFriends, "111", true);

    expect(result).not.toBe(mockFriends);
    expect(mockFriends[0].isOnline).toBe(false); // Original unchanged
    expect(result[0].isOnline).toBe(true); // New array updated
  });

  it("should return original array if friend not found", () => {
    const result = updateFriendOnlineStatus(mockFriends, "nonexistent", true);

    expect(result).toBe(mockFriends);
  });

  it("should update status to offline", () => {
    const onlineFriends = mockFriends.map((f) => ({ ...f, isOnline: true }));
    const result = updateFriendOnlineStatus(onlineFriends, "222", false);

    expect(result[1].isOnline).toBe(false);
    expect(result[0].isOnline).toBe(true); // Other friend unchanged
  });

  it("should handle empty friends list", () => {
    const result = updateFriendOnlineStatus([], "111", true);

    expect(result).toEqual([]);
  });

  it("should preserve all other friend properties", () => {
    const result = updateFriendOnlineStatus(mockFriends, "111", true);
    const updatedFriend = result[0];

    expect(updatedFriend.id).toBe("1");
    expect(updatedFriend.friendUsername).toBe("user1");
    expect(updatedFriend.friendDisplayName).toBe("User One");
    expect(updatedFriend.friendDiscordId).toBe("111");
  });
});

describe("updateGroupMemberOnlineStatus", () => {
  const mockMember1: GroupMember = {
    id: "member-1",
    userId: "user-1",
    groupId: "group-1",
    discordId: "111",
    username: "user1",
    displayName: "User One",
    avatar: null,
    player: null,
    timeZone: null,
    usePlayerAsDisplayName: false,
    role: "member",
    joinedAt: "2025-01-15T12:00:00.000Z",
    isOnline: false,
    isConnected: false,
  };

  const mockMember2: GroupMember = {
    id: "member-2",
    userId: "user-2",
    groupId: "group-1",
    discordId: "222",
    username: "user2",
    displayName: "User Two",
    avatar: null,
    player: null,
    timeZone: null,
    usePlayerAsDisplayName: false,
    role: "member",
    joinedAt: "2025-01-15T12:00:00.000Z",
    isOnline: false,
    isConnected: false,
  };

  it("should update member online status", () => {
    const groupMembers = new Map([["group-1", [mockMember1, mockMember2]]]);

    const result = updateGroupMemberOnlineStatus(
      groupMembers,
      "group-1",
      "111",
      true,
    );

    const members = result.get("group-1")!;
    expect(members[0].isOnline).toBe(true);
    expect(members[0].isConnected).toBe(true);
    expect(members[1].isOnline).toBe(false);
  });

  it("should not mutate original map", () => {
    const groupMembers = new Map([["group-1", [mockMember1, mockMember2]]]);

    const result = updateGroupMemberOnlineStatus(
      groupMembers,
      "group-1",
      "111",
      true,
    );

    expect(result).not.toBe(groupMembers);
    expect(groupMembers.get("group-1")![0].isOnline).toBe(false); // Original unchanged
    expect(result.get("group-1")![0].isOnline).toBe(true); // New map updated
  });

  it("should return original map if group not found", () => {
    const groupMembers = new Map([["group-1", [mockMember1]]]);

    const result = updateGroupMemberOnlineStatus(
      groupMembers,
      "nonexistent",
      "111",
      true,
    );

    expect(result).toBe(groupMembers);
  });

  it("should return original map if member not found", () => {
    const groupMembers = new Map([["group-1", [mockMember1]]]);

    const result = updateGroupMemberOnlineStatus(
      groupMembers,
      "group-1",
      "nonexistent",
      true,
    );

    expect(result).toBe(groupMembers);
  });

  it("should sync isOnline and isConnected", () => {
    const groupMembers = new Map([["group-1", [mockMember1]]]);

    const result = updateGroupMemberOnlineStatus(
      groupMembers,
      "group-1",
      "111",
      true,
    );
    const member = result.get("group-1")![0];

    expect(member.isOnline).toBe(true);
    expect(member.isConnected).toBe(true);

    const result2 = updateGroupMemberOnlineStatus(
      result,
      "group-1",
      "111",
      false,
    );
    const member2 = result2.get("group-1")![0];

    expect(member2.isOnline).toBe(false);
    expect(member2.isConnected).toBe(false);
  });

  it("should handle empty map", () => {
    const groupMembers = new Map<string, GroupMember[]>();

    const result = updateGroupMemberOnlineStatus(
      groupMembers,
      "group-1",
      "111",
      true,
    );

    expect(result).toBe(groupMembers);
    expect(result.size).toBe(0);
  });

  it("should preserve all other member properties", () => {
    const groupMembers = new Map([["group-1", [mockMember1]]]);

    const result = updateGroupMemberOnlineStatus(
      groupMembers,
      "group-1",
      "111",
      true,
    );
    const member = result.get("group-1")![0];

    expect(member.id).toBe("member-1");
    expect(member.username).toBe("user1");
    expect(member.displayName).toBe("User One");
    expect(member.role).toBe("member");
  });
});

describe("copyTextToClipboard", () => {
  // Note: navigator.clipboard may not be available in test environment
  // These tests verify the API is called correctly, but may fail without proper mocking

  it("should call navigator.clipboard.writeText", async () => {
    // Mock navigator.clipboard if not available
    const originalClipboard = navigator.clipboard;
    const mockWriteText = async (text: string) => {
      expect(text).toBe("test content");
    };

    if (!navigator.clipboard) {
      (globalThis.navigator as any).clipboard = {
        writeText: mockWriteText,
      };
    } else {
      navigator.clipboard.writeText = mockWriteText;
    }

    await copyTextToClipboard("test content");

    // Restore original clipboard
    if (!originalClipboard) {
      delete (globalThis.navigator as any).clipboard;
    } else {
      navigator.clipboard = originalClipboard;
    }
  });

  it("should handle empty string", async () => {
    const mockWriteText = async (text: string) => {
      expect(text).toBe("");
    };

    const originalClipboard = navigator.clipboard;
    if (!navigator.clipboard) {
      (globalThis.navigator as any).clipboard = {
        writeText: mockWriteText,
      };
    } else {
      navigator.clipboard.writeText = mockWriteText;
    }

    await copyTextToClipboard("");

    if (!originalClipboard) {
      delete (globalThis.navigator as any).clipboard;
    } else {
      navigator.clipboard = originalClipboard;
    }
  });
});
