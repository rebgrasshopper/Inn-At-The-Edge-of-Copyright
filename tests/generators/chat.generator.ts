import * as fc from "fast-check";

/**
 * Generator for non-empty chat messages
 */
export const chatMessageArb = fc
  .string({ minLength: 1, maxLength: 500 })
  .filter((s) => s.trim().length > 0);

/**
 * Generator for region names
 */
export const regionArb = fc
  .string({ minLength: 3, maxLength: 20 })
  .map((s) => s.replace(/[^a-zA-Z]/g, "x") || "region")
  .filter((s) => s.length >= 3);

/**
 * Generator for player names (simplified for chat tests)
 */
export const playerNameArb = fc
  .string({ minLength: 2, maxLength: 30 })
  .map((s) => s.replace(/[^a-zA-Z0-9]/g, "x") || "Player")
  .filter((s) => s.length >= 2);
