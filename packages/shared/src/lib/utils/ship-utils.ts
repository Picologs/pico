/**
 * Star Citizen Ship Utilities
 *
 * Provides utilities for matching and identifying Star Citizen ships from log data.
 * Uses fuzzy matching to handle variations in ship names and identifiers.
 *
 * @module ship-utils
 */

/**
 * Ship data structure from Fleet Yards API
 */
export interface ShipData {
  /** Ship name (e.g., "Aegis Avenger Titan") */
  name: string;
  /** URL-friendly slug (e.g., "aegis_avenger_titan") */
  slug: string;
  /** Alternative identifier */
  erkulIdentifier?: string | null;
  /** Fleet data with image variants */
  fleetData?: {
    variants: Array<{
      iso_l?: {
        /** Image hash for constructing URLs */
        hash?: string;
      };
    }>;
  };
}

/**
 * Fleet database type (keyed by slug)
 */
export type FleetDatabase = Record<string, ShipData>;

/**
 * Result of ship matching operation
 */
export interface ShipMatchResult {
  /** The matched ship data, or null if no match */
  ship: ShipData | null;
  /** The ship's display name */
  name: string | null;
  /** URL to the ship image (if available) */
  imageUrl: string | null;
}

/**
 * Options for fuzzy search
 */
interface FuzzySearchOptions {
  /** Score threshold (0-1, lower = more lenient) */
  threshold?: number;
  /** Keys to search with weights */
  keys?: Array<{ name: string; weight: number }>;
}

/**
 * Simple fuzzy search implementation
 * Returns items scored by similarity to the search term
 */
function fuzzySearch<T>(
  items: T[],
  searchTerm: string,
  options: FuzzySearchOptions = {},
): Array<{ item: T; score: number }> {
  const { threshold = 0.2, keys = [{ name: "name", weight: 1.0 }] } = options;

  const results = items
    .map((item) => {
      let totalScore = 0;
      let totalWeight = 0;

      for (const key of keys) {
        const value = (item as any)[key.name];
        if (typeof value === "string") {
          const score = calculateSimilarity(
            searchTerm.toLowerCase(),
            value.toLowerCase(),
          );
          totalScore += score * key.weight;
          totalWeight += key.weight;
        }
      }

      return {
        item,
        score: totalWeight > 0 ? totalScore / totalWeight : 0,
      };
    })
    .filter((result) => result.score >= 1 - threshold)
    .sort((a, b) => b.score - a.score);

  return results;
}

/**
 * Tokenize and normalize a string for fuzzy matching
 * Splits on spaces, hyphens, underscores and normalizes tokens
 * Also splits combined letter+number patterns like "L21" → ["l", "21"]
 */
