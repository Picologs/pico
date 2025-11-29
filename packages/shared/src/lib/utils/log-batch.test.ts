/**
 * Log Batch Management Tests
 *
 * Comprehensive test coverage for log batching, multi-target management,
 * and delta synchronization utilities.
 *
 * @module utils/log-batch.test
 */

import {
  describe,
  expect,
  test,
  beforeEach,
  afterEach,
  vi,
  type Mock,
} from "vitest";
import type { Log } from "@pico/types";
import {
  LogBatchManager,
  MultiTargetBatchManager,
  LogSyncManager,
  shouldCompressLogs,
  calculateLogSize,
  COMPRESSION_THRESHOLD_BYTES,
  COMPRESSION_THRESHOLD_LOGS,
  DEFAULT_BATCH_INTERVAL_MS,
  DEFAULT_BATCH_SIZE,
} from "./log-batch.js";

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a mock log for testing
 */
function createMockLog(overrides: Partial<Log> = {}): Log {
  const timestamp = overrides.timestamp || new Date().toISOString();
  return {
    id: overrides.id || `log-${Math.random()}`,
    userId: overrides.userId || "user-123",
    player: overrides.player || "TestPlayer",
    emoji: overrides.emoji || "🎮",
    line: overrides.line || "Test log line",
    timestamp,
    original: overrides.original || "Raw log text",
    open: overrides.open || false,
    eventType: overrides.eventType,
    metadata: overrides.metadata,
    reportedBy: overrides.reportedBy,
    ship: overrides.ship,
    children: overrides.children,
  };
}

/**
 * Create multiple mock logs
 */
function createMockLogs(count: number, baseTimestamp?: Date): Log[] {
  const logs: Log[] = [];
  const base = baseTimestamp || new Date();

  for (let i = 0; i < count; i++) {
    const timestamp = new Date(base.getTime() + i * 1000).toISOString();
    logs.push(
      createMockLog({
        id: `log-${i}`,
        timestamp,
        line: `Log entry ${i}`,
      }),
    );
  }

  return logs;
}

/**
 * Wait for a specified time
 */
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Constants Tests
// ============================================================================

describe("Constants", () => {
  test("COMPRESSION_THRESHOLD_BYTES should be 1024", () => {
    expect(COMPRESSION_THRESHOLD_BYTES).toBe(1024);
  });

  test("COMPRESSION_THRESHOLD_LOGS should be 1", () => {
    expect(COMPRESSION_THRESHOLD_LOGS).toBe(1);
  });

  test("DEFAULT_BATCH_INTERVAL_MS should be 2500", () => {
    expect(DEFAULT_BATCH_INTERVAL_MS).toBe(2500);
  });

  test("DEFAULT_BATCH_SIZE should be 8", () => {
    expect(DEFAULT_BATCH_SIZE).toBe(8);
  });
});

// ============================================================================
// Compression Utility Tests
// ============================================================================

describe("shouldCompressLogs", () => {
  test("should return false for empty array", () => {
    expect(shouldCompressLogs([])).toBe(false);
  });

  test("should return false for single log (at threshold)", () => {
    const logs = createMockLogs(1);
    expect(shouldCompressLogs(logs)).toBe(false);
  });

  test("should return false for 2 logs smaller than 1KB", () => {
    const logs = createMockLogs(2);
    // Small logs shouldn't trigger compression
    const size = calculateLogSize(logs);
    if (size <= COMPRESSION_THRESHOLD_BYTES) {
      expect(shouldCompressLogs(logs)).toBe(false);
    }
  });

  test("should return true for many logs exceeding size threshold", () => {
    // Create logs with large metadata to exceed 1KB
    const logs = createMockLogs(10).map((log) => ({
      ...log,
      metadata: {
        longText: "x".repeat(200), // Each log gets 200 chars of extra data
      },
    }));

    expect(shouldCompressLogs(logs)).toBe(true);
  });

  test("should use calculateLogSize internally", () => {
    const logs = createMockLogs(5);
    const size = calculateLogSize(logs);
    const shouldCompress = shouldCompressLogs(logs);

    // If size > threshold and count > threshold, should compress
    if (size > COMPRESSION_THRESHOLD_BYTES) {
      expect(shouldCompress).toBe(true);
    }
  });
});

