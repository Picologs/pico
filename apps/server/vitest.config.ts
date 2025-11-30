import { defineConfig } from "vitest/config";
import { neonTesting } from "neon-testing/vite";

export default defineConfig({
  plugins: [neonTesting({ debug: true })],
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    // env-loader MUST be first to load .env.test before other modules
    setupFiles: ["./src/test/env-loader.ts", "./src/test/setup.ts"],
    testTimeout: 30000, // 30s timeout for database operations
    hookTimeout: 60000, // 60s for beforeAll/afterAll (branch creation/deletion)
    // Run test files in parallel (each fork gets its own Neon branch)
    pool: "forks",
    poolOptions: {
      forks: {
        maxForks: 4,
        minForks: 1,
      },
    },
  },
});
