/**
 * Demo subscription handler for public log viewing
 * Allows unauthenticated users to view mock player logs
 */

import type { ServerWebSocket } from "bun";
import { destroyMockService } from "../mock";

// Store demo subscribers: ws -> userId
const demoSubscribers = new Map<ServerWebSocket<unknown>, string>();

// Cache last 40 demo logs for instant delivery to new subscribers
const demoLogCache: any[] = [];

/**
 * Subscribe a client to demo logs
 */
export function subscribeToDemo(
  ws: ServerWebSocket<unknown>,
  userId: string = "mock-player-demo",
): void {
  demoSubscribers.set(ws, userId);
  console.log(`[Demo] Client subscribed to demo logs for user: ${userId}`);

  // Send cached logs immediately to new subscriber
  if (demoLogCache.length > 0 && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(
        JSON.stringify({
          type: "receive_logs",
          data: { logs: demoLogCache, userId },
          timestamp: new Date().toISOString(),
        }),
      );
      console.log(
        `[Demo] Sent ${demoLogCache.length} cached logs to new subscriber`,
      );
    } catch (error) {
      console.error(
        "[Demo] Error sending cached logs to new subscriber:",
        error,
      );
    }
  }
}

/**
 * Unsubscribe a client from demo logs
 * Stops mock service immediately when last subscriber disconnects
 */
export async function unsubscribeFromDemo(
  ws: ServerWebSocket<unknown>,
): Promise<void> {
  const wasSubscribed = demoSubscribers.has(ws);
  demoSubscribers.delete(ws);

  if (wasSubscribed) {
    console.log("[Demo] Client unsubscribed from demo logs");

    // Stop mock service when last subscriber disconnects
    if (demoSubscribers.size === 0) {
      console.log("[Demo] No subscribers remaining, stopping mock service...");
      try {
        await destroyMockService();
        console.log("[Demo] Mock service stopped successfully");
      } catch (error) {
        console.error("[Demo] Error stopping mock service:", error);
      }
    }
  }
}

/**
 * Broadcast logs to demo subscribers
 * @param logs Array of log objects to broadcast
 * @param userId User ID of the sender (only send to matching subscribers)
 */
export function broadcastToDemo(logs: any[], userId: string): void {
  // Add logs to cache (keep last 40)
  demoLogCache.push(...logs);
  if (demoLogCache.length > 40) {
    demoLogCache.splice(0, demoLogCache.length - 40);
  }

  let delivered = 0;
  const deadConnections: ServerWebSocket<unknown>[] = [];

  for (const [ws, subscribedUserId] of demoSubscribers) {
    // Only send logs from the user they're subscribed to
    if (subscribedUserId === userId) {
      // Validate connection state before sending
      if (ws.readyState !== WebSocket.OPEN) {
        deadConnections.push(ws);
        continue;
      }

      try {
        ws.send(
          JSON.stringify({
            type: "receive_logs",
            data: { logs, userId },
            timestamp: new Date().toISOString(),
          }),
        );
        delivered++;
      } catch (error) {
        console.error("[Demo] Error sending to subscriber:", error);
        // Mark connection as dead on send failure
        deadConnections.push(ws);
      }
    }
  }

  // Clean up dead connections
  if (deadConnections.length > 0) {
    for (const ws of deadConnections) {
      demoSubscribers.delete(ws);
    }
    console.log(
      `[Demo] Cleaned up ${deadConnections.length} dead connection(s)`,
    );
  }

  if (delivered > 0) {
    console.log(
      `[Demo] Broadcasted ${logs.length} logs to ${delivered} subscribers`,
    );
  }
}

/**
 * Get demo subscriber count
 */
export function getDemoSubscriberCount(): number {
  return demoSubscribers.size;
}

/**
 * Clean up on connection close
 */
export function cleanupDemoSubscriber(ws: ServerWebSocket<unknown>): void {
  // Don't await - fire and forget for cleanup
  unsubscribeFromDemo(ws).catch((error) => {
    console.error("[Demo] Error during cleanup:", error);
  });
}
