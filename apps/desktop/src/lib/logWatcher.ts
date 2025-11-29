/**
 * Star Citizen Log Watcher for Tauri Desktop App
 *
 * Monitors the Star Citizen Game.log file for changes and parses log events.
 * Uses Tauri's file system plugin with watch feature.
 *
 * Features:
 * - Manual file selection via native dialog
 * - Incremental reading (only new lines since last read)
 * - Event parsing (player connections, inventory, kills, vehicle control, etc.)
 * - Deduplication by hash-based ID
 * - Memory management (limit to 1000 most recent logs)
 * - Environment detection (LIVE/PTU/HOTFIX)
 * - Persistent file path storage across app restarts
 *
 * Functions:
 * - selectLogFileManually(): Open file picker to select Game.log
 * - getSavedLogPath(): Get previously saved log file path
 * - startLogWatcher(logPath): Start watching log file (updates logState directly)
 * - stopLogWatcher(): Stop watching and cleanup
 * - loadStoredLogs(): Load persisted logs from Tauri store
 * - saveLogsToStore(logs): Save logs to Tauri store
 *
 * Log parsing utilities are imported from @pico/shared:
 * - parseStarCitizenLogLine: Parse single log line
 * - parseLogLines: Parse multiple log lines
 * - dedupeAndSortLogs: Deduplicate and sort logs
 * - applyMemoryLimit: Limit to N most recent logs
 * - LogBatchManager: Batch log transmission
 * - MultiTargetBatchManager: Batch to multiple targets
 * - LogSyncManager: Delta sync management
 *
 * @see https://v2.tauri.app/plugin/file-system/
 */

import type { Log } from '@pico/types';
import { watchImmediate, exists } from '@tauri-apps/plugin-fs';
import { open } from '@tauri-apps/plugin-dialog';
import { emit } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import {
	parseLogLines,
	resetParserState,
	setCurrentPlayer,
	dedupeAndSortLogs,
	applyMemoryLimit,
	flattenGroups,
	addPatterns
} from '@pico/shared';
import { logState } from '$lib/logState.svelte';
import { debug } from '$lib/debug';

// Type for Rust LogMetadata response
interface LogMetadata {
	line_count: number;
	player_name: string | null;
}

// Type for Rust RawLogPattern response
interface RawLogPattern {
	eventName: string | null;
	severity: string | null;
	teams: string[];
	subsystems: string[];
	signature: string;
	exampleLine: string;
}

// Type for Rust LogUpdate response (single-pass reading)
interface LogUpdate {
	line_count: number;
	player_name: string | null;
	new_lines: string[];
	patterns: RawLogPattern[];
}

export type PlayerNameUpdateCallback = (playerName: string) => Promise<void>;

// Internal state for log watching
let watcherHandle: (() => void) | null = null;
let currentLogPath: string | null = null;
let debounceTimer: number | null = null;
let pollInterval: number | null = null;
let lastKnownPlayerName: string | null = null;
let onPlayerNameUpdate: PlayerNameUpdateCallback | null = null;
let restartPending = false;

/**
 * Extract player name from log lines by finding the connection event
 * This ensures we have the player name before parsing any events
 *
 * @param lines - Array of log lines to scan
 * @returns Player name if found, null otherwise
 */
export function extractPlayerNameFromLines(lines: string[]): string | null {
	// Iterate backwards to find the MOST RECENT login event
	// This prevents reverting to an old character name if the log file contains multiple sessions
	for (let i = lines.length - 1; i >= 0; i--) {
		const line = lines[i];
		if (line.includes('AccountLoginCharacterStatus_Character')) {
			// Extract name (match until " - " delimiter to support hyphenated names)
			const nameMatch = line.match(/name\s+(.+?)\s+-\s+/);
			if (nameMatch) {
				return nameMatch[1];
			}
		}
	}
	return null;
}

/**
 * Start watching Star Citizen log file
 * Updates logState directly when new logs are detected
 *
 * @param logPath - Absolute path to the Game.log file
 * @param userIdParam - Optional user ID for log parsing
 * @param clearPreviousLogs - If true, clears stored logs before starting (for new file selection)
 * @param onPlayerNameChanged - Optional callback when player name changes
 */
