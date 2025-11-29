import devtoolsJson from "vite-plugin-devtools-json";
import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tailwindcss(), sveltekit(), devtoolsJson()],
  test: {
    include: ["src/lib/**/*.test.ts"],
    exclude: ["node_modules", ".svelte-kit", "dist", "**/*.test.js"],
    setupFiles: ["./test-setup.ts"],
    globals: true,
  },
});
