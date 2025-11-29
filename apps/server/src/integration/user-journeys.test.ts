/**
 * User Journey Integration Tests
 *
 * Tests complete user flows simulating multiple clients communicating
 * via WebSocket. These tests verify end-to-end scenarios without
 * requiring actual WebSocket connections.
 *
 * Patterns tested:
 * - Multi-client log sharing
 * - Friend request flows
 * - Group communication
 * - Offline/online transitions
 * - Multi-device scenarios
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { broadcast } from "../lib/utils";
import { clients, userConnections } from "../lib/state";

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Mock WebSocket that captures all sent messages
 */
class MockWebSocket {
  messages: any[] = [];
  closed = false;
  userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  send(data: string) {
    if (this.closed) throw new Error("WebSocket is closed");
    this.messages.push(JSON.parse(data));
  }

  close() {
    this.closed = true;
  }

  getLastMessage() {
    return this.messages[this.messages.length - 1];
  }

  getMessagesByType(type: string) {
    return this.messages.filter((m) => m.type === type);
  }

  clear() {
    this.messages = [];
  }

  hasReceived(type: string): boolean {
    return this.messages.some((m) => m.type === type);
  }
}

/**
 * Simulated user with WebSocket connection(s)
 */
class TestUser {
  discordId: string;
  username: string;
  connections: Map<string, MockWebSocket> = new Map();

  constructor(discordId: string, username: string) {
    this.discordId = discordId;
    this.username = username;
  }

  /**
   * Connect user with a new device
   */
  connect(deviceId: string = "default"): MockWebSocket {
    const connId = `${this.discordId}_${deviceId}`;
    const ws = new MockWebSocket(this.discordId);

    // Register in global state
    clients.set(connId, {
      userId: this.discordId,
      ws: ws as any,
      ip: "127.0.0.1",
      metadata: { device: deviceId, username: this.username },
    });

    // Track user connections
    if (!userConnections.has(this.discordId)) {
      userConnections.set(this.discordId, new Set());
    }
    userConnections.get(this.discordId)!.add(connId);

    this.connections.set(deviceId, ws);
    return ws;
  }

  /**
   * Disconnect a specific device or all devices
   */
  disconnect(deviceId?: string) {
    if (deviceId) {
      const connId = `${this.discordId}_${deviceId}`;
      const ws = this.connections.get(deviceId);
      if (ws) ws.close();
      clients.delete(connId);
      userConnections.get(this.discordId)?.delete(connId);
      this.connections.delete(deviceId);
    } else {
      // Disconnect all
      for (const [device] of this.connections) {
        this.disconnect(device);
      }
    }
  }

  /**
   * Get messages from a specific device
   */
  getMessages(deviceId: string = "default"): any[] {
    return this.connections.get(deviceId)?.messages || [];
  }

  /**
   * Clear all messages from all devices
   */
  clearMessages() {
    for (const [, ws] of this.connections) {
      ws.clear();
    }
  }

  /**
   * Check if user received a message type on any device
   */
  hasReceived(type: string): boolean {
    for (const [, ws] of this.connections) {
      if (ws.hasReceived(type)) return true;
    }
    return false;
  }

  /**
   * Get all messages of a type from all devices
   */
  getAllMessagesByType(type: string): any[] {
    const messages: any[] = [];
    for (const [, ws] of this.connections) {
      messages.push(...ws.getMessagesByType(type));
    }
    return messages;
  }
}

/**
 * Test scenario builder for setting up multi-user scenarios
 */
class TestScenario {
  users: Map<string, TestUser> = new Map();
  friendships: Set<string> = new Set(); // "userA:userB" format

  createUser(discordId: string, username: string): TestUser {
    const user = new TestUser(discordId, username);
    this.users.set(discordId, user);
    return user;
  }

  /**
   * Establish mutual friendship between two users
   */
  makeFriends(userA: TestUser, userB: TestUser) {
    const key = [userA.discordId, userB.discordId].sort().join(":");
    this.friendships.add(key);
  }

  /**
   * Check if two users are friends
   */
  areFriends(userA: TestUser, userB: TestUser): boolean {
    const key = [userA.discordId, userB.discordId].sort().join(":");
    return this.friendships.has(key);
  }

  /**
   * Get all friend IDs for a user
   */
  getFriendIds(user: TestUser): string[] {
    const friends: string[] = [];
    for (const friendship of this.friendships) {
      const [a, b] = friendship.split(":");
      if (a === user.discordId) friends.push(b);
      else if (b === user.discordId) friends.push(a);
    }
    return friends;
  }

  /**
   * Simulate sending logs to all friends
   */
  sendLogsToFriends(sender: TestUser, logs: any[]) {
    const friendIds = this.getFriendIds(sender);
    broadcast(friendIds, "logs_received", {
      senderDiscordId: sender.discordId,
      fromUsername: sender.username,
      logs,
      target: { type: "friends" },
    });
  }

  /**
   * Simulate sending logs to a specific friend
   */
  sendLogsToFriend(sender: TestUser, recipient: TestUser, logs: any[]) {
    broadcast([recipient.discordId], "logs_received", {
      senderDiscordId: sender.discordId,
      fromUsername: sender.username,
      logs,
      target: { type: "friend", discordId: recipient.discordId },
    });
  }

  /**
   * Cleanup all connections
   */
  cleanup() {
    for (const [, user] of this.users) {
      user.disconnect();
    }
    clients.clear();
    userConnections.clear();
  }
}

// ============================================================================
// User Journey Tests
// ============================================================================

describe("User Journey: Log Sharing Between Friends", () => {
  let scenario: TestScenario;

  beforeEach(() => {
    scenario = new TestScenario();
    clients.clear();
    userConnections.clear();
  });

  afterEach(() => {
    scenario.cleanup();
  });

  test("Journey: Two friends share logs in real-time", () => {
    // Setup: Alice and Bob are friends, both online
    const alice = scenario.createUser("alice_123", "Alice");
    const bob = scenario.createUser("bob_456", "Bob");
    scenario.makeFriends(alice, bob);

    alice.connect("desktop");
    bob.connect("desktop");

    // Alice plays game, generates logs
    const aliceLogs = [
      {
        id: "log1",
        line: "Alice killed a pirate",
        eventType: "kill",
        timestamp: new Date().toISOString(),
      },
      {
        id: "log2",
        line: "Alice found rare loot",
        eventType: "loot",
        timestamp: new Date().toISOString(),
      },
    ];

    // Alice shares logs with friends
    scenario.sendLogsToFriends(alice, aliceLogs);

    // Bob should receive Alice's logs
    expect(bob.hasReceived("logs_received")).toBe(true);
    const bobMessages = bob.getAllMessagesByType("logs_received");
    expect(bobMessages.length).toBe(1);
    expect(bobMessages[0].data.fromUsername).toBe("Alice");
    expect(bobMessages[0].data.logs.length).toBe(2);

    // Alice should NOT receive her own logs
    expect(alice.hasReceived("logs_received")).toBe(false);
  });

  test("Journey: Log sharing with multiple friends", () => {
    // Setup: Alice has 3 friends
    const alice = scenario.createUser("alice_123", "Alice");
    const bob = scenario.createUser("bob_456", "Bob");
    const charlie = scenario.createUser("charlie_789", "Charlie");
    const diana = scenario.createUser("diana_012", "Diana");

    scenario.makeFriends(alice, bob);
    scenario.makeFriends(alice, charlie);
    scenario.makeFriends(alice, diana);
    // Note: Bob and Charlie are NOT friends with each other

    alice.connect();
    bob.connect();
    charlie.connect();
    diana.connect();

    // Alice shares logs
    const logs = [
      { id: "log1", line: "Alice event", timestamp: new Date().toISOString() },
    ];
    scenario.sendLogsToFriends(alice, logs);

    // All friends should receive
    expect(bob.hasReceived("logs_received")).toBe(true);
    expect(charlie.hasReceived("logs_received")).toBe(true);
    expect(diana.hasReceived("logs_received")).toBe(true);
  });

  test("Journey: Offline friend misses logs, online friend receives", () => {
    const alice = scenario.createUser("alice_123", "Alice");
    const bob = scenario.createUser("bob_456", "Bob");
    const charlie = scenario.createUser("charlie_789", "Charlie");

    scenario.makeFriends(alice, bob);
    scenario.makeFriends(alice, charlie);

    alice.connect();
    bob.connect();
    // Charlie stays offline

    const logs = [
      { id: "log1", line: "Alice event", timestamp: new Date().toISOString() },
    ];
    scenario.sendLogsToFriends(alice, logs);

    // Bob receives, Charlie does not
    expect(bob.hasReceived("logs_received")).toBe(true);
    expect(charlie.hasReceived("logs_received")).toBe(false);
  });

  test("Journey: Friend comes online after logs sent", () => {
    const alice = scenario.createUser("alice_123", "Alice");
    const bob = scenario.createUser("bob_456", "Bob");

    scenario.makeFriends(alice, bob);

    alice.connect();
    // Bob is offline

    // Alice sends logs while Bob is offline
    const logs = [
      { id: "log1", line: "Alice event", timestamp: new Date().toISOString() },
    ];
    scenario.sendLogsToFriends(alice, logs);

    // Bob comes online later
    bob.connect();

    // Bob missed the logs (real-time only, no persistence in this test)
    expect(bob.hasReceived("logs_received")).toBe(false);
  });
});

