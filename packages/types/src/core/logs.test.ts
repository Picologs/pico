/**
 * Unit tests for log transformation functions
 *
 * Tests coverage:
 * - toLogTransmit: Convert Log to LogTransmit format
 * - fromLogTransmit: Convert LogTransmit back to Log format
 * - Round-trip transformations
 * - Edge cases: empty children, null values, deeply nested structures
 * - Different log event types
 */

import { describe, it, expect } from "vitest";
import {
  toLogTransmit,
  fromLogTransmit,
  type Log,
  type LogTransmit,
  type LogEventType,
  type LogMetadata,
} from "./log";

describe("Log Transformation Functions", () => {
  /**
   * Helper function to create a basic log entry
   */
  const createBasicLog = (overrides?: Partial<Log>): Log => ({
    id: "log-1",
    userId: "user-123",
    player: "Player One",
    emoji: "🚀",
    line: "Player One took off in a spaceship",
    timestamp: "2024-01-15T10:30:00Z",
    original: "Original raw log text",
    open: false,
    ...overrides,
  });

  /**
   * Helper function to create a log with metadata
   */
  const createLogWithMetadata = (metadata: LogMetadata): Log => ({
    ...createBasicLog(),
    eventType: "connection" as LogEventType,
    metadata,
  });

  // ============================================================================
  // BASIC TRANSFORMATION TESTS
  // ============================================================================

  describe("toLogTransmit - Basic Transformations", () => {
    it("should remove original and open fields", () => {
      const log = createBasicLog({
        original: "raw text",
        open: true,
      });

      const transmitted = toLogTransmit(log);

      expect(transmitted).not.toHaveProperty("original");
      expect(transmitted).not.toHaveProperty("open");
      expect(transmitted.id).toBe("log-1");
      expect(transmitted.userId).toBe("user-123");
    });

    it("should preserve core log fields", () => {
      const log = createBasicLog({
        id: "test-id",
        userId: "test-user",
        player: "Test Player",
        emoji: "💥",
        line: "Test line",
        timestamp: "2024-01-15T10:30:00Z",
      });

      const transmitted = toLogTransmit(log);

      expect(transmitted.id).toBe("test-id");
      expect(transmitted.userId).toBe("test-user");
      expect(transmitted.player).toBe("Test Player");
      expect(transmitted.emoji).toBe("💥");
      expect(transmitted.line).toBe("Test line");
      expect(transmitted.timestamp).toBe("2024-01-15T10:30:00Z");
    });

    it("should preserve reportedBy array", () => {
      const log = createBasicLog({
        reportedBy: ["user-1", "user-2", "user-3"],
      });

      const transmitted = toLogTransmit(log);

      expect(transmitted.reportedBy).toEqual(["user-1", "user-2", "user-3"]);
    });

    it("should preserve eventType field", () => {
      const log = createBasicLog({
        eventType: "actor_death" as LogEventType,
      });

      const transmitted = toLogTransmit(log);

      expect(transmitted.eventType).toBe("actor_death");
    });

    it("should preserve metadata object", () => {
      const metadata: LogMetadata = {
        vehicleName: "Avenger",
        vehicleId: "v-123",
        team: "Squad One",
        victimName: "Enemy Player",
        zone: "Stanton System",
      };

      const log = createLogWithMetadata(metadata);
      const transmitted = toLogTransmit(log);

      expect(transmitted.metadata).toEqual(metadata);
    });

    it("should handle logs with null player", () => {
      const log = createBasicLog({
        player: null,
      });

      const transmitted = toLogTransmit(log);

      expect(transmitted.player).toBeNull();
    });
  });

  // ============================================================================
  // CHILDREN HANDLING TESTS
  // ============================================================================

  describe("toLogTransmit - Children Handling", () => {
    it("should not include children field when empty", () => {
      const log = createBasicLog({
        children: [],
      });

      const transmitted = toLogTransmit(log);

      expect(transmitted).not.toHaveProperty("children");
    });

    it("should not include children field when undefined", () => {
      const log = createBasicLog({
        children: undefined,
      });

      const transmitted = toLogTransmit(log);

      expect(transmitted).not.toHaveProperty("children");
    });

    it("should recursively transform single child", () => {
      const childLog = createBasicLog({
        id: "child-1",
        original: "child raw text",
        open: true,
      });

      const parentLog = createBasicLog({
        id: "parent-1",
        children: [childLog],
      });

      const transmitted = toLogTransmit(parentLog);

      expect(transmitted.children).toBeDefined();
      expect(transmitted.children).toHaveLength(1);
      expect(transmitted.children![0].id).toBe("child-1");
      expect(transmitted.children![0]).not.toHaveProperty("original");
      expect(transmitted.children![0]).not.toHaveProperty("open");
    });

    it("should recursively transform multiple children", () => {
      const child1 = createBasicLog({ id: "child-1" });
      const child2 = createBasicLog({ id: "child-2" });
      const child3 = createBasicLog({ id: "child-3" });

      const parentLog = createBasicLog({
        id: "parent-1",
        children: [child1, child2, child3],
      });

      const transmitted = toLogTransmit(parentLog);

      expect(transmitted.children).toHaveLength(3);
      expect(transmitted.children![0].id).toBe("child-1");
      expect(transmitted.children![1].id).toBe("child-2");
      expect(transmitted.children![2].id).toBe("child-3");
    });

    it("should handle deeply nested children (3 levels)", () => {
      const grandchildLog = createBasicLog({
        id: "grandchild-1",
        original: "grandchild raw",
        open: true,
      });

      const childLog = createBasicLog({
        id: "child-1",
        children: [grandchildLog],
      });

      const parentLog = createBasicLog({
        id: "parent-1",
        children: [childLog],
      });

      const transmitted = toLogTransmit(parentLog);

      expect(transmitted.children).toHaveLength(1);
      expect(transmitted.children![0].children).toHaveLength(1);
      expect(transmitted.children![0].children![0].id).toBe("grandchild-1");
      expect(transmitted.children![0].children![0]).not.toHaveProperty(
        "original",
      );
      expect(transmitted.children![0].children![0]).not.toHaveProperty("open");
    });

    it("should handle mixed nested and non-nested children", () => {
      const grandchild1 = createBasicLog({ id: "grandchild-1" });
      const grandchild2 = createBasicLog({ id: "grandchild-2" });

      const child1 = createBasicLog({
        id: "child-1",
        children: [grandchild1, grandchild2],
      });

      const child2 = createBasicLog({
        id: "child-2",
        children: [],
      });

      const parentLog = createBasicLog({
        id: "parent-1",
        children: [child1, child2],
      });

      const transmitted = toLogTransmit(parentLog);

      expect(transmitted.children).toHaveLength(2);
      expect(transmitted.children![0].children).toHaveLength(2);
      expect(transmitted.children![1]).not.toHaveProperty("children");
    });
  });

  // ============================================================================
  // fromLogTransmit - BASIC TRANSFORMATIONS
  // ============================================================================

  describe("fromLogTransmit - Basic Transformations", () => {
    it("should add default original and open fields", () => {
      const transmitted: LogTransmit = {
        id: "log-1",
        userId: "user-123",
        player: "Player One",
        emoji: "🚀",
        line: "Log line",
        timestamp: "2024-01-15T10:30:00Z",
      };

      const log = fromLogTransmit(transmitted);

      expect(log.original).toBe("");
      expect(log.open).toBe(false);
    });

    it("should use provided default values", () => {
      const transmitted: LogTransmit = {
        id: "log-1",
        userId: "user-123",
        player: "Player One",
        emoji: "🚀",
        line: "Log line",
        timestamp: "2024-01-15T10:30:00Z",
      };

      const log = fromLogTransmit(transmitted, {
        original: "custom original text",
        open: true,
      });

      expect(log.original).toBe("custom original text");
      expect(log.open).toBe(true);
    });

    it("should preserve all transmitted fields", () => {
      const transmitted: LogTransmit = {
        id: "test-id",
        userId: "test-user",
        player: "Test Player",
        emoji: "💥",
        line: "Test line",
        timestamp: "2024-01-15T10:30:00Z",
        eventType: "vehicle_control_flow" as LogEventType,
        reportedBy: ["user-1", "user-2"],
      };

      const log = fromLogTransmit(transmitted);

      expect(log.id).toBe("test-id");
      expect(log.userId).toBe("test-user");
      expect(log.player).toBe("Test Player");
      expect(log.emoji).toBe("💥");
      expect(log.line).toBe("Test line");
      expect(log.timestamp).toBe("2024-01-15T10:30:00Z");
      expect(log.eventType).toBe("vehicle_control_flow");
      expect(log.reportedBy).toEqual(["user-1", "user-2"]);
    });

    it("should handle null player field", () => {
      const transmitted: LogTransmit = {
        id: "log-1",
        userId: "user-123",
        player: null,
        emoji: "⚙️",
        line: "System log",
        timestamp: "2024-01-15T10:30:00Z",
      };

      const log = fromLogTransmit(transmitted);

      expect(log.player).toBeNull();
    });
  });

  // ============================================================================
  // fromLogTransmit - CHILDREN HANDLING
  // ============================================================================

  describe("fromLogTransmit - Children Handling", () => {
    it("should not create children field when not present", () => {
      const transmitted: LogTransmit = {
        id: "log-1",
        userId: "user-123",
        player: "Player",
        emoji: "🚀",
        line: "Log",
        timestamp: "2024-01-15T10:30:00Z",
      };

      const log = fromLogTransmit(transmitted);

      expect(log).not.toHaveProperty("children");
    });

    it("should not create children field when empty", () => {
      const transmitted: LogTransmit = {
        id: "log-1",
        userId: "user-123",
        player: "Player",
        emoji: "🚀",
        line: "Log",
        timestamp: "2024-01-15T10:30:00Z",
        children: [],
      };

      const log = fromLogTransmit(transmitted);

      expect(log).not.toHaveProperty("children");
    });

    it("should recursively restore single child", () => {
      const transmitted: LogTransmit = {
        id: "parent-1",
        userId: "user-123",
        player: "Player",
        emoji: "🚀",
        line: "Parent log",
        timestamp: "2024-01-15T10:30:00Z",
        children: [
          {
            id: "child-1",
            userId: "user-123",
            player: "Player",
            emoji: "💥",
            line: "Child log",
            timestamp: "2024-01-15T10:31:00Z",
          },
        ],
      };

      const log = fromLogTransmit(transmitted);

      expect(log.children).toBeDefined();
      expect(log.children).toHaveLength(1);
      expect(log.children![0].id).toBe("child-1");
      expect(log.children![0].original).toBe("");
      expect(log.children![0].open).toBe(false);
    });

    it("should recursively restore multiple children", () => {
      const transmitted: LogTransmit = {
        id: "parent-1",
        userId: "user-123",
        player: "Player",
        emoji: "🚀",
        line: "Parent log",
        timestamp: "2024-01-15T10:30:00Z",
        children: [
          {
            id: "child-1",
            userId: "user-123",
            player: "Player",
            emoji: "💥",
            line: "Child 1",
            timestamp: "2024-01-15T10:31:00Z",
          },
          {
            id: "child-2",
            userId: "user-123",
            player: "Player",
            emoji: "💥",
            line: "Child 2",
            timestamp: "2024-01-15T10:32:00Z",
          },
          {
            id: "child-3",
            userId: "user-123",
            player: "Player",
            emoji: "💥",
            line: "Child 3",
            timestamp: "2024-01-15T10:33:00Z",
          },
        ],
      };

      const log = fromLogTransmit(transmitted);

      expect(log.children).toHaveLength(3);
      expect(log.children![0].id).toBe("child-1");
      expect(log.children![1].id).toBe("child-2");
      expect(log.children![2].id).toBe("child-3");
    });

    it("should handle deeply nested transmitted logs", () => {
      const transmitted: LogTransmit = {
        id: "parent-1",
        userId: "user-123",
        player: "Player",
        emoji: "🚀",
        line: "Parent",
        timestamp: "2024-01-15T10:30:00Z",
        children: [
          {
            id: "child-1",
            userId: "user-123",
            player: "Player",
            emoji: "💥",
            line: "Child",
            timestamp: "2024-01-15T10:31:00Z",
            children: [
              {
                id: "grandchild-1",
                userId: "user-123",
                player: "Player",
                emoji: "⚡",
                line: "Grandchild",
                timestamp: "2024-01-15T10:32:00Z",
              },
            ],
          },
        ],
      };

      const log = fromLogTransmit(transmitted);

      expect(log.children).toHaveLength(1);
      expect(log.children![0].children).toHaveLength(1);
      expect(log.children![0].children![0].id).toBe("grandchild-1");
      expect(log.children![0].children![0].original).toBe("");
      expect(log.children![0].children![0].open).toBe(false);
    });

    it("should apply default values to all nested children", () => {
      const transmitted: LogTransmit = {
        id: "parent-1",
        userId: "user-123",
        player: "Player",
        emoji: "🚀",
        line: "Parent",
        timestamp: "2024-01-15T10:30:00Z",
        children: [
          {
            id: "child-1",
            userId: "user-123",
            player: "Player",
            emoji: "💥",
            line: "Child",
            timestamp: "2024-01-15T10:31:00Z",
            children: [
              {
                id: "grandchild-1",
                userId: "user-123",
                player: "Player",
                emoji: "⚡",
                line: "Grandchild",
                timestamp: "2024-01-15T10:32:00Z",
              },
            ],
          },
        ],
      };

      const log = fromLogTransmit(transmitted, {
        original: "restored text",
        open: true,
      });

      expect(log.original).toBe("restored text");
      expect(log.open).toBe(true);
      expect(log.children![0].original).toBe("restored text");
      expect(log.children![0].open).toBe(true);
      expect(log.children![0].children![0].original).toBe("restored text");
      expect(log.children![0].children![0].open).toBe(true);
    });
  });

  // ============================================================================
  // ROUND-TRIP TRANSFORMATION TESTS
  // ============================================================================

  describe("Round-trip Transformations (to → from → to)", () => {
    it("should maintain data integrity for simple log", () => {
      const original = createBasicLog({
        id: "log-1",
        userId: "user-123",
        player: "Test Player",
        emoji: "🚀",
        line: "Test line",
        timestamp: "2024-01-15T10:30:00Z",
        original: "raw text",
        open: false,
      });

      const transmitted = toLogTransmit(original);
      const restored = fromLogTransmit(transmitted, {
        original: original.original,
        open: original.open,
      });

      expect(restored).toEqual(original);
    });

    it("should maintain data integrity for log with metadata", () => {
      const metadata: LogMetadata = {
        vehicleName: "Avenger",
        victimName: "Enemy",
        zone: "Stanton",
        weaponClass: "Ballistic",
      };

      const original = createLogWithMetadata(metadata);

      const transmitted = toLogTransmit(original);
      const restored = fromLogTransmit(transmitted, {
        original: original.original,
        open: original.open,
      });

      expect(restored.metadata).toEqual(original.metadata);
    });

    it("should maintain data integrity for log with single child", () => {
      const childLog = createBasicLog({
        id: "child-1",
        player: "Child Player",
      });

      const original = createBasicLog({
        id: "parent-1",
        children: [childLog],
      });

      const transmitted = toLogTransmit(original);
      const restored = fromLogTransmit(transmitted, {
        original: original.original,
        open: original.open,
      });

      expect(restored.children).toHaveLength(1);
      expect(restored.children![0].id).toBe("child-1");
      expect(restored.children![0].player).toBe("Child Player");
    });

    it("should maintain data integrity for deeply nested logs", () => {
      const grandchild = createBasicLog({
        id: "grandchild-1",
        eventType: "actor_death" as LogEventType,
      });

      const child = createBasicLog({
        id: "child-1",
        children: [grandchild],
      });

      const parent = createBasicLog({
        id: "parent-1",
        children: [child],
      });

      const transmitted = toLogTransmit(parent);
      const restored = fromLogTransmit(transmitted, {
        original: parent.original,
        open: parent.open,
      });

      expect(restored.children![0].children![0].eventType).toBe("actor_death");
      expect(restored.children![0].children![0].id).toBe("grandchild-1");
    });

    it("should handle round-trip with complex metadata and children", () => {
      const metadata: LogMetadata = {
        vehicleName: "Avenger",
        victimName: "Enemy Player",
        zone: "Stanton",
        damageType: "Kinetic",
        deathCause: "Explosion",
        direction: {
          x: "1.0",
          y: "2.0",
          z: "3.0",
        },
      };

      const child = createLogWithMetadata({
        itemName: "Rifle",
        attachmentName: "Scope",
      });

      const original = createLogWithMetadata(metadata);
      original.children = [child];

      const transmitted = toLogTransmit(original);
      const restored = fromLogTransmit(transmitted, {
        original: original.original,
        open: original.open,
      });

      expect(restored.metadata).toEqual(original.metadata);
      expect(restored.children![0].metadata).toEqual(child.metadata);
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe("Edge Cases", () => {
    it("should handle log with empty reportedBy array", () => {
      const log = createBasicLog({
        reportedBy: [],
      });

      const transmitted = toLogTransmit(log);

      expect(transmitted.reportedBy).toEqual([]);
    });

    it("should handle log with undefined metadata", () => {
      const log = createBasicLog({
        metadata: undefined,
      });

      const transmitted = toLogTransmit(log);

      expect(transmitted.metadata).toBeUndefined();
    });

    it("should handle log with empty metadata object", () => {
      const log = createBasicLog({
        metadata: {},
      });

      const transmitted = toLogTransmit(log);

      expect(transmitted.metadata).toEqual({});
    });

    it("should handle log with complex nested metadata", () => {
      const metadata: LogMetadata = {
        vehicleName: "Avenger",
        direction: {
          x: "1.5",
          y: "2.5",
          z: "3.5",
        },
        customField: "custom value",
        anotherCustom: 123,
      };

      const log = createLogWithMetadata(metadata);
      const transmitted = toLogTransmit(log);

      expect(transmitted.metadata).toEqual(metadata);
    });

    it("should handle very deeply nested logs (5 levels)", () => {
      let deepLog = createBasicLog({ id: "level-5" });

      for (let i = 4; i > 0; i--) {
        deepLog = createBasicLog({
          id: `level-${i}`,
          children: [deepLog],
        });
      }

      const transmitted = toLogTransmit(deepLog);

      expect(transmitted.children).toBeDefined();
      expect(transmitted.children![0].children).toBeDefined();
      expect(transmitted.children![0].children![0].children).toBeDefined();
      expect(
        transmitted.children![0].children![0].children![0].children,
      ).toBeDefined();
      expect(
        transmitted.children![0].children![0].children![0].children![0].id,
      ).toBe("level-5");
    });

    it("should handle log with all optional fields present", () => {
      const log: Log = {
        id: "full-log",
        userId: "user-123",
        player: "Player",
        emoji: "🚀",
        line: "Log line",
        timestamp: "2024-01-15T10:30:00Z",
        original: "raw text",
        open: true,
        reportedBy: ["user-1", "user-2"],
        eventType: "killing_spree" as LogEventType,
        metadata: {
          victimName: "Enemy",
          zone: "Stanton",
        },
        children: [createBasicLog({ id: "child-1" })],
      };

      const transmitted = toLogTransmit(log);

      expect(transmitted.id).toBe("full-log");
      expect(transmitted.eventType).toBe("killing_spree");
      expect(transmitted.metadata?.victimName).toBe("Enemy");
      expect(transmitted.reportedBy).toEqual(["user-1", "user-2"]);
      expect(transmitted.children).toHaveLength(1);
    });

    it("should handle unicode characters in log content", () => {
      const log = createBasicLog({
        player: "玩家",
        emoji: "🌟",
        line: "Привет мир ☺️",
        original: "Encoded text with émojis: 🎮🎯",
      });

      const transmitted = toLogTransmit(log);

      expect(transmitted.player).toBe("玩家");
      expect(transmitted.emoji).toBe("🌟");
      expect(transmitted.line).toBe("Привет мир ☺️");
    });
  });

  // ============================================================================
  // DIFFERENT LOG EVENT TYPES
  // ============================================================================

  describe("Different Log Event Types", () => {
    const eventTypes: LogEventType[] = [
      "connection",
      "vehicle_control_flow",
      "actor_death",
      "location_change",
      "destruction",
      "system_quit",
      "hospital_respawn",
      "mission_shared",
      "mission_completed",
      "killing_spree",
      "corpsify",
      "quantum_travel_group",
    ];

    eventTypes.forEach((eventType) => {
      it(`should preserve eventType: ${eventType}`, () => {
        const log = createBasicLog({
          eventType,
        });

        const transmitted = toLogTransmit(log);
        const restored = fromLogTransmit(transmitted);

        expect(restored.eventType).toBe(eventType);
      });
    });

    it("should handle log without eventType", () => {
      const log = createBasicLog();
      const transmitted = toLogTransmit(log);

      expect(transmitted.eventType).toBeUndefined();
    });

    it("should handle children with different event types", () => {
      const child1 = createBasicLog({
        id: "child-1",
        eventType: "actor_death" as LogEventType,
      });

      const child2 = createBasicLog({
        id: "child-2",
        eventType: "vehicle_control_flow" as LogEventType,
      });

      const parent = createBasicLog({
        id: "parent-1",
        eventType: "killing_spree" as LogEventType,
        children: [child1, child2],
      });

      const transmitted = toLogTransmit(parent);

      expect(transmitted.eventType).toBe("killing_spree");
      expect(transmitted.children![0].eventType).toBe("actor_death");
      expect(transmitted.children![1].eventType).toBe("vehicle_control_flow");
    });
  });

  // ============================================================================
  // METADATA-SPECIFIC TESTS
  // ============================================================================

  describe("Metadata Field Preservation", () => {
    it("should preserve vehicle metadata fields", () => {
      const metadata: LogMetadata = {
        vehicleName: "Mustang Delta",
        vehicleId: "v-456",
        team: "My Squadron",
        entityType: "ship",
      };

      const log = createLogWithMetadata(metadata);
      const transmitted = toLogTransmit(log);
      const restored = fromLogTransmit(transmitted);

      expect(restored.metadata?.vehicleName).toBe("Mustang Delta");
      expect(restored.metadata?.vehicleId).toBe("v-456");
      expect(restored.metadata?.team).toBe("My Squadron");
      expect(restored.metadata?.entityType).toBe("ship");
    });

    it("should preserve combat metadata fields", () => {
      const metadata: LogMetadata = {
        victimName: "Enemy Commander",
        victimId: "enemy-123",
        killerName: "Me",
        killerId: "user-123",
        weaponInstance: "rifle-1",
        weaponClass: "ballistic",
        damageType: "kinetic",
        deathCause: "gunshot",
      };

      const log = createLogWithMetadata(metadata);
      const transmitted = toLogTransmit(log);
      const restored = fromLogTransmit(transmitted);

      expect(restored.metadata?.victimName).toBe("Enemy Commander");
      expect(restored.metadata?.damageType).toBe("kinetic");
      expect(restored.metadata?.deathCause).toBe("gunshot");
    });

    it("should preserve location metadata", () => {
      const metadata: LogMetadata = {
        zone: "Crusader",
        location: "Orison",
        spawnpoint: "Hospital",
      };

      const log = createLogWithMetadata(metadata);
      const transmitted = toLogTransmit(log);
      const restored = fromLogTransmit(transmitted);

      expect(restored.metadata?.zone).toBe("Crusader");
      expect(restored.metadata?.location).toBe("Orison");
      expect(restored.metadata?.spawnpoint).toBe("Hospital");
    });

    it("should preserve direction vector metadata", () => {
      const metadata: LogMetadata = {
        direction: {
          x: "10.5",
          y: "-5.2",
          z: "3.1",
        },
      };

      const log = createLogWithMetadata(metadata);
      const transmitted = toLogTransmit(log);
      const restored = fromLogTransmit(transmitted);

      expect(restored.metadata?.direction).toEqual({
        x: "10.5",
        y: "-5.2",
        z: "3.1",
      });
    });

    it("should preserve custom metadata fields", () => {
      const metadata: LogMetadata = {
        customField1: "value1",
        customField2: 42,
        customField3: true,
        customField4: ["array", "values"],
      };

      const log = createLogWithMetadata(metadata);
      const transmitted = toLogTransmit(log);
      const restored = fromLogTransmit(transmitted);

      expect(restored.metadata?.customField1).toBe("value1");
      expect(restored.metadata?.customField2).toBe(42);
      expect(restored.metadata?.customField3).toBe(true);
      expect(restored.metadata?.customField4).toEqual(["array", "values"]);
    });
  });
});