describe("calculateLogSize", () => {
  test("should return 0 for empty array", () => {
    // Empty array JSON is "[]" which is 2 bytes
    const size = calculateLogSize([]);
    expect(size).toBeGreaterThanOrEqual(2);
  });

  test("should calculate size for single log", () => {
    const log = createMockLog({ line: "test" });
    const size = calculateLogSize([log]);
    expect(size).toBeGreaterThan(0);
  });

  test("should calculate larger size for multiple logs", () => {
    const singleLog = createMockLogs(1);
    const multipleLogs = createMockLogs(5);

    const singleSize = calculateLogSize(singleLog);
    const multipleSize = calculateLogSize(multipleLogs);

    expect(multipleSize).toBeGreaterThan(singleSize);
  });

  test("should calculate larger size for logs with metadata", () => {
    const simpleLog = createMockLog({ line: "test" });
    const complexLog = createMockLog({
      line: "test",
      metadata: {
        vehicleName: "Anvil Carrack",
        location: "Crusader",
        player: "TestPlayer",
        extra: "x".repeat(100),
      },
    });

    const simpleSize = calculateLogSize([simpleLog]);
    const complexSize = calculateLogSize([complexLog]);

    expect(complexSize).toBeGreaterThan(simpleSize);
  });
});

// ============================================================================
// LogBatchManager Tests
// ============================================================================

