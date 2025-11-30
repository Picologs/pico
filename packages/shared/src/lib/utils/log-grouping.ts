/**
 * Custom log grouping functions for picologs
 * Groups similar events that happen close together in time
 * Pattern inspired by groupKillingSprees() from @pico/shared
 */

import type { Log } from "@pico/types";
import { formatMissionObjectiveState } from "./log-parser.js";

/**
 * Observable event types that can be witnessed by multiple players simultaneously
 * These events will be grouped across players when they occur within a time window
 */
export const CROSS_PLAYER_OBSERVABLE_EVENTS = [
  "destruction", // Ship/vehicle destroyed
  "actor_death", // Player/NPC death
  "fatal_collision", // Vehicle collision
  "quantum_arrival", // Quantum travel arrival
  "landing_pad", // Landing pad events
  "mission_completed", // Mission completion
  "mission_ended", // Mission end
] as const;

/**
 * Generate a signature for an event that can be used to match the same event across players
 * Returns null if the event is not groupable across players
 */
export function getEventSignature(log: Log): string | null {
  const eventType = log.eventType;

  if (
    !eventType ||
    !CROSS_PLAYER_OBSERVABLE_EVENTS.includes(
      eventType as (typeof CROSS_PLAYER_OBSERVABLE_EVENTS)[number],
    )
  ) {
    return null;
  }

  // Build signature based on event type and key identifying metadata
  switch (eventType) {
    case "destruction":
      // Group by destroyed entity (vehicle name/id)
      if (log.metadata?.vehicleName) {
        return `destruction:${log.metadata.vehicleName}`;
      }
      return null;

    case "actor_death":
      // Group by victim (same person dying seen by multiple players)
      if (log.metadata?.victimName) {
        const zone = log.metadata.zone || "";
        const cause = log.metadata.deathCause || "";
        return `actor_death:${log.metadata.victimName}:${zone}:${cause}`;
      }
      return null;

    case "fatal_collision":
      // Group by vehicle involved in collision
      if (log.metadata?.vehicleName) {
        return `fatal_collision:${log.metadata.vehicleName}`;
      }
      return null;

    case "quantum_arrival":
      // Group by ship (same ship spotted by multiple players)
      if (log.metadata?.vehicleId) {
        return `quantum_arrival:${log.metadata.vehicleName}:${log.metadata.vehicleId}`;
      }
      return null;

    case "landing_pad":
      // Group by pad location
      if (log.metadata?.padId || log.metadata?.location) {
        return `landing_pad:${log.metadata.padId || log.metadata.location}`;
      }
      return null;

    case "mission_completed":
    case "mission_ended":
      // Group by mission ID
      if (log.metadata?.missionId) {
        return `${eventType}:${log.metadata.missionId}`;
      }
      return null;

    default:
      return null;
  }
}

/**
 * Create a grouped log for events witnessed by multiple players
 */
function createCrossPlayerGroupLog(logs: Log[]): Log {
  const firstLog = logs[0];
  const playerCount = logs.length;

  // Collect unique user IDs
  const userIds = [
    ...new Set(logs.map((l) => l.userId).filter(Boolean)),
  ] as string[];

  // Create unique ID
  const groupContent = logs.map((l) => l.id).join("-");
  const timestamp = new Date(firstLog.timestamp).getTime();
  const contentHash = Math.abs(hashString(groupContent)).toString(36);
  const id = `group-cross-player-${timestamp}-${contentHash}-${++groupCounter}`;

  return {
    id,
    userId: firstLog.userId,
    player: firstLog.player,
    reportedBy: logs.map((l) => l.player || "Unknown").filter(Boolean),
    emoji: firstLog.emoji || "👥",
    line: firstLog.line,
    timestamp: firstLog.timestamp,
    original: logs.map((l) => l.original).join("\n"),
    open: false,
    eventType: "cross_player_group",
    children: logs,
    metadata: {
      ...firstLog.metadata,
      playerCount,
      userIds,
      originalEventType: firstLog.eventType,
    },
  };
}

/**
 * Group events that are the same across different players
 * Only applies when viewing group logs (multiple users)
 */
export function groupCrossPlayerEvents(logs: Log[]): Log[] {
  const CROSS_PLAYER_TIMEOUT_MS = 5 * 1000; // 5 seconds
  const MIN_PLAYERS = 2;

  // Build signature groups with time windows
  const signatureGroups = new Map<string, Log[]>();
  const result: Log[] = [];
  const groupedLogIds = new Set<string>();

  console.log(
    "[groupCrossPlayerEvents] Starting cross-player grouping, input logs:",
    logs.length,
  );

  // First pass: collect logs by signature
  for (const log of logs) {
    const signature = getEventSignature(log);
    if (signature) {
      if (!signatureGroups.has(signature)) {
        signatureGroups.set(signature, []);
      }
      signatureGroups.get(signature)!.push(log);
    }
  }

  // Second pass: process signature groups with time windows
  for (const [signature, signatureLogs] of signatureGroups) {
    // Sort by timestamp
    signatureLogs.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    // Group by time window and unique users
    let currentGroup: Log[] = [];
    let currentUserIds = new Set<string>();
    let lastTime: Date | null = null;

    for (const log of signatureLogs) {
      const logTime = new Date(log.timestamp);
      const userId = log.userId;

      // Check if within time window
      const withinWindow =
        lastTime &&
        logTime.getTime() - lastTime.getTime() <= CROSS_PLAYER_TIMEOUT_MS;

      // Check if this is a different user (same user's duplicate shouldn't count)
      const isDifferentUser = userId && !currentUserIds.has(userId);

      if (withinWindow && currentGroup.length > 0) {
        // Add to current group
        currentGroup.push(log);
        if (userId) currentUserIds.add(userId);
      } else {
        // Finalize previous group
        if (
          currentGroup.length >= MIN_PLAYERS &&
          currentUserIds.size >= MIN_PLAYERS
        ) {
          const groupLog = createCrossPlayerGroupLog(currentGroup);
          checkIdCollision(groupLog.id, result, "cross_player");
          result.push(groupLog);
          currentGroup.forEach((l) => groupedLogIds.add(l.id));
        }
        // Start new group
        currentGroup = [log];
        currentUserIds = new Set(userId ? [userId] : []);
      }
      lastTime = logTime;
    }

    // Finalize last group
    if (
      currentGroup.length >= MIN_PLAYERS &&
      currentUserIds.size >= MIN_PLAYERS
    ) {
      const groupLog = createCrossPlayerGroupLog(currentGroup);
      checkIdCollision(groupLog.id, result, "cross_player");
      result.push(groupLog);
      currentGroup.forEach((l) => groupedLogIds.add(l.id));
    }
  }

  // Add non-grouped logs
  for (const log of logs) {
    if (!groupedLogIds.has(log.id)) {
      result.push(log);
    }
  }

  // Sort by timestamp
  result.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  console.log(
    "[groupCrossPlayerEvents] Completed cross-player grouping, output logs:",
    result.length,
  );
  return result;
}

// Counter to ensure unique group IDs even when same logs are regrouped
let groupCounter = 0;

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
function checkIdCollision(
  newId: string,
  existingLogs: Log[],
  groupType: string,
): void {
  const collision = existingLogs.find((log) => log.id === newId);
  if (collision) {
    console.warn(
      `[Grouping] ID collision detected for ${groupType}:`,
      newId,
      "Existing log:",
      collision.line,
    );
  }
}

/**
 * Group equipment attachment events that happen close together
 * Groups AttachmentReceived and EquipItem events for the same player within 2 minutes
 * Minimum 2 items required to form a group
 */
export function groupEquipmentEvents(logs: Log[]): Log[] {
  const result: Log[] = [];
  let currentGroup: Log[] = [];
  let lastEventTime: Date | null = null;
  let currentPlayer: string | null = null;

  const GROUP_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
  const MIN_GROUP_SIZE = 2;

  console.log(
    "[groupEquipmentEvents] Starting grouping, input logs:",
    logs.length,
  );

  for (const log of logs) {
    const isEquipment =
      log.eventType === "equipment_received" ||
      log.eventType === "equipment_equip";
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
          checkIdCollision(groupLog.id, result, "equipment");
          result.push(groupLog);
        } else {
          result.push(...currentGroup);
        }
        currentGroup = [log];
        currentPlayer = player;
      }
      lastEventTime = eventTime;
    } else {
      // Non-equipment event - pass through without interrupting group
      result.push(log);
    }
  }

  // Handle remaining group
  if (currentGroup.length >= MIN_GROUP_SIZE) {
    const groupLog = createEquipmentGroupLog(currentGroup);
    checkIdCollision(groupLog.id, result, "equipment");
    result.push(groupLog);
  } else {
    result.push(...currentGroup);
  }

  console.log(
    "[groupEquipmentEvents] Completed grouping, output logs:",
    result.length,
  );
  return result;
}

/**
 * Create a grouped equipment log from individual attachment/equip events
 */
