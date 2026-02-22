import type { CommandContext, CommandResult, ParsedCommand } from "../types/command.js";
/**
 * Tokenize input: lowercase, split on whitespace, strip articles
 * @param input - Raw user input string
 * @returns Array of tokens with articles removed
 */
export declare function tokenize(input: string): string[];
/**
 * Extract quantity from tokens if present (e.g., "get 3 coins" or "get all coins")
 * @param tokens - Array of tokens
 * @returns Object with quantity (or undefined) and remaining tokens
 */
export declare function extractQuantity(tokens: string[]): {
    quantity: number | "all" | undefined;
    tokens: string[];
};
/**
 * Find the closest matching verb for suggestions
 * @param input - The unrecognized verb
 * @returns The closest matching verb or null
 */
export declare function findSimilarVerb(input: string): string | null;
/**
 * Parse raw user input into a structured command
 * @param input - Raw user input string
 * @returns ParsedCommand with type, action, target, and args
 */
export declare function parse(input: string): ParsedCommand;
/**
 * Execute a parsed command by routing to the appropriate service
 * @param command - The parsed command to execute
 * @param context - The command context (player, room, socket)
 * @returns CommandResult with success status, message, and optional broadcasts
 */
export declare function execute(command: ParsedCommand, context: CommandContext): Promise<CommandResult>;
//# sourceMappingURL=CommandParser.d.ts.map