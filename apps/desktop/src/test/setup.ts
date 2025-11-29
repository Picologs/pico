/**
 * Vitest global setup file
 * Configures test environment and provides shared Tauri API mocks
 */

import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Tauri core API
vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn().mockResolvedValue(undefined)
}));

// Mock Tauri store plugin
vi.mock('@tauri-apps/plugin-store', () => {
	const mockStore = {
		get: vi.fn().mockResolvedValue(undefined),
		set: vi.fn().mockResolvedValue(undefined),
		delete: vi.fn().mockResolvedValue(undefined),
		clear: vi.fn().mockResolvedValue(undefined),
		save: vi.fn().mockResolvedValue(undefined),
		keys: vi.fn().mockResolvedValue([]),
		values: vi.fn().mockResolvedValue([]),
		entries: vi.fn().mockResolvedValue([]),
		length: vi.fn().mockResolvedValue(0),
		has: vi.fn().mockResolvedValue(false),
		onKeyChange: vi.fn().mockReturnValue(vi.fn()),
		onChange: vi.fn().mockReturnValue(vi.fn()),
		close: vi.fn().mockResolvedValue(undefined)
	};
	return {
		Store: {
			load: vi.fn().mockResolvedValue(mockStore)
		},
		LazyStore: vi.fn().mockImplementation(() => mockStore)
	};
});

// Mock Tauri updater plugin
vi.mock('@tauri-apps/plugin-updater', () => ({
	check: vi.fn().mockResolvedValue(null)
}));

// Mock Tauri process plugin
vi.mock('@tauri-apps/plugin-process', () => ({
	relaunch: vi.fn().mockResolvedValue(undefined)
}));

// Mock $app/environment for SvelteKit
// Set dev: false to simulate production mode for tests
vi.mock('$app/environment', () => ({
	dev: false,
	browser: true,
	building: false
}));

// Mock $app/navigation for SvelteKit
vi.mock('$app/navigation', () => ({
	goto: vi.fn().mockResolvedValue(undefined),
	invalidate: vi.fn().mockResolvedValue(undefined),
	invalidateAll: vi.fn().mockResolvedValue(undefined),
	preloadData: vi.fn().mockResolvedValue(undefined),
	preloadCode: vi.fn().mockResolvedValue(undefined),
	beforeNavigate: vi.fn(),
	afterNavigate: vi.fn(),
	onNavigate: vi.fn(),
	pushState: vi.fn(),
	replaceState: vi.fn()
}));

// Mock $app/stores for SvelteKit
vi.mock('$app/stores', () => ({
	page: {
		subscribe: vi.fn((fn: (value: unknown) => void) => {
			fn({ url: new URL('http://localhost/dashboard'), params: {} });
			return () => {};
		})
	},
	navigating: {
		subscribe: vi.fn((fn: (value: unknown) => void) => {
			fn(null);
			return () => {};
		})
	},
	updated: {
		subscribe: vi.fn((fn: (value: unknown) => void) => {
			fn(false);
			return () => {};
		}),
		check: vi.fn().mockResolvedValue(false)
	}
}));

// Mock Tauri fs plugin
vi.mock('@tauri-apps/plugin-fs', () => ({
	exists: vi.fn().mockResolvedValue(false),
	readTextFile: vi.fn().mockResolvedValue(''),
	writeTextFile: vi.fn().mockResolvedValue(undefined),
	watchImmediate: vi.fn().mockResolvedValue(vi.fn()),
	mkdir: vi.fn().mockResolvedValue(undefined),
	remove: vi.fn().mockResolvedValue(undefined),
	readDir: vi.fn().mockResolvedValue([])
}));

// Mock Tauri dialog plugin
vi.mock('@tauri-apps/plugin-dialog', () => ({
	open: vi.fn().mockResolvedValue(null),
	save: vi.fn().mockResolvedValue(null),
	message: vi.fn().mockResolvedValue(undefined),
	ask: vi.fn().mockResolvedValue(false),
	confirm: vi.fn().mockResolvedValue(false)
}));

