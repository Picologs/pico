/**
 * Log ID Generation Tests
 *
 * Tests for the log ID generation utility that creates deterministic IDs
 * based on timestamp and content.
 */

import { describe, it, expect } from "vitest";
import { generateId } from "./log-id";

describe("generateId", () => {
  it("should generate a unique ID from timestamp and line", () => {
    const timestamp = new Date("2025-01-15T12:00:00.000Z");
    const line = "Test log line";

    const id = generateId(timestamp, line);

    expect(id).toBeTypeOf("string");
    expect(id).toContain("log-");
    expect(id).toContain(String(timestamp.getTime()));
  });

  it("should generate consistent IDs for same inputs", () => {
    const timestamp = new Date("2025-01-15T12:00:00.000Z");
    const line = "Test log line";

    const id1 = generateId(timestamp, line);
    const id2 = generateId(timestamp, line);
    const id3 = generateId(timestamp, line);

    expect(id1).toBe(id2);
    expect(id2).toBe(id3);
  });

  it("should generate different IDs for different timestamps", () => {
    const timestamp1 = new Date("2025-01-15T12:00:00.000Z");
    const timestamp2 = new Date("2025-01-15T12:00:01.000Z");
    const line = "Same log line";

    const id1 = generateId(timestamp1, line);
    const id2 = generateId(timestamp2, line);

    expect(id1).not.toBe(id2);
  });

  it("should generate different IDs for different lines", () => {
    const timestamp = new Date("2025-01-15T12:00:00.000Z");
    const line1 = "First log line";
    const line2 = "Second log line";

    const id1 = generateId(timestamp, line1);
    const id2 = generateId(timestamp, line2);

    expect(id1).not.toBe(id2);
  });

  it("should handle empty log lines", () => {
    const timestamp = new Date("2025-01-15T12:00:00.000Z");
    const line = "";

    const id = generateId(timestamp, line);

    expect(id).toBeTypeOf("string");
    expect(id).toContain("log-");
  });

  it("should handle very long log lines", () => {
    const timestamp = new Date("2025-01-15T12:00:00.000Z");
    const line = "X".repeat(10000);

    const id = generateId(timestamp, line);

    expect(id).toBeTypeOf("string");
    expect(id).toContain("log-");
    // ID should be much shorter than the input
    expect(id.length).toBeLessThan(100);
  });

  it("should handle special characters in log lines", () => {
    const timestamp = new Date("2025-01-15T12:00:00.000Z");
    const line = "🚀 Special chars: <>&\"'";

    const id = generateId(timestamp, line);

    expect(id).toBeTypeOf("string");
    expect(id).toContain("log-");
  });

  it("should generate valid base36 hash component", () => {
    const timestamp = new Date("2025-01-15T12:00:00.000Z");
    const line = "Test log line";

    const id = generateId(timestamp, line);
    const parts = id.split("-");

    // Should have format: log-{timestamp}-{hash}
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe("log");
    expect(parts[1]).toBe(String(timestamp.getTime()));
    // Hash should be alphanumeric (base36)
    expect(parts[2]).toMatch(/^[a-z0-9]+$/);
  });

  it("should handle millisecond precision in timestamps", () => {
    const timestamp1 = new Date("2025-01-15T12:00:00.000Z");
    const timestamp2 = new Date("2025-01-15T12:00:00.001Z");
    const line = "Same log line";

    const id1 = generateId(timestamp1, line);
    const id2 = generateId(timestamp2, line);

    // Different milliseconds should produce different IDs
    expect(id1).not.toBe(id2);
  });

  it("should handle multiline log content", () => {
    const timestamp = new Date("2025-01-15T12:00:00.000Z");
    const line = "Line 1\nLine 2\nLine 3";

    const id = generateId(timestamp, line);

    expect(id).toBeTypeOf("string");
    expect(id).toContain("log-");
  });

  it("should produce different IDs for similar but different content", () => {
    const timestamp = new Date("2025-01-15T12:00:00.000Z");
    const line1 = "Player killed NPC";
    const line2 = "Player killed NPCs"; // Only one character different

    const id1 = generateId(timestamp, line1);
    const id2 = generateId(timestamp, line2);

    expect(id1).not.toBe(id2);
  });

  it("should handle Unicode characters", () => {
    const timestamp = new Date("2025-01-15T12:00:00.000Z");
    const line = "Player: 玩家123 killed NPC: エヌピーシー";

    const id = generateId(timestamp, line);

    expect(id).toBeTypeOf("string");
    expect(id).toContain("log-");
  });

  it("should generate consistent IDs across multiple calls", () => {
    const timestamp = new Date("2025-01-15T12:00:00.000Z");
    const line = "<2025-01-15T12:00:00.000Z> <Death> Player was killed by NPC";

    // Generate ID multiple times
    const ids = Array.from({ length: 100 }, () => generateId(timestamp, line));
    const uniqueIds = new Set(ids);

    // All IDs should be identical
    expect(uniqueIds.size).toBe(1);
  });
});
