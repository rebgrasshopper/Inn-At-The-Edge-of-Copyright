/**
 * Vitest global setup - runs once before all tests.
 * Sets up a separate test database to avoid wiping development data.
 */

import { execSync } from "child_process";
import fs from "fs";

export default function setup() {
  const testDbPath = "test.db";

  // Delete existing test db to start fresh
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  // Create schema using drizzle-kit push
  execSync("npx drizzle-kit push", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: "test.db" },
  });

  // Seed the test database
  execSync("npx tsx src/db/seed.ts", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: "test.db" },
  });
}
