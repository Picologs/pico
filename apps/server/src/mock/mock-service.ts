/**
 * Mock Player Service
 *
 * Simulates a real Star Citizen player streaming live gameplay logs via WebSocket.
 * Dual purpose:
 * 1. Public demo for website homepage (live preview)
 * 2. Development/testing (connect desktop/website to mock data)
 *
 * The service authenticates as a real user, connects to the WebSocket server,
 * and broadcasts realistic Log objects continuously using scenario-based gameplay.
 */

import type { Log } from "@pico/types";
import { generateConnection, generateSystemQuit } from "./generators";
import { selectRandomScenario, type ScenarioContext } from "./scenarios";
import { randomDelay, randomPlayerName } from "./data";
import EventEmitter from "events";

// ============================================================================
// TYPES
// ============================================================================

export interface MockServiceConfig {
  userId: string;
  playerName: string;
  wsUrl: string;
  jwtToken: string;
  autoStart?: boolean;
  broadcastTarget?: "friends" | "group" | "public";
  groupId?: string;
  sessionDuration?: number; // ms, 0 = infinite
}

export interface MockServiceStatus {
  isRunning: boolean;
  currentScenario: string | null;
  logsEmitted: number;
  sessionStartTime: number | null;
  uptime: number; // seconds
}

// ============================================================================
// MOCK PLAYER SERVICE
// ============================================================================

export class MockPlayerService extends EventEmitter {
  private config: MockServiceConfig;
  private ws: WebSocket | null = null;
  private isRunning = false;
  private currentScenario: string | null = null;
  private logsEmitted = 0;
  private sessionStartTime: number | null = null;
  private scenarioAbortController: AbortController | null = null;

  // Reconnection state
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly MAX_RECONNECT_ATTEMPTS = 10;

  constructor(config: MockServiceConfig) {
    super();
    this.config = config;

    // Add default error listener to prevent unhandled error exceptions
    // Consumers can add their own listeners to override this behavior
    this.on("error", () => {
      // Default handler - prevents Node from throwing if no other listeners
    });
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  /**
   * Start the mock player service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error("Mock player service is already running");
    }

    console.log(
      `[MockService] Starting mock player: ${this.config.playerName}`,
    );

    this.isRunning = true;
    this.sessionStartTime = Date.now();
    this.logsEmitted = 0;

    try {
      // Connect to WebSocket server
      await this.connectWebSocket();

      // Send connection event
      this.sendLog(
        generateConnection(this.config.userId, this.config.playerName),
      );

      // Start scenario loop
      this.runScenarioLoop();

      this.emit("started");
      console.log("[MockService] Mock player service started");
    } catch (error) {
      this.isRunning = false;
      this.sessionStartTime = null;
      console.error("[MockService] Failed to start:", error);
      throw error;
    }
  }

  /**
   * Stop the mock player service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log("[MockService] Stopping mock player service...");

    this.isRunning = false;

    // Clear any pending reconnect
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Abort current scenario
    if (this.scenarioAbortController) {
      this.scenarioAbortController.abort();
      this.scenarioAbortController = null;
    }

    // Send system quit
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendLog(
        generateSystemQuit(this.config.userId, this.config.playerName),
      );
      await this.delay(500);
    }

    // Close WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.currentScenario = null;
    this.sessionStartTime = null;
    this.reconnectAttempts = 0;

    this.emit("stopped");
    console.log("[MockService] Mock player service stopped");
  }

  /**
   * Get service status
   */
  getStatus(): MockServiceStatus {
    return {
      isRunning: this.isRunning,
      currentScenario: this.currentScenario,
      logsEmitted: this.logsEmitted,
      sessionStartTime: this.sessionStartTime,
      uptime: this.sessionStartTime
        ? Math.floor((Date.now() - this.sessionStartTime) / 1000)
        : 0,
    };
  }

  /**
   * Trigger a specific scenario by name
   */
  async triggerScenario(scenarioName: string): Promise<void> {
    // This would require importing ALL_SCENARIOS and finding by name
    // For now, just log the request
    console.log(`[MockService] Scenario trigger requested: ${scenarioName}`);
    // TODO: Implement scenario selection by name
  }

  // ==========================================================================
  // WEBSOCKET CONNECTION
  // ==========================================================================

  /**
   * Calculate exponential backoff delay
   * 1s → 2s → 4s → 8s → 16s → max 30s
   */
  private getReconnectDelay(): number {
    const baseDelay = 1000;
    const maxDelay = 30000;
    const delay = Math.min(
      baseDelay * Math.pow(2, this.reconnectAttempts),
      maxDelay,
    );
    return delay;
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.error(
        "[MockService] Max reconnection attempts reached, stopping service",
      );
      this.emit("error", new Error("Max reconnection attempts reached"));
      this.stop();
      return;
    }

    const delay = this.getReconnectDelay();
    this.reconnectAttempts++;

    console.log(
      `[MockService] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`,
    );

    this.reconnectTimeout = setTimeout(() => {
      if (this.isRunning) {
        this.connectWebSocket().catch((err) => {
          console.error("[MockService] Reconnection failed:", err);
          this.attemptReconnect();
        });
      }
    }, delay);
  }

  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(
        `[MockService] Connecting to WebSocket: ${this.config.wsUrl}`,
      );

