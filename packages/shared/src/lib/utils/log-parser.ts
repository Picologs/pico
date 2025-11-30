/**
 * Star Citizen Log Parser (4.3.x+ Format)
 *
 * Parses Game.log files from Star Citizen and converts raw log lines
 * into structured Log objects with rich metadata.
 *
 * This parser handles the NEW log format introduced in Star Citizen 4.3.x:
 * - Connection: `geid X` and `name Y` (no quotes, no equals)
 * - Location: `Location[X]` (square brackets)
 * - Vehicle Control: `for 'X'` (single quotes)
 * - Actor Death: `CActor::Kill: 'X'` (single quotes)
 * - Actor State Death: `<[ActorState] Dead>` Actor 'X' ejected from zone (4.4.x+)
 * - Destruction: `Vehicle 'X'` (single quotes)
 * - Fatal Collision: `<FatalCollision>` vehicle crash details (4.4.x+)
 * - Mission End: `<EndMission>` detailed mission completion (4.4.x+)
 * - Item Placement: `<[ActorState] Place>` player placing items (4.4.x+)
 * - Quantum Arrival: `<Quantum Drive Arrived>` QT destination reached (4.4.x+)
 * - Equip Item: `<EquipItem>` inventory equipment actions (4.4.x+)
 *
 * @module utils/log-parser
 */

import type { Log } from "@pico/types";
import { generateId } from "./log-id.js";
import { getCleanShipName, cleanShipName } from "./ship-name-cleaner.js";
import { getCleanNPCName } from "./npc-name-cleaner.js";

/**
 * Player Registry: Maps entity IDs to player names
 * Populated from connection events, actor deaths, vehicle destruction, etc.
 */
const playerRegistry = new Map<string, string>();

/**
 * Current Player: The log file owner (extracted from connection events)
 * This is the user whose game logs we are parsing
 */
let currentPlayer: string | null = null;

/**
 * Current Player Ship: The ship the player is currently flying
 * Tracked from vehicle control flow events (granted/releasing)
 */
let currentPlayerShip: { vehicleName: string; vehicleId: string } | null = null;

/**
 * Seen Ship IDs: Track ships that have already triggered events
 * Used to deduplicate starmap navigation events (show each ship only once)
 */
const seenShipIds = new Set<string>();

/**
 * Equipment Cache Entry: Tracks recent equipment events per player
 * Used to deduplicate and aggregate equipment events during login/respawn
 */
interface EquipmentCacheEntry {
  lastEmitTime: number;
  itemCount: number;
  items: Set<string>;
}

/**
 * Equipment Cache: Maps player names to their recent equipment events
 * Aggregates equipment events within 5-second windows to prevent flooding
 */
const equipmentCache = new Map<string, EquipmentCacheEntry>();

/**
 * Equipment cache timeout in milliseconds (5 seconds)
 * Events within this window are aggregated into a single event
 */
const EQUIPMENT_CACHE_TIMEOUT_MS = 5000;

/**
 * Equipment cache cleanup threshold (60 seconds)
 * Entries older than this are removed during cleanup
 */
const EQUIPMENT_CACHE_CLEANUP_MS = 60000;

/**
 * Bounty Marker Cache Entry: Tracks bounty target markers from CLocalMissionPhaseMarker
 * Used to correlate ObjectiveUpserted COMPLETED events with bounty kills
 */
interface BountyMarkerCacheEntry {
  missionId: string;
  generatorName: string;
  contract: string;
  timestamp: number;
}

/**
 * Bounty Marker Cache: Maps missionId to marker data
 * When ObjectiveUpserted COMPLETED fires for a tracked mission, emit bounty_kill
 */
const bountyMarkerCache = new Map<string, BountyMarkerCacheEntry>();

/**
 * Bounty Kill Emitted: Set of missionIds that already emitted a bounty_kill
 * Prevents duplicate bounty_kill events for the same mission
 */
const bountyKillEmitted = new Set<string>();

/**
 * Bounty marker cache timeout in milliseconds (30 minutes)
 * Markers older than this are considered stale and removed
 */
const BOUNTY_MARKER_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Clean up stale equipment cache entries
 * Removes entries older than EQUIPMENT_CACHE_CLEANUP_MS
 */
function cleanupEquipmentCache(): void {
  const now = Date.now();
  for (const [player, entry] of equipmentCache.entries()) {
    if (now - entry.lastEmitTime > EQUIPMENT_CACHE_CLEANUP_MS) {
      equipmentCache.delete(player);
    }
  }
}

/**
 * Clean up stale bounty marker cache entries
 * Removes entries older than BOUNTY_MARKER_TIMEOUT_MS
 */
function cleanupBountyMarkerCache(): void {
  const now = Date.now();
  for (const [missionId, entry] of bountyMarkerCache.entries()) {
    if (now - entry.timestamp > BOUNTY_MARKER_TIMEOUT_MS) {
      bountyMarkerCache.delete(missionId);
      bountyKillEmitted.delete(missionId);
    }
  }
}

/**
 * Clear bounty tracking for a specific mission
 * Called when MissionEnded is received
 */
function clearBountyMission(missionId: string): void {
  bountyMarkerCache.delete(missionId);
  bountyKillEmitted.delete(missionId);
}

/**
 * Parse target type from contract name
 * e.g., "InterSec_Bounty_Nyx_Easy" → "Easy"
 */
function parseTargetTypeFromContract(contract: string): string | undefined {
  const match = contract.match(/_(Easy|Medium|Hard|VHRT|ERT|Intro)$/i);
  return match ? match[1] : undefined;
}

/**
 * Register a player in the registry
 * Skips registration for "unknown" and entity ID 0
 */
function registerPlayer(
  entityId: string | undefined,
  name: string | undefined,
): void {
  if (!entityId || !name || entityId === "0" || name === "unknown") {
    return;
  }
  playerRegistry.set(entityId, name);
}

/**
 * Get player name from registry by entity ID
 */
function getPlayerName(entityId: string | undefined): string | null {
  if (!entityId) return null;
  return playerRegistry.get(entityId) || null;
}

/**
 * Format mission objective state for display
 * Converts "MISSION_OBJECTIVE_STATE_INPROGRESS" to "In Progress"
 */
