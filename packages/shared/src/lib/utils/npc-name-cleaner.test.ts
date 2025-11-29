/**
 * NPC Name Cleaner Tests
 *
 * Tests for the NPC name cleaning utility that processes Star Citizen
 * NPC names from Game.log files.
 */

import { describe, it, expect } from "vitest";
import { cleanNPCName, getCleanNPCName } from "./npc-name-cleaner";

describe("cleanNPCName", () => {
  describe("basic functionality", () => {
    it("should return null for null input", () => {
      expect(cleanNPCName(null)).toBeNull();
    });

    it("should return null for undefined input", () => {
      expect(cleanNPCName(undefined)).toBeNull();
    });

    it("should return null for empty string", () => {
      expect(cleanNPCName("")).toBeNull();
    });
  });

  describe("non-NPC names", () => {
    it("should handle player names", () => {
      const result = cleanNPCName("space-man-rob");
      expect(result?.name).toBe("space-man-rob");
      expect(result?.role).toBeNull();
      expect(result?.subtype).toBeNull();
      expect(result?.isNPC).toBe(false);
      expect(result?.original).toBe("space-man-rob");
    });

    it("should handle regular usernames", () => {
      const result = cleanNPCName("Player123");
      expect(result?.name).toBe("Player123");
      expect(result?.isNPC).toBe(false);
    });

    it("should handle names with special characters", () => {
      const result = cleanNPCName("Player_Name-123");
      expect(result?.name).toBe("Player_Name-123");
      expect(result?.isNPC).toBe(false);
    });
  });

  describe("NPC name parsing", () => {
    it("should parse NPC name with role and subtype", () => {
      const result = cleanNPCName(
        "NPC_Archetypes-Male-Human-FrontierFighters_Pilot_7327668045984",
      );
      expect(result?.name).toBe("NPC (Frontier Fighters Pilot)");
      expect(result?.role).toBe("Frontier Fighters");
      expect(result?.subtype).toBe("Pilot");
      expect(result?.isNPC).toBe(true);
    });

    it("should parse NPC name with role only", () => {
      const result = cleanNPCName(
        "NPC_Archetypes-Male-Human-FrontierFighters_7327668051722",
      );
      expect(result?.name).toBe("NPC (Frontier Fighters)");
      expect(result?.role).toBe("Frontier Fighters");
      expect(result?.subtype).toBeNull();
      expect(result?.isNPC).toBe(true);
    });

    it("should parse NPC with different gender", () => {
      const result = cleanNPCName(
        "NPC_Archetypes-Female-Human-SecurityGuard_Officer_123456",
      );
      expect(result?.name).toBe("NPC (Security Guard Officer)");
      expect(result?.role).toBe("Security Guard");
      expect(result?.subtype).toBe("Officer");
      expect(result?.isNPC).toBe(true);
    });

    it("should parse NPC with different species", () => {
      const result = cleanNPCName(
        "NPC_Archetypes-Male-Alien-Pirates_Captain_789012",
      );
      expect(result?.name).toBe("NPC (Pirates Captain)");
      expect(result?.role).toBe("Pirates");
      expect(result?.subtype).toBe("Captain");
      expect(result?.isNPC).toBe(true);
    });
  });

  describe("camelCase splitting", () => {
    it("should split FrontierFighters into Frontier Fighters", () => {
      const result = cleanNPCName(
        "NPC_Archetypes-Male-Human-FrontierFighters_123",
      );
      expect(result?.role).toBe("Frontier Fighters");
    });

    it("should split SecurityGuard into Security Guard", () => {
      const result = cleanNPCName(
        "NPC_Archetypes-Male-Human-SecurityGuard_456",
      );
      expect(result?.role).toBe("Security Guard");
    });

    it("should split PirateLeader into Pirate Leader", () => {
      const result = cleanNPCName("NPC_Archetypes-Male-Human-PirateLeader_789");
      expect(result?.role).toBe("Pirate Leader");
    });

    it("should handle single word roles", () => {
      const result = cleanNPCName("NPC_Archetypes-Male-Human-Civilian_123");
      expect(result?.role).toBe("Civilian");
    });

    it("should handle multiple capital letters", () => {
      const result = cleanNPCName("NPC_Archetypes-Male-Human-UEENavy_123");
      expect(result?.role).toBe("U E E Navy");
    });
  });

  describe("subtype handling", () => {
    it("should extract Pilot subtype", () => {
      const result = cleanNPCName(
        "NPC_Archetypes-Male-Human-FrontierFighters_Pilot_123",
      );
      expect(result?.subtype).toBe("Pilot");
      expect(result?.name).toBe("NPC (Frontier Fighters Pilot)");
    });

    it("should extract Officer subtype", () => {
      const result = cleanNPCName(
        "NPC_Archetypes-Male-Human-Security_Officer_456",
      );
      expect(result?.subtype).toBe("Officer");
      expect(result?.name).toBe("NPC (Security Officer)");
    });

    it("should extract Captain subtype", () => {
      const result = cleanNPCName(
        "NPC_Archetypes-Female-Human-Pirates_Captain_789",
      );
      expect(result?.subtype).toBe("Captain");
      expect(result?.name).toBe("NPC (Pirates Captain)");
    });

    it("should handle no subtype (direct numeric ID)", () => {
      const result = cleanNPCName(
        "NPC_Archetypes-Male-Human-Civilian_123456789",
      );
      expect(result?.subtype).toBeNull();
      expect(result?.name).toBe("NPC (Civilian)");
    });

    it("should not treat numeric parts as subtype", () => {
      const result = cleanNPCName(
        "NPC_Archetypes-Male-Human-Soldier_7327668051722",
      );
      expect(result?.subtype).toBeNull();
      expect(result?.name).toBe("NPC (Soldier)");
    });
  });

  describe("original preservation", () => {
    it("should preserve original NPC name", () => {
      const original = "NPC_Archetypes-Male-Human-FrontierFighters_Pilot_123";
      const result = cleanNPCName(original);
      expect(result?.original).toBe(original);
    });

    it("should preserve original player name", () => {
      const original = "space-man-rob";
      const result = cleanNPCName(original);
      expect(result?.original).toBe(original);
    });
  });

  describe("edge cases", () => {
    it("should handle NPC name with extra underscores", () => {
      const result = cleanNPCName(
        "NPC_Archetypes-Male-Human-Fighter__Ace__123",
      );
      // This should still parse, though format is unusual
      expect(result?.isNPC).toBe(true);
    });

    it("should handle very long NPC IDs", () => {
      const result = cleanNPCName(
        "NPC_Archetypes-Male-Human-Soldier_123456789012345",
      );
      expect(result?.isNPC).toBe(true);
      expect(result?.name).toBe("NPC (Soldier)");
    });

    it("should handle NPC names without numeric ID", () => {
      const result = cleanNPCName("NPC_Archetypes-Male-Human-Guard_Officer");
      expect(result?.isNPC).toBe(true);
      // Without numeric ID at the end, "Officer" is treated as the ID, not subtype
      expect(result?.subtype).toBeNull();
    });

    it("should handle minimal NPC format", () => {
      const result = cleanNPCName("NPC_Archetypes-Male-Human-Soldier");
      expect(result?.isNPC).toBe(true);
    });
  });

  describe("complex roles", () => {
    it("should handle multi-word camelCase roles with subtype", () => {
      const result = cleanNPCName(
        "NPC_Archetypes-Male-Human-MilitaryPolice_Sergeant_123",
      );
      expect(result?.role).toBe("Military Police");
      expect(result?.subtype).toBe("Sergeant");
      expect(result?.name).toBe("NPC (Military Police Sergeant)");
    });

    it("should handle three-word roles", () => {
      const result = cleanNPCName(
        "NPC_Archetypes-Male-Human-UnitedEmpireEarth_123",
      );
      expect(result?.role).toBe("United Empire Earth");
    });
  });
});

