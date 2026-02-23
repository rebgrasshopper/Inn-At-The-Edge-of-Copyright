/**
 * Command parser - main entry point for command processing.
 * Re-exports from the commands module for backward compatibility.
 */

// Re-export everything from the commands module
export {
  Command,
  COMMAND_ALIASES,
  COMMAND_REGISTRY,
  execute,
  findSimilarCommand,
  parse,
  tokenize,
} from "./commands/index.js";

export type {
  CommandDefinition,
  CommandHandler,
  CommandHelp,
} from "./commands/index.js";

// Legacy exports for backward compatibility with tests
export { tokenize as tokenizeInput } from "./commands/index.js";

/**
 * Extract quantity from tokens if present (e.g., "get 3 coins" or "get all coins")
 * @param tokens - Array of tokens
 * @returns Object with quantity (or undefined) and remaining tokens
 */
export function extractQuantity(tokens: string[]): {
  quantity: number | "all" | undefined;
  tokens: string[];
} {
  if (tokens.length < 2) {
    return { quantity: undefined, tokens };
  }

  const second = tokens[1];

  // Check for "all"
  if (second === "all") {
    return { quantity: "all", tokens: [tokens[0], ...tokens.slice(2)] };
  }

  // Check for numeric quantity
  const num = parseInt(second, 10);
  if (!isNaN(num) && num > 0) {
    return { quantity: num, tokens: [tokens[0], ...tokens.slice(2)] };
  }

  return { quantity: undefined, tokens };
}

/**
 * Find the closest matching verb for suggestions
 * @param input - The unrecognized verb
 * @returns The closest matching verb or null
 * @deprecated Use findSimilarCommand instead
 */
export { findSimilarCommand as findSimilarVerb } from "./commands/index.js";
