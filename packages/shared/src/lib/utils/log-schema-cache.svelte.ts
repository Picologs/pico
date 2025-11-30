/**
 * Log Schema Cache
 *
 * Svelte 5 reactive cache for log pattern discovery.
 * Batches patterns before sending to the server via WebSocket.
 *
 * Uses $state runes for reactive state management.
 *
 * @module shared/utils/log-schema-cache
 */

import type { RawLogPattern } from "@pico/types";

// Batch configuration
const BATCH_INTERVAL_MS = 60_000; // 60 seconds
const MAX_BATCH_SIZE = 100;

/** Whether beta features are enabled for this user */
let betaTesterEnabled = false;

/**
 * Set whether beta tester features are enabled
 *
 * Call this when user profile is loaded to enable/disable pattern collection.
 * When disabled, addPattern() and flushPatterns() will silently skip processing.
 *
 * @param enabled - Whether the user is a beta tester
 */
export function setBetaTesterEnabled(enabled: boolean): void {
  betaTesterEnabled = enabled;
}

/**
 * Pattern cache state
 *
 * Uses Svelte 5 $state runes for reactivity.
 * Exported as an object to allow mutation while maintaining reactivity.
 */
class PatternCacheState {
  /** Patterns waiting to be sent to server */
  pending = $state<RawLogPattern[]>([]);

  /** Timestamp of last report to server */
  lastReportTime = $state(0);

  /** Local occurrence counts by signature (for deduplication) */
  localCounts = $state(new Map<string, number>());

  /** Whether the cache has been initialized */
  initialized = $state(false);

  /** Number of patterns reported in current session */
  sessionReportCount = $state(0);

  /** Number of patterns deduplicated in current session */
  sessionDedupeCount = $state(0);
}

/** Singleton instance */
let instance: PatternCacheState | null = null;

/**
 * Get the pattern cache instance
 *
 * Creates the singleton on first call, returns existing instance thereafter.
 */
export function getPatternCache(): PatternCacheState {
  if (!instance) {
    instance = new PatternCacheState();
  }
  return instance;
}

/**
 * Callback type for sending patterns to server
 */
export type PatternReportCallback = (
  patterns: RawLogPattern[],
) => void | Promise<void>;

/** Callback for reporting patterns */
let reportCallback: PatternReportCallback | null = null;

/** Timer for batch flushing */
let batchTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Initialize the pattern cache with a report callback
 *
 * @param callback - Function to call when patterns should be reported
 */
export function initPatternCache(callback: PatternReportCallback): void {
  const cache = getPatternCache();
  reportCallback = callback;
  cache.initialized = true;

  // Start the batch timer
  startBatchTimer();
}

/**
 * Clean up the pattern cache
 *
 * Flushes any pending patterns and stops the timer.
 */
export function destroyPatternCache(): void {
  const cache = getPatternCache();

  // Flush any pending patterns
  if (cache.pending.length > 0) {
    flushPatterns();
  }

  // Stop the timer
  if (batchTimer) {
    clearTimeout(batchTimer);
    batchTimer = null;
  }

  reportCallback = null;
  cache.initialized = false;
}

/**
 * Start the batch flush timer
 */
function startBatchTimer(): void {
  if (batchTimer) {
    clearTimeout(batchTimer);
  }

  batchTimer = setTimeout(() => {
    flushPatterns();
    startBatchTimer(); // Restart timer
  }, BATCH_INTERVAL_MS);
}

/**
 * Add a pattern to the cache
 *
 * Increments local counts and adds to pending queue.
 * Triggers flush if batch size threshold is reached.
 *
 * @param pattern - The pattern to add
 * @returns true if pattern was added, false if deduplicated
 */
export function addPattern(pattern: RawLogPattern): boolean {
  // Skip if not a beta tester
  if (!betaTesterEnabled) {
    return false;
  }

  const cache = getPatternCache();

  // Get current count for this signature
  const existing = cache.localCounts.get(pattern.signature) ?? 0;

  // Update local count
  cache.localCounts.set(pattern.signature, existing + 1);

  // Only add to pending if this is the first occurrence (others are deduped)
  if (existing === 0) {
    cache.pending.push(pattern);
  } else {
    cache.sessionDedupeCount++;
  }

  // Check if we should flush
  if (cache.pending.length >= MAX_BATCH_SIZE) {
    flushPatterns();
  }

  return existing === 0;
}

/**
 * Add multiple patterns to the cache
 *
 * @param patterns - Array of patterns to add
 * @returns Number of unique patterns added
 */
export function addPatterns(patterns: RawLogPattern[]): number {
  let addedCount = 0;

  for (const pattern of patterns) {
    if (addPattern(pattern)) {
      addedCount++;
    }
  }

  return addedCount;
}

/**
 * Flush pending patterns to the server
 *
 * Sends all pending patterns via the report callback.
 */
export function flushPatterns(): void {
  // Skip if not a beta tester
  if (!betaTesterEnabled) {
    return;
  }

  const cache = getPatternCache();

  if (cache.pending.length === 0) {
    return;
  }

  if (!reportCallback) {
    console.warn(
      "[PatternCache] No report callback configured, patterns not sent",
    );
    return;
  }

  // Get patterns to send
  const patternsToSend = [...cache.pending];

  // Clear pending queue
  cache.pending = [];
  cache.lastReportTime = Date.now();
  cache.sessionReportCount += patternsToSend.length;

  // Send via callback (fire and forget, errors handled by callback)
  try {
    reportCallback(patternsToSend);
  } catch (error) {
    console.error("[PatternCache] Error reporting patterns:", error);
  }
}

/**
 * Get cache statistics
 *
 * @returns Object with cache stats
 */
export function getPatternCacheStats(): {
  pendingCount: number;
  uniqueSignatures: number;
  lastReportTime: number;
  sessionReportCount: number;
  sessionDedupeCount: number;
} {
  const cache = getPatternCache();

  return {
    pendingCount: cache.pending.length,
    uniqueSignatures: cache.localCounts.size,
    lastReportTime: cache.lastReportTime,
    sessionReportCount: cache.sessionReportCount,
    sessionDedupeCount: cache.sessionDedupeCount,
  };
}

/**
 * Check if a signature has been seen locally
 *
 * @param signature - The pattern signature to check
 * @returns true if pattern has been seen
 */
export function hasSeenPattern(signature: string): boolean {
  const cache = getPatternCache();
  return cache.localCounts.has(signature);
}

/**
 * Get local occurrence count for a signature
 *
 * @param signature - The pattern signature
 * @returns Number of times pattern has been seen locally
 */
export function getLocalCount(signature: string): number {
  const cache = getPatternCache();
  return cache.localCounts.get(signature) ?? 0;
}

/**
 * Reset the cache (for testing or session reset)
 */
export function resetPatternCache(): void {
  const cache = getPatternCache();
  cache.pending = [];
  cache.localCounts = new Map();
  cache.lastReportTime = 0;
  cache.sessionReportCount = 0;
  cache.sessionDedupeCount = 0;
}