// Mock Tauri path API
vi.mock('@tauri-apps/api/path', () => ({
	localDataDir: vi.fn().mockResolvedValue('C:\\Users\\TestUser\\AppData\\Local'),
	appDataDir: vi.fn().mockResolvedValue('C:\\Users\\TestUser\\AppData\\Roaming'),
	homeDir: vi.fn().mockResolvedValue('C:\\Users\\TestUser'),
	join: vi.fn((...parts: string[]) => parts.join('\\')),
	sep: '\\'
}));

// Mock Tauri event API
vi.mock('@tauri-apps/api/event', () => ({
	emit: vi.fn().mockResolvedValue(undefined),
	listen: vi.fn().mockResolvedValue(vi.fn()),
	once: vi.fn().mockResolvedValue(vi.fn())
}));

// Mock Tauri webviewWindow API
vi.mock('@tauri-apps/api/webviewWindow', () => ({
	getCurrentWebviewWindow: vi.fn(() => ({
		label: 'main',
		show: vi.fn().mockResolvedValue(undefined),
		hide: vi.fn().mockResolvedValue(undefined),
		close: vi.fn().mockResolvedValue(undefined),
		toggleMaximize: vi.fn().mockResolvedValue(undefined),
		minimize: vi.fn().mockResolvedValue(undefined),
		maximize: vi.fn().mockResolvedValue(undefined),
		unmaximize: vi.fn().mockResolvedValue(undefined),
		isMaximized: vi.fn().mockResolvedValue(false),
		setFocus: vi.fn().mockResolvedValue(undefined)
	}))
}));

// Mock Tauri deep-link plugin
vi.mock('@tauri-apps/plugin-deep-link', () => ({
	onOpenUrl: vi.fn()
}));

// Mock Tauri opener plugin
vi.mock('@tauri-apps/plugin-opener', () => ({
	openUrl: vi.fn().mockResolvedValue(undefined)
}));

// Mock Tauri app API
vi.mock('@tauri-apps/api/app', () => ({
	getVersion: vi.fn().mockResolvedValue('0.0.0-test'),
	getName: vi.fn().mockResolvedValue('picologs-test'),
	getTauriVersion: vi.fn().mockResolvedValue('2.0.0')
}));

// Mock @pico/shared - comprehensive mock for all exports used
vi.mock('@pico/shared', async (importOriginal) => {
	const actual = (await importOriginal()) as Record<string, unknown>;
	return {
		...actual,
		appState: {
			token: null,
			user: null,
			friends: [],
			groups: [],
			notifications: [],
			friendRequests: { incoming: [], outgoing: [] },
			logs: [],
			connectionStatus: 'disconnected',
			setUser: vi.fn(),
			addToast: vi.fn(),
			registerSignOut: vi.fn(),
			registerSelectLogFile: vi.fn(),
			registerResetWatcher: vi.fn()
		},
		destroyPatternCache: vi.fn(),
		dedupeAndSortLogs: vi.fn((logs: unknown[]) => logs),
		applyMemoryLimit: vi.fn((logs: unknown[]) => logs),
		flattenGroups: vi.fn((logs: unknown[]) => logs),
		processAllGroupings: vi.fn((logs: unknown[]) => logs),
		parseLogLines: vi.fn(() => []),
		resetParserState: vi.fn(),
		setCurrentPlayer: vi.fn(),
		getCurrentPlayer: vi.fn(),
		LogBatchManager: vi.fn(),
		MultiTargetBatchManager: vi.fn(),
		LogSyncManager: vi.fn(),
		DashboardPage: vi.fn(() => null),
		formatMissionObjectiveState: (state: string) => state.toLowerCase().replace(/_/g, ' ')
	};
});

// Global test utilities
export const resetMocks = () => {
	vi.clearAllMocks();
};