function tokenizeString(str: string): string[] {
  // Pre-process: normalize "Mk II", "MK II", "Mk 2" → "MkII" before tokenizing
  // This ensures they're treated as a single token
  const preprocessed = str
    .replace(/\bmk[\s\-]?i{1,2}\b/gi, "mkii")
    .replace(/\bmk[\s\-]?2\b/gi, "mkii");

  const tokens = preprocessed
    .toLowerCase()
    .split(/[\s\-_]+/)
    .filter((token) => token.length > 0);

  // Split tokens that combine letters and numbers without trailing letters
  // Examples: "l21" → ["l", "21"], "p52" → ["p", "52"]
  // But keep patterns like "f7cm" intact (handled by normalizeToken)
  const expandedTokens: string[] = [];
  for (const token of tokens) {
    // Match: single letter + digits (no trailing letters)
    const match = token.match(/^([a-z])(\d+)$/i);
    if (match) {
      expandedTokens.push(match[1].toLowerCase());
      expandedTokens.push(match[2]);
    } else {
      expandedTokens.push(normalizeToken(token));
    }
  }

  return expandedTokens;
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for lenient manufacturer matching (e.g., KRIG vs KRIN)
 */
function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1, // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Normalize a token for comparison
 * Handles variant suffixes like Mk2/MKII/mk-ii and model codes like L21, F7CM
 */
function normalizeToken(token: string): string {
  // Normalize Mk2, MKII, mk-ii, Mk II → mkii
  if (/^mk[\s\-]?i{1,2}$/i.test(token)) {
    return "mkii";
  }
  if (/^mk[\s\-]?2$/i.test(token)) {
    return "mkii";
  }

  // Normalize model codes with hyphens: F7C-M, F7-CM, F7CM → f7cm
  // This allows matching regardless of hyphenation style
  const modelMatch = token.match(/^([a-z]\d+)[\-]?([a-z]+)$/i);
  if (modelMatch) {
    return (modelMatch[1] + modelMatch[2]).toLowerCase();
  }

  return token.toLowerCase();
}

/**
 * Calculate similarity between two strings using token-based matching
 * Returns 0-1, where 1 is exact match
 *
 * This approach handles:
 * - Word reordering (e.g., "F7C-M Super Hornet" vs "Super Hornet F7C-M")
 * - Variant suffixes (Mk2, MKII, mk-ii are treated as equivalent)
 * - Different hyphenation styles (F7C-M, F7CM, F7-CM)
 * - Manufacturer matching (weighted higher)
 */
function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 1;

  const tokensA = tokenizeString(a);
  const tokensB = tokenizeString(b);

  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  // Count matching tokens
  let matchCount = 0;
  const matchedB = new Set<number>();

  for (const tokenA of tokensA) {
    for (let i = 0; i < tokensB.length; i++) {
      if (matchedB.has(i)) continue;

      const tokenB = tokensB[i];

      // Exact token match
      if (tokenA === tokenB) {
        matchCount++;
        matchedB.add(i);
        break;
      }

      // Partial match for longer tokens (e.g., "hornet" in "hornets")
      if (tokenA.length >= 4 && tokenB.length >= 4) {
        if (tokenA.includes(tokenB) || tokenB.includes(tokenA)) {
          matchCount += 0.8; // Slightly lower score for partial matches
          matchedB.add(i);
          break;
        }
      }
    }
  }

  // Calculate score based on matched tokens vs total tokens
  // Use the average of both perspectives to be balanced
  const scoreA = matchCount / tokensA.length;
  const scoreB = matchCount / tokensB.length;
  const baseScore = (scoreA + scoreB) / 2;

  // Bonus for manufacturer match (first token is typically manufacturer)
  // Use lenient matching: exact match OR edit distance ≤ 1 (handles typos like KRIG vs KRIN)
  const manufacturerExactMatch = tokensA[0] === tokensB[0];
  const manufacturerFuzzyMatch =
    !manufacturerExactMatch && levenshteinDistance(tokensA[0], tokensB[0]) <= 1;
  const manufacturerBonus = manufacturerExactMatch
    ? 0.15
    : manufacturerFuzzyMatch
      ? 0.1
      : 0;

  // Bonus for length similarity (helps distinguish between variants)
  const lengthDiff = Math.abs(tokensA.length - tokensB.length);
  const lengthBonus = lengthDiff === 0 ? 0.1 : lengthDiff === 1 ? 0.05 : 0;

  return Math.min(1, baseScore + manufacturerBonus + lengthBonus);
}

/**
 * Normalize ship name by handling common abbreviations and patterns
 *
 * Examples:
 * - "F7CM" → "F7C-M" (hyphenated model numbers)
 * - "F8C" → "F8C" (single letter, no hyphen needed)
 * - "Hornet" + "F7C-M" → adds "Super" for F7C-M variants
 *
 * @param parts - Vehicle name parts (split by underscore)
 * @returns Normalized parts array
 */
