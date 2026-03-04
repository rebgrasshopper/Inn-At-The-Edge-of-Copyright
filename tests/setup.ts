/**
 * Vitest setup file - runs before each test file.
 * Sets the test database environment variable.
 */

// Set test database BEFORE any imports that use it
process.env.DATABASE_URL = "test.db";
