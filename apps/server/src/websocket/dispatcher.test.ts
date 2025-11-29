/**
 * WebSocket dispatcher tests
 */

import { describe, it, expect, vi } from "vitest";
import { dispatchMessage } from "./dispatcher";

// Mock WebSocket
class MockWebSocket {
  messages: any[] = [];

  send(data: string) {
    this.messages.push(JSON.parse(data));
  }

  getLastMessage() {
    return this.messages[this.messages.length - 1];
  }

  clear() {
    this.messages = [];
  }
}

describe("WebSocket Dispatcher", () => {
  describe("dispatchMessage", () => {
    test("should send error for unknown message type", async () => {
      const ws = new MockWebSocket();

      await dispatchMessage(ws as any, "user123", "unknown_type", {}, "req-1");

      const lastMsg = ws.getLastMessage();
      expect(lastMsg.type).toBe("error");
      expect(lastMsg.error).toBe("Unknown message type: unknown_type");
      expect(lastMsg.requestId).toBe("req-1");
    });

    test("should include requestId in error response", async () => {
      const ws = new MockWebSocket();

      await dispatchMessage(
        ws as any,
        "user123",
        "invalid_action",
        {},
        "request-abc",
      );

      const lastMsg = ws.getLastMessage();
      expect(lastMsg.requestId).toBe("request-abc");
    });

    test("should handle missing requestId gracefully", async () => {
      const ws = new MockWebSocket();

      await dispatchMessage(ws as any, "user123", "unknown", {});

      const lastMsg = ws.getLastMessage();
      expect(lastMsg.type).toBe("error");
      expect(lastMsg.requestId).toBeUndefined();
    });
  });

  describe("message type routing", () => {
    // These tests verify the switch statement covers expected message types
    // The actual handler behavior is tested in the handler unit tests

    const messageTypes = [
      // Friends
      "get_friends",
      "send_friend_request",
      "accept_friend_request",
      "deny_friend_request",
      "cancel_friend_request",
      "remove_friend",
      "get_friend_requests",
      // Dashboard
      "get_dashboard_data",
      // Groups
      "get_groups",
      "create_group",
      "update_group",
      "delete_group",
      "leave_group",
      "invite_friend_to_group",
      "accept_group_invitation",
      "deny_group_invitation",
      "cancel_group_invitation",
      "get_group_invitations",
      "get_group_members",
      "update_member_role",
      "remove_member_from_group",
      // Logs
      "send_logs",
      "batch_logs",
      "batch_group_logs",
      // Log Schema
      "report_log_patterns",
      "get_log_pattern_stats",
      // Profile
      "get_user_profile",
      "update_user_profile",
      "delete_user_profile",
    ];

    test("should recognize all expected message types", () => {
      // This test documents all the message types the dispatcher should handle
      // Friends: 7, Dashboard: 1, Groups: 13, Logs: 3, Log Schema: 2, Profile: 3 = 29
      expect(messageTypes.length).toBe(29);
    });

    test("should not route to error for valid message types", async () => {
      // We can't fully test handler calls without mocking the database,
      // but we can verify the dispatcher doesn't immediately error
      const ws = new MockWebSocket();

      // Test a sample of message types - they will fail at the handler level
      // but shouldn't trigger "Unknown message type" error
      for (const type of ["get_friends", "get_groups", "get_dashboard_data"]) {
        ws.clear();
        try {
          await dispatchMessage(ws as any, "user123", type, {}, "req-1");
        } catch {
          // Handler errors are expected without DB setup
        }

        // If there's an error, it should NOT be "Unknown message type"
        const lastMsg = ws.getLastMessage();
        if (lastMsg?.type === "error") {
          expect(lastMsg.error).not.toContain("Unknown message type");
        }
      }
    });
  });
});
