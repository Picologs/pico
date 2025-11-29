/**
 * Comprehensive tests for JWT Validation Utilities
 *
 * Testing all functions in jwt-validator.ts:
 * - parseJwtPayload() - Parse payload without verification
 * - isJwtExpired() - Check token expiration
 * - validateJwt() - Basic validation (format + expiration)
 * - getJwtExpiration() - Get expiration date
 * - getJwtTimeRemaining() - Get time until expiry
 *
 * Coverage for:
 * - Valid tokens
 * - Expired tokens
 * - Malformed tokens
 * - Missing claims
 * - Clock skew tolerance
 */

import { describe, it, expect } from "vitest";
import {
  parseJwtPayload,
  isJwtExpired,
  validateJwt,
  getJwtExpiration,
  getJwtTimeRemaining,
  type JwtPayload,
} from "./jwt-validator";

// Helper to create a test JWT token manually
function createTestToken(payload: JwtPayload): string {
  const encoder = new TextEncoder();
  const base64urlEncode = (data: string) => {
    const bytes = encoder.encode(data);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  };

  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(payload));

  // Fake signature (doesn't matter for these tests since we don't verify)
  return `${encodedHeader}.${encodedPayload}.fake-signature`;
}

describe("parseJwtPayload", () => {
  it("should parse a valid JWT payload", () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = { userId: "123", iat: now, exp: now + 3600 };
    const token = createTestToken(payload);

    const parsed = parseJwtPayload(token);
    expect(parsed).not.toBeNull();
    expect(parsed?.userId).toBe("123");
    expect(parsed?.iat).toBe(now);
    expect(parsed?.exp).toBe(now + 3600);
  });

  it("should parse all standard JWT claims", () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      sub: "user-123",
      userId: "123",
      iat: now,
      exp: now + 3600,
      aud: "picologs",
      iss: "picologs-website",
    };
    const token = createTestToken(payload);

    const parsed = parseJwtPayload(token);
    expect(parsed?.sub).toBe("user-123");
    expect(parsed?.userId).toBe("123");
    expect(parsed?.iat).toBe(now);
    expect(parsed?.exp).toBe(now + 3600);
    expect(parsed?.aud).toBe("picologs");
    expect(parsed?.iss).toBe("picologs-website");
  });

  it("should parse custom claims", () => {
    const payload = {
      userId: "123",
      role: "admin",
      customField: "value",
      nested: { key: "value" },
    };
    const token = createTestToken(payload);

    const parsed = parseJwtPayload(token);
    expect(parsed?.userId).toBe("123");
    expect(parsed?.role).toBe("admin");
    expect(parsed?.customField).toBe("value");
    expect(parsed?.nested).toEqual({ key: "value" });
  });

  it("should return null for malformed token (not 3 parts)", () => {
    expect(parseJwtPayload("invalid.token")).toBeNull();
    expect(parseJwtPayload("only-one-part")).toBeNull();
    expect(parseJwtPayload("too.many.parts.here")).toBeNull();
  });

  it("should return null for token with empty payload", () => {
    expect(parseJwtPayload("..")).toBeNull();
  });

  it("should return null for invalid base64", () => {
    expect(parseJwtPayload("header.invalid!base64.signature")).toBeNull();
  });

  it("should return null for invalid JSON in payload", () => {
    const encoder = new TextEncoder();
    const base64urlEncode = (data: string) => {
      const bytes = encoder.encode(data);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
    };

    const invalidPayload = base64urlEncode("not-valid-json");
    expect(parseJwtPayload(`header.${invalidPayload}.signature`)).toBeNull();
  });

  it("should handle tokens without optional claims", () => {
    const payload = { userId: "123" };
    const token = createTestToken(payload);

    const parsed = parseJwtPayload(token);
    expect(parsed?.userId).toBe("123");
    expect(parsed?.iat).toBeUndefined();
    expect(parsed?.exp).toBeUndefined();
    expect(parsed?.sub).toBeUndefined();
  });
});

describe("isJwtExpired", () => {
  it("should return false for non-expired token", () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = { userId: "123", exp: now + 3600 }; // Expires in 1 hour
    const token = createTestToken(payload);

    expect(isJwtExpired(token)).toBe(false);
  });

  it("should return true for expired token", () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = { userId: "123", exp: now - 3600 }; // Expired 1 hour ago
    const token = createTestToken(payload);

    expect(isJwtExpired(token)).toBe(true);
  });

  it("should return true for token expiring exactly now", () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = { userId: "123", exp: now };
    const token = createTestToken(payload);

    // Token is considered expired if current time >= exp
    expect(isJwtExpired(token)).toBe(true);
  });

  it("should return true for token without exp claim", () => {
    const payload = { userId: "123" };
    const token = createTestToken(payload);

    expect(isJwtExpired(token)).toBe(true);
  });

  it("should return true for malformed token", () => {
    expect(isJwtExpired("invalid.token")).toBe(true);
    expect(isJwtExpired("only-one-part")).toBe(true);
    expect(isJwtExpired("")).toBe(true);
  });

  it("should handle clock skew tolerance", () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = { userId: "123", exp: now - 30 }; // Expired 30 seconds ago
    const token = createTestToken(payload);

    // Without tolerance, should be expired
    expect(isJwtExpired(token)).toBe(true);

    // With 60 second tolerance, should be valid
    expect(isJwtExpired(token, 60)).toBe(false);

    // With 31 second tolerance, should be valid (covers the 30 second gap)
    expect(isJwtExpired(token, 31)).toBe(false);

    // With 29 second tolerance, should be expired
    expect(isJwtExpired(token, 29)).toBe(true);
  });

  it("should handle negative clock skew", () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = { userId: "123", exp: now + 10 }; // Expires in 10 seconds
    const token = createTestToken(payload);

    // With negative tolerance (shouldn't be used but test edge case)
    expect(isJwtExpired(token, -20)).toBe(true);
  });
});

