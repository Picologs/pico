/**
 * WebSocket Connection Types Runtime Tests
 *
 * Tests cover:
 * - Connection state type validation
 * - Authentication payload structure
 * - Metrics and rate limiting types
 * - JSON serialization compatibility
 */

import { describe, it, expect } from "vitest";
import type {
  WebSocketData,
  ClientInfo,
  WebSocketJWTPayload,
  AuthSession,
  BandwidthMetrics,
  RateLimit,
} from "./connection.js";

// ============================================================================
// Helper Functions
// ============================================================================

function jsonRoundTrip<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// ============================================================================
// WebSocketData Tests
// ============================================================================

describe("WebSocket Connection - WebSocketData", () => {
  it("should create minimal WebSocketData for unauthenticated connection", () => {
    const data: WebSocketData = {
      connectionId: "conn-123",
      userId: null,
      clientIp: "127.0.0.1",
    };

    expect(data.connectionId).toBe("conn-123");
    expect(data.userId).toBeNull();
    expect(data.clientIp).toBe("127.0.0.1");
    expect(data.registrationTimeout).toBeUndefined();
    expect(data.authOnly).toBeUndefined();
  });

  it("should create WebSocketData for authenticated connection", () => {
    const data: WebSocketData = {
      connectionId: "conn-456",
      userId: "discord-123456789",
      clientIp: "192.168.1.1",
    };

    expect(data.connectionId).toBe("conn-456");
    expect(data.userId).toBe("discord-123456789");
    expect(data.clientIp).toBe("192.168.1.1");
  });

  it("should support authOnly flag for desktop OAuth", () => {
    const data: WebSocketData = {
      connectionId: "conn-789",
      userId: null,
      clientIp: "10.0.0.1",
      authOnly: true,
    };

    expect(data.authOnly).toBe(true);
  });

  it("should support registrationTimeout", () => {
    const timeout = setTimeout(() => {}, 30000);
    const data: WebSocketData = {
      connectionId: "conn-999",
      userId: null,
      clientIp: "172.16.0.1",
      registrationTimeout: timeout,
    };

    expect(data.registrationTimeout).toBeDefined();
    clearTimeout(timeout);
  });

  it("should handle IPv6 addresses", () => {
    const data: WebSocketData = {
      connectionId: "conn-ipv6",
      userId: null,
      clientIp: "::1",
    };

    expect(data.clientIp).toBe("::1");
  });

  it("should handle forwarded IP addresses", () => {
    const data: WebSocketData = {
      connectionId: "conn-fwd",
      userId: "user-123",
      clientIp: "203.0.113.0",
    };

    expect(data.clientIp).toBe("203.0.113.0");
  });
});

// ============================================================================
// ClientInfo Tests
// ============================================================================

describe("WebSocket Connection - ClientInfo", () => {
  it("should create ClientInfo with minimal metadata", () => {
    const info: ClientInfo = {
      userId: "discord-123",
      ws: {},
      ip: "127.0.0.1",
      metadata: {},
    };

    expect(info.userId).toBe("discord-123");
    expect(info.ip).toBe("127.0.0.1");
    expect(info.metadata).toEqual({});
  });

  it("should support rich metadata", () => {
    const info: ClientInfo = {
      userId: "discord-456",
      ws: {},
      ip: "192.168.1.100",
      metadata: {
        platform: "desktop",
        version: "1.0.0",
        os: "Windows",
        connectedAt: "2025-01-01T00:00:00Z",
      },
    };

    expect(info.metadata.platform).toBe("desktop");
    expect(info.metadata.version).toBe("1.0.0");
    expect(info.metadata.os).toBe("Windows");
  });

  it("should serialize metadata correctly", () => {
    const info: ClientInfo = {
      userId: "user-1",
      ws: {}, // ws won't serialize but that's okay
      ip: "10.0.0.1",
      metadata: {
        custom: "value",
        nested: {
          data: [1, 2, 3],
        },
      },
    };

    const serialized = JSON.stringify(info.metadata);
    const deserialized = JSON.parse(serialized);

    expect(deserialized.custom).toBe("value");
    expect(deserialized.nested.data).toEqual([1, 2, 3]);
  });
});

// ============================================================================
// WebSocketJWTPayload Tests
// ============================================================================

