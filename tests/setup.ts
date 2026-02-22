/**
 * Vitest setup file - runs before all tests.
 * Sets up a separate test database to avoid wiping development data.
 */

// Set test database BEFORE any imports that use it
process.env.DATABASE_URL = "test.db";

import { execSync } from "child_process";
import fs from "fs";

// Ensure test database exists with schema
const testDbPath = "test.db";

// Delete existing test db to start fresh each test run
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

// Run migrations to create schema in test db
execSync("npx drizzle-kit push", { stdio: "inherit" });
