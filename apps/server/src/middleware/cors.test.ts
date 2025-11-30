/**
 * CORS middleware tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  ALLOWED_ORIGINS,
  getDemoAllowedOrigins,
  getCorsHeaders,
  getDemoCorsHeaders,
  withCorsHeaders,
} from "./cors";

describe("CORS Middleware", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe("getDemoAllowedOrigins", () => {
    test("should return localhost origins in development", () => {
      process.env.NODE_ENV = "development";
      const origins = getDemoAllowedOrigins();
      expect(origins).toContain("http://localhost:5173");
      expect(origins).toContain("http://localhost:1420");
    });

    test("should return production origin in production", () => {
      process.env.NODE_ENV = "production";
      const origins = getDemoAllowedOrigins();
      expect(origins).toEqual(["https://picologs.com"]);
    });

    test("should return localhost origins when NODE_ENV is not set", () => {
      delete process.env.NODE_ENV;
      const origins = getDemoAllowedOrigins();
      expect(origins).toContain("http://localhost:5173");
    });
  });

  describe("getCorsHeaders", () => {
    test("should return allowed origin when origin is in allowed list", () => {
      const headers = getCorsHeaders("http://localhost:5173");
      expect(headers["Access-Control-Allow-Origin"]).toBe(
        "http://localhost:5173",
      );
    });

    test("should return first allowed origin when origin is not in list", () => {
      const headers = getCorsHeaders("http://malicious.com");
      expect(headers["Access-Control-Allow-Origin"]).toBe(ALLOWED_ORIGINS[0]);
    });

    test("should return first allowed origin when origin is null", () => {
      const headers = getCorsHeaders(null);
      expect(headers["Access-Control-Allow-Origin"]).toBe(ALLOWED_ORIGINS[0]);
    });

    test("should include correct methods", () => {
      const headers = getCorsHeaders("http://localhost:5173");
      expect(headers["Access-Control-Allow-Methods"]).toBe("POST, OPTIONS");
    });

    test("should include correct headers", () => {
      const headers = getCorsHeaders("http://localhost:5173");
      expect(headers["Access-Control-Allow-Headers"]).toBe(
        "Authorization, Content-Type",
      );
    });

    test("should include max age", () => {
      const headers = getCorsHeaders("http://localhost:5173");
      expect(headers["Access-Control-Max-Age"]).toBe("86400");
    });
  });

  describe("getDemoCorsHeaders", () => {
    test("should return allowed origin when origin is valid demo origin", () => {
      process.env.NODE_ENV = "development";
      const headers = getDemoCorsHeaders("http://localhost:5173");
      expect(headers["Access-Control-Allow-Origin"]).toBe(
        "http://localhost:5173",
      );
    });

    test("should return first demo origin when origin is invalid", () => {
      process.env.NODE_ENV = "development";
      const headers = getDemoCorsHeaders("http://malicious.com");
      expect(headers["Access-Control-Allow-Origin"]).toBe(
        "http://localhost:5173",
      );
    });

    test("should include GET method for demo endpoints", () => {
      const headers = getDemoCorsHeaders("http://localhost:5173");
      expect(headers["Access-Control-Allow-Methods"]).toBe(
        "GET, POST, OPTIONS",
      );
    });

    test("should use production origin in production mode", () => {
      process.env.NODE_ENV = "production";
      const headers = getDemoCorsHeaders("https://picologs.com");
      expect(headers["Access-Control-Allow-Origin"]).toBe(
        "https://picologs.com",
      );
    });
  });

  describe("withCorsHeaders", () => {
    test("should add CORS headers to response", () => {
      const originalResponse = new Response("test body", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

      const corsHeaders = {
        "Access-Control-Allow-Origin": "http://localhost:5173",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      };

      const response = withCorsHeaders(originalResponse, corsHeaders);

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
        "http://localhost:5173",
      );
      expect(response.headers.get("Access-Control-Allow-Methods")).toBe(
        "POST, OPTIONS",
      );
      expect(response.headers.get("Content-Type")).toBe("application/json");
    });

    test("should preserve original response status", () => {
      const originalResponse = new Response("error", { status: 400 });
      const corsHeaders = getCorsHeaders("http://localhost:5173");
      const response = withCorsHeaders(originalResponse, corsHeaders);

      expect(response.status).toBe(400);
    });

    test("should preserve original response body", async () => {
      const originalResponse = new Response("test body");
      const corsHeaders = getCorsHeaders("http://localhost:5173");
      const response = withCorsHeaders(originalResponse, corsHeaders);

      const body = await response.text();
      expect(body).toBe("test body");
    });
  });

  describe("ALLOWED_ORIGINS constant", () => {
    test("should include localhost origins by default", () => {
      expect(ALLOWED_ORIGINS).toContain("http://localhost:5173");
      expect(ALLOWED_ORIGINS).toContain("http://localhost:1420");
    });
  });
});
