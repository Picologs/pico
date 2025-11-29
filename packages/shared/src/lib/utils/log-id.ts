/**
 * Log ID Generation
 *
 * Generates deterministic IDs for log entries based on timestamp and content.
 * This ensures the same log line always gets the same ID for deduplication.
 *
 * @module utils/log-id
 */

/**
 * Simple hash function for generating deterministic IDs
 *
 * @param input - String to hash
 * @returns Numeric hash value
 */
function simpleHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Generate a deterministic ID for a log entry
 *
 * Uses timestamp + line content to create a unique, reproducible ID.
 * The same log line will always generate the same ID for deduplication.
 *
 * @param timestamp - Log timestamp
 * @param line - Raw log line content
 * @returns Unique log ID
 */
export function generateId(timestamp: Date, line: string): string {
  const timeStr = timestamp.toISOString();
  const combined = `${timeStr}-${line}`;
  const hash = simpleHash(combined);
  return `log-${timestamp.getTime()}-${hash.toString(36)}`;
}
