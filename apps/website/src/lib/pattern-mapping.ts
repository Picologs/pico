/**
 * LogFeed Event Type Mappings
 *
 * Maps existing LogFeed event types to their corresponding log pattern signatures.
 * Used for gap analysis to identify which patterns are already handled vs candidates for addition.
 */

import type { PatternCategory } from './pattern-utils';

// LogFeed event types (from @pico/types)
export type LogEventType =
	| 'connection'
	| 'vehicle_control_flow'
	| 'actor_death'
	| 'location_change'
	| 'destruction'
	| 'system_quit'
	| 'hospital_respawn'
	| 'mission_shared'
	| 'mission_completed'
	| 'mission_ended'
	| 'mission_objective'
	| 'hangar_door'
	| 'docking_tube'
	| 'landing_pad'
	| 'medical_bed'
	| 'purchase'
	| 'insurance_claim'
	| 'quantum_travel'
	| 'quantum_arrival'
	| 'equipment_received'
	| 'equipment_equip'
	| 'environmental_hazard'
	| 'fatal_collision'
	| 'item_placement'
	| 'bounty_marker'
	| 'bounty_kill'
	// Grouped/composite events (not relevant for pattern mapping)
	| 'killing_spree'
	| 'corpsify'
	| 'equipment_group'
	| 'insurance_group'
	| 'vehicle_control_group'
	| 'vehicle_error_group'
	| 'vehicle_exit_group'
	| 'mission_group'
	| 'mission_objective_group'
	| 'environmental_hazard_group'
	| 'inventory_group'
	| 'quantum_travel_group'
	| 'respawn_group'
	| 'crash_death_group'
	| 'cross_player_group'
	| 'bounty_kill_group';

export interface LogFeedMapping {
	eventType: LogEventType;
	category: PatternCategory;
	/** Event name patterns that map to this LogFeed type (case-insensitive contains) */
	eventNamePatterns: string[];
	/** Description of what this event type captures */
	description: string;
}

/**
 * Mappings from LogFeed event types to log pattern signatures
 * Used to identify which patterns are already "handled" by LogFeed
 */
