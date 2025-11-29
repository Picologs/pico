/**
 * JWT Utilities
 *
 * Platform-agnostic JWT token generation, verification, and decoding utilities.
 * Compatible with browser, Node.js, Bun, Deno, and Tauri environments.
 *
 * @module auth/jwt
 *
 * @example
 * ```typescript
 * import { generateJWT, verifyJWT, isJWTExpired } from '@pico/shared';
 *
 * // Generate a token
 * const token = await generateJWT(
 *   { userId: '123', type: 'websocket' },
 *   'your-secret-key',
 *   '24h'
 * );
 *
 * // Verify a token
 * const payload = await verifyJWT(token, 'your-secret-key', {
 *   issuer: 'picologs-website',
 *   audience: 'picologs-websocket'
 * });
 *
 * // Check if expired
 * if (isJWTExpired(token)) {
 *   console.log('Token has expired');
 * }
 * ```
 */

import type { JWTPayload, JWTVerifyOptions } from "@pico/types";

// Re-export types for convenience
export type { JWTPayload, JWTVerifyOptions };

/**
 * JWT Header structure
 */
interface JWTHeader {
  alg: string;
  typ: string;
}

/**
 * JWT error types
 */
export class JWTError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "INVALID_TOKEN"
      | "EXPIRED"
      | "NOT_YET_VALID"
      | "INVALID_SIGNATURE"
      | "INVALID_ISSUER"
      | "INVALID_AUDIENCE"
      | "MALFORMED",
  ) {
    super(message);
    this.name = "JWTError";
  }
}

/**
 * Convert expiry time string to seconds
 * Supports: '1h', '24h', '7d', '30d', '1m' (minutes), '1s', or number (seconds)
 */
function parseExpiryTime(expiresIn: string | number): number {
  if (typeof expiresIn === "number") {
    return expiresIn;
  }

  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(
      `Invalid expiry time format: ${expiresIn}. Use format like '24h', '7d', '30m'`,
    );
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case "s":
      return value;
    case "m":
      return value * 60;
    case "h":
      return value * 60 * 60;
    case "d":
      return value * 24 * 60 * 60;
    default:
      throw new Error(`Invalid time unit: ${unit}`);
  }
}

/**
 * Base64URL encode a string or Uint8Array
 */
function base64urlEncode(data: string | Uint8Array): string {
  const bytes =
    typeof data === "string" ? new TextEncoder().encode(data) : data;
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Base64URL decode a string to Uint8Array
 */
function base64urlDecode(str: string): Uint8Array {
  // Add padding if needed
  const padding = "=".repeat((4 - (str.length % 4)) % 4);
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/") + padding;

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generate HMAC-SHA256 signature
 * Platform-agnostic implementation using Web Crypto API (available everywhere)
 */
async function hmacSha256(
  message: string,
  secret: string,
): Promise<Uint8Array> {
  // Use Web Crypto API (available in browser, Node 15+, Bun, Deno)
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);

  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, messageData);
  return new Uint8Array(signature);
}

/**
 * Generate a JWT token
 *
 * @param payload - The payload to encode in the token
 * @param secret - Secret key for signing (minimum 32 characters recommended)
 * @param expiresIn - Token expiration time (e.g., '24h', '7d', '30m', 3600)
 * @param options - Additional token options (issuer, audience)
 * @returns Signed JWT token string
 *
 * @example
 * ```typescript
 * const token = await generateJWT(
 *   { userId: '123', type: 'websocket' },
 *   process.env.JWT_SECRET,
 *   '24h',
 *   { issuer: 'picologs-website', audience: 'picologs-websocket' }
 * );
 * ```
 *
 * @throws {Error} If secret is too short or expiresIn format is invalid
 */
export async function generateJWT(
  payload: Record<string, unknown>,
  secret: string,
  expiresIn: string | number = "24h",
  options?: { issuer?: string; audience?: string | string[] },
): Promise<string> {
  if (!secret || secret.length < 8) {
    throw new Error("JWT secret must be at least 8 characters long");
  }

  const header: JWTHeader = {
    alg: "HS256",
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);
  const exp = now + parseExpiryTime(expiresIn);

  const fullPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp,
    ...(options?.issuer && { iss: options.issuer }),
    ...(options?.audience && { aud: options.audience }),
  };

  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(fullPayload));
  const message = `${encodedHeader}.${encodedPayload}`;

  const signature = await hmacSha256(message, secret);
  const encodedSignature = base64urlEncode(signature);

  return `${message}.${encodedSignature}`;
}

/**
 * Verify and decode a JWT token
 *
 * @param token - The JWT token to verify
 * @param secret - Secret key used for signing
 * @param options - Verification options (issuer, audience, clock tolerance)
 * @returns Decoded payload if valid
 *
 * @example
 * ```typescript
 * try {
 *   const payload = await verifyJWT(token, process.env.JWT_SECRET, {
 *     issuer: 'picologs-website',
 *     audience: 'picologs-websocket',
 *     clockTolerance: 60 // Allow 60 seconds clock skew
 *   });
 *   console.log('User ID:', payload.userId);
 * } catch (error) {
 *   if (error instanceof JWTError) {
 *     console.error('JWT Error:', error.code, error.message);
 *   }
 * }
 * ```
 *
 * @throws {JWTError} If token is invalid, expired, or verification fails
 */
