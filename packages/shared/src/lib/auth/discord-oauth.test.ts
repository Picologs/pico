/**
 * Tests for Discord OAuth Utilities
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DiscordOAuthClient,
  createDiscordOAuthClient,
  authenticateWithDiscord,
  getDiscordAvatarUrl,
  getDefaultDiscordAvatarUrl,
  validateDiscordState,
  DiscordOAuthError,
  type DiscordOAuthConfig,
} from "./discord-oauth";

const TEST_CONFIG: DiscordOAuthConfig = {
  clientId: "test-client-id",
  clientSecret: "test-client-secret",
  redirectUri: "https://example.com/callback",
};

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe("DiscordOAuthError", () => {
  it("should create error with correct properties", () => {
    const error = new DiscordOAuthError("Test", "INVALID_CODE", 400);
    expect(error.name).toBe("DiscordOAuthError");
    expect(error.code).toBe("INVALID_CODE");
    expect(error.status).toBe(400);
  });
});

describe("DiscordOAuthClient", () => {
  let client: DiscordOAuthClient;

  beforeEach(() => {
    client = new DiscordOAuthClient(TEST_CONFIG);
    mockFetch.mockClear();
  });

  describe("exchangeCode", () => {
    it("should exchange code for tokens", async () => {
      const mockTokens = {
        access_token: "test-token",
        refresh_token: "refresh-token",
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokens,
      });

      const tokens = await client.exchangeCode("test-code");
      expect(tokens).toEqual(mockTokens);
    });

    it("should throw error on failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => "invalid_grant",
      });

      await expect(client.exchangeCode("bad-code")).rejects.toThrow(
        DiscordOAuthError,
      );
    });
  });

  describe("getUser", () => {
    it("should fetch user", async () => {
      const mockUser = { id: "123", username: "test", avatar: "hash" };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      });

      const user = await client.getUser("token");
      expect(user).toEqual(mockUser);
    });

    it("should throw on 401", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
      });

      await expect(client.getUser("bad-token")).rejects.toThrow(
        DiscordOAuthError,
      );
    });
  });

  describe("refreshToken", () => {
    it("should refresh token", async () => {
      const mockTokens = { access_token: "new-token" };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokens,
      });

      const tokens = await client.refreshToken("refresh-token");
      expect(tokens).toEqual(mockTokens);
    });
  });

  describe("revokeToken", () => {
    it("should revoke token", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await expect(client.revokeToken("token")).resolves.toBeUndefined();
    });
  });

  describe("syncProfile", () => {
    it("should sync with global_name", () => {
      const user = {
        id: "123",
        username: "test",
        avatar: "hash",
        global_name: "Test User",
        email: "test@test.com",
      };

      const profile = client.syncProfile(user);
      expect(profile.displayName).toBe("Test User");
      expect(profile.email).toBe("test@test.com");
    });

    it("should fallback to username", () => {
      const user = { id: "123", username: "test", avatar: "hash" };
      const profile = client.syncProfile(user);
      expect(profile.displayName).toBe("test");
    });
  });

  describe("getAuthorizationUrl", () => {
    it("should generate URL", () => {
      const url = client.getAuthorizationUrl({});
      expect(url).toContain("discord.com/oauth2/authorize");
      expect(url).toContain("client_id=test-client-id");
    });

    it("should include state", () => {
      const url = client.getAuthorizationUrl({ state: "test-state" });
      expect(url).toContain("state=test-state");
    });
  });
});

describe("Helper functions", () => {
  describe("createDiscordOAuthClient", () => {
    it("should create client", () => {
      const client = createDiscordOAuthClient(TEST_CONFIG);
      expect(client).toBeInstanceOf(DiscordOAuthClient);
    });
  });

  describe("authenticateWithDiscord", () => {
    beforeEach(() => {
      mockFetch.mockClear();
    });

    it("should exchange and fetch user", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: "token" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: "123", username: "test" }),
        });

      const [tokens, user] = await authenticateWithDiscord("code", TEST_CONFIG);
      expect(tokens.access_token).toBe("token");
      expect(user.id).toBe("123");
    });
  });

  describe("getDiscordAvatarUrl", () => {
    it("should return PNG for normal avatar", () => {
      const url = getDiscordAvatarUrl("123", "abc", 128);
      expect(url).toBe(
        "https://cdn.discordapp.com/avatars/123/abc.png?size=128",
      );
    });

    it("should return GIF for animated", () => {
      const url = getDiscordAvatarUrl("123", "a_abc", 256);
      expect(url).toBe(
        "https://cdn.discordapp.com/avatars/123/a_abc.gif?size=256",
      );
    });

    it("should return null for null avatar", () => {
      expect(getDiscordAvatarUrl("123", null)).toBeNull();
    });
  });

  describe("getDefaultDiscordAvatarUrl", () => {
    it("should handle new system", () => {
      const url = getDefaultDiscordAvatarUrl("123", "0");
      expect(url).toMatch(/embed\/avatars\/[0-5]\.png$/);
    });

    it("should handle legacy system", () => {
      const url = getDefaultDiscordAvatarUrl("123", "1234");
      expect(url).toMatch(/embed\/avatars\/[0-4]\.png$/);
    });
  });

  describe("validateDiscordState", () => {
    it("should validate matching states", () => {
      expect(validateDiscordState("test", "test")).toBe(true);
    });

    it("should reject mismatched states", () => {
      expect(validateDiscordState("test", "other")).toBe(false);
    });

    it("should reject null", () => {
      expect(validateDiscordState(null, "test")).toBe(false);
      expect(validateDiscordState("test", null)).toBe(false);
    });
  });
});
