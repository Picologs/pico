/**
 * Test helper functions for splash screen tests
 */

import { vi, type Mock } from 'vitest';

/**
 * Update download event types matching Tauri's API
 */
export type DownloadEvent =
	| { event: 'Started'; data: { contentLength?: number } }
	| { event: 'Progress'; data: { chunkLength: number } }
	| { event: 'Finished' };

/**
 * Mock update object matching Tauri updater API
 */
export interface MockUpdate {
	version: string;
	currentVersion: string;
	date?: string;
	body?: string;
	downloadAndInstall: Mock<(onEvent: (event: DownloadEvent) => void) => Promise<void>>;
	close?: Mock<() => Promise<void>>;
}

/**
 * Creates a mock update object for testing
 * @param version - Version string for the update (e.g., '0.14.0')
 * @param currentVersion - Current app version (e.g., '0.13.20')
 * @param simulateProgress - Whether to simulate download progress events
 * @returns Mock update object
 */
export function createMockUpdate(
	version: string,
	currentVersion: string = '0.13.20',
	simulateProgress: boolean = true
): MockUpdate {
	const downloadAndInstall = vi.fn(async (onEvent: (event: DownloadEvent) => void) => {
		if (simulateProgress) {
			// Simulate download progress
			onEvent({ event: 'Started', data: { contentLength: 5242880 } }); // 5 MB

			// Simulate chunks
			await new Promise((resolve) => setTimeout(resolve, 10));
			onEvent({ event: 'Progress', data: { chunkLength: 1048576 } }); // 1 MB

			await new Promise((resolve) => setTimeout(resolve, 10));
			onEvent({ event: 'Progress', data: { chunkLength: 2097152 } }); // 2 MB

			await new Promise((resolve) => setTimeout(resolve, 10));
			onEvent({ event: 'Progress', data: { chunkLength: 2097152 } }); // 2 MB

			await new Promise((resolve) => setTimeout(resolve, 10));
			onEvent({ event: 'Finished' });
		} else {
			// Just finish immediately
			onEvent({ event: 'Started', data: {} });
			onEvent({ event: 'Finished' });
		}
	});

	return {
		version,
		currentVersion,
		date: '2025-01-19T12:00:00Z',
		body: 'Test update',
		downloadAndInstall,
		close: vi.fn().mockResolvedValue(undefined)
	};
}

/**
 * Simulates a failed update check
 * @param errorMessage - Error message to throw
 */
export function createFailedUpdateCheck(errorMessage: string = 'Network error') {
	return vi.fn().mockRejectedValue(new Error(errorMessage));
}

/**
 * Simulates a failed download
 * @param errorMessage - Error message to throw
 */
export function createFailedDownload(errorMessage: string = 'Download failed') {
	const downloadAndInstall = vi.fn().mockRejectedValue(new Error(errorMessage));

	return {
		version: '0.14.0',
		currentVersion: '0.13.20',
		downloadAndInstall,
		close: vi.fn().mockResolvedValue(undefined)
	};
}

/**
 * Mock import.meta.env for testing different modes
 * @param isDev - Whether to mock development mode
 */
export function mockImportMetaEnv(isDev: boolean) {
	Object.defineProperty(import.meta, 'env', {
		value: {
			DEV: isDev,
			PROD: !isDev,
			MODE: isDev ? 'development' : 'production'
		},
		writable: true,
		configurable: true
	});
}

/**
 * Waits for all pending promises and timers
 */
export async function flushPromises() {
	return new Promise((resolve) => setTimeout(resolve, 0));
}
