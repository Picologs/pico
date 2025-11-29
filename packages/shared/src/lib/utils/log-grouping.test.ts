/**
 * Tests for log-grouping.ts
 * Comprehensive test coverage for log grouping functions
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { Log } from "@pico/types";
import {
  groupEquipmentEvents,
  groupInsuranceEvents,
  groupCrashDeathEvents,
  groupEnvironmentalHazards,
  groupInventoryRequests,
  groupKillingSprees,
  groupCrossPlayerEvents,
  getEventSignature,
  flattenGroups,
  processAllGroupings,
} from "./log-grouping";

// Helper to create a base log object
function createLog(overrides: Partial<Log> = {}): Log {
  return {
    id: `log-${Date.now()}-${Math.random()}`,
    userId: "user-123",
    player: "TestPlayer",
    reportedBy: ["TestPlayer"],
    emoji: "📝",
    line: "Test log line",
    timestamp: new Date().toISOString(),
    original: "Original log line",
    open: false,
    eventType: "unknown",
    ...overrides,
  };
}

// Helper to create timestamp with offset
function createTimestamp(baseTime: Date, offsetMs: number): string {
  return new Date(baseTime.getTime() + offsetMs).toISOString();
}

describe("groupEquipmentEvents", () => {
  const baseTime = new Date("2025-01-01T12:00:00Z");

  it("should group equipment events within 10-minute window", () => {
    const logs: Log[] = [
      createLog({
        id: "equip-1",
        eventType: "equipment_received",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 0),
        metadata: { attachmentName: "Rifle" },
      }),
      createLog({
        id: "equip-2",
        eventType: "equipment_equip",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 5 * 60 * 1000), // 5 minutes later
        metadata: { itemClass: "Armor" },
      }),
    ];

    const result = groupEquipmentEvents(logs);

    expect(result.length).toBe(1);
    expect(result[0].eventType).toBe("equipment_group");
    expect(result[0].children).toHaveLength(2);
    expect(result[0].metadata?.itemCount).toBe(2);
  });

  it("should not group equipment events outside 10-minute window", () => {
    const logs: Log[] = [
      createLog({
        id: "equip-1",
        eventType: "equipment_received",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 0),
      }),
      createLog({
        id: "equip-2",
        eventType: "equipment_equip",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 11 * 60 * 1000), // 11 minutes later
      }),
    ];

    const result = groupEquipmentEvents(logs);

    expect(result.length).toBe(2);
    expect(result[0].eventType).toBe("equipment_received");
    expect(result[1].eventType).toBe("equipment_equip");
  });

  it("should require minimum 2 items to form group", () => {
    const logs: Log[] = [
      createLog({
        id: "equip-1",
        eventType: "equipment_received",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 0),
      }),
    ];

    const result = groupEquipmentEvents(logs);

    expect(result.length).toBe(1);
    expect(result[0].eventType).toBe("equipment_received");
    expect(result[0].children).toBeUndefined();
  });

  it("should group only for same player", () => {
    const logs: Log[] = [
      createLog({
        id: "equip-1",
        eventType: "equipment_received",
        player: "Player1",
        timestamp: createTimestamp(baseTime, 0),
      }),
      createLog({
        id: "equip-2",
        eventType: "equipment_equip",
        player: "Player2",
        timestamp: createTimestamp(baseTime, 1000), // 1 second later
      }),
    ];

    const result = groupEquipmentEvents(logs);

    expect(result.length).toBe(2);
    expect(result[0].player).toBe("Player1");
    expect(result[1].player).toBe("Player2");
  });

  it("should pass through non-equipment events without grouping", () => {
    const logs: Log[] = [
      createLog({
        id: "equip-1",
        eventType: "equipment_received",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 0),
      }),
      createLog({
        id: "other-1",
        eventType: "actor_death",
        timestamp: createTimestamp(baseTime, 1000),
      }),
      createLog({
        id: "equip-2",
        eventType: "equipment_equip",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 2000),
      }),
    ];

    const result = groupEquipmentEvents(logs);

    expect(result.length).toBe(2);
    // Non-equipment events are passed through in place, so actor_death comes first
    expect(result[0].eventType).toBe("actor_death");
    expect(result[1].eventType).toBe("equipment_group");
  });

  it("should generate unique group IDs", () => {
    const logs: Log[] = [
      createLog({
        id: "equip-1",
        eventType: "equipment_received",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 0),
      }),
      createLog({
        id: "equip-2",
        eventType: "equipment_equip",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 1000),
      }),
    ];

    const result = groupEquipmentEvents(logs);

    expect(result[0].id).toMatch(/^group-equipment-\d+-[a-z0-9]+-\d+$/);
  });

  it("should generate different IDs when same logs are grouped multiple times", () => {
    const logs: Log[] = [
      createLog({
        id: "equip-1",
        eventType: "equipment_received",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 0),
      }),
      createLog({
        id: "equip-2",
        eventType: "equipment_equip",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 1000),
      }),
    ];

    // Group the same logs twice
    const result1 = groupEquipmentEvents([...logs]);
    const result2 = groupEquipmentEvents([...logs]);

    // Both should create groups with different IDs due to counter
    expect(result1.length).toBe(1);
    expect(result2.length).toBe(1);
    expect(result1[0].id).not.toBe(result2[0].id);
  });
});

describe("groupInsuranceEvents", () => {
  const baseTime = new Date("2025-01-01T12:00:00Z");

  it("should group insurance events within 2-minute window", () => {
    const logs: Log[] = [
      createLog({
        id: "insurance-1",
        eventType: "insurance_claim",
        timestamp: createTimestamp(baseTime, 0),
        metadata: { entitlementURN: "urn:claim:1" },
      }),
      createLog({
        id: "insurance-2",
        eventType: "insurance_claim",
        timestamp: createTimestamp(baseTime, 60 * 1000), // 1 minute later
        metadata: { entitlementURN: "urn:claim:2" },
      }),
    ];

    const result = groupInsuranceEvents(logs);

    expect(result.length).toBe(1);
    expect(result[0].eventType).toBe("insurance_group");
    expect(result[0].children).toHaveLength(2);
    expect(result[0].metadata?.claimCount).toBe(2);
  });

  it("should not group insurance events outside 2-minute window", () => {
    const logs: Log[] = [
      createLog({
        id: "insurance-1",
        eventType: "insurance_claim",
        timestamp: createTimestamp(baseTime, 0),
      }),
      createLog({
        id: "insurance-2",
        eventType: "insurance_claim",
        timestamp: createTimestamp(baseTime, 3 * 60 * 1000), // 3 minutes later
      }),
    ];

    const result = groupInsuranceEvents(logs);

    expect(result.length).toBe(2);
    expect(result[0].eventType).toBe("insurance_claim");
    expect(result[1].eventType).toBe("insurance_claim");
  });

  it("should require minimum 2 claims to form group", () => {
    const logs: Log[] = [
      createLog({
        id: "insurance-1",
        eventType: "insurance_claim",
        timestamp: createTimestamp(baseTime, 0),
      }),
    ];

    const result = groupInsuranceEvents(logs);

    expect(result.length).toBe(1);
    expect(result[0].eventType).toBe("insurance_claim");
    expect(result[0].children).toBeUndefined();
  });

  it("should pass through non-insurance events", () => {
    const logs: Log[] = [
      createLog({
        id: "insurance-1",
        eventType: "insurance_claim",
        timestamp: createTimestamp(baseTime, 0),
      }),
      createLog({
        id: "other-1",
        eventType: "actor_death",
        timestamp: createTimestamp(baseTime, 1000),
      }),
      createLog({
        id: "insurance-2",
        eventType: "insurance_claim",
        timestamp: createTimestamp(baseTime, 2000),
      }),
    ];

    const result = groupInsuranceEvents(logs);

    expect(result.length).toBe(2);
    // Non-insurance events are passed through in place, so actor_death comes first
    expect(result[0].eventType).toBe("actor_death");
    expect(result[1].eventType).toBe("insurance_group");
  });

  it("should collect entitlement URNs in metadata", () => {
    const logs: Log[] = [
      createLog({
        id: "insurance-1",
        eventType: "insurance_claim",
        timestamp: createTimestamp(baseTime, 0),
        metadata: { entitlementURN: "urn:claim:1" },
      }),
      createLog({
        id: "insurance-2",
        eventType: "insurance_claim",
        timestamp: createTimestamp(baseTime, 1000),
        metadata: { entitlementURN: "urn:claim:2" },
      }),
    ];

    const result = groupInsuranceEvents(logs);

    expect(result[0].metadata?.entitlements).toEqual([
      "urn:claim:1",
      "urn:claim:2",
    ]);
  });
});

describe("groupCrashDeathEvents", () => {
  const baseTime = new Date("2025-01-01T12:00:00Z");

  it("should group fatal_collision + exit + death within 30 seconds", () => {
    const logs: Log[] = [
      createLog({
        id: "crash-1",
        eventType: "fatal_collision",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 0),
        metadata: {
          vehicleName: "C2_Hercules_1234",
          hitEntity: "asteroid",
          part: "wing",
        },
      }),
      createLog({
        id: "exit-1",
        eventType: "vehicle_control_flow",
        timestamp: createTimestamp(baseTime, 5000), // 5 seconds later
        metadata: {
          action: "releasing",
          vehicleName: "C2_Hercules_1234",
        },
      }),
      createLog({
        id: "death-1",
        eventType: "actor_death",
        timestamp: createTimestamp(baseTime, 10000), // 10 seconds later
        metadata: {
          deathCause: "vehicle_destruction",
          zone: "C2_Hercules_1234",
          victimName: "TestPlayer",
        },
      }),
    ];

    const result = groupCrashDeathEvents(logs);

    expect(result.length).toBe(1);
    expect(result[0].eventType).toBe("crash_death_group");
    expect(result[0].children).toHaveLength(3);
    expect(result[0].emoji).toBe("💥");
    expect(result[0].line).toContain("died when their");
    expect(result[0].line).toContain("crashed into");
  });

  it("should not group if missing exit event", () => {
    const logs: Log[] = [
      createLog({
        id: "crash-1",
        eventType: "fatal_collision",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 0),
        metadata: {
          vehicleName: "C2_Hercules_1234",
          hitEntity: "asteroid",
        },
      }),
      createLog({
        id: "death-1",
        eventType: "actor_death",
        timestamp: createTimestamp(baseTime, 5000),
        metadata: {
          deathCause: "vehicle_destruction",
          zone: "C2_Hercules_1234",
          victimName: "TestPlayer",
        },
      }),
    ];

    const result = groupCrashDeathEvents(logs);

    expect(result.length).toBe(2);
    expect(result[0].eventType).toBe("fatal_collision");
    expect(result[1].eventType).toBe("actor_death");
  });

  it("should not group if missing death event", () => {
    const logs: Log[] = [
      createLog({
        id: "crash-1",
        eventType: "fatal_collision",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 0),
        metadata: {
          vehicleName: "C2_Hercules_1234",
          hitEntity: "asteroid",
        },
      }),
      createLog({
        id: "exit-1",
        eventType: "vehicle_control_flow",
        timestamp: createTimestamp(baseTime, 5000),
        metadata: {
          action: "releasing",
          vehicleName: "C2_Hercules_1234",
        },
      }),
    ];

    const result = groupCrashDeathEvents(logs);

    expect(result.length).toBe(2);
    expect(result[0].eventType).toBe("fatal_collision");
    expect(result[1].eventType).toBe("vehicle_control_flow");
  });

  it("should not group events outside 30-second window", () => {
    const logs: Log[] = [
      createLog({
        id: "crash-1",
        eventType: "fatal_collision",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 0),
        metadata: {
          vehicleName: "C2_Hercules_1234",
          hitEntity: "asteroid",
        },
      }),
      createLog({
        id: "exit-1",
        eventType: "vehicle_control_flow",
        timestamp: createTimestamp(baseTime, 35000), // 35 seconds later
        metadata: {
          action: "releasing",
          vehicleName: "C2_Hercules_1234",
        },
      }),
    ];

    const result = groupCrashDeathEvents(logs);

    expect(result.length).toBe(2);
    expect(result[0].eventType).toBe("fatal_collision");
    expect(result[1].eventType).toBe("vehicle_control_flow");
  });

  it("should match events by vehicle name", () => {
    const logs: Log[] = [
      createLog({
        id: "crash-1",
        eventType: "fatal_collision",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 0),
        metadata: {
          vehicleName: "C2_Hercules_1234",
          hitEntity: "asteroid",
        },
      }),
      createLog({
        id: "exit-wrong",
        eventType: "vehicle_control_flow",
        timestamp: createTimestamp(baseTime, 5000),
        metadata: {
          action: "releasing",
          vehicleName: "Different_Ship_5678", // Wrong ship
        },
      }),
      createLog({
        id: "death-1",
        eventType: "actor_death",
        timestamp: createTimestamp(baseTime, 10000),
        metadata: {
          deathCause: "vehicle_destruction",
          zone: "C2_Hercules_1234",
          victimName: "TestPlayer",
        },
      }),
    ];

    const result = groupCrashDeathEvents(logs);

    // Should not group because exit is for different vehicle
    expect(result.length).toBe(3);
    expect(result[0].eventType).toBe("fatal_collision");
  });

  it("should match death by player name and vehicle", () => {
    const logs: Log[] = [
      createLog({
        id: "crash-1",
        eventType: "fatal_collision",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 0),
        metadata: {
          vehicleName: "C2_Hercules_1234",
          hitEntity: "asteroid",
        },
      }),
      createLog({
        id: "exit-1",
        eventType: "vehicle_control_flow",
        timestamp: createTimestamp(baseTime, 5000),
        metadata: {
          action: "releasing",
          vehicleName: "C2_Hercules_1234",
        },
      }),
      createLog({
        id: "death-wrong",
        eventType: "actor_death",
        timestamp: createTimestamp(baseTime, 10000),
        metadata: {
          deathCause: "vehicle_destruction",
          zone: "C2_Hercules_1234",
          victimName: "DifferentPlayer", // Wrong player
        },
      }),
    ];

    const result = groupCrashDeathEvents(logs);

    // Should not group because death is for different player
    expect(result.length).toBe(3);
    expect(result[0].eventType).toBe("fatal_collision");
  });
});

describe("groupEnvironmentalHazards", () => {
  const baseTime = new Date("2025-01-01T12:00:00Z");

  it("should group environmental hazards within 1-minute window", () => {
    const logs: Log[] = [
      createLog({
        id: "hazard-1",
        eventType: "environmental_hazard",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 0),
        metadata: { hazardType: "suffocation", hazardState: "start" },
      }),
      createLog({
        id: "hazard-2",
        eventType: "environmental_hazard",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 30000), // 30 seconds later
        metadata: { hazardType: "depressurization", hazardState: "active" },
      }),
    ];

    const result = groupEnvironmentalHazards(logs);

    expect(result.length).toBe(1);
    expect(result[0].eventType).toBe("environmental_hazard_group");
    expect(result[0].children).toHaveLength(2);
    expect(result[0].metadata?.hazardCount).toBe(2);
  });

  it("should not group hazards outside 1-minute window", () => {
    const logs: Log[] = [
      createLog({
        id: "hazard-1",
        eventType: "environmental_hazard",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 0),
      }),
      createLog({
        id: "hazard-2",
        eventType: "environmental_hazard",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 70000), // 70 seconds later
      }),
    ];

    const result = groupEnvironmentalHazards(logs);

    expect(result.length).toBe(2);
  });

  it("should group only for same player", () => {
    const logs: Log[] = [
      createLog({
        id: "hazard-1",
        eventType: "environmental_hazard",
        player: "Player1",
        timestamp: createTimestamp(baseTime, 0),
      }),
      createLog({
        id: "hazard-2",
        eventType: "environmental_hazard",
        player: "Player2",
        timestamp: createTimestamp(baseTime, 5000),
      }),
    ];

    const result = groupEnvironmentalHazards(logs);

    expect(result.length).toBe(2);
  });

  it("should collect unique hazard types", () => {
    const logs: Log[] = [
      createLog({
        id: "hazard-1",
        eventType: "environmental_hazard",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 0),
        metadata: { hazardType: "suffocation" },
      }),
      createLog({
        id: "hazard-2",
        eventType: "environmental_hazard",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 5000),
        metadata: { hazardType: "suffocation" },
      }),
      createLog({
        id: "hazard-3",
        eventType: "environmental_hazard",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 10000),
        metadata: { hazardType: "depressurization" },
      }),
    ];

    const result = groupEnvironmentalHazards(logs);

    expect(result[0].metadata?.hazardTypes).toEqual([
      "suffocation",
      "depressurization",
    ]);
  });
});

describe("groupInventoryRequests", () => {
  const baseTime = new Date("2025-01-01T12:00:00Z");

  it("should group inventory requests within 10-minute window", () => {
    const logs: Log[] = [
      createLog({
        id: "inv-1",
        eventType: "location_change",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 0),
        metadata: { location: "hab_container" },
      }),
      createLog({
        id: "inv-2",
        eventType: "location_change",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 5 * 60 * 1000), // 5 minutes later
        metadata: { location: "hab_container" },
      }),
    ];

    const result = groupInventoryRequests(logs);

    expect(result.length).toBe(1);
    expect(result[0].eventType).toBe("inventory_group");
    expect(result[0].children).toHaveLength(2);
    expect(result[0].metadata?.requestCount).toBe(2);
  });

  it("should not group requests for different locations", () => {
    const logs: Log[] = [
      createLog({
        id: "inv-1",
        eventType: "location_change",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 0),
        metadata: { location: "hab_container" },
      }),
      createLog({
        id: "inv-2",
        eventType: "location_change",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 1000),
        metadata: { location: "ship_cargo" },
      }),
    ];

    const result = groupInventoryRequests(logs);

    expect(result.length).toBe(2);
  });

  it("should format location names in metadata", () => {
    const logs: Log[] = [
      createLog({
        id: "inv-1",
        eventType: "location_change",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 0),
        metadata: { location: "hab_container_storage" },
      }),
      createLog({
        id: "inv-2",
        eventType: "location_change",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 1000),
        metadata: { location: "hab_container_storage" },
      }),
    ];

    const result = groupInventoryRequests(logs);

    expect(result[0].metadata?.formattedLocation).toBe("hab container storage");
  });
});

describe("groupKillingSprees", () => {
  const baseTime = new Date("2025-01-01T12:00:00Z");

  it("should group 3+ kills within 5 minutes", () => {
    const logs: Log[] = [
      createLog({
        id: "kill-1",
        eventType: "actor_death",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 0),
        metadata: { killerName: "TestPlayer", victimName: "Enemy1" },
      }),
      createLog({
        id: "kill-2",
        eventType: "actor_death",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 60000), // 1 minute later
        metadata: { killerName: "TestPlayer", victimName: "Enemy2" },
      }),
      createLog({
        id: "kill-3",
        eventType: "actor_death",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 120000), // 2 minutes later
        metadata: { killerName: "TestPlayer", victimName: "Enemy3" },
      }),
    ];

    const result = groupKillingSprees(logs);

    expect(result.length).toBe(1);
    expect(result[0].eventType).toBe("killing_spree");
    expect(result[0].children).toHaveLength(3);
    expect(result[0].emoji).toBe("🔥");
    expect(result[0].line).toContain("3-kill spree");
  });

  it("should not group 2 or fewer kills", () => {
    const logs: Log[] = [
      createLog({
        id: "kill-1",
        eventType: "actor_death",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 0),
        metadata: { killerName: "TestPlayer", victimName: "Enemy1" },
      }),
      createLog({
        id: "kill-2",
        eventType: "actor_death",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 60000),
        metadata: { killerName: "TestPlayer", victimName: "Enemy2" },
      }),
    ];

    const result = groupKillingSprees(logs);

    expect(result.length).toBe(2);
    expect(result[0].eventType).toBe("actor_death");
    expect(result[1].eventType).toBe("actor_death");
  });

  it("should reset spree after 5-minute timeout", () => {
    const logs: Log[] = [
      createLog({
        id: "kill-1",
        eventType: "actor_death",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 0),
        metadata: { killerName: "TestPlayer", victimName: "Enemy1" },
      }),
      createLog({
        id: "kill-2",
        eventType: "actor_death",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 60000),
        metadata: { killerName: "TestPlayer", victimName: "Enemy2" },
      }),
      createLog({
        id: "kill-3",
        eventType: "actor_death",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 6 * 60 * 1000 + 1000), // Just over 5 minutes from kill-2
        metadata: { killerName: "TestPlayer", victimName: "Enemy3" },
      }),
    ];

    const result = groupKillingSprees(logs);

    // First two kills stay separate (not enough for spree), third is standalone
    expect(result.length).toBe(3);
    expect(result[0].eventType).toBe("actor_death");
    expect(result[1].eventType).toBe("actor_death");
    expect(result[2].eventType).toBe("actor_death");
  });

  it("should only count kills where player is the killer", () => {
    const logs: Log[] = [
      createLog({
        id: "kill-1",
        eventType: "actor_death",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 0),
        metadata: { killerName: "TestPlayer", victimName: "Enemy1" },
      }),
      createLog({
        id: "death-1",
        eventType: "actor_death",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 30000),
        metadata: { killerName: "Enemy", victimName: "TestPlayer" },
      }),
      createLog({
        id: "kill-2",
        eventType: "actor_death",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 60000),
        metadata: { killerName: "TestPlayer", victimName: "Enemy2" },
      }),
    ];

    const result = groupKillingSprees(logs);

    expect(result.length).toBe(3);
    expect(result[1].eventType).toBe("actor_death");
  });

  it("should collect victim names in metadata", () => {
    const logs: Log[] = [
      createLog({
        id: "kill-1",
        eventType: "actor_death",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 0),
        metadata: { killerName: "TestPlayer", victimName: "Enemy1" },
      }),
      createLog({
        id: "kill-2",
        eventType: "actor_death",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 60000),
        metadata: { killerName: "TestPlayer", victimName: "Enemy2" },
      }),
      createLog({
        id: "kill-3",
        eventType: "actor_death",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 120000),
        metadata: { killerName: "TestPlayer", victimName: "Enemy3" },
      }),
    ];

    const result = groupKillingSprees(logs);

    expect(result[0].metadata?.victims).toEqual(["Enemy1", "Enemy2", "Enemy3"]);
  });
});

describe("flattenGroups", () => {
  it("should extract children from grouped logs", () => {
    const child1 = createLog({
      id: "child-1",
      eventType: "equipment_received",
    });
    const child2 = createLog({ id: "child-2", eventType: "equipment_equip" });
    const groupLog = createLog({
      id: "group-1",
      eventType: "equipment_group",
      children: [child1, child2],
    });

    const result = flattenGroups([groupLog]);

    expect(result.length).toBe(2);
    expect(result[0].id).toBe("child-1");
    expect(result[1].id).toBe("child-2");
  });

  it("should pass through non-grouped logs", () => {
    const log1 = createLog({ id: "log-1", eventType: "actor_death" });
    const log2 = createLog({ id: "log-2", eventType: "connection" });

    const result = flattenGroups([log1, log2]);

    expect(result.length).toBe(2);
    expect(result[0].id).toBe("log-1");
    expect(result[1].id).toBe("log-2");
  });

  it("should handle mixed grouped and non-grouped logs", () => {
    const child1 = createLog({ id: "child-1" });
    const child2 = createLog({ id: "child-2" });
    const groupLog = createLog({
      id: "group-1",
      children: [child1, child2],
    });
    const standalone = createLog({ id: "standalone-1" });

    const result = flattenGroups([groupLog, standalone]);

    expect(result.length).toBe(3);
    expect(result[0].id).toBe("child-1");
    expect(result[1].id).toBe("child-2");
    expect(result[2].id).toBe("standalone-1");
  });

  it("should handle empty children array", () => {
    const groupLog = createLog({
      id: "group-1",
      children: [],
    });

    const result = flattenGroups([groupLog]);

    expect(result.length).toBe(1);
    expect(result[0].id).toBe("group-1");
  });
});

describe("processAllGroupings", () => {
  const baseTime = new Date("2025-01-01T12:00:00Z");

  it("should process all grouping types in single pass", () => {
    const logs: Log[] = [
      // Equipment events
      createLog({
        id: "equip-1",
        eventType: "equipment_received",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 0),
      }),
      createLog({
        id: "equip-2",
        eventType: "equipment_equip",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 1000),
      }),
      // Insurance events
      createLog({
        id: "insurance-1",
        eventType: "insurance_claim",
        timestamp: createTimestamp(baseTime, 10000),
      }),
      createLog({
        id: "insurance-2",
        eventType: "insurance_claim",
        timestamp: createTimestamp(baseTime, 11000),
      }),
      // Killing spree
      createLog({
        id: "kill-1",
        eventType: "actor_death",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 20000),
        metadata: { killerName: "TestPlayer", victimName: "Enemy1" },
      }),
      createLog({
        id: "kill-2",
        eventType: "actor_death",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 21000),
        metadata: { killerName: "TestPlayer", victimName: "Enemy2" },
      }),
      createLog({
        id: "kill-3",
        eventType: "actor_death",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 22000),
        metadata: { killerName: "TestPlayer", victimName: "Enemy3" },
      }),
    ];

    const result = processAllGroupings(logs);

    // Should create 3 groups (equipment, insurance, killing spree)
    expect(result.length).toBe(3);
    expect(result.some((log) => log.eventType === "equipment_group")).toBe(
      true,
    );
    expect(result.some((log) => log.eventType === "insurance_group")).toBe(
      true,
    );
    expect(result.some((log) => log.eventType === "killing_spree")).toBe(true);
  });

  it("should handle empty input", () => {
    const result = processAllGroupings([]);
    expect(result.length).toBe(0);
  });

  it("should handle logs with no groupable events", () => {
    const logs: Log[] = [
      createLog({
        id: "log-1",
        eventType: "connection",
        timestamp: createTimestamp(baseTime, 0),
      }),
      createLog({
        id: "log-2",
        eventType: "disconnection",
        timestamp: createTimestamp(baseTime, 1000),
      }),
    ];

    const result = processAllGroupings(logs);

    expect(result.length).toBe(2);
    expect(result[0].eventType).toBe("connection");
    expect(result[1].eventType).toBe("disconnection");
  });

  it("should maintain chronological order", () => {
    const logs: Log[] = [
      createLog({
        id: "log-1",
        eventType: "equipment_received",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 0),
      }),
      createLog({
        id: "log-2",
        eventType: "connection",
        timestamp: createTimestamp(baseTime, 500),
      }),
      createLog({
        id: "log-3",
        eventType: "equipment_equip",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 1000),
      }),
      createLog({
        id: "log-4",
        eventType: "disconnection",
        timestamp: createTimestamp(baseTime, 1500),
      }),
    ];

    const result = processAllGroupings(logs);

    // Check timestamps are in order
    for (let i = 1; i < result.length; i++) {
      const prevTime = new Date(result[i - 1].timestamp).getTime();
      const currTime = new Date(result[i].timestamp).getTime();
      expect(currTime).toBeGreaterThanOrEqual(prevTime);
    }
  });

  it("should not duplicate logs", () => {
    const logs: Log[] = [
      createLog({
        id: "equip-1",
        eventType: "equipment_received",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 0),
      }),
      createLog({
        id: "equip-2",
        eventType: "equipment_equip",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 1000),
      }),
    ];

    const result = processAllGroupings(logs);

    // Should have 1 group (not 2 individual logs + 1 group)
    expect(result.length).toBe(1);
    expect(result[0].eventType).toBe("equipment_group");
  });

  it("should handle mission events grouped by ID", () => {
    const logs: Log[] = [
      createLog({
        id: "mission-1",
        eventType: "mission_shared",
        timestamp: createTimestamp(baseTime, 0),
        metadata: { missionId: "mission-abc-123" },
      }),
      createLog({
        id: "mission-2",
        eventType: "mission_objective",
        timestamp: createTimestamp(baseTime, 10000),
        metadata: {
          missionId: "mission-abc-123",
          objectiveState: "INPROGRESS",
        },
      }),
      createLog({
        id: "mission-3",
        eventType: "mission_ended",
        timestamp: createTimestamp(baseTime, 20000),
        metadata: { missionId: "mission-abc-123", completionType: "Complete" },
      }),
    ];

    const result = processAllGroupings(logs);

    expect(result.length).toBe(1);
    expect(result[0].eventType).toBe("mission_group");
    expect(result[0].children).toHaveLength(3);
  });

  it("should handle quantum travel events", () => {
    const logs: Log[] = [
      createLog({
        id: "qt-1",
        eventType: "quantum_travel",
        timestamp: createTimestamp(baseTime, 0),
        metadata: { qtStateFrom: "ready", qtStateTo: "spooling" },
      }),
      createLog({
        id: "qt-2",
        eventType: "quantum_travel",
        timestamp: createTimestamp(baseTime, 5000),
        metadata: { qtStateFrom: "spooling", qtStateTo: "active" },
      }),
    ];

    const result = processAllGroupings(logs);

    expect(result.length).toBe(1);
    expect(result[0].eventType).toBe("quantum_travel_group");
  });

  it("should handle respawn events", () => {
    const logs: Log[] = [
      createLog({
        id: "respawn-1",
        eventType: "hospital_respawn",
        timestamp: createTimestamp(baseTime, 0),
        metadata: { bedId: "hospital-bed-1" },
      }),
      createLog({
        id: "respawn-2",
        eventType: "medical_bed",
        timestamp: createTimestamp(baseTime, 10000),
        metadata: { bedId: "medical-bed-1" },
      }),
    ];

    const result = processAllGroupings(logs);

    expect(result.length).toBe(1);
    expect(result[0].eventType).toBe("respawn_group");
  });

  it("should not produce duplicate keys in output", () => {
    const logs: Log[] = [
      // Equipment group 1
      createLog({
        id: "equip-1",
        eventType: "equipment_received",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 0),
      }),
      createLog({
        id: "equip-2",
        eventType: "equipment_equip",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 1000),
      }),
      // Equipment group 2 (after timeout)
      createLog({
        id: "equip-3",
        eventType: "equipment_received",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 15 * 60 * 1000),
      }),
      createLog({
        id: "equip-4",
        eventType: "equipment_equip",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 15 * 60 * 1000 + 1000),
      }),
    ];

    const result = processAllGroupings(logs);

    // Collect all IDs
    const ids = result.map((log) => log.id);
    const uniqueIds = new Set(ids);

    // All IDs should be unique
    expect(ids.length).toBe(uniqueIds.size);
  });

  it("should handle flatten and regroup without ID collisions", () => {
    const logs: Log[] = [
      createLog({
        id: "equip-1",
        eventType: "equipment_received",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 0),
      }),
      createLog({
        id: "equip-2",
        eventType: "equipment_equip",
        player: "TestPlayer",
        timestamp: createTimestamp(baseTime, 1000),
      }),
    ];

    // First grouping
    const grouped1 = processAllGroupings(logs);
    expect(grouped1.length).toBe(1);
    const id1 = grouped1[0].id;

    // Flatten
    const flattened = flattenGroups(grouped1);
    expect(flattened.length).toBe(2);

    // Regroup
    const grouped2 = processAllGroupings(flattened);
    expect(grouped2.length).toBe(1);
    const id2 = grouped2[0].id;

    // IDs should be different due to counter
    expect(id1).not.toBe(id2);
  });
});

describe("getEventSignature", () => {
  it("should return signature for destruction events", () => {
    const log = createLog({
      eventType: "destruction",
      metadata: { vehicleName: "C2_Hercules_1234" },
    });

    const signature = getEventSignature(log);
    expect(signature).toBe("destruction:C2_Hercules_1234");
  });

  it("should return signature for actor_death events", () => {
    const log = createLog({
      eventType: "actor_death",
      metadata: {
        victimName: "TestPlayer",
        zone: "Area18",
        deathCause: "explosion",
      },
    });

    const signature = getEventSignature(log);
    expect(signature).toBe("actor_death:TestPlayer:Area18:explosion");
  });

  it("should return null for non-observable events", () => {
    const log = createLog({
      eventType: "equipment_received",
      metadata: { attachmentName: "Rifle" },
    });

    const signature = getEventSignature(log);
    expect(signature).toBeNull();
  });

  it("should return null if missing required metadata", () => {
    const log = createLog({
      eventType: "destruction",
      metadata: {}, // Missing vehicleName
    });

    const signature = getEventSignature(log);
    expect(signature).toBeNull();
  });

  it("should return signature for mission events", () => {
    const log = createLog({
      eventType: "mission_completed",
      metadata: { missionId: "mission-123" },
    });

    const signature = getEventSignature(log);
    expect(signature).toBe("mission_completed:mission-123");
  });

  it("should return signature for quantum_arrival events with vehicleId", () => {
    const log = createLog({
      eventType: "quantum_arrival",
      metadata: { vehicleName: "Aegis Idris P", vehicleId: "12345" },
    });

    const signature = getEventSignature(log);
    expect(signature).toBe("quantum_arrival:Aegis Idris P:12345");
  });

  it("should return null for quantum_arrival without vehicleId", () => {
    const log = createLog({
      eventType: "quantum_arrival",
      metadata: { vehicleName: "Aegis Idris P" }, // Missing vehicleId
    });

    const signature = getEventSignature(log);
    expect(signature).toBeNull();
  });
});

describe("groupCrossPlayerEvents", () => {
  const baseTime = new Date("2025-01-01T12:00:00Z");

  it("should group same events from different players within 5-second window", () => {
    const logs: Log[] = [
      createLog({
        id: "death-1",
        userId: "user-1",
        eventType: "destruction",
        timestamp: createTimestamp(baseTime, 0),
        metadata: { vehicleName: "C2_Hercules_1234" },
      }),
      createLog({
        id: "death-2",
        userId: "user-2",
        eventType: "destruction",
        timestamp: createTimestamp(baseTime, 2000), // 2 seconds later
        metadata: { vehicleName: "C2_Hercules_1234" },
      }),
    ];

    const result = groupCrossPlayerEvents(logs);

    expect(result.length).toBe(1);
    expect(result[0].eventType).toBe("cross_player_group");
    expect(result[0].children).toHaveLength(2);
    expect(result[0].metadata?.playerCount).toBe(2);
    expect(result[0].metadata?.userIds).toEqual(["user-1", "user-2"]);
  });

  it("should not group events outside 5-second window", () => {
    const logs: Log[] = [
      createLog({
        id: "death-1",
        userId: "user-1",
        eventType: "destruction",
        timestamp: createTimestamp(baseTime, 0),
        metadata: { vehicleName: "C2_Hercules_1234" },
      }),
      createLog({
        id: "death-2",
        userId: "user-2",
        eventType: "destruction",
        timestamp: createTimestamp(baseTime, 6000), // 6 seconds later
        metadata: { vehicleName: "C2_Hercules_1234" },
      }),
    ];

    const result = groupCrossPlayerEvents(logs);

    expect(result.length).toBe(2);
    expect(result[0].eventType).toBe("destruction");
    expect(result[1].eventType).toBe("destruction");
  });

  it("should require at least 2 different users to form group", () => {
    const logs: Log[] = [
      createLog({
        id: "death-1",
        userId: "user-1",
        eventType: "destruction",
        timestamp: createTimestamp(baseTime, 0),
        metadata: { vehicleName: "C2_Hercules_1234" },
      }),
      createLog({
        id: "death-2",
        userId: "user-1", // Same user
        eventType: "destruction",
        timestamp: createTimestamp(baseTime, 1000),
        metadata: { vehicleName: "C2_Hercules_1234" },
      }),
    ];

    const result = groupCrossPlayerEvents(logs);

    // Should not group since it's the same user
    expect(result.length).toBe(2);
    expect(result[0].eventType).toBe("destruction");
  });

  it("should not group different events", () => {
    const logs: Log[] = [
      createLog({
        id: "death-1",
        userId: "user-1",
        eventType: "destruction",
        timestamp: createTimestamp(baseTime, 0),
        metadata: { vehicleName: "Ship_A" },
      }),
      createLog({
        id: "death-2",
        userId: "user-2",
        eventType: "destruction",
        timestamp: createTimestamp(baseTime, 1000),
        metadata: { vehicleName: "Ship_B" }, // Different ship
      }),
    ];

    const result = groupCrossPlayerEvents(logs);

    expect(result.length).toBe(2);
  });

  it("should group actor_death events by victim", () => {
    const logs: Log[] = [
      createLog({
        id: "death-1",
        userId: "user-1",
        player: "Player1",
        eventType: "actor_death",
        timestamp: createTimestamp(baseTime, 0),
        metadata: {
          victimName: "VictimPlayer",
          zone: "Area18",
          deathCause: "explosion",
        },
      }),
      createLog({
        id: "death-2",
        userId: "user-2",
        player: "Player2",
        eventType: "actor_death",
        timestamp: createTimestamp(baseTime, 1000),
        metadata: {
          victimName: "VictimPlayer",
          zone: "Area18",
          deathCause: "explosion",
        },
      }),
    ];

    const result = groupCrossPlayerEvents(logs);

    expect(result.length).toBe(1);
    expect(result[0].eventType).toBe("cross_player_group");
    expect(result[0].metadata?.originalEventType).toBe("actor_death");
  });

  it("should pass through non-observable events", () => {
    const logs: Log[] = [
      createLog({
        id: "equip-1",
        userId: "user-1",
        eventType: "equipment_received",
        timestamp: createTimestamp(baseTime, 0),
      }),
      createLog({
        id: "equip-2",
        userId: "user-2",
        eventType: "equipment_received",
        timestamp: createTimestamp(baseTime, 1000),
      }),
    ];

    const result = groupCrossPlayerEvents(logs);

    expect(result.length).toBe(2);
    expect(result[0].eventType).toBe("equipment_received");
  });

  it("should maintain chronological order", () => {
    const logs: Log[] = [
      createLog({
        id: "death-1",
        userId: "user-1",
        eventType: "destruction",
        timestamp: createTimestamp(baseTime, 0),
        metadata: { vehicleName: "Ship_A" },
      }),
      createLog({
        id: "other-1",
        userId: "user-3",
        eventType: "connection",
        timestamp: createTimestamp(baseTime, 500),
      }),
      createLog({
        id: "death-2",
        userId: "user-2",
        eventType: "destruction",
        timestamp: createTimestamp(baseTime, 1000),
        metadata: { vehicleName: "Ship_A" },
      }),
    ];

    const result = groupCrossPlayerEvents(logs);

    // Should have 2 items: cross_player_group and connection
    expect(result.length).toBe(2);

    // Check timestamps are in order
    for (let i = 1; i < result.length; i++) {
      const prevTime = new Date(result[i - 1].timestamp).getTime();
      const currTime = new Date(result[i].timestamp).getTime();
      expect(currTime).toBeGreaterThanOrEqual(prevTime);
    }
  });

  it("should group 3+ players witnessing same event", () => {
    const logs: Log[] = [
      createLog({
        id: "death-1",
        userId: "user-1",
        eventType: "destruction",
        timestamp: createTimestamp(baseTime, 0),
        metadata: { vehicleName: "Ship_A" },
      }),
      createLog({
        id: "death-2",
        userId: "user-2",
        eventType: "destruction",
        timestamp: createTimestamp(baseTime, 1000),
        metadata: { vehicleName: "Ship_A" },
      }),
      createLog({
        id: "death-3",
        userId: "user-3",
        eventType: "destruction",
        timestamp: createTimestamp(baseTime, 2000),
        metadata: { vehicleName: "Ship_A" },
      }),
      createLog({
        id: "death-4",
        userId: "user-4",
        eventType: "destruction",
        timestamp: createTimestamp(baseTime, 3000),
        metadata: { vehicleName: "Ship_A" },
      }),
      createLog({
        id: "death-5",
        userId: "user-5",
        eventType: "destruction",
        timestamp: createTimestamp(baseTime, 4000),
        metadata: { vehicleName: "Ship_A" },
      }),
    ];

    const result = groupCrossPlayerEvents(logs);

    expect(result.length).toBe(1);
    expect(result[0].eventType).toBe("cross_player_group");
    expect(result[0].children).toHaveLength(5);
    expect(result[0].metadata?.playerCount).toBe(5);
  });

  it("should generate unique group IDs", () => {
    const logs: Log[] = [
      createLog({
        id: "death-1",
        userId: "user-1",
        eventType: "destruction",
        timestamp: createTimestamp(baseTime, 0),
        metadata: { vehicleName: "Ship_A" },
      }),
      createLog({
        id: "death-2",
        userId: "user-2",
        eventType: "destruction",
        timestamp: createTimestamp(baseTime, 1000),
        metadata: { vehicleName: "Ship_A" },
      }),
    ];

    const result = groupCrossPlayerEvents(logs);

    expect(result[0].id).toMatch(/^group-cross-player-\d+-[a-z0-9]+-\d+$/);
  });

  it("should group quantum_arrival (ship spotted) events from different players", () => {
    const logs: Log[] = [
      createLog({
        id: "spotted-1",
        userId: "user-1",
        player: "space-man-rob",
        eventType: "quantum_arrival",
        emoji: "👀",
        line: "Aegis Idris P spotted nearby",
        timestamp: createTimestamp(baseTime, 0),
        metadata: { vehicleName: "Aegis Idris P", vehicleId: "12345" },
      }),
      createLog({
        id: "spotted-2",
        userId: "user-2",
        player: "Plamsa",
        eventType: "quantum_arrival",
        emoji: "👀",
        line: "Aegis Idris P spotted nearby",
        timestamp: createTimestamp(baseTime, 2000), // 2 seconds later
        metadata: { vehicleName: "Aegis Idris P", vehicleId: "12345" },
      }),
    ];

    const result = groupCrossPlayerEvents(logs);

    expect(result.length).toBe(1);
    expect(result[0].eventType).toBe("cross_player_group");
    expect(result[0].children).toHaveLength(2);
    expect(result[0].metadata?.playerCount).toBe(2);
    expect(result[0].metadata?.userIds).toEqual(["user-1", "user-2"]);
    expect(result[0].metadata?.originalEventType).toBe("quantum_arrival");
  });

  it("should not group different ships spotted by different players", () => {
    const logs: Log[] = [
      createLog({
        id: "spotted-1",
        userId: "user-1",
        eventType: "quantum_arrival",
        timestamp: createTimestamp(baseTime, 0),
        metadata: { vehicleName: "Aegis Idris P", vehicleId: "12345" },
      }),
      createLog({
        id: "spotted-2",
        userId: "user-2",
        eventType: "quantum_arrival",
        timestamp: createTimestamp(baseTime, 1000),
        metadata: { vehicleName: "Aegis Idris P", vehicleId: "67890" }, // Different ship instance
      }),
    ];

    const result = groupCrossPlayerEvents(logs);

    expect(result.length).toBe(2);
    expect(result[0].eventType).toBe("quantum_arrival");
    expect(result[1].eventType).toBe("quantum_arrival");
  });

  it("should group same ship spotted by 3+ players", () => {
    const logs: Log[] = [
      createLog({
        id: "spotted-1",
        userId: "user-1",
        player: "Player1",
        eventType: "quantum_arrival",
        timestamp: createTimestamp(baseTime, 0),
        metadata: { vehicleName: "Drake Kraken", vehicleId: "99999" },
      }),
      createLog({
        id: "spotted-2",
        userId: "user-2",
        player: "Player2",
        eventType: "quantum_arrival",
        timestamp: createTimestamp(baseTime, 1000),
        metadata: { vehicleName: "Drake Kraken", vehicleId: "99999" },
      }),
      createLog({
        id: "spotted-3",
        userId: "user-3",
        player: "Player3",
        eventType: "quantum_arrival",
        timestamp: createTimestamp(baseTime, 2000),
        metadata: { vehicleName: "Drake Kraken", vehicleId: "99999" },
      }),
    ];

    const result = groupCrossPlayerEvents(logs);

    expect(result.length).toBe(1);
    expect(result[0].eventType).toBe("cross_player_group");
    expect(result[0].children).toHaveLength(3);
    expect(result[0].metadata?.playerCount).toBe(3);
  });
});
