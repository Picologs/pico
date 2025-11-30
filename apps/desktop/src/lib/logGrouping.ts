/**
 * Custom log grouping functions for picologs
 * Groups similar events that happen close together in time
 * Pattern inspired by groupKillingSprees() from @pico/shared
 */

import type { Log } from '@pico/types';
import { formatMissionObjectiveState } from '@pico/shared';

/**
 * Simple string hash function for generating unique IDs
 * Uses DJB2 algorithm - fast and produces good distribution
 */
function hashString(str: string): number {
	let hash = 5381;
	for (let i = 0; i < str.length; i++) {
		hash = (hash * 33) ^ str.charCodeAt(i);
	}
	return hash;
}

/**
 * Check for ID collisions and log warnings for debugging
 */
function checkIdCollision(newId: string, existingLogs: Log[], groupType: string): void {
	const collision = existingLogs.find((log) => log.id === newId);
	if (collision) {
		console.warn(
			`[Grouping] ID collision detected for ${groupType}:`,
			newId,
			'Existing log:',
			collision.line
		);
	}
}

/**
 * Group equipment attachment events that happen close together
 * Groups AttachmentReceived events for the same player within 2 minutes
 * Minimum 2 items required to form a group
 */
export function groupEquipmentEvents(logs: Log[]): Log[] {
	const result: Log[] = [];
	let currentGroup: Log[] = [];
	let lastEventTime: Date | null = null;
	let currentPlayer: string | null = null;

	const GROUP_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes
	const MIN_GROUP_SIZE = 2;

	console.log('[groupEquipmentEvents] Starting grouping, input logs:', logs.length);

	for (const log of logs) {
		const isEquipment = log.eventType === ('equipment_received' as any);
		const player = log.player;

		if (isEquipment && player) {
			const eventTime = new Date(log.timestamp);

			// Check if this event is part of current group
			if (
				lastEventTime &&
				currentPlayer === player &&
				eventTime.getTime() - lastEventTime.getTime() <= GROUP_TIMEOUT_MS
			) {
				currentGroup.push(log);
			} else {
				// Finish previous group
				if (currentGroup.length >= MIN_GROUP_SIZE) {
					const groupLog = createEquipmentGroupLog(currentGroup);
					checkIdCollision(groupLog.id, result, 'equipment');
					result.push(groupLog);
				} else {
					result.push(...currentGroup);
				}
				currentGroup = [log];
				currentPlayer = player;
			}
			lastEventTime = eventTime;
		} else {
			// Non-equipment event - finish current group
			if (currentGroup.length >= MIN_GROUP_SIZE) {
				const groupLog = createEquipmentGroupLog(currentGroup);
				checkIdCollision(groupLog.id, result, 'equipment');
				result.push(groupLog);
			} else {
				result.push(...currentGroup);
			}
			currentGroup = [];
			currentPlayer = null;
			lastEventTime = null;
			result.push(log);
		}
	}

	// Handle remaining group
	if (currentGroup.length >= MIN_GROUP_SIZE) {
		const groupLog = createEquipmentGroupLog(currentGroup);
		checkIdCollision(groupLog.id, result, 'equipment');
		result.push(groupLog);
	} else {
		result.push(...currentGroup);
	}

	console.log('[groupEquipmentEvents] Completed grouping, output logs:', result.length);
	return result;
}

/**
 * Create a grouped equipment log from individual attachment events
 */
function createEquipmentGroupLog(items: Log[]): Log {
	const firstItem = items[0];
	const itemCount = items.length;
	const player = firstItem.player || 'Player';

	// Create unique ID with group prefix to prevent collision with individual events
	const groupContent = items.map((i) => i.id).join('-');
	const timestamp = new Date(firstItem.timestamp).getTime();
	const contentHash = Math.abs(hashString(groupContent)).toString(36);
	const id = `group-equipment-${timestamp}-${contentHash}`;

	return {
		id,
		userId: firstItem.userId,
		player: firstItem.player,
		reportedBy: (firstItem as any).reportedBy || ['Unknown'],
		emoji: '🎒',
		line: `${player} geared up`,
		timestamp: firstItem.timestamp,
		original: items.map((item) => item.original).join('\n'),
		open: false,
		eventType: 'equipment_group' as any,
		children: items,
		metadata: {
			itemCount,
			items: items.map((item) => item.metadata?.attachmentName).filter(Boolean)
		}
	};
}

