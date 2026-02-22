import * as fc from "fast-check";

/**
 * Generator for item names
 */
export const itemNameArb = fc
  .string({ minLength: 2, maxLength: 30 })
  .map((s) => s.replace(/[^a-zA-Z ]/g, "x").trim() || "item")
  .filter((s) => s.length >= 2);

/**
 * Generator for item quantities (positive integers)
 */
export const quantityArb = fc.integer({ min: 1, max: 100 });

/**
 * Generator for bulk flag
 */
export const isBulkArb = fc.boolean();
