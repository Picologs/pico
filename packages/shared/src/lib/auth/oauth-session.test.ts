/**
 * Tests for OAuth Session Management
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  OAuthSessionManager,
  generateOAuthState,
  validateOAuthState,
  type OAuthSessionStorage,
} from "./oauth-session";

describe("OAuthSessionManager", () => {
  let storage: OAuthSessionStorage;
  let manager: OAuthSessionManager;
  let mockStorage: Map<string, string>;

  beforeEach(() => {
    mockStorage = new Map();
    storage = {
      load: vi.fn(async () => mockStorage.get("session") || null),
      save: vi.fn(async (data: string) => {
        mockStorage.set("session", data);
      }),
      clear: vi.fn(async () => {
        mockStorage.delete("session");
      }),
    };
    manager = new OAuthSessionManager(storage);
  });

  describe("createSession", () => {
    it("should create session and return session ID", async () => {
      const sessionId = await manager.createSession({
        redirectUri: "https://example.com/callback",
      });

      expect(sessionId).toBeTruthy();
      expect(typeof sessionId).toBe("string");
      expect(storage.save).toHaveBeenCalled();
    });

    it("should include redirect URI", async () => {
      const sessionId = await manager.createSession({
        redirectUri: "https://example.com/callback",
      });

      const stored = mockStorage.get("session");
      expect(stored).toBeTruthy();
      const session = JSON.parse(stored!);
      expect(session.redirectUri).toBe("https://example.com/callback");
    });

    it("should include metadata", async () => {
      const sessionId = await manager.createSession({
        metadata: { userId: "123", flow: "login" },
      });

      const stored = mockStorage.get("session");
      const session = JSON.parse(stored!);
      expect(session.metadata).toEqual({ userId: "123", flow: "login" });
    });

    it("should set expiration time", async () => {
      const before = Date.now();
      await manager.createSession({});
      const after = Date.now();

      const stored = mockStorage.get("session");
      const session = JSON.parse(stored!);
      expect(session.expiresAt).toBeGreaterThan(before);
      expect(session.expiresAt).toBeLessThanOrEqual(after + 10 * 60 * 1000);
    });

    it("should use custom timeout", async () => {
      const shortManager = new OAuthSessionManager(storage, {
        sessionTimeout: 1000,
      });
      const before = Date.now();
      await shortManager.createSession({});

      const stored = mockStorage.get("session");
      const session = JSON.parse(stored!);
      expect(session.expiresAt).toBeLessThanOrEqual(before + 1000);
    });
  });

  describe("validateSession", () => {
    it("should validate valid session", async () => {
      const sessionId = await manager.createSession({
        redirectUri: "https://example.com/callback",
      });

      const session = await manager.validateSession(sessionId);
      expect(session).not.toBeNull();
      expect(session?.sessionId).toBe(sessionId);
    });

    it("should return null for null session ID", async () => {
      const session = await manager.validateSession(null);
      expect(session).toBeNull();
    });

    it("should return null for non-existent session", async () => {
      const session = await manager.validateSession("non-existent-id");
      expect(session).toBeNull();
    });

    it("should return null for mismatched session ID", async () => {
      await manager.createSession({ redirectUri: "https://example.com" });

      const session = await manager.validateSession("different-id");
      expect(session).toBeNull();
    });

    it("should return null for expired session", async () => {
      const expiredManager = new OAuthSessionManager(storage, {
        sessionTimeout: -1000,
      });
      const sessionId = await expiredManager.createSession({});

      const session = await expiredManager.validateSession(sessionId);
      expect(session).toBeNull();
    });

    it("should clear session after validation (single-use)", async () => {
      const sessionId = await manager.createSession({});

      // First validation succeeds
      const session1 = await manager.validateSession(sessionId);
      expect(session1).not.toBeNull();

      // Second validation fails (session was cleared)
      const session2 = await manager.validateSession(sessionId);
      expect(session2).toBeNull();
    });

    it("should handle malformed JSON", async () => {
      mockStorage.set("session", "invalid-json");

      const session = await manager.validateSession("any-id");
      expect(session).toBeNull();
    });
  });

  describe("clearSession", () => {
    it("should clear session", async () => {
      await manager.createSession({});
      await manager.clearSession();

      expect(storage.clear).toHaveBeenCalled();
      expect(mockStorage.has("session")).toBe(false);
    });
  });

  describe("getCurrentSession", () => {
    it("should return current session without clearing", async () => {
      const sessionId = await manager.createSession({
        redirectUri: "https://example.com",
      });

      const session1 = await manager.getCurrentSession();
      expect(session1).not.toBeNull();
      expect(session1?.sessionId).toBe(sessionId);

      // Should still be available
      const session2 = await manager.getCurrentSession();
      expect(session2).not.toBeNull();
    });

    it("should return null for expired session", async () => {
      const expiredManager = new OAuthSessionManager(storage, {
        sessionTimeout: -1000,
      });
      await expiredManager.createSession({});

      const session = await expiredManager.getCurrentSession();
      expect(session).toBeNull();
    });

    it("should return null when no session exists", async () => {
      const session = await manager.getCurrentSession();
      expect(session).toBeNull();
    });
  });

  describe("timestamped IDs", () => {
    it("should generate timestamped IDs by default", async () => {
      const sessionId = await manager.createSession({});

      expect(sessionId).toContain(":");
      const parts = sessionId.split(":");
      expect(parts).toHaveLength(2);
      expect(parseInt(parts[1])).toBeGreaterThan(0);
    });

    it("should generate non-timestamped IDs when disabled", async () => {
      const noTimestampManager = new OAuthSessionManager(storage, {
        useTimestampedIds: false,
      });
      const sessionId = await noTimestampManager.createSession({});

      expect(sessionId).not.toContain(":");
    });
  });
});

describe("generateOAuthState", () => {
  it("should generate state with timestamp by default", () => {
    const state = generateOAuthState();

    expect(state).toBeTruthy();
    expect(state).toContain(":");
    const parts = state.split(":");
    expect(parts).toHaveLength(2);
    expect(parseInt(parts[1])).toBeGreaterThan(0);
  });

  it("should generate state without timestamp when disabled", () => {
    const state = generateOAuthState(false);

    expect(state).toBeTruthy();
    expect(state).not.toContain(":");
  });

  it("should generate different states on each call", () => {
    const state1 = generateOAuthState();
    const state2 = generateOAuthState();

    expect(state1).not.toBe(state2);
  });
});

describe("validateOAuthState", () => {
  it("should validate matching states", () => {
    const state = "test-state-123";
    expect(validateOAuthState(state, state)).toBe(true);
  });

  it("should reject mismatched states", () => {
    expect(validateOAuthState("state1", "state2")).toBe(false);
  });

  it("should reject null or undefined", () => {
    expect(validateOAuthState(null, "state")).toBe(false);
    expect(validateOAuthState("state", null)).toBe(false);
    expect(validateOAuthState(null, null)).toBe(false);
  });

  it("should reject empty strings", () => {
    expect(validateOAuthState("", "state")).toBe(false);
    expect(validateOAuthState("state", "")).toBe(false);
  });

  it("should validate timestamped state within maxAge", () => {
    const now = Date.now();
    const state = `uuid-123:${now}`;

    expect(validateOAuthState(state, state, 10 * 60 * 1000)).toBe(true);
  });

  it("should reject expired timestamped state", () => {
    const oldTime = Date.now() - 20 * 60 * 1000; // 20 minutes ago
    const state = `uuid-123:${oldTime}`;

    expect(validateOAuthState(state, state, 10 * 60 * 1000)).toBe(false);
  });

  it("should handle state without timestamp", () => {
    const state = "simple-state";

    expect(validateOAuthState(state, state, 1000)).toBe(true);
  });

  it("should handle invalid timestamp gracefully", () => {
    const state = "uuid-123:invalid";

    // Should still validate if states match (timestamp parsing is optional)
    expect(validateOAuthState(state, state)).toBe(true);
  });
});
