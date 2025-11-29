/**
 * Storage wrapper for Tauri's plugin-store
 *
 * Provides a simple key-value storage API backed by JSON files
 * in the app's data directory.
 *
 * Uses singleton store manager to ensure only one Store instance
 * per file path, preventing Tauri's "already created" issues.
 */

import { getStoreInstance } from '$lib/store-manager';

/**
 * Get a value from a Tauri store
 *
 * @param storeFile - The name of the store file (e.g., 'settings.json')
 * @param key - The key to retrieve
 * @returns The stored value, or null if not found
 *
 * @example
 * const token = await getStorageValue('auth.json', 'jwt_token');
 */
export async function getStorageValue<T>(storeFile: string, key: string): Promise<T | null> {
	try {
		const store = await getStoreInstance(storeFile);
		const value = await store.get<T>(key);

		return value ?? null;
	} catch (error) {
		console.error(`Failed to get storage value from ${storeFile}[${key}]:`, error);
		return null;
	}
}

/**
 * Set a value in a Tauri store
 *
 * @param storeFile - The name of the store file (e.g., 'settings.json')
 * @param key - The key to set
 * @param value - The value to store (must be JSON-serializable)
 * @returns True if successful, false otherwise
 *
 * @example
 * await setStorageValue('auth.json', 'jwt_token', 'eyJhbGc...');
 */
export async function setStorageValue<T>(
	storeFile: string,
	key: string,
	value: T
): Promise<boolean> {
	try {
		const store = await getStoreInstance(storeFile);
		await store.set(key, value);
		// In Tauri v2, store.set() auto-saves with 100ms debounce

		return true;
	} catch (error) {
		console.error(`Failed to set storage value in ${storeFile}[${key}]:`, error);
		return false;
	}
}

/**
 * Delete a value from a Tauri store
 *
 * @param storeFile - The name of the store file (e.g., 'settings.json')
 * @param key - The key to delete
 * @returns True if successful, false otherwise
 *
 * @example
 * await deleteStorageValue('auth.json', 'jwt_token');
 */
export async function deleteStorageValue(storeFile: string, key: string): Promise<boolean> {
	try {
		const store = await getStoreInstance(storeFile);
		const deleted = await store.delete(key);
		// In Tauri v2, store.delete() auto-saves with 100ms debounce

		return deleted;
	} catch (error) {
		console.error(`Failed to delete storage value from ${storeFile}[${key}]:`, error);
		return false;
	}
}

/**
 * Get all keys from a Tauri store
 *
 * @param storeFile - The name of the store file (e.g., 'settings.json')
 * @returns Array of keys, or empty array if store doesn't exist
 *
 * @example
 * const keys = await getStorageKeys('settings.json');
 */
export async function getStorageKeys(storeFile: string): Promise<string[]> {
	try {
		const store = await getStoreInstance(storeFile);
		return await store.keys();
	} catch (error) {
		console.error(`Failed to get storage keys from ${storeFile}:`, error);
		return [];
	}
}

/**
 * Clear all values from a Tauri store
 *
 * @param storeFile - The name of the store file (e.g., 'settings.json')
 * @returns True if successful, false otherwise
 *
 * @example
 * await clearStorage('auth.json');
 */
export async function clearStorage(storeFile: string): Promise<boolean> {
	try {
		const store = await getStoreInstance(storeFile);
		await store.clear();
		// In Tauri v2, store.clear() auto-saves with 100ms debounce

		return true;
	} catch (error) {
		console.error(`Failed to clear storage in ${storeFile}:`, error);
		return false;
	}
}