export function formatMissionObjectiveState(state: string): string {
  return state
    .replace(/^MISSION_OBJECTIVE_STATE_/, "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Reset parser state (call when starting new log file)
 */
export function resetParserState(): void {
  playerRegistry.clear();
  currentPlayer = null;
  currentPlayerShip = null;
  seenShipIds.clear();
  equipmentCache.clear();
  bountyMarkerCache.clear();
  bountyKillEmitted.clear();
}

/**
 * Get the current player (log file owner)
 */
export function getCurrentPlayer(): string | null {
  return currentPlayer;
}

/**
 * Set the current player (log file owner)
 */
export function setCurrentPlayer(name: string | null): void {
  currentPlayer = name;
}

/**
 * Parse timestamp from log line
 * Format: <2025-11-02T07:47:09.855Z>
 */
export function parseLogTimestamp(line: string): string | null {
  const timestampMatch = line.match(
    /<(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)>/,
  );
  return timestampMatch ? timestampMatch[1] : null;
}

/**
 * Converts camelCase or PascalCase to space-separated lowercase words
 */
function convertCamelCaseToWords(str: string): string {
  return str
    .replace(/([A-Z])/g, " $1")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Clean player name by removing NPC indicators or formatting NPC archetypes
 */
function cleanPlayerName(name: string): string {
  // Try NPC archetype cleaning first
  if (name.startsWith("NPC_Archetypes-")) {
    return getCleanNPCName(name);
  }
  // Remove PU_ prefix and _NPC_ indicators
  return name.replace(/^PU_/, "").replace(/_NPC_.*$/, "");
}

/**
 * Check if entity is an NPC
 */
function isNPC(name: string): boolean {
  return (
    name.startsWith("PU_") ||
    name.includes("_NPC_") ||
    name.includes("AIModule") ||
    name.startsWith("NPC_Archetypes-")
  );
}

/**
 * Parse connection event
 * Format: <AccountLoginCharacterStatus_Character> Character: ... geid 201990709919 - ... - name space-man-rob - ...
 */
function parseConnectionEvent(line: string, timestamp: string): Log | null {
  if (!line.includes("AccountLoginCharacterStatus_Character")) return null;

  // Extract geid (entity ID)
  const geidMatch = line.match(/geid\s+(\d+)/);
  if (!geidMatch) return null;

  // Extract name (match until " - " delimiter to support hyphenated names like "space-man-rob")
  const nameMatch = line.match(/name\s+(.+?)\s+-\s+/);
  if (!nameMatch) return null;

  const playerName = nameMatch[1];
  const entityId = geidMatch[1];

  // Register player in registry
  registerPlayer(entityId, playerName);

  // Set as current player (log file owner)
  currentPlayer = playerName;

  return {
    id: generateId(new Date(timestamp), line),
    userId: "local",
    player: playerName,
    emoji: "🔗",
    line: `${playerName} connected to server`,
    timestamp,
    original: line,
    open: false,
    eventType: "connection",
    metadata: {
      playerId: entityId,
      playerName: playerName,
    },
  };
}

/**
 * Parse location/inventory request
 * Format: <RequestLocationInventory> Player[space-man-rob] requested inventory for Location[RR_CRU_LEO]
 */
function parseLocationChange(line: string, timestamp: string): Log | null {
  if (!line.includes("<RequestLocationInventory>")) return null;

  // Extract location
  const locationMatch = line.match(/Location\[([^\]]+)\]/);
  if (!locationMatch) return null;

  // Extract player
  const playerMatch = line.match(/Player\[([^\]]+)\]/);
  const playerName = playerMatch ? playerMatch[1] : currentPlayer;

  const location = locationMatch[1];

  return {
    id: generateId(new Date(timestamp), line),
    userId: "local",
    player: currentPlayer,
    emoji: "📍",
    line: `${playerName || "Player"} opened inventory at ${location}`,
    timestamp,
    original: line,
    open: false,
    eventType: "location_change",
    metadata: {
      location,
    },
  };
}

/**
 * Parse vehicle control flow
 * Format: <Vehicle Control Flow> ... Local client node [201990709919] requesting/granted/releasing control token for 'AEGS_Gladius_7174409165064' [7174409165064]
 */
function parseVehicleControlFlow(line: string, timestamp: string): Log | null {
  if (!line.includes("<Vehicle Control Flow>")) return null;

  // Extract player entity ID from "Local client node [ID]"
  const playerEntityIdMatch = line.match(/Local client node \[(\d+)\]/);
  const playerEntityId = playerEntityIdMatch?.[1];

  // Extract vehicle name (after "for")
  const vehicleMatch = line.match(/for\s+'([^']+)'/);
  if (!vehicleMatch) return null;

  const vehicleName = vehicleMatch[1];

  // Skip "Default" vehicle names (e.g., Default_17518)
  if (vehicleName.startsWith("Default_") || vehicleName === "Default") {
    return null;
  }

  // Clean the ship name
  const cleanedVehicleName = getCleanShipName(vehicleName);

  // Extract vehicle entity ID (after vehicle name)
  const vehicleEntityIdMatch = line.match(/for\s+'[^']+'\s+\[(\d+)\]/);
  const vehicleEntityId = vehicleEntityIdMatch?.[1];

  // Determine action type first
  let actionType: "requesting" | "granted" | "releasing" | "unknown" =
    "unknown";

  if (line.includes("requesting")) {
    actionType = "requesting";
  } else if (line.includes("granted")) {
    actionType = "granted";
  } else if (line.includes("releasing")) {
    actionType = "releasing";
  }

  // Look up player name from registry
  const playerName = getPlayerName(playerEntityId) || currentPlayer;

  // Track player's current ship (needed for other features)
  if (playerName === currentPlayer) {
    if (actionType === "granted") {
      // Player entered a ship
      currentPlayerShip = {
        vehicleName: cleanedVehicleName,
        vehicleId: vehicleEntityId || "",
      };
    } else if (actionType === "releasing") {
      // Player exited the ship
      currentPlayerShip = null;
    }
  }

  // Skip "requesting" events - but include "granted" and "releasing" (releasing needed for crash-death grouping)
  if (actionType === "requesting") {
    return null;
  }

  // Set display values based on action type
  const emoji = ""; // No emoji - ship image will be used in UI
  const actionText = actionType === "granted" ? "controls" : "exited";

  return {
    id: generateId(new Date(timestamp), line),
    userId: "local",
    player: currentPlayer,
    emoji: emoji,
    line: `${playerName || "Player"} ${actionText} ${cleanedVehicleName}`,
    timestamp,
    original: line,
    open: false,
    eventType: "vehicle_control_flow",
    metadata: {
      vehicleName: cleanedVehicleName,
      vehicleId: vehicleEntityId,
      playerId: playerEntityId,
      action: actionType,
    },
  };
}

/**
 * Parse starmap navigation event (alternative to vehicle control flow)
 * Format: <Failed to get starmap route data!> ... ANVL_Paladin_737650187803[737650187803]|CSCItemNavigation::GetStarmapRouteSegmentData
 */
function parseStarmapNavigationEvent(
  line: string,
  timestamp: string,
): Log | null {
  if (!line.includes("<Failed to get starmap route data!>")) return null;

  // Extract vehicle name and ID: SHIP_NAME[ID]
  const vehicleMatch = line.match(
    /([A-Za-z_0-9]+)\[(\d+)\]\|CSCItemNavigation::GetStarmapRouteSegmentData/,
  );
  if (!vehicleMatch) return null;

  const rawVehicleName = vehicleMatch[1];
  const vehicleId = vehicleMatch[2];

  // Skip if we've already seen this ship ID
  if (seenShipIds.has(vehicleId)) {
    return null;
  }

  // Add to seen ships
  seenShipIds.add(vehicleId);

  // Clean the ship name
  const cleanedVehicleName = getCleanShipName(rawVehicleName);

  // Track as current player's ship (for filtering quantum arrivals)
  currentPlayerShip = {
    vehicleName: cleanedVehicleName,
    vehicleId: vehicleId,
  };

  // Use current player name
  const playerName = currentPlayer;

  return {
    id: generateId(new Date(timestamp), line),
    userId: "local",
    player: currentPlayer,
    emoji: "", // No emoji - ship image will be used in UI
    line: `${playerName || "Player"} controls ${cleanedVehicleName}`,
    timestamp,
    original: line,
    open: false,
    eventType: "vehicle_control_flow",
    metadata: {
      vehicleName: cleanedVehicleName,
      vehicleId: vehicleId,
      playerId: undefined,
      action: "granted",
    },
  };
}

/**
 * Parse actor death
 * Format: <Actor Death> CActor::Kill: 'victim' [victimId] in zone 'zone' killed by 'killer' [killerId] using 'weapon'
 */
function parseActorDeath(line: string, timestamp: string): Log | null {
  if (!line.includes("<Actor Death>")) return null;

  // Extract victim name and ID: 'victim' [id]
  const victimMatch = line.match(/CActor::Kill:\s+'([^']+)'\s+\[(\d+)\]/);
  if (!victimMatch) return null;

  // Extract killer name and ID: 'killer' [id]
  const killerMatch = line.match(/killed by\s+'([^']+)'\s+\[(\d+)\]/);
  if (!killerMatch) return null;

  const victimName = victimMatch[1];
  const victimId = victimMatch[2];
  const killerName = killerMatch[1];
  const killerId = killerMatch[2];

  // Extract zone (optional): in zone 'zone' (often a ship name)
  const zoneMatch = line.match(/in zone\s+'([^']+)'/);
  const zoneRaw = zoneMatch ? zoneMatch[1] : undefined;
  // Clean zone (ship names)
  const zone = zoneRaw ? getCleanShipName(zoneRaw) : undefined;

  // Extract weapon: using 'weapon' [Class ...]
  const weaponMatch = line.match(/using\s+'([^']+)'/);
  const weaponRaw = weaponMatch ? weaponMatch[1] : undefined;
  // Clean weapon name by stripping ID suffix (like ship names)
  const weaponClass = weaponRaw
    ? weaponRaw.split("_").slice(0, -1).join(" ")
    : undefined;

  // Extract damage type: with damage type 'type'
  const damageTypeMatch = line.match(/with damage type\s+'([^']+)'/);
  const damageTypeRaw = damageTypeMatch ? damageTypeMatch[1] : undefined;
  // Convert camelCase to readable format (VehicleDestruction -> vehicle destruction)
  const damageType = damageTypeRaw
    ? convertCamelCaseToWords(damageTypeRaw)
    : undefined;

  // Register both entities in registry
  registerPlayer(victimId, victimName);
  registerPlayer(killerId, killerName);

  // Detect AI status before cleaning names
  const isAIVictim = isNPC(victimName);
  const isAIKiller = isNPC(killerName);

  // Skip if both are NPCs
  if (isAIVictim && isAIKiller) return null;

  const cleanVictim = cleanPlayerName(victimName);
  const cleanKiller = cleanPlayerName(killerName);

  return {
    id: generateId(new Date(timestamp), line),
    userId: "local",
    player: currentPlayer,
    emoji: "💀",
    line: `${cleanKiller} killed ${cleanVictim}`,
    timestamp,
    original: line,
    open: false,
    eventType: "actor_death",
    metadata: {
      victimName: cleanVictim,
      victimId: victimId,
      killerName: cleanKiller,
      killerId: killerId,
      zone,
      weaponClass,
      damageType,
      isAIVictim: isAIVictim,
      isAIKiller: isAIKiller,
    },
  };
}

