/**
 * Unified Log Management API for Picologs Desktop App
 *
 * Consolidates all log state management into a single class-based API.
 * Eliminates circular effect dependencies by using untrack() for mutations.
 *
 * Key features:
 * - Single source of truth for logs, filters, and player state
 * - No circular dependencies (uses untrack for mutations)
 * - Derived values for filtered logs
 * - Debounced persistence to Tauri store
 */

import { untrack } from 'svelte';
import type { Log } from '@pico/types';
import { processAndLimitLogs, getCurrentPlayer, filterState, appState } from '@pico/shared';
import { debug } from '$lib/debug';

// Debounce delay for disk writes (ms)
const SAVE_DEBOUNCE_MS = 2000;

// Memory limit for logs
const MAX_LOGS = 1000;

class LogApi {
	// Core reactive state
	logs = $state<Log[]>([]);
	lastLineCount = $state<number>(0);
	isWatching = $state<boolean>(false);
	logLocation = $state<string | null>(null);
	currentPlayer = $state<string | null>(null);
	isLoading = $state<boolean>(false);

	// Remote logs from WebSocket (friends/groups)
	remoteLogs = $state<Log[]>([]);

	// Track if logs have been loaded from storage (prevents duplicate loading)
	private hasLoadedFromStorage = $state<boolean>(false);

	// Getters for backward compatibility - delegate to filterState
	get enabledPlayers() {
		return filterState.players;
	}
	get enabledLogTypes() {
		return filterState.eventTypes;
	}
	get activeFriendId() {
		return filterState.activeFriendId;
	}
	get activeGroupId() {
		return filterState.activeGroupId;
	}

	// Debounce timer for saves
	private saveDebounceTimer: number | null = null;
	private userId: string | null = null;

	// Derived state
	hasLogs = $derived(this.logs.length > 0 || this.remoteLogs.length > 0);

	/**
	 * Set user ID for log parsing
	 */
	setUserId(userId: string | null) {
		this.userId = userId;
	}

	/**
	 * Get current user ID
	 */
	getUserId(): string {
		return this.userId || 'local';
	}

	/**
	 * Add new logs with full processing pipeline
	 * Called by logWatcher when new lines are parsed
	 */
	addLogs(newLogs: Log[]) {
		if (newLogs.length === 0) return;

		// Use untrack to prevent circular dependencies
		untrack(() => {
			// Combine with existing logs
			const combined = [...this.logs, ...newLogs];

			// Optimized single-pass processing: flatten + dedupe + sort + limit
			const processed = processAndLimitLogs(combined, MAX_LOGS);

			// Update state
			this.logs = processed;

			// Update current player
			this.currentPlayer = getCurrentPlayer() ?? this.logs[0]?.player ?? null;

			// Feed to appState (single source of truth for filtering)
			appState.setLogs(processed);

			// Debounced save to disk
			this.scheduleSave();
		});
	}

	/**
	 * Add remote logs from WebSocket (friends/groups)
	 */
	addRemoteLogs(logs: Log[]) {
		if (logs.length === 0) return;

		untrack(() => {
			// Deduplicate against existing remote logs
			const existingIds = new Set(this.remoteLogs.map((l) => l.id));
			const newLogs = logs.filter((l) => !existingIds.has(l.id));

			if (newLogs.length > 0) {
				this.remoteLogs = [...this.remoteLogs, ...newLogs];

				// Apply memory limit to remote logs too
				if (this.remoteLogs.length > MAX_LOGS) {
					this.remoteLogs = this.remoteLogs.slice(-MAX_LOGS);
				}

				// Feed combined logs to appState
				const allLogs = [...this.logs, ...this.remoteLogs];
				appState.setLogs(allLogs);
			}
		});
	}

	/**
	 * Clear remote logs (when switching contexts)
	 */
	clearRemoteLogs() {
		this.remoteLogs = [];
	}

	/**
	 * Set logs directly (used for initial load from storage)
	 */
	setLogs(logs: Log[]) {
		this.logs = logs;
		this.currentPlayer = getCurrentPlayer() ?? logs[0]?.player ?? null;
		appState.setLogs(logs);
	}

	/**
	 * Clear all logs (full reset including lastLineCount)
	 */
	clearLogs() {
		this.logs = [];
		this.remoteLogs = [];
		this.currentPlayer = null;
		this.lastLineCount = 0;

		// Reset loaded flag to allow reloading (e.g., when switching files)
		this.hasLoadedFromStorage = false;

		// Clear appState logs
		appState.setLogs([]);
		filterState.resetPlayers();

		// Clear from storage immediately
		this.clearStorage();
	}

	/**
	 * Clear displayed logs only - preserves lastLineCount
	 * Use this for "Clear Logs" button to avoid re-parsing the entire file
	 */
	clearLogsOnly() {
		this.logs = [];
		this.remoteLogs = [];
		this.currentPlayer = null;
		// NOTE: Intentionally NOT resetting lastLineCount
		// This prevents the watcher from re-parsing the entire file

		// Clear appState logs
		appState.setLogs([]);
		filterState.resetPlayers();

		// Save empty logs array but preserve lastLineCount
		this.saveLogsOnlyToStorage();
	}

