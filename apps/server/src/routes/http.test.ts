/**
 * HTTP routes tests
 */

import { describe, it, expect } from "vitest";
import {
  handleHealthCheck,
  handleBroadcast,
  handleWebSocketUpgrade,
  handleDemoWebSocketUpgrade,
  handleHttpRequest,
} from "./http";

describe("HTTP Routes", () => {
  describe("handleHealthCheck", () => {
    test("should return 503 when database is not reachable", async () => {
      // In test environment without DB, we expect 503
      const response = await handleHealthCheck();

      // Without a real DB connection, health check returns 503
      expect(response.status).toBe(503);
      const body = await response.json();
      expect(body.status).toBe("error");
    });

    test("should return JSON response", async () => {
      const response = await handleHealthCheck();
      const body = await response.json();

      expect(body).toBeDefined();
      expect(typeof body.status).toBe("string");
    });
  });

  describe("handleBroadcast", () => {
    test("should reject requests without API key", async () => {
      const req = new Request("http://localhost/broadcast", {
        method: "POST",
        body: JSON.stringify({ userIds: ["user1"], type: "test", data: {} }),
      });

      const response = await handleBroadcast(req);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe("Unauthorized");
    });

    test("should reject requests with wrong API key", async () => {
      const req = new Request("http://localhost/broadcast", {
        method: "POST",
        headers: { Authorization: "Bearer wrong-key" },
        body: JSON.stringify({ userIds: ["user1"], type: "test", data: {} }),
      });

      const response = await handleBroadcast(req);
      expect(response.status).toBe(401);
    });

    test("should require Authorization header", async () => {
      const req = new Request("http://localhost/broadcast", {
        method: "POST",
        body: JSON.stringify({ userIds: ["user1"], type: "test" }),
      });

      const response = await handleBroadcast(req);
      // Without any auth, should return 401
      expect(response.status).toBe(401);
    });
  });

  describe("handleWebSocketUpgrade", () => {
    test("should return error when upgrade fails", () => {
      const req = new Request("http://localhost/ws");
      const mockServer = {
        upgrade: () => false, // Simulate failed upgrade
      };

      const response = handleWebSocketUpgrade(
        req,
        mockServer,
        "127.0.0.1",
        "/ws",
      );

      expect(response).toBeDefined();
      expect(response!.status).toBe(400);
    });

    test("should return undefined when upgrade succeeds", () => {
      const req = new Request("http://localhost/ws");
      const mockServer = {
        upgrade: () => true, // Simulate successful upgrade
      };

      const response = handleWebSocketUpgrade(
        req,
        mockServer,
        "127.0.0.1",
        "/ws",
      );

      expect(response).toBeUndefined();
    });

    test("should set authOnly flag for /auth-ws path", () => {
      const req = new Request("http://localhost/auth-ws");
      let capturedData: any;
      const mockServer = {
        upgrade: (_req: any, opts: any) => {
          capturedData = opts.data;
          return true;
        },
      };

      handleWebSocketUpgrade(req, mockServer, "127.0.0.1", "/auth-ws");

      expect(capturedData.authOnly).toBe(true);
    });

    test("should not set authOnly flag for /ws path", () => {
      const req = new Request("http://localhost/ws");
      let capturedData: any;
      const mockServer = {
        upgrade: (_req: any, opts: any) => {
          capturedData = opts.data;
          return true;
        },
      };

      handleWebSocketUpgrade(req, mockServer, "127.0.0.1", "/ws");

      expect(capturedData.authOnly).toBe(false);
    });

    test("should generate unique connectionId", () => {
      const req = new Request("http://localhost/ws");
      let connectionId1: string;
      let connectionId2: string;

      const mockServer = {
        upgrade: (_req: any, opts: any) => {
          connectionId1 = opts.data.connectionId;
          return true;
        },
      };

      handleWebSocketUpgrade(req, mockServer, "127.0.0.1", "/ws");

      mockServer.upgrade = (_req: any, opts: any) => {
        connectionId2 = opts.data.connectionId;
        return true;
      };

      handleWebSocketUpgrade(req, mockServer, "127.0.0.1", "/ws");

      expect(connectionId1!).toBeDefined();
      expect(connectionId2!).toBeDefined();
      expect(connectionId1!).not.toBe(connectionId2!);
    });

    test("should set isDemoOnly to false for regular ws", () => {
      const req = new Request("http://localhost/ws");
      let capturedData: any;
      const mockServer = {
        upgrade: (_req: any, opts: any) => {
          capturedData = opts.data;
          return true;
        },
      };

      handleWebSocketUpgrade(req, mockServer, "127.0.0.1", "/ws");

      expect(capturedData.isDemoOnly).toBe(false);
    });

    test("should capture client IP", () => {
      const req = new Request("http://localhost/ws");
      let capturedData: any;
      const mockServer = {
        upgrade: (_req: any, opts: any) => {
          capturedData = opts.data;
          return true;
        },
      };

      handleWebSocketUpgrade(req, mockServer, "192.168.1.100", "/ws");

      expect(capturedData.ip).toBe("192.168.1.100");
    });
  });

  describe("handleDemoWebSocketUpgrade", () => {
    test("should reject requests without origin", () => {
      const req = new Request("http://localhost/demo");
      const mockServer = { upgrade: () => true };

      const response = handleDemoWebSocketUpgrade(req, mockServer, "127.0.0.1");

      expect(response).toBeDefined();
      expect(response!.status).toBe(403);
    });

    test("should reject requests with invalid origin", () => {
      const req = new Request("http://localhost/demo", {
        headers: { origin: "http://malicious.com" },
      });
      const mockServer = { upgrade: () => true };

      const response = handleDemoWebSocketUpgrade(req, mockServer, "127.0.0.1");

      expect(response!.status).toBe(403);
    });

    test("should accept requests with valid localhost origin in dev", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      try {
        const req = new Request("http://localhost/demo", {
          headers: { origin: "http://localhost:5173" },
        });
        const mockServer = { upgrade: () => true };

        const response = handleDemoWebSocketUpgrade(
          req,
          mockServer,
          "127.0.0.1",
        );

        expect(response).toBeUndefined(); // Success
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    test("should set isDemoOnly flag", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      try {
        const req = new Request("http://localhost/demo", {
          headers: { origin: "http://localhost:5173" },
        });
        let capturedData: any;
        const mockServer = {
          upgrade: (_req: any, opts: any) => {
            capturedData = opts.data;
            return true;
          },
        };

        handleDemoWebSocketUpgrade(req, mockServer, "127.0.0.1");

        expect(capturedData.isDemoOnly).toBe(true);
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe("handleHttpRequest", () => {
    const createCtx = (
      pathname: string,
      method: string = "GET",
      headers?: HeadersInit,
    ) => ({
      url: new URL(`http://localhost${pathname}`),
      ip: "127.0.0.1",
      req: new Request(`http://localhost${pathname}`, { method, headers }),
      server: {
        upgrade: () => false,
        requestIP: () => ({ address: "127.0.0.1" }),
      },
    });

    test("should route /health to health check", async () => {
      const ctx = createCtx("/health");
      const response = await handleHttpRequest(ctx);

      // In test env without DB, returns 503
      expect(response!.status).toBe(503);
    });

    test("should return 404 for unknown routes", async () => {
      const ctx = createCtx("/unknown");
      const response = await handleHttpRequest(ctx);

      expect(response!.status).toBe(404);
    });

    test("should route /ws to WebSocket upgrade", async () => {
      const ctx = createCtx("/ws");
      const response = await handleHttpRequest(ctx);

      // Returns error since mock server doesn't support upgrades
      expect(response!.status).toBe(400);
    });

    test("should route /demo to demo WebSocket upgrade", async () => {
      const ctx = createCtx("/demo");
      const response = await handleHttpRequest(ctx);

      // Returns 403 without valid origin
      expect(response!.status).toBe(403);
    });

    test("should route /upload to upload handler", async () => {
      const ctx = createCtx("/upload", "POST");
      const response = await handleHttpRequest(ctx);

      // Should get 401 (unauthorized) without auth header
      expect(response!.status).toBe(401);
    });

    test("should handle upload OPTIONS preflight", async () => {
      const ctx = createCtx("/upload", "OPTIONS");
      const response = await handleHttpRequest(ctx);

      expect(response!.status).toBe(204);
      expect(
        response!.headers.get("Access-Control-Allow-Methods"),
      ).toBeDefined();
    });

    test("should route /broadcast to broadcast handler", async () => {
      const ctx = {
        ...createCtx("/broadcast", "POST"),
        req: new Request("http://localhost/broadcast", {
          method: "POST",
          body: JSON.stringify({ userIds: [], type: "test" }),
        }),
      };
      const response = await handleHttpRequest(ctx);

      // Should get 401 without API key
      expect(response!.status).toBe(401);
    });
  });
});
