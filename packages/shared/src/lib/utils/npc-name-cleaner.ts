/**
 * NPC Name Cleaner Utility
 *
 * Cleans up NPC names from Star Citizen Game.log files by extracting
 * readable role and subtype information.
 *
 * @module npc-name-cleaner
 */

/**
 * Converts camelCase or PascalCase to space-separated words
 * @param str - The string to convert
 * @returns Space-separated words
 *
 * @example
 * ```typescript
 * splitCamelCase("FrontierFighters") // => "Frontier Fighters"
 * splitCamelCase("SecurityGuard") // => "Security Guard"
 * ```
 */
function splitCamelCase(str: string): string {
  return str
    .replace(/([A-Z])/g, " $1")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * NPC name cleaning result
 */
export interface CleanedNPCName {
  /** The cleaned NPC display name (e.g., "NPC (Frontier Fighter Pilot)") */
  name: string;
  /** The extracted role (e.g., "Frontier Fighter") */
  role: string | null;
  /** The extracted subtype (e.g., "Pilot") */
  subtype: string | null;
  /** Whether this was an NPC name */
  isNPC: boolean;
  /** The original raw name */
  original: string;
}

/**
 * Cleans an NPC name from Game.log
 *
 * Pattern: NPC_Archetypes-<Gender>-<Species>-<Role>[_<Subtype>]_<ID>
 *
 * @param rawName - Raw NPC name from log
 * @returns Cleaned NPC name with metadata
 *
 * @example
 * ```typescript
 * cleanNPCName("NPC_Archetypes-Male-Human-FrontierFighters_Pilot_7327668045984")
 * // => { name: "NPC (Frontier Fighter Pilot)", role: "Frontier Fighters", subtype: "Pilot", isNPC: true, original: "..." }
 *
 * cleanNPCName("NPC_Archetypes-Male-Human-FrontierFighters_7327668051722")
 * // => { name: "NPC (Frontier Fighter)", role: "Frontier Fighters", subtype: null, isNPC: true, original: "..." }
 *
 * cleanNPCName("space-man-rob")
 * // => { name: "space-man-rob", role: null, subtype: null, isNPC: false, original: "space-man-rob" }
 * ```
 */
export function cleanNPCName(
  rawName: string | undefined | null,
): CleanedNPCName | null {
  if (!rawName) {
    return null;
  }

  const original = rawName;

  // Check if this is an NPC name
  if (!rawName.startsWith("NPC_Archetypes-")) {
    return {
      name: rawName,
      role: null,
      subtype: null,
      isNPC: false,
      original,
    };
  }

  // Pattern: NPC_Archetypes-Male-Human-FrontierFighters_Pilot_7327668045984
  // Split by underscores
  const parts = rawName.split("_");

  // Remove the "NPC" and "Archetypes" parts and the numeric ID at the end
  // parts = ["NPC", "Archetypes-Male-Human-FrontierFighters", "Pilot", "7327668045984"]
  // or
  // parts = ["NPC", "Archetypes-Male-Human-FrontierFighters", "7327668051722"]

  // Extract the archetype part (contains role)
  const archetypePart = parts[1]; // "Archetypes-Male-Human-FrontierFighters"
  const archetypeParts = archetypePart.split("-");

  // Last part of archetype is the role
  const role = archetypeParts[archetypeParts.length - 1]; // "FrontierFighters"

  // Check if there's a subtype (between role and numeric ID)
  let subtype: string | null = null;
  if (parts.length >= 4) {
    // Check if the third part is not a number (it's a subtype like "Pilot")
    const potentialSubtype = parts[2];
    if (potentialSubtype && isNaN(parseInt(potentialSubtype, 10))) {
      subtype = potentialSubtype;
    }
  }

  // Format the role (convert camelCase to spaces)
  const formattedRole = splitCamelCase(role);

  // Build the display name
  let displayName = "NPC";
  if (subtype) {
    displayName = `NPC (${formattedRole} ${subtype})`;
  } else {
    displayName = `NPC (${formattedRole})`;
  }

  return {
    name: displayName,
    role: formattedRole,
    subtype: subtype,
    isNPC: true,
    original,
  };
}

/**
 * Gets just the cleaned NPC name string (convenience function)
 *
 * @param rawName - Raw NPC name from log
 * @returns Cleaned NPC name, or original if not an NPC or cleaning fails
 *
 * @example
 * ```typescript
 * getCleanNPCName("NPC_Archetypes-Male-Human-FrontierFighters_Pilot_7327668045984")
 * // => "NPC (Frontier Fighter Pilot)"
 *
 * getCleanNPCName("space-man-rob")
 * // => "space-man-rob"
 * ```
 */
export function getCleanNPCName(rawName: string | undefined | null): string {
  const cleaned = cleanNPCName(rawName);
  return cleaned?.name || rawName || "Unknown";
}
