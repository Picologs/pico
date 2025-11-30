/**
 * Scenario orchestration for realistic Star Citizen gameplay sessions
 *
 * Each scenario represents a complete gameplay sequence with logical event flows.
 * Scenarios use generators to create Log objects and emit them with realistic timing.
 */

import type { Log } from "@pico/types";
import {
  generateConnection,
  generateShipEntry,
  generateShipExit,
  generateQuantumSpooling,
  generateQuantumActive,
  generateQuantumArrival,
  generatePlayerKillsNPC,
  generateNPCKillsPlayer,
  generateShipDestruction,
  generateMissionShared,
  generateMissionObjective,
  generateMissionCompleted,
  generateRespawn,
  generateInsuranceClaim,
  generateEnvironmentalDeath,
  generateFatalCollision,
  generateLocationChange,
  generateSystemQuit,
  generateLandingPad,
} from "./generators";
import {
  randomShip,
  randomLocation,
  randomDelay,
  randomItem,
  randomNPC,
} from "./data";

// ============================================================================
// TYPES
// ============================================================================

export interface ScenarioContext {
  userId: string;
  playerName: string;
  onLog: (log: Log) => void;
  delay: (ms: number) => Promise<void>;
}

export type Scenario = (ctx: ScenarioContext) => Promise<void>;

// ============================================================================
// HELPER: QUANTUM TRAVEL SEQUENCE
// ============================================================================

async function quantumTravelTo(
  ctx: ScenarioContext,
  ship: { rawName: string; displayName: string; id: string },
  destination: string,
) {
  // Spooling
  ctx.onLog(
    generateQuantumSpooling(ctx.userId, ctx.playerName, ship, destination),
  );
  await ctx.delay(randomDelay(2000, 3000));

  // Active (travel time)
  ctx.onLog(
    generateQuantumActive(ctx.userId, ctx.playerName, ship, destination),
  );
  await ctx.delay(randomDelay(2000, 3000));

  // Arrival
  ctx.onLog(
    generateQuantumArrival(ctx.userId, ctx.playerName, ship, destination),
  );
  await ctx.delay(randomDelay(2000, 3000));
}

// ============================================================================
// SCENARIO: BOUNTY HUNTING
// ============================================================================

