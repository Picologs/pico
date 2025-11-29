/**
 * Debug logging utility
 *
 * Logs are only output when DEBUG mode is enabled.
 * In production, these calls are no-ops.
 */

// Enable debug mode in development or when explicitly set
export const DEBUG = import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true';

/**
 * Debug logger that only outputs in development mode
 */
export const debug = {
	log: (prefix: string, ...args: unknown[]) => {
		if (DEBUG) console.log(prefix, ...args);
	},
	warn: (prefix: string, ...args: unknown[]) => {
		if (DEBUG) console.warn(prefix, ...args);
	},
	error: (prefix: string, ...args: unknown[]) => {
		// Errors always log
		console.error(prefix, ...args);
	}
};