export async function verifyJWT(
  token: string,
  secret: string,
  options: JWTVerifyOptions = {},
): Promise<JWTPayload> {
  // Split token into parts
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new JWTError("JWT must have 3 parts", "MALFORMED");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;

  // Verify signature
  const message = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = await hmacSha256(message, secret);
  const expectedSignatureEncoded = base64urlEncode(expectedSignature);

  // Constant-time comparison to prevent timing attacks
  if (encodedSignature !== expectedSignatureEncoded) {
    throw new JWTError("Invalid signature", "INVALID_SIGNATURE");
  }

  // Decode header and payload
  let header: JWTHeader;
  let payload: JWTPayload;

  try {
    header = JSON.parse(
      new TextDecoder().decode(base64urlDecode(encodedHeader)),
    );
    payload = JSON.parse(
      new TextDecoder().decode(base64urlDecode(encodedPayload)),
    );
  } catch {
    throw new JWTError("Failed to decode token", "MALFORMED");
  }

  // Verify algorithm
  if (header.alg !== "HS256") {
    throw new JWTError(`Unsupported algorithm: ${header.alg}`, "INVALID_TOKEN");
  }

  // Get current time (allow override for testing)
  const now = options.currentTime ?? Math.floor(Date.now() / 1000);
  const clockTolerance = options.clockTolerance ?? 0;

  // Verify expiration (exp)
  if (payload.exp !== undefined) {
    if (now > payload.exp + clockTolerance) {
      throw new JWTError("Token has expired", "EXPIRED");
    }
  }

  // Verify not before (nbf)
  if (payload.nbf !== undefined) {
    if (now < payload.nbf - clockTolerance) {
      throw new JWTError("Token not yet valid", "NOT_YET_VALID");
    }
  }

  // Verify max age
  if (options.maxAge !== undefined && payload.iat !== undefined) {
    const tokenAge = now - payload.iat;
    if (tokenAge > options.maxAge + clockTolerance) {
      throw new JWTError("Token exceeds maximum age", "EXPIRED");
    }
  }

  // Verify issuer
  if (options.issuer !== undefined && payload.iss !== options.issuer) {
    throw new JWTError(
      `Invalid issuer. Expected: ${options.issuer}, Got: ${payload.iss}`,
      "INVALID_ISSUER",
    );
  }

  // Verify audience
  if (options.audience !== undefined) {
    const expectedAudiences = Array.isArray(options.audience)
      ? options.audience
      : [options.audience];
    const tokenAudiences = Array.isArray(payload.aud)
      ? payload.aud
      : [payload.aud];

    const hasMatchingAudience = expectedAudiences.some((expected) =>
      tokenAudiences.includes(expected),
    );

    if (!hasMatchingAudience) {
      throw new JWTError(
        `Invalid audience. Expected: ${expectedAudiences.join(", ")}, Got: ${tokenAudiences.join(", ")}`,
        "INVALID_AUDIENCE",
      );
    }
  }

  return payload;
}

/**
 * Decode a JWT token without verifying the signature
 *
 * WARNING: This does not verify the token! Only use for inspecting tokens
 * when signature verification is not required (e.g., reading public claims).
 *
 * @param token - The JWT token to decode
 * @returns Decoded payload, or null if malformed
 *
 * @example
 * ```typescript
 * const payload = decodeJWT(token);
 * if (payload) {
 *   console.log('Token issuer:', payload.iss);
 *   console.log('Token expires at:', new Date(payload.exp! * 1000));
 * }
 * ```
 */
export function decodeJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    const payload = JSON.parse(
      new TextDecoder().decode(base64urlDecode(parts[1])),
    );
    return payload;
  } catch {
    return null;
  }
}

/**
 * Check if a JWT token has expired (without verifying signature)
 *
 * @param token - The JWT token to check
 * @param clockTolerance - Clock tolerance in seconds (default: 0)
 * @returns true if token has expired or is malformed, false otherwise
 *
 * @example
 * ```typescript
 * if (isJWTExpired(token)) {
 *   console.log('Token needs renewal');
 *   // Refresh token or re-authenticate
 * }
 * ```
 */
export function isJWTExpired(
  token: string,
  clockTolerance: number = 0,
): boolean {
  const payload = decodeJWT(token);
  if (!payload || payload.exp === undefined) {
    return true; // Treat malformed or tokens without exp as expired
  }

  const now = Math.floor(Date.now() / 1000);
  return now > payload.exp + clockTolerance;
}

/**
 * Get time until token expires in seconds
 *
 * @param token - The JWT token to check
 * @returns Seconds until expiration, or null if token is malformed/expired/no exp claim
 *
 * @example
 * ```typescript
 * const ttl = getJWTTimeToLive(token);
 * if (ttl !== null && ttl < 300) {
 *   console.log('Token expires in less than 5 minutes');
 * }
 * ```
 */
export function getJWTTimeToLive(token: string): number | null {
  const payload = decodeJWT(token);
  if (!payload || payload.exp === undefined) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const ttl = payload.exp - now;
  return ttl > 0 ? ttl : null;
}