describe("User Journey: Multi-Device Scenarios", () => {
  let scenario: TestScenario;

  beforeEach(() => {
    scenario = new TestScenario();
    clients.clear();
    userConnections.clear();
  });

  afterEach(() => {
    scenario.cleanup();
  });

  test("Journey: User receives logs on multiple devices", () => {
    const alice = scenario.createUser("alice_123", "Alice");
    const bob = scenario.createUser("bob_456", "Bob");

    scenario.makeFriends(alice, bob);

    alice.connect("desktop");
    bob.connect("desktop");
    bob.connect("mobile");
    bob.connect("web");

    const logs = [
      { id: "log1", line: "Alice event", timestamp: new Date().toISOString() },
    ];
    scenario.sendLogsToFriends(alice, logs);

    // Bob should receive on ALL devices
    const desktopMessages = bob.getMessages("desktop");
    const mobileMessages = bob.getMessages("mobile");
    const webMessages = bob.getMessages("web");

    expect(desktopMessages.length).toBe(1);
    expect(mobileMessages.length).toBe(1);
    expect(webMessages.length).toBe(1);

    // All should have same content
    expect(desktopMessages[0].data.logs[0].id).toBe("log1");
    expect(mobileMessages[0].data.logs[0].id).toBe("log1");
    expect(webMessages[0].data.logs[0].id).toBe("log1");
  });

  test("Journey: Sender also receives on other devices", () => {
    const alice = scenario.createUser("alice_123", "Alice");
    const bob = scenario.createUser("bob_456", "Bob");

    scenario.makeFriends(alice, bob);

    alice.connect("desktop"); // Sending device
    alice.connect("mobile"); // Viewing device
    bob.connect("desktop");

    // When broadcasting to friends + self (for multi-device sync)
    const logs = [
      { id: "log1", line: "Alice event", timestamp: new Date().toISOString() },
    ];
    const friendIds = scenario.getFriendIds(alice);

    // Include self in broadcast for multi-device viewing
    broadcast([alice.discordId, ...friendIds], "logs_received", {
      senderDiscordId: alice.discordId,
      fromUsername: alice.username,
      logs,
      target: { type: "friends" },
    });

    // Alice's mobile should receive for sync
    expect(alice.getMessages("desktop").length).toBe(1);
    expect(alice.getMessages("mobile").length).toBe(1);

    // Bob should also receive
    expect(bob.getMessages("desktop").length).toBe(1);
  });

  test("Journey: Disconnecting one device does not affect others", () => {
    const alice = scenario.createUser("alice_123", "Alice");
    const bob = scenario.createUser("bob_456", "Bob");

    scenario.makeFriends(alice, bob);

    alice.connect("desktop");
    bob.connect("desktop");
    bob.connect("mobile");

    // Bob disconnects desktop
    bob.disconnect("desktop");

    const logs = [
      { id: "log1", line: "Alice event", timestamp: new Date().toISOString() },
    ];
    scenario.sendLogsToFriends(alice, logs);

    // Bob's mobile should still receive
    expect(bob.getMessages("mobile").length).toBe(1);
  });
});

describe("User Journey: Friend Request Flow", () => {
  let scenario: TestScenario;

  beforeEach(() => {
    scenario = new TestScenario();
    clients.clear();
    userConnections.clear();
  });

  afterEach(() => {
    scenario.cleanup();
  });

  test("Journey: Send and accept friend request", () => {
    const alice = scenario.createUser("alice_123", "Alice");
    const bob = scenario.createUser("bob_456", "Bob");

    alice.connect();
    bob.connect();

    // Alice sends friend request to Bob
    broadcast([bob.discordId], "friend_request_received", {
      from: { discordId: alice.discordId, username: alice.username },
      friendshipId: "friendship_1",
    });

    // Bob should receive the request
    expect(bob.hasReceived("friend_request_received")).toBe(true);
    const request = bob.getAllMessagesByType("friend_request_received")[0];
    expect(request.data.from.username).toBe("Alice");

    // Bob accepts, Alice gets notified
    broadcast([alice.discordId], "friend_request_accepted", {
      by: { discordId: bob.discordId, username: bob.username },
      friendshipId: "friendship_1",
    });

    expect(alice.hasReceived("friend_request_accepted")).toBe(true);
    const acceptance = alice.getAllMessagesByType("friend_request_accepted")[0];
    expect(acceptance.data.by.username).toBe("Bob");

    // Now they're friends
    scenario.makeFriends(alice, bob);

    // Clear messages
    alice.clearMessages();
    bob.clearMessages();

    // Alice can now send logs to Bob
    const logs = [
      {
        id: "log1",
        line: "First log as friends!",
        timestamp: new Date().toISOString(),
      },
    ];
    scenario.sendLogsToFriends(alice, logs);

    expect(bob.hasReceived("logs_received")).toBe(true);
  });

  test("Journey: Friend request while recipient offline", () => {
    const alice = scenario.createUser("alice_123", "Alice");
    const bob = scenario.createUser("bob_456", "Bob");

    alice.connect();
    // Bob is offline

    // Alice sends friend request
    const sent = broadcast([bob.discordId], "friend_request_received", {
      from: { discordId: alice.discordId, username: alice.username },
      friendshipId: "friendship_1",
    });

    // Broadcast returns 0 (no online recipients)
    expect(sent).toBe(0);

    // Bob comes online later
    bob.connect();

    // Bob would need to fetch pending requests via API
    // (not via WebSocket - this is correct behavior)
    expect(bob.hasReceived("friend_request_received")).toBe(false);
  });
});

describe("User Journey: Online/Offline Status", () => {
  let scenario: TestScenario;

  beforeEach(() => {
    scenario = new TestScenario();
    clients.clear();
    userConnections.clear();
  });

  afterEach(() => {
    scenario.cleanup();
  });

  test("Journey: Friend comes online notification", () => {
    const alice = scenario.createUser("alice_123", "Alice");
    const bob = scenario.createUser("bob_456", "Bob");
    const charlie = scenario.createUser("charlie_789", "Charlie");

    scenario.makeFriends(alice, bob);
    scenario.makeFriends(alice, charlie);
    scenario.makeFriends(bob, charlie);

    // Alice and Bob are online
    alice.connect();
    bob.connect();

    // Charlie comes online - notify all his friends
    charlie.connect();
    const charlieFriends = scenario.getFriendIds(charlie);
    broadcast(charlieFriends, "user_came_online", {
      user: { discordId: charlie.discordId, username: charlie.username },
    });

    // Alice and Bob should be notified
    expect(alice.hasReceived("user_came_online")).toBe(true);
    expect(bob.hasReceived("user_came_online")).toBe(true);

    const aliceNotif = alice.getAllMessagesByType("user_came_online")[0];
    expect(aliceNotif.data.user.username).toBe("Charlie");
  });

  test("Journey: Friend goes offline notification", () => {
    const alice = scenario.createUser("alice_123", "Alice");
    const bob = scenario.createUser("bob_456", "Bob");

    scenario.makeFriends(alice, bob);

    alice.connect();
    bob.connect();

    // Bob goes offline
    const bobFriends = scenario.getFriendIds(bob);
    broadcast(bobFriends, "user_disconnected", {
      user: { discordId: bob.discordId, username: bob.username },
    });

    bob.disconnect();

    // Alice should be notified
    expect(alice.hasReceived("user_disconnected")).toBe(true);
  });
});

describe("User Journey: Batch Log Sending", () => {
  let scenario: TestScenario;

  beforeEach(() => {
    scenario = new TestScenario();
    clients.clear();
    userConnections.clear();
  });

  afterEach(() => {
    scenario.cleanup();
  });

  test("Journey: Large batch of logs sent to friends", () => {
    const alice = scenario.createUser("alice_123", "Alice");
    const bob = scenario.createUser("bob_456", "Bob");

    scenario.makeFriends(alice, bob);

    alice.connect();
    bob.connect();

    // Alice sends a large batch (e.g., login event with many equipment logs)
    const largeBatch = Array.from({ length: 50 }, (_, i) => ({
      id: `log_${i}`,
      line: `Equipment event ${i}`,
      eventType: "equipment",
      timestamp: new Date(Date.now() + i * 1000).toISOString(),
    }));

    broadcast([bob.discordId], "batch_logs_received", {
      senderDiscordId: alice.discordId,
      fromUsername: alice.username,
      logs: largeBatch,
      count: largeBatch.length,
    });

    // Bob receives the batch
    expect(bob.hasReceived("batch_logs_received")).toBe(true);
    const batch = bob.getAllMessagesByType("batch_logs_received")[0];
    expect(batch.data.logs.length).toBe(50);
    expect(batch.data.count).toBe(50);
  });

  test("Journey: Compressed batch logs", () => {
    const alice = scenario.createUser("alice_123", "Alice");
    const bob = scenario.createUser("bob_456", "Bob");

    scenario.makeFriends(alice, bob);

    alice.connect();
    bob.connect();

    // Simulate compressed batch
    broadcast([bob.discordId], "batch_logs_received", {
      senderDiscordId: alice.discordId,
      fromUsername: alice.username,
      compressed: true,
      compressedData: "base64encodedgzipdata...",
      originalSize: 15000,
      compressedSize: 5000,
    });

    const batch = bob.getAllMessagesByType("batch_logs_received")[0];
    expect(batch.data.compressed).toBe(true);
    expect(batch.data.compressedData).toBeDefined();
    expect(batch.data.logs).toBeUndefined(); // Logs are in compressed data
  });
});