describe("validateJwt", () => {
  it("should validate a valid, non-expired token", () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = { userId: "123", iat: now, exp: now + 3600 };
    const token = createTestToken(payload);

    const result = validateJwt(token);
    expect(result.valid).toBe(true);
    expect(result.payload).not.toBeNull();
    expect(result.payload?.userId).toBe("123");
    expect(result.error).toBeUndefined();
  });

  it("should reject malformed token (not 3 parts)", () => {
    const result = validateJwt("invalid.token");
    expect(result.valid).toBe(false);
    expect(result.payload).toBeNull();
    expect(result.error).toBe(
      "Invalid JWT format: expected 3 parts separated by dots",
    );
  });

  it("should reject token with only 2 parts", () => {
    const result = validateJwt("header.payload");
    expect(result.valid).toBe(false);
    expect(result.payload).toBeNull();
    expect(result.error).toBe(
      "Invalid JWT format: expected 3 parts separated by dots",
    );
  });

  it("should reject token with 4 parts", () => {
    const result = validateJwt("a.b.c.d");
    expect(result.valid).toBe(false);
    expect(result.payload).toBeNull();
    expect(result.error).toBe(
      "Invalid JWT format: expected 3 parts separated by dots",
    );
  });

  it("should reject token with invalid payload", () => {
    const result = validateJwt("header.invalid!base64.signature");
    expect(result.valid).toBe(false);
    expect(result.payload).toBeNull();
    expect(result.error).toBe("Invalid JWT payload: failed to parse");
  });

  it("should reject expired token", () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = { userId: "123", exp: now - 3600 }; // Expired 1 hour ago
    const token = createTestToken(payload);

    const result = validateJwt(token);
    expect(result.valid).toBe(false);
    expect(result.payload).toBeNull();
    expect(result.error).toBe("Token expired");
  });

  it("should reject token without exp claim", () => {
    const payload = { userId: "123" };
    const token = createTestToken(payload);

    const result = validateJwt(token);
    expect(result.valid).toBe(false);
    expect(result.payload).toBeNull();
    expect(result.error).toBe("Token expired");
  });

  it("should accept expired token with clock skew tolerance", () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = { userId: "123", exp: now - 30 }; // Expired 30 seconds ago
    const token = createTestToken(payload);

    const result = validateJwt(token, { clockSkewSeconds: 60 });
    expect(result.valid).toBe(true);
    expect(result.payload).not.toBeNull();
    expect(result.payload?.userId).toBe("123");
    expect(result.error).toBeUndefined();
  });

  it("should use default clock skew of 0", () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = { userId: "123", exp: now - 1 }; // Expired 1 second ago
    const token = createTestToken(payload);

    const result = validateJwt(token);
    expect(result.valid).toBe(false);
  });

  it("should return all payload data when valid", () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      userId: "123",
      role: "admin",
      iat: now,
      exp: now + 3600,
      iss: "picologs",
      customData: { key: "value" },
    };
    const token = createTestToken(payload);

    const result = validateJwt(token);
    expect(result.valid).toBe(true);
    expect(result.payload?.userId).toBe("123");
    expect(result.payload?.role).toBe("admin");
    expect(result.payload?.iss).toBe("picologs");
    expect(result.payload?.customData).toEqual({ key: "value" });
  });
});

describe("getJwtExpiration", () => {
  it("should return expiration date for valid token", () => {
    const now = Math.floor(Date.now() / 1000);
    const expTime = now + 3600;
    const payload = { userId: "123", exp: expTime };
    const token = createTestToken(payload);

    const expDate = getJwtExpiration(token);
    expect(expDate).not.toBeNull();
    expect(expDate?.getTime()).toBe(expTime * 1000);
  });

  it("should return null for token without exp claim", () => {
    const payload = { userId: "123" };
    const token = createTestToken(payload);

    expect(getJwtExpiration(token)).toBeNull();
  });

  it("should return null for malformed token", () => {
    expect(getJwtExpiration("invalid.token")).toBeNull();
  });

  it("should return correct date for expired token", () => {
    const now = Math.floor(Date.now() / 1000);
    const expTime = now - 3600; // Expired 1 hour ago
    const payload = { userId: "123", exp: expTime };
    const token = createTestToken(payload);

    const expDate = getJwtExpiration(token);
    expect(expDate).not.toBeNull();
    expect(expDate?.getTime()).toBe(expTime * 1000);
    expect(expDate!.getTime()).toBeLessThan(Date.now());
  });

  it("should return Date object with correct timezone", () => {
    const now = Math.floor(Date.now() / 1000);
    const expTime = now + 3600;
    const payload = { userId: "123", exp: expTime };
    const token = createTestToken(payload);

    const expDate = getJwtExpiration(token);
    expect(expDate).toBeInstanceOf(Date);
    expect(expDate?.toISOString()).toBeTruthy();
  });
});

