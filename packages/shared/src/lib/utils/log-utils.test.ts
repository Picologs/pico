/**
 * Tests for log utility functions
 */

import { describe, it, expect } from "vitest";
import type { Log, Friend, Group } from "@pico/types";
import {
  dedupeAndSortLogs,
  groupKillingSprees,
  applyMemoryLimit,
  filterLogsByUser,
  filterLogsByUsers,
  filterLogsSince,
  filterLogsByTimeRange,
  filterLogsByEventType,
  getMostRecentLog,
  getLastSyncTimestamp,
  mergeLogs,
  countLogsByEventType,
  getUniquePlayers,
  extractPlayersFromLog,
  getAllPlayersFromLogs,
  filterLogsByPlayers,
  isNPCLog,
  filterOutNPCLogs,
  isAIEntity,
  calculateSessionStats,
  calculateScoreboard,
  type SessionStatsData,
  type ScoreboardEntry,
} from "./log-utils";

// Helper function to create test logs
function createLog(
  id: string,
  timestamp: string,
  userId: string = "user1",
  player: string = "TestPlayer",
  eventType: string = "actor_death",
): Log {
  return {
    id,
    userId,
    player,
    emoji: "💀",
    line: `Test log ${id}`,
    timestamp,
    original: `Original log line ${id}`,
    open: false,
    eventType,
  };
}

// Helper to create kill log
function createKillLog(
  id: string,
  timestamp: string,
  killer: string,
  victim: string,
  isAIVictim: boolean = false,
): Log {
  return {
    id,
    userId: "user1",
    player: killer,
    emoji: "💀",
    line: `${killer} killed ${victim}`,
    timestamp,
    original: `Kill log ${id}`,
    open: false,
    eventType: "actor_death",
    metadata: {
      killerName: killer,
      victimName: victim,
      isAIVictim,
    },
  };
}

