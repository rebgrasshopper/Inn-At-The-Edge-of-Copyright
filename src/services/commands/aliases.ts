/**
 * Command aliases - maps all input words to canonical commands.
 */

import { Command } from "./types.js";

/** Maps any input word to its canonical Command */
export const COMMAND_ALIASES: Record<string, Command> = {
  // Movement
  move: Command.Move,
  go: Command.Move,
  walk: Command.Move,
  exit: Command.Move,
  leave: Command.Move,
  north: Command.Move,
  south: Command.Move,
  east: Command.Move,
  west: Command.Move,
  up: Command.Move,
  down: Command.Move,
  n: Command.Move,
  s: Command.Move,
  e: Command.Move,
  w: Command.Move,
  u: Command.Move,
  d: Command.Move,

  // Chat
  say: Command.Say,
  speak: Command.Say,
  talk: Command.Say,
  shout: Command.Shout,
  yell: Command.Shout,
  whisper: Command.Whisper,
  tell: Command.Whisper,
  emote: Command.Emote,
  me: Command.Emote,

  // Items
  get: Command.Get,
  take: Command.Get,
  grab: Command.Get,
  pick: Command.Get,
  drop: Command.Drop,
  put: Command.Put,
  place: Command.Put,
  examine: Command.Examine,
  inspect: Command.Examine,
  x: Command.Examine,
  inventory: Command.Inventory,
  inv: Command.Inventory,
  i: Command.Inventory,

  // Equipment
  equip: Command.Equip,
  wear: Command.Equip,
  wield: Command.Equip,
  unequip: Command.Unequip,
  remove: Command.Unequip,
  unwear: Command.Unequip,
  equipment: Command.Equipment,
  eq: Command.Equipment,
  gear: Command.Equipment,

  // Containers
  open: Command.Open,
  close: Command.Close,
  shut: Command.Close,

  // Info
  look: Command.Look,
  l: Command.Look,
  stats: Command.Stats,
  stat: Command.Stats,
  score: Command.Stats,
  help: Command.Help,
  "?": Command.Help,

  // Combat (deferred but needed for parsing)
  attack: Command.Attack,
  fight: Command.Attack,
  kill: Command.Attack,
  hit: Command.Attack,
  strike: Command.Attack,
  flee: Command.Flee,
  run: Command.Flee,
  escape: Command.Flee,

  // Multi-word aliases
  "pick up": Command.Get,
  "put down": Command.Drop,
};

/**
 * Get all aliases for a given command
 * @param command - The canonical command
 * @returns Array of alias strings
 */
export function getAliasesForCommand(command: Command): string[] {
  return Object.entries(COMMAND_ALIASES)
    .filter(([, cmd]) => cmd === command)
    .map(([alias]) => alias)
    .filter((alias) => alias !== command); // Exclude the canonical name
}
