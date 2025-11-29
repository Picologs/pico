/**
 * Picologs WebSocket Server
 * Main entry point with modular architecture
 */

import { handleHttpRequest } from "./routes/http";
import { handleOpen, handleMessage, handleClose } from "./websocket/connection";

// Config
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || "0.0.0.0";

// Validate JWT secret on startup
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error("[FATAL] JWT_SECRET must be at least 32 characters");
  process.exit(1);
}

console.log(`[Server] Starting on ${HOST}:${PORT}`);

export const server = Bun.serve({
  port: PORT,
  hostname: HOST,

  async fetch(req, server) {
    const url = new URL(req.url);
    const ip = server.requestIP(req)?.address || "unknown";

    return handleHttpRequest({ url, ip, req, server });
  },

  websocket: {
    open: handleOpen,
    message: handleMessage,
    close: handleClose,
  },
});

console.log(`[Server] Running on ws://${HOST}:${PORT}/ws`);

// Auto-start mock service if enabled
const MOCK_AUTO_START = process.env.MOCK_AUTO_START === "true";
const MOCK_ENABLED = process.env.MOCK_SERVICE_ENABLED === "true";

if (MOCK_ENABLED && MOCK_AUTO_START) {
  console.log("[Server] Auto-starting mock service...");

  import("./mock")
    .then(async (mockModule) => {
      const { getMockService } = mockModule;
      try {
        const mockConfig = {
          userId: process.env.MOCK_PLAYER_DISCORD_ID || "mock-player-demo",
          playerName: process.env.MOCK_PLAYER_NAME || "DemoPlayer",
          wsUrl: process.env.MOCK_WS_URL || `ws://localhost:${PORT}`,
          jwtToken: process.env.MOCK_JWT_TOKEN || "",
          broadcastTarget: (process.env.MOCK_BROADCAST_TO as any) || "public",
          groupId: process.env.MOCK_GROUP_ID,
        };

        if (!mockConfig.jwtToken) {
          console.error(
            "[Server] Cannot auto-start mock service: MOCK_JWT_TOKEN not configured",
          );
          return;
        }

        const mockService = getMockService(mockConfig);
        await mockService.start();
        console.log("[Server] Mock service started automatically");
      } catch (error) {
        console.error("[Server] Failed to auto-start mock service:", error);
      }
    })
    .catch((error) => {
      console.error("[Server] Failed to import mock service:", error);
    });
}

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n[Server] Shutting down...");

  if (MOCK_ENABLED) {
    const { hasMockService, destroyMockService } = await import("./mock");
    if (hasMockService()) {
      await destroyMockService();
    }
  }

  process.exit(0);
});
