/**
 * Singleton Store Manager for Tauri plugin-store
 *
 * Ensures only one Store instance exists per file path to prevent
 * "options will be ignored if a Store with that path has already been created" issue
 * from Tauri plugin-store documentation.
 *
 * Reference: https://v2.tauri.app/plugin/store/
 */

import { Store } from '@tauri-apps/plugin-store';
import { debug } from '$lib/debug';

/**
 * Cache of Store initialization promises by file path
 * Caching the Promise (not the result) prevents race conditions when
 * multiple concurrent calls happen before the first one completes
 */
const storePromiseCache = new Map<string, Promise<Store>>();

/**
 * Get or create a Store instance for the given file path
 *
 * Uses singleton pattern to ensure only one Store instance per file.
 * This prevents issues with Tauri's "already created" behavior.
 *
 * @param filePath - Store file name (e.g., 'settings.json')
 * @param options - Store options (only used on first creation)
 * @returns Store instance (cached or newly created)
 *
 * @example
 * const store = await getStoreInstance('settings.json');
 * await store.set('key', 'value');
 * await store.save();
 */
export async function getStoreInstance(
	filePath: string,
	options?: { autoSave?: boolean | number }
): Promise<Store> {
	// Return cached promise if exists (prevents race condition)
	if (storePromiseCache.has(filePath)) {
		debug.log(`[StoreManager] Using cached Store instance for: ${filePath}`);
		return storePromiseCache.get(filePath)!;
	}

	// Create new instance with auto-save enabled by default (100ms debounce)
	const defaultOptions = { defaults: {}, autoSave: 100 as const };
	const finalOptions = { ...defaultOptions, ...options };

	debug.log(`[StoreManager] Creating new Store instance for: ${filePath}`, finalOptions);

	// Cache the promise immediately (before await) to prevent race conditions
	const storePromise = Store.load(filePath, finalOptions).then((store) => {
		debug.log(`[StoreManager] Store instance created successfully for: ${filePath}`);
		return store;
	});

	storePromiseCache.set(filePath, storePromise);

	return storePromise;
}

/**
 * Clear a Store instance from cache
 *
 * Use this if you need to force recreation of a Store instance.
 * Generally not needed unless testing or troubleshooting.
 *
 * @param filePath - Store file name to clear from cache
 * @returns True if store was in cache, false otherwise
 *
 * @example
 * clearStoreCache('settings.json');
 * const freshStore = await getStoreInstance('settings.json');
 */
export function clearStoreCache(filePath: string): boolean {
	if (storePromiseCache.has(filePath)) {
		debug.log(`[StoreManager] Clearing cached Store instance for: ${filePath}`);
		storePromiseCache.delete(filePath);
		return true;
	}
	return false;
}

/**
 * Clear all Store instances from cache
 *
 * Use this if you need to reset all stores.
 * Generally not needed unless testing or troubleshooting.
 *
 * @example
 * clearAllStores();
 */
export function clearAllStores(): void {
	debug.log(`[StoreManager] Clearing all cached Store instances (${storePromiseCache.size} total)`);
	storePromiseCache.clear();
}

/**
 * Get list of all cached store file paths
 *
 * Useful for debugging to see which stores are currently loaded.
 *
 * @returns Array of store file paths
 *
 * @example
 * const stores = getCachedStores();
 * console.log('Loaded stores:', stores);
 */
export function getCachedStores(): string[] {
	return Array.from(storePromiseCache.keys());
}
