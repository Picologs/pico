/**
 * Server-side JWT token utilities
 *
 * Reusable JWT token generation for WebSocket authentication.
 *
 * @module server/auth/jwt-tokens
 */

import { generateJWT } from "../../auth/jwt.js";
import type { JWTPayload } from "../../auth/jwt.js";

/**
 * WebSocket JWT payload structure
 */
export interface WebSocketJWTPayload extends JWTPayload {
  /** Discord user ID */
  userId: string;
  /** Token type */
  type: "websocket";
}

/**
 * Create WebSocket JWT token for authenticated user
 *
 * Generates a JWT token that can be used to authenticate WebSocket connections.
 * The token is valid for 30 days and includes the user's Discord ID.
 *
 * @param discordId - User's Discord ID
 * @param secret - JWT secret key
 * @param expiresIn - Token expiration time (default: 30d)
 * @returns Signed JWT token
 *
 * @example
 * ```typescript
 * import { createWebSocketJWT } from '@pico/shared/server';
 *
 * const jwtSecret = process.env.JWT_SECRET;
 * const token = await createWebSocketJWT('discord-123456', jwtSecret);
 * console.log('WebSocket token:', token);
 * ```
 */
export async function createWebSocketJWT(
  discordId: string,
  secret: string,
  expiresIn: string | number = "30d",
): Promise<string> {
  return await generateJWT(
    {
      userId: discordId,
      type: "websocket",
    } as WebSocketJWTPayload,
    secret,
    expiresIn,
    {
      issuer: "picologs-website",
      audience: "picologs-websocket",
    },
  );
}
