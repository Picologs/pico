/**
 * Tests for logGrouping.ts
 *
 * Tests log grouping functionality for equipment, insurance, killing sprees,
 * and the unified processAllGroupings function.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Log } from '@pico/types';

// Mock the @pico/shared module before importing logGrouping
vi.mock('@pico/shared', () => ({
	formatMissionObjectiveState: (state: string) => state.toLowerCase().replace(/_/g, ' ')
}));

import {
	groupEquipmentEvents,
	groupInsuranceEvents,
	groupKillingSprees,
	flattenGroups,
	processAllGroupings
} from './logGrouping';

// Helper to create test logs
function createTestLog(overrides: Partial<Log> = {}): Log {
	return {
		id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
		userId: 'test-user',
		player: 'TestPlayer',
		reportedBy: ['TestPlayer'],
		emoji: '📝',
		line: 'Test log entry',
		timestamp: new Date().toISOString(),
		original: 'Original log line',
		open: false,
		...overrides
	};
}

// Helper to create equipment log
function createEquipmentLog(player: string, timestamp: Date, attachmentName: string): Log {
	return createTestLog({
		id: `equip-${timestamp.getTime()}-${Math.random().toString(36).slice(2, 5)}`,
		player,
		emoji: '🎒',
		line: `${player} received ${attachmentName}`,
		timestamp: timestamp.toISOString(),
		eventType: 'equipment_received' as any,
		metadata: { attachmentName }
	});
}

// Helper to create insurance log
function createInsuranceLog(timestamp: Date, entitlementURN: string): Log {
	return createTestLog({
		id: `insurance-${timestamp.getTime()}-${Math.random().toString(36).slice(2, 5)}`,
		emoji: '📋',
		line: `Insurance claim: ${entitlementURN}`,
		timestamp: timestamp.toISOString(),
		eventType: 'insurance_claim' as any,
		metadata: { entitlementURN }
	});
}

// Helper to create kill log
function createKillLog(killer: string, victim: string, timestamp: Date): Log {
	return createTestLog({
		id: `kill-${timestamp.getTime()}-${Math.random().toString(36).slice(2, 5)}`,
		player: killer,
		emoji: '💀',
		line: `${killer} killed ${victim}`,
		timestamp: timestamp.toISOString(),
		eventType: 'actor_death',
		metadata: { killerName: killer, victimName: victim }
	});
}

describe('logGrouping', () => {
	describe('groupEquipmentEvents', () => {
		it('should not group single equipment event', () => {
			const now = new Date();
			const logs = [createEquipmentLog('Player1', now, 'Helmet')];

			const result = groupEquipmentEvents(logs);

			expect(result).toHaveLength(1);
			expect(result[0].eventType).toBe('equipment_received');
		});

		it('should group multiple equipment events within 2 minutes', () => {
			const now = new Date();
			const logs = [
				createEquipmentLog('Player1', now, 'Helmet'),
				createEquipmentLog('Player1', new Date(now.getTime() + 30000), 'Armor'),
				createEquipmentLog('Player1', new Date(now.getTime() + 60000), 'Backpack')
			];

			const result = groupEquipmentEvents(logs);

			expect(result).toHaveLength(1);
			expect(result[0].eventType).toBe('equipment_group');
			expect(result[0].children).toHaveLength(3);
			expect(result[0].metadata?.itemCount).toBe(3);
		});

		it('should not group equipment events from different players', () => {
			const now = new Date();
			const logs = [
				createEquipmentLog('Player1', now, 'Helmet'),
				createEquipmentLog('Player2', new Date(now.getTime() + 30000), 'Armor')
			];

			const result = groupEquipmentEvents(logs);

			expect(result).toHaveLength(2);
			expect(result[0].eventType).toBe('equipment_received');
			expect(result[1].eventType).toBe('equipment_received');
		});

		it('should not group equipment events more than 2 minutes apart', () => {
			const now = new Date();
			const logs = [
				createEquipmentLog('Player1', now, 'Helmet'),
				createEquipmentLog('Player1', new Date(now.getTime() + 150000), 'Armor') // 2.5 minutes later
			];

			const result = groupEquipmentEvents(logs);

			expect(result).toHaveLength(2);
		});

		it('should preserve non-equipment logs in order', () => {
			const now = new Date();
			const normalLog = createTestLog({
				timestamp: new Date(now.getTime() + 45000).toISOString(),
				eventType: 'connected'
			});

			const logs = [
				createEquipmentLog('Player1', now, 'Helmet'),
				createEquipmentLog('Player1', new Date(now.getTime() + 30000), 'Armor'),
				normalLog
			];

			const result = groupEquipmentEvents(logs);

			// Equipment should be grouped, normal log separate
			expect(result).toHaveLength(2);
			expect(result[0].eventType).toBe('equipment_group');
			expect(result[1].eventType).toBe('connected');
		});
	});

	describe('groupInsuranceEvents', () => {
		it('should not group single insurance event', () => {
			const now = new Date();
			const logs = [createInsuranceLog(now, 'ship-123')];

			const result = groupInsuranceEvents(logs);

			expect(result).toHaveLength(1);
			expect(result[0].eventType).toBe('insurance_claim');
		});

		it('should group multiple insurance events within 2 minutes', () => {
			const now = new Date();
			const logs = [
				createInsuranceLog(now, 'ship-123'),
				createInsuranceLog(new Date(now.getTime() + 30000), 'weapon-456'),
				createInsuranceLog(new Date(now.getTime() + 60000), 'armor-789')
			];

			const result = groupInsuranceEvents(logs);

			expect(result).toHaveLength(1);
			expect(result[0].eventType).toBe('insurance_group');
			expect(result[0].children).toHaveLength(3);
			expect(result[0].metadata?.claimCount).toBe(3);
		});

		it('should split groups when timeout exceeded', () => {
			const now = new Date();
			const logs = [
				createInsuranceLog(now, 'claim-1'),
				createInsuranceLog(new Date(now.getTime() + 30000), 'claim-2'),
				createInsuranceLog(new Date(now.getTime() + 180000), 'claim-3'), // 3 minutes later
				createInsuranceLog(new Date(now.getTime() + 200000), 'claim-4')
			];

			const result = groupInsuranceEvents(logs);

			expect(result).toHaveLength(2);
			expect(result[0].eventType).toBe('insurance_group');
			expect(result[0].children).toHaveLength(2);
			expect(result[1].eventType).toBe('insurance_group');
			expect(result[1].children).toHaveLength(2);
		});
	});

	describe('groupKillingSprees', () => {
		it('should not group less than 3 kills', () => {
			const now = new Date();
			const logs = [
				createKillLog('Player1', 'Victim1', now),
				createKillLog('Player1', 'Victim2', new Date(now.getTime() + 30000))
			];

			const result = groupKillingSprees(logs);

			expect(result).toHaveLength(2);
			expect(result[0].eventType).toBe('actor_death');
		});

		it('should group 3+ kills within 5 minutes', () => {
			const now = new Date();
			const logs = [
				createKillLog('Player1', 'Victim1', now),
				createKillLog('Player1', 'Victim2', new Date(now.getTime() + 60000)),
				createKillLog('Player1', 'Victim3', new Date(now.getTime() + 120000))
			];

			const result = groupKillingSprees(logs);

			expect(result).toHaveLength(1);
			expect(result[0].eventType).toBe('killing_spree');
			expect(result[0].children).toHaveLength(3);
			expect(result[0].metadata?.killCount).toBe(3);
			expect(result[0].line).toContain('3-kill spree');
		});

		it('should not group kills more than 5 minutes apart', () => {
			const now = new Date();
			const logs = [
				createKillLog('Player1', 'Victim1', now),
				createKillLog('Player1', 'Victim2', new Date(now.getTime() + 60000)),
				createKillLog('Player1', 'Victim3', new Date(now.getTime() + 120000)),
				// 4th kill needs to be >5 minutes after 3rd kill (at +120000)
				// So at least +120000 + 300001 = +420001ms from start
				createKillLog('Player1', 'Victim4', new Date(now.getTime() + 450000)) // 7.5 minutes from start (5.5 min after kill 3)
			];

			const result = groupKillingSprees(logs);

			expect(result).toHaveLength(2);
			expect(result[0].eventType).toBe('killing_spree');
			expect(result[0].children).toHaveLength(3);
			expect(result[1].eventType).toBe('actor_death');
		});

		it('should only count kills by the player (not deaths)', () => {
			const now = new Date();
			// Mix of kills by player and kills of player
			// Note: Deaths (where player is victim) break the spree sequence
			const logs = [
				createKillLog('Player1', 'Victim1', now), // Player1 killed
				createTestLog({
					timestamp: new Date(now.getTime() + 30000).toISOString(),
					eventType: 'actor_death',
					player: 'Player1',
					metadata: { killerName: 'Enemy', victimName: 'Player1' } // Player1 was killed
				}),
				createKillLog('Player1', 'Victim2', new Date(now.getTime() + 60000)),
				createKillLog('Player1', 'Victim3', new Date(now.getTime() + 90000))
			];

			const result = groupKillingSprees(logs);

			// The death breaks the spree, so we get:
			// - Kill 1 (individual, not enough for spree)
			// - Death (passed through)
			// - Kills 2 & 3 (individual, only 2 kills not enough for spree of 3)
			expect(result).toHaveLength(4);
			expect(result.filter((l) => l.eventType === 'killing_spree')).toHaveLength(0);
			expect(result.filter((l) => l.eventType === 'actor_death')).toHaveLength(4);
		});

		it('should group consecutive kills by the player without interruption', () => {
			const now = new Date();
			// All kills by player, no deaths in between
			const logs = [
				createKillLog('Player1', 'Victim1', now),
				createKillLog('Player1', 'Victim2', new Date(now.getTime() + 30000)),
				createKillLog('Player1', 'Victim3', new Date(now.getTime() + 60000))
			];

			const result = groupKillingSprees(logs);

			// Should group all 3 kills into a spree
			expect(result).toHaveLength(1);
			expect(result[0].eventType).toBe('killing_spree');
			expect(result[0].children).toHaveLength(3);
		});
	});

	describe('flattenGroups', () => {
		it('should flatten grouped logs back to individuals', () => {
			const now = new Date();
			const originalLogs = [
				createKillLog('Player1', 'Victim1', now),
				createKillLog('Player1', 'Victim2', new Date(now.getTime() + 30000)),
				createKillLog('Player1', 'Victim3', new Date(now.getTime() + 60000))
			];

			// Group the logs
			const grouped = groupKillingSprees(originalLogs);
			expect(grouped).toHaveLength(1);
			expect(grouped[0].eventType).toBe('killing_spree');

			// Flatten back
			const flattened = flattenGroups(grouped);
			expect(flattened).toHaveLength(3);
			expect(flattened.every((l) => l.eventType === 'actor_death')).toBe(true);
		});

		it('should preserve non-grouped logs', () => {
			const logs = [
				createTestLog({ eventType: 'connected' }),
				createTestLog({ eventType: 'location' })
			];

			const flattened = flattenGroups(logs);

			expect(flattened).toHaveLength(2);
			expect(flattened[0].eventType).toBe('connected');
			expect(flattened[1].eventType).toBe('location');
		});

		it('should handle mixed grouped and non-grouped logs', () => {
			const now = new Date();
			const killLogs = [
				createKillLog('Player1', 'Victim1', now),
				createKillLog('Player1', 'Victim2', new Date(now.getTime() + 30000)),
				createKillLog('Player1', 'Victim3', new Date(now.getTime() + 60000))
			];
			const normalLog = createTestLog({ eventType: 'connected' });

			const grouped = groupKillingSprees([...killLogs, normalLog]);
			const flattened = flattenGroups(grouped);

			// Should have 3 kills + 1 normal log
			expect(flattened).toHaveLength(4);
		});
	});

	describe('processAllGroupings', () => {
		it('should process multiple grouping types in single pass', () => {
			const now = new Date();

			const logs = [
				// Equipment group (3 items)
				createEquipmentLog('Player1', now, 'Helmet'),
				createEquipmentLog('Player1', new Date(now.getTime() + 10000), 'Armor'),
				createEquipmentLog('Player1', new Date(now.getTime() + 20000), 'Backpack'),
				// Killing spree (3 kills)
				createKillLog('Player1', 'Victim1', new Date(now.getTime() + 100000)),
				createKillLog('Player1', 'Victim2', new Date(now.getTime() + 130000)),
				createKillLog('Player1', 'Victim3', new Date(now.getTime() + 160000)),
				// Insurance group (2 claims)
				createInsuranceLog(new Date(now.getTime() + 200000), 'claim-1'),
				createInsuranceLog(new Date(now.getTime() + 210000), 'claim-2')
			];

			const result = processAllGroupings(logs);

			// Should have 3 groups
			const equipmentGroups = result.filter((l) => l.eventType === 'equipment_group');
			const killingSprees = result.filter((l) => l.eventType === 'killing_spree');
			const insuranceGroups = result.filter((l) => l.eventType === 'insurance_group');

			expect(equipmentGroups).toHaveLength(1);
			expect(killingSprees).toHaveLength(1);
			expect(insuranceGroups).toHaveLength(1);
		});

		it('should preserve ungrouped logs', () => {
			const now = new Date();

			const logs = [
				createTestLog({
					timestamp: now.toISOString(),
					eventType: 'connected',
					line: 'Player connected'
				}),
				createTestLog({
					timestamp: new Date(now.getTime() + 50000).toISOString(),
					eventType: 'location',
					line: 'Player at Port Olisar'
				})
			];

			const result = processAllGroupings(logs);

			expect(result).toHaveLength(2);
			expect(result[0].eventType).toBe('connected');
			expect(result[1].eventType).toBe('location');
		});

		it('should handle empty input', () => {
			const result = processAllGroupings([]);
			expect(result).toHaveLength(0);
		});

		it('should generate unique group IDs', () => {
			const now = new Date();
			const logs = [
				createKillLog('Player1', 'Victim1', now),
				createKillLog('Player1', 'Victim2', new Date(now.getTime() + 30000)),
				createKillLog('Player1', 'Victim3', new Date(now.getTime() + 60000))
			];

			const result1 = processAllGroupings(logs);
			const result2 = processAllGroupings(logs);

			// IDs should be deterministic based on content
			expect(result1[0].id).toBe(result2[0].id);

			// But different groups should have different IDs
			const laterLogs = [
				createKillLog('Player1', 'OtherVictim1', new Date(now.getTime() + 1000000)),
				createKillLog('Player1', 'OtherVictim2', new Date(now.getTime() + 1030000)),
				createKillLog('Player1', 'OtherVictim3', new Date(now.getTime() + 1060000))
			];

			const result3 = processAllGroupings(laterLogs);
			expect(result1[0].id).not.toBe(result3[0].id);
		});
	});

	describe('group ID uniqueness', () => {
		it('should use group- prefix to avoid collision with child IDs', () => {
			const now = new Date();
			const logs = [
				createKillLog('Player1', 'Victim1', now),
				createKillLog('Player1', 'Victim2', new Date(now.getTime() + 30000)),
				createKillLog('Player1', 'Victim3', new Date(now.getTime() + 60000))
			];

			const result = groupKillingSprees(logs);

			expect(result[0].id).toMatch(/^group-spree-/);
			expect(result[0].children?.every((c) => !c.id.startsWith('group-'))).toBe(true);
		});
	});
});