/**
 * Group insurance claim events that happen close together
 * Groups insurance claim events for the same player within 2 minutes
 * Minimum 2 claims required to form a group
 */
export function groupInsuranceEvents(logs: Log[]): Log[] {
	const result: Log[] = [];
	let currentGroup: Log[] = [];
	let lastEventTime: Date | null = null;

	const GROUP_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes
	const MIN_GROUP_SIZE = 2;

	console.log('[groupInsuranceEvents] Starting grouping, input logs:', logs.length);

	for (const log of logs) {
		const isInsurance = log.eventType === ('insurance_claim' as any);

		if (isInsurance) {
			const eventTime = new Date(log.timestamp);

			// Check if this event is part of current group
			if (lastEventTime && eventTime.getTime() - lastEventTime.getTime() <= GROUP_TIMEOUT_MS) {
				currentGroup.push(log);
			} else {
				// Finish previous group
				if (currentGroup.length >= MIN_GROUP_SIZE) {
					const groupLog = createInsuranceGroupLog(currentGroup);
					checkIdCollision(groupLog.id, result, 'insurance');
					result.push(groupLog);
				} else {
					result.push(...currentGroup);
				}
				currentGroup = [log];
			}
			lastEventTime = eventTime;
		} else {
			// Non-insurance event - finish current group
			if (currentGroup.length >= MIN_GROUP_SIZE) {
				const groupLog = createInsuranceGroupLog(currentGroup);
				checkIdCollision(groupLog.id, result, 'insurance');
				result.push(groupLog);
			} else {
				result.push(...currentGroup);
			}
			currentGroup = [];
			lastEventTime = null;
			result.push(log);
		}
	}

	// Handle remaining group
	if (currentGroup.length >= MIN_GROUP_SIZE) {
		const groupLog = createInsuranceGroupLog(currentGroup);
		checkIdCollision(groupLog.id, result, 'insurance');
		result.push(groupLog);
	} else {
		result.push(...currentGroup);
	}

	console.log('[groupInsuranceEvents] Completed grouping, output logs:', result.length);
	return result;
}

/**
 * Create a grouped insurance log from individual claim events
 */
function createInsuranceGroupLog(claims: Log[]): Log {
	const firstClaim = claims[0];
	const claimCount = claims.length;

	// Create unique ID with group prefix to prevent collision with individual events
	const groupContent = claims.map((c) => c.id).join('-');
	const timestamp = new Date(firstClaim.timestamp).getTime();
	const contentHash = Math.abs(hashString(groupContent)).toString(36);
	const id = `group-insurance-${timestamp}-${contentHash}`;

	return {
		id,
		userId: firstClaim.userId,
		player: firstClaim.player,
		reportedBy: (firstClaim as any).reportedBy || ['Unknown'],
		emoji: '📋',
		line: `Processed ${claimCount} insurance claims`,
		timestamp: firstClaim.timestamp,
		original: claims.map((claim) => claim.original).join('\n'),
		open: false,
		eventType: 'insurance_group' as any,
		children: claims,
		metadata: {
			claimCount,
			entitlements: claims.map((claim) => claim.metadata?.entitlementURN).filter(Boolean)
		}
	};
}

/**
 * Create a grouped vehicle control log from individual events
 * Groups request → grant → release sequences for the same vehicle
 */
