/**
 * Tests for admin users page - block/unblock functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database with vi.hoisted for proper hoisting
const { mockDb, mockSchema } = vi.hoisted(() => ({
	mockDb: {
		select: vi.fn(),
		insert: vi.fn(),
		update: vi.fn()
	},
	mockSchema: {
		users: {
			id: 'id',
			discordId: 'discordId',
			username: 'username',
			avatar: 'avatar',
			player: 'player',
			role: 'role',
			betaTester: 'betaTester',
			friendCode: 'friendCode',
			createdAt: 'createdAt',
			blockedAt: 'blockedAt',
			blockedBy: 'blockedBy',
			blockReason: 'blockReason'
		},
		adminAuditLog: {
			action: 'action',
			targetUserId: 'targetUserId',
			adminUserId: 'adminUserId',
			metadata: 'metadata'
		}
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

// Test data helpers
function createMockUser(overrides = {}) {
	return {
		id: 'user-uuid-123',
		discordId: 'user-discord-123',
		username: 'TestUser',
		avatar: null,
		player: 'TestPlayer',
		role: 'user',
		betaTester: false,
		friendCode: 'ABC123',
		createdAt: new Date('2024-01-01'),
		blockedAt: null,
		blockedBy: null,
		blockReason: null,
		...overrides
	};
}

function createMockAdmin() {
	return createMockUser({
		id: 'admin-uuid-123',
		discordId: 'admin-discord-123',
		username: 'AdminUser',
		role: 'admin'
	});
}

function createBlockedUser() {
	return createMockUser({
		blockedAt: new Date('2024-01-15'),
		blockedBy: 'admin-uuid-123',
		blockReason: 'Spam'
	});
}

// Helper to create mock select chain
function createMockSelectChain(result: unknown[]) {
	return {
		from: vi.fn(() => ({
			where: vi.fn(() => ({
				limit: vi.fn(() => Promise.resolve(result))
			})),
			orderBy: vi.fn(() => ({
				limit: vi.fn(() => ({
					offset: vi.fn(() => Promise.resolve(result))
				}))
			}))
		}))
	};
}

// Helper for select().from() with count
function createMockSelectCountChain(totalResult: unknown[], statsResult: unknown[]) {
	let callCount = 0;
	return {
		from: vi.fn((table) => {
			callCount++;
			if (callCount === 1) {
				// First call - users with pagination
				return {
					orderBy: vi.fn(() => ({
						limit: vi.fn(() => ({
							offset: vi.fn(() => Promise.resolve(totalResult))
						}))
					}))
				};
			} else if (callCount === 2) {
				// Second call - total count
				return Promise.resolve([{ total: totalResult.length }]);
			} else {
				// Third call - stats
				return Promise.resolve(statsResult);
			}
		})
	};
}

// Helper to create mock insert chain
function createMockInsertChain() {
	return {
		values: vi.fn(() => Promise.resolve())
	};
}

// Helper to create mock update chain
function createMockUpdateChain() {
	return {
		set: vi.fn(() => ({
			where: vi.fn(() => Promise.resolve())
		}))
	};
}

describe('Admin Users Page', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('load', () => {
		it('should return users with pagination and stats', async () => {
			const mockUsers = [createMockUser(), createMockAdmin()];
			const mockStats = [{
				totalUsers: 2,
				adminCount: 1,
				betaTesterCount: 0,
				recentSignups: 1,
				blockedCount: 0
			}];

			let selectCallCount = 0;
			mockDb.select.mockImplementation(() => {
				selectCallCount++;
				if (selectCallCount === 1) {
					// Users query
					return {
						from: vi.fn(() => ({
							orderBy: vi.fn(() => ({
								limit: vi.fn(() => ({
									offset: vi.fn(() => Promise.resolve(mockUsers))
								}))
							}))
						}))
					};
				} else if (selectCallCount === 2) {
					// Count query
					return {
						from: vi.fn(() => Promise.resolve([{ total: 2 }]))
					};
				} else {
					// Stats query
					return {
						from: vi.fn(() => Promise.resolve(mockStats))
					};
				}
			});

			const result = await load({
				url: new URL('http://localhost/admin/users')
			} as never);

			expect(result).toBeDefined();
			expect(result!.users).toEqual(mockUsers);
			expect(result!.pagination.page).toBe(1);
			expect(result!.pagination.total).toBe(2);
			expect(result!.stats.totalUsers).toBe(2);
		});

		it('should include blocking fields in user data', async () => {
			const blockedUser = createBlockedUser();
			const mockUsers = [blockedUser];
			const mockStats = [{
				totalUsers: 1,
				adminCount: 0,
				betaTesterCount: 0,
				recentSignups: 0,
				blockedCount: 1
			}];

			let selectCallCount = 0;
			mockDb.select.mockImplementation(() => {
				selectCallCount++;
				if (selectCallCount === 1) {
					return {
						from: vi.fn(() => ({
							orderBy: vi.fn(() => ({
								limit: vi.fn(() => ({
									offset: vi.fn(() => Promise.resolve(mockUsers))
								}))
							}))
						}))
					};
				} else if (selectCallCount === 2) {
					return {
						from: vi.fn(() => Promise.resolve([{ total: 1 }]))
					};
				} else {
					return {
						from: vi.fn(() => Promise.resolve(mockStats))
					};
				}
			});

			const result = await load({
				url: new URL('http://localhost/admin/users')
			} as never);

			expect(result).toBeDefined();
			expect(result!.users[0].blockedAt).toEqual(blockedUser.blockedAt);
			expect(result!.users[0].blockedBy).toBe('admin-uuid-123');
			expect(result!.users[0].blockReason).toBe('Spam');
			expect(result!.stats.blockedCount).toBe(1);
		});
	});

	describe('actions.blockUser', () => {
		it('should return 403 for non-admin users', async () => {
			const formData = new FormData();
			formData.set('userId', 'user-uuid-123');

			await actions.blockUser({
				request: { formData: () => Promise.resolve(formData) },
				locals: { user: { discordId: '123', role: 'user' } }
			} as never);

			expect(fail).toHaveBeenCalledWith(403, { error: 'Unauthorized' });
		});

		it('should return 400 when userId is missing', async () => {
			const formData = new FormData();
			// No userId set

			mockDb.select.mockReturnValue(createMockSelectChain([{ id: 'admin-uuid-123' }]));

			await actions.blockUser({
				request: { formData: () => Promise.resolve(formData) },
				locals: { user: { discordId: 'admin-discord-123', role: 'admin' } }
			} as never);

			expect(fail).toHaveBeenCalledWith(400, { error: 'Missing userId' });
		});

		it('should return 404 when target user not found', async () => {
			const formData = new FormData();
			formData.set('userId', 'nonexistent-uuid');

			mockDb.select
				.mockReturnValueOnce(createMockSelectChain([{ id: 'admin-uuid-123' }]))
				.mockReturnValueOnce(createMockSelectChain([]));

			await actions.blockUser({
				request: { formData: () => Promise.resolve(formData) },
				locals: { user: { discordId: 'admin-discord-123', role: 'admin' } }
			} as never);

			expect(fail).toHaveBeenCalledWith(404, { error: 'User not found' });
		});

		it('should return 400 when trying to block an admin', async () => {
			const formData = new FormData();
			formData.set('userId', 'other-admin-uuid');

			const targetAdmin = createMockAdmin();
			targetAdmin.id = 'other-admin-uuid';

			mockDb.select
				.mockReturnValueOnce(createMockSelectChain([{ id: 'admin-uuid-123' }]))
				.mockReturnValueOnce(createMockSelectChain([targetAdmin]));

			await actions.blockUser({
				request: { formData: () => Promise.resolve(formData) },
				locals: { user: { discordId: 'admin-discord-123', role: 'admin' } }
			} as never);

			expect(fail).toHaveBeenCalledWith(400, { error: 'Cannot block admin users' });
		});

		it('should return 400 when user is already blocked', async () => {
			const formData = new FormData();
			formData.set('userId', 'user-uuid-123');

			mockDb.select
				.mockReturnValueOnce(createMockSelectChain([{ id: 'admin-uuid-123' }]))
				.mockReturnValueOnce(createMockSelectChain([createBlockedUser()]));

			await actions.blockUser({
				request: { formData: () => Promise.resolve(formData) },
				locals: { user: { discordId: 'admin-discord-123', role: 'admin' } }
			} as never);

			expect(fail).toHaveBeenCalledWith(400, { error: 'User is already blocked' });
		});

		it('should successfully block a user', async () => {
			const formData = new FormData();
			formData.set('userId', 'user-uuid-123');
			formData.set('reason', 'Spam');

			mockDb.select
				.mockReturnValueOnce(createMockSelectChain([{ id: 'admin-uuid-123' }]))
				.mockReturnValueOnce(createMockSelectChain([createMockUser()]));
			mockDb.update.mockReturnValue(createMockUpdateChain());
			mockDb.insert.mockReturnValue(createMockInsertChain());

			const result = await actions.blockUser({
				request: { formData: () => Promise.resolve(formData) },
				locals: { user: { discordId: 'admin-discord-123', role: 'admin' } }
			} as never);

			expect(result).toEqual({ success: true, action: 'blocked', userId: 'user-uuid-123' });
			expect(mockDb.update).toHaveBeenCalled();
			expect(mockDb.insert).toHaveBeenCalled();
		});
	});

	describe('actions.unblockUser', () => {
		it('should return 403 for non-admin users', async () => {
			const formData = new FormData();
			formData.set('userId', 'user-uuid-123');

			await actions.unblockUser({
				request: { formData: () => Promise.resolve(formData) },
				locals: { user: { discordId: '123', role: 'user' } }
			} as never);

			expect(fail).toHaveBeenCalledWith(403, { error: 'Unauthorized' });
		});

		it('should return 400 when user is not blocked', async () => {
			const formData = new FormData();
			formData.set('userId', 'user-uuid-123');

			mockDb.select
				.mockReturnValueOnce(createMockSelectChain([{ id: 'admin-uuid-123' }]))
				.mockReturnValueOnce(createMockSelectChain([createMockUser()])); // Not blocked

			await actions.unblockUser({
				request: { formData: () => Promise.resolve(formData) },
				locals: { user: { discordId: 'admin-discord-123', role: 'admin' } }
			} as never);

			expect(fail).toHaveBeenCalledWith(400, { error: 'User is not blocked' });
		});

		it('should successfully unblock a user', async () => {
			const formData = new FormData();
			formData.set('userId', 'user-uuid-123');

			mockDb.select
				.mockReturnValueOnce(createMockSelectChain([{ id: 'admin-uuid-123' }]))
				.mockReturnValueOnce(createMockSelectChain([createBlockedUser()]));
			mockDb.update.mockReturnValue(createMockUpdateChain());
			mockDb.insert.mockReturnValue(createMockInsertChain());

			const result = await actions.unblockUser({
				request: { formData: () => Promise.resolve(formData) },
				locals: { user: { discordId: 'admin-discord-123', role: 'admin' } }
			} as never);

			expect(result).toEqual({ success: true, action: 'unblocked', userId: 'user-uuid-123' });
			expect(mockDb.update).toHaveBeenCalled();
			expect(mockDb.insert).toHaveBeenCalled();
		});
	});
});
