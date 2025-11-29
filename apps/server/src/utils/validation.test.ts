/**
 * Tests for validation utilities
 *
 * Tests for security-critical validation functions including:
 * - User ID validation
 * - UUID validation
 * - Metadata sanitization (prototype pollution prevention)
 */

import { describe, it, expect } from "vitest";
import { isValidUserId, isValidUUID, sanitizeMetadata } from "./validation";

describe("isValidUserId", () => {
  test("should accept valid alphanumeric user IDs", () => {
    expect(isValidUserId("user123")).toBe(true);
    expect(isValidUserId("USER123")).toBe(true);
    expect(isValidUserId("123456789012345678")).toBe(true); // Discord ID format
  });

  test("should accept user IDs with underscores and hyphens", () => {
    expect(isValidUserId("user_123")).toBe(true);
    expect(isValidUserId("user-123")).toBe(true);
    expect(isValidUserId("user_123-abc")).toBe(true);
  });

  test("should reject empty user IDs", () => {
    expect(isValidUserId("")).toBe(false);
  });

  test("should reject user IDs that are too long", () => {
    const longId = "a".repeat(257);
    expect(isValidUserId(longId)).toBe(false);
  });

  test("should accept user IDs at maximum length (256)", () => {
    const maxId = "a".repeat(256);
    expect(isValidUserId(maxId)).toBe(true);
  });

  test("should reject user IDs with special characters", () => {
    expect(isValidUserId("user@123")).toBe(false);
    expect(isValidUserId("user!123")).toBe(false);
    expect(isValidUserId("user#123")).toBe(false);
    expect(isValidUserId("user$123")).toBe(false);
    expect(isValidUserId("user%123")).toBe(false);
    expect(isValidUserId("user&123")).toBe(false);
    expect(isValidUserId("user*123")).toBe(false);
  });

  test("should reject user IDs with spaces", () => {
    expect(isValidUserId("user 123")).toBe(false);
    expect(isValidUserId(" user123")).toBe(false);
    expect(isValidUserId("user123 ")).toBe(false);
  });

  test("should reject non-string inputs", () => {
    // @ts-expect-error - Testing runtime behavior with invalid input
    expect(isValidUserId(null)).toBe(false);
    // @ts-expect-error - Testing runtime behavior with invalid input
    expect(isValidUserId(undefined)).toBe(false);
    // @ts-expect-error - Testing runtime behavior with invalid input
    expect(isValidUserId(123)).toBe(false);
    // @ts-expect-error - Testing runtime behavior with invalid input
    expect(isValidUserId({})).toBe(false);
  });

  test("should reject user IDs with newlines or tabs", () => {
    expect(isValidUserId("user\n123")).toBe(false);
    expect(isValidUserId("user\t123")).toBe(false);
    expect(isValidUserId("user\r123")).toBe(false);
  });
});

