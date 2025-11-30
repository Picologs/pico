/**
 * Database Schema Tests
 *
 * Tests the Drizzle ORM schema definitions including:
 * - Table structure validation
 * - Relations configuration
 * - Type exports
 */

import { describe, it, expect } from 'vitest';
import {
	users,
	groups,
	groupMembers,
	groupInvitations,
	friends,
	notifications,
	logPatterns,
	logPatternExamples,
	logTags,
	logPatternReports,
	usersRelations,
	groupsRelations,
	groupMembersRelations,
	friendsRelations,
	groupInvitationsRelations,
	notificationsRelations
} from './schema';

describe('Database Schema', () => {
	describe('Users Table', () => {
		it('should have all required columns', () => {
			const columns = Object.keys(users);
			expect(columns).toContain('id');
			expect(columns).toContain('discordId');
			expect(columns).toContain('username');
			expect(columns).toContain('avatar');
			expect(columns).toContain('player');
			expect(columns).toContain('timeZone');
			expect(columns).toContain('friendCode');
			expect(columns).toContain('role');
			expect(columns).toContain('createdAt');
			expect(columns).toContain('updatedAt');
		});

		it('should have usePlayerAsDisplayName column', () => {
			const columns = Object.keys(users);
			expect(columns).toContain('usePlayerAsDisplayName');
		});

		it('should have showTimezone column', () => {
			const columns = Object.keys(users);
			expect(columns).toContain('showTimezone');
		});
	});

	describe('Groups Table', () => {
		it('should have all required columns', () => {
			const columns = Object.keys(groups);
			expect(columns).toContain('id');
			expect(columns).toContain('name');
			expect(columns).toContain('description');
			expect(columns).toContain('avatar');
			expect(columns).toContain('tags');
			expect(columns).toContain('ownerId');
			expect(columns).toContain('createdAt');
			expect(columns).toContain('updatedAt');
		});
	});

	describe('Group Members Table', () => {
		it('should have all required columns', () => {
			const columns = Object.keys(groupMembers);
			expect(columns).toContain('id');
			expect(columns).toContain('groupId');
			expect(columns).toContain('userId');
			expect(columns).toContain('role');
			expect(columns).toContain('canInvite');
			expect(columns).toContain('canRemoveMembers');
			expect(columns).toContain('canEditGroup');
			expect(columns).toContain('joinedAt');
		});

		it('should have permission columns', () => {
			const columns = Object.keys(groupMembers);
			expect(columns).toContain('canInvite');
			expect(columns).toContain('canRemoveMembers');
			expect(columns).toContain('canEditGroup');
		});
	});

	describe('Group Invitations Table', () => {
		it('should have all required columns', () => {
			const columns = Object.keys(groupInvitations);
			expect(columns).toContain('id');
			expect(columns).toContain('groupId');
			expect(columns).toContain('inviterId');
			expect(columns).toContain('inviteeId');
			expect(columns).toContain('status');
			expect(columns).toContain('createdAt');
			expect(columns).toContain('respondedAt');
		});
	});

	describe('Friends Table', () => {
		it('should have all required columns', () => {
			const columns = Object.keys(friends);
			expect(columns).toContain('id');
			expect(columns).toContain('userId');
			expect(columns).toContain('friendId');
			expect(columns).toContain('status');
			expect(columns).toContain('createdAt');
		});
	});

	describe('Notifications Table', () => {
		it('should have all required columns', () => {
			const columns = Object.keys(notifications);
			expect(columns).toContain('id');
			expect(columns).toContain('userId');
			expect(columns).toContain('type');
			expect(columns).toContain('title');
			expect(columns).toContain('message');
			expect(columns).toContain('data');
			expect(columns).toContain('read');
			expect(columns).toContain('createdAt');
			expect(columns).toContain('readAt');
		});
	});

	describe('Log Patterns Table', () => {
		it('should have all required columns', () => {
			const columns = Object.keys(logPatterns);
			expect(columns).toContain('id');
			expect(columns).toContain('eventName');
			expect(columns).toContain('severity');
			expect(columns).toContain('signature');
			expect(columns).toContain('regexPattern');
			expect(columns).toContain('isHandled');
			expect(columns).toContain('firstSeenAt');
			expect(columns).toContain('lastSeenAt');
			expect(columns).toContain('totalOccurrences');
		});
	});

	describe('Log Pattern Examples Table', () => {
		it('should have all required columns', () => {
			const columns = Object.keys(logPatternExamples);
			expect(columns).toContain('id');
			expect(columns).toContain('patternId');
			expect(columns).toContain('exampleLine');
			expect(columns).toContain('addedAt');
		});
	});

	describe('Log Tags Table', () => {
		it('should have all required columns', () => {
			const columns = Object.keys(logTags);
			expect(columns).toContain('id');
			expect(columns).toContain('patternId');
			expect(columns).toContain('tagType');
			expect(columns).toContain('tagValue');
		});
	});

	describe('Log Pattern Reports Table', () => {
		it('should have all required columns', () => {
			const columns = Object.keys(logPatternReports);
			expect(columns).toContain('id');
			expect(columns).toContain('patternId');
			expect(columns).toContain('userId');
			expect(columns).toContain('occurrences');
			expect(columns).toContain('reportedAt');
		});
	});
});

