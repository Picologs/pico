/**
 * Mock data sources for realistic Star Citizen log simulation
 *
 * Provides pools of ships, weapons, locations, NPCs, and player names
 * to generate varied and authentic-looking game events.
 */

import type { ShipData } from "../types/ships";

// ============================================================================
// SHIPS
// ============================================================================

/**
 * Pool of 30+ real Star Citizen ships with manufacturer prefixes
 * Format: {manufacturer}_{shipName}_{randomId}
 */
export const SHIPS: ShipData[] = [
  // Light Fighters
  {
    manufacturer: "AEGS",
    name: "Gladius",
    displayName: "Aegis Gladius",
    role: "fighter",
  },
  {
    manufacturer: "ANVL",
    name: "Arrow",
    displayName: "Anvil Arrow",
    role: "fighter",
  },
  {
    manufacturer: "ANVL",
    name: "Hornet_F7C",
    displayName: "Anvil Hornet F7C",
    role: "fighter",
  },
  {
    manufacturer: "DRAK",
    name: "Buccaneer",
    displayName: "Drake Buccaneer",
    role: "fighter",
  },
  {
    manufacturer: "ORIG",
    name: "325a",
    displayName: "Origin 325a",
    role: "fighter",
  },

  // Medium Fighters
  {
    manufacturer: "AEGS",
    name: "Sabre",
    displayName: "Aegis Sabre",
    role: "fighter",
  },
  {
    manufacturer: "AEGS",
    name: "Vanguard_Warden",
    displayName: "Aegis Vanguard Warden",
    role: "fighter",
  },
  {
    manufacturer: "ANVL",
    name: "Hawk",
    displayName: "Anvil Hawk",
    role: "fighter",
  },

  // Starter Ships
  {
    manufacturer: "RSI",
    name: "Aurora_MR",
    displayName: "RSI Aurora MR",
    role: "starter",
  },
  {
    manufacturer: "CNOU",
    name: "Mustang_Alpha",
    displayName: "CNOU Mustang Alpha",
    role: "starter",
  },
  {
    manufacturer: "AEGS",
    name: "Avenger_Titan",
    displayName: "Aegis Avenger Titan",
    role: "starter",
  },
  {
    manufacturer: "ORIG",
    name: "100i",
    displayName: "Origin 100i",
    role: "starter",
  },

  // Multi-role / Medium Ships
  {
    manufacturer: "DRAK",
    name: "Cutlass_Black",
    displayName: "Drake Cutlass Black",
    role: "multi-role",
  },
  {
    manufacturer: "MISC",
    name: "Freelancer",
    displayName: "MISC Freelancer",
    role: "multi-role",
  },
  {
    manufacturer: "RSI",
    name: "Constellation_Andromeda",
    displayName: "RSI Constellation Andromeda",
    role: "multi-role",
  },
  {
    manufacturer: "AEGS",
    name: "Redeemer",
    displayName: "Aegis Redeemer",
    role: "gunship",
  },

  // Heavy / Large Ships
  {
    manufacturer: "AEGS",
    name: "Hammerhead",
    displayName: "Aegis Hammerhead",
    role: "corvette",
  },
  {
    manufacturer: "ORIG",
    name: "600i",
    displayName: "Origin 600i",
    role: "luxury",
  },
  {
    manufacturer: "ANVL",
    name: "Carrack",
    displayName: "Anvil Carrack",
    role: "exploration",
  },
  {
    manufacturer: "RSI",
    name: "Perseus",
    displayName: "RSI Perseus",
    role: "corvette",
  },

  // Mining / Industrial
  {
    manufacturer: "ARGO",
    name: "MOLE",
    displayName: "ARGO MOLE",
    role: "mining",
  },
  {
    manufacturer: "MISC",
    name: "Prospector",
    displayName: "MISC Prospector",
    role: "mining",
  },
  {
    manufacturer: "DRAK",
    name: "Vulture",
    displayName: "Drake Vulture",
    role: "salvage",
  },
  {
    manufacturer: "MISC",
    name: "Expanse",
    displayName: "MISC Expanse",
    role: "construction",
  },

  // Cargo / Transport
  {
    manufacturer: "DRAK",
    name: "Caterpillar",
    displayName: "Drake Caterpillar",
    role: "cargo",
  },
  {
    manufacturer: "MISC",
    name: "Hull_C",
    displayName: "MISC Hull C",
    role: "cargo",
  },
  {
    manufacturer: "CRUS",
    name: "C2_Hercules",
    displayName: "Crusader C2 Hercules",
    role: "cargo",
  },

  // Support
  {
    manufacturer: "AEGS",
    name: "Vulcan",
    displayName: "Aegis Vulcan",
    role: "support",
  },
  {
    manufacturer: "CRUS",
    name: "Starlifter_M2",
    displayName: "Crusader Starlifter M2",
    role: "transport",
  },

  // Ground Vehicles (sometimes appear in logs)
  {
    manufacturer: "TUMB",
    name: "Cyclone",
    displayName: "Tumbril Cyclone",
    role: "ground",
  },
  {
    manufacturer: "ORIG",
    name: "G12",
    displayName: "Origin G12",
    role: "ground",
  },
];

/**
 * NPC/AI ship variants (for combat encounters)
 */
export const NPC_SHIP_SUFFIXES = [
  "_PU_AI_FF", // Friendly AI
  "_PU_AI_CRIM", // Criminal AI
  "_PU_AI_PIRATE", // Pirate AI
  "_PU_PDC", // Point Defense Cannon
];

// ============================================================================
// WEAPONS
// ============================================================================

