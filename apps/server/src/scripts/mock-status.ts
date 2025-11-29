#!/usr/bin/env bun
/**
 * Mock Service Status CLI
 *
 * Usage: bun run mock:status
 */

const API_URL = process.env.API_URL || "http://localhost:8080";

async function getMockStatus() {
  try {
    const response = await fetch(`${API_URL}/api/mock/status`);
    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Failed to get status:", data.error || "Unknown error");
      process.exit(1);
    }

    console.log("Mock Service Status:");
    console.log("──────────────────────");
    console.log(`Running: ${data.isRunning ? "✅ Yes" : "❌ No"}`);

    if (data.isRunning) {
      console.log(`Current Scenario: ${data.currentScenario || "Idle"}`);
      console.log(`Logs Emitted: ${data.logsEmitted}`);
      console.log(`Uptime: ${formatUptime(data.uptime)}`);
      console.log(
        `Started: ${new Date(data.sessionStartTime).toLocaleString()}`,
      );
    }
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

getMockStatus();