function createEquipmentGroupLog(items: Log[]): Log {
  const firstItem = items[0];
  const itemCount = items.length;
  const player = firstItem.player || "Player";

  // Create unique ID with group prefix to prevent collision with individual events
  const groupContent = items.map((i) => i.id).join("-");
  const timestamp = new Date(firstItem.timestamp).getTime();
  const contentHash = Math.abs(hashString(groupContent)).toString(36);
  const id = `group-equipment-${timestamp}-${contentHash}-${++groupCounter}`;

  // Collect item names from both equipment_received and equipment_equip events
  const itemNames = items
    .map((item) => item.metadata?.attachmentName || item.metadata?.itemClass)
    .filter(Boolean);

  return {
    id,
    userId: firstItem.userId,
    player: firstItem.player,
    reportedBy: firstItem.reportedBy || ["Unknown"],
    emoji: "🎒",
    line: `${player} equipped ${itemCount} item${itemCount > 1 ? "s" : ""}`,
    timestamp: firstItem.timestamp,
    original: items.map((item) => item.original).join("\n"),
    open: false,
    eventType: "equipment_group",
    children: items,
    metadata: {
      itemCount,
      items: itemNames,
    },
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

  console.log(
    "[groupInsuranceEvents] Starting grouping, input logs:",
    logs.length,
  );

  for (const log of logs) {
    const isInsurance = log.eventType === "insurance_claim";

    if (isInsurance) {
      const eventTime = new Date(log.timestamp);

      // Check if this event is part of current group
      if (
        lastEventTime &&
        eventTime.getTime() - lastEventTime.getTime() <= GROUP_TIMEOUT_MS
      ) {
        currentGroup.push(log);
      } else {
        // Finish previous group
        if (currentGroup.length >= MIN_GROUP_SIZE) {
          const groupLog = createInsuranceGroupLog(currentGroup);
          checkIdCollision(groupLog.id, result, "insurance");
          result.push(groupLog);
        } else {
          result.push(...currentGroup);
        }
        currentGroup = [log];
      }
      lastEventTime = eventTime;
    } else {
      // Non-insurance event - pass through without interrupting group
      result.push(log);
    }
  }

  // Handle remaining group
  if (currentGroup.length >= MIN_GROUP_SIZE) {
    const groupLog = createInsuranceGroupLog(currentGroup);
    checkIdCollision(groupLog.id, result, "insurance");
    result.push(groupLog);
  } else {
    result.push(...currentGroup);
  }

  console.log(
    "[groupInsuranceEvents] Completed grouping, output logs:",
    result.length,
  );
  return result;
}

/**
 * Create a grouped insurance log from individual claim events
 */
function createInsuranceGroupLog(claims: Log[]): Log {
  const firstClaim = claims[0];
  const claimCount = claims.length;

  // Create unique ID with group prefix to prevent collision with individual events
  const groupContent = claims.map((c) => c.id).join("-");
  const timestamp = new Date(firstClaim.timestamp).getTime();
  const contentHash = Math.abs(hashString(groupContent)).toString(36);
  const id = `group-insurance-${timestamp}-${contentHash}-${++groupCounter}`;

  return {
    id,
    userId: firstClaim.userId,
    player: firstClaim.player,
    reportedBy: firstClaim.reportedBy || ["Unknown"],
    emoji: "📋",
    line: `Processed ${claimCount} insurance claims`,
    timestamp: firstClaim.timestamp,
    original: claims.map((claim) => claim.original).join("\n"),
    open: false,
    eventType: "insurance_group",
    children: claims,
    metadata: {
      claimCount,
      entitlements: claims
        .map((claim) => claim.metadata?.entitlementURN)
        .filter(Boolean),
    },
  };
}

/**
 * Create a grouped respawn log from individual respawn events
 * Includes both hospital_respawn and medical_bed events
 */
function createRespawnGroupLog(respawns: Log[]): Log {
  const firstRespawn = respawns[0];
  const respawnCount = respawns.length;

  // Create unique ID with group prefix to prevent collision with individual events
  const groupContent = respawns.map((r) => r.id).join("-");
  const timestamp = new Date(firstRespawn.timestamp).getTime();
  const contentHash = Math.abs(hashString(groupContent)).toString(36);
  const id = `group-respawn-${timestamp}-${contentHash}-${++groupCounter}`;

  // Collect respawn locations for metadata
  const locations = respawns
    .map((r) => r.metadata?.bedId)
    .filter(Boolean) as string[];
  const uniqueLocations = [...new Set(locations)];

  return {
    id,
    userId: firstRespawn.userId,
    player: firstRespawn.player,
    reportedBy: firstRespawn.reportedBy || ["Unknown"],
    emoji: "🏥",
    line: `${respawnCount} respawns`,
    timestamp: firstRespawn.timestamp,
    original: respawns.map((r) => r.original).join("\n"),
    open: false,
    eventType: "respawn_group",
    children: respawns,
    metadata: {
      respawnCount,
      locations: uniqueLocations,
      events: respawns.map((r) => ({
        player: r.metadata?.player,
        bedId: r.metadata?.bedId,
        eventType: r.eventType,
      })),
    },
  };
}

/**
 * Group environmental hazard events that happen close together
 * Groups suffocation and depressurization events for the same player within 1 minute
 * Minimum 2 events required to form a group
 */
export function groupEnvironmentalHazards(logs: Log[]): Log[] {
  const result: Log[] = [];
  let currentGroup: Log[] = [];
  let lastEventTime: Date | null = null;
  let currentPlayer: string | null = null;

  const GROUP_TIMEOUT_MS = 1 * 60 * 1000; // 1 minute
  const MIN_GROUP_SIZE = 2;

  console.log(
    "[groupEnvironmentalHazards] Starting grouping, input logs:",
    logs.length,
  );

  for (const log of logs) {
    const isHazard = log.eventType === "environmental_hazard";
    const player = log.player;

    if (isHazard && player) {
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
          const groupLog = createEnvironmentalHazardGroupLog(currentGroup);
          checkIdCollision(groupLog.id, result, "environmental_hazard");
          result.push(groupLog);
        } else {
          result.push(...currentGroup);
        }
        currentGroup = [log];
        currentPlayer = player;
      }
      lastEventTime = eventTime;
    } else {
      // Non-hazard event - pass through without interrupting group
      result.push(log);
    }
  }

  // Handle remaining group
  if (currentGroup.length >= MIN_GROUP_SIZE) {
    const groupLog = createEnvironmentalHazardGroupLog(currentGroup);
    checkIdCollision(groupLog.id, result, "environmental_hazard");
    result.push(groupLog);
  } else {
    result.push(...currentGroup);
  }

  console.log(
    "[groupEnvironmentalHazards] Completed grouping, output logs:",
    result.length,
  );
  return result;
}

/**
 * Create a grouped environmental hazard log from individual hazard events
 */
function createEnvironmentalHazardGroupLog(hazards: Log[]): Log {
  const firstHazard = hazards[0];
  const hazardCount = hazards.length;
  const player = firstHazard.player || "Player";

  // Create unique ID with group prefix to prevent collision with individual events
  const groupContent = hazards.map((h) => h.id).join("-");
  const timestamp = new Date(firstHazard.timestamp).getTime();
  const contentHash = Math.abs(hashString(groupContent)).toString(36);
  const id = `group-environmental-${timestamp}-${contentHash}-${++groupCounter}`;

  // Collect hazard types for metadata
  const hazardTypes = hazards
    .map((h) => h.metadata?.hazardType)
    .filter(Boolean) as string[];
  const uniqueTypes = [...new Set(hazardTypes)];

  return {
    id,
    userId: firstHazard.userId,
    player: firstHazard.player,
    reportedBy: firstHazard.reportedBy || ["Unknown"],
    emoji: "⚠️",
    line: `${player} experiencing environmental hazards (${hazardCount})`,
    timestamp: firstHazard.timestamp,
    original: hazards.map((h) => h.original).join("\n"),
    open: false,
    eventType: "environmental_hazard_group",
    children: hazards,
    metadata: {
      hazardCount,
      hazardTypes: uniqueTypes,
      events: hazards.map((h) => ({
        type: h.metadata?.hazardType,
        state: h.metadata?.hazardState,
      })),
    },
  };
}

/**
 * Group inventory request events that happen close together
 * Groups location_change events for the same player and location within 1 minute
 * Minimum 2 requests required to form a group
 */
export function groupInventoryRequests(logs: Log[]): Log[] {
  const result: Log[] = [];
  let currentGroup: Log[] = [];
  let lastEventTime: Date | null = null;
  let currentPlayer: string | null = null;
  let currentLocation: string | null = null;

  const GROUP_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
  const MIN_GROUP_SIZE = 2;

  console.log(
    "[groupInventoryRequests] Starting grouping, input logs:",
    logs.length,
  );

  for (const log of logs) {
    const isInventoryRequest = log.eventType === "location_change";
    const player = log.player;
    const location = log.metadata?.location as string | undefined;

    if (isInventoryRequest && player && location) {
      const eventTime = new Date(log.timestamp);

      // Check if this event is part of current group
      if (
        lastEventTime &&
        currentPlayer === player &&
        currentLocation === location &&
        eventTime.getTime() - lastEventTime.getTime() <= GROUP_TIMEOUT_MS
      ) {
        currentGroup.push(log);
      } else {
        // Finish previous group
        if (currentGroup.length >= MIN_GROUP_SIZE) {
          const groupLog = createInventoryGroupLog(currentGroup);
          checkIdCollision(groupLog.id, result, "inventory");
          result.push(groupLog);
        } else {
          result.push(...currentGroup);
        }
        currentGroup = [log];
        currentPlayer = player;
        currentLocation = location;
      }
      lastEventTime = eventTime;
    } else {
      // Non-inventory event - pass through without interrupting group
      result.push(log);
    }
  }

  // Handle remaining group
  if (currentGroup.length >= MIN_GROUP_SIZE) {
    const groupLog = createInventoryGroupLog(currentGroup);
    checkIdCollision(groupLog.id, result, "inventory");
    result.push(groupLog);
  } else {
    result.push(...currentGroup);
  }

  console.log(
    "[groupInventoryRequests] Completed grouping, output logs:",
    result.length,
  );
  return result;
}

/**
 * Create a grouped inventory request log from individual location_change events
 */
function createInventoryGroupLog(requests: Log[]): Log {
  const firstRequest = requests[0];
  const requestCount = requests.length;
  const player = firstRequest.player || "Player";
  const location =
    (firstRequest.metadata?.location as string) || "unknown location";
  const formattedLocation = location.split("_").join(" ");

  // Create unique ID with group prefix to prevent collision with individual events
  const groupContent = requests.map((r) => r.id).join("-");
  const timestamp = new Date(firstRequest.timestamp).getTime();
  const contentHash = Math.abs(hashString(groupContent)).toString(36);
  const id = `group-inventory-${timestamp}-${contentHash}-${++groupCounter}`;

  return {
    id,
    userId: firstRequest.userId,
    player: firstRequest.player,
    reportedBy: firstRequest.reportedBy || ["Unknown"],
    emoji: "📦",
    line: `${player} requested inventory in ${formattedLocation} (${requestCount}x)`,
    timestamp: firstRequest.timestamp,
    original: requests.map((r) => r.original).join("\n"),
    open: false,
    eventType: "inventory_group",
    children: requests,
    metadata: {
      requestCount,
      location,
      formattedLocation,
    },
  };
}

/**
 * Create a grouped vehicle control error log from duplicate error events
 * Groups multiple vehicle control flow errors for the same vehicle within a time window
 */
