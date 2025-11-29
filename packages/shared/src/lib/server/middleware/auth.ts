/**
 * Authentication Middleware
 *
 * Reusable SvelteKit authentication middleware supporting:
 * - JWT authentication (Authorization header or URL parameter)
 * - Cookie-based authentication with validation
 * - Database user verification
 *
 * @module lib/server/middleware/auth
 */

import { type Handle } from "@sveltejs/kit";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
import * as v from "valibot";

// ============================================================================
// Types
// ============================================================================

interface WebSocketJWTPayload {
  userId: string; // Discord ID
  type: "websocket";
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

/**
 * Database user table type (minimal schema)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DatabaseUsersTable = any; // Drizzle table type - must be any for compatibility

/**
 * Database instance type (supports multiple Drizzle backends)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DatabaseInstance = DrizzleD1Database<any> | NeonHttpDatabase<any>;

export interface AuthMiddlewareConfig {
  /** Database instance (Drizzle) */
  db: DatabaseInstance;
  /** JWT secret for token verification */
  jwtSecret: string;
  /** Database schema containing users table */
  schema: {
    users: DatabaseUsersTable;
  };
  /** Environment configuration */
  env?: {
    /** Node environment (development/production) */
    nodeEnv?: string;
    /** JWT issuer (default: 'picologs-website') */
    jwtIssuer?: string;
    /** JWT audience (default: 'picologs-websocket') */
    jwtAudience?: string;
  };
  /** Cookie configuration */
  cookies?: {
    /** Name of the info cookie (default: 'discord_info') */
    infoCookieName?: string;
    /** Name of the token cookie (default: 'discord_token') */
    tokenCookieName?: string;
    /** Name of the JWT cookie (default: 'jwt_token') */
    jwtCookieName?: string;
  };
  /** Enable debug logging */
  debug?: boolean;
}

// ============================================================================
// Validation Schemas
// ============================================================================

// Valibot schema to validate discord_info cookie structure
// Prevents prototype pollution and validates data types
const DiscordInfoSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  discordId: v.string(),
  username: v.optional(v.string()),
  avatar: v.optional(v.nullable(v.string())),
  player: v.optional(v.nullable(v.string())),
  friendCode: v.optional(v.nullable(v.string())),
  timeZone: v.optional(v.nullable(v.string())),
});

// ============================================================================
// Middleware Factory
// ============================================================================

/**
 * Creates a SvelteKit authentication middleware
 *
 * @param config - Middleware configuration
 * @returns SvelteKit Handle function
 *
 * @example
 * ```typescript
 * import { createAuthMiddleware } from '@pico/shared/server';
 * import { db, schema } from './db';
 *
 * export const handleAuth = createAuthMiddleware({
 *   db,
 *   jwtSecret: process.env.JWT_SECRET!,
 *   schema,
 *   env: {
 *     nodeEnv: process.env.NODE_ENV
 *   }
 * });
 * ```
 */
