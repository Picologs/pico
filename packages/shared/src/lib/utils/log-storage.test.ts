/**
 * Log Storage Tests
 *
 * Tests for storage-based log caching utilities.
 * The implementation uses localStorage (LocalStorageAdapter) by default.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Log } from "@pico/types";

// Mock localStorage (the implementation uses localStorage, not sessionStorage)
class LocalStorageMock {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] || null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = value;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }

  get length(): number {
    return Object.keys(this.store).length;
  }

  key(index: number): string | null {
    const keys = Object.keys(this.store);
    return keys[index] || null;
  }
}

// Store original console for restoration
const originalConsole = global.console;

const createMockLog = (id: string, timestamp?: string): Log => ({
  id,
  timestamp: timestamp || new Date().toISOString(),
  eventType: "kill",
  emoji: "💀",
  line: "Test log",
  userId: "user-123",
});

describe("log-storage", () => {
  beforeEach(async () => {
    // Reset modules to clear the singleton storageAdapter
    vi.resetModules();

    // Create fresh localStorage mock for each test to ensure isolation
    global.localStorage = new LocalStorageMock() as any;

    // Mock console to avoid noise in tests
    global.console = {
      ...originalConsole,
      warn: vi.fn(),
      error: vi.fn(),
    } as any;

    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  // Helper to import module fresh after reset
  async function importLogStorage() {
    return await import("./log-storage");
  }

  describe("loadLogs", () => {
    it("should return empty array when no logs exist", async () => {
      const { loadLogs } = await importLogStorage();
      const logs = await loadLogs("user-123");
      expect(logs).toEqual([]);
    });

    it("should load saved logs", async () => {
      const { loadLogs, saveLogs } = await importLogStorage();
      const testLogs = [createMockLog("log-1"), createMockLog("log-2")];
      await saveLogs("user-123", testLogs);

      const loaded = await loadLogs("user-123");
      expect(loaded).toHaveLength(2);
      expect(loaded[0].id).toBe("log-1");
    });

    it("should filter expired logs", async () => {
      const { loadLogs, saveLogs } = await importLogStorage();
      const now = new Date();
      const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
      const testLogs = [
        createMockLog("log-fresh", now.toISOString()),
        createMockLog("log-expired", eightDaysAgo.toISOString()),
      ];
      await saveLogs("user-123", testLogs);

      const loaded = await loadLogs("user-123");
      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe("log-fresh");
    });

    it("should handle version mismatch", async () => {
      const { loadLogs } = await importLogStorage();
      localStorage.setItem(
        "picologs_logs_user-123",
        JSON.stringify({ version: 999, logs: [createMockLog("log-1")] }),
      );

      const loaded = await loadLogs("user-123");
      expect(loaded).toEqual([]);
      expect(console.warn).toHaveBeenCalledWith(
        "Log cache version mismatch, clearing cache",
      );
    });

    it("should handle malformed JSON", async () => {
      const { loadLogs } = await importLogStorage();
      localStorage.setItem("picologs_logs_user-123", "invalid-json");

      const loaded = await loadLogs("user-123");
      expect(loaded).toEqual([]);
      expect(console.error).toHaveBeenCalled();
    });

    it("should isolate logs by user ID", async () => {
      const { loadLogs, saveLogs } = await importLogStorage();
      const logs1 = [createMockLog("log-user1")];
      const logs2 = [createMockLog("log-user2")];

      await saveLogs("user-1", logs1);
      await saveLogs("user-2", logs2);

      const loaded1 = await loadLogs("user-1");
      const loaded2 = await loadLogs("user-2");
      expect(loaded1[0].id).toBe("log-user1");
      expect(loaded2[0].id).toBe("log-user2");
    });
  });

  describe("saveLogs", () => {
    it("should save logs to localStorage", async () => {
      const { saveLogs } = await importLogStorage();
      const testLogs = [createMockLog("log-1")];
      await saveLogs("user-123", testLogs);

      const stored = localStorage.getItem("picologs_logs_user-123");
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed.version).toBe(1);
      expect(parsed.logs).toHaveLength(1);
    });

    it("should handle empty array", async () => {
      const { loadLogs, saveLogs } = await importLogStorage();
      await saveLogs("user-123", []);
      const loaded = await loadLogs("user-123");
      expect(loaded).toEqual([]);
    });

    it("should include lastUpdated timestamp", async () => {
      const { saveLogs } = await importLogStorage();
      const before = Date.now();
      await saveLogs("user-123", [createMockLog("log-1")]);
      const after = Date.now();

      const stored = JSON.parse(
        localStorage.getItem("picologs_logs_user-123")!,
      );
      expect(stored.lastUpdated).toBeGreaterThanOrEqual(before);
      expect(stored.lastUpdated).toBeLessThanOrEqual(after);
    });

    it("should handle storage errors gracefully", async () => {
      const { saveLogs } = await importLogStorage();
      // Mock setItem to throw an error
      const setItemSpy = vi
        .spyOn(localStorage, "setItem")
        .mockImplementation(() => {
          throw new Error("Storage error");
        });

      const logs = [createMockLog("log-1"), createMockLog("log-2")];

      // Should not throw - gracefully handles errors
      await expect(saveLogs("user-123", logs)).resolves.not.toThrow();

      setItemSpy.mockRestore();
    });

    it("should handle QuotaExceededError retry failure gracefully", async () => {
      const { saveLogs } = await importLogStorage();
      const setItemSpy = vi
        .spyOn(localStorage, "setItem")
        .mockImplementation(() => {
          // Always throw QuotaExceededError
          const error = new DOMException(
            "QuotaExceededError",
            "QuotaExceededError",
          );
          throw error;
        });

      const logs = [createMockLog("log-1")];

      // Should not throw even if retry fails
      await expect(saveLogs("user-123", logs)).resolves.not.toThrow();

      setItemSpy.mockRestore();
    });
  });

  describe("clearLogs", () => {
    it("should remove logs from localStorage", async () => {
      const { clearLogs, saveLogs } = await importLogStorage();
      await saveLogs("user-123", [createMockLog("log-1")]);
      expect(localStorage.getItem("picologs_logs_user-123")).toBeTruthy();

      await clearLogs("user-123");
      expect(localStorage.getItem("picologs_logs_user-123")).toBeNull();
    });

    it("should not affect other users", async () => {
      const { clearLogs, saveLogs } = await importLogStorage();
      await saveLogs("user-1", [createMockLog("log-1")]);
      await saveLogs("user-2", [createMockLog("log-2")]);

      await clearLogs("user-1");

      expect(localStorage.getItem("picologs_logs_user-1")).toBeNull();
      expect(localStorage.getItem("picologs_logs_user-2")).toBeTruthy();
    });

    it("should handle removeItem errors gracefully", async () => {
      const { clearLogs } = await importLogStorage();
      const removeItemSpy = vi
        .spyOn(localStorage, "removeItem")
        .mockImplementation(() => {
          throw new Error("Remove error");
        });

      // Should not throw
      await expect(clearLogs("user-123")).resolves.not.toThrow();

      removeItemSpy.mockRestore();
    });
  });

  describe("getLogIds", () => {
    it("should return Set of log IDs", async () => {
      const { getLogIds, saveLogs } = await importLogStorage();
      const testLogs = [
        createMockLog("log-1"),
        createMockLog("log-2"),
        createMockLog("log-3"),
      ];
      await saveLogs("user-123", testLogs);

      const ids = await getLogIds("user-123");
      expect(ids).toBeInstanceOf(Set);
      expect(ids.size).toBe(3);
      expect(ids.has("log-1")).toBe(true);
      expect(ids.has("log-2")).toBe(true);
      expect(ids.has("log-3")).toBe(true);
    });

    it("should return empty Set when no logs exist", async () => {
      const { getLogIds } = await importLogStorage();
      const ids = await getLogIds("user-123");
      expect(ids).toBeInstanceOf(Set);
      expect(ids.size).toBe(0);
    });
  });

  describe("getLogCount", () => {
    it("should return correct count", async () => {
      const { getLogCount, saveLogs } = await importLogStorage();
      const testLogs = [createMockLog("log-1"), createMockLog("log-2")];
      await saveLogs("user-123", testLogs);

      const count = await getLogCount("user-123");
      expect(count).toBe(2);
    });

    it("should return 0 when no logs exist", async () => {
      const { getLogCount } = await importLogStorage();
      const count = await getLogCount("user-123");
      expect(count).toBe(0);
    });
  });

  describe("getCacheSize", () => {
    it("should return approximate size in bytes", async () => {
      const { getCacheSize, saveLogs } = await importLogStorage();
      const testLogs = [createMockLog("log-1")];
      await saveLogs("user-123", testLogs);

      const size = await getCacheSize("user-123");
      expect(size).toBeGreaterThan(0);
    });

    it("should return 0 when no cache exists", async () => {
      const { getCacheSize } = await importLogStorage();
      const size = await getCacheSize("user-123");
      expect(size).toBe(0);
    });

    it("should return larger size for more logs", async () => {
      const { getCacheSize, saveLogs } = await importLogStorage();
      const smallCache = [createMockLog("log-1")];
      const largeCache = Array.from({ length: 10 }, (_, i) =>
        createMockLog(`log-${i}`),
      );

      await saveLogs("user-small", smallCache);
      await saveLogs("user-large", largeCache);

      const smallSize = await getCacheSize("user-small");
      const largeSize = await getCacheSize("user-large");

      expect(largeSize).toBeGreaterThan(smallSize);
    });

    it("should handle getItem errors gracefully", async () => {
      const { getCacheSize } = await importLogStorage();
      const getItemSpy = vi
        .spyOn(localStorage, "getItem")
        .mockImplementation(() => {
          throw new Error("getItem error");
        });

      // Should return 0 on error
      const size = await getCacheSize("user-123");
      expect(size).toBe(0);

      getItemSpy.mockRestore();
    });
  });

  describe("Integration scenarios", () => {
    it("should handle save/load/clear cycle", async () => {
      const { clearLogs, loadLogs, saveLogs } = await importLogStorage();
      const logs = [createMockLog("log-1"), createMockLog("log-2")];

      await saveLogs("user-123", logs);
      const loaded = await loadLogs("user-123");
      expect(loaded).toHaveLength(2);

      await clearLogs("user-123");
      const afterClear = await loadLogs("user-123");
      expect(afterClear).toEqual([]);
    });

    it("should auto-prune expired logs on load", async () => {
      const { loadLogs, saveLogs } = await importLogStorage();
      const now = new Date();
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      const logs = [
        createMockLog("log-fresh-1", now.toISOString()),
        createMockLog("log-expired", tenDaysAgo.toISOString()),
        createMockLog("log-fresh-2", now.toISOString()),
      ];

      await saveLogs("user-123", logs);

      // Load should auto-prune
      const loaded = await loadLogs("user-123");
      expect(loaded).toHaveLength(2);
      expect(loaded.every((log) => log.id.startsWith("log-fresh"))).toBe(true);
    });
  });
});