export const bountyHuntingScenario: Scenario = async (ctx) => {
  const ship = randomShip({ role: "fighter" });
  const station = randomLocation("stations");
  const huntLocation = randomLocation("zones");
  const numTargets = randomDelay(2, 5);

  // Start at station
  ctx.onLog(generateLocationChange(ctx.userId, ctx.playerName, station));
  await ctx.delay(randomDelay(2000, 3000));

  // Claim and enter ship
  ctx.onLog(generateInsuranceClaim(ctx.userId, ctx.playerName, ship));
  await ctx.delay(randomDelay(2000, 3000));

  ctx.onLog(generateShipEntry(ctx.userId, ctx.playerName, ship));
  await ctx.delay(randomDelay(2000, 3000));

  // Request landing pad departure
  ctx.onLog(
    generateLandingPad(ctx.userId, ctx.playerName, ship, station, "releasing"),
  );
  await ctx.delay(randomDelay(2000, 3000));

  // Quantum to hunt location
  await quantumTravelTo(ctx, ship, huntLocation);

  // Share bounty mission
  ctx.onLog(generateMissionShared(ctx.userId, ctx.playerName));
  await ctx.delay(randomDelay(2000, 3000));

  // Objective: locate target
  ctx.onLog(
    generateMissionObjective(ctx.userId, ctx.playerName, "Locate target"),
  );
  await ctx.delay(randomDelay(2000, 3000));

  // Combat sequence
  let playerDestroyed = false;
  for (let i = 0; i < numTargets; i++) {
    // Kill target
    ctx.onLog(generatePlayerKillsNPC(ctx.userId, ctx.playerName, ship));
    await ctx.delay(randomDelay(2000, 3000));

    // Check if combat goes badly (30% chance after first kill)
    if (Math.random() < 0.3 && i >= 1) {
      // Ship destroyed by NPC
      ctx.onLog(generateShipDestruction(ctx.userId, ctx.playerName, ship));
      await ctx.delay(randomDelay(2000, 3000));

      // Player killed
      ctx.onLog(generateNPCKillsPlayer(ctx.userId, ctx.playerName));
      await ctx.delay(randomDelay(2000, 3000));

      // Respawn at hospital
      const city = randomLocation("cities");
      ctx.onLog(generateRespawn(ctx.userId, ctx.playerName, city));
      await ctx.delay(randomDelay(2000, 3000));

      playerDestroyed = true;
      break;
    }

    // Sometimes take damage between kills
    if (Math.random() > 0.7) {
      await ctx.delay(randomDelay(2000, 3000));
    }
  }

  // Only complete mission if player survived
  if (!playerDestroyed) {
    // Mission complete
    ctx.onLog(
      generateMissionObjective(
        ctx.userId,
        ctx.playerName,
        "All targets eliminated",
      ),
    );
    await ctx.delay(randomDelay(2000, 3000));

    ctx.onLog(generateMissionCompleted(ctx.userId, ctx.playerName, true));
    await ctx.delay(randomDelay(2000, 3000));

    // Return to station
    await quantumTravelTo(ctx, ship, station);

    // Request landing
    ctx.onLog(
      generateLandingPad(
        ctx.userId,
        ctx.playerName,
        ship,
        station,
        "requesting",
      ),
    );
    await ctx.delay(randomDelay(2000, 3000));

    ctx.onLog(
      generateLandingPad(ctx.userId, ctx.playerName, ship, station, "granted"),
    );
    await ctx.delay(randomDelay(2000, 3000));

    // Exit ship
    ctx.onLog(generateShipExit(ctx.userId, ctx.playerName, ship));
    await ctx.delay(randomDelay(2000, 3000));
  }
};

// ============================================================================
// SCENARIO: MINING OPERATION
// ============================================================================

export const miningScenario: Scenario = async (ctx) => {
  const ship = randomShip({ role: "mining" });
  const station = randomLocation("stations");
  const asteroidField = "Yela_Asteroid_Field";

  // Start at station
  ctx.onLog(generateLocationChange(ctx.userId, ctx.playerName, station));
  await ctx.delay(randomDelay(2000, 3000));

  // Claim mining ship
  ctx.onLog(generateInsuranceClaim(ctx.userId, ctx.playerName, ship));
  await ctx.delay(randomDelay(2000, 3000));

  ctx.onLog(generateShipEntry(ctx.userId, ctx.playerName, ship));
  await ctx.delay(randomDelay(2000, 3000));

  // Depart
  ctx.onLog(
    generateLandingPad(ctx.userId, ctx.playerName, ship, station, "releasing"),
  );
  await ctx.delay(randomDelay(2000, 3000));

  // Quantum to asteroid field
  await quantumTravelTo(ctx, ship, asteroidField);

  // Mining events (simulated as location changes and objectives)
  ctx.onLog(
    generateMissionObjective(
      ctx.userId,
      ctx.playerName,
      "Scanning for resources",
    ),
  );
  await ctx.delay(randomDelay(2000, 3000));

  ctx.onLog(
    generateMissionObjective(ctx.userId, ctx.playerName, "Extracting minerals"),
  );
  await ctx.delay(randomDelay(2000, 3000));

  ctx.onLog(generateMissionObjective(ctx.userId, ctx.playerName, "Cargo full"));
  await ctx.delay(randomDelay(2000, 3000));

  // Return to station
  await quantumTravelTo(ctx, ship, station);

  ctx.onLog(
    generateLandingPad(ctx.userId, ctx.playerName, ship, station, "requesting"),
  );
  await ctx.delay(randomDelay(2000, 3000));

  ctx.onLog(
    generateLandingPad(ctx.userId, ctx.playerName, ship, station, "granted"),
  );
  await ctx.delay(randomDelay(2000, 3000));

  ctx.onLog(generateShipExit(ctx.userId, ctx.playerName, ship));
  await ctx.delay(randomDelay(2000, 3000));
};

