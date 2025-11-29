/**
 * Tests for admin handlers - block/unblock users and signups toggle
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Use vi.hoisted to ensure mocks are available during module loading
const { mockUserConnections, mockClients, mockDb, mockSend } = vi.hoisted(() => ({
  mockUserConnections: new Map<string, Set<string>>(),
  mockClients: new Map<string, { ws: any; userId: string }>(),
  mockDb: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
  mockSend: vi.fn(),
}));

vi.mock("../lib/state", () => ({
  userConnections: mockUserConnections,
  clients: mockClients,
}));

vi.mock("../lib/utils", () => ({
  send: mockSend,
}));

vi.mock("../lib/db", () => ({
  db: mockDb,
  users: { id: "id", discordId: "discordId", role: "role", blockedAt: "blockedAt" },
  adminSettings: { key: "key", value: "value" },
  adminAuditLog: { id: "id", action: "action", createdAt: "createdAt" },
}));

// Import after mocking
import { blockUser, unblockUser, toggleSignups, getAdminSettings } from "./admin";

// Mock WebSocket
class MockWebSocket {
  messages: any[] = [];
  closed = false;
  closeCode?: number;
  closeReason?: string;

  send(data: string) {
    this.messages.push(JSON.parse(data));
  }

  close(code: number, reason: string) {
    this.closed = true;
    this.closeCode = code;
    this.closeReason = reason;
  }
}

// Test data helpers
function createMockAdmin() {
  return {
    id: "admin-uuid-123",
    discordId: "admin-discord-123",
    username: "AdminUser",
    role: "admin",
    blockedAt: null,
  };
}

function createMockUser() {
  return {
    id: "user-uuid-456",
    discordId: "user-discord-456",
    username: "RegularUser",
    role: "user",
    blockedAt: null,
  };
}

function createBlockedUser() {
  return {
    ...createMockUser(),
    blockedAt: new Date("2024-01-01"),
    blockedBy: "admin-uuid-123",
    blockReason: "Spam",
  };
}

// Helper to create mock select chain
function createMockSelectChain(result: any) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve(result)),
      })),
      orderBy: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve(result)),
      })),
    })),
  };
}

// Helper to create mock insert chain
function createMockInsertChain() {
  return {
    values: vi.fn(() => ({
      onConflictDoUpdate: vi.fn(() => Promise.resolve()),
    })),
  };
}

// Helper to create mock update chain
function createMockUpdateChain() {
  return {
    set: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    })),
  };
}

describe("Admin Handlers", () => {
  let ws: MockWebSocket;

  beforeEach(() => {
    ws = new MockWebSocket();
    vi.clearAllMocks();
    mockUserConnections.clear();
    mockClients.clear();
    mockSend.mockClear();
  });

  describe("blockUser", () => {
    it("should return error for non-admin users", async () => {
      const regularUser = createMockUser();
      mockDb.select.mockReturnValue(createMockSelectChain([regularUser]));

      await blockUser(ws, "user-discord-456", { targetUserId: "other-user" }, "req-1");

      expect(mockSend).toHaveBeenCalledWith(
        ws,
        "error",
        undefined,
        "Unauthorized - admin access required",
        "req-1"
      );
    });

    it("should return error when user not found", async () => {
      mockDb.select.mockReturnValue(createMockSelectChain([]));

      await blockUser(ws, "unknown-user", { targetUserId: "other-user" }, "req-1");

      expect(mockSend).toHaveBeenCalledWith(
        ws,
        "error",
        undefined,
        "Unauthorized - admin access required",
        "req-1"
      );
    });

    it("should return error when missing targetUserId", async () => {
      const admin = createMockAdmin();
      mockDb.select.mockReturnValue(createMockSelectChain([admin]));

      await blockUser(ws, "admin-discord-123", {}, "req-1");

      expect(mockSend).toHaveBeenCalledWith(
        ws,
        "error",
        undefined,
        "Missing targetUserId",
        "req-1"
      );
    });

    it("should prevent blocking admin users", async () => {
      const admin = createMockAdmin();
      const targetAdmin = { ...createMockAdmin(), id: "other-admin-uuid", discordId: "other-admin" };

      // First call returns requesting admin, second returns target admin
      mockDb.select
        .mockReturnValueOnce(createMockSelectChain([admin]))
        .mockReturnValueOnce(createMockSelectChain([targetAdmin]));

      await blockUser(ws, "admin-discord-123", { targetUserId: "other-admin-uuid" }, "req-1");

      expect(mockSend).toHaveBeenCalledWith(
        ws,
        "error",
        undefined,
        "Cannot block admin users",
        "req-1"
      );
    });

    it("should prevent self-blocking", async () => {
      const admin = createMockAdmin();

      // Both calls return the same admin (self)
      mockDb.select
        .mockReturnValueOnce(createMockSelectChain([admin]))
        .mockReturnValueOnce(createMockSelectChain([admin]));

      await blockUser(ws, "admin-discord-123", { targetUserId: "admin-uuid-123" }, "req-1");

      expect(mockSend).toHaveBeenCalledWith(
        ws,
        "error",
        undefined,
        "Cannot block yourself",
        "req-1"
      );
    });

    it("should return error when user is already blocked", async () => {
      const admin = createMockAdmin();
      const blockedUser = createBlockedUser();

      mockDb.select
        .mockReturnValueOnce(createMockSelectChain([admin]))
        .mockReturnValueOnce(createMockSelectChain([blockedUser]));

      await blockUser(ws, "admin-discord-123", { targetUserId: "user-uuid-456" }, "req-1");

      expect(mockSend).toHaveBeenCalledWith(
        ws,
        "error",
        undefined,
        "User is already blocked",
        "req-1"
      );
    });

    it("should successfully block a user and send success response", async () => {
      const admin = createMockAdmin();
      const targetUser = createMockUser();

      mockDb.select
        .mockReturnValueOnce(createMockSelectChain([admin]))
        .mockReturnValueOnce(createMockSelectChain([targetUser]));
      mockDb.update.mockReturnValue(createMockUpdateChain());
      mockDb.insert.mockReturnValue(createMockInsertChain());

      await blockUser(ws, "admin-discord-123", { targetUserId: "user-uuid-456", reason: "Spam" }, "req-1");

      expect(mockSend).toHaveBeenCalledWith(
        ws,
        "admin_user_blocked",
        expect.objectContaining({
          success: true,
          userId: "user-uuid-456",
          username: "RegularUser",
        }),
        undefined,
        "req-1"
      );
    });

    it("should disconnect blocked user's WebSocket connections", async () => {
      const admin = createMockAdmin();
      const targetUser = createMockUser();

      // Set up mock connections for the target user
      const mockWs1 = new MockWebSocket();
      const mockWs2 = new MockWebSocket();
      mockUserConnections.set("user-discord-456", new Set(["conn-1", "conn-2"]));
      mockClients.set("conn-1", { ws: mockWs1, userId: "user-discord-456" });
      mockClients.set("conn-2", { ws: mockWs2, userId: "user-discord-456" });

      mockDb.select
        .mockReturnValueOnce(createMockSelectChain([admin]))
        .mockReturnValueOnce(createMockSelectChain([targetUser]));
      mockDb.update.mockReturnValue(createMockUpdateChain());
      mockDb.insert.mockReturnValue(createMockInsertChain());

      await blockUser(ws, "admin-discord-123", { targetUserId: "user-uuid-456" }, "req-1");

      // Verify WebSockets were closed
      expect(mockWs1.closed).toBe(true);
      expect(mockWs1.closeCode).toBe(1008);
      expect(mockWs2.closed).toBe(true);
      expect(mockWs2.closeCode).toBe(1008);

      // Verify response includes disconnection count
      expect(mockSend).toHaveBeenCalledWith(
        ws,
        "admin_user_blocked",
        expect.objectContaining({
          disconnectedConnections: 2,
        }),
        undefined,
        "req-1"
      );
    });
  });

  describe("unblockUser", () => {
    it("should return error for non-admin users", async () => {
      const regularUser = createMockUser();
      mockDb.select.mockReturnValue(createMockSelectChain([regularUser]));

      await unblockUser(ws, "user-discord-456", { targetUserId: "other-user" }, "req-1");

      expect(mockSend).toHaveBeenCalledWith(
        ws,
        "error",
        undefined,
        "Unauthorized - admin access required",
        "req-1"
      );
    });

    it("should return error when user is not blocked", async () => {
      const admin = createMockAdmin();
      const unblockedUser = createMockUser();

      mockDb.select
        .mockReturnValueOnce(createMockSelectChain([admin]))
        .mockReturnValueOnce(createMockSelectChain([unblockedUser]));

      await unblockUser(ws, "admin-discord-123", { targetUserId: "user-uuid-456" }, "req-1");

      expect(mockSend).toHaveBeenCalledWith(
        ws,
        "error",
        undefined,
        "User is not blocked",
        "req-1"
      );
    });

    it("should successfully unblock a user", async () => {
      const admin = createMockAdmin();
      const blockedUser = createBlockedUser();

      mockDb.select
        .mockReturnValueOnce(createMockSelectChain([admin]))
        .mockReturnValueOnce(createMockSelectChain([blockedUser]));
      mockDb.update.mockReturnValue(createMockUpdateChain());
      mockDb.insert.mockReturnValue(createMockInsertChain());

      await unblockUser(ws, "admin-discord-123", { targetUserId: "user-uuid-456" }, "req-1");

      expect(mockSend).toHaveBeenCalledWith(
        ws,
        "admin_user_unblocked",
        expect.objectContaining({
          success: true,
          userId: "user-uuid-456",
          username: "RegularUser",
        }),
        undefined,
        "req-1"
      );
    });
  });

  describe("toggleSignups", () => {
    it("should return error for non-admin users", async () => {
      const regularUser = createMockUser();
      mockDb.select.mockReturnValue(createMockSelectChain([regularUser]));

      await toggleSignups(ws, "user-discord-456", { enabled: false }, "req-1");

      expect(mockSend).toHaveBeenCalledWith(
        ws,
        "error",
        undefined,
        "Unauthorized - admin access required",
        "req-1"
      );
    });

    it("should return error when enabled is not a boolean", async () => {
      const admin = createMockAdmin();
      mockDb.select.mockReturnValue(createMockSelectChain([admin]));

      await toggleSignups(ws, "admin-discord-123", { enabled: "true" }, "req-1");

      expect(mockSend).toHaveBeenCalledWith(
        ws,
        "error",
        undefined,
        "Missing or invalid 'enabled' boolean",
        "req-1"
      );
    });

    it("should successfully toggle signups to disabled", async () => {
      const admin = createMockAdmin();

      mockDb.select
        .mockReturnValueOnce(createMockSelectChain([admin]))
        .mockReturnValueOnce(createMockSelectChain([{ key: "signups_enabled", value: true }]));
      mockDb.insert.mockReturnValue(createMockInsertChain());

      await toggleSignups(ws, "admin-discord-123", { enabled: false }, "req-1");

      expect(mockSend).toHaveBeenCalledWith(
        ws,
        "admin_signups_toggled",
        expect.objectContaining({
          success: true,
          signupsEnabled: false,
        }),
        undefined,
        "req-1"
      );
    });

    it("should successfully toggle signups to enabled", async () => {
      const admin = createMockAdmin();

      mockDb.select
        .mockReturnValueOnce(createMockSelectChain([admin]))
        .mockReturnValueOnce(createMockSelectChain([{ key: "signups_enabled", value: false }]));
      mockDb.insert.mockReturnValue(createMockInsertChain());

      await toggleSignups(ws, "admin-discord-123", { enabled: true }, "req-1");

      expect(mockSend).toHaveBeenCalledWith(
        ws,
        "admin_signups_toggled",
        expect.objectContaining({
          success: true,
          signupsEnabled: true,
        }),
        undefined,
        "req-1"
      );
    });
  });

  describe("getAdminSettings", () => {
    it("should return error for non-admin users", async () => {
      const regularUser = createMockUser();
      mockDb.select.mockReturnValue(createMockSelectChain([regularUser]));

      await getAdminSettings(ws, "user-discord-456", {}, "req-1");

      expect(mockSend).toHaveBeenCalledWith(
        ws,
        "error",
        undefined,
        "Unauthorized - admin access required",
        "req-1"
      );
    });

    it("should return settings and audit log for admin users", async () => {
      const admin = createMockAdmin();
      const mockSettings = [
        { key: "signups_enabled", value: true, updatedAt: new Date(), updatedBy: "admin-uuid" },
      ];
      const mockAuditLog = [
        {
          id: "log-1",
          action: "signups_toggled",
          targetUserId: null,
          adminUserId: "admin-uuid",
          metadata: { enabled: true },
          createdAt: new Date(),
        },
      ];

      // First select for admin verification
      mockDb.select
        .mockReturnValueOnce(createMockSelectChain([admin]))
        // Second select for settings
        .mockReturnValueOnce({
          from: vi.fn(() => Promise.resolve(mockSettings)),
        })
        // Third select for audit log
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve(mockAuditLog)),
            })),
          })),
        });

      await getAdminSettings(ws, "admin-discord-123", {}, "req-1");

      expect(mockSend).toHaveBeenCalledWith(
        ws,
        "admin_settings",
        expect.objectContaining({
          signupsEnabled: true,
        }),
        undefined,
        "req-1"
      );
    });

    it("should default signupsEnabled to true when not set", async () => {
      const admin = createMockAdmin();

      mockDb.select
        .mockReturnValueOnce(createMockSelectChain([admin]))
        .mockReturnValueOnce({
          from: vi.fn(() => Promise.resolve([])),
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve([])),
            })),
          })),
        });

      await getAdminSettings(ws, "admin-discord-123", {}, "req-1");

      expect(mockSend).toHaveBeenCalledWith(
        ws,
        "admin_settings",
        expect.objectContaining({
          signupsEnabled: true,
        }),
        undefined,
        "req-1"
      );
    });
  });
});
