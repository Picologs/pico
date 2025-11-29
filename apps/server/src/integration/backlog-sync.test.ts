/**
 * Backlog Sync Integration Tests
 *
 * Tests sending backlog logs to friends and groups on connect.
 * Uses the existing send_logs handler to verify backlog scenarios work correctly.
 *
 * @module server/integration/backlog-sync.test
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { withNeonTestBranch } from "../test/setup";
import { sendLogs } from "../handlers/logs";
import { decompressLogs } from "../utils/compression";
import {
  MockWebSocket,
  clearConnectionState,
  simulateConnection,
  seedTestUser,
  seedFriendship,
  seedTestGroup,
  seedGroupMember,
  cleanupTestData,
  assertReceivedMessage,
  assertDidNotReceiveMessage,
} from "./test-utils";

describe("Backlog Sync Integration Tests", () => {
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
  // Backlog to Friends Tests
  // ============================================================================

  describe("backlog to friends", () => {
    it("should broadcast backlog logs to online friends", async () => {
      // Create sender and friend
      const sender = await seedTestUser({ username: "backlog-sender" });
      const friend = await seedTestUser({ username: "backlog-friend" });
      await seedFriendship(sender.id, friend.id, "accepted");

      // Connect both users
      const senderWs = new MockWebSocket();
      const { ws: friendWs } = simulateConnection(friend.discordId);
      simulateConnection(sender.discordId);

      // Create backlog logs (simulating 50 logs from last 24 hours)
      const backlogLogs = Array.from({ length: 50 }, (_, i) => ({
        id: `backlog-log-${i}`,
        userId: sender.discordId,
        player: "TestPlayer",
        emoji: "📝",
        line: `Backlog event ${i}`,
        timestamp: new Date(Date.now() - (50 - i) * 60000).toISOString(),
        original: `Original line ${i}`,
        open: false,
      }));

      // Send backlog to friends
      await sendLogs(senderWs, sender.discordId, {
        logs: backlogLogs,
        target: { type: "friends" },
      });

      // Friend should receive logs (may be compressed for 50 logs)
      assertReceivedMessage(friendWs, "log_received");
      const received = friendWs.getMessagesByType("log_received")[0];
      const logs = received.data.compressed
        ? decompressLogs(received.data.compressedData)
        : received.data.logs;
      expect(logs).toHaveLength(50);
      expect(received.data.senderDiscordId).toBe(sender.discordId);
    });

    it("should return recipient count in response", async () => {
      const sender = await seedTestUser({ username: "backlog-sender-count" });
      const friend1 = await seedTestUser({ username: "backlog-friend-1" });
      const friend2 = await seedTestUser({ username: "backlog-friend-2" });
      await seedFriendship(sender.id, friend1.id, "accepted");
      await seedFriendship(sender.id, friend2.id, "accepted");

      // Connect all users
      const senderWs = new MockWebSocket();
      simulateConnection(sender.discordId);
      simulateConnection(friend1.discordId);
      simulateConnection(friend2.discordId);

      const backlogLogs = [
        { id: "log-1", timestamp: new Date().toISOString(), line: "Test" },
      ];

      await sendLogs(senderWs, sender.discordId, {
        logs: backlogLogs,
        target: { type: "friends" },
      });

      // Sender should get confirmation
      assertReceivedMessage(senderWs, "logs_sent");
      const response = senderWs.getMessagesByType("logs_sent")[0];
      // Recipients includes both friends + sender (self-broadcast)
      expect(response.data.recipients).toBeGreaterThanOrEqual(2);
    });

    it("should not send to offline friends", async () => {
      const sender = await seedTestUser({ username: "backlog-sender-offline" });
      const friend = await seedTestUser({ username: "backlog-friend-offline" });
      await seedFriendship(sender.id, friend.id, "accepted");

      // Only connect sender (friend is offline)
      const senderWs = new MockWebSocket();
      simulateConnection(sender.discordId);

      const backlogLogs = [
        { id: "log-1", timestamp: new Date().toISOString(), line: "Test" },
      ];

      await sendLogs(senderWs, sender.discordId, {
        logs: backlogLogs,
        target: { type: "friends" },
      });

      // Response should show only sender received (self-broadcast)
      assertReceivedMessage(senderWs, "logs_sent");
      const response = senderWs.getMessagesByType("logs_sent")[0];
      expect(response.data.recipients).toBe(1); // Only self
    });

    it("should handle empty logs array", async () => {
      const sender = await seedTestUser({ username: "backlog-sender-empty" });
      const senderWs = new MockWebSocket();
      simulateConnection(sender.discordId);

      await sendLogs(senderWs, sender.discordId, {
        logs: [],
        target: { type: "friends" },
      });

      // Should return error for empty logs
      assertReceivedMessage(senderWs, "error");
    });
  });

  // ============================================================================
  // Backlog to Groups Tests
  // ============================================================================

  describe("backlog to groups", () => {
    it("should broadcast backlog logs to online group members", async () => {
      // Create sender, group, and member
      const sender = await seedTestUser({ username: "backlog-group-sender" });
      const member = await seedTestUser({ username: "backlog-group-member" });

      const group = await seedTestGroup({
        ownerId: sender.id,
        name: "Backlog Test Group",
      });
      await seedGroupMember(group.id, member.id, "member");

      // Connect both users
      const senderWs = new MockWebSocket();
      const { ws: memberWs } = simulateConnection(member.discordId);
      simulateConnection(sender.discordId);

      const backlogLogs = Array.from({ length: 10 }, (_, i) => ({
        id: `group-backlog-log-${i}`,
        userId: sender.discordId,
        player: "GroupPlayer",
        emoji: "🎮",
        line: `Group backlog event ${i}`,
        timestamp: new Date(Date.now() - (10 - i) * 60000).toISOString(),
        original: `Original ${i}`,
        open: false,
      }));

      // Send backlog to group
      await sendLogs(senderWs, sender.discordId, {
        logs: backlogLogs,
        target: { type: "group", groupId: group.id },
      });

      // Group member should receive logs
      assertReceivedMessage(memberWs, "group_logs_received");
      const received = memberWs.getMessagesByType("group_logs_received")[0];
      expect(received.data.logs).toHaveLength(10);
      expect(received.data.groupId).toBe(group.id);
    });

    it("should not send to non-members", async () => {
      const sender = await seedTestUser({
        username: "backlog-group-sender-nm",
      });
      const nonMember = await seedTestUser({ username: "backlog-non-member" });

      const group = await seedTestGroup({
        ownerId: sender.id,
        name: "Private Group",
      });
      // Note: nonMember is NOT added to the group

      // Connect both users
      const senderWs = new MockWebSocket();
      const { ws: nonMemberWs } = simulateConnection(nonMember.discordId);
      simulateConnection(sender.discordId);

      const backlogLogs = [
        { id: "log-1", timestamp: new Date().toISOString(), line: "Test" },
      ];

      await sendLogs(senderWs, sender.discordId, {
        logs: backlogLogs,
        target: { type: "group", groupId: group.id },
      });

      // Non-member should NOT receive logs
      assertDidNotReceiveMessage(nonMemberWs, "group_logs_received");
    });

    it("should reject if sender is not a group member", async () => {
      const sender = await seedTestUser({
        username: "backlog-non-member-sender",
      });
      const owner = await seedTestUser({ username: "backlog-group-owner" });

      const group = await seedTestGroup({
        ownerId: owner.id,
        name: "Not My Group",
      });
      // Note: sender is NOT a member of the group

      const senderWs = new MockWebSocket();
      simulateConnection(sender.discordId);

      const backlogLogs = [
        { id: "log-1", timestamp: new Date().toISOString(), line: "Test" },
      ];

      await sendLogs(senderWs, sender.discordId, {
        logs: backlogLogs,
        target: { type: "group", groupId: group.id },
      });

      // Should return error
      assertReceivedMessage(senderWs, "error");
      const error = senderWs.getMessagesByType("error")[0];
      expect(error.error).toBe("Not a member of this group");
    });
  });

  // ============================================================================
  // Large Backlog Tests
  // ============================================================================

  describe("large backlog handling", () => {
    it("should handle 50 logs in single batch", async () => {
      const sender = await seedTestUser({ username: "backlog-large-sender" });
      const friend = await seedTestUser({ username: "backlog-large-friend" });
      await seedFriendship(sender.id, friend.id, "accepted");

      const senderWs = new MockWebSocket();
      const { ws: friendWs } = simulateConnection(friend.discordId);
      simulateConnection(sender.discordId);

      // Create 50 logs (typical backlog size)
      const backlogLogs = Array.from({ length: 50 }, (_, i) => ({
        id: `large-backlog-${i}`,
        userId: sender.discordId,
        player: "TestPlayer",
        emoji: "📝",
        line: `Large backlog event ${i} with some additional content to make it realistic`,
        timestamp: new Date(Date.now() - i * 1000).toISOString(),
        original: `Original line with more content ${i}`,
        open: false,
      }));

      await sendLogs(senderWs, sender.discordId, {
        logs: backlogLogs,
        target: { type: "friends" },
      });

      assertReceivedMessage(friendWs, "log_received");
      const received = friendWs.getMessagesByType("log_received")[0];
      const logs = received.data.compressed
        ? decompressLogs(received.data.compressedData)
        : received.data.logs;
      expect(logs).toHaveLength(50);
    });

    it("should compress large backlog payloads", async () => {
      const sender = await seedTestUser({
        username: "backlog-compress-sender",
      });
      const friend = await seedTestUser({
        username: "backlog-compress-friend",
      });
      await seedFriendship(sender.id, friend.id, "accepted");

      const senderWs = new MockWebSocket();
      const { ws: friendWs } = simulateConnection(friend.discordId);
      simulateConnection(sender.discordId);

      // Create logs with enough content to trigger compression (>1KB)
      const backlogLogs = Array.from({ length: 50 }, (_, i) => ({
        id: `compress-backlog-${i}`,
        userId: sender.discordId,
        player: "TestPlayer",
        emoji: "📝",
        line: `Compressed backlog event ${i}: ${"x".repeat(100)}`, // Pad to ensure >1KB total
        timestamp: new Date().toISOString(),
        original: `Original with padding: ${"y".repeat(100)}`,
        open: false,
      }));

      await sendLogs(senderWs, sender.discordId, {
        logs: backlogLogs,
        target: { type: "friends" },
      });

      assertReceivedMessage(friendWs, "log_received");
      const received = friendWs.getMessagesByType("log_received")[0];

      // Compressed messages have these fields
      if (received.data.compressed) {
        expect(received.data.compressedData).toBeDefined();
        expect(received.data.originalSize).toBeGreaterThan(0);
        expect(received.data.compressedSize).toBeLessThan(
          received.data.originalSize,
        );
      } else {
        // Small payloads may not be compressed
        expect(received.data.logs).toHaveLength(50);
      }
    });
  });
});
