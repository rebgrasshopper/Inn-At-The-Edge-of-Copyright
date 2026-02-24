/**
 * Text parsing utilities for command processing.
 */

/** Filler words to strip from command targets */
const FILLER_WORDS = new Set([
  "from",
  "the",
  "a",
  "an",
  "at",
  "on",
  "in",
  "to",
  "some",
]);

/**
 * Strip common filler words from a target string.
 * Useful for normalizing user input like "drink from the fountain" → "drink fountain"
 * @param target - The target string to clean
 * @returns Cleaned target with filler words removed
 */
export function stripFillerWords(target: string): string {
  return target
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => !FILLER_WORDS.has(word))
    .join(" ");
}