describe("WebSocket Connection - WebSocketJWTPayload", () => {
  it("should create minimal JWT payload", () => {
    const payload: WebSocketJWTPayload = {
      userId: "discord-123456789",
      type: "websocket",
    };

    expect(payload.userId).toBe("discord-123456789");
    expect(payload.type).toBe("websocket");
  });

  it("should create full JWT payload with standard claims", () => {
    const now = Math.floor(Date.now() / 1000);
    const payload: WebSocketJWTPayload = {
      userId: "discord-987654321",
      type: "websocket",
      iat: now,
      exp: now + 3600,
      iss: "picologs-server",
      aud: "picologs-client",
    };

    expect(payload.userId).toBe("discord-987654321");
    expect(payload.type).toBe("websocket");
    expect(payload.iat).toBe(now);
    expect(payload.exp).toBe(now + 3600);
    expect(payload.iss).toBe("picologs-server");
    expect(payload.aud).toBe("picologs-client");
  });

  it("should survive JSON round-trip", () => {
    const payload: WebSocketJWTPayload = {
      userId: "discord-111",
      type: "websocket",
      iat: 1609459200,
      exp: 1609462800,
      iss: "test-issuer",
      aud: "test-audience",
    };

    const roundTripped = jsonRoundTrip(payload);

    expect(roundTripped).toEqual(payload);
    expect(roundTripped.userId).toBe("discord-111");
    expect(roundTripped.type).toBe("websocket");
  });

  it("should validate type is always websocket", () => {
    const payload: WebSocketJWTPayload = {
      userId: "discord-222",
      type: "websocket", // This must be 'websocket' literal
    };

    expect(payload.type).toBe("websocket");
  });
});

// ============================================================================
// AuthSession Tests
// ============================================================================

describe("WebSocket Connection - AuthSession", () => {
  it("should create auth session for desktop OAuth", () => {
    const session: AuthSession = {
      otp: "123456",
      jwt: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      createdAt: Date.now(),
    };

    expect(session.otp).toBe("123456");
    expect(session.jwt).toBeDefined();
    expect(session.createdAt).toBeGreaterThan(0);
  });

  it("should support 6-digit OTP codes", () => {
    const session: AuthSession = {
      otp: "000000",
      jwt: "jwt-token",
      createdAt: Date.now(),
    };

    expect(session.otp).toHaveLength(6);
    expect(session.otp).toMatch(/^\d{6}$/);
  });

  it("should track creation timestamp", () => {
    const now = Date.now();
    const session: AuthSession = {
      otp: "999999",
      jwt: "test-jwt",
      createdAt: now,
    };

    expect(session.createdAt).toBe(now);
    expect(typeof session.createdAt).toBe("number");
  });

  it("should survive JSON round-trip", () => {
    const session: AuthSession = {
      otp: "555555",
      jwt: "test-jwt-token",
      createdAt: 1609459200000,
    };

    const roundTripped = jsonRoundTrip(session);

    expect(roundTripped).toEqual(session);
    expect(roundTripped.otp).toBe("555555");
  });

  it("should calculate expiration time correctly", () => {
    const createdAt = Date.now();
    const expiresInMs = 5 * 60 * 1000; // 5 minutes
    const expiresAt = createdAt + expiresInMs;

    const session: AuthSession = {
      otp: "111111",
      jwt: "jwt",
      createdAt,
    };

    // Session should be valid within 5 minutes
    const isExpired = Date.now() > expiresAt;
    expect(isExpired).toBe(false);
  });
});

// ============================================================================
// BandwidthMetrics Tests
// ============================================================================

describe("WebSocket Connection - BandwidthMetrics", () => {
  it("should initialize bandwidth metrics", () => {
    const metrics: BandwidthMetrics = {
      messagesSent: 0,
      messagesSkippedOffline: 0,
      lastResetTime: Date.now(),
    };

    expect(metrics.messagesSent).toBe(0);
    expect(metrics.messagesSkippedOffline).toBe(0);
    expect(metrics.lastResetTime).toBeGreaterThan(0);
  });

  it("should track sent messages", () => {
    const metrics: BandwidthMetrics = {
      messagesSent: 100,
      messagesSkippedOffline: 10,
      lastResetTime: Date.now(),
    };

    expect(metrics.messagesSent).toBe(100);
    expect(metrics.messagesSkippedOffline).toBe(10);
  });

  it("should handle high message counts", () => {
    const metrics: BandwidthMetrics = {
      messagesSent: 1_000_000,
      messagesSkippedOffline: 50_000,
      lastResetTime: Date.now(),
    };

    expect(metrics.messagesSent).toBe(1_000_000);
    expect(metrics.messagesSkippedOffline).toBe(50_000);
  });

  it("should survive JSON round-trip", () => {
    const metrics: BandwidthMetrics = {
      messagesSent: 42,
      messagesSkippedOffline: 7,
      lastResetTime: 1609459200000,
    };

    const roundTripped = jsonRoundTrip(metrics);

    expect(roundTripped).toEqual(metrics);
  });

  it("should support metrics reset tracking", () => {
    const now = Date.now();
    const metrics: BandwidthMetrics = {
      messagesSent: 0,
      messagesSkippedOffline: 0,
      lastResetTime: now,
    };

    const resetInterval = 60 * 1000; // 1 minute
    const shouldReset = Date.now() - metrics.lastResetTime > resetInterval;

    // Just created, should not need reset yet
    expect(shouldReset).toBe(false);
  });

  it("should calculate skip rate", () => {
    const metrics: BandwidthMetrics = {
      messagesSent: 100,
      messagesSkippedOffline: 25,
      lastResetTime: Date.now(),
    };

    const total = metrics.messagesSent + metrics.messagesSkippedOffline;
    const skipRate = (metrics.messagesSkippedOffline / total) * 100;

    expect(skipRate).toBe(20); // 25 out of 125 = 20%
  });
});

