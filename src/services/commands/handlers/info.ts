/**
 * Info command handlers.
 */

import { eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { players } from "../../../db/schema.js";
import type { CommandContext, CommandResult } from "../../../types/command.js";
import * as RoomService from "../../RoomService.js";
import { COMMAND_ALIASES } from "../aliases.js";
import { COMMAND_REGISTRY } from "../registry.js";
import { Command } from "../types.js";

/**
 * Handle look command
 */
export async function handleLook(
  args: string[],
  context: CommandContext,
): Promise<CommandResult> {
  const { player, room } = context;

  // If there's a target, redirect to examine
  if (args.length > 0) {
    // Strip "at" if present (e.g., "look at sword")
    const targetArgs = args[0] === "at" ? args.slice(1) : args;
    const target = targetArgs.join(" ");

    if (target) {
      // Import dynamically to avoid circular dependency
      const { handleExamine } = await import("./items.js");
      return handleExamine(targetArgs, context);
    }
  }

  // Get fresh room data
  const roomData = await RoomService.getRoomWithContents(room.id);
  if (!roomData) {
    return { success: false, message: "You are nowhere." };
  }

  // Send room data to client - client handles formatting
  return {
    success: true,
    broadcast: [
      {
        event: "room:look",
        room: `player:${player.id}`,
        data: { room: roomData },
      },
    ],
  };
}

/**
 * Handle stats command
 */
export async function handleStats(
  _args: string[],
  context: CommandContext,
): Promise<CommandResult> {
  const { player } = context;

  // Fetch fresh player data from database to get current HP/XP
  const freshPlayer = await db
    .select()
    .from(players)
    .where(eq(players.id, player.id))
    .get();

  if (!freshPlayer) {
    return { success: false, message: "Player not found." };
  }

  const lines = [
    `${freshPlayer.name} - Level ${freshPlayer.level}`,
    `HP: ${freshPlayer.currentHp}/${freshPlayer.maxHp}  XP: ${freshPlayer.xp}`,
    `STR: ${freshPlayer.str}  DEX: ${freshPlayer.dex}  CON: ${freshPlayer.con}`,
    `INT: ${freshPlayer.int}  WIS: ${freshPlayer.wis}  CHA: ${freshPlayer.cha}`,
  ];
  return { success: true, message: lines.join("\n") };
}

/**
 * Handle help command
 */
export async function handleHelp(
  args: string[],
  _context: CommandContext,
): Promise<CommandResult> {
  if (args.length === 0) {
    // General help - list all commands
    const lines = ["Available commands:", ""];

    for (const cmd of Object.values(Command)) {
      const def = COMMAND_REGISTRY[cmd];
      const aliasStr =
        def.help.aliases.length > 0
          ? ` (${def.help.aliases.slice(0, 3).join(", ")}${def.help.aliases.length > 3 ? "..." : ""})`
          : "";
      lines.push(`  ${cmd}${aliasStr} - ${def.help.summary}`);
    }

    lines.push("");
    lines.push('Type "help <command>" for details on a specific command.');
    return { success: true, message: lines.join("\n") };
  }

  // Specific command help
  const topic = args[0].toLowerCase();
  const command = COMMAND_ALIASES[topic];

  if (!command) {
    return { success: false, message: `Unknown command: ${topic}` };
  }

  const def = COMMAND_REGISTRY[command];
  const lines = [
    `${command} - ${def.help.summary}`,
    "",
    "Usage:",
    ...def.help.usage.map((u) => `  ${u}`),
    "",
    `Aliases: ${def.help.aliases.join(", ") || "none"}`,
    "",
    "Examples:",
    ...def.help.examples.map((ex) => `  ${ex}`),
  ];

  return { success: true, message: lines.join("\n") };
}
