#!/usr/bin/env bun
/**
 * Local Mock Simulation
 *
 * Runs the mock service locally without WebSocket connection.
 * Useful for testing log generation and scenario flow.
 *
 * Usage: bun run mock:simulate-local
 */

import { getMockService, type MockServiceConfig } from "../mock";

const PLAYER_NAME = process.env.MOCK_PLAYER_NAME || "TestPlayer";
const PLAYER_ID = process.env.MOCK_PLAYER_ID || "test-123";

async function simulateLocal() {
  console.log("🚀 Starting local mock simulation");
  console.log(`Player: ${PLAYER_NAME} (${PLAYER_ID})`);
  console.log("──────────────────────────────────");

  // Create mock config (no WebSocket)
  const config: MockServiceConfig = {
    userId: PLAYER_ID,
    playerName: PLAYER_NAME,
    wsUrl: "ws://localhost:8080", // Won't actually connect
    jwtToken: "fake-token", // Won't be used
    sessionDuration: 60000, // 1 minute simulation
  };

  const service = getMockService(config);

  // Listen to log events
  let logCount = 0;
  service.on("log", (log) => {
    logCount++;
    console.log(`[${logCount}] ${log.emoji} ${log.line}`);
  });

  service.on("started", () => {
    console.log("✅ Simulation started");
  });

  service.on("stopped", () => {
    console.log("──────────────────────────────────");
    console.log(`✅ Simulation complete. ${logCount} logs generated.`);
    process.exit(0);
  });

  service.on("error", (error) => {
    console.error("❌ Error:", error);
  });

  try {
    // Note: This will fail to connect to WebSocket, but will still run scenarios
    // For proper local testing, we'd need a WebSocket-less mode
    await service.start();
  } catch (error: any) {
    console.error("Failed to start simulation:", error.message);
    console.log(
      "\n💡 Tip: For full simulation, run the WebSocket server first.",
    );
    process.exit(1);
  }

  // Handle Ctrl+C
  process.on("SIGINT", async () => {
    console.log("\n\n⏸️  Stopping simulation...");
    await service.stop();
  });
}

simulateLocal();