function createVehicleErrorGroupLog(errors: Log[]): Log {
  const firstError = errors[0];
  const errorCount = errors.length;
  const player = firstError.player || "Player";
  const vehicleName = (firstError.metadata?.vehicleName as string) || "a ship";
  const vehicleId = (firstError.metadata?.vehicleId as string) || "unknown";

  // Create unique ID with group prefix to prevent collision with individual events
  const groupContent = errors.map((e) => e.id).join("-");
  const timestamp = new Date(firstError.timestamp).getTime();
  const contentHash = Math.abs(hashString(groupContent)).toString(36);
  const id = `group-vehicle-error-${timestamp}-${contentHash}-${++groupCounter}`;

  // Format vehicle name (remove trailing underscore ID if present)
  const formattedVehicleName =
    vehicleName.split("_").slice(0, -1).join(" ") || vehicleName;

  return {
    id,
    userId: firstError.userId,
    player: firstError.player,
    reportedBy: firstError.reportedBy || ["Unknown"],
    emoji: firstError.emoji || "🚀",
    line: `${player} controls ${formattedVehicleName} (${errorCount}x)`,
    timestamp: firstError.timestamp,
    original: errors.map((e) => e.original).join("\n"),
    open: false,
    eventType: "vehicle_control_group",
    children: errors,
    metadata: {
      errorCount,
      vehicleName,
      vehicleId,
      action: firstError.metadata?.action,
    },
  };
}

/**
 * Create a grouped vehicle exit log from standalone exit events
 * Groups multiple "exited X ship" events for the same vehicle within a time window
 */
function createVehicleExitGroupLog(exits: Log[]): Log {
  const firstExit = exits[0];
  const exitCount = exits.length;
  const vehicleName = firstExit.metadata?.vehicleName || "a ship";
  const vehicleId = firstExit.metadata?.vehicleId || "unknown";

  // Create unique ID
  const groupContent = exits.map((e) => e.id).join("-");
  const timestamp = new Date(firstExit.timestamp).getTime();
  const contentHash = Math.abs(hashString(groupContent)).toString(36);
  const id = `group-vehicle-exit-${timestamp}-${contentHash}-${++groupCounter}`;

  // Format vehicle name (remove trailing underscore ID)
  const formattedVehicleName = (vehicleName as string)
    .split("_")
    .slice(0, -1)
    .join(" ");

  return {
    id,
    userId: firstExit.userId,
    player: firstExit.player,
    reportedBy: firstExit.reportedBy || ["Unknown"],
    emoji: "🚪",
    line: `${firstExit.player} exited ${formattedVehicleName} (${exitCount}x)`,
    timestamp: firstExit.timestamp,
    original: exits.map((e) => e.original).join("\n"),
    open: false,
    eventType: "vehicle_exit_group",
    children: exits,
    metadata: {
      vehicleName,
      vehicleId,
      exitCount,
      team: firstExit.metadata?.team,
    },
  };
}

/**
 * Create a grouped vehicle control log from individual events
 * Groups request → grant → release sequences for the same vehicle
 */
