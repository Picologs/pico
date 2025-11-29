/**
 * Simple utility functions - inline the essentials
 */

import jwt from "jsonwebtoken";
import { gzipSync, gunzipSync } from "zlib";
import { rateLimits, type RateLimit, clients, userConnections } from "./state";

const JWT_SECRET = process.env.JWT_SECRET!;

// JWT verification
export function verifyToken(token: string): { userId: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: ["picologs-website", "picologs-desktop"],
      audience: "picologs-websocket",
    }) as any;

    if (!decoded.userId || decoded.type !== "websocket") return null;
    return { userId: decoded.userId };
  } catch {
    return null;
  }
}

// Simple validation
export const isValidUserId = (id: string) =>
  typeof id === "string" &&
  id.length > 0 &&
  id.length < 257 &&
  /^[a-zA-Z0-9_-]+$/.test(id);

export const isValidUUID = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

// Display name logic
export const getDisplayName = (user: {
  username: string;
  player: string | null;
  usePlayerAsDisplayName: boolean | null;
}) =>
  user.usePlayerAsDisplayName && user.player ? user.player : user.username;

// Compression
export const compressLogs = (logs: any[]) =>
  gzipSync(JSON.stringify(logs)).toString("base64");
export const decompressLogs = (data: string) =>
  JSON.parse(gunzipSync(Buffer.from(data, "base64")).toString("utf-8"));
export const shouldCompress = (logs: any[]) =>
  logs.length > 10 || JSON.stringify(logs).length > 5120;

// Rate limiting
export function checkRateLimit(
  key: string,
  limit: number,
  window = 60000,
): boolean {
  const now = Date.now();
  const rl = rateLimits.get(key);

  if (!rl || now > rl.resetTime) {
    rateLimits.set(key, { count: 1, resetTime: now + window });
    return true;
  }

  if (rl.count >= limit) return false;

  rl.count++;
  return true;
}

// Broadcast to users
export function broadcast(userIds: string[], type: string, data?: any): number {
  let sent = 0;

  for (const userId of userIds) {
    const connIds = userConnections.get(userId);
    if (!connIds) {
      console.warn(
        `[Broadcast] User ${userId} not found in userConnections (offline or not registered)`,
      );
      continue;
    }

    for (const connId of connIds) {
      const client = clients.get(connId);
      if (client) {
        try {
          client.ws.send(
            JSON.stringify({
              type,
              data: data || {},
              timestamp: new Date().toISOString(),
            }),
          );
          sent++;
        } catch (e) {
          console.error(`Broadcast error to ${userId}:`, e);
        }
      }
    }
  }

  return sent;
}

// Send to single connection
export function send(
  ws: any,
  type: string,
  data?: any,
  error?: string,
  requestId?: string,
) {
  ws.send(
    JSON.stringify({
      type,
      ...(requestId && { requestId }),
      ...(data && { data }),
      ...(error && { error, message: error }),
      timestamp: new Date().toISOString(),
    }),
  );
}

// Sanitize metadata
export function sanitizeMetadata(meta: any): Record<string, any> | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  if (JSON.stringify(meta).length > 10240) return null;

  const clean: Record<string, any> = Object.create(null);
  const blocked = ["__proto__", "constructor", "prototype"];

  for (const [key, value] of Object.entries(meta)) {
    if (blocked.includes(key.toLowerCase())) continue;
    if (["string", "number", "boolean"].includes(typeof value)) {
      clean[key] = value;
    }
  }

  return clean;
}
