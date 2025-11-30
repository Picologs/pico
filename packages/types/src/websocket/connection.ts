/**
 * WebSocket Connection Types
 *
 * Type definitions for WebSocket connection state, authentication,
 * and runtime metrics tracking.
 *
 * @module types/websocket/connection
 */

// ============================================================================
// Connection State Types
// ============================================================================

/**
 * WebSocket message data type stored per connection
 * Used by Bun's native WebSocket implementation
 */
export type WebSocketData = {
  connectionId: string;
  userId: string | null;
  clientIp: string;
  registrationTimeout?: ReturnType<typeof setTimeout>;
  authOnly?: boolean; // Mark auth-only connections
};

/**
 * Client connection info
 * Extended metadata for active connections
 */
export interface ClientInfo {
  userId: string;
  ws: any;
  ip: string;
  metadata: Record<string, any>;
}

// ============================================================================
// Authentication Types
// ============================================================================

/**
 * JWT verification result for WebSocket connections
 * Extends base JWTPayload with WebSocket-specific fields
 */
export interface WebSocketJWTPayload {
  userId: string; // Discord ID
  type: "websocket";
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

/**
 * Auth session for desktop OAuth flow
 * Temporary session linking OTP to JWT
 */
export interface AuthSession {
  otp: string;
  jwt: string;
  createdAt: number;
}

// ============================================================================
// Metrics & Rate Limiting Types
// ============================================================================

/**
 * Bandwidth metrics tracking per connection
 */
export interface BandwidthMetrics {
  messagesSent: number;
  messagesSkippedOffline: number;
  lastResetTime: number;
}

/**
 * Rate limit tracking per connection/IP
 */
export interface RateLimit {
  count: number;
  resetTime: number;
}
