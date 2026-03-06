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

  // Get fresh room data (include player's personal discoveries)
  const roomData = await RoomService.getRoomWithContents(room.id, player.id);
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
 * Format a stat value with its equipment bonus.
 * @param baseStat - The base stat value
 * @param bonus - The equipment bonus (can be positive or negative)
 * @returns Formatted string like "12 (+2)" or "10" if no bonus
 */
function formatStatWithBonus(baseStat: number, bonus: number): string {
  if (bonus === 0) {
    return String(baseStat + bonus);
  }
  const sign = bonus > 0 ? "+" : "";
  return `${baseStat + bonus} (${sign}${bonus})`;
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

  // Get equipment bonuses
  const { getEquipmentStatBonuses } = await import("../../items/equipment.js");
  const { totals, bonuses } = await getEquipmentStatBonuses(player.id);

  // Calculate CON HP bonus for display
  const { calculateConHpBonus } = await import("../../StatService.js");
  const totalCon = freshPlayer.con + totals.con;
  const conHpBonus = calculateConHpBonus(freshPlayer.level, totalCon);

  // Get active stance
  const { getActiveStance } = await import("../../FeatService.js");
  const activeStance = await getActiveStance(player.id);

  const strDisplay = formatStatWithBonus(freshPlayer.str, totals.str);
  const dexDisplay = formatStatWithBonus(freshPlayer.dex, totals.dex);
  const conDisplay = formatStatWithBonus(freshPlayer.con, totals.con);
  const intDisplay = formatStatWithBonus(freshPlayer.int, totals.int);
  const wisDisplay = formatStatWithBonus(freshPlayer.wis, totals.wis);
  const chaDisplay = formatStatWithBonus(freshPlayer.cha, totals.cha);

  // Format HP with CON bonus in parentheses if non-zero
  const hpDisplay =
    conHpBonus !== 0
      ? `HP: ${freshPlayer.currentHp}/${freshPlayer.maxHp} (${conHpBonus > 0 ? "+" : ""}${conHpBonus} from CON)`
      : `HP: ${freshPlayer.currentHp}/${freshPlayer.maxHp}`;

  const lines = [
    `${freshPlayer.name} - Level ${freshPlayer.level}`,
    `${hpDisplay}  XP: ${freshPlayer.xp}`,
    `STR: ${strDisplay}  DEX: ${dexDisplay}  CON: ${conDisplay}`,
    `INT: ${intDisplay}  WIS: ${wisDisplay}  CHA: ${chaDisplay}`,
  ];

  // Add active stance if any
  if (activeStance) {
    lines.push(`Stance: ${activeStance.name} (use "stance off" to deactivate)`);
  }

  // Add equipment bonuses section if any exist
  const statBonuses = bonuses.filter((b) => b.stat !== "hp");
  if (statBonuses.length > 0) {
    lines.push("");
    lines.push("Equipment Bonuses:");
    for (const bonus of statBonuses) {
      const sign = bonus.amount > 0 ? "+" : "";
      lines.push(
        `  ${sign}${bonus.amount} ${bonus.stat.toUpperCase()} from ${bonus.itemName}`,
      );
    }
  }

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