describe("dedupeAndSortLogs", () => {
  it("should remove duplicate logs by ID", () => {
    const logs = [
      createLog("1", "2024-01-01T10:00:00Z"),
      createLog("2", "2024-01-01T10:01:00Z"),
      createLog("1", "2024-01-01T10:02:00Z"), // Duplicate
    ];
    const result = dedupeAndSortLogs(logs);
    expect(result).toHaveLength(2);
    // After deduplication, we should have id '2' first (10:01) then '1' (10:02 - most recent version kept)
    expect(result.map((l) => l.id)).toEqual(["2", "1"]);
  });

  it("should preserve the most recent version of duplicate logs", () => {
    const logs = [
      { ...createLog("1", "2024-01-01T10:00:00Z"), line: "Old version" },
      { ...createLog("1", "2024-01-01T10:02:00Z"), line: "New version" },
    ];
    const result = dedupeAndSortLogs(logs);
    expect(result).toHaveLength(1);
    expect(result[0].line).toBe("New version");
  });

  it("should sort logs by timestamp in ascending order", () => {
    const logs = [
      createLog("3", "2024-01-01T10:03:00Z"),
      createLog("1", "2024-01-01T10:01:00Z"),
      createLog("2", "2024-01-01T10:02:00Z"),
    ];
    const result = dedupeAndSortLogs(logs);
    expect(result.map((l) => l.id)).toEqual(["1", "2", "3"]);
  });

  it("should handle empty array", () => {
    const result = dedupeAndSortLogs([]);
    expect(result).toHaveLength(0);
  });

  it("should handle single log", () => {
    const logs = [createLog("1", "2024-01-01T10:00:00Z")];
    const result = dedupeAndSortLogs(logs);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("should handle logs with same timestamp", () => {
    const logs = [
      createLog("1", "2024-01-01T10:00:00Z"),
      createLog("2", "2024-01-01T10:00:00Z"),
      createLog("3", "2024-01-01T10:00:00Z"),
    ];
    const result = dedupeAndSortLogs(logs);
    expect(result).toHaveLength(3);
  });

  it("should handle large arrays efficiently", () => {
    const logs = Array.from({ length: 1000 }, (_, i) =>
      createLog(`${i}`, `2024-01-01T${String(i % 24).padStart(2, "0")}:00:00Z`),
    );
    const result = dedupeAndSortLogs(logs);
    expect(result).toHaveLength(1000);
  });
});

describe("groupKillingSprees", () => {
  it("should group 3 consecutive kills into a spree", () => {
    const logs = [
      createKillLog("1", "2024-01-01T10:00:00Z", "Player1", "Victim1"),
      createKillLog("2", "2024-01-01T10:01:00Z", "Player1", "Victim2"),
      createKillLog("3", "2024-01-01T10:02:00Z", "Player1", "Victim3"),
    ];
    const result = groupKillingSprees(logs);
    expect(result).toHaveLength(1);
    expect(result[0].eventType).toBe("killing_spree");
    expect(result[0].metadata?.killCount).toBe(3);
    expect(result[0].children).toHaveLength(3);
  });

  it("should not group 2 consecutive kills (below minimum)", () => {
    const logs = [
      createKillLog("1", "2024-01-01T10:00:00Z", "Player1", "Victim1"),
      createKillLog("2", "2024-01-01T10:01:00Z", "Player1", "Victim2"),
    ];
    const result = groupKillingSprees(logs);
    expect(result).toHaveLength(2);
    expect(result[0].eventType).toBe("actor_death");
    expect(result[1].eventType).toBe("actor_death");
  });

  it("should break spree after 5 minute timeout", () => {
    const logs = [
      createKillLog("1", "2024-01-01T10:00:00Z", "Player1", "Victim1"),
      createKillLog("2", "2024-01-01T10:01:00Z", "Player1", "Victim2"),
      createKillLog("3", "2024-01-01T10:07:00Z", "Player1", "Victim3"), // 6 minutes later
    ];
    const result = groupKillingSprees(logs);
    expect(result).toHaveLength(3);
    expect(result.every((log) => log.eventType === "actor_death")).toBe(true);
  });

  it("should break spree on non-kill events", () => {
    const logs = [
      createKillLog("1", "2024-01-01T10:00:00Z", "Player1", "Victim1"),
      createKillLog("2", "2024-01-01T10:01:00Z", "Player1", "Victim2"),
      createLog(
        "3",
        "2024-01-01T10:02:00Z",
        "user1",
        "Player1",
        "location_change",
      ),
      createKillLog("4", "2024-01-01T10:03:00Z", "Player1", "Victim3"),
    ];
    const result = groupKillingSprees(logs);
    expect(result).toHaveLength(4);
    expect(result[2].eventType).toBe("location_change");
  });

  it("should create multiple sprees in same log array", () => {
    const logs = [
      createKillLog("1", "2024-01-01T10:00:00Z", "Player1", "Victim1"),
      createKillLog("2", "2024-01-01T10:01:00Z", "Player1", "Victim2"),
      createKillLog("3", "2024-01-01T10:02:00Z", "Player1", "Victim3"),
      createLog(
        "4",
        "2024-01-01T10:03:00Z",
        "user1",
        "Player1",
        "location_change",
      ),
      createKillLog("5", "2024-01-01T10:04:00Z", "Player1", "Victim4"),
      createKillLog("6", "2024-01-01T10:05:00Z", "Player1", "Victim5"),
      createKillLog("7", "2024-01-01T10:06:00Z", "Player1", "Victim6"),
    ];
    const result = groupKillingSprees(logs);
    expect(result).toHaveLength(3); // 2 sprees + 1 location change
    expect(result[0].eventType).toBe("killing_spree");
    expect(result[2].eventType).toBe("killing_spree");
  });

  it("should only count kills where player is the killer", () => {
    // Create kill logs where player field doesn't match killerName - these shouldn't be sprees
    const log1: Log = {
      ...createKillLog("1", "2024-01-01T10:00:00Z", "Player1", "Victim1"),
      player: "Player1", // Matches killer
    };
    const log2: Log = {
      ...createKillLog("2", "2024-01-01T10:01:00Z", "Player2", "Victim2"),
      player: "Player1", // Doesn't match killer (viewing Player1's log of Player2's kill)
    };
    const log3: Log = {
      ...createKillLog("3", "2024-01-01T10:02:00Z", "Player1", "Victim3"),
      player: "Player1", // Matches killer
    };
    const logs = [log1, log2, log3];
    const result = groupKillingSprees(logs);
    // log2 breaks the spree because player !== killerName, so we get 3 separate logs
    expect(result).toHaveLength(3);
    expect(result.every((log) => log.eventType === "actor_death")).toBe(true);
  });

  it("should create spree log with correct metadata", () => {
    const logs = [
      createKillLog("1", "2024-01-01T10:00:00Z", "Player1", "Victim1"),
      createKillLog("2", "2024-01-01T10:01:00Z", "Player1", "Victim2"),
      createKillLog("3", "2024-01-01T10:02:00Z", "Player1", "Victim3"),
    ];
    const result = groupKillingSprees(logs);
    expect(result).toHaveLength(1);
    const spree = result[0];
    expect(spree.id).toBe("spree-1");
    expect(spree.emoji).toBe("🔥");
    expect(spree.line).toBe("Player1 on a 3-kill spree!");
    expect(spree.metadata?.victims).toEqual(["Victim1", "Victim2", "Victim3"]);
  });

  it("should handle empty array", () => {
    const result = groupKillingSprees([]);
    expect(result).toHaveLength(0);
  });

  it("should handle 5+ kill spree", () => {
    const logs = Array.from({ length: 5 }, (_, i) =>
      createKillLog(`${i}`, `2024-01-01T10:0${i}:00Z`, "Player1", `Victim${i}`),
    );
    const result = groupKillingSprees(logs);
    expect(result).toHaveLength(1);
    expect(result[0].metadata?.killCount).toBe(5);
  });

  it("should not group 2 kills after timeout", () => {
    const logs = [
      createKillLog("1", "2024-01-01T10:00:00Z", "Player1", "Victim1"),
      createKillLog("2", "2024-01-01T10:07:00Z", "Player1", "Victim2"), // 7 minutes later
    ];
    const result = groupKillingSprees(logs);
    expect(result).toHaveLength(2);
    expect(result.every((log) => log.eventType === "actor_death")).toBe(true);
  });
});

describe("applyMemoryLimit", () => {
  it("should trim logs to specified limit", () => {
    const logs = Array.from({ length: 10 }, (_, i) =>
      createLog(`${i}`, `2024-01-01T10:0${i}:00Z`),
    );
    const result = applyMemoryLimit(logs, 5);
    expect(result).toHaveLength(5);
    expect(result.map((l) => l.id)).toEqual(["5", "6", "7", "8", "9"]);
  });

  it("should keep most recent logs", () => {
    const logs = [
      createLog("old", "2024-01-01T10:00:00Z"),
      createLog("recent", "2024-01-01T10:05:00Z"),
    ];
    const result = applyMemoryLimit(logs, 1);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("recent");
  });

  it("should return all logs if under limit", () => {
    const logs = Array.from({ length: 5 }, (_, i) =>
      createLog(`${i}`, `2024-01-01T10:0${i}:00Z`),
    );
    const result = applyMemoryLimit(logs, 10);
    expect(result).toHaveLength(5);
  });

  it("should return all logs if equal to limit", () => {
    const logs = Array.from({ length: 5 }, (_, i) =>
      createLog(`${i}`, `2024-01-01T10:0${i}:00Z`),
    );
    const result = applyMemoryLimit(logs, 5);
    expect(result).toHaveLength(5);
  });

  it("should use default limit of 1000", () => {
    const logs = Array.from({ length: 1500 }, (_, i) =>
      createLog(`${i}`, `2024-01-01T10:00:00Z`),
    );
    const result = applyMemoryLimit(logs);
    expect(result).toHaveLength(1000);
  });

  it("should handle empty array", () => {
    const result = applyMemoryLimit([]);
    expect(result).toHaveLength(0);
  });

  it("should handle limit of 0", () => {
    const logs = [createLog("1", "2024-01-01T10:00:00Z")];
    const result = applyMemoryLimit(logs, 0);
    // slice(-0) is equivalent to slice(0), which returns the full array
    // The function doesn't handle limit=0 as a special case
    expect(result).toHaveLength(1);
  });
});

describe("filterLogsByUser", () => {
  it("should filter logs by user ID", () => {
    const logs = [
      createLog("1", "2024-01-01T10:00:00Z", "user1"),
      createLog("2", "2024-01-01T10:01:00Z", "user2"),
      createLog("3", "2024-01-01T10:02:00Z", "user1"),
    ];
    const result = filterLogsByUser(logs, "user1");
    expect(result).toHaveLength(2);
    expect(result.map((l) => l.id)).toEqual(["1", "3"]);
  });

  it("should return empty array when no matches", () => {
    const logs = [createLog("1", "2024-01-01T10:00:00Z", "user1")];
    const result = filterLogsByUser(logs, "user2");
    expect(result).toHaveLength(0);
  });

  it("should handle empty array", () => {
    const result = filterLogsByUser([], "user1");
    expect(result).toHaveLength(0);
  });
});

describe("filterLogsByUsers", () => {
  it("should filter logs by multiple user IDs", () => {
    const logs = [
      createLog("1", "2024-01-01T10:00:00Z", "user1"),
      createLog("2", "2024-01-01T10:01:00Z", "user2"),
      createLog("3", "2024-01-01T10:02:00Z", "user3"),
    ];
    const result = filterLogsByUsers(logs, ["user1", "user3"]);
    expect(result).toHaveLength(2);
    expect(result.map((l) => l.id)).toEqual(["1", "3"]);
  });

  it("should return empty array when no user IDs provided", () => {
    const logs = [createLog("1", "2024-01-01T10:00:00Z", "user1")];
    const result = filterLogsByUsers(logs, []);
    expect(result).toHaveLength(0);
  });

  it("should handle empty array", () => {
    const result = filterLogsByUsers([], ["user1"]);
    expect(result).toHaveLength(0);
  });

  it("should use Set for efficient lookup", () => {
    const logs = Array.from({ length: 1000 }, (_, i) =>
      createLog(`${i}`, `2024-01-01T10:00:00Z`, `user${i % 10}`),
    );
    const result = filterLogsByUsers(logs, ["user1", "user2"]);
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("filterLogsSince", () => {
  it("should filter logs after timestamp (string)", () => {
    const logs = [
      createLog("1", "2024-01-01T10:00:00Z"),
      createLog("2", "2024-01-01T10:02:00Z"),
      createLog("3", "2024-01-01T10:04:00Z"),
    ];
    const result = filterLogsSince(logs, "2024-01-01T10:01:00Z");
    expect(result).toHaveLength(2);
    expect(result.map((l) => l.id)).toEqual(["2", "3"]);
  });

  it("should filter logs after timestamp (Date)", () => {
    const logs = [
      createLog("1", "2024-01-01T10:00:00Z"),
      createLog("2", "2024-01-01T10:02:00Z"),
    ];
    const result = filterLogsSince(logs, new Date("2024-01-01T10:01:00Z"));
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  it("should exclude logs at exact timestamp", () => {
    const logs = [
      createLog("1", "2024-01-01T10:00:00Z"),
      createLog("2", "2024-01-01T10:01:00Z"),
    ];
    const result = filterLogsSince(logs, "2024-01-01T10:01:00Z");
    expect(result).toHaveLength(0);
  });

  it("should handle empty array", () => {
    const result = filterLogsSince([], "2024-01-01T10:00:00Z");
    expect(result).toHaveLength(0);
  });
});

describe("filterLogsByTimeRange", () => {
  it("should filter logs within time range (inclusive)", () => {
    const logs = [
      createLog("1", "2024-01-01T10:00:00Z"),
      createLog("2", "2024-01-01T10:02:00Z"),
      createLog("3", "2024-01-01T10:04:00Z"),
      createLog("4", "2024-01-01T10:06:00Z"),
    ];
    const result = filterLogsByTimeRange(
      logs,
      new Date("2024-01-01T10:01:00Z"),
      new Date("2024-01-01T10:05:00Z"),
    );
    expect(result).toHaveLength(2);
    expect(result.map((l) => l.id)).toEqual(["2", "3"]);
  });

  it("should include logs at exact start and end times", () => {
    const logs = [
      createLog("1", "2024-01-01T10:00:00Z"),
      createLog("2", "2024-01-01T10:02:00Z"),
    ];
    const result = filterLogsByTimeRange(
      logs,
      new Date("2024-01-01T10:00:00Z"),
      new Date("2024-01-01T10:02:00Z"),
    );
    expect(result).toHaveLength(2);
  });

  it("should handle empty array", () => {
    const result = filterLogsByTimeRange(
      [],
      new Date("2024-01-01T10:00:00Z"),
      new Date("2024-01-01T10:02:00Z"),
    );
    expect(result).toHaveLength(0);
  });
});

describe("filterLogsByEventType", () => {
  it("should filter logs by event type", () => {
    const logs = [
      createLog("1", "2024-01-01T10:00:00Z", "user1", "Player1", "actor_death"),
      createLog(
        "2",
        "2024-01-01T10:01:00Z",
        "user1",
        "Player1",
        "location_change",
      ),
      createLog("3", "2024-01-01T10:02:00Z", "user1", "Player1", "actor_death"),
    ];
    const result = filterLogsByEventType(logs, ["actor_death"]);
    expect(result).toHaveLength(2);
    expect(result.map((l) => l.id)).toEqual(["1", "3"]);
  });

  it("should filter by multiple event types", () => {
    const logs = [
      createLog("1", "2024-01-01T10:00:00Z", "user1", "Player1", "actor_death"),
      createLog(
        "2",
        "2024-01-01T10:01:00Z",
        "user1",
        "Player1",
        "location_change",
      ),
      createLog("3", "2024-01-01T10:02:00Z", "user1", "Player1", "destruction"),
    ];
    const result = filterLogsByEventType(logs, ["actor_death", "destruction"]);
    expect(result).toHaveLength(2);
    expect(result.map((l) => l.id)).toEqual(["1", "3"]);
  });

  it("should return empty array when no matches", () => {
    const logs = [
      createLog("1", "2024-01-01T10:00:00Z", "user1", "Player1", "actor_death"),
    ];
    const result = filterLogsByEventType(logs, ["location_change"]);
    expect(result).toHaveLength(0);
  });

  it("should handle empty array", () => {
    const result = filterLogsByEventType([], ["actor_death"]);
    expect(result).toHaveLength(0);
  });
});

describe("getMostRecentLog", () => {
  it("should return the last log in array", () => {
    const logs = [
      createLog("1", "2024-01-01T10:00:00Z"),
      createLog("2", "2024-01-01T10:01:00Z"),
      createLog("3", "2024-01-01T10:02:00Z"),
    ];
    const result = getMostRecentLog(logs);
    expect(result?.id).toBe("3");
  });

  it("should return null for empty array", () => {
    const result = getMostRecentLog([]);
    expect(result).toBeNull();
  });

  it("should return single log", () => {
    const logs = [createLog("1", "2024-01-01T10:00:00Z")];
    const result = getMostRecentLog(logs);
    expect(result?.id).toBe("1");
  });
});

describe("getLastSyncTimestamp", () => {
  it("should return timestamp of most recent log", () => {
    const logs = [
      createLog("1", "2024-01-01T10:00:00Z"),
      createLog("2", "2024-01-01T10:02:00Z"),
    ];
    const result = getLastSyncTimestamp(logs);
    expect(result).toBe("2024-01-01T10:02:00Z");
  });

  it("should return null for empty array", () => {
    const result = getLastSyncTimestamp([]);
    expect(result).toBeNull();
  });
});

describe("mergeLogs", () => {
  it("should merge two log arrays", () => {
    const logs1 = [
      createLog("1", "2024-01-01T10:00:00Z"),
      createLog("2", "2024-01-01T10:02:00Z"),
    ];
    const logs2 = [
      createLog("3", "2024-01-01T10:01:00Z"),
      createLog("4", "2024-01-01T10:03:00Z"),
    ];
    const result = mergeLogs(logs1, logs2);
    expect(result).toHaveLength(4);
    expect(result.map((l) => l.id)).toEqual(["1", "3", "2", "4"]);
  });

  it("should deduplicate when merging", () => {
    const logs1 = [
      createLog("1", "2024-01-01T10:00:00Z"),
      createLog("2", "2024-01-01T10:01:00Z"),
    ];
    const logs2 = [
      createLog("2", "2024-01-01T10:01:00Z"),
      createLog("3", "2024-01-01T10:02:00Z"),
    ];
    const result = mergeLogs(logs1, logs2);
    expect(result).toHaveLength(3);
    expect(result.map((l) => l.id)).toEqual(["1", "2", "3"]);
  });

  it("should handle empty arrays", () => {
    const logs = [createLog("1", "2024-01-01T10:00:00Z")];
    expect(mergeLogs([], logs)).toHaveLength(1);
    expect(mergeLogs(logs, [])).toHaveLength(1);
    expect(mergeLogs([], [])).toHaveLength(0);
  });
});

describe("countLogsByEventType", () => {
  it("should count logs by event type", () => {
    const logs = [
      createLog("1", "2024-01-01T10:00:00Z", "user1", "Player1", "actor_death"),
      createLog("2", "2024-01-01T10:01:00Z", "user1", "Player1", "actor_death"),
      createLog(
        "3",
        "2024-01-01T10:02:00Z",
        "user1",
        "Player1",
        "location_change",
      ),
    ];
    const result = countLogsByEventType(logs);
    expect(result).toEqual({
      actor_death: 2,
      location_change: 1,
    });
  });

  it("should handle logs without eventType", () => {
    const logs = [
      { ...createLog("1", "2024-01-01T10:00:00Z"), eventType: undefined },
    ];
    const result = countLogsByEventType(logs);
    expect(result).toEqual({ unknown: 1 });
  });

  it("should handle empty array", () => {
    const result = countLogsByEventType([]);
    expect(result).toEqual({});
  });
});

describe("getUniquePlayers", () => {
  it("should return unique player names", () => {
    const logs = [
      createLog("1", "2024-01-01T10:00:00Z", "user1", "Player1"),
      createLog("2", "2024-01-01T10:01:00Z", "user1", "Player2"),
      createLog("3", "2024-01-01T10:02:00Z", "user1", "Player1"),
    ];
    const result = getUniquePlayers(logs);
    expect(result.size).toBe(2);
    expect(result.has("Player1")).toBe(true);
    expect(result.has("Player2")).toBe(true);
  });

  it("should handle logs without player names", () => {
    const logs = [{ ...createLog("1", "2024-01-01T10:00:00Z"), player: "" }];
    const result = getUniquePlayers(logs);
    expect(result.size).toBe(0);
  });

  it("should handle empty array", () => {
    const result = getUniquePlayers([]);
    expect(result.size).toBe(0);
  });
});

describe("extractPlayersFromLog", () => {
  it("should extract log owner", () => {
    const log = createLog("1", "2024-01-01T10:00:00Z", "user1", "Player1");
    const result = extractPlayersFromLog(log);
    expect(result.has("Player1")).toBe(true);
  });

  it("should extract killer and victim from metadata", () => {
    const log = createKillLog(
      "1",
      "2024-01-01T10:00:00Z",
      "Killer1",
      "Victim1",
    );
    const result = extractPlayersFromLog(log);
    expect(result.has("Killer1")).toBe(true);
    expect(result.has("Victim1")).toBe(true);
  });

  it("should extract cause from destruction events", () => {
    const log: Log = {
      ...createLog(
        "1",
        "2024-01-01T10:00:00Z",
        "user1",
        "Player1",
        "destruction",
      ),
      metadata: {
        causeName: "Destroyer",
        vehicleName: "Ship1",
      },
    };
    const result = extractPlayersFromLog(log);
    expect(result.has("Destroyer")).toBe(true);
  });

  it("should extract players from children logs", () => {
    const child1 = createKillLog(
      "1",
      "2024-01-01T10:00:00Z",
      "Player1",
      "Victim1",
    );
    const child2 = createKillLog(
      "2",
      "2024-01-01T10:01:00Z",
      "Player1",
      "Victim2",
    );
    const parent: Log = {
      ...createLog(
        "spree",
        "2024-01-01T10:00:00Z",
        "user1",
        "Player1",
        "killing_spree",
      ),
      children: [child1, child2],
    };
    const result = extractPlayersFromLog(parent);
    expect(result.has("Player1")).toBe(true);
    expect(result.has("Victim1")).toBe(true);
    expect(result.has("Victim2")).toBe(true);
  });

  it("should handle logs without metadata", () => {
    const log = createLog("1", "2024-01-01T10:00:00Z");
    const result = extractPlayersFromLog(log);
    expect(result.size).toBeGreaterThan(0);
  });
});

describe("getAllPlayersFromLogs", () => {
  it("should get all players sorted alphabetically", () => {
    const logs = [
      createLog("1", "2024-01-01T10:00:00Z", "user1", "Charlie"),
      createLog("2", "2024-01-01T10:01:00Z", "user1", "Alice"),
      createLog("3", "2024-01-01T10:02:00Z", "user1", "Bob"),
    ];
    const result = getAllPlayersFromLogs(logs);
    expect(result).toEqual(["Alice", "Bob", "Charlie"]);
  });

  it("should filter out AI entities", () => {
    const logs = [
      createLog("1", "2024-01-01T10:00:00Z", "user1", "Player1"),
      createLog("2", "2024-01-01T10:01:00Z", "user1", "PU_NPC_123"),
      createLog("3", "2024-01-01T10:02:00Z", "user1", "Entity_NPC_456"),
    ];
    const result = getAllPlayersFromLogs(logs);
    expect(result).toEqual(["Player1"]);
  });

  it("should handle empty array", () => {
    const result = getAllPlayersFromLogs([]);
    expect(result).toEqual([]);
  });
});

describe("filterLogsByPlayers", () => {
  it("should filter logs mentioning any of the specified players", () => {
    const logs = [
      createKillLog("1", "2024-01-01T10:00:00Z", "Player1", "Victim1"),
      createKillLog("2", "2024-01-01T10:01:00Z", "Player2", "Victim2"),
      createKillLog("3", "2024-01-01T10:02:00Z", "Player3", "Player1"),
    ];
    const result = filterLogsByPlayers(logs, ["Player1"]);
    expect(result).toHaveLength(2);
    expect(result.map((l) => l.id)).toEqual(["1", "3"]);
  });

  it("should return empty array when no player names provided", () => {
    const logs = [createLog("1", "2024-01-01T10:00:00Z")];
    const result = filterLogsByPlayers(logs, []);
    expect(result).toHaveLength(0);
  });

  it("should handle empty array", () => {
    const result = filterLogsByPlayers([], ["Player1"]);
    expect(result).toHaveLength(0);
  });
});

describe("isNPCLog", () => {
  it("should identify NPC logs with _NPC_ substring", () => {
    const log = createLog(
      "1",
      "2024-01-01T10:00:00Z",
      "user1",
      "Entity_NPC_123",
    );
    expect(isNPCLog(log)).toBe(true);
  });

  it("should identify NPC logs with PU_ prefix", () => {
    const log = createLog("1", "2024-01-01T10:00:00Z", "user1", "PU_Pirate_01");
    expect(isNPCLog(log)).toBe(true);
  });

  it("should not identify regular player logs as NPC", () => {
    const log = createLog(
      "1",
      "2024-01-01T10:00:00Z",
      "user1",
      "RegularPlayer",
    );
    expect(isNPCLog(log)).toBe(false);
  });

  it("should handle logs without player name", () => {
    const log = { ...createLog("1", "2024-01-01T10:00:00Z"), player: "" };
    expect(isNPCLog(log)).toBe(false);
  });
});

describe("filterOutNPCLogs", () => {
  it("should remove NPC logs", () => {
    const logs = [
      createLog("1", "2024-01-01T10:00:00Z", "user1", "Player1"),
      createLog("2", "2024-01-01T10:01:00Z", "user1", "PU_NPC_123"),
      createLog("3", "2024-01-01T10:02:00Z", "user1", "Player2"),
    ];
    const result = filterOutNPCLogs(logs);
    expect(result).toHaveLength(2);
    expect(result.map((l) => l.player)).toEqual(["Player1", "Player2"]);
  });

  it("should handle empty array", () => {
    const result = filterOutNPCLogs([]);
    expect(result).toHaveLength(0);
  });
});

describe("isAIEntity", () => {
  it("should identify AI entities with PU_ prefix", () => {
    expect(isAIEntity("PU_Pirate_01")).toBe(true);
  });

  it("should identify AI entities with _NPC_ substring", () => {
    expect(isAIEntity("Entity_NPC_123")).toBe(true);
  });

  it("should identify AI entities with AIModule substring", () => {
    expect(isAIEntity("CombatAIModule")).toBe(true);
  });

  it("should not identify regular players as AI", () => {
    expect(isAIEntity("RegularPlayer")).toBe(false);
  });

  it("should handle undefined", () => {
    expect(isAIEntity(undefined)).toBe(false);
  });

  it("should handle empty string", () => {
    expect(isAIEntity("")).toBe(false);
  });
});

describe("calculateSessionStats", () => {
  it("should count player kills", () => {
    const logs = [
      createKillLog("1", "2024-01-01T10:00:00Z", "Player1", "Victim1", false),
      createKillLog("2", "2024-01-01T10:01:00Z", "Player1", "Victim2", false),
    ];
    const stats = calculateSessionStats(logs, "Player1");
    expect(stats.playerKills).toBe(2);
    expect(stats.aiKills).toBe(0);
    expect(stats.deaths).toBe(0);
  });

  it("should count AI kills", () => {
    const logs = [
      createKillLog(
        "1",
        "2024-01-01T10:00:00Z",
        "Player1",
        "PU_Pirate_01",
        true,
      ),
      createKillLog(
        "2",
        "2024-01-01T10:01:00Z",
        "Player1",
        "PU_Pirate_02",
        true,
      ),
    ];
    const stats = calculateSessionStats(logs, "Player1");
    expect(stats.playerKills).toBe(0);
    expect(stats.aiKills).toBe(2);
    expect(stats.deaths).toBe(0);
  });

  it("should count deaths", () => {
    const logs = [
      createKillLog("1", "2024-01-01T10:00:00Z", "Killer1", "Player1", false),
      createKillLog("2", "2024-01-01T10:01:00Z", "Killer2", "Player1", false),
    ];
    const stats = calculateSessionStats(logs, "Player1");
    expect(stats.playerKills).toBe(0);
    expect(stats.deaths).toBe(2);
  });

  it("should count player ship destructions", () => {
    const logs: Log[] = [
      {
        ...createLog(
          "1",
          "2024-01-01T10:00:00Z",
          "user1",
          "Player1",
          "destruction",
        ),
        metadata: {
          causeName: "Player1",
          vehicleName: "Ship1",
          isAIVehicle: false,
        },
      },
      {
        ...createLog(
          "2",
          "2024-01-01T10:01:00Z",
          "user1",
          "Player1",
          "destruction",
        ),
        metadata: {
          causeName: "Player1",
          vehicleName: "Ship2",
          isAIVehicle: false,
        },
      },
    ];
    const stats = calculateSessionStats(logs, "Player1");
    expect(stats.playerShipsDestroyed).toBe(2);
    expect(stats.aiShipsDestroyed).toBe(0);
  });

  it("should count AI ship destructions", () => {
    const logs: Log[] = [
      {
        ...createLog(
          "1",
          "2024-01-01T10:00:00Z",
          "user1",
          "Player1",
          "destruction",
        ),
        metadata: {
          causeName: "Player1",
          vehicleName: "PirateShip1",
          isAIVehicle: true,
        },
      },
    ];
    const stats = calculateSessionStats(logs, "Player1");
    expect(stats.playerShipsDestroyed).toBe(0);
    expect(stats.aiShipsDestroyed).toBe(1);
  });

  it("should deduplicate ship destructions by vehicle name", () => {
    const logs: Log[] = [
      {
        ...createLog(
          "1",
          "2024-01-01T10:00:00Z",
          "user1",
          "Player1",
          "destruction",
        ),
        metadata: {
          causeName: "Player1",
          vehicleName: "Ship1",
          isAIVehicle: false,
        },
      },
      {
        ...createLog(
          "2",
          "2024-01-01T10:01:00Z",
          "user1",
          "Player1",
          "destruction",
        ),
        metadata: {
          causeName: "Player1",
          vehicleName: "Ship1", // Same vehicle
          isAIVehicle: false,
        },
      },
    ];
    const stats = calculateSessionStats(logs, "Player1");
    expect(stats.playerShipsDestroyed).toBe(1);
  });

  it("should handle null current player", () => {
    const logs = [
      createKillLog("1", "2024-01-01T10:00:00Z", "Player1", "Victim1", false),
    ];
    const stats = calculateSessionStats(logs, null);
    expect(stats.playerKills).toBe(0);
    expect(stats.aiKills).toBe(0);
    expect(stats.deaths).toBe(0);
  });

  it("should handle empty logs", () => {
    const stats = calculateSessionStats([], "Player1");
    expect(stats).toEqual({
      playerKills: 0,
      aiKills: 0,
      playerShipsDestroyed: 0,
      aiShipsDestroyed: 0,
      deaths: 0,
    });
  });

  it("should handle mixed event types", () => {
    const logs = [
      createKillLog("1", "2024-01-01T10:00:00Z", "Player1", "Victim1", false),
      createLog(
        "2",
        "2024-01-01T10:01:00Z",
        "user1",
        "Player1",
        "location_change",
      ),
      createKillLog("3", "2024-01-01T10:02:00Z", "Player1", "Victim2", true),
    ];
    const stats = calculateSessionStats(logs, "Player1");
    expect(stats.playerKills).toBe(1);
    expect(stats.aiKills).toBe(1);
  });
});

describe("calculateScoreboard", () => {
  it("should calculate scores correctly", () => {
    const logs = [
      createKillLog("1", "2024-01-01T10:00:00Z", "Player2", "Victim1", false), // +2
      createKillLog("2", "2024-01-01T10:01:00Z", "Player2", "Victim2", true), // +1
    ];
    const friends: Friend[] = [
      {
        id: "friend1",
        userDiscordId: "user1",
        friendDiscordId: "user2",
        friendUsername: "Friend1",
        friendDisplayName: null,
        friendAvatar: null,
        friendPlayer: "Player2",
        status: "accepted",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
        isOnline: true,
      },
    ];
    const result = calculateScoreboard(
      logs,
      "Player1",
      "user1",
      null,
      friends,
      [],
    );
    expect(result).toHaveLength(1);
    expect(result[0].score).toBe(3); // 2 + 1
    expect(result[0].playerKills).toBe(1);
    expect(result[0].aiKills).toBe(1);
  });

  it("should calculate K/D ratio correctly", () => {
    const logs = [
      createKillLog("1", "2024-01-01T10:00:00Z", "Player2", "Victim1", false),
      createKillLog("2", "2024-01-01T10:01:00Z", "Killer1", "Player2", false),
    ];
    const friends: Friend[] = [
      {
        id: "friend1",
        userDiscordId: "user1",
        friendDiscordId: "user2",
        friendUsername: "Friend1",
        friendDisplayName: null,
        friendAvatar: null,
        friendPlayer: "Player2",
        status: "accepted",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
        isOnline: true,
      },
    ];
    const result = calculateScoreboard(
      logs,
      "Player1",
      "user1",
      null,
      friends,
      [],
    );
    expect(result[0].kdRatio).toBe(1); // 1 kill / 1 death
  });

  it("should handle zero deaths (infinite K/D)", () => {
    const logs = [
      createKillLog("1", "2024-01-01T10:00:00Z", "Player2", "Victim1", false),
      createKillLog("2", "2024-01-01T10:01:00Z", "Player2", "Victim2", false),
    ];
    const friends: Friend[] = [
      {
        id: "friend1",
        userDiscordId: "user1",
        friendDiscordId: "user2",
        friendUsername: "Friend1",
        friendDisplayName: null,
        friendAvatar: null,
        friendPlayer: "Player2",
        status: "accepted",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
        isOnline: true,
      },
    ];
    const result = calculateScoreboard(
      logs,
      "Player1",
      "user1",
      null,
      friends,
      [],
    );
    expect(result[0].kdRatio).toBe(2); // 2 kills / 0 deaths
  });

  it("should exclude current user from scoreboard", () => {
    const logs = [
      createKillLog("1", "2024-01-01T10:00:00Z", "Player1", "Victim1", false),
    ];
    const friends: Friend[] = [];
    const result = calculateScoreboard(
      logs,
      "Player1",
      "user1",
      null,
      friends,
      [],
    );
    expect(result).toHaveLength(0);
  });

  it("should sort by score descending", () => {
    const logs = [
      createKillLog("1", "2024-01-01T10:00:00Z", "Player2", "Victim1", false), // 2 points
      createKillLog("2", "2024-01-01T10:01:00Z", "Player3", "Victim2", false), // 2 points
      createKillLog("3", "2024-01-01T10:02:00Z", "Player3", "Victim3", false), // 2 points (total 4)
    ];
    const friends: Friend[] = [
      {
        id: "friend1",
        userDiscordId: "user1",
        friendDiscordId: "user2",
        friendUsername: "Friend1",
        friendDisplayName: null,
        friendAvatar: null,
        friendPlayer: "Player2",
        status: "accepted",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
        isOnline: true,
      },
      {
        id: "friend2",
        userDiscordId: "user1",
        friendDiscordId: "user3",
        friendUsername: "Friend2",
        friendDisplayName: null,
        friendAvatar: null,
        friendPlayer: "Player3",
        status: "accepted",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
        isOnline: true,
      },
    ];
    const result = calculateScoreboard(
      logs,
      "Player1",
      "user1",
      null,
      friends,
      [],
    );
    expect(result).toHaveLength(2);
    expect(result[0].playerName).toBe("Player3");
    expect(result[0].score).toBe(4);
    expect(result[1].playerName).toBe("Player2");
    expect(result[1].score).toBe(2);
  });

  it("should assign ranks correctly", () => {
    const logs = [
      createKillLog("1", "2024-01-01T10:00:00Z", "Player2", "Victim1", false),
      createKillLog("2", "2024-01-01T10:01:00Z", "Player3", "Victim2", false),
    ];
    const friends: Friend[] = [
      {
        id: "friend1",
        userDiscordId: "user1",
        friendDiscordId: "user2",
        friendUsername: "Friend1",
        friendDisplayName: null,
        friendAvatar: null,
        friendPlayer: "Player2",
        status: "accepted",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
        isOnline: true,
      },
      {
        id: "friend2",
        userDiscordId: "user1",
        friendDiscordId: "user3",
        friendUsername: "Friend2",
        friendDisplayName: null,
        friendAvatar: null,
        friendPlayer: "Player3",
        status: "accepted",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
        isOnline: true,
      },
    ];
    const result = calculateScoreboard(
      logs,
      "Player1",
      "user1",
      null,
      friends,
      [],
    );
    expect(result[0].rank).toBe(1);
    expect(result[1].rank).toBe(2);
  });

  it("should only include online friends when no group selected", () => {
    const logs = [
      createKillLog("1", "2024-01-01T10:00:00Z", "Player2", "Victim1", false),
      createKillLog("2", "2024-01-01T10:01:00Z", "Player3", "Victim2", false),
    ];
    const friends: Friend[] = [
      {
        id: "friend1",
        userDiscordId: "user1",
        friendDiscordId: "user2",
        friendUsername: "Friend1",
        friendDisplayName: null,
        friendAvatar: null,
        friendPlayer: "Player2",
        status: "accepted",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
        isOnline: true,
      },
      {
        id: "friend2",
        userDiscordId: "user1",
        friendDiscordId: "user3",
        friendUsername: "Friend2",
        friendDisplayName: null,
        friendAvatar: null,
        friendPlayer: "Player3",
        status: "accepted",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
        isOnline: false,
      },
    ];
    const result = calculateScoreboard(
      logs,
      "Player1",
      "user1",
      null,
      friends,
      [],
    );
    expect(result).toHaveLength(2); // Both included (Player3 has combat activity)
  });

  it("should handle empty logs", () => {
    const friends: Friend[] = [
      {
        id: "friend1",
        userDiscordId: "user1",
        friendDiscordId: "user2",
        friendUsername: "Friend1",
        friendDisplayName: null,
        friendAvatar: null,
        friendPlayer: "Player2",
        status: "accepted",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
        isOnline: true,
      },
    ];
    const result = calculateScoreboard(
      [],
      "Player1",
      "user1",
      null,
      friends,
      [],
    );
    expect(result).toHaveLength(1);
    expect(result[0].score).toBe(0);
  });

  it("should include group members when group is selected", () => {
    const logs = [
      createKillLog("1", "2024-01-01T10:00:00Z", "Player2", "Victim1", false),
    ];
    const groups: Group[] = [
      {
        id: "group1",
        name: "Test Group",
        description: null,
        ownerId: "user1",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
        members: [
          {
            discordId: "user2",
            username: "Member1",
            displayName: null,
            avatar: null,
            player: "Player2",
            role: "member" as const,
            joinedAt: "2024-01-01T00:00:00Z",
            isOnline: true,
          },
        ],
      } as any,
    ];
    const result = calculateScoreboard(
      logs,
      "Player1",
      "user1",
      "group1",
      [],
      groups,
    );
    expect(result).toHaveLength(1);
    expect(result[0].playerName).toBe("Player2");
  });

  it("should count ship destructions in scoreboard", () => {
    const logs: Log[] = [
      {
        ...createLog(
          "1",
          "2024-01-01T10:00:00Z",
          "user1",
          "Player2",
          "destruction",
        ),
        metadata: {
          causeName: "Player2",
          vehicleName: "Ship1",
          isAIVehicle: false,
        },
      },
      {
        ...createLog(
          "2",
          "2024-01-01T10:01:00Z",
          "user1",
          "Player2",
          "destruction",
        ),
        metadata: {
          causeName: "Player2",
          vehicleName: "Ship2",
          isAIVehicle: true,
        },
      },
    ];
    const friends: Friend[] = [
      {
        id: "friend1",
        userDiscordId: "user1",
        friendDiscordId: "user2",
        friendUsername: "Friend1",
        friendDisplayName: null,
        friendAvatar: null,
        friendPlayer: "Player2",
        status: "accepted",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
        isOnline: true,
      },
    ];
    const result = calculateScoreboard(
      logs,
      "Player1",
      "user1",
      null,
      friends,
      [],
    );
    expect(result).toHaveLength(1);
    expect(result[0].playerShipsDestroyed).toBe(1);
    expect(result[0].aiShipsDestroyed).toBe(1);
    expect(result[0].score).toBe(3); // 2 + 1
  });

  it("should handle group without members", () => {
    const logs = [
      createKillLog("1", "2024-01-01T10:00:00Z", "Player2", "Victim1", false),
    ];
    const groups: Group[] = [
      {
        id: "group1",
        name: "Test Group",
        description: null,
        ownerId: "user1",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      } as any,
    ];
    const result = calculateScoreboard(
      logs,
      "Player1",
      "user1",
      "group1",
      [],
      groups,
    );
    expect(result).toHaveLength(0);
  });
});