export function createAuthMiddleware(config: AuthMiddlewareConfig): Handle {
  const {
    db,
    jwtSecret,
    schema,
    env = {},
    cookies = {},
    debug = false,
  } = config;

  const {
    nodeEnv = "production",
    jwtIssuer = "picologs-website",
    jwtAudience = "picologs-websocket",
  } = env;

  const {
    infoCookieName = "discord_info",
    tokenCookieName = "discord_token",
    jwtCookieName = "jwt_token",
  } = cookies;

  const users = schema.users;

  // Log configuration
  const log = (message: string, ...args: unknown[]) => {
    if (debug) {
      console.log(`[AuthMiddleware] ${message}`, ...args);
    }
  };

  const warn = (message: string, ...args: unknown[]) => {
    console.warn(`[AuthMiddleware] ${message}`, ...args);
  };

  return async ({ event, resolve }) => {
    log("=== Auth Middleware Start ===");
    log("URL:", event.url.pathname);
    log(
      "Cookies available:",
      event.cookies
        .getAll()
        .map((c) => c.name)
        .join(", "),
    );

    // ========================================================================
    // 1. Try JWT authentication from Authorization header
    // ========================================================================
    const authHeader = event.request.headers.get("authorization");
    let token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    log("Auth header token:", token ? "present" : "none");

    // Fallback to JWT from URL parameter (for iframe/desktop app)
    if (!token) {
      token = event.url.searchParams.get("token");
    }

    if (token) {
      try {
        // Verify JWT token
        const decoded = jwt.verify(token, jwtSecret, {
          issuer: jwtIssuer,
          audience: jwtAudience,
        }) as WebSocketJWTPayload;

        // Verify payload structure
        if (decoded.userId && decoded.type === "websocket") {
          // Fetch user from database using Discord ID
          const [user] = await (db as any)
            .select()
            .from(users)
            .where(eq(users.discordId, decoded.userId))
            .limit(1);

          if (user) {
            log("User authenticated via JWT:", user.id);
            event.locals.user = user;

            // Store JWT token in a cookie for subsequent requests
            // This ensures authentication persists across client-side navigations
            event.cookies.set(jwtCookieName, token, {
              path: "/",
              httpOnly: true,
              secure: nodeEnv === "production",
              sameSite: "lax",
              maxAge: 60 * 60 * 24 * 7, // 7 days (match JWT expiry)
            });

            return resolve(event);
          }
        }
      } catch (error) {
        // JWT validation failed, fall through to cookie auth
        warn(
          "JWT validation failed:",
          error instanceof Error ? error.message : "Unknown error",
        );
      }
    }

    // ========================================================================
    // 2. Try JWT from cookie (for subsequent requests after initial load)
    // ========================================================================
    const cookieToken = event.cookies.get(jwtCookieName);
    log("JWT cookie token:", cookieToken ? "present" : "none");
    if (cookieToken) {
      try {
        const decoded = jwt.verify(cookieToken, jwtSecret, {
          issuer: jwtIssuer,
          audience: jwtAudience,
        }) as WebSocketJWTPayload;

        if (decoded.userId && decoded.type === "websocket") {
          log(
            "JWT cookie decoded - userId:",
            decoded.userId,
            "type:",
            decoded.type,
          );
          const [user] = await (db as any)
            .select()
            .from(users)
            .where(eq(users.discordId, decoded.userId))
            .limit(1);

          if (user) {
            log("User authenticated via JWT cookie:", user.id);
            event.locals.user = user;
            return resolve(event);
          } else {
            log("No user found in database for discordId:", decoded.userId);
          }
        } else {
          log(
            "Invalid JWT payload - userId:",
            decoded.userId,
            "type:",
            decoded.type,
          );
        }
      } catch (error) {
        // JWT cookie invalid, delete it and fall through to cookie auth
        warn(
          "JWT cookie validation failed:",
          error instanceof Error ? error.message : "Unknown error",
        );
        event.cookies.delete(jwtCookieName, { path: "/" });
      }
    }

    // ========================================================================
    // 3. Fallback to cookie-based authentication
    // ========================================================================
    const discordInfo = event.cookies.get(infoCookieName);

    if (discordInfo) {
      try {
        const discordInfoParsed = JSON.parse(discordInfo);

        // Validate cookie data with Valibot to prevent prototype pollution
        // and ensure data integrity
        const validated = v.parse(DiscordInfoSchema, discordInfoParsed);

        // Get user from database by their UUID (stored as 'id' in the cookie)
        const [user] = await (db as any)
          .select()
          .from(users)
          .where(eq(users.id, validated.id))
          .limit(1);

        // Verify that the user exists and the discordId matches
        // This prevents cookie tampering where someone could change the ID
        if (user && user.discordId === validated.discordId) {
          log("User authenticated via cookie:", user.id);
          event.locals.user = user;
        } else {
          // User not found or discordId mismatch - clear invalid cookies
          warn(
            "Cookie verification failed: User not found or Discord ID mismatch",
          );
          event.cookies.delete(infoCookieName, { path: "/" });
          event.cookies.delete(tokenCookieName, { path: "/" });
          event.cookies.delete(jwtCookieName, { path: "/" });
        }
      } catch (error) {
        warn("Error fetching user from database:", error);
        // Clear invalid cookies
        event.cookies.delete(infoCookieName, { path: "/" });
        event.cookies.delete(tokenCookieName, { path: "/" });
        event.cookies.delete(jwtCookieName, { path: "/" });
      }
    }

    return resolve(event);
  };
}