function createVehicleControlGroupLog(events: Log[]): Log {
  const firstEvent = events[0];
  const vehicleName = firstEvent.metadata?.vehicleName || "a ship";
  const vehicleId = firstEvent.metadata?.vehicleId || "unknown";

  // Create unique ID
  const groupContent = events.map((e) => e.id).join("-");
  const timestamp = new Date(firstEvent.timestamp).getTime();
  const contentHash = Math.abs(hashString(groupContent)).toString(36);
  const id = `group-vehicle-${timestamp}-${contentHash}-${++groupCounter}`;

  // Determine if still in ship (no release event)
  const hasRelease = events.some((e) => e.metadata?.action === "releasing");
  const emoji = hasRelease ? "🚀" : "🛸";
  const line = hasRelease
    ? `${firstEvent.player} piloted ${(vehicleName as string).split("_").slice(0, -1).join(" ")}`
    : `${firstEvent.player} is piloting ${(vehicleName as string).split("_").slice(0, -1).join(" ")}...`;

  return {
    id,
    userId: firstEvent.userId,
    player: firstEvent.player,
    reportedBy: firstEvent.reportedBy || ["Unknown"],
    emoji,
    line,
    timestamp: firstEvent.timestamp,
    original: events.map((e) => e.original).join("\n"),
    open: false,
    eventType: "vehicle_control_group",
    children: events,
    metadata: {
      vehicleName,
      vehicleId,
      eventCount: events.length,
      actions: events.map((e) => e.metadata?.action),
      team: firstEvent.metadata?.team,
    },
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
  const groupContent = updates.map((u) => u.id).join("-");
  const timestamp = new Date(firstUpdate.timestamp).getTime();
  const contentHash = Math.abs(hashString(groupContent)).toString(36);
  const id = `group-mission-objective-${timestamp}-${contentHash}-${++groupCounter}`;

  // Get the latest state
  const finalState =
    (lastUpdate.metadata?.objectiveState as string) || "UPDATED";
  const formattedState = formatMissionObjectiveState(finalState);

  return {
    id,
    userId: firstUpdate.userId,
    player: firstUpdate.player,
    reportedBy: firstUpdate.reportedBy || ["Unknown"],
    emoji: "🎯",
    line: `Mission objectives (${updateCount} updates)`,
    timestamp: firstUpdate.timestamp,
    original: updates.map((u) => u.original).join("\n"),
    open: false,
    eventType: "mission_objective_group",
    children: updates,
    metadata: {
      updateCount,
      missionId: firstUpdate.metadata?.missionId,
      objectiveId: firstUpdate.metadata?.objectiveId,
      finalState,
      states: updates.map((u) => u.metadata?.objectiveState),
    },
  };
}

/**
 * Create a grouped mission log from all mission lifecycle events (shared, objectives, completion)
 * Groups by mission ID to show complete mission timeline
 */
function createMissionGroupLog(events: Log[]): Log {
  // Sort events chronologically (shared → objectives → completion)
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const firstEvent = sortedEvents[0];
  const lastEvent = sortedEvents[sortedEvents.length - 1];
  const eventCount = events.length;

  // Extract mission information
  const missionId = firstEvent.metadata?.missionId as string;

  // Count objectives
  const objectiveCount = events.filter(
    (e) => e.eventType === "mission_objective",
  ).length;

  // Determine completion state
  const completedEvent = events.find(
    (e) => e.eventType === "mission_completed",
  );
  const endedEvent = events.find((e) => e.eventType === "mission_ended");

  let emoji = "📋";
  let displayLine = "";
  let completionType: string | undefined;

  if (endedEvent) {
    completionType = endedEvent.metadata?.completionType as string;
    const player = endedEvent.metadata?.player || firstEvent.player || "Player";

    if (completionType === "Complete") {
      emoji = "✅";
      displayLine = `${player} completed mission${objectiveCount > 0 ? ` (${objectiveCount} objective${objectiveCount > 1 ? "s" : ""})` : ""}`;
    } else if (completionType === "Fail") {
      emoji = "❌";
      displayLine = `${player} failed mission${objectiveCount > 0 ? ` (${objectiveCount} objective${objectiveCount > 1 ? "s" : ""})` : ""}`;
    } else if (completionType === "Abort") {
      emoji = "🚫";
      displayLine = `${player} aborted mission${objectiveCount > 0 ? ` (${objectiveCount} objective${objectiveCount > 1 ? "s" : ""})` : ""}`;
    } else {
      displayLine = `${player} ended mission${objectiveCount > 0 ? ` (${objectiveCount} objective${objectiveCount > 1 ? "s" : ""})` : ""}`;
    }
  } else if (completedEvent) {
    emoji = "✅";
    const player = firstEvent.player || "Player";
    displayLine = `${player} completed mission${objectiveCount > 0 ? ` (${objectiveCount} objective${objectiveCount > 1 ? "s" : ""})` : ""}`;
    completionType = "completed";
  } else {
    // Ongoing mission (only shared + objectives, no completion)
    const player = firstEvent.player || "Player";
    displayLine = `${player}'s mission in progress${objectiveCount > 0 ? ` (${objectiveCount} objective${objectiveCount > 1 ? "s" : ""})` : ""}`;
  }

  // Create unique ID with group prefix to prevent collision with individual events
  const groupContent = events.map((e) => e.id).join("-");
  const timestamp = new Date(firstEvent.timestamp).getTime();
  const contentHash = Math.abs(hashString(groupContent)).toString(36);
  const id = `group-mission-${timestamp}-${contentHash}-${++groupCounter}`;

  return {
    id,
    userId: firstEvent.userId,
    player: firstEvent.player,
    reportedBy: firstEvent.reportedBy || ["Unknown"],
    emoji,
    line: displayLine,
    timestamp: firstEvent.timestamp,
    original: sortedEvents.map((e) => e.original).join("\n"),
    open: false,
    eventType: "mission_group",
    children: sortedEvents,
    metadata: {
      missionId,
      eventCount,
      objectiveCount,
      completionType,
      events: sortedEvents.map((e) => ({
        type: e.eventType,
        timestamp: e.timestamp,
      })),
    },
  };
}

/**
 * Create a grouped quantum travel log from individual quantum travel events
 */
function createQuantumTravelGroupLog(events: Log[]): Log {
  const firstEvent = events[0];
  const eventCount = events.length;

  // Create unique ID with group prefix to prevent collision with individual events
  const groupContent = events.map((e) => e.id).join("-");
  const timestamp = new Date(firstEvent.timestamp).getTime();
  const contentHash = Math.abs(hashString(groupContent)).toString(36);
  const id = `group-quantum-travel-${timestamp}-${contentHash}-${++groupCounter}`;

  // Collect state transitions
  const transitions = events
    .map((e) => {
      const from = e.metadata?.qtStateFrom;
      const to = e.metadata?.qtStateTo;
      if (from && to) return `${from} → ${to}`;
      return null;
    })
    .filter(Boolean);

  return {
    id,
    userId: firstEvent.userId,
    player: firstEvent.player,
    reportedBy: firstEvent.reportedBy || ["Unknown"],
    emoji: "⚡",
    line: `Quantum travel (${eventCount} jumps)`,
    timestamp: firstEvent.timestamp,
    original: events.map((e) => e.original).join("\n"),
    open: false,
    eventType: "quantum_travel_group",
    children: events,
    metadata: {
      eventCount,
      transitions,
      states: events.map((e) => ({
        from: e.metadata?.qtStateFrom,
        to: e.metadata?.qtStateTo,
        reason: e.metadata?.qtReason,
      })),
    },
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

  console.log(
    "[groupKillingSprees] Starting grouping, input logs:",
    logs.length,
  );

  for (const log of logs) {
    const isKill =
      log.eventType === "actor_death" &&
      log.metadata?.killerName === log.player;

    if (isKill) {
      const killTime = new Date(log.timestamp);

      // Check if this kill is part of current spree
      if (
        lastKillTime &&
        killTime.getTime() - lastKillTime.getTime() > SPREE_TIMEOUT_MS
      ) {
        // Timeout - finish current spree
        if (currentSpree.length >= MIN_SPREE_SIZE) {
          const spreeLog = createSpreeLog(currentSpree);
          checkIdCollision(spreeLog.id, result, "killing_spree");
          result.push(spreeLog);
        } else {
          result.push(...currentSpree);
        }
        currentSpree = [];
      }

      currentSpree.push(log);
      lastKillTime = killTime;
    } else {
      // Non-kill event - pass through without interrupting spree
      result.push(log);
    }
  }

  // Handle remaining spree
  if (currentSpree.length >= MIN_SPREE_SIZE) {
    const spreeLog = createSpreeLog(currentSpree);
    checkIdCollision(spreeLog.id, result, "killing_spree");
    result.push(spreeLog);
  } else {
    result.push(...currentSpree);
  }

  console.log(
    "[groupKillingSprees] Completed grouping, output logs:",
    result.length,
  );
  return result;
}

/**
 * Create a killing spree log from individual kill logs
 */
function createSpreeLog(kills: Log[]): Log {
  const firstKill = kills[0];
  const killCount = kills.length;

  // Create unique ID with group prefix to prevent collision with individual events
  const groupContent = kills.map((k) => k.id).join("-");
  const timestamp = new Date(firstKill.timestamp).getTime();
  const contentHash = Math.abs(hashString(groupContent)).toString(36);
  const id = `group-spree-${timestamp}-${contentHash}-${++groupCounter}`;

  return {
    id,
    userId: firstKill.userId,
    player: firstKill.player,
    reportedBy: firstKill.reportedBy || ["Unknown"],
    emoji: "🔥",
    line: `${firstKill.player} on a ${killCount}-kill spree!`,
    timestamp: firstKill.timestamp,
    original: kills.map((k) => k.original).join("\n"),
    open: false,
    eventType: "killing_spree",
    children: kills,
    metadata: {
      killCount,
      victims: kills.map((k) => k.metadata?.victimName).filter(Boolean),
    },
  };
}

/**
 * Group bounty kills that occur within 5 minutes
 * Creates a bounty_kill_group parent with individual bounty_kill events as children
 * Minimum 3 bounty kills required to form a group
 */
export function groupBountyKills(logs: Log[]): Log[] {
  const result: Log[] = [];
  let currentGroup: Log[] = [];
  let lastKillTime: Date | null = null;

  const GROUP_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  const MIN_GROUP_SIZE = 3;

  console.log("[groupBountyKills] Starting grouping, input logs:", logs.length);

  for (const log of logs) {
    const isBountyKill = log.eventType === "bounty_kill";

    if (isBountyKill) {
      const killTime = new Date(log.timestamp);

      // Check if this kill is part of current group
      if (
        lastKillTime &&
        killTime.getTime() - lastKillTime.getTime() > GROUP_TIMEOUT_MS
      ) {
        // Timeout - finish current group
        if (currentGroup.length >= MIN_GROUP_SIZE) {
          const groupLog = createBountyGroupLog(currentGroup);
          checkIdCollision(groupLog.id, result, "bounty_kill_group");
          result.push(groupLog);
        } else {
          result.push(...currentGroup);
        }
        currentGroup = [];
      }

      currentGroup.push(log);
      lastKillTime = killTime;
    } else {
      // Non-bounty event - pass through without interrupting group
      result.push(log);
    }
  }

  // Handle remaining group
  if (currentGroup.length >= MIN_GROUP_SIZE) {
    const groupLog = createBountyGroupLog(currentGroup);
    checkIdCollision(groupLog.id, result, "bounty_kill_group");
    result.push(groupLog);
  } else {
    result.push(...currentGroup);
  }

  console.log(
    "[groupBountyKills] Completed grouping, output logs:",
    result.length,
  );
  return result;
}

/**
 * Create a bounty kill group log from individual bounty kill logs
 */
function createBountyGroupLog(kills: Log[]): Log {
  const firstKill = kills[0];
  const killCount = kills.length;

  // Create unique ID with group prefix to prevent collision with individual events
  const groupContent = kills.map((k) => k.id).join("-");
  const timestamp = new Date(firstKill.timestamp).getTime();
  const contentHash = Math.abs(hashString(groupContent)).toString(36);
  const id = `group-bounty-${timestamp}-${contentHash}-${++groupCounter}`;

  // Collect target types for metadata
  const targetTypes = kills
    .map((k) => k.metadata?.targetType)
    .filter(Boolean) as string[];

  return {
    id,
    userId: firstKill.userId,
    player: firstKill.player,
    reportedBy: firstKill.reportedBy || ["Unknown"],
    emoji: "🔥🎯",
    line: `${firstKill.player} eliminated ${killCount} bounty targets!`,
    timestamp: firstKill.timestamp,
    original: kills.map((k) => k.original).join("\n"),
    open: false,
    eventType: "bounty_kill_group",
    children: kills,
    metadata: {
      killCount,
      targetTypes,
      objectiveIds: kills.map((k) => k.metadata?.objectiveId).filter(Boolean),
    },
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
    if (
      log.children &&
      Array.isArray(log.children) &&
      log.children.length > 0
    ) {
      console.log(
        `[flattenGroups] Flattening group ${log.id} with ${log.children.length} children`,
      );
      result.push(...log.children);
    } else {
      // Regular log without children
      result.push(log);
    }
  }

  console.log(
    `[flattenGroups] Flattened ${logs.length} logs to ${result.length} individual logs`,
  );
  return result;
}

/**
 * Group crash-death event sequences
 * Combines fatal_collision + vehicle_control_flow (releasing) + actor_death (vehicle_destruction)
 * into a single crash_death_group event when they occur within 30 seconds for the same player/vehicle
 */
export function groupCrashDeathEvents(logs: Log[]): Log[] {
  const result: Log[] = [];
  const groupedLogIds = new Set<string>(); // Track which logs have been consumed
  const CRASH_TIMEOUT_MS = 30 * 1000; // 30 seconds

  console.log(
    "[groupCrashDeathEvents] Starting crash-death grouping, input logs:",
    logs.length,
  );

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];

    // Skip logs that have already been grouped
    if (groupedLogIds.has(log.id)) {
      continue;
    }

    if (log.eventType === "fatal_collision") {
      const crashTime = new Date(log.timestamp);
      const vehicleName = log.metadata?.vehicleName;
      const player = log.player;
      const hitEntity = log.metadata?.hitEntity;

      console.log(
        `[groupCrashDeathEvents] 💥 Found crash at ${log.timestamp}:`,
      );
      console.log(`  Vehicle: "${vehicleName}"`);
      console.log(`  Player: "${player}"`);
      console.log(`  Hit: "${hitEntity}"`);
      console.log(
        `  Searching for: exit (vehicle="${vehicleName}") + death (zone="${vehicleName}", victim="${player}")`,
      );

      // Look ahead for exit + death within 30 seconds
      const relatedEvents: Log[] = [log];
      let j = i + 1;
      let foundExit = false;
      let foundDeath = false;

      while (
        j < logs.length &&
        new Date(logs[j].timestamp).getTime() - crashTime.getTime() <=
          CRASH_TIMEOUT_MS
      ) {
        const nextLog = logs[j];

        console.log(`  [${j}] ${nextLog.eventType}:`, {
          action: nextLog.metadata?.action,
          vehicleName: nextLog.metadata?.vehicleName,
          zone: nextLog.metadata?.zone,
          victimName: nextLog.metadata?.victimName,
          deathCause: nextLog.metadata?.deathCause,
        });

        // Match exit event (same vehicle)
        if (
          !foundExit &&
          nextLog.eventType === "vehicle_control_flow" &&
          nextLog.metadata?.action === "releasing" &&
          nextLog.metadata?.vehicleName === vehicleName
        ) {
          console.log(`    ✓ Found EXIT match!`);
          relatedEvents.push(nextLog);
          foundExit = true;
        } else if (!foundExit && nextLog.eventType === "vehicle_control_flow") {
          console.log(
            `    ✗ Exit mismatch: action="${nextLog.metadata?.action}" vehicle="${nextLog.metadata?.vehicleName}" (expected "${vehicleName}")`,
          );
        }

        // Match death event (same player + vehicle)
        if (
          !foundDeath &&
          nextLog.eventType === "actor_death" &&
          nextLog.metadata?.deathCause === "vehicle_destruction" &&
          nextLog.metadata?.zone === vehicleName &&
          nextLog.metadata?.victimName === player
        ) {
          console.log(`    ✓ Found DEATH match!`);
          relatedEvents.push(nextLog);
          foundDeath = true;
        } else if (!foundDeath && nextLog.eventType === "actor_death") {
          console.log(
            `    ✗ Death mismatch: cause="${nextLog.metadata?.deathCause}" zone="${nextLog.metadata?.zone}" victim="${nextLog.metadata?.victimName}" (expected zone="${vehicleName}", victim="${player}")`,
          );
        }

        // If we found both exit and death, we can stop looking
        if (foundExit && foundDeath) {
          break;
        }

        j++;
      }

      console.log(
        `  Result: foundExit=${foundExit}, foundDeath=${foundDeath}, relatedEvents=${relatedEvents.length}`,
      );
      if (!foundExit) console.log(`    ❌ Missing EXIT event`);
      if (!foundDeath) console.log(`    ❌ Missing DEATH event`);

      // If we found all 3 events, create group
      if (foundExit && foundDeath && relatedEvents.length === 3) {
        const groupLog = createCrashDeathGroupLog(relatedEvents);
        checkIdCollision(groupLog.id, result, "crash_death_group");
        result.push(groupLog);

        // Mark all events as grouped
        relatedEvents.forEach((event) => groupedLogIds.add(event.id));

        console.log(
          `[groupCrashDeathEvents] Created crash-death group for ${player} in ${vehicleName}`,
        );
      } else {
        // Standalone crash or incomplete sequence
        result.push(log);
        groupedLogIds.add(log.id);
      }
    } else {
      // Not a crash event - add it as standalone
      result.push(log);
      groupedLogIds.add(log.id);
    }
  }

  console.log(
    "[groupCrashDeathEvents] Completed crash-death grouping, output logs:",
    result.length,
  );
  return result;
}

/**
 * Create a crash-death group log from 3 related events
 */
