/**
 * Command system - main entry point.
 * Exports the execute function and related utilities.
 */

import type {
  CommandContext,
  CommandResult,
  ParsedCommand,
} from "../../types/command.js";
import * as FeatureService from "../FeatureService.js";
import { COMMAND_ALIASES } from "./aliases.js";
import { COMMAND_REGISTRY } from "./registry.js";
import { Command, COMMAND_CATEGORIES, LEGACY_ACTIONS } from "./types.js";

// Re-export types and registry for external use
export type {
  CommandDefinition,
  CommandHandler,
  CommandHelp,
} from "./types.js";
export { Command, COMMAND_ALIASES, COMMAND_REGISTRY };

/** Articles to strip from input */
const ARTICLES = ["the", "a", "an"];

/**
 * Tokenize input: lowercase, split on whitespace, strip articles
 * @param input - Raw user input string
 * @returns Array of tokens with articles removed
 */
export function tokenize(input: string): string[] {
  const tokens = input
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0);

  // Strip articles
  return tokens.filter((t) => !ARTICLES.includes(t));
}

/**
 * Find the closest matching command for suggestions
 * @param input - The unrecognized verb
 * @returns The closest matching command alias or null
 */
export function findSimilarCommand(input: string): string | null {
  const inputLower = input.toLowerCase();
  const allAliases = Object.keys(COMMAND_ALIASES);

  // Check for prefix match (user typed partial command)
  const prefixMatches = allAliases.filter((v) => v.startsWith(inputLower));
  if (prefixMatches.length === 1) {
    return prefixMatches[0];
  }

  // Simple Levenshtein-ish check: if first 2 chars match and length is close
  for (const alias of allAliases) {
    if (
      alias.length >= 2 &&
      inputLower.length >= 2 &&
      alias.slice(0, 2) === inputLower.slice(0, 2) &&
      Math.abs(alias.length - inputLower.length) <= 2
    ) {
      return alias;
    }
  }

  return null;
}

/** Direction aliases for movement shortcuts */
const DIRECTION_ALIASES: Record<string, string> = {
  n: "north",
  s: "south",
  e: "east",
  w: "west",
  u: "up",
  d: "down",
};

/** Full direction names */
const DIRECTIONS = ["north", "south", "east", "west", "up", "down"];

/**
 * Check if a token is a direction (full name or alias)
 * @param token - The token to check
 * @returns True if the token is a direction
 */
function isDirection(token: string): boolean {
  return DIRECTIONS.includes(token) || token in DIRECTION_ALIASES;
}

/**
 * Normalize a direction alias to its full name
 * @param token - The direction token (may be alias)
 * @returns The full direction name
 */
function normalizeDirection(token: string): string {
  return DIRECTION_ALIASES[token] || token;
}

/**
 * Safely look up a command alias, avoiding prototype pollution
 * @param key - The alias to look up
 * @returns The Command if found, undefined otherwise
 */
function getAlias(key: string): Command | undefined {
  return Object.hasOwn(COMMAND_ALIASES, key) ? COMMAND_ALIASES[key] : undefined;
}

/**
 * Parse raw user input into a structured command
 * @param input - Raw user input string
 * @returns ParsedCommand with type, action, target, and args
 */
export function parse(input: string): ParsedCommand {
  const tokens = tokenize(input);

  if (tokens.length === 0) {
    return {
      type: "unknown",
      action: "",
      raw: input,
    };
  }

  // Check for two-word command first (e.g., "pick up")
  const twoWordKey =
    tokens.length >= 2 ? `${tokens[0]} ${tokens[1]}` : undefined;
  const twoWordCommand = twoWordKey ? getAlias(twoWordKey) : undefined;

  const firstToken = tokens[0];
  const command = twoWordCommand || getAlias(firstToken);
  const argsStartIndex = twoWordCommand ? 2 : 1;

  // Handle "look at X" as examine
  if (command === Command.Look && tokens[1] === "at" && tokens.length > 2) {
    return {
      type: "item",
      action: "examine",
      target: tokens.slice(2).join(" "),
      args: tokens.slice(2),
      raw: input,
    };
  }

  // Handle "look X" (with target) as examine
  if (command === Command.Look && tokens.length > 1) {
    return {
      type: "item",
      action: "examine",
      target: tokens.slice(1).join(" "),
      args: tokens.slice(1),
      raw: input,
    };
  }

  if (command) {
    const category = COMMAND_CATEGORIES[command];
    const legacyAction = LEGACY_ACTIONS[command] || command;
    let target = tokens.slice(argsStartIndex).join(" ") || undefined;
    let args = tokens.slice(argsStartIndex);

    // Special handling for movement commands
    if (command === Command.Move) {
      // If first token is a direction itself (n, north, etc.)
      if (isDirection(firstToken)) {
        target = normalizeDirection(firstToken);
        args = [];
      } else if (tokens.length > 1 && isDirection(tokens[1])) {
        // "go north" or "go n"
        target = normalizeDirection(tokens[1]);
        args = tokens.slice(2);
      }
    }

    return {
      type: category,
      action: legacyAction,
      target,
      args: args.length > 0 ? args : undefined,
      raw: input,
    };
  }

  // Unknown command - try to suggest
  const suggestion = findSimilarCommand(firstToken);

  return {
    type: "unknown",
    action: firstToken,
    target: tokens.slice(1).join(" ") || undefined,
    args: suggestion ? [suggestion] : undefined,
    raw: input,
  };
}

/**
 * Execute a command by routing to the appropriate handler
 * @param input - Raw user input string
 * @param context - The command context (player, room, socket)
 * @returns CommandResult with success status, message, and optional broadcasts
 */
export async function execute(
  input: string,
  context: CommandContext,
): Promise<CommandResult> {
  const tokens = tokenize(input);

  if (tokens.length === 0) {
    return { success: false, message: "What?" };
  }

  // Check for two-word command first (e.g., "pick up")
  const twoWordKey =
    tokens.length >= 2 ? `${tokens[0]} ${tokens[1]}` : undefined;
  const twoWordCommand = twoWordKey ? getAlias(twoWordKey) : undefined;

  const firstToken = tokens[0];
  const command = twoWordCommand || getAlias(firstToken);
  const argsStartIndex = twoWordCommand ? 2 : 1;

  if (command) {
    const definition = COMMAND_REGISTRY[command];
    const args = tokens.slice(argsStartIndex);
    return definition.handler(args, context, input);
  }

  // Unknown command - check if it might be a feature interaction
  const verb = firstToken;
  const target = tokens.slice(1).join(" ");

  if (target) {
    const feature = await FeatureService.findFeatureByCommand(
      context.room.id,
      verb,
      target,
    );

    if (feature) {
      const result = await FeatureService.interactWithFeature(
        context.player.id,
        feature,
      );

      const messages = [result.message];
      for (const effect of result.effectsApplied) {
        if (effect.message) {
          messages.push(effect.message);
        }
      }
      if (result.revealedFeature) {
        messages.push(`You discover: ${result.revealedFeature.name}`);
      }
      if (result.revealedContainer) {
        messages.push(`You find: ${result.revealedContainer.name}`);
      }

      return { success: result.success, message: messages.join("\n") };
    }
  }

  // Unknown command with suggestion
  const suggestion = findSimilarCommand(firstToken);
  if (suggestion) {
    return {
      success: false,
      message: `I don't understand "${firstToken}". Did you mean "${suggestion}"?`,
    };
  }

  return {
    success: false,
    message: `I don't understand "${input}". Try "help" for commands.`,
  };
}