export const LOG_FEED_MAPPINGS: LogFeedMapping[] = [
	// ============================================================================
	// Session Events
	// ============================================================================
	{
		eventType: 'connection',
		category: 'player_action',
		eventNamePatterns: [
			'AccountLoginCharacterStatus_Character',
			'AccountLoginCharacterStatus',
			'LoginCharacter',
			'LoginCompleted',
			'InitiateLogin',
			'AsyncLoginCallback',
			'CDiffusionCryClient::OnLoginCompleted',
			'SubscribeToPlayerSocial',
			'SubscribeToFriendMessages'
		],
		description: 'Player connection and character selection'
	},
	{
		eventType: 'system_quit',
		category: 'system',
		eventNamePatterns: ['SystemQuit', 'System Quit'],
		description: 'Game client shutdown'
	},

	// ============================================================================
	// Combat Events
	// ============================================================================
	{
		eventType: 'actor_death',
		category: 'combat',
		eventNamePatterns: ['Actor Death', 'ActorDeath', '[ActorState] Dead', 'CActor::Kill'],
		description: 'Player or NPC death events'
	},
	{
		eventType: 'destruction',
		category: 'combat',
		eventNamePatterns: ['Vehicle Destruction', 'VehicleDestruction', 'DestroyLevel'],
		description: 'Vehicle destruction events'
	},
	{
		eventType: 'fatal_collision',
		category: 'combat',
		eventNamePatterns: ['FatalCollision', 'Fatal Collision'],
		description: 'Fatal vehicle collision events'
	},

	// ============================================================================
	// Navigation Events
	// ============================================================================
	{
		eventType: 'vehicle_control_flow',
		category: 'navigation',
		eventNamePatterns: ['Vehicle Control Flow', 'VehicleControlFlow'],
		description: 'Vehicle control state changes (enter/exit)'
	},
	{
		eventType: 'location_change',
		category: 'navigation',
		eventNamePatterns: [
			'RequestLocationInventory',
			'LocationInventory',
			'GenerateLocationProperty',
			'CEntityComponentShipListProvider'
		],
		description: 'Location/zone changes'
	},
	{
		eventType: 'quantum_travel',
		category: 'navigation',
		eventNamePatterns: ['Jump Drive Requesting State Change', 'QuantumTravel', 'Quantum Travel'],
		description: 'Quantum travel initiation'
	},
	{
		eventType: 'quantum_arrival',
		category: 'navigation',
		eventNamePatterns: ['Quantum Drive Arrived', 'QuantumArrival'],
		description: 'Quantum travel arrival'
	},
	{
		eventType: 'landing_pad',
		category: 'navigation',
		eventNamePatterns: ['CSCLoadingPlatformManager', 'LandingPad', 'Landing Pad'],
		description: 'Landing pad interactions'
	},
	{
		eventType: 'hangar_door',
		category: 'navigation',
		eventNamePatterns: ['HangarDoor', 'Hangar Door'],
		description: 'Hangar door operations'
	},
	{
		eventType: 'docking_tube',
		category: 'navigation',
		eventNamePatterns: ['DockingTube', 'Docking Tube', 'CDockingAnimatorComponent', 'CSCItemDockingTube'],
		description: 'Docking tube connections'
	},

	// ============================================================================
	// Mission Events
	// ============================================================================
	{
		eventType: 'mission_shared',
		category: 'mission',
		eventNamePatterns: ['MissionShared', 'Mission Shared', 'MissionSharedOnMessaged', 'PlayerJoined', 'PlayerLeft'],
		description: 'Mission sharing events'
	},
	{
		eventType: 'mission_completed',
		category: 'mission',
		eventNamePatterns: ['MissionEnded', 'Mission Ended', 'MissionComplete'],
		description: 'Mission completion events'
	},
	{
		eventType: 'mission_ended',
		category: 'mission',
		eventNamePatterns: ['EndMission', 'End Mission'],
		description: 'Mission end events'
	},
	{
		eventType: 'mission_objective',
		category: 'mission',
		eventNamePatterns: [
			'ObjectiveUpserted',
			'Objective Upserted',
			'CObjectiveMarkerComponent',
			'CMissionLogEntry',
			'CSubsumptionMissionComponent',
			'CommsNotifications',
			'SHUDEvent_OnCommsNotification',
			'SpawnCommsEntity',
			'LocalPlayerNotifications::StatusUpdate',
			'CSCPlayerMissionLog'
		],
		description: 'Mission objective updates'
	},
	{
		eventType: 'bounty_marker',
		category: 'mission',
		eventNamePatterns: ['CLocalMissionPhaseMarker::CreateMarker', 'KillShip'],
		description: 'Bounty target marker creation'
	},
	{
		eventType: 'bounty_kill',
		category: 'mission',
		eventNamePatterns: [], // Derived from ObjectiveUpserted with specific state
		description: 'Bounty kill confirmation'
	},

	// ============================================================================
	// Economy Events
	// ============================================================================
	{
		eventType: 'purchase',
		category: 'economy',
		eventNamePatterns: [
			'CEntityComponentShoppingProvider::SendStandardItemBuyRequest',
			'CEntityComponentShoppingProvider::RmShopFlowResponse',
			'CEntityComponentShoppingProvider::OnGainedAuthority',
			'CEntityComponentShopUIProvider',
			'ItemBuyRequest',
			'Purchase'
		],
		description: 'Item purchase events'
	},
	{
		eventType: 'insurance_claim',
		category: 'economy',
		eventNamePatterns: [
			'CWallet::ProcessClaimToNextStep',
			'CWallet::RmMulticastOnProcessClaimCallback',
			'CEntityComponentShipInsuranceProvider',
			'InsuranceClaim',
			'Insurance Claim'
		],
		description: 'Insurance claim events'
	},

	// ============================================================================
	// Medical/Respawn Events
	// ============================================================================
	{
		eventType: 'hospital_respawn',
		category: 'player_action',
		eventNamePatterns: ['Spawn Flow', 'lost reservation for spawnpoint'],
		description: 'Hospital respawn events'
	},
	{
		eventType: 'medical_bed',
		category: 'player_action',
		eventNamePatterns: ['CEntity::OnOwnerRemoved', 'MedicalBed', 'Medical Bed'],
		description: 'Medical bed usage events'
	},

	// ============================================================================
	// Equipment Events
	// ============================================================================
	{
		eventType: 'equipment_received',
		category: 'player_action',
		eventNamePatterns: [
			'AttachmentReceived',
			'Attachment Received',
			'InventoryManagement',
			'InventoryManagementRequest',
			'RequestInventory',
			'QueryInventory',
			'StoreItem',
			'OpenInventory',
			'OnInventoryStoreItem',
			'OnDragInventoryItemModifyTarget',
			'RequestOrCreatePersonalInventoryData'
		],
		description: 'Equipment attachment and inventory events'
	},
	{
		eventType: 'equipment_equip',
		category: 'player_action',
		eventNamePatterns: ['EquipItem', 'Equip Item'],
		description: 'Equipment equip events'
	},
	{
		eventType: 'item_placement',
		category: 'player_action',
		eventNamePatterns: ['[ActorState] Place', 'ItemPlacement'],
		description: 'Item placement events'
	},

	// ============================================================================
	// Environmental Events
	// ============================================================================
	{
		eventType: 'environmental_hazard',
		category: 'environment',
		eventNamePatterns: ['STAMINA', 'Suffocation', 'Depressurization', 'EnvironmentalHazard'],
		description: 'Environmental hazard events'
	}
];