function createCrashDeathGroupLog(events: Log[]): Log {
  const crashEvent = events.find((e) => e.eventType === "fatal_collision");
  const exitEvent = events.find((e) => e.metadata?.action === "releasing");
  const deathEvent = events.find(
    (e) => e.metadata?.deathCause === "vehicle_destruction",
  );

  if (!crashEvent) {
    throw new Error("createCrashDeathGroupLog called without crash event");
  }

  const vehicleName = crashEvent.metadata?.vehicleName || "ship";
  const hitEntity = crashEvent.metadata?.hitEntity || "unknown";
  const hitEntityPlayer = crashEvent.metadata?.hitEntityPlayer as
    | string
    | undefined;
  const hitEntityShip = crashEvent.metadata?.hitEntityShip as
    | string
    | undefined;
  const player = crashEvent.player;

  // Build enhanced entity string from parsed data
  let entityString: string;
  let hasKnownEntity = false;
  if (hitEntityPlayer && hitEntityShip) {
    entityString = `${hitEntityPlayer}'s ${hitEntityShip}`;
    hasKnownEntity = true;
  } else if (hitEntityPlayer) {
    entityString = hitEntityPlayer;
    hasKnownEntity = true;
  } else if (hitEntityShip) {
    entityString = hitEntityShip;
    hasKnownEntity = true;
  } else {
    entityString = hitEntity;
    hasKnownEntity = hitEntity !== "unknown";
  }

  const groupContent = events.map((e) => e.id).join("-");
  const timestamp = new Date(crashEvent.timestamp).getTime();
  const contentHash = Math.abs(hashString(groupContent)).toString(36);
  const id = `group-crash-death-${timestamp}-${contentHash}-${++groupCounter}`;

  // Build display line based on whether we know what was hit
  const crashDescription = hasKnownEntity
    ? `crashed into ${entityString}`
    : "had a fatal crash";

  return {
    id,
    userId: crashEvent.userId,
    player: player,
    reportedBy: crashEvent.reportedBy || ["Unknown"],
    emoji: "💥",
    line: `${player} died when their ${vehicleName} ${crashDescription}`,
    timestamp: crashEvent.timestamp,
    original: events.map((e) => e.original).join("\n"),
    open: false,

    eventType: "crash_death_group",
    children: events,
    metadata: {
      vehicleName,
      hitEntity,
      hitEntityPlayer,
      hitEntityShip,
      crashPart: crashEvent.metadata?.part,
      zone: crashEvent.metadata?.zone,
      victimName: deathEvent?.metadata?.victimName,
      eventCount: events.length,
    },
  };
}

/**
 * Optimized single-pass log processor
 * Combines flattening, crash-death grouping, and all other groupings into ONE loop
 * Uses sliding window for crash sequences instead of O(n²) lookahead
 */