/**
 * Parse actor state death (death from vehicle destruction)
 * Format: <[ActorState] Dead> ... Actor 'name' [id] ejected from zone 'vehicle' [vId] to zone 'dest' [dId] due to previous zone being in a destroyed vehicle...
 */
function parseActorStateDeath(line: string, timestamp: string): Log | null {
  if (!line.includes("<[ActorState] Dead>")) return null;

  // Extract actor name and ID: Actor 'name' [id]
  const actorMatch = line.match(/Actor\s+'([^']+)'\s+\[(\d+)\]/);
  if (!actorMatch) return null;

  // Extract source vehicle zone: ejected from zone 'vehicle' [id]
  const sourceZoneMatch = line.match(
    /ejected from zone\s+'([^']+)'\s+\[(\d+)\]/,
  );

  // Extract destination zone: to zone 'dest' [id]
  const destZoneMatch = line.match(/to zone\s+'([^']+)'\s+\[(\d+)\]/);

  const actorName = actorMatch[1];
  const actorId = actorMatch[2];
  const sourceZoneRaw = sourceZoneMatch ? sourceZoneMatch[1] : undefined;
  const sourceZoneId = sourceZoneMatch ? sourceZoneMatch[2] : undefined;
  const destZone = destZoneMatch ? destZoneMatch[1] : undefined;
  const destZoneId = destZoneMatch ? destZoneMatch[2] : undefined;

  // Clean the source zone name (likely a ship/vehicle)
  const sourceZone = sourceZoneRaw
    ? getCleanShipName(sourceZoneRaw)
    : undefined;

  // Register actor in registry
  registerPlayer(actorId, actorName);

  // Detect if actor is NPC
  const isAIVictim = isNPC(actorName);

  const cleanActor = cleanPlayerName(actorName);

  // Build display line
  let displayLine: string;
  if (sourceZone) {
    displayLine = `${cleanActor} died in ${sourceZone}`;
  } else {
    displayLine = `${cleanActor} died in vehicle destruction`;
  }

  return {
    id: generateId(new Date(timestamp), line),
    userId: "local",
    player: currentPlayer,
    emoji: "💀",
    line: displayLine,
    timestamp,
    original: line,
    open: false,
    eventType: "actor_death",
    metadata: {
      victimName: cleanActor,
      victimId: actorId,
      killerId: sourceZoneId,
      zone: sourceZone,
      damageType: "vehicle destruction",
      isAIVictim: isAIVictim,
      isAIKiller: false,
      deathCause: "vehicle_destruction",
      sourceZoneId: sourceZoneId,
      destZone: destZone,
      destZoneId: destZoneId,
    },
  };
}

/**
 * Parse vehicle/ship destruction
 * Format: <Vehicle Destruction> CVehicle::OnAdvanceDestroyLevel: Vehicle 'vehicle' [vehicleId] ... driven by 'driver' [driverId] ... caused by 'causer' [causerId]
 */
function parseDestruction(line: string, timestamp: string): Log | null {
  if (!line.includes("Destruction>")) return null;

  // Extract vehicle name and ID: 'vehicle' [id]
  const vehicleMatch = line.match(/Vehicle\s+'([^']+)'\s+\[(\d+)\]/);
  if (!vehicleMatch) return null;

  // Extract driver name and ID: 'driver' [id]
  const driverMatch = line.match(/driven by\s+'([^']+)'\s+\[(\d+)\]/);

  // Extract causer name and ID: 'causer' [id]
  const causerMatch = line.match(/caused by\s+'([^']+)'\s+\[(\d+)\]/);
  if (!causerMatch) return null;

  // Extract destroy level
  const levelMatch = line.match(/from destroy level (\d+) to (\d+)/);
  if (!levelMatch) return null;

  const vehicleName = vehicleMatch[1];
  const vehicleId = vehicleMatch[2];
  const driverName = driverMatch?.[1];
  const driverId = driverMatch?.[2];
  const causerName = causerMatch[1];
  const causerId = causerMatch[2];
  const fromLevel = parseInt(levelMatch[1]);
  const toLevel = parseInt(levelMatch[2]);

  // Register driver and causer in registry
  registerPlayer(driverId, driverName);
  registerPlayer(causerId, causerName);

  // Only show level 1 -> 2 transitions (complete destruction)
  if (!(fromLevel === 1 && toLevel === 2)) return null;

  // Extract cause type (e.g., 'Collision', 'Combat')
  const causeTypeMatch = line.match(/with\s+'([^']+)'/);
  const causeType = causeTypeMatch?.[1];

  let cleanCauser = cleanPlayerName(causerName);
  let isRealCauser = causerName !== "unknown" && causerId !== "0";

  // If causer looks like a ship/vehicle/PDC name, use ship cleaner
  // (Check for underscores and no spaces - indicates technical name)
  if (causerName.includes("_") && !causerName.includes(" ")) {
    const shipClean = getCleanShipName(causerName);
    // Only use ship-cleaned name if it was actually cleaned (changed)
    if (shipClean !== causerName) {
      cleanCauser = shipClean;
    }
  }

  // If causer is unknown, try to use the damage type instead (for display only, not metadata)
  if (!isRealCauser && causeType) {
    cleanCauser = causeType.toLowerCase();
  }

  const cleanedVehicle = cleanShipName(vehicleName);
  const cleanedVehicleName = cleanedVehicle?.name ?? vehicleName;
  const isAIVehicle = cleanedVehicle?.isAI ?? false;

  return {
    id: generateId(new Date(timestamp), line),
    userId: "local",
    player: currentPlayer,
    emoji: "💥",
    line: `${cleanCauser} destroyed ${cleanedVehicleName}`,
    timestamp,
    original: line,
    open: false,
    eventType: "destruction",
    metadata: {
      vehicleName: cleanedVehicleName,
      vehicleId: vehicleId,
      driverName: driverName ? cleanPlayerName(driverName) : undefined,
      driverId: driverId,
      // Only set causeName if it's a real entity (not a damage type fallback)
      causeName: isRealCauser ? cleanCauser : undefined,
      causeId: causerId,
      destroyLevelFrom: fromLevel.toString(),
      destroyLevelTo: toLevel.toString(),
      isAIVehicle: isAIVehicle,
    },
  };
}

/**
 * Parse system quit
 * Format: <SystemQuit> CSystem::Quit invoked...
 */
function parseSystemQuit(line: string, timestamp: string): Log | null {
  if (!line.includes("<SystemQuit>")) return null;

  return {
    id: generateId(new Date(timestamp), line),
    userId: "local",
    player: currentPlayer,
    emoji: "🔌",
    line: "Game session ended",
    timestamp,
    original: line,
    open: false,
    eventType: "system_quit",
  };
}

/**
 * Parse mission events (3 types)
 * Formats:
 * - Mission Shared: <MissionShared> Received share push message: ownerId[X] - missionId[Y]
 * - Objective Updated: <ObjectiveUpserted> Received ObjectiveUpserted push message for: mission_id X - objective_id Y - state Z
 * - Mission Completed: <MissionEnded> Received MissionEnded push message for: mission_id X - mission_state Y
 */