function createVehicleControlGroupLog(events: Log[]): Log {
	const firstEvent = events[0];
	const vehicleName = firstEvent.metadata?.vehicleName || 'a ship';
	const vehicleId = firstEvent.metadata?.vehicleId || 'unknown';

	// Create unique ID
	const groupContent = events.map((e) => e.id).join('-');
	const timestamp = new Date(firstEvent.timestamp).getTime();
	const contentHash = Math.abs(hashString(groupContent)).toString(36);
	const id = `group-vehicle-${timestamp}-${contentHash}`;

	// Determine if still in ship (no release event)
	const hasRelease = events.some((e) => e.metadata?.action === 'releasing');
	const emoji = hasRelease ? '🚀' : '🛸';
	const line = hasRelease
		? `Piloted ${vehicleName.split('_').slice(0, -1).join(' ')}`
		: `Piloting ${vehicleName.split('_').slice(0, -1).join(' ')}...`;

	return {
		id,
		userId: firstEvent.userId,
		player: firstEvent.player,
		reportedBy: (firstEvent as any).reportedBy || ['Unknown'],
		emoji,
		line,
		timestamp: firstEvent.timestamp,
		original: events.map((e) => e.original).join('\n'),
		open: false,
		eventType: 'vehicle_control_group' as any,
		children: events,
		metadata: {
			vehicleName,
			vehicleId,
			eventCount: events.length,
			actions: events.map((e) => e.metadata?.action),
			team: firstEvent.metadata?.team
		}
	};
}

/**
 * Create a grouped mission objective log from individual objective update events
 */
function createMissionObjectiveGroupLog(updates: Log[]): Log {
	const firstUpdate = updates[0];
	const lastUpdate = updates[updates.length - 1];
	const updateCount = updates.length;

	// Create unique ID with group prefix to prevent collision with individual events
	const groupContent = updates.map((u) => u.id).join('-');
	const timestamp = new Date(firstUpdate.timestamp).getTime();
	const contentHash = Math.abs(hashString(groupContent)).toString(36);
	const id = `group-mission-objective-${timestamp}-${contentHash}`;

	// Get the latest state
	const finalState = (lastUpdate.metadata?.objectiveState as string) || 'UPDATED';
	const formattedState = formatMissionObjectiveState(finalState);

	return {
		id,
		userId: firstUpdate.userId,
		player: firstUpdate.player,
		reportedBy: (firstUpdate as any).reportedBy || ['Unknown'],
		emoji: '🎯',
		line: `Mission objective: ${formattedState} (${updateCount} updates)`,
		timestamp: firstUpdate.timestamp,
		original: updates.map((u) => u.original).join('\n'),
		open: false,
		eventType: 'mission_objective_group' as any,
		children: updates,
		metadata: {
			updateCount,
			missionId: firstUpdate.metadata?.missionId,
			objectiveId: firstUpdate.metadata?.objectiveId,
			finalState,
			states: updates.map((u) => u.metadata?.objectiveState)
		}
	};
}

/**
 * Group killing spree events (local override of shared library function)
 * Groups consecutive kills by the same player within 5 minutes
 * Minimum 3 kills required to form a spree
 *
 * This is a local override to fix duplicate ID generation bug in the shared library.
 * The shared library uses `spree-${firstKill.id}` which can create duplicates.
 * We use timestamp range + count for guaranteed uniqueness.
 */
export function groupKillingSprees(logs: Log[]): Log[] {
	const result: Log[] = [];
	let currentSpree: Log[] = [];
	let lastKillTime: Date | null = null;

	const SPREE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
	const MIN_SPREE_SIZE = 3;

	console.log('[groupKillingSprees] Starting grouping, input logs:', logs.length);

	for (const log of logs) {
		const isKill = log.eventType === 'actor_death' && log.metadata?.killerName === log.player;

		if (isKill) {
			const killTime = new Date(log.timestamp);

			// Check if this kill is part of current spree
			if (lastKillTime && killTime.getTime() - lastKillTime.getTime() > SPREE_TIMEOUT_MS) {
				// Timeout - finish current spree
				if (currentSpree.length >= MIN_SPREE_SIZE) {
					const spreeLog = createSpreeLog(currentSpree);
					checkIdCollision(spreeLog.id, result, 'killing_spree');
					result.push(spreeLog);
				} else {
					result.push(...currentSpree);
				}
				currentSpree = [];
			}

			currentSpree.push(log);
			lastKillTime = killTime;
		} else {
			// Non-kill event - finish current spree
			if (currentSpree.length >= MIN_SPREE_SIZE) {
				const spreeLog = createSpreeLog(currentSpree);
				checkIdCollision(spreeLog.id, result, 'killing_spree');
				result.push(spreeLog);
			} else {
				result.push(...currentSpree);
			}
			currentSpree = [];
			lastKillTime = null;
			result.push(log);
		}
	}

	// Handle remaining spree
	if (currentSpree.length >= MIN_SPREE_SIZE) {
		const spreeLog = createSpreeLog(currentSpree);
		checkIdCollision(spreeLog.id, result, 'killing_spree');
		result.push(spreeLog);
	} else {
		result.push(...currentSpree);
	}

	console.log('[groupKillingSprees] Completed grouping, output logs:', result.length);
	return result;
}

