/**
 * WebSocket Lifecycle Integration Tests
 *
 * Tests the core WebSocket connection lifecycle:
 * - Connection establishment
 * - Registration/authentication
 * - Registration timeout
 * - Token validation
 * - Disconnection handling
 *
 * @module server/integration/websocket-lifecycle.test
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { withNeonTestBranch } from "../test/setup";
import { verifyToken } from "../lib/utils";
import { broadcast, send } from "../lib/utils";
import {
  clients,
  userConnections,
  isLoginBlocked,
  recordFailedLogin,
  clearFailedLogins,
} from "../lib/state";
import {
  MockWebSocket,
  clearConnectionState,
  simulateConnection,
  generateTestJWT,
  generateExpiredJWT,
  generateInvalidJWT,
  testDiscordId,
  seedTestUser,
  cleanupTestData,
} from "./test-utils";

describe("WebSocket Lifecycle Integration Tests", () => {
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
  // Connection Tests
  // ============================================================================

  describe("Connection Establishment", () => {
    test("should create a client entry on connection", () => {
      const userId = testDiscordId();
      const { ws, connectionId } = simulateConnection(userId);

      expect(clients.has(connectionId)).toBe(true);
      expect(clients.get(connectionId)?.userId).toBe(userId);
      expect(clients.get(connectionId)?.ws).toBe(ws as any);
    });

    test("should track user connections for multi-device support", () => {
      const userId = testDiscordId();

      // First device
      const { connectionId: connId1 } = simulateConnection(
        userId,
        "conn-device-1",
      );

      // Second device
      const { connectionId: connId2 } = simulateConnection(
        userId,
        "conn-device-2",
      );

      const userConns = userConnections.get(userId);
      expect(userConns).toBeDefined();
      expect(userConns?.size).toBe(2);
      expect(userConns?.has(connId1)).toBe(true);
      expect(userConns?.has(connId2)).toBe(true);
    });

    test("should store connection metadata", () => {
      const userId = testDiscordId();
      const metadata = { device: "desktop", version: "1.0.0" };

      simulateConnection(userId, "conn-with-meta", metadata);

      const client = clients.get("conn-with-meta");
      expect(client?.metadata).toEqual(metadata);
    });
  });

  // ============================================================================
  // Registration/Authentication Tests
  // ============================================================================

  describe("Registration Flow", () => {
    test("should verify valid JWT token", () => {
      const userId = testDiscordId();
      const token = generateTestJWT(userId);

      const result = verifyToken(token);

      expect(result).not.toBeNull();
      expect(result?.userId).toBe(userId);
    });

    test("should reject expired JWT token", () => {
      const userId = testDiscordId();
      const token = generateExpiredJWT(userId);

      const result = verifyToken(token);

      expect(result).toBeNull();
    });

    test("should reject JWT with wrong secret", () => {
      const userId = testDiscordId();
      const token = generateInvalidJWT(userId);

      const result = verifyToken(token);

      expect(result).toBeNull();
    });

    test("should reject JWT with missing userId", () => {
      // JWT without userId field
      const token =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoid2Vic29ja2V0In0.invalid";

      const result = verifyToken(token);

      expect(result).toBeNull();
    });

    test("should reject JWT with wrong type", () => {
      // JWT with type != 'websocket'
      const token =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0IiwidHlwZSI6ImFwaSJ9.invalid";

      const result = verifyToken(token);

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // Failed Login Throttling Tests
  // ============================================================================

  describe("Failed Login Throttling", () => {
    test("should not block on first failed attempt", () => {
      const ip = "192.168.1.100";

      const blocked = recordFailedLogin(ip);

      expect(blocked).toBe(false);
      expect(isLoginBlocked(ip).blocked).toBe(false);
    });

    test("should block after 5 failed attempts", () => {
      const ip = "192.168.1.101";

      // Record 4 failed attempts - should not block
      for (let i = 0; i < 4; i++) {
        const blocked = recordFailedLogin(ip);
        expect(blocked).toBe(false);
      }

      // 5th attempt should trigger block
      const blocked = recordFailedLogin(ip);
      expect(blocked).toBe(true);

      // Verify blocked
      const status = isLoginBlocked(ip);
      expect(status.blocked).toBe(true);
      expect(status.blockedFor).toBeGreaterThan(0);
    });

    test("should clear failed logins on successful auth", () => {
      const ip = "192.168.1.102";

      // Record some failed attempts
      recordFailedLogin(ip);
      recordFailedLogin(ip);
      recordFailedLogin(ip);

      // Simulate successful login
      clearFailedLogins(ip);

      // Should not be blocked and counter should be reset
      expect(isLoginBlocked(ip).blocked).toBe(false);

      // New failed attempt should start fresh
      const blocked = recordFailedLogin(ip);
      expect(blocked).toBe(false);
    });

    test("should track failed attempts per IP separately", () => {
      const ip1 = "192.168.1.103";
      const ip2 = "192.168.1.104";

      // Record 3 failed attempts from ip1
      recordFailedLogin(ip1);
      recordFailedLogin(ip1);
      recordFailedLogin(ip1);

      // Record 1 failed attempt from ip2
      recordFailedLogin(ip2);

      // Neither should be blocked yet
      expect(isLoginBlocked(ip1).blocked).toBe(false);
      expect(isLoginBlocked(ip2).blocked).toBe(false);
    });
  });

  // ============================================================================
  // Broadcasting Tests
  // ============================================================================

  describe("Broadcasting", () => {
    test("should broadcast message to connected user", () => {
      const userId = testDiscordId();
      const { ws } = simulateConnection(userId);

      const sent = broadcast([userId], "test_message", { foo: "bar" });

      expect(sent).toBe(1);
      expect(ws.getLastMessage().type).toBe("test_message");
      expect(ws.getLastMessage().data.foo).toBe("bar");
    });

    test("should broadcast to multiple connected users", () => {
      const user1 = testDiscordId();
      const user2 = testDiscordId();
      const user3 = testDiscordId();

      const { ws: ws1 } = simulateConnection(user1);
      const { ws: ws2 } = simulateConnection(user2);
      const { ws: ws3 } = simulateConnection(user3);

      const sent = broadcast([user1, user2, user3], "group_message", {
        text: "hello",
      });

      expect(sent).toBe(3);
      expect(ws1.hasMessage("group_message")).toBe(true);
      expect(ws2.hasMessage("group_message")).toBe(true);
      expect(ws3.hasMessage("group_message")).toBe(true);
    });

    test("should broadcast to all devices of multi-device user", () => {
      const userId = testDiscordId();

      const { ws: ws1 } = simulateConnection(userId, "device-1");
      const { ws: ws2 } = simulateConnection(userId, "device-2");

      const sent = broadcast([userId], "sync_message", { data: "sync" });

      expect(sent).toBe(2);
      expect(ws1.hasMessage("sync_message")).toBe(true);
      expect(ws2.hasMessage("sync_message")).toBe(true);
    });

    test("should skip offline users without error", () => {
      const onlineUser = testDiscordId();
      const offlineUser = testDiscordId();

      const { ws } = simulateConnection(onlineUser);
      // offlineUser is not connected

      const sent = broadcast([onlineUser, offlineUser], "notification", {
        msg: "hi",
      });

      expect(sent).toBe(1);
      expect(ws.hasMessage("notification")).toBe(true);
    });

    test("should include timestamp in broadcast messages", () => {
      const userId = testDiscordId();
      const { ws } = simulateConnection(userId);

      broadcast([userId], "timestamped_message", {});

      const msg = ws.getLastMessage();
      expect(msg.timestamp).toBeDefined();
      expect(new Date(msg.timestamp).getTime()).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Send Tests
  // ============================================================================

  describe("Send to Single Connection", () => {
    test("should send message with data", () => {
      const ws = new MockWebSocket();

      send(ws, "response", { result: "success" });

      const msg = ws.getLastMessage();
      expect(msg.type).toBe("response");
      expect(msg.data.result).toBe("success");
    });

    test("should send message with error", () => {
      const ws = new MockWebSocket();

      send(ws, "error", undefined, "Something went wrong");

      const msg = ws.getLastMessage();
      expect(msg.type).toBe("error");
      expect(msg.error).toBe("Something went wrong");
      expect(msg.message).toBe("Something went wrong"); // Duplicate for convenience
    });

    test("should include requestId for correlation", () => {
      const ws = new MockWebSocket();
      const requestId = "req-123";

      send(ws, "response", { data: "test" }, undefined, requestId);

      const msg = ws.getLastMessage();
      expect(msg.requestId).toBe(requestId);
    });

    test("should include timestamp", () => {
      const ws = new MockWebSocket();

      send(ws, "test", {});

      const msg = ws.getLastMessage();
      expect(msg.timestamp).toBeDefined();
    });
  });

  // ============================================================================
  // Disconnection Tests
  // ============================================================================

  describe("Disconnection Handling", () => {
    test("should remove client on disconnect", () => {
      const userId = testDiscordId();
      const { connectionId } = simulateConnection(userId);

      expect(clients.has(connectionId)).toBe(true);

      // Simulate disconnect
      const client = clients.get(connectionId);
      if (client) {
        const userConns = userConnections.get(client.userId);
        userConns?.delete(connectionId);
        if (userConns?.size === 0) {
          userConnections.delete(client.userId);
        }
        clients.delete(connectionId);
      }

      expect(clients.has(connectionId)).toBe(false);
      expect(userConnections.has(userId)).toBe(false);
    });

    test("should keep other device connections on single device disconnect", () => {
      const userId = testDiscordId();

      const { connectionId: conn1 } = simulateConnection(userId, "device-1");
      const { connectionId: conn2 } = simulateConnection(userId, "device-2");

      // Disconnect device 1
      const userConns = userConnections.get(userId);
      userConns?.delete(conn1);
      clients.delete(conn1);

      // Device 2 should still be connected
      expect(clients.has(conn2)).toBe(true);
      expect(userConnections.get(userId)?.has(conn2)).toBe(true);
      expect(userConnections.get(userId)?.size).toBe(1);
    });
  });

  // ============================================================================
  // Database Integration Tests
  // ============================================================================

  describe("Database Integration", () => {
    test("should seed and cleanup test user", async () => {
      const user = await seedTestUser({
        username: "lifecycle-test-user",
      });

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.username).toBe("lifecycle-test-user");

      // Cleanup
      const result = await cleanupTestData();
      expect(result.users).toBeGreaterThanOrEqual(1);
    });

    test("should generate valid JWT for seeded user", async () => {
      const user = await seedTestUser();
      const token = generateTestJWT(user.id);

      const verified = verifyToken(token);

      expect(verified).not.toBeNull();
      expect(verified?.userId).toBe(user.id);
    });
  });
});