export function processLogs(logs: Log[]): Log[] {
  const result: Log[] = [];
  const groupedLogIds = new Set<string>();

  // Optimized flatten: only create new array if needed
  // Logs from processAndLimitLogs are already flat, so this is usually O(1)
  let flatLogs = logs;
  const hasGroups = logs.some((log) => log.children && log.children.length > 0);
  if (hasGroups) {
    flatLogs = [];
    for (const log of logs) {
      if (
        log.children &&
        Array.isArray(log.children) &&
        log.children.length > 0
      ) {
        flatLogs.push(...log.children);
      } else {
        flatLogs.push(log);
      }
    }
  }

  // Crash sequence sliding window (buffered approach instead of lookahead)
  interface CrashSequence {
    crash: Log;
    crashTime: number;
    vehicleName: string;
    player: string;
    exit?: Log;
    death?: Log;
  }
  const activeCrashSequences: CrashSequence[] = [];
  const CRASH_TIMEOUT_MS = 30 * 1000;

  // All other grouping state (same as processAllGroupings)
  let killingSpree: Log[] = [];
  let lastKillTime: Date | null = null;
  let equipmentGroup: Log[] = [];
  let lastEquipmentTime: Date | null = null;
  let currentEquipmentPlayer: string | null = null;
  let insuranceGroup: Log[] = [];
  let lastInsuranceTime: Date | null = null;
  let environmentalHazardGroup: Log[] = [];
  let lastHazardTime: Date | null = null;
  let currentHazardPlayer: string | null = null;
  let inventoryGroup: Log[] = [];
  let lastInventoryTime: Date | null = null;
  let currentInventoryPlayer: string | null = null;
  let currentInventoryLocation: string | null = null;
  const vehicleErrorGroups = new Map<string, Log[]>();
  const missionGroups = new Map<string, Log[]>();
  let quantumTravelGroup: Log[] = [];
  let lastQuantumTravelTime: Date | null = null;
  let respawnGroup: Log[] = [];
  let lastRespawnTime: Date | null = null;

  // Timeouts and minimums
  const SPREE_TIMEOUT_MS = 5 * 60 * 1000;
  const MIN_SPREE_SIZE = 3;
  const EQUIPMENT_TIMEOUT_MS = 10 * 60 * 1000;
  const MIN_EQUIPMENT_SIZE = 2;
  const INSURANCE_TIMEOUT_MS = 2 * 60 * 1000;
  const MIN_INSURANCE_SIZE = 2;
  const HAZARD_TIMEOUT_MS = 1 * 60 * 1000;
  const MIN_HAZARD_SIZE = 2;
  const INVENTORY_TIMEOUT_MS = 10 * 60 * 1000;
  const MIN_INVENTORY_SIZE = 2;
  const VEHICLE_ERROR_TIMEOUT_MS = 10 * 60 * 1000;
  const MIN_VEHICLE_ERROR_SIZE = 2;
  const MIN_MISSION_GROUP_SIZE = 2;
  const QUANTUM_TRAVEL_TIMEOUT_MS = 1 * 60 * 1000;
  const MIN_QUANTUM_TRAVEL_SIZE = 2;
  const RESPAWN_TIMEOUT_MS = 5 * 60 * 1000;
  const MIN_RESPAWN_SIZE = 2;

  console.log(
    "[processLogs] Starting optimized single-pass processing, input logs:",
    flatLogs.length,
  );

  // Helper to finalize completed crash sequences
  const finalizeCrashSequences = (currentTime: number) => {
    const completedIndices: number[] = [];

    for (let i = 0; i < activeCrashSequences.length; i++) {
      const seq = activeCrashSequences[i];
      const age = currentTime - seq.crashTime;

      // Check if sequence is complete or timed out
      if (seq.exit && seq.death) {
        // Complete sequence - create group
        const events = [seq.crash, seq.exit, seq.death];
        const groupLog = createCrashDeathGroupLog(events);
        checkIdCollision(groupLog.id, result, "crash_death_group");
        result.push(groupLog);
        events.forEach((e) => groupedLogIds.add(e.id));
        completedIndices.push(i);
      } else if (age > CRASH_TIMEOUT_MS) {
        // Timed out - add crash as standalone
        if (!groupedLogIds.has(seq.crash.id)) {
          result.push(seq.crash);
          groupedLogIds.add(seq.crash.id);
        }
        // Add any partial matches as standalone
        if (seq.exit && !groupedLogIds.has(seq.exit.id)) {
          result.push(seq.exit);
          groupedLogIds.add(seq.exit.id);
        }
        if (seq.death && !groupedLogIds.has(seq.death.id)) {
          result.push(seq.death);
          groupedLogIds.add(seq.death.id);
        }
        completedIndices.push(i);
      }
    }

    // Remove completed sequences (in reverse to maintain indices)
    for (let i = completedIndices.length - 1; i >= 0; i--) {
      activeCrashSequences.splice(completedIndices[i], 1);
    }
  };

  // Finalize helpers (same as processAllGroupings)
  const finalizeKillingSpree = () => {
    if (killingSpree.length >= MIN_SPREE_SIZE) {
      const spreeLog = createSpreeLog(killingSpree);
      checkIdCollision(spreeLog.id, result, "killing_spree");
      result.push(spreeLog);
      killingSpree.forEach((log) => groupedLogIds.add(log.id));
    } else {
      killingSpree.forEach((log) => {
        if (!groupedLogIds.has(log.id)) result.push(log);
      });
    }
    killingSpree = [];
    lastKillTime = null;
  };

  const finalizeEquipment = () => {
    if (equipmentGroup.length >= MIN_EQUIPMENT_SIZE) {
      const groupLog = createEquipmentGroupLog(equipmentGroup);
      checkIdCollision(groupLog.id, result, "equipment");
      result.push(groupLog);
      equipmentGroup.forEach((log) => groupedLogIds.add(log.id));
    } else {
      equipmentGroup.forEach((log) => {
        if (!groupedLogIds.has(log.id)) result.push(log);
      });
    }
    equipmentGroup = [];
    lastEquipmentTime = null;
    currentEquipmentPlayer = null;
  };

  const finalizeInsurance = () => {
    if (insuranceGroup.length >= MIN_INSURANCE_SIZE) {
      const groupLog = createInsuranceGroupLog(insuranceGroup);
      checkIdCollision(groupLog.id, result, "insurance");
      result.push(groupLog);
      insuranceGroup.forEach((log) => groupedLogIds.add(log.id));
    } else {
      insuranceGroup.forEach((log) => {
        if (!groupedLogIds.has(log.id)) result.push(log);
      });
    }
    insuranceGroup = [];
    lastInsuranceTime = null;
  };

  const finalizeEnvironmentalHazards = () => {
    if (environmentalHazardGroup.length >= MIN_HAZARD_SIZE) {
      const groupLog = createEnvironmentalHazardGroupLog(
        environmentalHazardGroup,
      );
      checkIdCollision(groupLog.id, result, "environmental_hazard");
      result.push(groupLog);
      environmentalHazardGroup.forEach((log) => groupedLogIds.add(log.id));
    } else {
      environmentalHazardGroup.forEach((log) => {
        if (!groupedLogIds.has(log.id)) result.push(log);
      });
    }
    environmentalHazardGroup = [];
    lastHazardTime = null;
    currentHazardPlayer = null;
  };

  const finalizeInventory = () => {
    if (inventoryGroup.length >= MIN_INVENTORY_SIZE) {
      const groupLog = createInventoryGroupLog(inventoryGroup);
      checkIdCollision(groupLog.id, result, "inventory");
      result.push(groupLog);
      inventoryGroup.forEach((log) => groupedLogIds.add(log.id));
    } else {
      inventoryGroup.forEach((log) => {
        if (!groupedLogIds.has(log.id)) result.push(log);
      });
    }
    inventoryGroup = [];
    lastInventoryTime = null;
    currentInventoryPlayer = null;
    currentInventoryLocation = null;
  };

  const finalizeQuantumTravel = () => {
    if (quantumTravelGroup.length >= MIN_QUANTUM_TRAVEL_SIZE) {
      const groupLog = createQuantumTravelGroupLog(quantumTravelGroup);
      checkIdCollision(groupLog.id, result, "quantum_travel");
      result.push(groupLog);
      quantumTravelGroup.forEach((log) => groupedLogIds.add(log.id));
    } else {
      quantumTravelGroup.forEach((log) => {
        if (!groupedLogIds.has(log.id)) result.push(log);
      });
    }
    quantumTravelGroup = [];
    lastQuantumTravelTime = null;
  };

  const finalizeRespawnGroup = () => {
    if (respawnGroup.length >= MIN_RESPAWN_SIZE) {
      const groupLog = createRespawnGroupLog(respawnGroup);
      checkIdCollision(groupLog.id, result, "respawn");
      result.push(groupLog);
      respawnGroup.forEach((log) => groupedLogIds.add(log.id));
    } else {
      respawnGroup.forEach((log) => {
        if (!groupedLogIds.has(log.id)) result.push(log);
      });
    }
    respawnGroup = [];
    lastRespawnTime = null;
  };

  // Single pass through all flattened logs
  for (const log of flatLogs) {
    const logTime = new Date(log.timestamp).getTime();
    let logProcessed = false;

    // Check for timed-out crash sequences
    finalizeCrashSequences(logTime);

    // === CRASH SEQUENCE HANDLING (sliding window) ===
    if (log.eventType === "fatal_collision") {
      // Start new crash sequence
      activeCrashSequences.push({
        crash: log,
        crashTime: logTime,
        vehicleName: log.metadata?.vehicleName as string,
        player: log.player || "",
      });
      logProcessed = true;
    } else if (
      log.eventType === "vehicle_control_flow" &&
      log.metadata?.action === "releasing"
    ) {
      // Try to match with active crash sequence
      const vehicleName = log.metadata?.vehicleName;
      const matchingSeq = activeCrashSequences.find(
        (seq) => !seq.exit && seq.vehicleName === vehicleName,
      );
      if (matchingSeq) {
        matchingSeq.exit = log;
        logProcessed = true;
      }
    } else if (
      log.eventType === "actor_death" &&
      log.metadata?.deathCause === "vehicle_destruction"
    ) {
      // Try to match with active crash sequence
      const vehicleName = log.metadata?.zone;
      const victimName = log.metadata?.victimName;
      const matchingSeq = activeCrashSequences.find(
        (seq) =>
          !seq.death &&
          seq.vehicleName === vehicleName &&
          seq.player === victimName,
      );
      if (matchingSeq) {
        matchingSeq.death = log;
        logProcessed = true;
      }
    }

    // === OTHER GROUPINGS (same logic as processAllGroupings) ===
    const isKill =
      log.eventType === "actor_death" &&
      log.metadata?.killerName === log.player;
    const isEquipment =
      log.eventType === "equipment_received" ||
      log.eventType === "equipment_equip";
    const isInsurance = log.eventType === "insurance_claim";
    const isEnvironmentalHazard = log.eventType === "environmental_hazard";
    const isMissionEvent = [
      "mission_shared",
      "mission_objective",
      "mission_completed",
      "mission_ended",
    ].includes(log.eventType || "");
    const isQuantumTravel = log.eventType === "quantum_travel";
    const isRespawn =
      log.eventType === "hospital_respawn" || log.eventType === "medical_bed";
    const isInventoryRequest = log.eventType === "location_change";
    const isVehicleControlFlow = log.eventType === "vehicle_control_flow";

    // Killing spree
    if (isKill && !logProcessed) {
      if (lastKillTime && logTime - lastKillTime.getTime() > SPREE_TIMEOUT_MS) {
        finalizeKillingSpree();
      }
      killingSpree.push(log);
      lastKillTime = new Date(logTime);
      logProcessed = true;
    }

    // Equipment
    if (isEquipment && log.player && !logProcessed) {
      if (
        lastEquipmentTime &&
        currentEquipmentPlayer === log.player &&
        logTime - lastEquipmentTime.getTime() <= EQUIPMENT_TIMEOUT_MS
      ) {
        equipmentGroup.push(log);
      } else {
        if (equipmentGroup.length > 0) finalizeEquipment();
        equipmentGroup = [log];
        currentEquipmentPlayer = log.player;
      }
      lastEquipmentTime = new Date(logTime);
      logProcessed = true;
    }

    // Insurance
    if (isInsurance && !logProcessed) {
      if (
        lastInsuranceTime &&
        logTime - lastInsuranceTime.getTime() <= INSURANCE_TIMEOUT_MS
      ) {
        insuranceGroup.push(log);
      } else {
        if (insuranceGroup.length > 0) finalizeInsurance();
        insuranceGroup = [log];
      }
      lastInsuranceTime = new Date(logTime);
      logProcessed = true;
    }

    // Environmental hazards
    if (isEnvironmentalHazard && log.player && !logProcessed) {
      if (
        lastHazardTime &&
        currentHazardPlayer === log.player &&
        logTime - lastHazardTime.getTime() <= HAZARD_TIMEOUT_MS
      ) {
        environmentalHazardGroup.push(log);
      } else {
        if (environmentalHazardGroup.length > 0) finalizeEnvironmentalHazards();
        environmentalHazardGroup = [log];
        currentHazardPlayer = log.player;
      }
      lastHazardTime = new Date(logTime);
      logProcessed = true;
    }

    // Inventory requests
    const location = log.metadata?.location as string | undefined;
    if (isInventoryRequest && log.player && location && !logProcessed) {
      if (
        lastInventoryTime &&
        currentInventoryPlayer === log.player &&
        currentInventoryLocation === location &&
        logTime - lastInventoryTime.getTime() <= INVENTORY_TIMEOUT_MS
      ) {
        inventoryGroup.push(log);
      } else {
        if (inventoryGroup.length > 0) finalizeInventory();
        inventoryGroup = [log];
        currentInventoryPlayer = log.player;
        currentInventoryLocation = location;
      }
      lastInventoryTime = new Date(logTime);
      logProcessed = true;
    }

    // Mission events
    if (isMissionEvent && log.metadata?.missionId && !logProcessed) {
      const missionId = log.metadata.missionId as string;
      if (!missionGroups.has(missionId)) {
        missionGroups.set(missionId, []);
      }
      missionGroups.get(missionId)!.push(log);
      logProcessed = true;
    }

    // Quantum travel
    if (isQuantumTravel && !logProcessed) {
      if (
        lastQuantumTravelTime &&
        logTime - lastQuantumTravelTime.getTime() <= QUANTUM_TRAVEL_TIMEOUT_MS
      ) {
        quantumTravelGroup.push(log);
      } else {
        if (quantumTravelGroup.length > 0) finalizeQuantumTravel();
        quantumTravelGroup = [log];
      }
      lastQuantumTravelTime = new Date(logTime);
      logProcessed = true;
    }

    // Respawns
    if (isRespawn && !logProcessed) {
      if (
        lastRespawnTime &&
        logTime - lastRespawnTime.getTime() <= RESPAWN_TIMEOUT_MS
      ) {
        respawnGroup.push(log);
      } else {
        if (respawnGroup.length > 0) finalizeRespawnGroup();
        respawnGroup = [log];
      }
      lastRespawnTime = new Date(logTime);
      logProcessed = true;
    }

    // Vehicle control errors (collect for later grouping)
    if (
      isVehicleControlFlow &&
      log.metadata?.vehicleId &&
      log.userId &&
      !logProcessed
    ) {
      const vehicleId = log.metadata.vehicleId as string;
      const userId = log.userId;
      const errorKey = `${userId}-${vehicleId}`;
      if (!vehicleErrorGroups.has(errorKey)) {
        vehicleErrorGroups.set(errorKey, []);
      }
      vehicleErrorGroups.get(errorKey)!.push(log);
      logProcessed = true;
    }

    // Passthrough - log not processed by any grouper
    if (!logProcessed && !groupedLogIds.has(log.id)) {
      result.push(log);
    }
  }

  // Finalize all remaining groups
  finalizeCrashSequences(Date.now()); // Finalize any remaining crash sequences
  if (killingSpree.length > 0) finalizeKillingSpree();
  if (equipmentGroup.length > 0) finalizeEquipment();
  if (insuranceGroup.length > 0) finalizeInsurance();
  if (environmentalHazardGroup.length > 0) finalizeEnvironmentalHazards();
  if (inventoryGroup.length > 0) finalizeInventory();
  if (quantumTravelGroup.length > 0) finalizeQuantumTravel();
  if (respawnGroup.length > 0) finalizeRespawnGroup();

  // Finalize vehicle error groups
  if (vehicleErrorGroups.size > 0) {
    vehicleErrorGroups.forEach((errors) => {
      errors.sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );
      let currentGroup: Log[] = [];
      let lastTime: Date | null = null;

      for (const error of errors) {
        const errorTime = new Date(error.timestamp);
        if (
          lastTime &&
          errorTime.getTime() - lastTime.getTime() <= VEHICLE_ERROR_TIMEOUT_MS
        ) {
          currentGroup.push(error);
        } else {
          if (currentGroup.length >= MIN_VEHICLE_ERROR_SIZE) {
            const groupLog = createVehicleErrorGroupLog(currentGroup);
            checkIdCollision(groupLog.id, result, "vehicle_error");
            result.push(groupLog);
            currentGroup.forEach((log) => groupedLogIds.add(log.id));
          } else {
            currentGroup.forEach((log) => {
              if (!groupedLogIds.has(log.id)) result.push(log);
            });
          }
          currentGroup = [error];
        }
        lastTime = errorTime;
      }

      if (currentGroup.length >= MIN_VEHICLE_ERROR_SIZE) {
        const groupLog = createVehicleErrorGroupLog(currentGroup);
        checkIdCollision(groupLog.id, result, "vehicle_error");
        result.push(groupLog);
        currentGroup.forEach((log) => groupedLogIds.add(log.id));
      } else {
        currentGroup.forEach((log) => {
          if (!groupedLogIds.has(log.id)) result.push(log);
        });
      }
    });
  }

  // Finalize mission groups
  if (missionGroups.size > 0) {
    for (const [, missionEvents] of missionGroups.entries()) {
      if (missionEvents.length >= MIN_MISSION_GROUP_SIZE) {
        const groupLog = createMissionGroupLog(missionEvents);
        checkIdCollision(groupLog.id, result, "mission_group");
        result.push(groupLog);
        missionEvents.forEach((log) => groupedLogIds.add(log.id));
      } else {
        missionEvents.forEach((log) => {
          if (!groupedLogIds.has(log.id)) result.push(log);
        });
      }
    }
  }

  // Sort by timestamp
  result.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  console.log(
    "[processLogs] Completed single-pass processing, output logs:",
    result.length,
  );
  return result;
}

