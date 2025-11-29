/**
 * Discord Colors Utility Tests
 *
 * Tests for the Discord avatar color utility that generates consistent
 * colors based on user IDs.
 */

import { describe, it, expect } from "vitest";
import { getDiscordColor } from "./discord-colors";

describe("getDiscordColor", () => {
  it("should return a valid Discord color", () => {
    const validColors = [
      "#ED4245", // Red
      "#5865F2", // Blurple
      "#57F287", // Green
      "#F0B232", // Orange
      "#EB459E", // Pink
    ];

    const color = getDiscordColor("123456789");
    expect(validColors).toContain(color);
  });

  it("should return consistent color for same user ID", () => {
    const userId = "987654321";
    const color1 = getDiscordColor(userId);
    const color2 = getDiscordColor(userId);
    const color3 = getDiscordColor(userId);

    expect(color1).toBe(color2);
    expect(color2).toBe(color3);
  });

  it("should return different colors for different user IDs", () => {
    // Test enough IDs to ensure we get at least 2 different colors
    const userIds = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
    const colors = userIds.map((id) => getDiscordColor(id));

    // With 10 users and 5 colors, we should have some variety
    const uniqueColors = new Set(colors);
    expect(uniqueColors.size).toBeGreaterThan(1);
  });

  it("should handle empty string", () => {
    const validColors = ["#ED4245", "#5865F2", "#57F287", "#F0B232", "#EB459E"];
    const color = getDiscordColor("");
    expect(validColors).toContain(color);
  });

  it("should handle very long user IDs", () => {
    const validColors = ["#ED4245", "#5865F2", "#57F287", "#F0B232", "#EB459E"];
    const longUserId = "1".repeat(1000);
    const color = getDiscordColor(longUserId);
    expect(validColors).toContain(color);
  });

  it("should handle special characters in user ID", () => {
    const validColors = ["#ED4245", "#5865F2", "#57F287", "#F0B232", "#EB459E"];
    const color = getDiscordColor("user-123_abc");
    expect(validColors).toContain(color);
  });

  it("should distribute colors across the palette", () => {
    // Test 100 sequential user IDs to ensure good distribution
    const colors = Array.from({ length: 100 }, (_, i) =>
      getDiscordColor(String(i)),
    );
    const uniqueColors = new Set(colors);

    // With 100 users and 5 colors, we should get all 5 colors
    expect(uniqueColors.size).toBe(5);
  });

  it("should handle numeric user IDs consistently", () => {
    const userId = "123456789012345678";
    const color1 = getDiscordColor(userId);
    const color2 = getDiscordColor(userId);

    expect(color1).toBe(color2);
  });
});