function normalizeShipNameParts(parts: string[]): string[] {
  const normalized = [...parts];

  // Common abbreviation patterns
  for (let i = 0; i < normalized.length; i++) {
    const part = normalized[i].toUpperCase();

    // Handle hyphenated model numbers (F7CM → F7C-M, F8C → F8C, etc.)
    // Match: Letter + Digits + Letter(s) + optional Letter(s)
    // Examples: F7CM → F7C + M, F8C → F8C (no split), A2A → A2A (no split)
    if (/^[A-Z]\d+[A-Z]+$/.test(part)) {
      // Greedy match: capture as much as possible in first group (Letter+Digits+Letter)
      // This ensures F7CM → F7C + M (not F7 + CM)
      const match = part.match(/^([A-Z]\d+[A-Z])([A-Z]+)$/);
      if (match && match[2].length > 0) {
        // Only hyphenate if there's a second group
        normalized[i] = `${match[1]}-${match[2]}`;
      }
      // If no second group, keep as-is (e.g., F8C stays F8C)
    }
  }

  // Add "Super" for specific variants
  // F7C-M Hornet is actually "Super Hornet"
  const hasF7CM = normalized.some((p) => p.toLowerCase() === "f7c-m");
  const hasHornet = normalized.some((p) => p.toLowerCase() === "hornet");
  if (
    hasF7CM &&
    hasHornet &&
    !normalized.some((p) => p.toLowerCase() === "super")
  ) {
    // Insert "Super" before "Hornet"
    const hornetIndex = normalized.findIndex(
      (p) => p.toLowerCase() === "hornet",
    );
    if (hornetIndex >= 0) {
      normalized.splice(hornetIndex, 0, "Super");
    }
  }

  return normalized;
}

/**
 * Get ship data from vehicle name using progressive matching
 *
 * This function implements a smart matching algorithm:
 * 1. Normalizes common abbreviations (F7CM → F7C-M, etc.)
 * 2. Tries direct dictionary lookup with progressive shortening (underscores and hyphens)
 * 3. Falls back to fuzzy search if no exact match found
 *
 * @param vehicleName - The vehicle name from log metadata (e.g., "AEGIS_Avenger_Titan_123")
 * @param fleet - The fleet database (ship slug → ship data)
 * @param debug - Enable debug logging for troubleshooting (default: false)
 * @returns Ship data if found, null otherwise
 *
 * @example
 * ```typescript
 * const ship = getShipData('AEGIS_Avenger_Titan_123', fleetDatabase);
 * if (ship) {
 *   console.log('Ship:', ship.name);
 *   console.log('Image hash:', ship.fleetData?.variants[0]?.iso_l?.hash);
 * }
 *
 * // With debug logging
 * const ship = getShipData('ANVL_Hornet_F7CM_Mk2', fleetDatabase, true);
 * ```
 */
export function getShipData(
  vehicleName: string | undefined | null,
  fleet: FleetDatabase,
  debug: boolean = false,
): ShipData | null {
  if (!vehicleName || typeof vehicleName !== "string") {
    if (debug) console.log("[ShipMatch] Invalid vehicle name:", vehicleName);
    return null;
  }

  if (debug) console.log("[ShipMatch] Original vehicle name:", vehicleName);

  const vehicleNameParts = vehicleName.split("_");

  // Remove numeric suffix if present (e.g., "AEGIS_Avenger_Titan_123" → ["AEGIS", "Avenger", "Titan"])
  if (
    vehicleNameParts.length > 1 &&
    !isNaN(parseInt(vehicleNameParts[vehicleNameParts.length - 1], 10))
  ) {
    vehicleNameParts.pop();
  }

  // Normalize ship name parts (handle abbreviations like F7CM → F7C-M)
  const normalizedParts = normalizeShipNameParts(vehicleNameParts);
  if (debug) console.log("[ShipMatch] Normalized parts:", normalizedParts);

  // 1. Try direct match with progressive shortening (try both underscores and hyphens)
  let tempParts = [...normalizedParts];
  while (tempParts.length > 0) {
    // Normalize MKII → MK_II for dictionary lookup (database uses underscores)
    const normalizedForLookup = tempParts.map((part) =>
      /^mkii$/i.test(part) ? "mk_ii" : part,
    );

    // Try with underscores
    const vehicleNameKeyUnderscore = normalizedForLookup
      .join("_")
      .toLowerCase();
    if (debug)
      console.log(
        "[ShipMatch] Trying underscore key:",
        vehicleNameKeyUnderscore,
      );
    let ship = fleet[vehicleNameKeyUnderscore];
    if (ship) {
      if (debug) console.log("[ShipMatch] ✓ Found with underscore:", ship.name);
      return ship;
    }

    // Try with hyphens (some fleet keys use hyphens instead of underscores)
    const vehicleNameKeyHyphen = normalizedForLookup.join("-").toLowerCase();
    if (debug)
      console.log("[ShipMatch] Trying hyphen key:", vehicleNameKeyHyphen);
    ship = fleet[vehicleNameKeyHyphen];
    if (ship) {
      if (debug) console.log("[ShipMatch] ✓ Found with hyphen:", ship.name);
      return ship;
    }

    tempParts.pop();
  }

  // 2. If no direct match, fallback to fuzzy search
  if (debug) console.log("[ShipMatch] No direct match, trying fuzzy search...");

  const options: FuzzySearchOptions = {
    threshold: 0.5, // Token-based matching is more lenient (was 0.2 for Levenshtein)
    keys: [
      { name: "name", weight: 0.7 },
      { name: "slug", weight: 0.2 },
      { name: "erkulIdentifier", weight: 0.1 },
    ],
  };

  const fleetArray = Object.values(fleet);
  tempParts = [...normalizedParts];

  while (tempParts.length > 0) {
    const fuzzySearchTerm = tempParts.join(" ");
    if (debug) console.log("[ShipMatch] Fuzzy search term:", fuzzySearchTerm);
    const fuzzyResults = fuzzySearch<ShipData>(
      fleetArray,
      fuzzySearchTerm,
      options,
    );

    if (debug && fuzzyResults.length > 0) {
      console.log("[ShipMatch] Top 3 fuzzy matches:");
      fuzzyResults.slice(0, 3).forEach((result, index) => {
        console.log(
          `  ${index + 1}. ${result.item.name} (score: ${result.score.toFixed(2)}, has image: ${!!result.item.fleetData?.variants[0]?.iso_l?.hash})`,
        );
      });
    }

    if (fuzzyResults[0]?.item?.fleetData?.variants[0]?.iso_l?.hash) {
      if (debug)
        console.log(
          "[ShipMatch] ✓ Found with fuzzy search:",
          fuzzyResults[0].item.name,
        );
      return fuzzyResults[0].item;
    }
    tempParts.pop();
  }

  if (debug) console.log("[ShipMatch] ✗ No match found for:", vehicleName);
  return null;
}