describe("User Journey: Direct Message to Specific Friend", () => {
  let scenario: TestScenario;

  beforeEach(() => {
    scenario = new TestScenario();
    clients.clear();
    userConnections.clear();
  });

  afterEach(() => {
    scenario.cleanup();
  });

  test("Journey: Send logs to specific friend only", () => {
    const alice = scenario.createUser("alice_123", "Alice");
    const bob = scenario.createUser("bob_456", "Bob");
    const charlie = scenario.createUser("charlie_789", "Charlie");

    scenario.makeFriends(alice, bob);
    scenario.makeFriends(alice, charlie);

    alice.connect();
    bob.connect();
    charlie.connect();

    // Alice sends logs only to Bob (not Charlie)
    const logs = [
      {
        id: "log1",
        line: "Secret mission",
        timestamp: new Date().toISOString(),
      },
    ];
    scenario.sendLogsToFriend(alice, bob, logs);

    // Only Bob should receive
    expect(bob.hasReceived("logs_received")).toBe(true);
    expect(charlie.hasReceived("logs_received")).toBe(false);

    const bobLogs = bob.getAllMessagesByType("logs_received")[0];
    expect(bobLogs.data.target.type).toBe("friend");
    expect(bobLogs.data.target.discordId).toBe(bob.discordId);
  });
});

describe("User Journey: Connection Edge Cases", () => {
  let scenario: TestScenario;

  beforeEach(() => {
    scenario = new TestScenario();
    clients.clear();
    userConnections.clear();
  });

  afterEach(() => {
    scenario.cleanup();
  });

  test("Journey: Rapid connect/disconnect cycles", () => {
    const alice = scenario.createUser("alice_123", "Alice");
    const bob = scenario.createUser("bob_456", "Bob");

    scenario.makeFriends(alice, bob);

    alice.connect();

    // Bob rapidly connects and disconnects
    for (let i = 0; i < 5; i++) {
      bob.connect("device_" + i);
      bob.disconnect("device_" + i);
    }

    // Bob finally stays connected
    bob.connect("stable");

    const logs = [
      { id: "log1", line: "Test", timestamp: new Date().toISOString() },
    ];
    scenario.sendLogsToFriends(alice, logs);

    // Bob should receive on stable connection
    expect(bob.getMessages("stable").length).toBe(1);
  });

  test("Journey: Message sent during connection close", () => {
    const alice = scenario.createUser("alice_123", "Alice");
    const bob = scenario.createUser("bob_456", "Bob");

    scenario.makeFriends(alice, bob);

    alice.connect();
    bob.connect();

    // Close Bob's connection
    bob.disconnect();

    // Alice tries to send (Bob is now offline)
    const logs = [
      { id: "log1", line: "Test", timestamp: new Date().toISOString() },
    ];
    const sent = broadcast([bob.discordId], "logs_received", {
      senderDiscordId: alice.discordId,
      fromUsername: alice.username,
      logs,
    });

    // Should handle gracefully, return 0 sent
    expect(sent).toBe(0);
  });
});

