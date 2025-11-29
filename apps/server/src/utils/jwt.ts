import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/constants";
import type { WebSocketJWTPayload } from "@pico/types";

/**
 * Verify and decode a WebSocket JWT token
 * @param token - The JWT token to verify
 * @returns Decoded payload with userId if valid, null if invalid
 */
export function verifyWebSocketToken(token: string): { userId: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: "picologs-website",
      audience: "picologs-websocket",
    }) as WebSocketJWTPayload;

    // Verify payload structure
    if (!decoded.userId || decoded.type !== "websocket") {
      console.error("[JWT] Invalid token payload structure");
      return null;
    }

    return { userId: decoded.userId };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      console.error("[JWT] Token expired:", error.message);
    } else if (error instanceof jwt.JsonWebTokenError) {
      console.error("[JWT] Invalid token:", error.message);
    } else {
      console.error("[JWT] Token verification failed:", error);
    }
    return null;
  }
}