      // Clear any pending reconnect
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }

      // Close existing connection
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }

      this.ws = new WebSocket(this.config.wsUrl);

      this.ws.onopen = () => {
        console.log("[MockService] WebSocket connected");
        this.reconnectAttempts = 0; // Reset on successful connection

        // Register with the server
        this.ws!.send(
          JSON.stringify({
            type: "register",
            userId: this.config.userId,
            token: this.config.jwtToken,
            metadata: {
              playerName: this.config.playerName,
              isMockPlayer: true,
            },
          }),
        );

        resolve();
      };

      this.ws.onerror = (error) => {
        console.error("[MockService] WebSocket error:", error);
        this.emit("error", error);
        reject(error);
      };

      this.ws.onclose = () => {
        console.log("[MockService] WebSocket disconnected");
        this.ws = null;

        if (this.isRunning) {
          this.attemptReconnect();
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleWebSocketMessage(message);
        } catch (error) {
          console.error("[MockService] Failed to parse message:", error);
        }
      };
    });
  }

  private handleWebSocketMessage(message: any): void {
    // Handle server messages if needed
    if (message.type === "registered") {
      console.log("[MockService] Registered successfully");
      this.emit("registered");
    } else if (message.type === "error") {
      console.error(
        "[MockService] Server error:",
        message.error || message.data,
      );
      this.emit("error", message.error || message.data);
    }
    // Other message types can be handled as needed
  }

  // ==========================================================================
  // LOG EMISSION
  // ==========================================================================

  /**
   * Send a log via WebSocket
   */
  private sendLog(log: Log): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("[MockService] WebSocket not open, cannot send log");
      return;
    }

    // Remove 'original' and 'open' for network transmission
    const { original, open, children, ...logTransmit } = log;

    const message = {
      type: "send_logs",
      data: {
        logs: [logTransmit],
        target:
          this.config.broadcastTarget === "group"
            ? { type: "group", groupId: this.config.groupId }
            : { type: this.config.broadcastTarget || "friends" },
      },
    };

    this.ws.send(JSON.stringify(message));
    this.logsEmitted++;

    // Emit log event for local listeners (e.g., CLI, API)
    this.emit("log", log);
  }

  // ==========================================================================
  // SCENARIO EXECUTION
  // ==========================================================================

  /**
   * Run scenarios in a loop
   */
  private async runScenarioLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        // Check session duration limit
        if (this.config.sessionDuration && this.sessionStartTime) {
          const elapsed = Date.now() - this.sessionStartTime;
          if (elapsed >= this.config.sessionDuration) {
            console.log("[MockService] Session duration reached, stopping");
            await this.stop();
            return;
          }
        }

        // Select and run random scenario
        const { name, scenario } = selectRandomScenario();
        this.currentScenario = name;
        console.log(`[MockService] Starting scenario: ${name}`);

        this.scenarioAbortController = new AbortController();

        const ctx: ScenarioContext = {
          userId: this.config.userId,
          playerName: this.config.playerName,
          onLog: (log) => this.sendLog(log),
          delay: (ms) => this.delay(ms),
        };

        await scenario(ctx);

        console.log(`[MockService] Scenario completed: ${name}`);
        this.currentScenario = null;

        // Delay before next scenario (continuous flow)
        const idleTime = randomDelay(2000, 3000); // 2-3s between scenarios
        console.log(
          `[MockService] Idle for ${Math.floor(idleTime / 1000)}s before next scenario`,
        );
        await this.delay(idleTime);
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") {
          console.log("[MockService] Scenario aborted");
          return;
        }
        console.error("[MockService] Scenario error:", error);
        // Wait before retrying
        await this.delay(5000);
      }
    }
  }

  /**
   * Delay with abort support
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(resolve, ms);

      if (this.scenarioAbortController) {
        this.scenarioAbortController.signal.addEventListener("abort", () => {
          clearTimeout(timeout);
          reject(new DOMException("Aborted", "AbortError"));
        });
      }
    });
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let mockServiceInstance: MockPlayerService | null = null;

/**
 * Get or create the singleton mock service instance
 */
export function getMockService(config?: MockServiceConfig): MockPlayerService {
  if (!mockServiceInstance && config) {
    mockServiceInstance = new MockPlayerService(config);
  }

  if (!mockServiceInstance) {
    throw new Error(
      "Mock service not initialized. Provide config on first call.",
    );
  }

  return mockServiceInstance;
}

/**
 * Check if mock service exists
 */
export function hasMockService(): boolean {
  return mockServiceInstance !== null;
}

/**
 * Destroy the singleton instance
 */
export async function destroyMockService(): Promise<void> {
  if (mockServiceInstance) {
    try {
      await mockServiceInstance.stop();
    } catch (error: unknown) {
      // Suppress expected AbortError during shutdown
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      // Log unexpected errors
      console.error("[MockService] Unexpected error during shutdown:", error);
    } finally {
      mockServiceInstance = null;
    }
  }
}
