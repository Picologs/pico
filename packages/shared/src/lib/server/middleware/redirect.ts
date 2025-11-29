/**
 * WWW Redirect Middleware
 *
 * Reusable SvelteKit middleware for redirecting www subdomain to non-www domain.
 * Checks both URL hostname and Host header to handle various deployment scenarios.
 *
 * @module lib/server/middleware/redirect
 */

import { type Handle, redirect } from "@sveltejs/kit";

// ============================================================================
// Types
// ============================================================================

export interface WWWRedirectConfig {
  /** Domain to redirect www to (e.g., 'picologs.com') */
  domain: string;
  /** HTTP status code for redirect (default: 301) */
  statusCode?: 301 | 302 | 303 | 307 | 308;
  /** Enable debug logging */
  debug?: boolean;
}

// ============================================================================
// Middleware Factory
// ============================================================================

/**
 * Creates a SvelteKit middleware that redirects www subdomain to non-www
 *
 * @param config - Redirect configuration
 * @returns SvelteKit Handle function
 *
 * @example
 * ```typescript
 * import { createWWWRedirectMiddleware } from '@pico/shared/server';
 *
 * export const handleWWWRedirect = createWWWRedirectMiddleware({
 *   domain: 'picologs.com'
 * });
 * ```
 */
export function createWWWRedirectMiddleware(config: WWWRedirectConfig): Handle {
  const { domain, statusCode = 301, debug = false } = config;

  const log = (message: string, ...args: unknown[]) => {
    if (debug) {
    }
  };

  return async ({ event, resolve }) => {
    const url = new URL(event.request.url);

    // Check both URL hostname and Host header for www redirect
    const host = event.request.headers.get("host") || url.hostname;

    // Redirect www to non-www
    if (host === `www.${domain}` || url.hostname === `www.${domain}`) {
      const redirectUrl = `https://${domain}${url.pathname}${url.search}`;
      log(`Redirecting ${url.hostname} to ${domain}`);
      throw redirect(statusCode, redirectUrl);
    }

    return resolve(event);
  };
}
