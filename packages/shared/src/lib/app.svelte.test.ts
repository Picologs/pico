/**
 * Tests for AppState class
 *
 * Tests state management, particularly the profile update functionality
 * and the fixes for usePlayerAsDisplayName setting.
 *
 * NOTE: Svelte 5 runes ($state, $derived, $effect) are mocked globally in test-setup.ts
 * Run tests with: bun test --preload ./test-setup.ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { AppState } from "./app.svelte";
import type { UserProfile } from "./types-centralized/core/user";

describe("AppState", () => {
  let appState: AppState;

  beforeEach(() => {
    appState = new AppState();
  });

  describe("setUser", () => {
    it("should replace user object entirely", () => {
      // Set initial user
      const initialUser: UserProfile = {
        id: "1",
        discordId: "123456",
        username: "InitialUser",
        player: "InitialPlayer",
        usePlayerAsDisplayName: true,
        showTimezone: true,
        friendCode: "ABC123",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      };
      appState.setUser(initialUser);
      expect(appState.user).toEqual(initialUser);

      // Update with new user (simulating profile update)
      const updatedUser: UserProfile = {
        id: "1",
        discordId: "123456",
        username: "UpdatedUser",
        player: "UpdatedPlayer",
        usePlayerAsDisplayName: false, // Changed from true to false
        showTimezone: false, // Changed from true to false
        friendCode: "ABC123",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-02T00:00:00Z",
      };
      appState.setUser(updatedUser);

      // Should be completely replaced (not merged)
      expect(appState.user).toEqual(updatedUser);
      expect(appState.user?.usePlayerAsDisplayName).toBe(false);
      expect(appState.user?.showTimezone).toBe(false);
    });

    it("should update usePlayerAsDisplayName when changed from true to false", () => {
      // Initial state: using player name
      const initialUser: UserProfile = {
        id: "1",
        discordId: "123456",
        username: "DiscordUser",
        player: "SpaceCommander",
        usePlayerAsDisplayName: true,
        friendCode: "ABC123",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      };
      appState.setUser(initialUser);
      expect(appState.user?.usePlayerAsDisplayName).toBe(true);

      // Update: changed to use username
      const updatedUser: UserProfile = {
        ...initialUser,
        usePlayerAsDisplayName: false,
        updatedAt: "2024-01-02T00:00:00Z",
      };
      appState.setUser(updatedUser);

      // CRITICAL: This tests the bug fix - usePlayerAsDisplayName should update
      expect(appState.user?.usePlayerAsDisplayName).toBe(false);
    });

    it("should update usePlayerAsDisplayName when changed from false to true", () => {
      // Initial state: using username
      const initialUser: UserProfile = {
        id: "1",
        discordId: "123456",
        username: "DiscordUser",
        player: "SpaceCommander",
        usePlayerAsDisplayName: false,
        friendCode: "ABC123",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      };
      appState.setUser(initialUser);
      expect(appState.user?.usePlayerAsDisplayName).toBe(false);

      // Update: changed to use player name
      const updatedUser: UserProfile = {
        ...initialUser,
        usePlayerAsDisplayName: true,
        updatedAt: "2024-01-02T00:00:00Z",
      };
      appState.setUser(updatedUser);

      expect(appState.user?.usePlayerAsDisplayName).toBe(true);
    });

    it("should handle null user", () => {
      appState.setUser(null);
      expect(appState.user).toBeNull();
    });

    it("should replace null user with actual user", () => {
      appState.setUser(null);
      expect(appState.user).toBeNull();

      const newUser: UserProfile = {
        id: "1",
        discordId: "123456",
        username: "NewUser",
        friendCode: "ABC123",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      };
      appState.setUser(newUser);
      expect(appState.user).toEqual(newUser);
    });

    it("should preserve all fields when updating", () => {
      const initialUser: UserProfile = {
        id: "1",
        discordId: "123456",
        username: "User",
        avatar: "avatar-hash",
        player: "Player",
        timeZone: "America/New_York",
        showTimezone: true,
        usePlayerAsDisplayName: false,
        friendCode: "ABC123",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      };
      appState.setUser(initialUser);

      const updatedUser: UserProfile = {
        ...initialUser,
        player: "UpdatedPlayer",
        usePlayerAsDisplayName: true,
        updatedAt: "2024-01-02T00:00:00Z",
      };
      appState.setUser(updatedUser);

      expect(appState.user).toEqual(updatedUser);
      expect(appState.user?.avatar).toBe("avatar-hash");
      expect(appState.user?.timeZone).toBe("America/New_York");
      expect(appState.user?.friendCode).toBe("ABC123");
    });
  });

  describe("updateProfile", () => {
    it("should throw error if sendRequest is not initialized", async () => {
      const profileData = {
        player: "NewPlayer",
        timeZone: "America/New_York",
        usePlayerAsDisplayName: true,
      };

      await expect(appState.updateProfile(profileData)).rejects.toThrow(
        "WebSocket not initialized",
      );
    });

    it("should send request with correct data", async () => {
      const profileData = {
        player: "NewPlayer",
        timeZone: "America/New_York",
        usePlayerAsDisplayName: true,
        showTimezone: false,
      };

      const mockSendRequest = vi.fn().mockResolvedValue({
        id: "1",
        discordId: "123456",
        username: "User",
        player: "NewPlayer",
        timeZone: "America/New_York",
        usePlayerAsDisplayName: true,
        showTimezone: false,
        friendCode: "ABC123",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-02T00:00:00Z",
      });

      appState.sendRequest = mockSendRequest;

      await appState.updateProfile(profileData);

      expect(mockSendRequest).toHaveBeenCalledWith(
        "update_user_profile",
        profileData,
      );
    });

    it("should update local user state on successful profile update", async () => {
      const initialUser: UserProfile = {
        id: "1",
        discordId: "123456",
        username: "User",
        player: "OldPlayer",
        usePlayerAsDisplayName: false,
        showTimezone: true,
        friendCode: "ABC123",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      };
      appState.user = initialUser;

      const profileData = {
        player: "NewPlayer",
        timeZone: "America/Los_Angeles",
        usePlayerAsDisplayName: true,
        showTimezone: false,
      };

      const responseUser: UserProfile = {
        id: "1",
        discordId: "123456",
        username: "User",
        player: "NewPlayer",
        timeZone: "America/Los_Angeles",
        usePlayerAsDisplayName: true,
        showTimezone: false,
        friendCode: "ABC123",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-02T00:00:00Z",
      };

      const mockSendRequest = vi.fn().mockResolvedValue(responseUser);
      appState.sendRequest = mockSendRequest;

      await appState.updateProfile(profileData);

      // CRITICAL: Tests the bug fix - local state should be updated
      expect(appState.user?.player).toBe("NewPlayer");
      expect(appState.user?.usePlayerAsDisplayName).toBe(true);
      expect(appState.user?.showTimezone).toBe(false);
      expect(appState.user?.timeZone).toBe("America/Los_Angeles");
    });

    it("should handle errors and rethrow", async () => {
      const profileData = {
        player: "NewPlayer",
        timeZone: "America/New_York",
        usePlayerAsDisplayName: true,
      };

      const mockSendRequest = vi
        .fn()
        .mockRejectedValue(new Error("Network error"));
      appState.sendRequest = mockSendRequest;

      // Set initial user so we can verify it doesn't change on error
      const initialUser: UserProfile = {
        id: "1",
        discordId: "123456",
        username: "User",
        player: "OldPlayer",
        usePlayerAsDisplayName: false,
        friendCode: "ABC123",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      };
      appState.user = initialUser;

      await expect(appState.updateProfile(profileData)).rejects.toThrow(
        "Network error",
      );

      // User state should remain unchanged on error
      expect(appState.user?.player).toBe("OldPlayer");
      expect(appState.user?.usePlayerAsDisplayName).toBe(false);
    });

    it("should not update user state if user is null", async () => {
      appState.user = null;

      const profileData = {
        player: "NewPlayer",
        timeZone: "America/New_York",
        usePlayerAsDisplayName: true,
      };

      const responseUser: UserProfile = {
        id: "1",
        discordId: "123456",
        username: "User",
        player: "NewPlayer",
        usePlayerAsDisplayName: true,
        friendCode: "ABC123",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-02T00:00:00Z",
      };

      const mockSendRequest = vi.fn().mockResolvedValue(responseUser);
      appState.sendRequest = mockSendRequest;

      await appState.updateProfile(profileData);

      // User should remain null (no update if no existing user)
      expect(appState.user).toBeNull();
    });

    it("should not update user state if response is null", async () => {
      const initialUser: UserProfile = {
        id: "1",
        discordId: "123456",
        username: "User",
        player: "OldPlayer",
        friendCode: "ABC123",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      };
      appState.user = initialUser;

      const profileData = {
        player: "NewPlayer",
        timeZone: "America/New_York",
        usePlayerAsDisplayName: true,
      };

      const mockSendRequest = vi.fn().mockResolvedValue(null);
      appState.sendRequest = mockSendRequest;

      await appState.updateProfile(profileData);

      // User should remain unchanged
      expect(appState.user).toEqual(initialUser);
    });
  });

  describe("displayName $derived", () => {
    it("should derive display name from user", () => {
      const user: UserProfile = {
        id: "1",
        discordId: "123456",
        username: "DiscordUser",
        player: "SpaceCommander",
        usePlayerAsDisplayName: false,
        friendCode: "ABC123",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      };
      appState.user = user;

      // Note: $derived reactivity can't be easily tested without a Svelte component context
      // This would need to be tested in a component test or E2E test
      // For now, we verify the underlying getDisplayName logic is correct via display-name.test.ts
    });
  });

  describe("deleteProfile", () => {
    it("should throw error if sendRequest is not initialized", async () => {
      await expect(appState.deleteProfile()).rejects.toThrow(
        "WebSocket not initialized",
      );
    });

    it("should send delete request", async () => {
      const mockSendRequest = vi.fn().mockResolvedValue(undefined);
      appState.sendRequest = mockSendRequest;

      await appState.deleteProfile();

      expect(mockSendRequest).toHaveBeenCalledWith("delete_user_profile");
    });

    it("should handle delete errors and rethrow", async () => {
      const mockSendRequest = vi
        .fn()
        .mockRejectedValue(new Error("Delete failed"));
      appState.sendRequest = mockSendRequest;

      await expect(appState.deleteProfile()).rejects.toThrow("Delete failed");
    });
  });

  describe("addFriend - Bug #2: Double friends fix", () => {
    it("should prevent duplicate friends by friendship ID", () => {
      const friend = {
        id: "friendship-123",
        status: "accepted",
        createdAt: "2024-01-01T00:00:00Z",
        friendUserId: "user-456",
        friendDiscordId: "discord-789",
        friendUsername: "TestUser",
        friendDisplayName: "Test User",
        friendAvatar: null,
        friendPlayer: null,
        friendTimeZone: null,
        friendUsePlayerAsDisplayName: false,
        isOnline: false,
      };

      // Add friend first time
      appState.addFriend(friend);
      expect(appState.friends.length).toBe(1);

      // Try to add the same friend again (should be prevented)
      appState.addFriend(friend);
      expect(appState.friends.length).toBe(1);
    });

    it("should prevent duplicate friends by Discord ID", () => {
      const friend1 = {
        id: "friendship-123",
        status: "accepted",
        createdAt: "2024-01-01T00:00:00Z",
        friendUserId: "user-456",
        friendDiscordId: "discord-789",
        friendUsername: "TestUser",
        friendDisplayName: "Test User",
        friendAvatar: null,
        friendPlayer: null,
        friendTimeZone: null,
        friendUsePlayerAsDisplayName: false,
        isOnline: false,
      };

      const friend2 = {
        ...friend1,
        id: "friendship-456", // Different friendship ID
        isOnline: true, // Different online status
      };

      // Add friend first time
      appState.addFriend(friend1);
      expect(appState.friends.length).toBe(1);

      // Try to add the same Discord user with different friendship ID (should be prevented)
      appState.addFriend(friend2);
      expect(appState.friends.length).toBe(1);

      // Verify the original friend is still there (not replaced)
      expect(appState.friends[0].id).toBe("friendship-123");
    });

    it("should allow different friends with different IDs and Discord IDs", () => {
      const friend1 = {
        id: "friendship-123",
        status: "accepted",
        createdAt: "2024-01-01T00:00:00Z",
        friendUserId: "user-456",
        friendDiscordId: "discord-789",
        friendUsername: "TestUser1",
        friendDisplayName: "Test User 1",
        friendAvatar: null,
        friendPlayer: null,
        friendTimeZone: null,
        friendUsePlayerAsDisplayName: false,
        isOnline: false,
      };

      const friend2 = {
        id: "friendship-456",
        status: "accepted",
        createdAt: "2024-01-01T00:00:00Z",
        friendUserId: "user-789",
        friendDiscordId: "discord-999",
        friendUsername: "TestUser2",
        friendDisplayName: "Test User 2",
        friendAvatar: null,
        friendPlayer: null,
        friendTimeZone: null,
        friendUsePlayerAsDisplayName: false,
        isOnline: true,
      };

      appState.addFriend(friend1);
      appState.addFriend(friend2);

      expect(appState.friends.length).toBe(2);
      expect(appState.friends[0].friendDiscordId).toBe("discord-789");
      expect(appState.friends[1].friendDiscordId).toBe("discord-999");
    });

    it("should handle the double friend scenario from Bug #2", () => {
      // Simulate the bug scenario:
      // 1. User accepts friend request -> response handler adds friend
      // 2. Broadcast notification arrives -> broadcast handler tries to add same friend

      const friendFromResponse = {
        id: "friendship-123",
        status: "accepted",
        createdAt: "2024-01-01T00:00:00Z",
        friendUserId: "user-456",
        friendDiscordId: "discord-789",
        friendUsername: "NewFriend",
        friendDisplayName: "New Friend",
        friendAvatar: null,
        friendPlayer: null,
        friendTimeZone: null,
        friendUsePlayerAsDisplayName: false,
        isOnline: false,
      };

      const friendFromBroadcast = {
        id: "friendship-123",
        status: "accepted",
        createdAt: "2024-01-01T00:00:00Z",
        friendUserId: "user-456",
        friendDiscordId: "discord-789",
        friendUsername: "NewFriend",
        friendDisplayName: "New Friend",
        friendAvatar: null,
        friendPlayer: null,
        friendTimeZone: null,
        friendUsePlayerAsDisplayName: false,
        isOnline: true, // Broadcast might have updated online status
      };

      // First addition (from response)
      appState.addFriend(friendFromResponse);
      expect(appState.friends.length).toBe(1);

      // Second addition (from broadcast) - should be prevented
      appState.addFriend(friendFromBroadcast);
      expect(appState.friends.length).toBe(1);

      // Friend should still exist
      expect(appState.friends[0].friendDiscordId).toBe("discord-789");
    });
  });

  describe("Toast Management", () => {
    it("should add toast with correct properties", () => {
      appState.addToast("Test message", "success");

      expect(appState.toasts.length).toBe(1);
      expect(appState.toasts[0].message).toBe("Test message");
      expect(appState.toasts[0].type).toBe("success");
      expect(appState.toasts[0].id).toBeDefined();
    });

    it("should add toast with default type of info", () => {
      appState.addToast("Info message");

      expect(appState.toasts[0].type).toBe("info");
    });

    it("should add toast with custom icon option", () => {
      appState.addToast("Custom toast", "info", { customIcon: "🚀" });

      expect(appState.toasts[0].customIcon).toBe("🚀");
    });

    it("should add toast with avatar URL option", () => {
      appState.addToast("Avatar toast", "info", {
        avatarUrl: "https://example.com/avatar.png",
      });

      expect(appState.toasts[0].avatarUrl).toBe(
        "https://example.com/avatar.png",
      );
    });

    it("should add toast with autoDismiss option", () => {
      appState.addToast("No dismiss toast", "error", { autoDismiss: false });

      expect(appState.toasts[0].autoDismiss).toBe(false);
    });

    it("should default autoDismiss to true", () => {
      appState.addToast("Default dismiss toast", "success");

      expect(appState.toasts[0].autoDismiss).toBe(true);
    });

    it("should generate unique IDs for each toast", () => {
      appState.addToast("First toast", "info");
      appState.addToast("Second toast", "info");

      expect(appState.toasts[0].id).not.toBe(appState.toasts[1].id);
    });

    it("should remove toast by ID", () => {
      appState.addToast("Toast to remove", "info");
      const toastId = appState.toasts[0].id;

      appState.removeToast(toastId);

      expect(appState.toasts.length).toBe(0);
    });

    it("should only remove specified toast", () => {
      appState.addToast("First", "info");
      appState.addToast("Second", "info");
      const firstId = appState.toasts[0].id;

      appState.removeToast(firstId);

      expect(appState.toasts.length).toBe(1);
      expect(appState.toasts[0].message).toBe("Second");
    });

    it("should clear all toasts", () => {
      appState.addToast("First", "info");
      appState.addToast("Second", "success");
      appState.addToast("Third", "error");

      appState.clearToasts();

      expect(appState.toasts.length).toBe(0);
    });

    it("should handle clearing empty toasts array", () => {
      appState.clearToasts();

      expect(appState.toasts.length).toBe(0);
    });
  });

  describe("Group Management", () => {
    it("should add group with members array", () => {
      const group = {
        id: "group-123",
        name: "Test Group",
        ownerId: "user-123",
        createdAt: "2024-01-01T00:00:00Z",
        members: [],
      };

      appState.addGroup(group);

      expect(appState.groups.length).toBe(1);
      expect(appState.groups[0].name).toBe("Test Group");
      expect(appState.groups[0].members).toEqual([]);
    });

    it("should initialize empty members array if not provided", () => {
      const group = {
        id: "group-123",
        name: "Test Group",
        ownerId: "user-123",
        createdAt: "2024-01-01T00:00:00Z",
      };

      appState.addGroup(group as any);

      expect(appState.groups[0].members).toEqual([]);
    });

    it("should remove group by ID", () => {
      const group = {
        id: "group-123",
        name: "Test Group",
        ownerId: "user-123",
        createdAt: "2024-01-01T00:00:00Z",
        members: [],
      };

      appState.addGroup(group);
      appState.removeGroup("group-123");

      expect(appState.groups.length).toBe(0);
    });

    it("should update group data", () => {
      const group = {
        id: "group-123",
        name: "Original Name",
        ownerId: "user-123",
        createdAt: "2024-01-01T00:00:00Z",
        members: [],
      };

      appState.addGroup(group);
      appState.updateGroup("group-123", { name: "Updated Name" });

      expect(appState.groups[0].name).toBe("Updated Name");
    });

    it("should preserve members when updating group", () => {
      const group = {
        id: "group-123",
        name: "Test Group",
        ownerId: "user-123",
        createdAt: "2024-01-01T00:00:00Z",
        members: [
          { id: "member-1", discordId: "discord-1", username: "User1" },
        ],
      };

      appState.addGroup(group as any);
      appState.updateGroup("group-123", { name: "New Name" });

      expect(appState.groups[0].members?.length).toBe(1);
    });
  });

  describe("Group Invitations", () => {
    it("should derive group invitations from notifications", () => {
      const notification = {
        id: "notif-123",
        type: "group_invitation",
        userId: "user-123",
        read: false,
        createdAt: "2024-01-01T00:00:00Z",
        data: {
          invitationId: "invite-123",
          groupId: "group-456",
          groupName: "Star Runners",
          groupAvatar: null,
          inviterId: "inviter-789",
          inviterUsername: "InviterUser",
          inviterDisplayName: "Inviter",
          inviterAvatar: null,
        },
      };

      appState.setNotifications([notification as any]);

      expect(appState.groupInvitations.length).toBe(1);
      expect(appState.groupInvitations[0].group.name).toBe("Star Runners");
      expect(appState.groupInvitations[0].inviterUsername).toBe("InviterUser");
    });

    it("should filter only group_invitation type notifications", () => {
      const notifications = [
        {
          id: "notif-1",
          type: "group_invitation",
          userId: "user-123",
          read: false,
          createdAt: "2024-01-01T00:00:00Z",
          data: {
            invitationId: "invite-1",
            groupId: "group-1",
            groupName: "Group 1",
            inviterId: "inviter-1",
            inviterUsername: "Inviter1",
            inviterDisplayName: "Inviter 1",
          },
        },
        {
          id: "notif-2",
          type: "friend_request",
          userId: "user-123",
          read: false,
          createdAt: "2024-01-01T00:00:00Z",
          data: {},
        },
      ];

      appState.setNotifications(notifications as any);

      expect(appState.groupInvitations.length).toBe(1);
      expect(appState.groupInvitations[0].id).toBe("invite-1");
    });

    it("should return empty array when no group invitations", () => {
      appState.setNotifications([]);

      expect(appState.groupInvitations).toEqual([]);
    });
  });

  describe("All Pending Join Requests", () => {
    it("should return empty array when no pending requests", () => {
      expect(appState.allPendingJoinRequests).toEqual([]);
    });

    it("should flatten requests from multiple groups", () => {
      const request1 = {
        id: "req-1",
        groupId: "group-1",
        groupName: "Group 1",
        groupAvatar: null,
        userId: "user-1",
        username: "user1",
        displayName: "User 1",
        avatar: null,
        status: "pending" as const,
        createdAt: "2024-01-01T00:00:00Z",
      };
      const request2 = {
        id: "req-2",
        groupId: "group-1",
        groupName: "Group 1",
        groupAvatar: null,
        userId: "user-2",
        username: "user2",
        displayName: "User 2",
        avatar: null,
        status: "pending" as const,
        createdAt: "2024-01-02T00:00:00Z",
      };
      const request3 = {
        id: "req-3",
        groupId: "group-2",
        groupName: "Group 2",
        groupAvatar: null,
        userId: "user-3",
        username: "user3",
        displayName: "User 3",
        avatar: null,
        status: "pending" as const,
        createdAt: "2024-01-03T00:00:00Z",
      };

      appState.pendingJoinRequests.set("group-1", [request1, request2]);
      appState.pendingJoinRequests.set("group-2", [request3]);

      expect(appState.allPendingJoinRequests).toHaveLength(3);
    });

    it("should sort by createdAt descending (newest first)", () => {
      const older = {
        id: "req-old",
        groupId: "group-1",
        groupName: "Group 1",
        groupAvatar: null,
        userId: "user-1",
        username: "user1",
        displayName: "User 1",
        avatar: null,
        status: "pending" as const,
        createdAt: "2024-01-01T00:00:00Z",
      };
      const newer = {
        id: "req-new",
        groupId: "group-1",
        groupName: "Group 1",
        groupAvatar: null,
        userId: "user-2",
        username: "user2",
        displayName: "User 2",
        avatar: null,
        status: "pending" as const,
        createdAt: "2024-01-02T00:00:00Z",
      };

      appState.pendingJoinRequests.set("group-1", [older, newer]);

      expect(appState.allPendingJoinRequests[0].id).toBe("req-new");
      expect(appState.allPendingJoinRequests[1].id).toBe("req-old");
    });

    it("should clear after resetting pendingJoinRequests map", () => {
      const request = {
        id: "req-1",
        groupId: "group-1",
        groupName: "Group 1",
        groupAvatar: null,
        userId: "user-1",
        username: "user1",
        displayName: "User 1",
        avatar: null,
        status: "pending" as const,
        createdAt: "2024-01-01T00:00:00Z",
      };

      appState.pendingJoinRequests.set("group-1", [request]);
      expect(appState.allPendingJoinRequests).toHaveLength(1);

      appState.pendingJoinRequests = new Map();
      expect(appState.allPendingJoinRequests).toEqual([]);
    });
  });

  describe("Notification Management", () => {
    it("should add notification", () => {
      const notification = {
        id: "notif-123",
        type: "friend_request",
        userId: "user-123",
        read: false,
        createdAt: "2024-01-01T00:00:00Z",
        data: {},
      };

      appState.addNotification(notification as any);

      expect(appState.notifications.length).toBe(1);
    });

    it("should mark notification as read", () => {
      const notification = {
        id: "notif-123",
        type: "friend_request",
        userId: "user-123",
        read: false,
        createdAt: "2024-01-01T00:00:00Z",
        data: {},
      };

      appState.addNotification(notification as any);
      appState.markNotificationRead("notif-123");

      expect(appState.notifications[0].read).toBe(true);
    });

    it("should remove notification", () => {
      const notification = {
        id: "notif-123",
        type: "friend_request",
        userId: "user-123",
        read: false,
        createdAt: "2024-01-01T00:00:00Z",
        data: {},
      };

      appState.addNotification(notification as any);
      appState.removeNotification("notif-123");

      expect(appState.notifications.length).toBe(0);
    });

    it("should clear all notifications", () => {
      appState.addNotification({ id: "n1" } as any);
      appState.addNotification({ id: "n2" } as any);

      appState.clearNotifications();

      expect(appState.notifications.length).toBe(0);
    });

    it("should calculate unread count", () => {
      appState.setNotifications([
        { id: "n1", read: false },
        { id: "n2", read: true },
        { id: "n3", read: false },
      ] as any);

      expect(appState.unreadCount).toBe(2);
    });
  });

  describe("Log Management", () => {
    it("should add single log", () => {
      const log = {
        id: "log-1",
        userId: "user-123",
        line: "Test log entry",
        timestamp: "2024-01-01T00:00:00Z",
      };

      appState.addLog(log as any);

      expect(appState.logs.length).toBe(1);
      expect(appState.logs[0].line).toBe("Test log entry");
    });

    it("should add multiple logs with deduplication", () => {
      const logs = [
        {
          id: "log-1",
          userId: "user-123",
          line: "Log 1",
          timestamp: "2024-01-01T00:00:01Z",
        },
        {
          id: "log-2",
          userId: "user-123",
          line: "Log 2",
          timestamp: "2024-01-01T00:00:02Z",
        },
      ];

      appState.addLogs(logs as any);

      expect(appState.logs.length).toBe(2);
    });

    it("should clear all logs", () => {
      appState.addLog({ id: "log-1", line: "Test" } as any);
      appState.clearLogs();

      expect(appState.logs.length).toBe(0);
    });

    it("should set logs directly", () => {
      const logs = [
        { id: "log-1", line: "Log 1" },
        { id: "log-2", line: "Log 2" },
      ];

      appState.setLogs(logs as any);

      expect(appState.logs.length).toBe(2);
    });
  });

  describe("Connection Status", () => {
    it("should set connection status", () => {
      appState.setConnectionStatus("connected");
      expect(appState.connectionStatus).toBe("connected");

      appState.setConnectionStatus("disconnected");
      expect(appState.connectionStatus).toBe("disconnected");

      appState.setConnectionStatus("connecting");
      expect(appState.connectionStatus).toBe("connecting");

      appState.setConnectionStatus("error");
      expect(appState.connectionStatus).toBe("error");
    });
  });

  describe("State Reset", () => {
    it("should reset all state on logout", () => {
      // Setup some state
      appState.setUser({
        id: "1",
        discordId: "123",
        username: "Test",
        friendCode: "ABC",
        createdAt: "2024-01-01",
        updatedAt: "2024-01-01",
      });
      appState.addToast("Test", "info");
      appState.addNotification({ id: "n1" } as any);
      appState.addLog({ id: "log-1" } as any);

      appState.reset();

      expect(appState.user).toBeNull();
      expect(appState.toasts.length).toBe(0);
      expect(appState.notifications.length).toBe(0);
      expect(appState.logs.length).toBe(0);
      expect(appState.connectionStatus).toBe("disconnected");
    });
  });
});
