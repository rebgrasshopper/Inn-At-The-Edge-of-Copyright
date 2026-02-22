import * as fc from "fast-check";
import {
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
} from "../../src/utils/characterValidation.js";

// Character sets for name generation
const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const alphanumeric =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const validNameChars = alphanumeric + " -";

// Invalid characters (anything not alphanumeric, space, or dash)
const invalidChars = "!@#$%^&*()_+=[]{}|;':\",./<>?`~\\";

/**
 * Generator for valid character names
 * - 2-60 characters
 * - Only alphanumeric, spaces, and dashes
 * - At least one letter
 */
export const validNameArb = fc
  .tuple(
    // Start with a letter (ensures at least one alphanumeric)
    fc.constantFrom(...letters.split("")),
    // Rest can be alphanumeric, space, or dash
    fc.string({
      minLength: NAME_MIN_LENGTH - 1,
      maxLength: NAME_MAX_LENGTH - 1,
      unit: fc.constantFrom(...validNameChars.split("")),
    }),
  )
  .map(([first, rest]) => first + rest)
  .filter((name) => name.trim().length >= NAME_MIN_LENGTH);

/**
 * Generator for names with invalid characters
 */
export const invalidCharNameArb = fc
  .tuple(
    // Valid prefix
    fc.string({
      minLength: 1,
      maxLength: 10,
      unit: fc.constantFrom(...alphanumeric.split("")),
    }),
    // Invalid character
    fc.constantFrom(...invalidChars.split("")),
    // Valid suffix
    fc.string({
      minLength: 1,
      maxLength: 10,
      unit: fc.constantFrom(...alphanumeric.split("")),
    }),
  )
  .map(([prefix, invalid, suffix]) => prefix + invalid + suffix);

/**
 * Generator for names that are too short
 */
export const tooShortNameArb = fc.string({
  minLength: 0,
  maxLength: NAME_MIN_LENGTH - 1,
  unit: fc.constantFrom(...letters.split("")),
});

/**
 * Generator for names that are too long
 */
export const tooLongNameArb = fc.string({
  minLength: NAME_MAX_LENGTH + 1,
  maxLength: NAME_MAX_LENGTH + 50,
  unit: fc.constantFrom(...letters.split("")),
});