// ============================================================================
// SCENARIO: DEATH AND RESPAWN
// ============================================================================

export const deathAndRespawnScenario: Scenario = async (ctx) => {
  const ship = randomShip();
  const station = randomLocation("stations");
  const combatZone = randomLocation("zones");
  const city = randomLocation("cities");

  // Enter ship
  ctx.onLog(generateShipEntry(ctx.userId, ctx.playerName, ship));
  await ctx.delay(randomDelay(2000, 3000));

  // Depart station
  ctx.onLog(
    generateLandingPad(ctx.userId, ctx.playerName, ship, station, "releasing"),
  );
  await ctx.delay(randomDelay(2000, 3000));

  // Quantum to combat zone
  await quantumTravelTo(ctx, ship, combatZone);

  // Combat starts
  await ctx.delay(randomDelay(2000, 3000));

  // Kill one NPC
  ctx.onLog(generatePlayerKillsNPC(ctx.userId, ctx.playerName, ship));
  await ctx.delay(randomDelay(2000, 3000));

  // Death scenario (random)
  const deathType = randomItem([
    "npc_kill",
    "ship_destruction",
    "collision",
    "environmental",
  ] as const);

  switch (deathType) {
    case "npc_kill":
      ctx.onLog(generateNPCKillsPlayer(ctx.userId, ctx.playerName));
      break;
    case "ship_destruction":
      ctx.onLog(generateShipDestruction(ctx.userId, ctx.playerName, ship));
      await ctx.delay(randomDelay(2000, 3000));
      ctx.onLog(generateNPCKillsPlayer(ctx.userId, ctx.playerName));
      break;
    case "collision":
      ctx.onLog(generateFatalCollision(ctx.userId, ctx.playerName, ship));
      await ctx.delay(randomDelay(2000, 3000));
      ctx.onLog(generateEnvironmentalDeath(ctx.userId, ctx.playerName, "fall"));
      break;
    case "environmental":
      ctx.onLog(generateShipDestruction(ctx.userId, ctx.playerName, ship));
      await ctx.delay(randomDelay(2000, 3000));
      ctx.onLog(
        generateEnvironmentalDeath(ctx.userId, ctx.playerName, "suffocation"),
      );
      break;
  }

  await ctx.delay(randomDelay(2000, 3000));

  // Respawn at hospital
  ctx.onLog(generateRespawn(ctx.userId, ctx.playerName, city));
  await ctx.delay(randomDelay(2000, 3000));

  // Claim destroyed ship
  ctx.onLog(generateInsuranceClaim(ctx.userId, ctx.playerName, ship));
  await ctx.delay(randomDelay(2000, 3000));
};

// ============================================================================
// SCENARIO: MULTI-EVENT PATROL
// ============================================================================