function parseMissionEvents(line: string, timestamp: string): Log | null {
  // Mission Shared
  if (line.includes("<MissionShared>")) {
    const match = line.match(
      /<MissionShared>\s+Received\s+share\s+push\s+message:\s+ownerId\[(\d+)\]\s+-\s+missionId\[([a-f0-9\-]+)\]/,
    );
    if (!match) return null;

    const ownerId = match[1];
    const missionId = match[2];

    // Try to resolve ownerId to player name
    const ownerName = getPlayerName(ownerId) || currentPlayer;

    // Format display line
    let displayLine: string;
    if (ownerName) {
      displayLine = `Mission shared by ${ownerName}`;
    } else {
      // Show shortened mission ID if we can't resolve owner
      const shortId = missionId.substring(0, 8);
      displayLine = `Mission shared: ${shortId}...`;
    }

    return {
      id: generateId(new Date(timestamp), line),
      userId: "local",
      player: ownerName,
      emoji: "📋",
      line: displayLine,
      timestamp,
      original: line,
      open: false,
      eventType: "mission_shared",
      metadata: {
        missionId,
        ownerId,
      },
    };
  }

  // Objective Updated
  if (line.includes("<ObjectiveUpserted>")) {
    const match = line.match(
      /<ObjectiveUpserted>\s+Received\s+ObjectiveUpserted\s+push\s+message\s+for:\s+mission_id\s+([a-f0-9\-]+)\s+-\s+objective_id\s+([a-f0-9\-]+)\s+-\s+state\s+(\w+)/,
    );
    if (!match) return null;

    const missionId = match[1];
    const objectiveId = match[2];
    const state = match[3];

    // Check for bounty kill: COMPLETED state, tracked mission, ShowInLog flag, not already emitted
    if (
      state === "MISSION_OBJECTIVE_STATE_COMPLETED" &&
      bountyMarkerCache.has(missionId) &&
      !bountyKillEmitted.has(missionId) &&
      line.includes("ShowInLog")
    ) {
      const markerData = bountyMarkerCache.get(missionId)!;
      bountyKillEmitted.add(missionId); // Mark as emitted to avoid duplicates

      const targetType = parseTargetTypeFromContract(markerData.contract);

      return {
        id: generateId(new Date(timestamp), line),
        userId: "local",
        player: currentPlayer,
        emoji: "🎯",
        line: `Bounty target eliminated${targetType ? ` (${targetType})` : ""}`,
        timestamp,
        original: line,
        open: false,
        eventType: "bounty_kill",
        metadata: {
          missionId,
          objectiveId,
          generatorName: markerData.generatorName,
          contract: markerData.contract,
          targetType,
          isAIKill: true,
        },
      };
    }

    return {
      id: generateId(new Date(timestamp), line),
      userId: "local",
      player: currentPlayer,
      emoji: "🎯",
      line: `Mission objective: ${formatMissionObjectiveState(state)}`,
      timestamp,
      original: line,
      open: false,
      eventType: "mission_objective",
      metadata: {
        missionId,
        objectiveId,
        objectiveState: state,
      },
    };
  }

  // Mission Completed
  if (line.includes("<MissionEnded>")) {
    const match = line.match(
      /<MissionEnded>\s+Received\s+MissionEnded\s+push\s+message\s+for:\s+mission_id\s+([a-f0-9\-]+)\s+-\s+mission_state\s+(\w+)/,
    );
    if (!match) return null;

    const missionId = match[1];
    const missionState = match[2];

    // Clear bounty tracking for this mission
    clearBountyMission(missionId);

    return {
      id: generateId(new Date(timestamp), line),
      userId: "local",
      player: currentPlayer,
      emoji: "✅",
      line: `Mission ${formatMissionObjectiveState(missionState)}`,
      timestamp,
      original: line,
      open: false,
      eventType: "mission_completed",
      metadata: {
        missionId,
        missionState,
      },
    };
  }

  return null;
}

/**
 * Parse mission end event
 * Format: <EndMission> Ending mission for player. MissionId[X] Player[Y] PlayerId[Z] CompletionType[Complete/Abort/Fail] Reason[...]
 */
function parseEndMission(line: string, timestamp: string): Log | null {
  if (!line.includes("<EndMission>")) return null;

  // Extract mission ID
  const missionIdMatch = line.match(/MissionId\[([a-f0-9\-]+)\]/);
  if (!missionIdMatch) return null;

  // Extract player name
  const playerMatch = line.match(/Player\[([^\]]+)\]/);
  const playerName = playerMatch ? playerMatch[1] : currentPlayer;

  // Extract player ID
  const playerIdMatch = line.match(/PlayerId\[(\d+)\]/);
  const playerId = playerIdMatch ? playerIdMatch[1] : undefined;

  // Extract completion type
  const completionTypeMatch = line.match(/CompletionType\[([^\]]+)\]/);
  const completionType = completionTypeMatch
    ? completionTypeMatch[1]
    : "Unknown";

  // Extract reason
  const reasonMatch = line.match(/Reason\[([^\]]+)\]/);
  const reason = reasonMatch ? reasonMatch[1] : undefined;

  const missionId = missionIdMatch[1];

  // Register player if ID available
  if (playerId && playerName) {
    registerPlayer(playerId, playerName);
  }

  // Determine emoji and display based on completion type
  let emoji = "✅";
  let displayLine: string;

  if (completionType === "Complete") {
    emoji = "✅";
    displayLine = `${playerName || "Player"} completed mission`;
  } else if (completionType === "Abort") {
    emoji = "🚫";
    displayLine = `${playerName || "Player"} aborted mission`;
  } else if (completionType === "Fail") {
    emoji = "❌";
    displayLine = `${playerName || "Player"} failed mission`;
  } else {
    displayLine = `${playerName || "Player"} ended mission (${completionType})`;
  }

  return {
    id: generateId(new Date(timestamp), line),
    userId: "local",
    player: currentPlayer,
    emoji: emoji,
    line: displayLine,
    timestamp,
    original: line,
    open: false,
    eventType: "mission_ended",
    metadata: {
      missionId,
      player: playerName || undefined,
      playerId,
      completionType,
      reason,
    },
  };
}

/**
 * Parse fatal collision event
 * Format: <FatalCollision> Fatal Collision occured for vehicle X [Part: Y, Pos: ..., Zone: Z, PlayerPilot: 1] after hitting entity: W
 */
function parseFatalCollision(line: string, timestamp: string): Log | null {
  if (!line.includes("<FatalCollision>")) return null;

  console.log("[parseFatalCollision] Raw line:", line);

  // Extract vehicle name (allow mixed case like ANVL_Paladin_123)
  const vehicleMatch = line.match(/for vehicle\s+([A-Za-z_0-9]+)\s+\[/);
  console.log("[parseFatalCollision] Vehicle match:", vehicleMatch);
  const rawVehicleName = vehicleMatch ? vehicleMatch[1] : undefined;
  console.log("[parseFatalCollision] Raw vehicle name:", rawVehicleName);

  // Extract zone
  const zoneMatch = line.match(/Zone:\s+([^,\]]+)/);
  const zoneName = zoneMatch ? zoneMatch[1] : undefined;

  // Extract what was hit (full entity string for detailed parsing)
  const fullEntityMatch = line.match(/after hitting entity:\s+(.+?)\s*\]\./);
  const fullEntity = fullEntityMatch ? fullEntityMatch[1].trim() : "";

  // Extract basic entity name (for backward compatibility)
  const hitEntityMatch = fullEntity.match(/^([^\[]+)/);
  const hitEntity = hitEntityMatch
    ? hitEntityMatch[1].trim().toLowerCase()
    : "unknown";

  // Parse detailed entity info: "PlayerName [Zone: ShipInstance - Class(ShipClass)]"
  let hitEntityPlayer: string | undefined;
  let hitEntityShip: string | undefined;

  const detailedEntityMatch = fullEntity.match(
    /^([^\[]+)\s*\[Zone:\s*[^\-]+\-\s*Class\(([^)]+)\)/,
  );
  if (detailedEntityMatch) {
    hitEntityPlayer = detailedEntityMatch[1].trim();
    const rawShipClass = detailedEntityMatch[2].trim();
    hitEntityShip = getCleanShipName(rawShipClass);
  }

  // Extract part that collided
  const partMatch = line.match(/Part:\s+([^,\]]+)/);
  const part = partMatch ? partMatch[1] : undefined;

  // Clean vehicle name
  const vehicleName = rawVehicleName
    ? getCleanShipName(rawVehicleName)
    : "Vehicle";

  // Build display line
  let displayLine: string;
  if (hitEntity && hitEntity !== "unknown") {
    displayLine = `${vehicleName} crashed into ${hitEntity}`;
  } else {
    displayLine = `${vehicleName} fatal crash`;
  }

  return {
    id: generateId(new Date(timestamp), line),
    userId: "local",
    player: currentPlayer,
    emoji: "💥",
    line: displayLine,
    timestamp,
    original: line,
    open: false,
    eventType: "fatal_collision",
    metadata: {
      vehicleName,
      vehicleId: rawVehicleName,
      zone: zoneName,
      hitEntity,
      hitEntityPlayer,
      hitEntityShip,
      part,
    },
  };
}

