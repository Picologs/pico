/**
 * Tests for admin settings page - signups toggle
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database with vi.hoisted for proper hoisting
const { mockDb, mockSchema } = vi.hoisted(() => ({
	mockDb: {
		select: vi.fn(),
		insert: vi.fn()
	},
	mockSchema: {
		adminSettings: { key: 'key', value: 'value', updatedAt: 'updatedAt', updatedBy: 'updatedBy' },
		adminAuditLog: { action: 'action', adminUserId: 'adminUserId', metadata: 'metadata' },
		users: { id: 'id', discordId: 'discordId' }
	}
}));

vi.mock('$lib/db', () => ({
	db: mockDb,
	schema: mockSchema
}));

vi.mock('@sveltejs/kit', () => ({
	fail: vi.fn((status: number, data: Record<string, unknown>) => ({
		status,
		data,
		type: 'failure' as const
	}))
}));

// Import after mocking
import { load, actions } from './+page.server';
import { fail } from '@sveltejs/kit';

// Helper to create mock select chain
function createMockSelectChain(result: unknown[]) {
	return {
		from: vi.fn(() => ({
			where: vi.fn(() => ({
				limit: vi.fn(() => Promise.resolve(result))
			}))
		}))
	};
}

// Helper to create mock insert chain
function createMockInsertChain() {
	return {
		values: vi.fn(() => ({
			onConflictDoUpdate: vi.fn(() => Promise.resolve())
		}))
	};
}

describe('Admin Settings Page', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('load', () => {
		it('should return systemInfo and signupsEnabled true when setting is true', async () => {
			mockDb.select.mockReturnValue(
				createMockSelectChain([{ key: 'signups_enabled', value: true }])
			);

			const result = await load({
				locals: { user: { discordId: '123', role: 'admin' } }
			} as never);

			expect(result).toBeDefined();
			expect(result!.signupsEnabled).toBe(true);
			expect(result!.systemInfo).toBeDefined();
			expect(result!.systemInfo.nodeVersion).toBeDefined();
		});

		it('should return signupsEnabled true when setting is string "true"', async () => {
			mockDb.select.mockReturnValue(
				createMockSelectChain([{ key: 'signups_enabled', value: 'true' }])
			);

			const result = await load({
				locals: { user: { discordId: '123', role: 'admin' } }
			} as never);

			expect(result).toBeDefined();
			expect(result!.signupsEnabled).toBe(true);
		});

		it('should return signupsEnabled false when setting is false', async () => {
			mockDb.select.mockReturnValue(
				createMockSelectChain([{ key: 'signups_enabled', value: false }])
			);

			const result = await load({
				locals: { user: { discordId: '123', role: 'admin' } }
			} as never);

			expect(result).toBeDefined();
			expect(result!.signupsEnabled).toBe(false);
		});

		it('should default signupsEnabled to true when setting does not exist', async () => {
			mockDb.select.mockReturnValue(createMockSelectChain([]));

			const result = await load({
				locals: { user: { discordId: '123', role: 'admin' } }
			} as never);

			expect(result).toBeDefined();
			expect(result!.signupsEnabled).toBe(true);
		});
	});

	describe('actions.toggleSignups', () => {
		it('should return 403 for non-admin users', async () => {
			const formData = new FormData();
			formData.set('enabled', 'false');

			await actions.toggleSignups({
				request: { formData: () => Promise.resolve(formData) },
				locals: { user: { discordId: '123', role: 'user' } }
			} as never);

			expect(fail).toHaveBeenCalledWith(403, { error: 'Unauthorized' });
		});

		it('should return 403 when user is null', async () => {
			const formData = new FormData();
			formData.set('enabled', 'false');

			await actions.toggleSignups({
				request: { formData: () => Promise.resolve(formData) },
				locals: { user: null }
			} as never);

			expect(fail).toHaveBeenCalledWith(403, { error: 'Unauthorized' });
		});

		it('should return 400 when admin user not found in database', async () => {
			const formData = new FormData();
			formData.set('enabled', 'false');

			mockDb.select.mockReturnValue(createMockSelectChain([]));

			await actions.toggleSignups({
				request: { formData: () => Promise.resolve(formData) },
				locals: { user: { discordId: '123', role: 'admin' } }
			} as never);

			expect(fail).toHaveBeenCalledWith(400, { error: 'User not found' });
		});

		it('should successfully toggle signups to disabled', async () => {
			const formData = new FormData();
			formData.set('enabled', 'false');

			mockDb.select.mockReturnValue(
				createMockSelectChain([{ id: 'admin-uuid-123' }])
			);
			mockDb.insert.mockReturnValue(createMockInsertChain());

			const result = await actions.toggleSignups({
				request: { formData: () => Promise.resolve(formData) },
				locals: { user: { discordId: '123', role: 'admin' } }
			} as never);

			expect(result).toEqual({ success: true, signupsEnabled: false });
			expect(mockDb.insert).toHaveBeenCalledTimes(2); // adminSettings upsert + audit log
		});

		it('should successfully toggle signups to enabled', async () => {
			const formData = new FormData();
			formData.set('enabled', 'true');

			mockDb.select.mockReturnValue(
				createMockSelectChain([{ id: 'admin-uuid-123' }])
			);
			mockDb.insert.mockReturnValue(createMockInsertChain());

			const result = await actions.toggleSignups({
				request: { formData: () => Promise.resolve(formData) },
				locals: { user: { discordId: '123', role: 'admin' } }
			} as never);

			expect(result).toEqual({ success: true, signupsEnabled: true });
		});
	});
});