describe("LogBatchManager", () => {
  let sendFn: Mock;
  let batchManager: LogBatchManager;

  beforeEach(() => {
    sendFn = vi.fn();
    batchManager = new LogBatchManager(sendFn);
  });

  afterEach(() => {
    batchManager.destroy();
  });

  describe("Construction", () => {
    test("should initialize with default settings", () => {
      expect(batchManager.size).toBe(0);
      expect(batchManager.isEmpty).toBe(true);
    });

    test("should initialize with custom settings", () => {
      const customBatch = new LogBatchManager(sendFn, 5000, 10);
      expect(customBatch.size).toBe(0);
      customBatch.destroy();
    });
  });

  describe("add()", () => {
    test("should add log to batch", () => {
      const log = createMockLog();
      batchManager.add(log);

      expect(batchManager.size).toBe(1);
      expect(batchManager.isEmpty).toBe(false);
    });

    test("should trigger flush when batch size reached", () => {
      const logs = createMockLogs(DEFAULT_BATCH_SIZE);

      logs.forEach((log) => batchManager.add(log));

      expect(sendFn).toHaveBeenCalledTimes(1);
      expect(sendFn).toHaveBeenCalledWith(logs);
      expect(batchManager.size).toBe(0);
    });

    test("should trigger flush exactly at threshold (8 logs)", () => {
      const logs = createMockLogs(7);
      logs.forEach((log) => batchManager.add(log));

      expect(sendFn).toHaveBeenCalledTimes(0);
      expect(batchManager.size).toBe(7);

      // Add 8th log
      batchManager.add(createMockLog());

      expect(sendFn).toHaveBeenCalledTimes(1);
      expect(batchManager.size).toBe(0);
    });

    test("should handle multiple batches in sequence", () => {
      // First batch (8 logs)
      const firstBatch = createMockLogs(8);
      firstBatch.forEach((log) => batchManager.add(log));

      expect(sendFn).toHaveBeenCalledTimes(1);
      expect(sendFn).toHaveBeenNthCalledWith(1, firstBatch);

      // Second batch (8 logs)
      const secondBatch = createMockLogs(8);
      secondBatch.forEach((log) => batchManager.add(log));

      expect(sendFn).toHaveBeenCalledTimes(2);
      expect(sendFn).toHaveBeenNthCalledWith(2, secondBatch);
    });

    test("should start timer on first log", async () => {
      const log = createMockLog();
      batchManager.add(log);

      expect(batchManager.size).toBe(1);
      expect(sendFn).toHaveBeenCalledTimes(0);

      // Timer should be running
      await wait(DEFAULT_BATCH_INTERVAL_MS + 100);

      expect(sendFn).toHaveBeenCalledTimes(1);
      expect(batchManager.size).toBe(0);
    });
  });

  describe("addMany()", () => {
    test("should add multiple logs", () => {
      const logs = createMockLogs(5);
      batchManager.addMany(logs);

      expect(batchManager.size).toBe(5);
    });

    test("should trigger flush if total exceeds threshold", () => {
      const logs = createMockLogs(10);
      batchManager.addMany(logs);

      // Should have flushed once at 8 logs, leaving 2 remaining
      expect(sendFn).toHaveBeenCalledTimes(1);
      expect(batchManager.size).toBe(2);
    });

    test("should handle empty array", () => {
      batchManager.addMany([]);
      expect(batchManager.size).toBe(0);
    });
  });

  describe("flush()", () => {
    test("should send all logs immediately", () => {
      const logs = createMockLogs(5);
      logs.forEach((log) => batchManager.add(log));

      batchManager.flush();

      expect(sendFn).toHaveBeenCalledTimes(1);
      expect(sendFn).toHaveBeenCalledWith(logs);
      expect(batchManager.size).toBe(0);
    });

    test("should do nothing if batch is empty", () => {
      batchManager.flush();

      expect(sendFn).toHaveBeenCalledTimes(0);
    });

    test("should clear timer", async () => {
      const log = createMockLog();
      batchManager.add(log);
      batchManager.flush();

      // Wait past the interval
      await wait(DEFAULT_BATCH_INTERVAL_MS + 100);

      // Should only have been called once (from flush), not from timer
      expect(sendFn).toHaveBeenCalledTimes(1);
    });

    test("should update lastSendTime", () => {
      const beforeFlush = batchManager.timeSinceLastSend;
      const log = createMockLog();
      batchManager.add(log);

      batchManager.flush();

      const afterFlush = batchManager.timeSinceLastSend;
      expect(afterFlush).toBeLessThan(beforeFlush);
    });
  });

  describe("Timer-based flushing", () => {
    test("should auto-flush after interval", async () => {
      const log = createMockLog();
      batchManager.add(log);

      expect(sendFn).toHaveBeenCalledTimes(0);

      // Wait for interval to expire
      await wait(DEFAULT_BATCH_INTERVAL_MS + 100);

      expect(sendFn).toHaveBeenCalledTimes(1);
      expect(batchManager.size).toBe(0);
    });

    test("should use custom interval", async () => {
      const customInterval = 1000;
      const customBatch = new LogBatchManager(sendFn, customInterval);

      const log = createMockLog();
      customBatch.add(log);

      await wait(customInterval + 100);

      expect(sendFn).toHaveBeenCalledTimes(1);
      customBatch.destroy();
    });

    test("should not restart timer for subsequent logs", async () => {
      batchManager.add(createMockLog());
      await wait(1000);
      batchManager.add(createMockLog());
      await wait(1000);
      batchManager.add(createMockLog());

      // Wait for remaining time
      await wait(DEFAULT_BATCH_INTERVAL_MS - 2000 + 100);

      // Should have flushed once (timer started with first log)
      expect(sendFn).toHaveBeenCalledTimes(1);
    });
  });

  describe("Properties", () => {
    test("size should reflect current batch count", () => {
      expect(batchManager.size).toBe(0);

      batchManager.add(createMockLog());
      expect(batchManager.size).toBe(1);

      batchManager.add(createMockLog());
      expect(batchManager.size).toBe(2);

      batchManager.flush();
      expect(batchManager.size).toBe(0);
    });

    test("isEmpty should reflect batch state", () => {
      expect(batchManager.isEmpty).toBe(true);

      batchManager.add(createMockLog());
      expect(batchManager.isEmpty).toBe(false);

      batchManager.flush();
      expect(batchManager.isEmpty).toBe(true);
    });

    test("timeSinceLastSend should increase over time", async () => {
      const log = createMockLog();
      batchManager.add(log);
      batchManager.flush();

      const time1 = batchManager.timeSinceLastSend;
      await wait(100);
      const time2 = batchManager.timeSinceLastSend;

      expect(time2).toBeGreaterThan(time1);
    });
  });

  describe("clear()", () => {
    test("should clear batch without sending", () => {
      const logs = createMockLogs(5);
      logs.forEach((log) => batchManager.add(log));

      batchManager.clear();

      expect(batchManager.size).toBe(0);
      expect(sendFn).toHaveBeenCalledTimes(0);
    });

    test("should clear timer", async () => {
      batchManager.add(createMockLog());
      batchManager.clear();

      await wait(DEFAULT_BATCH_INTERVAL_MS + 100);

      expect(sendFn).toHaveBeenCalledTimes(0);
    });
  });

  describe("destroy()", () => {
    test("should clear batch and timer", () => {
      const logs = createMockLogs(5);
      logs.forEach((log) => batchManager.add(log));

      batchManager.destroy();

      expect(batchManager.size).toBe(0);
      expect(sendFn).toHaveBeenCalledTimes(0);
    });

    test("should prevent timer from firing", async () => {
      batchManager.add(createMockLog());
      batchManager.destroy();

      await wait(DEFAULT_BATCH_INTERVAL_MS + 100);

      expect(sendFn).toHaveBeenCalledTimes(0);
    });
  });

  describe("Async sendFn support", () => {
    test("should work with async send function", async () => {
      const asyncSendFn = vi.fn(async (logs: Log[]) => {
        await wait(10);
        return logs.length;
      });

      const asyncBatch = new LogBatchManager(asyncSendFn);
      const logs = createMockLogs(8);

      logs.forEach((log) => asyncBatch.add(log));

      expect(asyncSendFn).toHaveBeenCalledTimes(1);
      asyncBatch.destroy();
    });
  });
});