export const WEAPONS = {
  ship: [
    // Energy Weapons
    "KLWE_LaserRepeater_S1",
    "KLWE_LaserRepeater_S2",
    "KLWE_LaserRepeater_S3",
    "BEHR_LaserCannon_S4",
    "GATS_Ballistic_S2",
    "TALN_Ballistic_S3",

    // Missiles
    "AEGS_Missile_S1",
    "MISC_Missile_S2",
    "Torpedo_S9",

    // Ship-mounted
    "Turret_Remote_S3",
    "Turret_Manned_S4",
  ],
  fps: ["P4-AR", "LH-86", "Karna", "Arrowhead", "P8-SC", "Railgun_Animus"],
};

// ============================================================================
// LOCATIONS
// ============================================================================

export const LOCATIONS = {
  planets: ["Crusader", "microTech", "ArcCorp", "Hurston"],
  moons: [
    "Yela",
    "Daymar",
    "Cellin",
    "Aberdeen",
    "Arial",
    "Lyria",
    "Wala",
    "Magda",
  ],
  cities: ["Lorville", "New Babbage", "Area18", "Orison"],
  stations: [
    "Port_Olisar",
    "GrimHEX",
    "Everus_Harbor",
    "Baijini_Point",
    "Seraphim_Station",
    "Port_Tressler",
  ],
  zones: [
    "Crusader_Orbit",
    "ArcCorp_Area18_Spaceport",
    "Hurston_Lorville_Teasa_Spaceport",
    "microTech_New_Babbage_Spaceport",
    "Yela_Asteroid_Field",
    "Daymar_Surface",
    "Deep_Space_Lagrange_Point",
  ],
};

// ============================================================================
// NPCs
// ============================================================================

export const NPCS = {
  security: [
    "UEE_Security_Guard",
    "Crusader_Security_Officer",
    "ArcCorp_Security",
    "Station_Security",
  ],
  pirates: [
    "Pirate_Cutlass",
    "Pirate_Buccaneer",
    "Pirate_Caterpillar",
    "Outlaw_Fighter",
    "Criminal_Gladius",
  ],
  mission: [
    "Bounty_Target_Hammerhead",
    "Bounty_Target_Vanguard",
    "Nine_Tails_Fighter",
    "Xenothreat_Interceptor",
    "Escort_Mission_VIP",
  ],
  wildlife: ["Cave_Creature", "Hostile_Wildlife"],
};

// ============================================================================
// PLAYER NAMES
// ============================================================================

export const PLAYER_NAMES = [
  "DemoPlayer",
  "StarRunner",
  "VoidWalker",
  "QuantumDrifter",
  "SpaceCowboy",
  "NebulaNomad",
  "AsteroidMiner",
  "BountySeeker",
  "TradeRunner",
  "ExplorerX",
];

// ============================================================================
// MISSIONS
// ============================================================================

export const MISSION_TYPES = [
  "Bounty: Eliminate Target",
  "Delivery: Cargo Transport",
  "Combat Assist: Clear Hostiles",
  "Investigation: Search Area",
  "Mining: Extract Resources",
  "Escort: Protect VIP",
  "Rescue: Extract Personnel",
];

// ============================================================================
// DAMAGE TYPES
// ============================================================================

export const DAMAGE_TYPES = [
  "Combat",
  "Collision",
  "Energy",
  "Ballistic",
  "Explosive",
  "Environmental",
  "Suffocation",
  "Depressurization",
  "Burn",
  "Freeze",
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get a random item from an array
 */
export function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Get a random ship with unique ID
 */
export function randomShip(options?: { role?: string; isNPC?: boolean }): {
  id: string;
  rawName: string;
  displayName: string;
  manufacturer: string;
} {
  let ship = options?.role
    ? randomItem(SHIPS.filter((s) => s.role === options.role))
    : randomItem(SHIPS);

  const entityId = Math.floor(
    1000000000000 + Math.random() * 9000000000000,
  ).toString();
  const suffix = options?.isNPC ? randomItem(NPC_SHIP_SUFFIXES) : "";

  return {
    id: entityId,
    rawName: `${ship.manufacturer}_${ship.name}${suffix}_${entityId}`,
    displayName: ship.displayName + (options?.isNPC ? " (AI)" : ""),
    manufacturer: ship.manufacturer,
  };
}

/**
 * Get a random weapon
 */
export function randomWeapon(type: "ship" | "fps" = "ship"): string {
  return randomItem(WEAPONS[type]);
}

/**
 * Get a random location
 */
export function randomLocation(
  type?: "planets" | "moons" | "cities" | "stations" | "zones",
): string {
  if (type) {
    return randomItem(LOCATIONS[type]);
  }
  // Random from any category
  const allLocations = Object.values(LOCATIONS).flat();
  return randomItem(allLocations);
}

/**
 * Get a random NPC
 */
export function randomNPC(
  type?: "security" | "pirates" | "mission" | "wildlife",
): {
  name: string;
  id: string;
} {
  const npcPool = type ? NPCS[type] : Object.values(NPCS).flat();
  return {
    name: randomItem(npcPool),
    id: Math.floor(1000000000 + Math.random() * 9000000000).toString(),
  };
}

/**
 * Get a random player name
 */
export function randomPlayerName(): string {
  return randomItem(PLAYER_NAMES);
}

/**
 * Get a random mission type
 */
export function randomMission(): string {
  return randomItem(MISSION_TYPES);
}

/**
 * Get a random damage type
 */
export function randomDamageType(): string {
  return randomItem(DAMAGE_TYPES);
}

/**
 * Generate a random entity ID
 */
export function randomEntityId(): string {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
}

/**
 * Generate a random delay in milliseconds
 */
export function randomDelay(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min));
}
