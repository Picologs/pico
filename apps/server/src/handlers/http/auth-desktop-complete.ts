/**
 * Desktop Auth Complete endpoint handler
 * Pushes authentication result to desktop via WebSocket
 * Called by website after successful Discord OAuth
 */

import { authSessionOwners, clients, authSessions } from "../../lib/state";

const BROADCAST_API_KEY = process.env.BROADCAST_API_KEY;

interface AuthDesktopCompleteBody {
  sessionId: string;
  jwt: string;
  user: {
    id: string;
    discordId: string;
    username: string;
    avatar: string | null;
    friendCode: string;
  };
}

export async function handleAuthDesktopComplete(
  req: Request,
): Promise<Response> {
  // Authenticate request using the same API key as broadcast
  const authHeader = req.headers.get("Authorization");
  if (!BROADCAST_API_KEY) {
    console.error("[Auth Desktop Complete] BROADCAST_API_KEY not configured");
    return Response.json(
      {
        success: false,
        error: "Service temporarily unavailable",
      },
      { status: 503 },
    );
  }

  if (!authHeader || authHeader !== `Bearer ${BROADCAST_API_KEY}`) {
    console.warn("[Auth Desktop Complete] Unauthorized request");
    return Response.json(
      {
        success: false,
        error: "Unauthorized",
      },
      { status: 401 },
    );
  }

  try {
    const body: AuthDesktopCompleteBody = await req.json();
    const { sessionId, jwt, user } = body;

    // Validate required fields
    if (!sessionId || !jwt || !user) {
      return Response.json(
        {
          success: false,
          error: "Missing required fields: sessionId, jwt, user",
        },
        { status: 400 },
      );
    }

    if (!user.discordId || !user.username) {
      return Response.json(
        {
          success: false,
          error: "Invalid user object: missing discordId or username",
        },
        { status: 400 },
      );
    }

    console.log(
      "[Auth Desktop Complete] Processing auth for session:",
      sessionId,
    );

    // Look up the desktop's connection by sessionId
    const connectionId = authSessionOwners.get(sessionId);
    if (!connectionId) {
      console.warn(
        "[Auth Desktop Complete] Session not found or expired:",
        sessionId,
      );
      return Response.json(
        {
          success: false,
          error: "Session not found or expired",
        },
        { status: 404 },
      );
    }

    // Get the WebSocket connection
    const client = clients.get(connectionId);
    if (!client) {
      console.warn(
        "[Auth Desktop Complete] Connection not found for session:",
        sessionId,
      );
      // Clean up orphaned session
      authSessionOwners.delete(sessionId);
      return Response.json(
        {
          success: false,
          error: "Desktop connection not found",
        },
        { status: 404 },
      );
    }

    // Send desktop_auth_complete to the desktop
    const message = JSON.stringify({
      type: "desktop_auth_complete",
      data: {
        jwt,
        user,
      },
      timestamp: new Date().toISOString(),
    });

    try {
      client.ws.send(message);
      console.log(
        "[Auth Desktop Complete] Sent auth to desktop for session:",
        sessionId,
      );
    } catch (sendError) {
      console.error(
        "[Auth Desktop Complete] Failed to send to desktop:",
        sendError,
      );
      return Response.json(
        {
          success: false,
          error: "Failed to send to desktop",
        },
        { status: 500 },
      );
    }

    // Clean up session after successful delivery
    authSessionOwners.delete(sessionId);
    authSessions.delete(sessionId);

    return Response.json({
      success: true,
      message: "Authentication pushed to desktop",
    });
  } catch (error) {
    console.error("[Auth Desktop Complete] Error:", error);
    return Response.json(
      {
        success: false,
        error: "Internal error",
      },
      { status: 500 },
    );
  }
}