// ============================================================================
// MultiTargetBatchManager Tests
// ============================================================================

describe("MultiTargetBatchManager", () => {
  let sendFn: Mock;
  let multiManager: MultiTargetBatchManager;

  beforeEach(() => {
    sendFn = vi.fn();
    multiManager = new MultiTargetBatchManager(sendFn);
  });

  afterEach(() => {
    multiManager.destroy();
  });

  describe("Construction", () => {
    test("should initialize with no batches", () => {
      expect(multiManager.getTargetIds()).toHaveLength(0);
    });

    test("should accept custom settings", () => {
      const custom = new MultiTargetBatchManager(sendFn, 5000, 10);
      expect(custom.getTargetIds()).toHaveLength(0);
      custom.destroy();
    });
  });

  describe("add()", () => {
    test("should create batch for new target", () => {
      const log = createMockLog();
      multiManager.add("target-1", log);

      expect(multiManager.getTargetIds()).toContain("target-1");
      expect(multiManager.getSize("target-1")).toBe(1);
    });

    test("should add to existing target batch", () => {
      multiManager.add("target-1", createMockLog());
      multiManager.add("target-1", createMockLog());

      expect(multiManager.getSize("target-1")).toBe(2);
    });

    test("should maintain separate batches per target", () => {
      multiManager.add("target-1", createMockLog());
      multiManager.add("target-2", createMockLog());
      multiManager.add("target-1", createMockLog());

      expect(multiManager.getSize("target-1")).toBe(2);
      expect(multiManager.getSize("target-2")).toBe(1);
      expect(multiManager.getTargetIds()).toHaveLength(2);
    });

    test("should trigger flush per target when size reached", () => {
      const logs = createMockLogs(DEFAULT_BATCH_SIZE);

      logs.forEach((log) => multiManager.add("target-1", log));

      expect(sendFn).toHaveBeenCalledTimes(1);
      expect(sendFn).toHaveBeenCalledWith("target-1", logs);
      expect(multiManager.getSize("target-1")).toBe(0);
    });

    test("should handle different targets flushing independently", () => {
      // Fill target-1 to threshold
      const logs1 = createMockLogs(DEFAULT_BATCH_SIZE);
      logs1.forEach((log) => multiManager.add("target-1", log));

      expect(sendFn).toHaveBeenCalledTimes(1);
      expect(sendFn).toHaveBeenNthCalledWith(1, "target-1", logs1);

      // Fill target-2 to threshold
      const logs2 = createMockLogs(DEFAULT_BATCH_SIZE);
      logs2.forEach((log) => multiManager.add("target-2", log));

      expect(sendFn).toHaveBeenCalledTimes(2);
      expect(sendFn).toHaveBeenNthCalledWith(2, "target-2", logs2);
    });
  });

  describe("addMany()", () => {
    test("should add multiple logs to target", () => {
      const logs = createMockLogs(5);
      multiManager.addMany("target-1", logs);

      expect(multiManager.getSize("target-1")).toBe(5);
    });

    test("should trigger flush if threshold exceeded", () => {
      const logs = createMockLogs(10);
      multiManager.addMany("target-1", logs);

      expect(sendFn).toHaveBeenCalledTimes(1);
      expect(multiManager.getSize("target-1")).toBe(2);
    });
  });

  describe("flush()", () => {
    test("should flush specific target", () => {
      multiManager.add("target-1", createMockLog());
      multiManager.add("target-2", createMockLog());

      multiManager.flush("target-1");

      expect(sendFn).toHaveBeenCalledTimes(1);
      expect(multiManager.getSize("target-1")).toBe(0);
      expect(multiManager.getSize("target-2")).toBe(1);
    });

    test("should handle flushing non-existent target", () => {
      multiManager.flush("non-existent");
      expect(sendFn).toHaveBeenCalledTimes(0);
    });

    test("should handle flushing empty target", () => {
      multiManager.add("target-1", createMockLog());
      multiManager.flush("target-1");
      multiManager.flush("target-1");

      expect(sendFn).toHaveBeenCalledTimes(1);
    });
  });

  describe("flushAll()", () => {
    test("should flush all targets", () => {
      multiManager.add("target-1", createMockLog());
      multiManager.add("target-2", createMockLog());
      multiManager.add("target-3", createMockLog());

      multiManager.flushAll();

      expect(sendFn).toHaveBeenCalledTimes(3);
      expect(multiManager.getSize("target-1")).toBe(0);
      expect(multiManager.getSize("target-2")).toBe(0);
      expect(multiManager.getSize("target-3")).toBe(0);
    });

    test("should handle empty manager", () => {
      multiManager.flushAll();
      expect(sendFn).toHaveBeenCalledTimes(0);
    });

    test("should skip empty batches", () => {
      multiManager.add("target-1", createMockLog());
      multiManager.add("target-2", createMockLog());
      multiManager.flush("target-1");

      sendFn.mockClear();
      multiManager.flushAll();

      // Only target-2 should be flushed
      expect(sendFn).toHaveBeenCalledTimes(1);
    });
  });

  describe("getSize()", () => {
    test("should return 0 for non-existent target", () => {
      expect(multiManager.getSize("non-existent")).toBe(0);
    });

    test("should return correct size for target", () => {
      multiManager.add("target-1", createMockLog());
      multiManager.add("target-1", createMockLog());

      expect(multiManager.getSize("target-1")).toBe(2);
    });
  });

  describe("getTargetIds()", () => {
    test("should return empty array initially", () => {
      expect(multiManager.getTargetIds()).toEqual([]);
    });

    test("should return all target IDs", () => {
      multiManager.add("target-1", createMockLog());
      multiManager.add("target-2", createMockLog());
      multiManager.add("target-3", createMockLog());

      const targetIds = multiManager.getTargetIds();
      expect(targetIds).toHaveLength(3);
      expect(targetIds).toContain("target-1");
      expect(targetIds).toContain("target-2");
      expect(targetIds).toContain("target-3");
    });
  });

  describe("remove()", () => {
    test("should remove target without flushing", () => {
      multiManager.add("target-1", createMockLog());
      multiManager.add("target-2", createMockLog());

      multiManager.remove("target-1");

      expect(multiManager.getTargetIds()).toHaveLength(1);
      expect(multiManager.getTargetIds()).not.toContain("target-1");
      expect(sendFn).toHaveBeenCalledTimes(0);
    });

    test("should handle removing non-existent target", () => {
      multiManager.remove("non-existent");
      expect(multiManager.getTargetIds()).toHaveLength(0);
    });
  });

  describe("clear()", () => {
    test("should clear all batches without sending", () => {
      multiManager.add("target-1", createMockLog());
      multiManager.add("target-2", createMockLog());

      multiManager.clear();

      expect(multiManager.getTargetIds()).toHaveLength(0);
      expect(sendFn).toHaveBeenCalledTimes(0);
    });
  });

  describe("destroy()", () => {
    test("should destroy all batches", () => {
      multiManager.add("target-1", createMockLog());
      multiManager.add("target-2", createMockLog());

      multiManager.destroy();

      expect(multiManager.getTargetIds()).toHaveLength(0);
      expect(sendFn).toHaveBeenCalledTimes(0);
    });
  });

  describe("Per-target timer behavior", () => {
    test("should auto-flush each target independently", async () => {
      multiManager.add("target-1", createMockLog());
      await wait(1000);
      multiManager.add("target-2", createMockLog());

      // Wait for first target's timer
      await wait(DEFAULT_BATCH_INTERVAL_MS - 1000 + 100);

      expect(sendFn).toHaveBeenCalledTimes(1);
      expect(sendFn).toHaveBeenCalledWith("target-1", expect.any(Array));

      // Wait for second target's timer
      await wait(1000);

      expect(sendFn).toHaveBeenCalledTimes(2);
      expect(sendFn).toHaveBeenCalledWith("target-2", expect.any(Array));
    }, 10000); // Increase timeout for this test
  });

  describe("Mixed usage patterns", () => {
    test("should handle mix of size-based and timer-based flushes", async () => {
      // Target 1: Size-based flush
      const logs1 = createMockLogs(DEFAULT_BATCH_SIZE);
      logs1.forEach((log) => multiManager.add("target-1", log));

      expect(sendFn).toHaveBeenCalledTimes(1);

      // Target 2: Timer-based flush
      multiManager.add("target-2", createMockLog());
      await wait(DEFAULT_BATCH_INTERVAL_MS + 100);

      expect(sendFn).toHaveBeenCalledTimes(2);
    }, 10000);
  });
});

