/**
 * Ship Name Cleaner Tests
 *
 * Tests for the ship name cleaning utility that processes Star Citizen
 * ship names from Game.log files.
 */

import { describe, it, expect } from "vitest";
import { cleanShipName, getCleanShipName } from "./ship-name-cleaner";

describe("cleanShipName", () => {
  describe("basic functionality", () => {
    it("should return null for null input", () => {
      expect(cleanShipName(null)).toBeNull();
    });

    it("should return null for undefined input", () => {
      expect(cleanShipName(undefined)).toBeNull();
    });

    it("should return null for empty string", () => {
      expect(cleanShipName("")).toBeNull();
    });
  });

  describe("manufacturer expansion", () => {
    it("should expand ANVL to Anvil", () => {
      const result = cleanShipName("ANVL_Valkyrie_7347713114638");
      expect(result?.name).toBe("Anvil Valkyrie");
      expect(result?.isAI).toBe(false);
      expect(result?.isPDC).toBe(false);
    });

    it("should expand AEGS to Aegis", () => {
      const result = cleanShipName("AEGS_Gladius_123");
      expect(result?.name).toBe("Aegis Gladius");
    });

    it("should expand ORIG to Origin", () => {
      const result = cleanShipName("ORIG_300i_456");
      expect(result?.name).toBe("Origin 300i");
    });

    it("should expand DRAK to Drake", () => {
      const result = cleanShipName("DRAK_Cutlass_789");
      expect(result?.name).toBe("Drake Cutlass");
    });

    it("should expand MISC", () => {
      const result = cleanShipName("MISC_Freelancer_111");
      expect(result?.name).toBe("MISC Freelancer");
    });

    it("should expand RSI", () => {
      const result = cleanShipName("RSI_Aurora_222");
      expect(result?.name).toBe("RSI Aurora");
    });

    it("should expand CRUS to Crusader", () => {
      const result = cleanShipName("CRUS_C2_Hercules_333");
      expect(result?.name).toBe("Crusader C2 Hercules");
    });
  });

  describe("technical suffix removal", () => {
    it("should remove _PU_AI_FF suffix", () => {
      const result = cleanShipName("ANVL_Hawk_PU_AI_FF_7347713149574");
      expect(result?.name).toBe("Anvil Hawk (AI)");
      expect(result?.isAI).toBe(true);
      expect(result?.isPDC).toBe(false);
    });

    it("should remove _PU_Al_FF suffix", () => {
      const result = cleanShipName("ANVL_Valkyrie_PU_Al_FF_7347713114638");
      expect(result?.name).toBe("Anvil Valkyrie");
      expect(result?.isAI).toBe(false);
    });

    it("should remove _PU_ suffix", () => {
      const result = cleanShipName("AEGS_Gladius_PU_123");
      expect(result?.name).toBe("Aegis Gladius");
    });

    it("should remove _AI_ suffix", () => {
      const result = cleanShipName("ANVL_Hornet_AI_456");
      expect(result?.name).toBe("Anvil Hornet (AI)");
      expect(result?.isAI).toBe(true);
    });

    it("should remove _PDC_ suffix", () => {
      const result = cleanShipName("AIModule_Unmanned_PDC_789");
      expect(result?.name).toBe("PDC (AI)");
      expect(result?.isPDC).toBe(true);
    });

    it("should remove _CRIM_ suffix", () => {
      const result = cleanShipName("DRAK_Cutlass_PU_AI_CRIM_999");
      expect(result?.name).toBe("Drake Cutlass (AI)");
      expect(result?.isAI).toBe(true);
    });

    it("should remove numeric ID suffix", () => {
      const result = cleanShipName("ANVL_Valkyrie_7347713114638");
      expect(result?.name).toBe("Anvil Valkyrie");
    });

    it("should handle multiple suffixes", () => {
      const result = cleanShipName("ANVL_Hawk_PU_AI_FF_CRIM_7347713149574");
      expect(result?.name).toBe("Anvil Hawk (AI)");
      expect(result?.isAI).toBe(true);
    });
  });

  describe("AI detection", () => {
    it("should detect _PU_AI_ as AI", () => {
      const result = cleanShipName("ANVL_Hawk_PU_AI_FF_123");
      expect(result?.isAI).toBe(true);
      expect(result?.name).toContain("(AI)");
    });

    it("should detect _AI_ as AI", () => {
      const result = cleanShipName("AEGS_Sabre_AI_456");
      expect(result?.isAI).toBe(true);
      expect(result?.name).toContain("(AI)");
    });

    it("should detect AIModule as AI", () => {
      const result = cleanShipName("AIModule_Ship_789");
      expect(result?.isAI).toBe(true);
    });

    it("should not mark non-AI ships as AI", () => {
      const result = cleanShipName("ANVL_Valkyrie_PU_Al_FF_123");
      expect(result?.isAI).toBe(false);
      expect(result?.name).not.toContain("(AI)");
    });
  });

  describe("PDC handling", () => {
    it("should detect _PU_PDC_ as PDC", () => {
      const result = cleanShipName("AIModule_Unmanned_PU_PDC_123");
      expect(result?.isPDC).toBe(true);
      expect(result?.isAI).toBe(true);
      expect(result?.name).toBe("PDC (AI)");
    });

    it("should detect _PDC_ as PDC", () => {
      const result = cleanShipName("AIModule_Unmanned_PDC_456");
      expect(result?.isPDC).toBe(true);
      expect(result?.name).toBe("PDC (AI)");
    });

    it("should detect AIModule_Unmanned as PDC", () => {
      const result = cleanShipName("AIModule_Unmanned_789");
      expect(result?.isPDC).toBe(true);
      expect(result?.name).toBe("PDC (AI)");
    });

    it("should prioritize PDC detection over regular ship cleaning", () => {
      const result = cleanShipName("AIModule_Unmanned_PU_PDC_7166699717034");
      expect(result?.name).toBe("PDC (AI)");
      expect(result?.isPDC).toBe(true);
      expect(result?.isAI).toBe(true);
    });
  });

  describe("original preservation", () => {
    it("should preserve original ship name in result", () => {
      const original = "ANVL_Valkyrie_PU_Al_FF_7347713114638";
      const result = cleanShipName(original);
      expect(result?.original).toBe(original);
    });

    it("should preserve original even for PDCs", () => {
      const original = "AIModule_Unmanned_PU_PDC_123";
      const result = cleanShipName(original);
      expect(result?.original).toBe(original);
    });
  });

  describe("complex ship names", () => {
    it("should handle multi-part ship names", () => {
      const result = cleanShipName("CRUS_C2_Hercules_PU_123");
      expect(result?.name).toBe("Crusader C2 Hercules");
    });

    it("should handle variant names", () => {
      const result = cleanShipName("ANVL_Hornet_F7C_456");
      expect(result?.name).toBe("Anvil Hornet F7C");
    });

    it("should handle ships without manufacturer prefix", () => {
      const result = cleanShipName("GenericShip_789");
      expect(result?.name).toBe("GenericShip");
    });
  });

  describe("edge cases", () => {
    it("should handle ship name with only numeric ID", () => {
      const result = cleanShipName("123456789");
      expect(result?.name).toBe("");
    });

    it("should handle ship name with no underscores", () => {
      const result = cleanShipName("Gladius");
      expect(result?.name).toBe("Gladius");
    });

    it("should handle ship name with trailing underscore", () => {
      const result = cleanShipName("ANVL_Gladius_");
      // Trailing underscore creates an empty part that becomes a space
      expect(result?.name).toBe("Anvil Gladius ");
    });

    it("should handle ship name with leading underscore", () => {
      const result = cleanShipName("_ANVL_Gladius");
      // Leading underscore creates empty first part, ANVL doesn't get expanded in position 1
      expect(result?.name).toBe(" ANVL Gladius");
    });
  });
});

describe("getCleanShipName", () => {
  it("should return cleaned ship name string", () => {
    const result = getCleanShipName("ANVL_Valkyrie_7347713114638");
    expect(result).toBe("Anvil Valkyrie");
  });

  it("should return cleaned name with AI indicator", () => {
    const result = getCleanShipName("ANVL_Hawk_PU_AI_FF_123");
    expect(result).toBe("Anvil Hawk (AI)");
  });

  it("should return PDC name", () => {
    const result = getCleanShipName("AIModule_Unmanned_PU_PDC_123");
    expect(result).toBe("PDC (AI)");
  });

  it('should return "Unknown" for null', () => {
    const result = getCleanShipName(null);
    expect(result).toBe("Unknown");
  });

  it('should return "Unknown" for undefined', () => {
    const result = getCleanShipName(undefined);
    expect(result).toBe("Unknown");
  });

  it('should return "Unknown" for empty string', () => {
    const result = getCleanShipName("");
    expect(result).toBe("Unknown");
  });

  it("should handle complex ship names", () => {
    const result = getCleanShipName("CRUS_C2_Hercules_PU_AI_FF_123");
    expect(result).toBe("Crusader C2 Hercules (AI)");
  });
});
