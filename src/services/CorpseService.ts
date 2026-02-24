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
  players,
} from "../db/schema.js";
import { fuzzyMatch } from "../utils/fuzzyMatch.js";

/** Corpse lock duration in milliseconds (1 hour) */
const CORPSE_LOCK_DURATION_MS = 60 * 60 * 1000;

/** Corpse expiration duration in milliseconds (24 hours) */
const CORPSE_EXPIRATION_MS = 24 * 60 * 60 * 1000;

/**
 * Corpse data with inventory
 */
export type CorpseWithInventory = {
  id: string;
  playerId: string;
  playerName: string;
  roomId: string;
  createdAt: Date;
  unlocksAt: Date;
  inventory: Array<{
    itemId: string;
    itemName: string;
    itemPluralName: string | null;
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
  const expiresAt = new Date(now.getTime() + CORPSE_EXPIRATION_MS);

  await db.insert(corpses).values({
    id: corpseId,
    playerId,
    roomId,
    createdAt: now,
    unlocksAt,
    expiresAt,
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
  const corpseRecord = await db
    .select()
    .from(corpses)
    .innerJoin(players, eq(corpses.playerId, players.id))
    .where(eq(corpses.id, corpseId))
    .get();

  if (!corpseRecord) return null;

  const inventoryRecords = await db
    .select()
    .from(corpseInventory)
    .innerJoin(items, eq(corpseInventory.itemId, items.id))
    .where(eq(corpseInventory.corpseId, corpseId));

  return {
    id: corpseRecord.corpses.id,
    playerId: corpseRecord.corpses.playerId,
    playerName: corpseRecord.players.name,
    roomId: corpseRecord.corpses.roomId,
    createdAt: corpseRecord.corpses.createdAt,
    unlocksAt: corpseRecord.corpses.unlocksAt,
    inventory: inventoryRecords.map((record) => ({
      itemId: record.items.id,
      itemName: record.items.name,
      itemPluralName: record.items.pluralName,
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

/** Result of finding a corpse in a room */
export type FindCorpseResult =
  | { found: true; corpse: CorpseWithInventory }
  | { found: false; error: string };

/**
 * Find a corpse in a room by target string.
 * Handles "corpse", "corpse of X", and partial name matching.
 * Disambiguates only when there are corpses with different player names.
 * @param roomId - The room to search
 * @param target - The target string (e.g., "corpse", "corpse of djim")
 * @returns The found corpse or an error message
 */
export async function findCorpseInRoom(
  roomId: string,
  target: string,
): Promise<FindCorpseResult> {
  const roomCorpses = await getCorpsesInRoom(roomId);

  if (roomCorpses.length === 0) {
    return { found: false, error: "There are no corpses here." };
  }

  const targetLower = target.toLowerCase().trim();

  // Check for "corpse of X" pattern
  const corpseOfMatch = targetLower.match(/^corpse\s+of\s+(.+)$/);
  if (corpseOfMatch) {
    const nameQuery = corpseOfMatch[1];
    const matches = roomCorpses.filter((c) =>
      c.playerName.toLowerCase().startsWith(nameQuery),
    );

    if (matches.length === 0) {
      return {
        found: false,
        error: `There is no corpse of "${nameQuery}" here.`,
      };
    }
    // Return first match - if multiple have same name, just pick first
    return { found: true, corpse: matches[0] };
  }

  // Just "corpse" - check if we need to disambiguate
  if (targetLower === "corpse") {
    // Get unique player names
    const uniqueNames = new Set(roomCorpses.map((c) => c.playerName));

    if (uniqueNames.size === 1) {
      // All corpses belong to same player, return first
      return { found: true, corpse: roomCorpses[0] };
    }

    // Multiple different players - ask for disambiguation
    const names = [...uniqueNames]
      .map((name) => `corpse of ${name}`)
      .join(", ");
    return { found: false, error: `Which corpse? (${names})` };
  }

  return { found: false, error: `You don't see any "${target}" here.` };
}

/** Result of looting from a corpse */
export type LootResult = {
  success: boolean;
  message: string;
  /** If the corpse was deleted after looting, contains info for broadcast */
  corpseDeleted?: {
    playerName: string;
    roomId: string;
  };
};

/**
 * Loot an item from a corpse
 * @param playerId - The player looting
 * @param corpseId - The corpse to loot from
 * @param itemId - The item to take
 * @param quantity - How many to take (default 1)
 * @param corpseInfo - Optional corpse info for deletion tracking
 * @returns Success status, message, and corpse deletion info if applicable
 */
export async function lootFromCorpse(
  playerId: string,
  corpseId: string,
  itemId: string,
  quantity: number = 1,
  corpseInfo?: { playerName: string; roomId: string },
): Promise<LootResult> {
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
    return {
      success: true,
      message: "You take the item from the corpse.",
      corpseDeleted: corpseInfo,
    };
  }

  return { success: true, message: "You take the item from the corpse." };
}

/**
 * Loot an item from a corpse by item name
 * @param playerId - The player looting
 * @param corpse - The corpse to loot from
 * @param itemName - The item name to search for, or "all"
 * @param quantity - How many to take (default 1, or "all")
 * @returns Success status, message, and corpse deletion info if applicable
 */
export async function lootItemByName(
  playerId: string,
  corpse: CorpseWithInventory,
  itemName: string,
  quantity: number | "all" = 1,
): Promise<LootResult> {
  // Check if player can loot
  if (!(await canLootCorpse(playerId, corpse.id))) {
    return {
      success: false,
      message: "You cannot loot this corpse yet.",
    };
  }

  const corpseInfo = { playerName: corpse.playerName, roomId: corpse.roomId };
  const itemNameLower = itemName.toLowerCase();

  // Handle "all" - loot everything
  if (itemNameLower === "all") {
    if (corpse.inventory.length === 0) {
      return { success: false, message: "The corpse is empty." };
    }

    const takenItems: string[] = [];
    let lastResult: LootResult | null = null;

    for (const item of corpse.inventory) {
      const result = await lootFromCorpse(
        playerId,
        corpse.id,
        item.itemId,
        item.quantity,
        corpseInfo,
      );
      if (result.success) {
        takenItems.push(
          item.quantity === 1
            ? item.itemName
            : `${item.quantity} ${item.itemName}`,
        );
        lastResult = result;
      }
    }

    if (takenItems.length === 0) {
      return { success: false, message: "You couldn't take anything." };
    }

    return {
      success: true,
      message: `You take ${takenItems.join(", ")} from the corpse.`,
      corpseDeleted: lastResult?.corpseDeleted,
    };
  }

  // Find item by name using fuzzy matching
  let matchedPlural = false;
  const matchingItem = corpse.inventory.find((item) => {
    const result = fuzzyMatch(itemName, item.itemName, item.itemPluralName);
    if (result.matches) {
      matchedPlural = result.matchedPlural;
      return true;
    }
    return false;
  });

  if (!matchingItem) {
    return {
      success: false,
      message: `The corpse doesn't contain "${itemName}".`,
    };
  }

  // Determine quantity to take - plural match implies "all"
  let takeQty: number;
  if (quantity === "all" || matchedPlural) {
    takeQty = matchingItem.quantity;
  } else {
    takeQty = quantity;
  }

  const result = await lootFromCorpse(
    playerId,
    corpse.id,
    matchingItem.itemId,
    takeQty,
    corpseInfo,
  );

  if (result.success) {
    const displayName =
      takeQty === 1
        ? matchingItem.itemName
        : matchingItem.itemPluralName || `${matchingItem.itemName}s`;
    const itemDesc = takeQty === 1 ? displayName : `${takeQty} ${displayName}`;
    return {
      success: true,
      message: `You take ${itemDesc} from the corpse of ${corpse.playerName}.`,
      corpseDeleted: result.corpseDeleted,
    };
  }

  return result;
}

/**
 * Clean up old empty corpses (maintenance function)
 * @returns Number of corpses removed
 */
export async function cleanupEmptyCorpses(): Promise<number> {
  const allCorpses = await db.select().from(corpses);
  let removed = 0;

  for (const corpse of allCorpses) {
    const corpseItems = await db
      .select()
      .from(corpseInventory)
      .where(eq(corpseInventory.corpseId, corpse.id));

    if (corpseItems.length === 0) {
      await db.delete(corpses).where(eq(corpses.id, corpse.id));
      removed++;
    }
  }

  return removed;
}

/** Info about an expired corpse for broadcast */
export type ExpiredCorpseInfo = {
  playerName: string;
  roomId: string;
};

/**
 * Clean up expired corpses (older than 24 hours)
 * @returns Array of expired corpse info for broadcasting disappearance messages
 */
export async function cleanupExpiredCorpses(): Promise<ExpiredCorpseInfo[]> {
  const now = new Date();
  const expiredCorpses: ExpiredCorpseInfo[] = [];

  // Get all corpses with player names
  const allCorpses = await db
    .select()
    .from(corpses)
    .innerJoin(players, eq(corpses.playerId, players.id));

  for (const record of allCorpses) {
    if (record.corpses.expiresAt && record.corpses.expiresAt <= now) {
      expiredCorpses.push({
        playerName: record.players.name,
        roomId: record.corpses.roomId,
      });

      // Delete corpse inventory first
      await db
        .delete(corpseInventory)
        .where(eq(corpseInventory.corpseId, record.corpses.id));

      // Delete the corpse
      await db.delete(corpses).where(eq(corpses.id, record.corpses.id));
    }
  }

  return expiredCorpses;
}
