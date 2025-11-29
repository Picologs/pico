/**
 * Log Types
 *
 * Core log types for Star Citizen event tracking across all applications.
 * These types are used by picologs desktop app, website, and bun-server.
 *
 * @module types/core/log
 */

/**
 * Event type classification for Star Citizen game events
 */
export type LogEventType =
  | "connection"
  | "vehicle_control_flow"
  | "actor_death"
  | "location_change"
  | "destruction"
  | "system_quit"
  // Desktop-specific individual events
  | "hospital_respawn"
  | "mission_shared"
  | "mission_completed"
  | "mission_ended"
  | "mission_objective"
  | "hangar_door"
  | "docking_tube"
  | "landing_pad"
  | "medical_bed"
  | "purchase"
  | "insurance_claim"
  | "quantum_travel"
  | "quantum_arrival"
  | "equipment_received"
  | "equipment_equip"
  | "environmental_hazard"
  | "fatal_collision"
  | "item_placement"
  // Bounty events (SC 4.4.x+ - derived from mission objectives)
  | "bounty_marker"
  | "bounty_kill"
  // Grouped/composite events
  | "killing_spree"
  | "corpsify"
  | "equipment_group"
  | "insurance_group"
  | "vehicle_control_group"
  | "vehicle_error_group"
  | "vehicle_exit_group"
  | "mission_group"
  | "mission_objective_group"
  | "environmental_hazard_group"
  | "inventory_group"
  | "quantum_travel_group"
  | "respawn_group"
  | "crash_death_group"
  | "cross_player_group"
  | "bounty_kill_group";

/**
 * Rich metadata for game events
 */
export interface LogMetadata {
  // Vehicle/Ship metadata
  vehicleName?: string;
  vehicleId?: string;
  team?: string;
  entityType?: string;
  action?:
    | "requesting"
    | "granted"
    | "releasing"
    | "unknown"
    | "placing"
    | "placed";

  // Combat metadata
  victimName?: string;
  victimId?: string;
  killerName?: string;
  killerId?: string;
  weaponInstance?: string;
  weaponClass?: string;
  damageType?: string;
  deathCause?: string;

  // Location metadata
  zone?: string;
  location?: string;
  spawnpoint?: string;

  // Direction (for damage/movement)
  direction?: {
    x: string;
    y: string;
    z: string;
  };

  // Destruction metadata
  destroyLevel?: string;
  destroyLevelFrom?: string;
  destroyLevelTo?: string;
  causeName?: string;
  causeId?: string;

  // Player metadata
  player?: string;
  playerId?: string;
  reason?: string;

  // Equipment/Item metadata
  itemName?: string;
  itemId?: string;
  itemClass?: string;
  attachmentName?: string;
  attachmentStatus?: string;
  attachmentPort?: string;
  port?: string;
  postAction?: string;

  // Collision metadata
  hitEntity?: string;
  hitEntityPlayer?: string;
  hitEntityShip?: string;
  part?: string;
  crashPart?: string;

  // Mission metadata
  missionId?: string;
  completionType?: string;

  // Bounty metadata (SC 4.4.x+ - derived from mission objectives)
  objectiveId?: string;
  generatorName?: string;
  contract?: string;
  targetType?: string;
  isAIKill?: boolean;

  // Allow additional custom metadata
  [key: string]: unknown;
}

/**
 * Ship event grouping (for vehicle control flow events)
 */
export interface ShipGroup {
  vehicleId: string;
  vehicleName: string;
  team: string;
  location: string;
  events: Log[];
}

/**
 * Complete log entry with all metadata and relationships
 *
 * This is the canonical Log type used across all applications.
 * It includes all fields needed for rich event display and grouping.
 */
export interface Log {
  /** Unique log ID (deterministic hash based on timestamp + line) */
  id: string;

  /** User ID who generated this log */
  userId: string;

  /** Star Citizen player name (null for system logs) */
  player: string | null;

  /** Display emoji for the event type */
  emoji: string;