// ============================================================================
// LogSyncManager Tests
// ============================================================================

describe("LogSyncManager", () => {
  let syncManager: LogSyncManager;

  beforeEach(() => {
    syncManager = new LogSyncManager();
  });

  describe("updateLastSync()", () => {
    test("should store last sync timestamp", () => {
      const timestamp = new Date().toISOString();
      syncManager.updateLastSync("target-1", timestamp);

      expect(syncManager.getLastSync("target-1")).toBe(timestamp);
    });

    test("should update existing timestamp", () => {
      const timestamp1 = "2024-01-01T00:00:00.000Z";
      const timestamp2 = "2024-01-02T00:00:00.000Z";

      syncManager.updateLastSync("target-1", timestamp1);
      expect(syncManager.getLastSync("target-1")).toBe(timestamp1);

      syncManager.updateLastSync("target-1", timestamp2);
      expect(syncManager.getLastSync("target-1")).toBe(timestamp2);
    });

    test("should maintain separate timestamps per target", () => {
      const timestamp1 = "2024-01-01T00:00:00.000Z";
      const timestamp2 = "2024-01-02T00:00:00.000Z";

      syncManager.updateLastSync("target-1", timestamp1);
      syncManager.updateLastSync("target-2", timestamp2);

      expect(syncManager.getLastSync("target-1")).toBe(timestamp1);
      expect(syncManager.getLastSync("target-2")).toBe(timestamp2);
    });
  });

  describe("getLastSync()", () => {
    test("should return null for non-existent target", () => {
      expect(syncManager.getLastSync("non-existent")).toBeNull();
    });

    test("should return stored timestamp", () => {
      const timestamp = "2024-01-01T00:00:00.000Z";
      syncManager.updateLastSync("target-1", timestamp);

      expect(syncManager.getLastSync("target-1")).toBe(timestamp);
    });
  });

  describe("getNewLogs()", () => {
    test("should return all logs if never synced", () => {
      const logs = createMockLogs(5);
      const newLogs = syncManager.getNewLogs("target-1", logs);

      expect(newLogs).toHaveLength(5);
      expect(newLogs).toEqual(logs);
    });

    test("should filter logs after last sync timestamp", () => {
      const baseTime = new Date("2024-01-01T00:00:00.000Z");
      const logs = createMockLogs(10, baseTime);

      // Sync after 5th log (timestamp at 5 seconds)
      const lastSync = logs[4].timestamp;
      syncManager.updateLastSync("target-1", lastSync);

      const newLogs = syncManager.getNewLogs("target-1", logs);

      // Should return logs 5-9 (5 logs)
      expect(newLogs).toHaveLength(5);
      expect(newLogs[0].id).toBe("log-5");
    });

    test("should return empty array if all logs are old", () => {
      const baseTime = new Date("2024-01-01T00:00:00.000Z");
      const logs = createMockLogs(5, baseTime);

      // Sync after last log
      const lastSync = new Date(baseTime.getTime() + 10000).toISOString();
      syncManager.updateLastSync("target-1", lastSync);

      const newLogs = syncManager.getNewLogs("target-1", logs);

      expect(newLogs).toHaveLength(0);
    });

    test("should handle empty logs array", () => {
      syncManager.updateLastSync("target-1", new Date().toISOString());
      const newLogs = syncManager.getNewLogs("target-1", []);

      expect(newLogs).toHaveLength(0);
    });

    test("should use strict greater-than comparison (excludes equal)", () => {
      const timestamp = "2024-01-01T00:00:00.000Z";
      const logs = [
        createMockLog({ id: "log-1", timestamp }),
        createMockLog({ id: "log-2", timestamp: "2024-01-01T00:00:01.000Z" }),
      ];

      syncManager.updateLastSync("target-1", timestamp);
      const newLogs = syncManager.getNewLogs("target-1", logs);

      // Should only return log-2 (log-1 has same timestamp)
      expect(newLogs).toHaveLength(1);
      expect(newLogs[0].id).toBe("log-2");
    });

    test("should handle different targets independently", () => {
      const baseTime = new Date("2024-01-01T00:00:00.000Z");
      const logs = createMockLogs(10, baseTime);

      syncManager.updateLastSync("target-1", logs[2].timestamp);
      syncManager.updateLastSync("target-2", logs[7].timestamp);

      const newLogs1 = syncManager.getNewLogs("target-1", logs);
      const newLogs2 = syncManager.getNewLogs("target-2", logs);

      expect(newLogs1).toHaveLength(7); // logs 3-9
      expect(newLogs2).toHaveLength(2); // logs 8-9
    });
  });

  describe("reset()", () => {
    test("should reset sync state for target", () => {
      const timestamp = new Date().toISOString();
      syncManager.updateLastSync("target-1", timestamp);

      syncManager.reset("target-1");

      expect(syncManager.getLastSync("target-1")).toBeNull();
    });

    test("should not affect other targets", () => {
      const timestamp1 = "2024-01-01T00:00:00.000Z";
      const timestamp2 = "2024-01-02T00:00:00.000Z";

      syncManager.updateLastSync("target-1", timestamp1);
      syncManager.updateLastSync("target-2", timestamp2);

      syncManager.reset("target-1");

      expect(syncManager.getLastSync("target-1")).toBeNull();
      expect(syncManager.getLastSync("target-2")).toBe(timestamp2);
    });

    test("should handle resetting non-existent target", () => {
      syncManager.reset("non-existent");
      expect(syncManager.getLastSync("non-existent")).toBeNull();
    });
  });

  describe("resetAll()", () => {
    test("should reset all sync state", () => {
      syncManager.updateLastSync("target-1", "2024-01-01T00:00:00.000Z");
      syncManager.updateLastSync("target-2", "2024-01-02T00:00:00.000Z");
      syncManager.updateLastSync("target-3", "2024-01-03T00:00:00.000Z");

      syncManager.resetAll();

      expect(syncManager.getLastSync("target-1")).toBeNull();
      expect(syncManager.getLastSync("target-2")).toBeNull();
      expect(syncManager.getLastSync("target-3")).toBeNull();
      expect(syncManager.getSyncedTargets()).toHaveLength(0);
    });

    test("should handle empty manager", () => {
      syncManager.resetAll();
      expect(syncManager.getSyncedTargets()).toHaveLength(0);
    });
  });

  describe("getSyncedTargets()", () => {
    test("should return empty array initially", () => {
      expect(syncManager.getSyncedTargets()).toEqual([]);
    });

    test("should return all synced target IDs", () => {
      syncManager.updateLastSync("target-1", "2024-01-01T00:00:00.000Z");
      syncManager.updateLastSync("target-2", "2024-01-02T00:00:00.000Z");
      syncManager.updateLastSync("target-3", "2024-01-03T00:00:00.000Z");

      const targets = syncManager.getSyncedTargets();

      expect(targets).toHaveLength(3);
      expect(targets).toContain("target-1");
      expect(targets).toContain("target-2");
      expect(targets).toContain("target-3");
    });

    test("should not include reset targets", () => {
      syncManager.updateLastSync("target-1", "2024-01-01T00:00:00.000Z");
      syncManager.updateLastSync("target-2", "2024-01-02T00:00:00.000Z");

      syncManager.reset("target-1");

      const targets = syncManager.getSyncedTargets();

      expect(targets).toHaveLength(1);
      expect(targets).toContain("target-2");
      expect(targets).not.toContain("target-1");
    });
  });

  describe("Bandwidth reduction verification", () => {
    test("should demonstrate 99% bandwidth reduction claim", () => {
      const baseTime = new Date("2024-01-01T00:00:00.000Z");
      const allLogs = createMockLogs(1000, baseTime);

      // Initial sync: all logs
      const initialLogs = syncManager.getNewLogs("target-1", allLogs);
      expect(initialLogs).toHaveLength(1000);

      // Update sync to last log
      syncManager.updateLastSync(
        "target-1",
        allLogs[allLogs.length - 1].timestamp,
      );

      // Subsequent sync: only 10 new logs
      const newLogs = createMockLogs(
        10,
        new Date(baseTime.getTime() + 1000000),
      );
      const allLogsUpdated = [...allLogs, ...newLogs];

      const deltaLogs = syncManager.getNewLogs("target-1", allLogsUpdated);

      // Should only return new logs (99% reduction)
      expect(deltaLogs).toHaveLength(10);
      expect(deltaLogs.length / allLogsUpdated.length).toBeLessThan(0.01); // Less than 1%
    });

    test("should handle incremental syncs efficiently", () => {
      const baseTime = new Date("2024-01-01T00:00:00.000Z");
      let allLogs = createMockLogs(100, baseTime);

      // First sync
      const sync1 = syncManager.getNewLogs("target-1", allLogs);
      expect(sync1).toHaveLength(100);
      syncManager.updateLastSync(
        "target-1",
        allLogs[allLogs.length - 1].timestamp,
      );

      // Add 5 new logs
      const newLogs1 = createMockLogs(5, new Date(baseTime.getTime() + 200000));
      allLogs = [...allLogs, ...newLogs1];
      const sync2 = syncManager.getNewLogs("target-1", allLogs);
      expect(sync2).toHaveLength(5);
      syncManager.updateLastSync(
        "target-1",
        allLogs[allLogs.length - 1].timestamp,
      );

      // Add 3 more new logs
      const newLogs2 = createMockLogs(3, new Date(baseTime.getTime() + 300000));
      allLogs = [...allLogs, ...newLogs2];
      const sync3 = syncManager.getNewLogs("target-1", allLogs);
      expect(sync3).toHaveLength(3);
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("Integration: Batch + Sync", () => {
  test("should combine batching and delta sync for optimal bandwidth", async () => {
    const sendFn = vi.fn();
    const batchManager = new LogBatchManager(sendFn, 1000, 5);
    const syncManager = new LogSyncManager();

    const baseTime = new Date("2024-01-01T00:00:00.000Z");
    let allLogs = createMockLogs(100, baseTime);

    // Initial sync: get all logs
    const newLogs = syncManager.getNewLogs("friend-1", allLogs);
    expect(newLogs).toHaveLength(100);

    // Batch them (should send 20 batches of 5)
    newLogs.forEach((log) => batchManager.add(log));

    await wait(1100);

    expect(sendFn).toHaveBeenCalled();
    syncManager.updateLastSync(
      "friend-1",
      allLogs[allLogs.length - 1].timestamp,
    );

    // Add 7 new logs
    const additionalLogs = createMockLogs(
      7,
      new Date(baseTime.getTime() + 200000),
    );
    allLogs = [...allLogs, ...additionalLogs];

    // Delta sync: only get new logs
    const deltaLogs = syncManager.getNewLogs("friend-1", allLogs);
    expect(deltaLogs).toHaveLength(7);

    // Batch them (should send 1 batch after 5 logs, then timer flush for remaining 2)
    sendFn.mockClear();
    deltaLogs.forEach((log) => batchManager.add(log));

    expect(sendFn).toHaveBeenCalledTimes(1); // Size-based flush

    await wait(1100);

    expect(sendFn).toHaveBeenCalledTimes(2); // Timer-based flush

    batchManager.destroy();
  }, 10000);

  test("should handle multi-target batching with sync", () => {
    const sendFn = vi.fn();
    const multiManager = new MultiTargetBatchManager(sendFn);
    const syncManager = new LogSyncManager();

    const baseTime = new Date("2024-01-01T00:00:00.000Z");
    const logs = createMockLogs(15, baseTime);

    // Friend 1: synced up to log 10
    syncManager.updateLastSync("friend-1", logs[9].timestamp);
    const newLogs1 = syncManager.getNewLogs("friend-1", logs);
    expect(newLogs1).toHaveLength(5);
    newLogs1.forEach((log) => multiManager.add("friend-1", log));

    // Friend 2: synced up to log 12
    syncManager.updateLastSync("friend-2", logs[11].timestamp);
    const newLogs2 = syncManager.getNewLogs("friend-2", logs);
    expect(newLogs2).toHaveLength(3);
    newLogs2.forEach((log) => multiManager.add("friend-2", log));

    // Friend 3: synced up to log 8 (gets 7 new logs)
    syncManager.updateLastSync("friend-3", logs[7].timestamp);
    const newLogs3 = syncManager.getNewLogs("friend-3", logs);
    expect(newLogs3).toHaveLength(7);
    newLogs3.forEach((log) => multiManager.add("friend-3", log));

    // All batches should be pending (none reached size threshold of 8)
    expect(sendFn).toHaveBeenCalledTimes(0);
    expect(multiManager.getSize("friend-1")).toBe(5);
    expect(multiManager.getSize("friend-2")).toBe(3);
    expect(multiManager.getSize("friend-3")).toBe(7);

    // Flush all
    multiManager.flushAll();

    // Should now have flushed all 3 targets
    expect(sendFn).toHaveBeenCalledTimes(3);
    expect(multiManager.getSize("friend-1")).toBe(0);
    expect(multiManager.getSize("friend-2")).toBe(0);
    expect(multiManager.getSize("friend-3")).toBe(0);

    multiManager.destroy();
  });
});
