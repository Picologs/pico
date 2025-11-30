import type { ClientInfo, AuthSession, BandwidthMetrics } from "@pico/types";
import { SESSION_TIMEOUT } from "../config/constants";

/**
 * Store client connections
 * Map: connectionId → { userId, ws, ip, metadata }
 */
export const clients = new Map<string, ClientInfo>();

/**
 * Map userId to all their active connection IDs (supports multiple connections per user)
 * Map: userId → Set<connectionId>
 */
export const userConnections = new Map<string, Set<string>>();

/**
 * Pending desktop auth sessions for OAuth flow
 * Map: sessionId → { otp, jwt, createdAt }
 */
export const pendingAuthSessions = new Map<string, AuthSession>();

/**
 * SECURITY: OAuth session ownership tracking for CSRF protection
 * Prevents attackers from hijacking OAuth callbacks by validating session ownership
 * Map: sessionId → connectionId
 */
export const authSessionConnections = new Map<string, string>();

/**
 * Connection limits per IP address for DDoS protection
 * Map: ip → connectionCount
 */
export const connectionsPerIp = new Map<string, number>();

/**
 * BANDWIDTH OPTIMIZATION: Track messages sent vs skipped for offline users
 * Logs hourly savings from online-only broadcasting
 */
export const bandwidthMetrics: BandwidthMetrics = {
  messagesSent: 0,
  messagesSkippedOffline: 0,
  lastResetTime: Date.now(),
};

/**
 * Add a client connection
 */
export function addClient(connectionId: string, clientInfo: ClientInfo): void {
  clients.set(connectionId, clientInfo);

  // Track userId -> connectionIds mapping
  if (!userConnections.has(clientInfo.userId)) {
    userConnections.set(clientInfo.userId, new Set());
  }
  userConnections.get(clientInfo.userId)!.add(connectionId);
}

/**
 * Remove a client connection
 */
export function removeClient(connectionId: string): ClientInfo | undefined {
  const client = clients.get(connectionId);
  if (client) {
    clients.delete(connectionId);

    // Remove from userConnections
    const userConns = userConnections.get(client.userId);
    if (userConns) {
      userConns.delete(connectionId);
      if (userConns.size === 0) {
        userConnections.delete(client.userId);
      }
    }
  }
  return client;
}

/**
 * Get all connection IDs for a user
 */
export function getUserConnections(userId: string): Set<string> | undefined {
  return userConnections.get(userId);
}

/**
 * Check if a user is online
 */
export function isUserOnline(userId: string): boolean {
  return userConnections.has(userId);
}

/**
 * Increment connection count for an IP
 */
export function incrementIpConnections(ip: string): number {
  const count = (connectionsPerIp.get(ip) || 0) + 1;
  connectionsPerIp.set(ip, count);
  return count;
}

/**
 * Decrement connection count for an IP
 */
export function decrementIpConnections(ip: string): void {
  const count = connectionsPerIp.get(ip) || 0;
  if (count <= 1) {
    connectionsPerIp.delete(ip);
  } else {
    connectionsPerIp.set(ip, count - 1);
  }
}

/**
 * Clean up expired auth sessions (runs every 5 minutes)
 * Removes sessions older than SESSION_TIMEOUT and their ownership tracking
 */
function cleanupAuthSessions() {
  const now = Date.now();

  for (const [sessionId, session] of pendingAuthSessions.entries()) {
    if (now - session.createdAt > SESSION_TIMEOUT) {
      pendingAuthSessions.delete(sessionId);
      // SECURITY: Also clean up session ownership tracking
      authSessionConnections.delete(sessionId);
      console.log(`[Auth] Expired session ${sessionId}`);
    }
  }
}

// Clean up expired auth sessions every 5 minutes
setInterval(cleanupAuthSessions, 5 * 60 * 1000);

/**
 * Log bandwidth savings metrics and reset counters (runs every hour)
 * Shows percentage of messages saved by not broadcasting to offline users
 */
function logBandwidthMetrics() {
  const total =
    bandwidthMetrics.messagesSent + bandwidthMetrics.messagesSkippedOffline;
  if (total > 0) {
    const savingsPercent = (
      (bandwidthMetrics.messagesSkippedOffline / total) *
      100
    ).toFixed(1);
    console.log(
      `[Bandwidth Metrics] Sent: ${bandwidthMetrics.messagesSent}, Skipped offline: ${bandwidthMetrics.messagesSkippedOffline} (${savingsPercent}% bandwidth saved)`,
    );
  }
  // Reset counters
  bandwidthMetrics.messagesSent = 0;
  bandwidthMetrics.messagesSkippedOffline = 0;
  bandwidthMetrics.lastResetTime = Date.now();
}

// Log bandwidth savings every hour
setInterval(logBandwidthMetrics, 60 * 60 * 1000);
