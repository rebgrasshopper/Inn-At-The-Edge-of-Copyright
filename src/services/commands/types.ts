/**
 * Command system types and enums.
 * This is the single source of truth for all commands.
 */

import type { CommandContext, CommandResult } from "../../types/command.js";

/** All canonical command verbs */
export enum Command {
  // Movement
  Move = "move",

  // Chat
  Say = "say",
  Shout = "shout",
  Whisper = "whisper",
  Emote = "emote",

  // Items
  Get = "get",
  Drop = "drop",
  Put = "put",
  Examine = "examine",
  Inventory = "inventory",

  // Equipment
  Equip = "equip",
  Unequip = "unequip",
  Equipment = "equipment",

  // Containers
  Open = "open",
  Close = "close",

  // Info
  Look = "look",
  Stats = "stats",
  Help = "help",

  // Combat (deferred but needed for parsing)
  Attack = "attack",
  Flee = "flee",

  // Character
  Train = "train",
  Feats = "feats",
  Stance = "stance",
}

/** Command category for legacy type compatibility */
export type CommandCategory = "movement" | "chat" | "item" | "combat" | "info";

/** Maps commands to their legacy category */
export const COMMAND_CATEGORIES: Record<Command, CommandCategory> = {
  [Command.Move]: "movement",
  [Command.Say]: "chat",
  [Command.Shout]: "chat",
  [Command.Whisper]: "chat",
  [Command.Emote]: "chat",
  [Command.Get]: "item",
  [Command.Drop]: "item",
  [Command.Put]: "item",
  [Command.Examine]: "item",
  [Command.Inventory]: "item",
  [Command.Equip]: "item",
  [Command.Unequip]: "item",
  [Command.Equipment]: "item",
  [Command.Open]: "item",
  [Command.Close]: "item",
  [Command.Look]: "info",
  [Command.Stats]: "info",
  [Command.Help]: "info",
  [Command.Attack]: "combat",
  [Command.Flee]: "combat",
  [Command.Train]: "info",
  [Command.Feats]: "info",
  [Command.Stance]: "info",
};

/** Maps commands to their legacy action names (for backward compatibility) */
export const LEGACY_ACTIONS: Partial<Record<Command, string>> = {
  [Command.Say]: "speak",
  [Command.Move]: "move",
  [Command.Attack]: "attack",
  [Command.Flee]: "flee",
};

/** Help information for a command */
export type CommandHelp = {
  /** Brief one-line description */
  summary: string;
  /** Usage patterns */
  usage: string[];
  /** Alternative names for this command (derived from COMMAND_ALIASES) */
  aliases: string[];
  /** Example usages */
  examples: string[];
};

/** Handler function signature for commands */
export type CommandHandler = (
  args: string[],
  context: CommandContext,
  rawInput: string,
) => Promise<CommandResult>;

/** Complete definition of a command */
export type CommandDefinition = {
  handler: CommandHandler;
  help: CommandHelp;
};
