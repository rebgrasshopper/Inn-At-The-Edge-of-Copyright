/**
 * Character command handlers - commands that modify player character state.
 * Includes training stats, and future commands like feats.
 */

import { getEquippedItems } from "@/services/items/equipment.js";
import {
  calculateEquipmentConBonus,
  calculateMaxHp,
} from "@/services/StatService.js";
import { eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { players } from "../../../db/schema.js";
import type { CommandContext, CommandResult } from "../../../types/command.js";
import type { PlayerStats } from "../../../types/player.js";

/** Maximum value for any stat */
const MAX_STAT = 99;

/** Valid stat names */
const VALID_STATS: (keyof PlayerStats)[] = [
  "str",
  "dex",
  "con",
  "int",
  "wis",
  "cha",
];

/** Full stat names for display */
const STAT_NAMES: Record<keyof PlayerStats, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

/**
 * Handle the train command - spend attribute points to increase stats.
 * @param args - Command arguments (stat name or empty)
 * @param context - Command context with player info
 * @returns Command result with success/failure message
 */
export async function handleTrain(
  args: string[],
  context: CommandContext,
): Promise<CommandResult> {
  // Get current player data from database
  const player = await db
    .select()
    .from(players)
    .where(eq(players.id, context.player.id))
    .get();

  if (!player) {
    return { success: false, message: "Player not found." };
  }

  const unspentPoints = player.unspentAttributePoints;

  // No args - show current points and stats
  if (args.length === 0) {
    const statsDisplay = VALID_STATS.map(
      (stat) => `${stat} ${player[stat]}`,
    ).join(", ");

    if (unspentPoints === 0) {
      return {
        success: true,
        message: `You have no unspent attribute points.\nStats: ${statsDisplay}`,
      };
    }

    const pointWord = unspentPoints === 1 ? "point" : "points";
    return {
      success: true,
      message: `You have ${unspentPoints} unspent attribute ${pointWord}.\nStats: ${statsDisplay}\nUse "train <stat>" to increase a stat (e.g., "train str").`,
    };
  }

  // Parse stat name
  const statInput = args[0].toLowerCase();
  const stat = VALID_STATS.find((s) => s === statInput);

  if (!stat) {
    return {
      success: false,
      message: `Invalid stat "${statInput}". Valid stats: ${VALID_STATS.join(", ")}`,
    };
  }

  // Check for unspent points
  if (unspentPoints <= 0) {
    return {
      success: false,
      message: "You have no unspent attribute points.",
    };
  }

  // Check stat cap
  const currentValue = player[stat];
  if (currentValue >= MAX_STAT) {
    return {
      success: false,
      message: `Your ${STAT_NAMES[stat]} is already at the maximum (${MAX_STAT}).`,
    };
  }

  // Spend the point
  const newValue = currentValue + 1;
  const remainingPoints = unspentPoints - 1;

  // Build update object
  const updateData: Record<string, number> = {
    [stat]: newValue,
    unspentAttributePoints: remainingPoints,
  };

  // If training CON, recalculate max HP (preserve damage taken)
  let hpMessage = "";
  if (stat === "con") {
    const equipped = await getEquippedItems(context.player.id);
    const equipConBonus = calculateEquipmentConBonus(equipped);
    const totalCon = newValue + equipConBonus;
    const newMaxHp = calculateMaxHp(player.level, totalCon);
    const hpGained = newMaxHp - player.maxHp;
    const newCurrentHp = player.currentHp + hpGained;

    updateData.maxHp = newMaxHp;
    updateData.currentHp = newCurrentHp;
    hpMessage = ` (+${hpGained} max HP)`;
  }

  await db
    .update(players)
    .set(updateData)
    .where(eq(players.id, context.player.id));

  const pointWord = remainingPoints === 1 ? "point" : "points";
  const remainingMsg =
    remainingPoints > 0
      ? `(${remainingPoints} ${pointWord} remaining)`
      : "(no points remaining)";

  return {
    success: true,
    message: `You increase your ${STAT_NAMES[stat]} to ${newValue}.${hpMessage} ${remainingMsg}`,
  };
}
