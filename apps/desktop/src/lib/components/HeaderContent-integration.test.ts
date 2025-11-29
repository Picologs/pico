/**
 * HeaderContent Integration Tests - Offline Mode
 *
 * Tests the full integration of header bar functionality in offline mode,
 * including Select Log File and Clear Logs operations with file watcher.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/svelte';
import type { Mock } from 'vitest';

// Mock $app/environment (must come first)
vi.mock('$app/environment', () => ({
	browser: true
}));

// Mock @pico/shared
vi.mock('@pico/shared', () => ({
	Avatar: vi.fn(() => ({
		$$: {},
		$set: vi.fn(),
		$on: vi.fn(),
		$destroy: vi.fn()
	})),
	Dialog: vi.fn(() => ({
		$$: {},
		$set: vi.fn(),
		$on: vi.fn(),
		$destroy: vi.fn()
	})),
	DiscordIcon: vi.fn(() => ({
		$$: {},
		$set: vi.fn(),
		$on: vi.fn(),
		$destroy: vi.fn()
	})),
	appState: {
		user: null,
		friendRequests: { incoming: [], outgoing: [] },
		groupInvitations: [],
		logs: [],
		hasLogs: false,
		hasSelectedLog: false,
		logLocation: null,
		connectionStatus: 'disconnected',
		displayName: null,
		selectLogFile: vi.fn(),
		signIn: vi.fn(),
		signOut: vi.fn(),
		navigate: vi.fn(),
		acceptFriendRequest: vi.fn().mockResolvedValue(undefined),
		denyFriendRequest: vi.fn().mockResolvedValue(undefined),
		acceptGroupInvitation: vi.fn().mockResolvedValue(undefined),
		denyGroupInvitation: vi.fn().mockResolvedValue(undefined),
		clearLogs: vi.fn(),
		addToast: vi.fn()
	}
}));

// Mock lucide icons
vi.mock('@lucide/svelte', () => ({
	Copy: vi.fn(() => ({ $$: {}, $set: vi.fn(), $on: vi.fn(), $destroy: vi.fn() })),
	Check: vi.fn(() => ({ $$: {}, $set: vi.fn(), $on: vi.fn(), $destroy: vi.fn() })),
	X: vi.fn(() => ({ $$: {}, $set: vi.fn(), $on: vi.fn(), $destroy: vi.fn() })),
	Loader2: vi.fn(() => ({ $$: {}, $set: vi.fn(), $on: vi.fn(), $destroy: vi.fn() })),
	Bell: vi.fn(() => ({ $$: {}, $set: vi.fn(), $on: vi.fn(), $destroy: vi.fn() })),
	LogOut: vi.fn(() => ({ $$: {}, $set: vi.fn(), $on: vi.fn(), $destroy: vi.fn() })),
	Settings: vi.fn(() => ({ $$: {}, $set: vi.fn(), $on: vi.fn(), $destroy: vi.fn() })),
	Users: vi.fn(() => ({ $$: {}, $set: vi.fn(), $on: vi.fn(), $destroy: vi.fn() })),
	FolderOpen: vi.fn(() => ({ $$: {}, $set: vi.fn(), $on: vi.fn(), $destroy: vi.fn() })),
	ScrollText: vi.fn(() => ({ $$: {}, $set: vi.fn(), $on: vi.fn(), $destroy: vi.fn() })),
	BrushCleaning: vi.fn(() => ({ $$: {}, $set: vi.fn(), $on: vi.fn(), $destroy: vi.fn() }))
}));

// Import HeaderContent after mocks
import HeaderContent from './HeaderContent.svelte';
import { appState } from '@pico/shared';

describe('HeaderContent - Offline Mode Integration', () => {
	let mockAppState: any;

	beforeEach(async () => {
		vi.clearAllMocks();

		// Get the mocked appState instance
		mockAppState = appState;

		// Reset to offline mode state
		Object.assign(mockAppState, {
			user: null,
			friendRequests: { incoming: [], outgoing: [] },
			groupInvitations: [],
			logs: [],
			hasLogs: false,
			hasSelectedLog: false,
			logLocation: null,
			connectionStatus: 'disconnected',
			displayName: null
		});

		// Reset method mocks
		mockAppState.selectLogFile = vi.fn();
		mockAppState.signIn = vi.fn();
		mockAppState.signOut = vi.fn();
		mockAppState.navigate = vi.fn();
		mockAppState.acceptFriendRequest = vi.fn().mockResolvedValue(undefined);
		mockAppState.denyFriendRequest = vi.fn().mockResolvedValue(undefined);
		mockAppState.acceptGroupInvitation = vi.fn().mockResolvedValue(undefined);
		mockAppState.denyGroupInvitation = vi.fn().mockResolvedValue(undefined);
		mockAppState.clearLogs = vi.fn();
		mockAppState.addToast = vi.fn();
	});

	describe('Select Log File Flow - Offline Mode', () => {
		it('should display environment name after file selection', async () => {
			mockAppState.hasSelectedLog = true;
			mockAppState.logLocation = 'LIVE';
			mockAppState.selectLogFile = vi.fn();

			render(HeaderContent);

			expect(screen.getByText('LIVE')).toBeInTheDocument();
		});

		it('should call selectLogFile when button clicked', async () => {
			mockAppState.hasSelectedLog = true;
			mockAppState.logLocation = 'LIVE';
			mockAppState.selectLogFile = vi.fn();

			render(HeaderContent);

			const fileBtn = screen.getByRole('button', { name: /live/i });
			await fireEvent.click(fileBtn);

			expect(mockAppState.selectLogFile).toHaveBeenCalled();
		});

		it('should show Select Log File button when hasSelectedLog is true (offline mode)', () => {
			mockAppState.user = null; // Offline mode - no user
			mockAppState.hasSelectedLog = true;
			mockAppState.logLocation = 'PTU';
			mockAppState.selectLogFile = vi.fn();

			render(HeaderContent);

			expect(screen.getByText('PTU')).toBeInTheDocument();
		});

		it('should NOT show Select Log File button when no user and no file selected', () => {
			mockAppState.user = null;
			mockAppState.hasSelectedLog = false;
			mockAppState.selectLogFile = vi.fn();

			render(HeaderContent);

			const fileBtn = screen.queryByRole('button', { name: /select log file|live|ptu/i });
			expect(fileBtn).not.toBeInTheDocument();
		});
	});

	describe('Clear Logs Flow - Offline Mode', () => {
		it('should show Clear Logs button when logs exist', () => {
			mockAppState.hasLogs = true;
			mockAppState.logs = [
				{ id: '1', line: 'test log 1' },
				{ id: '2', line: 'test log 2' }
			];

			render(HeaderContent);

			const clearBtn = screen.getByRole('button', { name: /clear logs/i });
			expect(clearBtn).toBeInTheDocument();
		});

		it('should hide Clear Logs button when no logs', () => {
			mockAppState.hasLogs = false;
			mockAppState.logs = [];

			render(HeaderContent);

			const clearBtn = screen.queryByRole('button', { name: /clear logs/i });
			expect(clearBtn).not.toBeInTheDocument();
		});

		it('should render with onClearLogs callback for watcher continuation', () => {
			mockAppState.hasLogs = true;
			mockAppState.logs = [{ id: '1' }];

			// The onClearLogs callback is used by +page.svelte to keep watcher active
			const onClearLogs = vi.fn();
			render(HeaderContent, { props: { onClearLogs } });

			const clearBtn = screen.getByRole('button', { name: /clear logs/i });
			expect(clearBtn).toBeInTheDocument();
		});

		it('should render without onClearLogs callback', () => {
			mockAppState.hasLogs = true;
			mockAppState.logs = [{ id: '1' }];

			render(HeaderContent);

			const clearBtn = screen.getByRole('button', { name: /clear logs/i });
			expect(clearBtn).toBeInTheDocument();
		});
	});

	describe('Button Combinations - Offline Mode', () => {
		it('should show both Select Log File and Clear Logs buttons when applicable', () => {
			mockAppState.user = null;
			mockAppState.hasSelectedLog = true;
			mockAppState.logLocation = 'LIVE';
			mockAppState.hasLogs = true;
			mockAppState.logs = [{ id: '1' }];
			mockAppState.selectLogFile = vi.fn();

			render(HeaderContent);

			// Both buttons should be visible
			expect(screen.getByRole('button', { name: /live/i })).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /clear logs/i })).toBeInTheDocument();
		});

		it('should only show Select Log File button when no logs exist', () => {
			mockAppState.user = null;
			mockAppState.hasSelectedLog = true;
			mockAppState.logLocation = 'EPTU';
			mockAppState.hasLogs = false;
			mockAppState.logs = [];
			mockAppState.selectLogFile = vi.fn();

			render(HeaderContent);

			expect(screen.getByRole('button', { name: /eptu/i })).toBeInTheDocument();
			expect(screen.queryByRole('button', { name: /clear logs/i })).not.toBeInTheDocument();
		});

		it('should show Sign In button in offline mode when no file selected', () => {
			mockAppState.user = null;
			mockAppState.hasSelectedLog = false;
			mockAppState.signIn = vi.fn();

			render(HeaderContent);

			expect(screen.getByRole('button', { name: /sign in with discord/i })).toBeInTheDocument();
		});
	});

	describe('Offline Mode Scenarios', () => {
		it('should support HOTFIX environment in offline mode', () => {
			mockAppState.user = null;
			mockAppState.hasSelectedLog = true;
			mockAppState.logLocation = 'HOTFIX';
			mockAppState.selectLogFile = vi.fn();

			render(HeaderContent);

			expect(screen.getByText('HOTFIX')).toBeInTheDocument();
		});

		it('should work when logs exist but watcher not actively monitoring', () => {
			mockAppState.hasLogs = true;
			mockAppState.logs = [
				{ id: '1', line: 'cached log 1' },
				{ id: '2', line: 'cached log 2' }
			];
			mockAppState.hasSelectedLog = false; // File not currently selected
			mockAppState.user = null;

			render(HeaderContent);

			// Clear Logs button should still show (logs exist in appState)
			const clearBtn = screen.getByRole('button', { name: /clear logs/i });
			expect(clearBtn).toBeInTheDocument();

			// Select Log File button should NOT show (no file selected, no user)
			const fileBtn = screen.queryByRole('button', { name: /select log file/i });
			expect(fileBtn).not.toBeInTheDocument();
		});
	});
});
