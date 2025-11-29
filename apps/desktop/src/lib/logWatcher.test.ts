/**
 * Log Watcher Auto-Detection Tests
 *
 * Tests the autoDetectGameLog() function which searches for Star Citizen Game.log
 * files in priority order across common installation paths.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

// Mock @pico/shared to avoid SvelteKit dependencies
vi.mock('@pico/shared', () => ({
	dedupeAndSortLogs: vi.fn((logs) => logs),
	applyMemoryLimit: vi.fn((logs) => logs),
	LogBatchManager: vi.fn(),
	MultiTargetBatchManager: vi.fn(),
	LogSyncManager: vi.fn(),
	parseStarCitizenLogLine: vi.fn(),
	parseLogLines: vi.fn(() => []),
	resetParserState: vi.fn(),
	setCurrentPlayer: vi.fn(),
	getCurrentPlayer: vi.fn(),
	flattenGroups: vi.fn((logs) => logs),
	processAllGroupings: vi.fn((logs) => logs)
}));

// Mock Tauri APIs
vi.mock('@tauri-apps/api/path', () => ({
	localDataDir: vi.fn()
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
	exists: vi.fn(),
	readTextFile: vi.fn(),
	watchImmediate: vi.fn()
}));

vi.mock('@tauri-apps/api/event', () => ({
	emit: vi.fn()
}));

vi.mock('$lib/store-manager', () => ({
	getStoreInstance: vi.fn(() =>
		Promise.resolve({
			get: vi.fn(() => Promise.resolve(null)),
			set: vi.fn(() => Promise.resolve()),
			delete: vi.fn(() => Promise.resolve(true)),
			save: vi.fn(() => Promise.resolve())
		})
	)
}));

// Mock debug module - functions defined inside factory to avoid hoisting issues
vi.mock('$lib/debug', () => ({
	debug: {
		log: vi.fn(),
		error: vi.fn(),
		warn: vi.fn()
	}
}));

// Import after mocks are defined
import { localDataDir } from '@tauri-apps/api/path';
import { exists } from '@tauri-apps/plugin-fs';
import { autoDetectGameLog } from './logWatcher';
import { debug } from '$lib/debug';

describe('autoDetectGameLog()', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('Priority 1: LocalAppData Detection', () => {
		// Tests for LocalAppData path detection
		// Windows: C:\Users\{username}\AppData\Local\Star Citizen\{ENV}\Game.log

		it('should find LIVE in LocalAppData', async () => {
			// Mock directory paths
			(localDataDir as Mock).mockResolvedValue('C:\\Users\\TestUser\\AppData\\Local');

			// Mock exists to return true only for LocalAppData LIVE path
			(exists as Mock).mockImplementation(async (path: string) => {
				return path === 'C:\\Users\\TestUser\\AppData\\Local\\Star Citizen\\LIVE\\Game.log';
			});

			const result = await autoDetectGameLog();

			expect(result).toBe('C:\\Users\\TestUser\\AppData\\Local\\Star Citizen\\LIVE\\Game.log');
			expect(exists).toHaveBeenCalledWith(
				'C:\\Users\\TestUser\\AppData\\Local\\Star Citizen\\LIVE\\Game.log'
			);
		});

		it('should log detection to console', async () => {
			// Mock directory paths
			(localDataDir as Mock).mockResolvedValue('C:\\Users\\TestUser\\AppData\\Local');

			// Mock exists to return true only for LocalAppData LIVE path
			(exists as Mock).mockImplementation(async (path: string) => {
				return path === 'C:\\Users\\TestUser\\AppData\\Local\\Star Citizen\\LIVE\\Game.log';
			});

			await autoDetectGameLog();

			expect(debug.log).toHaveBeenCalledWith(
				'[AutoDetect] Found at LocalAppData:',
				'C:\\Users\\TestUser\\AppData\\Local\\Star Citizen\\LIVE\\Game.log'
			);
		});
	});

	describe('Priority 2: Program Files Detection', () => {
		// Tests for Program Files path detection
		// Example: D:\Program Files\Roberts Space Industries\StarCitizen\{ENV}\Game.log

		it('should find LIVE on C: drive in Program Files', async () => {
			// Mock directory paths
			(localDataDir as Mock).mockResolvedValue('C:\\Users\\TestUser\\AppData\\Local');

			// Mock exists to return false for LocalAppData and Home paths, true for C: Program Files
			(exists as Mock).mockImplementation(async (path: string) => {
				// Return true only for C: drive Program Files LIVE path
				return path === 'C:\\Program Files\\Roberts Space Industries\\StarCitizen\\LIVE\\Game.log';
			});

			const result = await autoDetectGameLog();

			expect(result).toBe(
				'C:\\Program Files\\Roberts Space Industries\\StarCitizen\\LIVE\\Game.log'
			);
			expect(exists).toHaveBeenCalledWith(
				'C:\\Program Files\\Roberts Space Industries\\StarCitizen\\LIVE\\Game.log'
			);
		});

		it('should find LIVE on D: drive for custom installation', async () => {
			// Mock directory paths
			(localDataDir as Mock).mockResolvedValue('C:\\Users\\TestUser\\AppData\\Local');

			// Mock exists to return false for all paths except D: drive LIVE
			(exists as Mock).mockImplementation(async (path: string) => {
				// Return true only for D: drive LIVE path
				return path === 'D:\\Program Files\\Roberts Space Industries\\StarCitizen\\LIVE\\Game.log';
			});

			const result = await autoDetectGameLog();

			expect(result).toBe(
				'D:\\Program Files\\Roberts Space Industries\\StarCitizen\\LIVE\\Game.log'
			);
			expect(exists).toHaveBeenCalledWith(
				'D:\\Program Files\\Roberts Space Industries\\StarCitizen\\LIVE\\Game.log'
			);
		});

		it('should log Program Files detection', async () => {
			// Mock directory paths
			(localDataDir as Mock).mockResolvedValue('C:\\Users\\TestUser\\AppData\\Local');

			// Mock exists to return false for LocalAppData and Home paths, true for C: Program Files
			(exists as Mock).mockImplementation(async (path: string) => {
				// Return true only for C: drive Program Files LIVE path
				return path === 'C:\\Program Files\\Roberts Space Industries\\StarCitizen\\LIVE\\Game.log';
			});

			await autoDetectGameLog();

			// Verify debug.log was called with correct message
			expect(debug.log).toHaveBeenCalledWith(
				'[AutoDetect] Found at Program Files:',
				'C:\\Program Files\\Roberts Space Industries\\StarCitizen\\LIVE\\Game.log'
			);
		});
	});
});