/**
 * Parse bounty marker event (SC 4.4.x+)
 * Format: <CLocalMissionPhaseMarker::CreateMarker> Creating objective marker: missionId [uuid], generator name [InterSec_KillShip], contract [InterSec_Bounty_Nyx_Easy], ...
 *
 * This event fires when a bounty target spawns. We cache it to correlate with
 * ObjectiveUpserted COMPLETED events for bounty kill detection.
 */
function parseBountyMarkerEvent(line: string, timestamp: string): Log | null {
  if (!line.includes("<CLocalMissionPhaseMarker::CreateMarker>")) return null;

  // Extract missionId
  const missionIdMatch = line.match(/missionId\s*\[([a-f0-9\-]+)\]/);
  if (!missionIdMatch) return null;

  // Extract generator name
  const generatorMatch = line.match(/generator name\s*\[([^\]]+)\]/);
  if (!generatorMatch) return null;

  const generatorName = generatorMatch[1];

  // Only track KillShip generators (bounty targets)
  if (!generatorName.includes("KillShip")) return null;

  // Extract contract name
  const contractMatch = line.match(/contract\s*\[([^\]]+)\]/);
  const contract = contractMatch ? contractMatch[1] : "Unknown";

  // Extract objectiveId (for reference)
  const objectiveIdMatch = line.match(/objectiveId\s*\[([a-f0-9\-]+)\]/);
  const objectiveId = objectiveIdMatch ? objectiveIdMatch[1] : undefined;

  const missionId = missionIdMatch[1];

  // Clean up stale cache entries periodically
  cleanupBountyMarkerCache();

  // Cache this marker for later correlation
  bountyMarkerCache.set(missionId, {
    missionId,
    generatorName,
    contract,
    timestamp: Date.now(),
  });

  // Parse target type from contract (Easy, Medium, Hard, VHRT, ERT)
  const targetType = parseTargetTypeFromContract(contract);

  return {
    id: generateId(new Date(timestamp), line),
    userId: "local",
    player: currentPlayer,
    emoji: "🎯",
    line: `Bounty target spawned${targetType ? ` (${targetType})` : ""}`,
    timestamp,
    original: line,
    open: false,
    eventType: "bounty_marker",
    metadata: {
      missionId,
      objectiveId,
      generatorName,
      contract,
      targetType,
    },
  };
}

/**
 * Parse actor state place event (item placement)
 * Format: <[ActorState] Place> ... 'PlayerName' [ID] placed/placing 'ItemName' [ItemID] ...
 */
function parseActorStatePlace(line: string, timestamp: string): Log | null {
  if (!line.includes("<[ActorState] Place>")) return null;

  // Extract player name and ID
  const playerMatch = line.match(/'([^']+)'\s+\[(\d+)\]/);
  if (!playerMatch) return null;

  const playerName = playerMatch[1];
  const playerId = playerMatch[2];

  // Extract item name (second quoted string)
  const itemMatch = line.match(/'[^']+'\s+\[\d+\][^']*'([^']+)'\s+\[(\d+)\]/);
  const itemName = itemMatch ? itemMatch[1] : "item";
  const itemId = itemMatch ? itemMatch[2] : undefined;

  // Determine action (placing vs placed)
  const action = line.includes("placing") ? "placing" : "placed";

  // Register player
  registerPlayer(playerId, playerName);

  // Clean player name
  const cleanPlayer = cleanPlayerName(playerName);

  // Clean item name (remove technical prefixes and IDs)
  let cleanItemName = itemName
    .replace(/^Carryable_\w+_/, "")
    .replace(/_\d+_\w+$/, "")
    .replace(/_/g, " ")
    .trim();

  // Capitalize first letter
  cleanItemName =
    cleanItemName.charAt(0).toUpperCase() + cleanItemName.slice(1);

  return {
    id: generateId(new Date(timestamp), line),
    userId: "local",
    player: currentPlayer,
    emoji: "📦",
    line: `${cleanPlayer} ${action} ${cleanItemName}`,
    timestamp,
    original: line,
    open: false,
    eventType: "item_placement",
    metadata: {
      player: cleanPlayer,
      playerId,
      itemName: cleanItemName,
      itemId,
      action,
    },
  };
}

/**
 * Parse quantum drive arrival event
 * Format: <Quantum Drive Arrived - Arrived at Final Destination> ... VehicleName[ID]|...|Quantum Drive has arrived at final destination
 */
function parseQuantumArrival(line: string, timestamp: string): Log | null {
  if (!line.includes("<Quantum Drive Arrived")) return null;

  // Extract vehicle name and ID (include lowercase for ship names like "Corsair", "Reclaimer")
  const vehicleMatch = line.match(/([A-Za-z_0-9]+)\[(\d+)\]/);
  const rawVehicleName = vehicleMatch ? vehicleMatch[1] : undefined;
  const vehicleId = vehicleMatch ? vehicleMatch[2] : undefined;

  // Clean vehicle name
  const vehicleName = rawVehicleName
    ? getCleanShipName(rawVehicleName)
    : "Ship";

  // Filter out player's own ship arrivals
  if (currentPlayerShip && vehicleId === currentPlayerShip.vehicleId) {
    return null;
  }

  // Show other ships as "spotted nearby"
  return {
    id: generateId(new Date(timestamp), line),
    userId: "local",
    player: currentPlayer,
    emoji: "👀",
    line: `${vehicleName} spotted nearby`,
    timestamp,
    original: line,
    open: false,
    eventType: "quantum_arrival",
    metadata: {
      vehicleName,
      vehicleId,
    },
  };
}

/**
 * Parse equip item event with deduplication
 * Format: <EquipItem> Request[X] equip from Inventory[Y:Location:Z] Class[ItemClass] Rank[...] Port[...] DependentRequest[...] PostAction[Carry/...]
 *
 * Deduplication: Aggregates equipment events within 5-second windows to prevent flooding during login/respawn.
 * When a player logs in, Star Citizen logs thousands of individual equipment events - this function
 * collapses them into a single event showing total item count.
 */
function parseEquipItem(line: string, timestamp: string): Log | null {
  if (!line.includes("<EquipItem>")) return null;

  // Extract item class
  const classMatch = line.match(/Class\[([^\]]+)\]/);
  if (!classMatch) return null;

  const itemClass = classMatch[1];

  // Extract port (where item is equipped)
  const portMatch = line.match(/Port\[([^\]]+)\]/);
  const port = portMatch ? portMatch[1] : undefined;

  // Extract post action (Carry, Wear, etc.)
  const postActionMatch = line.match(/PostAction\[([^\]]+)\]/);
  const postAction = postActionMatch ? postActionMatch[1] : undefined;

  // Filter out "Carry" actions (pick-up events are too noisy)
  if (postAction === "Carry") return null;

  // Clean item class name
  let cleanItemName = itemClass
    .replace(/^Carryable_\w+_/, "")
    .replace(/^Clothing_/, "")
    .replace(/^Armor_/, "")
    .replace(/_\d+_\w+$/, "")
    .replace(/_/g, " ")
    .trim();

  // Capitalize first letter
  cleanItemName =
    cleanItemName.charAt(0).toUpperCase() + cleanItemName.slice(1);

  // Determine verb based on post action
  let verb = "equipped";
  if (postAction === "Carry") {
    verb = "picked up";
  } else if (postAction === "Wear") {
    verb = "wore";
  }

  // Deduplication logic - aggregate equipment events within 5-second windows
  const player = currentPlayer || "Player";
  const now = new Date(timestamp).getTime();
  const cacheEntry = equipmentCache.get(player);

  // Clean up stale cache entries periodically (every 100 events on average)
  if (Math.random() < 0.01) {
    cleanupEquipmentCache();
  }

  if (cacheEntry) {
    const timeSinceLastEmit = now - cacheEntry.lastEmitTime;

    if (timeSinceLastEmit < EQUIPMENT_CACHE_TIMEOUT_MS) {
      // Within aggregation window - update cache but suppress event
      cacheEntry.itemCount++;
      cacheEntry.items.add(cleanItemName);
      return null;
    } else {
      // Window expired - emit aggregated event from previous window
      const aggregatedLog: Log = {
        id: generateId(
          new Date(cacheEntry.lastEmitTime),
          `equipment_aggregated_${player}`,
        ),
        userId: "local",
        player: currentPlayer,
        emoji: "🎒",
        line:
          cacheEntry.itemCount === 1
            ? `${player} ${verb} ${Array.from(cacheEntry.items)[0]}`
            : `${player} equipped ${cacheEntry.itemCount} items`,
        timestamp: new Date(cacheEntry.lastEmitTime).toISOString(),
        original: line,
        open: false,
        eventType: "equipment_equip",
        metadata: {
          itemClass:
            cacheEntry.itemCount === 1
              ? Array.from(cacheEntry.items)[0]
              : undefined,
          itemCount: cacheEntry.itemCount,
          aggregated: true,
          port,
          postAction,
        },
      };

      // Start new window
      equipmentCache.set(player, {
        lastEmitTime: now,
        itemCount: 1,
        items: new Set([cleanItemName]),
      });

      return aggregatedLog;
    }
  } else {
    // First equipment event for this player - start tracking
    equipmentCache.set(player, {
      lastEmitTime: now,
      itemCount: 1,
      items: new Set([cleanItemName]),
    });

    // Don't emit immediately - wait to see if more events come in the same window
    return null;
  }
}

