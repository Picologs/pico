/**
 * CORS middleware and configuration
 */

// Config
export const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(",") || [
  "http://localhost:5173",
  "http://localhost:1420",
];

/**
 * Get allowed origins for demo endpoints based on environment
 */
export function getDemoAllowedOrigins(): string[] {
  const isDev = process.env.NODE_ENV !== "production";
  return isDev
    ? ["http://localhost:5173", "http://localhost:1420"]
    : ["https://picologs.com"];
}

/**
 * Create CORS headers for a given origin
 */
export function getCorsHeaders(origin: string | null): HeadersInit {
  const allowedOrigin =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400", // 24 hours
  };
}

/**
 * Create CORS headers for demo/mock endpoints
 */
export function getDemoCorsHeaders(origin: string | null): HeadersInit {
  const allowedDemoOrigins = getDemoAllowedOrigins();
  const allowedOrigin =
    origin && allowedDemoOrigins.includes(origin)
      ? origin
      : allowedDemoOrigins[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

/**
 * Apply CORS headers to an existing response
 */
export function withCorsHeaders(
  response: Response,
  corsHeaders: HeadersInit,
): Response {
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) =>
    headers.set(key, value as string),
  );

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
