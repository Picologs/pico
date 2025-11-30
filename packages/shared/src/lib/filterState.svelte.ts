import type { LogEventType, Log } from "@pico/types";
import { getAllPlayersFromLogs } from "./utils/log-utils.js";

// All available log types
const ALL_LOG_TYPES: LogEventType[] = [
  "connection",
  "vehicle_control_flow",
  "actor_death",
  "location_change",
  "destruction",
  "system_quit",
  "hospital_respawn",
  "mission_shared",
  "mission_completed",
  "mission_ended",
  "mission_objective",
  "landing_pad",
  "medical_bed",
  "purchase",
  "insurance_claim",
  "quantum_travel",
  "quantum_arrival",
  "equipment_received",
  "equipment_equip",
  "fatal_collision",
  "item_placement",
  "killing_spree",
  "equipment_group",
  "insurance_group",
  "vehicle_control_group",
  "vehicle_exit_group",
  "mission_objective_group",
  "environmental_hazard",
  "environmental_hazard_group",
  "inventory_group",
  "respawn_group",
  // Bounty events (SC 4.4.x+)
  "bounty_marker",
  "bounty_kill",
  "bounty_kill_group",
];

// Combat-only log types
const COMBAT_LOG_TYPES: LogEventType[] = [
  "actor_death",
  "destruction",
  "killing_spree",
];

// LocalStorage key for event types (persist this one)
const ENABLED_LOG_TYPES_KEY = "picologs:enabledLogTypes";

/**
 * Centralized filter state - single source of truth for all filtering
 * Used by both online (appState) and offline (logApi) modes
 */
class FilterState {
  // Event type filter (persisted to localStorage)
  eventTypes = $state<Set<LogEventType>>(new Set(ALL_LOG_TYPES));

  // Player filter (not persisted - session only)
  // Explicit selection: only selected players are shown
  players = $state<Set<string>>(new Set());

  // Track players the user has explicitly deselected
  // New players will be auto-selected unless they're in this set
  private deselectedPlayers = $state<Set<string>>(new Set());

  // Context filters (friend/group selection)
  activeFriendId = $state<string | null>(null);
  activeGroupId = $state<string | null>(null);

  // Available players from current logs (set by log source)
  availablePlayers = $state<string[]>([]);

  constructor() {
    this.loadEventTypes();
  }

  // Load event types from localStorage
  private loadEventTypes() {
    if (typeof window === "undefined") return;

    try {
      const stored = localStorage.getItem(ENABLED_LOG_TYPES_KEY);
      if (stored) {
        const types = JSON.parse(stored) as LogEventType[];
        this.eventTypes = new Set(types);
      }
    } catch (error) {
      console.error("[FilterState] Failed to load event types:", error);
    }
  }

  // Save event types to localStorage
  private saveEventTypes() {
    if (typeof window === "undefined") return;

    try {
      const types = Array.from(this.eventTypes);
      localStorage.setItem(ENABLED_LOG_TYPES_KEY, JSON.stringify(types));
    } catch (error) {
      console.error("[FilterState] Failed to save event types:", error);
    }
  }

  // Update available players from logs
  setAvailablePlayers(logs: Log[]) {
    const players = getAllPlayersFromLogs(logs);
    this.availablePlayers = players;

    // Auto-select all players except those explicitly deselected
    const newSelectedPlayers = new Set<string>();
    for (const player of players) {
      if (!this.deselectedPlayers.has(player)) {
        newSelectedPlayers.add(player);
      }
    }
    this.players = newSelectedPlayers;
  }

  // Event type methods
  toggleEventType(eventType: LogEventType) {
    if (this.eventTypes.has(eventType)) {
      this.eventTypes.delete(eventType);
    } else {
      this.eventTypes.add(eventType);
    }
    this.eventTypes = new Set(this.eventTypes);
    this.saveEventTypes();
  }

  enableAllEventTypes() {
    this.eventTypes = new Set(ALL_LOG_TYPES);
    this.saveEventTypes();
  }

  disableAllEventTypes() {
    this.eventTypes = new Set();
    this.saveEventTypes();
  }

  setCombatOnly() {
    this.eventTypes = new Set(COMBAT_LOG_TYPES);
    this.saveEventTypes();
  }

  // Player methods
  togglePlayer(playerName: string) {
    const newPlayers = new Set(this.players);

    if (newPlayers.has(playerName)) {
      // Deselecting - track as explicitly deselected
      newPlayers.delete(playerName);
      this.deselectedPlayers.add(playerName);
    } else {
      // Selecting - remove from deselected list
      newPlayers.add(playerName);
      this.deselectedPlayers.delete(playerName);
    }

    this.players = newPlayers;
  }

  enableAllPlayers() {
    this.players = new Set(this.availablePlayers);
    this.deselectedPlayers = new Set(); // Clear deselected list
  }

  disableAllPlayers() {
    this.players = new Set();
    this.deselectedPlayers = new Set(this.availablePlayers); // Mark all as explicitly deselected
  }

  // Context methods
  setActiveFriendId(friendId: string | null) {
    this.activeFriendId = friendId;
    if (friendId) {
      this.activeGroupId = null;
    }
  }

  setActiveGroupId(groupId: string | null) {
    this.activeGroupId = groupId;
    if (groupId) {
      this.activeFriendId = null;
    }
  }

  // Reset all filters
  reset() {
    this.eventTypes = new Set(ALL_LOG_TYPES);
    this.players = new Set(this.availablePlayers);
    this.deselectedPlayers = new Set(); // Clear deselected list
    this.activeFriendId = null;
    this.activeGroupId = null;
    this.saveEventTypes();
  }

  // Reset player filter only (when logs change)
  resetPlayers() {
    this.players = new Set();
    this.deselectedPlayers = new Set(); // Clear deselected list
  }

  // Check if a player is enabled
  isPlayerEnabled(playerName: string): boolean {
    return this.players.has(playerName);
  }

  // Check if an event type is enabled
  isEventTypeEnabled(eventType: LogEventType): boolean {
    return this.eventTypes.has(eventType);
  }
}

// Export singleton instance
export const filterState = new FilterState();

// Export constants
export { ALL_LOG_TYPES, COMBAT_LOG_TYPES };

// Export class for testing
export { FilterState };
