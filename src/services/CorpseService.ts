/**
 * Corpse service for managing player corpses and looting.
 * Handles corpse access control based on ownership and time locks.
 */

import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  corpseInventory,
  corpses,
  items,
  playerInventory,
} from "../db/schema.js";

/** Corpse lock duration in milliseconds (1 hour) */
const CORPSE_LOCK_DURATION_MS = 60 * 60 * 1000;

/**
 * Corpse data with inventory
 */
export type CorpseWithInventory = {
  id: string;
  playerId: string;
  roomId: string;
  createdAt: Date;
  unlocksAt: Date;
  inventory: Array<{
    itemId: string;
    itemName: string;
    quantity: number;
  }>;
};

/**
 * Create a corpse for a dead player
 * @param playerId - The dead player's ID
 * @param roomId - The room where death occurred
 * @returns The created corpse ID
 */
export async function createCorpse(
  playerId: string,
  roomId: string,
): Promise<string> {
  const corpseId = randomUUID();
  const now = new Date();
  const unlocksAt = new Date(now.getTime() + CORPSE_LOCK_DURATION_MS);

  await db.insert(corpses).values({
    id: corpseId,
    playerId,
    roomId,
    createdAt: now,
    unlocksAt,
  });

  return corpseId;
}

/**
 * Transfer all player inventory to a corpse
 * @param playerId - The player whose inventory to transfer
 * @param corpseId - The target corpse ID
 */
export async function transferInventoryToCorpse(
  playerId: string,
  corpseId: string,
): Promise<void> {
  const inventory = await db
    .select()
    .from(playerInventory)
    .where(eq(playerInventory.playerId, playerId));

  for (const item of inventory) {
    await db.insert(corpseInventory).values({
      id: randomUUID(),
      corpseId,
      itemId: item.itemId,
      quantity: item.quantity,
    });
  }

  // Clear player inventory
  await db
    .delete(playerInventory)
    .where(eq(playerInventory.playerId, playerId));
}

/**
 * Check if a player can loot a corpse
 * @param playerId - The player attempting to loot
 * @param corpseId - The target corpse ID
 * @returns Whether looting is allowed
 */
export async function canLootCorpse(
  playerId: string,
  corpseId: string,
): Promise<boolean> {
  const corpse = await db
    .select()
    .from(corpses)
    .where(eq(corpses.id, corpseId))
    .get();

  if (!corpse) return false;

  const now = new Date();

  // Owner can always loot their own corpse
  if (corpse.playerId === playerId) return true;

  // Others can loot after unlock time
  return now >= corpse.unlocksAt;
}

/**
 * Get a corpse with its inventory
 * @param corpseId - The corpse ID
 * @returns Corpse data with inventory or null if not found
 */
export async function getCorpseWithInventory(
  corpseId: string,
): Promise<CorpseWithInventory | null> {
  const corpse = await db
    .select()
    .from(corpses)
    .where(eq(corpses.id, corpseId))
    .get();

  if (!corpse) return null;

  const inventoryRecords = await db
    .select()
    .from(corpseInventory)
    .innerJoin(items, eq(corpseInventory.itemId, items.id))
    .where(eq(corpseInventory.corpseId, corpseId));

  return {
    id: corpse.id,
    playerId: corpse.playerId,
    roomId: corpse.roomId,
    createdAt: corpse.createdAt,
    unlocksAt: corpse.unlocksAt,
    inventory: inventoryRecords.map((record) => ({
      itemId: record.items.id,
      itemName: record.items.name,
      quantity: record.corpse_inventory.quantity,
    })),
  };
}

/**
 * Get all corpses in a room
 * @param roomId - The room ID
 * @returns Array of corpses in the room
 */
export async function getCorpsesInRoom(
  roomId: string,
): Promise<CorpseWithInventory[]> {
  const roomCorpses = await db
    .select()
    .from(corpses)
    .where(eq(corpses.roomId, roomId));

  const result: CorpseWithInventory[] = [];

  for (const corpse of roomCorpses) {
    const withInventory = await getCorpseWithInventory(corpse.id);
    if (withInventory) {
      result.push(withInventory);
    }
  }

  return result;
}

/**
 * Loot an item from a corpse
 * @param playerId - The player looting
 * @param corpseId - The corpse to loot from
 * @param itemId - The item to take
 * @param quantity - How many to take (default 1)
 * @returns Success status and message
 */
export async function lootFromCorpse(
  playerId: string,
  corpseId: string,
  itemId: string,
  quantity: number = 1,
): Promise<{ success: boolean; message: string }> {
  // Check if player can loot
  if (!(await canLootCorpse(playerId, corpseId))) {
    return {
      success: false,
      message: "You cannot loot this corpse yet.",
    };
  }

  // Find the item in corpse inventory
  const corpseItem = await db
    .select()
    .from(corpseInventory)
    .where(
      and(
        eq(corpseInventory.corpseId, corpseId),
        eq(corpseInventory.itemId, itemId),
      ),
    )
    .get();

  if (!corpseItem) {
    return { success: false, message: "That item isn't in the corpse." };
  }

  if (corpseItem.quantity < quantity) {
    return { success: false, message: "There aren't that many." };
  }

  // Transfer to player inventory
  const existingPlayerItem = await db
    .select()
    .from(playerInventory)
    .where(
      and(
        eq(playerInventory.playerId, playerId),
        eq(playerInventory.itemId, itemId),
      ),
    )
    .get();

  if (existingPlayerItem) {
    await db
      .update(playerInventory)
      .set({ quantity: existingPlayerItem.quantity + quantity })
      .where(eq(playerInventory.id, existingPlayerItem.id));
  } else {
    await db.insert(playerInventory).values({
      id: randomUUID(),
      playerId,
      itemId,
      quantity,
    });
  }

  // Update or remove from corpse
  if (corpseItem.quantity === quantity) {
    await db
      .delete(corpseInventory)
      .where(eq(corpseInventory.id, corpseItem.id));
  } else {
    await db
      .update(corpseInventory)
      .set({ quantity: corpseItem.quantity - quantity })
      .where(eq(corpseInventory.id, corpseItem.id));
  }

  // Check if corpse is now empty and remove it
  const remainingItems = await db
    .select()
    .from(corpseInventory)
    .where(eq(corpseInventory.corpseId, corpseId));

  if (remainingItems.length === 0) {
    await db.delete(corpses).where(eq(corpses.id, corpseId));
  }

  return { success: true, message: "You take the item from the corpse." };
}

/**
 * Clean up old empty corpses (maintenance function)
 * @returns Number of corpses removed
 */
export async function cleanupEmptyCorpses(): Promise<number> {
  const allCorpses = await db.select().from(corpses);
  let removed = 0;

  for (const corpse of allCorpses) {
    const items = await db
      .select()
      .from(corpseInventory)
      .where(eq(corpseInventory.corpseId, corpse.id));

    if (items.length === 0) {
      await db.delete(corpses).where(eq(corpses.id, corpse.id));
      removed++;
    }
  }

  return removed;
}
