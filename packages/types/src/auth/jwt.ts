/**
 * JWT Authentication Types
 *
 * JSON Web Token types for WebSocket and API authentication.
 *
 * @module types/auth/jwt
 */

/**
 * JWT payload structure
 *
 * Standard JWT claims plus custom claims for WebSocket authentication.
 */
export interface JWTPayload {
  /** User ID (Discord ID) - optional to allow spreading custom payloads */
  userId?: string;

  /** Token type (always 'websocket' for WebSocket auth) - optional to allow spreading custom payloads */
  type?: "websocket";

  /** Issued at (Unix timestamp in seconds) */
  iat?: number;

  /** Expires at (Unix timestamp in seconds) */
  exp?: number;

  /** Not before (Unix timestamp in seconds) */
  nbf?: number;

  /** Issuer (typically the auth server domain) */
  iss?: string;

  /** Audience (typically the resource server domain) */
  aud?: string | string[];

  /** Allow additional properties for custom claims */
  [key: string]: unknown;
}

/**
 * JWT verification options
 */
export interface JWTVerifyOptions {
  /** Expected issuer */
  issuer?: string;

  /** Expected audience */
  audience?: string | string[];

  /** Clock tolerance in seconds (default: 0) */
  clockTolerance?: number;

  /** Whether to require exp claim (default: true) */
  requireExp?: boolean;

  /** Current time override for testing (Unix timestamp in seconds) */
  currentTime?: number;

  /** Maximum token age in seconds */
  maxAge?: number;
}

/**
 * JWT error types
 */
export type JWTErrorCode =
  | "INVALID_TOKEN"
  | "EXPIRED"
  | "NOT_YET_VALID"
  | "INVALID_SIGNATURE"
  | "INVALID_ISSUER"
  | "INVALID_AUDIENCE"
  | "MALFORMED";

/**
 * JWT error
 */
export class JWTError extends Error {
  constructor(
    public code: JWTErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "JWTError";
  }
}
