/**
 * Item command handlers.
 */

import { eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { players } from "../../../db/schema.js";
import type { CommandContext, CommandResult } from "../../../types/command.js";
import * as FeatureService from "../../FeatureService.js";
import * as ItemService from "../../items/index.js";

/**
 * Parse quantity from args if present (e.g., "3" or "all")
 */
function parseQuantity(args: string[]): {
  quantity: number | "all" | undefined;
  remainingArgs: string[];
} {
  if (args.length === 0) {
    return { quantity: undefined, remainingArgs: args };
  }

  const first = args[0];

  if (first === "all") {
    return { quantity: "all", remainingArgs: args.slice(1) };
  }

  const num = parseInt(first, 10);
  if (!isNaN(num) && num > 0) {
    return { quantity: num, remainingArgs: args.slice(1) };
  }

  return { quantity: undefined, remainingArgs: args };
}

/**
 * Handle get/take command
 */
export async function handleGet(
  args: string[],
  context: CommandContext,
): Promise<CommandResult> {
  const { player, room } = context;
  const { quantity, remainingArgs } = parseQuantity(args);
  const target = remainingArgs.join(" ");

  if (!target) {
    return { success: false, message: "What do you want to pick up?" };
  }

  // Check for "get X from Y" pattern
  const fromMatch = target.match(/^(.+?)\s+from\s+(.+)$/i);
  if (fromMatch) {
    const [, itemName, containerName] = fromMatch;
    const result = await ItemService.getItemFromContainer(
      player.id,
      room.id,
      itemName.trim(),
      containerName.trim(),
      quantity,
    );
    return { success: result.success, message: result.message };
  }

  const result = await ItemService.getItem(
    player.id,
    room.id,
    target,
    quantity,
  );
  return { success: result.success, message: result.message };
}

/**
 * Handle drop command
 */
export async function handleDrop(
  args: string[],
  context: CommandContext,
): Promise<CommandResult> {
  const { player, room } = context;
  const { quantity, remainingArgs } = parseQuantity(args);
  const target = remainingArgs.join(" ");

  if (!target) {
    return { success: false, message: "What do you want to drop?" };
  }

  const result = await ItemService.dropItem(
    player.id,
    room.id,
    target,
    quantity,
  );
  return { success: result.success, message: result.message };
}

/**
 * Handle put/place command
 */
export async function handlePut(
  args: string[],
  context: CommandContext,
): Promise<CommandResult> {
  const { player, room } = context;
  const { quantity, remainingArgs } = parseQuantity(args);
  const target = remainingArgs.join(" ");

  if (!target) {
    return { success: false, message: "What do you want to put, and where?" };
  }

  // Check for "put X in Y" pattern
  const inMatch = target.match(/^(.+?)\s+in\s+(.+)$/i);
  if (!inMatch) {
    return {
      success: false,
      message: "Put what in what? Try: put <item> in <container>",
    };
  }

  const [, itemName, containerName] = inMatch;
  const result = await ItemService.putItemInContainer(
    player.id,
    room.id,
    itemName.trim(),
    containerName.trim(),
    quantity,
  );
  return { success: result.success, message: result.message };
}

/**
 * Handle examine/inspect command
 */
export async function handleExamine(
  args: string[],
  context: CommandContext,
): Promise<CommandResult> {
  const { player, room } = context;
  const target = args.join(" ");

  if (!target) {
    return { success: false, message: "What do you want to examine?" };
  }

  // Check for self-examination
  const selfWords = ["self", "me", "myself", player.name.toLowerCase()];
  if (selfWords.includes(target.toLowerCase())) {
    // Fetch fresh player data from database to get current HP/XP
    const freshPlayer = await db
      .select()
      .from(players)
      .where(eq(players.id, player.id))
      .get();

    if (!freshPlayer) {
      return { success: false, message: "Player not found." };
    }

    // Show character info with equipment
    const equipResult = await ItemService.getEquipmentList(player.id);
    const lines = [
      `${freshPlayer.name} - Level ${freshPlayer.level}`,
      `HP: ${freshPlayer.currentHp}/${freshPlayer.maxHp}  XP: ${freshPlayer.xp}`,
      `STR: ${freshPlayer.str}  DEX: ${freshPlayer.dex}  CON: ${freshPlayer.con}`,
      `INT: ${freshPlayer.int}  WIS: ${freshPlayer.wis}  CHA: ${freshPlayer.cha}`,
      "",
      equipResult.message,
    ];
    return { success: true, message: lines.join("\n") };
  }

  // Check for "examine my X" pattern
  const myMatch = target.match(/^my\s+(.+)$/i);
  const searchOwn = !!myMatch;
  const itemName = myMatch ? myMatch[1] : target;

  const result = await ItemService.examineItem(
    player.id,
    room.id,
    itemName,
    searchOwn,
  );

  // If item not found, check for a feature by name (just show description)
  if (!result.success) {
    const feature = await FeatureService.findFeatureByName(room.id, target);
    if (feature) {
      return { success: true, message: feature.description };
    }

    // If no feature by name, check for a container
    const containerResult = await ItemService.examineContainer(room.id, target);
    if (containerResult.success) {
      return { success: true, message: containerResult.description };
    }
  }

  return { success: result.success, message: result.description };
}

/**
 * Handle inventory command
 */
export async function handleInventory(
  _args: string[],
  context: CommandContext,
): Promise<CommandResult> {
  const { player } = context;

  const inventory = await ItemService.getInventory(player.id);
  if (inventory.length === 0) {
    return { success: true, message: "You are not carrying anything." };
  }

  const lines = ["You are carrying:"];
  for (const stack of inventory) {
    if (stack.quantity === 1) {
      lines.push(`  ${stack.item.name}`);
    } else {
      const name = stack.item.pluralName || `${stack.item.name}s`;
      lines.push(`  ${stack.quantity} ${name}`);
    }
  }
  return { success: true, message: lines.join("\n") };
}

/**
 * Handle equip/wear command
 */
export async function handleEquip(
  args: string[],
  context: CommandContext,
): Promise<CommandResult> {
  const { player } = context;
  const target = args.join(" ");

  if (!target) {
    return { success: false, message: "What do you want to equip?" };
  }

  // Check for "equip X on Y" or "equip X to Y" pattern
  const slotMatch = target.match(/^(.+?)\s+(?:on|to)\s+(.+)$/i);
  if (slotMatch) {
    const [, itemName, slotName] = slotMatch;
    const result = await ItemService.equipItem(
      player.id,
      itemName.trim(),
      slotName.trim(),
    );
    return { success: result.success, message: result.message };
  }

  const result = await ItemService.equipItem(player.id, target);
  return { success: result.success, message: result.message };
}

/**
 * Handle unequip/remove command
 */
export async function handleUnequip(
  args: string[],
  context: CommandContext,
): Promise<CommandResult> {
  const { player } = context;
  const target = args.join(" ");

  if (!target) {
    return { success: false, message: "What do you want to unequip?" };
  }

  const result = await ItemService.unequipItem(player.id, target);
  return { success: result.success, message: result.message };
}

/**
 * Handle equipment command
 */
export async function handleEquipment(
  _args: string[],
  context: CommandContext,
): Promise<CommandResult> {
  const { player } = context;

  const result = await ItemService.getEquipmentList(player.id);
  return { success: result.success, message: result.message };
}

/**
 * Handle open command
 */
export async function handleOpen(
  args: string[],
  context: CommandContext,
): Promise<CommandResult> {
  const { room } = context;
  const target = args.join(" ");

  if (!target) {
    return { success: false, message: "What do you want to open?" };
  }

  const result = await ItemService.openContainer(room.id, target);
  return { success: result.success, message: result.message };
}

/**
 * Handle close command
 */
export async function handleClose(
  args: string[],
  context: CommandContext,
): Promise<CommandResult> {
  const { room } = context;
  const target = args.join(" ");

  if (!target) {
    return { success: false, message: "What do you want to close?" };
  }

  const result = await ItemService.closeContainer(room.id, target);
  return { success: result.success, message: result.message };
}
