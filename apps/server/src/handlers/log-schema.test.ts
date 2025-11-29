/**
 * Tests for log schema handlers - beta tester gating
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the database module before importing the handler
vi.mock("../lib/db", () => {
  const mockDb = {
    query: {
      users: {
        findFirst: vi.fn(),
      },
    },
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([])),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([])),
        onConflictDoNothing: vi.fn(() => Promise.resolve()),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
  };

  return { db: mockDb };
});

// Import after mocking
import { reportLogPatterns } from "./log-schema";
import { db } from "../lib/db";

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

const mockPatterns = [
  {
    eventName: "TestEvent",
    severity: "info",
    teams: ["gameplay"],
    subsystems: ["physics"],
    signature: "test-sig-123",
    exampleLine: "Test log line",
  },
];

describe("reportLogPatterns - betaTester gating", () => {
  let ws: MockWebSocket;

  beforeEach(() => {
    ws = new MockWebSocket();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("when user is not a beta tester", () => {
    beforeEach(() => {
      vi.mocked(db.query.users.findFirst).mockResolvedValue({
        betaTester: false,
      } as any);
    });

    it("should acknowledge without processing patterns", async () => {
      await reportLogPatterns(
        ws as any,
        "user-123",
        { patterns: mockPatterns },
        "req-1",
      );

      const lastMsg = ws.getLastMessage();
      expect(lastMsg.type).toBe("log_patterns_received");
      expect(lastMsg.data.acknowledged).toBe(true);
      expect(lastMsg.data.newCount).toBe(0);
      expect(lastMsg.data.updatedCount).toBe(0);
      expect(lastMsg.requestId).toBe("req-1");
    });

    it("should not query for existing patterns", async () => {
      await reportLogPatterns(ws as any, "user-123", {
        patterns: mockPatterns,
      });

      // db.select is used to query existing patterns
      // Should NOT be called when user is not a beta tester
      expect(db.select).not.toHaveBeenCalled();
    });

    it("should not insert any patterns", async () => {
      await reportLogPatterns(ws as any, "user-123", {
        patterns: mockPatterns,
      });

      expect(db.insert).not.toHaveBeenCalled();
    });

    it("should not update any patterns", async () => {
      await reportLogPatterns(ws as any, "user-123", {
        patterns: mockPatterns,
      });

      expect(db.update).not.toHaveBeenCalled();
    });
  });

  describe("when user is a beta tester", () => {
    beforeEach(() => {
      vi.mocked(db.query.users.findFirst).mockResolvedValue({
        betaTester: true,
      } as any);
    });

    it("should query for existing patterns", async () => {
      // Mock the pattern lookup to return empty (all new patterns)
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      // Mock insert to return the inserted pattern
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi
            .fn()
            .mockResolvedValue([{ id: "pat-1", signature: "test-sig-123" }]),
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        }),
      } as any);

      try {
        await reportLogPatterns(ws as any, "user-123", {
          patterns: mockPatterns,
        });
      } catch {
        // Handler may throw due to incomplete mock chain, but the key check is that db.select was called
      }

      // Should query existing patterns (key test - confirms beta tester check passed)
      expect(db.select).toHaveBeenCalled();
    });
  });

  describe("when user does not exist", () => {
    beforeEach(() => {
      vi.mocked(db.query.users.findFirst).mockResolvedValue(null);
    });

    it("should acknowledge without processing", async () => {
      await reportLogPatterns(ws as any, "user-123", {
        patterns: mockPatterns,
      });

      const lastMsg = ws.getLastMessage();
      expect(lastMsg.type).toBe("log_patterns_received");
      expect(lastMsg.data.acknowledged).toBe(true);
      expect(db.insert).not.toHaveBeenCalled();
    });
  });

  describe("error cases", () => {
    it("should return error for empty patterns array", async () => {
      await reportLogPatterns(
        ws as any,
        "user-123",
        { patterns: [] },
        "req-err",
      );

      const lastMsg = ws.getLastMessage();
      expect(lastMsg.type).toBe("error");
      expect(lastMsg.error).toBe("No patterns provided");
    });

    it("should return error for missing patterns", async () => {
      await reportLogPatterns(ws as any, "user-123", {} as any, "req-err");

      const lastMsg = ws.getLastMessage();
      expect(lastMsg.type).toBe("error");
    });
  });
});
