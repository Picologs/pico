import type { RateLimit } from "@pico/types";
import {
  HTTP_RATE_LIMIT,
  HTTP_RATE_WINDOW,
  WS_RATE_LIMIT,
  WS_RATE_WINDOW,
} from "../config/constants";

// Rate limiting storage
export const httpRateLimits = new Map<string, RateLimit>();
export const wsRateLimits = new Map<string, RateLimit>();

/**
 * Check if an IP address is localhost
 */
function isLocalhost(ip: string): boolean {
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "::ffff:127.0.0.1" ||
    ip === "localhost"
  );
}

/**
 * Check HTTP rate limit for an IP address
 * Note: Localhost connections are never rate limited in development
 */
export function checkHttpRateLimit(ip: string): boolean {
  // Never rate limit localhost connections
  if (isLocalhost(ip)) {
    return true;
  }
  const now = Date.now();
  const limit = httpRateLimits.get(ip);

  if (!limit || now > limit.resetTime) {
    // New window
    httpRateLimits.set(ip, { count: 1, resetTime: now + HTTP_RATE_WINDOW });
    return true;
  }

  if (limit.count >= HTTP_RATE_LIMIT) {
    return false; // Rate limited
  }

  limit.count++;
  return true;
}

/**
 * Check WebSocket rate limit for a user/connection
 * Note: Only IP addresses (not user IDs) from localhost are exempted from rate limiting
 */
export function checkWsRateLimit(
  key: string,
  maxLimit: number = WS_RATE_LIMIT,
): boolean {
  // Only exempt localhost IPs, not user IDs
  // User IDs (Discord IDs) are always rate limited regardless of origin
  // IP addresses look like: 127.0.0.1, ::1, ::ffff:127.0.0.1
  // Discord IDs look like: 18-digit numbers or test-discord-xxxxx
  const isIpAddress = /^[\d.:]+$/.test(key) || key === "localhost";
  if (isIpAddress && isLocalhost(key)) {
    return true;
  }

  const now = Date.now();
  const limit = wsRateLimits.get(key);

  if (!limit || now > limit.resetTime) {
    // New window
    wsRateLimits.set(key, { count: 1, resetTime: now + WS_RATE_WINDOW });
    return true;
  }

  if (limit.count >= maxLimit) {
    return false; // Rate limited
  }

  limit.count++;
  return true;
}

/**
 * Clean up expired rate limit entries
 */
function cleanupRateLimits() {
  const now = Date.now();

  for (const [key, limit] of httpRateLimits.entries()) {
    if (now > limit.resetTime) {
      httpRateLimits.delete(key);
    }
  }

  for (const [key, limit] of wsRateLimits.entries()) {
    if (now > limit.resetTime) {
      wsRateLimits.delete(key);
    }
  }
}

// Clean up every 5 minutes
setInterval(cleanupRateLimits, 5 * 60 * 1000);