export const patrolScenario: Scenario = async (ctx) => {
  const ship = randomShip({ role: randomItem(["fighter", "multi-role"]) });
  const station = randomLocation("stations");
  const locations = [
    randomLocation("zones"),
    randomLocation("zones"),
    randomLocation("zones"),
  ];

  // Claim and enter ship
  ctx.onLog(generateInsuranceClaim(ctx.userId, ctx.playerName, ship));
  await ctx.delay(randomDelay(2000, 3000));

  ctx.onLog(generateShipEntry(ctx.userId, ctx.playerName, ship));
  await ctx.delay(randomDelay(2000, 3000));

  // Depart
  ctx.onLog(
    generateLandingPad(ctx.userId, ctx.playerName, ship, station, "releasing"),
  );
  await ctx.delay(randomDelay(2000, 3000));

  // Visit multiple locations
  let patrolEnded = false;
  for (const location of locations) {
    // Quantum travel
    await quantumTravelTo(ctx, ship, location);

    // Random event at location
    const event = randomItem(["combat", "scan", "nothing"] as const);

    switch (event) {
      case "combat":
        // Short combat encounter
        const kills = randomDelay(1, 3);
        for (let i = 0; i < kills; i++) {
          ctx.onLog(generatePlayerKillsNPC(ctx.userId, ctx.playerName, ship));
          await ctx.delay(randomDelay(2000, 3000));

          // 30% chance combat goes badly after first kill
          if (Math.random() < 0.3 && i >= 1) {
            // Ship destroyed by NPC
            ctx.onLog(
              generateShipDestruction(ctx.userId, ctx.playerName, ship),
            );
            await ctx.delay(randomDelay(2000, 3000));

            // Player killed
            ctx.onLog(generateNPCKillsPlayer(ctx.userId, ctx.playerName));
            await ctx.delay(randomDelay(2000, 3000));

            // Respawn at hospital
            const city = randomLocation("cities");
            ctx.onLog(generateRespawn(ctx.userId, ctx.playerName, city));
            await ctx.delay(randomDelay(2000, 3000));

            patrolEnded = true;
            break;
          }
        }
        break;
      case "scan":
        ctx.onLog(
          generateMissionObjective(
            ctx.userId,
            ctx.playerName,
            `Scanning ${location}`,
          ),
        );
        await ctx.delay(randomDelay(2000, 3000));
        break;
      case "nothing":
        // Just pass through
        await ctx.delay(randomDelay(2000, 3000));
        break;
    }

    if (patrolEnded) break;

    await ctx.delay(randomDelay(2000, 3000));
  }

  // Only return to station if patrol wasn't ended by death
  if (!patrolEnded) {
    // Return to station
    await quantumTravelTo(ctx, ship, station);

    ctx.onLog(
      generateLandingPad(
        ctx.userId,
        ctx.playerName,
        ship,
        station,
        "requesting",
      ),
    );
    await ctx.delay(randomDelay(2000, 3000));

    ctx.onLog(
      generateLandingPad(ctx.userId, ctx.playerName, ship, station, "granted"),
    );
    await ctx.delay(randomDelay(2000, 3000));

    ctx.onLog(generateShipExit(ctx.userId, ctx.playerName, ship));
    await ctx.delay(randomDelay(2000, 3000));
  }
};

// ============================================================================
// SCENARIO: QUICK COMBAT
// ============================================================================

export const quickCombatScenario: Scenario = async (ctx) => {
  const ship = randomShip({ role: "fighter" });
  const combatZone = randomLocation("zones");

  // Already in ship
  ctx.onLog(generateShipEntry(ctx.userId, ctx.playerName, ship));
  await ctx.delay(randomDelay(2000, 3000));

  // Quantum to combat
  await quantumTravelTo(ctx, ship, combatZone);

  // Quick combat (2-4 kills)
  const kills = randomDelay(2, 5);
  for (let i = 0; i < kills; i++) {
    ctx.onLog(generatePlayerKillsNPC(ctx.userId, ctx.playerName, ship));
    await ctx.delay(randomDelay(2000, 3000));

    // 30% chance combat goes badly after first kill
    if (Math.random() < 0.3 && i >= 1) {
      // Ship destroyed by NPC
      ctx.onLog(generateShipDestruction(ctx.userId, ctx.playerName, ship));
      await ctx.delay(randomDelay(2000, 3000));

      // Player killed
      ctx.onLog(generateNPCKillsPlayer(ctx.userId, ctx.playerName));
      await ctx.delay(randomDelay(2000, 3000));

      // Respawn at hospital
      const city = randomLocation("cities");
      ctx.onLog(generateRespawn(ctx.userId, ctx.playerName, city));
      await ctx.delay(randomDelay(2000, 3000));

      break;
    }
  }

  await ctx.delay(randomDelay(2000, 3000));
};

