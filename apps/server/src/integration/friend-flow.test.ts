/**
 * Friend Flow Integration Tests
 *
 * Tests the complete friend lifecycle:
 * - Sending friend requests
 * - Accepting/denying requests
 * - Removing friends
 * - Friend list retrieval with pagination
 * - Real-time notifications
 *
 * @module server/integration/friend-flow.test
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { withNeonTestBranch } from "../test/setup";
import {
  getFriends,
  sendFriendRequest,
  acceptFriendRequest,
  denyFriendRequest,
  removeFriend,
  getFriendRequests,
} from "../handlers/friends";
import { broadcast } from "../lib/utils";
import { userConnections } from "../lib/state";
import {
  MockWebSocket,
  clearConnectionState,
  simulateConnection,
  seedTestUser,
  seedFriendship,
  cleanupTestData,
  assertReceivedMessage,
  assertDidNotReceiveMessage,
  createTestContext,
} from "./test-utils";

describe("Friend Flow Integration Tests", () => {
  // Set up ephemeral Neon database branch for this test suite
  withNeonTestBranch();

  beforeEach(() => {
    clearConnectionState();
  });

  afterEach(async () => {
    clearConnectionState();
    await cleanupTestData();
  });

  // ============================================================================
  // Get Friends Tests
  // ============================================================================

  describe("getFriends", () => {
    test("should return empty list for user with no friends", async () => {
      const user = await seedTestUser();
      const ws = new MockWebSocket();
      simulateConnection(user.discordId);

      await getFriends(ws, user.discordId, {}, "req-1");

      const response = ws.getLastMessage();
      expect(response.type).toBe("friends_list");
      expect(response.data.friends).toEqual([]);
      expect(response.data.pagination.total).toBe(0);
      expect(response.requestId).toBe("req-1");
    });

    test("should return friends list for user with friends", async () => {
      const user1 = await seedTestUser({ username: "friend-test-user-1" });
      const user2 = await seedTestUser({ username: "friend-test-user-2" });
      await seedFriendship(user1.id, user2.id, "accepted");

      const ws = new MockWebSocket();
      simulateConnection(user1.discordId);

      await getFriends(ws, user1.discordId, {}, "req-1");

      const response = ws.getLastMessage();
      expect(response.type).toBe("friends_list");
      expect(response.data.friends.length).toBe(1);
      expect(response.data.friends[0].friendUsername).toBe(
        "friend-test-user-2",
      );
      expect(response.data.pagination.total).toBe(1);
    });

    test("should not return pending friendships in friends list", async () => {
      const user1 = await seedTestUser();
      const user2 = await seedTestUser();
      await seedFriendship(user1.id, user2.id, "pending");

      const ws = new MockWebSocket();

      await getFriends(ws, user1.discordId, {}, "req-1");

      const response = ws.getLastMessage();
      expect(response.data.friends.length).toBe(0);
    });

    test("should show online status for connected friends", async () => {
      const user1 = await seedTestUser();
      const user2 = await seedTestUser();
      await seedFriendship(user1.id, user2.id, "accepted");

      // Connect user2
      simulateConnection(user2.discordId);

      const ws = new MockWebSocket();
      await getFriends(ws, user1.discordId, {}, "req-1");

      const response = ws.getLastMessage();
      expect(response.data.friends[0].isOnline).toBe(true);
    });

    test("should support pagination", async () => {
      // Create user with multiple friends
      const mainUser = await seedTestUser();
      const friends = await Promise.all([
        seedTestUser({ username: "paginate-friend-1" }),
        seedTestUser({ username: "paginate-friend-2" }),
        seedTestUser({ username: "paginate-friend-3" }),
      ]);

      for (const friend of friends) {
        await seedFriendship(mainUser.id, friend.id, "accepted");
      }

      const ws = new MockWebSocket();

      // Request first page with 2 per page
      await getFriends(
        ws,
        mainUser.discordId,
        { page: 1, perPage: 2 },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.data.friends.length).toBe(2);
      expect(response.data.pagination.page).toBe(1);
      expect(response.data.pagination.perPage).toBe(2);
      expect(response.data.pagination.total).toBe(3);
      expect(response.data.pagination.totalPages).toBe(2);
      expect(response.data.pagination.hasMore).toBe(true);
    });

    test("should sort by username by default", async () => {
      const mainUser = await seedTestUser();
      const friendA = await seedTestUser({ username: "alice-test" });
      const friendB = await seedTestUser({ username: "bob-test" });
      const friendC = await seedTestUser({ username: "charlie-test" });

      await seedFriendship(mainUser.id, friendC.id, "accepted");
      await seedFriendship(mainUser.id, friendA.id, "accepted");
      await seedFriendship(mainUser.id, friendB.id, "accepted");

      const ws = new MockWebSocket();
      await getFriends(ws, mainUser.discordId, {}, "req-1");

      const response = ws.getLastMessage();
      const names = response.data.friends.map((f: any) => f.friendUsername);
      expect(names).toEqual(["alice-test", "bob-test", "charlie-test"]);
    });

    test("should sort online friends first when sortBy=online", async () => {
      const mainUser = await seedTestUser();
      const offlineFriend = await seedTestUser({ username: "offline-user" });
      const onlineFriend = await seedTestUser({ username: "online-user" });

      await seedFriendship(mainUser.id, offlineFriend.id, "accepted");
      await seedFriendship(mainUser.id, onlineFriend.id, "accepted");

      // Connect only the online friend
      simulateConnection(onlineFriend.discordId);

      const ws = new MockWebSocket();
      await getFriends(ws, mainUser.discordId, { sortBy: "online" }, "req-1");

      const response = ws.getLastMessage();
      expect(response.data.friends[0].friendUsername).toBe("online-user");
      expect(response.data.friends[0].isOnline).toBe(true);
    });
  });

  // ============================================================================
  // Send Friend Request Tests
  // ============================================================================

  describe("sendFriendRequest", () => {
    test("should send friend request by friend code", async () => {
      const sender = await seedTestUser({ username: "sender" });
      const receiver = await seedTestUser({
        username: "receiver",
        friendCode: "TEST01",
      });

      const ws = new MockWebSocket();
      const { ws: receiverWs } = simulateConnection(receiver.discordId);

      await sendFriendRequest(
        ws,
        sender.discordId,
        { friendCode: "TEST01" },
        "req-1",
      );

      // Sender should get success response
      const senderMsg = ws.getLastMessage();
      expect(senderMsg.type).toBe("friend_request_sent");
      // Handler returns fromDiscordId (the target user's ID)
      expect(senderMsg.data.fromDiscordId).toBe(receiver.discordId);

      // Receiver should get notification
      expect(receiverWs.hasMessage("friend_request_received")).toBe(true);
    });

    test("should reject request to self", async () => {
      const user = await seedTestUser({ friendCode: "MYSELF" });

      const ws = new MockWebSocket();

      await sendFriendRequest(
        ws,
        user.discordId,
        { friendCode: "MYSELF" },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.type).toBe("error");
      expect(response.error).toContain("yourself");
    });

    test("should reject if already friends", async () => {
      const user1 = await seedTestUser({ friendCode: "USER01" });
      const user2 = await seedTestUser({ friendCode: "USER02" });
      await seedFriendship(user1.id, user2.id, "accepted");

      const ws = new MockWebSocket();

      await sendFriendRequest(
        ws,
        user1.discordId,
        { friendCode: "USER02" },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.type).toBe("error");
      expect(response.error).toContain("Already friends");
    });

    test("should reject if request already pending", async () => {
      const user1 = await seedTestUser({ friendCode: "PEND01" });
      const user2 = await seedTestUser({ friendCode: "PEND02" });
      await seedFriendship(user1.id, user2.id, "pending");

      const ws = new MockWebSocket();

      await sendFriendRequest(
        ws,
        user1.discordId,
        { friendCode: "PEND02" },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.type).toBe("error");
      expect(response.error).toContain("already sent");
    });

    test("should reject invalid friend code", async () => {
      const sender = await seedTestUser();

      const ws = new MockWebSocket();

      await sendFriendRequest(
        ws,
        sender.discordId,
        { friendCode: "INVALID123" },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.type).toBe("error");
      expect(response.error).toContain("not found");
    });

    test("should reject if no friend code or discord ID provided", async () => {
      const sender = await seedTestUser();

      const ws = new MockWebSocket();

      await sendFriendRequest(ws, sender.discordId, {}, "req-1");

      const response = ws.getLastMessage();
      expect(response.type).toBe("error");
      expect(response.error).toContain("required");
    });
  });

  // ============================================================================
  // Accept Friend Request Tests
  // ============================================================================

  describe("acceptFriendRequest", () => {
    test("should accept pending friend request", async () => {
      const sender = await seedTestUser({ username: "request-sender" });
      const receiver = await seedTestUser({ username: "request-receiver" });
      const friendship = await seedFriendship(
        sender.id,
        receiver.id,
        "pending",
      );

      const ws = new MockWebSocket();
      const { ws: senderWs } = simulateConnection(sender.discordId);

      await acceptFriendRequest(
        ws,
        receiver.discordId,
        { friendshipId: friendship.id },
        "req-1",
      );

      // Receiver should get success
      const receiverMsg = ws.getLastMessage();
      expect(receiverMsg.type).toBe("friend_request_accepted");

      // Sender should be notified via 'friend_request_accepted_notification'
      expect(senderWs.hasMessage("friend_request_accepted_notification")).toBe(
        true,
      );
    });

    test("should reject if friendship not found", async () => {
      const user = await seedTestUser();

      const ws = new MockWebSocket();

      await acceptFriendRequest(
        ws,
        user.discordId,
        { friendshipId: "00000000-0000-0000-0000-000000000000" },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.type).toBe("error");
    });
  });

  // ============================================================================
  // Deny Friend Request Tests
  // ============================================================================

  describe("denyFriendRequest", () => {
    test("should deny pending friend request", async () => {
      const sender = await seedTestUser();
      const receiver = await seedTestUser();
      const friendship = await seedFriendship(
        sender.id,
        receiver.id,
        "pending",
      );

      const ws = new MockWebSocket();

      await denyFriendRequest(
        ws,
        receiver.discordId,
        { friendshipId: friendship.id },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.type).toBe("friend_request_denied");
    });
  });

  // ============================================================================
  // Remove Friend Tests
  // ============================================================================

  describe("removeFriend", () => {
    test("should remove accepted friendship", async () => {
      const user1 = await seedTestUser();
      const user2 = await seedTestUser();
      const friendship = await seedFriendship(user1.id, user2.id, "accepted");

      const ws = new MockWebSocket();
      const { ws: user2Ws } = simulateConnection(user2.discordId);

      await removeFriend(
        ws,
        user1.discordId,
        { friendshipId: friendship.id },
        "req-1",
      );

      // User1 should get success
      const response = ws.getLastMessage();
      expect(response.type).toBe("friend_removed");

      // User2 should be notified via 'friend_removed_notification'
      expect(user2Ws.hasMessage("friend_removed_notification")).toBe(true);
    });

    test("should reject if not in friendship", async () => {
      const user1 = await seedTestUser();
      const user2 = await seedTestUser();
      const user3 = await seedTestUser();
      const friendship = await seedFriendship(user1.id, user2.id, "accepted");

      const ws = new MockWebSocket();

      // User3 tries to remove user1-user2 friendship
      await removeFriend(
        ws,
        user3.discordId,
        { friendshipId: friendship.id },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.type).toBe("error");
    });
  });

  // ============================================================================
  // Get Friend Requests Tests
  // ============================================================================

  describe("getFriendRequests", () => {
    test("should return incoming and outgoing requests", async () => {
      const mainUser = await seedTestUser();
      const incomingUser = await seedTestUser();
      const outgoingUser = await seedTestUser();

      // Incoming: incomingUser sent request to mainUser
      await seedFriendship(incomingUser.id, mainUser.id, "pending");

      // Outgoing: mainUser sent request to outgoingUser
      await seedFriendship(mainUser.id, outgoingUser.id, "pending");

      const ws = new MockWebSocket();

      await getFriendRequests(ws, mainUser.discordId, {}, "req-1");

      const response = ws.getLastMessage();
      expect(response.type).toBe("friend_requests");
      expect(response.data.incoming.length).toBe(1);
      expect(response.data.outgoing.length).toBe(1);
    });

    test("should return empty arrays for user with no pending requests", async () => {
      const user = await seedTestUser();

      const ws = new MockWebSocket();

      await getFriendRequests(ws, user.discordId, {}, "req-1");

      const response = ws.getLastMessage();
      expect(response.type).toBe("friend_requests");
      expect(response.data.incoming).toEqual([]);
      expect(response.data.outgoing).toEqual([]);
    });
  });

  // ============================================================================
  // Broadcasting Tests
  // ============================================================================

  describe("Friend Broadcasting", () => {
    test("should broadcast log to all online friends", async () => {
      const ctx = await createTestContext(3, {
        connectAll: true,
        createFriendships: true,
      });

      const [sender, friend1, friend2] = ctx.users;
      const senderConn = ctx.connections.get(sender.id)!;
      const friend1Conn = ctx.connections.get(friend1.id)!;
      const friend2Conn = ctx.connections.get(friend2.id)!;

      // Broadcast from sender to friends
      const friendIds = [friend1.discordId, friend2.discordId];
      broadcast(friendIds, "log_received", {
        senderDiscordId: sender.discordId,
        logs: [{ id: 1, message: "test log" }],
      });

      // Friends should receive
      expect(friend1Conn.ws.hasMessage("log_received")).toBe(true);
      expect(friend2Conn.ws.hasMessage("log_received")).toBe(true);

      // Sender should not receive (not in recipient list)
      expect(senderConn.ws.hasMessage("log_received")).toBe(false);

      await ctx.cleanup();
    });

    test("should skip offline friends", async () => {
      const onlineUser = await seedTestUser();
      const offlineUser = await seedTestUser();
      const sender = await seedTestUser();

      await seedFriendship(sender.id, onlineUser.id, "accepted");
      await seedFriendship(sender.id, offlineUser.id, "accepted");

      // Only connect online user
      const { ws: onlineWs } = simulateConnection(onlineUser.discordId);
      // offlineUser is not connected

      broadcast([onlineUser.discordId, offlineUser.discordId], "notification", {
        text: "hi",
      });

      // Only online user should receive
      expect(onlineWs.hasMessage("notification")).toBe(true);
    });
  });
});
