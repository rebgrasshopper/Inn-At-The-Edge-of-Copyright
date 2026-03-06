/**
 * Item command handlers.
 */

import { eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { players } from "../../../db/schema.js";
import type { CommandContext, CommandResult } from "../../../types/command.js";
import * as CorpseService from "../../CorpseService.js";
import * as FeatureService from "../../FeatureService.js";
import * as ItemService from "../../items/index.js";

/**
 * Parse quantity from args if present (e.g., "3" or "all")
 * Does NOT consume "all" if followed by "from" (that's "get all from X")
 */
function parseQuantity(args: string[]): {
  quantity: number | "all" | undefined;
  remainingArgs: string[];
} {
  if (args.length === 0) {
    return { quantity: undefined, remainingArgs: args };
  }

  const first = args[0];

  // Don't consume "all" if followed by "from" - that's "get all from X"
  if (first === "all" && args[1] !== "from") {
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
  const target = args.join(" ");

  if (!target) {
    return { success: false, message: "What do you want to pick up?" };
  }

  // Check for "get X from Y" pattern FIRST (before quantity parsing)
  const fromMatch = target.match(/^(.+?)\s+from\s+(.+)$/i);
  if (fromMatch) {
    const [, itemPart, sourceName] = fromMatch;
    const sourceNameLower = sourceName.trim().toLowerCase();

    // Parse quantity from the item part
    const itemTokens = itemPart.trim().split(/\s+/);
    let quantity: number | "all" | undefined;
    let itemName: string;

    if (itemTokens[0] === "all") {
      quantity = "all";
      itemName = "all";
    } else {
      const num = parseInt(itemTokens[0], 10);
      if (!isNaN(num) && num > 0) {
        quantity = num;
        itemName = itemTokens.slice(1).join(" ");
      } else {
        quantity = undefined;
        itemName = itemPart.trim();
      }
    }

    // Check if source is a corpse
    if (
      sourceNameLower === "corpse" ||
      sourceNameLower.startsWith("corpse of ")
    ) {
      const corpseResult = await CorpseService.findCorpseInRoom(
        room.id,
        sourceName.trim(),
      );
      if (!corpseResult.found) {
        return { success: false, message: corpseResult.error };
      }

      const lootResult = await CorpseService.lootItemByName(
        player.id,
        corpseResult.corpse,
        itemName,
        quantity,
      );

      // If corpse was deleted, add broadcast for disappearance message
      if (lootResult.corpseDeleted) {
        return {
          success: lootResult.success,
          message: lootResult.message,
          broadcast: [
            {
              room: lootResult.corpseDeleted.roomId,
              event: "chat:message",
              data: {
                id: crypto.randomUUID(),
                type: "system",
                content: `The corpse of ${lootResult.corpseDeleted.playerName} crumbles into dust and fades away.`,
                timestamp: new Date().toISOString(),
              },
            },
          ],
        };
      }

      return { success: lootResult.success, message: lootResult.message };
    }

    // Otherwise treat as container
    const result = await ItemService.getItemFromContainer(
      player.id,
      room.id,
      itemName,
      sourceName.trim(),
      quantity,
    );
    return { success: result.success, message: result.message };
  }

  // No "from" pattern - parse quantity normally
  const { quantity, remainingArgs } = parseQuantity(args);
  const itemTarget = remainingArgs.join(" ");

  if (!itemTarget) {
    return { success: false, message: "What do you want to pick up?" };
  }

  const result = await ItemService.getItem(
    player.id,
    room.id,
    itemTarget,
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
    const freshPlayer = db
      .select()
      .from(players)
      .where(eq(players.id, player.id))
      .get();

    if (!freshPlayer) {
      return { success: false, message: "Player not found." };
    }

    // Calculate AC
    const { calculateAC, calculateEquipmentConBonus } =
      await import("../../StatService.js");
    const { getEquippedItems } = await import("../../items/equipment.js");

    const equipped = await getEquippedItems(player.id);
    const equipConBonus = calculateEquipmentConBonus(equipped);
    const ac = await calculateAC(freshPlayer.dex, equipConBonus, player.id);

    // Show character info with equipment
    const equipResult = await ItemService.getEquipmentList(player.id);
    const lines = [
      `${freshPlayer.name} - Level ${freshPlayer.level}`,
      `HP: ${freshPlayer.currentHp}/${freshPlayer.maxHp}  AC: ${ac}  XP: ${freshPlayer.xp}`,
      `STR: ${freshPlayer.str}  DEX: ${freshPlayer.dex}  CON: ${freshPlayer.con}`,
      `INT: ${freshPlayer.int}  WIS: ${freshPlayer.wis}  CHA: ${freshPlayer.cha}`,
      "",
      equipResult.message,
    ];
    return { success: true, message: lines.join("\n") };
  }

  // Check for corpse examination
  const targetLower = target.toLowerCase();
  if (targetLower === "corpse" || targetLower.startsWith("corpse of ")) {
    const corpseResult = await CorpseService.findCorpseInRoom(room.id, target);
    if (!corpseResult.found) {
      return { success: false, message: corpseResult.error };
    }

    const corpse = corpseResult.corpse;
    const lines = [`The corpse of ${corpse.playerName}.`];

    if (corpse.inventory.length === 0) {
      lines.push("It is empty.");
    } else {
      lines.push("It contains:");
      for (const item of corpse.inventory) {
        if (item.quantity === 1) {
          lines.push(`  ${item.itemName}`);
        } else {
          const displayName = item.itemPluralName || `${item.itemName}s`;
          lines.push(`  ${item.quantity} ${displayName}`);
        }
      }
    }

    // Check if locked for this player
    const canLoot = await CorpseService.canLootCorpse(player.id, corpse.id);
    if (!canLoot) {
      const timeLeft = Math.ceil(
        (corpse.unlocksAt.getTime() - Date.now()) / 60000,
      );
      lines.push(`(Locked for ${timeLeft} more minutes)`);
    }

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
    const feature = await FeatureService.findFeatureByName(
      room.id,
      target,
      player.id,
    );
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
