/**
 * Tests for avatar utility functions
 */

import { describe, it, expect } from "vitest";
import { isEmoji, isValidAvatarHash, getAvatarUrl } from "./avatarUtils";

describe("isEmoji", () => {
  it("should return true for single emojis", () => {
    expect(isEmoji("🚀")).toBe(true);
    expect(isEmoji("👍")).toBe(true);
    expect(isEmoji("🎮")).toBe(true);
    expect(isEmoji("❤️")).toBe(true);
    expect(isEmoji("🔥")).toBe(true);
    expect(isEmoji("⭐")).toBe(true);
  });

  it("should return true for multi-character emojis", () => {
    expect(isEmoji("👨‍💻")).toBe(true); // Man technologist with ZWJ
    expect(isEmoji("🏳️‍🌈")).toBe(true); // Rainbow flag with variation selector
    expect(isEmoji("👨‍👩‍👧‍👦")).toBe(true); // Family with multiple ZWJ
    expect(isEmoji("👍🏻")).toBe(true); // Thumbs up with skin tone modifier
  });

  it("should return false for non-emojis", () => {
    expect(isEmoji("hello")).toBe(false);
    expect(isEmoji("123")).toBe(false);
    expect(isEmoji("test string")).toBe(false);
    expect(isEmoji("abc123")).toBe(false);
  });

  it("should return false for URLs", () => {
    expect(isEmoji("https://example.com")).toBe(false);
    expect(isEmoji("http://example.com/🚀")).toBe(false);
    expect(isEmoji("https://cdn.discordapp.com/avatars/123/abc.png")).toBe(
      false,
    );
  });

  it("should return false for Discord avatar hashes", () => {
    expect(isEmoji("a_1234567890abcdef1234567890abcd")).toBe(false);
    expect(isEmoji("1234567890abcdef1234567890abcdef")).toBe(false);
    expect(isEmoji("abc123def456")).toBe(false);
    expect(isEmoji("5075d67a7fc17080b0b370a3cb74")).toBe(false);
    expect(isEmoji("d80b370a3cb74")).toBe(false);
  });

  it("should return false for null and undefined", () => {
    expect(isEmoji(null)).toBe(false);
    expect(isEmoji(undefined)).toBe(false);
  });

  it("should return false for empty strings and whitespace", () => {
    expect(isEmoji("")).toBe(false);
    expect(isEmoji("   ")).toBe(false);
    expect(isEmoji("\n")).toBe(false);
    expect(isEmoji("\t")).toBe(false);
  });

  it("should handle emojis with whitespace", () => {
    expect(isEmoji("  🚀  ")).toBe(true); // Trimmed
    expect(isEmoji("\n🎮\n")).toBe(true); // Trimmed
  });

  it("should return false for non-string values", () => {
    expect(isEmoji(123 as any)).toBe(false);
    expect(isEmoji({} as any)).toBe(false);
    expect(isEmoji([] as any)).toBe(false);
  });
});

describe("isValidAvatarHash", () => {
  it("should return true for valid Discord avatar hashes", () => {
    expect(isValidAvatarHash("a_1234567890abcdef1234567890abcd")).toBe(true);
    expect(isValidAvatarHash("1234567890abcdef1234567890abcdef")).toBe(true);
    expect(isValidAvatarHash("abc123def456")).toBe(true);
  });

  it("should return false for default avatar indices", () => {
    expect(isValidAvatarHash("0")).toBe(false);
    expect(isValidAvatarHash("1")).toBe(false);
    expect(isValidAvatarHash("5")).toBe(false);
  });

  it("should handle hashes with extensions", () => {
    expect(isValidAvatarHash("a_1234567890abcdef1234567890abcd.png")).toBe(
      true,
    );
    expect(isValidAvatarHash("1234567890abcdef1234567890abcdef.jpg")).toBe(
      true,
    );
  });

  it("should return false for null and undefined", () => {
    expect(isValidAvatarHash(null)).toBe(false);
    expect(isValidAvatarHash(undefined)).toBe(false);
  });

  it("should return false for short strings", () => {
    expect(isValidAvatarHash("ab")).toBe(false);
    expect(isValidAvatarHash("a")).toBe(false);
  });
});

describe("getAvatarUrl", () => {
  it("should return null for emoji avatars", () => {
    const result = getAvatarUrl("123456789", "🚀");
    expect(result).toBeNull();
  });

  it("should return null for invalid avatars", () => {
    expect(getAvatarUrl("123456789", null)).toBeNull();
    expect(getAvatarUrl("123456789", undefined)).toBeNull();
    expect(getAvatarUrl("123456789", "")).toBeNull();
  });

  it("should return full URL for allowed domains", () => {
    const tigrisUrl = "https://fly.storage.tigris.dev/bucket/avatar.png";
    expect(getAvatarUrl("123456789", tigrisUrl)).toBe(tigrisUrl);

    const discordUrl = "https://cdn.discordapp.com/avatars/123/abc.png";
    expect(getAvatarUrl("123456789", discordUrl)).toBe(discordUrl);
  });

  it("should return full URL for subdomains of allowed domains", () => {
    const subdomainUrl =
      "https://us-west.fly.storage.tigris.dev/bucket/avatar.png";
    expect(getAvatarUrl("123456789", subdomainUrl)).toBe(subdomainUrl);
  });

  it("should reject URLs from disallowed domains", () => {
    const badUrl = "https://malicious.com/avatar.png";
    expect(getAvatarUrl("123456789", badUrl)).toBeNull();
  });

  it("should construct Discord CDN URL for valid hashes", () => {
    const result = getAvatarUrl("123456789", "abc123def456");
    expect(result).toContain(
      "cdn.discordapp.com/avatars/123456789/abc123def456.png",
    );
    expect(result).toContain("size=128");
  });

  it("should handle different sizes", () => {
    const result256 = getAvatarUrl("123456789", "abc123def456", 256);
    expect(result256).toContain("size=256");

    const result64 = getAvatarUrl("123456789", "abc123def456", 64);
    expect(result64).toContain("size=64");
  });

  it("should round to nearest valid size", () => {
    const result = getAvatarUrl("123456789", "abc123def456", 100);
    expect(result).toContain("size=128"); // Closest valid size
  });

  it("should return null when discordId is missing for hash", () => {
    const result = getAvatarUrl(null, "abc123def456");
    expect(result).toBeNull();
  });
});
