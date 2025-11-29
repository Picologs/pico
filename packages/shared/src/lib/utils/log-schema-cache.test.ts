/**
 * Tests for log schema cache with beta tester gating
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  addPattern,
  flushPatterns,
  setBetaTesterEnabled,
  resetPatternCache,
  getPatternCacheStats,
  initPatternCache,
  destroyPatternCache,
} from "./log-schema-cache.svelte";
import type { RawLogPattern } from "@pico/types";

const mockPattern: RawLogPattern = {
  eventName: "TestEvent",
  severity: "info",
  teams: ["gameplay"],
  subsystems: ["physics"],
  signature: "test-sig-123",
  exampleLine: "<2024-01-01T00:00:00Z> TestEvent occurred",
};

describe("setBetaTesterEnabled", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetPatternCache();
    setBetaTesterEnabled(false); // Reset to default
  });

  afterEach(() => {
    destroyPatternCache();
    vi.useRealTimers();
  });

  describe("when betaTester is disabled (default)", () => {
    it("addPattern should return false and not add to queue", () => {
      setBetaTesterEnabled(false);
      const result = addPattern(mockPattern);
      expect(result).toBe(false);
      expect(getPatternCacheStats().pendingCount).toBe(0);
    });

    it("addPattern should not increment session counts", () => {
      setBetaTesterEnabled(false);
      addPattern(mockPattern);
      const stats = getPatternCacheStats();
      expect(stats.sessionReportCount).toBe(0);
      expect(stats.uniqueSignatures).toBe(0);
    });

    it("flushPatterns should do nothing when disabled", () => {
      // First enable to add a pattern
      setBetaTesterEnabled(true);
      addPattern(mockPattern);
      expect(getPatternCacheStats().pendingCount).toBe(1);

      // Now disable and try to flush
      setBetaTesterEnabled(false);

      let callbackCalled = false;
      initPatternCache(() => {
        callbackCalled = true;
      });
      flushPatterns();

      // Callback should not be called when disabled
      expect(callbackCalled).toBe(false);
      // Patterns should still be pending (not flushed)
      expect(getPatternCacheStats().pendingCount).toBe(1);
    });
  });

  describe("when betaTester is enabled", () => {
    beforeEach(() => {
      setBetaTesterEnabled(true);
    });

    it("addPattern should return true and add to queue", () => {
      const result = addPattern(mockPattern);
      expect(result).toBe(true);
      expect(getPatternCacheStats().pendingCount).toBe(1);
    });

    it("addPattern should deduplicate same signature", () => {
      addPattern(mockPattern);
      const result = addPattern(mockPattern);
      expect(result).toBe(false); // Deduplicated
      expect(getPatternCacheStats().pendingCount).toBe(1);
      expect(getPatternCacheStats().sessionDedupeCount).toBe(1);
    });

    it("flushPatterns should call callback with patterns", () => {
      let sentPatterns: RawLogPattern[] = [];
      initPatternCache((patterns) => {
        sentPatterns = patterns;
      });

      addPattern(mockPattern);
      flushPatterns();

      expect(sentPatterns).toHaveLength(1);
      expect(sentPatterns[0].signature).toBe("test-sig-123");
    });

    it("should clear pending queue after flush", () => {
      initPatternCache(() => {});
      addPattern(mockPattern);
      expect(getPatternCacheStats().pendingCount).toBe(1);

      flushPatterns();
      expect(getPatternCacheStats().pendingCount).toBe(0);
    });

    it("should track session report count after flush", () => {
      initPatternCache(() => {});
      addPattern(mockPattern);
      addPattern({ ...mockPattern, signature: "sig-2" });

      flushPatterns();
      expect(getPatternCacheStats().sessionReportCount).toBe(2);
    });
  });

  describe("toggling betaTester mid-session", () => {
    it("should stop accepting patterns when disabled", () => {
      setBetaTesterEnabled(true);
      addPattern(mockPattern);
      expect(getPatternCacheStats().pendingCount).toBe(1);

      setBetaTesterEnabled(false);
      addPattern({ ...mockPattern, signature: "new-sig" });
      expect(getPatternCacheStats().pendingCount).toBe(1); // Still 1
    });

    it("should resume accepting patterns when re-enabled", () => {
      setBetaTesterEnabled(false);
      addPattern(mockPattern);
      expect(getPatternCacheStats().pendingCount).toBe(0);

      setBetaTesterEnabled(true);
      addPattern({ ...mockPattern, signature: "new-sig" });
      expect(getPatternCacheStats().pendingCount).toBe(1);
    });

    it("should preserve pending patterns across toggle", () => {
      setBetaTesterEnabled(true);
      addPattern(mockPattern);

      setBetaTesterEnabled(false);
      // Patterns should still be in queue, just not flushed

      setBetaTesterEnabled(true);
      // Now flush should work
      let sentPatterns: RawLogPattern[] = [];
      initPatternCache((patterns) => {
        sentPatterns = patterns;
      });
      flushPatterns();

      expect(sentPatterns).toHaveLength(1);
    });
  });

  describe("edge cases", () => {
    it("should handle multiple rapid toggles", () => {
      setBetaTesterEnabled(true);
      setBetaTesterEnabled(false);
      setBetaTesterEnabled(true);
      setBetaTesterEnabled(false);

      addPattern(mockPattern);
      expect(getPatternCacheStats().pendingCount).toBe(0);
    });

    it("should handle empty patterns array gracefully", () => {
      setBetaTesterEnabled(true);
      // Don't add any patterns
      initPatternCache(() => {});
      flushPatterns(); // Should not throw

      expect(getPatternCacheStats().pendingCount).toBe(0);
      expect(getPatternCacheStats().sessionReportCount).toBe(0);
    });
  });
});