/**
 * Create a killing spree log from individual kill logs
 */
function createSpreeLog(kills: Log[]): Log {
	const firstKill = kills[0];
	const killCount = kills.length;

	// Create unique ID with group prefix to prevent collision with individual events
	const groupContent = kills.map((k) => k.id).join('-');
	const timestamp = new Date(firstKill.timestamp).getTime();
	const contentHash = Math.abs(hashString(groupContent)).toString(36);
	const id = `group-spree-${timestamp}-${contentHash}`;

	return {
		id,
		userId: firstKill.userId,
		player: firstKill.player,
		reportedBy: (firstKill as any).reportedBy || ['Unknown'],
		emoji: '🔥',
		line: `${firstKill.player} on a ${killCount}-kill spree!`,
		timestamp: firstKill.timestamp,
		original: kills.map((k) => k.original).join('\n'),
		open: false,
		eventType: 'killing_spree' as any,
		children: kills,
		metadata: {
			killCount,
			victims: kills.map((k) => k.metadata?.victimName).filter(Boolean)
		}
	};
}

/**
 * Flatten all grouped logs back to individual logs
 * Extracts children from groups and discards the group wrappers
 * This prevents duplicate issues when re-grouping stored logs
 */
export function flattenGroups(logs: Log[]): Log[] {
	const result: Log[] = [];

	for (const log of logs) {
		// If this log has children (is a group), add the children instead of the parent
		if (log.children && Array.isArray(log.children) && log.children.length > 0) {
			console.log(
				`[flattenGroups] Flattening group ${log.id} with ${log.children.length} children`
			);
			result.push(...log.children);
		} else {
			// Regular log without children
			result.push(log);
		}
	}

	console.log(`[flattenGroups] Flattened ${logs.length} logs to ${result.length} individual logs`);
	return result;
}

/**
 * Unified single-pass grouper - processes all grouping types in one iteration
 * Eliminates redundant loops by tracking all grouping states in parallel
 * Uses log IDs to prevent double-processing
 */