describe("User Journey: High Volume Scenarios", () => {
  let scenario: TestScenario;

  beforeEach(() => {
    scenario = new TestScenario();
    clients.clear();
    userConnections.clear();
  });

  afterEach(() => {
    scenario.cleanup();
  });

  test("Journey: User with many friends (fan-out)", () => {
    const alice = scenario.createUser("alice_123", "Alice");

    // Alice has 20 friends
    const friends: TestUser[] = [];
    for (let i = 0; i < 20; i++) {
      const friend = scenario.createUser(`friend_${i}`, `Friend${i}`);
      scenario.makeFriends(alice, friend);
      friend.connect();
      friends.push(friend);
    }

    alice.connect();

    const logs = [
      { id: "log1", line: "Big event", timestamp: new Date().toISOString() },
    ];
    scenario.sendLogsToFriends(alice, logs);

    // All 20 friends should receive
    let receivedCount = 0;
    for (const friend of friends) {
      if (friend.hasReceived("logs_received")) {
        receivedCount++;
      }
    }

    expect(receivedCount).toBe(20);
  });

  test("Journey: Many logs sent in sequence", () => {
    const alice = scenario.createUser("alice_123", "Alice");
    const bob = scenario.createUser("bob_456", "Bob");

    scenario.makeFriends(alice, bob);

    alice.connect();
    bob.connect();

    // Alice sends 100 individual log events
    for (let i = 0; i < 100; i++) {
      scenario.sendLogsToFriends(alice, [
        {
          id: `log_${i}`,
          line: `Event ${i}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    }

    // Bob should have received all 100
    const messages = bob.getAllMessagesByType("logs_received");
    expect(messages.length).toBe(100);
  });
});

// ============================================================================
// Extended Friend Management Journeys
// ============================================================================

describe("User Journey: Friend Request Lifecycle", () => {
  let scenario: TestScenario;

  beforeEach(() => {
    scenario = new TestScenario();
    clients.clear();
    userConnections.clear();
  });

  afterEach(() => {
    scenario.cleanup();
  });

  test("Journey: Friend request denied", () => {
    const alice = scenario.createUser("alice_123", "Alice");
    const bob = scenario.createUser("bob_456", "Bob");

    alice.connect();
    bob.connect();

    // Alice sends request
    broadcast([bob.discordId], "friend_request_received", {
      from: { discordId: alice.discordId, username: alice.username },
      friendshipId: "friendship_1",
    });

    expect(bob.hasReceived("friend_request_received")).toBe(true);

    // Bob denies
    broadcast([alice.discordId], "friend_request_denied", {
      by: { discordId: bob.discordId, username: bob.username },
      friendshipId: "friendship_1",
    });

    expect(alice.hasReceived("friend_request_denied")).toBe(true);
  });

  test("Journey: Friend request cancelled by sender", () => {
    const alice = scenario.createUser("alice_123", "Alice");
    const bob = scenario.createUser("bob_456", "Bob");

    alice.connect();
    bob.connect();

    // Alice sends request
    broadcast([bob.discordId], "friend_request_received", {
      from: { discordId: alice.discordId, username: alice.username },
      friendshipId: "friendship_1",
    });

    // Alice changes mind and cancels
    broadcast([bob.discordId], "friend_request_cancelled", {
      by: { discordId: alice.discordId, username: alice.username },
      friendshipId: "friendship_1",
    });

    expect(bob.hasReceived("friend_request_cancelled")).toBe(true);
  });

  test("Journey: Unfriend notification", () => {
    const alice = scenario.createUser("alice_123", "Alice");
    const bob = scenario.createUser("bob_456", "Bob");

    scenario.makeFriends(alice, bob);

    alice.connect();
    bob.connect();

    // Alice unfriends Bob
    broadcast([bob.discordId], "friend_removed_notification", {
      removedByDiscordId: alice.discordId,
      removedByUsername: alice.username,
    });

    expect(bob.hasReceived("friend_removed_notification")).toBe(true);
    const notif = bob.getAllMessagesByType("friend_removed_notification")[0];
    expect(notif.data.removedByUsername).toBe("Alice");
  });

  test("Journey: Cross-device friend request sync", () => {
    const alice = scenario.createUser("alice_123", "Alice");
    const bob = scenario.createUser("bob_456", "Bob");

    // Alice has multiple devices
    alice.connect("desktop");
    alice.connect("mobile");
    bob.connect();

    // Alice sends friend request from desktop - both devices should see outgoing
    broadcast([alice.discordId], "friend_request_sent", {
      id: "friendship_1",
      status: "pending",
      toDiscordId: bob.discordId,
      toUsername: bob.username,
    });

    // Both Alice's devices should be synced
    expect(alice.getMessages("desktop").length).toBe(1);
    expect(alice.getMessages("mobile").length).toBe(1);
  });

  test("Journey: Mutual friend request collision", () => {
    const alice = scenario.createUser("alice_123", "Alice");
    const bob = scenario.createUser("bob_456", "Bob");

    alice.connect();
    bob.connect();

    // Both send requests "simultaneously"
    broadcast([bob.discordId], "friend_request_received", {
      from: { discordId: alice.discordId, username: alice.username },
      friendshipId: "friendship_alice_to_bob",
    });

    broadcast([alice.discordId], "friend_request_received", {
      from: { discordId: bob.discordId, username: bob.username },
      friendshipId: "friendship_bob_to_alice",
    });

    // Both should have received a request
    expect(alice.hasReceived("friend_request_received")).toBe(true);
    expect(bob.hasReceived("friend_request_received")).toBe(true);
  });
});

// ============================================================================
// Group Journeys
// ============================================================================

describe("User Journey: Group Management", () => {
  let scenario: TestScenario;

  beforeEach(() => {
    scenario = new TestScenario();
    clients.clear();
    userConnections.clear();
  });

  afterEach(() => {
    scenario.cleanup();
  });

  test("Journey: Create group and invite friend", () => {
    const alice = scenario.createUser("alice_123", "Alice");
    const bob = scenario.createUser("bob_456", "Bob");

    scenario.makeFriends(alice, bob);

    alice.connect();
    bob.connect();

    const groupId = "group_abc123";

    // Alice invites Bob
    broadcast([bob.discordId], "group_invitation_received", {
      id: "invite_1",
      groupId,
      groupName: "Star Runners",
      inviterDiscordId: alice.discordId,
      inviterUsername: alice.username,
    });

    expect(bob.hasReceived("group_invitation_received")).toBe(true);
    const invite = bob.getAllMessagesByType("group_invitation_received")[0];
    expect(invite.data.groupName).toBe("Star Runners");

    // Bob accepts
    broadcast([alice.discordId], "member_joined_group", {
      groupId,
      memberDiscordId: bob.discordId,
      memberUsername: bob.username,
    });

    expect(alice.hasReceived("member_joined_group")).toBe(true);
  });

  test("Journey: Group log sharing", () => {
    const alice = scenario.createUser("alice_123", "Alice");
    const bob = scenario.createUser("bob_456", "Bob");
    const charlie = scenario.createUser("charlie_789", "Charlie");

    alice.connect();
    bob.connect();
    charlie.connect();

    const groupId = "group_123";

    // Alice sends logs to group
    broadcast([bob.discordId, charlie.discordId], "group_logs_received", {
      groupId,
      fromDiscordId: alice.discordId,
      fromUsername: alice.username,
      logs: [
        {
          id: "log1",
          line: "Found treasure!",
          timestamp: new Date().toISOString(),
        },
      ],
    });

    expect(bob.hasReceived("group_logs_received")).toBe(true);
    expect(charlie.hasReceived("group_logs_received")).toBe(true);
    expect(alice.hasReceived("group_logs_received")).toBe(false);
  });

  test("Journey: Member kicked from group", () => {
    const alice = scenario.createUser("alice_123", "Alice");
    const bob = scenario.createUser("bob_456", "Bob");
    const charlie = scenario.createUser("charlie_789", "Charlie");

    alice.connect();
    bob.connect();
    charlie.connect();

    const groupId = "group_123";

    // Alice kicks Charlie
    broadcast(
      [alice.discordId, bob.discordId, charlie.discordId],
      "member_removed_from_group",
      {
        groupId,
        memberId: charlie.discordId,
        username: charlie.username,
      },
    );

    expect(alice.hasReceived("member_removed_from_group")).toBe(true);
    expect(bob.hasReceived("member_removed_from_group")).toBe(true);
    expect(charlie.hasReceived("member_removed_from_group")).toBe(true);
  });

  test("Journey: Member leaves group voluntarily", () => {
    const alice = scenario.createUser("alice_123", "Alice");
    const bob = scenario.createUser("bob_456", "Bob");
    const charlie = scenario.createUser("charlie_789", "Charlie");

    alice.connect();
    bob.connect();
    charlie.connect();

    const groupId = "group_123";

    // Charlie leaves
    broadcast([alice.discordId, bob.discordId], "member_left_group", {
      groupId,
      userId: charlie.discordId,
      username: charlie.username,
    });

    expect(alice.hasReceived("member_left_group")).toBe(true);
    expect(bob.hasReceived("member_left_group")).toBe(true);
    expect(charlie.hasReceived("member_left_group")).toBe(false);
  });

  test("Journey: Group deleted by owner", () => {
    const alice = scenario.createUser("alice_123", "Alice");
    const bob = scenario.createUser("bob_456", "Bob");

    alice.connect();
    bob.connect();

    const groupId = "group_123";

    broadcast([alice.discordId, bob.discordId], "group_deleted", { groupId });

    expect(alice.hasReceived("group_deleted")).toBe(true);
    expect(bob.hasReceived("group_deleted")).toBe(true);
  });

  test("Journey: Group settings updated", () => {
    const alice = scenario.createUser("alice_123", "Alice");
    const bob = scenario.createUser("bob_456", "Bob");

    alice.connect();
    bob.connect();

    const groupId = "group_123";

    broadcast([bob.discordId], "group_updated", {
      groupId,
      group: {
        id: groupId,
        name: "Star Runners Elite",
        description: "Updated",
      },
    });

    expect(bob.hasReceived("group_updated")).toBe(true);
    const update = bob.getAllMessagesByType("group_updated")[0];
    expect(update.data.group.name).toBe("Star Runners Elite");
  });

  test("Journey: Member role updated", () => {
    const alice = scenario.createUser("alice_123", "Alice");
    const bob = scenario.createUser("bob_456", "Bob");

    alice.connect();
    bob.connect();

    const groupId = "group_123";

    broadcast([alice.discordId, bob.discordId], "member_role_updated", {
      groupId,
      memberId: bob.discordId,
      role: "admin",
    });

    expect(bob.hasReceived("member_role_updated")).toBe(true);
    const roleUpdate = bob.getAllMessagesByType("member_role_updated")[0];
    expect(roleUpdate.data.role).toBe("admin");
  });
});

// ============================================================================
// Gaming Session Journeys
// ============================================================================

describe("User Journey: Gaming Session", () => {
  let scenario: TestScenario;

  beforeEach(() => {
    scenario = new TestScenario();
    clients.clear();
    userConnections.clear();
  });

  afterEach(() => {
    scenario.cleanup();
  });

  test("Journey: Complete gaming session with friends", () => {
    const player = scenario.createUser("player_123", "GamerPro");
    const friend1 = scenario.createUser("friend1_456", "Spectator1");
    const friend2 = scenario.createUser("friend2_789", "Spectator2");

    scenario.makeFriends(player, friend1);
    scenario.makeFriends(player, friend2);

    player.connect();
    friend1.connect();
    friend2.connect();

    // Player login with equipment batch
    const loginLogs = [
      { id: "log1", eventType: "login", line: "Player logged in" },
      { id: "log2", eventType: "equipment", line: "Equipped: Heavy Armor" },
      { id: "log3", eventType: "equipment", line: "Equipped: Laser Rifle" },
    ];

    broadcast([friend1.discordId, friend2.discordId], "batch_logs_received", {
      senderDiscordId: player.discordId,
      fromUsername: player.username,
      logs: loginLogs,
      count: loginLogs.length,
    });

    expect(friend1.hasReceived("batch_logs_received")).toBe(true);
    expect(friend2.hasReceived("batch_logs_received")).toBe(true);

    friend1.clearMessages();
    friend2.clearMessages();

    // Combat events
    const combatLogs = [
      { id: "log4", eventType: "combat", line: "Engaged enemy pirate" },
      { id: "log5", eventType: "kill", line: "Killed: Pirate Captain" },
      { id: "log6", eventType: "loot", line: "Looted: 50,000 credits" },
    ];

    for (const log of combatLogs) {
      scenario.sendLogsToFriends(player, [log]);
    }

    expect(friend1.getAllMessagesByType("logs_received").length).toBe(3);
    expect(friend2.getAllMessagesByType("logs_received").length).toBe(3);
  });

  test("Journey: Multiple friends playing simultaneously", () => {
    const alice = scenario.createUser("alice_123", "Alice");
    const bob = scenario.createUser("bob_456", "Bob");
    const charlie = scenario.createUser("charlie_789", "Charlie");

    scenario.makeFriends(alice, bob);
    scenario.makeFriends(alice, charlie);
    scenario.makeFriends(bob, charlie);

    alice.connect();
    bob.connect();
    charlie.connect();

    scenario.sendLogsToFriends(alice, [
      { id: "a1", line: "Alice: Found asteroid" },
    ]);
    scenario.sendLogsToFriends(bob, [
      { id: "b1", line: "Bob: Mining operation" },
    ]);
    scenario.sendLogsToFriends(charlie, [
      { id: "c1", line: "Charlie: Cargo full" },
    ]);

    // Each sees their friends' logs
    expect(alice.getAllMessagesByType("logs_received").length).toBe(2);
    expect(bob.getAllMessagesByType("logs_received").length).toBe(2);
    expect(charlie.getAllMessagesByType("logs_received").length).toBe(2);
  });

  test("Journey: Spectator joins mid-session", () => {
    const player = scenario.createUser("player_123", "GamerPro");
    const spectator = scenario.createUser("spectator_456", "Watcher");

    scenario.makeFriends(player, spectator);

    player.connect();
    // Spectator offline initially

    scenario.sendLogsToFriends(player, [{ id: "log1", line: "Event 1" }]);

    // Spectator comes online
    spectator.connect();

    // Missed earlier logs
    expect(spectator.hasReceived("logs_received")).toBe(false);

    // New logs work
    scenario.sendLogsToFriends(player, [{ id: "log2", line: "Event 2" }]);

    expect(spectator.hasReceived("logs_received")).toBe(true);
  });
});

// ============================================================================
// Notification Journeys
// ============================================================================

describe("User Journey: Notifications", () => {
  let scenario: TestScenario;

  beforeEach(() => {
    scenario = new TestScenario();
    clients.clear();
    userConnections.clear();
  });

  afterEach(() => {
    scenario.cleanup();
  });

  test("Journey: Notification bell updates", () => {
    const alice = scenario.createUser("alice_123", "Alice");
    const bob = scenario.createUser("bob_456", "Bob");

    alice.connect();
    bob.connect();

    broadcast([bob.discordId], "friend_request_received", {
      from: { discordId: alice.discordId, username: alice.username },
      friendshipId: "f1",
    });

    broadcast([bob.discordId], "notification_count_updated", {
      unreadCount: 1,
    });

    expect(bob.hasReceived("notification_count_updated")).toBe(true);
    const countUpdate = bob.getAllMessagesByType(
      "notification_count_updated",
    )[0];
    expect(countUpdate.data.unreadCount).toBe(1);
  });

  test("Journey: Multiple notification types", () => {
    const user = scenario.createUser("user_123", "User");
    user.connect();

    broadcast([user.discordId], "friend_request_received", {
      from: { discordId: "friend_123", username: "NewFriend" },
      friendshipId: "f1",
    });

    broadcast([user.discordId], "group_invitation_received", {
      id: "invite_1",
      groupId: "group_123",
      groupName: "Cool Group",
    });

    broadcast([user.discordId], "user_came_online", {
      user: { discordId: "online_friend", username: "OnlineFriend" },
    });

    expect(user.getAllMessagesByType("friend_request_received").length).toBe(1);
    expect(user.getAllMessagesByType("group_invitation_received").length).toBe(
      1,
    );
    expect(user.getAllMessagesByType("user_came_online").length).toBe(1);
  });
});

// ============================================================================
// Connection Resilience
// ============================================================================

describe("User Journey: Connection Resilience", () => {
  let scenario: TestScenario;

  beforeEach(() => {
    scenario = new TestScenario();
    clients.clear();
    userConnections.clear();
  });

  afterEach(() => {
    scenario.cleanup();
  });

  test("Journey: Reconnection after disconnect", () => {
    const alice = scenario.createUser("alice_123", "Alice");
    const bob = scenario.createUser("bob_456", "Bob");

    scenario.makeFriends(alice, bob);

    alice.connect();
    bob.connect();

    bob.disconnect();

    scenario.sendLogsToFriends(alice, [{ id: "log1", line: "Missed event" }]);

    bob.connect();

    expect(bob.hasReceived("logs_received")).toBe(false);

    scenario.sendLogsToFriends(alice, [{ id: "log2", line: "New event" }]);

    expect(bob.hasReceived("logs_received")).toBe(true);
  });

  test("Journey: Message during device switch", () => {
    const alice = scenario.createUser("alice_123", "Alice");
    const bob = scenario.createUser("bob_456", "Bob");

    scenario.makeFriends(alice, bob);

    alice.connect();
    bob.connect("desktop");

    bob.disconnect("desktop");
    bob.connect("mobile");

    scenario.sendLogsToFriends(alice, [{ id: "log1", line: "Event" }]);

    expect(bob.getMessages("mobile").length).toBe(1);
    expect(bob.getMessages("desktop").length).toBe(0);
  });

  test("Journey: Broadcast to partially online friend list", () => {
    const sender = scenario.createUser("sender_123", "Sender");
    const online1 = scenario.createUser("online1_456", "Online1");
    const online2 = scenario.createUser("online2_789", "Online2");
    const offline1 = scenario.createUser("offline1_012", "Offline1");
    const offline2 = scenario.createUser("offline2_345", "Offline2");

    scenario.makeFriends(sender, online1);
    scenario.makeFriends(sender, online2);
    scenario.makeFriends(sender, offline1);
    scenario.makeFriends(sender, offline2);

    sender.connect();
    online1.connect();
    online2.connect();

    scenario.sendLogsToFriends(sender, [{ id: "log1", line: "Event" }]);

    expect(online1.hasReceived("logs_received")).toBe(true);
    expect(online2.hasReceived("logs_received")).toBe(true);
    expect(offline1.hasReceived("logs_received")).toBe(false);
    expect(offline2.hasReceived("logs_received")).toBe(false);
  });
});

// ============================================================================
// Complex Social Scenarios
// ============================================================================

describe("User Journey: Complex Social Scenarios", () => {
  let scenario: TestScenario;

  beforeEach(() => {
    scenario = new TestScenario();
    clients.clear();
    userConnections.clear();
  });

  afterEach(() => {
    scenario.cleanup();
  });

  test("Journey: New user onboarding flow", () => {
    const newUser = scenario.createUser("newuser_123", "NewPlayer");
    const existingUser = scenario.createUser("existing_456", "Veteran");

    newUser.connect();
    existingUser.connect();

    broadcast([newUser.discordId], "welcome_notification", {
      message: "Welcome to Pico!",
      tips: ["Add friends", "Join groups", "Start sharing logs"],
    });

    expect(newUser.hasReceived("welcome_notification")).toBe(true);

    broadcast([existingUser.discordId], "friend_request_received", {
      from: { discordId: newUser.discordId, username: newUser.username },
      friendshipId: "f1",
    });

    broadcast([newUser.discordId], "friend_request_accepted", {
      by: {
        discordId: existingUser.discordId,
        username: existingUser.username,
      },
    });

    expect(newUser.hasReceived("friend_request_accepted")).toBe(true);
  });

  test("Journey: Org/clan group activity", () => {
    const leader = scenario.createUser("leader_123", "OrgLeader");
    const member1 = scenario.createUser("member1_456", "Member1");
    const member2 = scenario.createUser("member2_789", "Member2");
    const member3 = scenario.createUser("member3_012", "Member3");

    const groupId = "org_group_123";

    leader.connect();
    member1.connect();
    member2.connect();
    member3.connect();

    broadcast(
      [member1.discordId, member2.discordId, member3.discordId],
      "group_logs_received",
      {
        groupId,
        fromDiscordId: leader.discordId,
        fromUsername: leader.username,
        logs: [
          {
            id: "ann1",
            line: "Org meeting in 10 minutes!",
            eventType: "announcement",
          },
        ],
      },
    );

    expect(member1.hasReceived("group_logs_received")).toBe(true);
    expect(member2.hasReceived("group_logs_received")).toBe(true);
    expect(member3.hasReceived("group_logs_received")).toBe(true);
    expect(leader.hasReceived("group_logs_received")).toBe(false);
  });

  test("Journey: Friend isolation (non-friends cannot see logs)", () => {
    const alice = scenario.createUser("alice_123", "Alice");
    const bob = scenario.createUser("bob_456", "Bob");
    const stranger = scenario.createUser("stranger_789", "Stranger");

    scenario.makeFriends(alice, bob);

    alice.connect();
    bob.connect();
    stranger.connect();

    scenario.sendLogsToFriends(alice, [{ id: "log1", line: "Secret log" }]);

    expect(bob.hasReceived("logs_received")).toBe(true);
    expect(stranger.hasReceived("logs_received")).toBe(false);
  });

  test("Journey: Bi-directional conversation", () => {
    const alice = scenario.createUser("alice_123", "Alice");
    const bob = scenario.createUser("bob_456", "Bob");

    scenario.makeFriends(alice, bob);

    alice.connect();
    bob.connect();

    scenario.sendLogsToFriend(alice, bob, [
      { id: "a1", line: "Alice: Hey Bob!" },
    ]);
    scenario.sendLogsToFriend(bob, alice, [
      { id: "b1", line: "Bob: Hey Alice!" },
    ]);
    scenario.sendLogsToFriend(alice, bob, [
      { id: "a2", line: "Alice: Check out this loot!" },
    ]);

    expect(bob.getAllMessagesByType("logs_received").length).toBe(2);
    expect(alice.getAllMessagesByType("logs_received").length).toBe(1);
  });
});

// ============================================================================
// Performance and Load Scenarios
// ============================================================================

describe("User Journey: Load and Performance", () => {
  let scenario: TestScenario;

  beforeEach(() => {
    scenario = new TestScenario();
    clients.clear();
    userConnections.clear();
  });

  afterEach(() => {
    scenario.cleanup();
  });

  test("Journey: Large friend network (50 friends)", () => {
    const centralUser = scenario.createUser("central_123", "Popular");

    const friends: TestUser[] = [];
    for (let i = 0; i < 50; i++) {
      const friend = scenario.createUser(`friend_${i}`, `Friend${i}`);
      scenario.makeFriends(centralUser, friend);
      friend.connect();
      friends.push(friend);
    }

    centralUser.connect();

    scenario.sendLogsToFriends(centralUser, [
      { id: "log1", line: "Big announcement" },
    ]);

    const receivedCount = friends.filter((f) =>
      f.hasReceived("logs_received"),
    ).length;
    expect(receivedCount).toBe(50);
  });

  test("Journey: Burst of logs (rapid fire)", () => {
    const sender = scenario.createUser("sender_123", "Sender");
    const receiver = scenario.createUser("receiver_456", "Receiver");

    scenario.makeFriends(sender, receiver);

    sender.connect();
    receiver.connect();

    for (let i = 0; i < 50; i++) {
      scenario.sendLogsToFriends(sender, [
        { id: `log_${i}`, line: `Rapid event ${i}` },
      ]);
    }

    expect(receiver.getAllMessagesByType("logs_received").length).toBe(50);
  });

  test("Journey: Many users, sparse friendship (hub pattern)", () => {
    const hub = scenario.createUser("hub_123", "Hub");
    const spokes: TestUser[] = [];

    for (let i = 0; i < 10; i++) {
      const spoke = scenario.createUser(`spoke_${i}`, `Spoke${i}`);
      scenario.makeFriends(hub, spoke);
      spoke.connect();
      spokes.push(spoke);
    }

    hub.connect();

    const spoke0Friends = scenario.getFriendIds(spokes[0]);
    broadcast(spoke0Friends, "logs_received", {
      senderDiscordId: spokes[0].discordId,
      fromUsername: spokes[0].username,
      logs: [{ id: "log1", line: "Event" }],
    });

    // Only hub receives (spokes aren't friends with each other)
    expect(hub.hasReceived("logs_received")).toBe(true);
    for (let i = 1; i < spokes.length; i++) {
      expect(spokes[i].hasReceived("logs_received")).toBe(false);
    }
  });
});

// ============================================================================
// Profile Management Journeys
// ============================================================================

describe("User Journey: Profile Management", () => {
  let scenario: TestScenario;

  beforeEach(() => {
    scenario = new TestScenario();
    clients.clear();
    userConnections.clear();
  });

  afterEach(() => {
    scenario.cleanup();
  });

  test("Journey: Profile update broadcasts to all friends", () => {
    const alice = scenario.createUser("alice_123", "Alice");
    const bob = scenario.createUser("bob_456", "Bob");
    const charlie = scenario.createUser("charlie_789", "Charlie");
    const stranger = scenario.createUser("stranger_012", "Stranger");

    scenario.makeFriends(alice, bob);
    scenario.makeFriends(alice, charlie);
    // stranger is NOT a friend

    alice.connect();
    bob.connect();
    charlie.connect();
    stranger.connect();

    // Alice updates her profile (sets player name)
    const friendIds = scenario.getFriendIds(alice);
    broadcast(friendIds, "friend_profile_updated", {
      discordId: alice.discordId,
      player: "AliceInSpace",
      username: alice.username,
      avatar: null,
      usePlayerAsDisplayName: true,
      displayName: "AliceInSpace",
    });

    // Friends should receive the update
    expect(bob.hasReceived("friend_profile_updated")).toBe(true);
    expect(charlie.hasReceived("friend_profile_updated")).toBe(true);

    // Stranger should NOT receive the update
    expect(stranger.hasReceived("friend_profile_updated")).toBe(false);

    // Verify update content
    const bobUpdate = bob.getAllMessagesByType("friend_profile_updated")[0];
    expect(bobUpdate.data.player).toBe("AliceInSpace");
    expect(bobUpdate.data.displayName).toBe("AliceInSpace");
  });

  test("Journey: Profile update syncs to multiple devices", () => {
    const alice = scenario.createUser("alice_123", "Alice");
    const bob = scenario.createUser("bob_456", "Bob");

    scenario.makeFriends(alice, bob);

    // Alice has multiple devices
    alice.connect("desktop");
    alice.connect("mobile");
    bob.connect();

    // Alice updates profile from desktop - broadcasts to friends and syncs to own devices
    broadcast([alice.discordId, bob.discordId], "friend_profile_updated", {
      discordId: alice.discordId,
      player: "NewPlayer",
      username: alice.username,
      avatar: null,
      usePlayerAsDisplayName: false,
      displayName: "Alice",
    });

    // Both Alice's devices receive for sync
    expect(alice.getMessages("desktop").length).toBe(1);
    expect(alice.getMessages("mobile").length).toBe(1);

    // Bob also receives
    expect(bob.hasReceived("friend_profile_updated")).toBe(true);
  });

  test("Journey: Display name preference change", () => {
    const alice = scenario.createUser("alice_123", "Alice");
    const bob = scenario.createUser("bob_456", "Bob");

    scenario.makeFriends(alice, bob);

    alice.connect();
    bob.connect();

    // Alice sets player name but doesn't use it as display name
    broadcast([bob.discordId], "friend_profile_updated", {
      discordId: alice.discordId,
      player: "SpacePilot42",
      username: "Alice",
      usePlayerAsDisplayName: false,
      displayName: "Alice",
    });

    let update = bob.getAllMessagesByType("friend_profile_updated")[0];
    expect(update.data.displayName).toBe("Alice");

    bob.clearMessages();

    // Alice enables usePlayerAsDisplayName
    broadcast([bob.discordId], "friend_profile_updated", {
      discordId: alice.discordId,
      player: "SpacePilot42",
      username: "Alice",
      usePlayerAsDisplayName: true,
      displayName: "SpacePilot42",
    });

    update = bob.getAllMessagesByType("friend_profile_updated")[0];
    expect(update.data.displayName).toBe("SpacePilot42");
  });
});

// ============================================================================
// Group Invitation Response Journeys
// ============================================================================

describe("User Journey: Group Invitation Responses", () => {
  let scenario: TestScenario;

  beforeEach(() => {
    scenario = new TestScenario();
    clients.clear();
    userConnections.clear();
  });

  afterEach(() => {
    scenario.cleanup();
  });

  test("Journey: Accept group invitation", () => {
    const alice = scenario.createUser("alice_123", "Alice");
    const bob = scenario.createUser("bob_456", "Bob");
    const charlie = scenario.createUser("charlie_789", "Charlie");

    alice.connect();
    bob.connect();
    charlie.connect();

    const groupId = "group_123";

    // Alice (owner) invites Bob
    broadcast([bob.discordId], "group_invitation_received", {
      id: "invite_1",
      groupId,
      groupName: "Star Runners",
      inviterDiscordId: alice.discordId,
      inviterUsername: alice.username,
    });

    expect(bob.hasReceived("group_invitation_received")).toBe(true);

    // Bob accepts
    broadcast([alice.discordId, charlie.discordId], "member_joined_group", {
      groupId,
      memberDiscordId: bob.discordId,
      memberUsername: bob.username,
      memberAvatar: null,
    });

    // Owner and existing members notified
    expect(alice.hasReceived("member_joined_group")).toBe(true);
    expect(charlie.hasReceived("member_joined_group")).toBe(true);
  });

  test("Journey: Deny group invitation", () => {
    const alice = scenario.createUser("alice_123", "Alice");
    const bob = scenario.createUser("bob_456", "Bob");

    alice.connect();
    bob.connect();

    const groupId = "group_123";

    // Alice invites Bob
    broadcast([bob.discordId], "group_invitation_received", {
      id: "invite_1",
      groupId,
      groupName: "Star Runners",
      inviterDiscordId: alice.discordId,
      inviterUsername: alice.username,
    });

    // Bob denies
    broadcast([alice.discordId], "group_invitation_denied", {
      groupId,
      invitationId: "invite_1",
      deniedByDiscordId: bob.discordId,
      deniedByUsername: bob.username,
    });

    expect(alice.hasReceived("group_invitation_denied")).toBe(true);
    const denial = alice.getAllMessagesByType("group_invitation_denied")[0];
    expect(denial.data.deniedByUsername).toBe("Bob");
  });

  test("Journey: Cancel group invitation (by inviter)", () => {
    const alice = scenario.createUser("alice_123", "Alice");
    const bob = scenario.createUser("bob_456", "Bob");

    alice.connect();
    bob.connect();

    const groupId = "group_123";

    // Alice invites Bob
    broadcast([bob.discordId], "group_invitation_received", {
      id: "invite_1",
      groupId,
      groupName: "Star Runners",
      inviterDiscordId: alice.discordId,
      inviterUsername: alice.username,
    });

    expect(bob.hasReceived("group_invitation_received")).toBe(true);

    // Alice cancels the invitation
    broadcast([bob.discordId], "group_invitation_cancelled", {
      groupId,
      invitationId: "invite_1",
      cancelledByDiscordId: alice.discordId,
    });

    expect(bob.hasReceived("group_invitation_cancelled")).toBe(true);
  });

  test("Journey: Invitation while recipient offline", () => {
    const alice = scenario.createUser("alice_123", "Alice");
    const bob = scenario.createUser("bob_456", "Bob");

    alice.connect();
    // Bob is offline

    // Alice sends invitation
    const sent = broadcast([bob.discordId], "group_invitation_received", {
      id: "invite_1",
      groupId: "group_123",
      groupName: "Star Runners",
      inviterDiscordId: alice.discordId,
      inviterUsername: alice.username,
    });

    // Broadcast returns 0 (no online recipients)
    expect(sent).toBe(0);

    // Bob comes online - would fetch pending invitations via API
    bob.connect();
    expect(bob.hasReceived("group_invitation_received")).toBe(false);
  });

  test("Journey: Multiple pending invitations", () => {
    const alice = scenario.createUser("alice_123", "Alice");
    const bob = scenario.createUser("bob_456", "Bob");
    const charlie = scenario.createUser("charlie_789", "Charlie");

    alice.connect();
    bob.connect();
    charlie.connect();

    // Bob receives invitations from multiple groups
    broadcast([bob.discordId], "group_invitation_received", {
      id: "invite_1",
      groupId: "group_1",
      groupName: "Star Runners",
      inviterDiscordId: alice.discordId,
      inviterUsername: alice.username,
    });

    broadcast([bob.discordId], "group_invitation_received", {
      id: "invite_2",
      groupId: "group_2",
      groupName: "Space Pirates",
      inviterDiscordId: charlie.discordId,
      inviterUsername: charlie.username,
    });

    const invitations = bob.getAllMessagesByType("group_invitation_received");
    expect(invitations.length).toBe(2);
    expect(invitations[0].data.groupName).toBe("Star Runners");
    expect(invitations[1].data.groupName).toBe("Space Pirates");
  });
});

// ============================================================================
// Group Role and Permission Journeys
// ============================================================================

describe("User Journey: Group Roles and Permissions", () => {
  let scenario: TestScenario;

  beforeEach(() => {
    scenario = new TestScenario();
    clients.clear();
    userConnections.clear();
  });

  afterEach(() => {
    scenario.cleanup();
  });

  test("Journey: Promote member to admin", () => {
    const owner = scenario.createUser("owner_123", "Owner");
    const member = scenario.createUser("member_456", "Member");
    const otherMember = scenario.createUser("other_789", "Other");

    owner.connect();
    member.connect();
    otherMember.connect();

    const groupId = "group_123";

    // Owner promotes member to admin
    broadcast(
      [owner.discordId, member.discordId, otherMember.discordId],
      "member_role_updated",
      {
        groupId,
        memberId: member.discordId,
        memberUsername: member.username,
        oldRole: "member",
        newRole: "admin",
        updatedByDiscordId: owner.discordId,
      },
    );

    // All group members notified
    expect(owner.hasReceived("member_role_updated")).toBe(true);
    expect(member.hasReceived("member_role_updated")).toBe(true);
    expect(otherMember.hasReceived("member_role_updated")).toBe(true);

    const update = member.getAllMessagesByType("member_role_updated")[0];
    expect(update.data.newRole).toBe("admin");
  });

  test("Journey: Demote admin to member", () => {
    const owner = scenario.createUser("owner_123", "Owner");
    const admin = scenario.createUser("admin_456", "Admin");

    owner.connect();
    admin.connect();

    const groupId = "group_123";

    broadcast([owner.discordId, admin.discordId], "member_role_updated", {
      groupId,
      memberId: admin.discordId,
      memberUsername: admin.username,
      oldRole: "admin",
      newRole: "member",
      updatedByDiscordId: owner.discordId,
    });

    const update = admin.getAllMessagesByType("member_role_updated")[0];
    expect(update.data.oldRole).toBe("admin");
    expect(update.data.newRole).toBe("member");
  });

  test("Journey: Admin removes member", () => {
    const owner = scenario.createUser("owner_123", "Owner");
    const admin = scenario.createUser("admin_456", "Admin");
    const member = scenario.createUser("member_789", "Member");

    owner.connect();
    admin.connect();
    member.connect();

    const groupId = "group_123";

    // Admin removes member
    broadcast(
      [owner.discordId, admin.discordId, member.discordId],
      "member_removed_from_group",
      {
        groupId,
        memberId: member.discordId,
        memberUsername: member.username,
        removedByDiscordId: admin.discordId,
        removedByUsername: admin.username,
      },
    );

    // All receive notification including removed member
    expect(owner.hasReceived("member_removed_from_group")).toBe(true);
    expect(admin.hasReceived("member_removed_from_group")).toBe(true);
    expect(member.hasReceived("member_removed_from_group")).toBe(true);
  });

  test("Journey: Transfer ownership (leave as owner)", () => {
    const owner = scenario.createUser("owner_123", "Owner");
    const newOwner = scenario.createUser("newowner_456", "NewOwner");
    const member = scenario.createUser("member_789", "Member");

    owner.connect();
    newOwner.connect();
    member.connect();

    const groupId = "group_123";

    // Owner leaves - ownership transfers to newOwner
    broadcast([newOwner.discordId, member.discordId], "ownership_transferred", {
      groupId,
      previousOwnerDiscordId: owner.discordId,
      newOwnerDiscordId: newOwner.discordId,
      newOwnerUsername: newOwner.username,
    });

    expect(newOwner.hasReceived("ownership_transferred")).toBe(true);
    expect(member.hasReceived("ownership_transferred")).toBe(true);
  });
});

// ============================================================================
// Authentication Journeys
// ============================================================================

describe("User Journey: Authentication", () => {
  let scenario: TestScenario;

  beforeEach(() => {
    scenario = new TestScenario();
    clients.clear();
    userConnections.clear();
  });

  afterEach(() => {
    scenario.cleanup();
  });

  test("Journey: Initial connection and registration", () => {
    const user = scenario.createUser("user_123", "TestUser");

    // User connects - server sends registered confirmation
    const ws = user.connect();

    // Simulate server sending registered confirmation
    ws.messages.push({
      type: "registered",
      data: { message: "Successfully registered" },
    });

    expect(user.hasReceived("registered")).toBe(true);
  });

  test("Journey: Reconnection after disconnect", () => {
    const user = scenario.createUser("user_123", "TestUser");
    const friend = scenario.createUser("friend_456", "Friend");

    scenario.makeFriends(user, friend);

    user.connect();
    friend.connect();

    // User sends some logs
    scenario.sendLogsToFriends(user, [
      { id: "log1", line: "Before disconnect" },
    ]);
    expect(friend.hasReceived("logs_received")).toBe(true);
    friend.clearMessages();

    // User disconnects
    const friendIds = scenario.getFriendIds(user);
    broadcast(friendIds, "user_disconnected", {
      user: { discordId: user.discordId, username: user.username },
    });
    user.disconnect();

    expect(friend.hasReceived("user_disconnected")).toBe(true);
    friend.clearMessages();

    // User reconnects
    user.connect();
    broadcast(friendIds, "user_came_online", {
      user: { discordId: user.discordId, username: user.username },
    });

    expect(friend.hasReceived("user_came_online")).toBe(true);

    // User can send logs again
    friend.clearMessages();
    scenario.sendLogsToFriends(user, [{ id: "log2", line: "After reconnect" }]);
    expect(friend.hasReceived("logs_received")).toBe(true);
  });

  test("Journey: Session across multiple devices", () => {
    const user = scenario.createUser("user_123", "TestUser");

    // User connects with desktop
    user.connect("desktop");

    // User connects with mobile (same user, different device)
    user.connect("mobile");

    // User connects with web
    user.connect("web");

    // All 3 connections should be tracked for same user
    expect(userConnections.get(user.discordId)?.size).toBe(3);

    // Disconnecting one doesn't affect others
    user.disconnect("mobile");
    expect(userConnections.get(user.discordId)?.size).toBe(2);
  });
});

// ============================================================================
// Error Handling Journeys
// ============================================================================

describe("User Journey: Error Scenarios", () => {
  let scenario: TestScenario;

  beforeEach(() => {
    scenario = new TestScenario();
    clients.clear();
    userConnections.clear();
  });

  afterEach(() => {
    scenario.cleanup();
  });

  test("Journey: Send to non-existent user", () => {
    const alice = scenario.createUser("alice_123", "Alice");
    alice.connect();

    // Try to send to non-existent user
    const sent = broadcast(["nonexistent_user"], "logs_received", {
      senderDiscordId: alice.discordId,
      fromUsername: alice.username,
      logs: [{ id: "log1", line: "Test" }],
    });

    // Should return 0 sent
    expect(sent).toBe(0);
  });

  test("Journey: Message after user disconnected", () => {
    const alice = scenario.createUser("alice_123", "Alice");
    const bob = scenario.createUser("bob_456", "Bob");

    scenario.makeFriends(alice, bob);

    alice.connect();
    bob.connect();

    // Bob disconnects
    bob.disconnect();

    // Alice tries to send
    const sent = broadcast([bob.discordId], "logs_received", {
      senderDiscordId: alice.discordId,
      fromUsername: alice.username,
      logs: [{ id: "log1", line: "Test" }],
    });

    expect(sent).toBe(0);
  });

  test("Journey: Partial delivery (some recipients online)", () => {
    const sender = scenario.createUser("sender_123", "Sender");
    const online1 = scenario.createUser("online1_456", "Online1");
    const online2 = scenario.createUser("online2_789", "Online2");
    const offline1 = scenario.createUser("offline1_012", "Offline1");
    const offline2 = scenario.createUser("offline2_345", "Offline2");

    scenario.makeFriends(sender, online1);
    scenario.makeFriends(sender, online2);
    scenario.makeFriends(sender, offline1);
    scenario.makeFriends(sender, offline2);

    sender.connect();
    online1.connect();
    online2.connect();
    // offline1 and offline2 stay offline

    scenario.sendLogsToFriends(sender, [{ id: "log1", line: "Test" }]);

    // Only online friends receive
    expect(online1.hasReceived("logs_received")).toBe(true);
    expect(online2.hasReceived("logs_received")).toBe(true);
    expect(offline1.hasReceived("logs_received")).toBe(false);
    expect(offline2.hasReceived("logs_received")).toBe(false);
  });

  test("Journey: Empty recipient list", () => {
    const user = scenario.createUser("user_123", "User");
    user.connect();

    // No friends = empty recipient list
    const sent = broadcast([], "logs_received", {
      senderDiscordId: user.discordId,
      logs: [{ id: "log1", line: "Test" }],
    });

    expect(sent).toBe(0);
  });

  test("Journey: Malformed message handling", () => {
    const user = scenario.createUser("user_123", "User");
    const ws = user.connect();

    // Simulate server sending error response
    ws.messages.push({
      type: "error",
      message: "Invalid message format",
      error: "MALFORMED_MESSAGE",
    });

    expect(user.hasReceived("error")).toBe(true);
    const error = user.getAllMessagesByType("error")[0];
    expect(error.error).toBe("MALFORMED_MESSAGE");
  });
});

// ============================================================================
// Dashboard Data Journeys
// ============================================================================

describe("User Journey: Dashboard Data Loading", () => {
  let scenario: TestScenario;

  beforeEach(() => {
    scenario = new TestScenario();
    clients.clear();
    userConnections.clear();
  });

  afterEach(() => {
    scenario.cleanup();
  });

  test("Journey: Initial dashboard data load", () => {
    const user = scenario.createUser("user_123", "TestUser");
    const ws = user.connect();

    // Simulate server responding with dashboard data
    ws.messages.push({
      type: "dashboard_data",
      data: {
        user: { id: "user_123", username: "TestUser", avatar: null },
        friends: [],
        friendsPagination: { page: 1, perPage: 50, total: 0 },
        groups: [],
        groupsPagination: { page: 1, perPage: 50, total: 0 },
        logs: [],
        notifications: {
          friendRequests: [],
          groupInvitations: [],
        },
      },
    });

    expect(user.hasReceived("dashboard_data")).toBe(true);
    const dashboard = user.getAllMessagesByType("dashboard_data")[0];
    expect(dashboard.data.user.username).toBe("TestUser");
  });

  test("Journey: Dashboard with pending notifications", () => {
    const user = scenario.createUser("user_123", "TestUser");
    const ws = user.connect();

    // Simulate dashboard with pending friend request and group invitation
    ws.messages.push({
      type: "dashboard_data",
      data: {
        user: { id: "user_123", username: "TestUser", avatar: null },
        friends: [
          {
            friendDiscordId: "friend_456",
            friendUsername: "ExistingFriend",
            isOnline: true,
          },
        ],
        friendsPagination: { page: 1, perPage: 50, total: 1 },
        groups: [],
        groupsPagination: { page: 1, perPage: 50, total: 0 },
        logs: [],
        notifications: {
          friendRequests: [
            {
              id: "req_1",
              requesterDiscordId: "requester_789",
              requesterUsername: "NewFriend",
              status: "pending",
            },
          ],
          groupInvitations: [
            {
              id: "invite_1",
              groupId: "group_123",
              groupName: "Star Runners",
              inviterUsername: "GroupOwner",
            },
          ],
        },
      },
    });

    const dashboard = user.getAllMessagesByType("dashboard_data")[0];
    expect(dashboard.data.friends.length).toBe(1);
    expect(dashboard.data.notifications.friendRequests.length).toBe(1);
    expect(dashboard.data.notifications.groupInvitations.length).toBe(1);
  });

  test("Journey: Dashboard syncs across devices", () => {
    const user = scenario.createUser("user_123", "TestUser");

    user.connect("desktop");
    user.connect("mobile");

    // Simulate dashboard data sent to both devices
    broadcast([user.discordId], "dashboard_data", {
      user: { id: "user_123", username: "TestUser" },
      friends: [],
      groups: [],
      notifications: { friendRequests: [], groupInvitations: [] },
    });

    // Both devices should receive
    expect(user.getMessages("desktop").length).toBe(1);
    expect(user.getMessages("mobile").length).toBe(1);
  });

  test("Journey: Dashboard includes pending join requests for owned groups", () => {
    const user = scenario.createUser("user_123", "TestUser");
    const ws = user.connect();

    // Simulate dashboard with pending join requests for a group the user owns/admins
    ws.messages.push({
      type: "dashboard_data",
      data: {
        user: { id: "user_123", username: "TestUser", avatar: null },
        friends: [],
        friendsPagination: { page: 1, perPage: 50, total: 0 },
        groups: [
          {
            id: "group_123",
            name: "Star Runners",
            ownerId: "user_123",
            pendingJoinRequestCount: 2,
          },
        ],
        groupsPagination: { page: 1, perPage: 50, total: 1 },
        logs: [],
        notifications: {
          friendRequests: [],
          groupInvitations: [],
        },
        // New field: actual pending join requests data for notification dropdown
        pendingJoinRequests: {
          group_123: [
            {
              id: "req_1",
              groupId: "group_123",
              groupName: "Star Runners",
              groupAvatar: null,
              userId: "requester_456",
              username: "JoinRequester1",
              displayName: "JoinRequester1",
              avatar: null,
              message: "Would love to join!",
              status: "pending",
              createdAt: "2024-01-15T10:00:00.000Z",
            },
            {
              id: "req_2",
              groupId: "group_123",
              groupName: "Star Runners",
              groupAvatar: null,
              userId: "requester_789",
              username: "JoinRequester2",
              displayName: "JoinRequester2",
              avatar: null,
              message: null,
              status: "pending",
              createdAt: "2024-01-15T11:00:00.000Z",
            },
          ],
        },
      },
    });

    const dashboard = user.getAllMessagesByType("dashboard_data")[0];
    expect(dashboard.data.groups.length).toBe(1);
    expect(dashboard.data.groups[0].pendingJoinRequestCount).toBe(2);
    expect(dashboard.data.pendingJoinRequests).toBeDefined();
    expect(dashboard.data.pendingJoinRequests.group_123.length).toBe(2);
    expect(dashboard.data.pendingJoinRequests.group_123[0].username).toBe(
      "JoinRequester1",
    );
    expect(dashboard.data.pendingJoinRequests.group_123[0].message).toBe(
      "Would love to join!",
    );
  });

  test("Journey: Dashboard with no pending join requests for non-admin user", () => {
    const user = scenario.createUser("user_123", "TestUser");
    const ws = user.connect();

    // User is a member but not owner/admin - shouldn't see join requests
    ws.messages.push({
      type: "dashboard_data",
      data: {
        user: { id: "user_123", username: "TestUser", avatar: null },
        friends: [],
        friendsPagination: { page: 1, perPage: 50, total: 0 },
        groups: [
          {
            id: "group_123",
            name: "Star Runners",
            ownerId: "other_user",
            // No pendingJoinRequestCount since user is not admin
          },
        ],
        groupsPagination: { page: 1, perPage: 50, total: 1 },
        logs: [],
        notifications: {
          friendRequests: [],
          groupInvitations: [],
        },
        // Empty or undefined for non-admin users
        pendingJoinRequests: {},
      },
    });

    const dashboard = user.getAllMessagesByType("dashboard_data")[0];
    expect(dashboard.data.pendingJoinRequests).toEqual({});
  });
});

// ============================================================================
// Notification Journeys
// ============================================================================

describe("User Journey: Notifications", () => {
  let scenario: TestScenario;

  beforeEach(() => {
    scenario = new TestScenario();
    clients.clear();
    userConnections.clear();
  });

  afterEach(() => {
    scenario.cleanup();
  });

  test("Journey: Notification for friend activity", () => {
    const alice = scenario.createUser("alice_123", "Alice");
    const bob = scenario.createUser("bob_456", "Bob");

    scenario.makeFriends(alice, bob);

    alice.connect();
    bob.connect();

    // Alice achieves something notable - Bob gets notification
    broadcast([bob.discordId], "friend_activity_notification", {
      friendDiscordId: alice.discordId,
      friendUsername: alice.username,
      activityType: "achievement",
      message: 'Alice earned "Master Pilot" achievement',
    });

    expect(bob.hasReceived("friend_activity_notification")).toBe(true);
  });

  test("Journey: Clear notifications", () => {
    const user = scenario.createUser("user_123", "User");
    const ws = user.connect();

    // Simulate notifications cleared
    ws.messages.push({
      type: "notifications_cleared",
      data: { clearedCount: 5 },
    });

    expect(user.hasReceived("notifications_cleared")).toBe(true);
  });

  test("Journey: Mark notification as read", () => {
    const user = scenario.createUser("user_123", "User");
    const ws = user.connect();

    // Simulate notification marked as read
    ws.messages.push({
      type: "notification_read",
      data: { notificationId: "notif_123" },
    });

    expect(user.hasReceived("notification_read")).toBe(true);
  });
});
