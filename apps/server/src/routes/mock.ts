/**
 * Mock Service Control API
 *
 * HTTP endpoints for controlling the mock player service:
 * - POST /api/mock/start - Start mock player
 * - POST /api/mock/stop - Stop mock player
 * - GET /api/mock/status - Get service status
 * - POST /api/mock/scenario/:name - Trigger specific scenario
 *
 * Protected: Development/staging only
 */

import type { Server } from "bun";
import {
  getMockService,
  hasMockService,
  destroyMockService,
  type MockServiceConfig,
} from "../mock";

// Environment check - only allow in dev/staging
const MOCK_ENABLED = process.env.MOCK_SERVICE_ENABLED === "true";
const MOCK_PLAYER_ID = process.env.MOCK_PLAYER_DISCORD_ID || "mock-player-demo";
const MOCK_PLAYER_NAME = process.env.MOCK_PLAYER_NAME || "DemoPlayer";
const WS_URL = process.env.MOCK_WS_URL || "ws://localhost:8080";
const JWT_TOKEN = process.env.MOCK_JWT_TOKEN || "";

/**
 * Helper: Check if mock service is enabled
 */
function checkMockEnabled(): { ok: boolean; response?: Response } {
  if (!MOCK_ENABLED) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: "Mock service is disabled" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      ),
    };
  }
  return { ok: true };
}

/**
 * POST /api/mock/start
 * Start the mock player service
 */
export async function startMockService(): Promise<Response> {
  const check = checkMockEnabled();
  if (!check.ok) return check.response!;

  try {
    // Check if already running
    if (hasMockService()) {
      const service = getMockService();
      const status = service.getStatus();
      if (status.isRunning) {
        return new Response(
          JSON.stringify({ error: "Mock service is already running", status }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    }

    // Validate config
    if (!JWT_TOKEN) {
      return new Response(
        JSON.stringify({ error: "MOCK_JWT_TOKEN not configured" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Create and start service
    const config: MockServiceConfig = {
      userId: MOCK_PLAYER_ID,
      playerName: MOCK_PLAYER_NAME,
      wsUrl: WS_URL,
      jwtToken: JWT_TOKEN,
      broadcastTarget: "public", // Public for demo
    };

    const service = getMockService(config);
    await service.start();

    return new Response(
      JSON.stringify({
        success: true,
        message: "Mock service started",
        status: service.getStatus(),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    console.error("[MockAPI] Start error:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Failed to start mock service",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

/**
 * POST /api/mock/stop
 * Stop the mock player service
 */
export async function stopMockService(): Promise<Response> {
  const check = checkMockEnabled();
  if (!check.ok) return check.response!;

  try {
    if (!hasMockService()) {
      return new Response(
        JSON.stringify({ error: "Mock service is not running" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    await destroyMockService();

    return new Response(
      JSON.stringify({
        success: true,
        message: "Mock service stopped",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    console.error("[MockAPI] Stop error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to stop mock service" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

/**
 * GET /api/mock/status
 * Get mock service status
 */
export function getMockServiceStatus(): Response {
  const check = checkMockEnabled();
  if (!check.ok) return check.response!;

  try {
    if (!hasMockService()) {
      return new Response(
        JSON.stringify({
          isRunning: false,
          currentScenario: null,
          logsEmitted: 0,
          sessionStartTime: null,
          uptime: 0,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const service = getMockService();
    const status = service.getStatus();

    return new Response(JSON.stringify(status), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[MockAPI] Status error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to get status" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

/**
 * POST /api/mock/scenario/:name
 * Trigger a specific scenario
 */
export async function triggerScenario(scenarioName: string): Promise<Response> {
  const check = checkMockEnabled();
  if (!check.ok) return check.response!;

  try {
    if (!hasMockService()) {
      return new Response(
        JSON.stringify({ error: "Mock service is not running" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const service = getMockService();
    await service.triggerScenario(scenarioName);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Scenario '${scenarioName}' triggered`,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    console.error("[MockAPI] Trigger scenario error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to trigger scenario" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

/**
 * Route handler for mock API
 */
export function handleMockRoute(req: Request): Response | Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // POST /api/mock/start
  if (method === "POST" && path === "/api/mock/start") {
    return startMockService();
  }

  // POST /api/mock/stop
  if (method === "POST" && path === "/api/mock/stop") {
    return stopMockService();
  }

  // GET /api/mock/status
  if (method === "GET" && path === "/api/mock/status") {
    return getMockServiceStatus();
  }

  // POST /api/mock/scenario/:name
  const scenarioMatch = path.match(/^\/api\/mock\/scenario\/(.+)$/);
  if (method === "POST" && scenarioMatch) {
    return triggerScenario(scenarioMatch[1]);
  }

  // Not found
  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}
