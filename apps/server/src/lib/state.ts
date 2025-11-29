/**
 * Centralized in-memory state management
 * Simple Maps for all connection and session tracking
 */

import type { ServerWebSocket } from "bun";

// Connection state
export interface Client {
  userId: string;
  ws: ServerWebSocket<any>;
  ip: string;
  metadata: Record<string, any>;
}

export const clients = new Map<string, Client>();
export const userConnections = new Map<string, Set<string>>();
export const connectionsPerIp = new Map<string, number>();

// Auth sessions for OAuth flow
export interface AuthSession {
  otp: string;
  jwt: string;
  createdAt: number;
}

export const authSessions = new Map<string, AuthSession>();
export const authSessionOwners = new Map<string, string>(); // sessionId -> connectionId

// Rate limiting
export interface RateLimit {
  count: number;
  resetTime: number;
}

export const rateLimits = new Map<string, RateLimit>();

// Failed login attempt tracking (per IP)
export interface FailedLoginAttempts {
  count: number;
  firstAttempt: number;
  blockedUntil?: number;
}

export const failedLoginAttempts = new Map<string, FailedLoginAttempts>();

// Login throttling constants
export const LOGIN_THROTTLE = {
  MAX_ATTEMPTS: 5, // Max failed attempts before blocking
  WINDOW_MS: 15 * 60 * 1000, // 15-minute window for counting attempts
  BLOCK_DURATION_MS: 30 * 60 * 1000, // 30-minute block after exceeding limit
};

/**
 * Check if IP is blocked due to too many failed login attempts
 * @param ip - IP address to check
 * @returns Object with blocked status and time remaining if blocked
 */
export function isLoginBlocked(ip: string): {
  blocked: boolean;
  blockedFor?: number;
} {
  const attempts = failedLoginAttempts.get(ip);
  if (!attempts) return { blocked: false };

  const now = Date.now();

  // Check if currently blocked
  if (attempts.blockedUntil && now < attempts.blockedUntil) {
    return { blocked: true, blockedFor: attempts.blockedUntil - now };
  }

  // Check if window has expired - reset if so
  if (now - attempts.firstAttempt > LOGIN_THROTTLE.WINDOW_MS) {
    failedLoginAttempts.delete(ip);
    return { blocked: false };
  }

  return { blocked: false };
}

/**
 * Record a failed login attempt for an IP
 * @param ip - IP address that failed to authenticate
 * @returns Whether the IP is now blocked
 */
export function recordFailedLogin(ip: string): boolean {
  const now = Date.now();
  const existing = failedLoginAttempts.get(ip);

  if (!existing || now - existing.firstAttempt > LOGIN_THROTTLE.WINDOW_MS) {
    // Start fresh window
    failedLoginAttempts.set(ip, { count: 1, firstAttempt: now });
    return false;
  }

  // Increment count
  existing.count++;

  // Check if should block
  if (existing.count >= LOGIN_THROTTLE.MAX_ATTEMPTS) {
    existing.blockedUntil = now + LOGIN_THROTTLE.BLOCK_DURATION_MS;
    console.log(
      `[Auth] IP ${ip} blocked for ${LOGIN_THROTTLE.BLOCK_DURATION_MS / 60000} minutes after ${existing.count} failed attempts`,
    );
    return true;
  }

  return false;
}

/**
 * Clear failed login attempts for an IP (call on successful login)
 * @param ip - IP address to clear
 */
export function clearFailedLogins(ip: string): void {
  failedLoginAttempts.delete(ip);
}

// Cleanup expired auth sessions and login attempts every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    const SESSION_TIMEOUT = 5 * 60 * 1000;

    // Cleanup auth sessions
    for (const [sessionId, session] of authSessions.entries()) {
      if (now - session.createdAt > SESSION_TIMEOUT) {
        authSessions.delete(sessionId);
        authSessionOwners.delete(sessionId);
      }
    }

    // Cleanup expired login attempt records
    for (const [ip, attempts] of failedLoginAttempts.entries()) {
      // Remove if block has expired and window has passed
      const windowExpired =
        now - attempts.firstAttempt > LOGIN_THROTTLE.WINDOW_MS;
      const blockExpired =
        !attempts.blockedUntil || now > attempts.blockedUntil;
      if (windowExpired && blockExpired) {
        failedLoginAttempts.delete(ip);
      }
    }
  },
  5 * 60 * 1000,
);
