import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import * as schema from "./schema.js";

// Configure Neon to use ws for WebSocket connections in dev mode
// Using dynamic import to avoid SSR warnings during module initialization
if (typeof WebSocket === "undefined") {
  import("ws").then((ws) => {
    neonConfig.webSocketConstructor = ws.default;
  });
}

// Get DATABASE_URL from environment at runtime
function getDatabaseUrl(): string {
  // Try Bun.env first (Bun runtime), then process.env (Node.js compatibility)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const url =
    (globalThis as any).Bun?.env?.DATABASE_URL ?? process.env.DATABASE_URL;

  if (!url) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  return url;
}

// Create pool lazily to ensure environment variables are read at runtime
let _db: ReturnType<typeof drizzle> | null = null;

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(target, prop) {
    if (!_db) {
      const connectionString = getDatabaseUrl();
      const pool = new Pool({ connectionString });
      _db = drizzle(pool, { schema });
    }
    return Reflect.get(_db, prop);
  },
});

// Re-export drizzle-orm operators to ensure consumers use the same instance
// This prevents type conflicts when using operators with schema from shared-svelte
export {
  eq,
  and,
  or,
  not,
  isNull,
  isNotNull,
  inArray,
  notInArray,
  exists,
  notExists,
  between,
  notBetween,
  like,
  ilike,
  notIlike,
  gt,
  gte,
  lt,
  lte,
  ne,
  sql,
} from "drizzle-orm";