export function processAllGroupings(logs: Log[]): Log[] {
	const result: Log[] = [];
	const groupedLogIds = new Set<string>(); // Track which logs have been consumed by groups

	// Parallel grouping state
	let killingSpree: Log[] = [];
	let lastKillTime: Date | null = null;

	let equipmentGroup: Log[] = [];
	let lastEquipmentTime: Date | null = null;
	let currentEquipmentPlayer: string | null = null;

	let insuranceGroup: Log[] = [];
	let lastInsuranceTime: Date | null = null;

	const missionObjectiveGroups = new Map<string, Log[]>(); // Key: missionId-objectiveId
	const vehicleGroups = new Map<string, Log[]>(); // Key: vehicleId

	const SPREE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
	const MIN_SPREE_SIZE = 3;
	const EQUIPMENT_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes
	const MIN_EQUIPMENT_SIZE = 2;
	const INSURANCE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes
	const MIN_INSURANCE_SIZE = 2;
	const MIN_MISSION_OBJECTIVE_SIZE = 2;

	console.log('[processAllGroupings] Starting unified grouping, input logs:', logs.length);

	// Helper to finalize killing spree
	const finalizeKillingSpree = () => {
		if (killingSpree.length >= MIN_SPREE_SIZE) {
			const spreeLog = createSpreeLog(killingSpree);
			checkIdCollision(spreeLog.id, result, 'killing_spree');
			result.push(spreeLog);
			// Mark individual kill logs as grouped
			killingSpree.forEach((log) => groupedLogIds.add(log.id));
		} else {
			// Not enough for group, add individual logs
			killingSpree.forEach((log) => {
				if (!groupedLogIds.has(log.id)) {
					result.push(log);
				}
			});
		}
		killingSpree = [];
		lastKillTime = null;
	};

	// Helper to finalize equipment group
	const finalizeEquipment = () => {
		if (equipmentGroup.length >= MIN_EQUIPMENT_SIZE) {
			const groupLog = createEquipmentGroupLog(equipmentGroup);
			checkIdCollision(groupLog.id, result, 'equipment');
			result.push(groupLog);
			// Mark individual equipment logs as grouped
			equipmentGroup.forEach((log) => groupedLogIds.add(log.id));
		} else {
			// Not enough for group, add individual logs
			equipmentGroup.forEach((log) => {
				if (!groupedLogIds.has(log.id)) {
					result.push(log);
				}
			});
		}
		equipmentGroup = [];
		lastEquipmentTime = null;
		currentEquipmentPlayer = null;
	};

	// Helper to finalize insurance group
	const finalizeInsurance = () => {
		if (insuranceGroup.length >= MIN_INSURANCE_SIZE) {
			const groupLog = createInsuranceGroupLog(insuranceGroup);
			checkIdCollision(groupLog.id, result, 'insurance');
			result.push(groupLog);
			// Mark individual insurance logs as grouped
			insuranceGroup.forEach((log) => groupedLogIds.add(log.id));
		} else {
			// Not enough for group, add individual logs
			insuranceGroup.forEach((log) => {
				if (!groupedLogIds.has(log.id)) {
					result.push(log);
				}
			});
		}
		insuranceGroup = [];
		lastInsuranceTime = null;
	};

	// Helper to finalize mission objective groups
	const finalizeMissionObjectives = () => {
		missionObjectiveGroups.forEach((group) => {
			if (group.length >= MIN_MISSION_OBJECTIVE_SIZE) {
				const groupLog = createMissionObjectiveGroupLog(group);
				checkIdCollision(groupLog.id, result, 'mission_objective');
				result.push(groupLog);
				// Mark individual objective logs as grouped
				group.forEach((log) => groupedLogIds.add(log.id));
			} else {
				// Not enough for group, add individual logs
				group.forEach((log) => {
					if (!groupedLogIds.has(log.id)) {
						result.push(log);
					}
				});
			}
		});
		missionObjectiveGroups.clear();
	};

	// Helper to finalize vehicle control groups
	const finalizeVehicleGroups = () => {
		vehicleGroups.forEach((events) => {
			// Sort by timestamp
			events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

			// Process events to find request → grant → release sequences
			let i = 0;
			while (i < events.length) {
				const event = events[i];
				const action = event.metadata?.action;

				if (action === 'requesting') {
					// Look for matching 'granted' within 5 seconds
					const grantEvent = events.find(
						(e, idx) =>
							idx > i &&
							e.metadata?.action === 'granted' &&
							new Date(e.timestamp).getTime() - new Date(event.timestamp).getTime() < 5000
					);

					if (grantEvent) {
						// Found pair! Look for matching 'releasing' event
						const grantIndex = events.indexOf(grantEvent);
						const releaseEvent = events.find(
							(e, idx) => idx > grantIndex && e.metadata?.action === 'releasing'
						);

						// Create group
						const children = releaseEvent ? [event, grantEvent, releaseEvent] : [event, grantEvent];

						const groupLog = createVehicleControlGroupLog(children);
						checkIdCollision(groupLog.id, result, 'vehicle_control');
						result.push(groupLog);
						children.forEach((log) => groupedLogIds.add(log.id));

						// Skip processed events
						i = releaseEvent ? events.indexOf(releaseEvent) + 1 : grantIndex + 1;
					} else {
						// No grant found, add as individual log
						if (!groupedLogIds.has(event.id)) {
							result.push(event);
						}
						i++;
					}
				} else {
					// Standalone grant or release (shouldn't happen normally)
					if (!groupedLogIds.has(event.id)) {
						result.push(event);
					}
					i++;
				}
			}
		});
		vehicleGroups.clear();
	};

	// Single pass through all logs
	for (const log of logs) {
		const isKill = log.eventType === 'actor_death' && log.metadata?.killerName === log.player;
		const isEquipment = log.eventType === ('equipment_received' as any);
		const isInsurance = log.eventType === ('insurance_claim' as any);
		const isMissionObjective = log.eventType === ('mission_objective' as any);

		let logProcessed = false;

		// Process killing spree
		if (isKill) {
			const killTime = new Date(log.timestamp);

			// Check timeout
			if (lastKillTime && killTime.getTime() - lastKillTime.getTime() > SPREE_TIMEOUT_MS) {
				finalizeKillingSpree();
			}

			killingSpree.push(log);
			lastKillTime = killTime;
			logProcessed = true;
		} else if (killingSpree.length > 0) {
			// Non-kill encountered, finalize current spree
			finalizeKillingSpree();
		}

		// Process equipment
		if (isEquipment && log.player) {
			const eventTime = new Date(log.timestamp);

			// Check if this event is part of current group
			if (
				lastEquipmentTime &&
				currentEquipmentPlayer === log.player &&
				eventTime.getTime() - lastEquipmentTime.getTime() <= EQUIPMENT_TIMEOUT_MS
			) {
				equipmentGroup.push(log);
			} else {
				// Finish previous group
				if (equipmentGroup.length > 0) {
					finalizeEquipment();
				}
				equipmentGroup = [log];
				currentEquipmentPlayer = log.player;
			}
			lastEquipmentTime = eventTime;
			logProcessed = true;
		} else if (equipmentGroup.length > 0 && (!isEquipment || !log.player)) {
			// Non-equipment encountered, finalize current group
			finalizeEquipment();
		}

		// Process insurance
		if (isInsurance) {
			const eventTime = new Date(log.timestamp);

			// Check if this event is part of current group
			if (
				lastInsuranceTime &&
				eventTime.getTime() - lastInsuranceTime.getTime() <= INSURANCE_TIMEOUT_MS
			) {
				insuranceGroup.push(log);
			} else {
				// Finish previous group
				if (insuranceGroup.length > 0) {
					finalizeInsurance();
				}
				insuranceGroup = [log];
			}
			lastInsuranceTime = eventTime;
			logProcessed = true;
		} else if (insuranceGroup.length > 0 && !isInsurance) {
			// Non-insurance encountered, finalize current group
			finalizeInsurance();
		}

		// Process mission objectives
		if (isMissionObjective && log.metadata?.missionId && log.metadata?.objectiveId) {
			const key = `${log.metadata.missionId}-${log.metadata.objectiveId}`;
			if (!missionObjectiveGroups.has(key)) {
				missionObjectiveGroups.set(key, []);
			}
			missionObjectiveGroups.get(key)!.push(log);
			logProcessed = true;
		} else if (missionObjectiveGroups.size > 0 && !isMissionObjective) {
			// Non-objective encountered, finalize all mission objective groups
			finalizeMissionObjectives();
		}

		// Process vehicle control flow
		if (log.eventType === 'vehicle_control_flow' && log.metadata?.vehicleId) {
			const vehicleId = log.metadata.vehicleId as string;
			if (!vehicleGroups.has(vehicleId)) {
				vehicleGroups.set(vehicleId, []);
			}
			vehicleGroups.get(vehicleId)!.push(log);
			logProcessed = true;
		}

		// If log wasn't processed by any grouper, add it to result
		if (!logProcessed && !groupedLogIds.has(log.id)) {
			result.push(log);
		}
	}

	// Finalize any remaining groups
	if (killingSpree.length > 0) {
		finalizeKillingSpree();
	}
	if (equipmentGroup.length > 0) {
		finalizeEquipment();
	}
	if (insuranceGroup.length > 0) {
		finalizeInsurance();
	}
	if (missionObjectiveGroups.size > 0) {
		finalizeMissionObjectives();
	}
	if (vehicleGroups.size > 0) {
		finalizeVehicleGroups();
	}

	console.log('[processAllGroupings] Completed unified grouping, output logs:', result.length);
	return result;
}