/**
 * @deprecated Use processLogs() instead for better performance
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

  let environmentalHazardGroup: Log[] = [];
  let lastHazardTime: Date | null = null;
  let currentHazardPlayer: string | null = null;

  let inventoryGroup: Log[] = [];
  let lastInventoryTime: Date | null = null;
  let currentInventoryPlayer: string | null = null;
  let currentInventoryLocation: string | null = null;

  // Vehicle control error grouping (duplicate errors within time window)
  const vehicleErrorGroups = new Map<string, Log[]>(); // Key: userId-vehicleId

  // Mission grouping by ID (not time-based)
  const missionGroups = new Map<string, Log[]>(); // Key: missionId

  let quantumTravelGroup: Log[] = [];
  let lastQuantumTravelTime: Date | null = null;

  let respawnGroup: Log[] = [];
  let lastRespawnTime: Date | null = null;

  let bountyKillGroup: Log[] = [];
  let lastBountyKillTime: Date | null = null;

  let vehicleExitGroup: Log[] = [];
  let lastVehicleExitTime: Date | null = null;
  let currentVehicleExitId: string | null = null;

  const vehicleGroups = new Map<string, Log[]>(); // Key: vehicleId

  const SPREE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  const MIN_SPREE_SIZE = 3;
  const EQUIPMENT_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
  const MIN_EQUIPMENT_SIZE = 2;
  const INSURANCE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes
  const MIN_INSURANCE_SIZE = 2;
  const HAZARD_TIMEOUT_MS = 1 * 60 * 1000; // 1 minute
  const MIN_HAZARD_SIZE = 2;
  const INVENTORY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
  const MIN_INVENTORY_SIZE = 2;
  const VEHICLE_ERROR_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
  const MIN_VEHICLE_ERROR_SIZE = 2;
  const MIN_MISSION_GROUP_SIZE = 2; // Minimum events to form a mission group
  const QUANTUM_TRAVEL_TIMEOUT_MS = 1 * 60 * 1000; // 1 minute
  const MIN_QUANTUM_TRAVEL_SIZE = 2;
  const RESPAWN_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  const MIN_RESPAWN_SIZE = 2;
  const BOUNTY_KILL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  const MIN_BOUNTY_KILL_SIZE = 3;
  const VEHICLE_EXIT_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
  const MIN_VEHICLE_EXIT_SIZE = 2;

  console.log(
    "[processAllGroupings] Starting unified grouping, input logs:",
    logs.length,
  );

  // Helper to finalize killing spree
  const finalizeKillingSpree = () => {
    if (killingSpree.length >= MIN_SPREE_SIZE) {
      const spreeLog = createSpreeLog(killingSpree);
      checkIdCollision(spreeLog.id, result, "killing_spree");
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
      checkIdCollision(groupLog.id, result, "equipment");
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
      checkIdCollision(groupLog.id, result, "insurance");
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

  // Helper to finalize environmental hazard group
  const finalizeEnvironmentalHazards = () => {
    if (environmentalHazardGroup.length >= MIN_HAZARD_SIZE) {
      const groupLog = createEnvironmentalHazardGroupLog(
        environmentalHazardGroup,
      );
      checkIdCollision(groupLog.id, result, "environmental_hazard");
      result.push(groupLog);
      // Mark individual hazard logs as grouped
      environmentalHazardGroup.forEach((log) => groupedLogIds.add(log.id));
    } else {
      // Not enough for group, add individual logs
      environmentalHazardGroup.forEach((log) => {
        if (!groupedLogIds.has(log.id)) {
          result.push(log);
        }
      });
    }
    environmentalHazardGroup = [];
    lastHazardTime = null;
    currentHazardPlayer = null;
  };

  // Helper to finalize inventory group
  const finalizeInventory = () => {
    if (inventoryGroup.length >= MIN_INVENTORY_SIZE) {
      const groupLog = createInventoryGroupLog(inventoryGroup);
      checkIdCollision(groupLog.id, result, "inventory");
      result.push(groupLog);
      // Mark individual inventory logs as grouped
      inventoryGroup.forEach((log) => groupedLogIds.add(log.id));
    } else {
      // Not enough for group, add individual logs
      inventoryGroup.forEach((log) => {
        if (!groupedLogIds.has(log.id)) {
          result.push(log);
        }
      });
    }
    inventoryGroup = [];
    lastInventoryTime = null;
    currentInventoryPlayer = null;
    currentInventoryLocation = null;
  };

  // Helper to finalize vehicle control error groups
  const finalizeVehicleErrors = () => {
    vehicleErrorGroups.forEach((errors) => {
      // Sort by timestamp
      errors.sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );

      // Split into time-based sub-groups
      let currentGroup: Log[] = [];
      let lastTime: Date | null = null;

      for (const error of errors) {
        const errorTime = new Date(error.timestamp);

        if (
          lastTime &&
          errorTime.getTime() - lastTime.getTime() <= VEHICLE_ERROR_TIMEOUT_MS
        ) {
          // Part of current group
          currentGroup.push(error);
        } else {
          // Finalize previous group
          if (currentGroup.length >= MIN_VEHICLE_ERROR_SIZE) {
            const groupLog = createVehicleErrorGroupLog(currentGroup);
            checkIdCollision(groupLog.id, result, "vehicle_error");
            result.push(groupLog);
            currentGroup.forEach((log) => groupedLogIds.add(log.id));
          } else {
            // Not enough for group, add individual logs
            currentGroup.forEach((log) => {
              if (!groupedLogIds.has(log.id)) {
                result.push(log);
              }
            });
          }
          // Start new group
          currentGroup = [error];
        }
        lastTime = errorTime;
      }

      // Finalize last group
      if (currentGroup.length >= MIN_VEHICLE_ERROR_SIZE) {
        const groupLog = createVehicleErrorGroupLog(currentGroup);
        checkIdCollision(groupLog.id, result, "vehicle_error");
        result.push(groupLog);
        currentGroup.forEach((log) => groupedLogIds.add(log.id));
      } else {
        // Not enough for group, add individual logs
        currentGroup.forEach((log) => {
          if (!groupedLogIds.has(log.id)) {
            result.push(log);
          }
        });
      }
    });
    vehicleErrorGroups.clear();
  };

  // Helper to finalize quantum travel group
  const finalizeQuantumTravel = () => {
    if (quantumTravelGroup.length >= MIN_QUANTUM_TRAVEL_SIZE) {
      const groupLog = createQuantumTravelGroupLog(quantumTravelGroup);
      checkIdCollision(groupLog.id, result, "quantum_travel");
      result.push(groupLog);
      // Mark individual quantum travel logs as grouped
      quantumTravelGroup.forEach((log) => groupedLogIds.add(log.id));
    } else {
      // Not enough for group, add individual logs
      quantumTravelGroup.forEach((log) => {
        if (!groupedLogIds.has(log.id)) {
          result.push(log);
        }
      });
    }
    quantumTravelGroup = [];
    lastQuantumTravelTime = null;
  };

  // Helper to finalize respawn group
  const finalizeRespawnGroup = () => {
    if (respawnGroup.length >= MIN_RESPAWN_SIZE) {
      const groupLog = createRespawnGroupLog(respawnGroup);
      checkIdCollision(groupLog.id, result, "respawn");
      result.push(groupLog);
      // Mark individual respawn logs as grouped
      respawnGroup.forEach((log) => groupedLogIds.add(log.id));
    } else {
      // Not enough for group, add individual logs
      respawnGroup.forEach((log) => {
        if (!groupedLogIds.has(log.id)) {
          result.push(log);
        }
      });
    }
    respawnGroup = [];
    lastRespawnTime = null;
  };

  // Helper to finalize bounty kill group
  const finalizeBountyKillGroup = () => {
    if (bountyKillGroup.length >= MIN_BOUNTY_KILL_SIZE) {
      const groupLog = createBountyGroupLog(bountyKillGroup);
      checkIdCollision(groupLog.id, result, "bounty_kill");
      result.push(groupLog);
      // Mark individual bounty kill logs as grouped
      bountyKillGroup.forEach((log) => groupedLogIds.add(log.id));
    } else {
      // Not enough for group, add individual logs
      bountyKillGroup.forEach((log) => {
        if (!groupedLogIds.has(log.id)) {
          result.push(log);
        }
      });
    }
    bountyKillGroup = [];
    lastBountyKillTime = null;
  };

  // Helper to finalize vehicle exit group
  const finalizeVehicleExits = () => {
    if (vehicleExitGroup.length >= MIN_VEHICLE_EXIT_SIZE) {
      const groupLog = createVehicleExitGroupLog(vehicleExitGroup);
      checkIdCollision(groupLog.id, result, "vehicle_exit");
      result.push(groupLog);
      // Mark individual exit logs as grouped
      vehicleExitGroup.forEach((log) => groupedLogIds.add(log.id));
    } else {
      // Not enough for group, add individual logs
      vehicleExitGroup.forEach((log) => {
        if (!groupedLogIds.has(log.id)) {
          result.push(log);
        }
      });
    }
    vehicleExitGroup = [];
    lastVehicleExitTime = null;
    currentVehicleExitId = null;
  };

  // Helper to finalize vehicle control groups
  const finalizeVehicleGroups = () => {
    // Collect standalone exit events across all vehicles for grouping
    const standaloneExits: Log[] = [];

    vehicleGroups.forEach((events) => {
      // Sort by timestamp
      events.sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );

      // Process events to find request → grant → release sequences
      let i = 0;
      while (i < events.length) {
        const event = events[i];
        const action = event.metadata?.action;

        if (action === "requesting") {
          // Look for matching 'granted' within 5 seconds
          const grantEvent = events.find(
            (e, idx) =>
              idx > i &&
              e.metadata?.action === "granted" &&
              new Date(e.timestamp).getTime() -
                new Date(event.timestamp).getTime() <
                5000,
          );

          if (grantEvent) {
            // Found pair! Look for matching 'releasing' event
            const grantIndex = events.indexOf(grantEvent);
            const releaseEvent = events.find(
              (e, idx) =>
                idx > grantIndex && e.metadata?.action === "releasing",
            );

            // Create group
            const children = releaseEvent
              ? [event, grantEvent, releaseEvent]
              : [event, grantEvent];

            const groupLog = createVehicleControlGroupLog(children);
            checkIdCollision(groupLog.id, result, "vehicle_control");
            result.push(groupLog);
            children.forEach((log) => groupedLogIds.add(log.id));

            // Skip processed events
            i = releaseEvent
              ? events.indexOf(releaseEvent) + 1
              : grantIndex + 1;
          } else {
            // No grant found, add as individual log
            if (!groupedLogIds.has(event.id)) {
              result.push(event);
            }
            i++;
          }
        } else if (action === "releasing") {
          // Standalone exit event - collect for grouping
          standaloneExits.push(event);
          i++;
        } else {
          // Standalone grant (shouldn't happen normally)
          if (!groupedLogIds.has(event.id)) {
            result.push(event);
          }
          i++;
        }
      }
    });
    vehicleGroups.clear();

    // Group standalone exit events by vehicle + time
    if (standaloneExits.length > 0) {
      // Sort by vehicleId and timestamp
      standaloneExits.sort((a, b) => {
        const vehicleCompare = (
          (a.metadata?.vehicleId as string) || ""
        ).localeCompare((b.metadata?.vehicleId as string) || "");
        if (vehicleCompare !== 0) return vehicleCompare;
        return (
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
      });

      // Group by vehicle + time window
      let currentGroup: Log[] = [];
      let lastExitTime: Date | null = null;
      let currentVehicleId: string | null = null;

      for (const exit of standaloneExits) {
        const vehicleId = exit.metadata?.vehicleId as string;
        const exitTime = new Date(exit.timestamp);

        // Check if this exit is part of current group
        if (
          lastExitTime &&
          currentVehicleId === vehicleId &&
          exitTime.getTime() - lastExitTime.getTime() <= VEHICLE_EXIT_TIMEOUT_MS
        ) {
          currentGroup.push(exit);
        } else {
          // Finish previous group
          if (currentGroup.length >= MIN_VEHICLE_EXIT_SIZE) {
            const groupLog = createVehicleExitGroupLog(currentGroup);
            checkIdCollision(groupLog.id, result, "vehicle_exit");
            result.push(groupLog);
            currentGroup.forEach((log) => groupedLogIds.add(log.id));
          } else {
            // Not enough for group, add individual logs
            currentGroup.forEach((log) => {
              if (!groupedLogIds.has(log.id)) {
                result.push(log);
              }
            });
          }
          currentGroup = [exit];
          currentVehicleId = vehicleId;
        }
        lastExitTime = exitTime;
      }

      // Handle remaining group
      if (currentGroup.length >= MIN_VEHICLE_EXIT_SIZE) {
        const groupLog = createVehicleExitGroupLog(currentGroup);
        checkIdCollision(groupLog.id, result, "vehicle_exit");
        result.push(groupLog);
        currentGroup.forEach((log) => groupedLogIds.add(log.id));
      } else {
        currentGroup.forEach((log) => {
          if (!groupedLogIds.has(log.id)) {
            result.push(log);
          }
        });
      }
    }
  };

  // Single pass through all logs
  for (const log of logs) {
    const isKill =
      log.eventType === "actor_death" &&
      log.metadata?.killerName === log.player;
    const isEquipment =
      log.eventType === "equipment_received" ||
      log.eventType === "equipment_equip";
    const isInsurance = log.eventType === "insurance_claim";
    const isEnvironmentalHazard = log.eventType === "environmental_hazard";
    const isBountyKill = log.eventType === "bounty_kill";
    const isMissionEvent = [
      "mission_shared",
      "mission_objective",
      "mission_completed",
      "mission_ended",
    ].includes(log.eventType || "");

    let logProcessed = false;

    // Process killing spree
    if (isKill) {
      const killTime = new Date(log.timestamp);

      // Check timeout
      if (
        lastKillTime &&
        killTime.getTime() - lastKillTime.getTime() > SPREE_TIMEOUT_MS
      ) {
        finalizeKillingSpree();
      }

      killingSpree.push(log);
      lastKillTime = killTime;
      logProcessed = true;
    }

    // Process bounty kills
    if (isBountyKill) {
      const killTime = new Date(log.timestamp);

      // Check timeout
      if (
        lastBountyKillTime &&
        killTime.getTime() - lastBountyKillTime.getTime() >
          BOUNTY_KILL_TIMEOUT_MS
      ) {
        finalizeBountyKillGroup();
      }

      bountyKillGroup.push(log);
      lastBountyKillTime = killTime;
      logProcessed = true;
    }

    // Process equipment
    if (isEquipment && log.player) {
      const eventTime = new Date(log.timestamp);

      // Check if this event is part of current group
      if (
        lastEquipmentTime &&
        currentEquipmentPlayer === log.player &&
        eventTime.getTime() - lastEquipmentTime.getTime() <=
          EQUIPMENT_TIMEOUT_MS
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
    }

    // Process insurance
    if (isInsurance) {
      const eventTime = new Date(log.timestamp);

      // Check if this event is part of current group
      if (
        lastInsuranceTime &&
        eventTime.getTime() - lastInsuranceTime.getTime() <=
          INSURANCE_TIMEOUT_MS
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
    }

    // Process environmental hazards
    if (isEnvironmentalHazard && log.player) {
      const eventTime = new Date(log.timestamp);

      // Check if this event is part of current group
      if (
        lastHazardTime &&
        currentHazardPlayer === log.player &&
        eventTime.getTime() - lastHazardTime.getTime() <= HAZARD_TIMEOUT_MS
      ) {
        environmentalHazardGroup.push(log);
      } else {
        // Finish previous group
        if (environmentalHazardGroup.length > 0) {
          finalizeEnvironmentalHazards();
        }
        environmentalHazardGroup = [log];
        currentHazardPlayer = log.player;
      }
      lastHazardTime = eventTime;
      logProcessed = true;
    }

    // Process inventory requests
    const isInventoryRequest = log.eventType === "location_change";
    const location = log.metadata?.location as string | undefined;
    if (isInventoryRequest && log.player && location) {
      const eventTime = new Date(log.timestamp);

      // Check if this event is part of current group
      if (
        lastInventoryTime &&
        currentInventoryPlayer === log.player &&
        currentInventoryLocation === location &&
        eventTime.getTime() - lastInventoryTime.getTime() <=
          INVENTORY_TIMEOUT_MS
      ) {
        inventoryGroup.push(log);
      } else {
        // Finish previous group
        if (inventoryGroup.length > 0) {
          finalizeInventory();
        }
        inventoryGroup = [log];
        currentInventoryPlayer = log.player;
        currentInventoryLocation = location;
      }
      lastInventoryTime = eventTime;
      logProcessed = true;
    }

    // Process mission events (group by mission ID)
    if (isMissionEvent && log.metadata?.missionId) {
      const missionId = log.metadata.missionId as string;
      if (!missionGroups.has(missionId)) {
        missionGroups.set(missionId, []);
      }
      missionGroups.get(missionId)!.push(log);
      logProcessed = true;
    }

    // Process quantum travel (time-based grouping)
    const isQuantumTravel = log.eventType === "quantum_travel";
    if (isQuantumTravel) {
      const eventTime = new Date(log.timestamp);

      // Check if this event is part of current group
      if (
        lastQuantumTravelTime &&
        eventTime.getTime() - lastQuantumTravelTime.getTime() <=
          QUANTUM_TRAVEL_TIMEOUT_MS
      ) {
        quantumTravelGroup.push(log);
      } else {
        // Finish previous group
        if (quantumTravelGroup.length > 0) {
          finalizeQuantumTravel();
        }
        quantumTravelGroup = [log];
      }
      lastQuantumTravelTime = eventTime;
      logProcessed = true;
    }

    // Process respawns (includes both hospital_respawn and medical_bed)
    const isRespawn =
      log.eventType === "hospital_respawn" || log.eventType === "medical_bed";
    if (isRespawn) {
      const eventTime = new Date(log.timestamp);

      // Check if this event is part of current group
      if (
        lastRespawnTime &&
        eventTime.getTime() - lastRespawnTime.getTime() <= RESPAWN_TIMEOUT_MS
      ) {
        respawnGroup.push(log);
      } else {
        // Finish previous group
        if (respawnGroup.length > 0) {
          finalizeRespawnGroup();
        }
        respawnGroup = [log];
      }
      lastRespawnTime = eventTime;
      logProcessed = true;
    }

    // Process vehicle control errors (duplicate errors within time window)
    // Collect all vehicle control flow events for time-based grouping
    const isVehicleControlFlow = log.eventType === "vehicle_control_flow";
    if (isVehicleControlFlow && log.metadata?.vehicleId && log.userId) {
      const vehicleId = log.metadata.vehicleId as string;
      const userId = log.userId;
      const errorKey = `${userId}-${vehicleId}`;

      if (!vehicleErrorGroups.has(errorKey)) {
        vehicleErrorGroups.set(errorKey, []);
      }
      vehicleErrorGroups.get(errorKey)!.push(log);
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
  if (environmentalHazardGroup.length > 0) {
    finalizeEnvironmentalHazards();
  }
  if (inventoryGroup.length > 0) {
    finalizeInventory();
  }
  // Finalize vehicle control error groups
  if (vehicleErrorGroups.size > 0) {
    finalizeVehicleErrors();
  }
  // Finalize mission groups (by mission ID)
  if (missionGroups.size > 0) {
    for (const [missionId, missionEvents] of missionGroups.entries()) {
      if (missionEvents.length >= MIN_MISSION_GROUP_SIZE) {
        const groupLog = createMissionGroupLog(missionEvents);
        checkIdCollision(groupLog.id, result, "mission_group");
        result.push(groupLog);
        // Mark individual mission events as grouped
        missionEvents.forEach((log) => groupedLogIds.add(log.id));
      } else {
        // Not enough for group, add individual logs
        missionEvents.forEach((log) => {
          if (!groupedLogIds.has(log.id)) {
            result.push(log);
          }
        });
      }
    }
  }
  if (quantumTravelGroup.length > 0) {
    finalizeQuantumTravel();
  }
  if (respawnGroup.length > 0) {
    finalizeRespawnGroup();
  }
  if (bountyKillGroup.length > 0) {
    finalizeBountyKillGroup();
  }
  if (vehicleGroups.size > 0) {
    finalizeVehicleGroups();
  }

  // Sort final result by timestamp to ensure chronological order
  // This is necessary because vehicle control groups are finalized after the main loop,
  // which can cause them to be appended at the end regardless of their timestamp
  result.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  console.log(
    "[processAllGroupings] Completed unified grouping, output logs:",
    result.length,
  );
  return result;
}
