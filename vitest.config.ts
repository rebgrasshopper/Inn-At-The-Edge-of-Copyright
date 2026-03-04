import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    // Run test files sequentially to avoid SQLite conflicts
    fileParallelism: false,
    // Global setup runs once before all tests (seeds database)
    globalSetup: ["tests/globalSetup.ts"],
    // Setup files run before each test file (sets env var)
    setupFiles: ["tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules", "dist", "client", "archive", "drizzle"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