describe("getCleanNPCName", () => {
  it("should return cleaned NPC name string with role and subtype", () => {
    const result = getCleanNPCName(
      "NPC_Archetypes-Male-Human-FrontierFighters_Pilot_123",
    );
    expect(result).toBe("NPC (Frontier Fighters Pilot)");
  });

  it("should return cleaned NPC name string with role only", () => {
    const result = getCleanNPCName("NPC_Archetypes-Male-Human-Civilian_789");
    expect(result).toBe("NPC (Civilian)");
  });

  it("should return player name unchanged", () => {
    const result = getCleanNPCName("space-man-rob");
    expect(result).toBe("space-man-rob");
  });

  it('should return "Unknown" for null', () => {
    const result = getCleanNPCName(null);
    expect(result).toBe("Unknown");
  });

  it('should return "Unknown" for undefined', () => {
    const result = getCleanNPCName(undefined);
    expect(result).toBe("Unknown");
  });

  it('should return "Unknown" for empty string', () => {
    const result = getCleanNPCName("");
    expect(result).toBe("Unknown");
  });

  it("should handle complex NPC names", () => {
    const result = getCleanNPCName(
      "NPC_Archetypes-Female-Human-SecurityGuard_Officer_456",
    );
    expect(result).toBe("NPC (Security Guard Officer)");
  });
});
