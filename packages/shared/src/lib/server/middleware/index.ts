/**
 * Server Middleware
 *
 * Reusable SvelteKit middleware functions for authentication, redirects, and more.
 *
 * @module lib/server/middleware
 */

export { createAuthMiddleware, type AuthMiddlewareConfig } from "./auth.js";
export {
  createWWWRedirectMiddleware,
  type WWWRedirectConfig,
} from "./redirect.js";
