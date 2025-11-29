/**
 * Custom log event types for Star Citizen
 * These extend the base LogEventType from @pico/types
 */

/**
 * Additional event types for local parsing
 * These will eventually be migrated to @pico/types
 */
export type CustomLogEventType =
	| 'mission_shared' // Friend shares mission with you
	| 'mission_objective' // Mission objective progress updates
	| 'mission_completed' // Mission completion
	| 'hangar_door' // Hangar door state changes
	| 'docking_tube' // Docking tube connections
	| 'landing_pad' // Landing platform status
	| 'hospital_respawn' // Hospital bed reservations
	| 'medical_bed' // Medical bed detachment (respawn)
	| 'purchase' // Shopping purchases
	| 'insurance_claim' // Insurance claims
	| 'quantum_travel' // Quantum travel state changes
	| 'equipment_received'; // Equipment attached to player

/**
 * Extended metadata for custom event types
 * Extends the base LogMetadata from @pico/types
 */
export interface CustomLogMetadata {
	// Mission events
	missionId?: string;
	objectiveId?: string;
	missionState?: string;
	objectiveState?: string;
	ownerId?: string;

	// Docking events
	landingArea?: string;
	hangarDoor?: string;
	doorState?: string;
	tubeState?: string;
	lastTubeState?: string;
	platformId?: string;

	// Medical events
	bedId?: string;
	spawnpointId?: string;
	locationId?: string;

	// Economy events
	itemName?: string;
	itemPrice?: string;
	shopName?: string;
	entitlementURN?: string;

	// Quantum travel
	qtStateFrom?: string;
	qtStateTo?: string;
	qtReason?: string;
	qtZone?: string;

	// Equipment
	attachmentName?: string;
	attachmentStatus?: string;
	attachmentPort?: string;

	// Allow any additional fields
	[key: string]: unknown;
}
