import { sql } from "drizzle-orm";
import { db } from "../../lib/db";

/**
 * Health check endpoint handler
 * Verifies database connectivity
 */
export async function handleHealth(): Promise<Response> {
  try {
    // Quick database ping
    await db.execute(sql`SELECT 1`);
    return new Response("OK", { status: 200 });
  } catch (dbError) {
    console.error("[Health Check] Database unavailable:", dbError);
    return new Response("Database unavailable", { status: 503 });
  }
}