export async function startLogWatcher(
	logPath: string,
	userIdParam?: string,
	clearPreviousLogs?: boolean,
	onPlayerNameChanged?: PlayerNameUpdateCallback
): Promise<void> {
	// Stop existing watcher if any
	if (watcherHandle) {
		await stopLogWatcher();
	}

	// Reset parser state (clear player registry)
	resetParserState();

	// Set userId in logState for log parsing
	logState.setUserId(userIdParam || null);
	logState.setLoading(true);

	// Set player name update callback
	onPlayerNameUpdate = onPlayerNameChanged || null;
	lastKnownPlayerName = null;

	// Validate log path exists
	if (!(await exists(logPath))) {
		throw new Error(`Log file does not exist: ${logPath}`);
	}

	currentLogPath = logPath;

	// Extract environment from path for logLocation
	const pathParts = logPath.split(/[/\\]/);
	const location = pathParts.length > 1 ? pathParts[pathParts.length - 2] : null;
	logState.setLogLocation(location);

	// Load stored logs from Tauri store (if any), or clear if switching files
	let storedLineCount = 0;
	if (clearPreviousLogs) {
		// Clear stored logs when switching to a new file
		logState.clearLogs();
	} else {
		// Load stored logs from previous session
		try {
			await logState.loadFromStorage();
			storedLineCount = logState.lastLineCount;

			// If we have a userId parameter (authenticated mode), update userId on all stored logs
			if (userIdParam && logState.logs.length > 0) {
				logState.setLogs(logState.logs.map((log) => ({ ...log, userId: userIdParam })));
			}
		} catch (error) {
			debug.warn('[LogWatcher] Could not load stored logs:', error);
		}
	}

	// Read and parse initial file content using Rust SINGLE-PASS for performance
	try {
		// Load settings store for cached player name
		const { getStoreInstance } = await import('$lib/store-manager');
		const settingsStore = await getStoreInstance('settings.json');
		const cachedPlayerName = await settingsStore.get<string>('cachedPlayerName');

		// Determine if we need to extract player name (first run or no cache)
		const needsPlayerNameScan = !cachedPlayerName || storedLineCount === 0;

		// Determine starting position for reading
		const fromLine = storedLineCount > 0 ? storedLineCount : 0;

		// SINGLE-PASS: Get line count, player name (if needed), new lines, and patterns all at once
		let update: LogUpdate;
		try {
			update = await invoke<LogUpdate>('read_log_update', {
				path: logPath,
				fromLine,
				extractPlayerName: needsPlayerNameScan,
				extractPatterns: true
			});
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error('[LogWatcher] Rust IPC error:', errorMessage);
			throw new Error(`Failed to read log file: ${errorMessage}`);
		}

		const currentLineCount = update.line_count;
		let playerName = update.player_name;

		// Handle truncation detection
		if (storedLineCount > 0 && currentLineCount < storedLineCount) {
			// File was truncated - re-read from beginning with player name extraction
			debug.log('[LogWatcher]', 'File truncation detected, re-reading from start');
			const truncUpdate = await invoke<LogUpdate>('read_log_update', {
				path: logPath,
				fromLine: 0,
				extractPlayerName: true,
				extractPatterns: true
			});
			playerName = truncUpdate.player_name;
			update.new_lines = truncUpdate.new_lines;
			update.patterns = truncUpdate.patterns;
		} else if (!needsPlayerNameScan) {
			// Use cached player name
			playerName = cachedPlayerName;
			debug.log('[LogWatcher]', 'Using cached player name:', playerName);
		}

		// Cache player name if we extracted it
		if (needsPlayerNameScan && playerName) {
			await settingsStore.set('cachedPlayerName', playerName);
			await settingsStore.save();
			debug.log('[LogWatcher]', 'Cached player name:', playerName);
		}

		if (playerName) {
			setCurrentPlayer(playerName);

			// Update player name in profile if it has changed and callback is provided
			if (onPlayerNameUpdate && playerName !== lastKnownPlayerName) {
				lastKnownPlayerName = playerName;
				try {
					await onPlayerNameUpdate(playerName);
					debug.log('[LogWatcher]', 'Player name updated in profile:', playerName);
				} catch (error) {
					console.error('[LogWatcher] Failed to update player name in profile:', error);
				}
			}
		} else {
			debug.warn('[LogWatcher]', 'No player name found in file - events will show as Unknown');
		}

		// Update lastLineCount to current file state
		logState.setLastLineCount(currentLineCount);

		// Parse and process logs if we got new lines
		if (update.new_lines.length > 0) {
			const parsedLogs = parseLogLines(update.new_lines, logState.getUserId());

			// Telemetry: track parse success rate
			const parseRate =
				parsedLogs.length > 0 ? Math.round((parsedLogs.length / update.new_lines.length) * 100) : 0;
			debug.log(
				`[LogWatcher] Initial parse: ${update.new_lines.length} lines → ${parsedLogs.length} logs (${parseRate}% parse rate)`
			);

			// Add to logState (handles processing pipeline and debounced save)
			logState.addLogs(parsedLogs);
		}

		// Send patterns to cache for batching (Rust extracts, TypeScript batches and sends)
		if (update.patterns.length > 0) {
			const addedCount = addPatterns(update.patterns);
			debug.log(
				`[LogWatcher] Initial patterns: ${update.patterns.length} extracted, ${addedCount} unique added to cache`
			);
		}

		// Set watching state
		logState.setWatching(true);
		logState.setLoading(false);
	} catch (error) {
		console.error('[LogWatcher] Error reading initial file:', error);
	}

	// Extract directory and filename for directory watching
	// Watching the directory is more reliable than watching the file directly
	const pathSeparator = logPath.includes('/') ? '/' : '\\';
	const lastSeparatorIndex = logPath.lastIndexOf(pathSeparator);
	const directory = logPath.substring(0, lastSeparatorIndex);
	const fileName = logPath.substring(lastSeparatorIndex + 1);

	// Helper function to process file changes (used by watcher and debounce)
	async function handleFileChange() {
		try {
			// Check if file exists before reading
			const fileExists = await exists(logPath);
			if (!fileExists) {
				debug.warn('[LogWatcher] File does not exist, skipping update');
				return;
			}
			await emit('watcher-handle-change-start', {
				path: logPath,
				timestamp: new Date().toISOString()
			});

			// SINGLE-PASS: Get line count, new lines, and patterns in one read
			let update: LogUpdate;
			try {
				update = await invoke<LogUpdate>('read_log_update', {
					path: logPath,
					fromLine: logState.lastLineCount,
					extractPlayerName: false, // Only extract from new lines below
					extractPatterns: true
				});
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				console.error('[LogWatcher] Rust IPC error during file change:', errorMessage);
				return; // Skip this update, watcher will retry on next change
			}

			const currentLineCount = update.line_count;
			const newLines = update.new_lines;

			// Detect truncation: file has fewer lines than we've already read
			if (currentLineCount < logState.lastLineCount) {
				debug.log(
					`[LogWatcher] File truncation detected (${logState.lastLineCount} -> ${currentLineCount})`
				);
				await emit('watcher-truncation', {
					before: logState.lastLineCount,
					after: currentLineCount
				});
				logState.setLastLineCount(0);

				// Schedule restart OUTSIDE callback context to avoid nesting issues
				if (!restartPending) {
					restartPending = true;
					debug.log('[LogWatcher] Scheduling watcher restart in 1s...');

					setTimeout(async () => {
						try {
							// Save state before restart
							const path = currentLogPath;

							const user = logState.getUserId();
							const playerCallback = onPlayerNameUpdate;

							debug.log('[LogWatcher] Stopping old watcher...');
							await stopLogWatcher();

							// Wait for file system to settle
							await new Promise((resolve) => setTimeout(resolve, 500));

							debug.log('[LogWatcher] Starting fresh watcher...');
							if (path) {
								await startLogWatcher(path, user || undefined, false, playerCallback || undefined);
							}
						} catch (error) {
							console.error('[LogWatcher] Restart failed:', error);
						} finally {
							restartPending = false;
						}
					}, 1000); // 1s delay ensures we're outside callback context
				}
				return; // Exit early - restart will handle re-reading
			}

			debug.log(
				`[LogWatcher] Line count check: {current: ${currentLineCount}, last: ${logState.lastLineCount}, new: ${newLines.length}}`
			);
			await emit('watcher-new-lines', {
				count: newLines.length,
				currentLineCount,
				lastLineCount: logState.lastLineCount
			});

			if (newLines.length > 0) {
				// Pre-scan for player name to ensure currentPlayer is set before parsing
				const playerName = extractPlayerNameFromLines(newLines);
				if (playerName) {
					setCurrentPlayer(playerName);

					// Update player name in profile if it has changed and callback is provided
					if (onPlayerNameUpdate && playerName !== lastKnownPlayerName) {
						lastKnownPlayerName = playerName;

						// Cache the new player name
						try {
							const { getStoreInstance } = await import('$lib/store-manager');
							const settingsStore = await getStoreInstance('settings.json');
							await settingsStore.set('cachedPlayerName', playerName);
							await settingsStore.save();
						} catch (cacheError) {
							debug.warn('[LogWatcher]', 'Failed to cache player name:', cacheError);
						}

						try {
							await onPlayerNameUpdate(playerName);
							debug.log('[LogWatcher]', 'Player name updated in profile:', playerName);
						} catch (error) {
							console.error('[LogWatcher] Failed to update player name in profile:', error);
						}
					}
				}

				// Parse new lines
				const newLogs = parseLogLines(newLines, logState.getUserId());

				// Telemetry: track parse success rate
				const parseRate =
					newLogs.length > 0 ? Math.round((newLogs.length / newLines.length) * 100) : 0;
				debug.log(
					`[LogWatcher] Parsed ${newLines.length} lines → ${newLogs.length} logs (${parseRate}% parse rate)`
				);

				// Add to logState (handles processing pipeline and debounced save)
				logState.addLogs(newLogs);
				debug.log(`[LogWatcher] Total logs: ${logState.logs.length}`);

				// Send patterns to cache for batching (Rust extracts, TypeScript batches and sends)
				if (update.patterns.length > 0) {
					const addedCount = addPatterns(update.patterns);
					debug.log(
						`[LogWatcher] Patterns: ${update.patterns.length} extracted, ${addedCount} unique added to cache`
					);
				}
			} else {
				debug.log('[LogWatcher] No new lines detected, skipping update');
			}

			// IMPORTANT: Always update line count, even if no new lines (prevents position drift)
			logState.setLastLineCount(currentLineCount);
		} catch (error) {
			console.error('[LogWatcher] Error processing file change:', error);
		}
	}

	// Watch directory for changes (more reliable than watching file directly)
	const unwatch = await watchImmediate(directory, async (event) => {
		try {
			// Debug logging to diagnose watcher issues
			debug.log('[LogWatcher] Watcher event received:', {
				paths: event.paths,
				fileName: fileName,
				timestamp: new Date().toISOString()
			});
			await emit('watcher-event', {
				paths: event.paths,
				fileName: fileName,
				timestamp: new Date().toISOString()
			});

			// Filter events to only process changes to our specific file
			const isOurFile = event.paths.some((p) => {
				// Normalize path separators for comparison
				const normalizedPath = p.replace(/\//g, pathSeparator);
				const matches = normalizedPath.endsWith(fileName) || normalizedPath.includes(fileName);
				debug.log('[LogWatcher] Path check:', {
					original: p,
					normalized: normalizedPath,
					fileName: fileName,
					matches: matches
				});
				return matches;
			});
			await emit('watcher-path-check', {
				isOurFile,
				paths: event.paths,
				expectedFile: fileName
			});

			if (!isOurFile) {
				debug.log('[LogWatcher] Ignoring event - not our file');
				return;
			}

			debug.log('[LogWatcher] Event is for our file, setting debounce timer');

			// Debounce: wait 500ms for file writes to settle before processing
			if (debounceTimer !== null) {
				clearTimeout(debounceTimer);
			}

			debounceTimer = setTimeout(async () => {
				debug.log('[LogWatcher] Debounce timer fired, calling handleFileChange');
				await emit('watcher-debounce-fired', { path: logPath });
				await handleFileChange(); // Await to properly catch errors
				debounceTimer = null;
			}, 500) as unknown as number;
		} catch (error) {
			console.error('[LogWatcher] Watcher callback error - watcher may have stopped:', error);
			// Don't rethrow - we want the watcher to keep running even if one event fails
		}
	});

	watcherHandle = unwatch;

	// Fallback polling - catches changes if watcher events don't fire (every 10s)
	// This is a safety net for when watchImmediate() events stop firing on Windows
	pollInterval = setInterval(async () => {
		try {
			await handleFileChange();
		} catch (error) {
			console.error('[LogWatcher] Poll error:', error);
		}
	}, 10000) as unknown as number;
	debug.log('[LogWatcher] Started 10-second polling fallback');
}

/**
 * Stop watching log file and cleanup
 */
export async function stopLogWatcher(): Promise<void> {
	// Force save any pending changes before stopping
	await logState.forceSave();

	// Unwatch file
	if (watcherHandle) {
		watcherHandle();
		watcherHandle = null;
	}

	// Clear debounce timer
	if (debounceTimer !== null) {
		clearTimeout(debounceTimer);
		debounceTimer = null;
	}

	// Clear poll interval
	if (pollInterval !== null) {
		clearInterval(pollInterval);
		pollInterval = null;
	}

	// Clear state
	currentLogPath = null;
	logState.setWatching(false);
	logState.setLoading(false);

	// Reset parser state (clear player registry and cached player name)
	// This ensures old player names don't persist when selecting a new log file
	resetParserState();
	lastKnownPlayerName = null;
	onPlayerNameUpdate = null;
}

/**
 * Auto-detect Star Citizen Game.log file
 *
 * Checks common installation paths in priority order:
 * 1. LocalAppData (most common for logs)
 * 2. Common installation drives (C-F)
 *
 * Environments checked in priority: LIVE > PTU > EPTU > HOTFIX > TECH-PREVIEW
 *
 * @returns Path to Game.log if found, null otherwise
 */
export async function autoDetectGameLog(): Promise<string | null> {
	try {
		const { localDataDir } = await import('@tauri-apps/api/path');

		const localData = await localDataDir();

		// Priority order: LIVE (most common) > PTU > EPTU > HOTFIX > TECH-PREVIEW
		const environments = ['LIVE', 'PTU', 'EPTU', 'HOTFIX', 'TECH-PREVIEW'];

		// Priority 1: LocalAppData (Windows default for logs)
		// Windows: C:\Users\{username}\AppData\Local\Star Citizen\{ENV}\Game.log
		for (const env of environments) {
			const path = `${localData}\\Star Citizen\\${env}\\Game.log`;
			if (await exists(path)) {
				debug.log('[AutoDetect] Found at LocalAppData:', path);
				return path;
			}
		}

		// Priority 2: Common installation drives (for custom installations)
		// Example: D:\Program Files\Roberts Space Industries\StarCitizen\{ENV}\Game.log
		const commonDrives = ['C', 'D', 'E', 'F'];
		for (const drive of commonDrives) {
			for (const env of environments) {
				const path = `${drive}:\\Program Files\\Roberts Space Industries\\StarCitizen\\${env}\\Game.log`;
				if (await exists(path)) {
					debug.log('[AutoDetect] Found at Program Files:', path);
					return path;
				}
			}
		}

		debug.log('[AutoDetect] No Game.log found in common locations');
		return null;
	} catch (error) {
		console.error('[AutoDetect] Error during auto-detection:', error);
		return null;
	}
}

/**
 * Open native file picker to manually select Game.log file
 * Saves selected path to settings store for future use
 *
 * @returns Selected file path, or null if user cancelled
 */
export async function selectLogFileManually(): Promise<string | null> {
	try {
		const selected = await open({
			multiple: false,
			directory: false,
			filters: [
				{
					name: 'Star Citizen Logs',
					extensions: ['log']
				}
			],
			title: 'Select Star Citizen Game.log'
		});

		if (selected) {
			// Save to settings store
			await saveLogPath(selected);
			return selected;
		}

		return null;
	} catch (error) {
		console.error('[LogWatcher] File picker error:', error);
		return null;
	}
}

/**
 * Get previously saved log file path from settings store
 *
 * @returns Saved log file path, or null if none saved
 */
export async function getSavedLogPath(): Promise<string | null> {
	try {
		debug.log('[LogWatcher] Loading saved log path from settings.json...');
		const { getStoreInstance } = await import('$lib/store-manager');
		const store = await getStoreInstance('settings.json');

		const path = await store.get<string>('lastFile');
		debug.log('[LogWatcher] Raw value from store:', { path, type: typeof path });

		if (path && typeof path === 'string') {
			debug.log('[LogWatcher] Found saved path, verifying file exists:', path);
			// Verify file still exists
			if (await exists(path)) {
				debug.log('[LogWatcher] ✓ File exists, returning saved path');
				return path;
			} else {
				debug.warn('[LogWatcher] ✗ Saved log path no longer exists, clearing...', path);
				await saveLogPath(null);
				return null;
			}
		}

		debug.log('[LogWatcher] No saved path found in store');
		return null;
	} catch (error) {
		console.error('[LogWatcher] Error loading saved log path:', error);
		return null;
	}
}

/**
 * Save log file path to settings store
 *
 * @param path - Log file path to save (or null to clear)
 */
export async function saveLogPath(path: string | null): Promise<void> {
	try {
		debug.log('[LogWatcher] Saving log path to settings.json:', path || '<clearing>');
		const { getStoreInstance } = await import('$lib/store-manager');
		const store = await getStoreInstance('settings.json');

		if (path) {
			await store.set('lastFile', path);
			debug.log('[LogWatcher] Set lastFile key in store');
		} else {
			const deleted = await store.delete('lastFile');
			debug.log('[LogWatcher] Deleted lastFile key from store:', deleted);
		}

		// Explicitly save (even though auto-save is enabled, be defensive)
		await store.save();
		debug.log('[LogWatcher] Explicitly saved store to disk');

		// Verify save by reading back
		const verified = await store.get<string>('lastFile');
		debug.log('[LogWatcher] Verification read:', verified === path ? '✓ Match' : '✗ Mismatch', {
			expected: path,
			actual: verified
		});
	} catch (error) {
		console.error('[LogWatcher] Error saving log path:', error);
		throw error;
	}
}

/**
 * Parse log line into structured Log object
 *
 * NOTE: This functionality is now imported from @pico/shared
 * Use parseStarCitizenLogLine(line, userId) or parseLogLines(lines, userId) instead
 *
 * Supported events:
 *   - AccountLoginCharacterStatus_Character (player connection)
 *   - RequestLocationInventory (inventory requests)
 *   - Actor Death (kills/deaths)
 *   - Vehicle Control Flow (ship boarding)
 *   - Vehicle Destruction / Ship Destruction
 *   - SystemQuit
 *
 * Features:
 *   - Regex patterns to extract log events
 *   - Deterministic ID generation (hash-based)
 *   - Structured Log object output
 *
 * @example
 * ```typescript
 * import { parseStarCitizenLogLine } from '@pico/shared';
 * const log = parseStarCitizenLogLine(line, userId);
 * ```
 */

/**
 * Load persisted logs from Tauri store
 */
export async function loadStoredLogs(): Promise<Log[]> {
	try {
		const { getStoreInstance } = await import('$lib/store-manager');
		const store = await getStoreInstance('logs.json');

		const logs = await store.get<Log[]>('logs');
		debug.log('[LogWatcher] loadStoredLogs() retrieved:', logs?.length || 0, 'logs from storage');

		if (logs && Array.isArray(logs)) {
			// Flatten groups to ensure no group wrappers exist (handles legacy data)
			const flattenedLogs = flattenGroups(logs);

			// Deduplicate loaded logs to clean up any existing duplicates
			const dedupedLogs = dedupeAndSortLogs(flattenedLogs);
			if (dedupedLogs.length !== logs.length) {
				debug.warn(
					`[LogWatcher] Removed ${logs.length - dedupedLogs.length} duplicate logs from storage`
				);
			}

			return dedupedLogs;
		}

		return [];
	} catch (error) {
		console.error('[LogWatcher] Error loading stored logs:', error);
		return [];
	}
}

/**
 * Save logs to Tauri store
 */
export async function saveLogsToStore(logs: Log[]): Promise<void> {
	try {
		const { getStoreInstance } = await import('$lib/store-manager');
		const store = await getStoreInstance('logs.json');

		// Flatten groups before saving (prevents duplicate groups on reload)
		// Storage should only contain individual events, not group wrappers
		const flattenedLogs = flattenGroups(logs);

		// Deduplicate before applying memory limit and saving
		const dedupedLogs = dedupeAndSortLogs(flattenedLogs);
		if (dedupedLogs.length !== logs.length) {
			debug.warn(
				`[LogWatcher] Removed ${logs.length - dedupedLogs.length} duplicate logs before saving`
			);
		}

		// Apply memory limit after deduplication
		const limitedLogs = applyMemoryLimit(dedupedLogs, 1000);

		await store.set('logs', limitedLogs);
		await store.set('lastLineCount', logState.lastLineCount);
		await store.save();
	} catch (error) {
		console.error('[LogWatcher] Error saving logs to store:', error);
		throw error;
	}
}

/**
 * Clear stored logs from Tauri store
 * Used when switching to a new log file or clearing logs for the same file
 * @param clearLineCount - If true, also clears lastLineCount (use when switching to new file)
 */
export async function clearStoredLogs(clearLineCount: boolean = false): Promise<void> {
	try {
		const { getStoreInstance } = await import('$lib/store-manager');
		const store = await getStoreInstance('logs.json');

		await store.delete('logs');

		if (clearLineCount) {
			// Clear line count when switching to a new file (start from beginning)
			await store.delete('lastLineCount');
		} else {
			// Preserve file position when clearing logs for the same file
			// This prevents re-reading old logs after a manual clear
		}

		await store.save();
	} catch (error) {
		console.error('[LogWatcher] Error clearing stored logs:', error);
		throw error;
	}
}
