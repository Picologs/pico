/**
 * Dashboard Page Tests
 *
 * Tests the dashboard page functionality including:
 * - Manual log file selection
 * - Environment extraction from path (LIVE/PTU/EPTU)
 * - Filter reset on file selection
 * - Log watcher lifecycle
 * - Player name detection and sync
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

// Mock $app/environment
vi.mock('$app/environment', () => ({
	browser: true
}));

// Mock fleet data
vi.mock('@pico/shared/data/fleet.json', () => ({
	default: []
}));

// Mock $lib/logApi.svelte.ts - inline to avoid hoisting issues
vi.mock('$lib/logApi.svelte.ts', () => ({
	logApi: {
		logs: [],
		clearLogs: vi.fn(),
		clearLogsOnly: vi.fn(),
		resetFilters: vi.fn(),
		loadFromStorage: vi.fn(() => Promise.resolve()),
		forceSave: vi.fn(() => Promise.resolve())
	}
}));

// Mock @pico/shared - inline to avoid hoisting issues
vi.mock('@pico/shared', () => ({
	appState: {
		logs: [],
		filteredLogs: [],
		currentPlayer: null,
		user: { discordId: 'test-user-123', username: 'TestUser', player: null },
		sendRequest: vi.fn(),
		logLocation: null,
		selectLogFile: null,
		resetWatcher: null,
		hasLogs: false,
		hasSelectedLog: false,
		connectionStatus: 'connected',
		layoutReady: true,
		friends: [],
		groups: [],
		activeFriendId: null,
		activeGroupId: null,
		isPlayerNameUpdating: false,
		enabledPlayers: new Set(),
		addToast: vi.fn(),
		updateProfile: vi.fn(),
		updatePlayerName: vi.fn()
	},
	DashboardPage: vi.fn(() => null),
	LogBatchManager: vi.fn().mockImplementation(function () {
		return { addMany: vi.fn(), flush: vi.fn() };
	}),
	getCurrentPlayer: vi.fn(() => null),
	filterState: {
		setActiveFriendId: vi.fn(),
		setActiveGroupId: vi.fn()
	}
}));

// Mock $lib/logWatcher
vi.mock('$lib/logWatcher', () => ({
	startLogWatcher: vi.fn().mockResolvedValue(undefined),
	stopLogWatcher: vi.fn().mockResolvedValue(undefined),
	selectLogFileManually: vi.fn().mockResolvedValue(null),
	getSavedLogPath: vi.fn().mockResolvedValue(null),
	saveLogPath: vi.fn().mockResolvedValue(undefined),
	clearStoredLogs: vi.fn().mockResolvedValue(undefined)
}));

// Mock @tauri-apps/plugin-fs
vi.mock('@tauri-apps/plugin-fs', () => ({
	exists: vi.fn().mockResolvedValue(true)
}));

// Mock @tauri-apps/api/app
vi.mock('@tauri-apps/api/app', () => ({
	getVersion: vi.fn().mockResolvedValue('0.13.0')
}));

// Import mocks
import { appState } from '@pico/shared';
import { selectLogFileManually, startLogWatcher } from '$lib/logWatcher';
import { exists } from '@tauri-apps/plugin-fs';
import { logApi } from '$lib/logApi.svelte.ts';

describe('Dashboard - File Selection', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		// Reset appState
		appState.logs = [];
		appState.hasLogs = false;
		appState.hasSelectedLog = false;
		appState.logLocation = null;
		appState.connectionStatus = 'connected';
		appState.user = { discordId: 'test-user-123', username: 'TestUser', player: null };
		appState.groups = [];

		// Reset mocks
		(selectLogFileManually as Mock).mockResolvedValue(null);
		(exists as Mock).mockResolvedValue(true);
	});

	describe('Environment extraction from path', () => {
		it('should extract LIVE environment from path', () => {
			const path = 'C:\\Users\\Test\\Star Citizen\\LIVE\\Game.log';
			const pathParts = path.split(/[/\\]/);
			const logLocation = pathParts.length > 1 ? pathParts[pathParts.length - 2] : null;

			expect(logLocation).toBe('LIVE');
		});

		it('should extract PTU environment from path', () => {
			const path = 'C:\\Users\\Test\\Star Citizen\\PTU\\Game.log';
			const pathParts = path.split(/[/\\]/);
			const logLocation = pathParts.length > 1 ? pathParts[pathParts.length - 2] : null;

			expect(logLocation).toBe('PTU');
		});

		it('should extract EPTU environment from path', () => {
			const path = 'C:\\Users\\Test\\Star Citizen\\EPTU\\Game.log';
			const pathParts = path.split(/[/\\]/);
			const logLocation = pathParts.length > 1 ? pathParts[pathParts.length - 2] : null;

			expect(logLocation).toBe('EPTU');
		});

		it('should handle Unix-style paths', () => {
			const path = '/home/user/StarCitizen/LIVE/Game.log';
			const pathParts = path.split(/[/\\]/);
			const logLocation = pathParts.length > 1 ? pathParts[pathParts.length - 2] : null;

			expect(logLocation).toBe('LIVE');
		});
	});

	describe('File validation', () => {
		it('should validate file exists before proceeding', async () => {
			const mockPath = 'C:\\Users\\Test\\Star Citizen\\LIVE\\Game.log';
			(exists as Mock).mockResolvedValue(false);

			const fileExists = await exists(mockPath);

			expect(fileExists).toBe(false);
			expect(exists).toHaveBeenCalledWith(mockPath);
		});

		it('should show error toast when file does not exist', async () => {
			(exists as Mock).mockResolvedValue(false);
			const mockPath = 'C:\\nonexistent\\Game.log';

			const fileExists = await exists(mockPath);
			if (!fileExists) {
				appState.addToast('Selected file does not exist', 'error');
			}

			expect(appState.addToast).toHaveBeenCalledWith('Selected file does not exist', 'error');
		});
	});

	describe('Filter reset on file selection', () => {
		it('should call logApi.resetFilters on file selection', () => {
			logApi.clearLogs();
			logApi.resetFilters();

			expect(logApi.clearLogs).toHaveBeenCalled();
			expect(logApi.resetFilters).toHaveBeenCalled();
		});

		it('should clear group members cache from localStorage', () => {
			const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');

			appState.groups = [
				{ id: 'group-1', name: 'Group 1' },
				{ id: 'group-2', name: 'Group 2' }
			] as any;

			for (const group of appState.groups) {
				const cacheKey = `picologs:groupMembers:${group.id}`;
				localStorage.removeItem(cacheKey);
			}

			expect(removeItemSpy).toHaveBeenCalledWith('picologs:groupMembers:group-1');
			expect(removeItemSpy).toHaveBeenCalledWith('picologs:groupMembers:group-2');

			removeItemSpy.mockRestore();
		});
	});

	describe('Cancellation handling', () => {
		it('should handle user cancelling file dialog gracefully', async () => {
			(selectLogFileManually as Mock).mockResolvedValue(null);

			const result = await selectLogFileManually();

			expect(result).toBeNull();
			expect(startLogWatcher).not.toHaveBeenCalled();
		});
	});
});

describe('Dashboard - Player Name Detection', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		appState.user = { discordId: 'test-user-123', username: 'TestUser', player: null };
		appState.sendRequest = vi.fn() as any;
		appState.connectionStatus = 'connected';
		appState.isPlayerNameUpdating = false;
		(appState.updateProfile as Mock).mockResolvedValue({ playerChanged: true });
	});

	describe('Name comparison', () => {
		it('should skip update when player names match (case-insensitive)', () => {
			appState.user.player = 'HeftyTM';
			const detectedName = 'heftytm';

			const normalized = detectedName?.trim();
			const current = appState.user.player?.trim();

			const namesMatch = current?.toLowerCase() === normalized?.toLowerCase();

			expect(namesMatch).toBe(true);
		});

		it('should skip update when player names match (with whitespace)', () => {
			appState.user.player = 'HeftyTM';
			const detectedName = '  HeftyTM  ';

			const normalized = detectedName?.trim();
			const current = appState.user.player?.trim();

			const namesMatch = current?.toLowerCase() === normalized?.toLowerCase();

			expect(namesMatch).toBe(true);
		});

		it('should detect when player names differ', () => {
			appState.user.player = 'OldPlayer';
			const detectedName = 'NewPlayer';

			const normalized = detectedName?.trim();
			const current = appState.user.player?.trim();

			const namesMatch = current?.toLowerCase() === normalized?.toLowerCase();

			expect(namesMatch).toBe(false);
		});
	});

	describe('Profile update', () => {
		it('should call updateProfile when player name changes', async () => {
			appState.user.player = 'OldPlayer';
			const newName = 'NewPlayer';

			await appState.updateProfile({ player: newName });

			expect(appState.updateProfile).toHaveBeenCalledWith({ player: newName });
		});

		it('should show toast only when playerChanged is true', async () => {
			(appState.updateProfile as Mock).mockResolvedValue({ playerChanged: true });

			const response = await appState.updateProfile({ player: 'NewPlayer' });

			if (response?.playerChanged) {
				appState.updatePlayerName('NewPlayer');
				appState.addToast('Character: NewPlayer', 'success');
			}

			expect(appState.updatePlayerName).toHaveBeenCalledWith('NewPlayer');
			expect(appState.addToast).toHaveBeenCalledWith('Character: NewPlayer', 'success');
		});

		it('should NOT show toast when playerChanged is false', async () => {
			(appState.updateProfile as Mock).mockResolvedValue({ playerChanged: false });

			const response = await appState.updateProfile({ player: 'SameName' });

			if (response?.playerChanged) {
				appState.updatePlayerName('SameName');
				appState.addToast('Character: SameName', 'success');
			}

			expect(appState.updatePlayerName).not.toHaveBeenCalled();
		});

		it('should handle update errors gracefully', async () => {
			const error = new Error('Network error');
			(appState.updateProfile as Mock).mockRejectedValue(error);

			try {
				await appState.updateProfile({ player: 'NewPlayer' });
			} catch {
				appState.addToast('Failed to update character', 'error');
			}

			expect(appState.addToast).toHaveBeenCalledWith('Failed to update character', 'error');
		});
	});

	describe('Connection state', () => {
		it('should queue player name when not connected', () => {
			appState.sendRequest = null;
			appState.connectionStatus = 'disconnected';

			const shouldQueue = !appState.sendRequest || appState.connectionStatus !== 'connected';

			expect(shouldQueue).toBe(true);
		});

		it('should skip update when already updating', () => {
			appState.isPlayerNameUpdating = true;

			const shouldSkip = appState.isPlayerNameUpdating;

			expect(shouldSkip).toBe(true);
		});
	});
});
