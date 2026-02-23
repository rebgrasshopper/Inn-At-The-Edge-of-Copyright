/**
 * Item examination functions - examineItem and getInventory.
 */

import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { items, playerInventory } from "../../db/schema.js";
import type { Item, ItemStack } from "../../types/item.js";
import { generateStatsDescription, toItem } from "../ItemService.utils.js";
import { getPlayerEquipment } from "./equipment.js";
import {
  findItemInContainer,
  findItemInPlayerInventory,
  findItemInRoom,
  getOpenContainersInRoom,
} from "./finders.js";

export type ExamineContext = {
  playerId: string;
  roomId: string;
};

/**
 * Examine an item and return its description.
 * @param playerId - The player examining the item
 * @param roomId - The room the player is in
 * @param itemName - The name of the item to examine
 * @param searchOwn - If true, search own inventory first (for "examine my X")
 * @returns Description string or error message
 */
export async function examineItem(
  playerId: string,
  roomId: string,
  itemName: string,
  searchOwn: boolean = false,
): Promise<{ success: boolean; description: string }> {
  let item: Item | null = null;
  let isOwnItem = false;

  if (searchOwn) {
    // Search own inventory first
    const ownItem = await findItemInPlayerInventory(playerId, itemName);
    if (ownItem) {
      item = ownItem.item;
      isOwnItem = true;
    }
  }

  if (!item) {
    // Search room inventory
    const roomItem = await findItemInRoom(roomId, itemName);
    if (roomItem) {
      item = roomItem.item;
    }
  }

  if (!item && !searchOwn) {
    // Search own inventory (if not already searched)
    const ownItem = await findItemInPlayerInventory(playerId, itemName);
    if (ownItem) {
      item = ownItem.item;
      isOwnItem = true;
    }
  }

  if (!item) {
    // Search open containers
    const openContainers = await getOpenContainersInRoom(roomId);
    for (const container of openContainers) {
      const containerItem = await findItemInContainer(container.id, itemName);
      if (containerItem) {
        item = containerItem.item;
        break;
      }
    }
  }

  // TODO: Search worn items on other players, NPCs, monsters

  if (!item) {
    return {
      success: false,
      description: `You don't see any "${itemName}" here.`,
    };
  }

  // Build description
  let description = item.description;

  // Add private stats info if it's the player's own item
  if (isOwnItem) {
    const statsDesc = generateStatsDescription(item);
    if (statsDesc) {
      description += `\n${statsDesc}`;
    }
  }

  return { success: true, description };
}

/**
 * Get a player's inventory (excluding equipped items).
 * @param playerId - The player whose inventory to retrieve
 * @returns Array of ItemStacks
 */
export async function getInventory(playerId: string): Promise<ItemStack[]> {
  // Get equipped item IDs to exclude
  const equipment = await getPlayerEquipment(playerId);
  const equippedItemIds = new Set<string>();
  if (equipment) {
    for (const itemId of Object.values(equipment)) {
      if (itemId) equippedItemIds.add(itemId);
    }
  }

  const inventoryRows = await db
    .select()
    .from(playerInventory)
    .innerJoin(items, eq(playerInventory.itemId, items.id))
    .where(eq(playerInventory.playerId, playerId));

  // Filter out equipped items
  return inventoryRows
    .filter((row) => !equippedItemIds.has(row.items.id))
    .map((row) => ({
      item: toItem(row.items),
      quantity: row.player_inventory.quantity,
    }));
}
