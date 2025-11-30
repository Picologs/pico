/**
 * Backlog sync module
 *
 * Sends the last 50 logs to friends and groups when the user comes online.
 * This allows friends/groups to see recent activity from before the connection.
 */

import type { Log } from '@pico/types';

/** Maximum number of logs to send as backlog */
export const BACKLOG_LIMIT = 50;

interface BacklogAppState {
	sendRequest: ((type: string, data: unknown) => Promise<unknown>) | null;
	connectionStatus: string;
	groups: Array<{ id: string; name?: string }> | undefined;
}

/**
 * Send backlog logs to friends and all groups
 *
 * @param logs - All stored logs (will take last 50)
 * @param appState - Application state with sendRequest, connectionStatus, and groups
 * @returns Promise that resolves when all sends complete (or fail gracefully)
 */
export async function sendBacklog(logs: Log[], appState: BacklogAppState): Promise<void> {
	// Guard: Check connection and sendRequest availability
	if (!appState.sendRequest || appState.connectionStatus !== 'connected') {
		return;
	}

	// Get last 50 logs (most recent)
	const backlogLogs = logs.slice(-BACKLOG_LIMIT);
	if (backlogLogs.length === 0) {
		return;
	}

	console.log(`[Backlog] Sending ${backlogLogs.length} backlog logs`);

	// Send to friends (best effort - don't let failure block group sends)
	try {
		await appState.sendRequest('send_logs', {
			logs: backlogLogs,
			target: { type: 'friends' }
		});
		console.log('[Backlog] Sent to friends successfully');
	} catch (error) {
		console.error('[Backlog] Failed to send to friends:', error);
		// Continue to groups even if friends send fails
	}

	// Send to each group (best effort per group)
	const groups = appState.groups || [];
	for (const group of groups) {
		try {
			await appState.sendRequest('send_logs', {
				logs: backlogLogs,
				target: { type: 'group', groupId: group.id }
			});
			console.log(`[Backlog] Sent to group ${group.id} successfully`);
		} catch (error) {
			console.error(`[Backlog] Failed to send to group ${group.id}:`, error);
			// Continue to next group
		}
	}

	console.log('[Backlog] Backlog sync complete');
}
