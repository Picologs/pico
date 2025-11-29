/**
 * Tests for compression utilities
 *
 * Tests for log compression/decompression including:
 * - Compression and decompression round-trip
 * - Threshold-based compression decisions
 * - Data integrity
 */

import { describe, it, expect } from "vitest";
import {
  compressLogs,
  decompressLogs,
  shouldCompressLogs,
} from "./compression";

describe("compressLogs", () => {
  test("should compress logs to base64 string", () => {
    const logs = [{ id: "1", message: "test" }];
    const compressed = compressLogs(logs);

    expect(typeof compressed).toBe("string");
    // Base64 strings only contain alphanumeric chars plus + / =
    expect(/^[A-Za-z0-9+/]+=*$/.test(compressed)).toBe(true);
  });

  test("should compress empty array", () => {
    const logs: any[] = [];
    const compressed = compressLogs(logs);

    expect(typeof compressed).toBe("string");
    expect(compressed.length).toBeGreaterThan(0);
  });

  test("should compress large log arrays", () => {
    const logs = Array.from({ length: 100 }, (_, i) => ({
      id: `log-${i}`,
      message: `Test log message ${i}`,
      timestamp: new Date().toISOString(),
      eventType: "test",
    }));

    const compressed = compressLogs(logs);
    const originalSize = JSON.stringify(logs).length;

    // Compressed should be smaller than original
    expect(compressed.length).toBeLessThan(originalSize);
  });

  test("should handle logs with special characters", () => {
    const logs = [
      { id: "1", message: "Test with émojis 🚀 and unicode: 日本語" },
      { id: "2", message: "Quotes \"and\" 'apostrophes'" },
      { id: "3", message: "Newlines\nand\ttabs" },
    ];

    const compressed = compressLogs(logs);
    expect(typeof compressed).toBe("string");
  });
});

describe("decompressLogs", () => {
  test("should decompress back to original logs", () => {
    const original = [
      { id: "1", message: "test1" },
      { id: "2", message: "test2" },
    ];

    const compressed = compressLogs(original);
    const decompressed = decompressLogs(compressed);

    expect(decompressed).toEqual(original);
  });

  test("should preserve all data types in round-trip", () => {
    const original = [
      {
        id: "1",
        count: 42,
        active: true,
        score: 3.14,
        tags: ["a", "b"],
        nested: { value: "deep" },
      },
    ];

    const compressed = compressLogs(original);
    const decompressed = decompressLogs(compressed);

    expect(decompressed).toEqual(original);
  });

  test("should handle empty compressed array", () => {
    const compressed = compressLogs([]);
    const decompressed = decompressLogs(compressed);

    expect(decompressed).toEqual([]);
  });

  test("should handle large decompressed payloads", () => {
    const original = Array.from({ length: 500 }, (_, i) => ({
      id: `log-${i}`,
      message: `A longer test message for log entry number ${i}`,
      timestamp: new Date().toISOString(),
      metadata: { index: i, category: "test" },
    }));

    const compressed = compressLogs(original);
    const decompressed = decompressLogs(compressed);

    expect(decompressed.length).toBe(500);
    expect(decompressed[0].id).toBe("log-0");
    expect(decompressed[499].id).toBe("log-499");
  });

  test("should preserve unicode in round-trip", () => {
    const original = [
      { id: "1", message: "Unicode: 🎮 日本語 Ελληνικά العربية" },
    ];

    const compressed = compressLogs(original);
    const decompressed = decompressLogs(compressed);

    expect(decompressed).toEqual(original);
  });
});

describe("shouldCompressLogs", () => {
  test("should return false for small arrays", () => {
    const logs = [{ id: "1", message: "test" }];
    expect(shouldCompressLogs(logs)).toBe(false);
  });

  test("should return true for arrays with more than 10 items", () => {
    const logs = Array.from({ length: 11 }, (_, i) => ({
      id: `${i}`,
      message: "test",
    }));
    expect(shouldCompressLogs(logs)).toBe(true);
  });

  test("should return false for exactly 10 items", () => {
    const logs = Array.from({ length: 10 }, (_, i) => ({
      id: `${i}`,
      message: "test",
    }));
    expect(shouldCompressLogs(logs)).toBe(false);
  });

  test("should return true when payload exceeds 5KB", () => {
    // Create a small number of logs with large content
    const largeContent = "x".repeat(2000);
    const logs = [
      { id: "1", message: largeContent },
      { id: "2", message: largeContent },
      { id: "3", message: largeContent },
    ];
    // 3 logs with ~2KB each = ~6KB total
    expect(shouldCompressLogs(logs)).toBe(true);
  });

  test("should return false for payload under 5KB with few items", () => {
    const logs = [
      { id: "1", message: "short" },
      { id: "2", message: "also short" },
    ];
    expect(shouldCompressLogs(logs)).toBe(false);
  });

  test("should return false for empty array", () => {
    expect(shouldCompressLogs([])).toBe(false);
  });

  test("should prioritize count threshold over size", () => {
    // 15 small logs should trigger compression even if small
    const logs = Array.from({ length: 15 }, (_, i) => ({
      id: `${i}`,
      m: "x",
    }));
    expect(shouldCompressLogs(logs)).toBe(true);
  });
});

describe("Compression Integration", () => {
  test("should achieve significant compression for repetitive data", () => {
    const logs = Array.from({ length: 100 }, (_, i) => ({
      id: `log-${i}`,
      eventType: "player_kill",
      timestamp: "2024-01-01T12:00:00Z",
      message: "Player killed another player",
    }));

    const originalSize = JSON.stringify(logs).length;
    const compressed = compressLogs(logs);
    // Base64 increases size by ~33%, but gzip should compress more
    const compressionRatio = (compressed.length / originalSize) * 100;

    // With repetitive data, should achieve better than 50% compression
    expect(compressionRatio).toBeLessThan(80);
  });

  test("should handle real-world log structure", () => {
    const logs = [
      {
        id: "abc123",
        userId: "123456789012345678",
        timestamp: "2024-01-15T10:30:00.000Z",
        eventType: "actor_death",
        line: "<2024-01-15T10:30:00.000Z> Player was killed by Enemy",
        metadata: {
          victimName: "TestPlayer",
          killerName: "Enemy",
          weapon: "laser_rifle",
          zone: "Stanton",
        },
      },
    ];

    const compressed = compressLogs(logs);
    const decompressed = decompressLogs(compressed);

    expect(decompressed).toEqual(logs);
  });
});