/**
 * Parse docking/landing events (3 types)
 * Formats:
 * - Hangar Door: <CLandingArea::OnDoorOpenStateChanged> ... LandingArea_X ... Door: HangarDoor_Y ... State: Z
 * - Docking Tube: <CSCItemDockingTube::OnSetTubeState> ... OnSetTubeState to X, last tube state is Y
 * - Landing Pad: <CSCLoadingPlatformManager> ... (platform events)
 */
function parseDockingEvents(line: string, timestamp: string): Log | null {
  // Hangar Door - DISABLED (too noisy)
  // if (line.includes('<CLandingArea::OnDoorOpenStateChanged>')) {
  // 	const landingAreaMatch = line.match(/LandingArea_(\w+)/);
  // 	const doorMatch = line.match(/Door:\s+HangarDoor_(\w+)/);
  // 	const stateMatch = line.match(/State:\s+(\w+)/);

  // 	if (!landingAreaMatch || !doorMatch || !stateMatch) return null;

  // 	const landingArea = landingAreaMatch[1];
  // 	const door = doorMatch[1];
  // 	const state = stateMatch[1];

  // 	return {
  // 		id: generateId(new Date(timestamp), line),
  // 		userId: 'local',
  // 		player: null,
  // 		emoji: '🚪',
  // 		line: `Hangar door ${state.toLowerCase()}: ${door}`,
  // 		timestamp,
  // 		original: line,
  // 		open: false,
  // 		eventType: 'hangar_door',
  // 		metadata: {
  // 			landingArea,
  // 			hangarDoor: door,
  // 			doorState: state
  // 		}
  // 	};
  // }

  // Docking Tube - DISABLED (too noisy)
  // if (line.includes('<CSCItemDockingTube::OnSetTubeState>')) {
  // 	const match = line.match(/OnSetTubeState\s+to\s+(\w+),\s+last\s+tube\s+state\s+is\s+(\w+)/);
  // 	if (!match) return null;

  // 	const newState = match[1];
  // 	const lastState = match[2];

  // 	return {
  // 		id: generateId(new Date(timestamp), line),
  // 		userId: 'local',
  // 		player: null,
  // 		emoji: '🔗',
  // 		line: `Docking tube: ${lastState} → ${newState}`,
  // 		timestamp,
  // 		original: line,
  // 		open: false,
  // 		eventType: 'docking_tube',
  // 		metadata: {
  // 			tubeState: newState,
  // 			lastTubeState: lastState
  // 		}
  // 	};
  // }

  // Landing Pad (generic landing platform events)
  if (line.includes("<CSCLoadingPlatformManager>")) {
    return {
      id: generateId(new Date(timestamp), line),
      userId: "local",
      player: currentPlayer,
      emoji: "🛬",
      line: "Landing platform activity",
      timestamp,
      original: line,
      open: false,
      eventType: "landing_pad",
      metadata: {},
    };
  }

  return null;
}

/**
 * Prettify bed names for display
 * Examples:
 * - "bed_hospital_1_a-007" → "Hospital 1 Bed A-007"
 * - "Bed_Single_Front_Spawnpoint_No_Persistent_Hab-001" → "Hab Bed 001"
 * - "Unknown" → null (caller should hide location)
 */
function prettifyBedName(bedId: string): string | null {
  // Check if bedId is "Unknown" (case-insensitive)
  if (bedId.toLowerCase() === "unknown") {
    return null;
  }

  // Pattern: bed_hospital_X_Y-ZZZ → "Hospital X Bed Y-ZZZ"
  const hospitalMatch = bedId.match(/bed_hospital_(\d+)_([a-z])-(\d+)/i);
  if (hospitalMatch) {
    return `Hospital ${hospitalMatch[1]} Bed ${hospitalMatch[2].toUpperCase()}-${hospitalMatch[3]}`;
  }

  // Pattern: Bed_Single_..._Hab-XXX → "Hab Bed XXX"
  const habMatch = bedId.match(/Bed_.*_Hab-(\d+)/i);
  if (habMatch) {
    return `Hab Bed ${habMatch[1]}`;
  }

  // Pattern: bed_X_Y-ZZZ (generic) → "Bed Y-ZZZ"
  const genericBedMatch = bedId.match(/bed_[^_]+_([a-z])-(\d+)/i);
  if (genericBedMatch) {
    return `Bed ${genericBedMatch[1].toUpperCase()}-${genericBedMatch[2]}`;
  }

  // Fallback: Clean up underscores and capitalize
  return bedId
    .replace(/_/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Parse medical/respawn events (2 types)
 * Formats:
 * - Hospital Respawn: <Spawn Flow> Player 'X' ... lost reservation for spawnpoint Y [id] at location Z
 * - Medical Bed: <CEntity::OnOwnerRemoved> ... medical bed detachment
 */
function parseMedicalEvents(line: string, timestamp: string): Log | null {
  // Hospital Respawn
  if (line.includes("<Spawn Flow>")) {
    const match = line.match(
      /Player\s+'([^']+)'.*lost\s+reservation\s+for\s+spawnpoint\s+([^\s]+)\s+\[(\d+)\]\s+at\s+location\s+(\d+)/,
    );
    if (!match) return null;

    const playerName = match[1];
    const bedId = match[2];
    const spawnpointId = match[3];
    const locationId = match[4];

    // Prettify bed name or hide if "Unknown"
    const prettyBedName = prettifyBedName(bedId);
    const displayMessage = prettyBedName
      ? `${playerName} respawned at ${prettyBedName}`
      : `${playerName} respawned`;

    return {
      id: generateId(new Date(timestamp), line),
      userId: "local",
      player: currentPlayer,
      emoji: "🏥",
      line: displayMessage,
      timestamp,
      original: line,
      open: false,
      eventType: "hospital_respawn",
      metadata: {
        player: playerName,
        bedId,
        spawnpointId,
        locationId,
      },
    };
  }

  // Medical Bed (OnOwnerRemoved - detachment from medical bed)
  if (line.includes("<CEntity::OnOwnerRemoved>") && line.includes("bed")) {
    const playerMatch = line.match(/Player\[([^\]]+)\]/);
    const playerName = playerMatch ? playerMatch[1] : currentPlayer;

    return {
      id: generateId(new Date(timestamp), line),
      userId: "local",
      player: currentPlayer,
      emoji: "🛏️",
      line: `${playerName || "Player"} left medical bed`,
      timestamp,
      original: line,
      open: false,
      eventType: "medical_bed",
      metadata: {
        player: playerName || undefined,
      },
    };
  }

  return null;
}

/**
 * Parse economy/shopping events (2 types)
 * Formats:
 * - Purchase: <CEntityComponentShoppingProvider::SendStandardItemBuyRequest> ... itemName[X] client_price[Y] shopName[Z]
 * - Insurance Claim: <CWallet::ProcessClaimToNextStep> ... entitlementURN: X
 */
