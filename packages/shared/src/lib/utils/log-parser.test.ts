/**
 * Tests for Star Citizen log parser
 *
 * This test suite covers the main parsing functions and event type parsers
 * for the Star Citizen Game.log parser.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  parseStarCitizenLogLine,
  parseLogLines,
  extractPlayerName,
  detectEnvironment,
  parseLogTimestamp,
  formatMissionObjectiveState,
  resetParserState,
  getCurrentPlayer,
  setCurrentPlayer,
} from "./log-parser";
import type { Log } from "@pico/types";

describe("parseLogTimestamp", () => {
  it("should parse valid ISO timestamp", () => {
    const line = "<2025-11-02T07:47:09.855Z> Some log content";
    const timestamp = parseLogTimestamp(line);
    expect(timestamp).toBe("2025-11-02T07:47:09.855Z");
  });

  it("should return null for invalid timestamp format", () => {
    const line = "Invalid timestamp format";
    const timestamp = parseLogTimestamp(line);
    expect(timestamp).toBeNull();
  });

  it("should return null for line without timestamp", () => {
    const line = "No timestamp here";
    const timestamp = parseLogTimestamp(line);
    expect(timestamp).toBeNull();
  });

  it("should handle line with multiple angle brackets", () => {
    const line = "<2025-11-02T07:47:09.855Z> <SomeTag> Content";
    const timestamp = parseLogTimestamp(line);
    expect(timestamp).toBe("2025-11-02T07:47:09.855Z");
  });
});

describe("formatMissionObjectiveState", () => {
  it("should format INPROGRESS state", () => {
    const state = formatMissionObjectiveState(
      "MISSION_OBJECTIVE_STATE_INPROGRESS",
    );
    expect(state).toBe("Inprogress");
  });

  it("should format COMPLETED state", () => {
    const state = formatMissionObjectiveState(
      "MISSION_OBJECTIVE_STATE_COMPLETED",
    );
    expect(state).toBe("Completed");
  });

  it("should format FAILED state", () => {
    const state = formatMissionObjectiveState("MISSION_OBJECTIVE_STATE_FAILED");
    expect(state).toBe("Failed");
  });

  it("should handle state without prefix", () => {
    const state = formatMissionObjectiveState("ACTIVE");
    expect(state).toBe("Active");
  });

  it("should handle lowercase state", () => {
    const state = formatMissionObjectiveState("MISSION_OBJECTIVE_STATE_active");
    expect(state).toBe("Active");
  });
});

describe("resetParserState", () => {
  it("should reset current player", () => {
    setCurrentPlayer("TestPlayer");
    expect(getCurrentPlayer()).toBe("TestPlayer");

    resetParserState();
    expect(getCurrentPlayer()).toBeNull();
  });

  it("should allow setting player after reset", () => {
    setCurrentPlayer("Player1");
    resetParserState();
    setCurrentPlayer("Player2");
    expect(getCurrentPlayer()).toBe("Player2");
  });
});

describe("getCurrentPlayer and setCurrentPlayer", () => {
  beforeEach(() => {
    resetParserState();
  });

  it("should get and set current player", () => {
    expect(getCurrentPlayer()).toBeNull();

    setCurrentPlayer("TestPlayer");
    expect(getCurrentPlayer()).toBe("TestPlayer");
  });

  it("should allow setting null player", () => {
    setCurrentPlayer("TestPlayer");
    setCurrentPlayer(null);
    expect(getCurrentPlayer()).toBeNull();
  });

  it("should support hyphenated player names", () => {
    setCurrentPlayer("space-man-rob");
    expect(getCurrentPlayer()).toBe("space-man-rob");
  });
});

describe("extractPlayerName", () => {
  it("should extract player name from connection event", () => {
    const logContent = `<2025-11-02T07:47:09.855Z> <AccountLoginCharacterStatus_Character> Character: ... geid 201990709919 - ... - name space-man-rob - ...`;
    const playerName = extractPlayerName(logContent);
    expect(playerName).toBe("space-man-rob");
  });

  it("should extract player name with hyphens", () => {
    const logContent = `<2025-11-02T07:47:09.855Z> <AccountLoginCharacterStatus_Character> Character: ... geid 123 - ... - name test-player-name - ...`;
    const playerName = extractPlayerName(logContent);
    expect(playerName).toBe("test-player-name");
  });

  it("should extract player name without hyphens", () => {
    const logContent = `<2025-11-02T07:47:09.855Z> <AccountLoginCharacterStatus_Character> Character: ... geid 123 - ... - name TestPlayer - ...`;
    const playerName = extractPlayerName(logContent);
    expect(playerName).toBe("TestPlayer");
  });

  it("should return null for log without connection event", () => {
    const logContent = `<2025-11-02T07:47:09.855Z> Some other log content`;
    const playerName = extractPlayerName(logContent);
    expect(playerName).toBeNull();
  });

  it("should return null for empty log", () => {
    const playerName = extractPlayerName("");
    expect(playerName).toBeNull();
  });

  it("should extract first player name from multi-line log", () => {
    const logContent = `
			<2025-11-02T07:47:09.855Z> Some content
			<2025-11-02T07:47:10.855Z> <AccountLoginCharacterStatus_Character> Character: ... geid 123 - ... - name FirstPlayer - ...
			<2025-11-02T07:47:11.855Z> <AccountLoginCharacterStatus_Character> Character: ... geid 456 - ... - name SecondPlayer - ...
		`;
    const playerName = extractPlayerName(logContent);
    expect(playerName).toBe("FirstPlayer");
  });
});

describe("detectEnvironment", () => {
  it("should detect LIVE environment with backslashes", () => {
    const path = "C:\\Program Files\\Star Citizen\\LIVE\\Game.log";
    expect(detectEnvironment(path)).toBe("LIVE");
  });

  it("should detect LIVE environment with forward slashes", () => {
    const path = "/home/user/Star Citizen/LIVE/Game.log";
    expect(detectEnvironment(path)).toBe("LIVE");
  });

  it("should detect PTU environment with backslashes", () => {
    const path = "C:\\Program Files\\Star Citizen\\PTU\\Game.log";
    expect(detectEnvironment(path)).toBe("PTU");
  });

  it("should detect PTU environment with forward slashes", () => {
    const path = "/home/user/Star Citizen/PTU/Game.log";
    expect(detectEnvironment(path)).toBe("PTU");
  });

  it("should detect HOTFIX environment with backslashes", () => {
    const path = "C:\\Program Files\\Star Citizen\\HOTFIX\\Game.log";
    expect(detectEnvironment(path)).toBe("HOTFIX");
  });

  it("should detect HOTFIX environment with forward slashes", () => {
    const path = "/home/user/Star Citizen/HOTFIX/Game.log";
    expect(detectEnvironment(path)).toBe("HOTFIX");
  });

  it("should return UNKNOWN for unrecognized path", () => {
    const path = "C:\\Program Files\\Star Citizen\\Game.log";
    expect(detectEnvironment(path)).toBe("UNKNOWN");
  });

  it("should return UNKNOWN for empty path", () => {
    expect(detectEnvironment("")).toBe("UNKNOWN");
  });

  it("should be case-sensitive for environment names", () => {
    const path = "C:\\Program Files\\Star Citizen\\live\\Game.log";
    expect(detectEnvironment(path)).toBe("UNKNOWN");
  });
});

describe("parseStarCitizenLogLine - Connection Events", () => {
  beforeEach(() => {
    resetParserState();
  });

  it("should parse connection event", () => {
    const line =
      "<2025-11-02T07:47:09.855Z> <AccountLoginCharacterStatus_Character> Character: ... geid 201990709919 - ... - name space-man-rob - ...";
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).not.toBeNull();
    expect(log?.eventType).toBe("connection");
    expect(log?.player).toBe("space-man-rob");
    expect(log?.emoji).toBe("🔗");
    expect(log?.line).toBe("space-man-rob connected to server");
    expect(log?.metadata?.playerName).toBe("space-man-rob");
    expect(log?.metadata?.playerId).toBe("201990709919");
    expect(log?.userId).toBe("user123");
  });

  it("should parse connection event with hyphenated name", () => {
    const line =
      "<2025-11-02T07:47:09.855Z> <AccountLoginCharacterStatus_Character> Character: ... geid 123 - ... - name test-player-name - ...";
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).not.toBeNull();
    expect(log?.player).toBe("test-player-name");
    expect(log?.metadata?.playerName).toBe("test-player-name");
  });

  it("should set current player on connection event", () => {
    const line =
      "<2025-11-02T07:47:09.855Z> <AccountLoginCharacterStatus_Character> Character: ... geid 123 - ... - name TestPlayer - ...";
    parseStarCitizenLogLine(line, "user123");

    expect(getCurrentPlayer()).toBe("TestPlayer");
  });

  it("should return null for connection event without geid", () => {
    const line =
      "<2025-11-02T07:47:09.855Z> <AccountLoginCharacterStatus_Character> Character: ... - name TestPlayer - ...";
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).toBeNull();
  });

  it("should return null for connection event without name", () => {
    const line =
      "<2025-11-02T07:47:09.855Z> <AccountLoginCharacterStatus_Character> Character: ... geid 123 - ...";
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).toBeNull();
  });
});

describe("parseStarCitizenLogLine - Actor Death Events", () => {
  beforeEach(() => {
    resetParserState();
    setCurrentPlayer("TestPlayer");
  });

  it("should parse actor death event", () => {
    const line = `<2025-11-02T07:47:10.855Z> <Actor Death> CActor::Kill: 'Victim' [123] in zone 'AEGS_Gladius_456' killed by 'Killer' [789] using 'KLWE_LaserRepeater_S2' with damage type 'Combat'`;
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).not.toBeNull();
    expect(log?.eventType).toBe("actor_death");
    expect(log?.emoji).toBe("💀");
    expect(log?.line).toBe("Killer killed Victim");
    expect(log?.metadata?.victimName).toBe("Victim");
    expect(log?.metadata?.victimId).toBe("123");
    expect(log?.metadata?.killerName).toBe("Killer");
    expect(log?.metadata?.killerId).toBe("789");
  });

  it("should clean ship names in zone", () => {
    const line = `<2025-11-02T07:47:10.855Z> <Actor Death> CActor::Kill: 'Victim' [123] in zone 'AEGS_Gladius_456' killed by 'Killer' [789] using 'weapon' with damage type 'Combat'`;
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).not.toBeNull();
    expect(log?.metadata?.zone).toBe("Aegis Gladius");
  });

  it("should clean weapon names", () => {
    const line = `<2025-11-02T07:47:10.855Z> <Actor Death> CActor::Kill: 'Victim' [123] in zone 'zone' killed by 'Killer' [789] using 'KLWE_LaserRepeater_S2_123456' with damage type 'Combat'`;
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).not.toBeNull();
    expect(log?.metadata?.weaponClass).toBe("KLWE LaserRepeater S2");
  });

  it("should convert damage type from camelCase", () => {
    const line = `<2025-11-02T07:47:10.855Z> <Actor Death> CActor::Kill: 'Victim' [123] in zone 'zone' killed by 'Killer' [789] using 'weapon' with damage type 'VehicleDestruction'`;
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).not.toBeNull();
    expect(log?.metadata?.damageType).toBe("vehicle destruction");
  });

  it("should detect NPC victims", () => {
    const line = `<2025-11-02T07:47:10.855Z> <Actor Death> CActor::Kill: 'PU_SecurityGuard_NPC' [123] in zone 'zone' killed by 'Player' [789] using 'weapon' with damage type 'Combat'`;
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).not.toBeNull();
    expect(log?.metadata?.isAIVictim).toBe(true);
  });

  it("should detect NPC killers", () => {
    const line = `<2025-11-02T07:47:10.855Z> <Actor Death> CActor::Kill: 'Player' [123] in zone 'zone' killed by 'PU_SecurityGuard_NPC' [789] using 'weapon' with damage type 'Combat'`;
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).not.toBeNull();
    expect(log?.metadata?.isAIKiller).toBe(true);
  });

  it("should skip NPC vs NPC kills", () => {
    const line = `<2025-11-02T07:47:10.855Z> <Actor Death> CActor::Kill: 'PU_NPC1_NPC' [123] in zone 'zone' killed by 'PU_NPC2_NPC' [789] using 'weapon' with damage type 'Combat'`;
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).toBeNull();
  });

  it("should clean NPC names", () => {
    const line = `<2025-11-02T07:47:10.855Z> <Actor Death> CActor::Kill: 'NPC_Archetypes-Male-Human-FrontierFighters_Pilot_123' [123] in zone 'zone' killed by 'Player' [789] using 'weapon' with damage type 'Combat'`;
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).not.toBeNull();
    expect(log?.metadata?.victimName).toContain("NPC");
  });
});

describe("parseStarCitizenLogLine - Vehicle Control Flow", () => {
  beforeEach(() => {
    resetParserState();
    setCurrentPlayer("TestPlayer");
  });

  it("should parse vehicle control granted event", () => {
    const line = `<2025-11-02T07:47:10.855Z> <Vehicle Control Flow> Local client node [123] granted control token for 'AEGS_Gladius_456' [456]`;
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).not.toBeNull();
    expect(log?.eventType).toBe("vehicle_control_flow");
    expect(log?.line).toContain("controls");
    expect(log?.line).toContain("Aegis Gladius");
    expect(log?.metadata?.vehicleName).toBe("Aegis Gladius");
    expect(log?.metadata?.vehicleId).toBe("456");
    expect(log?.metadata?.action).toBe("granted");
  });

  it("should parse vehicle control releasing event", () => {
    const line = `<2025-11-02T07:47:10.855Z> <Vehicle Control Flow> Local client node [123] releasing control token for 'AEGS_Gladius_456' [456]`;
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).not.toBeNull();
    expect(log?.eventType).toBe("vehicle_control_flow");
    expect(log?.line).toContain("exited");
    expect(log?.metadata?.action).toBe("releasing");
  });

  it("should skip vehicle control requesting event", () => {
    const line = `<2025-11-02T07:47:10.855Z> <Vehicle Control Flow> Local client node [123] requesting control token for 'AEGS_Gladius_456' [456]`;
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).toBeNull();
  });

  it("should skip Default vehicle names", () => {
    const line = `<2025-11-02T07:47:10.855Z> <Vehicle Control Flow> Local client node [123] granted control token for 'Default_17518' [456]`;
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).toBeNull();
  });

  it("should clean ship names", () => {
    const line = `<2025-11-02T07:47:10.855Z> <Vehicle Control Flow> Local client node [123] granted control token for 'ANVL_Hornet_F7C_789' [789]`;
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).not.toBeNull();
    expect(log?.metadata?.vehicleName).toBe("Anvil Hornet F7C");
  });
});

describe("parseStarCitizenLogLine - Destruction Events", () => {
  beforeEach(() => {
    resetParserState();
    setCurrentPlayer("TestPlayer");
  });

  it("should parse vehicle destruction event", () => {
    const line = `<2025-11-02T07:47:10.855Z> <Vehicle Destruction> CVehicle::OnAdvanceDestroyLevel: Vehicle 'AEGS_Gladius_456' [456] from destroy level 1 to 2 driven by 'Driver' [123] caused by 'Attacker' [789] with 'Combat'`;
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).not.toBeNull();
    expect(log?.eventType).toBe("destruction");
    expect(log?.emoji).toBe("💥");
    expect(log?.line).toContain("destroyed");
    expect(log?.line).toContain("Aegis Gladius");
    expect(log?.metadata?.vehicleName).toBe("Aegis Gladius");
    expect(log?.metadata?.vehicleId).toBe("456");
    expect(log?.metadata?.driverName).toBe("Driver");
    expect(log?.metadata?.causeName).toBe("Attacker");
    expect(log?.metadata?.destroyLevelFrom).toBe("1");
    expect(log?.metadata?.destroyLevelTo).toBe("2");
  });

  it("should skip partial destruction (not 1 to 2)", () => {
    const line = `<2025-11-02T07:47:10.855Z> <Vehicle Destruction> CVehicle::OnAdvanceDestroyLevel: Vehicle 'AEGS_Gladius_456' [456] from destroy level 0 to 1 driven by 'Driver' [123] caused by 'Attacker' [789] with 'Combat'`;
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).toBeNull();
  });

  it("should handle unknown causer", () => {
    const line = `<2025-11-02T07:47:10.855Z> <Vehicle Destruction> CVehicle::OnAdvanceDestroyLevel: Vehicle 'AEGS_Gladius_456' [456] from destroy level 1 to 2 driven by 'Driver' [123] caused by 'unknown' [0] with 'Collision'`;
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).not.toBeNull();
    expect(log?.line).toContain("collision");
  });

  it("should clean ship/PDC names for causer", () => {
    const line = `<2025-11-02T07:47:10.855Z> <Vehicle Destruction> CVehicle::OnAdvanceDestroyLevel: Vehicle 'AEGS_Gladius_456' [456] from destroy level 1 to 2 driven by 'Driver' [123] caused by 'ANVL_Hornet_789' [789] with 'Combat'`;
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).not.toBeNull();
    expect(log?.line).toContain("Anvil Hornet");
  });
});

describe("parseStarCitizenLogLine - Location Change", () => {
  beforeEach(() => {
    resetParserState();
    setCurrentPlayer("TestPlayer");
  });

  it("should parse location inventory request", () => {
    const line = `<2025-11-02T07:47:10.855Z> <RequestLocationInventory> Player[TestPlayer] requested inventory for Location[RR_CRU_LEO]`;
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).not.toBeNull();
    expect(log?.eventType).toBe("location_change");
    expect(log?.emoji).toBe("📍");
    expect(log?.line).toContain("opened inventory at");
    expect(log?.line).toContain("RR_CRU_LEO");
    expect(log?.metadata?.location).toBe("RR_CRU_LEO");
  });

  it("should use current player if not specified", () => {
    const line = `<2025-11-02T07:47:10.855Z> <RequestLocationInventory> requested inventory for Location[RR_CRU_LEO]`;
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).not.toBeNull();
    expect(log?.line).toContain("TestPlayer");
  });
});

describe("parseStarCitizenLogLine - System Quit", () => {
  beforeEach(() => {
    resetParserState();
    setCurrentPlayer("TestPlayer");
  });

  it("should parse system quit event", () => {
    const line = `<2025-11-02T07:47:10.855Z> <SystemQuit> CSystem::Quit invoked...`;
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).not.toBeNull();
    expect(log?.eventType).toBe("system_quit");
    expect(log?.emoji).toBe("🔌");
    expect(log?.line).toBe("Game session ended");
  });
});

describe("parseStarCitizenLogLine - Mission Events", () => {
  beforeEach(() => {
    resetParserState();
    setCurrentPlayer("TestPlayer");
  });

  it("should parse mission shared event", () => {
    const line = `<2025-11-02T07:47:10.855Z> <MissionShared> Received share push message: ownerId[123] - missionId[abc-123-def-456]`;
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).not.toBeNull();
    expect(log?.eventType).toBe("mission_shared");
    expect(log?.emoji).toBe("📋");
    expect(log?.line).toContain("Mission shared");
    expect(log?.metadata?.missionId).toBe("abc-123-def-456");
    expect(log?.metadata?.ownerId).toBe("123");
  });

  it("should parse objective updated event", () => {
    const line = `<2025-11-02T07:47:10.855Z> <ObjectiveUpserted> Received ObjectiveUpserted push message for: mission_id abc-123 - objective_id def-456 - state MISSION_OBJECTIVE_STATE_COMPLETED`;
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).not.toBeNull();
    expect(log?.eventType).toBe("mission_objective");
    expect(log?.emoji).toBe("🎯");
    expect(log?.line).toContain("Mission objective");
    expect(log?.line).toContain("Completed");
    expect(log?.metadata?.missionId).toBe("abc-123");
    expect(log?.metadata?.objectiveId).toBe("def-456");
    expect(log?.metadata?.objectiveState).toBe(
      "MISSION_OBJECTIVE_STATE_COMPLETED",
    );
  });

  it("should parse mission ended event", () => {
    const line = `<2025-11-02T07:47:10.855Z> <MissionEnded> Received MissionEnded push message for: mission_id abc-123 - mission_state MISSION_STATE_COMPLETED`;
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).not.toBeNull();
    expect(log?.eventType).toBe("mission_completed");
    expect(log?.emoji).toBe("✅");
    expect(log?.line).toContain("Mission");
    expect(log?.metadata?.missionId).toBe("abc-123");
    expect(log?.metadata?.missionState).toBe("MISSION_STATE_COMPLETED");
  });

  it("should parse end mission event (complete)", () => {
    const line = `<2025-11-02T07:47:10.855Z> <EndMission> Ending mission for player. MissionId[abc-123] Player[TestPlayer] PlayerId[123] CompletionType[Complete] Reason[ObjectiveCompleted]`;
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).not.toBeNull();
    expect(log?.eventType).toBe("mission_ended");
    expect(log?.emoji).toBe("✅");
    expect(log?.line).toContain("completed mission");
    expect(log?.metadata?.missionId).toBe("abc-123");
    expect(log?.metadata?.completionType).toBe("Complete");
  });

  it("should parse end mission event (abort)", () => {
    const line = `<2025-11-02T07:47:10.855Z> <EndMission> Ending mission for player. MissionId[abc-123] Player[TestPlayer] PlayerId[123] CompletionType[Abort] Reason[PlayerAborted]`;
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).not.toBeNull();
    expect(log?.emoji).toBe("🚫");
    expect(log?.line).toContain("aborted mission");
  });

  it("should parse end mission event (fail)", () => {
    const line = `<2025-11-02T07:47:10.855Z> <EndMission> Ending mission for player. MissionId[abc-123] Player[TestPlayer] PlayerId[123] CompletionType[Fail] Reason[TimedOut]`;
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).not.toBeNull();
    expect(log?.emoji).toBe("❌");
    expect(log?.line).toContain("failed mission");
  });
});

describe("parseStarCitizenLogLine - Invalid Lines", () => {
  beforeEach(() => {
    resetParserState();
  });

  it("should return null for line without timestamp", () => {
    const line = "This is a log line without timestamp";
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).toBeNull();
  });

  it("should return null for empty line", () => {
    const log = parseStarCitizenLogLine("", "user123");

    expect(log).toBeNull();
  });

  it("should return null for unrecognized event type", () => {
    const line = "<2025-11-02T07:47:10.855Z> <UnknownEvent> Some content";
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).toBeNull();
  });
});

describe("parseLogLines", () => {
  beforeEach(() => {
    resetParserState();
  });

  it("should parse multiple log lines", () => {
    const lines = [
      "<2025-11-02T07:47:09.855Z> <AccountLoginCharacterStatus_Character> Character: ... geid 123 - ... - name TestPlayer - ...",
      "<2025-11-02T07:47:10.855Z> <SystemQuit> CSystem::Quit invoked...",
      "<2025-11-02T07:47:11.855Z> Invalid line without timestamp",
    ];

    const logs = parseLogLines(lines, "user123");

    expect(logs).toHaveLength(2);
    expect(logs[0]?.eventType).toBe("connection");
    expect(logs[1]?.eventType).toBe("system_quit");
  });

  it("should filter out null results", () => {
    const lines = [
      "Invalid line 1",
      "<2025-11-02T07:47:09.855Z> <AccountLoginCharacterStatus_Character> Character: ... geid 123 - ... - name TestPlayer - ...",
      "Invalid line 2",
    ];

    const logs = parseLogLines(lines, "user123");

    expect(logs).toHaveLength(1);
    expect(logs[0]?.eventType).toBe("connection");
  });

  it("should return empty array for empty input", () => {
    const logs = parseLogLines([], "user123");
    expect(logs).toEqual([]);
  });

  it("should return empty array for all invalid lines", () => {
    const lines = ["Invalid line 1", "Invalid line 2", "Invalid line 3"];
    const logs = parseLogLines(lines, "user123");
    expect(logs).toEqual([]);
  });

  it("should maintain order of logs", () => {
    const lines = [
      "<2025-11-02T07:47:09.855Z> <AccountLoginCharacterStatus_Character> Character: ... geid 123 - ... - name TestPlayer - ...",
      "<2025-11-02T07:47:10.855Z> <RequestLocationInventory> Player[TestPlayer] requested inventory for Location[Test]",
      "<2025-11-02T07:47:11.855Z> <SystemQuit> CSystem::Quit invoked...",
    ];

    const logs = parseLogLines(lines, "user123");

    expect(logs).toHaveLength(3);
    expect(logs[0]?.eventType).toBe("connection");
    expect(logs[1]?.eventType).toBe("location_change");
    expect(logs[2]?.eventType).toBe("system_quit");
  });
});

describe("parseStarCitizenLogLine - reportedBy field", () => {
  beforeEach(() => {
    resetParserState();
  });

  it("should set reportedBy to current player after connection", () => {
    const connectionLine =
      "<2025-11-02T07:47:09.855Z> <AccountLoginCharacterStatus_Character> Character: ... geid 123 - ... - name TestPlayer - ...";
    parseStarCitizenLogLine(connectionLine, "user123");

    const eventLine =
      "<2025-11-02T07:47:10.855Z> <SystemQuit> CSystem::Quit invoked...";
    const log = parseStarCitizenLogLine(eventLine, "user123");

    expect(log?.reportedBy).toEqual(["TestPlayer"]);
  });

  it("should set reportedBy to Unknown if no current player", () => {
    const line =
      "<2025-11-02T07:47:10.855Z> <SystemQuit> CSystem::Quit invoked...";
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log?.reportedBy).toEqual(["Unknown"]);
  });
});

describe("parseStarCitizenLogLine - Environmental Hazards", () => {
  beforeEach(() => {
    resetParserState();
    setCurrentPlayer("TestPlayer");
  });

  it("should parse suffocation start event", () => {
    const line = `<2025-11-02T07:47:10.855Z> <[STAMINA] Player started suffocating> Player[TestPlayer] Details: ...`;
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).not.toBeNull();
    expect(log?.eventType).toBe("environmental_hazard");
    expect(log?.emoji).toBe("⚠️");
    expect(log?.line).toContain("started suffocating");
    expect(log?.metadata?.hazardType).toBe("suffocation");
    expect(log?.metadata?.hazardState).toBe("started");
  });

  it("should parse suffocation stop event", () => {
    const line = `<2025-11-02T07:47:10.855Z> <[STAMINA] Player stopped suffocating> Player[TestPlayer]`;
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).not.toBeNull();
    expect(log?.eventType).toBe("environmental_hazard");
    expect(log?.line).toContain("stopped suffocating");
    expect(log?.metadata?.hazardState).toBe("stopped");
  });

  it("should parse depressurization start event", () => {
    const line = `<2025-11-02T07:47:10.855Z> <[STAMINA] Player started depressurization> Player[TestPlayer] Details: ...`;
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).not.toBeNull();
    expect(log?.eventType).toBe("environmental_hazard");
    expect(log?.line).toContain("started depressurizing");
    expect(log?.metadata?.hazardType).toBe("depressurization");
  });

  it("should parse depressurization stop event", () => {
    const line = `<2025-11-02T07:47:10.855Z> <[STAMINA] Player stopped depressurization> Player[TestPlayer]`;
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).not.toBeNull();
    expect(log?.line).toContain("stopped depressurizing");
  });
});

describe("parseStarCitizenLogLine - Fatal Collision", () => {
  beforeEach(() => {
    resetParserState();
    setCurrentPlayer("TestPlayer");
  });

  it("should parse fatal collision event", () => {
    const line = `<2025-11-02T07:47:10.855Z> <FatalCollision> Fatal Collision occured for vehicle AEGS_Gladius_123 [Part: Wing, Pos: 0,0,0, Zone: Crusader, PlayerPilot: 1] after hitting entity: Asteroid [123].`;
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).not.toBeNull();
    expect(log?.eventType).toBe("fatal_collision");
    expect(log?.emoji).toBe("💥");
    expect(log?.line).toContain("crashed into");
    expect(log?.metadata?.vehicleName).toBe("Aegis Gladius");
    expect(log?.metadata?.hitEntity).toBe("asteroid"); // lowercase as per implementation
    expect(log?.metadata?.part).toBe("Wing");
    expect(log?.metadata?.zone).toBe("Crusader");
  });

  it("should parse collision with another player", () => {
    const line = `<2025-11-02T07:47:10.855Z> <FatalCollision> Fatal Collision occured for vehicle ANVL_Hornet_456 [Part: Body, Zone: Stanton, PlayerPilot: 1] after hitting entity: OtherPlayer [Zone: ShipInstance - Class(AEGS_Sabre_789)] [456].`;
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).not.toBeNull();
    expect(log?.metadata?.hitEntityPlayer).toBe("OtherPlayer");
    expect(log?.metadata?.hitEntityShip).toBe("Aegis Sabre");
  });

  it("should handle collision without hit entity", () => {
    const line = `<2025-11-02T07:47:10.855Z> <FatalCollision> Fatal Collision occured for vehicle AEGS_Gladius_123 [Part: Wing, Zone: Crusader, PlayerPilot: 1] after hitting entity: unknown [0].`;
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).not.toBeNull();
    expect(log?.line).toContain("fatal crash"); // 'fatal crash' when hitEntity is 'unknown'
  });
});

describe("parseStarCitizenLogLine - Actor State Death", () => {
  beforeEach(() => {
    resetParserState();
    setCurrentPlayer("TestPlayer");
  });

  it("should parse actor state death from vehicle destruction", () => {
    const line = `<2025-11-02T07:47:10.855Z> <[ActorState] Dead> Actor 'PlayerName' [123] ejected from zone 'AEGS_Gladius_456' [456] to zone 'Space' [789] due to previous zone being in a destroyed vehicle...`;
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).not.toBeNull();
    expect(log?.eventType).toBe("actor_death");
    expect(log?.emoji).toBe("💀");
    expect(log?.line).toContain("died in");
    expect(log?.line).toContain("Aegis Gladius");
    expect(log?.metadata?.victimName).toBe("PlayerName");
    expect(log?.metadata?.victimId).toBe("123");
    expect(log?.metadata?.deathCause).toBe("vehicle_destruction");
    expect(log?.metadata?.damageType).toBe("vehicle destruction");
  });

  it("should handle NPC actor state death", () => {
    const line = `<2025-11-02T07:47:10.855Z> <[ActorState] Dead> Actor 'PU_SecurityGuard_NPC' [123] ejected from zone 'Ship' [456] to zone 'Space' [789] due to previous zone being in a destroyed vehicle...`;
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).not.toBeNull();
    expect(log?.metadata?.isAIVictim).toBe(true);
  });
});

describe("parseStarCitizenLogLine - Quantum Travel", () => {
  beforeEach(() => {
    resetParserState();
    setCurrentPlayer("TestPlayer");
  });

  it("should parse quantum travel state change", () => {
    const line = `<2025-11-02T07:47:10.855Z> <Jump Drive Requesting State Change> Requested change from Idle to Spooling, reason: QDRV spooling | Stanton | (player: AEGS_GLADIUS_7123456789 in zone Crusader)`;
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).not.toBeNull();
    expect(log?.eventType).toBe("quantum_travel");
    expect(log?.emoji).toBe("⚡");
    expect(log?.line).toContain("Quantum travel");
    expect(log?.metadata?.qtStateFrom).toBe("Idle");
    expect(log?.metadata?.qtStateTo).toBe("Spooling");
    expect(log?.metadata?.vehicleName).toBe("Aegis GLADIUS");
    expect(log?.metadata?.system).toBe("Stanton");
  });

  it("should filter out repetitive Idle to Idle events", () => {
    const line = `<2025-11-02T07:47:10.855Z> <Jump Drive Requesting State Change> Requested change from Idle to Idle, reason: no change | Stanton | (player: AEGS_GLADIUS_7123456789 in zone Space)`;
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).toBeNull();
  });

  it("should include Idle to Idle near jump points", () => {
    const line = `<2025-11-02T07:47:10.855Z> <Jump Drive Requesting State Change> Requested change from Idle to Idle, reason: [linked to JumpPoint_Permanent] | Stanton | (player: AEGS_GLADIUS_7123456789 in zone JumpPoint_Stanton_Pyro)`;
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).not.toBeNull();
    expect(log?.metadata?.isNearJumpPoint).toBe(true);
  });
});

describe("parseStarCitizenLogLine - Medical Events", () => {
  beforeEach(() => {
    resetParserState();
    setCurrentPlayer("TestPlayer");
  });

  it("should parse hospital respawn event", () => {
    const line = `<2025-11-02T07:47:10.855Z> <Spawn Flow> Player 'TestPlayer' lost reservation for spawnpoint bed_hospital_1_a-007 [123] at location 456`;
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).not.toBeNull();
    expect(log?.eventType).toBe("hospital_respawn");
    expect(log?.emoji).toBe("🏥");
    expect(log?.line).toContain("respawned at");
    expect(log?.line).toContain("Hospital 1 Bed A-007");
    expect(log?.metadata?.bedId).toBe("bed_hospital_1_a-007");
  });

  it("should hide Unknown bed names", () => {
    const line = `<2025-11-02T07:47:10.855Z> <Spawn Flow> Player 'TestPlayer' lost reservation for spawnpoint Unknown [123] at location 456`;
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).not.toBeNull();
    expect(log?.line).not.toContain("Unknown");
    expect(log?.line).toBe("TestPlayer respawned");
  });

  it("should parse hab bed respawn", () => {
    const line = `<2025-11-02T07:47:10.855Z> <Spawn Flow> Player 'TestPlayer' lost reservation for spawnpoint Bed_Single_Front_Spawnpoint_No_Persistent_Hab-001 [123] at location 456`;
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).not.toBeNull();
    expect(log?.line).toContain("Hab Bed 001");
  });
});

describe("parseStarCitizenLogLine - Economy Events", () => {
  beforeEach(() => {
    resetParserState();
    setCurrentPlayer("TestPlayer");
  });

  it("should parse purchase event", () => {
    const line = `<2025-11-02T07:47:10.855Z> <CEntityComponentShoppingProvider::SendStandardItemBuyRequest> itemName[LaserRifle] client_price[5000] shopName[Weapon Shop]`;
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).not.toBeNull();
    expect(log?.eventType).toBe("purchase");
    expect(log?.emoji).toBe("🛒");
    expect(log?.line).toContain("Purchased");
    expect(log?.line).toContain("LaserRifle");
    expect(log?.line).toContain("5,000 aUEC");
    expect(log?.metadata?.itemName).toBe("LaserRifle");
    expect(log?.metadata?.itemPrice).toBe("5000");
  });

  it("should parse insurance claim event", () => {
    const line = `<2025-11-02T07:47:10.855Z> <CWallet::ProcessClaimToNextStep> entitlementURN: urn:insurance:claim:123456`;
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).not.toBeNull();
    expect(log?.eventType).toBe("insurance_claim");
    expect(log?.emoji).toBe("📋");
    expect(log?.line).toContain("Insurance claim processed");
    expect(log?.metadata?.entitlementURN).toBe("urn:insurance:claim:123456");
  });
});

describe("parseStarCitizenLogLine - Quantum Arrival", () => {
  beforeEach(() => {
    resetParserState();
    setCurrentPlayer("TestPlayer");
  });

  it("should parse quantum arrival for other ships", () => {
    const line = `<2025-11-02T07:47:10.855Z> <Quantum Drive Arrived - Arrived at Final Destination> AEGS_Gladius_123[123]|Component|Quantum Drive has arrived at final destination`;
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).not.toBeNull();
    expect(log?.eventType).toBe("quantum_arrival");
    expect(log?.emoji).toBe("👀");
    expect(log?.line).toContain("spotted nearby");
    expect(log?.metadata?.vehicleName).toBe("Aegis Gladius");
    expect(log?.metadata?.vehicleId).toBe("123");
  });

  it("should filter out quantum arrival for player own ship detected via starmap navigation", () => {
    // First, player controls a ship via starmap navigation event
    const starmapLine = `<2025-11-02T07:46:00.000Z> [Notice] <Failed to get starmap route data!> [ItemNavigation][CL][14316] | NOT AUTH | RSI_Perseus_7724689695195[7724689695195]|CSCItemNavigation::GetStarmapRouteSegmentData|No Route loaded! [Team_CGP4][QuantumTravel]`;
    const controlLog = parseStarCitizenLogLine(starmapLine, "user123");
    expect(controlLog).not.toBeNull();
    expect(controlLog?.line).toContain("controls");
    expect(controlLog?.metadata?.vehicleId).toBe("7724689695195");

    // Then, the same ship triggers a quantum arrival - should be filtered out
    const arrivalLine = `<2025-11-02T07:47:10.855Z> [Notice] <Quantum Drive Arrived - Arrived at Final Destination> [ItemNavigation][CL][14316] | NOT AUTH | RSI_Perseus_7724689695195[7724689695195]|CSCItemNavigation::OnQuantumDriveArrived|Quantum Drive has arrived at final destination [Team_CGP4][QuantumTravel]`;
    const arrivalLog = parseStarCitizenLogLine(arrivalLine, "user123");

    // The arrival should be filtered out (return null) because it's the player's own ship
    expect(arrivalLog).toBeNull();
  });
});

describe("parseStarCitizenLogLine - Equipment Events", () => {
  beforeEach(() => {
    resetParserState();
    setCurrentPlayer("TestPlayer");
  });

  it("should parse equipment attachment received", () => {
    const line = `<2025-11-02T07:47:10.855Z> <AttachmentReceived> Player[TestPlayer] Attachment[LaserRifle] Status[Equipped] Port[RightHand]`;
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).not.toBeNull();
    expect(log?.eventType).toBe("equipment_received");
    expect(log?.emoji).toBe("🎒");
    expect(log?.line).toContain("equipped");
    expect(log?.metadata?.attachmentName).toBe("LaserRifle");
    expect(log?.metadata?.attachmentPort).toBe("RightHand");
  });

  it("should aggregate equip item events within time window", () => {
    // First event starts the aggregation window (returns null)
    const line1 = `<2025-11-02T07:47:10.855Z> <EquipItem> Request[123] equip from Inventory[456:Location:789] Class[Armor_Heavy_Chest] Rank[1] Port[Torso] DependentRequest[] PostAction[Wear]`;
    const log1 = parseStarCitizenLogLine(line1, "user123");
    expect(log1).toBeNull(); // First event is cached for aggregation

    // Second event 6 seconds later triggers the aggregated output from the first window
    const line2 = `<2025-11-02T07:47:16.855Z> <EquipItem> Request[124] equip from Inventory[456:Location:789] Class[Armor_Light_Legs] Rank[1] Port[Legs] DependentRequest[] PostAction[Wear]`;
    const log2 = parseStarCitizenLogLine(line2, "user123");

    // Second event returns the aggregated log from the first window
    expect(log2).not.toBeNull();
    expect(log2?.eventType).toBe("equipment_equip");
    expect(log2?.metadata?.aggregated).toBe(true);
  });

  it("should filter out Carry actions", () => {
    const line = `<2025-11-02T07:47:10.855Z> <EquipItem> Request[123] equip from Inventory[456:Location:789] Class[Carryable_Food_Apple] Rank[1] Port[RightHand] DependentRequest[] PostAction[Carry]`;
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).toBeNull();
  });
});

describe("parseStarCitizenLogLine - Starmap Navigation", () => {
  beforeEach(() => {
    resetParserState();
    setCurrentPlayer("TestPlayer");
  });

  it("should parse starmap navigation event", () => {
    const line = `<2025-11-02T07:47:10.855Z> <Failed to get starmap route data!> AEGS_Gladius_123[123]|CSCItemNavigation::GetStarmapRouteSegmentData`;
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).not.toBeNull();
    expect(log?.eventType).toBe("vehicle_control_flow");
    expect(log?.line).toContain("controls");
    expect(log?.metadata?.vehicleName).toBe("Aegis Gladius");
    expect(log?.metadata?.action).toBe("granted");
  });

  it("should deduplicate same ship ID", () => {
    const line = `<2025-11-02T07:47:10.855Z> <Failed to get starmap route data!> AEGS_Gladius_123[123]|CSCItemNavigation::GetStarmapRouteSegmentData`;

    const log1 = parseStarCitizenLogLine(line, "user123");
    expect(log1).not.toBeNull();

    const log2 = parseStarCitizenLogLine(line, "user123");
    expect(log2).toBeNull(); // Should be filtered out as duplicate
  });
});

describe("parseStarCitizenLogLine - Edge Cases", () => {
  beforeEach(() => {
    resetParserState();
    setCurrentPlayer("TestPlayer");
  });

  it("should handle very long player names", () => {
    const line =
      "<2025-11-02T07:47:09.855Z> <AccountLoginCharacterStatus_Character> Character: ... geid 123 - ... - name VeryLongPlayerNameThatExceedsNormalLength123456 - ...";
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).not.toBeNull();
    expect(log?.player).toBe("VeryLongPlayerNameThatExceedsNormalLength123456");
  });

  it("should handle player names with special characters", () => {
    const line =
      "<2025-11-02T07:47:09.855Z> <AccountLoginCharacterStatus_Character> Character: ... geid 123 - ... - name Player_123-ABC - ...";
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).not.toBeNull();
    expect(log?.player).toBe("Player_123-ABC");
  });

  it("should handle timestamps at boundary dates", () => {
    const line =
      "<1970-01-01T00:00:00.000Z> <SystemQuit> CSystem::Quit invoked...";
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).not.toBeNull();
    expect(log?.timestamp).toBe("1970-01-01T00:00:00.000Z");
  });

  it("should handle future timestamps", () => {
    const line =
      "<2099-12-31T23:59:59.999Z> <SystemQuit> CSystem::Quit invoked...";
    const log = parseStarCitizenLogLine(line, "user123");

    expect(log).not.toBeNull();
    expect(log?.timestamp).toBe("2099-12-31T23:59:59.999Z");
  });

  it("should generate unique IDs for same event at different times", () => {
    const line1 =
      "<2025-11-02T07:47:09.855Z> <SystemQuit> CSystem::Quit invoked...";
    const line2 =
      "<2025-11-02T07:47:10.855Z> <SystemQuit> CSystem::Quit invoked...";

    const log1 = parseStarCitizenLogLine(line1, "user123");
    const log2 = parseStarCitizenLogLine(line2, "user123");

    expect(log1?.id).not.toBe(log2?.id);
  });

  it("should generate same ID for identical lines", () => {
    resetParserState();
    const line =
      "<2025-11-02T07:47:09.855Z> <SystemQuit> CSystem::Quit invoked...";

    const log1 = parseStarCitizenLogLine(line, "user123");

    resetParserState();
    const log2 = parseStarCitizenLogLine(line, "user123");

    expect(log1?.id).toBe(log2?.id);
  });
});