	/**
	 * Save only the logs array to storage (preserves lastLineCount)
	 */
	private async saveLogsOnlyToStorage() {
		try {
			const { getStoreInstance } = await import('$lib/store-manager');
			const store = await getStoreInstance('logs.json');
			await store.set('logs', []);
			// NOTE: NOT saving lastLineCount - preserves existing value
			await store.save();
			debug.log('[LogApi] Cleared logs from storage (preserved lastLineCount)');
		} catch (error) {
			console.error('[LogApi] Failed to save logs:', error);
		}
	}

	/**
	 * Update last line count (for incremental reading)
	 */
	setLastLineCount(count: number) {
		this.lastLineCount = count;
	}

	/**
	 * Set watching state
	 */
	setWatching(watching: boolean) {
		this.isWatching = watching;
	}

	/**
	 * Set log location (environment: LIVE, PTU, etc.)
	 */
	setLogLocation(location: string | null) {
		this.logLocation = location;
	}

	/**
	 * Set loading state
	 */
	setLoading(loading: boolean) {
		this.isLoading = loading;
	}

	// Filter management methods - delegate to filterState

	/**
	 * Enable all players in filter
	 */
	enableAllPlayers() {
		filterState.enableAllPlayers();
	}

	/**
	 * Toggle a player in the filter
	 */
	togglePlayer(player: string) {
		filterState.togglePlayer(player);
	}

	/**
	 * Enable all log types in filter
	 */
	enableAllLogTypes() {
		filterState.enableAllEventTypes();
	}

	/**
	 * Toggle a log type in the filter
	 */
	toggleLogType(type: string) {
		filterState.toggleEventType(type as any);
	}

	/**
	 * Set active friend filter
	 */
	setActiveFriendId(friendId: string | null) {
		filterState.setActiveFriendId(friendId);
	}

	/**
	 * Set active group filter
	 */
	setActiveGroupId(groupId: string | null) {
		filterState.setActiveGroupId(groupId);
	}

	/**
	 * Reset all filters
	 */
	resetFilters() {
		filterState.reset();
	}

	/**
	 * Schedule debounced save to disk
	 */
	private scheduleSave() {
		// Clear existing timer
		if (this.saveDebounceTimer !== null) {
			clearTimeout(this.saveDebounceTimer);
		}

		// Schedule new save
		this.saveDebounceTimer = setTimeout(async () => {
			await this.saveToStorage();
			this.saveDebounceTimer = null;
		}, SAVE_DEBOUNCE_MS) as unknown as number;
	}

	/**
	 * Save logs to Tauri store (internal)
	 * Logs are already processed by addLogs(), save directly
	 */
	private async saveToStorage() {
		try {
			const { getStoreInstance } = await import('$lib/store-manager');
			const store = await getStoreInstance('logs.json');

			// Logs are already flattened, deduped, and limited by addLogs()
			await store.set('logs', this.logs);
			await store.set('lastLineCount', this.lastLineCount);
			await store.save();

			debug.log('[LogApi] Saved', this.logs.length, 'logs to storage');
		} catch (error) {
			console.error('[LogApi] Failed to save logs:', error);
		}
	}

	/**
	 * Load logs from Tauri store
	 */
	async loadFromStorage(): Promise<void> {
		// Guard: Skip if already loaded with data (prevents duplicate loading)
		if (this.hasLoadedFromStorage && this.logs.length > 0) {
			debug.log('[LogApi] Skipping load - already loaded from storage');
			return;
		}

		try {
			const { getStoreInstance } = await import('$lib/store-manager');
			const store = await getStoreInstance('logs.json');

			// Load stored line count
			const storedLineCount = await store.get<number>('lastLineCount');
			if (typeof storedLineCount === 'number' && storedLineCount > 0) {
				this.lastLineCount = storedLineCount;
			}

			// Load stored logs
			const logs = await store.get<Log[]>('logs');
			if (logs && Array.isArray(logs)) {
				// Logs are already deduplicated when saved - use directly
				this.logs = logs;
				appState.setLogs(logs);
				debug.log('[LogApi] Loaded', logs.length, 'logs from storage');
			}

			// Mark as loaded to prevent duplicate loading
			this.hasLoadedFromStorage = true;
		} catch (error) {
			console.error('[LogApi] Failed to load logs:', error);
		}
	}

	/**
	 * Clear logs from storage
	 */
	private async clearStorage() {
		try {
			const { getStoreInstance } = await import('$lib/store-manager');
			const store = await getStoreInstance('logs.json');
			await store.delete('logs');
			await store.delete('lastLineCount');
			await store.save();
		} catch (error) {
			console.error('[LogApi] Failed to clear storage:', error);
		}
	}

	/**
	 * Force immediate save (call before app shutdown)
	 */
	async forceSave() {
		if (this.saveDebounceTimer !== null) {
			clearTimeout(this.saveDebounceTimer);
			this.saveDebounceTimer = null;
		}
		await this.saveToStorage();
	}

	/**
	 * Cleanup (call on component unmount)
	 */
	destroy() {
		if (this.saveDebounceTimer !== null) {
			clearTimeout(this.saveDebounceTimer);
			this.saveDebounceTimer = null;
		}
	}
}

// Export singleton instance
export const logApi = new LogApi();

// Export class for testing
export { LogApi };
