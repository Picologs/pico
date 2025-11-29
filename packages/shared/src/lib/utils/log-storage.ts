import type { Log } from "@pico/types";

/**
 * Storage format for log cache
 */
interface LogCache {
  version: 1;
  lastUpdated: number;
  logs: Log[];
}

const STORAGE_VERSION = 1;
const STORAGE_KEY_PREFIX = "picologs_logs_";
const FRIEND_LOGS_PREFIX = "picologs_friend_logs_";
const GROUP_LOGS_PREFIX = "picologs_group_logs_";
const EXPIRY_DAYS = 7;
const MAX_LOGS_PER_SOURCE = 1000;

/**
 * Storage adapter interface for platform-agnostic storage
 */
interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  isAvailable(): Promise<boolean>;
}

/**
 * SessionStorage adapter for web (ephemeral, cleared on tab close)
 */
class SessionStorageAdapter implements StorageAdapter {
  async isAvailable(): Promise<boolean> {
    try {
      const test = "__session_storage_test__";
      sessionStorage.setItem(test, test);
      sessionStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    sessionStorage.setItem(key, value);
  }

  async remove(key: string): Promise<void> {
    sessionStorage.removeItem(key);
  }
}

/**
 * LocalStorage adapter for web (persistent, survives tab close)
 */
class LocalStorageAdapter implements StorageAdapter {
  async isAvailable(): Promise<boolean> {
    try {
      const test = "__local_storage_test__";
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    localStorage.setItem(key, value);
  }

  async remove(key: string): Promise<void> {
    localStorage.removeItem(key);
  }
}

/**
 * Tauri Store adapter for desktop (persistent, unlimited disk space)
 */
class TauriStoreAdapter implements StorageAdapter {
  private store: any = null;

  async isAvailable(): Promise<boolean> {
    return typeof window !== "undefined" && "__TAURI__" in window;
  }

  private async getStore() {
    if (!this.store) {
      const { Store } = await import("@tauri-apps/plugin-store");
      this.store = await Store.load("logs.json");
    }
    return this.store;
  }

