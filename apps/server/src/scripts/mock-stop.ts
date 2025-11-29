#!/usr/bin/env bun
/**
 * Stop Mock Service CLI
 *
 * Usage: bun run mock:stop
 */

const API_URL = process.env.API_URL || "http://localhost:8080";

async function stopMockService() {
  try {
    console.log("Stopping mock service...");

    const response = await fetch(`${API_URL}/api/mock/stop`, {
      method: "POST",
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Failed to stop:", data.error || "Unknown error");
      process.exit(1);
    }

    console.log("✅ Mock service stopped successfully");
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

stopMockService();
