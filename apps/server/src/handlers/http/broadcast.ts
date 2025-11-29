import { BROADCAST_API_KEY } from "../../config/constants";
import { clients, userConnections } from "../../services/connection-manager";
import { isValidUserId } from "../../utils/validation";

/**
 * Broadcast endpoint handler
 * Sends messages to specific users via WebSocket
 * Requires API key authentication
 */
export async function handleBroadcast(
  req: Request,
  clientIp: string,
): Promise<Response> {
  try {
    // Check API key authentication
    const authHeader = req.headers.get("Authorization");
    if (!BROADCAST_API_KEY) {
      console.error(
        "[Security] BROADCAST_API_KEY not configured - broadcast endpoint disabled",
      );
      return Response.json(
        {
          success: false,
          error: "Service temporarily unavailable",
        },
        { status: 503 },
      );
    }

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.warn(
        `[Unauthorized] Missing or invalid Authorization header from ${clientIp}`,
      );
      return Response.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 },
      );
    }

    const providedKey = authHeader.substring(7); // Remove 'Bearer ' prefix
    if (providedKey !== BROADCAST_API_KEY) {
      console.warn(`[Unauthorized] Invalid API key from ${clientIp}`);
      return Response.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 },
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const { userIds, type, data } = body;

    if (!userIds || !Array.isArray(userIds) || !type) {
      return Response.json(
        {
          success: false,
          error: "Invalid request",
        },
        { status: 400 },
      );
    }

    // Validate userIds
    if (userIds.length > 1000) {
      return Response.json(
        {
          success: false,
          error: "Too many userIds (max 1000)",
        },
        { status: 400 },
      );
    }

    for (const userId of userIds) {
      if (!isValidUserId(userId)) {
        return Response.json(
          {
            success: false,
            error: "Invalid userId format in request",
          },
          { status: 400 },
        );
      }
    }

    // Validate type field
    if (typeof type !== "string" || type.length < 1 || type.length > 100) {
      return Response.json(
        {
          success: false,
          error: "Invalid type field",
        },
        { status: 400 },
      );
    }

    let delivered = 0;
    let notDeliveredCount = 0;

    console.log("[Broadcast] Attempting to broadcast:", {
      type,
      userCount: userIds.length,
      totalConnectedUsers: userConnections.size,
    });

    const message = JSON.stringify({
      type,
      data: data || {},
      timestamp: new Date().toISOString(),
    });

    userIds.forEach((userId) => {
      const connectionIds = userConnections.get(userId);

      if (connectionIds && connectionIds.size > 0) {
        let userDelivered = false;
        let connectionsSent = 0;

        // Send to all connections for this user
        connectionIds.forEach((connectionId) => {
          const client = clients.get(connectionId);
          if (client) {
            try {
              client.ws.send(message);
              userDelivered = true;
              connectionsSent++;
            } catch (sendError) {
              console.error(
                `[Broadcast] Error sending to ${userId}:`,
                sendError,
              );
            }
          }
        });

        if (userDelivered) {
          delivered += connectionsSent;
        } else {
          notDeliveredCount++;
        }
      } else {
        notDeliveredCount++;
      }
    });

    return Response.json({
      success: true,
      delivered,
      total: userIds.length,
      notDelivered: notDeliveredCount,
    });
  } catch (e) {
    console.error(`[Broadcast Error] from ${clientIp}:`, e);
    return Response.json(
      {
        success: false,
        error: "Internal error",
      },
      { status: 500 },
    );
  }
}