  async get(key: string): Promise<string | null> {
    try {
      const store = await this.getStore();
      const value = await store.get(key);
      return value ? JSON.stringify(value) : null;
    } catch (error) {
      console.error("Failed to get from Tauri Store:", error);
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    const store = await this.getStore();
    await store.set(key, JSON.parse(value));
    await store.save();
  }

  async remove(key: string): Promise<void> {
    const store = await this.getStore();
    await store.delete(key);
    await store.save();
  }
}

/**
 * Get the appropriate storage adapter based on platform
 */
function getStorageAdapter(): StorageAdapter {
  // Detect Tauri environment
  if (typeof window !== "undefined" && "__TAURI__" in window) {
    return new TauriStoreAdapter();
  }
  // Default to localStorage for web (persistent)
  return new LocalStorageAdapter();
}

// Singleton instance
let storageAdapter: StorageAdapter | null = null;

/**
 * Get or create storage adapter instance
 */
function getAdapter(): StorageAdapter {
  if (!storageAdapter) {
    storageAdapter = getStorageAdapter();
  }
  return storageAdapter;
}

/**
 * Get the storage key for a specific user
 */
function getStorageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}${userId}`;
}

/**
 * Check if a log is expired (older than EXPIRY_DAYS)
 */
function isExpired(log: Log): boolean {
  const now = Date.now();
  const logTime = new Date(log.timestamp).getTime();
  const expiryMs = EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  return now - logTime > expiryMs;
}

/**
 * Load logs from storage for a specific user
 * Automatically prunes expired logs (older than 7 days)
 */
export async function loadLogs(userId: string): Promise<Log[]> {
  const adapter = getAdapter();

  if (!(await adapter.isAvailable())) {
    return [];
  }

  try {
    const key = getStorageKey(userId);
    const stored = await adapter.get(key);

    if (!stored) {
      return [];
    }

    const cache: LogCache = JSON.parse(stored);

    // Version check
    if (cache.version !== STORAGE_VERSION) {
      console.warn("Log cache version mismatch, clearing cache");
      await clearLogs(userId);
      return [];
    }

    // Filter out expired logs
    const validLogs = cache.logs.filter((log) => !isExpired(log));

    // If we pruned any logs, save the updated cache
    if (validLogs.length !== cache.logs.length) {
      await saveLogs(userId, validLogs);
    }

    return validLogs;
  } catch (error) {
    console.error("Failed to load logs from storage:", error);
    return [];
  }
}

/**
 * Save logs to storage for a specific user
 */
export async function saveLogs(userId: string, logs: Log[]): Promise<void> {
  const adapter = getAdapter();

  if (!(await adapter.isAvailable())) {
    return;
  }

  const key = getStorageKey(userId);

  try {
    const cache: LogCache = {
      version: STORAGE_VERSION,
      lastUpdated: Date.now(),
      logs,
    };

    await adapter.set(key, JSON.stringify(cache));
  } catch (error) {
    // Handle quota exceeded or other errors
    console.error("Failed to save logs to storage:", error);

    // If quota exceeded (sessionStorage), try clearing old logs and retry
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      console.warn("Storage quota exceeded, clearing old logs");
      try {
        // Keep only recent logs (last 24 hours)
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        const recentLogs = logs.filter(
          (log) => new Date(log.timestamp).getTime() > oneDayAgo,
        );
        const cache: LogCache = {
          version: STORAGE_VERSION,
          lastUpdated: Date.now(),
          logs: recentLogs,
        };
        await adapter.set(key, JSON.stringify(cache));
      } catch (retryError) {
        console.error("Failed to save logs even after pruning:", retryError);
      }
    }
  }
}

/**
 * Clear logs from storage for a specific user
 */
export async function clearLogs(userId: string): Promise<void> {
  const adapter = getAdapter();

  if (!(await adapter.isAvailable())) {
    return;
  }

  try {
    const key = getStorageKey(userId);
    await adapter.remove(key);
  } catch (error) {
    console.error("Failed to clear logs from storage:", error);
  }
}

/**
 * Get a Set of all log IDs currently in storage for a specific user
 * Used for efficient deduplication checks
 */
export async function getLogIds(userId: string): Promise<Set<string>> {
  const logs = await loadLogs(userId);
  return new Set(logs.map((log) => log.id));
}

/**
 * Get the count of logs in storage for a specific user
 */
export async function getLogCount(userId: string): Promise<number> {
  const logs = await loadLogs(userId);
  return logs.length;
}

/**
 * Get the approximate size of the log cache in bytes
 */
export async function getCacheSize(userId: string): Promise<number> {
  const adapter = getAdapter();

  if (!(await adapter.isAvailable())) {
    return 0;
  }

  try {
    const key = getStorageKey(userId);
    const stored = await adapter.get(key);
    return stored ? new Blob([stored]).size : 0;
  } catch {
    return 0;
  }
}

// ============================================================================
// Friend/Group Log Storage
// ============================================================================

/**
 * Storage format for friend/group log cache
 */
interface RemoteLogCache {
  version: 1;
  lastUpdated: number;
  logs: Log[];
  sourceType: "friend" | "group";
  sourceId: string;
}

/**
 * Get the storage key for a specific friend's logs
 */
function getFriendStorageKey(friendDiscordId: string): string {
  return `${FRIEND_LOGS_PREFIX}${friendDiscordId}`;
}

/**
 * Get the storage key for a specific group's logs
 */
function getGroupStorageKey(groupId: string): string {
  return `${GROUP_LOGS_PREFIX}${groupId}`;
}

/**
 * Deduplicate and sort logs by timestamp (newest first for storage)
 */
function dedupeAndSortForStorage(logs: Log[]): Log[] {
  const seen = new Set<string>();
  const unique: Log[] = [];

  for (const log of logs) {
    if (!seen.has(log.id)) {
      seen.add(log.id);
      unique.push(log);
    }
  }

  // Sort by timestamp descending (newest first) for consistent storage
  return unique.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

/**
 * Load logs from storage for a specific friend
 * Automatically prunes expired logs (older than 7 days)
 */
export async function loadFriendLogs(friendDiscordId: string): Promise<Log[]> {
  const adapter = getAdapter();

  if (!(await adapter.isAvailable())) {
    return [];
  }

  try {
    const key = getFriendStorageKey(friendDiscordId);
    const stored = await adapter.get(key);

    if (!stored) {
      return [];
    }

    const cache: RemoteLogCache = JSON.parse(stored);

    // Version check
    if (cache.version !== STORAGE_VERSION) {
      console.warn("Friend log cache version mismatch, clearing cache");
      await clearFriendLogs(friendDiscordId);
      return [];
    }

    // Filter out expired logs
    const validLogs = cache.logs.filter((log) => !isExpired(log));

    // If we pruned any logs, save the updated cache
    if (validLogs.length !== cache.logs.length) {
      await saveFriendLogs(friendDiscordId, validLogs);
    }

    return validLogs;
  } catch (error) {
    console.error("Failed to load friend logs from storage:", error);
    return [];
  }
}

/**
 * Save logs to storage for a specific friend
 * Applies memory limit and deduplication
 */
export async function saveFriendLogs(
  friendDiscordId: string,
  logs: Log[],
): Promise<void> {
  const adapter = getAdapter();

  if (!(await adapter.isAvailable())) {
    return;
  }

  const key = getFriendStorageKey(friendDiscordId);

  try {
    // Dedupe, sort, and apply limit
    const processedLogs = dedupeAndSortForStorage(logs).slice(
      0,
      MAX_LOGS_PER_SOURCE,
    );

    const cache: RemoteLogCache = {
      version: STORAGE_VERSION,
      lastUpdated: Date.now(),
      logs: processedLogs,
      sourceType: "friend",
      sourceId: friendDiscordId,
    };

    await adapter.set(key, JSON.stringify(cache));
  } catch (error) {
    console.error("Failed to save friend logs to storage:", error);

    // Handle quota exceeded
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      console.warn(
        "Storage quota exceeded for friend logs, keeping recent only",
      );
      try {
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        const recentLogs = logs.filter(
          (log) => new Date(log.timestamp).getTime() > oneDayAgo,
        );
        const cache: RemoteLogCache = {
          version: STORAGE_VERSION,
          lastUpdated: Date.now(),
          logs: dedupeAndSortForStorage(recentLogs).slice(
            0,
            MAX_LOGS_PER_SOURCE,
          ),
          sourceType: "friend",
          sourceId: friendDiscordId,
        };
        await adapter.set(key, JSON.stringify(cache));
      } catch (retryError) {
        console.error(
          "Failed to save friend logs even after pruning:",
          retryError,
        );
      }
    }
  }
}

/**
 * Clear logs from storage for a specific friend
 */
export async function clearFriendLogs(friendDiscordId: string): Promise<void> {
  const adapter = getAdapter();

  if (!(await adapter.isAvailable())) {
    return;
  }

  try {
    const key = getFriendStorageKey(friendDiscordId);
    await adapter.remove(key);
  } catch (error) {
    console.error("Failed to clear friend logs from storage:", error);
  }
}

/**
 * Load logs from storage for a specific group
 * Automatically prunes expired logs (older than 7 days)
 */
export async function loadGroupLogs(groupId: string): Promise<Log[]> {
  const adapter = getAdapter();

  if (!(await adapter.isAvailable())) {
    return [];
  }

  try {
    const key = getGroupStorageKey(groupId);
    const stored = await adapter.get(key);

    if (!stored) {
      return [];
    }

    const cache: RemoteLogCache = JSON.parse(stored);

    // Version check
    if (cache.version !== STORAGE_VERSION) {
      console.warn("Group log cache version mismatch, clearing cache");
      await clearGroupLogs(groupId);
      return [];
    }

    // Filter out expired logs
    const validLogs = cache.logs.filter((log) => !isExpired(log));

    // If we pruned any logs, save the updated cache
    if (validLogs.length !== cache.logs.length) {
      await saveGroupLogs(groupId, validLogs);
    }

    return validLogs;
  } catch (error) {
    console.error("Failed to load group logs from storage:", error);
    return [];
  }
}

/**
 * Save logs to storage for a specific group
 * Applies memory limit and deduplication
 */
export async function saveGroupLogs(
  groupId: string,
  logs: Log[],
): Promise<void> {
  const adapter = getAdapter();

  if (!(await adapter.isAvailable())) {
    return;
  }

  const key = getGroupStorageKey(groupId);

  try {
    // Dedupe, sort, and apply limit
    const processedLogs = dedupeAndSortForStorage(logs).slice(
      0,
      MAX_LOGS_PER_SOURCE,
    );

    const cache: RemoteLogCache = {
      version: STORAGE_VERSION,
      lastUpdated: Date.now(),
      logs: processedLogs,
      sourceType: "group",
      sourceId: groupId,
    };

    await adapter.set(key, JSON.stringify(cache));
  } catch (error) {
    console.error("Failed to save group logs to storage:", error);

    // Handle quota exceeded
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      console.warn(
        "Storage quota exceeded for group logs, keeping recent only",
      );
      try {
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        const recentLogs = logs.filter(
          (log) => new Date(log.timestamp).getTime() > oneDayAgo,
        );
        const cache: RemoteLogCache = {
          version: STORAGE_VERSION,
          lastUpdated: Date.now(),
          logs: dedupeAndSortForStorage(recentLogs).slice(
            0,
            MAX_LOGS_PER_SOURCE,
          ),
          sourceType: "group",
          sourceId: groupId,
        };
        await adapter.set(key, JSON.stringify(cache));
      } catch (retryError) {
        console.error(
          "Failed to save group logs even after pruning:",
          retryError,
        );
      }
    }
  }
}

/**
 * Clear logs from storage for a specific group
 */
export async function clearGroupLogs(groupId: string): Promise<void> {
  const adapter = getAdapter();

  if (!(await adapter.isAvailable())) {
    return;
  }

  try {
    const key = getGroupStorageKey(groupId);
    await adapter.remove(key);
  } catch (error) {
    console.error("Failed to clear group logs from storage:", error);
  }
}