function parseEconomyEvents(line: string, timestamp: string): Log | null {
  // Purchase
  if (
    line.includes(
      "<CEntityComponentShoppingProvider::SendStandardItemBuyRequest>",
    )
  ) {
    const itemMatch = line.match(/itemName\[([^\]]+)\]/);
    const priceMatch = line.match(/client_price\[([^\]]+)\]/);
    const shopMatch = line.match(/shopName\[([^\]]+)\]/);

    if (!itemMatch) return null;

    const itemName = itemMatch[1];
    const price = priceMatch ? priceMatch[1] : "0";
    const shopName = shopMatch ? shopMatch[1] : undefined;

    // Format price as currency
    const formattedPrice =
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
      })
        .format(parseFloat(price))
        .replace("$", "") + " aUEC";

    return {
      id: generateId(new Date(timestamp), line),
      userId: "local",
      player: currentPlayer,
      emoji: "🛒",
      line: `Purchased ${itemName} for ${formattedPrice}`,
      timestamp,
      original: line,
      open: false,
      eventType: "purchase",
      metadata: {
        itemName,
        itemPrice: price,
        shopName,
      },
    };
  }

  // Insurance Claim
  if (line.includes("<CWallet::ProcessClaimToNextStep>")) {
    const match = line.match(/entitlementURN:\s+([^\s,]+)/);
    if (!match) return null;

    const entitlementURN = match[1];

    return {
      id: generateId(new Date(timestamp), line),
      userId: "local",
      player: currentPlayer,
      emoji: "📋",
      line: `Insurance claim processed`,
      timestamp,
      original: line,
      open: false,
      eventType: "insurance_claim",
      metadata: {
        entitlementURN,
      },
    };
  }

  return null;
}

/**
 * Parse quantum travel events
 * Format: <Jump Drive Requesting State Change> Requested change from X to Y, reason: Z | ... | (player: Ship in zone ...)
 */
function parseQuantumTravel(line: string, timestamp: string): Log | null {
  if (!line.includes("<Jump Drive Requesting State Change>")) return null;

  const match = line.match(
    /Requested\s+change\s+from\s+(\w+)\s+to\s+(\w+),\s+reason:\s+([^|]+)/,
  );
  if (!match) return null;

  const fromState = match[1];
  const toState = match[2];
  const reason = match[3].trim();

  // Extract ship name from format: (player: SHIP_NAME in zone ...)
  const shipMatch = line.match(
    /\((?:\w+):\s+([A-Z_0-9]+(?:_\d+)?)\s+in\s+zone\s+([^\)]+)\)/,
  );
  const rawShipName = shipMatch?.[1] || null;
  const zoneName = shipMatch?.[2] || null;

  // Extract system from line (appears after reason)
  const systemMatch = line.match(/\|\s*([A-Z]\w+)\s*\|/);
  const system = systemMatch?.[1] || undefined;

  // Extract link type from reason brackets: [linked to X]
  const linkMatch = reason.match(/\[linked to ([^\]]+)\]/);
  const linkedTo = linkMatch?.[1] || null;
  const isNearJumpPoint =
    linkedTo === "JumpPoint_Permanent" ||
    zoneName?.includes("JumpPoint") ||
    false;

  // Filter out repetitive Idle→Idle events UNLESS they're near jump points
  if (fromState === "Idle" && toState === "Idle" && !isNearJumpPoint) {
    return null;
  }

  // Simplify reason text
  let simplifiedReason = reason;
  if (reason.includes("QDRV is no longer powered")) {
    simplifiedReason = "drive lost power";
  } else if (reason.includes("Jump Drive is no longer in use")) {
    simplifiedReason = "drive shut down";
  } else if (reason.includes("spooling")) {
    simplifiedReason = "spooling drive";
  } else if (reason.includes("calibrating")) {
    simplifiedReason = "calibrating";
  } else if (reason.includes("traveling")) {
    simplifiedReason = "traveling";
  }

  // Clean ship name
  const cleanedShipName = rawShipName ? getCleanShipName(rawShipName) : null;

  // Clean zone name (basic cleanup)
  let cleanedZone = zoneName;
  if (zoneName) {
    // Remove prefixes like OOC_, Hangar_MediumTop_, etc.
    cleanedZone = zoneName
      .replace(/^OOC_/, "")
      .replace(/^Hangar_\w+_/, "")
      .replace(/RestStop_\d+$/, "Rest Stop")
      .replace(/_/g, " ");

    // Handle jump point zones
    if (zoneName.includes("JumpPoint_")) {
      const jpMatch = zoneName.match(/JumpPoint_(\w+)_(\w+)/);
      if (jpMatch) {
        cleanedZone = `${jpMatch[1]}-${jpMatch[2]} jump point`;
      }
    }
  }

  // Build display line
  let displayLine: string;
  if (fromState === toState) {
    // Same state (e.g., Idle→Idle with jump point)
    const shipPrefix = cleanedShipName ? `${cleanedShipName}'s ` : "";
    const locationSuffix =
      cleanedZone && cleanedZone !== zoneName ? ` near ${cleanedZone}` : "";
    displayLine = `QT: ${shipPrefix}${simplifiedReason}${locationSuffix}`;
  } else {
    // Different states - show transition with ship name if available
    const shipPrefix = cleanedShipName ? `${cleanedShipName}: ` : "";
    displayLine = `${shipPrefix}Quantum travel: ${fromState} → ${toState}`;
  }

  return {
    id: generateId(new Date(timestamp), line),
    userId: "local",
    player: currentPlayer,
    emoji: "⚡",
    line: displayLine,
    timestamp,
    original: line,
    open: false,
    eventType: "quantum_travel",
    metadata: {
      qtStateFrom: fromState,
      qtStateTo: toState,
      qtReason: reason,
      vehicleName: cleanedShipName ?? undefined,
      vehicleId: rawShipName ?? undefined,
      zone: cleanedZone ?? zoneName ?? undefined,
      system: system,
      linkedType:
        linkedTo === "JumpPoint_Permanent"
          ? "jump_point"
          : linkedTo === "no jump point"
            ? "none"
            : "unknown",
      isNearJumpPoint,
    },
  };
}

/**
 * Parse equipment events
 * Format: <AttachmentReceived> Player[X] Attachment[Y] ... Status[Z] Port[W]
 */
function parseEquipmentEvents(line: string, timestamp: string): Log | null {
  if (!line.includes("<AttachmentReceived>")) return null;

  const playerMatch = line.match(/Player\[([^\]]+)\]/);
  const attachmentMatch = line.match(/Attachment\[([^\]]+)\]/);
  const statusMatch = line.match(/Status\[([^\]]+)\]/);
  const portMatch = line.match(/Port\[([^\]]+)\]/);

  if (!playerMatch || !attachmentMatch) return null;

  const playerName = playerMatch[1];
  const attachmentName = attachmentMatch[1];
  const status = statusMatch ? statusMatch[1] : "unknown";
  const port = portMatch ? portMatch[1] : "unknown";

  return {
    id: generateId(new Date(timestamp), line),
    userId: "local",
    player: currentPlayer,
    emoji: "🎒",
    line: `${playerName} equipped ${attachmentName}`,
    timestamp,
    original: line,
    open: false,
    eventType: "equipment_received",
    metadata: {
      player: playerName,
      attachmentName,
      attachmentStatus: status,
      attachmentPort: port,
    },
  };
}

/**
 * Parse environmental hazard events (suffocation, depressurization)
 * Formats:
 * - Suffocation Start: <[STAMINA] Player started suffocating> Player[X] Details: ...
 * - Suffocation Stop: <[STAMINA] Player stopped suffocating> Player[X]
 * - Depressurization Start: <[STAMINA] Player started depressurization> Player[X] Details: ...
 * - Depressurization Stop: <[STAMINA] Player stopped depressurization> Player[X]
 */
