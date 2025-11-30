/**
 * Tests for rate limiting service
 *
 * Tests rate limiting for HTTP and WebSocket connections including:
 * - Rate limit enforcement
 * - Window reset behavior
 * - Localhost exemptions
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  checkHttpRateLimit,
  checkWsRateLimit,
  httpRateLimits,
  wsRateLimits,
} from "./rate-limiting";

describe("checkHttpRateLimit", () => {
  beforeEach(() => {
    // Clear rate limit state before each test
    httpRateLimits.clear();
  });

  test("should allow first request from new IP", () => {
    expect(checkHttpRateLimit("192.168.1.1")).toBe(true);
  });

  test("should increment count for subsequent requests", () => {
    const ip = "192.168.1.2";
    checkHttpRateLimit(ip);
    checkHttpRateLimit(ip);
    checkHttpRateLimit(ip);

    const limit = httpRateLimits.get(ip);
    expect(limit?.count).toBe(3);
  });

  test("should block after rate limit exceeded", () => {
    const ip = "192.168.1.3";

    // Make 30 requests (the limit)
    for (let i = 0; i < 30; i++) {
      expect(checkHttpRateLimit(ip)).toBe(true);
    }

    // 31st request should be blocked
    expect(checkHttpRateLimit(ip)).toBe(false);
  });

  test("should not rate limit localhost (127.0.0.1)", () => {
    for (let i = 0; i < 100; i++) {
      expect(checkHttpRateLimit("127.0.0.1")).toBe(true);
    }
  });

  test("should not rate limit localhost (::1)", () => {
    for (let i = 0; i < 100; i++) {
      expect(checkHttpRateLimit("::1")).toBe(true);
    }
  });

  test("should not rate limit localhost (::ffff:127.0.0.1)", () => {
    for (let i = 0; i < 100; i++) {
      expect(checkHttpRateLimit("::ffff:127.0.0.1")).toBe(true);
    }
  });

  test("should not rate limit localhost string", () => {
    for (let i = 0; i < 100; i++) {
      expect(checkHttpRateLimit("localhost")).toBe(true);
    }
  });

  test("should reset count after window expires", () => {
    const ip = "192.168.1.4";

    // Exhaust rate limit
    for (let i = 0; i < 30; i++) {
      checkHttpRateLimit(ip);
    }
    expect(checkHttpRateLimit(ip)).toBe(false);

    // Manually expire the window
    const limit = httpRateLimits.get(ip);
    if (limit) {
      limit.resetTime = Date.now() - 1000;
    }

    // Should be allowed again
    expect(checkHttpRateLimit(ip)).toBe(true);
    expect(httpRateLimits.get(ip)?.count).toBe(1);
  });

  test("should track different IPs independently", () => {
    const ip1 = "192.168.1.10";
    const ip2 = "192.168.1.11";

    // Exhaust limit for ip1
    for (let i = 0; i < 30; i++) {
      checkHttpRateLimit(ip1);
    }
    expect(checkHttpRateLimit(ip1)).toBe(false);

    // ip2 should still be allowed
    expect(checkHttpRateLimit(ip2)).toBe(true);
  });
});

describe("checkWsRateLimit", () => {
  beforeEach(() => {
    // Clear rate limit state before each test
    wsRateLimits.clear();
  });

  test("should allow first message from new user", () => {
    expect(checkWsRateLimit("user_123")).toBe(true);
  });

  test("should increment count for subsequent messages", () => {
    const userId = "user_456";
    checkWsRateLimit(userId);
    checkWsRateLimit(userId);
    checkWsRateLimit(userId);

    const limit = wsRateLimits.get(userId);
    expect(limit?.count).toBe(3);
  });

  test("should use custom limit when provided", () => {
    const userId = "user_789";
    const customLimit = 5;

    // Should allow up to custom limit
    for (let i = 0; i < customLimit; i++) {
      expect(checkWsRateLimit(userId, customLimit)).toBe(true);
    }

    // Should block after custom limit
    expect(checkWsRateLimit(userId, customLimit)).toBe(false);
  });

  test("should not rate limit localhost IP addresses", () => {
    // IP-like keys that are localhost should be exempt
    for (let i = 0; i < 200; i++) {
      expect(checkWsRateLimit("127.0.0.1")).toBe(true);
    }
  });

  test("should not rate limit ::1", () => {
    for (let i = 0; i < 200; i++) {
      expect(checkWsRateLimit("::1")).toBe(true);
    }
  });

  test("should rate limit user IDs even if they look numeric", () => {
    const discordId = "123456789012345678";

    // Make many requests
    for (let i = 0; i < 100; i++) {
      checkWsRateLimit(discordId);
    }

    // Should have counted (not exempted)
    const limit = wsRateLimits.get(discordId);
    expect(limit?.count).toBe(100);
  });

  test("should reset count after window expires", () => {
    const userId = "user_expire";

    // Make some requests
    for (let i = 0; i < 50; i++) {
      checkWsRateLimit(userId);
    }

    // Manually expire the window
    const limit = wsRateLimits.get(userId);
    if (limit) {
      limit.resetTime = Date.now() - 1000;
    }

    // Should reset count
    expect(checkWsRateLimit(userId)).toBe(true);
    expect(wsRateLimits.get(userId)?.count).toBe(1);
  });

  test("should track different users independently", () => {
    const user1 = "user_a";
    const user2 = "user_b";

    // Make requests for user1
    for (let i = 0; i < 50; i++) {
      checkWsRateLimit(user1);
    }

    // user2 count should be independent
    checkWsRateLimit(user2);
    checkWsRateLimit(user2);
    expect(wsRateLimits.get(user2)?.count).toBe(2);
  });

  test("should distinguish between IP addresses and user IDs", () => {
    // Localhost IP should be exempt
    expect(checkWsRateLimit("127.0.0.1")).toBe(true);
    expect(wsRateLimits.has("127.0.0.1")).toBe(false); // Not tracked

    // User ID should be tracked
    expect(checkWsRateLimit("test-discord-12345")).toBe(true);
    expect(wsRateLimits.has("test-discord-12345")).toBe(true);
  });
});

describe("Rate Limit Window Behavior", () => {
  beforeEach(() => {
    httpRateLimits.clear();
    wsRateLimits.clear();
  });

  test("should set reset time on first request", () => {
    const now = Date.now();
    checkHttpRateLimit("test_ip");

    const limit = httpRateLimits.get("test_ip");
    expect(limit?.resetTime).toBeGreaterThan(now);
    // Window is 60 seconds (60000ms)
    expect(limit?.resetTime).toBeLessThanOrEqual(now + 61000);
  });

  test("should preserve reset time for subsequent requests in same window", () => {
    checkHttpRateLimit("test_ip_2");
    const firstResetTime = httpRateLimits.get("test_ip_2")?.resetTime;

    checkHttpRateLimit("test_ip_2");
    checkHttpRateLimit("test_ip_2");

    const laterResetTime = httpRateLimits.get("test_ip_2")?.resetTime;
    expect(laterResetTime).toBe(firstResetTime);
  });
});