/**
 * Get ship image URL from ship data
 *
 * @param ship - The ship data
 * @param baseUrl - Base URL for ship images (default: '/ships/')
 * @returns Image URL if available, null otherwise
 *
 * @example
 * ```typescript
 * const ship = getShipData('AEGIS_Avenger_Titan', fleet);
 * const imageUrl = getShipImageUrl(ship);
 * // Returns: '/ships/aegis_avenger_titan__iso_l_abc123.webp'
 * ```
 */
export function getShipImageUrl(
  ship: ShipData | null,
  baseUrl: string = "/ships/",
): string | null {
  if (!ship?.slug || !ship?.fleetData?.variants[0]?.iso_l?.hash) {
    return null;
  }

  return `${baseUrl}${ship.slug}__iso_l_${ship.fleetData.variants[0].iso_l.hash}.webp`;
}

/**
 * Get ship icon emoji based on ship type/category
 *
 * This is a placeholder function. In the future, it could be enhanced to
 * categorize ships and return appropriate emoji icons.
 *
 * @param ship - The ship data
 * @returns Emoji icon for the ship
 *
 * @example
 * ```typescript
 * const icon = getShipIcon(ship);
 * // Returns: '🚀'
 * ```
 */
export function getShipIcon(_ship?: ShipData | null): string {
  // Future enhancement: categorize ships by type (fighter, cargo, mining, etc.)
  // For now, return default ship icon
  return "🚀";
}

/**
 * Match ship data and get all related info in one call
 *
 * Convenience function that combines ship matching and data extraction.
 *
 * @param vehicleName - The vehicle name from log metadata
 * @param fleet - The fleet database
 * @param baseImageUrl - Base URL for ship images (default: '/ships/')
 * @returns Complete ship match result
 *
 * @example
 * ```typescript
 * const result = matchShip('AEGIS_Avenger_Titan_123', fleet);
 * if (result.ship) {
 *   console.log('Ship:', result.name);
 *   console.log('Image:', result.imageUrl);
 * }
 * ```
 */
export function matchShip(
  vehicleName: string | undefined | null,
  fleet: FleetDatabase,
  baseImageUrl: string = "/ships/",
): ShipMatchResult {
  const ship = getShipData(vehicleName, fleet);

  return {
    ship,
    name: ship?.name || null,
    imageUrl: getShipImageUrl(ship, baseImageUrl),
  };
}
