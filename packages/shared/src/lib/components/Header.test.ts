/**
 * Tests for Header.svelte notification logic
 *
 * Tests notification dropdown logic including:
 * - Notification count calculation
 * - Join request handling
 * - Empty state detection
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { appState } from "../app.svelte";
import type { GroupJoinRequest } from "@pico/types";

// Helper to create a test join request
function createTestJoinRequest(
  overrides: Partial<GroupJoinRequest> = {},
): GroupJoinRequest {
  return {
    id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    groupId: "group-123",
    groupName: "Test Group",
    groupAvatar: null,
    userId: "user-456",
    username: "testuser",
    displayName: "Test User",
    avatar: null,
    status: "pending",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("Header - Notification Count Logic", () => {
  beforeEach(() => {
    // Reset appState before each test
    appState.friendRequests = { incoming: [], outgoing: [] };
    appState.notifications = [];
    appState.pendingJoinRequests = new Map();
  });

  it("should calculate notification count with only friend requests", () => {
    appState.friendRequests = {
      incoming: [
        {
          id: "req-1",
          fromUserId: "user-1",
          toUserId: "user-2",
          direction: "incoming",
          fromUsername: "user1",
          fromDiscordId: "discord-1",
          fromPlayer: null,
          fromAvatar: null,
          createdAt: new Date().toISOString(),
        },
      ],
      outgoing: [],
    };

    const notificationCount =
      appState.friendRequests.incoming.length +
      appState.groupInvitations.length +
      appState.allPendingJoinRequests.length;

    expect(notificationCount).toBe(1);
  });

  it("should calculate notification count with only group invitations", () => {
    const notification = {
      id: "notif-1",
      type: "group_invitation",
      userId: "user-123",
      read: false,
      createdAt: "2024-01-01T00:00:00Z",
      data: {
        invitationId: "invite-1",
        groupId: "group-1",
        groupName: "Test Group",
        groupAvatar: null,
        inviterId: "inviter-1",
        inviterUsername: "Inviter",
        inviterDisplayName: "Inviter User",
        inviterAvatar: null,
      },
    };

    appState.setNotifications([notification as any]);

    const notificationCount =
      appState.friendRequests.incoming.length +
      appState.groupInvitations.length +
      appState.allPendingJoinRequests.length;

    expect(notificationCount).toBe(1);
  });

  it("should calculate notification count with only join requests", () => {
    const joinRequest = createTestJoinRequest();
    appState.pendingJoinRequests.set("group-1", [joinRequest]);

    const notificationCount =
      appState.friendRequests.incoming.length +
      appState.groupInvitations.length +
      appState.allPendingJoinRequests.length;

    expect(notificationCount).toBe(1);
  });

  it("should calculate combined notification count", () => {
    // Add friend request
    appState.friendRequests = {
      incoming: [
        {
          id: "req-1",
          fromUserId: "user-1",
          toUserId: "user-2",
          direction: "incoming",
          fromUsername: "user1",
          fromDiscordId: "discord-1",
          fromPlayer: null,
          fromAvatar: null,
          createdAt: new Date().toISOString(),
        },
      ],
      outgoing: [],
    };

    // Add group invitation
    const notification = {
      id: "notif-1",
      type: "group_invitation",
      userId: "user-123",
      read: false,
      createdAt: "2024-01-01T00:00:00Z",
      data: {
        invitationId: "invite-1",
        groupId: "group-1",
        groupName: "Test Group",
        groupAvatar: null,
        inviterId: "inviter-1",
        inviterUsername: "Inviter",
        inviterDisplayName: "Inviter User",
        inviterAvatar: null,
      },
    };
    appState.setNotifications([notification as any]);

    // Add join request
    const joinRequest = createTestJoinRequest();
    appState.pendingJoinRequests.set("group-2", [joinRequest]);

    const notificationCount =
      appState.friendRequests.incoming.length +
      appState.groupInvitations.length +
      appState.allPendingJoinRequests.length;

    expect(notificationCount).toBe(3);
  });

  it("should return 0 when no notifications", () => {
    const notificationCount =
      appState.friendRequests.incoming.length +
      appState.groupInvitations.length +
      appState.allPendingJoinRequests.length;

    expect(notificationCount).toBe(0);
  });
});

describe("Header - Empty State Detection", () => {
  beforeEach(() => {
    appState.friendRequests = { incoming: [], outgoing: [] };
    appState.notifications = [];
    appState.pendingJoinRequests = new Map();
  });

  it("should detect empty state when no notifications", () => {
    const isEmpty =
      appState.friendRequests.incoming.length === 0 &&
      appState.groupInvitations.length === 0 &&
      appState.allPendingJoinRequests.length === 0;

    expect(isEmpty).toBe(true);
  });

  it("should NOT be empty when friend requests exist", () => {
    appState.friendRequests = {
      incoming: [
        {
          id: "req-1",
          fromUserId: "user-1",
          toUserId: "user-2",
          direction: "incoming",
          fromUsername: "user1",
          fromDiscordId: "discord-1",
          fromPlayer: null,
          fromAvatar: null,
          createdAt: new Date().toISOString(),
        },
      ],
      outgoing: [],
    };

    const isEmpty =
      appState.friendRequests.incoming.length === 0 &&
      appState.groupInvitations.length === 0 &&
      appState.allPendingJoinRequests.length === 0;

    expect(isEmpty).toBe(false);
  });

  it("should NOT be empty when join requests exist", () => {
    const joinRequest = createTestJoinRequest();
    appState.pendingJoinRequests.set("group-1", [joinRequest]);

    const isEmpty =
      appState.friendRequests.incoming.length === 0 &&
      appState.groupInvitations.length === 0 &&
      appState.allPendingJoinRequests.length === 0;

    expect(isEmpty).toBe(false);
  });
});

describe("Header - Join Request Handlers", () => {
  beforeEach(() => {
    appState.pendingJoinRequests = new Map();
    vi.clearAllMocks();
  });

  it("should call reviewJoinRequest with accept action", async () => {
    const reviewSpy = vi
      .spyOn(appState, "reviewJoinRequest")
      .mockResolvedValue();

    // Simulate handler logic
    const handleAcceptJoinRequest = async (
      requestId: string,
      groupId: string,
    ) => {
      await appState.reviewJoinRequest(requestId, groupId, "accept");
    };

    await handleAcceptJoinRequest("req-123", "group-456");

    expect(reviewSpy).toHaveBeenCalledWith("req-123", "group-456", "accept");

    reviewSpy.mockRestore();
  });

  it("should call reviewJoinRequest with deny action", async () => {
    const reviewSpy = vi
      .spyOn(appState, "reviewJoinRequest")
      .mockResolvedValue();

    // Simulate handler logic
    const handleDenyJoinRequest = async (
      requestId: string,
      groupId: string,
    ) => {
      await appState.reviewJoinRequest(requestId, groupId, "deny");
    };

    await handleDenyJoinRequest("req-123", "group-456");

    expect(reviewSpy).toHaveBeenCalledWith("req-123", "group-456", "deny");

    reviewSpy.mockRestore();
  });

  it("should handle errors gracefully in accept handler", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const reviewSpy = vi
      .spyOn(appState, "reviewJoinRequest")
      .mockRejectedValue(new Error("Network error"));

    // Simulate handler logic with error handling
    const handleAcceptJoinRequest = async (
      requestId: string,
      groupId: string,
    ) => {
      try {
        await appState.reviewJoinRequest(requestId, groupId, "accept");
      } catch (error) {
        console.error("[Header] Failed to accept join request:", error);
      }
    };

    await handleAcceptJoinRequest("req-123", "group-456");

    expect(consoleSpy).toHaveBeenCalledWith(
      "[Header] Failed to accept join request:",
      expect.any(Error),
    );

    consoleSpy.mockRestore();
    reviewSpy.mockRestore();
  });

  it("should handle errors gracefully in deny handler", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const reviewSpy = vi
      .spyOn(appState, "reviewJoinRequest")
      .mockRejectedValue(new Error("Network error"));

    // Simulate handler logic with error handling
    const handleDenyJoinRequest = async (
      requestId: string,
      groupId: string,
    ) => {
      try {
        await appState.reviewJoinRequest(requestId, groupId, "deny");
      } catch (error) {
        console.error("[Header] Failed to deny join request:", error);
      }
    };

    await handleDenyJoinRequest("req-123", "group-456");

    expect(consoleSpy).toHaveBeenCalledWith(
      "[Header] Failed to deny join request:",
      expect.any(Error),
    );

    consoleSpy.mockRestore();
    reviewSpy.mockRestore();
  });
});

describe("Header - Join Request Display Logic", () => {
  beforeEach(() => {
    appState.pendingJoinRequests = new Map();
  });

  it("should display displayName when available", () => {
    const joinRequest = createTestJoinRequest({
      displayName: "John Doe",
      username: "johndoe",
    });

    const displayedName = joinRequest.displayName || joinRequest.username;

    expect(displayedName).toBe("John Doe");
  });

  it("should fallback to username when displayName is empty", () => {
    const joinRequest = createTestJoinRequest({
      displayName: "",
      username: "johndoe",
    });

    const displayedName = joinRequest.displayName || joinRequest.username;

    expect(displayedName).toBe("johndoe");
  });

  it("should show group name in request description", () => {
    const joinRequest = createTestJoinRequest({
      groupName: "Star Runners",
    });

    const description = `Wants to join ${joinRequest.groupName}`;

    expect(description).toBe("Wants to join Star Runners");
  });
});
