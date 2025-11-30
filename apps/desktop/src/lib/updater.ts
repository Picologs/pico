/**
 * Auto-Update Handler for Tauri Desktop App
 *
 * Checks for app updates using tauri-plugin-updater.
 * Downloads and installs updates in the background.
 *
 * @see https://v2.tauri.app/plugin/updater/
 */

import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export interface UpdateCheckResult {
	available: boolean;
	version?: string;
	currentVersion?: string;
	update?: Update;
}

export interface DownloadProgress {
	downloaded: number;
	contentLength: number;
	percentage: number;
}

/**
 * Check for updates
 * Returns update information if available
 */
export async function checkForUpdates(): Promise<UpdateCheckResult> {
	console.log('[Updater] Checking for updates...');

	try {
		const update = await check();

		if (update) {
			console.log(`[Updater] Update available: ${update.version}`);
			return {
				available: true,
				version: update.version,
				currentVersion: update.currentVersion,
				update
			};
		} else {
			console.log('[Updater] No updates available');
			return { available: false };
		}
	} catch (error) {
		console.error('[Updater] Failed to check for updates:', error);
		throw error;
	}
}

/**
 * Download and install update with progress tracking
 * @param update The update object from checkForUpdates
 * @param onProgress Optional callback for download progress
 */
export async function downloadAndInstallUpdate(
	update: Update,
	onProgress?: (progress: DownloadProgress) => void
): Promise<void> {
	console.log('[Updater] Downloading and installing update...');

	let totalDownloaded = 0;

	try {
		await update.downloadAndInstall((event) => {
			if (event.event === 'Started') {
				console.log('[Updater] Download started');
				totalDownloaded = 0;
			} else if (event.event === 'Progress') {
				const chunkLength = event.data.chunkLength || 0;
				totalDownloaded += chunkLength;
				// Note: contentLength is not available, so we can't calculate exact percentage
				// We'll just report bytes downloaded
				console.log(`[Updater] Downloaded: ${(totalDownloaded / 1024 / 1024).toFixed(2)} MB`);

				if (onProgress) {
					onProgress({
						downloaded: totalDownloaded,
						contentLength: 0, // Not available from Tauri updater API
						percentage: 0 // Can't calculate without total size
					});
				}
			} else if (event.event === 'Finished') {
				console.log('[Updater] Download finished');
			}
		});

		console.log('[Updater] Update installed successfully');
	} catch (error) {
		console.error('[Updater] Failed to download/install update:', error);
		throw error;
	}
}

/**
 * Relaunch app after update installation
 * Note: On Windows, the app will automatically exit during installation
 */
export async function relaunchApp(): Promise<void> {
	console.log('[Updater] Relaunching app...');
	try {
		await relaunch();
	} catch (error) {
		console.error('[Updater] Failed to relaunch:', error);
		throw error;
	}
}