function parseEnvironmentalHazards(
  line: string,
  timestamp: string,
): Log | null {
  // Check if line contains environmental hazard markers
  if (!line.includes("<[STAMINA]")) return null;

  // Extract player name
  const playerMatch = line.match(/Player\[([^\]]+)\]/);
  const playerName = playerMatch ? playerMatch[1] : currentPlayer;

  // Suffocation start
  if (line.includes("Player started suffocating")) {
    return {
      id: generateId(new Date(timestamp), line),
      userId: "local",
      player: currentPlayer,
      emoji: "⚠️",
      line: `${playerName || "Player"} started suffocating`,
      timestamp,
      original: line,
      open: false,
      eventType: "environmental_hazard",
      metadata: {
        player: playerName || undefined,
        hazardType: "suffocation",
        hazardState: "started",
      },
    };
  }

  // Suffocation stop
  if (line.includes("Player stopped suffocating")) {
    return {
      id: generateId(new Date(timestamp), line),
      userId: "local",
      player: currentPlayer,
      emoji: "⚠️",
      line: `${playerName || "Player"} stopped suffocating`,
      timestamp,
      original: line,
      open: false,
      eventType: "environmental_hazard",
      metadata: {
        player: playerName || undefined,
        hazardType: "suffocation",
        hazardState: "stopped",
      },
    };
  }

  // Depressurization start
  if (line.includes("Player started depressurization")) {
    return {
      id: generateId(new Date(timestamp), line),
      userId: "local",
      player: currentPlayer,
      emoji: "⚠️",
      line: `${playerName || "Player"} started depressurizing`,
      timestamp,
      original: line,
      open: false,
      eventType: "environmental_hazard",
      metadata: {
        player: playerName || undefined,
        hazardType: "depressurization",
        hazardState: "started",
      },
    };
  }

  // Depressurization stop
  if (line.includes("Player stopped depressurization")) {
    return {
      id: generateId(new Date(timestamp), line),
      userId: "local",
      player: currentPlayer,
      emoji: "⚠️",
      line: `${playerName || "Player"} stopped depressurizing`,
      timestamp,
      original: line,
      open: false,
      eventType: "environmental_hazard",
      metadata: {
        player: playerName || undefined,
        hazardType: "depressurization",
        hazardState: "stopped",
      },
    };
  }

  return null;
}

/**
 * Parse a single Star Citizen log line
 */
export function parseStarCitizenLogLine(
  line: string,
  userId: string,
): Log | null {
  // Extract timestamp first
  const timestamp = parseLogTimestamp(line);
  if (!timestamp) return null;

  // Try each parser in order
  let log: Log | null = null;

  log = parseConnectionEvent(line, timestamp);
  if (log) {
    log.userId = userId;
    log.reportedBy = currentPlayer ? [currentPlayer] : ["Unknown"];
    return log;
  }

  log = parseActorDeath(line, timestamp);
  if (log) {
    log.userId = userId;
    log.reportedBy = currentPlayer ? [currentPlayer] : ["Unknown"];
    return log;
  }

  log = parseActorStateDeath(line, timestamp);
  if (log) {
    log.userId = userId;
    log.reportedBy = currentPlayer ? [currentPlayer] : ["Unknown"];
    return log;
  }

  log = parseVehicleControlFlow(line, timestamp);
  if (log) {
    log.userId = userId;
    log.reportedBy = currentPlayer ? [currentPlayer] : ["Unknown"];
    return log;
  }

  log = parseStarmapNavigationEvent(line, timestamp);
  if (log) {
    log.userId = userId;
    log.reportedBy = currentPlayer ? [currentPlayer] : ["Unknown"];
    return log;
  }

  log = parseDestruction(line, timestamp);
  if (log) {
    log.userId = userId;
    log.reportedBy = currentPlayer ? [currentPlayer] : ["Unknown"];
    return log;
  }

  log = parseFatalCollision(line, timestamp);
  if (log) {
    log.userId = userId;
    log.reportedBy = currentPlayer ? [currentPlayer] : ["Unknown"];
    return log;
  }

  log = parseLocationChange(line, timestamp);
  if (log) {
    log.userId = userId;
    log.reportedBy = currentPlayer ? [currentPlayer] : ["Unknown"];
    return log;
  }

  log = parseSystemQuit(line, timestamp);
  if (log) {
    log.userId = userId;
    log.reportedBy = currentPlayer ? [currentPlayer] : ["Unknown"];
    return log;
  }

  // New custom parsers

  // Bounty marker MUST be parsed before mission events
  // so cache is populated before ObjectiveUpserted correlation
  log = parseBountyMarkerEvent(line, timestamp);
  if (log) {
    log.userId = userId;
    log.reportedBy = currentPlayer ? [currentPlayer] : ["Unknown"];
    return log;
  }

  log = parseMissionEvents(line, timestamp);
  if (log) {
    log.userId = userId;
    log.reportedBy = currentPlayer ? [currentPlayer] : ["Unknown"];
    return log;
  }

  log = parseEndMission(line, timestamp);
  if (log) {
    log.userId = userId;
    log.reportedBy = currentPlayer ? [currentPlayer] : ["Unknown"];
    return log;
  }

  log = parseDockingEvents(line, timestamp);
  if (log) {
    log.userId = userId;
    log.reportedBy = currentPlayer ? [currentPlayer] : ["Unknown"];
    return log;
  }

  log = parseMedicalEvents(line, timestamp);
  if (log) {
    log.userId = userId;
    log.reportedBy = currentPlayer ? [currentPlayer] : ["Unknown"];
    return log;
  }

  log = parseEconomyEvents(line, timestamp);
  if (log) {
    log.userId = userId;
    log.reportedBy = currentPlayer ? [currentPlayer] : ["Unknown"];
    return log;
  }

  log = parseQuantumTravel(line, timestamp);
  if (log) {
    log.userId = userId;
    log.reportedBy = currentPlayer ? [currentPlayer] : ["Unknown"];
    return log;
  }

  log = parseQuantumArrival(line, timestamp);
  if (log) {
    log.userId = userId;
    log.reportedBy = currentPlayer ? [currentPlayer] : ["Unknown"];
    return log;
  }

  log = parseEquipmentEvents(line, timestamp);
  if (log) {
    log.userId = userId;
    log.reportedBy = currentPlayer ? [currentPlayer] : ["Unknown"];
    return log;
  }

  log = parseEquipItem(line, timestamp);
  if (log) {
    log.userId = userId;
    log.reportedBy = currentPlayer ? [currentPlayer] : ["Unknown"];
    return log;
  }

  log = parseEnvironmentalHazards(line, timestamp);
  if (log) {
    log.userId = userId;
    log.reportedBy = currentPlayer ? [currentPlayer] : ["Unknown"];
    return log;
  }

  // Item placement events - DISABLED (too noisy)
  // log = parseActorStatePlace(line, timestamp);
  // if (log) {
  // 	log.userId = userId;
  // 	log.reportedBy = currentPlayer ? [currentPlayer] : ['Unknown'];
  // 	return log;
  // }

  return null;
}

/**
 * Parse multiple log lines
 *
 * Note: Pattern extraction for log schema discovery now happens in Rust
 * (apps/desktop/src-tauri/src/lib.rs) during the single-pass file read.
 *
 * @param lines - Array of raw log lines
 * @param userId - User ID to assign to parsed logs
 * @returns Array of parsed Log objects (unmatched lines filtered out)
 */
export function parseLogLines(lines: string[], userId: string): Log[] {
  return lines
    .map((line) => parseStarCitizenLogLine(line, userId))
    .filter((log): log is Log => log !== null);
}

/**
 * Extract player name from log file content by scanning for connection events
 * Returns the first player name found, or null if none found
 */
export function extractPlayerName(logContent: string): string | null {
  const lines = logContent.split("\n");
  for (const line of lines) {
    if (line.includes("AccountLoginCharacterStatus_Character")) {
      const nameMatch = line.match(/name\s+(.+?)\s+-\s+/);
      if (nameMatch) {
        return nameMatch[1];
      }
    }
  }
  return null;
}

/**
 * Detect Star Citizen environment from file path
 * Returns 'LIVE', 'PTU', 'HOTFIX', or 'UNKNOWN'
 */
export function detectEnvironment(
  filePath: string,
): "LIVE" | "PTU" | "HOTFIX" | "UNKNOWN" {
  if (filePath.includes("\\LIVE\\") || filePath.includes("/LIVE/")) {
    return "LIVE";
  }
  if (filePath.includes("\\PTU\\") || filePath.includes("/PTU/")) {
    return "PTU";
  }
  if (filePath.includes("\\HOTFIX\\") || filePath.includes("/HOTFIX/")) {
    return "HOTFIX";
  }
  return "UNKNOWN";
}
