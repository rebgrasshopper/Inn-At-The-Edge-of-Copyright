/**
 * Item finder functions - shared utilities for locating items in various inventories.
 */

import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  containerInventory,
  containers,
  items,
  playerInventory,
  roomInventory,
} from "../../db/schema.js";
import {
  findItemByName,
  type InventoryEntry,
  type ItemFindResult,
} from "../ItemService.utils.js";

/**
 * Find an item in room inventory by name (exact, prefix, or word match).
 * @param roomId - The room to search
 * @param itemName - The name to search for
 * @returns ItemFindResult or null if not found
 */
export async function findItemInRoom(
  roomId: string,
  itemName: string,
): Promise<ItemFindResult | null> {
  const roomItems = await db
    .select()
    .from(roomInventory)
    .innerJoin(items, eq(roomInventory.itemId, items.id))
    .where(eq(roomInventory.roomId, roomId));

  const entries: InventoryEntry<(typeof roomItems)[0]["room_inventory"]>[] =
    roomItems.map((r) => ({
      itemRecord: { name: r.items.name, pluralName: r.items.pluralName },
      inventoryRecord: r.room_inventory,
      rawItem: r.items,
    }));

  const result = findItemByName(entries, itemName);
  if (!result) return null;

  return {
    item: result.item,
    inventoryId: result.inventoryRecord.id,
    quantity: result.inventoryRecord.quantity,
    matchedPlural: result.matchedPlural,
  };
}

/**
 * Find an item in player inventory by name (exact, prefix, or word match).
 * @param playerId - The player to search
 * @param itemName - The name to search for
 * @returns ItemFindResult or null if not found
 */
export async function findItemInPlayerInventory(
  playerId: string,
  itemName: string,
): Promise<ItemFindResult | null> {
  const playerItems = await db
    .select()
    .from(playerInventory)
    .innerJoin(items, eq(playerInventory.itemId, items.id))
    .where(eq(playerInventory.playerId, playerId));

  const entries: InventoryEntry<(typeof playerItems)[0]["player_inventory"]>[] =
    playerItems.map((r) => ({
      itemRecord: { name: r.items.name, pluralName: r.items.pluralName },
      inventoryRecord: r.player_inventory,
      rawItem: r.items,
    }));

  const result = findItemByName(entries, itemName);
  if (!result) return null;

  return {
    item: result.item,
    inventoryId: result.inventoryRecord.id,
    quantity: result.inventoryRecord.quantity,
    matchedPlural: result.matchedPlural,
  };
}

/**
 * Find an item in a container by name (exact, prefix, or word match).
 * @param containerId - The container to search
 * @param itemName - The name to search for
 * @returns ItemFindResult or null if not found
 */
export async function findItemInContainer(
  containerId: string,
  itemName: string,
): Promise<ItemFindResult | null> {
  const containerItems = await db
    .select()
    .from(containerInventory)
    .innerJoin(items, eq(containerInventory.itemId, items.id))
    .where(eq(containerInventory.containerId, containerId));

  const entries: InventoryEntry<
    (typeof containerItems)[0]["container_inventory"]
  >[] = containerItems.map((r) => ({
    itemRecord: { name: r.items.name, pluralName: r.items.pluralName },
    inventoryRecord: r.container_inventory,
    rawItem: r.items,
  }));

  const result = findItemByName(entries, itemName);
  if (!result) return null;

  return {
    item: result.item,
    inventoryId: result.inventoryRecord.id,
    quantity: result.inventoryRecord.quantity,
    matchedPlural: result.matchedPlural,
  };
}

/**
 * Get all open, visible containers in a room.
 * @param roomId - The room to search
 * @returns Array of open containers
 */
export async function getOpenContainersInRoom(roomId: string) {
  return db
    .select()
    .from(containers)
    .where(
      and(
        eq(containers.roomId, roomId),
        eq(containers.isOpen, true),
        eq(containers.isHidden, false),
      ),
    );
}

/**
 * Find a visible container in a room by name (exact, prefix, word match, or alias).
 * @param roomId - The room to search
 * @param containerName - The name to search for
 * @returns The container or null if not found
 */
export async function findContainerInRoom(
  roomId: string,
  containerName: string,
) {
  const containerList = await db
    .select()
    .from(containers)
    .where(and(eq(containers.roomId, roomId), eq(containers.isHidden, false)));

  const nameLower = containerName.toLowerCase();

  // Helper to check if a container matches
  const matchesName = (
    c: (typeof containerList)[0],
    matchFn: (name: string) => boolean,
  ) => {
    // Check main name
    if (matchFn(c.name.toLowerCase())) return true;
    // Check aliases
    const aliases = (c.aliases as string[] | null) || [];
    return aliases.some((alias) => matchFn(alias.toLowerCase()));
  };

  // Try exact match first
  const exactMatch = containerList.find((c) =>
    matchesName(c, (name) => name === nameLower),
  );
  if (exactMatch) return exactMatch;

  // Try prefix match
  const prefixMatch = containerList.find((c) =>
    matchesName(c, (name) => name.startsWith(nameLower)),
  );
  if (prefixMatch) return prefixMatch;

  // Try word match (any word starts with search term)
  const wordMatch = containerList.find((c) =>
    matchesName(c, (name) => {
      const words = name.split(/\s+/);
      return words.some((w) => w.startsWith(nameLower));
    }),
  );
  if (wordMatch) return wordMatch;

  return null;
}