// ============================================================================
// RateLimit Tests
// ============================================================================

describe("WebSocket Connection - RateLimit", () => {
  it("should initialize rate limit", () => {
    const rateLimit: RateLimit = {
      count: 0,
      resetTime: Date.now() + 60000, // 1 minute from now
    };

    expect(rateLimit.count).toBe(0);
    expect(rateLimit.resetTime).toBeGreaterThan(Date.now());
  });

  it("should track request count", () => {
    const rateLimit: RateLimit = {
      count: 50,
      resetTime: Date.now() + 60000,
    };

    expect(rateLimit.count).toBe(50);
  });

  it("should determine if limit is exceeded", () => {
    const maxRequests = 100;
    const rateLimit: RateLimit = {
      count: 150,
      resetTime: Date.now() + 60000,
    };

    const isExceeded = rateLimit.count > maxRequests;
    expect(isExceeded).toBe(true);
  });

  it("should check if rate limit has expired", () => {
    const pastTime = Date.now() - 60000; // 1 minute ago
    const rateLimit: RateLimit = {
      count: 100,
      resetTime: pastTime,
    };

    const hasExpired = Date.now() > rateLimit.resetTime;
    expect(hasExpired).toBe(true);
  });

  it("should survive JSON round-trip", () => {
    const rateLimit: RateLimit = {
      count: 25,
      resetTime: 1609459200000,
    };

    const roundTripped = jsonRoundTrip(rateLimit);

    expect(roundTripped).toEqual(rateLimit);
  });

  it("should handle zero count", () => {
    const rateLimit: RateLimit = {
      count: 0,
      resetTime: Date.now() + 60000,
    };

    expect(rateLimit.count).toBe(0);
  });

  it("should calculate time remaining until reset", () => {
    const resetTime = Date.now() + 30000; // 30 seconds from now
    const rateLimit: RateLimit = {
      count: 50,
      resetTime,
    };

    const timeRemaining = rateLimit.resetTime - Date.now();
    expect(timeRemaining).toBeGreaterThan(0);
    expect(timeRemaining).toBeLessThanOrEqual(30000);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("WebSocket Connection - Integration", () => {
  it("should create complete connection state for authenticated user", () => {
    const wsData: WebSocketData = {
      connectionId: "conn-123",
      userId: "discord-123",
      clientIp: "192.168.1.1",
    };

    const clientInfo: ClientInfo = {
      userId: "discord-123",
      ws: {},
      ip: "192.168.1.1",
      metadata: {
        platform: "desktop",
        version: "1.0.0",
      },
    };

    const metrics: BandwidthMetrics = {
      messagesSent: 0,
      messagesSkippedOffline: 0,
      lastResetTime: Date.now(),
    };

    const rateLimit: RateLimit = {
      count: 0,
      resetTime: Date.now() + 60000,
    };

    expect(wsData.userId).toBe(clientInfo.userId);
    expect(wsData.clientIp).toBe(clientInfo.ip);
    expect(metrics.messagesSent).toBe(0);
    expect(rateLimit.count).toBe(0);
  });

  it("should create OAuth session for desktop app", () => {
    const session: AuthSession = {
      otp: "123456",
      jwt: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      createdAt: Date.now(),
    };

    const wsData: WebSocketData = {
      connectionId: "conn-oauth",
      userId: null,
      clientIp: "127.0.0.1",
      authOnly: true,
    };

    expect(session.otp).toHaveLength(6);
    expect(wsData.authOnly).toBe(true);
    expect(wsData.userId).toBeNull();
  });

  it("should handle connection upgrade from unauth to auth", () => {
    // Initial unauthenticated state
    let wsData: WebSocketData = {
      connectionId: "conn-upgrade",
      userId: null,
      clientIp: "10.0.0.1",
    };

    expect(wsData.userId).toBeNull();

    // After authentication
    wsData = {
      ...wsData,
      userId: "discord-789",
    };

    expect(wsData.userId).toBe("discord-789");
    expect(wsData.connectionId).toBe("conn-upgrade");
  });
});
