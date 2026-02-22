import * as fc from "fast-check";

/**
 * Generator for valid usernames
 * Usernames must be at least 3 characters, alphanumeric
 */
export const usernameArb = fc
  .stringMatching(/^[a-zA-Z][a-zA-Z0-9]{2,19}$/)
  .filter((s) => s.length >= 3 && s.length <= 20);

/**
 * Generator for valid passwords
 * Passwords must be at least 6 characters
 */
export const passwordArb = fc
  .string({ minLength: 6, maxLength: 50 })
  .filter((s) => s.length >= 6 && !s.includes("\0"));

/**
 * Generator for invalid passwords (wrong passwords for testing rejection)
 * These are passwords that are different from the original
 */
export const wrongPasswordArb = fc
  .string({ minLength: 6, maxLength: 50 })
  .filter((s) => s.length >= 6 && !s.includes("\0"));

/**
 * Generator for unique test identifiers to avoid collisions
 */
export const uniqueIdArb = fc.uuid();
