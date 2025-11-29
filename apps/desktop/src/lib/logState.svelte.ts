/**
 * Backwards-compatible Log State for Tauri Desktop App
 *
 * This module now delegates to logApi for all functionality.
 * Kept for backwards compatibility with existing imports.
 *
 * @deprecated Use logApi directly for new code
 */

import { logApi, LogApi } from './logApi.svelte';

// Create a proxy class that delegates to logApi
// This maintains the same interface for backwards compatibility
class LogState {
	// Delegate all reactive state to logApi
	get logs() {
		return logApi.logs;
	}
	set logs(value) {
		logApi.logs = value;
	}

	get lastLineCount() {
		return logApi.lastLineCount;
	}
	set lastLineCount(value) {
		logApi.lastLineCount = value;
	}

	get isWatching() {
		return logApi.isWatching;
	}
	set isWatching(value) {
		logApi.isWatching = value;
	}

	get logLocation() {
		return logApi.logLocation;
	}
	set logLocation(value) {
		logApi.logLocation = value;
	}

	get currentPlayer() {
		return logApi.currentPlayer;
	}
	set currentPlayer(value) {
		logApi.currentPlayer = value;
	}

	get isLoading() {
		return logApi.isLoading;
	}
	set isLoading(value) {
		logApi.isLoading = value;
	}

	get hasLogs() {
		return logApi.hasLogs;
	}

	// Delegate all methods to logApi
	setUserId(userId: string | null) {
		logApi.setUserId(userId);
	}

	getUserId(): string {
		return logApi.getUserId();
	}

	addLogs(newLogs: Parameters<typeof logApi.addLogs>[0]) {
		logApi.addLogs(newLogs);
	}

	setLogs(logs: Parameters<typeof logApi.setLogs>[0]) {
		logApi.setLogs(logs);
	}

	clearLogs() {
		logApi.clearLogs();
	}

	setLastLineCount(count: number) {
		logApi.setLastLineCount(count);
	}

	setWatching(watching: boolean) {
		logApi.setWatching(watching);
	}

	setLogLocation(location: string | null) {
		logApi.setLogLocation(location);
	}

	setLoading(loading: boolean) {
		logApi.setLoading(loading);
	}

	async loadFromStorage(): Promise<void> {
		return logApi.loadFromStorage();
	}

	async forceSave() {
		return logApi.forceSave();
	}

	destroy() {
		logApi.destroy();
	}
}

// Export singleton instance that delegates to logApi
export const logState = new LogState();

// Export class for testing
export { LogState };

// Re-export logApi for direct access
export { logApi, LogApi };