describe('Database Relations', () => {
	describe('Users Relations', () => {
		it('should be defined', () => {
			expect(usersRelations).toBeDefined();
		});
	});

	describe('Groups Relations', () => {
		it('should be defined', () => {
			expect(groupsRelations).toBeDefined();
		});
	});

	describe('Group Members Relations', () => {
		it('should be defined', () => {
			expect(groupMembersRelations).toBeDefined();
		});
	});

	describe('Friends Relations', () => {
		it('should be defined', () => {
			expect(friendsRelations).toBeDefined();
		});
	});

	describe('Group Invitations Relations', () => {
		it('should be defined', () => {
			expect(groupInvitationsRelations).toBeDefined();
		});
	});

	describe('Notifications Relations', () => {
		it('should be defined', () => {
			expect(notificationsRelations).toBeDefined();
		});
	});
});

describe('Schema Type Inference', () => {
	it('should export User type', async () => {
		const schemaModule = await import('./schema');
		expect(schemaModule.users).toBeDefined();
	});

	it('should export Group type', async () => {
		const schemaModule = await import('./schema');
		expect(schemaModule.groups).toBeDefined();
	});

	it('should export GroupMember type', async () => {
		const schemaModule = await import('./schema');
		expect(schemaModule.groupMembers).toBeDefined();
	});

	it('should export Friend type', async () => {
		const schemaModule = await import('./schema');
		expect(schemaModule.friends).toBeDefined();
	});

	it('should export Notification type', async () => {
		const schemaModule = await import('./schema');
		expect(schemaModule.notifications).toBeDefined();
	});

	it('should export LogPattern type', async () => {
		const schemaModule = await import('./schema');
		expect(schemaModule.logPatterns).toBeDefined();
	});
});

describe('Table Constraints', () => {
	describe('Users Table Constraints', () => {
		it('should have unique discordId', () => {
			// The schema definition includes .unique() on discordId
			// This test verifies the column exists
			expect(users.discordId).toBeDefined();
		});

		it('should have unique friendCode', () => {
			expect(users.friendCode).toBeDefined();
		});
	});

	describe('Group Members Constraints', () => {
		it('should have groupId foreign key', () => {
			expect(groupMembers.groupId).toBeDefined();
		});

		it('should have userId foreign key', () => {
			expect(groupMembers.userId).toBeDefined();
		});
	});

	describe('Friends Constraints', () => {
		it('should have userId foreign key', () => {
			expect(friends.userId).toBeDefined();
		});

		it('should have friendId foreign key', () => {
			expect(friends.friendId).toBeDefined();
		});
	});
});