/**
 * Check if a pattern's event name matches any LogFeed event type
 * Returns the matching LogFeed type or null if unhandled
 */
export function findMatchingLogFeedType(eventName: string): LogEventType | null {
	const eventNameLower = eventName.toLowerCase();

	for (const mapping of LOG_FEED_MAPPINGS) {
		if (mapping.eventNamePatterns.length === 0) continue;

		for (const pattern of mapping.eventNamePatterns) {
			if (eventNameLower.includes(pattern.toLowerCase())) {
				return mapping.eventType;
			}
		}
	}

	return null;
}

/**
 * Suggest which LogFeed event type a pattern could extend
 * Based on category matching when no direct pattern match exists
 */
export function suggestLogFeedType(
	eventName: string,
	category: PatternCategory
): { type: LogEventType; confidence: 'high' | 'medium' | 'low' } | null {
	// First check for direct match
	const directMatch = findMatchingLogFeedType(eventName);
	if (directMatch) {
		return { type: directMatch, confidence: 'high' };
	}

	// Find types in the same category
	const categoryMatches = LOG_FEED_MAPPINGS.filter((m) => m.category === category);

	if (categoryMatches.length === 0) {
		return null; // New category needed
	}

	// Check for partial name similarity
	const eventNameLower = eventName.toLowerCase();
	for (const mapping of categoryMatches) {
		// Check if any word from the event type appears in the event name
		const typeWords = mapping.eventType.split('_');
		const matchingWords = typeWords.filter(
			(word) => word.length > 3 && eventNameLower.includes(word)
		);

		if (matchingWords.length > 0) {
			return { type: mapping.eventType, confidence: 'medium' };
		}
	}

	// Return first category match as low confidence suggestion
	return { type: categoryMatches[0].eventType, confidence: 'low' };
}

/**
 * Get all LogFeed types grouped by category
 */
export function getLogFeedTypesByCategory(): Map<PatternCategory, LogFeedMapping[]> {
	const result = new Map<PatternCategory, LogFeedMapping[]>();

	for (const mapping of LOG_FEED_MAPPINGS) {
		const existing = result.get(mapping.category) || [];
		existing.push(mapping);
		result.set(mapping.category, existing);
	}

	return result;
}

/**
 * Get coverage stats for gap analysis
 */
export function getCoverageStats(
	patterns: Array<{ eventName: string; category: PatternCategory | string | null }>
): {
	handled: number;
	unhandled: number;
	byCategoryHandled: Map<PatternCategory, number>;
	byCategoryUnhandled: Map<PatternCategory, number>;
} {
	let handled = 0;
	let unhandled = 0;
	const byCategoryHandled = new Map<PatternCategory, number>();
	const byCategoryUnhandled = new Map<PatternCategory, number>();

	for (const pattern of patterns) {
		const category = (pattern.category as PatternCategory) || 'uncategorized';
		const isHandled = findMatchingLogFeedType(pattern.eventName) !== null;

		if (isHandled) {
			handled++;
			byCategoryHandled.set(category, (byCategoryHandled.get(category) || 0) + 1);
		} else {
			unhandled++;
			byCategoryUnhandled.set(category, (byCategoryUnhandled.get(category) || 0) + 1);
		}
	}

	return { handled, unhandled, byCategoryHandled, byCategoryUnhandled };
}
