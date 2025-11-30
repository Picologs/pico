import { clients, userConnections } from "./connection-manager";

/**
 * Broadcast messages to specific users (internal use)
 * @param userIds - Array of Discord IDs to broadcast to
 * @param type - Message type
 * @param data - Message data (optional)
 * @returns Number of connections that received the message
 */
export function broadcastToUsers(
  userIds: string[],
  type: string,
  data?: Record<string, any>,
): number {
  let delivered = 0;

  userIds.forEach((userId) => {
    const connectionIds = userConnections.get(userId);
    if (connectionIds && connectionIds.size > 0) {
      connectionIds.forEach((connectionId) => {
        const client = clients.get(connectionId);
        if (client) {
          try {
            client.ws.send(
              JSON.stringify({
                type,
                data: data || {},
                timestamp: new Date().toISOString(),
              }),
            );
            delivered++;
          } catch (sendError) {
            console.error(`[Broadcast] Error sending to ${userId}:`, sendError);
          }
        }
      });
    }
  });

  return delivered;
}
