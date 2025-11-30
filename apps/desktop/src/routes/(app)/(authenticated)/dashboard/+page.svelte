<script lang="ts">
	import { untrack } from 'svelte';
	import {
		DashboardPage,
		appState,
		LogBatchManager,
		getCurrentPlayer,
		filterState
	} from '@pico/shared';
	import type { Log } from '@pico/types';
	import fleetData from '@pico/shared/data/fleet.json';
	import {
		startLogWatcher,
		stopLogWatcher,
		selectLogFileManually,
		getSavedLogPath,
		saveLogPath,
		clearStoredLogs
	} from '$lib/logWatcher';
	import { sendBacklog } from '$lib/backlog';
	import { logApi } from '$lib/logApi.svelte';
	import { exists } from '@tauri-apps/plugin-fs';
	import { getVersion } from '@tauri-apps/api/app';
	import { onMount } from 'svelte';

	// Local log state (offline mode + desktop-specific log watching)
	let isWatchingLogs = $state(false);
	let isSelectingFile = $state(false);
	let appVersion = $state<string>('');
	let logLocation = $state<string | null>(null);

	// Log batch manager for sending logs to server
	let batchManager: LogBatchManager | null = null;
	let batchManagerInitialized = $state(false); // Prevent re-initialization
	let previousLogCount = 0;
	let sentLogIds = new Set<string>(); // Track which logs have been sent to prevent duplicates
	let isInitialized = $state(false); // Guard effect until init complete
	let pendingPlayerName = $state<string | null>(null); // Store player name detected before connection ready

	// Saved log path (reactive state for initialization)
	let savedLogPath = $state<string | null>(null);

	// Transition guard flag (prevents $effect from running during file selection)
	let isTransitioning = $state(false);

	// Sync log location to appState for Header component
	$effect(() => {
		appState.logLocation = logLocation;
	});

	// React to logApi.logs changes for batch manager only
	// Logs are already flattened in logApi.addLogs(), no need to flatten again
	$effect(() => {
		const logs = logApi.logs;

		// Skip until initialization complete - stored logs are marked in init
		if (!isInitialized) return;
		if (logs.length === 0 && !isWatchingLogs) return;

		// Use untrack for all mutations to prevent circular dependencies
		untrack(() => {
			if (batchManager) {
				// Send only NEW logs that haven't been sent yet
				const unsentLogs = logs.filter((log) => !sentLogIds.has(log.id));
				if (unsentLogs.length > 0) {
					console.log(`[Dashboard] Sending ${unsentLogs.length} new unsent logs`);
					batchManager.addMany(unsentLogs);
					unsentLogs.forEach((log) => sentLogIds.add(log.id));

					// Memory management: Prevent unbounded Set growth
					if (sentLogIds.size > 2000) {
						const oldSize = sentLogIds.size;
						const recentLogIds = logs.slice(-1000).map((l) => l.id);
						sentLogIds = new Set(recentLogIds);
						console.log(
							`[Dashboard] Pruned sentLogIds Set to ${sentLogIds.size} entries (was ${oldSize})`
						);
					}
				}
			}

			// Update previous count for next iteration
			previousLogCount = logs.length;
		});
	});

	// Reactively initialize batch manager and file watching when all conditions are met
	$effect(() => {
		// Prevent effect from running during file selection (race condition fix)
		if (isTransitioning) return;

		// Prevent re-initialization if already initialized
		if (batchManagerInitialized) return;

		// Check if we have a saved log path and user data
		if (!savedLogPath || !appState.user?.discordId) {
			return;
		}

		// Wait for layout to be ready (connected + initial data loaded)
		// This defers heavy log processing until after the splash screen closes
		if (!appState.layoutReady) {
			return;
		}

		// If authenticated and connected, create batch manager
		if (appState.connectionStatus === 'connected' && appState.sendRequest && !batchManager) {
			try {
				console.log('[Dashboard] Connection ready, initializing batch manager');

				batchManager = new LogBatchManager(
					async (logs) => {
						// Guard: Check WebSocket connection before sending
						if (appState.connectionStatus !== 'connected') {
							console.warn('[Dashboard] Skipping log send - WebSocket not connected');
							return;
						}

						// Send logs via WebSocket to friends (includes self for multi-device sync)
						console.log(`[Dashboard] Sending batch of ${logs.length} logs via WebSocket`);
						try {
							// Use sendRequest if available
							if (appState.sendRequest) {
								await appState.sendRequest('batch_logs', {
									logs,
									target: { type: 'friends' }
								});
								console.log(`[Dashboard] Successfully sent ${logs.length} logs`);
							}
						} catch (error) {
							console.error('[Dashboard] Failed to send logs:', error);
						}
					},
					2500, // 2.5s interval
					8 // 8 logs per batch
				);
				previousLogCount = 0;
				batchManagerInitialized = true; // Mark as initialized
			} catch (error) {
				console.error('[Dashboard] Failed to initialize batch manager:', error);
				// Reset state to allow retry
				batchManager = null;
				batchManagerInitialized = false;
				if (appState.addToast) {
					appState.addToast('Failed to initialize log sharing', 'error');
				}
				return;
			}
		}

		// Start file watching if not already watching and batch manager is ready
		if (!isWatchingLogs && batchManager) {
			// startWatching already has error handling, but we catch here for completeness
			startWatching(savedLogPath)
				.then(async () => {
					// Mark all loaded logs as sent AFTER watcher init completes
					logApi.logs.forEach((log) => sentLogIds.add(log.id));
					isInitialized = true; // Enable the effect for new logs
					console.log(
						'[Dashboard] Initialization complete, marked',
						logApi.logs.length,
						'logs as sent'
					);

					// Send backlog to friends and groups (fire-and-forget)
					// This allows friends/groups to see recent activity from before connection
					sendBacklog(logApi.logs, appState).catch((error) => {
						console.error('[Dashboard] Backlog sync failed:', error);
					});

					// Belt-and-suspenders: sync cached player name if user.player is null
					// This handles edge cases where the offline → authenticated transition
					// didn't trigger the player name callback properly
					if (appState.user && !appState.user.player && appState.sendRequest) {
						const { getStoreInstance } = await import('$lib/store-manager');
						const settingsStore = await getStoreInstance('settings.json');
						const cachedPlayerName = await settingsStore.get<string>('cachedPlayerName');

						if (cachedPlayerName) {
							console.log('[Dashboard] Syncing cached player name to server:', cachedPlayerName);
							onPlayerNameChanged(cachedPlayerName);
						}
					}
				})
				.catch((error) => {
					console.error('[Dashboard] Error in $effect startWatching:', error);
					// Error already handled in startWatching function
				});
		}
	});

	// Sync pending player name when connection becomes ready
	$effect(() => {
		// Read dependencies
		const name = pendingPlayerName;
		const sendRequest = appState.sendRequest;
		const status = appState.connectionStatus;
		const isUpdating = appState.isPlayerNameUpdating;

		if (name && sendRequest && status === 'connected' && !isUpdating) {
			console.log('[Dashboard] Connection ready, syncing pending player name:', name);
			untrack(() => {
				onPlayerNameChanged(name);
			});
		}
	});

	// Log file selection
	async function handleSelectLogFile() {
		console.log('[Dashboard] Selecting log file...');

		isSelectingFile = true;

		try {
			const result = await selectLogFileManually();

			if (result) {
				// Validate file exists before proceeding
				const fileExists = await exists(result);
				if (!fileExists) {
					console.error('[Dashboard] Selected file does not exist:', result);
					if (appState.addToast) {
						appState.addToast('Selected file does not exist', 'error');
					}
					return;
				}

				// FIX: Prevent $effect from running during file selection transition
				// This prevents race condition where $effect reads old savedLogPath value
				isTransitioning = true;

				// Clear displayed logs and reset all filters using logApi
				logApi.clearLogs();
				logApi.resetFilters();
				console.log('[Dashboard] Cleared logs and reset all filters via logApi');

				// Clear group members cache to prevent stale data (e.g., old player names)
				if (typeof window !== 'undefined') {
					for (const group of appState.groups) {
						const cacheKey = `picologs:groupMembers:${group.id}`;
						localStorage.removeItem(cacheKey);
					}
					console.log('[Dashboard] Cleared group members cache');
				}

				// IMPORTANT: Clear Tauri storage FIRST (before resetting watcher state)
				// Pass true to also clear lastLineCount so new file reads from beginning
				await clearStoredLogs(true);

				// Reset watcher state (stops watcher, clears batch manager)
				// This would normally trigger $effect, but isTransitioning prevents it
				await resetWatcherState();

				// Extract parent folder name instead of full path
				const pathParts = result.split(/[/\\]/);
				logLocation = pathParts.length > 1 ? pathParts[pathParts.length - 2] : null;

				// IMPORTANT: Reset this flag BEFORE setting savedLogPath
				// This ensures the $effect will run when savedLogPath changes to the new file
				// Without this, the effect hits the early return and the new file never starts watching
				batchManagerInitialized = false;

				// Store path in reactive state - $effect will handle initialization
				savedLogPath = result;

				// FIX: Re-enable $effect now that all state is updated
				// Effect will run once with the correct new path
				isTransitioning = false;

				// Mark that a log file has been selected
				appState.hasSelectedLog = true;

				console.log('[Dashboard] File selected successfully:', result);
			}
		} catch (error) {
			console.error('[Dashboard] File selection failed:', error);

			// Show user-friendly error message
			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

			let userMessage = 'Failed to select log file';
			if (errorMessage.includes('permission') || errorMessage.includes('access')) {
				userMessage = 'Permission denied - cannot access file';
			} else if (errorMessage.includes('canceled') || errorMessage.includes('cancelled')) {
				// User cancelled file picker - don't show error
				console.log('[Dashboard] File selection cancelled by user');
				return;
			}

			if (appState.addToast) {
				appState.addToast(userMessage, 'error');
			}
		} finally {
			// Ensure transition flag is always reset, even on error
			isTransitioning = false;
			isSelectingFile = false;
		}
	}

	// Reset watcher state when logs are cleared
	async function resetWatcherState() {
		console.log('[Dashboard] Resetting watcher state');

		// Stop the file watcher and wait for it to complete
		await stopLogWatcher();

		// Reset state flags
		isWatchingLogs = false;
		isInitialized = false; // Reset init guard
		batchManagerInitialized = false; // Allow re-initialization

		// Clear tracking sets and counters
		sentLogIds.clear();
		previousLogCount = 0;

		// Clean up batch manager
		if (batchManager) {
			batchManager.flush();
			batchManager = null;
		}

		// Note: hasLogs is now derived from logApi.logs, no need to reset manually

		// NOTE: We intentionally DO NOT clear savedLogPath or logLocation here
		// This allows the path to persist across file selections and app restarts
		// The path is only updated when a new file is selected via selectLogFileManually()

		console.log('[Dashboard] Watcher state reset complete');
	}

	async function onPlayerNameChanged(playerName: string) {
		if (!appState.sendRequest || !appState.user?.discordId) {
			// Store for later sync when connection is ready
			pendingPlayerName = playerName;
			console.log(
				'[Dashboard] Player name detected, queuing for sync when connection ready:',
				playerName
			);
			return;
		}

		// Normalize for comparison (trim whitespace, case-insensitive)
		const normalized = playerName?.trim();
		const current = appState.user.player?.trim();

		// Guard: Only update if player name actually changed
		// If current is null/undefined but server might have it, still compare normalized values
		if (current?.toLowerCase() === normalized?.toLowerCase()) {
			console.log('[Dashboard] Player name unchanged, skipping update:', playerName);
			pendingPlayerName = null; // Clear to prevent re-triggering
			return;
		}

		try {
			// Set loading state (but don't clear all state!)
			appState.isPlayerNameUpdating = true;

			// Update profile on server - server will normalize and return playerChanged flag
			const response = await appState.updateProfile({
				player: normalized
				// Note: Intentionally NOT sending usePlayerAsDisplayName
				// Let server keep existing preference
			});
			console.log('[Dashboard] Player name update response:', response);

			// Only update local state and show toast if server confirms the change
			if (response?.playerChanged) {
				appState.updatePlayerName(normalized);
				appState.addToast(`Character: ${playerName}`, 'success');
				console.log('[Dashboard] Player name changed on server:', normalized);
			} else {
				console.log('[Dashboard] Server reports player name unchanged');
			}

			// Clear loading state and pending
			appState.isPlayerNameUpdating = false;
			pendingPlayerName = null;
		} catch (error) {
			console.error('[Dashboard] Failed to update player name:', error);
			appState.isPlayerNameUpdating = false;
			appState.addToast('Failed to update character', 'error');
			pendingPlayerName = playerName; // Keep for retry
		}
	}

	async function startWatching(path: string) {
		console.log('[Dashboard] Starting log watcher for:', path);

		try {
			isWatchingLogs = true;

			// Start watcher - updates logState directly, caller handles initialization
			await startLogWatcher(path, appState.user?.discordId, undefined, onPlayerNameChanged);
		} catch (error) {
			console.error('[Dashboard] Failed to start log watcher:', error);

			// Reset watching state on error to allow retry
			isWatchingLogs = false;

			// Show user-friendly error message
			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

			// Provide specific error messages for common issues
			let userMessage = 'Failed to start log watcher';
			if (errorMessage.includes('does not exist')) {
				userMessage = 'Selected file no longer exists';
			} else if (errorMessage.includes('permission') || errorMessage.includes('access')) {
				userMessage = 'Permission denied - cannot access file';
			} else if (errorMessage.includes('invalid') || errorMessage.includes('path')) {
				userMessage = 'Invalid file path';
			}

			// Show toast notification if available
			if (appState.addToast) {
				appState.addToast(userMessage, 'error');
			}
		}
	}

	// Initialize on mount
	onMount(() => {
		console.log('[Dashboard] Component mounted');

		// Clear friend/group filters for offline mode only
		// These filters run BEFORE event type filtering in appState.filteredLogs
		// If set from previous online session, all offline logs (userId: 'local') are filtered out
		// In online mode, preserve filters (e.g., restored from localStorage)
		if (!appState.user || !appState.token) {
			filterState.setActiveFriendId(null);
			filterState.setActiveGroupId(null);
			console.log('[Dashboard] Cleared active filters for offline mode');
		} else {
			console.log('[Dashboard] Online mode - preserving active filters');
		}

		// Register handlers for Header/App components
		appState.selectLogFile = handleSelectLogFile;
		appState.resetWatcher = resetWatcherState;

		// PERFORMANCE: Run async initialization in parallel with WebSocket connection
		Promise.all([
			// Pre-load logs immediately (don't wait for layoutReady)
			// This overlaps disk I/O with network latency
			logApi.loadFromStorage().then(() => {
				console.log('[Dashboard] Logs pre-loaded:', logApi.logs.length);
			}),
			// Fetch app version for footer
			getVersion().then((version) => {
				appVersion = version;
				console.log('[Dashboard] App version:', version);
			}),
			// Check for saved log path
			getSavedLogPath().then((path) => {
				if (path) {
					console.log('[Dashboard] Found saved log path:', path);
					// Extract parent folder name instead of full path
					const pathParts = path.split(/[/\\]/);
					logLocation = pathParts.length > 1 ? pathParts[pathParts.length - 2] : null;

					// Store path in reactive state - $effect will handle initialization
					savedLogPath = path;
					appState.hasSelectedLog = true;
					appState.logLocation = path; // Set full path for UI consistency during transition
					console.log('[Dashboard] Saved path stored, waiting for conditions to be met...');
				}
			})
		]).catch((error) => {
			console.error('[Dashboard] Error during parallel initialization:', error);
		});

		// Cleanup on unmount
		return () => {
			console.log('[Dashboard] Cleaning up log watcher');

			// Flush any pending logs before unmounting
			if (batchManager) {
				console.log('[Dashboard] Flushing pending logs from batch manager');
				batchManager.flush();
				batchManager = null;
			}

			// Unregister handlers
			appState.selectLogFile = undefined;
			appState.resetWatcher = undefined;

			stopLogWatcher();
		};
	});
</script>

<!-- Use shared DashboardPage component for consistent behavior with website -->
<DashboardPage fleet={fleetData} {appVersion} />
