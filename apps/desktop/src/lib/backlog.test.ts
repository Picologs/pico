import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendBacklog, BACKLOG_LIMIT } from './backlog';
import type { Log } from '@pico/types';

/**
 * Create test logs with incremental IDs
 */
function createTestLogs(count: number): Log[] {
	const baseTime = new Date('2025-01-01T00:00:00Z');
	return Array.from({ length: count }, (_, i) => ({
		id: `log-${i}`,
		userId: 'user-123',
		player: 'TestPlayer',
		reportedBy: ['TestPlayer'],
		emoji: '📝',
		line: `Test log line ${i}`,
		timestamp: new Date(baseTime.getTime() + i * 1000).toISOString(),
		original: `Original log line ${i}`,
		open: false
	}));
}

describe('Backlog Sync', () => {
	let mockSendRequest: ReturnType<typeof vi.fn>;
	let mockAppState: {
		sendRequest: ReturnType<typeof vi.fn> | null;
		connectionStatus: string;
		groups: Array<{ id: string; name: string }> | undefined;
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockSendRequest = vi.fn().mockResolvedValue({ success: true });
		mockAppState = {
			sendRequest: mockSendRequest,
			connectionStatus: 'connected',
			groups: [
				{ id: 'group-1', name: 'Test Group 1' },
				{ id: 'group-2', name: 'Test Group 2' }
			]
		};
	});

	describe('sendBacklog', () => {
		it('should send last 50 logs to friends', async () => {
			const logs = createTestLogs(100);

			await sendBacklog(logs, mockAppState);

			expect(mockSendRequest).toHaveBeenCalledWith('send_logs', {
				logs: expect.arrayContaining([expect.objectContaining({ id: expect.any(String) })]),
				target: { type: 'friends' }
			});

			// Verify only last 50 logs sent
			const sentLogs = mockSendRequest.mock.calls[0][1].logs;
			expect(sentLogs).toHaveLength(BACKLOG_LIMIT);
		});

		it('should send logs to each group', async () => {
			const logs = createTestLogs(10);

			await sendBacklog(logs, mockAppState);

			// Friends + 2 groups = 3 calls
			expect(mockSendRequest).toHaveBeenCalledTimes(3);

			// Verify group calls
			expect(mockSendRequest).toHaveBeenCalledWith('send_logs', {
				logs: expect.any(Array),
				target: { type: 'group', groupId: 'group-1' }
			});
			expect(mockSendRequest).toHaveBeenCalledWith('send_logs', {
				logs: expect.any(Array),
				target: { type: 'group', groupId: 'group-2' }
			});
		});

		it('should not send if no logs available', async () => {
			await sendBacklog([], mockAppState);

			expect(mockSendRequest).not.toHaveBeenCalled();
		});

		it('should not send if disconnected', async () => {
			mockAppState.connectionStatus = 'disconnected';
			const logs = createTestLogs(10);

			await sendBacklog(logs, mockAppState);

			expect(mockSendRequest).not.toHaveBeenCalled();
		});

		it('should not send if sendRequest is unavailable', async () => {
			mockAppState.sendRequest = null;
			const logs = createTestLogs(10);

			await sendBacklog(logs, mockAppState);

			// Should not throw, just return early
			expect(mockSendRequest).not.toHaveBeenCalled();
		});

		it('should handle send failure gracefully', async () => {
			mockSendRequest.mockRejectedValue(new Error('Network error'));
			const logs = createTestLogs(10);

			// Should not throw
			await expect(sendBacklog(logs, mockAppState)).resolves.not.toThrow();
		});

		it('should continue sending to groups if friends send fails', async () => {
			mockSendRequest
				.mockRejectedValueOnce(new Error('Friends failed'))
				.mockResolvedValue({ success: true });

			const logs = createTestLogs(10);

			await sendBacklog(logs, mockAppState);

			// Should still attempt group sends (friends + 2 groups = 3 calls)
			expect(mockSendRequest).toHaveBeenCalledTimes(3);
		});

		it('should send all logs if fewer than 50', async () => {
			const logs = createTestLogs(25);

			await sendBacklog(logs, mockAppState);

			const sentLogs = mockSendRequest.mock.calls[0][1].logs;
			expect(sentLogs).toHaveLength(25);
		});

		it('should send most recent logs (last 50)', async () => {
			const logs = createTestLogs(100);
			// Logs are indexed 0-99, we want 50-99 (last 50)

			await sendBacklog(logs, mockAppState);

			const sentLogs = mockSendRequest.mock.calls[0][1].logs;
			// Verify these are the most recent (last) logs
			expect(sentLogs[0].id).toBe(logs[50].id);
			expect(sentLogs[49].id).toBe(logs[99].id);
		});

		it('should handle empty groups array', async () => {
			mockAppState.groups = [];
			const logs = createTestLogs(10);

			await sendBacklog(logs, mockAppState);

			// Only friends call
			expect(mockSendRequest).toHaveBeenCalledTimes(1);
			expect(mockSendRequest).toHaveBeenCalledWith('send_logs', {
				logs: expect.any(Array),
				target: { type: 'friends' }
			});
		});

		it('should handle undefined groups', async () => {
			mockAppState.groups = undefined;
			const logs = createTestLogs(10);

			await sendBacklog(logs, mockAppState);

			// Only friends call, no error
			expect(mockSendRequest).toHaveBeenCalledTimes(1);
		});

		it('should continue to next group if one group send fails', async () => {
			mockSendRequest
				.mockResolvedValueOnce({ success: true }) // friends
				.mockRejectedValueOnce(new Error('Group 1 failed')) // group-1
				.mockResolvedValueOnce({ success: true }); // group-2

			const logs = createTestLogs(10);

			await sendBacklog(logs, mockAppState);

			// All 3 calls should be attempted
			expect(mockSendRequest).toHaveBeenCalledTimes(3);

			// Verify group-2 was still called after group-1 failed
			expect(mockSendRequest).toHaveBeenNthCalledWith(3, 'send_logs', {
				logs: expect.any(Array),
				target: { type: 'group', groupId: 'group-2' }
			});
		});
	});
});
