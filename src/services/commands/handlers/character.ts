/**
 * Character command handlers - commands that modify player character state.
 * Includes training stats, feats, and stances.
 */

import {
  acquireFeat,
  checkPrerequisites,
  getActiveStance,
  getAvailableFeats,
  getCategories,
  getFeatByName,
  getFeatsByCategory,
  getPlayerFeats,
  setActiveStance,
} from "@/services/FeatService.js";
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
    const newMaxHp = await calculateMaxHp(
      player.level,
      totalCon,
      context.player.id,
    );
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

/**
 * Handle the feats command - view, acquire, and manage feats.
 * @param args - Command arguments (subcommand and optional feat name)
 * @param context - Command context with player info
 * @returns Command result with success/failure message
 */
export async function handleFeats(
  args: string[],
  context: CommandContext,
): Promise<CommandResult> {
  const playerId = context.player.id;

  // Get player's unspent feat slots
  const player = db
    .select()
    .from(players)
    .where(eq(players.id, playerId))
    .get();

  if (!player) {
    return { success: false, message: "Player not found." };
  }

  const unspentSlots = player.unspentFeatSlots;

  // No args - list owned feats
  if (args.length === 0) {
    const ownedFeats = await getPlayerFeats(playerId);
    const slotWord = unspentSlots === 1 ? "slot" : "slots";
    const slotMsg =
      unspentSlots > 0
        ? `You have ${unspentSlots} unspent feat ${slotWord}.`
        : "You have no unspent feat slots.";

    if (ownedFeats.length === 0) {
      return {
        success: true,
        message: `${slotMsg}\nYou have no feats yet. Use "feats available" to see what you can acquire.`,
      };
    }

    const featList = ownedFeats.map((f) => `  ${f.name}`).join("\n");
    return {
      success: true,
      message: `${slotMsg}\nYour feats:\n${featList}`,
    };
  }

  const subcommand = args[0].toLowerCase();

  // feats available - list acquirable feats
  if (subcommand === "available") {
    const available = await getAvailableFeats(playerId);

    if (available.length === 0) {
      return {
        success: true,
        message:
          "No feats are currently available to acquire. You may need to meet more prerequisites or level up.",
      };
    }

    const featList = available.map((f) => `  ${f.name}`).join("\n");
    return {
      success: true,
      message: `Available feats:\n${featList}\nUse "feats info <name>" for details or "feats acquire <name>" to learn one.`,
    };
  }

  // feats info <name> - show feat details
  if (subcommand === "info") {
    if (args.length < 2) {
      return {
        success: false,
        message: "Usage: feats info <feat name>",
      };
    }

    const featName = args.slice(1).join(" ");
    const feat = await getFeatByName(featName);

    if (!feat) {
      return {
        success: false,
        message: `No feat found matching "${featName}".`,
      };
    }

    // Check if player has this feat
    const ownedFeats = await getPlayerFeats(playerId);
    const hasFeat = ownedFeats.some((f) => f.id === feat.id);

    // Check prerequisites
    const prereqResult = await checkPrerequisites(playerId, feat.id);
    const prereqStatus =
      prereqResult.unmetRequirements.length === 0
        ? "✓ Prerequisites met"
        : `✗ Unmet: ${prereqResult.unmetRequirements.join(", ")}`;

    const lines = [
      feat.name,
      `Category: ${feat.category}`,
      feat.prerequisitesText
        ? `Prerequisites: ${feat.prerequisitesText}`
        : "Prerequisites: None",
      prereqStatus,
      hasFeat ? "Status: You have this feat" : "Status: Not acquired",
      "",
      feat.shortDescription,
    ];

    if (feat.longDescription) {
      lines.push("", feat.longDescription);
    }

    return {
      success: true,
      message: lines.join("\n"),
    };
  }

  // feats acquire <name> - attempt to acquire feat
  if (subcommand === "acquire" || subcommand === "learn") {
    if (args.length < 2) {
      return {
        success: false,
        message: "Usage: feats acquire <feat name>",
      };
    }

    const featName = args.slice(1).join(" ");
    const feat = await getFeatByName(featName);

    if (!feat) {
      return {
        success: false,
        message: `No feat found matching "${featName}".`,
      };
    }

    const result = await acquireFeat(playerId, feat.id);

    return {
      success: result.success,
      message: result.message,
    };
  }

  // feats category <name> - list feats in category
  if (subcommand === "category" || subcommand === "categories") {
    if (args.length < 2) {
      // Show available categories
      const categories = await getCategories();
      const catList = categories
        .map((c) => `  ${c.name} (${c.count} feats)`)
        .join("\n");
      return {
        success: true,
        message: `Feat categories:\n${catList}\nUse "feats category <name>" to list feats in a category.`,
      };
    }

    const categoryName = args.slice(1).join(" ");
    const featsInCategory = await getFeatsByCategory(categoryName, true);

    if (featsInCategory.length === 0) {
      return {
        success: false,
        message: `No supported feats found in category "${categoryName}".`,
      };
    }

    const featList = featsInCategory.map((f) => `  ${f.name}`).join("\n");
    return {
      success: true,
      message: `Feats in ${categoryName}:\n${featList}`,
    };
  }

  // Unknown subcommand - treat as feat name for info
  const featName = args.join(" ");
  const feat = await getFeatByName(featName);

  if (feat) {
    // Redirect to info
    return handleFeats(["info", ...args], context);
  }

  return {
    success: false,
    message: `Unknown feats subcommand "${subcommand}". Try: feats, feats available, feats info <name>, feats acquire <name>, feats category <name>`,
  };
}

/**
 * Handle the stance command - activate or deactivate combat stances.
 * @param args - Command arguments (stance name or "off")
 * @param context - Command context with player info
 * @returns Command result with success/failure message
 */
export async function handleStance(
  args: string[],
  context: CommandContext,
): Promise<CommandResult> {
  const playerId = context.player.id;

  // No args - show current stance
  if (args.length === 0) {
    const activeStance = await getActiveStance(playerId);

    if (!activeStance) {
      return {
        success: true,
        message:
          'You are not in any combat stance. Use "stance <name>" to activate one.',
      };
    }

    return {
      success: true,
      message: `You are in ${activeStance.name} stance. Use "stance off" to deactivate.`,
    };
  }

  const stanceArg = args.join(" ").toLowerCase();

  // stance off - deactivate
  if (stanceArg === "off" || stanceArg === "none" || stanceArg === "clear") {
    const result = await setActiveStance(playerId, null);

    if (!result.success) {
      return { success: false, message: result.message };
    }

    return {
      success: true,
      message: "You relax your combat stance.",
    };
  }

  // stance <name> - activate
  const stanceName = args.join(" ");
  const feat = await getFeatByName(stanceName);

  if (!feat) {
    return {
      success: false,
      message: `No stance found matching "${stanceName}".`,
    };
  }

  const result = await setActiveStance(playerId, feat.id);

  return {
    success: result.success,
    message: result.message,
  };
}
