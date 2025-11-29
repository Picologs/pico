/**
 * JWT Token Validation Utilities
 *
 * Platform-agnostic utilities for validating and parsing JWT tokens.
 * Works in browser, Tauri, Node.js, Bun, and any JavaScript environment.
 *
 * @module jwt-validator
 * @example
 * ```typescript
 * import { validateJwt, parseJwtPayload, isJwtExpired } from '@pico/shared';
 *
 * // Validate JWT and check expiration
 * const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
 * if (validateJwt(token)) {
 *   const payload = parseJwtPayload(token);
 *   console.log('User ID:', payload.userId);
 * }
 *
 * // Check if token is expired
 * if (isJwtExpired(token)) {
 *   console.log('Token expired, please re-authenticate');
 * }
 * ```
 */

/**
 * JWT payload structure
 */
export interface JwtPayload {
  /** Subject (user identifier) */
  sub?: string;
  /** User ID (custom claim) */
  userId?: string;
  /** Issued at timestamp (seconds since epoch) */
  iat?: number;
  /** Expiration timestamp (seconds since epoch) */
  exp?: number;
  /** Audience */
  aud?: string;
  /** Issuer */
  iss?: string;
  /** Additional custom claims */
  [key: string]: unknown;
}

/**
 * JWT validation result
 */
export interface JwtValidationResult {
  /** Whether the token is valid */
  valid: boolean;
  /** Parsed payload if valid, null otherwise */
  payload: JwtPayload | null;
  /** Error message if invalid */
  error?: string;
}

/**
 * Parse JWT payload without validation
 *
 * Extracts and decodes the payload section of a JWT token.
 * Does NOT verify the signature or validate claims.
 *
 * @param token - JWT token string
 * @returns Parsed payload object or null if parsing fails
 *
 * @example
 * ```typescript
 * const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
 * const payload = parseJwtPayload(token);
 * if (payload) {
 *   console.log('User ID:', payload.userId);
 *   console.log('Expires:', new Date(payload.exp! * 1000));
 * }
 * ```
 */
export function parseJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    const [, payloadB64] = parts;
    if (!payloadB64) {
      return null;
    }

    // Decode base64url (replace URL-safe chars and pad if needed)
    const base64 = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    const jsonStr = atob(base64);
    const payload = JSON.parse(jsonStr) as JwtPayload;

    return payload;
  } catch {
    return null;
  }
}

/**
 * Check if JWT token is expired
 *
 * Validates the `exp` (expiration) claim in the JWT payload.
 * Returns true if the token is expired or has no expiration claim.
 *
 * @param token - JWT token string
 * @param clockSkewSeconds - Optional clock skew tolerance in seconds (default: 0)
 * @returns True if token is expired, false otherwise
 *
 * @example
 * ```typescript
 * const token = getStoredToken();
 * if (isJwtExpired(token)) {
 *   // Token expired, redirect to login
 *   redirectToLogin();
 * } else {
 *   // Token valid, continue
 *   makeAuthenticatedRequest(token);
 * }
 *
 * // With clock skew tolerance (60 seconds)
 * if (isJwtExpired(token, 60)) {
 *   // Token expired (with 60s tolerance)
 * }
 * ```
 */
export function isJwtExpired(
  token: string,
  clockSkewSeconds: number = 0,
): boolean {
  const payload = parseJwtPayload(token);
  if (!payload || !payload.exp) {
    return true; // No expiration claim = treat as expired
  }

  // exp is in seconds, Date.now() is in milliseconds
  const expirationTime = payload.exp * 1000;
  const currentTime = Date.now();
  const skewMs = clockSkewSeconds * 1000;

  return currentTime > expirationTime + skewMs;
}

/**
 * Validate JWT token format and expiration
 *
 * Performs basic JWT validation:
 * - Checks token format (3 parts separated by dots)
 * - Parses payload
 * - Validates expiration claim
 *
 * Does NOT verify the signature (requires secret key).
 *
 * @param token - JWT token string
 * @param options - Validation options
 * @param options.clockSkewSeconds - Clock skew tolerance in seconds (default: 0)
 * @returns Validation result with payload if valid
 *
 * @example
 * ```typescript
 * const result = validateJwt(token);
 * if (result.valid) {
 *   console.log('User ID:', result.payload!.userId);
 * } else {
 *   console.error('Invalid token:', result.error);
 * }
 *
 * // With clock skew tolerance
 * const result = validateJwt(token, { clockSkewSeconds: 60 });
 * ```
 */
export function validateJwt(
  token: string,
  options: { clockSkewSeconds?: number } = {},
): JwtValidationResult {
  const { clockSkewSeconds = 0 } = options;

  // Check format
  const parts = token.split(".");
  if (parts.length !== 3) {
    return {
      valid: false,
      payload: null,
      error: "Invalid JWT format: expected 3 parts separated by dots",
    };
  }

  // Parse payload
  const payload = parseJwtPayload(token);
  if (!payload) {
    return {
      valid: false,
      payload: null,
      error: "Invalid JWT payload: failed to parse",
    };
  }

  // Check expiration
  if (isJwtExpired(token, clockSkewSeconds)) {
    return {
      valid: false,
      payload: null,
      error: "Token expired",
    };
  }

  return {
    valid: true,
    payload,
  };
}

/**
 * Get expiration date from JWT token
 *
 * Extracts the expiration timestamp from the JWT payload and converts it to a Date object.
 *
 * @param token - JWT token string
 * @returns Expiration date or null if token has no expiration claim
 *
 * @example
 * ```typescript
 * const token = getStoredToken();
 * const expiresAt = getJwtExpiration(token);
 * if (expiresAt) {
 *   console.log('Token expires at:', expiresAt.toLocaleString());
 *   console.log('Time remaining:', expiresAt.getTime() - Date.now(), 'ms');
 * }
 * ```
 */
export function getJwtExpiration(token: string): Date | null {
  const payload = parseJwtPayload(token);
  if (!payload || !payload.exp) {
    return null;
  }

  return new Date(payload.exp * 1000);
}

/**
 * Get time until JWT token expires
 *
 * Calculates the number of milliseconds until the token expires.
 * Returns negative value if token is already expired.
 *
 * @param token - JWT token string
 * @returns Milliseconds until expiration, or null if no expiration claim
 *
 * @example
 * ```typescript
 * const token = getStoredToken();
 * const msUntilExpiry = getJwtTimeRemaining(token);
 * if (msUntilExpiry !== null) {
 *   if (msUntilExpiry < 0) {
 *     console.log('Token expired');
 *   } else {
 *     console.log('Token expires in:', Math.floor(msUntilExpiry / 1000), 'seconds');
 *   }
 * }
 * ```
 */
export function getJwtTimeRemaining(token: string): number | null {
  const expiresAt = getJwtExpiration(token);
  if (!expiresAt) {
    return null;
  }

  return expiresAt.getTime() - Date.now();
}
