/**
 * HTTP route handlers
 */

import { db, users } from "../lib/db";
import { verifyToken, checkRateLimit, broadcast } from "../lib/utils";
import {
  getCorsHeaders,
  getDemoCorsHeaders,
  getDemoAllowedOrigins,
  withCorsHeaders,
} from "../middleware/cors";
import { handleUpload } from "../handlers/http/upload";
import { handleAuthDesktopComplete } from "../handlers/http/auth-desktop-complete";
import { handleMockRoute } from "./mock";

const BROADCAST_API_KEY = process.env.BROADCAST_API_KEY;

// Security headers for all HTTP responses
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

function withSecurityHeaders(response: Response): Response {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

export interface HttpRouteContext {
  url: URL;
  ip: string;
  req: Request;
  server: any;
}

/**
 * Health check endpoint
 */
export async function handleHealthCheck(): Promise<Response> {
  try {
    await db.select().from(users).limit(1);
    return Response.json({ status: "ok", timestamp: new Date().toISOString() });
  } catch {
    return Response.json({ status: "error" }, { status: 503 });
  }
}

/**
 * Broadcast endpoint (internal API)
 */
export async function handleBroadcast(req: Request): Promise<Response> {
  const authHeader = req.headers.get("Authorization");
  if (!BROADCAST_API_KEY || authHeader !== `Bearer ${BROADCAST_API_KEY}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { userIds, type, data } = await req.json();
    if (!Array.isArray(userIds) || !type) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }

    const delivered = broadcast(userIds, type, data);
    return Response.json({
      success: true,
      delivered,
      total: userIds.length,
      notDelivered: userIds.length - delivered,
    });
  } catch (error) {
    console.error("[HTTP] Broadcast error:", error);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * Upload endpoint with authentication
 */
export async function handleUploadRoute(req: Request): Promise<Response> {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Handle POST request
  if (req.method === "POST") {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401, headers: corsHeaders },
      );
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    if (!payload || !payload.userId) {
      return Response.json(
        { error: "Invalid or expired token" },
        { status: 401, headers: corsHeaders },
      );
    }

    const uploadResponse = await handleUpload(req, payload.userId);
    return withCorsHeaders(uploadResponse, corsHeaders);
  }

  return Response.json(
    { error: "Method not allowed" },
    { status: 405, headers: corsHeaders },
  );
}

/**
 * Mock API routes
 */
export async function handleMockApiRoute(req: Request): Promise<Response> {
  const origin = req.headers.get("origin");
  const corsHeaders = getDemoCorsHeaders(origin);

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Handle actual request and add CORS headers to response
  const response = await handleMockRoute(req);
  return withCorsHeaders(response, corsHeaders);
}

/**
 * WebSocket upgrade handler
 */
export function handleWebSocketUpgrade(
  req: Request,
  server: any,
  ip: string,
  pathname: string,
): Response | undefined {
  const connectionId = crypto.randomUUID();
  const authOnly = pathname === "/auth-ws";

  const upgraded = server.upgrade(req, {
    data: { connectionId, userId: null, ip, authOnly, isDemoOnly: false },
  });

  if (upgraded) {
    return undefined; // WebSocket upgrade successful
  }

  return Response.json({ error: "WebSocket upgrade failed" }, { status: 400 });
}

/**
 * Demo WebSocket upgrade handler
 */
export function handleDemoWebSocketUpgrade(
  req: Request,
  server: any,
  ip: string,
): Response | undefined {
  const origin = req.headers.get("origin");
  const allowedDemoOrigins = getDemoAllowedOrigins();

  if (!origin || !allowedDemoOrigins.includes(origin)) {
    console.log(`[Demo] Connection rejected - Invalid origin: ${origin}`);
    return new Response("Forbidden", { status: 403 });
  }

  const connectionId = crypto.randomUUID();
  const upgraded = server.upgrade(req, {
    data: { connectionId, userId: null, ip, authOnly: false, isDemoOnly: true },
  });

  if (upgraded) {
    return undefined;
  }

  return Response.json({ error: "WebSocket upgrade failed" }, { status: 400 });
}

/**
 * Main HTTP request router
 */
export async function handleHttpRequest(
  ctx: HttpRouteContext,
): Promise<Response | undefined> {
  const { url, ip, req, server } = ctx;
  const pathname = url.pathname;

  let response: Response | undefined;

  // Health check
  if (pathname === "/health" && req.method === "GET") {
    response = await handleHealthCheck();
  }
  // Broadcast endpoint (no rate limiting - internal API)
  else if (pathname === "/broadcast" && req.method === "POST") {
    response = await handleBroadcast(req);
  }
  // Desktop auth complete endpoint
  else if (pathname === "/auth/desktop-complete" && req.method === "POST") {
    response = await handleAuthDesktopComplete(req);
  }
  // WebSocket upgrade (exempt from HTTP rate limiting and security headers)
  else if (pathname === "/ws" || pathname === "/auth-ws") {
    return handleWebSocketUpgrade(req, server, ip, pathname);
  }
  // Demo WebSocket endpoint (exempt from security headers)
  else if (pathname === "/demo") {
    return handleDemoWebSocketUpgrade(req, server, ip);
  }
  // Rate limit other HTTP endpoints
  else if (!checkRateLimit(`http:${ip}`, 30, 60000)) {
    response = Response.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }
  // Upload endpoint
  else if (pathname === "/upload") {
    response = await handleUploadRoute(req);
  }
  // Mock service API
  else if (pathname.startsWith("/api/mock")) {
    response = await handleMockApiRoute(req);
  }
  // Not found
  else {
    response = new Response("Not found", { status: 404 });
  }

  // Apply security headers to all HTTP responses
  return response ? withSecurityHeaders(response) : undefined;
}
