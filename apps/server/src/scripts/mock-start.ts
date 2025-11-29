#!/usr/bin/env bun
/**
 * Start Mock Service CLI
 *
 * Usage: bun run mock:start
 */

const API_URL = process.env.API_URL || "http://localhost:8080";

async function startMockService() {
  try {
    console.log("Starting mock service...");

    const response = await fetch(`${API_URL}/api/mock/start`, {
      method: "POST",
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Failed to start:", data.error || "Unknown error");
      process.exit(1);
    }

    console.log("✅ Mock service started successfully");
    console.log("Status:", JSON.stringify(data.status, null, 2));
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

startMockService();