// ============================================================================
// SCENARIO: CARGO RUN
// ============================================================================

export const cargoRunScenario: Scenario = async (ctx) => {
  const ship = randomShip({ role: randomItem(["cargo", "multi-role"]) });
  const startStation = randomLocation("stations");
  const endStation = randomItem(
    ["Port_Olisar", "Everus_Harbor", "Baijini_Point"].filter(
      (s) => s !== startStation,
    ),
  );

  // Start at station
  ctx.onLog(generateLocationChange(ctx.userId, ctx.playerName, startStation));
  await ctx.delay(randomDelay(2000, 3000));

  // Accept delivery mission
  ctx.onLog(generateMissionShared(ctx.userId, ctx.playerName));
  await ctx.delay(randomDelay(2000, 3000));

  // Claim ship
  ctx.onLog(generateInsuranceClaim(ctx.userId, ctx.playerName, ship));
  await ctx.delay(randomDelay(2000, 3000));

  ctx.onLog(generateShipEntry(ctx.userId, ctx.playerName, ship));
  await ctx.delay(randomDelay(2000, 3000));

  // Objective: load cargo
  ctx.onLog(generateMissionObjective(ctx.userId, ctx.playerName, "Load cargo"));
  await ctx.delay(randomDelay(2000, 3000));

  // Depart
  ctx.onLog(
    generateLandingPad(
      ctx.userId,
      ctx.playerName,
      ship,
      startStation,
      "releasing",
    ),
  );
  await ctx.delay(randomDelay(2000, 3000));

  // Quantum to destination
  await quantumTravelTo(ctx, ship, endStation);

  // Request landing
  ctx.onLog(
    generateLandingPad(
      ctx.userId,
      ctx.playerName,
      ship,
      endStation,
      "requesting",
    ),
  );
  await ctx.delay(randomDelay(2000, 3000));

  ctx.onLog(
    generateLandingPad(ctx.userId, ctx.playerName, ship, endStation, "granted"),
  );
  await ctx.delay(randomDelay(2000, 3000));

  // Objective: deliver cargo
  ctx.onLog(
    generateMissionObjective(ctx.userId, ctx.playerName, "Deliver cargo"),
  );
  await ctx.delay(randomDelay(2000, 3000));

  // Mission complete
  ctx.onLog(generateMissionCompleted(ctx.userId, ctx.playerName, true));
  await ctx.delay(randomDelay(2000, 3000));

  ctx.onLog(generateShipExit(ctx.userId, ctx.playerName, ship));
  await ctx.delay(randomDelay(2000, 3000));
};

// ============================================================================
// ALL SCENARIOS
// ============================================================================

export const ALL_SCENARIOS: {
  name: string;
  scenario: Scenario;
  weight: number;
}[] = [
  { name: "Bounty Hunting", scenario: bountyHuntingScenario, weight: 3 },
  { name: "Mining Operation", scenario: miningScenario, weight: 2 },
  { name: "Death and Respawn", scenario: deathAndRespawnScenario, weight: 3 },
  { name: "Patrol", scenario: patrolScenario, weight: 2 },
  { name: "Quick Combat", scenario: quickCombatScenario, weight: 3 },
  { name: "Cargo Run", scenario: cargoRunScenario, weight: 2 },
];

/**
 * Select a random scenario based on weights
 */
export function selectRandomScenario(): { name: string; scenario: Scenario } {
  const totalWeight = ALL_SCENARIOS.reduce((sum, s) => sum + s.weight, 0);
  let random = Math.random() * totalWeight;

  for (const item of ALL_SCENARIOS) {
    random -= item.weight;
    if (random <= 0) {
      return item;
    }
  }

  // Fallback
  return ALL_SCENARIOS[0];
}
