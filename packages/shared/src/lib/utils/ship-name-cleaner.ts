/**
 * Ship Name Cleaner Utility
 *
 * Cleans up ship names from Star Citizen Game.log files by removing technical suffixes
 * and expanding manufacturer abbreviations.
 *
 * @module ship-name-cleaner
 */

/**
 * Mapping of manufacturer codes to full names
 */
const MANUFACTURER_MAP: Record<string, string> = {
  ANVL: "Anvil",
  AEGS: "Aegis",
  ORIG: "Origin",
  DRAK: "Drake",
  CNOU: "CNOU",
  MISC: "MISC",
  RSI: "RSI",
  VAND: "Vanduul",
  AOPO: "Aopoa",
  BANU: "Banu",
  CRUS: "Crusader",
  KRIN: "Kruger",
  ESPR: "Esperia",
  ARGO: "ARGO",
  MRAI: "Mirai",
  TUMB: "Tumbril",
};

/**
 * Technical suffixes to strip from ship names
 * These are added by the game engine and don't represent the ship's actual name
 */
const TECHNICAL_SUFFIXES = [
  "_PU_AI_FF",
  "_PU_AI_CRIM",
  "_PU_Al_FF",
  "_PU_PDC",
  "_PU_",
  "_AI_",
  "_FF_",
  "_PDC_",
  "_Al_",
  "_CRIM_",
];

/**
 * Ship name cleaning result
 */
export interface CleanedShipName {
  /** The cleaned ship name (e.g., "Anvil Valkyrie") */
  name: string;
  /** Whether this is an AI-controlled ship */
  isAI: boolean;
  /** Whether this is a PDC (Point Defense Cannon) */
  isPDC: boolean;
  /** The original raw name */
  original: string;
}

/**
 * Cleans a ship name from Game.log by removing technical suffixes and expanding manufacturer codes
 *
 * @param rawName - Raw ship name from log (e.g., "ANVL_Valkyrie_PU_Al_FF_7347713114638")
 * @returns Cleaned ship name with metadata
 *
 * @example
 * ```typescript
 * cleanShipName("ANVL_Valkyrie_PU_Al_FF_7347713114638")
 * // => { name: "Anvil Valkyrie", isAI: false, isPDC: false, original: "..." }
 *
 * cleanShipName("ANVL_Hawk_PU_AI_FF_7347713149574")
 * // => { name: "Anvil Hawk (AI)", isAI: true, isPDC: false, original: "..." }
 *
 * cleanShipName("AIModule_Unmanned_PU_PDC_7166699717034")
 * // => { name: "PDC (AI)", isAI: true, isPDC: true, original: "..." }
 * ```
 */
export function cleanShipName(
  rawName: string | undefined | null,
): CleanedShipName | null {
  if (!rawName) {
    return null;
  }

  // Store original for reference
  const original = rawName;

  // Detect AI and PDC indicators before cleaning
  const isAI =
    rawName.includes("_PU_AI_") ||
    rawName.includes("_AI_") ||
    rawName.includes("AIModule");
  const isPDC =
    rawName.includes("_PU_PDC_") ||
    rawName.includes("_PDC_") ||
    rawName.includes("AIModule_Unmanned");

  // Special case: PDC turrets
  if (isPDC) {
    return {
      name: "PDC (AI)",
      isAI: true,
      isPDC: true,
      original,
    };
  }

  // Split by underscores
  let parts = rawName.split("_");

  // Remove numeric ID suffix (e.g., "7347713114638")
  if (parts.length > 0 && !isNaN(parseInt(parts[parts.length - 1], 10))) {
    parts.pop();
  }

  // Remove technical suffixes
  parts = parts.filter((part) => {
    // Check if this part is a technical suffix
    for (const suffix of TECHNICAL_SUFFIXES) {
      // Remove leading underscore for comparison
      const cleanSuffix = suffix.replace(/^_|_$/g, "");
      if (part === cleanSuffix) {
        return false;
      }
    }
    return true;
  });

  // Expand manufacturer code if it's the first part
  if (parts.length > 0 && MANUFACTURER_MAP[parts[0]]) {
    parts[0] = MANUFACTURER_MAP[parts[0]];
  }

  // Join parts with spaces
  let cleanedName = parts.join(" ");

  // Add AI indicator if applicable
  if (isAI && !isPDC) {
    cleanedName += " (AI)";
  }

  return {
    name: cleanedName,
    isAI,
    isPDC,
    original,
  };
}

/**
 * Gets just the cleaned ship name string (convenience function)
 *
 * @param rawName - Raw ship name from log
 * @returns Cleaned ship name, or original if cleaning fails
 *
 * @example
 * ```typescript
 * getCleanShipName("ANVL_Valkyrie_PU_Al_FF_7347713114638")
 * // => "Anvil Valkyrie"
 * ```
 */
export function getCleanShipName(rawName: string | undefined | null): string {
  const cleaned = cleanShipName(rawName);
  return cleaned?.name || rawName || "Unknown";
}
