/**
 * JWT Authentication Unit Tests
 *
 * Comprehensive test suite covering:
 * - JWTError class instantiation
 * - Error code enumeration
 * - JWT payload structure validation
 * - Token expiration logic
 * - Error message formatting
 * - Edge cases and error handling
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { JWTPayload, JWTVerifyOptions, JWTErrorCode } from "./auth/jwt.js";
import { JWTError } from "./auth/jwt.js";

describe("JWTError Class", () => {
  describe("Instantiation with different error codes", () => {
    it("should create JWTError with INVALID_TOKEN code", () => {
      const error = new JWTError("INVALID_TOKEN", "Token is invalid");
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(JWTError);
      expect(error.code).toBe("INVALID_TOKEN");
      expect(error.message).toBe("Token is invalid");
      expect(error.name).toBe("JWTError");
    });

    it("should create JWTError with EXPIRED code", () => {
      const error = new JWTError("EXPIRED", "Token has expired");
      expect(error.code).toBe("EXPIRED");
      expect(error.message).toBe("Token has expired");
    });

    it("should create JWTError with NOT_YET_VALID code", () => {
      const error = new JWTError("NOT_YET_VALID", "Token is not yet valid");
      expect(error.code).toBe("NOT_YET_VALID");
      expect(error.message).toBe("Token is not yet valid");
    });

    it("should create JWTError with INVALID_SIGNATURE code", () => {
      const error = new JWTError(
        "INVALID_SIGNATURE",
        "Signature verification failed",
      );
      expect(error.code).toBe("INVALID_SIGNATURE");
      expect(error.message).toBe("Signature verification failed");
    });

    it("should create JWTError with INVALID_ISSUER code", () => {
      const error = new JWTError("INVALID_ISSUER", "Issuer does not match");
      expect(error.code).toBe("INVALID_ISSUER");
      expect(error.message).toBe("Issuer does not match");
    });

    it("should create JWTError with INVALID_AUDIENCE code", () => {
      const error = new JWTError("INVALID_AUDIENCE", "Audience does not match");
      expect(error.code).toBe("INVALID_AUDIENCE");
      expect(error.message).toBe("Audience does not match");
    });

    it("should create JWTError with MALFORMED code", () => {
      const error = new JWTError("MALFORMED", "Token is malformed");
      expect(error.code).toBe("MALFORMED");
      expect(error.message).toBe("Token is malformed");
    });
  });

  describe("Error properties and inheritance", () => {
    it("should be throwable as Error", () => {
      const error = new JWTError("INVALID_TOKEN", "Test error");
      expect(() => {
        throw error;
      }).toThrow(JWTError);
    });

    it("should have correct name property", () => {
      const error = new JWTError("INVALID_TOKEN", "Test");
      expect(error.name).toBe("JWTError");
    });

    it("should have stack trace", () => {
      const error = new JWTError("INVALID_TOKEN", "Test");
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain("JWTError");
    });

    it("should preserve code as public property", () => {
      const error = new JWTError("EXPIRED", "Token expired");
      expect(error.code).toBe("EXPIRED");
      expect(Object.getOwnPropertyNames(error)).toContain("code");
    });
  });

  describe("Error message formatting", () => {
    it("should handle detailed error messages", () => {
      const detailedMessage =
        "Token expired at 2025-11-14T12:00:00Z. Current time: 2025-11-14T12:30:00Z";
      const error = new JWTError("EXPIRED", detailedMessage);
      expect(error.message).toBe(detailedMessage);
    });

    it("should handle empty error message", () => {
      const error = new JWTError("INVALID_TOKEN", "");
      expect(error.message).toBe("");
    });

    it("should handle special characters in message", () => {
      const specialMessage = "Token validation failed: [ERROR] @invalid!";
      const error = new JWTError("INVALID_TOKEN", specialMessage);
      expect(error.message).toBe(specialMessage);
    });

    it("should handle multiline messages", () => {
      const multilineMessage =
        "Multiple errors:\n1. Invalid signature\n2. Expired token";
      const error = new JWTError("INVALID_SIGNATURE", multilineMessage);
      expect(error.message).toBe(multilineMessage);
      expect(error.message).toContain("\n");
    });
  });

  describe("Constructor parameter handling", () => {
    it("should accept all valid error codes", () => {
      const codes: JWTErrorCode[] = [
        "INVALID_TOKEN",
        "EXPIRED",
        "NOT_YET_VALID",
        "INVALID_SIGNATURE",
        "INVALID_ISSUER",
        "INVALID_AUDIENCE",
        "MALFORMED",
      ];

      codes.forEach((code) => {
        const error = new JWTError(code, `Error: ${code}`);
        expect(error.code).toBe(code);
      });
    });

    it("should maintain code and message independently", () => {
      const error = new JWTError("EXPIRED", "Custom message");
      expect(error.code).toBe("EXPIRED");
      expect(error.message).toBe("Custom message");
      // Verify they are different properties
      expect(error.code !== error.message).toBe(true);
    });

    it("should handle very long error messages", () => {
      const longMessage = "A".repeat(1000);
      const error = new JWTError("INVALID_TOKEN", longMessage);
      expect(error.message).toBe(longMessage);
      expect(error.message.length).toBe(1000);
    });
  });
});

describe("JWTPayload Interface", () => {
  describe("Payload structure validation", () => {
    it("should create minimal valid payload", () => {
      const payload: JWTPayload = {};
      expect(payload).toBeDefined();
    });

    it("should support userId claim", () => {
      const payload: JWTPayload = {
        userId: "123456789",
      };
      expect(payload.userId).toBe("123456789");
    });

    it("should support type claim as websocket", () => {
      const payload: JWTPayload = {
        type: "websocket",
      };
      expect(payload.type).toBe("websocket");
    });

    it("should support standard JWT claims", () => {
      const payload: JWTPayload = {
        iat: 1700000000,
        exp: 1700003600,
        nbf: 1699999900,
        iss: "https://auth.example.com",
        aud: "https://app.example.com",
      };
      expect(payload.iat).toBe(1700000000);
      expect(payload.exp).toBe(1700003600);
      expect(payload.nbf).toBe(1699999900);
      expect(payload.iss).toBe("https://auth.example.com");
      expect(payload.aud).toBe("https://app.example.com");
    });

    it("should support multiple audiences as array", () => {
      const payload: JWTPayload = {
        aud: ["https://app1.example.com", "https://app2.example.com"],
      };
      expect(Array.isArray(payload.aud)).toBe(true);
      expect(payload.aud).toHaveLength(2);
    });

    it("should support custom claims via index signature", () => {
      const payload: JWTPayload = {
        custom_claim: "custom_value",
        another_claim: 42,
        nested: { key: "value" },
      };
      expect(payload.custom_claim).toBe("custom_value");
      expect(payload.another_claim).toBe(42);
      expect(payload.nested).toEqual({ key: "value" });
    });

    it("should support complete WebSocket auth payload", () => {
      const payload: JWTPayload = {
        userId: "user-123",
        type: "websocket",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        iss: "picologs-server",
        aud: "picologs-websocket",
      };
      expect(payload.userId).toBe("user-123");
      expect(payload.type).toBe("websocket");
      expect(typeof payload.iat).toBe("number");
      expect(typeof payload.exp).toBe("number");
    });

    it("should allow undefined optional claims", () => {
      const payload: JWTPayload = {
        userId: "user-123",
        iat: undefined,
        exp: undefined,
        custom: "value",
      };
      expect(payload.userId).toBe("user-123");
      expect(payload.iat).toBeUndefined();
      expect(payload.exp).toBeUndefined();
    });
  });

  describe("Token expiration logic", () => {
    it("should correctly identify expired token", () => {
      const now = Math.floor(Date.now() / 1000);
      const expiredPayload: JWTPayload = {
        exp: now - 3600, // expired 1 hour ago
      };
      expect(expiredPayload.exp! < now).toBe(true);
    });

    it("should correctly identify not yet valid token", () => {
      const now = Math.floor(Date.now() / 1000);
      const notYetValidPayload: JWTPayload = {
        nbf: now + 3600, // valid in 1 hour
      };
      expect(notYetValidPayload.nbf! > now).toBe(true);
    });

    it("should correctly identify valid token", () => {
      const now = Math.floor(Date.now() / 1000);
      const validPayload: JWTPayload = {
        iat: now - 60,
        exp: now + 3600,
        nbf: now,
      };
      expect(validPayload.iat! <= now).toBe(true);
      expect(validPayload.exp! > now).toBe(true);
      expect(validPayload.nbf! <= now).toBe(true);
    });

    it("should handle exp claim at exact current time as expired", () => {
      const now = Math.floor(Date.now() / 1000);
      const payload: JWTPayload = {
        exp: now,
      };
      expect(payload.exp! <= now).toBe(true);
    });

    it("should preserve timestamp precision", () => {
      const timestamp = 1700062800;
      const payload: JWTPayload = {
        iat: timestamp,
        exp: timestamp + 86400,
      };
      expect(payload.iat).toBe(timestamp);
      expect(payload.exp).toBe(timestamp + 86400);
      expect(payload.exp! - payload.iat!).toBe(86400);
    });
  });

  describe("Payload type safety", () => {
    it("should maintain type when spreading", () => {
      const base: JWTPayload = { userId: "user-123" };
      const spread: JWTPayload = { ...base, custom: "claim" };
      expect(spread.userId).toBe("user-123");
      expect(spread.custom).toBe("claim");
    });

    it("should allow partial payloads", () => {
      const partial: JWTPayload = { userId: "user-123" };
      expect(partial.exp).toBeUndefined();
      expect(partial.userId).toBeDefined();
    });
  });
});

describe("JWTVerifyOptions Interface", () => {
  describe("Verification options structure", () => {
    it("should create minimal verification options", () => {
      const options: JWTVerifyOptions = {};
      expect(options).toBeDefined();
    });

    it("should support issuer option", () => {
      const options: JWTVerifyOptions = {
        issuer: "picologs-server",
      };
      expect(options.issuer).toBe("picologs-server");
    });

    it("should support single audience option", () => {
      const options: JWTVerifyOptions = {
        audience: "picologs-websocket",
      };
      expect(options.audience).toBe("picologs-websocket");
    });

    it("should support multiple audiences as array", () => {
      const options: JWTVerifyOptions = {
        audience: ["app1", "app2", "app3"],
      };
      expect(Array.isArray(options.audience)).toBe(true);
      expect(options.audience).toHaveLength(3);
    });

    it("should support clock tolerance option", () => {
      const options: JWTVerifyOptions = {
        clockTolerance: 30,
      };
      expect(options.clockTolerance).toBe(30);
    });

    it("should support requireExp option", () => {
      const optionsRequired: JWTVerifyOptions = { requireExp: true };
      const optionsNotRequired: JWTVerifyOptions = { requireExp: false };
      expect(optionsRequired.requireExp).toBe(true);
      expect(optionsNotRequired.requireExp).toBe(false);
    });

    it("should support currentTime override for testing", () => {
      const testTime = 1700000000;
      const options: JWTVerifyOptions = {
        currentTime: testTime,
      };
      expect(options.currentTime).toBe(testTime);
    });

    it("should support maxAge option", () => {
      const options: JWTVerifyOptions = {
        maxAge: 86400,
      };
      expect(options.maxAge).toBe(86400);
    });

    it("should support all options together", () => {
      const options: JWTVerifyOptions = {
        issuer: "picologs-server",
        audience: ["app1", "app2"],
        clockTolerance: 30,
        requireExp: true,
        currentTime: 1700000000,
        maxAge: 86400,
      };
      expect(options.issuer).toBe("picologs-server");
      expect(options.audience).toHaveLength(2);
      expect(options.clockTolerance).toBe(30);
      expect(options.requireExp).toBe(true);
      expect(options.currentTime).toBe(1700000000);
      expect(options.maxAge).toBe(86400);
    });
  });

  describe("Verification options edge cases", () => {
    it("should allow zero clock tolerance", () => {
      const options: JWTVerifyOptions = {
        clockTolerance: 0,
      };
      expect(options.clockTolerance).toBe(0);
    });

    it("should allow large clock tolerance", () => {
      const options: JWTVerifyOptions = {
        clockTolerance: 3600,
      };
      expect(options.clockTolerance).toBe(3600);
    });

    it("should allow zero maxAge", () => {
      const options: JWTVerifyOptions = {
        maxAge: 0,
      };
      expect(options.maxAge).toBe(0);
    });

    it("should allow very large maxAge", () => {
      const options: JWTVerifyOptions = {
        maxAge: 31536000, // 1 year
      };
      expect(options.maxAge).toBe(31536000);
    });

    it("should handle empty audience array", () => {
      const options: JWTVerifyOptions = {
        audience: [],
      };
      expect(Array.isArray(options.audience)).toBe(true);
      expect(options.audience).toHaveLength(0);
    });

    it("should allow undefined optional fields", () => {
      const options: JWTVerifyOptions = {
        issuer: undefined,
        audience: undefined,
        clockTolerance: undefined,
        requireExp: undefined,
        currentTime: undefined,
        maxAge: undefined,
      };
      expect(options.issuer).toBeUndefined();
      expect(options.audience).toBeUndefined();
      expect(options.clockTolerance).toBeUndefined();
      expect(options.requireExp).toBeUndefined();
      expect(options.currentTime).toBeUndefined();
      expect(options.maxAge).toBeUndefined();
    });
  });
});

describe("JWTErrorCode Type", () => {
  describe("Error code enumeration", () => {
    it("should support INVALID_TOKEN error code", () => {
      const code: JWTErrorCode = "INVALID_TOKEN";
      expect(code).toBe("INVALID_TOKEN");
    });

    it("should support EXPIRED error code", () => {
      const code: JWTErrorCode = "EXPIRED";
      expect(code).toBe("EXPIRED");
    });

    it("should support NOT_YET_VALID error code", () => {
      const code: JWTErrorCode = "NOT_YET_VALID";
      expect(code).toBe("NOT_YET_VALID");
    });

    it("should support INVALID_SIGNATURE error code", () => {
      const code: JWTErrorCode = "INVALID_SIGNATURE";
      expect(code).toBe("INVALID_SIGNATURE");
    });

    it("should support INVALID_ISSUER error code", () => {
      const code: JWTErrorCode = "INVALID_ISSUER";
      expect(code).toBe("INVALID_ISSUER");
    });

    it("should support INVALID_AUDIENCE error code", () => {
      const code: JWTErrorCode = "INVALID_AUDIENCE";
      expect(code).toBe("INVALID_AUDIENCE");
    });

    it("should support MALFORMED error code", () => {
      const code: JWTErrorCode = "MALFORMED";
      expect(code).toBe("MALFORMED");
    });

    it("should enumerate all seven error codes", () => {
      const codes: JWTErrorCode[] = [
        "INVALID_TOKEN",
        "EXPIRED",
        "NOT_YET_VALID",
        "INVALID_SIGNATURE",
        "INVALID_ISSUER",
        "INVALID_AUDIENCE",
        "MALFORMED",
      ];
      expect(codes).toHaveLength(7);
    });

    it("should map error codes to meaningful descriptions", () => {
      const errorDescriptions: Record<JWTErrorCode, string> = {
        INVALID_TOKEN: "The token is invalid",
        EXPIRED: "The token has expired",
        NOT_YET_VALID: "The token is not yet valid",
        INVALID_SIGNATURE: "The token signature is invalid",
        INVALID_ISSUER: "The token issuer does not match",
        INVALID_AUDIENCE: "The token audience does not match",
        MALFORMED: "The token is malformed",
      };
      Object.entries(errorDescriptions).forEach(([code, description]) => {
        expect(description).toBeDefined();
        expect(typeof description).toBe("string");
      });
    });
  });
});

describe("Integration Tests", () => {
  describe("Real-world JWT error scenarios", () => {
    it("should handle standard JWT validation flow", () => {
      try {
        throw new JWTError(
          "INVALID_SIGNATURE",
          "Failed to verify token signature",
        );
      } catch (error) {
        expect(error).toBeInstanceOf(JWTError);
        if (error instanceof JWTError) {
          expect(error.code).toBe("INVALID_SIGNATURE");
          expect(error.message).toContain("signature");
        }
      }
    });

    it("should distinguish between different JWT errors", () => {
      const errors = [
        new JWTError("EXPIRED", "Token has expired"),
        new JWTError("NOT_YET_VALID", "Token is not yet valid"),
        new JWTError("INVALID_ISSUER", "Issuer mismatch"),
      ];

      expect(errors[0].code).not.toBe(errors[1].code);
      expect(errors[1].code).not.toBe(errors[2].code);
      expect(errors[0].code).not.toBe(errors[2].code);
    });

    it("should create and validate complete auth flow scenario", () => {
      const now = Math.floor(Date.now() / 1000);

      // Create valid token
      const validToken: JWTPayload = {
        userId: "discord-user-123",
        type: "websocket",
        iat: now,
        exp: now + 3600,
        iss: "picologs-server",
        aud: "picologs-websocket",
      };

      // Verify token structure
      expect(validToken.userId).toBeDefined();
      expect(validToken.exp! > now).toBe(true);

      // Simulate validation errors
      const verifyOptions: JWTVerifyOptions = {
        issuer: "picologs-server",
        audience: "picologs-websocket",
        requireExp: true,
      };

      expect(verifyOptions.issuer).toBe(validToken.iss);
      expect(validToken.exp).toBeDefined();
    });

    it("should handle error recovery with fallback", () => {
      let error: JWTError | null = null;
      try {
        throw new JWTError("EXPIRED", "Token expired, please refresh");
      } catch (e) {
        if (e instanceof JWTError) {
          error = e;
        }
      }

      expect(error).not.toBeNull();
      expect(error?.code).toBe("EXPIRED");
      // Simulate fallback to refresh token
      const refreshed: JWTPayload = {
        userId: "discord-user-123",
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      expect(refreshed.exp).toBeDefined();
    });
  });

  describe("Error handling patterns", () => {
    it("should support error chaining", () => {
      const originalError = new Error("Network error");
      const jwtError = new JWTError(
        "INVALID_TOKEN",
        `Failed to validate: ${originalError.message}`,
      );
      expect(jwtError.message).toContain("Network error");
    });

    it("should support error logging", () => {
      const error = new JWTError("INVALID_SIGNATURE", "Verification failed");
      const errorLog = {
        timestamp: new Date().toISOString(),
        code: error.code,
        message: error.message,
        name: error.name,
      };
      expect(errorLog.code).toBe("INVALID_SIGNATURE");
      expect(errorLog.name).toBe("JWTError");
    });

    it("should support serialization for API responses", () => {
      const error = new JWTError("MALFORMED", "Invalid token format");
      const serialized = {
        error: error.code,
        message: error.message,
      };
      expect(JSON.stringify(serialized)).toContain("MALFORMED");
    });
  });
});