  /** Formatted log line for display */
  line: string;

  /** ISO 8601 timestamp */
  timestamp: string;

  /** Original raw log text (shown when expanded) */
  original: string;

  /** UI state: whether log details are expanded */
  open: boolean;

  /** List of user IDs who reported this log (for multi-user scenarios) */
  reportedBy?: string[];

  /** Event type classification */
  eventType?: LogEventType;

  /** Rich event metadata */
  metadata?: LogMetadata;

  /** Ship event grouping (for vehicle control flow) */
  ship?: ShipGroup;

  /** Child logs (for killing sprees, grouped events) */
  children?: Log[];
}

/**
 * Optimized log format for network transmission
 *
 * Excludes fields not needed by recipients:
 * - `original`: Raw log text (only needed locally for expand/collapse)
 * - `open`: UI state (recipient manages their own UI state)
 * - Converts `children` to LogTransmit format recursively
 *
 * This reduces payload size by ~50% for typical log entries.
 *
 * @see {@link Log} for the complete log structure
 */
export type LogTransmit = Omit<Log, "original" | "open" | "children"> & {
  /** Child logs in transmit format (recursive) */
  children?: LogTransmit[];
};

/**
 * Convert a Log object to LogTransmit format for network transmission
 *
 * Removes the 'original' field (raw log text) and 'open' UI state to reduce
 * payload size. Recursively processes children if present.
 *
 * @param log - The full Log object from local storage
 * @returns Optimized LogTransmit object for network transmission
 */
export function toLogTransmit(log: Log): LogTransmit {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { original, open, children, ...rest } = log;

  const transmit: LogTransmit = rest;

  // Recursively convert children if present
  if (children && children.length > 0) {
    transmit.children = children.map(toLogTransmit);
  }

  return transmit;
}

/**
 * Convert LogTransmit back to Log format (for receiving)
 *
 * Adds default values for fields not transmitted:
 * - `original`: Empty string (not transmitted)
 * - `open`: false (default UI state)
 *
 * @param transmitted - The LogTransmit object received from network
 * @param defaults - Optional default values to merge
 * @returns Complete Log object with default values
 */
export function fromLogTransmit(
  transmitted: LogTransmit,
  defaults?: { original?: string; open?: boolean },
): Log {
  const { children, ...rest } = transmitted;

  const log: Log = {
    ...rest,
    original: defaults?.original ?? "",
    open: defaults?.open ?? false,
  };

  // Recursively convert children if present
  if (children && children.length > 0) {
    log.children = children.map((child) => fromLogTransmit(child, defaults));
  }

  return log;
}

/**
 * Recent event type (simplified log representation)
 */
export interface RecentEvent {
  eventType: string;
  timestamp: string;
  player: string;
  emoji: string;
  metadata: Record<string, unknown>;
}

/**
 * Simple log line representation (minimal fields)
 */
export interface LogLine {
  timestamp: string;
  player: string | null;
  emoji: string;
  line: string;
}

/**
 * Log sync options for requesting historical logs
 */
export interface LogSyncOptions {
  /** ISO timestamp to sync from (only logs after this time) */
  since?: string;
  /** Maximum number of logs to return */
  limit?: number;
}

// ============================================================================
// Log Schema Discovery Types
// ============================================================================

/**
 * Raw log pattern extracted from Game.log files
 *
 * Used for crowdsourced log schema discovery - the desktop app extracts
 * patterns from log files and reports them to the server for cataloging.
 */
export interface RawLogPattern {
  /** Event name from <EventName> in log (null if not present) */
  eventName: string | null;
  /** Severity level: Notice, Error, Trace, Warning, or null */
  severity: string | null;
  /** Team tags from [Team_XXX] brackets */
  teams: string[];
  /** Subsystem tags from other [Tag] brackets */
  subsystems: string[];
  /** Stable hash signature for deduplication */
  signature: string;
  /** Raw example log line */
  exampleLine: string;
}