describe("isValidUUID", () => {
  test("should accept valid UUIDs", () => {
    expect(isValidUUID("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isValidUUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toBe(true);
    expect(isValidUUID("f47ac10b-58cc-4372-a567-0e02b2c3d479")).toBe(true);
  });

  test("should accept UUIDs with uppercase letters", () => {
    expect(isValidUUID("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
    expect(isValidUUID("F47AC10B-58CC-4372-A567-0E02B2C3D479")).toBe(true);
  });

  test("should accept mixed case UUIDs", () => {
    expect(isValidUUID("550e8400-E29B-41d4-A716-446655440000")).toBe(true);
  });

  test("should reject invalid UUID formats", () => {
    expect(isValidUUID("not-a-uuid")).toBe(false);
    expect(isValidUUID("550e8400e29b41d4a716446655440000")).toBe(false); // No dashes
    expect(isValidUUID("550e8400-e29b-41d4-a716-44665544000")).toBe(false); // Too short
    expect(isValidUUID("550e8400-e29b-41d4-a716-4466554400000")).toBe(false); // Too long
  });

  test("should reject UUIDs with wrong segment lengths", () => {
    expect(isValidUUID("550e840-e29b-41d4-a716-446655440000")).toBe(false); // First segment too short
    expect(isValidUUID("550e84000-e29b-41d4-a716-446655440000")).toBe(false); // First segment too long
  });

  test("should reject UUIDs with invalid characters", () => {
    expect(isValidUUID("550e8400-e29b-41d4-a716-44665544000g")).toBe(false);
    expect(isValidUUID("550e8400-e29b-41d4-a716-44665544000!")).toBe(false);
  });

  test("should reject empty strings", () => {
    expect(isValidUUID("")).toBe(false);
  });

  test("should reject non-string inputs", () => {
    // @ts-expect-error - Testing runtime behavior with invalid input
    expect(isValidUUID(null)).toBe(false);
    // @ts-expect-error - Testing runtime behavior with invalid input
    expect(isValidUUID(undefined)).toBe(false);
    // @ts-expect-error - Testing runtime behavior with invalid input
    expect(isValidUUID(123)).toBe(false);
  });
});

describe("sanitizeMetadata", () => {
  test("should return clean object for valid metadata", () => {
    const input = { key: "value", count: 42, active: true };
    const result = sanitizeMetadata(input);
    expect(result).toEqual({ key: "value", count: 42, active: true });
  });

  test("should handle nested objects", () => {
    const input = { user: { name: "test", id: 123 } };
    const result = sanitizeMetadata(input);
    expect(result).toEqual({ user: { name: "test", id: 123 } });
  });

  test("should reject __proto__ key (prototype pollution)", () => {
    const input = { __proto__: { isAdmin: true }, safe: "value" };
    const result = sanitizeMetadata(input);
    expect(result).toEqual({ safe: "value" });
    expect(result).not.toHaveProperty("__proto__");
  });

  test("should reject constructor key (prototype pollution)", () => {
    const input = { constructor: { evil: true }, safe: "value" };
    const result = sanitizeMetadata(input);
    expect(result).toEqual({ safe: "value" });
    expect(result).not.toHaveProperty("constructor");
  });

  test("should reject prototype key (prototype pollution)", () => {
    const input = { prototype: { evil: true }, safe: "value" };
    const result = sanitizeMetadata(input);
    expect(result).toEqual({ safe: "value" });
    expect(result).not.toHaveProperty("prototype");
  });

  test("should handle case-insensitive dangerous keys", () => {
    const input = { __PROTO__: { isAdmin: true }, CONSTRUCTOR: { evil: true } };
    const result = sanitizeMetadata(input);
    expect(result).toEqual({});
  });

  test("should reject nested dangerous keys", () => {
    const input = { user: { __proto__: { isAdmin: true }, name: "test" } };
    const result = sanitizeMetadata(input);
    expect(result).toEqual({ user: { name: "test" } });
  });

  test("should return null for null input", () => {
    expect(sanitizeMetadata(null)).toBe(null);
  });

  test("should return null for undefined input", () => {
    expect(sanitizeMetadata(undefined)).toBe(null);
  });

  test("should return null for array input", () => {
    expect(sanitizeMetadata([1, 2, 3])).toBe(null);
  });

  test("should return null for non-object input", () => {
    expect(sanitizeMetadata("string")).toBe(null);
    expect(sanitizeMetadata(123)).toBe(null);
    expect(sanitizeMetadata(true)).toBe(null);
  });

  test("should return null for oversized metadata", () => {
    const largeValue = "x".repeat(15000); // > 10KB
    const input = { data: largeValue };
    expect(sanitizeMetadata(input)).toBe(null);
  });

  test("should accept metadata at size limit", () => {
    // Create object just under 10KB
    const value = "x".repeat(9000);
    const input = { data: value };
    const result = sanitizeMetadata(input);
    expect(result).not.toBe(null);
  });

  test("should filter out function values", () => {
    const input = { name: "test", fn: () => {} };
    const result = sanitizeMetadata(input);
    expect(result).toEqual({ name: "test" });
  });

  test("should filter out array values in nested objects", () => {
    const input = { user: { name: "test", tags: ["a", "b"] } };
    const result = sanitizeMetadata(input);
    expect(result).toEqual({ user: { name: "test" } });
  });

  test("should create object without prototype chain", () => {
    const input = { key: "value" };
    const result = sanitizeMetadata(input);
    // Object.create(null) creates object with no prototype
    expect(Object.getPrototypeOf(result)).toBe(null);
  });
});