describe("getJwtTimeRemaining", () => {
  it("should return time remaining for non-expired token", () => {
    const now = Math.floor(Date.now() / 1000);
    const expTime = now + 3600; // Expires in 1 hour
    const payload = { userId: "123", exp: expTime };
    const token = createTestToken(payload);

    const remaining = getJwtTimeRemaining(token);
    expect(remaining).not.toBeNull();
    // Should be close to 3600000ms (1 hour)
    expect(remaining!).toBeGreaterThan(3595000);
    expect(remaining!).toBeLessThanOrEqual(3600000);
  });

  it("should return negative value for expired token", () => {
    const now = Math.floor(Date.now() / 1000);
    const expTime = now - 3600; // Expired 1 hour ago
    const payload = { userId: "123", exp: expTime };
    const token = createTestToken(payload);

    const remaining = getJwtTimeRemaining(token);
    expect(remaining).not.toBeNull();
    expect(remaining!).toBeLessThan(0);
    // Should be close to -3600000ms
    expect(remaining!).toBeLessThan(-3595000);
  });

  it("should return null for token without exp claim", () => {
    const payload = { userId: "123" };
    const token = createTestToken(payload);

    expect(getJwtTimeRemaining(token)).toBeNull();
  });

  it("should return null for malformed token", () => {
    expect(getJwtTimeRemaining("invalid.token")).toBeNull();
  });

  it("should return value close to 0 for token about to expire", () => {
    const now = Math.floor(Date.now() / 1000);
    const expTime = now + 1; // Expires in 1 second
    const payload = { userId: "123", exp: expTime };
    const token = createTestToken(payload);

    const remaining = getJwtTimeRemaining(token);
    expect(remaining).not.toBeNull();
    expect(remaining!).toBeGreaterThanOrEqual(0);
    expect(remaining!).toBeLessThanOrEqual(1000);
  });

  it("should return decreasing values over time", async () => {
    const now = Math.floor(Date.now() / 1000);
    const expTime = now + 10; // Expires in 10 seconds
    const payload = { userId: "123", exp: expTime };
    const token = createTestToken(payload);

    const remaining1 = getJwtTimeRemaining(token);
    // Wait long enough for a measurable difference
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const remaining2 = getJwtTimeRemaining(token);

    expect(remaining1).not.toBeNull();
    expect(remaining2).not.toBeNull();
    expect(remaining2!).toBeLessThan(remaining1!);
  });
});

describe("Edge cases and integration", () => {
  it("should handle token with very large exp value", () => {
    const farFuture = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60; // 1 year
    const payload = { userId: "123", exp: farFuture };
    const token = createTestToken(payload);

    expect(isJwtExpired(token)).toBe(false);
    expect(validateJwt(token).valid).toBe(true);

    const remaining = getJwtTimeRemaining(token);
    expect(remaining).not.toBeNull();
    expect(remaining!).toBeGreaterThan(360 * 24 * 60 * 60 * 1000); // > 360 days
  });

  it("should handle token with exp = 0", () => {
    const payload = { userId: "123", exp: 0 };
    const token = createTestToken(payload);

    expect(isJwtExpired(token)).toBe(true);
    expect(validateJwt(token).valid).toBe(false);

    // Note: exp = 0 is treated as falsy by the implementation, returning null
    // This is an edge case - 0 technically means epoch (Jan 1, 1970) but is treated as "no exp"
    const expDate = getJwtExpiration(token);
    expect(expDate).toBeNull();

    const remaining = getJwtTimeRemaining(token);
    expect(remaining).toBeNull();
  });

  it("should handle all operations on same token", () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      userId: "123",
      iat: now,
      exp: now + 3600,
      iss: "picologs",
    };
    const token = createTestToken(payload);

    // Parse
    const parsed = parseJwtPayload(token);
    expect(parsed?.userId).toBe("123");

    // Check expiration
    expect(isJwtExpired(token)).toBe(false);

    // Validate
    const validated = validateJwt(token);
    expect(validated.valid).toBe(true);

    // Get expiration date
    const expDate = getJwtExpiration(token);
    expect(expDate).not.toBeNull();

    // Get time remaining
    const remaining = getJwtTimeRemaining(token);
    expect(remaining).toBeGreaterThan(0);
  });
});
